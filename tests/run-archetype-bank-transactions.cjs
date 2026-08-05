'use strict'

const assert = require('assert')

const calibrationPath = require.resolve('../cloudfunctions/_shared/crush-celebrity-calibration')
const calibrationModule = require(calibrationPath)
const fakeCalibrationReport = {
  passed: false,
  seed: 20260801,
  iterations: 200000,
  genders: {
    female: { passed: false, iterations: 200000, missingGolden: ['example'] },
    male: { passed: true, iterations: 200000, missingGolden: [] }
  },
  goldenAnswers: { example: { CQ01: 'A' } },
  reportChecksum: 'fake-report-checksum'
}
require.cache[calibrationPath].exports = {
  ...calibrationModule,
  runCelebrityCalibration: () => JSON.parse(JSON.stringify(fakeCalibrationReport))
}

const bankModulePath = require.resolve('../cloudfunctions/_shared/archetype-bank')
delete require.cache[bankModulePath]
const {
  COLLECTION,
  FEATURE_RELATION,
  FEATURE_CELEBRITY,
  checksumContent,
  seedArchetypeQuestionBanks,
  saveArchetypeQuestionDraft,
  validateCelebrityContent,
  runCelebrityCalibrationDraft,
  publishArchetypeQuestionBank
} = require(bankModulePath)

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function createFakeDb(initial = {}) {
  const collections = new Map()
  for (const [name, documents] of Object.entries(initial)) {
    collections.set(name, new Map(documents.map((document) => [document._id, clone(document)])))
  }
  let beforeTransaction = null

  function collection(name) {
    if (!collections.has(name)) collections.set(name, new Map())
    const documents = collections.get(name)
    return {
      doc(id) {
        return {
          async get() {
            const document = documents.get(id)
            return { data: document ? clone(document) : null }
          },
          async update(patch) {
            if (!documents.has(id)) throw new Error(`missing document ${id}`)
            documents.set(id, { ...documents.get(id), ...clone(patch) })
            return { updated: 1 }
          }
        }
      },
      async add(document) {
        const id = document._id
        if (!id || documents.has(id)) {
          const error = new Error('duplicate document')
          error.code = 'DUPLICATE'
          throw error
        }
        documents.set(id, clone(document))
        return { id }
      },
      where(filter) {
        let items = [...documents.values()].filter((document) => Object.entries(filter).every(([key, value]) => document[key] === value))
        const query = {
          orderBy(key, direction) {
            items = items.sort((left, right) => {
              const leftValue = left[key] instanceof Date ? left[key].getTime() : left[key]
              const rightValue = right[key] instanceof Date ? right[key].getTime() : right[key]
              const result = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
              return direction === 'desc' ? -result : result
            })
            return query
          },
          limit(value) {
            items = items.slice(0, value)
            return query
          },
          async get() {
            return { data: clone(items) }
          }
        }
        return query
      }
    }
  }

  return {
    collection,
    async runTransaction(callback) {
      if (beforeTransaction) {
        const hook = beforeTransaction
        beforeTransaction = null
        await hook()
      }
      return callback({ collection })
    },
    setBeforeTransaction(callback) {
      beforeTransaction = callback
    },
    read(name, id) {
      return clone(collections.get(name)?.get(id))
    }
  }
}

