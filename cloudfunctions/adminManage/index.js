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
  weeklyMaxTokens: 650,
  sideReadMaxTokens: 550,
  attachmentMaxTokens: 1200,
  eventTemperature: 0.2,
  eventUnderstandingTemperature: 0.1,
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
    title: '即时反馈 / Event assessment',
    description: '首页即时反馈、评估历史快照、事件触发后的关系评分重算。'
  },
  eventUnderstanding: {
    title: '事件理解 / Event understanding',
    description: '保存时间线前的事件类型、标题、语义标签自动识别。'
  },
  weeklyReview: {
    title: '本周复盘 / Weekly review',
    description: '关系页本周复盘与复盘历史生成。'
  },
  sideRead: {
    title: '侧写 / Side read',
    description: '属相、星座等轻量侧写，包括即时侧写和周侧写。'
  },
  attachmentAnalysis: {
    title: '附件识别 / Attachment analysis',
    description: '聊天截图和图片附件的文字提取、摘要与置信度识别。'
  }
}
const PROMPT_FIXED_GUARDRAILS = {
  eventAssessment: {
    lockedRules: [
      'ZH: 只根据用户提供的事实、事件上下文和画像字段判断；不要编造行为、承诺、情绪或关系状态。 / EN: Judge only from provided facts, event context, and profile fields; do not invent actions, promises, emotions, or relationship status.',
      'ZH: subjectRole 为 self/both/unknown 时，代码会自动降权或修正评分。 / EN: When subjectRole is self, both, or unknown, code reduces weight or corrects score changes.',
      'ZH: 涉及亲密、边界、酒精或私密空间时，不替用户同意升级关系，优先尊重、节奏和安全。 / EN: For intimacy, boundary, alcohol, or private-space contexts, never consent on the user behalf; prioritize respect, pacing, and safety.',
      'ZH: 未成年人只允许友谊、边界、安全感和健康沟通建议。 / EN: For minors, only allow friendship, boundaries, safety, and healthy communication advice.',
      'ZH: AI 返回后仍会校验枚举、数值范围、字段长度，并在失败时按规则兜底。 / EN: AI output is validated for enums, numeric ranges, and field lengths, with rule fallback on failure.'
    ],
    runtimeContext: [
      'currentAssessment={intentScore,riskScore,evidenceLevel,labels,nextAction}',
      'selfProfile={gender,ageRange,identity,zodiac,constellation,aiStyle,aiBoldness}',
      'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
      'recentEvents limited by runtimeConfig.eventContextLimit',
      'currentEvent={title,description,subjectRole,semanticTags}'
    ],
    outputContract: [
      'eventType,eventTitle,intentDelta,riskDelta,evidenceDelta,summary,rationale,categories,currentStatus,rawReply',
      'eventType: positive | risk | verification | note',
      'currentStatus only needs tags, summary, caution.',
      'rawReply uses exactly three headings: 对方可能的心理 / 你下一步怎么做 / 重点观察什么.',
      'Do not return labels, confidence, actionAdvice or eventInsight for speed.',
      'JSON only; code validates and normalizes the result.'
    ]
  },
  eventUnderstanding: {
    lockedRules: [
      'ZH: 只根据当前事件描述和辅助上下文分类；不要推断未出现的回应或承诺。 / EN: Classify only from current event description and supporting context; do not infer absent responses or promises.',
      'ZH: 必须区分用户动作、对象动作和双方互动；主体不清时降低置信度。 / EN: Distinguish user actions, target actions, and mutual interactions; lower confidence when actor is unclear.',
      'ZH: 拒绝、回避、失约、冷淡、拖延等负向边界优先识别为风险。 / EN: Rejection, avoidance, no-show, coldness, or delay should be prioritized as risk.',
      'ZH: 输出必须是可解析 JSON，代码会校验 eventType、semanticTags 和 commitment 枚举。 / EN: Output must be parseable JSON; code validates eventType, semanticTags, and commitment enums.'
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
      'ZH: 只总结本周提供的事件和评估变化，不编造长期趋势。 / EN: Summarize only provided weekly events and assessment changes; do not invent long-term trends.',
      'ZH: 未成年人场景不生成成人化、越界或操控建议。 / EN: For minors, do not generate adult, boundary-crossing, or manipulative advice.',
      'ZH: AI 返回后会校验 trendLabel、数组长度和空值兜底。 / EN: AI output is validated for trendLabel, array lengths, and empty fallbacks.'
    ],
    runtimeContext: [
      'selfProfile and targetProfile',
      'weekStart/weekEnd',
      'weeklyStats={eventCount,assessmentCount,scoreTrend}',
      'weekly key events limited by runtimeConfig.weeklyEventLimit'
    ],
    outputContract: [
      'title,trendLabel,summary,keyChanges,keyEvents,nextWeekFocus,avoidMisread',
      'trendLabel enum is validated by code.'
    ]
  },
  sideRead: {
    lockedRules: [
      'ZH: 侧写只能作为轻量参考，不得伪装成确定事实、医学诊断或心理诊断。 / EN: Profile reading is lightweight reference only, never fact or medical/psychological diagnosis.',
      'ZH: 不用属相星座鼓励操控、试探底线或越界行为。 / EN: Do not use zodiac or astrology to encourage manipulation, boundary testing, or boundary crossing.',
      'ZH: 未成年人场景使用保守、边界优先表达。 / EN: For minors, use conservative and boundary-first wording.'
    ],
    runtimeContext: [
      'instant side read: selfProfile + targetProfile + currentEvent + currentAssessment',
      'weekly side read: week range + review summary + scoreTrend + weekly key events'
    ],
    outputContract: [
      'title,summary,sections[{label,text}]',
      'sections are length-limited by code.'
    ]
  },
  attachmentAnalysis: {
    lockedRules: [
      'ZH: 看不清的内容必须留空或标注不确定，不要编造截图文字。 / EN: Unreadable content must be empty or marked uncertain; do not fabricate screenshot text.',
      'ZH: 不识别或扩散敏感个人信息，除非它是用户提供内容中完成任务所必需的上下文。 / EN: Do not identify or spread sensitive personal information unless necessary for the task context.',
      'ZH: 输出必须是可解析 JSON，代码会校验字段和置信度枚举。 / EN: Output must be parseable JSON; code validates fields and confidence enums.'
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
    weeklyMaxTokens: clampNumber(source.weeklyMaxTokens, fallback.weeklyMaxTokens, 300, 1600, true),
    sideReadMaxTokens: clampNumber(source.sideReadMaxTokens, fallback.sideReadMaxTokens, 200, 1200, true),
    attachmentMaxTokens: clampNumber(source.attachmentMaxTokens, fallback.attachmentMaxTokens, 400, 2400, true),
    eventTemperature: clampNumber(source.eventTemperature, fallback.eventTemperature, 0, 1),
    eventUnderstandingTemperature: clampNumber(source.eventUnderstandingTemperature, fallback.eventUnderstandingTemperature, 0, 1),
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
      outputNotes: legacyConfig && legacyConfig.extraPrompt ? [{ zh: cleanText(legacyConfig.extraPrompt, BUSINESS_PROMPT_LIMITS.outputNoteZh), en: '' }] : []
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
    outputNotes: Array.isArray(business.outputNotes) ? business.outputNotes.slice(0, BUSINESS_PROMPT_LIMITS.outputNoteItems).map((item) => ({ zh: cleanText((item && item.zh) || item, BUSINESS_PROMPT_LIMITS.outputNoteZh), en: cleanText(item && item.en, BUSINESS_PROMPT_LIMITS.outputNoteEn) })).filter((item) => item.zh || item.en) : []
  }
}

function formatBilingualList(items) {
  return (items || []).map((item) => item.en ? ((item.zh || '') + ' / EN: ' + item.en) : (item.zh || item.en)).filter(Boolean)
}

function getCallNames(moduleKey) {
  if (moduleKey === 'eventAssessment') return ['createTimeline: eventAssessment', 'generateAssessmentAI: eventAssessment']
  if (moduleKey === 'eventUnderstanding') return ['createTimeline: eventUnderstanding', 'generateAssessmentAI: eventUnderstanding']
  if (moduleKey === 'weeklyReview') return ['weeklyReview: generateReview']
  if (moduleKey === 'sideRead') return ['generateSideRead: instant side read', 'weeklyReview: weekly side read']
  if (moduleKey === 'attachmentAnalysis') return ['analyzeAttachment: image/chat screenshot']
  return [moduleKey]
}

function getSafetyPreview(moduleKey) {
  const common = [
    'Always: use only provided facts and runtime context; do not fabricate missing actions, promises, emotions, or relationship status.',
    'Always: return parseable JSON matching the fixed output schema; code validates enums, ranges, lengths, and fallback behavior.'
  ]
  const moduleSpecific = {
    eventAssessment: [
      'Always: score changes require real target actions, responses, follow-through, avoidance, or rejection.',
      'Conditional boundary-sensitive event: do not assume consent to intimacy escalation; prioritize respect, pacing, and safety.',
      'Conditional under18: only friendship, boundaries, safety, and healthy communication advice.'
    ],
    eventUnderstanding: [
      'Always: distinguish self, target, both, and unknown subject roles; lower confidence when actor is unclear.',
      'Conditional under18 or sexual/private-space wording: classify directly and do not normalize risky intimacy wording.'
    ],
    weeklyReview: [
      'Always: summarize only provided weekly events and assessment changes; do not invent long-term trends.',
      'Conditional under18: avoid adult, boundary-crossing, or manipulative advice.'
    ],
    sideRead: [
      'Always: zodiac/astrology is lightweight reference only, never diagnosis or fact.',
      'Always: do not use zodiac/astrology to encourage manipulation, boundary testing, or boundary crossing.',
      'Conditional under18: conservative, boundary-first wording.'
    ],
    attachmentAnalysis: [
      'Always: unreadable screenshot content must be empty or marked uncertain; never fabricate text.',
      'Always: do not identify or spread sensitive personal information unless required by user-provided context.'
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
      'review week: weekStart to weekEnd',
      'weeklyStats={eventCount,assessmentCount,scoreTrend}',
      'weekly key events limited by runtimeConfig.weeklyEventLimit'
    ],
    sideRead: [
      'persona: selfProfile.aiStyle + selfProfile.aiBoldness -> backend personaConfig; under18 may override final style/intensity.',
      'instant side read: selfProfile + targetProfile + currentEvent + currentAssessment',
      'weekly side read: week range + review summary + scoreTrend + weekly key events'
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
    'User selects only keys in mini program: selfProfile.aiStyle + selfProfile.aiBoldness.',
    'Backend provides template text for each key. Final key may be overridden by safety rules.'
  ].concat(
    PERSONA_STYLE_KEYS.map((key) => key + ': ' + persona.styles[key].labelZh + ' (' + persona.styles[key].labelEn + ') - ' + persona.styles[key].promptZh + ' / EN: ' + persona.styles[key].promptEn),
    PERSONA_BOLDNESS_KEYS.map((key) => key + ': ' + persona.boldness[key].labelZh + ' (' + persona.boldness[key].labelEn + ') - ' + persona.boldness[key].promptZh + ' / EN: ' + persona.boldness[key].promptEn)
  )
}

function buildPromptPreview(moduleKey, moduleConfig, settings) {
  const meta = PROMPT_MODULE_META[moduleKey] || { title: moduleKey, description: '' }
  const guardrails = PROMPT_FIXED_GUARDRAILS[moduleKey] || { outputContract: [] }
  const business = readBusinessPromptConfig(settings, moduleKey, moduleConfig)
  const lines = [
    '调用 / Call: ' + getCallNames(moduleKey).join(' | '),
    '模块 / Module: ' + meta.title,
    meta.description ? 'Description: ' + meta.description : '',
    '',
    'Final composition order:',
    '1. System safety guardrails, with conditional under18/boundary/image rules.',
    '2. Persona text, when this call uses persona: user-selected key + backend personaConfig template + safety override.',
    '3. Backend business prompt: role/task/rules/output notes from promptModules; legacy promptConfig is kept only for old-record compatibility.',
    '4. Runtime context placeholders shown below; actual user/event data is injected at call time.'
  ].filter(Boolean)

  appendPreviewSection(lines, 'System safety guardrails actually considered', getSafetyPreview(moduleKey))
  appendPreviewSection(lines, 'Persona block', buildPersonaPreview(settings, moduleKey))
  appendPreviewSection(lines, 'Backend business prompt', business.enabled === false
    ? ['This module is disabled in backend business prompt. Code keeps safety guardrails and runtime context only.']
    : [
        'Name: ' + business.nameZh + ' (' + business.nameEn + ')',
        'Role: ' + (business.roleZh || '[empty]') + (business.roleEn ? ' / EN: ' + business.roleEn : ''),
        'Task: ' + (business.taskZh || '[empty]') + (business.taskEn ? ' / EN: ' + business.taskEn : '')
      ].concat(
        formatBilingualList(business.rules).map((item) => 'Rule: ' + item),
        formatBilingualList(business.outputNotes).map((item) => 'Output note: ' + item)
      ))
  appendPreviewSection(lines, 'Fixed output contract', guardrails.outputContract || [])
  appendPreviewSection(lines, 'Runtime context injected at call time', getRuntimePreview(moduleKey))
  return lines.join('\n')
}

function buildPromptMessageLines(items) {
  return (items || [])
    .map((item, index) => {
      const value = typeof item === 'string' ? { zh: item, en: '' } : (item || {})
      const zh = cleanText(value.zh, 1800)
      const en = cleanText(value.en, 1800)
      if (zh && en) return String(index + 1) + '. ' + zh + '\n   EN: ' + en
      return String(index + 1) + '. ' + (zh || en)
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

  if (persona.style.labelZh || persona.style.labelEn || persona.style.promptZh || persona.style.promptEn) {
    promptLines.push(`Current companion style / Current companion style: ${persona.style.labelZh} (${persona.style.labelEn}). ${persona.style.promptZh} EN: ${persona.style.promptEn}`)
  }
  if (persona.boldness.labelZh || persona.boldness.labelEn || persona.boldness.promptZh || persona.boldness.promptEn) {
    promptLines.push(`Current advice intensity / Current advice intensity: ${persona.boldness.labelZh} (${persona.boldness.labelEn}). ${persona.boldness.promptZh} EN: ${persona.boldness.promptEn}`)
  }
  if (persona.style.labelZh || persona.style.labelEn) {
    systemParts.push(`Current companion style: ${persona.style.labelZh || persona.style.labelEn}.`)
  }
  if (persona.boldness.labelZh || persona.boldness.labelEn) {
    systemParts.push(`Advice intensity: ${persona.boldness.labelZh || persona.boldness.labelEn}.`)
  }
  if (persona.boundarySensitive) {
    promptLines.push('Safety override: this event involves intimacy, boundaries, or escalation. Do not assume consent; prioritize respect, pacing, and safety.')
  }
  if (persona.isMinor) {
    promptLines.push('Safety override: the user is under 18. Only allow friendship, boundaries, safety, and healthy communication advice.')
  }

  return {
    systemPrompt: systemParts.join(' '),
    userPrompt: promptLines.join('\n')
  }
}

function hasBusinessPromptContent(business) {
  return Boolean(
    business?.roleZh ||
    business?.roleEn ||
    business?.taskZh ||
    business?.taskEn ||
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
  const guardrails = PROMPT_FIXED_GUARDRAILS[moduleKey]?.lockedRules || []
  const systemLines = [
    'Safety guardrails / 安全护栏:',
    ...buildPromptMessageLines(guardrails),
    personaPrompt.systemPrompt
  ].filter(Boolean)
  const userLines = [
    `Module / 模块: ${business.nameZh} (${business.nameEn})`,
    business.roleZh || business.roleEn ? `Role / 角色: ${business.roleZh}\nEN: ${business.roleEn}` : '',
    business.taskZh || business.taskEn ? `Task / 任务: ${business.taskZh}\nEN: ${business.taskEn}` : '',
    business.rules.length ? 'Business rules / 业务规则:' : '',
    ...buildPromptMessageLines(business.rules),
    Object.keys(business.outputSchema || {}).length > 0 ? `Output schema / 输出结构:\n${JSON.stringify(business.outputSchema)}` : '',
    business.outputNotes.length ? 'Output notes / 输出要求:' : '',
    ...buildPromptMessageLines(business.outputNotes),
    'Runtime context / 运行时上下文:',
    personaPrompt.userPrompt,
    'Output must be JSON only. Required fields: eventType,eventTitle,intentDelta,riskDelta,evidenceDelta,summary,rationale,categories,currentStatus,rawReply. Do not return labels, confidence, actionAdvice, or eventInsight.',
    'currentStatus only needs tags,summary,caution. rawReply must use exactly three headings: 对方可能的心理 / 你下一步怎么做 / 重点观察什么.',
    describeSubjectRoleForPrompt(previewEvent.subjectRole),
    `Current assessment: ${JSON.stringify(currentAssessment)}`,
    `Self profile: ${serializeSelfProfile(selfProfile)}`,
    `Target profile: ${serializeCaseProfile(caseProfile)}`,
    `Recent timeline: ${JSON.stringify(compactRecentTimeline(recentTimeline, previewEvent.id))}`,
    `Current event: ${JSON.stringify(previewEvent)}`
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
    const guardrails = PROMPT_FIXED_GUARDRAILS[key] || { lockedRules: [] }
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
      '业务提示词（角色、任务、规则、输出要求）只从后台 promptModules 读取。 / Business prompts are loaded only from backend promptModules.',
      '后台缺字段时不再回退到代码里的业务提示词；该模块会规则兜底或跳过 AI。 / Missing backend business prompt fields do not fallback to code prompts; the module uses rule fallback or skips AI.',
      '安全护栏、输出结构校验、未成年人和边界敏感保护保留在代码中，并在后台只读可见。 / Safety guardrails, output validation, minor protection, and boundary protection remain in code and are visible read-only in admin.',
      '最终拼接顺序：安全护栏 + 用户选择的人格模板 + 后台业务提示词 + 运行时上下文。 / Final order: safety guardrails + user-selected persona template + backend business prompt + runtime context.'
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
        : (existing.apiKey || '')
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

async function getUserById(userId) {
  const res = await db.collection('users').doc(userId).get()
  return normalizeDoc(res)
}

async function requireAdminUser(event = {}) {
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

  const users = (usersRes.data || []).map((user) => ({
    id: user._id,
    email: user.email || '',
    phone: user.phone || '',
    loginType: user.loginType || (user.phone ? 'wechat_phone' : 'email'),
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin) || user.role === 'admin',
    caseCount: caseCountByUser[user._id] || 0,
    createdAt: toISO(user.createdAt),
    updatedAt: toISO(user.updatedAt),
    lastLoginAt: toISO(user.lastLoginAt)
  }))

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

  return {
    success: true,
    user: {
      id: user._id,
      email: user.email || '',
      phone: user.phone || '',
      loginType: user.loginType || '',
      role: user.role || (user.isAdmin ? 'admin' : 'user'),
      createdAt: toISO(user.createdAt),
      updatedAt: toISO(user.updatedAt),
      lastLoginAt: toISO(user.lastLoginAt)
    },
    cases: cases.map((item, index) => ({
      id: item._id,
      name: item.name || item.profile?.name || '未命名对象',
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
  if (!caseId) return { success: false, message: '请先选择一个关系对象' }

  const existing = await getGlobalAISettingsRaw()
  const base = applySettingsDefaults(existing || getDefaultSettings())
  const settings = mergePreviewSettings(base, event)
  const defaultModel = getDefaultModel(settings.aiModels, settings.aiDefaultModelId)
  const caseDoc = normalizeDoc(await db.collection('cases').doc(caseId).get().catch(() => null))
  if (!caseDoc) return { success: false, message: '所选关系对象不存在' }

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

async function adminManualRecharge(event, adminUserId) {
  const targetUserId = String(event.targetUserId || '').trim()
  if (!targetUserId) return { success: false, message: '缺少 targetUserId' }
  const amountTokens = Number(event.amountTokens)
  if (Number.isNaN(amountTokens) || amountTokens === 0 || amountTokens < -100000000 || amountTokens > 100000000) {
    return { success: false, message: '额度需在 -1亿 ~ 1亿 之间（不含 0）' }
  }
  const isDeduction = amountTokens < 0
  const remark = String(event.remark || (isDeduction ? '管理员调减额度' : '管理员手动充值')).trim()

  const { ensureTokenAccount } = require('./_shared/billing')
  const account = await ensureTokenAccount(db, targetUserId)
  const newBalance = (account.balanceTokens || 0) + amountTokens
  if (newBalance < 0) return { success: false, message: '扣减后余额不能为负' }
  const now = new Date()

  await db.collection('token_accounts').doc(account._id).update({
    balanceTokens: newBalance,
    purchasedTokens: isDeduction ? (account.purchasedTokens || 0) : (account.purchasedTokens || 0) + amountTokens,
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

  const updatedPurchased = isDeduction ? (account.purchasedTokens || 0) : (account.purchasedTokens || 0) + amountTokens
  return { success: true, account: { ...account, balanceTokens: newBalance, purchasedTokens: updatedPurchased } }
}

exports.main = async (event = {}) => {
  try {
    const { userId, user } = await requireAdminUser(event)
    const action = String(event.action || '').trim()

    if (action === 'getOverview') return await getOverview(userId, user)
    if (action === 'getUserDetail') return await getUserDetail(event)
    if (action === 'updateAISettings') return await updateAISettings(event, userId)
    if (action === 'previewPrompt') return await previewPrompt(event)
    if (action === 'getBillingSettings') return await getBillingSettings(event)
    if (action === 'updateBillingSettings') return await updateBillingSettings(event, userId)
    if (action === 'getTokenLedger') return await getTokenLedger(event)
    if (action === 'adminManualRecharge') return await adminManualRecharge(event, userId)

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




