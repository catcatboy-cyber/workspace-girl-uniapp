const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'
const BILLING_DOC_ID = 'settings_billing'
const { ensureBillingSettings } = require('./_shared/billing')
const PROMPT_MODULE_KEYS = ['eventAssessment', 'eventUnderstanding', 'weeklyReview', 'sideRead', 'attachmentAnalysis']
const BUSINESS_PROMPT_LIMITS = {
  legacyGoal: 1600,
  legacyRule: 800,
  legacyRuleItems: 20,
  legacyExtraPrompt: 6000,
  roleZh: 800,
  roleEn: 1000,
  taskZh: 1600,
  taskEn: 2000,
  ruleZh: 800,
  ruleEn: 1000,
  ruleItems: 20,
  outputNoteZh: 1200,
  outputNoteEn: 1400,
  outputNoteItems: 20
}
const DEFAULT_RUNTIME_CONFIG = {
  eventContextLimit: 3,
  weeklyEventLimit: 10,
  weeklySideEventLimit: 8,
  eventMaxTokens: 650,
  eventUnderstandingMaxTokens: 260,
  batchTagMaxTokens: 600,
  weeklyMaxTokens: 650,
  sideReadMaxTokens: 550,
  attachmentMaxTokens: 1200,
  eventTemperature: 0.2,
  eventUnderstandingTemperature: 0.1,
  batchTagTemperature: 0.1,
  weeklyTemperature: 0.25,
  sideReadTemperature: 0.35,
  attachmentTemperature: 0.1
}

const PERSONA_STYLE_KEYS = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian']
const PERSONA_BOLDNESS_KEYS = ['conservative', 'balanced', 'bold']
function createEmptyPersonaItem() {
  return {
    labelZh: '',
    labelEn: '',
    promptZh: '',
    promptEn: ''
  }
}

function createEmptyPersonaConfig() {
  return {
    styles: PERSONA_STYLE_KEYS.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {}),
    boldness: PERSONA_BOLDNESS_KEYS.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {})
  }
}
const COMMON_LOCKED_RULES = [
  '输出必须是可解析 JSON；代码会校验枚举、数值范围和字段长度，失败时回退到规则结果。',
  '只根据用户提供的事实、事件上下文和画像字段判断；不要编造行为、承诺、情绪或关系状态。',
  '未成年人场景只允许友谊、边界、安全感和健康沟通建议；不要生成成人化、性暗示、饮酒、开房、操控或越界行为建议。'
]

const PROMPT_MODULE_META = {
  eventAssessment: {
    title: '即时反馈',
    description: '首页即时反馈、评估历史快照、事件触发后的关系评分重算。',
    runtimeContext: [
      'currentAssessment={intentScore,riskScore,evidenceLevel,labels,nextAction}',
      'selfProfile={gender,ageRange,identity,zodiac,constellation,aiStyle,aiBoldness}',
      'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
      'recentEvents limited by runtimeConfig.eventContextLimit',
      'currentEvent={title,description,subjectRole,semanticTags}'
    ],
    outputContract: [
      'eventType,eventTitle,intentDelta,riskDelta,evidenceDelta,summary,rationale,categories,currentStatus,eventInsight,rawReply',
      'eventType: positive | risk | verification | note',
      'currentStatus 只返回 tags, summary, caution。',
      'rawReply 四段标题：小咪先回答你的问题 / 对方可能在想 / 下一步可以这样推进 / 留个心眼（每段2-3句）。第一段必须先正面回答 userQuestion.label。',
      'Do not return labels, confidence or actionAdvice for speed.',
      'eventInsight={actor,interaction,commitmentStatus,evidenceType}; all values are fixed enums and validated by code.'
    ]
  },
  eventUnderstanding: {
    title: '事件理解',
    description: '保存时间线前的事件类型、标题、语义标签自动识别。',
    runtimeContext: [
      'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
      'recentTimeline latest records',
      'newEvent={subjectRole,description}'
    ],
    outputContract: [
      'eventType,eventTitle,summary,semanticTags',
      'semanticTags={scene,behavior,outcome,risk,initiator,response,commitment}'
    ]
  },
  weeklyReview: {
    title: '近14天复盘',
    description: '关系页近14天复盘与复盘历史生成。',
    runtimeContext: [
      'selfProfile and targetProfile',
      'weekStart/weekEnd',
      'periodStats={eventCount,assessmentCount,scoreTrend}',
      '14-day key events limited by runtimeConfig.weeklyEventLimit'
    ],
    outputContract: [
      'title,trendLabel,summary,keyChanges,keyEvents,nextWeekFocus,avoidMisread',
      'trendLabel enum is validated by code.'
    ]
  },
  sideRead: {
    title: '星象速写',
    description: '属相、星座等轻量星象速写，包括即时星象速写和14天星象速写。',
    runtimeContext: [
      'instant side read: selfProfile + targetProfile + currentEvent + currentAssessment',
      '14-day side read: 14-day range + review summary + scoreTrend + 14-day key events'
    ],
    outputContract: [
      'title,summary,sections[{label,text}]',
      'sections are length-limited by code.'
    ]
  },
  attachmentAnalysis: {
    title: '附件识别',
    description: '聊天截图和图片附件的文字提取、摘要与置信度识别。',
    runtimeContext: [
      'one image attachment URL is sent as image_url content'
    ],
    outputContract: [
      '{"isChatRecord":boolean,"extractedText":"...","suggestedTitle":"...","summary":"...","confidence":"low|medium|high"}'
    ]
  }
}
function normalizeList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

function toISO(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function redactKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return `***${key.slice(-4)}`
}

function redactSettings(settings) {
  if (!settings) return null
  const clone = { ...settings }
  if (Array.isArray(clone.aiModels)) {
    clone.aiModels = clone.aiModels.map((model) => ({
      ...model,
      apiKey: model.apiKey ? redactKey(model.apiKey) : '',
      hasApiKey: Boolean(model.apiKey)
    }))
  }
  if (clone.aiApiKey) {
    clone.aiApiKey = redactKey(clone.aiApiKey)
  }
  return clone
}

function cleanText(value, maxLength = 1200) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : ''
}

function stripFixedPromptBlocks(value) {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n')
  const result = []
  let skipping = false
  const fixedHeadPattern = /^(固定输入上下文|固定返回结构|固定返回要求)\s*[：:]?\s*$/
  const editableHeadPattern = /^(业务判断标准|判断标准|输出要求|业务规则)\s*[：:]?\s*$/
  for (const line of lines) {
    const trimmed = line.trim()
    if (fixedHeadPattern.test(trimmed)) {
      skipping = true
      continue
    }
    if (skipping && editableHeadPattern.test(trimmed)) {
      skipping = false
      result.push(line)
      continue
    }
    if (skipping) continue
    result.push(line)
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function clonePlainObject(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {}
}

function createEmptyPromptConfig() {
  return PROMPT_MODULE_KEYS.reduce((result, key) => {
    result[key] = {
      enabled: true,
      goal: '',
      rules: [],
      extraPrompt: ''
    }
    return result
  }, {})
}

function getDefaultPromptConfig() {
  return createEmptyPromptConfig()
}

function normalizeRules(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback
  return (Array.isArray(source) ? source : [])
    .map((item) => cleanText(item, BUSINESS_PROMPT_LIMITS.legacyRule))
    .filter(Boolean)
    .slice(0, BUSINESS_PROMPT_LIMITS.legacyRuleItems)
}

function normalizePromptModuleConfig(value, fallback) {
  const source = value && typeof value === 'object' ? value : {}
  const safeFallback = fallback && typeof fallback === 'object'
    ? fallback
    : { enabled: true, goal: '', rules: [], extraPrompt: '' }
  return {
    enabled: source.enabled !== false,
    goal: Object.prototype.hasOwnProperty.call(source, 'goal')
      ? cleanText(source.goal, BUSINESS_PROMPT_LIMITS.legacyGoal)
      : safeFallback.goal,
    rules: normalizeRules(source.rules, safeFallback.rules),
    extraPrompt: Object.prototype.hasOwnProperty.call(source, 'extraPrompt')
      ? cleanText(source.extraPrompt, BUSINESS_PROMPT_LIMITS.legacyExtraPrompt)
      : safeFallback.extraPrompt
  }
}

function normalizePromptConfig(value, baseValue) {
  const defaults = getDefaultPromptConfig()
  const source = value && typeof value === 'object' ? value : {}
  const base = baseValue && typeof baseValue === 'object' ? baseValue : {}
  const result = {}

  for (const key of PROMPT_MODULE_KEYS) {
    const fallback = defaults[key] || { enabled: true, goal: '', rules: [], extraPrompt: '' }
    result[key] = normalizePromptModuleConfig(
      Object.prototype.hasOwnProperty.call(source, key)
        ? source[key]
        : base[key],
      fallback
    )
  }

  return result
}


function cleanPersonaText(value, maxLength) {
  const text = cleanText(value, maxLength)
  return /^[?\s]+$/.test(text) ? '' : text
}

function normalizePersonaItem(value, fallback) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    labelZh: cleanPersonaText(source.labelZh, 40) || fallback.labelZh,
    labelEn: cleanPersonaText(source.labelEn, 60) || fallback.labelEn,
    promptZh: cleanPersonaText(source.promptZh, 260) || fallback.promptZh,
    promptEn: cleanPersonaText(source.promptEn, 320) || fallback.promptEn
  }
}

function normalizePersonaConfig(value) {
  const source = value && typeof value === 'object' ? value : {}
  const defaults = createEmptyPersonaConfig()
  return {
    styles: PERSONA_STYLE_KEYS.reduce((result, key) => {
      result[key] = normalizePersonaItem(source.styles?.[key], defaults.styles[key])
      return result
    }, {}),
    boldness: PERSONA_BOLDNESS_KEYS.reduce((result, key) => {
      result[key] = normalizePersonaItem(source.boldness?.[key], defaults.boldness[key])
      return result
    }, {})
  }
}
function clampNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(clamped) : Number(clamped.toFixed(2))
}

