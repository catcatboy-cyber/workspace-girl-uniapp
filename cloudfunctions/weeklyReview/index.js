const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./_shared/ai-http')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'
const REVIEW_COLLECTION = 'weekly_reviews'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseWeekStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getCurrentWeekStart(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS)
  const day = local.getUTCDay() || 7
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - (day - 1) * MS_PER_DAY - TZ_OFFSET_MS)
}

function getWeekRange(weekStartValue) {
  const start = parseWeekStart(weekStartValue) || getCurrentWeekStart()
  const end = new Date(start.getTime() + 7 * MS_PER_DAY)
  return {
    start,
    end,
    weekStart: dateKey(new Date(start.getTime() + TZ_OFFSET_MS)),
    weekEnd: dateKey(new Date(end.getTime() - 1 + TZ_OFFSET_MS))
  }
}

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

async function ensureReviewCollection() {
  try {
    await db.createCollection(REVIEW_COLLECTION)
  } catch (error) {
    const message = String(error?.message || '')
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      console.warn('ensure weekly_reviews collection failed:', error)
    }
  }
}

function normalizeSettings(settings) {
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const defaultModel = settings.aiModels.find((m) => m.id === defaultId) || settings.aiModels[0] || {}
    const provider = typeof defaultModel.provider === 'string' && defaultModel.provider.trim()
      ? defaultModel.provider.trim()
      : 'openai-compatible'
    return {
      enabled: Boolean(settings.aiEnabled),
      provider,
      apiKey: typeof defaultModel.apiKey === 'string' ? defaultModel.apiKey.trim() : '',
      baseUrl: typeof defaultModel.baseUrl === 'string' && defaultModel.baseUrl.trim()
        ? defaultModel.baseUrl.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'https://api.anthropic.com'
          : 'https://api.openai.com/v1',
      model: typeof defaultModel.model === 'string' && defaultModel.model.trim()
        ? defaultModel.model.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'claude-3-5-sonnet-20241022'
          : 'gpt-4o-mini',
      fallbackToRules: settings.aiFallbackToRules !== false
    }
  }

  const provider = typeof settings?.aiProvider === 'string' && settings.aiProvider.trim()
    ? settings.aiProvider.trim()
    : 'openai-compatible'
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider,
    apiKey: typeof settings?.aiApiKey === 'string' ? settings.aiApiKey.trim() : '',
    baseUrl: typeof settings?.aiBaseUrl === 'string' && settings.aiBaseUrl.trim()
      ? settings.aiBaseUrl.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'https://api.anthropic.com'
        : 'https://api.openai.com/v1',
    model: typeof settings?.aiModel === 'string' && settings.aiModel.trim()
      ? settings.aiModel.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'claude-3-5-sonnet-20241022'
        : 'gpt-4o-mini',
    fallbackToRules: settings?.aiFallbackToRules !== false
  }
}

async function getAISettings(userId) {
  const globalDocRes = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  let rawSettings = normalizeDoc(globalDocRes)

  if (!rawSettings) {
    const globalScopeRes = await db.collection('system_settings')
      .where({ scope: 'global', key: 'ai' })
      .limit(1)
      .get()
    rawSettings = globalScopeRes.data && globalScopeRes.data.length > 0 ? globalScopeRes.data[0] : null
  }

  if (!rawSettings) {
    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()
    rawSettings = data && data.length > 0 ? data[0] : null
  }

  return normalizeSettings(rawSettings)
}

function timestamp(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function inRange(item, field, start, end) {
  const time = timestamp(item?.[field])
  return time >= start.getTime() && time < end.getTime()
}

function pickPreviousAssessment(assessments, start) {
  return assessments
    .filter((item) => timestamp(item.createdAt) < start.getTime())
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))[0] || null
}

function compareAssessments(previous, current) {
  if (!current) {
    return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat' }
  }

  if (!previous) {
    return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat' }
  }

  const intentDelta = (current.intentScore || 0) - (previous.intentScore || 0)
  const riskDelta = (current.consistencyRiskScore || 0) - (previous.consistencyRiskScore || 0)
  return {
    intentDelta,
    riskDelta,
    intentDirection: intentDelta > 0 ? 'up' : intentDelta < 0 ? 'down' : 'flat',
    riskDirection: riskDelta > 0 ? 'up' : riskDelta < 0 ? 'down' : 'flat'
  }
}

