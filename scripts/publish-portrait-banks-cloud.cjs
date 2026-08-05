const path = require('node:path')
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const envId = process.argv[2] || 'cloud1-d0gvhqu2c8a2b61fd'
const collection = 'archetype_question_banks'
const featureCelebrity = 'Crush名人图鉴'
const featureCharacter = '次元角色图鉴'

function extendedDate(date = new Date()) {
  return { $date: { $numberLong: String(date.getTime()) } }
}

function checksumContent(content) {
  const crypto = require('node:crypto')
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((out, key) => {
        out[key] = stable(value[key])
        return out
      }, {})
    }
    return value
  }
  return crypto.createHash('sha256').update(JSON.stringify(stable(content)), 'utf8').digest('hex')
}

function run(command) {
  const payload = JSON.stringify([{
    TableName: collection,
    CommandType: command.type,
    Command: JSON.stringify(command.body)
  }])
  const result = spawnSync(process.execPath, [cli, 'db', 'nosql', 'execute', '-e', envId, '--json', '--command', payload], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`CloudBase command failed with status ${result.status}`)
}

function chunks(items, size) {
  const output = []
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size))
  return output
}

function publishBank({ file, featureKey, version, bankId, peopleChunkSize }) {
  const content = JSON.parse(fs.readFileSync(path.join(projectRoot, 'cloudfunctions', '_shared', file), 'utf8'))
  const now = new Date()
  const checksum = checksumContent(content)
  const skeleton = {
    _id: bankId,
    featureKey,
    contentVersion: version,
    status: 'published',
    revision: 1,
    content: {
      dimensions: content.dimensions,
      questions: content.questions,
      resultCopy: content.resultCopy,
      people: []
    },
    checksum,
    createdBy: 'cloud-deploy',
    updatedBy: 'cloud-deploy',
    publishedBy: 'cloud-deploy',
    createdAt: extendedDate(now),
    updatedAt: extendedDate(now),
    publishedAt: extendedDate(now)
  }

  console.log(`[portrait-publish] inserting ${bankId}`)
  run({ type: 'INSERT', body: { insert: collection, documents: [skeleton] } })

  for (const people of chunks(content.people, peopleChunkSize)) {
    run({
      type: 'UPDATE',
      body: {
        update: collection,
        updates: [{ q: { _id: bankId }, u: { $push: { 'content.people': { $each: people } } } }]
      }
    })
  }

  const goldenSets = Object.entries(content.goldenAnswers || {}).map(([key, answers]) => ({ [`content.goldenAnswers.${key}`]: answers }))
  for (const batch of chunks(goldenSets, 8)) {
    const set = Object.assign({}, ...batch)
    run({
      type: 'UPDATE',
      body: {
        update: collection,
        updates: [{ q: { _id: bankId }, u: { $set: set } }]
      }
    })
  }

  run({
    type: 'UPDATE',
    body: {
      update: collection,
      updates: [{
        q: { _id: bankId },
        u: { $set: { 'content.calibrationSummary': content.calibrationSummary } }
      }]
    }
  })
  console.log(`[portrait-publish] published ${bankId} checksum=${checksum}`)
}

function archiveBank(bankId) {
  run({
    type: 'UPDATE',
    body: {
      update: collection,
      updates: [{ q: { _id: bankId }, u: { $set: { status: 'archived', updatedAt: extendedDate(), updatedBy: 'cloud-deploy' } } }]
    }
  })
}

publishBank({
  file: 'crush-celebrity-v1.json',
  featureKey: featureCelebrity,
  version: '1.1.0',
  bankId: 'archetype_bank_crush_celebrity_1_1_0',
  peopleChunkSize: 6
})
publishBank({
  file: 'dimension-character-v1.json',
  featureKey: featureCharacter,
  version: '1.0.0',
  bankId: 'archetype_bank_dimension_character_1_0_0',
  peopleChunkSize: 4
})
archiveBank('archetype_bank_crush_celebrity_1_0_0')
console.log('[portrait-publish] complete')
