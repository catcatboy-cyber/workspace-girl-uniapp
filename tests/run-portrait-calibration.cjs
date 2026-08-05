'use strict'

const assert = require('assert')
const celebrity = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const character = require('../cloudfunctions/_shared/dimension-character-v1.json')
const celebrityReport = require('../calibration/crush-celebrity-v1.1.0-gender-calibration.json')
const characterReport = require('../calibration/dimension-character-v1.0.0-calibration.json')
const { FEATURE_CELEBRITY, FEATURE_CHARACTER, validateArchetypeContent } = require('../cloudfunctions/_shared/archetype-bank')

for (const [content, feature, report] of [[celebrity, FEATURE_CELEBRITY, celebrityReport], [character, FEATURE_CHARACTER, characterReport]]) {
  assert.strictEqual(report.passed, true)
  assert.strictEqual(content.calibrationSummary.reportChecksum, report.reportChecksum)
  assert.deepStrictEqual(validateArchetypeContent(feature, content, { requireCalibration: true }), [])
  assert.strictEqual(report.genders.female.iterations, 200000)
  assert.strictEqual(report.genders.male.iterations, 200000)
}
console.log(JSON.stringify({ success: true, celebrity: celebrityReport.reportChecksum, character: characterReport.reportChecksum }, null, 2))
