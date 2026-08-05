'use strict'

const assert = require('assert')
const content = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const { validateCelebrityContent, checksumContent } = require('../cloudfunctions/_shared/archetype-bank')
const { scoreCrushCelebrity } = require('../cloudfunctions/_shared/crush-celebrity-score')
const { createEvaluator } = require('../cloudfunctions/_shared/crush-celebrity-calibration')

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`)
}

const errors = validateCelebrityContent(content, { requireCalibration: false })
assert.deepStrictEqual(errors, [], JSON.stringify(errors, null, 2))
const missingShareTemplate = JSON.parse(JSON.stringify(content))
delete missingShareTemplate.resultCopy.shareTemplate
assert(validateCelebrityContent(missingShareTemplate, { requireCalibration: false }).some((item) => item.path === 'resultCopy.shareTemplate'))
assert.strictEqual(typeof checksumContent(content), 'string')
assert.strictEqual(content.questions.length, 12)
assert.strictEqual(content.people.length, 48)
assert.strictEqual(new Set(content.people.map((item) => item.key)).size, 48)
assert.deepStrictEqual(content.people.reduce((counts, person) => {
  counts[person.era] = (counts[person.era] || 0) + 1
  return counts
}, {}), { history: 16, modern: 16, contemporary: 16 })
assert.deepStrictEqual(content.questions[0].options[0].scores, { initiative: 100 })
assert.deepStrictEqual(content.questions[11].options[2].scores, { initiative: 80, warmth: 85, reliability: 35, romance: 100, boundary: 25 })

const allA = content.questions.map((question) => ({ questionId: question.id, optionKey: 'A' }))
const first = scoreCrushCelebrity(content, { mode: 'self', subjectGender: 'male', answers: allA })
const second = scoreCrushCelebrity(content, { mode: 'self', subjectGender: 'male', answers: allA })
assert.deepStrictEqual(first, second)
assert.strictEqual(first.topFive.length, 5)
assert.strictEqual(content.people.find((item) => item.key === first.primaryPersonKey).gender, 'male')
assert.strictEqual(first.similarities[first.primaryPersonKey], Math.max(...Object.values(first.similarities)))

const calibrationEvaluator = createEvaluator(content, { subjectGender: 'male' })
for (const optionKeys of [
  Array(12).fill('A'),
  Array(12).fill('D'),
  ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'],
  ['D', 'C', 'B', 'A', 'D', 'C', 'B', 'A', 'D', 'C', 'B', 'A']
]) {
  const answers = content.questions.map((question, index) => ({ questionId: question.id, optionKey: optionKeys[index] }))
  const production = scoreCrushCelebrity(content, { mode: 'self', subjectGender: 'male', answers })
  const calibrationDimensions = calibrationEvaluator.dimensionsFor(optionKeys)
  const calibrationRanking = calibrationEvaluator.rankedFor(optionKeys)
  assert.deepStrictEqual(calibrationDimensions, production.dimensions)
  assert.strictEqual(calibrationRanking[0].key, production.primaryPersonKey)
  assert.deepStrictEqual(
    calibrationRanking.slice(0, 5).map((item) => ({ personKey: item.key, similarity: item.similarity })),
    production.topFive.map((item) => ({ personKey: item.personKey, similarity: item.similarity }))
  )
}

let validLowCoverage = null
for (let a = 0; a < 12 && !validLowCoverage; a += 1) {
  for (let b = a + 1; b < 12 && !validLowCoverage; b += 1) {
    for (let c = b + 1; c < 12 && !validLowCoverage; c += 1) {
      for (let d = c + 1; d < 12 && !validLowCoverage; d += 1) {
        const unknown = new Set([a, b, c, d])
        const answers = content.questions.map((question, index) => ({ questionId: question.id, optionKey: unknown.has(index) ? 'U' : 'A' }))
        try {
          validLowCoverage = scoreCrushCelebrity(content, { mode: 'target', subjectGender: 'female', answers })
        } catch (_) {}
      }
    }
  }
}
assert(validLowCoverage, 'expected at least one valid 8/12 target answer pattern')
assert.strictEqual(validLowCoverage.answeredCount, 8)
assert.strictEqual(validLowCoverage.observationConfidence, 'low')

const sevenValid = content.questions.map((question, index) => ({ questionId: question.id, optionKey: index < 5 ? 'U' : 'A' }))
expectCode(() => scoreCrushCelebrity(content, { mode: 'target', subjectGender: 'female', answers: sevenValid }), 'INSUFFICIENT_OBSERVATION')
const selfUnknown = content.questions.map((question, index) => ({ questionId: question.id, optionKey: index === 0 ? 'U' : 'A' }))
expectCode(() => scoreCrushCelebrity(content, { mode: 'self', subjectGender: 'female', answers: selfUnknown }), 'INVALID_ARGUMENT')
expectCode(() => scoreCrushCelebrity(content, { mode: 'self', answers: allA }), 'PROFILE_GENDER_REQUIRED')

console.log(JSON.stringify({
  success: true,
  questionCount: content.questions.length,
  personCount: content.people.length,
  primaryForAllA: first.primaryPersonKey,
  similarityForAllA: first.similarities[first.primaryPersonKey],
  checksum: checksumContent(content)
}, null, 2))
