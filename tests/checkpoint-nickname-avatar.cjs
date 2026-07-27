// ===== Regression checkpoints for nickname-avatar feature =====

// ===== isAllowedAvatarUrl (sync'd between userProfile & wechatLogin) =====
const ALLOWED_AVATAR_PREFIXES = ['cloud://']
const ALLOWED_AVATAR_PATTERNS = [/^\/static\/avatars\//]

function isAllowedAvatarUrl(url) {
  if (!url) return true
  if (ALLOWED_AVATAR_PREFIXES.some(p => url.startsWith(p))) return true
  if (ALLOWED_AVATAR_PATTERNS.some(r => r.test(url))) return true
  return false
}

let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { pass++; return }
  fail++; console.error('  FAIL:', label)
}

console.log('\n=== Checkpoint 1: isAllowedAvatarUrl ===')
check('cloud:// accepted', isAllowedAvatarUrl('cloud://env-xxx.bucket/path/avatar.jpg') === true)
check('/static/avatars/ accepted', isAllowedAvatarUrl('/static/avatars/cat.png') === true)
check('empty string accepted', isAllowedAvatarUrl('') === true)
check('null accepted', isAllowedAvatarUrl(null) === true)
check('undefined accepted', isAllowedAvatarUrl(undefined) === true)
check('https:// rejected', isAllowedAvatarUrl('https://thirdwx.qlogo.cn/mmopen/xxx') === false)
check('arbitrary http rejected', isAllowedAvatarUrl('http://evil.com/avatar.jpg') === false)
check('random string rejected', isAllowedAvatarUrl('some-random-value') === false)
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c1ok = fail === 0
pass = 0; fail = 0

