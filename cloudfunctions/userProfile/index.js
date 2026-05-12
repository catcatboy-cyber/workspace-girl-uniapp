const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

const GENDERS = new Set(['male', 'female', 'private'])
const AGE_RANGES = new Set(['under18', '18_22', '23_26', '27_plus'])
const IDENTITIES = new Set(['high_school', 'college', 'graduate', 'worker', 'other'])
const ZODIACS = new Set(['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'])
const CONSTELLATIONS = new Set(['', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'])

function normalizeProfile(input = {}) {
  const profile = input && typeof input === 'object' ? input : {}
  const gender = String(profile.gender || '').trim()
  const ageRange = String(profile.ageRange || '').trim()
  const identity = String(profile.identity || '').trim()
  const zodiac = String(profile.zodiac || '').trim()
  const constellation = String(profile.constellation || '').trim()

  return {
    gender: GENDERS.has(gender) ? gender : '',
    ageRange: AGE_RANGES.has(ageRange) ? ageRange : '',
    identity: IDENTITIES.has(identity) ? identity : '',
    zodiac: ZODIACS.has(zodiac) ? zodiac : '',
    constellation: CONSTELLATIONS.has(constellation) ? constellation : ''
  }
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
      const profile = normalizeProfile(event.profile)
      const invalidMessage = validateRequired(profile)
      if (invalidMessage) {
        return { success: false, message: invalidMessage }
      }

      const now = new Date()
      const user = await getUser(userId)
      const nextProfile = {
        ...(user?.selfProfile || {}),
        ...profile,
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
