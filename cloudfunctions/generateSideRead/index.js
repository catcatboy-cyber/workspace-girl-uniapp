const cloudbase = require('@cloudbase/node-sdk')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const { buildPromptMessages } = require('./_shared/ai-prompt-config')
const { buildPersonaPrompt } = require('./_shared/persona-config')
const { checkFeatureAccess, checkTokenBalance } = require('./_shared/subscription')
const { recordTokenUsage } = require('./_shared/token-usage')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'
const SIDE_READ_TIMEOUT_MS = 45000
function isMpRuntime() {
  return Boolean(process.env.WX_CONTEXT_KEYS || process.env.TENCENTCLOUD_RUNENV)
}

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

async function requireAuthenticatedUserId(event = {}) {
  const userInfo = await app.auth().getUserInfo()
  const candidates = [
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]
  if (isMpRuntime()) {
    candidates.push(event?.userId)
  }
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const error = new Error('UNAUTHENTICATED')
  error.code = 'UNAUTHENTICATED'
  throw error
}

async function getAISettings(userId) {
  const globalDocRes = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  let settings = normalizeDoc(globalDocRes)
  if (!settings) {
    const globalScopeRes = await db.collection('system_settings')
      .where({ scope: 'global', key: 'ai' })
      .limit(1)
      .get()
    settings = globalScopeRes.data && globalScopeRes.data.length > 0 ? globalScopeRes.data[0] : null
  }
  if (!settings) {
    const userSettingsRes = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()
    settings = userSettingsRes.data && userSettingsRes.data.length > 0 ? userSettingsRes.data[0] : null
  }
  return settings
}

function normalizeSettings(settings) {
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const defaultModel = settings.aiModels.find((m) => m.id === defaultId) || settings.aiModels[0] || {}
    const provider = typeof defaultModel.provider === 'string' && defaultModel.provider.trim()
      ? defaultModel.provider.trim()
      : 'openai-compatible'
    return {
      enabled: Boolean(settings.aiEnabled),
      provider,
      apiKey: typeof defaultModel.apiKey === 'string' ? defaultModel.apiKey.trim() : '',
      baseUrl: typeof defaultModel.baseUrl === 'string' && defaultModel.baseUrl.trim()
        ? defaultModel.baseUrl.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'https://api.anthropic.com'
          : 'https://api.openai.com/v1',
      model: typeof defaultModel.model === 'string' && defaultModel.model.trim()
        ? defaultModel.model.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'claude-3-5-sonnet-20241022'
          : 'gpt-4o-mini',
      runtimeConfig: settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
      promptConfig: settings.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
      promptModules: settings.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {},
      personaConfig: settings.personaConfig && typeof settings.personaConfig === 'object' ? settings.personaConfig : {}
    }
  }

  const provider = typeof settings?.aiProvider === 'string' && settings.aiProvider.trim()
    ? settings.aiProvider.trim()
    : 'openai-compatible'
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider,
    apiKey: typeof settings?.aiApiKey === 'string' ? settings.aiApiKey.trim() : '',
    baseUrl: typeof settings?.aiBaseUrl === 'string' && settings.aiBaseUrl.trim()
      ? settings.aiBaseUrl.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'https://api.anthropic.com'
        : 'https://api.openai.com/v1',
    model: typeof settings?.aiModel === 'string' && settings.aiModel.trim()
      ? settings.aiModel.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'claude-3-5-sonnet-20241022'
        : 'gpt-4o-mini',
    runtimeConfig: settings?.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
    promptConfig: settings?.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
    promptModules: settings?.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {},
    personaConfig: settings?.personaConfig && typeof settings.personaConfig === 'object' ? settings.personaConfig : {}
  }
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function buildUrls(baseUrl, provider) {
  const normalizedProvider = String(provider || 'openai-compatible').trim().toLowerCase()
  const normalized = trimTrailingSlash(baseUrl || 'https://api.openai.com/v1')
  const pathname = new URL(normalized).pathname.toLowerCase()
  if (normalizedProvider === 'anthropic') {
    if (pathname.endsWith('/messages')) return [normalized]
    return normalized.endsWith('/v1') ? [`${normalized}/messages`] : [`${normalized}/v1/messages`, `${normalized}/messages`]
  }
  if (pathname.endsWith('/chat/completions')) return [normalized]
  return normalized.endsWith('/v1') ? [`${normalized}/chat/completions`] : [`${normalized}/v1/chat/completions`, `${normalized}/chat/completions`]
}

