'use strict'

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '..', 'RELATION-HEROINE-DEEPSEEK-HANDOFF-2026-08-01.md')
const source = fs.readFileSync(sourcePath, 'utf8')

function section(start, end) {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`missing section: ${start}`)
  const to = end ? source.indexOf(end, from + start.length) : source.length
  return source.slice(from, to < 0 ? source.length : to)
}

function rows(markdown) {
  return markdown.split(/\r?\n/)
    .filter((line) => /^\| [A-Z][A-Z0-9]+ \|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
}

function splitParallel(value) {
  const parts = String(value).split('｜')
  if (parts.length !== 2) throw new Error(`parallel text must use ｜: ${value}`)
  return { textSelf: parts[0].trim(), textTarget: parts[1].trim() }
}

const stages = [
  { key: 'pre_relationship', label: '还没在一起：刚认识、朋友或暧昧' },
  { key: 'early_dating', label: '刚开始交往' },
  { key: 'steady_relationship', label: '稳定交往' },
  { key: 'long_term', label: '长期共同生活或婚姻' }
]

const archetypeDefs = [
  {
    key: 'ran_yingying', name: '冉莹颖型', label: '掌舵大女主', prefix: 'R',
    universalSection: ['### 7.1 冉莹颖型', '### 7.2 佟晨洁型'],
    stageSection: ['### 8.1 冉莹颖型', '### 8.2 佟晨洁型'],
    scenarioSection: ['### 9.1 冉莹颖型', '### 9.2 佟晨洁型'],
    dimensions: [
      ['take_charge', '主动掌舵', '遇到模糊局面时更愿意拍板并推进', '更习惯等待共识或由别人发起'],
      ['responsibility', '责任兜底', '关键时刻倾向补位、兑现和收尾', '更重视各自负责，不会轻易替人兜底'],
      ['standards_control', '高标准掌控', '对过程和结果都有较强标准与掌控感', '更能接受别人按自己的方式处理']
    ],
    attraction: '主动、能扛事、关键时刻有行动力',
    caution: '标准过高时可能替别人做决定，让人有被管理感'
  },
  {
    key: 'tong_chenjie', name: '佟晨洁型', label: '清醒边界派', prefix: 'T',
    universalSection: ['### 7.2 佟晨洁型', '### 7.3 谢杏芳型'],
    stageSection: ['### 8.2 佟晨洁型', '### 8.3 谢杏芳型'],
    scenarioSection: ['### 9.2 佟晨洁型', '### 9.3 谢杏芳型'],
    dimensions: [
      ['independent_boundary', '独立边界', '亲密中仍能保留安排、空间和边界', '更容易为了关系压缩自己的空间'],
      ['clear_observation', '清醒观察', '更看长期行动与一致性，不被一时表达带走', '更容易相信当下感受或替不一致找理由'],
      ['needs_exit', '需求表达与止损', '能说清需求，并在反复不合时采取行动', '更容易等待、回避表达或延后决定']
    ],
    attraction: '清醒、有边界、不会在喜欢里失去自己',
    caution: '观察期过长或止损过快时，可能让人感到距离感'
  },
  {
    key: 'xie_xingfang', name: '谢杏芳型', label: '长期守护者', prefix: 'X',
    universalSection: ['### 7.3 谢杏芳型', '## 8. 五道阶段题'],
    stageSection: ['### 8.3 谢杏芳型', '## 9. 情景验证题'],
    scenarioSection: ['### 9.3 谢杏芳型', '有效情景至少'],
    dimensions: [
      ['long_commitment', '长期承诺', '重视长期稳定，不因一次波动否定全部', '更看重当下体验，关系低谷时更快抽离'],
      ['repair_tolerance', '容错修复', '愿意根据持续行动给出有限修复机会', '受伤后较难重新开放观察'],
      ['stable_maintenance', '稳定维护', '会主动维护连接、体面和共同稳定', '更倾向让关系自然发展，不主动维系']
    ],
    attraction: '稳定、重承诺、愿意给关系修复空间',
    caution: '容错过高时可能延迟面对反复发生的问题'
  }
]

function buildUniversal(def) {
  return rows(section(...def.universalSection)).map((columns) => ({
    id: columns[0],
    textSelf: columns[1],
    textTarget: columns[2],
    reverse: columns[3] === 'true',
    dimensionKey: def.dimensions[Math.floor((Number(columns[0].slice(-2)) - 1) / 5)][0]
  }))
}

function buildStageQuestions(def) {
  const output = Object.fromEntries(stages.map((stage) => [stage.key, []]))
  for (const columns of rows(section(...def.stageSection))) {
    stages.forEach((stage, index) => {
      output[stage.key].push({
        id: columns[0],
        ...splitParallel(columns[index + 1]),
        reverse: false,
        dimensionKey: def.dimensions[2][0]
      })
    })
  }
  return output
}

function buildScenarios(def) {
  const output = Object.fromEntries(stages.map((stage) => [stage.key, []]))
  for (const columns of rows(section(...def.scenarioSection))) {
    const contexts = columns[1].split(' / ').map((item) => item.trim())
    if (contexts.length !== 4) throw new Error(`scenario stage count invalid: ${columns[0]}`)
    stages.forEach((stage, index) => {
      output[stage.key].push({
        id: columns[0],
        textSelf: `${contexts[index]}，你通常会：`,
        textTarget: `${contexts[index]}，TA通常会：`,
        options: [
          { key: 'A', text: columns[2] },
          { key: 'B', text: columns[3] },
          { key: 'C', text: columns[4] }
        ],
        typicalOptionKey: 'A'
      })
    })
  }
  return output
}

const screenerRows = rows(section('## 6. 六题快筛', '## 7. 首发'))
const screener = screenerRows.map((columns) => {
  const promptParts = columns[1].split(' / ')
  return {
    id: columns[0],
    textSelf: promptParts[0].trim(),
    textTarget: (promptParts[1] || promptParts[0]).trim(),
    options: ['R', 'T', 'X'].map((key, index) => ({
      key,
      textSelf: columns[index + 2],
      textTarget: columns[index + 2],
      voteFor: { R: 'ran_yingying', T: 'tong_chenjie', X: 'xie_xingfang' }[key]
    }))
  }
})

const content = {
  stages,
  screener,
  archetypes: archetypeDefs.map((def) => ({
    key: def.key,
    name: def.name,
    label: def.label,
    enabled: true,
    dimensions: def.dimensions.map(([key, name, highText, lowText]) => ({ key, name, weight: 1 / 3, highText, lowText })),
    universalQuestions: buildUniversal(def),
    stageQuestions: buildStageQuestions(def),
    scenarios: buildScenarios(def),
    resultCopy: { attraction: def.attraction, caution: def.caution }
  }))
}

const rendered = `${JSON.stringify(content, null, 2)}\n`
const args = process.argv.slice(2)
if (args.includes('--total-lines')) {
  process.stdout.write(String(rendered.split(/\r?\n/).length - 1))
} else {
  const startArg = args.find((item) => item.startsWith('--line-start='))
  const countArg = args.find((item) => item.startsWith('--line-count='))
  const start = startArg ? Math.max(0, Number(startArg.split('=')[1]) || 0) : 0
  const count = countArg ? Math.max(0, Number(countArg.split('=')[1]) || 0) : Number.MAX_SAFE_INTEGER
  const lines = rendered.trimEnd().split(/\r?\n/).slice(start, start + count)
  process.stdout.write(`${lines.join('\n')}\n`)
}
