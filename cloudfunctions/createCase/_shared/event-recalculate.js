const { deriveLabels } = require('./engine')
const { analyzeTimelineEvent } = require('./ai-event')

const ALL_CATEGORIES = [
  'initiative',
  'investment',
  'progression',
  'consistency',
  'avoidance',
  'verifiability',
  'instability',
  'evidence_strength'
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function bucketize(score) {
  if (score < 25) return 'low'
  if (score < 45) return 'low_medium'
  if (score < 60) return 'medium'
  if (score < 75) return 'medium_high'
  return 'high'
}

function bumpEvidence(level, delta) {
  const scale = ['E1', 'E2', 'E3', 'E4', 'E5']
  const currentIndex = scale.indexOf(level)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  return scale[clamp(safeIndex + delta, 0, scale.length - 1)]
}

function deriveConfidence(level) {
  if (level === 'E1' || level === 'E2') return 'low'
  if (level === 'E3') return 'medium'
  return 'high'
}

function deriveNextAction(intentScore, riskScore, evidenceLevel) {
  if (evidenceLevel === 'E1') return 'insufficient_data'
  if (riskScore >= 75) return 'pause'
  if (riskScore >= 60) return 'verify'
  if (intentScore >= 60 && riskScore < 45 && ['E3', 'E4', 'E5'].includes(evidenceLevel)) return 'clarify'
  return 'observe'
}

function normalizeSignalSummary(summary) {
  const nextSummary = {}
  for (const key of ALL_CATEGORIES) {
    nextSummary[key] = typeof summary?.[key] === 'number' ? summary[key] : 0
  }
  return nextSummary
}

function applyCategoryEffects(summary, analysis) {
  const nextSummary = { ...summary }
  if (analysis.categories.includes('initiative')) nextSummary.initiative += analysis.intentDelta > 0 ? 2 : -1
  if (analysis.categories.includes('investment')) nextSummary.investment += analysis.intentDelta > 0 ? 2 : -1
  if (analysis.categories.includes('progression')) nextSummary.progression += analysis.intentDelta > 0 ? 2 : -1
  if (analysis.categories.includes('consistency')) nextSummary.consistency -= analysis.riskDelta > 0 ? 2 : -1
  if (analysis.categories.includes('avoidance')) nextSummary.avoidance -= analysis.riskDelta > 0 ? 2 : -1
  if (analysis.categories.includes('verifiability')) nextSummary.verifiability += analysis.riskDelta > 0 ? -2 : 2
  if (analysis.categories.includes('instability')) nextSummary.instability -= analysis.riskDelta > 0 ? 2 : -1
  return nextSummary
}

function buildHeadline(intentScore, riskScore, analysis) {
  if (analysis.usedAI) {
    return `AI 研判后：${analysis.summary}`
  }
  if (riskScore >= 70) return '新增事件后，风险明显抬升，建议优先做事实验证。'
  if (intentScore >= 60 && riskScore < 45) return '新增事件后，关系信号整体偏稳，但仍应继续看一致性。'
  if (intentScore < 45) return '新增事件后，主动与投入信号仍偏弱，不宜过度投入。'
  return '新增事件后，判断出现轻度变化，建议继续观察关键互动。'
}

async function recalculateAssessmentFromEvent(params) {
  const {
    previous,
    event,
    assessmentId,
    recentTimeline = [],
    caseProfile,
    aiSettings
  } = params
  const analysis = await analyzeTimelineEvent({
    latestResult: previous,
    event,
    recentTimeline,
    caseProfile,
    settings: aiSettings
  })
  const nextSignalSummary = applyCategoryEffects(normalizeSignalSummary(previous.signalSummary), analysis)
  const nextIntentScore = clamp((previous.intentScore ?? 0) + analysis.intentDelta, 0, 100)
  const nextRiskScore = clamp((previous.consistencyRiskScore ?? 0) + analysis.riskDelta, 0, 100)
  const nextEvidenceLevel = bumpEvidence(previous.evidenceLevel || 'E1', analysis.evidenceDelta)
  const nextConfidenceLevel = deriveConfidence(nextEvidenceLevel)
  const nextAction = deriveNextAction(nextIntentScore, nextRiskScore, nextEvidenceLevel)
  const nextLabels = deriveLabels(nextSignalSummary, nextEvidenceLevel)
  const createdAt = new Date()
  const {
    _id: _previousDocId,
    caseId: _previousCaseId,
    ...previousSnapshot
  } = previous

  return {
    ...previousSnapshot,
    assessmentId,
    createdAt,
    version: previous.version || 'v0.1',
    source: 'event_recalculation',
    triggerEventId: event.id,
    triggerEventTitle: analysis.eventTitle || event.title,
    triggerEventType: analysis.eventType || event.type,
    intentScore: nextIntentScore,
    intentBucket: bucketize(nextIntentScore),
    consistencyRiskScore: nextRiskScore,
    riskBucket: bucketize(nextRiskScore),
    evidenceLevel: nextEvidenceLevel,
    confidenceLevel: nextConfidenceLevel,
    primaryLabels: nextLabels,
    nextAction,
    explanation: {
      headline: buildHeadline(nextIntentScore, nextRiskScore, analysis),
      bullets: analysis.rationale,
      cautions: [
        analysis.usedAI ? '本次结论包含 AI 对事件语义的结构化研判。' : '当前未启用 AI，仍使用规则兜底重算。',
        '如果后续新增事件与本次方向相反，结论仍可能继续变化。',
        analysis.summary ? `本次主要触发：${analysis.summary}。` : '本次变化来自新增时间线事件。'
      ]
    },
    signalSummary: nextSignalSummary
  }
}

module.exports = {
  recalculateAssessmentFromEvent
}
