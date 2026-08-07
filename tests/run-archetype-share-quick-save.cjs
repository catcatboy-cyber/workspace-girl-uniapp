'use strict'

const assert = require('assert')
const cloudbase = require('@cloudbase/node-sdk')
const femaleRelation = require('../cloudfunctions/_shared/relation-female-v1.json')
const maleRelation = require('../cloudfunctions/_shared/relation-male-v1.json')
const celebrity = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const character = require('../cloudfunctions/_shared/dimension-character-v1.json')
const { checksumContent, buildBankId, FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER } = require('../cloudfunctions/_shared/archetype-bank')

function createDb(initial) {
  const stores = new Map(Object.entries(initial).map(([name, rows]) => [name, new Map(rows.map((row) => [row._id, structuredClone(row)]))]))
  let sequence = 0
  function collection(name) {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      doc(id) { return { async get() { return { data: store.has(id) ? structuredClone(store.get(id)) : null } } } },
      async add(document) { const id = document._id || `${name}-${++sequence}`; store.set(id, { ...structuredClone(document), _id: id }); return { id } },
      where(filter) { let rows = [...store.values()].filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)); const query = { limit(count) { rows = rows.slice(0, count); return query }, orderBy() { return query }, async get() { return { data: structuredClone(rows) } } }; return query }
    }
  }
  return { collection, rows: (name) => [...(stores.get(name)?.values() || [])].map((row) => structuredClone(row)) }
}

function relationPayload(content, gender, mode, shareId) {
  const person = content.archetypes[0]
  const stageKey = 'pre_relationship'
  return {
    kind: 'relation_archetype', subjectGender: gender, mode, entryMode: 'share_quick', resultShareId: shareId, stageKey, personKey: person.key,
    answers: [...person.universalQuestions, ...person.stageQuestions[stageKey]].map((question) => ({ questionId: question.id, optionKey: 'A' })),
    scenarioAnswers: person.scenarios[stageKey].map((question) => ({ questionId: question.id, optionKey: 'A' })), contentVersion: '1.0.0'
  }
}

function portraitPayload(kind, content, gender, mode, shareId, version) {
  return { kind, subjectGender: gender, mode, entryMode: 'share_quick', resultShareId: shareId, answers: content.questions.map((question) => ({ questionId: question.id, optionKey: 'A' })), contentVersion: version }
}

