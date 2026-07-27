const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { checkFeatureAccess } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

const GENDERS = new Set(['male', 'female', 'private'])
const AGE_RANGES = new Set(['under18', '18_22', '23_26', '27_plus'])
const IDENTITIES = new Set(['high_school', 'college', 'graduate', 'worker', 'other'])
const ZODIACS = new Set(['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'])
const CONSTELLATIONS = new Set([
  '',
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座'
])
const AI_STYLES = new Set([
  '',
  'gentle_bestie',
  'calm_strategist',
  'playful_flirty',
  'direct_sharp',
  'careful_guardian'
])
const AI_BOLDNESS = new Set(['', 'conservative', 'balanced', 'bold'])
const VALID_MBTI = new Set([
  '', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
])

function normalizeProfile(input = {}) {
  const profile = input && typeof input === 'object' ? input : {}
  const gender = String(profile.gender || '').trim()
  const ageRange = String(profile.ageRange || '').trim()
  const identity = String(profile.identity || '').trim()
  const zodiac = String(profile.zodiac || '').trim()
  const constellation = String(profile.constellation || '').trim()
  const aiStyle = String(profile.aiStyle || '').trim()
  const aiBoldness = String(profile.aiBoldness || '').trim()

  const mbtiCode = String(profile.mbtiCode || '').trim()

  return {
    gender: GENDERS.has(gender) ? gender : '',
    ageRange: AGE_RANGES.has(ageRange) ? ageRange : '',
    identity: IDENTITIES.has(identity) ? identity : '',
    zodiac: ZODIACS.has(zodiac) ? zodiac : '',
    constellation: CONSTELLATIONS.has(constellation) ? constellation : '',
    aiStyle: AI_STYLES.has(aiStyle) ? aiStyle : '',
    aiBoldness: AI_BOLDNESS.has(aiBoldness) ? aiBoldness : '',
    mbtiCode: VALID_MBTI.has(mbtiCode) ? mbtiCode : ''
  }
}

function normalizeProfilePatch(input = {}) {
  const profile = input && typeof input === 'object' ? input : {}
  const patch = {}

  if (Object.prototype.hasOwnProperty.call(profile, 'gender')) {
    patch.gender = GENDERS.has(String(profile.gender || '').trim()) ? String(profile.gender || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'ageRange')) {
    patch.ageRange = AGE_RANGES.has(String(profile.ageRange || '').trim()) ? String(profile.ageRange || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'identity')) {
    patch.identity = IDENTITIES.has(String(profile.identity || '').trim()) ? String(profile.identity || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'zodiac')) {
    patch.zodiac = ZODIACS.has(String(profile.zodiac || '').trim()) ? String(profile.zodiac || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'constellation')) {
    patch.constellation = CONSTELLATIONS.has(String(profile.constellation || '').trim()) ? String(profile.constellation || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'aiStyle')) {
    patch.aiStyle = AI_STYLES.has(String(profile.aiStyle || '').trim()) ? String(profile.aiStyle || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'aiBoldness')) {
    patch.aiBoldness = AI_BOLDNESS.has(String(profile.aiBoldness || '').trim()) ? String(profile.aiBoldness || '').trim() : ''
  }
  if (Object.prototype.hasOwnProperty.call(profile, 'mbtiCode')) {
    const v = String(profile.mbtiCode || '').trim()
    patch.mbtiCode = VALID_MBTI.has(v) ? v : ''
  }

  return patch
}

function validateRequired(profile) {
  if (!profile.gender) return '请选择性别'
  if (!profile.ageRange) return '请选择年龄阶段'
  if (!profile.identity) return '请选择目前身份'
  return ''
}

async function getUser(userId) {
  const result = await db.collection('users').doc(userId).get()
  const data = Array.isArray(result?.data) ? result.data[0] : result?.data
  return data || null
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const action = String(event.action || 'get').trim()

    if (action === 'get') {
      const user = await getUser(userId)
      if (!user) return { success: false, message: '用户不存在' }
      return {
        success: true,
        selfProfile: user.selfProfile || null
      }
    }

    if (action === 'update') {
      const profileInput = event.profile && typeof event.profile === 'object' ? event.profile : {}
      const updatesAIPersona =
        Object.prototype.hasOwnProperty.call(profileInput, 'aiStyle') ||
        Object.prototype.hasOwnProperty.call(profileInput, 'aiBoldness')
      if (updatesAIPersona) {
        const access = await checkFeatureAccess(db, userId, '自定义AI风格')
        if (!access.allowed) {
          return {
            success: false,
            code: 'FEATURE_NOT_AVAILABLE',
            message: access.reason || '当前套餐不支持自定义AI风格'
          }
        }
      }

      const submittedProfile = normalizeProfilePatch(event.profile)
      const now = new Date()
      const user = await getUser(userId)
      const mergedProfile = {
        ...(user?.selfProfile || {}),
        ...submittedProfile
      }
      const normalizedMergedProfile = normalizeProfile(mergedProfile)
      const invalidMessage = validateRequired(normalizedMergedProfile)
      if (invalidMessage) {
        return { success: false, message: invalidMessage }
      }

      const nextProfile = {
        ...normalizedMergedProfile,
        completedAt: user?.selfProfile?.completedAt || now,
        updatedAt: now
      }

      await db.collection('users').doc(userId).update({
        selfProfile: _.set(nextProfile),
        updatedAt: now
      })

      return {
        success: true,
        selfProfile: nextProfile
      }
    }

    return { success: false, message: '不支持的操作' }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('userProfile error:', error)
    return { success: false, message: '保存本人画像失败' }
  }
}
