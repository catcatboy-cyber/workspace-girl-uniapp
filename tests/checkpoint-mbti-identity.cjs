// ===== Smoke & regression checkpoint tests for MBTI + identity fields =====
// 方案 v5 — feature/mbti-identity-fields

const fs = require('fs')
let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { pass++; return }
  fail++; console.error('  FAIL:', label)
}

function readShared(name) {
  return fs.readFileSync(`cloudfunctions/_shared/${name}`, 'utf8')
}

// ==========================================
// C1: case-profile.js — core module exists with correct exports
// ==========================================
console.log('\n=== C1: case-profile.js core module ===')
const cp = readShared('case-profile.js')

check('VALID_MBTI Set with 16 types (empty + 16)',
  cp.includes("'INTJ'") && cp.includes("'ESFP'") && cp.includes("new Set([") &&
  cp.match(/'[IE][SN][TF][JP]'/g)?.length >= 16)

check('MBTI validation uses Set (NOT regex .toUpperCase)',
  cp.includes('VALID_MBTI.has') && !cp.includes('.toUpperCase()'))

check('VALID_IDENTITY_LABEL uses English keys',
  cp.includes("'ex'") && cp.includes("'crush_secret'") && cp.includes("'classmate'") &&
  cp.includes("'colleague'") && cp.includes("'online_friend'") && cp.includes("'arranged'"))

check('IDENTITY_LABEL_MAP maps English→Chinese',
  cp.includes("'ex': '前男友/前女友'") && cp.includes("'arranged': '相亲对象'"))

check('resolveIdentityLabel(profile) accepts profile object',
  cp.includes('resolveIdentityLabel(profile)') && cp.includes('profile.identityLabel'))

check('__custom__ falls back to identityLabelCustom',
  cp.includes("label === '__custom__'") && cp.includes('identityLabelCustom'))

check('identityLabelCustom slice(0, 20)',
  cp.includes('.slice(0, 20)'))

check('normalizeCaseProfilePatch uses hasOwnProperty.cal',
  cp.includes('hasOwnProperty.call(input') || cp.includes('hasOwnProperty.call(input, key)'))

