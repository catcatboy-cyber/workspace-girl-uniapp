'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const pages = read('src/pages.json')
const landing = read('src/pages/heart-persona-share/heart-persona-share.vue')
const plan = read('HEART-PERSONA-SHARE-QUICK-TEST-DEV-PLAN-2026-08-06.md')
assert(pages.includes('pages/heart-persona-share/heart-persona-share'))
for (const route of ['relation-heroine/relation-heroine', 'crush-celebrity/crush-celebrity', 'dimension-character/dimension-character']) assert(landing.includes(route))
for (const key of ['entryMode=share_quick', 'resultShareId=', 'mode=', 'subjectGender=']) assert(landing.includes(key))
assert(!landing.includes('createCase('))
assert(!landing.includes('activeCaseId'))

for (const file of ['src/pages/relation-heroine/relation-heroine.vue', 'src/pages/crush-celebrity/crush-celebrity.vue', 'src/pages/dimension-character/dimension-character.vue']) {
  const source = read(file)
  assert(source.includes("entryMode.value === 'share_quick'"))
  assert(source.includes('resultShareId'))
}
for (const file of ['src/pages/relation-heroine-result/relation-heroine-result.vue', 'src/pages/crush-celebrity-result/crush-celebrity-result.vue', 'src/pages/dimension-character-result/dimension-character-result.vue']) {
  const source = read(file)
  assert(source.includes('/pages/heart-persona-share/heart-persona-share?resultShareId='))
  assert(source.includes('enterHomeFromHeartPersonaResult'))
}
for (const file of ['src/pages/relation-heroine-history/relation-heroine-history.vue', 'src/pages/dimension-character-history/dimension-character-history.vue']) {
  assert(read(file).includes('TA（快速测试）'))
}
for (const functionName of ['getArchetypeReport', 'saveArchetypeResult', 'getArchetypeResults']) {
  assert(plan.includes(`functions:deploy ${functionName} -e cloud1-d0gvhqu2c8a2b61fd`), `sandbox deployment plan missing ${functionName}`)
}

console.log('archetype share routing tests passed')
