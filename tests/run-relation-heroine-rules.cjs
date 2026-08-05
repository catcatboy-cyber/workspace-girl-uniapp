'use strict'

const assert = require('assert')
const { validateRelationContent, checksumContent, normalizeSubjectGender } = require('../cloudfunctions/_shared/archetype-bank')
const { scoreRelationArchetype } = require('../cloudfunctions/_shared/relation-archetype-score')

function payload(archetype, optionFor, mode = 'self', stageKey = 'pre_relationship') {
  const questions = [...archetype.universalQuestions, ...archetype.stageQuestions[stageKey]]
  return {
    mode,
    stageKey,
    personKey: archetype.key,
    answers: questions.map((question, index) => ({
      questionId: question.id,
      optionKey: optionFor(question, index)
    })),
    scenarioAnswers: archetype.scenarios[stageKey].map((question) => ({ questionId: question.id, optionKey: 'A' }))
  }
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`)
}

const banks = [
  { gender: 'female', content: require('../cloudfunctions/_shared/relation-female-v1.json') },
  { gender: 'male', content: require('../cloudfunctions/_shared/relation-male-v1.json') }
]
for (const value of ['male', '男']) assert.strictEqual(normalizeSubjectGender(value), 'male')
for (const value of ['female', '女']) assert.strictEqual(normalizeSubjectGender(value), 'female')
for (const value of ['private', '非二元', '未说明', '', null, undefined]) assert.strictEqual(normalizeSubjectGender(value), 'unknown')

for (const { gender, content } of banks) {
 const errors = validateRelationContent(content)
 assert.deepStrictEqual(errors, [], `${gender}: ${JSON.stringify(errors, null, 2)}`)
 assert.strictEqual(content.screener.length, 6)
 assert.strictEqual(content.archetypes.length, 3)
 assert.strictEqual(checksumContent(content).length, 64)
 for (const archetype of content.archetypes) {
  assert.strictEqual(archetype.dimensions.length, 3)
  assert.strictEqual(archetype.universalQuestions.length, 10)
  const stageIdSignature = Object.values(archetype.stageQuestions).map((items) => items.map((item) => item.id).sort().join('|'))
  assert.strictEqual(new Set(stageIdSignature).size, 1)
  const scenarioIdSignature = Object.values(archetype.scenarios).map((items) => items.map((item) => item.id).sort().join('|'))
  assert.strictEqual(new Set(scenarioIdSignature).size, 1)
  for (const stage of content.stages) {
    assert.strictEqual(archetype.stageQuestions[stage.key].length, 5)
    assert.strictEqual(archetype.scenarios[stage.key].length, 3)
  }
  const stageFirstTexts = content.stages.map((stage) => archetype.stageQuestions[stage.key][0].textSelf)
  assert.strictEqual(new Set(stageFirstTexts).size, 4)

  const high = scoreRelationArchetype(content, payload(archetype, (question) => question.reverse ? 'E' : 'A'))
  assert.strictEqual(high.similarity, 100)
  assert.strictEqual(high.scenarioVerification, '情景高度吻合')
  const low = scoreRelationArchetype(content, payload(archetype, (question) => question.reverse ? 'A' : 'E'))
  assert.strictEqual(low.similarity, 0)
  const middle = scoreRelationArchetype(content, payload(archetype, () => 'C'))
  assert.strictEqual(middle.similarity, 50)

  const validByDimension = new Map()
  const lowCoverage = scoreRelationArchetype(content, payload(archetype, (question) => {
    const count = validByDimension.get(question.dimensionKey) || 0
    validByDimension.set(question.dimensionKey, count + 1)
    return count < 3 ? 'A' : 'U'
  }, 'target'))
  assert.strictEqual(lowCoverage.answeredCount, 9)
  assert.strictEqual(lowCoverage.observationConfidence, 'low')
  const insufficientByDimension = new Map()
  expectCode(() => scoreRelationArchetype(content, payload(archetype, (question) => {
    const count = insufficientByDimension.get(question.dimensionKey) || 0
    insufficientByDimension.set(question.dimensionKey, count + 1)
    return count < 2 ? 'A' : 'U'
  }, 'target')), 'INSUFFICIENT_OBSERVATION')
  expectCode(() => scoreRelationArchetype(content, payload(archetype, (_question, index) => index === 0 ? 'U' : 'A', 'self')), 'INVALID_ARGUMENT')
 }
}

console.log(JSON.stringify({
  success: true,
  genders: banks.map((item) => item.gender),
  screenerCountPerGender: 6,
  archetypeCountPerGender: 3,
  itemCountPerGender: 132
}, null, 2))
