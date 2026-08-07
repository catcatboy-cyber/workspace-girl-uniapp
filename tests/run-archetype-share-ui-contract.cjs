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
