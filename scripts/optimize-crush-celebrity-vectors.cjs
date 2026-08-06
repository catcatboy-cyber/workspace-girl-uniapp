'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const content = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const { DIMENSIONS } = require('../cloudfunctions/_shared/crush-celebrity-score')

const OPTION_KEYS = ['A', 'B', 'C', 'D']
const DEFAULT_SEED = 20260801
const adjustmentReportPath = path.resolve(__dirname, '..', 'calibration', 'crush-celebrity-v1-vector-adjustment-report.json')

function numberArg(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))
  return value ? Number(value.slice(prefix.length)) : fallback
}

function stringArg(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
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
  const sums = new Int16Array(DIMENSIONS.length)
  const counts = new Int8Array(DIMENSIONS.length)
  content.questions.forEach((question, questionIndex) => {
    const option = question.options.find((item) => item.key === keys[questionIndex])
    for (const [dimension, rawValue] of Object.entries(option.scores)) {
      const dimensionIndex = DIMENSIONS.indexOf(dimension)
      sums[dimensionIndex] += Number(rawValue)
      counts[dimensionIndex] += 1
    }
  })
  return DIMENSIONS.map((_, index) => Math.round(sums[index] / counts[index]))
}

function createSamples(sampleCount, seed) {
  const random = mulberry32(seed)
  const samples = Array.from({ length: DIMENSIONS.length }, () => new Uint8Array(sampleCount))
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const keys = content.questions.map(() => OPTION_KEYS[Math.floor(random() * OPTION_KEYS.length)])
    const dimensions = dimensionsFor(keys)
    for (let dimensionIndex = 0; dimensionIndex < DIMENSIONS.length; dimensionIndex += 1) {
      samples[dimensionIndex][sampleIndex] = dimensions[dimensionIndex]
    }
  }
  return samples
}

function createProfiles() {
  if (!fs.existsSync(adjustmentReportPath)) {
    return content.people.map((person) => DIMENSIONS.map((dimension) => Number(person.profile[dimension])))
  }
  const report = JSON.parse(fs.readFileSync(adjustmentReportPath, 'utf8'))
  const adjustmentMap = new Map(report.adjustments.map((item) => [item.personKey, item]))
  return content.people.map((person) => {
    const adjustment = adjustmentMap.get(person.key)
    if (!adjustment) throw new Error(`Missing V1 baseline profile for ${person.key}`)
    for (const dimension of DIMENSIONS) {
      if (Number(person.profile[dimension]) !== Number(adjustment.after[dimension])) {
        throw new Error(`Current profile no longer matches the audited V1 adjustment: ${person.key}.${dimension}`)
      }
    }
    return DIMENSIONS.map((dimension) => Number(adjustment.before[dimension]))
  })
}

function createBounds(profiles) {
  return profiles.map((profile) => profile.map((value) => ({ low: Math.max(0, value - 5), high: Math.min(100, value + 5) })))
}

function tiePriority() {
  return content.people.map((person, index) => ({ index, sortOrder: Number(person.sortOrder) || Number.MAX_SAFE_INTEGER, key: person.key }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key, 'en'))
    .reduce((result, item, priority) => {
      result[item.index] = priority
      return result
    }, [])
}

function wins(distanceA, personA, distanceB, personB, priorities) {
  return distanceA < distanceB || (distanceA === distanceB && priorities[personA] < priorities[personB])
}

function createState(samples, profiles, priorities) {
  const sampleCount = samples[0].length
  const personCount = profiles.length
  const distances = profiles.map(() => new Float64Array(sampleCount))
  for (let personIndex = 0; personIndex < personCount; personIndex += 1) {
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      let squared = 0
      for (let dimensionIndex = 0; dimensionIndex < DIMENSIONS.length; dimensionIndex += 1) {
        const difference = samples[dimensionIndex][sampleIndex] - profiles[personIndex][dimensionIndex]
        squared += difference * difference
      }
      distances[personIndex][sampleIndex] = squared
    }
  }

  const winners = new Uint8Array(sampleCount)
  const seconds = new Uint8Array(sampleCount)
  const counts = new Int32Array(personCount)
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let winner = 0
    let second = 1
    if (wins(distances[second][sampleIndex], second, distances[winner][sampleIndex], winner, priorities)) {
      winner = 1
      second = 0
    }
    for (let personIndex = 2; personIndex < personCount; personIndex += 1) {
      const distance = distances[personIndex][sampleIndex]
      if (wins(distance, personIndex, distances[winner][sampleIndex], winner, priorities)) {
        second = winner
        winner = personIndex
      } else if (wins(distance, personIndex, distances[second][sampleIndex], second, priorities)) {
        second = personIndex
      }
    }
    winners[sampleIndex] = winner
    seconds[sampleIndex] = second
    counts[winner] += 1
  }
  return { distances, winners, seconds, counts }
}

