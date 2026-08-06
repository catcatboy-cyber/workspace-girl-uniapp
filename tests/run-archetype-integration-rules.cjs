'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const subscription = require('../cloudfunctions/_shared/subscription')
const config = subscription.DEFAULT_SUBSCRIPTION_CONFIG
const features = ['关系女主角', 'Crush名人图鉴', '次元角色图鉴']

assert.strictEqual(config.configVersion, 8)
assert.strictEqual(config.heartPersonaReportPayment.priceFen, 199)
assert.strictEqual(config.heartPersonaReportPayment.sandboxProductId, '0001')
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
assert(caseDetail.includes('normalizeRelationGender'))
assert(caseDetail.includes('relationDisplayTitle'))
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
for (const source of [celebrityPage, characterPage]) {
  assert(source.includes('normalizeRelationGender'))
  assert(!source.includes("!['male', 'female'].includes(String("))
  assert(source.includes('/pages/edit-profile/edit-profile?caseId='))
  assert(source.includes('/pages/self-profile/self-profile?mode=onboarding&redirect='))
  assert(!source.includes("uni.navigateTo({ url: mode.value === 'target' ? `/pages/case-detail/case-detail"))
}
const celebrityPersonCard = fs.readFileSync(path.join(root, 'src/components/archetype/CelebrityPersonCard.vue'), 'utf8')
assert(celebrityPersonCard.includes('person.coverUrl'))

const saveResultFunction = fs.readFileSync(path.join(root, 'cloudfunctions/saveArchetypeResult/index.js'), 'utf8')
assert(saveResultFunction.includes('resolveQuizAccess(db, userId, kind, subjectGender)'))
assert(saveResultFunction.includes('return { success: true, resultId, kind }'))
assert(saveResultFunction.includes("return error('PROFILE_GENDER_REQUIRED'"))

for (const functionName of ['getArchetypeReport', 'archetypeReportPayment']) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions', functionName, 'package.json'), 'utf8'))
  assert(packageJson.dependencies?.['wx-server-sdk'], `${functionName} must package wx-server-sdk for trusted mini-program identity`)
}

const reportAccess = fs.readFileSync(path.join(root, 'cloudfunctions/_shared/archetype-report-access.js'), 'utf8')
assert(reportAccess.includes("collection('archetype_report_refund_tasks')"))
assert(reportAccess.includes("status: 'pending'"))
assert(reportAccess.includes('auditTrail: []'))

const adminManage = fs.readFileSync(path.join(root, 'cloudfunctions/adminManage/index.js'), 'utf8')
assert(adminManage.includes("action === 'listArchetypeReportRefundTasks'"))
assert(adminManage.includes("action === 'updateArchetypeReportRefundTask'"))
assert(adminManage.includes("!['processing', 'dismissed'].includes(nextStatus)"))
assert(adminManage.includes("task.status === 'refunded'"))
assert(adminManage.includes("const targetUserId = String(event.targetUserId || '').trim()"))
const listOrdersStart = adminManage.indexOf('async function listArchetypeReportOrders')
const listOrdersEnd = adminManage.indexOf('async function adminReconcileArchetypeReportOrder', listOrdersStart)
const listOrdersSource = adminManage.slice(listOrdersStart, listOrdersEnd)
assert(!listOrdersSource.includes('event.targetUserId || event.userId'))

const adminApi = fs.readFileSync(path.join(root, 'src/utils/api.ts'), 'utf8')
assert(adminApi.includes('adminGetArchetypeReportRefundTasks'))
assert(adminApi.includes('adminUpdateArchetypeReportRefundTask'))
const reportOrdersPanel = fs.readFileSync(path.join(root, 'src/pages/admin/components/panels/ArchetypeReportOrdersPanel.vue'), 'utf8')
assert(reportOrdersPanel.includes('最终“已退款”只由微信退款通知写入'))
assert(reportOrdersPanel.includes("updateRefundTask(task, 'processing')"))
assert(reportOrdersPanel.includes("updateRefundTask(task, 'dismissed')"))
assert(reportOrdersPanel.includes('targetUserId: filters.userId'))

const relationResultPage = fs.readFileSync(path.join(root, 'src/pages/relation-heroine-result/relation-heroine-result.vue'), 'utf8')
const celebrityResultPage = fs.readFileSync(path.join(root, 'src/pages/crush-celebrity-result/crush-celebrity-result.vue'), 'utf8')
for (const source of [relationResultPage, celebrityResultPage]) {
  assert(source.includes('resultId'))
  assert(source.includes('getArchetypeReport'))
  assert(!source.includes('getArchetypeQuestionBank'))
  assert(source.includes('HeartPersonaReportPaywall'))
}
assert(relationResultPage.includes('report.value?.exactSimilarity'))

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
assert(relationResultPage.includes('report.value?.subjectGender'))

console.log(JSON.stringify({ success: true, configVersion: config.configVersion, features, routeCount: 10 }, null, 2))