function normalizeRuntimeConfig(value, baseValue) {
  const source = value && typeof value === 'object' ? value : {}
  const base = baseValue && typeof baseValue === 'object' ? baseValue : {}
  const fallback = { ...DEFAULT_RUNTIME_CONFIG, ...base }
  return {
    eventContextLimit: clampNumber(source.eventContextLimit, fallback.eventContextLimit, 3, 8, true),
    weeklyEventLimit: clampNumber(source.weeklyEventLimit, fallback.weeklyEventLimit, 5, 20, true),
    weeklySideEventLimit: clampNumber(source.weeklySideEventLimit, fallback.weeklySideEventLimit, 3, 12, true),
    eventMaxTokens: clampNumber(source.eventMaxTokens, fallback.eventMaxTokens, 300, 1400, true),
    eventUnderstandingMaxTokens: clampNumber(source.eventUnderstandingMaxTokens, fallback.eventUnderstandingMaxTokens, 120, 600, true),
    batchTagMaxTokens: clampNumber(source.batchTagMaxTokens, fallback.batchTagMaxTokens, 200, 1200, true),
    weeklyMaxTokens: clampNumber(source.weeklyMaxTokens, fallback.weeklyMaxTokens, 300, 1600, true),
    sideReadMaxTokens: clampNumber(source.sideReadMaxTokens, fallback.sideReadMaxTokens, 200, 1200, true),
    attachmentMaxTokens: clampNumber(source.attachmentMaxTokens, fallback.attachmentMaxTokens, 400, 2400, true),
    eventTemperature: clampNumber(source.eventTemperature, fallback.eventTemperature, 0, 1),
    eventUnderstandingTemperature: clampNumber(source.eventUnderstandingTemperature, fallback.eventUnderstandingTemperature, 0, 1),
    batchTagTemperature: clampNumber(source.batchTagTemperature, fallback.batchTagTemperature, 0, 1),
    weeklyTemperature: clampNumber(source.weeklyTemperature, fallback.weeklyTemperature, 0, 1),
    sideReadTemperature: clampNumber(source.sideReadTemperature, fallback.sideReadTemperature, 0, 1),
    attachmentTemperature: clampNumber(source.attachmentTemperature, fallback.attachmentTemperature, 0, 1)
  }
}

function applySettingsDefaults(settings) {
  const base = settings ? { ...settings } : getDefaultSettings()
  base.promptConfigVersion = 1
  base.promptConfig = normalizePromptConfig(base.promptConfig)
  base.promptModules = base.promptModules && typeof base.promptModules === 'object' ? base.promptModules : {}
  base.personaConfig = normalizePersonaConfig(base.personaConfig)
  base.runtimeConfigVersion = 1
  base.runtimeConfig = normalizeRuntimeConfig(base.runtimeConfig)
  return base
}

function appendPreviewSection(lines, title, items) {
  if (!Array.isArray(items) || items.length === 0) return
  if (lines.length > 0) lines.push('')
  lines.push(title)
  items.forEach((item, index) => {
    lines.push(String(index + 1) + '. ' + item)
  })
}

function readBusinessPromptConfig(settings, moduleKey, legacyConfig) {
  const source = settings && typeof settings === 'object' ? settings : {}
  const moduleConfig = source.promptModules && typeof source.promptModules === 'object' ? source.promptModules[moduleKey] : null
  const business = moduleConfig && typeof moduleConfig === 'object' && moduleConfig.businessPrompt && typeof moduleConfig.businessPrompt === 'object' ? moduleConfig.businessPrompt : null
  if (!business) {
    return {
      enabled: legacyConfig && legacyConfig.enabled === false ? false : true,
      nameZh: PROMPT_MODULE_META[moduleKey] && PROMPT_MODULE_META[moduleKey].title || moduleKey,
      nameEn: moduleKey,
      roleZh: cleanText(legacyConfig && legacyConfig.goal, BUSINESS_PROMPT_LIMITS.roleZh),
      roleEn: '',
      taskZh: cleanText(legacyConfig && legacyConfig.goal, BUSINESS_PROMPT_LIMITS.taskZh),
      taskEn: '',
      rules: Array.isArray(legacyConfig && legacyConfig.rules) ? legacyConfig.rules.slice(0, BUSINESS_PROMPT_LIMITS.ruleItems).map((item) => ({ zh: cleanText(item, BUSINESS_PROMPT_LIMITS.ruleZh), en: '' })).filter((item) => item.zh) : [],
      outputSchema: {},
      outputNotes: legacyConfig && legacyConfig.extraPrompt ? [{ zh: cleanText(stripFixedPromptBlocks(legacyConfig.extraPrompt), BUSINESS_PROMPT_LIMITS.outputNoteZh), en: '' }].filter((item) => item.zh) : []
    }
  }
  return {
    enabled: moduleConfig.enabled !== false && business.enabled !== false,
    nameZh: cleanText(business.nameZh, 60) || (PROMPT_MODULE_META[moduleKey] && PROMPT_MODULE_META[moduleKey].title) || moduleKey,
    nameEn: cleanText(business.nameEn, 80) || moduleKey,
    roleZh: cleanText(business.roleZh, BUSINESS_PROMPT_LIMITS.roleZh),
    roleEn: cleanText(business.roleEn, BUSINESS_PROMPT_LIMITS.roleEn),
    taskZh: cleanText(business.taskZh, BUSINESS_PROMPT_LIMITS.taskZh),
    taskEn: cleanText(business.taskEn, BUSINESS_PROMPT_LIMITS.taskEn),
    rules: Array.isArray(business.rules) ? business.rules.slice(0, BUSINESS_PROMPT_LIMITS.ruleItems).map((item) => ({ zh: cleanText((item && item.zh) || item, BUSINESS_PROMPT_LIMITS.ruleZh), en: cleanText(item && item.en, BUSINESS_PROMPT_LIMITS.ruleEn) })).filter((item) => item.zh || item.en) : [],
    outputSchema: clonePlainObject(business.outputSchema),
    outputNotes: Array.isArray(business.outputNotes) ? business.outputNotes.slice(0, BUSINESS_PROMPT_LIMITS.outputNoteItems).map((item) => ({ zh: cleanText(stripFixedPromptBlocks((item && item.zh) || item), BUSINESS_PROMPT_LIMITS.outputNoteZh), en: '' })).filter((item) => item.zh) : []
  }
}

function formatBilingualList(items) {
  return (items || []).map((item) => item.zh || item.en).filter(Boolean)
}

function getCallNames(moduleKey) {
  if (moduleKey === 'eventAssessment') return ['createTimeline: eventAssessment', 'generateAssessmentAI: eventAssessment']
  if (moduleKey === 'eventUnderstanding') return ['createTimeline: eventUnderstanding', 'generateAssessmentAI: eventUnderstanding']
  if (moduleKey === 'weeklyReview') return ['weeklyReview: generateReview']
  if (moduleKey === 'sideRead') return ['generateSideRead: instant side read', 'weeklyReview: 14-day side read']
  if (moduleKey === 'attachmentAnalysis') return ['analyzeAttachment: image/chat screenshot']
  return [moduleKey]
}

function getSafetyPreview(moduleKey) {
  const common = [
    '只使用用户提供的事实和运行时上下文；不要编造未出现的行为、承诺、情绪或关系状态。',
    '必须返回匹配固定输出结构的可解析 JSON；代码会校验枚举、范围、长度和兜底行为。'
  ]
  const moduleSpecific = {
    eventAssessment: [
      '评分变化必须基于真实的对象动作、回应、兑现、回避或拒绝。',
      '涉及边界敏感事件时，不要默认同意亲密升级，优先尊重、节奏和安全。',
      '未成年人场景只允许友谊、边界、安全和健康沟通建议。'
    ],
    eventUnderstanding: [
      '必须区分用户、对象、双方和主体不清；主体不清时降低判断强度。',
      '涉及未成年人、性暗示或私密空间表述时，直接分类并避免正常化风险亲密表达。'
    ],
    weeklyReview: [
      '只总结提供的近14天事件和评估变化，不编造长期趋势。',
      '未成年人场景避免成人化、越界或操控建议。'
    ],
    sideRead: [
      '属相星座只作为轻量参考，不能当成诊断或事实。',
      '不要用属相星座鼓励操控、试探底线或越界。',
      '未成年人场景使用保守、边界优先表达。'
    ],
    attachmentAnalysis: [
      '看不清的截图内容必须留空或标注不确定，不要编造文字。',
      '不要识别或扩散敏感个人信息，除非它是用户提供内容中完成任务所必需的上下文。'
    ]
  }
  return common.concat(moduleSpecific[moduleKey] || [])
}

function getRuntimePreview(moduleKey) {
  const map = {
    eventAssessment: [
      'persona: selfProfile.aiStyle + selfProfile.aiBoldness -> backend personaConfig; under18 and boundary-sensitive events may override final style/intensity.',
      'currentAssessment={intentScore,riskScore,evidenceLevel,labels}',
      'selfProfile={gender,ageRange,identity,zodiac,constellation,aiStyle,aiBoldness}',
      'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
      'recentEvents limited by runtimeConfig.eventContextLimit',
      'currentEvent={title,description,subjectRole,semanticTags,...}'
    ],
    eventUnderstanding: [
      'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
      'recentTimeline latest 3 records',
      'newEvent={subjectRole,description}'
    ],
    weeklyReview: [
      'persona: selfProfile.aiStyle + selfProfile.aiBoldness -> backend personaConfig; under18 may override final style/intensity.',
      'selfProfile, target name, targetProfile',
      '14-day review range: weekStart to weekEnd',
      'periodStats={eventCount,assessmentCount,scoreTrend}',
      '14-day key events limited by runtimeConfig.weeklyEventLimit'
    ],
    sideRead: [
      'persona: selfProfile.aiStyle + selfProfile.aiBoldness -> backend personaConfig; under18 may override final style/intensity.',
      'instant side read: selfProfile + targetProfile + currentEvent + currentAssessment',
      '14-day side read: 14-day range + review summary + scoreTrend + 14-day key events'
    ],
    attachmentAnalysis: [
      'one image attachment URL is sent as image_url content',
      'no persona is used for this call'
    ]
  }
  return map[moduleKey] || []
}

