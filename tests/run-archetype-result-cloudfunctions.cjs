'use strict'

const assert = require('assert')
const cloudbase = require('@cloudbase/node-sdk')
const relationContent = require('../cloudfunctions/_shared/relation-female-v1.json')
const celebrityContent = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const { checksumContent, buildBankId, FEATURE_RELATION, FEATURE_CELEBRITY } = require('../cloudfunctions/_shared/archetype-bank')
const { scoreRelationArchetype } = require('../cloudfunctions/_shared/relation-archetype-score')
const { scoreCrushCelebrity } = require('../cloudfunctions/_shared/crush-celebrity-score')

function createMemoryDb(initial = {}) {
  const collections = new Map()
  let sequence = 0
  for (const [name, documents] of Object.entries(initial)) {
    collections.set(name, new Map(documents.map((document) => [document._id, structuredClone(document)])))
  }

  function collection(name) {
    if (!collections.has(name)) collections.set(name, new Map())
    const documents = collections.get(name)
    return {
      doc(id) {
        return {
          async get() {
            return { data: documents.has(id) ? structuredClone(documents.get(id)) : null }
          }
        }
      },
      async add(document) {
        const id = document._id || `${name}-${++sequence}`
        documents.set(id, { ...structuredClone(document), _id: id })
        return { id }
      },
      where(filter) {
        let values = [...documents.values()].filter((document) => Object.entries(filter).every(([key, value]) => document[key] === value))
        const query = {
          orderBy(key, direction) {
            values.sort((left, right) => {
              const leftValue = left[key] instanceof Date ? left[key].getTime() : left[key]
              const rightValue = right[key] instanceof Date ? right[key].getTime() : right[key]
              const result = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
              return direction === 'desc' ? -result : result
            })
            return query
          },
          limit(value) {
            values = values.slice(0, value)
            return query
          },
          async get() {
            return { data: structuredClone(values) }
          }
        }
        return query
      }
    }
  }

  return {
    collection,
    readAll(name) {
      return [...(collections.get(name)?.values() || [])].map((item) => structuredClone(item))
    }
  }
}

