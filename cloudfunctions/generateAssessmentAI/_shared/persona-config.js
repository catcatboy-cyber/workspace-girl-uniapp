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

module.exports = {
  STYLE_KEYS,
  BOLDNESS_KEYS,
  createEmptyPersonaConfig,
  normalizePersonaConfig,
  buildPersonaPrompt
}