async function main() {
  const seedDb = createFakeDb()
  const seeded = await seedArchetypeQuestionBanks(seedDb, { featureKey: FEATURE_RELATION, subjectGender: 'female' }, 'admin-1')
  assert.strictEqual(seeded.success, true)
  assert.strictEqual(seeded.bank.revision, 1)
  const seededAgain = await seedArchetypeQuestionBanks(seedDb, { featureKey: FEATURE_RELATION, subjectGender: 'female' }, 'admin-1')
  assert.strictEqual(seededAgain.code, 'ALREADY_SEEDED')

  const draftId = seeded.bank._id
  const conflict = await saveArchetypeQuestionDraft(seedDb, {
    bankId: draftId,
    expectedRevision: 9,
    content: seeded.bank.content
  }, 'admin-2')
  assert.strictEqual(conflict.code, 'REVISION_CONFLICT')
  assert.strictEqual(seedDb.read(COLLECTION, draftId).revision, 1)

  const relationContent = require('../cloudfunctions/_shared/relation-female-v1.json')
  const maleContent = require('../cloudfunctions/_shared/relation-male-v1.json')
  const oldPublished = {
    _id: 'archetype_bank_relation_female_0_9_0',
    featureKey: FEATURE_RELATION,
    subjectGender: 'female',
    contentVersion: '0.9.0',
    status: 'published',
    revision: 3,
    content: relationContent,
    checksum: checksumContent(relationContent),
    publishedAt: new Date('2026-07-01T00:00:00Z')
  }
  const publishDraft = {
    _id: 'archetype_bank_relation_female_1_0_0',
    featureKey: FEATURE_RELATION,
    subjectGender: 'female',
    contentVersion: '1.0.0',
    status: 'draft',
    revision: 2,
    content: relationContent,
    checksum: checksumContent(relationContent)
  }
  const malePublished = {
    _id: 'archetype_bank_relation_male_1_0_0', featureKey: FEATURE_RELATION, subjectGender: 'male',
    contentVersion: '1.0.0', status: 'published', revision: 1, content: maleContent, checksum: checksumContent(maleContent)
  }
  const publishDb = createFakeDb({ [COLLECTION]: [oldPublished, publishDraft, malePublished] })
  const published = await publishArchetypeQuestionBank(publishDb, {
    bankId: publishDraft._id,
    expectedRevision: publishDraft.revision,
    checksum: publishDraft.checksum
  }, 'admin-3')
  assert.strictEqual(published.success, true)
  assert.strictEqual(publishDb.read(COLLECTION, oldPublished._id).status, 'archived')
  assert.strictEqual(publishDb.read(COLLECTION, publishDraft._id).status, 'published')
  assert.strictEqual(publishDb.read(COLLECTION, malePublished._id).status, 'published')

  const celebrityContent = clone(require('../cloudfunctions/_shared/crush-celebrity-v1.json'))
  delete celebrityContent.calibrationSummary
  const celebrityDraft = {
    _id: 'archetype_bank_crush_celebrity_1_0_0',
    featureKey: FEATURE_CELEBRITY,
    contentVersion: '1.0.0',
    status: 'draft',
    revision: 4,
    content: celebrityContent,
    checksum: checksumContent(celebrityContent)
  }
  const calibrationDb = createFakeDb({ [COLLECTION]: [celebrityDraft] })
  calibrationDb.setBeforeTransaction(async () => {
    await calibrationDb.collection(COLLECTION).doc(celebrityDraft._id).update({ revision: 5, updatedBy: 'admin-other' })
  })
  const staleCalibration = await runCelebrityCalibrationDraft(calibrationDb, {
    bankId: celebrityDraft._id,
    expectedRevision: 4,
    seed: 20260801,
    iterations: 200000
  }, 'admin-4')
  assert.strictEqual(staleCalibration.code, 'REVISION_CONFLICT')
  assert.strictEqual(calibrationDb.read(COLLECTION, celebrityDraft._id).content.calibrationSummary, undefined)

  const cleanCalibrationDoc = { ...celebrityDraft, revision: 4 }
  const cleanCalibrationDb = createFakeDb({ [COLLECTION]: [cleanCalibrationDoc] })
  const calibrationSaved = await runCelebrityCalibrationDraft(cleanCalibrationDb, {
    bankId: celebrityDraft._id,
    expectedRevision: 4,
    seed: 20260801,
    iterations: 200000
  }, 'admin-4')
  assert.strictEqual(calibrationSaved.success, true)
  assert.strictEqual(calibrationSaved.revision, 5)
  assert.strictEqual(calibrationSaved.reportChecksum, 'fake-report-checksum')
  assert.strictEqual(cleanCalibrationDb.read(COLLECTION, celebrityDraft._id).content.calibrationSummary.reportChecksum, 'fake-report-checksum')

  const publishCelebrityContent = clone(celebrityContent)
  publishCelebrityContent.calibrationSummary = {
    passed: true,
    seed: 20260801,
    iterations: 200000,
    genders: {
      female: { passed: true, iterations: 200000, missingGolden: [] },
      male: { passed: true, iterations: 200000, missingGolden: [] }
    },
    missingGolden: [],
    reportChecksum: 'report-1'
  }
  const celebrityPublishDraft = {
    ...celebrityDraft,
    content: publishCelebrityContent,
    checksum: checksumContent(publishCelebrityContent)
  }
  const celebrityPublishDb = createFakeDb({ [COLLECTION]: [celebrityPublishDraft] })
  const missingReport = await publishArchetypeQuestionBank(celebrityPublishDb, {
    bankId: celebrityPublishDraft._id,
    expectedRevision: celebrityPublishDraft.revision,
    checksum: celebrityPublishDraft.checksum
  }, 'admin-5')
  assert.strictEqual(missingReport.code, 'CALIBRATION_REQUIRED')
  const mismatchedReport = await publishArchetypeQuestionBank(celebrityPublishDb, {
    bankId: celebrityPublishDraft._id,
    expectedRevision: celebrityPublishDraft.revision,
    checksum: celebrityPublishDraft.checksum,
    reportChecksum: 'wrong-report'
  }, 'admin-5')
  assert.strictEqual(mismatchedReport.code, 'CHECKSUM_MISMATCH')

  const invalidGoldenContent = clone(publishCelebrityContent)
  invalidGoldenContent.goldenAnswers = {
    zhou_enlai: Object.fromEntries(invalidGoldenContent.questions.map((question) => [question.id, 'A'])),
    xiao_hong: Object.fromEntries(invalidGoldenContent.questions.map((question) => [question.id, 'A']))
  }
  const goldenErrors = validateCelebrityContent(invalidGoldenContent, { requireCalibration: true })
  assert(goldenErrors.some((item) => item.path === 'goldenAnswers.xiao_hong' && item.code === 'GOLDEN_NOT_WINNER'))
  assert(!goldenErrors.some((item) => item.path === 'goldenAnswers.zhou_enlai' && item.code === 'GOLDEN_NOT_WINNER'))

  console.log(JSON.stringify({
    success: true,
    seedIdempotent: true,
    revisionConflictProtected: true,
    publishTransactionProtected: true,
    genderPublishIsolationProtected: true,
    calibrationConflictProtected: true,
    reportChecksumProtected: true,
    goldenWinnerValidated: true
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
