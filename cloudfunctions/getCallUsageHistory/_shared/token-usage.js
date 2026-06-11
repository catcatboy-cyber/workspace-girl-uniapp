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

  try {
    const result = await db.collection(TOKEN_USAGE_COLLECTION).add(doc)
    const usageId = result?.id || result?._id || ''
    const record = {
      ...doc,
      recordCreated: true,
      recordId: usageId,
      tokensDeducted: 0
    }

    // 额度扣减（旧系统：token_accounts）
    if (doc.totalTokens > 0) {
      try {
        const { chargeTokenUsage } = require('./billing')
        const chargeResult = await chargeTokenUsage(db, {
          userId,
          realTokens: doc.totalTokens,
          provider: doc.provider,
          model: doc.model,
          usageId,
          feature: doc.feature
        })
        record.tokensDeducted = chargeResult?.deducted || 0
        if (chargeResult?.insufficientBalance) {
          record.insufficientBalance = true
          record.balanceAtDeduction = chargeResult.balance
        }
      } catch (chargeErr) {
        console.warn('[token charge failed (non-fatal)]', chargeErr)
      }

      // 同步扣减 v3.2 平台 Token（users.monthlyTokensUsed / extraTokens）
      try {
        const { consumeTokens } = require('./subscription')
        await consumeTokens(db, userId, doc.totalTokens, doc.feature, doc.model)
      } catch (subErr) {
        console.warn('[v3.2 consumeTokens failed (non-fatal)]', subErr)
      }
    }

    return record
  } catch (error) {
    console.error('[token usage record failed]', error)
    return {
      ...doc,
      recordCreated: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    }
  }
}

module.exports = {
  TOKEN_USAGE_COLLECTION,
  normalizeUsage,
  recordTokenUsage
}