function shouldSendResponseFormat(settings) {
  const model = String(settings.model || '').toLowerCase()
  const baseUrl = String(settings.baseUrl || '').toLowerCase()
  return !(model.includes('deepseek') || baseUrl.includes('deepseek'))
}

function requestText(urlString, body, timeoutMs, headers, normalizer) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const transport = url.protocol === 'http:' ? http : https
    const payload = JSON.stringify(body)
    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          text: async () => text,
          json: async () => {
            const parsed = JSON.parse(text)
            return normalizer ? normalizer(parsed) : parsed
          }
        })
      })
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('AI_REQUEST_TIMEOUT')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function normalizeAnthropicMessages(messages) {
  const list = Array.isArray(messages) ? messages : []
  return {
    system: list.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n'),
    messages: list.filter((item) => item.role !== 'system').map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '')
    }))
  }
}

function normalizeAnthropicResponse(payload) {
  const content = Array.isArray(payload?.content)
    ? payload.content.filter((item) => item?.type === 'text').map((item) => item.text).join('\n')
    : ''
  return {
    usage: {
      prompt_tokens: payload?.usage?.input_tokens || 0,
      completion_tokens: payload?.usage?.output_tokens || 0,
      total_tokens: (payload?.usage?.input_tokens || 0) + (payload?.usage?.output_tokens || 0)
    },
    choices: [{ message: { content } }],
    raw: payload
  }
}

async function postChatCompletions(settings, messages) {
  const provider = String(settings.provider || 'openai-compatible').trim().toLowerCase()
  const urls = buildUrls(settings.baseUrl, provider)
  const isAnthropic = provider === 'anthropic'
  const anthropicPayload = normalizeAnthropicMessages(messages)
  const runtimeConfig = getRuntimeConfig(settings)
  const body = isAnthropic
    ? {
        model: settings.model,
        system: anthropicPayload.system || undefined,
        messages: anthropicPayload.messages,
        temperature: runtimeConfig.sideReadTemperature,
        max_tokens: runtimeConfig.sideReadMaxTokens
      }
    : {
        model: settings.model,
        messages,
        temperature: runtimeConfig.sideReadTemperature,
        max_tokens: runtimeConfig.sideReadMaxTokens
      }
  if (!isAnthropic && shouldSendResponseFormat(settings)) {
    body.response_format = { type: 'json_object' }
  }
  const headers = isAnthropic
    ? { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' }
    : { Authorization: `Bearer ${settings.apiKey}` }

  let lastResponse = null
  for (const url of urls) {
    const response = await requestText(url, body, SIDE_READ_TIMEOUT_MS, headers, isAnthropic ? normalizeAnthropicResponse : null)
    if (response.status === 404 && url !== urls[urls.length - 1]) {
      lastResponse = response
      continue
    }
    return response
  }
  return lastResponse
}

function parseJSONContent(raw) {
  const text = String(raw || '').trim()
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('模型返回内容不是有效 JSON')
  }
}

function clean(value, maxLength = 160) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function clampRuntimeNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(clamped) : Number(clamped.toFixed(2))
}

function getRuntimeConfig(settings = {}) {
  const source = settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {}
  return {
    sideReadMaxTokens: clampRuntimeNumber(source.sideReadMaxTokens, 550, 200, 1200, true),
    sideReadTemperature: clampRuntimeNumber(source.sideReadTemperature, 0.35, 0, 1)
  }
}

function normalizeSideRead(value) {
  const input = value && typeof value === 'object' ? value : {}
  const title = sanitizeSideReadText(clean(input.title, 36) || '星象速写')
  const summary = sanitizeSideReadText(clean(input.summary, 300))
  const sections = Array.isArray(input.sections)
    ? input.sections.slice(0, 3).map((item) => ({
        label: sanitizeSideReadText(clean(item?.label, 24)),
        text: sanitizeSideReadText(clean(item?.text, 400))
      })).filter((item) => item.label && item.text)
    : []
  if (!summary && sections.length === 0) throw new Error('SIDE_READ_EMPTY')
  return { title, summary, sections }
}

function sectionText(section) {
  return `${section?.label || ''} ${section?.text || ''}`
}

