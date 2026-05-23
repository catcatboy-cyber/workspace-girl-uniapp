const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./ai-http')
const { buildTimelineRecordTitle, classifyTimelineEvent } = require('./event-understanding')
const { buildPromptMessages } = require('./ai-prompt-config')
const { buildPersonaPrompt } = require('./persona-config')

const EVENT_TYPES = ['positive', 'risk', 'verification', 'note']

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function cleanText(value, maxLength = 600) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : ''
}

function normalizeStringList(value, maxItems = 6, maxLength = 60) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : []
}

function normalizeCurrentStatus(value) {
  const source = value && typeof value === 'object' ? value : {}
  const result = {
    tags: normalizeStringList(source.tags, 5, 24),
    summary: cleanText(source.summary, 100),
    caution: cleanText(source.caution, 100)
  }
  return result.tags.length || result.summary || result.caution ? result : null
}

function mapRelationType(value) {
  const map = { romantic: '恋爱对象', close_friend: '亲密朋友', colleague: '同事', classmate: '同学', teacher: '老师' }
  return map[value] || value || ''
}

function serializeCaseProfile(profile) {
  if (!profile) return '未提供'

  const normalized = {
    relationType: mapRelationType(profile.relationType),
    age: profile.age,
    gender: profile.gender,
    occupation: profile.occupation,
    zodiac: profile.zodiac,
    constellation: profile.constellation
  }

  return Object.values(normalized).some(Boolean) ? JSON.stringify(normalized) : '未提供'
}

function describeSubjectRole(role) {
  if (role === 'self') {
    return 'subjectRole=self：这条记录主要描述用户自己。文本里的“我”是用户本人，不是关系对象。不要把用户的穿着、化妆、准备、情绪、表达当成对方释放的信号；请分析它可能怎样影响互动、用户接下来怎么做，以及需要观察对方什么反应。'
  }
  if (role === 'both') {
    return 'subjectRole=both：这条记录描述双方互动。请拆分“用户做了什么”和“关系对象回应/做了什么”；用户自己的主动不能算作对方主动，只有对方动作才能改变对方意向或风险判断。'
  }
  if (role === 'unknown') {
    return 'subjectRole=unknown：行为主体不确定。请弱化权重；除非文本明确写出对方回应、承诺、兑现、回避或失约，否则不要提高或降低对方意向/风险。'
  }
  return 'subjectRole=target：这条记录主要描述关系对象。请分析对方行为对关系意向、风险和证据强度的影响。'
}

function hasExplicitTargetReaction(event) {
  const content = `${event.title || ''} ${event.description || ''}`
  return ['他', '她', '对方', '回复', '答应', '拒绝', '主动', '约我', '说', '问我', '夸', '取消', '失约', '回避'].some((item) => content.includes(item))
}

function normalizeSubjectRoleAnalysis(event, analysis) {
  if (event.subjectRole === 'unknown') {
    const hasTargetReaction = hasExplicitTargetReaction(event)
    return {
      ...analysis,
      eventType: hasTargetReaction ? analysis.eventType : 'note',
      intentDelta: hasTargetReaction ? clamp(Math.round(Number(analysis.intentDelta || 0) / 2), -10, 10) : 0,
      riskDelta: hasTargetReaction ? clamp(Math.round(Number(analysis.riskDelta || 0) / 2), -10, 10) : 0,
      evidenceDelta: 0,
      labels: ['主体不确定', ...(analysis.labels || []).slice(0, 2)],
      summary: analysis.summary || '这条记录主体不确定，先弱化为观察上下文。',
      rationale: analysis.rationale?.length
        ? analysis.rationale
        : ['行为主体还不清楚，暂时不直接作为对方意向或风险信号。'],
      confidence: 'low',
      categories: analysis.categories || []
    }
  }

  if (event.subjectRole !== 'self' || hasExplicitTargetReaction(event)) return analysis
  return {
    ...analysis,
    eventType: 'note',
    intentDelta: 0,
    riskDelta: 0,
    evidenceDelta: 0,
    labels: analysis.labels?.length ? analysis.labels : ['我的状态/准备记录'],
    summary: analysis.summary || '这条记录主要描述用户自己，先作为互动准备和观察上下文。',
    rationale: analysis.rationale?.length
      ? analysis.rationale
      : [
          '这条记录没有明确写出对方的回应，不能直接当作对方意向或风险信号。',
          '它更适合用于提醒你下一步观察对方是否回应、配合或给出清楚反馈。'
        ],
    categories: [],
    confidence: analysis.confidence || 'medium'
  }
}

function classifyTextAsRisk(content) {
  return content.includes('失联')
    || content.includes('消失')
    || content.includes('拖延')
    || content.includes('回避')
    || content.includes('拒绝')
    || content.includes('婉拒')
    || content.includes('不想')
    || content.includes('不愿意')
    || content.includes('不合适')
    || content.includes('算了')
    || content.includes('没感觉')
    || content.includes('不见')
}

