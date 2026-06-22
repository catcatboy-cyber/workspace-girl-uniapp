const PROMPT_MODULE_KEYS = ['eventAssessment', 'eventUnderstanding', 'weeklyReview', 'sideRead', 'attachmentAnalysis']
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
    zh: '输出必须是可解析 JSON；代码会校验枚举、数值范围和字段长度，失败时回退到规则结果。',
    en: 'Output must be parseable JSON; code validates enums, numeric ranges, and field lengths, and falls back to rule results on failure.'
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

function normalizeBusinessPrompt(settings, moduleKey) {
  const moduleConfig = settings?.promptModules?.[moduleKey]
  if (!moduleConfig || typeof moduleConfig !== 'object') return null

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

  if (!hasBusinessContent && normalized.enabled !== false) return null
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

  const userLines = [
    `模块: ${business.nameZh}`,
    business.roleZh ? `角色: ${business.roleZh}` : '',
    business.taskZh ? `任务: ${business.taskZh}` : '',
    business.rules.length ? '业务规则:' : '',
    ...buildBilingualLines(business.rules),
    Object.keys(business.outputSchema).length > 0 ? `输出结构:\n${JSON.stringify(business.outputSchema)}` : '',
    business.outputNotes.length ? '输出要求:' : '',
    ...buildBilingualLines(business.outputNotes),
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
  normalizeBusinessPrompt,
  buildPromptMessages
}
