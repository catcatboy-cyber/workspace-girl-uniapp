const crypto = require('crypto')

const OFFER_ID = process.env.VIRTUAL_PAY_OFFER_ID || ''
const APP_KEY = process.env.VIRTUAL_PAY_APP_KEY || ''
const SANDBOX_KEY = process.env.VIRTUAL_PAY_SANDBOX_KEY || ''
const IS_ENABLED = String(process.env.USE_VIRTUAL_PAY || '').trim() === 'true'

// access_token 缓存
let _tokenCache = { token: '', expiresAt: 0 }

/** 按环境选择 AppKey */
function getAppKey(env = 0) {
  if (env === 1 && SANDBOX_KEY) return SANDBOX_KEY
  return APP_KEY
}

/** 获取 access_token（用于虚拟支付服务端 API） */
async function getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) return _tokenCache.token

  const appid = String(process.env.WXPAY_APPID || process.env.WECHAT_APPID || '').trim()
  const secret = String(process.env.WECHAT_APP_SECRET || '').trim()
  if (!appid || !secret) throw new Error('缺少 WXPAY_APPID / WECHAT_APP_SECRET 环境变量')

  const https = require('https')
  const url = `/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`

  return new Promise((resolve, reject) => {
    https.get({ hostname: 'api.weixin.qq.com', path: url, timeout: 5000 }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.access_token) {
            _tokenCache = { token: j.access_token, expiresAt: Date.now() + (j.expires_in - 300) * 1000 }
            resolve(_tokenCache.token)
          } else {
            reject(new Error(`getAccessToken failed: ${data.slice(0, 200)}`))
          }
        } catch (e) { reject(e) }
      })
    }).on('error', reject).on('timeout', () => reject(new Error('getAccessToken timeout')))
  })
}

/**
 * 生成 signData 的规范 JSON 字符串（字段按字典序排序）。
 * 微信 requestVirtualPayment 要求 signData 是 JSON 字符串，且
 * paySig / signature / 前端传参必须使用「这同一个字符串」，逐字节一致，
 * 否则微信服务端重新验签会失败（PAY_SIG_INVALID / SIGNATURE_INVALID）。
 */
function serializeSignData(signDataObj) {
  const sorted = {}
  Object.keys(signDataObj).sort().forEach(k => { sorted[k] = signDataObj[k] })
  return JSON.stringify(sorted)
}

/** 支付签名 paySig = hex(hmac_sha256(appKey, 'requestVirtualPayment&' + signData)) */
function signPaySig(signDataStr, env = 0) {
  const appKey = getAppKey(env)
  return crypto.createHmac('sha256', appKey)
    .update(`requestVirtualPayment&${signDataStr}`, 'utf8').digest('hex')
}

/** 用户态签名 signature = hex(hmac_sha256(session_key, signData)) */
function signUserSig(signDataStr, sessionKey) {
  return crypto.createHmac('sha256', sessionKey).update(signDataStr, 'utf8').digest('hex')
}

/**
 * 用 wx.login 的 code 换取「最新」session_key。
 * 虚拟支付的 signature 要求 session_key 有效/新鲜；DB 里存量的 session_key 会过期，
 * 过期就会 SIGNATURE_INVALID。所以支付前用本次 code 现换一份最新的来签名。
 */
