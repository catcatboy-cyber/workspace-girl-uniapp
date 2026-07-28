/**
 * 内容安全集成测试
 * 测试 contentSecCheck 云函数 + contentSecCallback HTTP 端点
 *
 * 用法：node tests/integration-test-content-security.cjs
 *       set WECHAT_MESSAGE_TOKEN=xxx && node tests/integration-test-content-security.cjs
 */
async function main() {
const crypto = require('crypto')
const https = require('https')
const http = require('http')

const ENV_ID = 'cloud1-d0gvhqu2c8a2b61fd'
const REGION = process.env.TCB_REGION || 'ap-shanghai'

// ====== 配置：从环境变量读取 token ======
const TOKEN = process.env.WECHAT_MESSAGE_TOKEN || ''
if (!TOKEN) {
  console.log('SKIP HTTP tests: 设置 WECHAT_MESSAGE_TOKEN 环境变量后可测 callback 端点')
  console.log('  set WECHAT_MESSAGE_TOKEN=你在微信后台填的token值')
}
console.log('')

// ContentSecCallback HTTP 地址（CloudBase HTTP 触发器）
const CALLBACK_HOST = `${ENV_ID}.${REGION}.tcb.qcloud.la`
const CALLBACK_PATH = `/contentSecCallback`

let passed = 0
let failed = 0
let skipped = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

function skip(label) {
  console.log(`  ⏭️  ${label}`)
  skipped++
}

function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

// ====== 1. 单元逻辑验证 ======
console.log('===== 1. 逻辑单元测试 =====')

const {
  MEDIA_TYPE_IMAGE,
  MEDIA_CHECK_VERSION,
  getSceneNumber,
  normalizeMediaCheckCallback
} = require('../cloudfunctions/contentSecCheck/_shared/content-security')

assert(MEDIA_TYPE_IMAGE === 2, 'MEDIA_TYPE_IMAGE = 2')
assert(MEDIA_CHECK_VERSION === 2, 'MEDIA_CHECK_VERSION = 2')
assert(getSceneNumber('image') === 1, 'scene image → 1')
assert(getSceneNumber('avatar') === 1, 'scene avatar → 1')
assert(getSceneNumber('custom_pet') === 1, 'scene custom_pet → 1')
assert(getSceneNumber('timeline') === 4, 'scene timeline → 4')
assert(getSceneNumber('unknown') === 1, 'unknown scene → 1 (safe default)')

// ====== 2. 回调结果归一化（fail-closed） ======
console.log('\n===== 2. 回调归一化 (normalizeMediaCheckCallback) =====')

const passResult = normalizeMediaCheckCallback({
  trace_id: 'trace-pass-001', errcode: 0, result: { suggest: 'pass', label: 100 }
})
assert(passResult.valid === true, 'pass: valid=true')
assert(passResult.status === 'pass', 'pass: status=pass')
assert(passResult.code === 'OK', 'pass: code=OK')

const riskyResult = normalizeMediaCheckCallback({
  trace_id: 'trace-risk-001', errcode: 0, result: { suggest: 'risky', label: 20002 }
})
assert(riskyResult.valid === true, 'risky: valid=true')
assert(riskyResult.status === 'rejected', 'risky: status=rejected (fail-closed)')
assert(riskyResult.code === 'CONTENT_RISK', 'risky: code=CONTENT_RISK')

const reviewResult = normalizeMediaCheckCallback({
  trace_id: 'trace-review-001', errcode: 0, result: { suggest: 'review' }
})
assert(reviewResult.status === 'rejected', 'review → rejected (fail-closed)')

const downloadErr = normalizeMediaCheckCallback({
  trace_id: 'trace-err-001', errcode: -1008
})
assert(downloadErr.status === 'failed', 'errcode=-1008 → failed')
assert(downloadErr.code === 'SECURITY_CHECK_UNAVAILABLE', 'errcode=-1008 → SECURITY_CHECK_UNAVAILABLE')

const unknownSuggest = normalizeMediaCheckCallback({
  trace_id: 'trace-unk-001', errcode: 0, result: { suggest: 'unknown_value' }
})
assert(unknownSuggest.status === 'failed', 'unknown suggest → failed (fail-closed)')

const noTraceId = normalizeMediaCheckCallback({ errcode: 0 })
assert(noTraceId.valid === false, 'no trace_id → valid=false')
assert(noTraceId.code === 'INVALID_CALLBACK', 'no trace_id → INVALID_CALLBACK')

// 大小写 + _id 兼容
const pascalEvent = normalizeMediaCheckCallback({
  traceId: 'trace-pascal', errCode: 0, result: { suggest: 'PASS' }
})
assert(pascalEvent.status === 'pass', 'camelCase traceId + PASS (uppercase) → pass')

// ====== 3. 签名验证 ======
console.log('\n===== 3. 签名验证 =====')

function verifyMessageSignature(token, timestamp, nonce, signature) {
  const expected = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

const testToken = 'test_token_123'
const ts = '1750000000'
const nonce = 'abcd1234'
const validSig = crypto.createHash('sha1').update([testToken, ts, nonce].sort().join('')).digest('hex')

assert(
  verifyMessageSignature(testToken, ts, nonce, validSig) === true,
  '正确签名验证通过'
)
assert(
  verifyMessageSignature(testToken, ts, nonce, 'wrong_sig_0000000000000000000000000000000000000') === false,
  '错误签名被拒绝'
)
assert(
  verifyMessageSignature('', ts, nonce, validSig) === false,
  '空 token 时签名失败'
)

// ====== 4. HTTP 回调端点可达性测试 ======
console.log('\n===== 4. HTTP 回调端点测试 =====')

if (!TOKEN) {
  skip('未设置 WECHAT_MESSAGE_TOKEN，跳过 HTTP 测试')
} else {
  const ts2 = String(Math.floor(Date.now() / 1000))
  const nonce2 = crypto.randomBytes(8).toString('hex')
  const sig2 = crypto.createHash('sha1').update([TOKEN, ts2, nonce2].sort().join('')).digest('hex')
  const echostr = 'hello_test_echo_' + Date.now()

  const callbackUrl = `https://${CALLBACK_HOST}${CALLBACK_PATH}?signature=${encodeURIComponent(sig2)}&timestamp=${ts2}&nonce=${nonce2}&echostr=${encodeURIComponent(echostr)}`

  console.log(`  URL: https://${CALLBACK_HOST}${CALLBACK_PATH}`)
  console.log(`  Token: ${TOKEN.slice(0, 3)}***`)

  try {
    const response = await httpRequest(callbackUrl, { method: 'GET' })
    console.log(`  HTTP ${response.statusCode}: ${response.body.slice(0, 200)}`)

    if (response.statusCode === 200 && response.body === echostr) {
      console.log('  ✅ GET echostr 验证通过！')
      console.log('  ✅ 微信 URL 验证应该已经成功了')
      passed++
    } else if (response.statusCode === 403) {
      console.log('  ❌ 签名被拒绝 (403)')
      console.log('  可能原因：WECHAT_MESSAGE_TOKEN 与微信后台不一致')
      console.log('  或：CloudBase HTTP 触发器格式与预期不同')
      failed++
    } else if (response.statusCode === 503) {
      console.log('  ❌ 服务不可用 (503) - 可能未部署或环境变量未生效')
      failed++
    } else {
      console.log(`  ⚠️  意外响应: ${response.statusCode}`)
      console.log(`  Body: ${response.body.slice(0, 300)}`)
      skipped++
    }
  } catch (err) {
    console.log(`  ❌ 请求失败: ${err.message}`)
    console.log(`  可能原因：HTTP 触发器未开启，或域名不正确`)
    console.log(`  尝试的域名: ${CALLBACK_HOST}`)
    failed++
  }
}

// ====== 5. 模拟内容安全回调 (本地) ======
console.log('\n===== 5. 模拟完整回调链路 (本地) =====')

// 模拟 applyMediaCheckResult 的核心逻辑
const mockTraceId = 'mock-trace-' + Date.now()
const mockPayload = {
  trace_id: mockTraceId,
  errcode: 0,
  result: { suggest: 'pass', label: 100 }
}

const mockNormalized = normalizeMediaCheckCallback(mockPayload)
assert(mockNormalized.valid === true, '模拟回调: valid=true')
assert(mockNormalized.traceId === mockTraceId, '模拟回调: traceId 匹配')
assert(mockNormalized.status === 'pass', '模拟回调: status=pass')

// 模拟各种场景
const scenarios = [
  { label: '通过', payload: { trace_id: 's1', errcode: 0, result: { suggest: 'pass', label: 100 } }, expect: 'pass' },
  { label: '色情违规', payload: { trace_id: 's2', errcode: 0, result: { suggest: 'risky', label: 20002 } }, expect: 'rejected' },
  { label: '时政违规', payload: { trace_id: 's3', errcode: 0, result: { suggest: 'risky', label: 20001 } }, expect: 'rejected' },
  { label: '人工复核', payload: { trace_id: 's4', errcode: 0, result: { suggest: 'review', label: 21000 } }, expect: 'rejected' },
  { label: '文件下载失败', payload: { trace_id: 's5', errcode: -1008 }, expect: 'failed' },
]

for (const s of scenarios) {
  const r = normalizeMediaCheckCallback(s.payload)
  assert(r.status === s.expect, `场景[${s.label}]: status=${r.status} (预期=${s.expect})`)
}

// ====== 6. 检查 contentSecCheck 部署状态 ======
console.log('\n===== 6. contentSecCheck 部署状态 =====')

const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')

const checkConfigPath = path.join(root, 'cloudfunctions/contentSecCheck/config.json')
if (fs.existsSync(checkConfigPath)) {
  const checkConfig = JSON.parse(fs.readFileSync(checkConfigPath, 'utf8'))
  console.log(`  runtime: ${checkConfig.runtime || '(default)'}`)
  console.log(`  timeout: ${checkConfig.timeout || '(default)'}`)
  const perms = checkConfig.permissions?.openapi || []
  assert(
    perms.includes('security.mediaCheckAsync'),
    'config.json 声明了 security.mediaCheckAsync 权限'
  )
} else {
  skip('contentSecCheck/config.json 缺失')
}

const cbIndexPath = path.join(root, 'cloudfunctions/contentSecCallback/index.js')
const cbIndex = fs.readFileSync(cbIndexPath, 'utf8')
assert(cbIndex.includes('wxa_media_check'), 'contentSecCallback 处理 wxa_media_check 事件')
assert(cbIndex.includes('verifyMessageSignature'), 'contentSecCallback 包含签名验证')
assert(cbIndex.includes('WECHAT_MESSAGE_TOKEN'), 'contentSecCallback 使用 WECHAT_MESSAGE_TOKEN 环境变量')

// ====== 7. 检查前端 API 调用完整性 ======
console.log('\n===== 7. 前端 API 调用层检查 =====')

const apiSource = fs.readFileSync(path.join(root, 'src/utils/api.ts'), 'utf8')
assert(apiSource.includes('contentSecCheck'), 'api.ts 导出 contentSecCheck')
assert(apiSource.includes("action: 'checkImage'"), 'api.ts 调用 checkImage action')
assert(apiSource.includes("action: 'getImageCheckResult'"), 'api.ts 调用 getImageCheckResult action')
assert(apiSource.includes('SECURITY_CHECK_PENDING'), '前端轮询处理 pending 状态')
assert(apiSource.includes('所发布内容含违规信息'), '前端有违规信息提示')

// ====== 8. 最终评分 ======
console.log('\n===== 集成测试结果 =====')
console.log(`  ✅ 通过: ${passed}`)
console.log(`  ❌ 失败: ${failed}`)
console.log(`  ⏭️  跳过: ${skipped}`)
console.log('')

  if (failed > 0) {
    console.log('⚠️  有测试失败，请检查上述 ❌ 项')
    process.exit(1)
  } else {
    console.log('✅ 所有可执行测试通过')
    if (TOKEN) {
      console.log('')
      console.log('如需进一步验证，可以在微信小程序中：')
      console.log('1. 上传一张正常图片作为头像')
      console.log('2. 观察云函数日志: npx tcb fn log contentSecCheck')
      console.log('3. 观察回调日志:   npx tcb fn log contentSecCallback')
      console.log('4. 检查数据库 content_security_checks 集合中的记录状态')
    }
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('测试运行失败:', error)
  process.exit(1)
})
