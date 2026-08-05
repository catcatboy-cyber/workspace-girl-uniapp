'use strict'

const assert = require('assert')
const fs = require('fs')
const content = require('../cloudfunctions/_shared/dimension-character-v1.json')
const report = require('../calibration/dimension-character-v1.0.0-calibration.json')
const { validateArchetypeContent, FEATURE_CHARACTER } = require('../cloudfunctions/_shared/archetype-bank')

assert.strictEqual(report.passed, true)
assert.strictEqual(report.genders.female.passed, true)
assert.strictEqual(report.genders.male.passed, true)
assert.strictEqual(report.genders.female.iterations, 200000)
assert.strictEqual(report.genders.male.iterations, 200000)
assert.deepStrictEqual(validateArchetypeContent(FEATURE_CHARACTER, content, { requireCalibration: true }), [])
assert.strictEqual(fs.existsSync('calibration/dimension-character-v1.0.0-calibration.json'), true)
console.log(JSON.stringify({ success: true, reportChecksum: report.reportChecksum }, null, 2))
