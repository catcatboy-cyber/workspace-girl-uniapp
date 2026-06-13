#!/usr/bin/env node
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const AUDIT_DIR = path.join(ROOT, 'audit', 'cloudbase')
const DEFAULT_COLLECTIONS = [
  'users',
  'cases',
  'assessments',
  'timeline_records',
  'system_settings',
  'weekly_reviews',
  'token_usage_records',
  'token_accounts',
  'token_ledger_records',
  'call_usage_records',
  'voice_usage',
  'recharge_orders'
]
const CONFIG_COLLECTIONS = [
  'system_settings'
]
const SENSITIVE_KEY_RE = /secret|key|token|password|private|appid|appsecret|authorization|api[_-]?key/i

function usage() {
  console.log(`Usage:
  node scripts/audit-cloudbase-env.cjs snapshot --env <envId> --name <snapshotName>
  node scripts/audit-cloudbase-env.cjs compare --old <snapshotName> --new <snapshotName>

Options:
  --collections a,b,c       Override collection list for snapshot.
  --limit <n>               Per-page database query size. Default: 100.
  --skip-data               Snapshot config only, skip database documents.
  --config-only             Snapshot only configuration collections.
  --fast                    Skip slow per-function detail calls.
`)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item.startsWith('--')) {
      const key = item.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i += 1
      }
    } else {
      args._.push(item)
    }
  }
  return args
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value))
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortValue(value[key])
    return acc
  }, {})
}

function redactValue(key, value) {
  if (SENSITIVE_KEY_RE.test(String(key))) {
    if (value === undefined || value === null || value === '') {
      return { present: false }
    }
    return {
      present: true,
      sha256: sha256(value),
      length: String(value).length
    }
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item))
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, childKey) => {
      acc[childKey] = redactValue(childKey, value[childKey])
      return acc
    }, {})
  }
  return value
}

