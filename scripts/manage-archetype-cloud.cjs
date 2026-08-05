const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'audit-indexes'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'
const collectionName = 'archetype_question_banks'
const collectionNames = [collectionName, 'archetype_results']
const clearConfirmation = process.argv.includes('--confirm-clear-archetype-results')

const indexDefinitions = [
  {
    key: { featureKey: 1, subjectGender: 1, status: 1 },
    name: 'archetype_bank_feature_gender_status'
  },
  {
    key: { featureKey: 1, subjectGender: 1, contentVersion: 1 },
    name: 'archetype_bank_feature_gender_version_unique',
    unique: true
  }
]

function buildMongoCommand() {
  if (mode === 'clear-results') {
    if (!clearConfirmation) {
      throw new Error('Refusing to clear archetype_results without --confirm-clear-archetype-results')
    }
    return { delete: 'archetype_results', deletes: [{ q: {}, limit: 0 }] }
  }
  if (mode === 'audit-results') {
    return {
      aggregate: 'archetype_results',
      pipeline: [
        { $group: { _id: { kind: '$kind', subjectGender: '$subjectGender', contentVersion: '$contentVersion' }, count: { $sum: 1 }, earliest: { $min: '$createdAt' }, latest: { $max: '$createdAt' } } },
        { $sort: { '_id.kind': 1, '_id.subjectGender': 1, '_id.contentVersion': 1 } }
      ],
      cursor: {}
    }
  }
  if (mode === 'audit-subscription') {
    return {
      find: 'system_settings',
      filter: { _id: 'settings_subscription' },
      limit: 1
    }
  }
  if (mode === 'audit-indexes') return { listIndexes: collectionName }
  if (mode === 'create-indexes') return { createIndexes: collectionName, indexes: indexDefinitions }
  if (mode === 'audit-published') {
    return {
      aggregate: collectionName,
      pipeline: [
        {
          $project: {
            featureKey: 1,
            subjectGender: 1,
            displayTitle: 1,
            contentVersion: 1,
            status: 1,
            revision: 1,
            checksum: 1,
            publishedAt: 1,
            calibrationSummary: '$content.calibrationSummary',
            goldenAnswersCount: {
              $size: {
                $objectToArray: { $ifNull: ['$content.goldenAnswers', {}] }
              }
            }
          }
        },
        { $sort: { featureKey: 1, contentVersion: 1 } }
      ],
      cursor: {}
    }
  }
  throw new Error(`Unknown mode: ${mode}`)
}

function buildPayload() {
  if (mode === 'migrate-indexes') {
    return [
      {
        TableName: collectionName,
        CommandType: 'COMMAND',
        Command: JSON.stringify({ dropIndexes: collectionName, index: 'archetype_bank_feature_version_unique' })
      },
      {
        TableName: collectionName,
        CommandType: 'COMMAND',
        Command: JSON.stringify({ createIndexes: collectionName, indexes: indexDefinitions })
      }
    ]
  }
  if (mode === 'create-collections') {
    return collectionNames.map((name) => ({
      TableName: name,
      CommandType: 'COMMAND',
      Command: JSON.stringify({ create: name })
    }))
  }
  if (mode === 'audit-collections') {
    return collectionNames.map((name) => ({
      TableName: name,
      CommandType: 'COMMAND',
      Command: JSON.stringify({ count: name, query: {} })
    }))
  }
  return [{
    TableName: ['audit-results', 'clear-results'].includes(mode) ? 'archetype_results' : mode === 'audit-subscription' ? 'system_settings' : collectionName,
    CommandType: 'COMMAND',
    Command: JSON.stringify(buildMongoCommand())
  }]
}

const payload = JSON.stringify(buildPayload())

const result = spawnSync(process.execPath, [
  cli,
  'db',
  'nosql',
  'execute',
  '-e', envId,
  '--json',
  '--command', payload
], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
