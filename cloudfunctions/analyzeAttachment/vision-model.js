function findVisionModel(settings = {}) {
  const models = Array.isArray(settings.aiModels) ? settings.aiModels : []
  const visionModels = models.filter((item) => item && item.supportsVision === true)
  if (visionModels.length === 0) return null

  const defaultModelId = String(settings.aiDefaultModelId || '').trim()
  return visionModels.find((item) => item.id === defaultModelId) || visionModels[0]
}

module.exports = { findVisionModel }
