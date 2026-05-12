const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const COLLECTIONS = [
  'users',
  'cases',
  'assessments',
  'timeline_records',
  'system_settings',
  'weekly_reviews'
]

exports.main = async () => {
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