function buildPersonaPreview(settings, moduleKey) {
  if (moduleKey === 'eventUnderstanding' || moduleKey === 'attachmentAnalysis') return []
  const persona = normalizePersonaConfig(settings && settings.personaConfig)
  return [
    '小程序只保存用户选择的风格和强度 key。',
    '后台提供每个 key 对应的中文模板，安全规则可覆盖最终风格。'
  ].concat(
    PERSONA_STYLE_KEYS.map((key) => key + ': ' + persona.styles[key].labelZh + ' - ' + persona.styles[key].promptZh),
    PERSONA_BOLDNESS_KEYS.map((key) => key + ': ' + persona.boldness[key].labelZh + ' - ' + persona.boldness[key].promptZh)
  )
}

function buildPromptPreview(moduleKey, moduleConfig, settings) {
  const meta = PROMPT_MODULE_META[moduleKey] || { title: moduleKey, description: '' }
  const guardrails = PROMPT_MODULE_META[moduleKey] || { outputContract: [] }
  const business = readBusinessPromptConfig(settings, moduleKey, moduleConfig)
  const lines = [
    '调用: ' + getCallNames(moduleKey).join(' | '),
    '模块: ' + meta.title,
    meta.description ? '说明: ' + meta.description : '',
    '',
    '最终拼接顺序:',
    '1. 系统安全护栏，包括未成年人、边界、图片等条件规则。',
    '2. 陪伴风格文案：用户选择 key + 后台中文模板 + 安全覆盖规则。',
    '3. 后台业务提示词：角色、任务、规则、输出要求。',
    '4. 运行时上下文：实际用户、事件、画像和评分数据在调用时注入。'
  ].filter(Boolean)

  appendPreviewSection(lines, '实际参与的安全护栏', getSafetyPreview(moduleKey))
  appendPreviewSection(lines, '陪伴风格块', buildPersonaPreview(settings, moduleKey))
  appendPreviewSection(lines, '后台业务提示词', business.enabled === false
    ? ['该模块已在后台业务提示词中停用。代码仍保留安全护栏和运行时上下文。']
    : [
        '名称: ' + business.nameZh,
        '角色: ' + (business.roleZh || '[空]'),
        '任务: ' + (business.taskZh || '[空]')
      ].concat(
        formatBilingualList(business.rules).map((item) => '规则: ' + item),
        formatBilingualList(business.outputNotes).map((item) => '输出要求: ' + item)
      ))
  appendPreviewSection(lines, '固定输出结构', guardrails.outputContract || [])
  appendPreviewSection(lines, '调用时注入的运行时上下文', getRuntimePreview(moduleKey))
  return lines.join('\n')
}

function buildPromptMessageLines(items) {
  return (items || [])
    .map((item, index) => {
      const value = typeof item === 'string' ? { zh: item, en: '' } : (item || {})
      const zh = cleanText(value.zh, 1800)
      return zh ? String(index + 1) + '. ' + zh : ''
    })
    .filter(Boolean)
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

function buildTimelineRecordTitle(input) {
  const normalized = cleanText(input, 1200).replace(/\s+/g, ' ')
  if (!normalized) return '后台测试记录'
  const firstChunk = normalized
    .split(/[。！？!?；;，,\n]/)
    .map((item) => item.trim())
    .find(Boolean) || normalized
  return firstChunk.length <= 20 ? firstChunk : firstChunk.slice(0, 20).trim() + '...'
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

function mapRelationType(value) {
  const map = { romantic: 'Crush', close_friend: 'Friend Crush' }
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

function describeSubjectRoleForPrompt(role) {
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

function isBoundarySensitivePromptEvent(event) {
  const content = `${event?.title || ''} ${event?.description || ''}`
  return ['酒店', '开房', '过夜', '小树林', '私密', '暧昧', '亲', '抱', '摸', '身体', '上床', '发生关系', '边界', '性', '喝酒后']
    .some((item) => content.includes(item))
}

function resolvePreviewPersona(settings, selfProfile, options = {}) {
  const persona = normalizePersonaConfig(settings && settings.personaConfig)
  const requestedStyle = PERSONA_STYLE_KEYS.includes(selfProfile?.aiStyle) ? selfProfile.aiStyle : 'gentle_bestie'
  const requestedBoldness = PERSONA_BOLDNESS_KEYS.includes(selfProfile?.aiBoldness) ? selfProfile.aiBoldness : 'balanced'
  const isMinor = selfProfile?.ageRange === 'under18'
  const boundarySensitive = Boolean(options.boundarySensitive)
  const effectiveStyle = isMinor ? 'careful_guardian' : requestedStyle
  const effectiveBoldness = isMinor
    ? 'conservative'
    : boundarySensitive && requestedBoldness === 'bold'
      ? 'balanced'
      : requestedBoldness
  return {
    isMinor,
    boundarySensitive,
    style: persona.styles[effectiveStyle] || createEmptyPersonaItem(),
    boldness: persona.boldness[effectiveBoldness] || createEmptyPersonaItem()
  }
}

function buildPreviewPersonaPrompt(settings, selfProfile, options = {}) {
  const persona = resolvePreviewPersona(settings, selfProfile, options)
  const promptLines = []
  const systemParts = []

  if (persona.style.labelZh || persona.style.promptZh) {
    promptLines.push(`当前陪伴风格: ${persona.style.labelZh}。${persona.style.promptZh}`)
  }
  if (persona.boldness.labelZh || persona.boldness.promptZh) {
    promptLines.push(`当前建议强度: ${persona.boldness.labelZh}。${persona.boldness.promptZh}`)
  }
  if (persona.style.labelZh) {
    systemParts.push(`当前陪伴风格: ${persona.style.labelZh}。`)
  }
  if (persona.boldness.labelZh) {
    systemParts.push(`建议强度: ${persona.boldness.labelZh}。`)
  }
  if (persona.boundarySensitive) {
    promptLines.push('安全覆盖规则: 当前事件涉及亲密、边界或关系升级。不要替用户同意，优先提醒尊重、节奏和安全。')
  }
  if (persona.isMinor) {
    promptLines.push('安全覆盖规则: 用户未满 18 岁。只允许友谊、边界、安全和健康沟通建议。')
  }

  return {
    systemPrompt: systemParts.join(' '),
    userPrompt: promptLines.join('\n')
  }
}

function hasBusinessPromptContent(business) {
  return Boolean(
    business?.roleZh ||
    business?.taskZh ||
    (Array.isArray(business?.rules) && business.rules.length > 0) ||
    (Array.isArray(business?.outputNotes) && business.outputNotes.length > 0) ||
    (business?.outputSchema && Object.keys(business.outputSchema).length > 0)
  )
}

function buildActualPromptMessages({ settings, recordContent, selfProfile, caseProfile, latestResult, recentTimeline }) {
  const normalizedSettings = applySettingsDefaults(settings)
  const moduleKey = 'eventAssessment'
  const business = readBusinessPromptConfig(
    normalizedSettings,
    moduleKey,
    normalizedSettings.promptConfig && normalizedSettings.promptConfig[moduleKey]
  )
  if (!business || business.enabled === false || !hasBusinessPromptContent(business)) return null

  const description = cleanText(recordContent, 1600)
  const previewEvent = {
    id: 'admin_prompt_preview',
    title: buildTimelineRecordTitle(description),
    type: 'note',
    subjectRole: 'target',
    subjectRoleConfidence: 'user_selected',
    description,
    semanticTags: {},
    occurrenceAt: new Date().toISOString()
  }
  const currentAssessment = latestResult && typeof latestResult === 'object'
    ? {
        intentScore: latestResult.intentScore,
        riskScore: latestResult.riskScore ?? latestResult.consistencyRiskScore,
        evidenceLevel: latestResult.evidenceLevel,
        labels: latestResult.labels || latestResult.primaryLabels || [],
        nextAction: latestResult.nextAction
      }
    : {
        intentScore: 50,
        riskScore: 35,
        evidenceLevel: 'E2',
        labels: ['后台提示词预览'],
        nextAction: 'observe'
      }
  const personaPrompt = buildPreviewPersonaPrompt(normalizedSettings, selfProfile, {
    boundarySensitive: isBoundarySensitivePromptEvent(previewEvent)
  })
  const guardrails = COMMON_LOCKED_RULES
  const systemLines = [
    '安全护栏:',
    ...buildPromptMessageLines(guardrails),
    personaPrompt.systemPrompt
  ].filter(Boolean)
  const userLines = [
    `模块: ${business.nameZh}`,
    business.roleZh ? `角色: ${business.roleZh}` : '',
    business.taskZh ? `任务: ${business.taskZh}` : '',
    business.rules.length ? '业务规则:' : '',
    ...buildPromptMessageLines(business.rules),
    Object.keys(business.outputSchema || {}).length > 0 ? `输出结构:\n${JSON.stringify(business.outputSchema)}` : '',
    business.outputNotes.length ? '输出要求:' : '',
    ...buildPromptMessageLines(business.outputNotes),
    '运行时上下文:',
    personaPrompt.userPrompt,
    '只返回 JSON。必需字段：eventType,eventTitle,intentDelta,riskDelta,evidenceDelta,summary,rationale,categories,currentStatus,eventInsight,rawReply。不要返回 labels、confidence 或 actionAdvice。',
    'currentStatus 只需要 tags,summary,caution。rawReply 四段标题：小咪先回答你的问题 / 对方可能在想 / 下一步可以这样推进 / 留个心眼（每段2-3句）。第一段必须先正面回答 userQuestion.label。',
    'eventInsight 只能使用枚举：actor=target|self|both|unknown；interaction=initiated|responded|rejected|delayed|fulfilled|promised|observed|unclear；commitmentStatus=none|promised|fulfilled|broken|unclear；evidenceType=fact|feeling|mixed|unclear。',
    describeSubjectRoleForPrompt(previewEvent.subjectRole),
    `当前评估快照: ${JSON.stringify(currentAssessment)}`,
    `本人画像: ${serializeSelfProfile(selfProfile)}`,
    `Crush 画像: ${serializeCaseProfile(caseProfile)}`,
    `最近事件: ${JSON.stringify(compactRecentTimeline(recentTimeline, previewEvent.id))}`,
    `本次事件: ${JSON.stringify(previewEvent)}`
  ].filter(Boolean)

  return [
    { role: 'system', content: systemLines.join('\n') },
    { role: 'user', content: userLines.join('\n') }
  ]
}

function mergePreviewSettings(base, event) {
  const draft = event && typeof event.draftSettings === 'object' ? event.draftSettings : {}
  return applySettingsDefaults({
    ...base,
    promptModules: draft.promptModules && typeof draft.promptModules === 'object'
      ? draft.promptModules
      : base.promptModules,
    personaConfig: draft.personaConfig && typeof draft.personaConfig === 'object'
      ? draft.personaConfig
      : base.personaConfig,
    runtimeConfig: draft.runtimeConfig && typeof draft.runtimeConfig === 'object'
      ? draft.runtimeConfig
      : base.runtimeConfig
  })
}
function buildPromptAdminView(settings) {
  const normalized = applySettingsDefaults(settings)
  const modules = {}

  for (const key of PROMPT_MODULE_KEYS) {
    const moduleConfig = normalized.promptConfig[key]
    const guardrails = { lockedRules: COMMON_LOCKED_RULES }
    const meta = PROMPT_MODULE_META[key] || { title: key, description: '' }
    modules[key] = {
      key,
      title: meta.title,
      description: meta.description,
      guardrails: guardrails.lockedRules || [],
      runtimeContext: guardrails.runtimeContext || [],
      outputContract: guardrails.outputContract || [],
      effectivePreview: buildPromptPreview(key, moduleConfig, normalized)
    }
  }

  return {
    version: 1,
    policyLines: [
      '业务提示词（角色、任务、规则、输出要求）只从后台 promptModules 读取。',
      '后台缺字段时不再回退到代码里的业务提示词；该模块会规则兜底或跳过 AI。',
      '安全护栏、输出结构校验、未成年人和边界敏感保护保留在代码中，并在后台只读可见。',
      '最终拼接顺序：安全护栏 + 用户选择的人格模板 + 后台业务提示词 + 运行时上下文。'
    ],
    modules
  }
}

function normalizePromptAdminView(value, settings) {
  const generated = buildPromptAdminView(settings)
  const source = value && typeof value === 'object' ? value : {}
  const modules = {}

  for (const key of PROMPT_MODULE_KEYS) {
    const current = source.modules && typeof source.modules === 'object' && source.modules[key]
      ? source.modules[key]
      : {}
    const fallback = generated.modules[key]
    modules[key] = {
      key,
      title: cleanText(current.title, 40) || fallback.title,
      description: cleanText(current.description, 120) || fallback.description,
      guardrails: Array.isArray(current.guardrails)
        ? current.guardrails.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 12)
        : fallback.guardrails,
      runtimeContext: Array.isArray(current.runtimeContext)
        ? current.runtimeContext.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 12)
        : fallback.runtimeContext,
      outputContract: Array.isArray(current.outputContract)
        ? current.outputContract.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 12)
        : fallback.outputContract,
      effectivePreview: fallback.effectivePreview
    }
  }

  return {
    version: 1,
    policyLines: Array.isArray(source.policyLines)
      ? source.policyLines.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 12)
      : generated.policyLines,
    modules
  }
}

