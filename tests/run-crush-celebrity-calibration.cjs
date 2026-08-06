'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const content = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const adjustmentReport = require('../calibration/crush-celebrity-v1-vector-adjustment-report.json')
const { DIMENSIONS, DIMENSION_WEIGHTS } = require('../cloudfunctions/_shared/crush-celebrity-score')

const ITERATIONS = Math.max(200000, Number(process.env.ARCHETYPE_CALIBRATION_ITERATIONS) || 200000)
const SEED = Number(process.env.ARCHETYPE_CALIBRATION_SEED) || 20260801
const OPTIONS = ['A', 'B', 'C', 'D']

assert.strictEqual(adjustmentReport.featureKey, 'crush_celebrity')
assert.strictEqual(adjustmentReport.iterations, 200000)
assert.strictEqual(adjustmentReport.before.passed, false)
assert.strictEqual(adjustmentReport.after.passed, true)
assert.strictEqual(adjustmentReport.adjustments.length, 48)
const adjustmentMap = new Map(adjustmentReport.adjustments.map((item) => [item.personKey, item]))
assert.strictEqual(adjustmentMap.size, 48)
for (const person of content.people) {
  const adjustment = adjustmentMap.get(person.key)
  assert(adjustment, `missing vector adjustment for ${person.key}`)
  assert.deepStrictEqual(person.profile, adjustment.after, `adjusted profile mismatch for ${person.key}`)
  for (const dimension of DIMENSIONS) {
    const delta = Number(adjustment.after[dimension]) - Number(adjustment.before[dimension])
    assert.strictEqual(delta, adjustment.delta[dimension], `delta mismatch for ${person.key}.${dimension}`)
    assert.strictEqual(Number.isInteger(adjustment.after[dimension]), true, `non-integer profile for ${person.key}.${dimension}`)
    assert.strictEqual(Math.abs(delta) <= 5, true, `profile delta exceeds +/-5 for ${person.key}.${dimension}`)
  }
}

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function dimensionsFor(keys) {
  const buckets = Object.fromEntries(DIMENSIONS.map((key) => [key, []]))
  content.questions.forEach((question, index) => {
    const option = question.options.find((item) => item.key === keys[index])
    for (const [dimension, value] of Object.entries(option.scores)) buckets[dimension].push(Number(value))
  })
  return Object.fromEntries(DIMENSIONS.map((dimension) => {
    const values = buckets[dimension]
    return [dimension, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)]
  }))
}

function rankedFor(keys) {
  const dimensions = dimensionsFor(keys)
  return content.people.filter((item) => item.enabled !== false).map((person) => {
    let squared = 0
    for (const dimension of DIMENSIONS) squared += DIMENSION_WEIGHTS[dimension] * ((dimensions[dimension] - person.profile[dimension]) ** 2)
    const distance = Math.sqrt(squared)
    return { key: person.key, era: person.era, sortOrder: person.sortOrder, distance, similarity: Math.round(Math.max(0, Math.min(100, 100 - distance))) }
  }).sort((a, b) => b.similarity - a.similarity || a.distance - b.distance || a.sortOrder - b.sortOrder || a.key.localeCompare(b.key, 'en'))
}

function objective(keys, personKey) {
  const ranked = rankedFor(keys)
  const rank = ranked.findIndex((item) => item.key === personKey)
  const target = ranked[rank]
  const leader = ranked[0]
  return { value: rank * 10000 + target.distance + Math.max(0, target.distance - leader.distance) * 10, rank, distance: target.distance, leader: leader.key }
}

function findGolden(personKey, random) {
  let best = null
  const restarts = 160
  for (let restart = 0; restart < restarts; restart += 1) {
    let keys = Array.from({ length: content.questions.length }, () => OPTIONS[Math.floor(random() * OPTIONS.length)])
    let current = objective(keys, personKey)
    for (let pass = 0; pass < 20; pass += 1) {
      let improved = false
      const positions = Array.from({ length: keys.length }, (_, index) => index).sort(() => random() - 0.5)
      for (const index of positions) {
        const original = keys[index]
        let localBest = current
        let localKey = original
        for (const optionKey of OPTIONS) {
          if (optionKey === original) continue
          const candidateKeys = keys.slice()
          candidateKeys[index] = optionKey
          const candidate = objective(candidateKeys, personKey)
          if (candidate.value < localBest.value) { localBest = candidate; localKey = optionKey }
        }
        if (localKey !== original) {
          keys[index] = localKey
          current = localBest
          improved = true
        }
      }
      if (!best || current.value < best.score.value) best = { keys: keys.slice(), score: current }
      if (current.rank === 0) return keys
      if (!improved) break
    }
  }
  return best?.score?.rank === 0 ? best.keys : null
}