function isBoundarySensitiveEvent(event) {
  const content = `${event?.title || ''} ${event?.description || ''}`
  return [
    '酒店',
    '开房',
    '过夜',
    '小树林',
    '私密',
    '暧昧',
    '亲',
    '抱',
    '摸',
    '身体',
    '上床',
    '发生关系',
    '边界',
    '性',
    '喝酒后'
  ].some((item) => content.includes(item))
}

function serializeSelfProfile(profile) {
  if (!profile) return '未提供'

  const normalized = {
    gender: profile.gender,
    ageRange: profile.ageRange,
    identity: profile.identity,
    zodiac: profile.zodiac,
    constellation: profile.constellation,
    aiStyle: profile.aiStyle,
    aiBoldness: profile.aiBoldness
  }

  return Object.values(normalized).some(Boolean) ? JSON.stringify(normalized) : '未提供'
}

function compactRecentTimeline(items, currentEventId, limit = 3) {
  return (items || [])
    .filter((item) => item?.id !== currentEventId)
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      type: item.type,
      subjectRole: item.subjectRole,
      description: typeof item.description === 'string' ? item.description.slice(0, 160) : '',
      occurrenceAt: item.occurrenceAt
    }))
}

function fallbackAnalysis(event) {
  const fallbackType = EVENT_TYPES.includes(event.type) ? event.type : classifyTimelineEvent(event.description || '')
  const content = `${event.title || ''} ${event.description || ''}`.toLowerCase()
  if (event.subjectRole === 'unknown') {
    return {
      eventType: 'note',
      eventTitle: buildTimelineRecordTitle(event.description || event.title || '') || '主体不确定记录',
      intentDelta: 0,
      riskDelta: 0,
      evidenceDelta: 0,
      labels: ['主体不确定'],
      summary: '这条记录还没有明确谁做了这件事，先作为低权重观察上下文。',
      rationale: [
        '行为主体不清楚时，不能直接把它当成对方意向或风险信号。',
        '建议后续补充：是谁主动、对方怎么回应、有没有兑现或回避。'
      ],
      confidence: 'low',
      categories: ['context'],
      usedAI: false
    }
  }
  if (event.subjectRole === 'self') {
    return {
      eventType: 'note',
      eventTitle: buildTimelineRecordTitle(event.description || event.title || '') || '我的状态记录',
      intentDelta: 0,
      riskDelta: 0,
      evidenceDelta: 0,
      labels: ['我的状态/准备记录'],
      summary: '这条记录主要描述用户自己，不能直接当作对方意向或风险信号。',
      rationale: [
        '用户自己的穿着、准备、情绪或表达方式，会影响互动氛围，但不是对方已经释放出的关系信号。',
        '更适合记录下来用于下一步观察：对方是否回应、是否配合、是否给出清楚反馈。'
      ],
      confidence: 'medium',
      categories: ['context'],
      usedAI: false
    }
  }
  let intentDelta = 0
  let riskDelta = 0
  let evidenceDelta = 0
  const labels = []
  const rationale = []
  const categories = []

  if (fallbackType === 'positive') {
    intentDelta += 8
    riskDelta -= 4
    evidenceDelta += 1
    labels.push('正向推进事件')
    rationale.push('记录类型被标记为正向信号，通常代表主动、投入或推进关系。')
    categories.push('initiative', 'investment', 'progression')
  }

  if (fallbackType === 'risk') {
    intentDelta -= 4
    riskDelta += 10
    evidenceDelta += 1
    labels.push('风险事件')
    rationale.push('记录类型被标记为风险信号，会提高一致性与稳定性风险。')
    categories.push('consistency', 'avoidance', 'instability')
  }

  if (fallbackType === 'verification') {
    evidenceDelta += 1
    categories.push('verifiability')
    if (content.includes('失败') || content.includes('对不上') || content.includes('矛盾') || content.includes('失约')) {
      riskDelta += 12
      intentDelta -= 5
      labels.push('验证失败')
      rationale.push('验证结果偏负面，说明原有说法与事实存在落差。')
      categories.push('consistency', 'avoidance')
    } else if (content.includes('通过') || content.includes('兑现') || content.includes('证实') || content.includes('解释清楚')) {
      riskDelta -= 8
      intentDelta += 4
      labels.push('验证通过')
      rationale.push('验证结果偏正面，会降低可验证性相关风险。')
      categories.push('initiative', 'investment')
    }
  }

  if (fallbackType === 'note') {
    if (classifyTextAsRisk(content)) {
      riskDelta += 8
      intentDelta -= 4
      labels.push('回避/失联线索')
      rationale.push('文本里出现回避、拖延或消失类线索，通常会提高风险。')
      categories.push('avoidance', 'instability')
    }
    if (content.includes('主动') || content.includes('见面') || content.includes('兑现') || content.includes('补偿')) {
      intentDelta += 6
      riskDelta -= 3
      labels.push('主动/兑现线索')
      rationale.push('文本里出现主动推进或兑现线索，会增强意向判断。')
      categories.push('initiative', 'investment', 'progression')
    }
  }

  return {
    eventType: fallbackType,
    eventTitle: buildTimelineRecordTitle(event.description || event.title || '') || '关系记录',
    intentDelta: clamp(intentDelta, -20, 20),
    riskDelta: clamp(riskDelta, -20, 20),
    evidenceDelta: clamp(evidenceDelta, 0, 2),
    labels,
    summary: rationale[0] || '当前事件未触发明显结构化变化。',
    rationale: rationale.length > 0 ? rationale : ['当前事件没有命中明确规则，暂不做显著修正。'],
    confidence: rationale.length > 0 ? 'medium' : 'low',
    categories,
    usedAI: false
  }
}

