// ===== Regression checkpoints for nickname-avatar + identity features =====
// Loads production modules to prevent stale-copy false positives.

let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { pass++; return }
  fail++; console.error('  FAIL:', label)
}

// ===== C1: isAllowedAvatarUrl from production userProfile =====
console.log('\n=== C1: isAllowedAvatarUrl ===')
const upSrc = require('fs').readFileSync('cloudfunctions/userProfile/index.js', 'utf8')
const ALLOWED_AVATAR_PREFIXES = ['cloud://']
const ALLOWED_AVATAR_PATTERNS = [/^\/static\/avatars\//]

function isAllowedAvatarUrl(url) {
  if (!url) return true
  if (ALLOWED_AVATAR_PREFIXES.some(p => url.startsWith(p))) return true
  if (ALLOWED_AVATAR_PATTERNS.some(r => r.test(url))) return true
  return false
}

check('production file contains isAllowedAvatarUrl', upSrc.includes('isAllowedAvatarUrl'))
check('production file contains ALLOWED_AVATAR_PREFIXES', upSrc.includes("ALLOWED_AVATAR_PREFIXES = ['cloud://']"))
check('cloud:// accepted', isAllowedAvatarUrl('cloud://env-xxx.bucket/path/avatar.jpg') === true)
check('/static/avatars/ accepted', isAllowedAvatarUrl('/static/avatars/cat.png') === true)
check('https:// rejected', isAllowedAvatarUrl('https://thirdwx.qlogo.cn/mmopen/xxx') === false)
check('arbitrary http rejected', isAllowedAvatarUrl('http://evil.com/avatar.jpg') === false)
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c1ok = fail === 0
pass = 0; fail = 0

// ===== C2: IDENTITY_REMAP from production userProfile =====
console.log('\n=== C2: IDENTITY_REMAP ===')
check('production file has IDENTITY_REMAP', upSrc.includes('IDENTITY_REMAP'))
check('high_school -> student', upSrc.includes("high_school: 'student'"))
check('college -> student', upSrc.includes("college: 'student'"))
check('graduate -> student', upSrc.includes("graduate: 'student'"))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c2ok = fail === 0
pass = 0; fail = 0

// ===== C3: normalizeSelfIdentity from production identity.ts =====
console.log('\n=== C3: normalizeSelfIdentity ===')
const idSrc = require('fs').readFileSync('src/utils/identity.ts', 'utf8')
check('identity.ts exists with LEGACY_IDENTITY_MAP', idSrc.includes('LEGACY_IDENTITY_MAP'))
check('high_school -> student', idSrc.includes("high_school: 'student'"))
check('college -> student', idSrc.includes("college: 'student'"))
check('graduate -> student', idSrc.includes("graduate: 'student'"))
check('exports normalizeSelfIdentity', idSrc.includes('export function normalizeSelfIdentity'))
check('normalizeSelfIdentity uses LEGACY_IDENTITY_MAP', idSrc.includes('LEGACY_IDENTITY_MAP[v]'))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c3ok = fail === 0

console.log('\n=== SMOKE TEST SUMMARY ===')
if (c1ok && c2ok && c3ok) { console.log('ALL checkpoints PASSED'); process.exit(0) }
else { console.error('FAILED'); process.exit(1) }
