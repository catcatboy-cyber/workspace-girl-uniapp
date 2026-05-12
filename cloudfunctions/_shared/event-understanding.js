const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./ai-http')

const EVENT_TYPES = ['positive', 'risk', 'verification', 'note']

function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildTimelineRecordTitle(input) {
  const normalized = trimText(input)
  if (!normalized) return ''

  const firstChunk = normalized
    .split(/[。！？!?；;，,\n]/)
    .map((item) => item.trim())
    .find(Boolean) || normalized

  if (firstChunk.length <= 20) return firstChunk
  return `${firstChunk.slice(0, 20).trim()}...`
}

function serializeCaseProfile(profile) {
  if (!profile) return '未提供'

  const normalized = {
    relationType: profile.relationType,
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
    return 'self：这条记录主要描述用户自己。文本里的“我”是用户本人，不是关系对象。不要把用户的穿着、化妆、准备、情绪、表达当成对方释放的信号；请分析它可能怎样影响互动，以及后续应该观察对方什么反应。'
  }
  if (role === 'both') {
    return 'both：这条记录描述双方互动。请先拆开“用户做了什么”和“关系对象回应/做了什么”，不要把用户自己的主动当成对方主动；只有对方的回应、承诺、兑现、回避等动作才能作为对方信号。'
  }
  if (role === 'unknown') {
    return 'unknown：行为主体不确定。请弱化权重，优先判为 note；除非文本明确写出对方回应、承诺、兑现、回避或失约，否则不要把它当成对方意向或风险信号。'
  }
  return 'target：这条记录主要描述关系对象。文本里的“他/她/对方”才是主要分析对象，请分析对方行为释放的关系信号。'
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

function classifyTimelineEvent(description) {
  const content = String(description || '').toLowerCase()

  if (['验证', '核实', '查证', '求证', '证实', '兑现', '对上', '对不上', '截图', '账单', '定位', '录音'].some((item) => content.includes(item))) {
    return 'verification'
  }

  if ([
    '失联', '消失', '敷衍', '冷淡', '拖延', '推迟', '取消', '放鸽子', '失约', '回避', '拉黑',
    '矛盾', '骗', '撒谎', '借口', '没来', '拒绝', '婉拒', '不想', '不愿意', '不合适', '算了',
    '别联系', '没感觉', '不要', '不见', '不考虑'
  ].some((item) => content.includes(item))) {
    return 'risk'
  }

  if (['主动', '约', '见面', '吃饭', '礼物', '送我', '接我', '安排', '介绍朋友', '带我', '公开', '报备', '解释清楚', '道歉', '补偿'].some((item) => content.includes(item))) {
    return 'positive'
  }

  return 'note'
}

function fallbackUnderstandEvent(params) {
  const subjectRole = ['target', 'self', 'both', 'unknown'].includes(params.subjectRole) ? params.subjectRole : 'target'
  const isWeakContext = subjectRole === 'self' || subjectRole === 'unknown'
  return {
    eventType: isWeakContext ? 'note' : classifyTimelineEvent(params.description),
    eventTitle: buildTimelineRecordTitle(params.description) || (subjectRole === 'self' ? '我的状态记录' : '关系记录'),
    summary: isWeakContext
      ? '这条记录先作为上下文记录，不直接当作对方信号。'
      : '当前使用规则自动识别事件类型与标题。',
    usedAI: false
  }
}

async function inferTimelineRecord(params) {
  const settings = normalizeSettings(params.settings)
  if (!settings.enabled || !settings.apiKey) {
    return fallbackUnderstandEvent(params)
  }

  const prompt = [
    '你是关系时间线事件理解模块。',
    '请只根据这条新描述，输出结构化 JSON，自动判断事件类型并生成展示标题。',
    'eventType 只能是 positive、risk、verification、note 四选一。',
    'eventTitle 要求简短中文，适合时间线展示，尽量不超过 20 个字。',
    'summary 用一句中文简短说明你为什么这么判断。',
    describeSubjectRole(params.subjectRole),
    '如果 subjectRole=self，eventTitle 可以写成“我做了某个准备/我当时的状态”；eventType 通常使用 note，除非描述中明确包含对方的回应或承诺。',
    '如果 subjectRole=both，必须区分用户动作和对方动作，不能因为“我主动”就推高对方意向。',
    '如果 subjectRole=unknown，除非文本明确写出对方动作，否则 eventType 使用 note，summary 提醒后续补清主体。',
    '拒绝、婉拒、回避、失约、冷淡、拖延等负向边界或退缩信号，应优先判为 risk。',
    `对象画像（辅助信息）：${serializeCaseProfile(params.caseProfile)}`,
    `最近时间线（辅助信息）：${JSON.stringify((params.recentTimeline || []).slice(0, 3))}`,
    `新事件描述：${JSON.stringify({ subjectRole: ['target', 'self', 'both', 'unknown'].includes(params.subjectRole) ? params.subjectRole : 'target', description: params.description })}`
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
        { role: 'system', content: '你是严谨的关系事件分类器。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      maxTokens: 180
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
      if (settings.fallbackToRules) {
        console.error('[AI事件理解失败，回退到规则]', error.message)
        return fallbackUnderstandEvent(params)
      }
      throw error
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw || typeof raw !== 'string') {
      const error = new Error('AI 返回内容为空')
      if (settings.fallbackToRules) {
        console.error('[AI事件理解失败，回退到规则]', error.message)
        return fallbackUnderstandEvent(params)
      }
      throw error
    }

    const parsed = parseJSONContent(raw)
    const eventType = EVENT_TYPES.includes(parsed.eventType) ? parsed.eventType : classifyTimelineEvent(params.description)
    const eventTitle = buildTimelineRecordTitle(parsed.eventTitle) || buildTimelineRecordTitle(params.description) || '关系记录'

    return {
      eventType,
      eventTitle,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'AI 已完成事件理解。',
      usedAI: true
    }
  } catch (error) {
    if (settings.fallbackToRules) {
      console.error('[AI事件理解失败，回退到规则]', getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS))
      return fallbackUnderstandEvent(params)
    }
    throw error
  }
}

module.exports = {
  buildTimelineRecordTitle,
  classifyTimelineEvent,
  inferTimelineRecord
}
