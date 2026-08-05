const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { transformSync } = require('esbuild')

function loadTypeScriptModule(file) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = transformSync(source, {
    loader: 'ts',
    format: 'cjs',
    target: 'node18'
  }).code
  const loaded = new Module(file, module)
  loaded.filename = file
  loaded.paths = Module._nodeModulePaths(path.dirname(file))
  loaded._compile(compiled, file)
  return loaded.exports
}

const { translateSceneLabel, buildLandingSourceText } = loadTypeScriptModule(
  path.resolve(__dirname, '../src/utils/scene-map.ts')
)

assert.equal(translateSceneLabel('1007'), '单人聊天会话中的小程序消息卡片')
assert.equal(translateSceneLabel('9999'), null)
assert.equal(translateSceneLabel('invite'), null)
assert.equal(
  buildLandingSourceText('wechat_share', '1007', 'analysis_result'),
  '1007 · 单人聊天会话中的小程序消息卡片 · 渠道 wechat_share · 落地页 analysis_result'
)
assert.equal(buildLandingSourceText('', '9999', ''), '9999 · 未知场景')
assert.equal(buildLandingSourceText('', '', ''), '')

console.log('PASS registration source scenes are translated without dropping raw attribution')
