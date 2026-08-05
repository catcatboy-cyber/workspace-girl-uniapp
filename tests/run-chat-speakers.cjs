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

const {
  extractChatSpeakers,
  inferIsChatRecord,
  mapChatSpeakers,
  suggestSelfSpeaker
} = loadTypeScriptModule(path.resolve(__dirname, '../src/utils/chat-speakers.ts'))

const namedChat = '张三：周末要不要吃饭。\n夏红：我不想去'
assert.deepEqual(new Set(extractChatSpeakers(namedChat)), new Set(['张三', '夏红']))
assert.equal(inferIsChatRecord(namedChat), true)

const normalizedScreenshot = '[14:32] 我：在干嘛\n[14:33] 对方：刚下班'
assert.deepEqual(new Set(extractChatSpeakers(normalizedScreenshot)), new Set(['我', '对方']))
assert.equal(suggestSelfSpeaker({ speakers: ['对方', '我'], profileNickname: '夏红' }), '我')

const datedChat = '2026-08-05 10:21 张三：在吗\n2026-08-05 10:22 夏红：在'
assert.deepEqual(new Set(extractChatSpeakers(datedChat)), new Set(['张三', '夏红']))

assert.equal(inferIsChatRecord('2026-08-05 10:21 写了一条日记\n今天心情不错'), false)
assert.equal(inferIsChatRecord('时间：今晚\n地点：公司楼下'), false)

assert.deepEqual(mapChatSpeakers({
  selfSpeaker: '夏红',
  speakers: ['路人', '夏红', '张三'],
  crushName: '张三'
}), {
  chatSelfName: '夏红',
  chatTargetName: '张三'
})

console.log('PASS chat speaker extraction ignores timestamps and metadata labels')
console.log('PASS explicit self/target names are mapped into interaction identity')