function runCli(args, options = {}) {
  const result = spawnSync('cmd.exe', ['/c', 'npx.cmd', 'cloudbase', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.status !== 0) {
    if (options.optional) {
      return { ok: false, stdout: result.stdout || '', stderr: result.stderr || '' }
    }
    throw new Error(`cloudbase ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  }
  return { ok: true, stdout: result.stdout || '', stderr: result.stderr || '' }
}

function parseCliJson(output) {
  const trimmed = output.trim()
  if (!trimmed) return null
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  let start = -1
  if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket)
  else start = Math.max(firstBrace, firstBracket)
  if (start < 0) return null
  return JSON.parse(trimmed.slice(start))
}

function snapshotDir(name) {
  return path.join(AUDIT_DIR, 'snapshots', name)
}

function getCloudbasercFunctions() {
  const file = path.join(ROOT, 'cloudbaserc.json')
  if (!fs.existsSync(file)) return []
  const config = readJson(file)
  return Array.isArray(config.functions) ? config.functions.map((fn) => fn.name).filter(Boolean) : []
}

function listFunctions(env) {
  const all = []
  const pageSize = 100
  for (let offset = 0; ; offset += pageSize) {
    const out = runCli(['fn', 'list', '-e', env, '--json', '--limit', String(pageSize), '--offset', String(offset)])
    const parsed = parseCliJson(out.stdout)
    const data = Array.isArray(parsed?.data) ? parsed.data : []
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}

function functionDetail(env, name) {
  const out = runCli(['fn', 'detail', name, '-e', env, '--json'], { optional: true })
  if (!out.ok) return { name, error: out.stderr || out.stdout }
  const parsed = parseCliJson(out.stdout)
  const data = parsed?.data || parsed || {}
  const variables = Array.isArray(data?.Environment?.Variables)
    ? data.Environment.Variables.map((item) => ({
      Key: item.Key,
      Value: redactValue(item.Key, item.Value)
    })).sort((a, b) => a.Key.localeCompare(b.Key))
    : []
  return {
    name,
    runtime: data.Runtime,
    timeout: data.Timeout,
    memorySize: data.MemorySize,
    handler: data.Handler,
    status: data.Status,
    availableStatus: data.AvailableStatus,
    triggers: data.Triggers || [],
    envVariables: variables
  }
}

function getLoginConfig(env) {
  const out = runCli(['env', 'login', 'get', '-e', env])
  return out.stdout
}

function getPermissions(env) {
  const out = runCli(['permission', 'get', '-e', env, '--json'])
  return parseCliJson(out.stdout)?.data || null
}

function getHosting(env) {
  const out = runCli(['hosting', 'detail', '-e', env, '--json'], { optional: true })
  return out.ok ? parseCliJson(out.stdout) : { error: out.stderr || out.stdout }
}

function listStorage(env, prefix = '') {
  const out = runCli(['storage', 'list', prefix, '-e', env, '--json'], { optional: true })
  return out.ok ? parseCliJson(out.stdout) : { error: out.stderr || out.stdout }
}

function dbCommand(env, tableName, commandType, commandObject) {
  const payload = JSON.stringify([{
    TableName: tableName,
    CommandType: commandType,
    Command: JSON.stringify(commandObject)
  }])
  const out = runCli(['db', 'nosql', 'execute', '-e', env, '--json', '--command', payload])
  return parseCliJson(out.stdout)
}

function extractDbDocuments(parsed) {
  const data = parsed?.data || parsed?.Data || parsed
  const first = Array.isArray(data) ? data[0] : data
  if (Array.isArray(data?.results?.[0])) return data.results[0]
  const candidates = [
    first?.data,
    first?.Data,
    first?.Result,
    first?.result,
    first?.Response?.Data
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
    if (typeof candidate === 'string') {
      try {
        const parsedCandidate = JSON.parse(candidate)
        if (Array.isArray(parsedCandidate)) return parsedCandidate
        if (Array.isArray(parsedCandidate?.data)) return parsedCandidate.data
        if (Array.isArray(parsedCandidate?.cursor?.firstBatch)) return parsedCandidate.cursor.firstBatch
      } catch {}
    }
    if (Array.isArray(candidate?.cursor?.firstBatch)) return candidate.cursor.firstBatch
  }
  if (Array.isArray(first?.cursor?.firstBatch)) return first.cursor.firstBatch
  return []
}

function extractDbCount(parsed) {
  const data = parsed?.data || parsed?.Data || parsed
  const first = Array.isArray(data) ? data[0] : data
  if (typeof data?.results?.[0]?.[0]?.n === 'number') return data.results[0][0].n
  if (typeof data?.results?.[0]?.[0]?.count === 'number') return data.results[0][0].count
  const candidates = [first?.n, first?.count, first?.Data, first?.Result, first?.data]
  for (const candidate of candidates) {
    if (typeof candidate === 'number') return candidate
    if (typeof candidate === 'string') {
      try {
        const parsedCandidate = JSON.parse(candidate)
        if (typeof parsedCandidate?.n === 'number') return parsedCandidate.n
        if (typeof parsedCandidate?.count === 'number') return parsedCandidate.count
      } catch {}
    }
  }
  return null
}

function dumpCollection(env, name, pageSize) {
  const countParsed = dbCommand(env, name, 'COMMAND', { count: name, query: {} })
  const count = extractDbCount(countParsed)
  const docs = []
  for (let skip = 0; ; skip += pageSize) {
    const parsed = dbCommand(env, name, 'QUERY', {
      find: name,
      filter: {},
      skip,
      limit: pageSize
    })
    const page = extractDbDocuments(parsed)
    docs.push(...page)
    if (page.length < pageSize) break
  }
  return { count, exported: docs.length, documents: docs }
}

function summarizeCollection(collection) {
  const docs = Array.isArray(collection?.documents) ? collection.documents : []
  const fields = new Set()
  const hashes = []
  for (const doc of docs) {
    if (doc && typeof doc === 'object') {
      Object.keys(doc).forEach((key) => fields.add(key))
      hashes.push({
        id: doc._id || doc.id || null,
        sha256: sha256(stableStringify(doc))
      })
    }
  }
  return {
    count: collection?.count,
    exported: collection?.exported,
    fields: Array.from(fields).sort(),
    documentHashes: hashes.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  }
}

function sanitizeSystemSettings(collection) {
  const docs = Array.isArray(collection?.documents) ? collection.documents : []
  return docs.map((doc) => redactValue('', doc))
}

function snapshot(args) {
  const env = args.env
  const name = args.name
  if (!env || !name) {
    usage()
    process.exit(2)
  }
  const outDir = snapshotDir(name)
  ensureDir(outDir)
  const pageSize = Number(args.limit || 100)
  const collections = args.collections
    ? String(args.collections).split(',').map((item) => item.trim()).filter(Boolean)
    : args['config-only']
      ? CONFIG_COLLECTIONS
    : DEFAULT_COLLECTIONS

  const projectFunctions = getCloudbasercFunctions()
  const cloudFunctions = listFunctions(env)
  const functionNames = Array.from(new Set([
    ...projectFunctions,
    ...cloudFunctions.map((fn) => fn.name).filter(Boolean)
  ])).sort()

  const meta = {
    name,
    env,
    createdAt: new Date().toISOString(),
    collections,
    projectFunctions,
    cloudFunctionCount: cloudFunctions.length
  }
  writeJson(path.join(outDir, 'meta.json'), meta)
  writeJson(path.join(outDir, 'functions-list.json'), cloudFunctions)
  writeJson(
    path.join(outDir, 'functions-detail-redacted.json'),
    args.fast
      ? cloudFunctions.map((fn) => ({ name: fn.name, runtime: fn.runtime, status: fn.status, createTime: fn.createTime, modifyTime: fn.modifyTime }))
      : functionNames.map((fn) => functionDetail(env, fn))
  )
  fs.writeFileSync(path.join(outDir, 'login-config.txt'), getLoginConfig(env), 'utf8')
  writeJson(path.join(outDir, 'permissions.json'), getPermissions(env))
  writeJson(path.join(outDir, 'hosting.json'), getHosting(env))
  writeJson(path.join(outDir, 'storage-root.json'), listStorage(env, ''))
  writeJson(path.join(outDir, 'storage-pets.json'), listStorage(env, 'pets/'))

  if (!args['skip-data']) {
    const dbDir = path.join(outDir, 'database')
    ensureDir(dbDir)
    for (const collection of collections) {
      console.error(`[snapshot:${name}] dumping ${collection}`)
      try {
        const dumped = dumpCollection(env, collection, pageSize)
        writeJson(path.join(dbDir, `${collection}.json`), dumped)
        writeJson(path.join(dbDir, `${collection}.summary.json`), summarizeCollection(dumped))
        if (collection === 'system_settings') {
          writeJson(path.join(dbDir, 'system_settings.redacted.json'), sanitizeSystemSettings(dumped))
        }
      } catch (error) {
        writeJson(path.join(dbDir, `${collection}.error.json`), {
          message: error.message
        })
      }
    }
  }

  console.log(`Snapshot written: ${outDir}`)
}

function loadSnapshot(name) {
  const dir = snapshotDir(name)
  return {
    dir,
    meta: readJson(path.join(dir, 'meta.json')),
    functions: readJson(path.join(dir, 'functions-detail-redacted.json')),
    permissions: readJson(path.join(dir, 'permissions.json')),
    hosting: readJson(path.join(dir, 'hosting.json')),
    storagePets: readJson(path.join(dir, 'storage-pets.json'))
  }
}

function mapBy(items, keyFn) {
  const map = new Map()
  for (const item of items || []) map.set(keyFn(item), item)
  return map
}

function diffJson(a, b) {
  const ah = sha256(stableStringify(a))
  const bh = sha256(stableStringify(b))
  return { equal: ah === bh, oldSha256: ah, newSha256: bh }
}

function compare(args) {
  const oldName = args.old
  const newName = args.new
  if (!oldName || !newName) {
    usage()
    process.exit(2)
  }
  const oldSnap = loadSnapshot(oldName)
  const newSnap = loadSnapshot(newName)
  const report = []
  report.push(`# CloudBase 环境差异审计`)
  report.push('')
  report.push(`- 旧快照：${oldName} (${oldSnap.meta.env})`)
  report.push(`- 新快照：${newName} (${newSnap.meta.env})`)
  report.push(`- 生成时间：${new Date().toISOString()}`)
  report.push('')

  const oldFns = mapBy(oldSnap.functions, (fn) => fn.name)
  const newFns = mapBy(newSnap.functions, (fn) => fn.name)
  const allFns = Array.from(new Set([...oldFns.keys(), ...newFns.keys()])).sort()
  const missingInNew = allFns.filter((name) => oldFns.has(name) && !newFns.has(name))
  const addedInNew = allFns.filter((name) => !oldFns.has(name) && newFns.has(name))
  const changedFns = allFns.filter((name) => oldFns.has(name) && newFns.has(name) && !diffJson(oldFns.get(name), newFns.get(name)).equal)
  report.push(`## 云函数`)
  report.push('')
  report.push(`- 旧环境函数数：${oldFns.size}`)
  report.push(`- 新环境函数数：${newFns.size}`)
  report.push(`- 新环境缺失：${missingInNew.length ? missingInNew.join(', ') : '无'}`)
  report.push(`- 新环境新增：${addedInNew.length ? addedInNew.join(', ') : '无'}`)
  report.push(`- 配置/环境变量/触发器有差异：${changedFns.length ? changedFns.join(', ') : '无'}`)
  report.push('')

  report.push(`## 权限与托管`)
  report.push('')
  report.push(`- 权限规则一致：${diffJson(oldSnap.permissions, newSnap.permissions).equal ? '是' : '否'}`)
  report.push(`- 静态托管信息一致：${diffJson(oldSnap.hosting, newSnap.hosting).equal ? '是' : '否'}`)
  report.push(`- 宠物存储清单一致：${diffJson(oldSnap.storagePets, newSnap.storagePets).equal ? '是' : '否'}`)
  report.push('')

  report.push(`## 数据库集合`)
  report.push('')
  const collections = Array.from(new Set([...(oldSnap.meta.collections || []), ...(newSnap.meta.collections || [])])).sort()
  for (const collection of collections) {
    const oldSummaryFile = path.join(oldSnap.dir, 'database', `${collection}.summary.json`)
    const newSummaryFile = path.join(newSnap.dir, 'database', `${collection}.summary.json`)
    if (!fs.existsSync(oldSummaryFile) || !fs.existsSync(newSummaryFile)) {
      report.push(`- ${collection}: 缺少快照，无法比较`)
      continue
    }
    const oldSummary = readJson(oldSummaryFile)
    const newSummary = readJson(newSummaryFile)
    const same = diffJson(oldSummary.documentHashes, newSummary.documentHashes).equal
    report.push(`- ${collection}: old=${oldSummary.exported}, new=${newSummary.exported}, 文档哈希一致=${same ? '是' : '否'}`)
  }
  report.push('')

  const oldSettingsFile = path.join(oldSnap.dir, 'database', 'system_settings.json')
  const newSettingsFile = path.join(newSnap.dir, 'database', 'system_settings.json')
  if (fs.existsSync(oldSettingsFile) && fs.existsSync(newSettingsFile)) {
    const oldSettings = readJson(oldSettingsFile)
    const newSettings = readJson(newSettingsFile)
    const settingsDiff = diffJson(oldSettings.documents || [], newSettings.documents || [])
    report.push(`## system_settings 重点检查`)
    report.push('')
    report.push(`- 完整文档一致：${settingsDiff.equal ? '是' : '否'}`)
    report.push(`- old sha256: \`${settingsDiff.oldSha256}\``)
    report.push(`- new sha256: \`${settingsDiff.newSha256}\``)
    report.push('')
    report.push(`如这里为“否”，优先检查：AI provider/model/baseURL、system prompt、prompt templates、billing/subscription、feature flags。敏感字段请看 snapshot 中的 redacted 文件。`)
    report.push('')
  }

  const reportDir = path.join(AUDIT_DIR, 'reports')
  ensureDir(reportDir)
  const reportFile = path.join(reportDir, `${oldName}-vs-${newName}.md`)
  fs.writeFileSync(reportFile, `${report.join('\n')}\n`, 'utf8')
  console.log(`Report written: ${reportFile}`)
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]
try {
  if (command === 'snapshot') snapshot(args)
  else if (command === 'compare') compare(args)
  else {
    usage()
    process.exit(2)
  }
} catch (error) {
  console.error(error.stack || error.message)
  process.exit(1)
}
