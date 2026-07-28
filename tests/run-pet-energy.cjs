const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const store = new Map()
globalThis.uni = {
  getStorageSync(key) { return store.get(key) },
  setStorageSync(key, value) { store.set(key, structuredClone(value)) },
  removeStorageSync(key) { store.delete(key) }
}

function localDateKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resetStore() {
  store.clear()
}

async function main() {
  const helpersUrl = pathToFileURL(path.resolve(__dirname, '..', 'src', 'utils', 'helpers.ts')).href
  const helpers = await import(helpersUrl)

  assert.equal(helpers.getPetMoodForScore(0).level, 'low')
  assert.equal(helpers.getPetMoodForScore(24).level, 'low')
  assert.equal(helpers.getPetMoodForScore(25).level, 'tired')
  assert.equal(helpers.getPetMoodForScore(49).level, 'tired')
  assert.equal(helpers.getPetMoodForScore(50).level, 'good')
  assert.equal(helpers.getPetMoodForScore(79).level, 'good')
  assert.equal(helpers.getPetMoodForScore(80).level, 'full')
  assert.equal(helpers.getPetMoodForScore(100).level, 'full')
  console.log('PASS pet mood score boundaries')

  resetStore()
  const defaultSnapshot = helpers.getPetEnergySnapshot()
  assert.equal(defaultSnapshot.score, 60)
  assert.equal(defaultSnapshot.actions.every(item => item.count === 0), true)
  console.log('PASS pet energy default snapshot')

  resetStore()
  store.set('petEnergy', {
    score: 40,
    updatedAt: Date.now(),
    lastRunAt: 0,
    dailyCounts: { date: localDateKey(), record: 1, chat: -3, petting: Number.NaN }
  })
  const normalized = helpers.readPetEnergy()
  assert.deepEqual(normalized.dailyCounts, { date: localDateKey(), record: 1, chat: 0, petting: 0, reply: 0 })
  console.log('PASS legacy daily counts normalization')

  resetStore()
  const recordResult = helpers.feedPet('record')
  assert.equal(recordResult.previousScore, 60)
  assert.equal(recordResult.score, 90)
  assert.equal(recordResult.bonus, 30)
  assert.equal(recordResult.crossedMoodBoundary, true)
  assert.equal(helpers.takePendingPetEnergyFeedback().type, 'level-change')
  console.log('PASS pet record bonus and feedback')

  resetStore()
  helpers.writePetEnergy({
    score: 90,
    updatedAt: Date.now(),
    lastRunAt: 0,
    dailyCounts: { date: localDateKey(), record: 0, chat: 0, petting: 0, reply: 0 }
  })
  const cappedByScore = helpers.feedPet('record')
  assert.equal(cappedByScore.score, 100)
  assert.equal(cappedByScore.bonus, 10)
  assert.equal(cappedByScore.configuredBonus, 30)
  assert.equal(cappedByScore.reachedFull, true)
  assert.equal(helpers.takePendingPetEnergyFeedback().type, 'full')
  console.log('PASS actual bonus near full energy')

  resetStore()
  helpers.writePetEnergy({
    score: 50,
    updatedAt: Date.now(),
    lastRunAt: 0,
    dailyCounts: { date: localDateKey(), record: 3, chat: 0, petting: 0, reply: 0 }
  })
  const dailyCap = helpers.feedPet('record')
  assert.equal(dailyCap.applied, false)
  assert.equal(dailyCap.score, 50)
  assert.equal(helpers.takePendingPetEnergyFeedback().type, 'cap')
  helpers.feedPet('record')
  assert.equal(helpers.takePendingPetEnergyFeedback(), null)
  console.log('PASS pet daily cap and one-time notice')

  resetStore()
  helpers.writePetEnergy({
    score: 60,
    updatedAt: Date.now() - 8 * 60 * 60 * 1000 - 1000,
    lastRunAt: 0,
    dailyCounts: { date: localDateKey(), record: 0, chat: 0, petting: 0, reply: 0 }
  })
  assert.equal(helpers.decayPetEnergy(), 50)
  assert.equal(helpers.readPetEnergy().score, 50)
  console.log('PASS pet energy four-hour decay steps')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