function isZodiacSection(section, zodiacValues) {
  const text = sectionText(section)
  const zodiacs = Array.isArray(zodiacValues) ? zodiacValues.filter(Boolean) : [zodiacValues].filter(Boolean)
  return text.includes('生肖') ||
    text.includes('属相') ||
    zodiacs.some((zodiac) => text.includes(`属${zodiac}`)) ||
    zodiacs.some((zodiac) => text.includes(zodiac) && !text.includes('星座'))
}

function isConstellationSection(section, constellationValues) {
  const text = sectionText(section)
  const constellations = Array.isArray(constellationValues) ? constellationValues.filter(Boolean) : [constellationValues].filter(Boolean)
  return text.includes('星座') || constellations.some((constellation) => text.includes(constellation))
}

function labelPair(selfValue, targetValue, prefix = '') {
  if (selfValue && targetValue && selfValue !== targetValue) return `${prefix}${selfValue} / ${prefix}${targetValue}`
  if (targetValue) return `${prefix}${targetValue}`
  if (selfValue) return `${prefix}${selfValue}`
  return ''
}

function buildZodiacSection(zodiacLabel, latest) {
  const eventTitle = clean(latest?.triggerEventTitle || latest?.explanation?.headline, 28)
  return {
    label: '生肖角度',
    text: eventTitle
      ? `参考${zodiacLabel}的相处倾向，这次更适合把「${eventTitle}」当成连续行动里的一个信号看，不要只凭单次热度定结论。`
      : `参考${zodiacLabel}的相处倾向，先看对方是否持续给出实际行动，不要只凭单次热度定结论。`
  }
}

function buildConstellationSection(constellation, latest) {
  const eventTitle = clean(latest?.triggerEventTitle || latest?.explanation?.headline, 28)
  return {
    label: '星座角度',
    text: eventTitle
      ? `参考${constellation}的表达习惯，这次「${eventTitle}」更适合看细节回应、稳定度和后续补动作，不要把星象速写当成确定事实。`
      : `参考${constellation}的表达习惯，更适合看细节回应、稳定度和后续补动作，不要把星象速写当成确定事实。`
  }
}

function ensureSideReadDimensions(sideRead, caseProfile, selfProfile, latest) {
  const targetZodiac = clean(caseProfile?.zodiac, 12)
  const selfZodiac = clean(selfProfile?.zodiac, 12)
  const targetConstellation = clean(caseProfile?.constellation, 12)
  const selfConstellation = clean(selfProfile?.constellation, 12)
  const zodiacLabel = labelPair(selfZodiac, targetZodiac, '属')
  const constellationLabel = labelPair(selfConstellation, targetConstellation)
  const sections = Array.isArray(sideRead?.sections) ? [...sideRead.sections] : []
  const additions = []

  if (zodiacLabel && !sections.some((item) => isZodiacSection(item, [selfZodiac, targetZodiac]))) {
    additions.push(buildZodiacSection(zodiacLabel, latest || {}))
  }
  if (constellationLabel && !sections.some((item) => isConstellationSection(item, [selfConstellation, targetConstellation]))) {
    additions.push(buildConstellationSection(constellationLabel, latest || {}))
  }

  if (additions.length === 0) return sideRead

  const merged = [...sections, ...additions]
  const required = merged.filter((item) => isZodiacSection(item, [selfZodiac, targetZodiac]) || isConstellationSection(item, [selfConstellation, targetConstellation]))
  const optional = merged.filter((item) => !required.includes(item))
  const nextSections = [...required, ...optional].slice(0, 3)
  return {
    ...sideRead,
    title: sideRead?.title || '星象速写',
    summary: sideRead?.summary || '结合已知画像和本次事件做轻量星象速写，只作为观察参考。',
    sections: nextSections
  }
}

function sanitizeSideReadText(value) {
  return String(value || '')
    .replace(/属相星座侧写/g, '星象速写')
    .replace(/属相星座侧\s*写/g, '星象速写')
    .replace(/星座侧写/g, '星座速写')
    .replace(/星座侧\s*写/g, '星座速写')
    .replace(/属相侧写/g, '属相速写')
    .replace(/属相侧\s*写/g, '属相速写')
    .replace(/综合侧写/g, '综合星象速写')
    .replace(/综合侧\s*写/g, '综合星象速写')
    .replace(/保守侧写/g, '保守星象速写')
    .replace(/保守侧\s*写/g, '保守星象速写')
    .replace(/侧写资料不足/g, '星象速写资料不足')
    .replace(/侧\s*写资料不足/g, '星象速写资料不足')
    .replace(/側寫/g, '星象速写')
    .replace(/侧写/g, '星象速写')
    .replace(/侧\s*写/g, '星象速写')
}

