const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./_shared/ai-http')
const { recordTokenUsage } = require('./_shared/token-usage')
const { checkBalance } = require('./_shared/billing')
const { checkFeatureAccess, checkTokenBalance, consumeTokens } = require('./_shared/subscription')
const { buildPromptMessages } = require('./_shared/ai-prompt-config')
const { buildPersonaPrompt } = require('./_shared/persona-config')

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

function parseRangeStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getCurrent14DayStart(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - 13 * MS_PER_DAY - TZ_OFFSET_MS)
}

function getWeekRange(weekStartValue) {
  const start = parseRangeStart(weekStartValue) || getCurrent14DayStart()
  const end = new Date(start.getTime() + 14 * MS_PER_DAY)
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

function cleanText(value, maxLength = 160) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function clampRuntimeNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(clamped) : Number(clamped.toFixed(2))
}

function getRuntimeConfig(settings = {}) {
  const source = settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {}
  return {
    weeklyEventLimit: clampRuntimeNumber(source.weeklyEventLimit, 10, 5, 20, true),
    weeklySideEventLimit: clampRuntimeNumber(source.weeklySideEventLimit, 8, 3, 12, true),
    weeklyMaxTokens: clampRuntimeNumber(source.weeklyMaxTokens, 650, 300, 1600, true),
    sideReadMaxTokens: clampRuntimeNumber(source.sideReadMaxTokens, 550, 200, 1200, true),
    weeklyTemperature: clampRuntimeNumber(source.weeklyTemperature, 0.25, 0, 1),
    sideReadTemperature: clampRuntimeNumber(source.sideReadTemperature, 0.35, 0, 1)
  }
}

function mapRelationTypeLabel(value) {
  const map = { romantic: 'Crush', close_friend: 'Friend Crush' }
  return map[value] || cleanText(String(value || ''), 24)
}

function serializeSelfProfile(profile) {
  const payload = {
    gender: cleanText(profile?.gender, 24),
    ageRange: cleanText(profile?.ageRange, 24),
    identity: cleanText(profile?.identity, 24),
    zodiac: cleanText(profile?.zodiac, 12),
    constellation: cleanText(profile?.constellation, 24),
    aiStyle: cleanText(profile?.aiStyle, 24),
    aiBoldness: cleanText(profile?.aiBoldness, 24)
  }
  return Object.values(payload).some(Boolean) ? JSON.stringify(payload) : '未提供'
}

function serializeCaseProfile(profile) {
  const payload = {
    relationType: mapRelationTypeLabel(profile?.relationType),
    gender: cleanText(profile?.gender, 24),
    age: cleanText(String(profile?.age || ''), 12),
    occupation: cleanText(profile?.occupation, 24),
    zodiac: cleanText(profile?.zodiac, 12),
    constellation: cleanText(profile?.constellation, 24)
  }
  return Object.values(payload).some(Boolean) ? JSON.stringify(payload) : '未提供'
}

function hasWeeklySideReadProfile(selfProfile, caseProfile) {
  return Boolean(
    selfProfile?.zodiac ||
    selfProfile?.constellation ||
    caseProfile?.zodiac ||
    caseProfile?.constellation
  )
}

function normalizeWeeklySideRead(value) {
  const sanitized = sanitizeWeeklySideReadObject(value)
  const title = sanitized.title || '近14天星象速写'
  const summary = sanitized.summary
  const sections = sanitized.sections

  if (!summary && sections.length === 0) {
    throw new Error('WEEKLY_SIDE_READ_EMPTY')
  }

  return { title, summary, sections }
}

function sanitizeSideReadText(value) {
  return String(value || '')
    .replace(/属相星座侧写/g, '星象速写')
    .replace(/属相星座侧\s*写/g, '星象速写')
    .replace(/星座侧写/g, '星座速写')
    .replace(/星座侧\s*写/g, '星座速写')
    .replace(/属相侧写/g, '属相速写')
    .replace(/属相侧\s*写/g, '属相速写')
    .replace(/综合侧写/g, '综合星象速写')
    .replace(/综合侧\s*写/g, '综合星象速写')
    .replace(/保守侧写/g, '保守星象速写')
    .replace(/保守侧\s*写/g, '保守星象速写')
    .replace(/侧写资料不足/g, '星象速写资料不足')
    .replace(/侧\s*写资料不足/g, '星象速写资料不足')
    .replace(/側寫/g, '星象速写')
    .replace(/侧写/g, '星象速写')
    .replace(/侧\s*写/g, '星象速写')
}

