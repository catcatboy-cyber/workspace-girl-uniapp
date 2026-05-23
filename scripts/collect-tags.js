/**
 * 收集 petLines tagLines 的标记结果，合并到 pet-lines-output.json
 * 用法: node scripts/collect-tags.js
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CLI = 'node node_modules/@cloudbase/cli/dist/standalone/cli.js'
const BATCH_SIZE = 200
const TOTAL = 1000

async function main() {
  const allTagged = []

  for (let start = 0; start < TOTAL; start += BATCH_SIZE) {
    console.log(`\n▶ 收集 ${start}-${Math.min(start + BATCH_SIZE, TOTAL)}`)
    const cmd = `${CLI} fn invoke petLines --params '{"action":"tagLines","startIndex":${start},"count":${BATCH_SIZE}}'`
    let output
    try {
      output = execSync(cmd, { encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024 })
    } catch (e) {
      console.error(`  失败: ${e.message}`)
      continue
    }

    // 提取 Return result 行（去除 ANSI 颜色码）
    const clean = output.replace(/\x1B\[[0-9;]*m/g, '')
    const match = clean.match(/Return result[：:]\s*(.+)/)
    if (!match) { console.error('  未找到 Return result'); console.error('  output (cleaned):', clean.slice(-500)); continue }

    try {
      const result = JSON.parse(match[1])
      if (result.success && Array.isArray(result.tagged)) {
        allTagged.push(...result.tagged)
        console.log(`  ✓ 收集 ${result.tagged.length} 条 (总计 ${allTagged.length})`)
      } else {
        console.error(`  返回失败: ${result.message}`)
      }
    } catch (e) {
      console.error(`  解析失败: ${e.message}`)
    }
  }

  // 排序并去重
  allTagged.sort((a, b) => a.index - b.index)
  const unique = []
  const seen = new Set()
  for (const item of allTagged) {
    if (!seen.has(item.index)) { seen.add(item.index); unique.push(item) }
  }

  // 合并到原数据
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'pet-lines-output.json'), 'utf8'))
  const allLines = [...data.lines.humor.map(t => ({ category: 'humor', text: t })), ...data.lines.literary.map(t => ({ category: 'literary', text: t }))]

  for (const tagged of unique) {
    if (tagged.index < allLines.length) {
      allLines[tagged.index].tags = tagged.tags
    }
  }

  // 统计
  const taggedCount = allLines.filter(l => l.tags?.length > 0).length
  const untaggedCount = allLines.length - taggedCount
  console.log(`\n=== 汇总 ===`)
  console.log(`  已标记: ${taggedCount}`)
  console.log(`  未标记: ${untaggedCount}`)
  console.log(`  标签分布:`)

  const tagFreq = {}
  allLines.forEach(l => (l.tags || []).forEach(t => tagFreq[t] = (tagFreq[t] || 0) + 1))
  Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log(`    ${tag}: ${count}`)
  })

  fs.writeFileSync(path.join(__dirname, 'pet-lines-output.json'), JSON.stringify({ ...data, lines: undefined, items: allLines, generatedAt: new Date().toISOString() }, null, 2), 'utf8')
  console.log(`\n  输出: pet-lines-output.json (${allLines.length} 条)`)
}

main().catch(e => { console.error(e); process.exit(1) })