function classifyTrend(intentDelta, riskDelta) {
  if (riskDelta >= 10) return '风险抬头'
  if (intentDelta >= 8 && riskDelta <= 3) return '升温'
  if (intentDelta <= -8) return '降温'
  if (Math.abs(intentDelta) >= 6 || Math.abs(riskDelta) >= 6) return '有波动'
  return '基本持平'
}

function compactEvent(item) {
  return {
    id: item._id || item.id,
    title: item.title || '关系记录',
    type: item.type || 'note',
    date: item.dateLabel || item.date || item.occurrenceAt || item.createdAt,
    description: String(item.description || '').slice(0, 220),
    aiUsed: Boolean(item.aiUsed)
  }
}

function compactAssessment(item) {
  return {
    id: item._id || item.assessmentId,
    createdAt: item.createdAt,
    source: item.source,
    triggerEventTitle: item.triggerEventTitle,
    intentScore: item.intentScore,
    riskScore: item.consistencyRiskScore,
    evidenceLevel: item.evidenceLevel,
    confidenceLevel: item.confidenceLevel,
    headline: item.explanation?.headline
  }
}

function fallbackReview(params) {
  const { caseDoc, weekStart, weekEnd, weekEvents, weekAssessments, previousAssessment, latestAssessment } = params
  const trend = compareAssessments(previousAssessment, latestAssessment)
  const trendLabel = classifyTrend(trend.intentDelta, trend.riskDelta)
  const keyEvents = weekEvents.slice(0, 4).map((item) => item.title || item.description || '关系记录')

  const summary = weekEvents.length === 0
    ? '本周还没有新增事件。现在不适合靠单次感受下结论，可以等下一次真实互动出现后再复盘。'
    : trend.riskDelta >= 10
      ? '本周风险分有明显抬头，重点不是继续猜测对方态度，而是回看是否出现了回避、拖延、失约或说法变化。'
      : trend.intentDelta >= 8 && trend.riskDelta <= 3
        ? '本周意向信号有所增强，但仍建议观察这种推进是否会持续落地，而不是只看一次热度。'
        : '本周关系有新变化，但还没有形成足够强的单向结论，适合继续积累连续证据。'

  return {
    title: `${caseDoc.name || '当前对象'} · 本周复盘`,
    trendLabel,
    summary,
    keyChanges: [
      `本周新增 ${weekEvents.length} 条真实事件。`,
      `本周产生 ${weekAssessments.length} 次评估变化。`,
      `意向变化 ${trend.intentDelta > 0 ? '+' : ''}${trend.intentDelta}，风险变化 ${trend.riskDelta > 0 ? '+' : ''}${trend.riskDelta}。`
    ],
    keyEvents: keyEvents.length > 0 ? keyEvents : ['本周暂无新增关键事件。'],
    nextWeekFocus: [
      '观察对方是否主动推进，而不是只看聊天氛围。',
      '关注答应过的事情是否兑现。',
      '如果出现含糊或拖延，优先记录事实，不急着脑补原因。'
    ],
    avoidMisread: [
      '不要把单次热情直接等同于长期投入。',
      '不要把一次冷淡直接等同于关系结束。',
      '优先看连续行为，而不是单条消息。'
    ],
    aiUsed: false
  }
}

async function buildAIReview(params) {
  const settings = await getAISettings(params.userId)
  if (!settings.enabled || !settings.apiKey) return fallbackReview(params)

  const fallback = fallbackReview(params)
  const prompt = [
    '你是关系周复盘助手。你的任务不是替用户裁决感情真假，而是帮助用户从一周维度看清事实、趋势和下周该观察什么。',
    '请根据本周事件、本周评估变化、周初/周末分数，输出 JSON，不要 markdown。',
    '语气要冷静、具体、克制，适合给情绪困惑中的用户看。',
    '不要鼓励冲动表白、纠缠、测试、控制或过度解读。强调连续行为和事实证据。',
    'JSON 字段：title, trendLabel, summary, keyChanges, keyEvents, nextWeekFocus, avoidMisread。',
    'trendLabel 从以下选择：升温、降温、有波动、风险抬头、基本持平。',
    'summary 是 1 段中文，keyChanges/keyEvents/nextWeekFocus/avoidMisread 都是中文数组，每个数组 2-4 条。',
    `对象：${params.caseDoc.name}`,
    `复盘周：${params.weekStart} 至 ${params.weekEnd}`,
    `分数变化：${JSON.stringify(params.scoreTrend)}`,
    `本周事件：${JSON.stringify(params.weekEvents.map(compactEvent).slice(0, 12))}`,
    `本周评估：${JSON.stringify(params.weekAssessments.map(compactAssessment).slice(0, 8))}`
  ].join('\n')

  try {
    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是严谨、克制的关系周复盘助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.25,
      maxTokens: 900
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = parseJSONContent(raw)
    return {
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      trendLabel: typeof parsed.trendLabel === 'string' ? parsed.trendLabel : fallback.trendLabel,
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      keyChanges: Array.isArray(parsed.keyChanges) ? parsed.keyChanges.map(String).slice(0, 4) : fallback.keyChanges,
      keyEvents: Array.isArray(parsed.keyEvents) ? parsed.keyEvents.map(String).slice(0, 4) : fallback.keyEvents,
      nextWeekFocus: Array.isArray(parsed.nextWeekFocus) ? parsed.nextWeekFocus.map(String).slice(0, 4) : fallback.nextWeekFocus,
      avoidMisread: Array.isArray(parsed.avoidMisread) ? parsed.avoidMisread.map(String).slice(0, 4) : fallback.avoidMisread,
      aiUsed: true
    }
  } catch (error) {
    console.error('[weeklyReview AI failed]', getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS))
    return fallback
  }
}