function fallbackSideRead(caseProfile, latest) {
  const zodiac = clean(caseProfile?.zodiac, 12)
  const constellation = clean(caseProfile?.constellation, 12)
  const eventTitle = clean(latest?.triggerEventTitle || latest?.explanation?.headline, 32)
  const basis = [zodiac ? `属相：${zodiac}` : '', constellation ? `星座：${constellation}` : ''].filter(Boolean).join('，')
  const summary = eventTitle
    ? `这次先按已知画像和事件做保守星象速写：${eventTitle}。`
    : '这次先按已知画像做保守星象速写，结果只作为轻量参考。'
  const sections = []
  if (zodiac) {
    sections.push({
      label: '生肖角度',
      text: `参考${zodiac}的相处倾向，先观察对方是否持续有实际行动，不要只凭单次热度下结论。`
    })
  }
  if (constellation) {
    sections.push({
      label: '星座角度',
      text: `参考${constellation}的表达习惯，更适合看细节回应和稳定度，不要把星象速写当成确定事实。`
    })
  }
  if (sections.length === 0) {
    sections.push({
      label: '星象速写提醒',
      text: 'Crush 画像里缺少属相或星座，建议先补充资料，再生成更贴合的星象速写。'
    })
  }
  return {
    title: basis ? '保守星象速写' : '星象速写资料不足',
    summary,
    sections
  }
}

