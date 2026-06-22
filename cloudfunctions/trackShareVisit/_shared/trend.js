function direction(delta) {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function compareAssessments(previous, current) {
  if (!previous) {
    return {
      hasPrevious: false,
      intentDelta: 0,
      riskDelta: 0,
      evidenceChanged: false,
      intentDirection: 'flat',
      riskDirection: 'flat',
      summaryText: '这是第一次评估，后续复评后才能看到趋势变化。'
    }
  }

  const intentDelta = (current.intentScore || 0) - (previous.intentScore || 0)
  const riskDelta = (current.consistencyRiskScore || 0) - (previous.consistencyRiskScore || 0)
  const evidenceChanged = current.evidenceLevel !== previous.evidenceLevel

  const summaryParts = []
  if (intentDelta > 0) summaryParts.push(`意向 +${intentDelta}`)
  else if (intentDelta < 0) summaryParts.push(`意向 ${intentDelta}`)
  else summaryParts.push('意向持平')

  if (riskDelta > 0) summaryParts.push(`风险 +${riskDelta}`)
  else if (riskDelta < 0) summaryParts.push(`风险 ${riskDelta}`)
  else summaryParts.push('风险持平')

  if (evidenceChanged) {
    summaryParts.push(`证据等级 ${previous.evidenceLevel} → ${current.evidenceLevel}`)
  }

  let warningText
  if (riskDelta >= 10) {
    warningText = '与上次相比，风险上升较明显，建议优先关注发生了什么变化。'
  } else if (intentDelta <= -10) {
    warningText = '与上次相比，意向信号明显走弱，建议避免只参考更早前的正向印象。'
  }

  return {
    hasPrevious: true,
    intentDelta,
    riskDelta,
    evidenceChanged,
    intentDirection: direction(intentDelta),
    riskDirection: direction(riskDelta),
    summaryText: summaryParts.join(' / '),
    warningText
  }
}

function buildTrendTimelineRecords(params) {
  const records = []
  const now = Date.now()
  const createdAt = new Date(now).toISOString()

  records.push({
    id: `assessment-${now}-1`,
    title: `第 ${params.assessmentIndex} 次评估完成`,
    type: 'assessment',
    dateLabel: '刚刚',
    description: `当前结果：${params.intentBucket} / ${params.riskBucket} / ${params.evidenceLevel}`,
    occurrenceAt: createdAt,
    createdAt
  })

  if (Math.abs(params.riskDelta) >= 8) {
    const riskText = params.riskDelta > 0 ? `风险 +${params.riskDelta}` : `风险 ${params.riskDelta}`
    records.push({
      id: `trend-${now}-2`,
      title: `第 ${params.assessmentIndex} 次评估：${riskText}`,
      type: 'trend',
      dateLabel: '趋势变化',
      description: params.riskDelta > 0 ? '与上次相比，风险上升较明显。' : '与上次相比，风险有所下降。',
      occurrenceAt: createdAt,
      createdAt
    })
  }

  if (Math.abs(params.intentDelta) >= 8) {
    const intentText = params.intentDelta > 0 ? `意向 +${params.intentDelta}` : `意向 ${params.intentDelta}`
    records.push({
      id: `trend-${now}-3`,
      title: `第 ${params.assessmentIndex} 次评估：${intentText}`,
      type: 'trend',
      dateLabel: '趋势变化',
      description: params.intentDelta > 0 ? '与上次相比，意向信号增强。' : '与上次相比，意向信号走弱。',
      occurrenceAt: createdAt,
      createdAt
    })
  }

  if (params.warningText) {
    records.push({
      id: `trend-${now}-4`,
      title: '趋势预警',
      type: 'risk',
      dateLabel: '系统提示',
      description: params.warningText,
      occurrenceAt: createdAt,
      createdAt
    })
  }

  return records
}

function isSystemTimelineRecord(record) {
  const id = record?._id || record?.id || ''
  return record?.type === 'assessment'
    || record?.type === 'trend'
    || String(id).startsWith('assessment-')
    || String(id).startsWith('trend-')
    || /^t\d+$/.test(String(id))
}

module.exports = {
  compareAssessments,
  buildTrendTimelineRecords,
  isSystemTimelineRecord
}
