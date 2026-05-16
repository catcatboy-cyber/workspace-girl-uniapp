const TOKEN_USAGE_COLLECTION = 'token_usage_records'

function normalizeUsage(usage = {}) {
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0)
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0)
  const totalTokens = Number(usage.total_tokens ?? (promptTokens + completionTokens))
  return {
    promptTokens: Number.isFinite(promptTokens) ? Math.max(0, Math.round(promptTokens)) : 0,
    completionTokens: Number.isFinite(completionTokens) ? Math.max(0, Math.round(completionTokens)) : 0,
    totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.round(totalTokens)) : 0
  }
}

async function recordTokenUsage(db, payload = {}) {
  const userId = String(payload.userId || '').trim()
  if (!userId) return null

  const tokens = normalizeUsage(payload.usage)
  const now = new Date()
  const doc = {
    userId,
    caseId: String(payload.caseId || '').trim(),
    recordId: String(payload.recordId || '').trim(),
    assessmentId: String(payload.assessmentId || '').trim(),
    feature: String(payload.feature || 'unknown').trim(),
    provider: String(payload.provider || '').trim(),
    model: String(payload.model || '').trim(),
    promptTokens: tokens.promptTokens,
    completionTokens: tokens.completionTokens,
    totalTokens: tokens.totalTokens,
    usageAvailable: tokens.totalTokens > 0,
    requestId: String(payload.requestId || '').trim(),
    createdAt: now,
    updatedAt: now
  }

  await db.collection(TOKEN_USAGE_COLLECTION).add(doc).catch((error) => {
    console.error('[token usage record failed]', error)
  })
  return doc
}

module.exports = {
  TOKEN_USAGE_COLLECTION,
  normalizeUsage,
  recordTokenUsage
}
