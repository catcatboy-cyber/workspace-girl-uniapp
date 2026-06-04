/**
 * AI 模型故障转移 & 额度管理
 * 用法：各个云函数 normalize 后调 resolveAIModel 获取可用模型列表，
 *       调 AI 成功后 recordModelUsage 记录消耗，失败后 continue 到下一个模型。
 */

function resolveAIModel(settings) {
  if (!settings || !Array.isArray(settings.aiModels) || settings.aiModels.length === 0) {
    return { models: [], defaultModelId: settings?.aiDefaultModelId || 'default' }
  }

  const defaultId = settings.aiDefaultModelId || settings.aiModels[0]?.id || 'default'

  // 优先级排序：默认模型排第一，其余按原顺序
  const sorted = [...settings.aiModels].sort((a, b) => {
    if (a.id === defaultId) return -1
    if (b.id === defaultId) return 1
    return 0
  })

  // 过滤：必须有 apiKey，且未超额度
  const available = sorted.filter(m => {
    if (!m.apiKey) return false
    const quota = Number(m.quota || 0)
    const used = Number(m.tokensUsed || 0)
    if (quota > 0 && used >= quota) return false
    return true
  })

  return { models: available, defaultModelId: defaultId }
}

/**
 * 更新模型的 tokensUsed 计数器
 * db: CloudBase database 实例
 * settingsDocId: system_settings 文档 _id（通常是 'settings_global_ai'）
 * modelId: 使用的模型 id
 * tokens: 本次消耗的 tokens
 * multiplier: 扣费倍率（可选，默认 1）
 */
async function recordModelUsage(db, settingsDocId, modelId, tokens, multiplier = 1) {
  if (!modelId || !tokens) return
  try {
    const deducted = Math.ceil(tokens * (multiplier || 1))
    const idx = `aiModels.${modelId === 'default' ? '0' : modelId}`
    // 尝试用数组索引更新，如果 model id 不匹配则用 find + update
    const doc = await db.collection('system_settings').doc(settingsDocId).get().catch(() => null)
    const models = doc?.data?.[0]?.aiModels || doc?.data?.[0]?.aiModels
    if (!models) return

    const targetIdx = models.findIndex(m => m.id === modelId)
    if (targetIdx < 0) return

    const current = Number(models[targetIdx].tokensUsed || 0)
    await db.collection('system_settings').doc(settingsDocId).update({
      [`aiModels.${targetIdx}.tokensUsed`]: current + deducted
    }).catch(() => {})
  } catch {}
}

module.exports = { resolveAIModel, recordModelUsage }
