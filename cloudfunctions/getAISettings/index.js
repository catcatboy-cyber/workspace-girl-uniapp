const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
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
function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

function redactKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return '***' + key.slice(-4)
}

function syncLegacyFieldsFromDefaultModel(settings) {
  if (!settings || !Array.isArray(settings.aiModels) || settings.aiModels.length === 0) return settings

  const defaultModel = settings.aiModels.find((m) => m.id === settings.aiDefaultModelId) || settings.aiModels[0]
  if (!defaultModel) return settings

  settings.aiProvider = defaultModel.provider || 'openai-compatible'
  settings.aiBaseUrl = defaultModel.baseUrl || 'https://api.openai.com/v1'
  settings.aiModel = defaultModel.model || 'gpt-4o-mini'
  settings.aiApiKey = defaultModel.apiKey ? redactKey(defaultModel.apiKey) : ''
  return settings
}

function cleanText(value, maxLength = 1200) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : ''
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

function normalizePromptConfig(value) {
  const defaults = getDefaultPromptConfig()
  const source = value && typeof value === 'object' ? value : {}
  const result = {}

  for (const key of PROMPT_MODULE_KEYS) {
    result[key] = normalizePromptModuleConfig(source[key], defaults[key])
  }

  return result
}

// 灏嗘棫鐗堝崟妯″瀷鏍煎紡杩佺Щ鍒板妯″瀷鏍煎紡

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

function normalizeRuntimeConfig(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    eventContextLimit: clampNumber(source.eventContextLimit, DEFAULT_RUNTIME_CONFIG.eventContextLimit, 3, 8, true),
    weeklyEventLimit: clampNumber(source.weeklyEventLimit, DEFAULT_RUNTIME_CONFIG.weeklyEventLimit, 5, 20, true),
    weeklySideEventLimit: clampNumber(source.weeklySideEventLimit, DEFAULT_RUNTIME_CONFIG.weeklySideEventLimit, 3, 12, true),
    eventMaxTokens: clampNumber(source.eventMaxTokens, DEFAULT_RUNTIME_CONFIG.eventMaxTokens, 300, 1400, true),
    eventUnderstandingMaxTokens: clampNumber(source.eventUnderstandingMaxTokens, DEFAULT_RUNTIME_CONFIG.eventUnderstandingMaxTokens, 120, 600, true),
    weeklyMaxTokens: clampNumber(source.weeklyMaxTokens, DEFAULT_RUNTIME_CONFIG.weeklyMaxTokens, 300, 1600, true),
    sideReadMaxTokens: clampNumber(source.sideReadMaxTokens, DEFAULT_RUNTIME_CONFIG.sideReadMaxTokens, 200, 1200, true),
    attachmentMaxTokens: clampNumber(source.attachmentMaxTokens, DEFAULT_RUNTIME_CONFIG.attachmentMaxTokens, 400, 2400, true),
    eventTemperature: clampNumber(source.eventTemperature, DEFAULT_RUNTIME_CONFIG.eventTemperature, 0, 1),
    eventUnderstandingTemperature: clampNumber(source.eventUnderstandingTemperature, DEFAULT_RUNTIME_CONFIG.eventUnderstandingTemperature, 0, 1),
    weeklyTemperature: clampNumber(source.weeklyTemperature, DEFAULT_RUNTIME_CONFIG.weeklyTemperature, 0, 1),
    sideReadTemperature: clampNumber(source.sideReadTemperature, DEFAULT_RUNTIME_CONFIG.sideReadTemperature, 0, 1),
    attachmentTemperature: clampNumber(source.attachmentTemperature, DEFAULT_RUNTIME_CONFIG.attachmentTemperature, 0, 1)
  }
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
function buildPromptAdminView(settings) {
  const source = settings && typeof settings === 'object' ? settings : {}
  const promptConfig = normalizePromptConfig(source.promptConfig)
  const modules = {}

  for (const key of PROMPT_MODULE_KEYS) {
    const guardrails = PROMPT_FIXED_GUARDRAILS[key] || { lockedRules: [], runtimeContext: [], outputContract: [] }
    const meta = PROMPT_MODULE_META[key] || { title: key, description: '' }
    modules[key] = {
      key,
      title: meta.title,
      description: meta.description,
      guardrails: guardrails.lockedRules || [],
      runtimeContext: guardrails.runtimeContext || [],
      outputContract: guardrails.outputContract || [],
      effectivePreview: buildPromptPreview(key, promptConfig[key], source)
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

function migrateToV2(settings) {
  if (!settings) return null

  const clone = { ...settings }

  if (clone.settingsVersion === 2 || clone.aiModels) {
    // already v2
    if (clone.aiModels) {
      clone.aiModels = clone.aiModels.map((m) => ({
        ...m,
        apiKey: m.apiKey ? redactKey(m.apiKey) : ''
      }))
    }
    clone.promptConfigVersion = 1
    clone.promptConfig = normalizePromptConfig(clone.promptConfig)
    clone.promptModules = clone.promptModules && typeof clone.promptModules === 'object' ? clone.promptModules : {}
    clone.personaConfig = normalizePersonaConfig(clone.personaConfig)
    clone.promptAdminView = normalizePromptAdminView(clone.promptAdminView, clone)
    clone.defaultPromptConfig = getDefaultPromptConfig()
    clone.defaultPersonaConfig = normalizePersonaConfig(null)
    clone.runtimeConfigVersion = 1
    clone.runtimeConfig = normalizeRuntimeConfig(clone.runtimeConfig)
    return syncLegacyFieldsFromDefaultModel(clone)
  }

  // 鏃х増鏍煎紡 鈫?杩佺Щ
  const models = [{
    id: 'default',
    name: '默认模型',
    provider: clone.aiProvider || 'openai-compatible',
    baseUrl: clone.aiBaseUrl || 'https://api.openai.com/v1',
    model: clone.aiModel || 'gpt-4o-mini',
    apiKey: clone.aiApiKey || ''
  }]

  clone.settingsVersion = 2
  clone.aiModels = models
  clone.aiDefaultModelId = 'default'
  clone.promptConfigVersion = 1
  clone.promptConfig = normalizePromptConfig(clone.promptConfig)
  clone.promptModules = clone.promptModules && typeof clone.promptModules === 'object' ? clone.promptModules : {}
  clone.personaConfig = normalizePersonaConfig(clone.personaConfig)
  clone.promptAdminView = normalizePromptAdminView(clone.promptAdminView, clone)
  clone.defaultPromptConfig = getDefaultPromptConfig()
  clone.defaultPersonaConfig = normalizePersonaConfig(null)
  clone.runtimeConfigVersion = 1
  clone.runtimeConfig = normalizeRuntimeConfig(clone.runtimeConfig)

  // keep legacy-compatible fields hidden from client
  delete clone.aiProvider
  delete clone.aiBaseUrl
  delete clone.aiModel
  delete clone.aiApiKey

  clone.aiModels = clone.aiModels.map((m) => ({
    ...m,
    apiKey: m.apiKey ? redactKey(m.apiKey) : ''
  }))

  return syncLegacyFieldsFromDefaultModel(clone)
}

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)

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

    if (!rawSettings) {
      return { success: true, settings: null }
    }

    const settings = migrateToV2({ ...rawSettings })

    return { success: true, settings }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getAISettings error:', error)
    return { success: false, message: '获取 AI 设置失败' }
  }
}