function buildAdminAISettings(settings) {
  const normalized = applySettingsDefaults(settings || getDefaultSettings())
  normalized.promptAdminView = normalizePromptAdminView(normalized.promptAdminView, normalized)
  normalized.defaultPromptConfig = getDefaultPromptConfig()
  return redactSettings(normalized)
}

function getDefaultSettings() {
  return {
    _id: GLOBAL_AI_SETTINGS_ID,
    scope: 'global',
    key: 'ai',
    settingsVersion: 2,
    aiEnabled: false,
    aiFallbackToRules: true,
    aiModels: [
      {
        id: 'default',
        name: '默认模型',
        provider: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: ''
      }
    ],
    aiDefaultModelId: 'default',
    promptConfigVersion: 1,
    promptConfig: getDefaultPromptConfig(),
    promptAdminView: normalizePromptAdminView(null, { promptConfig: getDefaultPromptConfig() }),
    personaConfig: normalizePersonaConfig(null),
    runtimeConfigVersion: 1,
    runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG }
  }
}

function normalizeModels(models, existingModels) {
  if (!Array.isArray(models)) return null
  return models.map((model, index) => {
    const existing = existingModels.find((item) => item.id === model.id) || {}
    return {
      id: model.id || existing.id || (index === 0 ? 'default' : `model_${index + 1}`),
      name: model.name || existing.name || '默认模型',
      provider: model.provider || existing.provider || 'openai-compatible',
      baseUrl: model.baseUrl || existing.baseUrl || 'https://api.openai.com/v1',
      model: model.model || existing.model || 'gpt-4o-mini',
      apiKey: typeof model.apiKey === 'string' && model.apiKey && !model.apiKey.startsWith('***')
        ? model.apiKey
        : (existing.apiKey || ''),
      quota: Number(model.quota || existing.quota || 0),
      tokensUsed: Number(existing.tokensUsed || 0)
    }
  })
}

function getDefaultModel(models, defaultModelId) {
  if (!Array.isArray(models) || models.length === 0) return null
  return models.find((item) => item.id === defaultModelId) || models[0]
}

async function getStrictAuthUserId() {
  const userInfo = await app.auth().getUserInfo()
  const candidates = [
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  const error = new Error('UNAUTHENTICATED')
  error.code = 'UNAUTHENTICATED'
  throw error
}

async function getUserById(userId) {
  const res = await db.collection('users').doc(userId).get()
  return normalizeDoc(res)
}

async function requireAdminUser() {
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  const userIds = []

  userIds.push(await getStrictAuthUserId())

  for (const userId of [...new Set(userIds)]) {
    const user = await getUserById(userId)
    const email = String(user?.email || '').trim().toLowerCase()
    const isAdmin = Boolean(user?.isAdmin) || user?.role === 'admin' || adminEmails.includes(email)

    if (isAdmin) {
      return { userId, user }
    }
  }

  if (userIds.length === 0) {
    const error = new Error('UNAUTHENTICATED')
    error.code = 'UNAUTHENTICATED'
    throw error
  }

  const error = new Error('ADMIN_REQUIRED')
  error.code = 'ADMIN_REQUIRED'
  throw error
}

async function getGlobalAISettingsRaw() {
  const byDoc = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  const doc = normalizeDoc(byDoc)
  if (doc) return doc

  const byScope = await db.collection('system_settings')
    .where({ scope: 'global', key: 'ai' })
    .limit(1)
    .get()
  if (byScope.data && byScope.data.length > 0) return byScope.data[0]

  return null
}

async function persistPromptAdminViewIfNeeded(settings) {
  if (!settings || !settings._id) return settings
  const normalized = applySettingsDefaults(settings)
  const promptAdminView = normalizePromptAdminView(settings.promptAdminView, normalized)
  const missingModules = !settings.promptAdminView?.modules
  const missingDetails = PROMPT_MODULE_KEYS.some((key) => {
    const module = settings.promptAdminView?.modules?.[key]
    return !module
      || !Array.isArray(module.guardrails)
      || !Array.isArray(module.runtimeContext)
      || !Array.isArray(module.outputContract)
  })

  if (!missingModules && !missingDetails) return { ...settings, promptAdminView }

  await db.collection('system_settings').doc(settings._id).update({
    promptAdminView,
    promptAdminViewSyncedAt: new Date()
  })
  return { ...settings, promptAdminView }
}

async function getOverview(currentUserId = '', currentUser = null) {
  const [usersRes, casesRes, settings] = await Promise.all([
    db.collection('users').limit(100).get(),
    db.collection('cases').limit(1000).get(),
    getGlobalAISettingsRaw()
  ])
  const normalizedSettings = settings
    ? applySettingsDefaults(settings)
    : getDefaultSettings()

  const cases = casesRes.data || []
  const caseCountByUser = cases.reduce((map, item) => {
    const userId = item.userId || ''
    if (userId) map[userId] = (map[userId] || 0) + 1
    return map
  }, {})

  const users = (usersRes.data || []).map((user) => {
    let planLabel = '免费版'
    const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null
    if (trialEnd && !isNaN(trialEnd.getTime()) && new Date() < trialEnd) {
      planLabel = '试用期'
    } else if (user.plan === 'pro') {
      planLabel = 'Pro'
    } else if (user.plan === 'ultra') {
      planLabel = 'Ultra'
    } else if (user.plan) {
      planLabel = user.plan === 'free' ? '免费版' : user.plan
    }
    return {
    id: user._id,
    email: user.email || '',
    phone: user.phone || '',
    loginType: user.loginType || (user.phone ? 'wechat_phone' : 'email'),
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin) || user.role === 'admin',
    plan: user.plan || 'free',
    planLabel,
    caseCount: caseCountByUser[user._id] || 0,
    createdAt: toISO(user.createdAt),
    updatedAt: toISO(user.updatedAt),
    lastLoginAt: toISO(user.lastLoginAt)
  }})

  return {
    success: true,
    currentUser: {
      id: currentUser?._id || currentUserId || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      loginType: currentUser?.loginType || (currentUser?.phone ? 'wechat_phone' : 'email'),
      role: currentUser?.role || (currentUser?.isAdmin ? 'admin' : 'user'),
      isAdmin: Boolean(currentUser?.isAdmin) || currentUser?.role === 'admin'
    },
    users,
    stats: {
      userCount: users.length,
      caseCount: cases.length,
      aiEnabled: Boolean(normalizedSettings?.aiEnabled)
    },
    aiSettings: buildAdminAISettings(normalizedSettings)
  }
}

