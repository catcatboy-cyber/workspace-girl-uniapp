const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./ai-http')
const { buildPromptMessages } = require('./ai-prompt-config')
const { buildPersonaPrompt } = require('./persona-config')
const { serializeCaseProfileForAI } = require('./case-profile')
const {
  SCHEMA_VERSION,
  ACTORS,
  INTERACTIONS,
  COMMITMENT_STATUSES,
  COMMITMENT_TYPES,
  EVIDENCE_TYPES,
  STRENGTHS,
  SIGNALS,
  SCENES,
  PET_MOODS,
  normalizeNormalizedEvent,
  buildAnalysisFromNormalizedEvent,
  buildFallbackAnalysis
} = require('./normalized-event')

function cleanText(value, maxLength = 600) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : ''
}

function normalizeEventInsight(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    actor: ACTORS.includes(source.actor) ? source.actor : 'unknown',
    interaction: INTERACTIONS.includes(source.interaction) ? source.interaction : 'unclear',
    commitmentStatus: COMMITMENT_STATUSES.includes(source.commitmentStatus) ? source.commitmentStatus : 'unclear',
    evidenceType: EVIDENCE_TYPES.includes(source.evidenceType) ? source.evidenceType : 'unclear'
  }
}

function buildCurrentEventContext(event) {
  const source = event && typeof event === 'object' ? event : {}
  return {
    id: source.id,
    inputSubjectRole: source.inputSubjectRole,
    userQuestion: source.userQuestion,
    description: source.description,
    chatSelfName: source.chatSelfName,
    chatTargetName: source.chatTargetName,
    occurrenceAt: source.occurrenceAt,
    createdAt: source.createdAt
  }
}

function serializeSelfProfile(profile) {
  if (!profile) return '未提供'
  const normalized = {
    nickname: profile.nickname,
    gender: profile.gender,
    ageRange: profile.ageRange,
    identity: profile.identity,
    zodiac: profile.zodiac,
    constellation: profile.constellation,
    mbti: profile.mbtiCode,
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
      description: cleanText(item.description, 160),
      chatSelfName: item.chatSelfName || '',
      chatTargetName: item.chatTargetName || '',
      occurrenceAt: item.occurrenceAt
    }))
}

function isBoundarySensitiveEvent(event) {
  const content = `${event?.title || ''} ${event?.description || ''}`
  return ['酒店', '开房', '过夜', '私密', '暧昧', '亲', '抱', '摸', '身体', '上床', '发生关系', '边界', '性', '喝酒后']
    .some((item) => content.includes(item))
}

function normalizeSettings(settings) {
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const defaultModel = settings.aiModels.find((model) => model.id === defaultId) || settings.aiModels[0] || {}
    const provider = cleanText(defaultModel.provider, 80)
    const runtime = settings.runtimeConfig || {}
    return {
      enabled: Boolean(settings.aiEnabled),
      provider,
      apiKey: cleanText(defaultModel.apiKey, 400),
      baseUrl: cleanText(defaultModel.baseUrl, 400) || (provider.toLowerCase() === 'anthropic' ? 'https://api.anthropic.com' : ''),
      model: cleanText(defaultModel.model, 160) || (provider.toLowerCase() === 'anthropic' ? 'claude-3-5-sonnet-20241022' : ''),
      eventMaxTokens: Number.isFinite(Number(runtime.eventMaxTokens)) ? Number(runtime.eventMaxTokens) : 800,
      eventTemperature: Number.isFinite(Number(runtime.eventTemperature)) ? Number(runtime.eventTemperature) : 0.2,
      eventContextLimit: Number.isFinite(Number(runtime.eventContextLimit)) ? Number(runtime.eventContextLimit) : 3
    }
  }

  const provider = cleanText(settings?.aiProvider, 80)
  const runtime = settings?.runtimeConfig || {}
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider,
    apiKey: cleanText(settings?.aiApiKey, 400),
    baseUrl: cleanText(settings?.aiBaseUrl, 400) || (provider.toLowerCase() === 'anthropic' ? 'https://api.anthropic.com' : ''),
    model: cleanText(settings?.aiModel, 160) || (provider.toLowerCase() === 'anthropic' ? 'claude-3-5-sonnet-20241022' : ''),
    eventMaxTokens: Number.isFinite(Number(runtime.eventMaxTokens)) ? Number(runtime.eventMaxTokens) : 800,
    eventTemperature: Number.isFinite(Number(runtime.eventTemperature)) ? Number(runtime.eventTemperature) : 0.2,
    eventContextLimit: Number.isFinite(Number(runtime.eventContextLimit)) ? Number(runtime.eventContextLimit) : 3
  }
}

