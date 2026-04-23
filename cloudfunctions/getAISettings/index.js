const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

function redactKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return '***' + key.slice(-4)
}

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app)

    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()

    if (!data || data.length === 0) {
      return { success: true, settings: null }
    }

    const settings = { ...data[0] }
    if (settings.aiApiKey) {
      settings.aiApiKey = redactKey(settings.aiApiKey)
    } else {
      settings.aiApiKey = ''
    }

    return { success: true, settings }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getAISettings error:', error)
    return { success: false, message: '获取AI设置失败' }
  }
}
