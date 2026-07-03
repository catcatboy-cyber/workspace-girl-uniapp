// 受控实验：唯一变量 = Content-Length 有无。验证 kiro 的"412 主因是缺 CL / chunked"主张
// 用官方自校验接口 query_user_balance，body/签名完全相同
const fs = require('fs'), crypto = require('crypto'), https = require('https')
const RC = JSON.parse(fs.readFileSync(__dirname + '/cloudbaserc.json', 'utf8'))
const E = RC.functions.find(f => f.name === 'recharge').envVariables
const APPID = E.WXPAY_APPID, SECRET = E.WECHAT_APP_SECRET, APP_KEY = E.VIRTUAL_PAY_APP_KEY
const OPENID = 'oGN863aSTQuudAvk8Kwd-W1amub0'
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d, 'utf8').digest('hex')
const sort = o => { const s = {}; Object.keys(o).sort().forEach(k => s[k] = o[k]); return s }
function getToken() { return new Promise((res, rej) => { https.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d).access_token) } catch (e) { rej(e) } }) }).on('error', rej) }) }

function callWithHeaders(path, bodyBuf, headers) {
  return new Promise(resolve => {
    const req = https.request({ hostname: 'api.weixin.qq.com', port: 443, path, method: 'POST', headers, timeout: 8000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d, reqHeaders: req.getHeaders() }))
    })
    req.on('error', e => resolve({ status: 0, body: 'ERR ' + e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }) })
    req.write(bodyBuf); req.end()
  })
}

const retry = async (fn) => { for (let i = 0; i < 5; i++) { const r = await fn(); if (r.status !== 0) return r; await new Promise(x => setTimeout(x, 900)) } return { status: 0, body: 'all-retries-failed' } }

;(async () => {
  const token = await getToken()
  const uri = '/xpay/query_user_balance'
  const body = JSON.stringify(sort({ env: 0, openid: OPENID, user_ip: '127.0.0.1' }))
  const bodyBuf = Buffer.from(body, 'utf8')
  const paySig = hmac(APP_KEY, `${uri}&${body}`)
  const path = `${uri}?access_token=${token}&pay_sig=${paySig}`
  console.log('body:', body, '| byteLen:', bodyBuf.length, '\n')

  // 交替各测 3 次，排除网络瞬断干扰
  for (let round = 1; round <= 3; round++) {
    const a = await retry(() => callWithHeaders(path, bodyBuf, { 'Content-Type': 'application/json' }))
    const b = await retry(() => callWithHeaders(path, bodyBuf, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bodyBuf.length }))
    console.log(`第${round}轮: [A 无CL/chunked] HTTP ${a.status} ${String(a.body).slice(0,120)}  ||  [B 有CL] HTTP ${b.status} ${String(b.body).slice(0,120)}`)
  }

  // 末轮取详细结果做判定
  const a = await retry(() => callWithHeaders(path, bodyBuf, { 'Content-Type': 'application/json' }))
  const b = await retry(() => callWithHeaders(path, bodyBuf, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bodyBuf.length }))
  console.log('\n[A 无 Content-Length] -> HTTP', a.status, '| body:', String(a.body).slice(0, 300))
  console.log('[B 有 Content-Length] -> HTTP', b.status, '| body:', String(b.body).slice(0, 300), '\n')

  console.log('='.repeat(60))
  console.log('判定: A=%d B=%d', a.status, b.status)
  if (a.status === 412 && b.status === 200) console.log('✅ kiro 正确：缺 Content-Length(chunked) 就是 412 主因')
  else if (a.status === b.status) console.log('❌ 与 CL 无关：两者结果相同，根因另有其因')
  else console.log('⚠️ 结果需进一步分析')
})()
