'use strict'

const assert = require('assert')
const content = require('../cloudfunctions/_shared/dimension-character-v1.json')
const { FEATURE_CHARACTER, validateArchetypeContent, checksumContent } = require('../cloudfunctions/_shared/archetype-bank')
const { scoreCrushCelebrity } = require('../cloudfunctions/_shared/crush-celebrity-score')

assert.deepStrictEqual(validateArchetypeContent(FEATURE_CHARACTER, content, { requireCalibration: false }), [])
assert.strictEqual(content.people.length, 72)
assert.deepStrictEqual(content.people.reduce((counts, person) => { counts[person.gender] = (counts[person.gender] || 0) + 1; return counts }, {}), { male: 36, female: 36 })
assert.deepStrictEqual(content.people.reduce((counts, person) => { counts[person.category] = (counts[person.category] || 0) + 1; return counts }, {}), { classic: 12, wuxia: 12, tomb_raiding: 12, chinese_screen: 12, international: 12, anime: 12 })
assert.strictEqual(Object.keys(content.goldenAnswers).length, 72)

for (const gender of ['male', 'female']) {
  const answers = content.questions.map((question) => ({ questionId: question.id, optionKey: 'A' }))
  const result = scoreCrushCelebrity(content, { mode: 'self', subjectGender: gender, answers })
  assert(result.topFive.every((item) => content.people.find((person) => person.key === item.personKey).gender === gender))
  assert.strictEqual(result.subjectGender, gender)
}
assert.throws(() => scoreCrushCelebrity(content, { mode: 'self', answers: content.questions.map((question) => ({ questionId: question.id, optionKey: 'A' })) }), (error) => error.code === 'PROFILE_GENDER_REQUIRED')

console.log(JSON.stringify({ success: true, checksum: checksumContent(content), people: content.people.length }, null, 2))