async function main() {
  const relationBank = {
    _id: buildBankId(FEATURE_RELATION, 'female', '1.0.0'),
    featureKey: FEATURE_RELATION,
    subjectGender: 'female',
    displayTitle: '关系女主角',
    contentVersion: '1.0.0',
    status: 'published',
    content: relationContent,
    checksum: checksumContent(relationContent)
  }
  const celebrityBank = {
    _id: buildBankId(FEATURE_CELEBRITY, '1.0.0'),
    featureKey: FEATURE_CELEBRITY,
    contentVersion: '1.0.0',
    status: 'published',
    content: celebrityContent,
    checksum: checksumContent(celebrityContent)
  }
  const archivedRelationBank = {
    ...relationBank,
    _id: buildBankId(FEATURE_RELATION, 'female', '0.9.0'),
    contentVersion: '0.9.0',
    status: 'archived'
  }
  const draftRelationBank = {
    ...relationBank,
    _id: buildBankId(FEATURE_RELATION, 'female', '1.1.0'),
    contentVersion: '1.1.0',
    status: 'draft'
  }
  const db = createMemoryDb({
    archetype_question_banks: [relationBank, celebrityBank, archivedRelationBank, draftRelationBank],
    cases: [
      { _id: 'case-owned', userId: 'user-1', profile: { nickname: '小夏', avatar: 'avatar-a', gender: '女' } },
      { _id: 'case-other', userId: 'user-2', profile: { nickname: '小周' } }
    ],
    archetype_results: [
      { _id: 'other-user-result', userId: 'user-2', kind: 'relation_archetype', subjectGender: 'female', mode: 'self', createdAt: new Date('2026-08-01T00:00:00Z') }
    ],
    users: [{ _id: 'user-1', selfProfile: { gender: 'female' } }]
  })

  let authenticatedUserId = 'user-1'
  let featureAllowed = true
  const app = { database: () => db }
  const cloudbasePath = require.resolve('@cloudbase/node-sdk')
  require.cache[cloudbasePath].exports = { ...cloudbase, SYMBOL_CURRENT_ENV: 'test-env', init: () => app }

  const authPath = require.resolve('../cloudfunctions/saveArchetypeResult/_shared/auth')
  require(authPath)
  require.cache[authPath].exports = {
    requireAuthenticatedUserId: async () => {
      if (!authenticatedUserId) {
        const error = new Error('UNAUTHENTICATED')
        error.code = 'UNAUTHENTICATED'
        throw error
      }
      return authenticatedUserId
    }
  }
  const subscriptionPath = require.resolve('../cloudfunctions/saveArchetypeResult/_shared/subscription')
  require(subscriptionPath)
  require.cache[subscriptionPath].exports = { checkFeatureAccess: async () => ({ allowed: featureAllowed }) }
  const savePath = require.resolve('../cloudfunctions/saveArchetypeResult/index.js')
  delete require.cache[savePath]
  const saveFunction = require(savePath)

  const publicBankAuthPath = require.resolve('../cloudfunctions/getArchetypeQuestionBank/_shared/auth')
  require(publicBankAuthPath)
  require.cache[publicBankAuthPath].exports = require.cache[authPath].exports
  const publicBankSubscriptionPath = require.resolve('../cloudfunctions/getArchetypeQuestionBank/_shared/subscription')
  require(publicBankSubscriptionPath)
  require.cache[publicBankSubscriptionPath].exports = require.cache[subscriptionPath].exports
  const publicBankPath = require.resolve('../cloudfunctions/getArchetypeQuestionBank/index.js')
  delete require.cache[publicBankPath]
  const publicBankFunction = require(publicBankPath)
  const currentBank = await publicBankFunction.main({ featureKey: FEATURE_RELATION, subjectGender: 'female' })
  assert.strictEqual(currentBank.success, true)
  assert.strictEqual(currentBank.bank.contentVersion, '1.0.0')
  const archivedBank = await publicBankFunction.main({ featureKey: FEATURE_RELATION, subjectGender: 'female', contentVersion: '0.9.0' })
  assert.strictEqual(archivedBank.success, true)
  assert.strictEqual(archivedBank.bank.contentVersion, '0.9.0')
  const hiddenDraftBank = await publicBankFunction.main({ featureKey: FEATURE_RELATION, subjectGender: 'female', contentVersion: '1.1.0' })
  assert.strictEqual(hiddenDraftBank.code, 'CONTENT_NOT_PUBLISHED')

  const relationPerson = relationContent.archetypes.find((item) => item.key === 'ran_yingying')
  const relationQuestions = [...relationPerson.universalQuestions, ...relationPerson.stageQuestions.pre_relationship]
  const relationAnswers = relationQuestions.map((question) => ({ questionId: question.id, optionKey: 'A' }))
  const scenarioAnswers = relationPerson.scenarios.pre_relationship.map((question) => ({ questionId: question.id, optionKey: 'A' }))
  const expectedRelation = scoreRelationArchetype(relationContent, {
    mode: 'self',
    stageKey: 'pre_relationship',
    personKey: 'ran_yingying',
    answers: relationAnswers,
    scenarioAnswers
  })

  const selfWithCase = await saveFunction.main({
    kind: 'relation_archetype', subjectGender: 'female',
    mode: 'self',
    caseId: 'case-owned',
    stageKey: 'pre_relationship',
    personKey: 'ran_yingying',
    answers: relationAnswers,
    scenarioAnswers,
    contentVersion: '1.0.0'
  })
  assert.strictEqual(selfWithCase.code, 'INVALID_ARGUMENT')

  const selfSaved = await saveFunction.main({
    kind: 'relation_archetype', subjectGender: 'female',
    mode: 'self',
    stageKey: 'pre_relationship',
    personKey: 'ran_yingying',
    answers: relationAnswers,
    scenarioAnswers,
    contentVersion: '1.0.0',
    similarity: 100,
    dimensionScores: { forged: 100 }
  })
  assert.strictEqual(selfSaved.success, true)
  assert.strictEqual(selfSaved.result.similarity, expectedRelation.similarity)
  assert.deepStrictEqual(selfSaved.result.dimensionScores, expectedRelation.dimensionScores)
  assert.strictEqual(selfSaved.result.personSnapshot.name, '冉莹颖型')
  assert.strictEqual('caseId' in selfSaved.result, false)
  assert.strictEqual('forged' in selfSaved.result.dimensionScores, false)

  const mismatchedGender = await saveFunction.main({
    kind: 'relation_archetype', subjectGender: 'male', mode: 'self',
    stageKey: 'pre_relationship', personKey: 'ran_yingying', answers: relationAnswers, scenarioAnswers, contentVersion: '1.0.0'
  })
  assert.strictEqual(mismatchedGender.code, 'GENDER_MISMATCH')

  const unauthorizedCase = await saveFunction.main({
    kind: 'relation_archetype', subjectGender: 'female',
    mode: 'target',
    caseId: 'case-other',
    stageKey: 'pre_relationship',
    personKey: 'ran_yingying',
    answers: relationAnswers,
    scenarioAnswers,
    contentVersion: '1.0.0'
  })
  assert.strictEqual(unauthorizedCase.code, 'CASE_NOT_FOUND')

  const targetSaved = await saveFunction.main({
    kind: 'relation_archetype', subjectGender: 'female',
    mode: 'target',
    caseId: 'case-owned',
    stageKey: 'pre_relationship',
    personKey: 'ran_yingying',
    answers: relationAnswers,
    scenarioAnswers,
    contentVersion: '1.0.0'
  })
  assert.strictEqual(targetSaved.success, true)
  assert.strictEqual(targetSaved.result.caseSnapshot.name, '小夏')

  const celebrityAnswers = celebrityContent.questions.map((question) => ({ questionId: question.id, optionKey: 'A' }))
const expectedCelebrity = scoreCrushCelebrity(celebrityContent, { mode: 'self', subjectGender: 'female', answers: celebrityAnswers })
  const celebritySaved = await saveFunction.main({
    kind: 'crush_celebrity',
    mode: 'self',
    answers: celebrityAnswers,
    contentVersion: '1.0.0',
    primaryPersonKey: 'forged-person',
    similarities: { 'forged-person': 100 }
  })
  assert.strictEqual(celebritySaved.success, true)
  assert.strictEqual(celebritySaved.result.primaryPersonKey, expectedCelebrity.primaryPersonKey)
  assert.deepStrictEqual(celebritySaved.result.topFive, expectedCelebrity.topFive)
  assert.strictEqual(celebritySaved.result.similarities['forged-person'], undefined)

  featureAllowed = false
  const denied = await saveFunction.main({
    kind: 'crush_celebrity',
    mode: 'self',
    answers: celebrityAnswers,
    contentVersion: '1.0.0'
  })
  assert.strictEqual(denied.code, 'FEATURE_NOT_AVAILABLE')
  featureAllowed = true

  authenticatedUserId = null
  const unauthenticated = await saveFunction.main({ kind: 'crush_celebrity', mode: 'self' })
  assert.strictEqual(unauthenticated.code, 'AUTH_REQUIRED')
  authenticatedUserId = 'user-1'

  const resultsAuthPath = require.resolve('../cloudfunctions/getArchetypeResults/_shared/auth')
  require(resultsAuthPath)
  require.cache[resultsAuthPath].exports = require.cache[authPath].exports
  const resultsPath = require.resolve('../cloudfunctions/getArchetypeResults/index.js')
  delete require.cache[resultsPath]
  const resultsFunction = require(resultsPath)
  const ownResults = await resultsFunction.main({ kind: 'relation_archetype', subjectGender: 'female', limit: 50 })
  assert.strictEqual(ownResults.success, true)
  assert(ownResults.results.length >= 2)
  assert(ownResults.results.every((item) => item.userId === 'user-1'))
  const caseResults = await resultsFunction.main({ kind: 'relation_archetype', subjectGender: 'female', caseId: 'case-owned', limit: 50 })
  assert.strictEqual(caseResults.results.length, 1)
  assert.strictEqual(caseResults.results[0]._id, targetSaved.result._id)
  const exactOwnResult = await resultsFunction.main({ kind: 'relation_archetype', resultId: selfSaved.result._id })
  assert.strictEqual(exactOwnResult.results.length, 1)
  assert.strictEqual(exactOwnResult.results[0]._id, selfSaved.result._id)
  const exactOtherResult = await resultsFunction.main({ kind: 'relation_archetype', resultId: 'other-user-result' })
  assert.deepStrictEqual(exactOtherResult.results, [])

  console.log(JSON.stringify({
    success: true,
    ownershipProtected: true,
    featureAccessProtected: true,
    serverRecalculationProtected: true,
    selfCaseOmitted: true,
    resultQueriesUserScoped: true,
    versionedBanksProtected: true,
    savedResultCount: db.readAll('archetype_results').length
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
