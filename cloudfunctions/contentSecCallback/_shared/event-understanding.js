const { projectSemanticTagsFromNormalizedEvent } = require('./normalized-event')

function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildTimelineRecordTitle(input) {
  const normalized = trimText(input)
  if (!normalized) return ''
  const firstChunk = normalized.split(/[。！？!?；;，,\n]/).map((item) => item.trim()).find(Boolean) || normalized
  return firstChunk.length <= 20 ? firstChunk : `${firstChunk.slice(0, 20).trim()}...`
}

// 兼容旧调用签名；事件类型不再从原文关键词推断。
function classifyTimelineEvent() {
  return 'note'
}

function buildResolvedSemanticTags(_record, eventInsight) {
  const source = eventInsight && typeof eventInsight === 'object' ? eventInsight : {}
  return projectSemanticTagsFromNormalizedEvent({
    actor: ['target', 'self', 'both', 'unknown'].includes(source.actor) ? source.actor : 'unknown',
    interaction: ['initiated', 'responded', 'rejected', 'delayed', 'promised', 'fulfilled', 'observed', 'unclear'].includes(source.interaction)
      ? source.interaction
      : 'unclear',
    commitmentStatus: ['none', 'promised', 'fulfilled', 'broken', 'unclear'].includes(source.commitmentStatus)
      ? source.commitmentStatus
      : 'unclear',
    commitmentType: 'none',
    evidenceType: ['fact', 'feeling', 'mixed', 'unclear'].includes(source.evidenceType) ? source.evidenceType : 'unclear',
    scene: [],
    signals: [],
    strength: 'weak'
  }, 'fallback')
}

async function inferTimelineRecord(params = {}) {
  const description = trimText(params.description)
  return {
    eventType: 'note',
    eventTitle: buildTimelineRecordTitle(description) || '关系记录',
    summary: '旧事件理解入口已停用，等待统一语义归一化链路处理。',
    semanticTags: null,
    usedAI: false,
    validationError: 'LEGACY_EVENT_UNDERSTANDING_DISABLED'
  }
}

module.exports = {
  buildTimelineRecordTitle,
  classifyTimelineEvent,
  inferTimelineRecord,
  buildResolvedSemanticTags
}
