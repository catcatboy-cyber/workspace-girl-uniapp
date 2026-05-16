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
    return analysis.summary || '这次事件已经纳入当前关系判断。'
  }
  if (riskScore >= 70) return '新增事件后，风险明显抬升，建议优先做事实验证。'
  if (intentScore >= 60 && riskScore < 45) return '新增事件后，关系信号整体偏稳，但仍应继续看一致性。'
  if (intentScore < 45) return '新增事件后，主动与投入信号仍偏弱，不宜过度投入。'
  return '新增事件后，判断出现轻度变化，建议继续观察关键互动。'
}

const focusLabelMap = {
  '单向投入': {
    meaning: '大部分推进成本还在你这边，对方并没有持续拿出相称的主动和投入。',
    action: '先停掉补位式推进，看对方会不会自己来推进。',
    nextRecordPrompt: '如果你先停一下，对方会不会自己来推进。'
  },
  '口头热情，行动不足': {
    meaning: '嘴上表达不差，但真正落到见面、兑现、安排这些动作上还不够。',
    action: '不要按话术加码投入，重点看下一次是否真的落地。',
    nextRecordPrompt: '答应过的见面、安排或回应，这次有没有真正落地。'
  },
  '关键问题难验证': {
    meaning: '一些关键说法、身份、时间线或承诺，当前还对不上或很难核实。',
    action: '优先做事实验证，不要在模糊区继续脑补。',
    nextRecordPrompt: '有没有新的可核实事实，或者原说法能不能对上。'
  },
  '节奏明显不稳定': {
    meaning: '热度、态度或推进节奏前后反复，单次高点不代表整体趋势。',
    action: '把注意力从单点体感切回连续记录，至少再看几轮互动。',
    nextRecordPrompt: '后续两三次互动是继续反复，还是开始稳定。'
  },
  '证据不足': {
    meaning: '现阶段样本还太少，很多判断仍停留在感觉层，不够稳。',
    action: '先补真实事件和重复模式，再决定要不要下结论。',
    nextRecordPrompt: '一条具体、可复盘、不是纯感觉的真实互动。'
  }
}

function buildFocusStatus(eventType, nextAction) {
  if (nextAction === 'pause') return '降速观察'
  if (nextAction === 'verify') return '验证中'
  if (nextAction === 'clarify') return '升温中'
  if (eventType === 'risk') return '风险抬头'
  if (eventType === 'positive') return '升温中'
  if (eventType === 'verification') return '验证中'
  return '继续观察'
}

function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function clipText(value, maxLength = 48) {
  const normalized = trimText(value)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized
}

function getSourceEventTitle(event, analysis) {
  return trimText(analysis.eventTitle || event.title || event.description || '上一次记录')
}

function buildFocusBasis(event, analysis, preset) {
  const summary = trimText(analysis.summary)
  const rationale = Array.isArray(analysis.rationale)
    ? analysis.rationale.map(trimText).find(Boolean)
    : ''
  const reason = summary || rationale || preset.meaning
  if (!reason) return '继续观察后续动作是否一致。'
  return clipText(reason, 58)
}

function buildSpecificNextRecordPrompt(event, analysis, preset) {
  const sourceTitle = getSourceEventTitle(event, analysis)
  const eventType = analysis.eventType || event.type
  const role = event.subjectRole
  const subjectPrefix = role === 'self'
    ? '对方接下来是否回应你的主动或表达'
    : role === 'both'
      ? '双方下一次互动里，对方是否给出更明确的回应'
      : role === 'unknown'
        ? '这件事的行为主体能不能补清楚'
        : '对方下一次是否拿出更具体的动作'

  if (eventType === 'risk') {
    return `围绕「${clipText(sourceTitle, 18)}」，记录对方是否继续回避、拖延或让承诺落空。`
  }
  if (eventType === 'verification') {
    return `围绕「${clipText(sourceTitle, 18)}」，记录新的事实能不能对上原来的说法。`
  }
  if (eventType === 'positive') {
    return `围绕「${clipText(sourceTitle, 18)}」，记录${subjectPrefix}，而不是只停留在口头热度。`
  }
  return `${subjectPrefix}；如果没有新动作，就记录没有发生什么。`
}

