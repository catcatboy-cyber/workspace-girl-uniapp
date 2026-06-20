const cloudbase = require('@cloudbase/node-sdk')
const https = require('https')
const http = require('http')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const TIMEOUT_MS = 20000
const RATE_LIMIT_WINDOW_MS = 60000   // 1 分钟窗口
const RATE_LIMIT_MAX = 5             // 每窗口最多 5 次

// ========== AI helpers ==========

function resolveAvailableModels(settings) {
  const models = Array.isArray(settings?.aiModels) ? settings.aiModels : []
  return models.filter(m => m?.enabled !== false && m?.apiKey)
}

function aiHttpRequest(urlStr, body, timeoutMs, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const transport = u.protocol === 'http:' ? http : https
    const payload = JSON.stringify(body)
    const req = transport.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
      path: `${u.pathname}${u.search}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), Authorization: `Bearer ${apiKey}` }
    }, (res) => {
      resolve(res)
    })
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('TIMEOUT')) })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ========== 规则兜底 ==========

const RULE_FALLBACKS = {
  flirt: { intent: 50, risk: 45, analysis: '暧昧期的信号往往模糊。主动聊天但回避当面互动，可能是养鱼，也可能是对方本身社交节奏不同。建议观察对方是否愿意付出实质性行动，而不是只看聊天频率。', reply: '可以先顺着话题聊下去，但同时留一个明确的邀约钩子，看看对方是否愿意接。' },
  commit: { intent: 40, risk: 60, analysis: '承诺后不兑现或含糊其辞，是关系中的重要风险信号。真正的承诺会伴随时间、地点、行动，不是口头应承。建议降低期待值，观察行动而非话语。', reply: '可以先轻松回应，但心里记一笔：下次再出现类似情况，就需要直接沟通了。' },
  slow: { intent: 45, risk: 35, analysis: '慢热和不够喜欢有时很难区分。关键看对方是否愿意为你调整节奏，以及是否主动创造相处机会。真慢热的人在重要时刻会给出明确信号。', reply: '给彼此一点时间，但设定一个心理期限。过了期限还是模糊，就需要直接问清楚。' },
  cold: { intent: 30, risk: 55, analysis: '被拒绝后的冷处理需要区分：果断拒绝（不再联系）是明确信号，含糊推脱（最近很忙）可能是暂时的。关键是对方是否还在主动联系你。', reply: '不要连续追问。暂停几天，观察对方是否主动联系。如果一直没有消息，那就是答案。' },
  ex: { intent: 35, risk: 70, analysis: '前任突然联系，需要先分辨动机：是寂寞无聊、后悔回头、还是有具体问题需要解决。看对方是否带着解决问题的态度而来，还是有实际变化，而不是单纯的情绪波动。', reply: '不要立刻热情回应。保持礼貌但保持距离，先问清楚对方联系的原因，再做判断。' },
  online: { intent: 40, risk: 55, analysis: '网恋长期不见面是高风险信号。对方可能同时在聊多个人，也可能对方对现实见面有顾虑。建议尽快安排一次安全的线下见面，避免陷入纯文字的情感依赖。', reply: '可以试探性地提议一次安全、公开的线下见面。对方的反应会说明很多问题。' },
  action: { intent: 50, risk: 40, analysis: '说和做的差距是检验关系的核心标准。主动说下次约你但没有实际行动，可能是礼貌性敷衍，也可能是确实有事。关注对方在重要节点上的行为，而非日常聊天。', reply: '给对方一次机会，主动提一个具体的时间和活动。如果还是推脱，那就值得重新评估。' },
  general: { intent: 45, risk: 35, analysis: '关系信号的三个核心维度：主动性、回应度、兑现率。主动不等于真心，回应不等于承诺，兑现才是真正的信号。建议把注意力放在对方做了什么，而不是说了什么。', reply: '根据对方的具体表现，选择轻松自然地推进，或者暂时保持观察。' }
}

// ========== 频控（内存实现，不依赖数据库集合） ==========

const rateLimitStore = {} // { key: [timestamp, ...] }

function checkRateLimit(key) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  if (!rateLimitStore[key]) rateLimitStore[key] = []
  rateLimitStore[key] = rateLimitStore[key].filter(ts => ts > windowStart)
  return rateLimitStore[key].length < RATE_LIMIT_MAX
}

function recordRateLimit(key) {
  if (!rateLimitStore[key]) rateLimitStore[key] = []
  rateLimitStore[key].push(Date.now())
}

// ========== 主函数 ==========

exports.main = async (event = {}) => {
  const text = String(event.text || event.content || '').trim()
  const scene = String(event.scene || 'general').trim()

  if (!text || text.length < 2) {
    return { success: false, message: '请至少输入 2 个字' }
  }
  if (text.length > 600) {
    return { success: false, message: '输入内容过长，请控制在 600 字以内' }
  }

  // 获取 openid（微信环境）
  let openid = ''
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
    const ctx = cloud.getWXContext()
    openid = ctx.OPENID || ''
  } catch {}

  // 频控
  const rateKey = openid || (event.ip || 'anonymous')
  if (!checkRateLimit(rateKey)) {
    return { success: false, message: '操作太频繁，请 1 分钟后再试', code: 'RATE_LIMITED' }
  }

  // 获取 AI 配置（兜底：配置不可用时直接走规则）
  let models = []
  try {
    const settingsRes = await db.collection('system_settings').where({ scope: 'global', key: 'ai' }).limit(1).get()
    const settings = settingsRes?.data?.[0]
    models = resolveAvailableModels(settings || {})
  } catch (e) {
    console.warn('[quickRead] db error:', e?.message || e)
  }
  const fallback = RULE_FALLBACKS[scene] || RULE_FALLBACKS.general

  if (models.length === 0) {
    recordRateLimit(rateKey)
    return { success: true, ...fallback, source: 'rules' }
  }

  const scenePrompts = {
    flirt: '暧昧期，对方主动聊天但不约见面。判断是暧昧还是有其他意图。',
    commit: '对方做了承诺但未兑现或回避具体时间。判断承诺的真假。',
    slow: '判断对方是真慢热还是不够喜欢。',
    cold: '对方在冷淡/回避/拒绝。判断是果断拒绝还是暂时回避。',
    ex: '前任突然联系。判断是真心回头还是临时无聊。',
    online: '网恋长期未见面。判断对方是否靠谱。',
    action: '关注对方是否将说辞变成行动。',
    general: '综合判断这句话中的关系信号和意图。'
  }

  // 尝试 AI
  for (const model of models) {
    try {
      const baseUrl = (model.baseUrl || '').replace(/\/+$/, '')
      const messages = [
        { role: 'system', content: `你是恋爱信号分析助手。分析对方的一句话，给意向、风险、解读和建议回复。

回复 JSON（不包含 markdown 代码块）：
{
  "intentScore": 数字0-100（主动意向程度）,
  "riskScore": 数字0-100（风险/回避程度）,
  "analysis": "解读分析（60-120字）",
  "replySuggestion": "建议回复（15-40字）"
}
场景：${scenePrompts[scene] || scenePrompts.general}` },
        { role: 'user', content: `对方说：「${text.slice(0, 300)}」` }
      ]

      const url = `${baseUrl}/v1/chat/completions`
      const res = await aiHttpRequest(url, { model: model.model, messages, temperature: 0.6, max_tokens: 300 }, TIMEOUT_MS, model.apiKey)
      if (!res || res.status === 404) continue
      if (res.status !== 200) {
        const errBody = await res.text?.().catch(() => '')
        console.warn(`[quickRead] AI ${model.id} returned ${res.status}: ${errBody.slice(0, 100)}`)
        continue
      }
      const data = await res.json()
      const raw = (data?.choices?.[0]?.message?.content || '').trim()
      let parsed
      try {
        parsed = JSON.parse(raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '').trim())
      } catch {
        parsed = {}
      }

      const result = {
        success: true,
        intentScore: Math.max(0, Math.min(100, Math.round(Number(parsed.intentScore) || fallback.intent))),
        riskScore: Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore) || fallback.risk))),
        analysis: String(parsed.analysis || '').trim().slice(0, 300) || fallback.analysis,
        replySuggestion: String(parsed.replySuggestion || '').trim().slice(0, 100) || fallback.reply,
        source: 'ai',
        scene
      }

      recordRateLimit(rateKey)
      return result
    } catch (e) {
      console.warn(`[quickRead] AI ${model.id} error:`, e?.message || e)
    }
  }

  // 全失败，规则兜底
  recordRateLimit(rateKey)
  return { success: true, ...fallback, source: 'rules_fallback' }
}
