const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'
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
const PROMPT_MODULE_META = {
  eventAssessment: {
    title: '即时反馈',
    description: '首页即时反馈、评估历史快照、事件触发后的关系评分重算。'
  },
  eventUnderstanding: {
    title: '事件理解',
    description: '保存时间线前的事件类型、标题、语义标签自动识别。'
  },
  weeklyReview: {
    title: '近14天复盘',
    description: '关系页近14天复盘与复盘历史生成。'
  },
  sideRead: {
    title: '星象速写',
    description: '属相、星座等轻量星象速写，包括即时星象速写和14天星象速写。'
  },
  attachmentAnalysis: {
    title: '附件识别',
    description: '聊天截图和图片附件的文字提取、摘要与置信度识别。'
  }
}
const PROMPT_FIXED_GUARDRAILS = {
  eventAssessment: {
    lockedRules: [
      '只根据用户提供的事实、事件上下文和画像字段判断；不要编造行为、承诺、情绪或关系状态。',
      'subjectRole 为 self/both/unknown 时，代码会自动降权或修正评分。',
      '涉及亲密、边界、酒精或私密空间时，不替用户同意升级关系，优先尊重、节奏和安全。',
      '未成年人只允许友谊、边界、安全感和健康沟通建议。',
      'AI 返回后仍会校验枚举、数值范围、字段长度，并在失败时按规则兜底。'
    ],
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
      'rawReply 只允许三段标题：小咪觉得对方可能在想 / 小咪觉得可以这样 / 小咪说留个心眼。',
      'Do not return labels, confidence or actionAdvice for speed.',
      'eventInsight={actor,interaction,commitmentStatus,evidenceType}; all values are fixed enums and validated by code.',
      'JSON only; code validates and normalizes the result.'
    ]
  },
  eventUnderstanding: {
    lockedRules: [
      '只根据当前事件描述和辅助上下文分类；不要推断未出现的回应或承诺。',
      '必须区分用户动作、对象动作和双方互动；主体不清时降低置信度。',
      '拒绝、回避、失约、冷淡、拖延等负向边界优先识别为风险。',
      '输出必须是可解析 JSON，代码会校验 eventType、semanticTags 和 commitment 枚举。'
    ],
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
    lockedRules: [
      '只总结近14天提供的事件和评估变化，不编造长期趋势。',
      '未成年人场景不生成成人化、越界或操控建议。',
      'AI 返回后会校验 trendLabel、数组长度和空值兜底。'
    ],
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
    lockedRules: [
      '星象速写只能作为轻量参考，不得伪装成确定事实、医学诊断或心理诊断。',
      '不用属相星座鼓励操控、试探底线或越界行为。',
      '未成年人场景使用保守、边界优先表达。'
    ],
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
    lockedRules: [
      '看不清的内容必须留空或标注不确定，不要编造截图文字。',
      '不识别或扩散敏感个人信息，除非它是用户提供内容中完成任务所必需的上下文。',
      '输出必须是可解析 JSON，代码会校验字段和置信度枚举。'
    ],
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
    personaConfig: normalizePersonaConfig(null),
    runtimeConfigVersion: 1,
    runtimeConfig: { ...DEFAULT_RUNTIME_CONFIG }
  }
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
  return {
    enabled: source.enabled !== false,
    goal: Object.prototype.hasOwnProperty.call(source, 'goal')
      ? cleanText(source.goal, BUSINESS_PROMPT_LIMITS.legacyGoal)
      : fallback.goal,
    rules: normalizeRules(source.rules, fallback.rules),
    extraPrompt: Object.prototype.hasOwnProperty.call(source, 'extraPrompt')
      ? cleanText(source.extraPrompt, BUSINESS_PROMPT_LIMITS.legacyExtraPrompt)
      : fallback.extraPrompt
  }
}