function buildSpecificAction(event, analysis, preset) {
  const role = event.subjectRole
  if (role === 'self') {
    return '先不要把自己的投入自动当成对方信号，重点看对方有没有接住并给出清楚回应。'
  }
  if (role === 'unknown') {
    return '先补清谁做了什么，再决定这条记录应不应该影响对方判断。'
  }
  if ((analysis.eventType || event.type) === 'verification') {
    return '先做事实核对，再决定要不要继续推进。'
  }
  return preset.action
}

function buildNextRecordFocus(params) {
  const {
    labels,
    event,
    analysis,
    nextAction,
    createdAt
  } = params
  const label = labels[0] || '继续观察后续是否稳定'
  const preset = focusLabelMap[label] || {
    meaning: analysis.summary || '当前没有特别突出的结构性提醒，重点不是下结论，而是看后续动作能不能持续。',
    action: '继续记录关键互动，优先盯兑现、主动和明确回应。',
    nextRecordPrompt: '有没有新的主动推进，或者有没有一次明确兑现。'
  }

  return {
    label,
    status: buildFocusStatus(analysis.eventType || event.type, nextAction),
    meaning: preset.meaning,
    basis: buildFocusBasis(event, analysis, preset),
    action: buildSpecificAction(event, analysis, preset),
    nextRecordPrompt: buildSpecificNextRecordPrompt(event, analysis, preset) || preset.nextRecordPrompt,
    sourceEventId: event.id,
    sourceEventTitle: getSourceEventTitle(event, analysis),
    sourceEventType: analysis.eventType || event.type,
    generatedAt: createdAt
  }
}

async function recalculateAssessmentFromEvent(params) {
  const {
    previous,
    event,
    assessmentId,
    recentTimeline = [],
    caseProfile,
    selfProfile,
    aiSettings,
    traceId
  } = params
  const analysis = await analyzeTimelineEvent({
    latestResult: previous,
    event,
    recentTimeline,
    caseProfile,
    selfProfile,
    settings: aiSettings,
    traceId
  })
  const nextSignalSummary = applyCategoryEffects(normalizeSignalSummary(previous.signalSummary), analysis)
  const nextIntentScore = clamp((previous.intentScore ?? 0) + analysis.intentDelta, 0, 100)
  const nextRiskScore = clamp((previous.consistencyRiskScore ?? 0) + analysis.riskDelta, 0, 100)
  const nextEvidenceLevel = bumpEvidence(previous.evidenceLevel || 'E1', analysis.evidenceDelta)
  const nextConfidenceLevel = deriveConfidence(nextEvidenceLevel)
  const nextAction = deriveNextAction(nextIntentScore, nextRiskScore, nextEvidenceLevel)
  const nextLabels = deriveLabels(nextSignalSummary, nextEvidenceLevel)
  const createdAt = new Date()
  const nextRecordFocus = buildNextRecordFocus({
    labels: nextLabels,
    event,
    analysis,
    nextAction,
    createdAt
  })
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
    nextRecordFocus,
    rawReply: analysis.rawReply || '',
    actionAdvice: analysis.actionAdvice || null,
    eventInsight: analysis.eventInsight || null,
    sideReadAdvice: analysis.sideReadAdvice || null,
    currentStatus: analysis.currentStatus || null,
    explanation: {
      headline: buildHeadline(nextIntentScore, nextRiskScore, analysis),
      bullets: analysis.rationale,
      cautions: [
        analysis.usedAI ? '本次主要看对方动作、回应节奏和后续兑现。' : '本次先按可见事实做保守判断。',
        '如果后续新增事件与本次方向相反，结论仍可能继续变化。',
        analysis.summary ? `本次主要触发：${analysis.summary}。` : '本次变化来自新增时间线事件。'
      ]
    },
    signalSummary: nextSignalSummary,
    aiUsed: Boolean(analysis.usedAI),
    aiProvider: analysis.aiProvider || '',
    aiModel: analysis.aiModel || '',
    tokenUsage: analysis.tokenUsage || null
  }
}

module.exports = {
  recalculateAssessmentFromEvent
}
