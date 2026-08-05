#!/usr/bin/env node
/**
 * processReferralJobs 定时触发器管理（触发频率属于环境配置，不写在业务代码里）
 *
 * Usage:
 *   node scripts/manage-referral-trigger.cjs list                  [envId]
 *   node scripts/manage-referral-trigger.cjs create-minute         [envId]   # 验证期：每分钟
 *   node scripts/manage-referral-trigger.cjs create-hourly         [envId]   # 稳态：每小时整点
 *   node scripts/manage-referral-trigger.cjs delete <triggerName>  [envId]
 *   node scripts/manage-referral-trigger.cjs invoke                [envId]   # 手工调用一次
 */
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const FN_NAME = 'processReferralJobs'

const args = process.argv.slice(2)
const mode = args[0] || 'list'

const TRIGGERS = {
  'create-minute': { name: 'processReferralJobsEveryMinute', config: '0 * * * * * *' },
  'create-hourly': { name: 'processReferralJobsEveryHour', config: '0 0 * * * * *' }
}

function run(cliArgs) {
  const result = spawnSync(process.execPath, [cli, ...cliArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  return result.status ?? 1
}

if (mode === 'list') {
  const envId = args[1] || 'cloud1-d0gvhqu2c8a2b61fd'
  process.exitCode = run(['fn', 'detail', FN_NAME, '-e', envId, '--json'])
} else if (mode === 'invoke') {
  const envId = args[1] || 'cloud1-d0gvhqu2c8a2b61fd'
  process.exitCode = run(['fn', 'invoke', FN_NAME, '-e', envId])
} else if (mode === 'delete') {
  const triggerName = args[1]
  const envId = args[2] || 'cloud1-d0gvhqu2c8a2b61fd'
  if (!triggerName) {
    console.error('delete 需要 triggerName')
    process.exitCode = 2
  } else {
    process.exitCode = run(['fn', 'trigger', 'delete', FN_NAME, triggerName, '-e', envId])
  }
} else if (TRIGGERS[mode]) {
  const envId = args[1] || 'cloud1-d0gvhqu2c8a2b61fd'
  const trigger = TRIGGERS[mode]
  console.error(`[referral-trigger] create ${trigger.name} (${trigger.config}) on ${envId}`)
  process.exitCode = run([
    'fn', 'trigger', 'create', FN_NAME,
    '-e', envId,
    '--trigger-name', trigger.name,
    '--cron', trigger.config
  ])
} else {
  console.error(`Unknown mode: ${mode}`)
  process.exitCode = 2
}