function getSessionKeyByCode(loginCode) {
  const code = String(loginCode || '').trim()
  if (!code) return Promise.resolve('')
  const appid = String(process.env.WXPAY_APPID || process.env.WECHAT_APPID || '').trim()
  const secret = String(process.env.WECHAT_APP_SECRET || '').trim()
  if (!appid || !secret) {
    console.warn('[VPAY] getSessionKeyByCode missing appid/secret')
    return Promise.resolve('')
  }
  const https = require('https')
  const path = `/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  return new Promise((resolve) => {
    https.get({ hostname: 'api.weixin.qq.com', path, timeout: 5000 }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.session_key) return resolve(String(j.session_key).trim())
          console.warn('[VPAY] jscode2session no session_key:', String(data).slice(0, 200))
          resolve('')
        } catch (_) { resolve('') }
      })
    }).on('error', (e) => { console.warn('[VPAY] jscode2session error:', e.message); resolve('') })
      .on('timeout', function () { this.destroy(); resolve('') })
  })
}

/** 生成唯一 outTradeNo（8-32字符，不以 _ 开头） */
function generateOutTradeNo(prefix = 'VP') {
  const ts = Date.now().toString(36)
  const rand = crypto.randomBytes(4).toString('hex')
  const id = `${prefix}${ts}${rand}`
  return id.replace(/^_+/, 'V').slice(0, 32)
}

/** 构建 signData 对象（camelCase — 微信虚拟支付要求的字段名） */
function buildSignData(params) {
  const d = {
    offerId: OFFER_ID,
    buyQuantity: params.buyQuantity,
    currencyType: 'CNY',
    env: params.sandbox ? 1 : 0,
    outTradeNo: params.outTradeNo,
    attach: params.attach || ''
  }
  if (params.productId) d.productId = params.productId
  if (params.goodsPrice != null) d.goodsPrice = params.goodsPrice
  return d
}

/**
 * 查询虚拟支付订单状态（服务端验单）
 * API: POST /xpay/query_order?access_token=TOKEN&pay_sig=SIG
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html
 */
async function queryVirtualOrder(outTradeNo, userOpenid, env = 0, wxOrderId = '') {
  const https = require('https')
  const appKey = getAppKey(env)

  // 请求体：query_order 接口用 order_id 字段传入商户订单号（即我们的 outTradeNo）
  // 注意：不是 out_trade_no！微信虚拟支付接口只认 order_id 或 wx_order_id
  // order_id 可以传商户自己生成的订单号，wx_order_id 是微信侧的内部订单号
  const bodyObj = { env, offer_id: OFFER_ID, openid: userOpenid, order_id: outTradeNo }
  const body = JSON.stringify(bodyObj)  // 字段字典序: env < offer_id < openid < order_id

  // pay_sig = HMAC-SHA256(appKey, uri + '&' + body)，uri 必须带前导 /
  const signUri = '/xpay/query_order'
  const stringToSign = `${signUri}&${body}`
  const paySig = crypto.createHmac('sha256', appKey).update(stringToSign, 'utf8').digest('hex')

  // 获取 access_token
  let accessToken
  try {
    accessToken = await getAccessToken()
  } catch (e) {
    console.warn('[VPAY] getAccessToken failed:', e.message)
    return null
  }

  const reqPath = `${signUri}?access_token=${accessToken}&pay_sig=${paySig}`
  // 关键：计算 body 的字节长度（非字符长度），微信网关校验 Content-Length
  const bodyBuf = Buffer.from(body, 'utf8')

  console.log('[VPAY] queryOrder signUri=%s stringToSign=%s', signUri, stringToSign)
  console.log('[VPAY] queryOrder body=%s byteLen=%d paySig=%s env=%d', body, bodyBuf.length, paySig, env)

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.weixin.qq.com', port: 443, path: reqPath, method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': bodyBuf.length
      },
      timeout: 8000
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        console.log('[VPAY] queryOrder HTTP status=%s headers=%j body=%s',
          res.statusCode, res.headers, String(data).slice(0, 500))
        try {
          const j = JSON.parse(data)
          if (j.errcode && j.errcode !== 0) {
            console.warn('[VPAY] queryOrder errcode=%s errmsg=%s', j.errcode, j.errmsg)
          }
          resolve(j)
        } catch (_) { resolve(null) }
      })
    })
    req.on('error', (err) => { console.warn('[VPAY] queryOrder req error:', err.message); resolve(null) })
    req.on('timeout', () => { console.warn('[VPAY] queryOrder timeout'); req.destroy(); resolve(null) })
    req.write(bodyBuf)
    req.end()
  })
}

module.exports = {
  OFFER_ID,
  IS_ENABLED,
  serializeSignData,
  signPaySig,
  signUserSig,
  getSessionKeyByCode,
  generateOutTradeNo,
  buildSignData,
  queryVirtualOrder,
  getAppKey
}