function normalizeSettings(settings) {
  // 新版多模型格式
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

  // 旧版单模型格式（兼容）
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

async function analyzeTimelineEvent(params) {
  const settings = normalizeSettings(params.settings)
  if (!settings.enabled || !settings.apiKey) {
    return fallbackAnalysis(params.event)
  }

  const personaPrompt = buildPersonaPrompt(params.settings, params.selfProfile, {
    boundarySensitive: isBoundarySensitiveEvent(params.event)
  })
  const messages = buildPromptMessages({
    moduleKey: 'eventAssessment',
    settings: params.settings,
    systemExtra: personaPrompt.systemPrompt,
    contextLines: [
      personaPrompt.userPrompt,
      'Output must be JSON only. Required fields: eventType,eventTitle,intentDelta,riskDelta,evidenceDelta,summary,rationale,categories,currentStatus,rawReply. Do not return labels, confidence, actionAdvice, or eventInsight.',
      'currentStatus only needs tags,summary,caution. rawReply must use exactly three headings: 对方可能的心理 / 你下一步怎么做 / 重点观察什么.',
      describeSubjectRole(params.event?.subjectRole),
      `Current assessment: ${JSON.stringify({
        intentScore: params.latestResult?.intentScore,
        riskScore: params.latestResult?.consistencyRiskScore,
        evidenceLevel: params.latestResult?.evidenceLevel,
        labels: params.latestResult?.primaryLabels,
        nextAction: params.latestResult?.nextAction
      })}`,
      `Self profile: ${serializeSelfProfile(params.selfProfile)}`,
      `Target profile: ${serializeCaseProfile(params.caseProfile)}`,
      `Recent timeline: ${JSON.stringify(compactRecentTimeline(params.recentTimeline, params.event?.id))}`,
      `Current event: ${JSON.stringify(params.event)}`
    ].filter(Boolean)
  })
  if (!messages) return fallbackAnalysis(params.event)

  try {
    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      messages,
      temperature: 0.2
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
      if (settings.fallbackToRules) {
        console.error('[AI分析失败，回退到规则]', error.message)
        return fallbackAnalysis(params.event)
      }
      throw error
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw || typeof raw !== 'string') {
      const error = new Error('AI 返回内容为空')
      if (settings.fallbackToRules) {
        console.error('[AI分析失败，回退到规则]', error.message)
        return fallbackAnalysis(params.event)
      }
      throw error
    }

    const parsed = parseJSONContent(raw)
    const eventType = EVENT_TYPES.includes(parsed.eventType) ? parsed.eventType : classifyTimelineEvent(params.event.description || '')
    const eventTitle = buildTimelineRecordTitle(parsed.eventTitle || params.event.description || params.event.title || '') || '关系记录'
    return normalizeSubjectRoleAnalysis(params.event, {
      eventType,
      eventTitle,
      intentDelta: clamp(Number(parsed.intentDelta ?? 0), -20, 20),
      riskDelta: clamp(Number(parsed.riskDelta ?? 0), -20, 20),
      evidenceDelta: clamp(Number(parsed.evidenceDelta ?? 0), 0, 2),
      labels: [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'AI 已参与分析。',
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.map(String) : [],
      confidence: 'medium',
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
      currentStatus: normalizeCurrentStatus(parsed.currentStatus),
      rawReply: cleanText(parsed.rawReply, 900),
      usedAI: true
    })
  } catch (error) {
    if (settings.fallbackToRules) {
      console.error('[AI分析失败，回退到规则]', getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS))
      return fallbackAnalysis(params.event)
    }
    throw error
  }
}

module.exports = {
  analyzeTimelineEvent,
  fallbackAnalysis
}
