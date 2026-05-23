const STYLE_KEYS = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian']
const BOLDNESS_KEYS = ['conservative', 'balanced', 'bold']

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
    styles: STYLE_KEYS.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {}),
    boldness: BOLDNESS_KEYS.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {})
  }
}

function cleanText(value, maxLength = 320) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function normalizeItem(input, fallback = createEmptyPersonaItem()) {
  const source = input && typeof input === 'object' ? input : {}
  return {
    labelZh: cleanText(source.labelZh, 40) || fallback.labelZh,
    labelEn: cleanText(source.labelEn, 60) || fallback.labelEn,
    promptZh: cleanText(source.promptZh, 260) || fallback.promptZh,
    promptEn: cleanText(source.promptEn, 320) || fallback.promptEn
  }
}

function normalizePersonaConfig(input) {
  const source = input && typeof input === 'object' ? input : {}
  const defaults = createEmptyPersonaConfig()
  return {
    styles: STYLE_KEYS.reduce((result, key) => {
      result[key] = normalizeItem(source.styles?.[key], defaults.styles[key])
      return result
    }, {}),
    boldness: BOLDNESS_KEYS.reduce((result, key) => {
      result[key] = normalizeItem(source.boldness?.[key], defaults.boldness[key])
      return result
    }, {})
  }
}

function resolvePersona(settings, selfProfile, options = {}) {
  const personaConfig = normalizePersonaConfig(settings?.personaConfig)
  const requestedStyle = STYLE_KEYS.includes(selfProfile?.aiStyle) ? selfProfile.aiStyle : 'gentle_bestie'
  const requestedBoldness = BOLDNESS_KEYS.includes(selfProfile?.aiBoldness) ? selfProfile.aiBoldness : 'balanced'
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
    style: personaConfig.styles[effectiveStyle] || createEmptyPersonaItem(),
    boldness: personaConfig.boldness[effectiveBoldness] || createEmptyPersonaItem()
  }
}

function buildPersonaPrompt(settings, selfProfile, options = {}) {
  const persona = resolvePersona(settings, selfProfile, options)
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

module.exports = {
  STYLE_KEYS,
  BOLDNESS_KEYS,
  createEmptyPersonaConfig,
  normalizePersonaConfig,
  buildPersonaPrompt
}
