const cloudbase = require('@cloudbase/node-sdk')
const https = require('https')
const http = require('http')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { checkFeatureAccess, checkTokenBalance } = require('./_shared/subscription')
const { recordTokenUsage } = require('./_shared/token-usage')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const TIMEOUT_MS = 20000
const RATE_LIMIT_WINDOW_MS = 60000   // 1 分钟窗口
const RATE_LIMIT_MAX = 5             // 每窗口最多 5 次
const QUICK_READ_FEATURE = '即时反馈'
const QUICK_READ_USAGE_FEATURE = 'quickRead'
const QUICK_READ_EST_TOKENS = 800

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
      const chunks = []
      res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(text),
          json: () => Promise.resolve(JSON.parse(text))
        })
      })
    })
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('TIMEOUT')) })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ========== 规则兜底 ==========

const RULE_FALLBACKS = {
  chat_reply: { intent: 48, risk: 42, evidence: 'E2', labels: ['证据不足'], analysis: '单条回复只能看出一部分信号。重点不是某句话甜不甜，而是对方有没有主动延续、追问和把聊天推进到更具体的安排。', reply: '可以轻松接住话题，再抛一个具体但低压力的问题，看对方会不会继续。' },
  date_progress: { intent: 56, risk: 38, evidence: 'E3', labels: [], analysis: '涉及约见推进时，最关键的是具体时间、地点和对方是否主动协调。如果对方愿意把模糊想法变成安排，通常比单纯聊天更有参考价值。', reply: '可以顺势给一个具体时间选项，看看对方是否接得住。' },
  hot_cold: { intent: 48, risk: 66, evidence: 'E3', labels: ['节奏明显不稳定'], analysis: '忽冷忽热说明关系热度还不稳定。热的时候不能直接当作确定喜欢，冷的时候也不一定立刻判死刑，重点看后续是否能连续稳定。', reply: '先别追问太满，放慢一点，看对方会不会主动补解释或补行动。' },
  ex_contact: { intent: 35, risk: 70, evidence: 'E3', labels: ['关键问题难验证'], analysis: '前任重新出现时，动机比话术更重要。需要看对方是否带着清楚目的、实际变化和尊重边界，而不是只靠情绪回潮。', reply: '先礼貌但保持距离，问清楚对方这次联系的原因。' },
  after_meet: { intent: 54, risk: 45, evidence: 'E3', labels: [], analysis: '见面后的变化比见面当天更能说明问题。重点看对方是否继续主动联系、是否提下一次，以及态度有没有比见面前更明确。', reply: '可以轻松提到见面里的一个细节，看对方是否愿意延续。' },
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

function buildQuickReadUsage(usage, fallbackTokens = QUICK_READ_EST_TOKENS) {
  const promptTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0)
  const completionTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0)
  const totalTokens = Number(usage?.total_tokens ?? (promptTokens + completionTokens))
  const safeTotal = Number.isFinite(totalTokens) && totalTokens > 0 ? Math.round(totalTokens) : Math.round(fallbackTokens)
  const safePrompt = Number.isFinite(promptTokens) && promptTokens > 0 ? Math.round(promptTokens) : Math.round(safeTotal * 0.7)
  const safeCompletion = Number.isFinite(completionTokens) && completionTokens > 0 ? Math.round(completionTokens) : Math.max(0, safeTotal - safePrompt)
  return {
    prompt_tokens: safePrompt,
    completion_tokens: safeCompletion,
    total_tokens: safeTotal
  }
}

async function checkQuickReadAccess(userId) {
  const access = await checkFeatureAccess(db, userId, QUICK_READ_FEATURE)
  if (!access.allowed) {
    return { ok: false, code: 'FEATURE_NOT_AVAILABLE', message: access.reason || '当前套餐不支持此功能' }
  }

  const tokenCheck = await checkTokenBalance(db, userId, QUICK_READ_EST_TOKENS)
  if (!tokenCheck.ok) {
    return {
      ok: false,
      code: tokenCheck.code || 'TOKEN_INSUFFICIENT',
      message: tokenCheck.message || 'Token 余额不足',
      ...tokenCheck
    }
  }

  return { ok: true }
}

