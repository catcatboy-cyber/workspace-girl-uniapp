'use strict'

const assert = require('assert')
const cloudbase = require('@cloudbase/node-sdk')
const relationContent = require('../cloudfunctions/_shared/relation-female-v1.json')
const { checksumContent, buildBankId, FEATURE_RELATION } = require('../cloudfunctions/_shared/archetype-bank')

function clone(value) { return value === undefined ? undefined : structuredClone(value) }

function createDb(initial) {
  const stores = new Map(Object.entries(initial).map(([name, rows]) => [name, new Map(rows.map((row) => [row._id, clone(row)]))]))
  function collection(name) {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      doc(id) { return { async get() { return { data: store.has(id) ? clone(store.get(id)) : null } }, async update(patch) { store.set(id, { ...store.get(id), ...clone(patch) }); return { updated: 1 } }, async set(document) { store.set(id, { ...clone(document), _id: id }); return { upserted: 1 } } } },
      async add(document) { const id = document._id || `${name}-${store.size + 1}`; if (store.has(id)) throw Object.assign(new Error('duplicate'), { code: 'DUPLICATE' }); store.set(id, { ...clone(document), _id: id }); return { id } },
      where(filter) { let rows = [...store.values()].filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)); const query = { limit(count) { rows = rows.slice(0, count); return query }, orderBy() { return query }, async get() { return { data: clone(rows) } } }; return query }
    }
  }
  return { collection, runTransaction: async (callback) => callback({ collection }), rows: (name) => [...(stores.get(name)?.values() || [])].map(clone) }
}

function hasForbidden(value, forbidden) {
  if (!value || typeof value !== 'object') return false
  if (Object.keys(value).some((key) => forbidden.has(key))) return true
  return Object.values(value).some((item) => hasForbidden(item, forbidden))
}

async function main() {
  const bank = { _id: buildBankId(FEATURE_RELATION, 'female', '1.0.0'), featureKey: FEATURE_RELATION, subjectGender: 'female', contentVersion: '1.0.0', status: 'published', checksum: checksumContent(relationContent), content: relationContent }
  const result = {
    _id: 'result-1', userId: 'owner-1', kind: 'relation_archetype', mode: 'target', subjectGender: 'female', contentVersion: '1.0.0',
    personKey: relationContent.archetypes[0].key, similarity: 87, answers: [{ questionId: 'secret', optionKey: 'A' }], dimensionScores: { secret: 99 }, topFive: [{ secret: true }], caseId: 'case-secret', caseSnapshot: { name: 'private-crush' }, sourceResultShareId: 'hps_source_secret', sourceResultId: 'source-secret', createdAt: new Date()
  }
  const db = createDb({ archetype_question_banks: [bank], archetype_results: [result], archetype_result_shares: [], users: [{ _id: 'owner-1', selfProfile: { nickname: '小雨', avatar: '/static/avatars/anime-mint.svg' } }] })
  let userId = 'owner-1'
  let accessLevel = 'preview'
  const cloudbasePath = require.resolve('@cloudbase/node-sdk')
  require.cache[cloudbasePath].exports = { ...cloudbase, SYMBOL_CURRENT_ENV: 'test', init: () => ({ database: () => db }) }
  const authPath = require.resolve('../cloudfunctions/getArchetypeReport/_shared/auth')
  require(authPath)
  require.cache[authPath].exports = { requireAuthenticatedUserId: async () => userId }
  const accessPath = require.resolve('../cloudfunctions/getArchetypeReport/_shared/archetype-report-access')
  require(accessPath)
  require.cache[accessPath].exports = { resolveReportAccess: async () => ({ accessLevel }) }
  const functionPath = require.resolve('../cloudfunctions/getArchetypeReport/index.js')
  delete require.cache[functionPath]
  const handler = require(functionPath)

  const first = await handler.main({ action: 'prepareShare', resultId: result._id })
  assert.strictEqual(first.success, true)
  assert.match(first.data.resultShareId, /^hps_[A-Za-z0-9_-]{24,80}$/)
  const second = await handler.main({ action: 'prepareShare', resultId: result._id })
  assert.strictEqual(second.data.resultShareId, first.data.resultShareId)
  const parallel = await Promise.all(Array.from({ length: 20 }, () => handler.main({ action: 'prepareShare', resultId: result._id })))
  assert(parallel.every((item) => item.data.resultShareId === first.data.resultShareId))
  assert.strictEqual(db.rows('archetype_result_shares').length, 1)

  userId = 'viewer-2'
  const band = await handler.main({ action: 'getSharedPreview', resultShareId: first.data.resultShareId })
  assert.strictEqual(band.success, true)
  assert.strictEqual(band.share.scoreDisplay.type, 'band')
  assert.match(band.share.summary, /^TA在这次答题中/)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(band.share.scoreDisplay, 'exact'), false)
  assert.strictEqual(hasForbidden(band.share, new Set([
    'answers', 'scenarioAnswers', 'dimensions', 'dimensionScores', 'similarities', 'topFive', 'secondary',
    'decision', 'evidence', 'watchSignals', 'communicationAdvice', 'exactSimilarity', 'caseId', 'caseSnapshot',
    'userId', 'ownerUserId', 'resultId', 'sourceResultId', 'sourceResultShareId', 'email', 'phone', 'openid', 'inviteCode', 'reportAccess', 'accessLevel'
  ])), false)
  const invalid = await handler.main({ action: 'getSharedPreview', resultShareId: 'hps_invalid' })
  assert.strictEqual(invalid.code, 'SHARE_NOT_FOUND')

  accessLevel = 'full'
  const exact = await handler.main({ action: 'getSharedPreview', resultShareId: first.data.resultShareId })
  assert.deepStrictEqual(exact.share.scoreDisplay, { type: 'exact', exact: 87 })
  accessLevel = 'preview'
  const downgraded = await handler.main({ action: 'getSharedPreview', resultShareId: first.data.resultShareId })
  assert.strictEqual(downgraded.share.scoreDisplay.type, 'band')

  const shareDoc = db.rows('archetype_result_shares')[0]
  await db.collection('archetype_result_shares').doc(shareDoc._id).update({ status: 'revoked', revokedAt: new Date() })
  const revoked = await handler.main({ action: 'getSharedPreview', resultShareId: first.data.resultShareId })
  assert.strictEqual(revoked.code, 'SHARE_NOT_FOUND')
  userId = 'owner-1'
  const reactivated = await handler.main({ action: 'prepareShare', resultId: result._id })
  assert.notStrictEqual(reactivated.data.resultShareId, first.data.resultShareId)
  userId = 'viewer-2'
  const oldLink = await handler.main({ action: 'getSharedPreview', resultShareId: first.data.resultShareId })
  assert.strictEqual(oldLink.code, 'SHARE_NOT_FOUND')
  userId = 'not-owner'
  const unauthorized = await handler.main({ action: 'prepareShare', resultId: result._id })
  assert.strictEqual(unauthorized.code, 'RESULT_NOT_FOUND')

  console.log('archetype share security tests passed')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
