'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const before = (source, first, second, message) => {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  assert(firstIndex >= 0, `missing ${first}: ${message}`)
  assert(secondIndex >= 0, `missing ${second}: ${message}`)
  assert(firstIndex < secondIndex, message)
}

const landing = read('src/pages/heart-persona-share/heart-persona-share.vue')
for (const value of [
  "response?.code === 'AUTH_REQUIRED'",
  'needsLogin.value = shouldOfferExplicitLogin()',
  'waitForCurrentUserId()',
  'ensureSilentWechatLogin()',
  'redirect=${encodeURIComponent(currentPath())}',
  "selectMode('self')",
  "selectMode('target')",
  "selectGender('female')",
  "selectGender('male')",
  'heartPersonaShareSelection:',
  'uni.setStorageSync(selectionStorageKey()',
  'uni.getStorageSync(selectionStorageKey())',
  'uni.removeStorageSync(selectionStorageKey())',
  "query.push(`mode=${selectedMode.value}`)",
  "query.push(`subjectGender=${selectedGender.value}`)",
  'success: clearSelection',
  ':disabled="quizRouting"',
  "appendReferralParams(sharePath(), 'heart_persona_result')",
  '分享失效页有主页 CTA'
]) {
  if (value === '分享失效页有主页 CTA') assert(landing.includes('@click="goHome"'))
  else assert(landing.includes(value), `landing contract missing: ${value}`)
}
assert(!landing.includes('createCase('))
assert(/\/\/ #ifdef MP-WEIXIN\s+offerExplicitLogin = false/.test(landing), 'Mini Program auth fallback must remain silent')
for (const value of ['storybook-page', '魔镜说', '完整维度仅本人可见', '好友的完整报告保持私密']) {
  assert(landing.includes(value), `storybook landing contract missing: ${value}`)
}
for (const forbidden of ['dimensionScores', 'similarities', 'watchSignals', 'communicationAdvice']) {
  assert(!landing.includes(forbidden), `shared landing must not depend on private report field: ${forbidden}`)
}
assert(!landing.includes('getActiveCaseId'))
assert(!landing.includes('updateSelfProfile'))
assert(!landing.includes("'confirm'"), 'gender selection must not open a second confirmation step')
assert(!landing.includes('确认本次测试'), 'quick share flow must enter the quiz immediately after gender selection')
const genderSelection = landing.match(/function selectGender\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
assert(genderSelection.includes('persistSelection()'))
assert(genderSelection.includes('startQuiz()'))
assert(genderSelection.indexOf('persistSelection()') < genderSelection.indexOf('startQuiz()'), 'selection must persist before direct quiz navigation')
assert(!landing.includes("appendReferralParams(currentPath(), 'heart_persona_result')"), 'partial quick-test selections must not leak into a re-shared result URL')

for (const file of [
  'src/pages/relation-heroine/relation-heroine.vue',
  'src/pages/crush-celebrity/crush-celebrity.vue',
  'src/pages/dimension-character/dimension-character.vue'
]) {
  const source = read(file)
  for (const value of [
    "entryMode.value === 'share_quick'",
    'resultShareId.value',
    'subjectGender',
    'getArchetypeDraftKey',
    'waitForCurrentUserId',
    'ensureSilentWechatLogin',
    '答案已保存，请稍后重试',
    "{ resultShareId: resultShareId.value }",
    "{ key: 'U', text: '无法判断 / 没观察到' }"
  ]) assert(source.includes(value), `${file} missing ${value}`)
  before(source, 'if (isShareQuick.value)', "else if (mode.value === 'target')", `${file} must handle quick mode before the standard target branch`)
}

const appSource = read('src/App.vue')
assert(appSource.includes('ensureSilentWechatLogin(true)'))
assert(appSource.includes('if (!getCurrentUserId()) ensureSilentWechatLogin()'))
const silentLogin = read('src/utils/silent-login.ts')
assert(silentLogin.includes('silentLoginInFlight'))
assert(silentLogin.includes('wxApi.login'))
assert(silentLogin.includes("wechatLogin('',"))

for (const file of [
  'src/pages/crush-celebrity-result/crush-celebrity-result.vue',
  'src/pages/dimension-character-result/dimension-character-result.vue'
]) assert(read(file).includes('report.subjectLabel'), `${file} must render the server-projected quick subject label`)

for (const file of [
  'src/pages/crush-celebrity/crush-celebrity.vue',
  'src/pages/dimension-character/dimension-character.vue'
]) {
  const source = read(file)
  assert(source.includes('normalizeRelationGender(person.gender) === subjectGender.value'))
  assert(source.includes('enabledPeople.value.filter'))
}

for (const file of [
  'src/pages/relation-heroine-result/relation-heroine-result.vue',
  'src/pages/crush-celebrity-result/crush-celebrity-result.vue',
  'src/pages/dimension-character-result/dimension-character-result.vue'
]) {
  const source = read(file)
  for (const value of [
    ':loading="homeRouting"',
    ':disabled="homeRouting"',
    'prepareArchetypeResultShare(resultId.value)',
    'resultSharePromise',
    '/pages/heart-persona-share/heart-persona-share?resultShareId=',
    "report.value.entryMode === 'share_quick'",
    'onShow(() =>',
    'loadReport()'
  ]) assert(source.includes(value), `${file} missing ${value}`)
  assert(source.includes(':disabled="Boolean(quizRoutingAction)"') || source.includes(':disabled="retestRouting"'), `${file} must disable duplicate quick retest routing`)
  assert(source.includes(':loading="quizRoutingAction') || source.includes(':loading="retestRouting"'), `${file} must show quick retest loading state`)
}

const paywall = read('src/components/HeartPersonaReportPaywall.vue')
assert(paywall.includes('/pages/subscription/subscription?from=heart_persona_result&resultId='))
for (const value of ['storybook-paywall', '魔镜已找到原型', '后面的答案，被魔镜封存了', '支付 ¥${priceYuan}', '只解锁当前测试结果']) {
  assert(paywall.includes(value), `storybook paywall missing ${value}`)
}

const storybookReport = read('src/components/HeartPersonaStorybookReport.vue')
for (const value of ['--persona-paper:var(--surface', '第一章 · 魔镜判词', '第二章 · 关系雷达', 'radarDataPolygon', '第五章 · 不同阶段怎么相处', '第六章 · 红绿灯信号', '第七章 · 现在就能做', 'actionSteps', 'getArchetypeResults', '你的人设图鉴已点亮', '喜欢还是想逃', '人物相似度', '测试用于关系风格探索']) {
  assert(storybookReport.includes(value), `storybook full report missing ${value}`)
}
assert(!storybookReport.includes('color-mix('), 'storybook result must stay compatible with WeChat WXSS')
const archetypeAdmin = read('src/pages/admin/components/panels/ArchetypeQuestionBankPanel.vue')
for (const value of ['resultPage.stageAdvice', 'resultPage.trafficSignals', 'resultPage.actionSteps', '编辑完整报告配置']) {
  assert(archetypeAdmin.includes(value), `archetype admin missing configurable result field ${value}`)
}
for (const file of [
  'src/pages/relation-heroine-result/relation-heroine-result.vue',
  'src/pages/crush-celebrity-result/crush-celebrity-result.vue',
  'src/pages/dimension-character-result/dimension-character-result.vue'
]) {
  const source = read(file)
  assert(source.includes('HeartPersonaStorybookReport'), `${file} must use the shared storybook report`)
  assert(source.includes("@import '@/styles/heart-persona-storybook.scss'"), `${file} must use shared storybook tokens and actions`)
}

const subscription = read('src/pages/subscription/subscription.vue')
before(subscription, 'if (confirmed?.success)', 'uni.navigateBack()', 'subscription must navigate back only inside the confirmed-success path')
assert(subscription.includes("returnFrom.value === 'heart_persona_result'"))
assert(subscription.includes('权益生效处理中'))

const home = read('src/utils/heart-persona-result.ts')
before(home, 'if (!response?.success)', 'shouldCompleteSelfProfile(response)', 'home CTA must validate the profile response before onboarding routing')
assert(home.includes('/pages/self-profile/self-profile?mode=onboarding'))
assert(!home.includes('subjectGender'))
assert(!home.includes('createCase'))

const login = read('src/pages/login/login.vue')
assert(login.includes('catch { return'))
before(login, 'if (!uid)', "if (uid && pendingRedirect.value && isHeartPersonaShareRedirect", 'login must stop when auth is still unavailable')
before(login, "isHeartPersonaShareRedirect(pendingRedirect.value)", 'shouldCompleteSelfProfile()', 'share redirect must bypass profile onboarding until the result flow reaches its home CTA')

console.log('archetype share UI contract tests passed')