function normalizePromptConfig(value, baseValue) {
  const defaults = getDefaultPromptConfig()
  const source = value && typeof value === 'object' ? value : {}
  const base = baseValue && typeof baseValue === 'object' ? baseValue : {}
  const result = {}

  for (const key of PROMPT_MODULE_KEYS) {
    result[key] = normalizePromptModuleConfig(
      Object.prototype.hasOwnProperty.call(source, key)
        ? source[key]
        : base[key],
      defaults[key]
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
  const guardrails = PROMPT_FIXED_GUARDRAILS[moduleKey] || { outputContract: [] }
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
function buildPromptAdminView(settings) {
  const normalized = applySettingsDefaults(settings)
  const modules = {}

  for (const key of PROMPT_MODULE_KEYS) {
    const moduleConfig = normalized.promptConfig[key]
    const guardrails = PROMPT_FIXED_GUARDRAILS[key] || { lockedRules: [], runtimeContext: [], outputContract: [] }
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

function normalizeModels(models, existingModels) {
  if (!Array.isArray(models)) return null

  return models.map((model, index) => {
    const existingModel = existingModels.find((item) => item.id === model.id) || {}
    const id = model.id || existingModel.id || (index === 0 ? 'default' : `model_${index + 1}`)

    return {
      id,
      name: model.name || existingModel.name || '默认模型',
      provider: model.provider || existingModel.provider || 'openai-compatible',
      baseUrl: model.baseUrl || existingModel.baseUrl || 'https://api.openai.com/v1',
      model: model.model || existingModel.model || 'gpt-4o-mini',
      apiKey: typeof model.apiKey === 'string' && model.apiKey && !model.apiKey.startsWith('***')
        ? model.apiKey
        : (existingModel.apiKey || '')
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

function getEventAuthUserId(event = {}) {
  const candidates = [
    event.authUserId,
    event.userId
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return ''
}

async function requireAdminUserId(event = {}) {
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  const userIds = []

  try {
    userIds.push(await getStrictAuthUserId())
  } catch (error) {
    if (error?.code !== 'UNAUTHENTICATED' && error?.message !== 'UNAUTHENTICATED') {
      throw error
    }
  }

  const eventUserId = getEventAuthUserId(event)
  if (eventUserId) userIds.push(eventUserId)

  for (const userId of [...new Set(userIds)]) {
    const userRes = await db.collection('users').doc(userId).get()
    const user = normalizeDoc(userRes)
    const email = String(user?.email || '').trim().toLowerCase()
    const isAdmin = Boolean(user?.isAdmin) || user?.role === 'admin' || adminEmails.includes(email)

    if (isAdmin) return userId
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

exports.main = async (event) => {
  const {
    models,
    defaultModelId,
    aiEnabled,
    aiFallbackToRules
  } = event

  try {
    const adminUserId = await requireAdminUserId(event)
    const now = new Date()
    const existingSettings = await getGlobalAISettingsRaw()
    const baseSettings = applySettingsDefaults(existingSettings || getDefaultSettings())
    const existingModels = Array.isArray(baseSettings.aiModels) ? baseSettings.aiModels : []
    const normalizedModels = normalizeModels(models, existingModels) || existingModels
    const finalDefaultModelId = defaultModelId || baseSettings.aiDefaultModelId || normalizedModels[0]?.id || 'default'
    const syncedDefaultModel = getDefaultModel(normalizedModels, finalDefaultModelId)

    const update = {
      scope: 'global',
      key: 'ai',
      updatedAt: now,
      updatedBy: adminUserId,
      settingsVersion: 2,
      aiEnabled: !!aiEnabled,
      aiFallbackToRules: aiFallbackToRules !== false,
      aiModels: normalizedModels,
      aiDefaultModelId: finalDefaultModelId,
      promptConfigVersion: 1,
      promptConfig: normalizePromptConfig(event.promptConfig, baseSettings.promptConfig),
      promptModules: event.promptModules && typeof event.promptModules === 'object'
        ? event.promptModules
        : (baseSettings.promptModules || {}),
      personaConfig: normalizePersonaConfig(event.personaConfig || baseSettings.personaConfig),
      runtimeConfigVersion: 1,
      runtimeConfig: normalizeRuntimeConfig(event.runtimeConfig, baseSettings.runtimeConfig)
    }
    update.promptAdminView = normalizePromptAdminView(event.promptAdminView || baseSettings.promptAdminView, update)

    if (syncedDefaultModel) {
      update.aiProvider = syncedDefaultModel.provider || 'openai-compatible'
      update.aiBaseUrl = syncedDefaultModel.baseUrl || 'https://api.openai.com/v1'
      update.aiModel = syncedDefaultModel.model || 'gpt-4o-mini'
      update.aiApiKey = syncedDefaultModel.apiKey || ''
    }

    if (!existingSettings) {
      await db.collection('system_settings').add({
        _id: GLOBAL_AI_SETTINGS_ID,
        createdAt: now,
        ...update
      })
    } else {
      await db.collection('system_settings').doc(existingSettings._id).update(update)
    }

    return { success: true }
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED') {
      return { success: false, message: '请先登录管理员账号' }
    }
    if (error?.code === 'ADMIN_REQUIRED') {
      return { success: false, message: '当前账号没有后台管理权限' }
    }
    console.error('updateAISettings error:', error)
    return { success: false, message: '更新 AI 设置失败' }
  }
}







