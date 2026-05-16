const PROMPT_MODULE_KEYS = ['eventAssessment', 'eventUnderstanding', 'weeklyReview', 'sideRead', 'attachmentAnalysis']
const BUSINESS_PROMPT_LIMITS = {
  roleZh: 800,
  roleEn: 1000,
  taskZh: 1600,
  taskEn: 2000,
  rules: { maxItems: 20, zh: 800, en: 1000 },
  outputNotes: { maxItems: 20, zh: 1200, en: 1400 }
}

const SAFETY_GUARDRAILS = {
  eventAssessment: [
    {
      zh: '只根据用户提供的事实、事件上下文和画像字段判断；不要编造没有出现的行为、承诺、情绪或关系状态。',
      en: 'Judge only from provided facts, event context, and profile fields; do not invent actions, promises, emotions, or relationship status.'
    },
    {
      zh: '未成年人场景只允许友谊、边界、安全感和健康沟通建议；不要生成成人化、性暗示、饮酒、开房或操控建议。',
      en: 'For minors, only allow friendship, boundaries, safety, and healthy communication advice; do not generate adult, sexual, alcohol, hotel, or manipulation advice.'
    },
    {
      zh: '不能替用户同意任何亲密升级；涉及边界、身体亲密、酒精或私密空间时，优先提醒尊重、节奏和安全。',
      en: 'Never consent to intimacy escalation on behalf of the user; when boundaries, physical intimacy, alcohol, or private spaces appear, prioritize respect, pacing, and safety.'
    },
    {
      zh: '输出必须是可解析 JSON；代码会校验枚举、数值范围、字段长度，并在失败时回退到规则结果。',
      en: 'Output must be parseable JSON; code validates enums, numeric ranges, and field lengths, and falls back to rule results on failure.'
    }
  ],
  eventUnderstanding: [
    {
      zh: '只根据本次事件描述和辅助上下文分类；不要推断描述里没有出现的回应或承诺。',
      en: 'Classify only from the current event description and supporting context; do not infer responses or promises that are not present.'
    },
    {
      zh: '必须区分用户动作、对象动作和双方互动；主体不清时降低判断强度。',
      en: 'Distinguish user actions, target actions, and mutual interactions; reduce confidence when the actor is unclear.'
    },
    {
      zh: '输出必须是可解析 JSON；代码会校验 eventType、semanticTags 和 commitment 枚举。',
      en: 'Output must be parseable JSON; code validates eventType, semanticTags, and commitment enums.'
    }
  ],
  weeklyReview: [
    {
      zh: '只总结本周提供的事件和评估变化；不要编造没有提供的长期趋势。',
      en: 'Summarize only the provided weekly events and assessment changes; do not invent long-term trends.'
    },
    {
      zh: '未成年人场景不生成成人化、越界或操控建议。',
      en: 'For minors, do not generate adult, boundary-crossing, or manipulative advice.'
    },
    {
      zh: '输出必须是可解析 JSON；代码会校验数组长度和枚举。',
      en: 'Output must be parseable JSON; code validates array lengths and enums.'
    }
  ],
  sideRead: [
    {
      zh: '侧写只能作为轻量参考，不得伪装成确定事实、医学诊断或心理诊断。',
      en: 'Profile reading is only lightweight reference; it must not be presented as fact or medical/psychological diagnosis.'
    },
    {
      zh: '不要用属相星座鼓励操控、试探底线或越界行为。',
      en: 'Do not use zodiac or astrology to encourage manipulation, boundary testing, or boundary-crossing behavior.'
    },
    {
      zh: '输出必须是可解析 JSON；代码会校验字段和长度。',
      en: 'Output must be parseable JSON; code validates fields and lengths.'
    }
  ],
  attachmentAnalysis: [
    {
      zh: '看不清的内容必须留空或标注不确定；不要编造截图文字。',
      en: 'Unreadable content must be left empty or marked uncertain; do not fabricate screenshot text.'
    },
    {
      zh: '不要识别或扩散敏感个人信息，除非它是用户提供内容中完成任务所必需的上下文。',
      en: 'Do not identify or spread sensitive personal information unless it is necessary context from user-provided content.'
    },
    {
      zh: '输出必须是可解析 JSON；代码会校验字段和置信度枚举。',
      en: 'Output must be parseable JSON; code validates fields and confidence enums.'
    }
  ]
}

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
    normalized.roleEn ||
    normalized.taskZh ||
    normalized.taskEn ||
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
      const en = cleanText(item.en, BUSINESS_PROMPT_LIMITS.outputNotes.en)
      if (zh && en) return `${index + 1}. ${zh}\n   EN: ${en}`
      return `${index + 1}. ${zh || en}`
    })
    .filter(Boolean)
}

function buildPromptMessages({ moduleKey, settings, contextLines = [], systemExtra = '' }) {
  const safety = SAFETY_GUARDRAILS[moduleKey] || []
  const business = normalizeBusinessPrompt(settings, moduleKey)
  if (!business || !business.enabled) return null

  const systemLines = [
    'Safety guardrails / 安全护栏:',
    ...buildBilingualLines(safety),
    systemExtra
  ].filter(Boolean)

  const userLines = [
    `Module / 模块: ${business.nameZh} (${business.nameEn})`,
    business.roleZh || business.roleEn ? `Role / 角色: ${business.roleZh}\nEN: ${business.roleEn}` : '',
    business.taskZh || business.taskEn ? `Task / 任务: ${business.taskZh}\nEN: ${business.taskEn}` : '',
    business.rules.length ? 'Business rules / 业务规则:' : '',
    ...buildBilingualLines(business.rules),
    Object.keys(business.outputSchema).length > 0 ? `Output schema / 输出结构:\n${JSON.stringify(business.outputSchema)}` : '',
    business.outputNotes.length ? 'Output notes / 输出要求:' : '',
    ...buildBilingualLines(business.outputNotes),
    contextLines.length ? 'Runtime context / 运行时上下文:' : '',
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
