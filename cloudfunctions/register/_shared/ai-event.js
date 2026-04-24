const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./ai-http')
const { buildTimelineRecordTitle, classifyTimelineEvent } = require('./event-understanding')

const EVENT_TYPES = ['positive', 'risk', 'verification', 'note']

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
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

function fallbackAnalysis(event) {
  const fallbackType = EVENT_TYPES.includes(event.type) ? event.type : classifyTimelineEvent(event.description || '')
  const content = `${event.title || ''} ${event.description || ''}`.toLowerCase()
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

  const prompt = [
    '你是关系事件理解模块，不直接裁决真假，只输出结构化影响。',
    '请根据当前评估快照、最近时间线和新事件，先判断这条事件的 eventType 和 eventTitle，再判断它会如何影响：intentDelta, riskDelta, evidenceDelta。',
    '输出必须是 JSON，不要加 markdown。',
    'eventType 只能是 positive、risk、verification、note 四选一。',
    'eventTitle 要求简短中文，适合时间线展示，尽量不超过 20 个字。',
    'intentDelta 和 riskDelta 取值建议在 -20 到 20。evidenceDelta 取值 0 到 2。',
    'labels 为简短中文标签数组；summary 为一句中文总结；rationale 为 2-4 条中文理由；confidence 为 low/medium/high；categories 为相关维度数组。',
    '对象画像只能作为辅助理解，不可单独作为核心结论依据，更不能仅凭画像直接推高或压低评分。',
    `当前评估：${JSON.stringify({
      intentScore: params.latestResult?.intentScore,
      riskScore: params.latestResult?.consistencyRiskScore,
      evidenceLevel: params.latestResult?.evidenceLevel,
      labels: params.latestResult?.primaryLabels,
      nextAction: params.latestResult?.nextAction
    })}`,
    `对象画像（辅助信息）：${serializeCaseProfile(params.caseProfile)}`,
    `最近时间线：${JSON.stringify((params.recentTimeline || []).slice(0, 5))}`,
    `新事件：${JSON.stringify(params.event)}`
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
        { role: 'system', content: '你是严谨的关系事件结构化分析器。' },
        { role: 'user', content: prompt }
      ],
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
    return {
      eventType,
      eventTitle,
      intentDelta: clamp(Number(parsed.intentDelta ?? 0), -20, 20),
      riskDelta: clamp(Number(parsed.riskDelta ?? 0), -20, 20),
      evidenceDelta: clamp(Number(parsed.evidenceDelta ?? 0), 0, 2),
      labels: Array.isArray(parsed.labels) ? parsed.labels.map(String) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'AI 已参与分析。',
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.map(String) : [],
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
      usedAI: true
    }
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