async function getUserDetail(event) {
  const userId = String(event.targetUserId || event.detailUserId || event.userId || '').trim()
  if (!userId) return { success: false, message: '缺少用户 ID' }

  const [user, casesRes] = await Promise.all([
    getUserById(userId),
    db.collection('cases').where({ userId }).limit(100).get()
  ])

  if (!user) return { success: false, message: '用户不存在' }

  const cases = casesRes.data || []
  const caseIds = cases.map((item) => item._id)
  const [timelineGroups, assessmentGroups] = await Promise.all([
    Promise.all(caseIds.map((caseId) => db.collection('timeline_records').where({ caseId }).limit(100).get())),
    Promise.all(caseIds.map((caseId) => db.collection('assessments').where({ caseId }).limit(100).get()))
  ])

  const userInfo = {
    id: user._id || '',
    email: user.email || '',
    phone: user.phone || '',
    loginType: user.loginType || '',
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin) || user.role === 'admin',
    plan: user.plan || 'free',
    trialEndsAt: (user.trialEndsAt && !isNaN(new Date(user.trialEndsAt).getTime())) ? toISO(user.trialEndsAt) : null,
    planExpiresAt: (user.planExpiresAt && !isNaN(new Date(user.planExpiresAt).getTime())) ? toISO(user.planExpiresAt) : null,
    extraTokens: Number(user.extraTokens || 0),
    monthlyTokensUsed: Number(user.monthlyTokensUsed || 0),
    inviteCode: String(user.inviteCode || ''),
    referralCount: Number(user.referralCount || 0),
    landingChannel: String(user.landingChannel || ''),
    landingScene: String(user.landingScene || ''),
    landingRef: String(user.landingRef || ''),
    landingShareId: String(user.landingShareId || ''),
    landingInviteCode: String(user.landingInviteCode || ''),
    createdAt: toISO(user.createdAt),
    updatedAt: toISO(user.updatedAt),
    lastLoginAt: toISO(user.lastLoginAt)
  }

  return {
    success: true,
    user: userInfo,
    cases: cases.map((item, index) => ({
      id: item._id,
      name: item.name || item.profile?.name || '未命名 Crush',
      createdAt: toISO(item.createdAt),
      updatedAt: toISO(item.updatedAt),
      latestResultId: item.latestResultId || '',
      timelineCount: (timelineGroups[index].data || []).length,
      assessmentCount: (assessmentGroups[index].data || []).length
    }))
  }
}

async function updateAISettings(event, adminUserId) {
  const existing = await getGlobalAISettingsRaw()
  const base = applySettingsDefaults(existing || getDefaultSettings())
  const existingModels = Array.isArray(base.aiModels) ? base.aiModels : []
  const normalizedModels = normalizeModels(event.models, existingModels) || existingModels
  const defaultModelId = event.defaultModelId || base.aiDefaultModelId || normalizedModels[0]?.id || 'default'
  const defaultModel = getDefaultModel(normalizedModels, defaultModelId)
  const now = new Date()
  const update = {
    scope: 'global',
    key: 'ai',
    settingsVersion: 2,
    aiEnabled: Boolean(event.aiEnabled),
    aiFallbackToRules: event.aiFallbackToRules !== false,
    aiModels: normalizedModels,
    aiDefaultModelId: defaultModelId,
    promptConfigVersion: 1,
    promptConfig: normalizePromptConfig(event.promptConfig, base.promptConfig),
    promptModules: event.promptModules && typeof event.promptModules === 'object'
      ? event.promptModules
      : (base.promptModules || {}),
    petSpeakConfig: event.petSpeakConfig && typeof event.petSpeakConfig === 'object'
      ? event.petSpeakConfig
      : (base.petSpeakConfig || {}),
    personaConfig: normalizePersonaConfig(event.personaConfig || base.personaConfig),
    runtimeConfigVersion: 1,
    runtimeConfig: normalizeRuntimeConfig(event.runtimeConfig, base.runtimeConfig),
    aiProvider: defaultModel?.provider || 'openai-compatible',
    aiBaseUrl: defaultModel?.baseUrl || 'https://api.openai.com/v1',
    aiModel: defaultModel?.model || 'gpt-4o-mini',
    aiApiKey: defaultModel?.apiKey || '',
    updatedAt: now,
    updatedBy: adminUserId
  }
  update.promptAdminView = normalizePromptAdminView(event.promptAdminView || base.promptAdminView, update)

  if (!existing) {
    await db.collection('system_settings').add({
      _id: GLOBAL_AI_SETTINGS_ID,
      createdAt: now,
      ...update
    })
  } else {
    await db.collection('system_settings').doc(existing._id).update(update)
  }

  const saved = await getGlobalAISettingsRaw()
  return { success: true, aiSettings: buildAdminAISettings(saved) }
}

async function previewPrompt(event) {
  const moduleKey = String(event.moduleKey || 'eventAssessment').trim()
  if (moduleKey !== 'eventAssessment') {
    return { success: false, message: '目前只支持即时反馈记录的实际提示词预览' }
  }

  const recordContent = cleanText(event.recordContent, 1600)
  if (!recordContent) return { success: false, message: '请先输入一条记录内容' }
  const caseId = String(event.caseId || '').trim()
  if (!caseId) return { success: false, message: '请先选择一个 Crush' }

  const existing = await getGlobalAISettingsRaw()
  const base = applySettingsDefaults(existing || getDefaultSettings())
  const settings = mergePreviewSettings(base, event)
  const defaultModel = getDefaultModel(settings.aiModels, settings.aiDefaultModelId)
  const caseDoc = normalizeDoc(await db.collection('cases').doc(caseId).get().catch(() => null))
  if (!caseDoc) return { success: false, message: '所选 Crush 不存在' }

  const ownerUserId = String(caseDoc.userId || '').trim()
  const [selfProfileRes, latestAssessmentRes, timelineRes] = await Promise.all([
    ownerUserId ? db.collection('users').doc(ownerUserId).get().catch(() => null) : Promise.resolve(null),
    db.collection('assessments').where({ caseId }).orderBy('createdAt', 'desc').limit(1).get().catch(() => null),
    db.collection('timeline_records').where({ caseId }).orderBy('occurrenceAt', 'desc').limit(8).get().catch(() => null)
  ])
  const selfProfile = normalizeDoc(selfProfileRes)?.selfProfile || null
  const latestAssessment = normalizeDoc(latestAssessmentRes)
  const recentTimeline = (timelineRes?.data || [])
    .filter((item) => item?.type !== 'assessment' && item?.type !== 'trend')
    .map((item) => ({
      id: item._id || item.id,
      title: item.title,
      type: item.type,
      subjectRole: item.subjectRole,
      description: item.description,
      occurrenceAt: item.occurrenceAt
    }))
  const messages = buildActualPromptMessages({
    settings,
    recordContent,
    selfProfile,
    caseProfile: caseDoc.profile || {},
    latestResult: latestAssessment,
    recentTimeline
  })

  if (!messages) {
    return {
      success: false,
      message: '即时反馈业务提示词为空或已停用，实际调用时会跳过 AI 或规则兜底'
    }
  }

  return {
    success: true,
    moduleKey,
    model: defaultModel?.model || settings.aiModel || '',
    provider: defaultModel?.provider || settings.aiProvider || '',
    baseUrl: defaultModel?.baseUrl || settings.aiBaseUrl || '',
    messages,
    promptText: messages.map((item) => `[${item.role}]\n${item.content}`).join('\n\n'),
    recentTimeline
  }
}

async function getBillingSettings(event) {
  const billing = await ensureBillingSettings(db)
  return { success: true, billing }
}

async function updateBillingSettings(event, adminUserId) {
  const existing = await ensureBillingSettings(db)

  const welcomeTokens = Number(event.welcomeTokens)
  const tokensPerYuan = Number(event.tokensPerYuan)
  const rechargeTiers = Array.isArray(event.rechargeTiers) ? event.rechargeTiers : existing.rechargeTiers
  const modelPricing = Array.isArray(event.modelPricing) ? event.modelPricing : existing.modelPricing
  const insufficientBalanceMode = String(event.insufficientBalanceMode || existing.insufficientBalanceMode || 'block')
  const noUsageFallback = String(event.noUsageFallback || existing.noUsageFallback || 'zero')

  if (Number.isNaN(welcomeTokens) || welcomeTokens < 0 || welcomeTokens > 100000000) {
    return { success: false, message: '首次赠送额度需在 0 ~ 1亿 之间' }
  }
  if (Number.isNaN(tokensPerYuan) || tokensPerYuan < 1 || tokensPerYuan > 10000000) {
    return { success: false, message: '兑换比例需在 1 ~ 1000万 之间' }
  }
  if (!['block', 'allow'].includes(insufficientBalanceMode)) {
    return { success: false, message: '余额不足模式无效' }
  }
  if (!['zero', 'fallback', 'fixed'].includes(noUsageFallback)) {
    return { success: false, message: 'Usage缺失策略无效' }
  }
  for (let i = 0; i < rechargeTiers.length; i++) {
    const t = rechargeTiers[i]
    if (!t.id || !t.name) return { success: false, message: `充值档位${i + 1}缺少 id 或名称` }
    const pf = Number(t.priceFen)
    if (Number.isNaN(pf) || pf < 1 || pf > 1000000) return { success: false, message: `充值档位"${t.name}"价格需在 1分 ~ 1万元 之间` }
    const bt = Number(t.bonusTokens)
    if (Number.isNaN(bt) || bt < 0 || bt > 100000000) return { success: false, message: `充值档位"${t.name}"赠送额度需在 0 ~ 1亿 之间` }
  }
  for (let i = 0; i < modelPricing.length; i++) {
    const m = modelPricing[i]
    if (!m.modelId) return { success: false, message: `模型倍率${i + 1}缺少 modelId` }
    const cm = Number(m.costMultiplier)
    if (Number.isNaN(cm) || cm < 0.01 || cm > 1000) return { success: false, message: `模型"${m.modelId}"倍率需在 0.01 ~ 1000 之间` }
  }

  const now = new Date()
  const update = {
    firstGiftEnabled: event.firstGiftEnabled !== undefined ? Boolean(event.firstGiftEnabled) : existing.firstGiftEnabled,
    welcomeTokens,
    tokensPerYuan,
    rechargeTiers: rechargeTiers.map((t, i) => ({
      id: t.id,
      name: t.name,
      priceFen: Number(t.priceFen),
      bonusTokens: Number(t.bonusTokens),
      grantCalls: t.grantCalls != null ? Number(t.grantCalls) : undefined,
      bonusCalls: t.bonusCalls != null ? Number(t.bonusCalls) : 0,
      tagline: t.tagline || '',
      enabled: t.enabled !== false,
      sortOrder: t.sortOrder != null ? Number(t.sortOrder) : i
    })),
    modelPricing: modelPricing.map(m => ({
      modelId: m.modelId,
      costMultiplier: Number(m.costMultiplier),
      enabled: m.enabled !== false
    })),
    insufficientBalanceMode,
    noUsageFallback,
    updatedAt: now,
    updatedBy: adminUserId
  }

  await db.collection('system_settings').doc(existing._id).update(update)

  const { data } = await db.collection('system_settings').doc(existing._id).get()
  const saved = (data && data.length > 0) ? data[0] : update
  return { success: true, billing: saved }
}