const random = mulberry32(SEED)
const winnerCounts = Object.fromEntries(content.people.map((person) => [person.key, 0]))
const eraWinners = { history: new Set(), modern: new Set(), contemporary: new Set() }
const goldenAnswers = {}

for (let index = 0; index < ITERATIONS; index += 1) {
  const keys = Array.from({ length: content.questions.length }, () => OPTIONS[Math.floor(random() * OPTIONS.length)])
  const winner = rankedFor(keys)[0]
  winnerCounts[winner.key] += 1
  eraWinners[winner.era].add(winner.key)
  if (!goldenAnswers[winner.key]) {
    goldenAnswers[winner.key] = Object.fromEntries(content.questions.map((question, questionIndex) => [question.id, keys[questionIndex]]))
  }
}

for (const person of content.people) {
  if (goldenAnswers[person.key]) continue
  const keys = findGolden(person.key, random)
  if (keys) goldenAnswers[person.key] = Object.fromEntries(content.questions.map((question, index) => [question.id, keys[index]]))
}

const distribution = Object.entries(winnerCounts).map(([personKey, count]) => ({ personKey, count, ratio: count / ITERATIONS })).sort((a, b) => b.count - a.count)
const maxRatio = distribution[0]?.ratio || 0
const topFiveRatio = distribution.slice(0, 5).reduce((sum, item) => sum + item.ratio, 0)
const missingGolden = content.people.filter((person) => !goldenAnswers[person.key]).map((person) => person.key)
const eraWinnerCounts = Object.fromEntries(Object.entries(eraWinners).map(([key, value]) => [key, value.size]))
const passed = maxRatio <= 0.12 && topFiveRatio <= 0.45 && Object.values(eraWinnerCounts).every((count) => count >= 10) && missingGolden.length === 0
const reportCore = { seed: SEED, iterations: ITERATIONS, maxRatio, topFiveRatio, eraWinnerCounts, missingGolden, distribution, goldenAnswers }
const reportChecksum = crypto.createHash('sha256').update(JSON.stringify(reportCore)).digest('hex')
const report = { ...reportCore, passed, reportChecksum }
const outputPath = path.join(os.tmpdir(), 'crush-celebrity-calibration.json')
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8')

console.log(JSON.stringify({
  passed,
  seed: SEED,
  iterations: ITERATIONS,
  maxWinner: distribution[0],
  topFiveRatio,
  eraWinnerCounts,
  goldenCount: Object.keys(goldenAnswers).length,
  missingGolden,
  reportChecksum,
  outputPath
}, null, 2))

assert.strictEqual(maxRatio <= 0.12, true, `max winner ratio ${maxRatio}`)
assert.strictEqual(topFiveRatio <= 0.45, true, `top five ratio ${topFiveRatio}`)
assert.strictEqual(Object.values(eraWinnerCounts).every((count) => count >= 10), true, `era coverage ${JSON.stringify(eraWinnerCounts)}`)
assert.deepStrictEqual(missingGolden, [])
assert.strictEqual(reportChecksum, adjustmentReport.after.reportChecksum, 'adjusted report checksum mismatch')
assert.strictEqual(maxRatio, adjustmentReport.after.maxRatio, 'adjusted max ratio mismatch')
assert.strictEqual(topFiveRatio, adjustmentReport.after.topFiveRatio, 'adjusted top five ratio mismatch')
assert.deepStrictEqual(eraWinnerCounts, adjustmentReport.after.eraWinnerCounts, 'adjusted era coverage mismatch')
assert.strictEqual(Object.keys(goldenAnswers).length, adjustmentReport.after.goldenCount, 'adjusted golden count mismatch')
