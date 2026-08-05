'use strict'

const fs = require('fs')
const path = require('path')
const { runCelebrityCalibration } = require('../cloudfunctions/_shared/crush-celebrity-calibration')

const ROOT = path.resolve(__dirname, '..')
const jobs = [
  { file: 'crush-celebrity-v1.json', report: 'crush-celebrity-v1.1.0-gender-calibration.json', seed: 20260804 },
  { file: 'dimension-character-v1.json', report: 'dimension-character-v1.0.0-calibration.json', seed: 20260814 }
]

function compactGender(report) {
  return {
    subjectGender: report.subjectGender,
    seed: report.seed,
    iterations: report.iterations,
    passed: report.passed,
    maxRatio: report.maxRatio,
    topFiveRatio: report.topFiveRatio,
    groupWinnerCounts: report.groupWinnerCounts,
    missingGolden: report.missingGolden,
    distribution: report.distribution,
    reportChecksum: report.reportChecksum
  }
}

for (const job of jobs) {
  const filePath = path.join(ROOT, 'cloudfunctions', '_shared', job.file)
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const beforeProfiles = Object.fromEntries(content.people.map((person) => [person.key, { ...person.profile }]))
  const report = runCelebrityCalibration(content, { iterations: 200000, seed: job.seed })
  content.goldenAnswers = report.goldenAnswers
  content.calibrationSummary = {
    passed: report.passed,
    seed: report.seed,
    iterations: report.iterations,
    genders: Object.fromEntries(Object.entries(report.genders).map(([gender, value]) => [gender, compactGender(value)])),
    missingGolden: Object.values(report.genders).flatMap((item) => item.missingGolden || []),
    reportChecksum: report.reportChecksum
  }
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8')
  const adjustments = content.people.map((person) => ({
    personKey: person.key,
    before: beforeProfiles[person.key],
    after: person.profile,
    delta: Object.fromEntries(Object.keys(person.profile).map((key) => [key, person.profile[key] - beforeProfiles[person.key][key]]))
  }))
  const audit = {
    sourceFile: job.file,
    passed: report.passed,
    reportChecksum: report.reportChecksum,
    adjustmentLimit: 5,
    adjustments,
    genders: Object.fromEntries(Object.entries(report.genders).map(([gender, value]) => [gender, compactGender(value)]))
  }
  const reportPath = path.join(ROOT, 'calibration', job.report)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
  console.log(`${job.file}: passed=${report.passed} checksum=${report.reportChecksum}`)
}
