const PROMPT_MODULE_KEYS = ['eventAssessment', 'weeklyReview', 'sideRead', 'attachmentAnalysis']
const BUSINESS_PROMPT_LIMITS = {
  roleZh: 800,
  roleEn: 1000,
  taskZh: 1600,
  taskEn: 2000,
  rules: { maxItems: 20, zh: 800, en: 1000 },
  outputNotes: { maxItems: 20, zh: 1200, en: 1400 }
}

const SAFETY_GUARDRAILS = [
  {
    zh: '需要 JSON 的模块必须输出可解析 JSON；代码会校验协议、枚举和字段长度，失败时按未知语义和零分保守保存。',
    en: 'Modules requiring JSON must output parseable JSON; code validates the protocol, enums, and field lengths, and conservatively stores unknown semantics with zero score on failure.'
  },
  {
    zh: '只根据用户提供的事实、事件上下文和画像字段判断；不要编造没有出现的行为、承诺、情绪或关系状态。',
    en: 'Judge only from provided facts, event context, and profile fields; do not invent actions, promises, emotions, or relationship status.'
  },
  {
    zh: '未成年人场景只允许友谊、边界、安全感和健康沟通建议；不要生成成人化、性暗示、饮酒、开房、操控或越界行为建议。',
    en: 'For minors, only allow friendship, boundaries, safety, and healthy communication advice; do not generate adult, sexual, alcohol, hotel, manipulation, or boundary-crossing advice.'
  }
]

function cleanText(value, maxLength = 1200) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
    : ''
}

function cloneOutputSchema(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {}
}

function normalizeBilingual(value, limits = BUSINESS_PROMPT_LIMITS.rules) {
  if (typeof value === 'string') {
    return { zh: cleanText(value, limits.zh), en: '' }
  }
  const source = value && typeof value === 'object' ? value : {}
  return {
    zh: cleanText(source.zh, limits.zh),
    en: cleanText(source.en, limits.en)
  }
}

function normalizeRuleList(value, limits = BUSINESS_PROMPT_LIMITS.rules) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeBilingual(item, limits))
    .filter((item) => item.zh || item.en)
    .slice(0, limits.maxItems)
}

function createEmptyBusinessPrompt(moduleKey) {
  return {
    enabled: true,
    nameZh: moduleKey,
    nameEn: moduleKey,
    roleZh: '',
    roleEn: '',
    taskZh: '',
    taskEn: '',
    rules: [],
    outputSchema: {},
    outputNotes: []
  }
}

function sanitizePromptModules(value) {
  const modules = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {}
  delete modules.eventUnderstanding
  const eventAssessment = modules.eventAssessment
  if (eventAssessment && typeof eventAssessment === 'object') {
    const business = eventAssessment.businessPrompt && typeof eventAssessment.businessPrompt === 'object'
      ? eventAssessment.businessPrompt
      : eventAssessment
    business.rules = []
    business.outputSchema = {}
    business.outputNotes = []
  }
  return modules
}

function normalizeBusinessPrompt(settings, moduleKey) {
  const configuredModule = settings?.promptModules?.[moduleKey]
  const moduleConfig = configuredModule && typeof configuredModule === 'object'
    ? configuredModule
    : { enabled: true, businessPrompt: createEmptyBusinessPrompt(moduleKey) }

  const business = moduleConfig.businessPrompt && typeof moduleConfig.businessPrompt === 'object'
    ? moduleConfig.businessPrompt
    : moduleConfig
  const fallback = createEmptyBusinessPrompt(moduleKey)
  const normalized = {
    enabled: moduleConfig.enabled !== false && business.enabled !== false,
    nameZh: cleanText(business.nameZh, 60) || fallback.nameZh,
    nameEn: cleanText(business.nameEn, 80) || fallback.nameEn,
    roleZh: cleanText(business.roleZh, BUSINESS_PROMPT_LIMITS.roleZh),
    roleEn: cleanText(business.roleEn, BUSINESS_PROMPT_LIMITS.roleEn),
    taskZh: cleanText(business.taskZh, BUSINESS_PROMPT_LIMITS.taskZh),
    taskEn: cleanText(business.taskEn, BUSINESS_PROMPT_LIMITS.taskEn),
    rules: normalizeRuleList(business.rules, BUSINESS_PROMPT_LIMITS.rules),
    outputSchema: cloneOutputSchema(business.outputSchema),
    outputNotes: normalizeRuleList(business.outputNotes, BUSINESS_PROMPT_LIMITS.outputNotes)
  }

  const hasBusinessContent = Boolean(
    normalized.roleZh ||
    normalized.taskZh ||
    normalized.rules.length > 0 ||
    normalized.outputNotes.length > 0 ||
    Object.keys(normalized.outputSchema).length > 0
  )

  // 即使业务内容为空，只要模块启用就返回有效对象；固定协议由调用方注入。
  if (!hasBusinessContent && normalized.enabled === false) return null
  return normalized
}

function buildBilingualLines(items) {
  return (items || [])
    .map((item, index) => {
      const zh = cleanText(item.zh, BUSINESS_PROMPT_LIMITS.outputNotes.zh)
      return zh ? `${index + 1}. ${zh}` : ''
    })
    .filter(Boolean)
}

function buildPromptMessages({ moduleKey, settings, contextLines = [], systemExtra = '' }) {
  const safety = SAFETY_GUARDRAILS
  const business = normalizeBusinessPrompt(settings, moduleKey)
  if (!business || !business.enabled) return null

  const systemLines = [
    '安全护栏:',
    ...buildBilingualLines(safety),
    systemExtra
  ].filter(Boolean)

  // eventAssessment 的协议、枚举、语义原则与评分边界全部由代码固定。
  // DB 在该模块只允许提供简短角色/任务，旧 rules/schema/notes 不进入运行时 prompt。
  const useManagedEventProtocol = moduleKey === 'eventAssessment'
  const userLines = [
    `模块: ${business.nameZh}`,
    business.roleZh ? `角色: ${business.roleZh}` : '',
    business.taskZh ? `任务: ${business.taskZh}` : '',
    !useManagedEventProtocol && business.rules.length ? '业务规则:' : '',
    ...(!useManagedEventProtocol ? buildBilingualLines(business.rules) : []),
    !useManagedEventProtocol && Object.keys(business.outputSchema).length > 0 ? `输出结构:\n${JSON.stringify(business.outputSchema)}` : '',
    !useManagedEventProtocol && business.outputNotes.length ? '输出要求:' : '',
    ...(!useManagedEventProtocol ? buildBilingualLines(business.outputNotes) : []),
    contextLines.length ? '运行时上下文:' : '',
    ...contextLines
  ].filter(Boolean)

  return [
    { role: 'system', content: systemLines.join('\n') },
    { role: 'user', content: userLines.join('\n') }
  ]
}

module.exports = {
  PROMPT_MODULE_KEYS,
  SAFETY_GUARDRAILS,
  sanitizePromptModules,
  normalizeBusinessPrompt,
  buildPromptMessages
}