function metricsFor(counts, sampleCount) {
  const ratios = Array.from(counts, (count) => count / sampleCount)
  const sortedRatios = ratios.slice().sort((a, b) => b - a)
  const eraWinnerCounts = { history: 0, modern: 0, contemporary: 0 }
  let zeroWinners = 0
  for (let personIndex = 0; personIndex < counts.length; personIndex += 1) {
    if (counts[personIndex] > 0) eraWinnerCounts[content.people[personIndex].era] += 1
    else zeroWinners += 1
  }
  const maxRatio = sortedRatios[0] || 0
  const topFiveRatio = sortedRatios.slice(0, 5).reduce((sum, ratio) => sum + ratio, 0)
  const eraDeficit = Object.values(eraWinnerCounts).reduce((sum, count) => sum + Math.max(0, 10 - count), 0)
  const target = 1 / counts.length
  const concentration = ratios.reduce((sum, ratio) => sum + ((ratio - target) ** 2), 0)
  const maxExcess = Math.max(0, maxRatio - 0.1)
  const topFiveExcess = Math.max(0, topFiveRatio - 0.38)
  const score = zeroWinners * 1e9 + eraDeficit * 1e9 + (maxExcess ** 2) * 1e11 + (topFiveExcess ** 2) * 1e11 + concentration * 1e7
  return { score, maxRatio, topFiveRatio, zeroWinners, eraWinnerCounts, eraDeficit, concentration }
}

function evaluateCoordinate(state, samples, profiles, priorities, personIndex, dimensionIndex, nextValue) {
  const sampleCount = samples[0].length
  const currentValue = profiles[personIndex][dimensionIndex]
  const nextDistances = new Float64Array(sampleCount)
  const nextCounts = Int32Array.from(state.counts)
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const sampleValue = samples[dimensionIndex][sampleIndex]
    const oldDifference = sampleValue - currentValue
    const nextDifference = sampleValue - nextValue
    const nextDistance = state.distances[personIndex][sampleIndex] - (oldDifference * oldDifference) + (nextDifference * nextDifference)
    nextDistances[sampleIndex] = nextDistance
    const otherWinner = state.winners[sampleIndex] === personIndex ? state.seconds[sampleIndex] : state.winners[sampleIndex]
    const nextWinner = wins(nextDistance, personIndex, state.distances[otherWinner][sampleIndex], otherWinner, priorities)
      ? personIndex
      : otherWinner
    const previousWinner = state.winners[sampleIndex]
    if (nextWinner !== previousWinner) {
      nextCounts[previousWinner] -= 1
      nextCounts[nextWinner] += 1
    }
  }
  return { nextValue, nextDistances, nextCounts, metrics: metricsFor(nextCounts, sampleCount) }
}

function evaluateProfile(state, samples, priorities, personIndex, nextProfile) {
  const sampleCount = samples[0].length
  const nextDistances = new Float64Array(sampleCount)
  const nextCounts = Int32Array.from(state.counts)
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let nextDistance = 0
    for (let dimensionIndex = 0; dimensionIndex < DIMENSIONS.length; dimensionIndex += 1) {
      const difference = samples[dimensionIndex][sampleIndex] - nextProfile[dimensionIndex]
      nextDistance += difference * difference
    }
    nextDistances[sampleIndex] = nextDistance
    const otherWinner = state.winners[sampleIndex] === personIndex ? state.seconds[sampleIndex] : state.winners[sampleIndex]
    const nextWinner = wins(nextDistance, personIndex, state.distances[otherWinner][sampleIndex], otherWinner, priorities)
      ? personIndex
      : otherWinner
    const previousWinner = state.winners[sampleIndex]
    if (nextWinner !== previousWinner) {
      nextCounts[previousWinner] -= 1
      nextCounts[nextWinner] += 1
    }
  }
  return { nextProfile, nextDistances, nextCounts, metrics: metricsFor(nextCounts, sampleCount) }
}