function sanitizeWeeklySideReadObject(value) {
  const input = value && typeof value === 'object' ? value : {}
  const title = sanitizeSideReadText(cleanText(input.title, 36))
  const summary = sanitizeSideReadText(cleanText(input.summary, 300))
  const sections = Array.isArray(input.sections)
    ? input.sections
      .slice(0, 3)
      .map((item) => ({
        label: sanitizeSideReadText(cleanText(item?.label, 24)),
        text: sanitizeSideReadText(cleanText(item?.text, 400))
      }))
      .filter((item) => item.label && item.text)
    : []
  return { title, summary, sections }
}

function normalizeStringArray(value, fallback, maxItems = 4, maxLength = 80) {
  const items = Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : []
  return items.length > 0 ? items : fallback
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
      fallbackToRules: settings.aiFallbackToRules !== false,
      runtimeConfig: settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
      promptConfig: settings.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
      promptModules: settings.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {},
      personaConfig: settings.personaConfig && typeof settings.personaConfig === 'object' ? settings.personaConfig : {}
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
    fallbackToRules: settings?.aiFallbackToRules !== false,
    runtimeConfig: settings?.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
    promptConfig: settings?.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
    promptModules: settings?.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {},
    personaConfig: settings?.personaConfig && typeof settings.personaConfig === 'object' ? settings.personaConfig : {}
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
  if (!current || !previous) {
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
    title: cleanText(item.title || '关系记录', 60),
    type: cleanText(item.type || 'note', 24),
    date: item.dateLabel || item.date || item.occurrenceAt || item.createdAt,
    description: cleanText(String(item.description || ''), 220),
    aiUsed: Boolean(item.aiUsed)
  }
}

