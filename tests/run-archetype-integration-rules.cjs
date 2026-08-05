'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const subscription = require('../cloudfunctions/_shared/subscription')
const config = subscription.DEFAULT_SUBSCRIPTION_CONFIG
const features = ['关系女主角', 'Crush名人图鉴', '次元角色图鉴']

assert.strictEqual(config.configVersion, 7)
for (const feature of features) {
  assert(config.trial.features.includes(feature), `trial missing ${feature}`)
  assert(!config.trial.excludedFeatures.includes(feature), `trial excludes ${feature}`)
  assert(config.plans.free.excludedFeatures.includes(feature), `free must exclude ${feature}`)
  assert(config.plans.pro.features.includes(feature), `pro missing ${feature}`)
  assert(!config.plans.pro.excludedFeatures.includes(feature), `pro excludes ${feature}`)
  assert(config.plans.ultra.features.includes(feature), `ultra missing ${feature}`)
  assert(!config.plans.ultra.excludedFeatures.includes(feature), `ultra excludes ${feature}`)
}

const pages = JSON.parse(fs.readFileSync(path.join(root, 'src', 'pages.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
const paths = new Set(pages.pages.map((item) => item.path))
for (const expected of [
  'pages/relation-heroine/relation-heroine',
  'pages/relation-heroine-result/relation-heroine-result',
  'pages/relation-heroine-history/relation-heroine-history',
  'pages/crush-celebrity/crush-celebrity',
  'pages/crush-celebrity-result/crush-celebrity-result',
  'pages/crush-celebrity-person/crush-celebrity-person',
  'pages/dimension-character/dimension-character',
  'pages/dimension-character-result/dimension-character-result',
  'pages/dimension-character-person/dimension-character-person',
  'pages/dimension-character-history/dimension-character-history'
]) assert(paths.has(expected), `missing route ${expected}`)

const caseDetail = fs.readFileSync(path.join(root, 'src/pages/case-detail/case-detail.vue'), 'utf8')
assert(caseDetail.includes('goRelationHeroine'))
assert(caseDetail.includes('goCrushCelebrity'))
assert(caseDetail.includes('goDimensionCharacter'))
assert(!caseDetail.includes('ArchetypeHeroBanner'))
const taohua = fs.readFileSync(path.join(root, 'src/pages/taohua/taohua.vue'), 'utf8')
assert(taohua.includes('goRelationHeroineSelf'))
assert(taohua.includes('goCelebritySelf'))
assert(taohua.includes('goDimensionCharacterSelf'))

const relationPage = fs.readFileSync(path.join(root, 'src/pages/relation-heroine/relation-heroine.vue'), 'utf8')
const celebrityPage = fs.readFileSync(path.join(root, 'src/pages/crush-celebrity/crush-celebrity.vue'), 'utf8')
const characterPage = fs.readFileSync(path.join(root, 'src/pages/dimension-character/dimension-character.vue'), 'utf8')
for (const source of [relationPage, celebrityPage, characterPage]) {
  assert(source.includes("getActiveCaseId()"))
  assert(!source.includes('setActiveCaseId'))
  assert(source.includes('无法判断 / 没观察到'))
  assert(source.includes('onBackPress'))
  assert(source.includes('退出并保留'))
  assert(source.includes('if (submitting.value) return'))
}
assert(celebrityPage.includes('enabledPeople'))
assert(celebrityPage.includes('caseAvatar'))
assert(celebrityPage.includes('target-snapshot'))
assert(celebrityPage.includes('CelebrityPersonCard'))
const celebrityPersonCard = fs.readFileSync(path.join(root, 'src/components/archetype/CelebrityPersonCard.vue'), 'utf8')
assert(celebrityPersonCard.includes('person.coverUrl'))

const saveResultFunction = fs.readFileSync(path.join(root, 'cloudfunctions/saveArchetypeResult/index.js'), 'utf8')
assert(saveResultFunction.indexOf('checkFeatureAccess(db, userId, featureKey)') < saveResultFunction.indexOf('await requireOwnedCase(caseId, userId)'))

const relationResultPage = fs.readFileSync(path.join(root, 'src/pages/relation-heroine-result/relation-heroine-result.vue'), 'utf8')
const celebrityResultPage = fs.readFileSync(path.join(root, 'src/pages/crush-celebrity-result/crush-celebrity-result.vue'), 'utf8')
for (const source of [relationResultPage, celebrityResultPage]) {
  assert(source.includes('resultId'))
  assert(source.includes('result.value.contentVersion'))
  assert(!source.includes("history?.results?.[0]"))
}
assert(relationResultPage.includes("similarity >= 80 ? '高度相似' : result.value.similarity >= 60 ? '明显相似' : result.value.similarity >= 40 ? '部分相似' : '相似度较低'"))

const celebrityCopy = fs.readFileSync(path.join(root, 'src/utils/crush-celebrity-copy.ts'), 'utf8')
assert(celebrityCopy.includes('buildCelebrityTypeLabel'))
assert(celebrityCopy.includes('buildCelebritySummary'))
assert(celebrityCopy.includes('buildCelebrityShareCopy'))
assert(celebrityCopy.includes('核心特征是'))

const indexManager = fs.readFileSync(path.join(root, 'scripts/manage-archetype-cloud.cjs'), 'utf8')
assert(indexManager.includes("key: { featureKey: 1, subjectGender: 1, status: 1 }"))
assert(indexManager.includes("key: { featureKey: 1, subjectGender: 1, contentVersion: 1 }"))
assert(indexManager.includes("unique: true"))
assert(relationPage.includes('resolveRelationSubjectGender'))
assert(relationPage.includes("kind: 'relation_archetype'"))
assert(relationResultPage.includes('result.value.subjectGender'))

console.log(JSON.stringify({ success: true, configVersion: config.configVersion, features, routeCount: 10 }, null, 2))