async function main() {
  const banks = [
    { _id: buildBankId(FEATURE_RELATION, 'female', '1.0.0'), featureKey: FEATURE_RELATION, subjectGender: 'female', contentVersion: '1.0.0', status: 'published', content: femaleRelation, checksum: checksumContent(femaleRelation) },
    { _id: buildBankId(FEATURE_RELATION, 'male', '1.0.0'), featureKey: FEATURE_RELATION, subjectGender: 'male', contentVersion: '1.0.0', status: 'published', content: maleRelation, checksum: checksumContent(maleRelation) },
    { _id: buildBankId(FEATURE_CELEBRITY, '1.1.0'), featureKey: FEATURE_CELEBRITY, contentVersion: '1.1.0', status: 'published', content: celebrity, checksum: checksumContent(celebrity) },
    { _id: buildBankId(FEATURE_CHARACTER, '1.0.0'), featureKey: FEATURE_CHARACTER, contentVersion: '1.0.0', status: 'published', content: character, checksum: checksumContent(character) }
  ]
  const sourceResults = [
    { _id: 'source-relation', userId: 'owner', kind: 'relation_archetype' },
    { _id: 'source-celebrity', userId: 'owner', kind: 'crush_celebrity' },
    { _id: 'source-character', userId: 'owner', kind: 'dimension_character' }
  ]
  const shareIds = { relation_archetype: `hps_${'r'.repeat(32)}`, crush_celebrity: `hps_${'c'.repeat(32)}`, dimension_character: `hps_${'d'.repeat(32)}` }
  const shares = sourceResults.map((result) => ({ _id: `share-${result.kind}`, resultShareId: shareIds[result.kind], ownerUserId: 'owner', resultId: result._id, kind: result.kind, status: 'active' }))
  const revokedShareId = `hps_${'x'.repeat(32)}`
  shares.push({ _id: 'share-revoked', resultShareId: revokedShareId, ownerUserId: 'owner', resultId: 'source-celebrity', kind: 'crush_celebrity', status: 'revoked' })
  const db = createDb({ archetype_question_banks: banks, archetype_results: sourceResults, archetype_result_shares: shares, users: [{ _id: 'tester', selfProfile: { gender: 'female' } }], cases: [{ _id: 'foreign-case', userId: 'other-user', profile: { gender: 'female' } }] })
  const cloudbasePath = require.resolve('@cloudbase/node-sdk')
  require.cache[cloudbasePath].exports = { ...cloudbase, SYMBOL_CURRENT_ENV: 'test', init: () => ({ database: () => db }) }
  const authPath = require.resolve('../cloudfunctions/saveArchetypeResult/_shared/auth')
  require(authPath)
  require.cache[authPath].exports = { requireAuthenticatedUserId: async () => 'tester' }
  const accessPath = require.resolve('../cloudfunctions/saveArchetypeResult/_shared/archetype-report-access')
  require(accessPath)
  let accessAllowed = true
  require.cache[accessPath].exports = { resolveQuizAccess: async () => ({ allowed: accessAllowed }) }
  const functionPath = require.resolve('../cloudfunctions/saveArchetypeResult/index.js')
  delete require.cache[functionPath]
  const handler = require(functionPath)

  let successCount = 0
  for (const gender of ['female', 'male']) {
    for (const mode of ['self', 'target']) {
      const cases = [
        relationPayload(gender === 'female' ? femaleRelation : maleRelation, gender, mode, shareIds.relation_archetype),
        portraitPayload('crush_celebrity', celebrity, gender, mode, shareIds.crush_celebrity, '1.1.0'),
        portraitPayload('dimension_character', character, gender, mode, shareIds.dimension_character, '1.0.0')
      ]
      for (const payload of cases) {
        const response = await handler.main(payload)
        assert.strictEqual(response.success, true, `${payload.kind}/${mode}/${gender}: ${response.message || response.code}`)
        assert.deepStrictEqual(Object.keys(response).sort(), ['kind', 'resultId', 'success'])
        const stored = db.rows('archetype_results').find((item) => item._id === response.resultId)
        assert.strictEqual(stored.entryMode, 'share_quick')
        assert.strictEqual(stored.subjectGender, gender)
        assert.strictEqual(stored.subjectType, mode === 'target' ? 'temporary_target' : 'self')
        assert.strictEqual('caseId' in stored, false)
        if (payload.kind !== 'relation_archetype') {
          const sourceContent = payload.kind === 'crush_celebrity' ? celebrity : character
          const matchedPerson = sourceContent.people.find((person) => person.key === stored.primaryPersonKey)
          assert.strictEqual(matchedPerson?.gender, gender, `${payload.kind}/${mode}/${gender} returned a cross-gender match`)
        }
        successCount += 1
      }
    }
  }
  assert.strictEqual(successCount, 12)

  const forbiddenCase = await handler.main({ ...portraitPayload('crush_celebrity', celebrity, 'female', 'target', shareIds.crush_celebrity, '1.1.0'), caseId: 'case-x' })
  assert.strictEqual(forbiddenCase.code, 'QUICK_CASE_FORBIDDEN')
  const missingShare = await handler.main({ ...portraitPayload('crush_celebrity', celebrity, 'female', 'self', '', '1.1.0') })
  assert.strictEqual(missingShare.code, 'SHARE_NOT_FOUND')
  const revokedShare = await handler.main({ ...portraitPayload('crush_celebrity', celebrity, 'female', 'self', revokedShareId, '1.1.0') })
  assert.strictEqual(revokedShare.code, 'SHARE_NOT_FOUND')
  const mismatchedKind = await handler.main({ ...portraitPayload('dimension_character', character, 'female', 'self', shareIds.crush_celebrity, '1.0.0') })
  assert.strictEqual(mismatchedKind.code, 'SHARE_KIND_MISMATCH')
  const missingGender = await handler.main({ ...portraitPayload('crush_celebrity', celebrity, 'female', 'self', shareIds.crush_celebrity, '1.1.0'), subjectGender: '' })
  assert.strictEqual(missingGender.code, 'GENDER_REQUIRED')
  accessAllowed = false
  const denied = await handler.main(portraitPayload('crush_celebrity', celebrity, 'female', 'self', shareIds.crush_celebrity, '1.1.0'))
  assert.strictEqual(denied.code, 'FEATURE_NOT_AVAILABLE')
  accessAllowed = true
  const standardTarget = await handler.main({ kind: 'crush_celebrity', mode: 'target', answers: [], contentVersion: '1.1.0' })
  assert.strictEqual(standardTarget.code, 'CASE_NOT_FOUND')
  const foreignTarget = await handler.main({ kind: 'crush_celebrity', mode: 'target', caseId: 'foreign-case', answers: [], contentVersion: '1.1.0' })
  assert.strictEqual(foreignTarget.code, 'CASE_NOT_FOUND')
  const genderMismatch = await handler.main({ ...relationPayload(maleRelation, 'male', 'self', shareIds.relation_archetype), entryMode: 'standard', resultShareId: '' })
  assert.strictEqual(genderMismatch.code, 'GENDER_MISMATCH')

  console.log('archetype share quick-save tests passed')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