function buildSchemaInstruction() {
  return [
    'schemaVersion=2 时 event.actions 必须存在，数组按 sequence 升序排列；每个动作必须独立标明 actor 和 interaction。',
    `严格返回 JSON：{"schemaVersion":${SCHEMA_VERSION},"event":{actor,interaction,commitmentStatus,commitmentType,evidenceType,scene,signals,strength,actions:[{actor,interaction,commitmentStatus,commitmentType,evidenceType,strength,sequence}]},"copy":{title,summary,reason,answer,targetMind,nextStep,caution,petLine,petMood}}。`,
    `actor=${ACTORS.join('|')}；interaction=${INTERACTIONS.join('|')}；commitmentStatus=${COMMITMENT_STATUSES.join('|')}；commitmentType=${COMMITMENT_TYPES.join('|')}；evidenceType=${EVIDENCE_TYPES.join('|')}；strength=${STRENGTHS.join('|')}。`,
    `scene 最多2项，只能取 ${SCENES.join('|')}；signals 最多4项，只能取 ${SIGNALS.join('|')}；petMood=${PET_MOODS.join('|')}。`,
    '不要返回 eventType、intentDelta、riskDelta、evidenceDelta、categories、semanticTags 或 rawReply。'
  ].join('\n')
}

function buildSemanticInstruction(inputSubjectRole) {
  const v2Contract = [
    'V2 multi-action contract: event.actions is required and contains 1-4 chronological actions.',
    'Each action must contain actor=target|self|unknown, interaction, commitmentStatus, commitmentType, evidenceType, strength, sequence.',
    'For a two-party transcript, preserve both sides: target invitation + self rejection is target initiated followed by self rejected; self invitation + target rejection is self initiated followed by target rejected.',
    'Never rewrite the user response as a target action, and never delete a target action because the user later rejected it.',
    'intentScore is based only on target actions. Self actions are context and must not directly change target intent or risk.',
    'Top-level event fields are the primary target action when any target action exists; subjectRole is derived by code from the action actors.'
  ]
  return [
    '只依据原文识别动作发出者、互动、承诺、依据和场景，不补充未出现的事实。',
    'actions 中每个 actor 必须是该 interaction 的真实动作发出者：“我邀请他”是 self，“他邀请我”是 target；无法判断才是 unknown。用户自己的行为、感受和猜测不是对方信号。',
    '“我想/我准备/我打算请他吃饭”等句子描述用户自己的意图，actor=self；尚未实际发出邀请时，不得写成 target 主动或 target 承诺。',
    '多动作事件必须按原文顺序分别返回 event.actions，不得只保留最终结果。顶层 event 字段用于兼容，存在 target 动作时复制主要 target 动作。',
    '同一主体有多个动作时，主动作优先级：承诺未兑现 > 拒绝 > 拖延 > 兑现 > 承诺 > 回应 > 主动发起 > 普通观察 > 不清。',
    '关键正例：“我请他吃饭，他拒绝了我”→actions=[self initiated,target rejected]，顶层 actor=target, interaction=rejected。',
    '关键反例：“他请我吃饭，我拒绝了他”→actions=[target initiated,self rejected]，顶层 actor=target, interaction=initiated。',
    'broken 只表示原文明确出现“先前已经答应或承诺，后来没有兑现”。拒绝一个新邀约不是 broken；此时 commitmentStatus=none 且 commitmentType=none。吃饭、电影等场景本身也不代表存在承诺。',
    '字段一致性：commitmentStatus=promised 时 interaction=promised；fulfilled 时 interaction=fulfilled；broken 时 interaction=rejected 或 delayed。只有 promised/fulfilled/broken 才允许 commitmentType 非 none。',
    'strength 标准：weak=轻微或较含糊但仍有事实；medium=普通明确事件；strong=明确、重要、可验证或对推进/风险影响显著。明确拒绝、明确兑现、明确违约通常为 strong。',
    '明确直接拒绝只需 interaction=rejected；除非原文还出现回避、绕开、拖延或不落实，否则不要自动添加 avoidance。',
    inputSubjectRole === 'both' ? '这是微信对话记录的文字转写：每行按截图阅读顺序排列，格式为“[日期 时间] 我：内容”或“[日期 时间] 对方：内容”。“我”=USER，“对方”=TARGET；日期和 HH:mm 只是原始显示信息，绝不能仅按 HH:mm 重排消息或推断回复间隔。逐条保留双方动作的原始先后；[无法辨认] 不构成任何动作、承诺、情绪或信号。通话时长、撤回提示等系统记录只能说明该记录本身，不可单独推断是谁主动、关系升温、冷淡或承诺。' : '',
    '人格和建议强度只影响 copy，不得影响 event。copy 对主体、主动作和承诺的描述必须与 event 完全一致。',
    '输出 JSON 前逐项自检：每个 action.actor 是否发出对应 interaction；copy 是否同时准确描述双方动作；broken 是否有明确先前承诺；普通拒绝是否误带 commitmentType；strength 是否符合事实强度。',
    ...v2Contract,
  ].filter(Boolean).join('\n')
}

