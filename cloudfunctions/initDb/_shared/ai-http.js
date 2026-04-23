const http = require('http')
const https = require('https')
const { URL } = require('url')

const DEFAULT_TIMEOUT_MS = 15000

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function buildChatCompletionUrls(baseUrl) {
  const normalized = trimTrailingSlash(baseUrl || 'https://api.openai.com/v1')
  const urls = [`${normalized}/chat/completions`]

  if (!normalized.endsWith('/v1')) {
    urls.push(`${normalized}/v1/chat/completions`)
  }

  return [...new Set(urls)]
}

function requestText(urlString, body, timeoutMs, apiKey) {
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
        Authorization: `Bearer ${apiKey}`
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
          json: async () => JSON.parse(text)
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
  const urls = buildChatCompletionUrls(params.baseUrl)
  let lastResponse = null

  for (const url of urls) {
    const response = await requestText(url, {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      response_format: params.responseFormat,
      max_tokens: params.maxTokens
    }, params.timeoutMs || DEFAULT_TIMEOUT_MS, params.apiKey)

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
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
}