// ─── 订阅配置管理 ─────────────────────────────────────

async function getSubscriptionConfigAdmin(event) {
  const { ensureSubscriptionConfig } = require('./_shared/subscription')
  const config = await ensureSubscriptionConfig(db)
  return { success: true, config }
}

function stripSystemAndUndefinedFields(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    return value.map(stripSystemAndUndefinedFields).filter(item => item !== undefined)
  }
  if (typeof value === 'object') {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === '_id' || key === '_openid') continue
      const cleaned = stripSystemAndUndefinedFields(item)
      if (cleaned !== undefined) result[key] = cleaned
    }
    return result
  }
  return value
}

async function updateSubscriptionConfigAdmin(event, adminUserId) {
  try {
    const { ensureSubscriptionConfig } = require('./_shared/subscription')
    const existing = await ensureSubscriptionConfig(db)

    if (!existing || !existing._id) {
      return { success: false, message: '订阅配置文档初始化失败' }
    }

    // 合并传入的字段（不能包含 _id）
    const { _id, ...updated } = { ...existing }

    if (event.trial) {
      updated.trial = {
        enabled: event.trial.enabled !== undefined ? Boolean(event.trial.enabled) : existing.trial?.enabled,
        durationDays: Number.isFinite(Number(event.trial.durationDays)) ? Number(event.trial.durationDays) : existing.trial?.durationDays,
        extendOnReferral: Number.isFinite(Number(event.trial.extendOnReferral)) ? Number(event.trial.extendOnReferral) : existing.trial?.extendOnReferral
      }
      if (Array.isArray(event.trial.features)) updated.trial.features = event.trial.features
      if (Array.isArray(event.trial.excludedFeatures)) updated.trial.excludedFeatures = event.trial.excludedFeatures
    }

    if (event.plans) {
      updated.plans = { ...existing.plans }
      for (const key of ['free', 'pro', 'ultra']) {
        if (event.plans[key]) {
          // features/excludedFeatures 用数组原样，其他字段用展开合并
          const { features, excludedFeatures, ...rest } = event.plans[key]
          updated.plans[key] = { ...existing.plans[key], ...rest }
          if (Array.isArray(features)) updated.plans[key].features = features
          if (Array.isArray(excludedFeatures)) updated.plans[key].excludedFeatures = excludedFeatures
        }
      }
    }

    if (event.referral) {
      updated.referral = { ...existing.referral, ...event.referral }
    }

    if (event.tokenExchangeRate !== undefined) {
      updated.tokenExchangeRate = Number(event.tokenExchangeRate) || 1
    }
    if (event.featureEstTokens) {
      updated.featureEstTokens = { ...existing.featureEstTokens, ...event.featureEstTokens }
    }
    if (event.welcomeTokens !== undefined) {
      updated.welcomeTokens = Number(event.welcomeTokens) || 0
    }
    // 兼容旧字段名
    if (event.welcomeCalls !== undefined && event.welcomeTokens === undefined) {
      updated.welcomeTokens = Number(event.welcomeCalls) || 0
    }

    updated.updatedAt = new Date()
    updated.updatedBy = adminUserId

    const patch = stripSystemAndUndefinedFields(updated)
    await db.collection('system_settings').doc(existing._id).update(patch)

    const { data } = await db.collection('system_settings').doc(existing._id).get()
    const saved = (data && data.length > 0) ? data[0] : updated
    return { success: true, config: saved }
  } catch (error) {
    console.error('updateSubscriptionConfigAdmin error:', error)
    return { success: false, message: '订阅配置保存失败: ' + (error?.message || String(error)) }
  }
}

async function adminGrantExtraCallsAction(event, adminUserId) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  const amount = Number(event.amount)
  if (Number.isNaN(amount) || amount <= 0 || amount > 10000) {
    return { success: false, message: '次数需在 1 ~ 10000 之间' }
  }
  const remark = String(event.remark || '管理员手动加次数').trim()

  const { addExtraTokens } = require('./_shared/subscription')
  const result = await addExtraTokens(db, targetUserId, amount, remark)

  if (!result.success) return result

  return { success: true, userId: targetUserId, amount, extraCallsAfter: 'see user doc' }
}

async function getTokenLedger(event) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  const limit = Math.min(Number(event.limit) || 50, 200)
  const { data } = await db.collection('token_ledger_records')
    .where({ userId: targetUserId })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return { success: true, records: data || [] }
}

// 各用户 Token 消耗汇总（平台 Token + 模型 Token）
async function getUsersTokenConsumption(event = {}) {
  const limit = Math.min(Number(event.limit) || 500, 2000)
  const userMap = {}

  // token_ledger_records 有真实倍率扣减记录，且不会和 call_usage_records 重复
  try {
    const { data } = await db.collection('token_ledger_records')
      .where({ type: 'consume' })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    for (const r of (data || [])) {
      const uid = r.userId
      if (!uid) continue
      if (!userMap[uid]) userMap[uid] = { userId: uid, platformTokens: 0, modelTokens: 0, callCount: 0, lastUsed: null }
      // amountTokens 是负数（扣减），取绝对值；这是真实平台 Token（已乘倍率）
      userMap[uid].platformTokens += Math.abs(Number(r.amountTokens || 0))
      userMap[uid].modelTokens += Number(r.realTokens || 0)
      userMap[uid].callCount += 1
      const d = new Date(r.createdAt)
      if (!userMap[uid].lastUsed || d > userMap[uid].lastUsed) userMap[uid].lastUsed = d
    }
  } catch (_) {}
  const ledgerUserIds = new Set(Object.keys(userMap))

  // 补充：如果某用户在 ledger 里没有记录，尝试从 call_usage_records 补充
  try {
    const { data } = await db.collection('call_usage_records')
      .where({ type: 'consume' })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    for (const r of (data || [])) {
      const uid = r.userId
      if (!uid || ledgerUserIds.has(uid)) continue  // 已有 ledger 数据则跳过
      if (!userMap[uid]) userMap[uid] = { userId: uid, platformTokens: 0, modelTokens: 0, callCount: 0, lastUsed: null }
      userMap[uid].platformTokens += Number(r.platformTokens || 0)
      userMap[uid].modelTokens += Number(r.modelTokens || 0)
      userMap[uid].callCount += 1
      const d = new Date(r.createdAt)
      if (!userMap[uid].lastUsed || d > userMap[uid].lastUsed) userMap[uid].lastUsed = d
    }
  } catch (_) {}

  // 3. 批量查用户邮箱/手机
  const userIds = Object.keys(userMap)
  const userInfos = {}
  if (userIds.length > 0) {
    const batches = []
    for (let i = 0; i < userIds.length; i += 100) {
      batches.push(userIds.slice(i, i + 100))
    }
    for (const batch of batches) {
      try {
        const { data: us } = await db.collection('users')
          .where({ _id: db.command.in(batch) })
          .field({ email: true, phone: true })
          .get()
        for (const u of (us || [])) {
          userInfos[u._id] = { email: u.email || '', phone: u.phone || '' }
        }
      } catch (_) {}
    }
  }

  // 4. 组装结果，按 platformTokens 降序
  const rows = Object.values(userMap)
    .sort((a, b) => b.platformTokens - a.platformTokens)
    .map(r => ({
      userId: r.userId,
      email: userInfos[r.userId]?.email || '',
      phone: userInfos[r.userId]?.phone || '',
      platformTokens: r.platformTokens,
      modelTokens: r.modelTokens,
      callCount: r.callCount,
      lastUsed: r.lastUsed ? r.lastUsed.toISOString() : ''
    }))

  return { success: true, rows, totalUsers: rows.length }
}

// 单用户 Token 消费明细
async function getUserTokenDetails(event = {}) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  const limit = Math.min(Number(event.limit) || 200, 500)

  const records = []

  // token_ledger_records（最完整：platform/模型 token + 倍率 + 功能名）
  try {
    const { data } = await db.collection('token_ledger_records')
      .where({ userId: targetUserId, type: 'consume' })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    for (const r of (data || [])) {
      records.push({
        _id: r._id,
        feature: r.feature || r.remark || '',
        platformTokens: Math.abs(Number(r.amountTokens || 0)),
        modelTokens: Number(r.realTokens || 0),
        rate: Number(r.chargeMultiplier || 1),
        model: r.model || '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
        source: 'ledger'
      })
    }
  } catch (_) {}

  // 如果 ledger 为空，从 call_usage_records 补充
  if (records.length === 0) {
    try {
      const { data } = await db.collection('call_usage_records')
        .where({ userId: targetUserId, type: 'consume' })
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
      for (const r of (data || [])) {
        records.push({
          _id: r._id,
          feature: r.feature || '',
          platformTokens: Number(r.platformTokens || 0),
          modelTokens: Number(r.modelTokens || 0),
          rate: Number(r.exchangeRate || 1),
          model: '',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
          source: 'call_usage'
        })
      }
    } catch (_) {}
  }

  return { success: true, records }
}