function buildFallbackResult(fallback, scene, question, source) {
  const tailored = tailorFallbackToQuestion(fallback, question)
  return {
    success: true,
    intentScore: fallback.intent,
    riskScore: fallback.risk,
    consistencyRiskScore: fallback.risk,
    evidenceLevel: fallback.evidence || 'E2',
    primaryLabels: fallback.labels || [],
    directAnswer: tailored.directAnswer,
    analysis: tailored.analysis,
    nextAction: tailored.nextAction,
    replySuggestion: tailored.replySuggestion,
    source,
    scene,
    question
  }
}

function tailorFallbackToQuestion(fallback, question) {
  const q = String(question || '').trim()
  if (q.includes('养鱼')) {
    const risk = Number(fallback.risk || 0)
    const directAnswer = risk >= 60
      ? '有养鱼或低成本暧昧风险，但还不能只凭这一条定性。'
      : '暂时不像明确养鱼，更像信号还不够稳定。'
    return {
      directAnswer,
      analysis: `${directAnswer}${fallback.analysis}`,
      nextAction: risk >= 60 ? '先别继续加码，观察对方是否愿意给明确安排和兑现行动。' : fallback.reply,
      replySuggestion: risk >= 60 ? '可以回得轻一点，把球抛给对方：那你定个具体时间？' : fallback.reply
    }
  }
  if (q.includes('喜欢')) {
    const intent = Number(fallback.intent || 0)
    const directAnswer = intent >= 60 ? '有好感信号，但还要看能不能持续兑现。' : intent >= 45 ? '有一点兴趣，但还没到能确认喜欢。' : '目前喜欢信号偏弱。'
    return { directAnswer, analysis: `${directAnswer}${fallback.analysis}`, nextAction: fallback.reply, replySuggestion: fallback.reply }
  }
  if (q.includes('主动')) {
    const risk = Number(fallback.risk || 0)
    const directAnswer = risk >= 60 ? '不建议继续强主动，先降一点投入。' : '可以低压力主动一次，但不要连续追。'
    return {
      directAnswer,
      analysis: `${directAnswer}${fallback.analysis}`,
      nextAction: risk >= 60 ? '暂停追问，等对方下一次主动或明确解释。' : fallback.reply,
      replySuggestion: risk >= 60 ? '先不追问，保持轻松回应即可。' : fallback.reply
    }
  }
  if (q.includes('回复')) {
    return {
      directAnswer: `可以这样回：${fallback.reply}`,
      analysis: fallback.analysis,
      nextAction: fallback.reply,
      replySuggestion: fallback.reply
    }
  }
  return {
    directAnswer: '这条信息只能做初步判断，重点看后续行动是否跟上。',
    analysis: fallback.analysis,
    nextAction: fallback.reply,
    replySuggestion: fallback.reply
  }
}