function acceptCoordinate(state, profiles, priorities, personIndex, dimensionIndex, candidate) {
  profiles[personIndex][dimensionIndex] = candidate.nextValue
  const previousWinners = state.winners.slice()
  const previousSeconds = state.seconds.slice()
  state.distances[personIndex] = candidate.nextDistances
  state.counts = candidate.nextCounts
  for (let sampleIndex = 0; sampleIndex < state.winners.length; sampleIndex += 1) {
    const previousWinner = previousWinners[sampleIndex]
    const previousSecond = previousSeconds[sampleIndex]
    if (
      previousWinner !== personIndex &&
      previousSecond !== personIndex &&
      !wins(candidate.nextDistances[sampleIndex], personIndex, state.distances[previousSecond][sampleIndex], previousSecond, priorities)
    ) continue

    let winner = 0
    let second = 1
    if (wins(state.distances[second][sampleIndex], second, state.distances[winner][sampleIndex], winner, priorities)) {
      winner = 1
      second = 0
    }
    for (let candidatePerson = 2; candidatePerson < profiles.length; candidatePerson += 1) {
      const distance = state.distances[candidatePerson][sampleIndex]
      if (wins(distance, candidatePerson, state.distances[winner][sampleIndex], winner, priorities)) {
        second = winner
        winner = candidatePerson
      } else if (wins(distance, candidatePerson, state.distances[second][sampleIndex], second, priorities)) {
        second = candidatePerson
      }
    }
    state.winners[sampleIndex] = winner
    state.seconds[sampleIndex] = second
  }
}

function acceptProfile(state, profiles, priorities, personIndex, candidate) {
  profiles[personIndex] = candidate.nextProfile.slice()
  const previousWinners = state.winners.slice()
  const previousSeconds = state.seconds.slice()
  state.distances[personIndex] = candidate.nextDistances
  state.counts = candidate.nextCounts
  for (let sampleIndex = 0; sampleIndex < state.winners.length; sampleIndex += 1) {
    const previousWinner = previousWinners[sampleIndex]
    const previousSecond = previousSeconds[sampleIndex]
    if (
      previousWinner !== personIndex &&
      previousSecond !== personIndex &&
      !wins(candidate.nextDistances[sampleIndex], personIndex, state.distances[previousSecond][sampleIndex], previousSecond, priorities)
    ) continue

    let winner = 0
    let second = 1
    if (wins(state.distances[second][sampleIndex], second, state.distances[winner][sampleIndex], winner, priorities)) {
      winner = 1
      second = 0
    }
    for (let candidatePerson = 2; candidatePerson < profiles.length; candidatePerson += 1) {
      const distance = state.distances[candidatePerson][sampleIndex]
      if (wins(distance, candidatePerson, state.distances[winner][sampleIndex], winner, priorities)) {
        second = winner
        winner = candidatePerson
      } else if (wins(distance, candidatePerson, state.distances[second][sampleIndex], second, priorities)) {
        second = candidatePerson
      }
    }
    state.winners[sampleIndex] = winner
    state.seconds[sampleIndex] = second
  }
}

function rescueZeroWinners(state, samples, profiles, bounds, priorities) {
  let rescues = 0
  const zeroPeople = Array.from(state.counts, (count, personIndex) => ({ count, personIndex }))
    .filter((item) => item.count === 0)
    .map((item) => item.personIndex)
  for (const personIndex of zeroPeople) {
    if (state.counts[personIndex] > 0) continue
    let anchorProfile = null
    let anchorMargin = Number.NEGATIVE_INFINITY
    for (let sampleIndex = 0; sampleIndex < samples[0].length; sampleIndex += 1) {
      const nextProfile = bounds[personIndex].map(({ low, high }, dimensionIndex) =>
        Math.max(low, Math.min(high, samples[dimensionIndex][sampleIndex]))
      )
      let nextDistance = 0
      for (let dimensionIndex = 0; dimensionIndex < DIMENSIONS.length; dimensionIndex += 1) {
        const difference = samples[dimensionIndex][sampleIndex] - nextProfile[dimensionIndex]
        nextDistance += difference * difference
      }
      const otherWinner = state.winners[sampleIndex]
      const otherDistance = state.distances[otherWinner][sampleIndex]
      if (!wins(nextDistance, personIndex, otherDistance, otherWinner, priorities)) continue
      const margin = otherDistance - nextDistance
      if (margin > anchorMargin) {
        anchorMargin = margin
        anchorProfile = nextProfile
      }
    }
    if (anchorProfile) {
      const candidate = evaluateProfile(state, samples, priorities, personIndex, anchorProfile)
      const currentMetrics = metricsFor(state.counts, samples[0].length)
      if (candidate.metrics.score + 1e-9 < currentMetrics.score) {
        acceptProfile(state, profiles, priorities, personIndex, candidate)
        rescues += 1
        console.log(`anchored ${content.people[personIndex].key} count=${state.counts[personIndex]}`)
        continue
      }
    }

    const valuesByDimension = bounds[personIndex].map(({ low, high }, dimensionIndex) =>
      Array.from(new Set([low, Math.round((low + high) / 2), high, profiles[personIndex][dimensionIndex]])).sort((a, b) => a - b)
    )
    let best = null
    for (const initiative of valuesByDimension[0]) {
      for (const warmth of valuesByDimension[1]) {
        for (const reliability of valuesByDimension[2]) {
          for (const romance of valuesByDimension[3]) {
            for (const boundary of valuesByDimension[4]) {
              const nextProfile = [initiative, warmth, reliability, romance, boundary]
              if (nextProfile.every((value, index) => value === profiles[personIndex][index])) continue
              const candidate = evaluateProfile(state, samples, priorities, personIndex, nextProfile)
              if (!best || candidate.metrics.score < best.metrics.score) best = candidate
            }
          }
        }
      }
    }
    const currentMetrics = metricsFor(state.counts, samples[0].length)
    if (best && best.metrics.score + 1e-9 < currentMetrics.score) {
      acceptProfile(state, profiles, priorities, personIndex, best)
      rescues += 1
      console.log(`rescued ${content.people[personIndex].key} count=${state.counts[personIndex]}`)
    }
  }
  return rescues
}

