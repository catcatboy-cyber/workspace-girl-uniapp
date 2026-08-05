'use strict'

const crypto = require('crypto')
const { DIMENSIONS, DIMENSION_WEIGHTS, normalizeSubjectGender } = require('./crush-celebrity-score')

const OPTION_KEYS = ['A', 'B', 'C', 'D']

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

function createEvaluator(content, options = {}) {
  const subjectGender = normalizeSubjectGender(options.subjectGender)
  const eligiblePeople = content.people.filter((item) =>
    item.enabled !== false && (!['female', 'male'].includes(subjectGender) || normalizeSubjectGender(item.gender) === subjectGender)
  )
  function dimensionsFor(keys) {
    const sums = Object.fromEntries(DIMENSIONS.map((key) => [key, 0]))
    const counts = Object.fromEntries(DIMENSIONS.map((key) => [key, 0]))
    content.questions.forEach((question, index) => {
      const option = question.options.find((item) => item.key === keys[index])
      for (const [dimension, value] of Object.entries(option.scores)) {
        sums[dimension] += Number(value)
        counts[dimension] += 1
      }
    })
    return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, Math.round(sums[dimension] / counts[dimension])]))
  }

  function rankedFor(keys) {
    const dimensions = dimensionsFor(keys)
    return eligiblePeople.map((person) => {
      let squared = 0
      for (const dimension of DIMENSIONS) squared += DIMENSION_WEIGHTS[dimension] * ((dimensions[dimension] - person.profile[dimension]) ** 2)
      const distance = Math.sqrt(squared)
      return { key: person.key, era: person.era, category: person.category, sortOrder: person.sortOrder, distance, similarity: Math.round(Math.max(0, Math.min(100, 100 - distance))) }
    }).sort((a, b) => b.similarity - a.similarity || a.distance - b.distance || a.sortOrder - b.sortOrder || a.key.localeCompare(b.key, 'en'))
  }
  return { dimensionsFor, rankedFor }
}

function findGolden(content, rankedFor, personKey, random) {
  function objective(keys) {
    const ranked = rankedFor(keys)
    const rank = ranked.findIndex((item) => item.key === personKey)
    const target = ranked[rank]
    const leader = ranked[0]
    return { value: rank * 10000 + target.distance + Math.max(0, target.distance - leader.distance) * 10, rank }
  }
  let best = null
  for (let restart = 0; restart < 160; restart += 1) {
    const keys = Array.from({ length: content.questions.length }, () => OPTION_KEYS[Math.floor(random() * OPTION_KEYS.length)])
    let current = objective(keys)
    for (let pass = 0; pass < 20; pass += 1) {
      let improved = false
      const positions = Array.from({ length: keys.length }, (_, index) => index).sort(() => random() - 0.5)
      for (const index of positions) {
        const original = keys[index]
        let localBest = current
        let localKey = original
        for (const optionKey of OPTION_KEYS) {
          if (optionKey === original) continue
          const candidate = keys.slice()
          candidate[index] = optionKey
          const score = objective(candidate)
          if (score.value < localBest.value) { localBest = score; localKey = optionKey }
        }
        if (localKey !== original) { keys[index] = localKey; current = localBest; improved = true }
      }
      if (!best || current.value < best.score.value) best = { keys: keys.slice(), score: current }
      if (current.rank === 0) return keys
      if (!improved) break
    }
  }
  return best?.score?.rank === 0 ? best.keys : null
}

function runCelebrityCalibration(content, options = {}) {
  const iterations = Math.max(200000, Number(options.iterations) || 200000)
  const seed = Number(options.seed) || 20260801
  const random = mulberry32(seed)
  const genders = options.subjectGender ? [normalizeSubjectGender(options.subjectGender)] : ['female', 'male']
  if (genders.some((gender) => !['female', 'male'].includes(gender))) throw new Error('subjectGender invalid')
  const reports = {}
  const goldenAnswers = {}
  for (const gender of genders) reports[gender] = runGenderCalibration(content, { ...options, iterations, seed: seed + (gender === 'male' ? 1 : 0), subjectGender: gender })
  for (const report of Object.values(reports)) Object.assign(goldenAnswers, report.goldenAnswers)
  const passed = genders.every((gender) => reports[gender].passed)
  const core = { seed, iterations, genders: reports, goldenAnswers }
  const reportChecksum = crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')
  return { ...core, passed, reportChecksum }
}

function runGenderCalibration(content, options = {}) {
  const iterations = Math.max(200000, Number(options.iterations) || 200000)
  const seed = Number(options.seed) || 20260801
  const subjectGender = normalizeSubjectGender(options.subjectGender)
  const people = content.people.filter((person) => person.enabled !== false && normalizeSubjectGender(person.gender) === subjectGender)
  const random = mulberry32(seed)
  const { rankedFor } = createEvaluator(content, { subjectGender })
  const winnerCounts = Object.fromEntries(people.map((person) => [person.key, 0]))
  const groupWinners = {}
  const goldenAnswers = {}
  for (let index = 0; index < iterations; index += 1) {
    const keys = Array.from({ length: content.questions.length }, () => OPTION_KEYS[Math.floor(random() * OPTION_KEYS.length)])
    const winner = rankedFor(keys)[0]
    winnerCounts[winner.key] += 1
    const group = winner.era || winner.category || 'all'
    if (!groupWinners[group]) groupWinners[group] = new Set()
    groupWinners[group].add(winner.key)
    if (!goldenAnswers[winner.key]) goldenAnswers[winner.key] = Object.fromEntries(content.questions.map((question, questionIndex) => [question.id, keys[questionIndex]]))
  }
  for (const person of people) {
    if (goldenAnswers[person.key]) continue
    const keys = findGolden(content, rankedFor, person.key, random)
    if (keys) goldenAnswers[person.key] = Object.fromEntries(content.questions.map((question, index) => [question.id, keys[index]]))
  }
  const distribution = Object.entries(winnerCounts).map(([personKey, count]) => ({ personKey, count, ratio: count / iterations })).sort((a, b) => b.count - a.count)
  const maxRatio = distribution[0]?.ratio || 0
  const topFiveRatio = distribution.slice(0, 5).reduce((sum, item) => sum + item.ratio, 0)
  const missingGolden = people.filter((person) => !goldenAnswers[person.key]).map((person) => person.key)
  const groupWinnerCounts = Object.fromEntries(Object.entries(groupWinners).map(([key, value]) => [key, value.size]))
  const passed = maxRatio <= 0.18 && topFiveRatio <= 0.58 && missingGolden.length === 0
  const core = { subjectGender, seed, iterations, maxRatio, topFiveRatio, groupWinnerCounts, missingGolden, distribution, goldenAnswers }
  const reportChecksum = crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')
  return { ...core, passed, reportChecksum }
}

module.exports = { createEvaluator, runGenderCalibration, runCelebrityCalibration }