function serializeProfile(profile) {
  if (!profile) return '未提供'
  const result = {
    gender: profile.gender,
    age: profile.age,
    ageRange: profile.ageRange,
    identity: profile.identity,
    occupation: profile.occupation,
    relationType: profile.relationType,
    zodiac: profile.zodiac,
    constellation: profile.constellation,
    aiStyle: profile.aiStyle,
    aiBoldness: profile.aiBoldness
  }
  return Object.values(result).some(Boolean) ? JSON.stringify(result) : '未提供'
}

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  try {
    const userId = await requireAuthenticatedUserId(event)
    const caseId = typeof event.caseId === 'string' ? event.caseId.trim() : ''
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const caseDoc = normalizeDoc(await db.collection('cases').doc(caseId).get())
    if (!caseDoc) return { success: false, message: '档案不存在' }
    if (caseDoc.userId !== userId) return { success: false, message: '无权访问' }
    // Fetch latest assessment if available (optional — supports profile-only side read)
    let latest = null
    let latestResultId = null
    if (caseDoc.latestResultId) {
      latest = normalizeDoc(await db.collection('assessments').doc(caseDoc.latestResultId).get())
      if (latest) latestResultId = caseDoc.latestResultId
    }

    const user = normalizeDoc(await db.collection('users').doc(userId).get().catch(() => null))
    const aiSettings = normalizeSettings(await getAISettings(userId))
    if (!aiSettings.enabled || !aiSettings.apiKey) {
      return { success: false, message: 'AI 未启用' }
    }

    // Fetch original event text (not assessment analysis) for side read context
    let eventContext = null
    if (latest?.triggerEventId) {
      const eventDoc = normalizeDoc(await db.collection('timeline_records').doc(latest.triggerEventId).get().catch(() => null))
      if (eventDoc) {
        eventContext = {
          title: clean(eventDoc.title || '', 80),
          description: clean(eventDoc.description || '', 400)
        }
      }
    }
    // Fallback: use triggerEventTitle from assessment if timeline record not found
    if (!eventContext && latest?.triggerEventTitle) {
      eventContext = { title: clean(latest.triggerEventTitle, 80), description: '' }
    }

    const personaPrompt = buildPersonaPrompt(aiSettings, user?.selfProfile)
    const targetZodiac = clean(caseDoc.profile?.zodiac, 12)
    const targetConstellation = clean(caseDoc.profile?.constellation, 12)
    const contextLines = [
      personaPrompt.userPrompt,
      'Output JSON only. title <= 20 Chinese chars, summary <= 200 chars, each section.text <= 280 chars. Do not use markdown fences.',
      'Output structure requirement: if Target profile has zodiac, include one section about 生肖/属相; if Target profile has constellation, include one separate section about 星座. When both exist, both dimensions must appear.',
      `Self profile: ${serializeProfile(user?.selfProfile)}`,
      `Target profile: ${serializeProfile(caseDoc.profile)}`,
      `Required dimensions: zodiac=${targetZodiac || 'missing'}, constellation=${targetConstellation || 'missing'}`
    ]
    if (eventContext) {
      contextLines.push(
        'Below is the original event record. Generate a zodiac/constellation side read based on this raw event, NOT on any prior assessment analysis. Focus on what the event reveals about personality dynamics and cosmic style.',
        `Event title: ${eventContext.title}`,
        ...(eventContext.description ? [`Event description: ${eventContext.description}`] : [])
      )
    } else {
      contextLines.push('No event context available. Generate a profile-only zodiac/constellation side read based on the self and target profile data.')
    }
    const messages = buildPromptMessages({
      moduleKey: 'sideRead',
      settings: aiSettings,
      systemExtra: personaPrompt.systemPrompt,
      contextLines
    })
    if (!messages) {
      return { success: false, message: '后台未配置星象速写提示词' }
    }

    const runtimeConfig = getRuntimeConfig(aiSettings)

    // 功能门控
    const access = await checkFeatureAccess(db, userId, '星象速写')
    if (!access.allowed) return { success: false, code: 'FEATURE_NOT_AVAILABLE', message: access.reason }

    // Token 预估检查
    const tokCheck = await checkTokenBalance(db, userId, runtimeConfig.sideReadMaxTokens)
    if (!tokCheck.ok) return { success: false, code: tokCheck.code, message: tokCheck.message, ...tokCheck }

    const response = await postChatCompletions(aiSettings, messages)
    if (!response?.ok) {
      const text = await response?.text().catch(() => '')
      return { success: false, message: `AI 接口返回 ${response?.status || 0}${text ? ` / ${text.slice(0, 80)}` : ''}` }
    }
    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    await recordTokenUsage(db, {
      userId,
      caseId,
      assessmentId: latestResultId,
      feature: 'sideRead',
      provider: aiSettings.provider,
      model: aiSettings.model,
      usage: data?.usage
    })
    let sideReadAdvice
    try {
      sideReadAdvice = normalizeSideRead(parseJSONContent(raw))
    } catch (parseError) {
      console.error('[generateSideRead parse fallback]', parseError?.message, String(raw || '').slice(0, 500))
      sideReadAdvice = fallbackSideRead(caseDoc.profile, latest || {})
    }
    sideReadAdvice = ensureSideReadDimensions(sideReadAdvice, caseDoc.profile, user?.selfProfile, latest || {})

    // Store on assessment if available, otherwise on case document
    if (latestResultId) {
      await db.collection('assessments').doc(latestResultId).update({
        sideReadAdvice: _.set(sideReadAdvice),
        sideReadGeneratedAt: _.set(new Date())
      })
    } else {
      await db.collection('cases').doc(caseId).update({
        profileSideRead: _.set(sideReadAdvice),
        profileSideReadGeneratedAt: _.set(new Date())
      })
    }

    await db.collection('timeline_records').add({
      caseId,
      userId,
      type: 'note',
      feature: 'sideRead',
      title: sideReadAdvice.title || '星象速写',
      description: sideReadAdvice.summary || '',
      sections: sideReadAdvice.sections || [],
      occurrenceAt: new Date(),
      createdAt: new Date(),
      aiUsed: true
    })

    console.log('[generateSideRead perf]', JSON.stringify({
      caseId,
      assessmentId: caseDoc.latestResultId,
      elapsedMs: Date.now() - startedAt,
      contentChars: raw.length
    }))

    return { success: true, sideReadAdvice }
  } catch (error) {
    console.error('generateSideRead error:', error)
    if (error?.code === 'UNAUTHENTICATED' || error?.message === 'UNAUTHENTICATED') {
      return { success: false, message: '请先登录' }
    }
    if (error?.message === 'AI_REQUEST_TIMEOUT') {
      return { success: false, message: '星象速写生成超时，请稍后再试' }
    }
    return { success: false, message: error?.message || '星象速写生成失败' }
  }
}


