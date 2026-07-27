const cloudbase = require('@cloudbase/node-sdk')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

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

exports.main = async (event) => {
  const { userId, email, loginType, startDate, endDate, page = 1, pageSize = 50 } = event || {}

  try {
    await requireAdminUserId()
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED') return { success: false, message: '请先登录管理员账号' }
    if (error?.code === 'ADMIN_REQUIRED') return { success: false, message: '当前账号没有后台管理权限' }
    return { success: false, message: '登录日志鉴权失败' }
  }

  // 构建查询条件
  const conditions = []

  if (userId && typeof userId === 'string' && userId.trim()) {
    conditions.push({ userId: userId.trim() })
  }

  if (email && typeof email === 'string' && email.trim()) {
    // 支持邮箱模糊搜索
    conditions.push({
      email: db.RegExp({
        regexp: email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        options: 'i'
      })
    })
  }

  if (loginType && typeof loginType === 'string' && loginType.trim()) {
    conditions.push({ loginType: loginType.trim() })
  }

  if (startDate || endDate) {
    const dateCondition = {}
    if (startDate) {
      dateCondition.$gte = new Date(startDate)
    }
    if (endDate) {
      // endDate 为当天 23:59:59
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateCondition.$lte = end
    }
    if (Object.keys(dateCondition).length > 0) {
      conditions.push({ createdAt: dateCondition })
    }
  }

  const where = conditions.length > 0 ? db.command.and(conditions) : {}

  try {
    // 查询总数
    const countResult = await db.collection('login_logs').where(where).count()
    const total = countResult.total || 0

    // 分页查询，按时间倒序
    const skip = (Math.max(1, Number(page)) - 1) * Math.min(200, Math.max(1, Number(pageSize)))
    const limit = Math.min(200, Math.max(1, Number(pageSize)))

    const { data } = await db.collection('login_logs')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    // 按用户聚合统计
    const statsResult = await db.collection('login_logs')
      .aggregate()
      .match(where)
      .group({
        _id: '$userId',
        totalLogins: { $sum: 1 },
        lastLogin: { $max: '$createdAt' },
        email: { $last: '$email' }
      })
      .sort({ lastLogin: -1 })
      .limit(200)
      .end()

    const userStats = (statsResult.data || []).map(item => ({
      userId: item._id,
      email: item.email || '',
      totalLogins: item.totalLogins,
      lastLogin: item.lastLogin
    }))

    return {
      success: true,
      data: (data || []).map(formatLogRecord),
      total,
      page: Number(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      userStats
    }
  } catch (error) {
    console.error('[getLoginLogs] 查询失败:', error)
    return {
      success: false,
      message: '查询登录日志失败: ' + (error.message || '未知错误')
    }
  }
}

function formatLogRecord(record) {
  return {
    _id: record._id,
    userId: record.userId || '',
    email: record.email || '',
    phone: record.phone || '',
    loginType: record.loginType || '',
    platform: record.platform || '',
    createdAt: record.createdAt
  }
}