async function adminManualRecharge(event, adminUserId) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  const amountTokens = Number(event.amountTokens)
  if (Number.isNaN(amountTokens) || amountTokens === 0 || amountTokens < -100000000 || amountTokens > 100000000) {
    return { success: false, message: '额度需在 -1亿 ~ 1亿 之间（不含 0）' }
  }
  const isDeduction = amountTokens < 0
  const safeRemark = String(event.remark || (isDeduction ? 'admin token deduction' : 'admin token grant')).trim()
  const nowForTokenAdjustment = new Date()
  const userForTokenAdjustmentRes = await db.collection('users').doc(targetUserId).get()
  const userForTokenAdjustment = Array.isArray(userForTokenAdjustmentRes.data)
    ? userForTokenAdjustmentRes.data[0]
    : userForTokenAdjustmentRes.data
  const currentExtraTokens = Number(userForTokenAdjustment?.extraTokens || 0)
  const nextExtraTokens = currentExtraTokens + amountTokens
  if (nextExtraTokens < 0) return { success: false, message: 'extraTokens cannot be negative after adjustment' }

  await db.collection('users').doc(targetUserId).update({
    extraTokens: db.command.inc(amountTokens)
  })
  await db.collection('call_usage_records').add({
    userId: targetUserId,
    type: amountTokens > 0 ? 'grant' : 'adjust',
    source: 'adminManualRecharge',
    amount: amountTokens,
    remark: safeRemark,
    createdAt: nowForTokenAdjustment
  })

  return {
    success: true,
    account: {
      userId: targetUserId,
      balanceTokens: nextExtraTokens,
      extraTokens: nextExtraTokens,
      updatedAt: nowForTokenAdjustment
    }
  }
  const remark = String(event.remark || (isDeduction ? '管理员调减额度' : '管理员手动充值')).trim()

  const { ensureTokenAccount } = require('./_shared/billing')
  const account = await ensureTokenAccount(db, targetUserId)
  const newBalance = (account.balanceTokens || 0) + amountTokens
  if (newBalance < 0) return { success: false, message: '扣减后余额不能为负' }
  const now = new Date()
  try {
    const userRes = await db.collection('users').doc(targetUserId).get()
    const user = Array.isArray(userRes.data) ? userRes.data[0] : userRes.data
    const currentExtraTokens = Number(user?.extraTokens || 0)
    if (currentExtraTokens + amountTokens < 0) {
      return { success: false, message: '扣减后前台额外 Token 不能为负' }
    }
  } catch (err) {
    console.warn('precheck extraTokens on adminManualRecharge failed:', err?.message || err)
  }

  await db.collection('token_accounts').doc(account._id).update({
    balanceTokens: newBalance,
    purchasedTokens: isDeduction ? Math.max(0, (account.purchasedTokens || 0) + amountTokens) : (account.purchasedTokens || 0) + amountTokens,
    updatedAt: now
  })

  await db.collection('token_ledger_records').add({
    userId: targetUserId,
    type: 'adjust',
    amountTokens,
    balanceAfter: newBalance,
    remark: `${remark}（操作人: ${adminUserId}）`,
    createdAt: now
  })

  try {
    await db.collection('users').doc(targetUserId).update({
      extraTokens: db.command.inc(amountTokens)
    })
    await db.collection('call_usage_records').add({
      userId: targetUserId,
      type: amountTokens > 0 ? 'grant' : 'adjust',
      source: 'adminManualRecharge',
      amount: amountTokens,
      remark,
      createdAt: now
    })
  } catch (err) {
    console.warn('sync extraTokens on adminManualRecharge failed:', err?.message || err)
  }

  const updatedPurchased = isDeduction ? (account.purchasedTokens || 0) : (account.purchasedTokens || 0) + amountTokens
  return { success: true, account: { ...account, balanceTokens: newBalance, purchasedTokens: updatedPurchased } }
}

async function adminUpdateUser(event, adminUserId) {
  const targetUserId = String(event.userId || event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 userId' }

  const patch = {}
  const ALLOWED = ['plan', 'trialEndsAt', 'planExpiresAt', 'extraTokens', 'monthlyTokensUsed', 'isAdmin', 'email', 'inviteCode']

  for (const key of ALLOWED) {
    if (event[key] !== undefined && event[key] !== null) {
      if (key === 'plan') {
        const planVal = String(event[key] || '').trim()
        if (!planVal) continue
        if (!['free', 'pro', 'ultra'].includes(planVal)) {
          return { success: false, message: `无效套餐: "${planVal}"，可选值: free / pro / ultra` }
        }
        patch[key] = planVal
      } else if (key === 'trialEndsAt' || key === 'planExpiresAt') {
        if (!event[key]) {
          patch[key] = null
        } else {
          const d = new Date(event[key])
          if (isNaN(d.getTime())) {
            return { success: false, message: `无效日期: "${event[key]}"，请使用 YYYY-MM-DD 格式` }
          }
          patch[key] = d
        }
      } else if (key === 'isAdmin') {
        patch.isAdmin = Boolean(event.isAdmin)
        patch.role = event.isAdmin ? 'admin' : 'user'
      } else if (key === 'extraTokens' || key === 'monthlyTokensUsed') {
        patch[key] = Number(event[key]) || 0
      } else if (key === 'inviteCode') {
        const code = String(event[key] || '').trim()
        if (code && !/^[A-Za-z0-9]{4,10}$/.test(code)) {
          return { success: false, message: '邀请码格式无效（4-10 位字母或数字）' }
        }
        patch[key] = code
      } else if (key === 'email') {
        const emailVal = String(event[key] || '').trim()
        if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          return { success: false, message: `邮箱格式无效: "${emailVal}"` }
        }
        patch[key] = emailVal
      } else {
        patch[key] = event[key]
      }
    }
  }

  if (Object.keys(patch).length === 0) return { success: false, message: '无可更新字段' }

  // 最后一位管理员保护：不允许把自己降级（除非还有其他管理员）
  if (patch.isAdmin === false && targetUserId !== adminUserId) {
    // 检查目标用户是否是最后一个管理员
    try {
      const { data: admins } = await db.collection('users')
        .where(db.command.or([{ isAdmin: true }, { role: 'admin' }]))
        .limit(10).get()
      const adminCount = (admins || []).filter(u =>
        (u.isAdmin === true || u.role === 'admin') && u._id !== targetUserId
      ).length
      if (adminCount === 0) {
        return { success: false, message: '不能移除最后一位管理员，请先指定另一位用户为管理员' }
      }
    } catch (err) {
      console.warn('admin count check failed (non-fatal):', err.message)
    }
  }

  patch.updatedAt = new Date()
  patch.updatedBy = adminUserId

  try {
    await db.collection('users').doc(targetUserId).update(patch)
    return { success: true, patch }
  } catch (err) {
    console.error('adminUpdateUser failed:', err)
    return { success: false, message: '更新用户信息失败' }
  }
}

async function listFeedbacks() {
  try {
    const { data } = await db.collection('system_feedback')
      .limit(100)
      .get()
    const sorted = (data || []).sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime()
      const tb = new Date(b.createdAt || 0).getTime()
      return tb - ta
    })
    return { success: true, feedbacks: sorted }
  } catch (error) {
    console.error('listFeedbacks error:', error)
    return { success: false, message: error?.message || '读取反馈失败' }
  }
}

async function resolveFeedback(event) {
  const feedbackId = String(event.feedbackId || '').trim()
  if (!feedbackId) return { success: false, message: '缺少 feedbackId' }

  try {
    const fbRes = await db.collection('system_feedback').doc(feedbackId).get()
    const raw = fbRes.data
    const fb = Array.isArray(raw) ? raw[0] : raw
    if (!fb) return { success: false, message: '反馈不存在' }
    if (fb.resolved) return { success: false, message: '该反馈已处理' }

    let userId = fb.userId || event.targetUserId || ''
    if (!userId && fb.openid) {
      const userRes = await db.collection('users').where({ openid: fb.openid }).limit(1).get()
      userId = userRes.data?.[0]?._id || ''
    }

    const tokens = Math.max(0, Number(event.rewardTokens) || 0)
    if (tokens > 0) {
      if (!userId) return { success: false, message: '无法确定用户，请填写"用户ID"输入框' }
      const { addExtraTokens } = require('./_shared/subscription')
      const result = await addExtraTokens(db, userId, tokens, 'feedback_reward')
      if (!result.success) return result

      await db.collection('system_feedback').doc(feedbackId).update({
        resolved: true,
        rewardTokens: tokens,
        resolvedAt: new Date()
      })

      return { success: true }
      const { ensureTokenAccount } = require('./_shared/billing')
      const account = await ensureTokenAccount(db, userId)
      const newBalance = (account.balanceTokens || 0) + tokens
      const now = new Date()
      await db.collection('token_accounts').doc(account._id).update({
        balanceTokens: newBalance,
        updatedAt: now
      })
      await db.collection('token_ledger_records').add({
        userId,
        type: 'adjust',
        amountTokens: tokens,
        balanceAfter: newBalance,
        remark: `反馈采纳奖励：${fb.content.slice(0, 40)}`,
        createdAt: now
      })
      try {
        const { addExtraTokens } = require('./_shared/subscription')
        await addExtraTokens(db, userId, tokens, 'feedback_reward')
      } catch (err) {
        console.warn('addExtraTokens on feedback reward failed:', err?.message || err)
      }
    }

    await db.collection('system_feedback').doc(feedbackId).update({
      resolved: true,
      rewardTokens: tokens,
      resolvedAt: new Date()
    })

    return { success: true }
  } catch (error) {
    console.error('resolveFeedback error:', error)
    return { success: false, message: error?.message || '处理反馈失败' }
  }
}