check('serializeCaseProfileForAI exports',
  cp.includes('module.exports') && cp.includes('serializeCaseProfileForAI'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c1ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C2: ai-event.js — serializeSelfProfile +mbtiCode
// ==========================================
console.log('\n=== C2: ai-event.js MBTI injection ===')
const ae = readShared('ai-event.js')

check('serializeSelfProfile includes mbtiCode',
  ae.includes('mbti = profile.mbtiCode') || ae.includes("mbti: profile.mbtiCode"))

check('serializeCaseProfile delegates to serializeCaseProfileForAI',
  ae.includes('serializeCaseProfileForAI'))

check('case-profile.js is required in ai-event.js',
  ae.includes("require('./case-profile')"))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c2ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C3: event-understanding.js — legacy entry remains explicitly disabled
// ==========================================
console.log('\n=== C3: event-understanding.js ===')
const eu = readShared('event-understanding.js')

check('legacy event-understanding entry is explicitly disabled',
  eu.includes('LEGACY_EVENT_UNDERSTANDING_DISABLED'))

check('legacy entry does not run a second case-profile serializer',
  !eu.includes('serializeCaseProfileForAI'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c3ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C4: createCase — normalizeCaseProfile used
// ==========================================
console.log('\n=== C4: createCase/index.js ===')
const cc = fs.readFileSync('cloudfunctions/createCase/index.js', 'utf8')

check('case-profile is required',
  cc.includes("require('./_shared/case-profile')"))

check('normalizeCaseProfile used instead of raw profile',
  cc.includes('normalizeCaseProfile(profile)'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c4ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C5: updateCaseProfile — normalizeCaseProfilePatch used
// ==========================================
console.log('\n=== C5: updateCaseProfile/index.js ===')
const uc = fs.readFileSync('cloudfunctions/updateCaseProfile/index.js', 'utf8')

check('case-profile is required',
  uc.includes("require('./_shared/case-profile')"))

check('normalizeCaseProfilePatch used for partial update',
  uc.includes('normalizeCaseProfilePatch(profile)'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c5ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C6: userProfile — mbtiCode in normalizeProfile and normalizeProfilePatch
// ==========================================
console.log('\n=== C6: userProfile/index.js ===')
const up = fs.readFileSync('cloudfunctions/userProfile/index.js', 'utf8')

check('VALID_MBTI Set defined locally',
  up.includes('VALID_MBTI') && up.includes("'INTJ'"))

check('normalizeProfile returns mbtiCode',
  up.includes('mbtiCode:') && up.includes('VALID_MBTI.has'))

check('normalizeProfilePatch has mbtiCode hasOwnProperty block',
  up.includes("hasOwnProperty.call(profile, 'mbtiCode')"))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c6ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C7: petLines — getCaseMeta + buildReplyToolContext
// ==========================================
console.log('\n=== C7: petLines/index.js ===')
const pl = fs.readFileSync('cloudfunctions/petLines/index.js', 'utf8')

check('getCaseMeta includes mbti',
  pl.includes('mbti') && pl.includes('mbtiCode'))

check('getCaseMeta includes identityLabel with resolveIdentityLabel(profile)',
  pl.includes('resolveIdentityLabel(profile)') && pl.includes('identityLabel'))

check('buildReplyToolContext includes mbti for target',
  pl.includes('targetProfile.mbtiCode'))

check('buildReplyToolContext uses resolveIdentityLabel(profile)',
  pl.includes('resolveIdentityLabel(targetProfile)'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c7ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C8: generatePairRead — prompt injection
// ==========================================
console.log('\n=== C8: generatePairRead/index.js ===')
const gp = fs.readFileSync('cloudfunctions/generatePairRead/index.js', 'utf8')

check('case-profile is required',
  gp.includes("require('./_shared/case-profile')"))

check('mbtiCode injected into userPrompt',
  gp.includes('selfProfile.mbtiCode') && gp.includes('caseProfile.mbtiCode') && gp.includes('personalityContext'))

check('identityLabel resolved in prompt context',
  gp.includes('resolveIdentityLabel(caseProfile)'))

check('personalityContext built (JSON object, no mbtiLines)',
  gp.includes('personalityContext') && gp.includes('personalityContextStr'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c8ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C9: weeklyReview — serializeCaseProfile has new fields
// ==========================================
console.log('\n=== C9: weeklyReview/index.js ===')
const wr = fs.readFileSync('cloudfunctions/weeklyReview/index.js', 'utf8')

check('mbtiCode in serializeCaseProfile',
  wr.includes("profile?.mbtiCode") && wr.includes('mbti'))

check('resolveIdentityLabel used in serializeCaseProfile',
  wr.includes('resolveIdentityLabel(profile)'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c9ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C10: frontend — api.ts SelfProfile +mbtiCode
// ==========================================
console.log('\n=== C10: api.ts SelfProfile type ===')
const api = fs.readFileSync('src/utils/api.ts', 'utf8')

check('SelfProfile has mbtiCode field',
  api.includes('mbtiCode?: string'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c10ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C11: frontend — taohua.ts exports
// ==========================================
console.log('\n=== C11: taohua.ts MBTI + identity exports ===')
const th = fs.readFileSync('src/utils/taohua.ts', 'utf8')

check('MBTI_OPTIONS exported with 16 types',
  th.includes('export const MBTI_OPTIONS') && th.includes("'INTJ'") && th.includes("'ESFP'"))

check('IDENTITY_LABEL_OPTIONS uses English keys',
  th.includes("value: 'ex'") && th.includes("value: 'crush_secret'"))

check('resolveIdentityLabel(profile) exported',
  th.includes('export function resolveIdentityLabel') && th.includes('profile:'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c11ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C12: frontend — self-profile MBTI picker
// ==========================================
console.log('\n=== C12: self-profile.vue MBTI picker ===')
const sp = fs.readFileSync('src/pages/self-profile/self-profile.vue', 'utf8')

check('mbtiOptions defined',
  sp.includes("'INTJ'") && sp.includes("'INTP'"))

check('MBTI picker in template',
  sp.includes('MBTI 性格类型') || sp.includes('mbti'))

check('mbtiCode in reactive profile',
  sp.includes("mbtiCode: ''"))

check('mbtiCode in applyProfile',
  sp.includes('value.mbtiCode'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c12ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C13: frontend — edit-profile English identityLabel keys
// ==========================================
console.log('\n=== C13: edit-profile.vue identityLabel keys ===')
const ep = fs.readFileSync('src/pages/edit-profile/edit-profile.vue', 'utf8')

check('identityLabelValues uses English keys',
  ep.includes("'ex'") && ep.includes("'crush_secret'"))

check('IDENTITY_LABEL_MAP defined',
  ep.includes("IDENTITY_LABEL_MAP"))

check('identityLabelDisplay computed uses map',
  ep.includes('IDENTITY_LABEL_MAP[profile.identityLabel]'))

check('identityLabelValues has only English keys (ex, crush_secret, etc)',
  /identityLabelValues\s*=\s*\[/.test(ep) &&
  ep.match(/identityLabelValues\s*=\s*\[([^\]]*)\]/)?.[1]?.includes("'ex'") &&
  ep.match(/identityLabelValues\s*=\s*\[([^\]]*)\]/)?.[1]?.includes("'__custom__'"))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c13ok = fail === 0
pass = 0; fail = 0

// ==========================================
// ==========================================
// C14: pair-onboarding — identity init + normalizeSelfIdentity
// ==========================================
console.log('\n=== C14: pair-onboarding.vue identity init ===')
const po = fs.readFileSync('src/pages/pair-onboarding/pair-onboarding.vue', 'utf8')

check('identityOptions uses new enum (student/worker/other)',
  po.includes("value: 'student'") && po.includes("value: 'worker'") && !po.includes("high_school"))

check('selfForm.identity initialized with normalizeSelfIdentity',
  po.includes('normalizeSelfIdentity(options?.selfIdentity || cached?.identity)'))

check('normalizeSelfIdentity imported',
  po.includes("import { normalizeSelfIdentity } from '@/utils/identity'"))

check('template loops over identityOptions',
  po.includes('v-for="item in identityOptions"'))

check('identity field in reactive selfForm',
  po.includes("identity: ''"))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c14ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C15: create Crush form — MBTI + identity fields
// ==========================================
console.log('\n=== C15: AssessmentForm.vue Crush profile fields ===')
const assessmentForm = fs.readFileSync('src/components/AssessmentForm.vue', 'utf8')

check('create form renders MBTI picker',
  assessmentForm.includes('MBTI 性格类型') && assessmentForm.includes('onMbtiChange'))

check('create form renders TA identity picker and custom input',
  assessmentForm.includes('TA 的身份') &&
  assessmentForm.includes("profile.identityLabel === '__custom__'") &&
  assessmentForm.includes('profile.identityLabelCustom'))

check('create form reuses shared MBTI and identity options',
  assessmentForm.includes('IDENTITY_LABEL_OPTIONS') && assessmentForm.includes('MBTI_OPTIONS'))

check('create payload profile includes MBTI and identity fields',
  assessmentForm.includes('mbtiCode: props.initialProfile?.mbtiCode') &&
  assessmentForm.includes('identityLabel: props.initialProfile?.identityLabel') &&
  assessmentForm.includes('identityLabelCustom: props.initialProfile?.identityLabelCustom') &&
  assessmentForm.includes('profile: { ...profile }'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c15ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C16: homepage hero — MBTI profile tag
// ==========================================
console.log('\n=== C16: index.vue hero MBTI tag ===')
const indexPage = fs.readFileSync('src/pages/index/index.vue', 'utf8')

check('hero profile items include MBTI value when present',
  indexPage.includes('if (p.mbtiCode) items.push(p.mbtiCode)'))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c16ok = fail === 0
pass = 0; fail = 0

// ==========================================
// C17: tab page heroes - MBTI profile tags
// ==========================================
console.log('\n=== C17: tab page hero MBTI tags ===')
const caseDetailPage = fs.readFileSync('src/pages/case-detail/case-detail.vue', 'utf8')
const casesPage = fs.readFileSync('src/pages/cases/cases.vue', 'utf8')
const timelinePage = fs.readFileSync('src/pages/timeline/timeline.vue', 'utf8')

check('case-detail hero profile items include MBTI value',
  caseDetailPage.includes("p.mbtiCode || ''"))

check('cases hero profile tags include active Crush MBTI value',
  casesPage.includes("item.profile?.mbtiCode || ''"))

check('timeline hero profile items include MBTI value',
  timelinePage.includes("p.mbtiCode || ''"))

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c17ok = fail === 0
pass = 0; fail = 0

// ==========================================
// SUMMARY
// ==========================================
console.log('\n=== SMOKE TEST SUMMARY ===')
const checkpointResults = [c1ok, c2ok, c3ok, c4ok, c5ok, c6ok, c7ok, c8ok, c9ok, c10ok, c11ok, c12ok, c13ok, c14ok, c15ok, c16ok, c17ok]
const allPass = checkpointResults.every(Boolean)
const failedChecks = checkpointResults
  .map((ok, i) => ok ? null : `C${i + 1}`).filter(Boolean)

if (allPass) {
  console.log(`ALL ${checkpointResults.length} checkpoints PASSED`)
  process.exit(0)
} else {
  console.error('FAILED checkpoints:', failedChecks.join(', '))
  process.exit(1)
}