function fallbackForEvent(event, code) {
  return buildFallbackAnalysis(event?.description || event?.title || '', code)
}

function buildEventAssessmentMessages(params) {
  const settings = normalizeSettings(params.settings)
  const personaPrompt = buildPersonaPrompt(params.settings, params.selfProfile, {
    boundarySensitive: isBoundarySensitiveEvent(params.event)
  })
  const messages = buildPromptMessages({
    moduleKey: 'eventAssessment',
    settings: params.settings,
    systemExtra: personaPrompt.systemPrompt,
    contextLines: [
      personaPrompt.userPrompt,
      buildSemanticInstruction(params.event?.inputSubjectRole),
      buildSchemaInstruction(),
      params.event?.userQuestion?.label
        ? `copy.answer 必须先直接回答：${cleanText(params.event.userQuestion.label, 60)}`
        : 'copy.answer 直接回答用户最可能关心的问题。',
      `Self profile: ${serializeSelfProfile(params.selfProfile)}`,
      `Target profile: ${serializeCaseProfileForAI(params.caseProfile)}`,
      `Identity: USER="${cleanText(params.event?.chatSelfName || params.selfProfile?.nickname || '用户', 40)}"; TARGET="${cleanText(params.event?.chatTargetName || params.caseName || 'TA', 40)}"。`,
      `Recent timeline: ${JSON.stringify(compactRecentTimeline(params.recentTimeline, params.event?.id, settings.eventContextLimit))}`,
      `Current event: ${JSON.stringify(buildCurrentEventContext(params.event))}`
    ].filter(Boolean)
  })
  return { settings, messages }
}

async function analyzeTimelineEvent(params) {
  const { settings, messages } = buildEventAssessmentMessages(params)
  if (!settings.enabled || !settings.apiKey) return fallbackForEvent(params.event, 'AI_REQUEST_FAILED')
  if (!messages) return fallbackForEvent(params.event, 'AI_REQUEST_FAILED')

  try {
    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      messages,
      temperature: settings.eventTemperature,
      maxTokens: settings.eventMaxTokens
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[AI语义归一化失败]', `HTTP ${response.status}`, errorText.slice(0, 180))
      return fallbackForEvent(params.event, 'AI_REQUEST_FAILED')
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw || typeof raw !== 'string') return fallbackForEvent(params.event, 'AI_RESPONSE_EMPTY')

    let parsed
    try {
      parsed = parseJSONContent(raw)
    } catch (error) {
      console.error('[AI语义JSON解析失败]', error?.message || error)
      return fallbackForEvent(params.event, 'NORMALIZED_EVENT_JSON_INVALID')
    }
    const normalized = normalizeNormalizedEvent(parsed, { description: params.event?.description })
    if (!normalized.ok) {
      console.error('[AI语义协议校验失败]', normalized.error, normalized.warnings || [])
      return fallbackForEvent(params.event, normalized.error)
    }
    return buildAnalysisFromNormalizedEvent(normalized.value, {
      warnings: normalized.warnings,
      aiProvider: settings.provider,
      aiModel: data?.model || settings.model,
      tokenUsage: data?.usage || null
    })
  } catch (error) {
    console.error('[AI语义归一化失败]', getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS))
    return fallbackForEvent(params.event, 'AI_REQUEST_FAILED')
  }
}

module.exports = {
  analyzeTimelineEvent,
  fallbackAnalysis: (event) => fallbackForEvent(event, 'AI_REQUEST_FAILED'),
  normalizeEventInsight,
  buildCurrentEventContext,
  buildSemanticInstruction,
  buildEventAssessmentMessages
}