// ===== normalizeProfile includes nickname/avatarUrl =====
const GENDERS = new Set(['male', 'female', 'private'])
const AGE_RANGES = new Set(['under18', '18_22', '23_26', '27_plus'])
const IDENTITIES = new Set(['high_school', 'college', 'graduate', 'worker', 'other'])
const ZODIACS = new Set(['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'])
const CONSTELLATIONS = new Set(['', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'])
const AI_STYLES = new Set(['', 'gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian'])
const AI_BOLDNESS = new Set(['', 'conservative', 'balanced', 'bold'])

function normalizeProfile(input = {}) {
  const p = input && typeof input === 'object' ? input : {}
  const gender = String(p.gender || '').trim()
  const ageRange = String(p.ageRange || '').trim()
  const identity = String(p.identity || '').trim()
  const zodiac = String(p.zodiac || '').trim()
  const constellation = String(p.constellation || '').trim()
  const aiStyle = String(p.aiStyle || '').trim()
  const aiBoldness = String(p.aiBoldness || '').trim()
  const nickname = String(p.nickname || '').trim().slice(0, 30)
  const avatarUrl = String(p.avatarUrl || '').trim().slice(0, 500)
  return {
    gender: GENDERS.has(gender) ? gender : '',
    ageRange: AGE_RANGES.has(ageRange) ? ageRange : '',
    identity: IDENTITIES.has(identity) ? identity : '',
    zodiac: ZODIACS.has(zodiac) ? zodiac : '',
    constellation: CONSTELLATIONS.has(constellation) ? constellation : '',
    aiStyle: AI_STYLES.has(aiStyle) ? aiStyle : '',
    aiBoldness: AI_BOLDNESS.has(aiBoldness) ? aiBoldness : '',
    nickname: nickname || '',
    avatarUrl: avatarUrl || ''
  }
}

console.log('\n=== Checkpoint 2: normalizeProfile ===')
const p = normalizeProfile({ gender:'male', ageRange:'18_22', identity:'college', nickname:'小明', avatarUrl:'cloud://xxx/yyy.jpg' })
check('nickname preserved', p.nickname === '小明')
check('avatarUrl preserved', p.avatarUrl === 'cloud://xxx/yyy.jpg')
check('nickname truncated to 30 chars', normalizeProfile({ gender:'male', ageRange:'18_22', identity:'college', nickname:'a'.repeat(50) }).nickname.length === 30)
check('nickname empty when missing', normalizeProfile({ gender:'male', ageRange:'18_22', identity:'college' }).nickname === '')
check('avatarUrl empty when missing', normalizeProfile({ gender:'male', ageRange:'18_22', identity:'college' }).avatarUrl === '')
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c2ok = fail === 0
pass = 0; fail = 0

// ===== normalizeProfilePatch returns {patch, topPatch} =====
function normalizeProfilePatch(input = {}) {
  const profile = input && typeof input === 'object' ? input : {}
  const patch = {}
  if (Object.prototype.hasOwnProperty.call(profile, 'gender')) {
    patch.gender = GENDERS.has(String(profile.gender || '').trim()) ? String(profile.gender || '').trim() : ''
  }
  const topPatch = {}
  if (Object.prototype.hasOwnProperty.call(profile, 'nickname')) {
    const v = String(profile.nickname || '').trim().slice(0, 30)
    patch.nickname = v
    topPatch.nickName = v
    topPatch.nickname = v
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'avatarUrl')) {
    const v = String(profile.avatarUrl || '').trim().slice(0, 500)
    if (v && !isAllowedAvatarUrl(v)) {
      // reject illegal value
    } else {
      patch.avatarUrl = v
      topPatch.avatarUrl = v
    }
  }
  return { patch, topPatch }
}

console.log('\n=== Checkpoint 3: normalizeProfilePatch ===')
let r = normalizeProfilePatch({ nickname: '小明' })
check('#10 only-nickname: patch has nickname', r.patch.nickname === '小明')
check('#10 only-nickname: topPatch has nickName', r.topPatch.nickName === '小明')
check('#10 only-nickname: topPatch has nickname', r.topPatch.nickname === '小明')
check('#10 only-nickname: avatarUrl NOT in topPatch', !('avatarUrl' in r.topPatch))
check('#10 only-nickname: avatarUrl NOT in patch', !('avatarUrl' in r.patch))

r = normalizeProfilePatch({ avatarUrl: 'cloud://xxx/yyy.jpg' })
check('only-avatarUrl: patch has avatarUrl', r.patch.avatarUrl === 'cloud://xxx/yyy.jpg')
check('only-avatarUrl: topPatch has avatarUrl', r.topPatch.avatarUrl === 'cloud://xxx/yyy.jpg')
check('only-avatarUrl: nickname NOT in topPatch', !('nickName' in r.topPatch))
check('only-avatarUrl: nickname NOT in patch', !('nickname' in r.patch))

r = normalizeProfilePatch({ avatarUrl: 'https://thirdwx.qlogo.cn/xxx' })
check('https reject: avatarUrl NOT in patch', !('avatarUrl' in r.patch))
check('https reject: avatarUrl NOT in topPatch', !('avatarUrl' in r.topPatch))

r = normalizeProfilePatch({ nickname: '小明', avatarUrl: 'cloud://xxx/yyy.jpg' })
check('both: nickname in patch', r.patch.nickname === '小明')
check('both: avatarUrl in patch', r.patch.avatarUrl === 'cloud://xxx/yyy.jpg')

r = normalizeProfilePatch({ gender: 'male' })
check('other-field: topPatch empty', Object.keys(r.topPatch).length === 0)

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c3ok = fail === 0
pass = 0; fail = 0

// ===== Checkpoint 4: update merge logic =====
console.log('\n=== Checkpoint 4: update merge safety (#11, #12) ===')
// Simulate merge: only named-nickname input, no avatarUrl
const topPatch1 = { nickName: '小明', nickname: '小明' }
const updateData1 = { selfProfile: {}, updatedAt: new Date() }
for (const key of Object.keys(topPatch1)) {
  if (topPatch1[key] !== undefined && topPatch1[key] !== null) {
    updateData1[key] = topPatch1[key]
  }
}
check('#12 only-nickname: nickName merged', updateData1.nickName === '小明')
check('#12 only-nickname: avatarUrl NOT merged', !('avatarUrl' in updateData1))
check('#12 only-nickname: selfProfile preserved', 'selfProfile' in updateData1)

// Simulate merge: empty topPatch
const topPatch2 = {}
const updateData2 = { selfProfile: {}, updatedAt: new Date() }
for (const key of Object.keys(topPatch2)) {
  if (topPatch2[key] !== undefined && topPatch2[key] !== null) {
    updateData2[key] = topPatch2[key]
  }
}
check('empty topPatch: only selfProfile + updatedAt', Object.keys(updateData2).length === 2)

// Simulate merge: both nickname + avatarUrl (cloud)
const topPatch3 = { nickName: '小明', nickname: '小明', avatarUrl: 'cloud://xxx/yyy.jpg' }
const updateData3 = { selfProfile: {}, updatedAt: new Date() }
for (const key of Object.keys(topPatch3)) {
  if (topPatch3[key] !== undefined && topPatch3[key] !== null) {
    updateData3[key] = topPatch3[key]
  }
}
check('both: avatarUrl merged', updateData3.avatarUrl === 'cloud://xxx/yyy.jpg')
check('both: nickName merged', updateData3.nickName === '小明')

console.log('  Result: %d/%d PASS', pass, pass + fail)
const c4ok = fail === 0
pass = 0; fail = 0

// ===== Summary =====
console.log('\n=== SUMMARY ===')
if (c1ok && c2ok && c3ok && c4ok) {
  console.log('All 4 checkpoints PASS')
  process.exit(0)
} else {
  console.error('Some checkpoints FAILED')
  process.exit(1)
}