function inferSceneFromText(text, question) {
  const source = `${String(text || '')}\n${String(question || '')}`.toLowerCase()
  const normalized = source
    .replace(/\s+/g, '')
    .replace(/[，。！？、,.!?;；:："'`~()\[\]{}<>《》【】]/g, '')

  if (
    normalized.includes('前任') ||
    normalized.includes('复合') ||
    normalized.includes('回头') ||
    normalized.includes('旧情') ||
    normalized.includes('前女友') ||
    normalized.includes('前男友')
  ) return 'ex_contact'

  if (
    normalized.includes('忽冷忽热') ||
    normalized.includes('时冷时热') ||
    normalized.includes('一下热情一下冷淡') ||
    normalized.includes('突然冷淡') ||
    normalized.includes('突然热情') ||
    normalized.includes('爱回不回') ||
    normalized.includes('断联') ||
    normalized.includes('消失')
  ) return 'hot_cold'

  if (
    normalized.includes('见面后') ||
    normalized.includes('约会后') ||
    normalized.includes('吃饭后') ||
    normalized.includes('看完电影') ||
    normalized.includes('分别后') ||
    normalized.includes('聊完以后') ||
    normalized.includes('见过面')
  ) return 'after_meet'

  if (
    normalized.includes('下次约') ||
    normalized.includes('什么时候见') ||
    normalized.includes('要不要见面') ||
    normalized.includes('出来吗') ||
    normalized.includes('改天约') ||
    normalized.includes('周末约') ||
    normalized.includes('定时间') ||
    normalized.includes('订位') ||
    normalized.includes('见面')
  ) return 'date_progress'

  if (
    normalized.includes('回复') ||
    normalized.includes('回我') ||
    normalized.includes('怎么回') ||
    normalized.includes('发消息') ||
    normalized.includes('聊天')
  ) return 'chat_reply'

  return 'general'
}

// ========== 主函数 ==========

exports.main = async (event = {}) => {
  const text = String(event.text || event.content || '').trim()
  const question = String(event.question || '').trim()
  const ageRange = String(event.ageRange || '').trim()
  const providedScene = String(event.scene || '').trim()
  const scene = providedScene || inferSceneFromText(text, question)

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
    return buildFallbackResult(fallback, scene, question, 'rules')
  }

  let userId = ''
  try {
    userId = await requireAuthenticatedUserId(app, event)
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    throw error
  }

  const accessCheck = await checkQuickReadAccess(userId)
  if (!accessCheck.ok) {
    return {
      success: false,
      code: accessCheck.code,
      message: accessCheck.message,
      ...accessCheck
    }
  }

  const scenePrompts = {
    chat_reply: '聊天回复场景。判断对方回复是升温、敷衍、试探还是回避。',
    date_progress: '约见推进场景。判断对方是否愿意把暧昧变成具体安排。',
    hot_cold: '忽冷忽热场景。判断热度波动背后的风险和下一步观察重点。',
    ex_contact: '前任暧昧/前任联系场景。判断动机、边界和风险。',
    after_meet: '见面后变化场景。判断见面后是否升温、降温或观望。',
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
        { role: 'system', content: `你是恋爱信号分析助手。只根据用户提供的事实判断关系信号，不要编造对方情绪、身份或承诺。分析一条暧昧/恋爱初期事件，给意向、风险、证据、标签、解读和建议回复。
${ageRange === 'under18' ? '用户未满18岁：只允许友谊、边界、安全感和健康沟通建议，不要生成暧昧升级或亲密试探建议。' : ''}

回复 JSON（不包含 markdown 代码块）：
{
  "directAnswer": "必须先直接回答用户选择的问题，20-45字。不要绕开问题。",
  "intentScore": 数字0-100（主动意向程度）,
  "riskScore": 数字0-100（风险/回避程度）,
  "evidenceLevel": "E1|E2|E3|E4|E5",
  "primaryLabels": ["证据不足|口头热情，行动不足|节奏明显不稳定|关键问题难验证|单向投入"] 中的0-2个,
  "analysis": "解读分析（60-120字）",
  "nextAction": "下一步建议（20-60字）",
  "replySuggestion": "建议回复（15-40字）"
}
场景：${scenePrompts[scene] || scenePrompts.general}
用户最想知道：${question || '想判断TA是什么意思'}
要求：
1. directAnswer 必须正面回答“${question || 'TA是什么意思'}”，不要写成通用恋爱建议。
2. 如果用户问“他是不是养鱼”，必须明确说“有养鱼风险/暂时不像养鱼/证据不足不能定性”，并解释依据。
3. 如果用户问“怎么回复”，replySuggestion 必须给可以直接发出去的一句话。
4. analysis 第一段继续解释依据，但不要重复 directAnswer。` },
        { role: 'user', content: `用户困惑：${question || '想判断TA是什么意思'}\n事实描述：「${text.slice(0, 500)}」` }
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
        consistencyRiskScore: Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore) || fallback.risk))),
        evidenceLevel: ['E1', 'E2', 'E3', 'E4', 'E5'].includes(parsed.evidenceLevel) ? parsed.evidenceLevel : (fallback.evidence || 'E2'),
        primaryLabels: Array.isArray(parsed.primaryLabels) ? parsed.primaryLabels.map(String).slice(0, 2) : (fallback.labels || []),
        directAnswer: String(parsed.directAnswer || '').trim().slice(0, 120) || tailorFallbackToQuestion(fallback, question).directAnswer,
        analysis: String(parsed.analysis || '').trim().slice(0, 300) || fallback.analysis,
        nextAction: String(parsed.nextAction || '').trim().slice(0, 120) || fallback.reply,
        replySuggestion: String(parsed.replySuggestion || '').trim().slice(0, 100) || fallback.reply,
        source: 'ai',
        scene,
        question
      }

      await recordTokenUsage(db, {
        userId,
        feature: QUICK_READ_USAGE_FEATURE,
        provider: 'openai-compatible',
        model: model.model || model.id || '',
        usage: buildQuickReadUsage(data?.usage)
      })

      recordRateLimit(rateKey)
      return result
    } catch (e) {
      console.warn(`[quickRead] AI ${model.id} error:`, e?.message || e)
    }
  }

  // 全失败，规则兜底
  recordRateLimit(rateKey)
  return buildFallbackResult(fallback, scene, question, 'rules_fallback')
}
