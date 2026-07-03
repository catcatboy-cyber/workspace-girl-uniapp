/**
 * 虚拟支付 query_order 诊断脚本（已修复版）
 * 
 * 关键修复：
 * 1. Content-Length 显式设置（解决 412）
 * 2. 用 order_id 字段传商户订单号（不是 out_trade_no）
 * 3. Content-Type 加 charset=utf-8
 */
const fs = require('fs'), crypto = require('crypto'), https = require('https')
const RC = JSON.parse(fs.readFileSync(__dirname + '/cloudbaserc.json', 'utf8'))
const E = RC.functions.find(f => f.name === 'recharge').envVariables
const APPID = E.WXPAY_APPID, SECRET = E.WECHAT_APP_SECRET
const APP_KEY = E.VIRTUAL_PAY_APP_KEY
const SANDBOX_KEY = E.VIRTUAL_PAY_SANDBOX_KEY || ''
const OFFER_ID = E.VIRTUAL_PAY_OFFER_ID
const OPENID = 'oGN863aSTQuudAvk8Kwd-W1amub0'

const hmac = (k, d) => crypto.createHmac('sha256', k).update(d, 'utf8').digest('hex')

function getToken() {
  return new Promise((res, rej) => {
    https.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`, r => {
      let d = ''; r.on('data', c => d += c)
      r.on('end', () => { try { res(JSON.parse(d).access_token) } catch (e) { rej(e) } })
    }).on('error', rej)
  })
}

async function queryOrder(token, appKey, env, orderId, label) {
  const bodyObj = { env, offer_id: OFFER_ID, openid: OPENID, order_id: orderId }
  const bodyStr = JSON.stringify(bodyObj)
  const bodyBuf = Buffer.from(bodyStr, 'utf8')
  const uri = '/xpay/query_order'
  const paySig = hmac(appKey, `${uri}&${bodyStr}`)
  const reqPath = `${uri}?access_token=${token}&pay_sig=${paySig}`

  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.weixin.qq.com', port: 443, path: reqPath, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bodyBuf.length },
      timeout: 10000
    }, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => {
        console.log(`\n[${label}] STATUS=${res.statusCode}`)
        try {
          const p = JSON.parse(d)
          console.log('  errcode:', p.errcode, '| errmsg:', p.errmsg)
          if (p.order) {
            console.log('  status:', p.order.status, '| order_fee:', p.order.order_fee, '| paid_time:', p.order.paid_time)
            console.log('  wx_order_id:', p.order.wx_order_id)
          }
          resolve(p)
        } catch (_) { console.log('  RAW:', d); resolve(null) }
      })
    })
    req.on('error', e => { console.log(`[${label}] ERR: ${e.message}`); resolve(null) })
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.write(bodyBuf); req.end()
  })
}

// 用法：node test-query-order.js [orderId]
;(async () => {
  const orderId = process.argv[2] || 'RCmr49yx360f2f6d2d'
  const token = await getToken()
  console.log('查单:', orderId)
  if (SANDBOX_KEY) await queryOrder(token, SANDBOX_KEY, 1, orderId, '沙箱')
  await queryOrder(token, APP_KEY, 0, orderId, '正式')
})()
