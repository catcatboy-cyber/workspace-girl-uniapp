const http = require('http')
const https = require('https')
const { URL } = require('url')

const DEFAULT_TIMEOUT_MS = 45000

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function normalizeProvider(provider) {
  return String(provider || 'openai-compatible').trim().toLowerCase() || 'openai-compatible'
}

function normalizeModelName(model) {
  return String(model || '').trim().toLowerCase()
}

function shouldSendResponseFormat(params, provider) {
  if (!params.responseFormat) return false
  if (provider === 'anthropic') return false

  const model = normalizeModelName(params.model)
  const baseUrl = String(params.baseUrl || '').toLowerCase()
  // Some OpenAI-compatible proxies accept response_format but return empty or
  // truncated content for DeepSeek-style models. Prompt-only JSON is steadier.
  if (model.includes('deepseek') || baseUrl.includes('deepseek')) return false

  return true
}

function getDefaultBaseUrl(provider) {
  return normalizeProvider(provider) === 'anthropic'
    ? 'https://api.anthropic.com'
    : 'https://api.openai.com/v1'
}

function buildChatCompletionUrls(baseUrl, provider) {
  const normalizedProvider = normalizeProvider(provider)
  const normalized = trimTrailingSlash(baseUrl || getDefaultBaseUrl(normalizedProvider))
  const pathname = new URL(normalized).pathname.toLowerCase()

  if (normalizedProvider === 'anthropic') {
    if (pathname.endsWith('/messages')) return [normalized]

    const urls = normalized.endsWith('/v1')
      ? [`${normalized}/messages`]
      : [`${normalized}/v1/messages`, `${normalized}/messages`]

    return [...new Set(urls)]
  }

  if (pathname.endsWith('/chat/completions')) return [normalized]

  const urls = normalized.endsWith('/v1')
    ? [`${normalized}/chat/completions`]
    : [`${normalized}/v1/chat/completions`, `${normalized}/chat/completions`]

  return [...new Set(urls)]
}

function normalizeAnthropicMessages(messages) {
  const list = Array.isArray(messages) ? messages : []
  const system = list
    .filter((item) => item && item.role === 'system' && typeof item.content === 'string' && item.content.trim())
    .map((item) => item.content.trim())
    .join('\n\n')

  const normalizedMessages = list
    .filter((item) => item && item.role !== 'system')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content : String(item.content || '')
    }))

  if (normalizedMessages.length === 0) {
    normalizedMessages.push({ role: 'user', content: '' })
  }

  return { system, messages: normalizedMessages }
}

function normalizeAnthropicResponse(payload) {
  const text = Array.isArray(payload?.content)
    ? payload.content
      .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim()
    : ''

  return {
    model: payload?.model || '',
    choices: [
      {
        message: {
          content: text
        }
      }
    ],
    raw: payload
  }
}

function extractTextContent(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (typeof item?.text === 'string') return item.text
        if (typeof item?.content === 'string') return item.content
        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return value.text
    if (typeof value.content === 'string') return value.content
  }
  return ''
}

function normalizeOpenAICompatibleResponse(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null
  const message = choice?.message || {}
  const content = extractTextContent(message.content)
    || extractTextContent(message.reasoning_content)
    || extractTextContent(choice?.text)
    || extractTextContent(payload?.output_text)
    || extractTextContent(payload?.content)

  return {
    ...payload,
    choices: [
      {
        ...choice,
        message: {
          ...message,
          content
        }
      }
    ],
    raw: payload
  }
}

function requestText(urlString, body, timeoutMs, headers, responseNormalizer) {
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
          statusText: res.statusMessage || '',
          text: async () => text,
          json: async () => {
            const payload = JSON.parse(text)
            return typeof responseNormalizer === 'function' ? responseNormalizer(payload) : payload
          }
        })
      })
    })

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('AI_REQUEST_TIMEOUT'))
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function postChatCompletions(params) {
  const provider = normalizeProvider(params.provider)
  const urls = buildChatCompletionUrls(params.baseUrl, provider)
  let lastResponse = null

  const isAnthropic = provider === 'anthropic'
  const anthropicPayload = normalizeAnthropicMessages(params.messages)
  const requestBody = isAnthropic
    ? {
        model: params.model,
        system: anthropicPayload.system || undefined,
        messages: anthropicPayload.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens || 256
      }
    : {
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      }

  if (!isAnthropic && shouldSendResponseFormat(params, provider)) {
    requestBody.response_format = params.responseFormat
  }

  const headers = isAnthropic
    ? {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01'
      }
    : {
        Authorization: `Bearer ${params.apiKey}`
      }

  for (const url of urls) {
    const response = await requestText(
      url,
      requestBody,
      params.timeoutMs || DEFAULT_TIMEOUT_MS,
      headers,
      isAnthropic ? normalizeAnthropicResponse : normalizeOpenAICompatibleResponse
    )

    if (response.status === 404 && url !== urls[urls.length - 1]) {
      lastResponse = response
      continue
    }

    return response
  }

  if (lastResponse) return lastResponse
  throw new Error('没有可用的 AI 接口地址。')
}

function parseJSONContent(raw) {
  const trimmed = String(raw || '').trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1])
    }

    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }

    throw new Error('模型返回内容不是有效 JSON。')
  }
}

function getAIErrorMessage(error, timeoutMs) {
  if (error instanceof Error && error.message === 'AI_REQUEST_TIMEOUT') {
    return `请求超时：${Math.round((timeoutMs || DEFAULT_TIMEOUT_MS) / 1000)} 秒内没有收到模型响应。`
  }

  return error instanceof Error ? error.message : String(error)
}

module.exports = {
  AI_REQUEST_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  buildChatCompletionUrls,
  getDefaultBaseUrl,
  normalizeOpenAICompatibleResponse,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
}
