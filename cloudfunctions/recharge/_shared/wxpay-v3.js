/**
 * 微信支付 API v3 工具库
 *
 * 纯 Node.js 内置模块实现，零外部依赖：
 * - crypto: RSA-SHA256 签名/验签、AES-256-GCM 加解密
 * - https: HTTP 请求
 *
 * 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012791856
 */

const crypto = require('crypto')
const https = require('https')

// ─── 环境变量读取 ───────────────────────────────────────────────

function env(name) {
  return String(process.env[name] || '').trim()
}

// 仅 PAY_DEBUG=true 时才打印支付敏感日志
function isPayDebug() {
  return String(process.env.PAY_DEBUG || '').trim() === 'true'
}

// ─── PEM / Base64 规范化 ───────────────────────────────────────

/**
 * 将环境变量中的密钥还原为 PEM 字符串。
 *
 * CloudBase 环境变量不支持直接存多行 PEM，因此采用两种存储格式：
 * 1. Base64 编码（推荐）：先 base64 编码再存入 → 运行时解码，零歧义
 * 2. \n 转义（兼容历史格式）：PEM 换行替换为 \n → 运行时还原
 *
 * 自动检测：不含 -----BEGIN 前缀 → Base64 解码；否则 → \n 还原
 */
function normalizePem(envValue) {
  if (!envValue) return ''
  let pem = envValue
  if (!pem.includes('-----BEGIN')) {
    // Base64 编码路径
    pem = Buffer.from(pem, 'base64').toString('utf8')
  } else {
    // 兼容历史 \n 转义路径
    pem = pem.replace(/\\n/g, '\n')
  }
  // 清除可能的 Windows CRLF → LF，确保 Node.js crypto 模块正常解析
  return pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// ─── 请求签名 ───────────────────────────────────────────────────

/**
 * 构造 WECHATPAY2-SHA256-RSA2048 Authorization 头
 *
 * @param {string} method - HTTP 方法（GET/POST）
 * @param {string} url - 完整 URL（含 query string）
 * @param {string} body - 请求体，GET 请求传空串 ''
 * @returns {{ authorization: string, timestamp: string, nonce: string }}
 */
function signRequest(method, url, body) {
  const rawKey = env('WXPAY_PRIVATE_KEY')
  const privateKey = normalizePem(rawKey)
  const mchid = env('WXPAY_MCHID')
  const serialNo = env('WXPAY_SERIAL_NO')

  if (isPayDebug()) {
    console.log('[WXPAY][sign] mchid=%s serialNo=%s keyReady=%s',
      mchid, serialNo, privateKey.length > 0)
  }

  const u = new URL(url)
  const canonicalUrl = u.pathname + (u.search || '')
  const timestamp = Math.floor(Date.now() / 1000)
  // 官方示例: Math.random().toString(36).substr(2, 15)
  const nonce = Math.random().toString(36).substr(2, 15)
  const bodyStr = body || ''

  // 签名串: HTTP方法\nURL路径\n时间戳\n随机串\n请求体\n（与微信官方示例逐字一致）
  const message = method + '\n' + canonicalUrl + '\n' + timestamp + '\n' + nonce + '\n' + bodyStr + '\n'

  if (isPayDebug()) {
    console.log('[WXPAY][sign] signMessage前120=%s', message.slice(0, 120))
  }

  // 微信官方示例: crypto.createSign('RSA-SHA256').update(signStr).sign(privateKey, 'base64')
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')

  // Authorization 格式与微信官方示例逐字一致
  const authorization = 'WECHATPAY2-SHA256-RSA2048 ' +
    'mchid="' + mchid + '",' +
    'nonce_str="' + nonce + '",' +
    'signature="' + signature + '",' +
    'timestamp="' + timestamp + '",' +
    'serial_no="' + serialNo + '"'

  return { authorization, timestamp, nonce }
}

// ─── HTTP 请求封装 ──────────────────────────────────────────────

/**
 * 通用微信支付 API v3 请求
 *
 * @param {string} method - GET / POST
 * @param {string} path - 路径，如 /v3/pay/transactions/jsapi
 * @param {object|string} body - 请求体对象或空串
 * @returns {Promise<{ success: boolean, data?: object, error?: object, statusCode?: number }>}
 */
function wechatpayRequest(method, path, body) {
  const url = `https://api.mch.weixin.qq.com${path}`
  const bodyStr = body && typeof body === 'object' ? JSON.stringify(body) : (body || '')
  const { authorization } = signRequest(method, url, bodyStr)

  if (isPayDebug()) {
    console.log('[WXPAY][req] %s %s bodyLen=%s', method, path, bodyStr.length)
  }

  const u = new URL(url)
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
    'Authorization': authorization,
    'User-Agent': 'cloudbase-recharge/1.0'
  }
  if (bodyStr) {
    headers['Content-Length'] = Buffer.byteLength(bodyStr)
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      headers,
      timeout: 8000
    }, res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed = null
        try { parsed = data ? JSON.parse(data) : {} } catch (_) { /* raw text */ }
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          // 微信支付 API v3 查单返回 200 + JSON
          resolve({ success: true, data: parsed || {}, statusCode: res.statusCode })
        } else {
          console.error('[WXPAY] API error:', res.statusCode, JSON.stringify(parsed || data).slice(0, 500))
          resolve({ success: false, error: parsed || { message: String(data).slice(0, 200) }, statusCode: res.statusCode })
        }
      })
    })
    req.on('error', err => {
      console.error('[WXPAY] request error:', err.message)
      reject(err)
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('WeChat Pay request timeout'))
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── 统一下单 ───────────────────────────────────────────────────

/**
 * JSAPI 统一下单
 *
 * POST /v3/pay/transactions/jsapi
 *
 * @param {object} params
 * @param {string} params.appid - 小程序 AppID
 * @param {string} params.mchid - 商户号
 * @param {string} params.openid - 用户 openid
 * @param {string} params.description - 商品描述（最长 127）
 * @param {string} params.out_trade_no - 商户订单号
 * @param {{ total: number, currency: string }} params.amount - 金额
 * @param {string} params.notify_url - 回调通知地址
 * @returns {Promise<{ success: boolean, prepay_id?: string, error?: object }>}
 */
async function createJsapiOrder(params) {
  const body = {
    appid: params.appid,
    mchid: params.mchid,
    description: String(params.description || '').substring(0, 127),
    out_trade_no: params.out_trade_no,
    notify_url: params.notify_url,
    amount: {
      total: params.amount.total,
      currency: params.amount.currency || 'CNY'
    },
    payer: {
      openid: params.openid
    }
  }

  if (isPayDebug()) {
    console.log('[WXPAY][createJsapiOrder] out_trade_no=%s amount=%s mchid=%s',
      params.out_trade_no, params.amount.total, params.mchid)
  }
  const result = await wechatpayRequest('POST', '/v3/pay/transactions/jsapi', body)

  if (result.success && result.data && result.data.prepay_id) {
    if (isPayDebug()) {
      console.log('[WXPAY][createJsapiOrder] 成功 prepay_id=%s', result.data.prepay_id)
    }
    return { success: true, prepay_id: result.data.prepay_id }
  }

  console.error('[WXPAY][createJsapiOrder] 失败 statusCode=%s error=%s',
    result.statusCode, JSON.stringify(result.error || result).slice(0, 600))
  return { success: false, error: result.error, statusCode: result.statusCode }
}

// ─── 支付参数生成（给 wx.requestPayment） ────────────────────────

/**
 * 生成前端 wx.requestPayment 所需的参数
 *
 * 签名串: appId\ntimeStamp\nnonceStr\npackage\n
 * 用商户私钥 RSA-SHA256 签名
 *
 * @param {string} prepayId - 统一下单返回的 prepay_id
 * @returns {{ timeStamp: string, nonceStr: string, package: string, signType: string, paySign: string }}
 */
function createPayParams(prepayId) {
  const privateKey = normalizePem(env('WXPAY_PRIVATE_KEY'))
  const appId = env('WXPAY_APPID')

  const timeStamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const packageVal = `prepay_id=${prepayId}`

  const message = appId + '\n' + timeStamp + '\n' + nonceStr + '\n' + packageVal + '\n'

  const paySign = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')

  return {
    timeStamp,
    nonceStr,
    package: packageVal,
    signType: 'RSA',
    paySign
  }
}

// ─── 查单 ───────────────────────────────────────────────────────

/**
 * 通过商户订单号查询微信支付订单状态
 *
 * GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={mchid}
 *
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<object|null>} { trade_state, transaction_id, trade_state_desc, amount, success_time } 或 null
 */
async function queryOrderByOutTradeNo(outTradeNo) {
  const mchid = env('WXPAY_MCHID')
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${mchid}`

  try {
    const result = await wechatpayRequest('GET', path, '')
    if (result.success && result.data) {
      return {
        trade_state: String(result.data.trade_state || '').trim(),
        transaction_id: String(result.data.transaction_id || '').trim(),
        trade_state_desc: String(result.data.trade_state_desc || ''),
        amount: result.data.amount,
        success_time: result.data.success_time
      }
    }
    return null
  } catch (err) {
    console.error('[WXPAY][queryOrder] 失败:', err.message)
    return null
  }
}

// ─── 回调验签 ───────────────────────────────────────────────────

/**
 * 验证微信支付回调通知的签名
 *
 * 微信回调 HTTP 头:
 *   Wechatpay-Timestamp: 时间戳
 *   Wechatpay-Nonce: 随机串
 *   Wechatpay-Signature: 签名（Base64）
 *   Wechatpay-Serial: 平台证书序列号
 *
 * 验签串: 时间戳\n随机串\n请求体\n
 * 使用微信支付平台公钥验证 RSA-SHA256 签名
 *
 * @param {object} headers - HTTP 请求头（key 全小写）
 * @param {string} rawBody - 原始请求体
 * @returns {boolean}
 */
function verifyCallbackSignature(headers, rawBody) {
  const platformPublicKey = normalizePem(env('WXPAY_PLATFORM_PUBLIC_KEY'))
  if (!platformPublicKey) {
    console.error('[WXPAY] 缺少 WXPAY_PLATFORM_PUBLIC_KEY 环境变量')
    return false
  }

  const timestamp = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  const serial = headers['wechatpay-serial']

  if (!timestamp || !nonce || !signature) {
    console.error('[WXPAY][verify] 缺少回调签名头 timestamp=%s nonce=%s sig=%s',
      !!timestamp, !!nonce, !!signature)
    return false
  }

  if (isPayDebug()) {
    console.log('[WXPAY][verify] serial=%s timestamp=%s', serial, timestamp)
  }

  const message = timestamp + '\n' + nonce + '\n' + rawBody + '\n'

  try {
    const ok = crypto.createVerify('RSA-SHA256').update(message).verify(platformPublicKey, signature, 'base64')
    if (isPayDebug()) {
      console.log('[WXPAY][verify] result=%s', ok)
    }
    return ok
  } catch (err) {
    console.error('[WXPAY][verify] 验签异常:', err.message)
    return false
  }
}

// ─── 回调解密 ───────────────────────────────────────────────────

/**
 * 解密微信支付回调通知的 resource 字段
 *
 * 算法: AEAD_AES_256_GCM
 * Key:  APIv3 密钥（32 字节）
 * IV:   resource.nonce（12 字节）
 * AAD:  resource.associated_data
 * Tag:  密文最后 16 字节
 *
 * @param {object} resource - 回调 body.resource
 * @param {string} resource.nonce
 * @param {string} resource.associated_data
 * @param {string} resource.ciphertext - Base64 编码的密文
 * @returns {object|null} 解密后的 JSON 对象
 */
function decryptResource(resource) {
  const apiV3Key = env('WXPAY_API_V3_KEY')
  if (!apiV3Key) {
    console.error('[WXPAY] 缺少 WXPAY_API_V3_KEY 环境变量')
    return null
  }

  const nonce = resource.nonce
  const associatedData = resource.associated_data || ''
  const ciphertext = resource.ciphertext

  if (!nonce || !ciphertext) {
    console.error('[WXPAY][decrypt] 缺少 resource 字段: nonce=%s ciphertext=%s', !!nonce, !!ciphertext)
    return null
  }

  try {
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64')

    // 最后 16 字节是认证标签（auth tag）
    if (ciphertextBuffer.length < 16) {
      console.error('[WXPAY][decrypt] 密文过短: %d bytes', ciphertextBuffer.length)
      return null
    }
    const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16)
    const encryptedData = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16)

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(nonce, 'utf8')
    )
    decipher.setAuthTag(authTag)
    decipher.setAAD(Buffer.from(associatedData, 'utf8'))

    let decrypted = decipher.update(encryptedData, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    const parsed = JSON.parse(decrypted)
    if (isPayDebug()) {
      console.log('[WXPAY][decrypt] 解密成功 out_trade_no=%s transaction_id=%s',
        parsed.out_trade_no, parsed.transaction_id)
    }
    return parsed
  } catch (err) {
    console.error('[WXPAY][decrypt] 解密失败:', err.message)
    return null
  }
}

// ─── 导出 ───────────────────────────────────────────────────────

module.exports = {
  normalizePem,
  signRequest,
  wechatpayRequest,
  createJsapiOrder,
  createPayParams,
  queryOrderByOutTradeNo,
  verifyCallbackSignature,
  decryptResource
}