function fallbackReview(params) {
  const { caseDoc, weekEvents, weekAssessments, previousAssessment, latestAssessment } = params
  const trend = compareAssessments(previousAssessment, latestAssessment)
  const trendLabel = classifyTrend(trend.intentDelta, trend.riskDelta)
  const keyEvents = weekEvents
    .slice(0, 4)
    .map((item) => cleanText(item.title || item.description || '关系记录', 60))
    .filter(Boolean)

  const summary = weekEvents.length === 0
    ? '近14天还没有新增事件。现在不适合下重结论，先继续记录真实互动。'
    : trend.riskDelta >= 10
      ? '近14天风险分明显抬头，重点不是继续猜，而是回看是否出现回避、拖延、失约或说法变化。'
      : trend.intentDelta >= 8 && trend.riskDelta <= 3
        ? '近14天意向信号有增强，但重点仍是看推进是否持续落地，而不是只看一次热度。'
        : '近14天关系有变化，但还没形成足够强的单向结论，适合继续积累连续证据。'

  return {
    title: `${cleanText(caseDoc.name, 24) || '当前 Crush'} · 近14天复盘`,
    trendLabel,
    summary,
    keyChanges: [
      `近14天新增 ${weekEvents.length} 条真实事件。`,
      `近14天产生 ${weekAssessments.length} 次评估变化。`,
      `意向变化 ${trend.intentDelta > 0 ? '+' : ''}${trend.intentDelta}，风险变化 ${trend.riskDelta > 0 ? '+' : ''}${trend.riskDelta}。`
    ],
    keyEvents: keyEvents.length > 0 ? keyEvents : ['近14天暂无新增关键事件。'],
    nextWeekFocus: [
      '下一次最该验证的一件事：看对方是否有明确的后续动作，而不只是停在聊天气氛里。',
      '关注答应过的事情有没有兑现。',
      '如果出现含糊或拖延，先记录事实，不急着脑补原因。'
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
  const personaPrompt = buildPersonaPrompt(settings, params.selfProfile)
  const runtimeConfig = getRuntimeConfig(settings)
  const messages = buildPromptMessages({
    moduleKey: 'weeklyReview',
    settings,
    systemExtra: personaPrompt.systemPrompt,
    contextLines: [
      personaPrompt.userPrompt,
      `Self profile: ${serializeSelfProfile(params.selfProfile)}`,
      `Target name: ${cleanText(params.caseDoc.name, 24) || 'current target'}`,
      `Target profile: ${serializeCaseProfile(params.caseDoc.profile)}`,
      `14-day review range: ${params.weekStart} to ${params.weekEnd}`,
      `14-day stats: ${JSON.stringify({
        eventCount: params.weekEvents.length,
        assessmentCount: params.weekAssessments.length,
        scoreTrend: params.scoreTrend
      })}`,
      `14-day key events, max ${runtimeConfig.weeklyEventLimit}: ${JSON.stringify(params.weekEvents.map(compactEvent).slice(0, runtimeConfig.weeklyEventLimit))}`
    ]
  })
  if (!messages) return fallback

  // 功能 + Token 门控
  const accessW = await checkFeatureAccess(db, params.userId, '周复盘')
  if (!accessW.allowed) throw Object.assign(new Error(accessW.reason), { code: 'FEATURE_NOT_AVAILABLE' })
  const tokW = await checkTokenBalance(db, params.userId, 2000)
  if (!tokW.ok) throw Object.assign(new Error(tokW.message || 'Token不足'), { code: tokW.code, ...tokW })

  const balCheck = await checkBalance(db, params.userId, runtimeConfig.weeklyMaxTokens)
  if (!balCheck.ok) {
    throw Object.assign(new Error('余额不足，请充值'), { code: 'INSUFFICIENT_BALANCE', balance: balCheck.balance, required: balCheck.required })
  }

  try {
    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      messages,
      temperature: runtimeConfig.weeklyTemperature,
      maxTokens: runtimeConfig.weeklyMaxTokens
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    await recordTokenUsage(db, {
      userId: params.userId,
      caseId: params.caseDoc?._id || params.caseId,
      feature: 'weeklyReview',
      provider: settings.provider,
      model: settings.model,
      usage: data?.usage
    })
    const parsed = parseJSONContent(raw)
    return {
      title: cleanText(parsed.title, 60) || fallback.title,
      trendLabel: cleanText(parsed.trendLabel, 12) || fallback.trendLabel,
      summary: cleanText(parsed.summary, 400) || fallback.summary,
      keyChanges: normalizeStringArray(parsed.keyChanges, fallback.keyChanges),
      keyEvents: normalizeStringArray(parsed.keyEvents, fallback.keyEvents),
      nextWeekFocus: normalizeStringArray(parsed.nextWeekFocus, fallback.nextWeekFocus),
      avoidMisread: normalizeStringArray(parsed.avoidMisread, fallback.avoidMisread),
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
  return (data || []).map((item) => item?.weeklySideRead
    ? { ...item, weeklySideRead: sanitizeWeeklySideReadObject(item.weeklySideRead) }
    : item)
}

async function generateReview(params) {
  await ensureReviewCollection()
  const { caseDoc, caseId, userId, weekStart } = params
  const range = getWeekRange(weekStart)
  const reviewId = `weekly_${caseId}_${range.weekStart}`

  const [timelineRes, assessmentsRes, userRes, existingReviewRes] = await Promise.all([
    db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get(),
    db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get(),
    db.collection('users').doc(userId).get().catch(() => null),
    db.collection(REVIEW_COLLECTION).doc(reviewId).get().catch(() => null)
  ])

  const allTimeline = timelineRes.data || []
  const allAssessments = assessmentsRes.data || []
  const userDoc = normalizeDoc(userRes)
  const existingReview = normalizeDoc(existingReviewRes)
  const weekEvents = allTimeline
    .filter((item) => !['assessment', 'trend'].includes(item.type))
    .filter((item) => inRange(item, 'occurrenceAt', range.start, range.end))
  const weekAssessments = allAssessments.filter((item) => inRange(item, 'createdAt', range.start, range.end))
  const previousAssessment = pickPreviousAssessment(allAssessments, range.start)
  const latestAssessment = weekAssessments[weekAssessments.length - 1] || previousAssessment || allAssessments[allAssessments.length - 1] || null
  const scoreTrend = compareAssessments(previousAssessment, latestAssessment)

  const aiReview = await buildAIReview({
    userId,
    selfProfile: userDoc?.selfProfile || null,
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
  const review = {
    userId,
    caseId,
    caseName: caseDoc.name || '',
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    createdAt: existingReview?.createdAt || now,
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
    ...(existingReview?.weeklySideRead ? {
      weeklySideRead: sanitizeWeeklySideReadObject(existingReview.weeklySideRead),
      weeklySideReadGeneratedAt: existingReview.weeklySideReadGeneratedAt || null
    } : {}),
    ...aiReview
  }

  await db.collection(REVIEW_COLLECTION).doc(reviewId).set(review)

  // 删除同周期旧 timeline 记录，避免重复
  const oldRecords = await db.collection('timeline_records')
    .where({ caseId, reviewId })
    .get()
  for (const doc of oldRecords.data || []) {
    await db.collection('timeline_records').doc(doc._id).remove()
  }

  await db.collection('timeline_records').add({
    caseId, userId, type: 'weekly_review',
    reviewId,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    title: `近14天复盘：${aiReview.title || weekStart}`,
    description: aiReview.summary || '',
    trendLabel: aiReview.trendLabel || '',
    eventCount: weekEvents.length,
    assessmentCount: weekAssessments.length,
    intentDelta: scoreTrend.intentDelta,
    riskDelta: scoreTrend.riskDelta,
    keyChanges: aiReview.keyChanges || [],
    keyEvents: aiReview.keyEvents || [],
    nextWeekFocus: aiReview.nextWeekFocus || [],
    avoidMisread: aiReview.avoidMisread || [],
    occurrenceAt: new Date(), createdAt: new Date(),
    aiUsed: aiReview.aiUsed !== false
  })
  return { _id: reviewId, ...review }
}

async function buildAIWeeklySideRead(params) {
  const settings = await getAISettings(params.userId)
  if (!settings.enabled || !settings.apiKey) {
    throw new Error('AI_DISABLED')
  }

  const personaPrompt = buildPersonaPrompt(settings, params.selfProfile)
  const runtimeConfig = getRuntimeConfig(settings)
  const messages = buildPromptMessages({
    moduleKey: 'sideRead',
    settings,
    systemExtra: personaPrompt.systemPrompt,
    contextLines: [
      personaPrompt.userPrompt,
      `14-day range: ${params.weekStart} to ${params.weekEnd}`,
      `Self profile: ${serializeSelfProfile(params.selfProfile)}`,
      `Target name: ${cleanText(params.caseDoc.name, 24) || 'current target'}`,
      `Target profile: ${serializeCaseProfile(params.caseDoc.profile)}`,
      `14-day review summary: ${cleanText(params.review?.summary, 160) || 'not provided'}`,
      `14-day score change: ${JSON.stringify(params.scoreTrend)}`,
      `14-day key events, max ${runtimeConfig.weeklySideEventLimit}: ${JSON.stringify(params.weekEvents.map(compactEvent).slice(0, runtimeConfig.weeklySideEventLimit))}`
    ]
  })
  if (!messages) {
    throw new Error('SIDE_READ_PROMPT_DISABLED')
  }

  // 功能 + Token 门控 - sideRead
  const accessSR = await checkFeatureAccess(db, params.userId, '星象速写')
  if (!accessSR.allowed) throw Object.assign(new Error(accessSR.reason), { code: 'FEATURE_NOT_AVAILABLE' })
  const tokSR = await checkTokenBalance(db, params.userId, 1500)
  if (!tokSR.ok) throw Object.assign(new Error(tokSR.message || 'Token不足'), { code: tokSR.code, ...tokSR })

  const balCheck = await checkBalance(db, params.userId, runtimeConfig.sideReadMaxTokens)
  if (!balCheck.ok) {
    throw Object.assign(new Error('INSUFFICIENT_BALANCE'), { code: 'INSUFFICIENT_BALANCE', balance: balCheck.balance, required: balCheck.required })
  }

  const response = await postChatCompletions({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
    responseFormat: { type: 'json_object' },
    messages,
    temperature: runtimeConfig.sideReadTemperature,
    maxTokens: runtimeConfig.sideReadMaxTokens
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
  }

  const data = await response.json()
  const raw = data?.choices?.[0]?.message?.content
  await recordTokenUsage(db, {
    userId: params.userId,
    caseId: params.caseDoc?._id || params.caseId,
    feature: 'weeklySideRead',
    provider: settings.provider,
    model: settings.model,
    usage: data?.usage
  })
  return normalizeWeeklySideRead(parseJSONContent(raw))
}

async function generateWeeklySideRead(params) {
  await ensureReviewCollection()
  const { caseDoc, caseId, userId, weekStart } = params
  const range = getWeekRange(weekStart)
  const reviewId = `weekly_${caseId}_${range.weekStart}`

  const [reviewRes, userRes, timelineRes] = await Promise.all([
    db.collection(REVIEW_COLLECTION).doc(reviewId).get().catch(() => null),
    db.collection('users').doc(userId).get().catch(() => null),
    db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get()
  ])

  const review = normalizeDoc(reviewRes)
  if (!review) {
    throw new Error('WEEKLY_REVIEW_REQUIRED')
  }

  const userDoc = normalizeDoc(userRes)
  const selfProfile = userDoc?.selfProfile || null
  const caseProfile = caseDoc?.profile || {}

  if (!hasWeeklySideReadProfile(selfProfile, caseProfile)) {
    throw new Error('WEEKLY_SIDE_READ_PROFILE_MISSING')
  }

  const allTimeline = timelineRes.data || []
  const weekEvents = allTimeline
    .filter((item) => !['assessment', 'trend'].includes(item.type))
    .filter((item) => inRange(item, 'occurrenceAt', range.start, range.end))

  const weeklySideRead = await buildAIWeeklySideRead({
    userId,
    selfProfile,
    caseDoc,
    review,
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    weekEvents,
    scoreTrend: {
      intentDelta: review.intentDelta || 0,
      riskDelta: review.riskDelta || 0
    }
  })

  const now = new Date()
  await db.collection(REVIEW_COLLECTION).doc(reviewId).update({
    weeklySideRead: _.set(weeklySideRead),
    weeklySideReadGeneratedAt: _.set(now),
    updatedAt: _.set(now)
  })

  // 删除同周期旧星象速写 timeline 记录，避免重复
  const oldSideReads = await db.collection('timeline_records')
    .where({ caseId, reviewId })
    .get()
  for (const doc of oldSideReads.data || []) {
    await db.collection('timeline_records').doc(doc._id).remove()
  }

  await db.collection('timeline_records').add({
    caseId, userId, type: 'note', reviewId,
    feature: 'weeklySideRead',
    title: weeklySideRead.title || '近14天星象速写',
    description: weeklySideRead.summary || '',
    sections: weeklySideRead.sections || [],
    occurrenceAt: new Date(), createdAt: new Date(),
    aiUsed: true
  })

  const reviews = await getReviews(caseId)
  const nextReview = reviews.find((item) => item.weekStart === range.weekStart) || null
  return { review: nextReview, reviews }
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

    if (action === 'generateSideRead') {
      const result = await generateWeeklySideRead({ caseDoc, caseId, userId, weekStart })
      return { success: true, ...result }
    }

    const reviews = await getReviews(caseId)
    return { success: true, reviews, currentWeekStart: getWeekRange(weekStart).weekStart }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError

    if (error?.code === 'INSUFFICIENT_BALANCE') {
      return { success: false, message: error.message, code: 'INSUFFICIENT_BALANCE', balance: error.balance, required: error.required }
    }
    if (error?.message === 'WEEKLY_REVIEW_REQUIRED') {
      return { success: false, message: '请先生成近14天复盘' }
    }
    if (error?.message === 'WEEKLY_SIDE_READ_PROFILE_MISSING') {
      return { success: false, message: '请先完善你或 Crush 的属相、星座信息' }
    }
    if (error?.message === 'AI_DISABLED') {
      return { success: false, message: 'AI 未启用' }
    }
    if (error?.message === 'AI_REQUEST_TIMEOUT') {
      return { success: false, message: 'AI 生成超时，请稍后再试' }
    }

    console.error('weeklyReview error:', error)
    return { success: false, message: '14天复盘处理失败' }
  }
}