async function listCustomPetRequests() {
  try {
    const { data } = await db.collection('custom_pet_requests')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    const requests = data || []

    // Resolve cloud:// file IDs to temp URLs for image display
    const allFileIds = []
    for (const req of requests) {
      if (req.referenceImages && req.referenceImages.length) {
        for (const img of req.referenceImages) {
          if (typeof img === 'string' && img.startsWith('cloud://')) allFileIds.push(img)
        }
      }
    }
    if (allFileIds.length) {
      try {
        const urlRes = await app.getTempFileURL({ fileList: allFileIds })
        const fileMap = {}
        const files = urlRes?.fileList || []
        for (const f of files) {
          if (f.fileID && f.tempFileURL) fileMap[f.fileID] = f.tempFileURL
        }
        for (const req of requests) {
          if (req.referenceImages && req.referenceImages.length) {
            req.referenceImages = req.referenceImages.map((img) => fileMap[img] || img)
          }
        }
      } catch (e) {
        console.error('listCustomPetRequests getTempFileURL error:', e)
      }
    }

    return { success: true, requests }
  } catch (error) {
    console.error('listCustomPetRequests error:', error)
    return { success: false, message: error?.message || '读取宠物需求失败' }
  }
}

async function updateCustomPetRequest(event) {
  const requestId = String(event.requestId || '').trim()
  const status = String(event.status || '').trim()
  const adminNote = String(event.adminNote || '').trim()
  const deliveredPetId = String(event.deliveredPetId || '').trim()

  if (!requestId) return { success: false, message: '缺少 requestId' }
  if (!['in_progress', 'delivered', 'rejected'].includes(status)) {
    return { success: false, message: '无效状态，可选：in_progress, delivered, rejected' }
  }
  if (status === 'delivered' && !deliveredPetId) {
    return { success: false, message: '交付时需要填写 deliveredPetId' }
  }

  try {
    const update = { status, updatedAt: new Date() }
    if (adminNote) update.adminNote = adminNote
    if (deliveredPetId) update.deliveredPetId = deliveredPetId
    if (status === 'delivered') update.deliveredAt = new Date()
    if (status === 'rejected') update.rejectedAt = new Date()

    await db.collection('custom_pet_requests').doc(requestId).update(update)
    return { success: true }
  } catch (error) {
    console.error('updateCustomPetRequest error:', error)
    return { success: false, message: error?.message || '更新宠物需求失败' }
  }
}

async function listOrders(event = {}) {
  const status = typeof event.status === 'string' ? event.status.trim() : ''
  const page = Math.max(1, parseInt(event.page, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 20))

  let query = db.collection('recharge_orders')
  if (status && status !== 'all') {
    query = query.where({ status })
  }
  const countRes = await query.count()
  const total = countRes.total || 0

  const { data } = await query
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    orders: (data || []).map((item) => ({
      _id: item._id || '',
      userId: item.userId || '',
      planName: item.planName || item.productName || '',
      amountFen: item.amountFen || item.amount || 0,
      amountYuan: item.amountYuan || ((item.amountFen || item.amount || 0) / 100).toFixed(2),
      status: item.status || 'pending',
      productType: item.productType || (item.type === 'subscription_upgrade' ? 'subscription' : 'recharge'),
      orderNo: item.orderNo || '',
      grantTokens: item.grantTokens || 0,
      createdAt: item.createdAt,
      paidAt: item.paidAt || null,
      transactionId: item.transactionId || '',
      remark: item.remark || ''
    })),
    total,
    page,
    pageSize
  }
}

async function refundOrder(event = {}) {
  const orderId = typeof event.orderId === 'string' ? event.orderId.trim() : ''
  if (!orderId) return { success: false, message: '缺少订单ID' }

  const orderRes = await db.collection('recharge_orders').doc(orderId).get()
  const order = (orderRes.data && orderRes.data.length > 0) ? orderRes.data[0] : null
  if (!order) return { success: false, message: '订单不存在' }
  if (order.status !== 'paid') return { success: false, message: '仅已支付订单可退款' }

  await db.collection('recharge_orders').doc(orderId).update({
    status: 'refunded',
    refundedAt: new Date()
  })

  const refundTokens = Number(order.grantTokens || 0)
  if (refundTokens > 0) {
    const userRes = await db.collection('users').doc(order.userId).get()
    const user = Array.isArray(userRes.data) ? userRes.data[0] : userRes.data
    const currentExtraTokens = Number(user?.extraTokens || 0)
    const deduction = Math.min(currentExtraTokens, refundTokens)
    if (deduction > 0) {
      await db.collection('users').doc(order.userId).update({
        extraTokens: db.command.inc(-deduction)
      })
    }
    await db.collection('call_usage_records').add({
      userId: order.userId,
      type: 'adjust',
      source: 'refund',
      amount: -deduction,
      relatedOrderId: orderId,
      remark: `refund: ${order.planName || order.productName || ''}`,
      createdAt: new Date()
    })
  }

  return { success: true, orderId }
}

async function deleteUser(event, currentUserId) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  if (targetUserId === currentUserId) return { success: false, message: '不能删除当前登录的管理员账号' }

  try {
    const casesRes = await db.collection('cases').where({ userId: targetUserId }).limit(500).get()
    const caseIds = (casesRes.data || []).map(c => c._id)

    if (caseIds.length > 0) {
      await db.collection('assessments').where({ caseId: db.command.in(caseIds) }).remove().catch(() => {})
      await db.collection('timeline_records').where({ caseId: db.command.in(caseIds) }).remove().catch(() => {})
    }
    await db.collection('cases').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('login_logs').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('call_usage_records').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('token_ledger_records').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('token_accounts').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('feedbacks').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('system_feedback').where({ userId: targetUserId }).remove().catch(() => {})
    await db.collection('invite_rewards').where({ inviterId: targetUserId }).remove().catch(() => {})
    await db.collection('invite_rewards').where({ inviteeId: targetUserId }).remove().catch(() => {})
    await db.collection('users').doc(targetUserId).remove()

    return { success: true, message: `已删除用户及其 ${caseIds.length} 个 Crush 和所有关联数据` }
  } catch (error) {
    console.error('[adminManage] deleteUser error:', error)
    return { success: false, message: '删除失败: ' + (error.message || '未知错误') }
  }
}

async function listReferralClaims() {
  const { data: claims } = await db.collection('referral_claims')
    .orderBy('createdAt', 'desc').limit(500).get()
  const userIds = new Set()
  ;(claims || []).forEach(c => { userIds.add(c.inviterUserId); userIds.add(c.inviteeUserId) })
  const userMap = {}
  if (userIds.size > 0) {
    const batches = [...userIds]
    for (let i = 0; i < batches.length; i += 100) {
      const { data: users } = await db.collection('users')
        .where({ _id: db.command.in(batches.slice(i, i + 100)) }).get()
      ;(users || []).forEach(u => { userMap[u._id] = { email: u.email || '', phone: u.phone || '' } })
    }
  }
  const rows = (claims || []).map(c => ({
    id: c._id,
    inviteeId: c.inviteeUserId,
    inviteeLabel: userMap[c.inviteeUserId]?.email || userMap[c.inviteeUserId]?.phone || c.inviteeUserId?.slice(0, 20),
    inviterId: c.inviterUserId,
    inviterLabel: userMap[c.inviterUserId]?.email || userMap[c.inviterUserId]?.phone || c.inviterUserId?.slice(0, 20),
    inviteCode: c.inviteCode || '',
    channel: c.channel || '',
    status: c.status || '',
    inviterTokens: c.inviterTokens || 0,
    inviteeTokens: c.inviteeTokens || 0,
    createdAt: c.createdAt,
    rewardedAt: c.rewardedAt
  }))
  return { success: true, rows, total: rows.length, totalInviterRewards: rows.reduce((s, r) => s + r.inviterTokens, 0), totalInviteeRewards: rows.reduce((s, r) => s + r.inviteeTokens, 0) }
}

exports.main = async (event = {}) => {
  try {
    const { userId, user } = await requireAdminUser()
    const action = String(event.action || '').trim()

    if (action === 'getOverview') return await getOverview(userId, user)
    if (action === 'getUserDetail') return await getUserDetail(event)
    if (action === 'adminUpdateUser') return await adminUpdateUser(event, userId)
    if (action === 'updateAISettings') return await updateAISettings(event, userId)
    if (action === 'previewPrompt') return await previewPrompt(event)
    if (action === 'getBillingSettings') return await getBillingSettings(event)
    if (action === 'updateBillingSettings') return await updateBillingSettings(event, userId)
    if (action === 'getSubscriptionConfig') return await getSubscriptionConfigAdmin(event)
    if (action === 'updateSubscriptionConfig') return await updateSubscriptionConfigAdmin(event, userId)
    if (action === 'adminGrantExtraCalls') return await adminGrantExtraCallsAction(event, userId)
    if (action === 'getTokenLedger') return await getTokenLedger(event)
    if (action === 'getUsersTokenConsumption') return await getUsersTokenConsumption(event)
    if (action === 'getUserTokenDetails') return await getUserTokenDetails(event)
    if (action === 'adminManualRecharge') return await adminManualRecharge(event, userId)
    if (action === 'listFeedbacks') return await listFeedbacks()
    if (action === 'resolveFeedback') return await resolveFeedback(event)
    if (action === 'listCustomPetRequests') return await listCustomPetRequests()
    if (action === 'updateCustomPetRequest') return await updateCustomPetRequest(event)
    if (action === 'listOrders') return await listOrders(event)
    if (action === 'refundOrder') return await refundOrder(event)
    if (action === 'deleteUser') return await deleteUser(event, userId)
    if (action === 'listReferralClaims') return await listReferralClaims()

    return { success: false, message: '未知后台操作' }
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED' || error?.message === 'UNAUTHENTICATED') {
      return { success: false, message: '请先登录管理员账号', code: 'UNAUTHENTICATED' }
    }
    if (error?.code === 'ADMIN_REQUIRED' || error?.message === 'ADMIN_REQUIRED') {
      return { success: false, message: '当前账号没有后台管理权限', code: 'ADMIN_REQUIRED' }
    }
    console.error('adminManage error:', error)
    return { success: false, message: '后台操作失败' }
  }
}







