const http = require('http')
const https = require('https')
const { URL } = require('url')

const DEFAULT_TIMEOUT_MS = 15000

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function normalizeProvider(provider) {
  return String(provider || 'openai-compatible').trim().toLowerCase() || 'openai-compatible'
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
    return [...new Set(normalized.endsWith('/v1') ? [`${normalized}/messages`] : [`${normalized}/v1/messages`, `${normalized}/messages`])]
  }

  if (pathname.endsWith('/chat/completions')) return [normalized]
  return [...new Set(normalized.endsWith('/v1') ? [`${normalized}/chat/completions`] : [`${normalized}/v1/chat/completions`, `${normalized}/chat/completions`])]
}

function requestText(urlString, body, timeoutMs, headers) {
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
          json: async () => JSON.parse(text)
        })
      })
    })

    req.setTimeout(timeoutMs, () => req.destroy(new Error('AI_REQUEST_TIMEOUT')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function postChatCompletions(params) {
  const provider = normalizeProvider(params.provider)
  if (provider === 'anthropic') {
    throw new Error('VISION_NOT_SUPPORTED_FOR_ANTHROPIC_IN_THIS_FUNCTION')
  }

  const urls = buildChatCompletionUrls(params.baseUrl, provider)
  let lastResponse = null
  for (const url of urls) {
    const response = await requestText(
      url,
      {
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        response_format: params.responseFormat,
        max_tokens: params.maxTokens
      },
      params.timeoutMs || DEFAULT_TIMEOUT_MS,
      { Authorization: `Bearer ${params.apiKey}` }
    )
    if (response.status === 404 && url !== urls[urls.length - 1]) {
      lastResponse = response
      continue
    }
    return response
  }
  if (lastResponse) return lastResponse
  throw new Error('NO_AI_ENDPOINT')
}

function parseJSONContent(raw) {
  const text = String(raw || '').trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('INVALID_JSON')
  }
}

module.exports = {
  AI_REQUEST_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent
}