function shuffledCoordinates(random) {
  const coordinates = []
  for (let personIndex = 0; personIndex < content.people.length; personIndex += 1) {
    for (let dimensionIndex = 0; dimensionIndex < DIMENSIONS.length; dimensionIndex += 1) coordinates.push([personIndex, dimensionIndex])
  }
  for (let index = coordinates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const value = coordinates[index]
    coordinates[index] = coordinates[swapIndex]
    coordinates[swapIndex] = value
  }
  return coordinates
}

function summary(counts, sampleCount) {
  const metrics = metricsFor(counts, sampleCount)
  const distribution = content.people.map((person, index) => ({
    personKey: person.key,
    era: person.era,
    count: counts[index],
    ratio: counts[index] / sampleCount
  })).sort((a, b) => b.count - a.count)
  return { ...metrics, distribution }
}

const sampleCount = Math.max(10000, numberArg('sample', 50000))
const sweeps = Math.max(1, numberArg('sweeps', 6))
const seed = numberArg('seed', DEFAULT_SEED)
const outputPath = path.resolve(stringArg('output', path.join(os.tmpdir(), 'crush-celebrity-vector-candidate.json')))
const samples = createSamples(sampleCount, seed)
const baselineProfiles = createProfiles()
const profiles = baselineProfiles.map((profile) => profile.slice())
const bounds = createBounds(baselineProfiles)
const priorities = tiePriority()
const state = createState(samples, profiles, priorities)
const random = mulberry32(seed ^ 0xA5A5A5A5)
const before = summary(state.counts, sampleCount)
let currentMetrics = metricsFor(state.counts, sampleCount)

console.log(`before ${JSON.stringify(currentMetrics)}`)
for (let sweep = 0; sweep < sweeps; sweep += 1) {
  const rescues = rescueZeroWinners(state, samples, profiles, bounds, priorities)
  currentMetrics = metricsFor(state.counts, sampleCount)
  let changes = 0
  for (const [personIndex, dimensionIndex] of shuffledCoordinates(random)) {
    const { low, high } = bounds[personIndex][dimensionIndex]
    const currentValue = profiles[personIndex][dimensionIndex]
    let best = null
    for (let nextValue = low; nextValue <= high; nextValue += 1) {
      if (nextValue === currentValue) continue
      const candidate = evaluateCoordinate(state, samples, profiles, priorities, personIndex, dimensionIndex, nextValue)
      if (!best || candidate.metrics.score < best.metrics.score) best = candidate
    }
    if (best && best.metrics.score + 1e-9 < currentMetrics.score) {
      acceptCoordinate(state, profiles, priorities, personIndex, dimensionIndex, best)
      currentMetrics = best.metrics
      changes += 1
    }
  }
  console.log(`sweep ${sweep + 1}/${sweeps} rescues=${rescues} changes=${changes} ${JSON.stringify(currentMetrics)}`)
  if (rescues === 0 && changes === 0) break
}

const adjustments = content.people.map((person, personIndex) => ({
  personKey: person.key,
  before: Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension, baselineProfiles[personIndex][index]])),
  after: Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension, profiles[personIndex][index]])),
  delta: Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension, profiles[personIndex][index] - baselineProfiles[personIndex][index]]))
}))

const result = {
  seed,
  sampleCount,
  sweeps,
  constraints: { perDimensionDelta: 5, maxWinnerTarget: 0.1, topFiveTarget: 0.38, minimumEraWinners: 10 },
  before,
  after: summary(state.counts, sampleCount),
  adjustments
}
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
console.log(`candidate ${outputPath}`)
