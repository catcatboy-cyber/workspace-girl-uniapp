const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')

const entry = path.join(__dirname, '..', 'src', 'utils', 'crush-type.js')
const bundled = esbuild.transformSync(fs.readFileSync(entry, 'utf8'), {
  loader: 'js',
  format: 'cjs'
}).code

const mod = { exports: {} }
new Function('module', 'exports', bundled)(mod, mod.exports)
const { deriveCrushType } = mod.exports

const cases = [
  ['insufficient_evidence', { evidenceLevel: 'E1', intentScore: 80, consistencyRiskScore: 10 }],
  ['sweet_talker_low_action', { evidenceLevel: 'E3', intentScore: 66, consistencyRiskScore: 50, primaryLabels: ['口头热情，行动不足'] }],
  ['hot_cold', { evidenceLevel: 'E3', intentScore: 54, consistencyRiskScore: 50, primaryLabels: ['节奏明显不稳定'] }],
  ['low_cost_flirt', { evidenceLevel: 'E3', intentScore: 58, consistencyRiskScore: 68 }],
  ['serious_progressor', { evidenceLevel: 'E4', intentScore: 78, consistencyRiskScore: 30, timelineStats: { fulfilledCount: 1 } }],
  ['warming_stable', { evidenceLevel: 'E3', intentScore: 64, consistencyRiskScore: 34 }],
  ['ambiguous_observer', { evidenceLevel: 'E3', intentScore: 52, consistencyRiskScore: 40 }],
  ['friend_boundary', { evidenceLevel: 'E3', intentScore: 35, consistencyRiskScore: 35 }],
  ['ambiguous_observer', {}]
]

let failed = 0
for (const [expected, input] of cases) {
  const actual = deriveCrushType(input).key
  if (actual !== expected) {
    failed += 1
    console.error(`FAIL expected=${expected} actual=${actual}`)
  } else {
    console.log(`PASS ${expected}`)
  }
}

if (failed > 0) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log(`${cases.length} passed, 0 failed`)
