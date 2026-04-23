const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event) => {
  const { aiEnabled, aiProvider, aiApiKey, aiBaseUrl, aiModel, aiFallbackToRules } = event
  try {
    const userId = await requireAuthenticatedUserId(app)

    const now = new Date()
    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()

    const update = { updatedAt: now }
    if (typeof aiEnabled !== 'undefined') update.aiEnabled = !!aiEnabled
    if (typeof aiProvider !== 'undefined') update.aiProvider = aiProvider
    if (typeof aiBaseUrl !== 'undefined') update.aiBaseUrl = aiBaseUrl
    if (typeof aiModel !== 'undefined') update.aiModel = aiModel
    if (typeof aiFallbackToRules !== 'undefined') update.aiFallbackToRules = !!aiFallbackToRules

    if (typeof aiApiKey !== 'undefined') {
      // empty string clears, otherwise overwrite
      update.aiApiKey = aiApiKey === '' ? '' : aiApiKey
    }

    if (!data || data.length === 0) {
      const newId = `settings_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      await db.collection('system_settings').add({
        _id: newId,
        userId,
        aiEnabled: false,
        aiProvider: '',
        aiApiKey: '',
        aiBaseUrl: '',
        aiModel: '',
        aiFallbackToRules: true,
        ...update
      })
    } else {
      await db.collection('system_settings').doc(data[0]._id).update(update)
    }

    return { success: true }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('updateAISettings error:', error)
    return { success: false, message: '更新AI设置失败' }
  }
}