async function getReviews(caseId) {
  await ensureReviewCollection()
  const { data } = await db.collection(REVIEW_COLLECTION)
    .where({ caseId })
    .orderBy('weekStart', 'desc')
    .limit(20)
    .get()
  return data || []
}

async function generateReview(params) {
  await ensureReviewCollection()
  const { caseDoc, caseId, userId, weekStart } = params
  const range = getWeekRange(weekStart)

  const timelineRes = await db.collection('timeline_records')
    .where({ caseId })
    .orderBy('occurrenceAt', 'desc')
    .get()

  const assessmentsRes = await db.collection('assessments')
    .where({ caseId })
    .orderBy('createdAt', 'asc')
    .get()

  const allTimeline = timelineRes.data || []
  const allAssessments = assessmentsRes.data || []
  const weekEvents = allTimeline
    .filter((item) => !['assessment', 'trend'].includes(item.type))
    .filter((item) => inRange(item, 'occurrenceAt', range.start, range.end))
  const weekAssessments = allAssessments.filter((item) => inRange(item, 'createdAt', range.start, range.end))
  const previousAssessment = pickPreviousAssessment(allAssessments, range.start)
  const latestAssessment = weekAssessments[weekAssessments.length - 1] || previousAssessment || allAssessments[allAssessments.length - 1] || null
  const scoreTrend = compareAssessments(previousAssessment, latestAssessment)

  const aiReview = await buildAIReview({
    userId,
    caseDoc,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    weekEvents,
    weekAssessments,
    previousAssessment,
    latestAssessment,
    scoreTrend
  })

  const now = new Date()
  const reviewId = `weekly_${caseId}_${range.weekStart}`
  const review = {
    userId,
    caseId,
    caseName: caseDoc.name || '',
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    generatedAt: now,
    updatedAt: now,
    eventCount: weekEvents.length,
    assessmentCount: weekAssessments.length,
    intentDelta: scoreTrend.intentDelta,
    riskDelta: scoreTrend.riskDelta,
    scoreSnapshot: {
      previousIntentScore: previousAssessment?.intentScore ?? null,
      previousRiskScore: previousAssessment?.consistencyRiskScore ?? null,
      latestIntentScore: latestAssessment?.intentScore ?? null,
      latestRiskScore: latestAssessment?.consistencyRiskScore ?? null
    },
    sourceEventIds: weekEvents.map((item) => item._id || item.id).filter(Boolean),
    sourceAssessmentIds: weekAssessments.map((item) => item._id || item.assessmentId).filter(Boolean),
    ...aiReview
  }

  await db.collection(REVIEW_COLLECTION).doc(reviewId).set(review)
  return { _id: reviewId, ...review }
}

exports.main = async (event = {}) => {
  const { caseId, action = 'list', weekStart } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少 caseId' }

    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    if (action === 'generate') {
      const review = await generateReview({ caseDoc, caseId, userId, weekStart })
      const reviews = await getReviews(caseId)
      return { success: true, review, reviews }
    }

    const reviews = await getReviews(caseId)
    return { success: true, reviews, currentWeekStart: getWeekRange(weekStart).weekStart }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('weeklyReview error:', error)
    return { success: false, message: '周复盘处理失败' }
  }
}
