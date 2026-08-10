const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const COLLECTIONS = [
  'users',
  'cases',
  'assessments',
  'timeline_records',
  'system_settings',
  'weekly_reviews',
  'token_usage_records',
  'token_accounts',
  'token_ledger_records',
  'call_usage_records',
  'voice_usage',
  'recharge_orders',
  'referral_claims',
  'referral_commission_jobs',
  'referral_commissions',
  'commission_accounts',
  'commission_ledger',
  'commission_review_tasks',
  'archetype_question_banks',
  'archetype_results'
]

function normalizeDoc(res) {
  const data = res?.data
  return Array.isArray(data) ? (data[0] || null) : (data || null)
}

function normalizeList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

async function getStrictAuthUserId() {
  const userInfo = await app.auth().getUserInfo()
  const candidates = [
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  const error = new Error('UNAUTHENTICATED')
  error.code = 'UNAUTHENTICATED'
  throw error
}

async function requireAdminUserId() {
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  const userIds = []

  userIds.push(await getStrictAuthUserId())

  for (const userId of [...new Set(userIds)]) {
    const user = normalizeDoc(await db.collection('users').doc(userId).get().catch(() => null))
    const email = String(user?.email || '').trim().toLowerCase()
    if (Boolean(user?.isAdmin) || user?.role === 'admin' || adminEmails.includes(email)) {
      return userId
    }
  }

  if (userIds.length === 0) {
    const error = new Error('UNAUTHENTICATED')
    error.code = 'UNAUTHENTICATED'
    throw error
  }

  const error = new Error('ADMIN_REQUIRED')
  error.code = 'ADMIN_REQUIRED'
  throw error
}

exports.main = async (event = {}) => {
  try {
    await requireAdminUserId()
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED') return { success: false, message: '请先登录管理员账号' }
    if (error?.code === 'ADMIN_REQUIRED') return { success: false, message: '当前账号没有后台管理权限' }
    return { success: false, message: '初始化鉴权失败' }
  }

  const results = {}
  for (const name of COLLECTIONS) {
    try {
      const res = await db.createCollection(name)
      results[name] = { ok: true, res }
    } catch (err) {
      results[name] = { ok: false, code: err.code, message: err.message }
    }
  }
  return { success: true, results }
}
