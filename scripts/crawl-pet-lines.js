/**
 * 爬取恋爱话术数据 — 扩库版
 *   lovelive API (plain + JSON) → humor (幽默/土味情话)
 *   Hitokoto API (i/d/j/h)       → literary (文艺/诗词/情感)
 *
 * 用法: node scripts/crawl-pet-lines.js
 * 输出: scripts/pet-lines-output.json (追加到已有数据)
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const OUTPUT_FILE = path.join(__dirname, 'pet-lines-output.json')
const TARGET_TOTAL = 1000          // 每个分类目标总数
const CONCURRENCY = 6
const REQUEST_DELAY_MS = 150
const MAX_RETRIES = 3

// ========== 加载已有数据用于去重 ==========

let existingKeys = new Set()
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    const items = existing.items || []
    items.forEach(item => {
      const key = normalize(item.text)
      if (key.length >= 4) existingKeys.add(key)
    })
    console.log(`已加载 ${existingKeys.size} 条已有数据用于去重`)
  } catch (e) { console.log('加载已有数据失败，从头开始') }
}

function normalize(text) {
  return String(text || '')
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[，,。！？!?…\.\-\—\~～、；;：:（）()【】\[\]《》<>"'"''""]/g, '')
    .trim()
    .slice(0, 60)
}

// ========== 数据源 ==========

const SOURCES = {
  humor: {
    name: 'lovelive',
    label: '幽默',
    urls: [
      { url: 'https://api.lovelive.tools/api/SweetNothings', parse: (body) => String(body || '').trim() },
      { url: 'https://api.lovelive.tools/api/SweetNothings/Serialization/Json', parse: (body) => {
        try {
          const data = JSON.parse(body)
          const arr = data?.returnObj
          if (Array.isArray(arr)) return arr.map(s => String(s || '').trim()).filter(Boolean)
          if (typeof arr === 'string') return arr.trim()
        } catch {}
        return ''
      }},
    ]
  },
  literary: {
    name: 'hitokoto',
    label: '文艺',
    urls: [
      'https://v1.hitokoto.cn/?c=i&encode=json',   // 诗词
      'https://v1.hitokoto.cn/?c=d&encode=json',   // 文学
      'https://v1.hitokoto.cn/?c=j&encode=json',   // 网易云
      'https://v1.hitokoto.cn/?c=h&encode=json',   // 影视
    ].map(u => ({ url: u, parse: parseHitokoto }))
  }
}

function parseHitokoto(body) {
  try {
    const data = JSON.parse(body)
    return (data.hitokoto || '').trim()
  } catch {
    return String(body || '').trim()
  }
}

// ========== 工具函数 ==========

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')) })
  })
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try { return await httpGet(url) }
    catch (err) { if (i === retries - 1) throw err; await sleep(500 * (i + 1)) }
  }
}

// ========== 核心逻辑 ==========

async function crawlSource(category, source, existingCount) {
  const lines = new Map() // key -> text
  let urlIndex = 0
  const need = Math.max(0, TARGET_TOTAL - existingCount)

  console.log(`  [${source.label}] 已有 ${existingCount} 条, 需新增 ${need} 条, 并发 ${CONCURRENCY}`)

  while (lines.size < need) {
    const batch = []
    const batchStart = lines.size

    for (let i = 0; i < CONCURRENCY && lines.size < need; i++) {
      const endpoint = source.urls[urlIndex % source.urls.length]
      urlIndex++
      batch.push(
        fetchWithRetry(endpoint.url)
          .then((body) => {
            const result = endpoint.parse(body)
            const texts = Array.isArray(result) ? result : [result]
            for (const text of texts) {
              if (!text) continue
              const key = normalize(text)
              if (key && key.length >= 4 && !existingKeys.has(key) && !lines.has(key)) {
                lines.set(key, text)
                existingKeys.add(key)  // 实时加入去重池
              }
            }
          })
          .catch((err) => {
            if (lines.size < 10) console.error(`    fetch error: ${err.message}`)
          })
      )
    }

    await Promise.all(batch)
    const added = lines.size - batchStart

    if (lines.size % 100 < CONCURRENCY || added === 0) {
      console.log(`  [${source.label}] 已收集 ${lines.size} 条 (本批 +${added})`)
    }

    if (added === 0) await sleep(1000)
    else await sleep(REQUEST_DELAY_MS)
  }

  console.log(`  [${source.label}] 完成: ${lines.size} 条`)
  return Array.from(lines.values())
}

// ========== 关键词补标 ==========

function supplementTags(items) {
  const keywordMap = {
    '吃饭': ['吃饭','晚饭','午饭','早餐','夜宵','火锅','烧烤','下馆子','干饭','开饭','喝粥','煮面','吃面','炒菜','喝汤','甜点','好吃','胃口','馋','零食','美味','奶茶'],
    '约会': ['约会','看电影','散步','逛街','海边','旅行','一起去看','出来见面','陪我','跟你去','和你去','见你','来找我','出去逛','一起去','游玩','游乐园'],
    '下雨': ['下雨','淋雨','雨天','雨伞','躲雨','打伞','淋湿','暴风雨','台风'],
    '关心': ['多穿','保暖','感冒','照顾好','保重','身体','累了','辛苦','心疼你','别太累','注意休息'],
    '道歉': ['对不起','抱歉','原谅','我错了','不好意思','道歉'],
    '生气': ['生气了','烦死了','讨厌你','不想理','无语','气死','不爽','懒得理','滚'],
    '早安': ['早安','早上好','早晨','天亮','清晨'],
    '晚安': ['晚安','早点睡','困了','睡了','好梦','安啦'],
  }

  let added = 0
  items.forEach(item => {
    const text = item.text
    for (const [tag, keywords] of Object.entries(keywordMap)) {
      if (!item.tags.includes(tag) && keywords.some(kw => text.includes(kw))) {
        item.tags.push(tag)
        added++
      }
    }
  })
  console.log(`  关键词补标: +${added} 个标签`)
  return items
}

// ========== AI 批量打标（新条目） ==========

// AI 打标通过 petLines tagLines 云函数完成，这里只标记需要打标的条目

// ========== main ==========

async function main() {
  console.log('=== 宠物话术数据爬取（扩库版） ===\n')

  // 加载已有数据
  let existingItems = []
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
      existingItems = existing.items || []
      console.log(`已有 ${existingItems.length} 条数据`)
    } catch (e) {}
  }

  const results = {}
  const totalStart = Date.now()

  for (const [category, source] of Object.entries(SOURCES)) {
    const existingCount = existingItems.filter(i => i.category === category).length
    console.log(`\n▶ 开始爬取: ${source.label}类 (${source.name})`)
    const startTime = Date.now()
    const texts = await crawlSource(category, source, existingCount)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    results[category] = texts
    console.log(`  ✓ ${source.label}类完成: ${texts.length} 条新增, 耗时 ${elapsed}s`)
  }

  // 合并：已有数据 + 新数据
  const existingHumor = existingItems.filter(i => i.category === 'humor')
  const existingLiterary = existingItems.filter(i => i.category === 'literary')

  const newHumor = results.humor.map(text => ({ category: 'humor', text, tags: [] }))
  const newLiterary = results.literary.map(text => ({ category: 'literary', text, tags: [] }))

  const allHumor = [...existingHumor, ...newHumor]
  const allLiterary = [...existingLiterary, ...newLiterary]

  console.log(`\n幽默: ${existingHumor.length} 已有 + ${newHumor.length} 新增 = ${allHumor.length}`)
  console.log(`文艺: ${existingLiterary.length} 已有 + ${newLiterary.length} 新增 = ${allLiterary.length}`)

  const allItems = [...allHumor, ...allLiterary]

  // 关键词补标（只对新条目）
  const untagged = allItems.filter(i => !i.tags || i.tags.length === 0)
  console.log(`\n未打标条目: ${untagged.length}`)
  if (untagged.length > 0) {
    supplementTags(untagged)
  }

  // 统计
  const taggedCount = allItems.filter(i => i.tags && i.tags.length > 0).length
  console.log(`已打标: ${taggedCount}/${allItems.length}`)

  // 输出
  const output = {
    generatedAt: new Date().toISOString(),
    sources: {
      humor: { api: 'api.lovelive.tools (plain + JSON)', count: allHumor.length },
      literary: { api: 'v1.hitokoto.cn (i=诗词 + d=文学 + j=网易云 + h=影视)', count: allLiterary.length }
    },
    total: allItems.length,
    items: allItems
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8')

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
  console.log(`\n=== 完成 (总耗时 ${totalElapsed}s) ===`)
  console.log(`  幽默: ${allHumor.length} 条`)
  console.log(`  文艺: ${allLiterary.length} 条`)
  console.log(`  总计: ${allItems.length} 条`)
  console.log(`  输出: ${OUTPUT_FILE}`)

  if (untagged.length > 0) {
    console.log(`\n⚠ ${untagged.length} 条新条目未打标，需要运行 tagLines 补标`)
  }
}

main().catch((err) => {
  console.error('爬取出错:', err)
  process.exit(1)
})
