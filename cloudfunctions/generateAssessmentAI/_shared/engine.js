const { questionMappingRules } = require('./config')

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

function directionValue(direction) {
  switch (direction) {
    case 'positive': return 1
    case 'negative': return -1
    case 'neutral': return 0
    case 'uncertain': return 0
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toScoreFromSigned(raw, minRaw, maxRaw) {
  if (maxRaw <= minRaw) return 50
  const normalized = ((raw - minRaw) / (maxRaw - minRaw)) * 100
  return Math.round(clamp(normalized, 0, 100))
}

function bucketize(score) {
  if (score < 25) return 'low'
  if (score < 45) return 'low_medium'
  if (score < 60) return 'medium'
  if (score < 75) return 'medium_high'
  return 'high'
}

function getRulesMap(rules) {
  const map = new Map()
  for (const rule of rules) {
    const key = `${rule.questionId}::${rule.optionValue}`
    const existing = map.get(key) ?? []
    existing.push(rule)
    map.set(key, existing)
  }
  return map
}

function collectSignals(answers, extractedTextSignals) {
  const rulesMap = getRulesMap(questionMappingRules)
  const signals = []

  for (const answer of answers) {
    if (typeof answer.value !== 'string') continue
    const key = `${answer.questionId}::${answer.value}`
    const matched = rulesMap.get(key) ?? []
    for (const rule of matched) {
      for (const signal of rule.signals) {
        signals.push({ ...signal, source: 'answer' })
      }
    }
  }

  for (const signal of extractedTextSignals) {
    if (signal.confidence === 'low') continue
    signals.push({
      category: signal.category,
      direction: signal.direction,
      weight: signal.weight,
      magnitude: signal.magnitude,
      source: 'text'
    })
  }

  return signals
}

function summarizeSignals(signals) {
  const summary = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0]))
  for (const signal of signals) {
    summary[signal.category] += directionValue(signal.direction) * signal.weight * signal.magnitude
  }
  return summary
}

function countEvidenceScore(answers) {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]))
  let score = 0

  const q20 = byId.get('Q20')
  if (q20 === 'mostly_feelings') score += 0
  else if (q20 === 'few_facts_many_guesses') score += 1
  else if (q20 === 'half_half') score += 2
  else if (q20 === 'many_concrete_facts') score += 3
  else if (q20 === 'mostly_fact_based') score += 4

  const q21 = byId.get('Q21')
  if (q21 === 'almost_none') score += 0
  else if (q21 === 'only_one') score += 1
  else if (q21 === 'two_or_three') score += 2
  else if (q21 === 'multiple') score += 3
  else if (q21 === 'highly_repetitive') score += 4

  const q22 = byId.get('Q22')
  if (q22 === 'under_3_days') score += 0
  else if (q22 === 'several_days') score += 1
  else if (q22 === 'one_to_two_weeks') score += 2
  else if (q22 === 'two_to_six_weeks') score += 3
  else if (q22 === 'longer') score += 4

  return score
}

function deriveEvidenceLevel(answers) {
  const score = countEvidenceScore(answers)
  if (score <= 2) return 'E1'
  if (score <= 5) return 'E2'
  if (score <= 8) return 'E3'
  if (score <= 10) return 'E4'
  return 'E5'
}

function deriveConfidenceLevel(evidenceLevel) {
  if (evidenceLevel === 'E1' || evidenceLevel === 'E2') return 'low'
  if (evidenceLevel === 'E3') return 'medium'
  return 'high'
}

function deriveLabels(summary, evidenceLevel) {
  const labels = []

  if (summary.initiative <= -10 && summary.investment <= -10) {
    labels.push('单向投入')
  }
  if (summary.progression >= 6 && summary.consistency <= -8) {
    labels.push('口头热情，行动不足')
  }
  if (summary.verifiability <= -8 && summary.avoidance <= -8) {
    labels.push('关键问题难验证')
  }
  if (summary.instability <= -8) {
    labels.push('节奏明显不稳定')
  }
  if (evidenceLevel === 'E1' || evidenceLevel === 'E2') {
    labels.push('证据不足')
  }

  return labels
}

function deriveNextAction(intentScore, riskScore, evidenceLevel) {
  if (evidenceLevel === 'E1') return 'insufficient_data'
  if (riskScore >= 75) return 'pause'
  if (riskScore >= 60) return 'verify'
  if (intentScore >= 60 && riskScore < 45 && (evidenceLevel === 'E3' || evidenceLevel === 'E4' || evidenceLevel === 'E5')) return 'clarify'
  return 'observe'
}

function buildExplanation(
  intentScore,
  riskScore,
  evidenceLevel,
  labels,
  summary
) {
  const headline =
    intentScore >= 60
      ? '对方存在一定主动和投入迹象，但仍需结合一致性继续观察。'
      : '当前主动与投入信号偏弱，更适合先观察而不是提前投入。'

  const bullets = []
  const cautions = []

  if (summary.initiative > 0) bullets.push('主动性有一定正向信号。')
  else if (summary.initiative < 0) bullets.push('主动性偏弱，更多可能仍由你在推动。')

  if (summary.investment > 0) bullets.push('对方投入度存在一些积极表现。')
  else if (summary.investment < 0) bullets.push('投入度偏低，互动质量可能不足。')

  if (summary.consistency < 0) bullets.push('前后一致性存在一定风险。')
  if (summary.avoidance < 0) bullets.push('在关键问题上存在回避倾向。')
  if (summary.verifiability < 0) bullets.push('关键事实可验证性偏低。')
  if (summary.instability < 0) bullets.push('互动节奏存在波动，不建议只看单次热度。')

  if (evidenceLevel === 'E1' || evidenceLevel === 'E2') {
    cautions.push('当前证据偏少，不建议下强结论。')
  }
  if (labels.includes('节奏明显不稳定')) {
    cautions.push('忽冷忽热不等于无意向，但会显著降低判断可靠性。')
  }
  cautions.push('本结果是辅助判断，不代表事实裁决。')

  return { headline, bullets, cautions }
}

function evaluateAssessment(params) {
  const extractedTextSignals = params.extractedTextSignals ?? []
  const signals = collectSignals(params.answers, extractedTextSignals)
  const summary = summarizeSignals(signals)

  const intentRaw =
    summary.initiative * 0.35 +
    summary.investment * 0.30 +
    summary.progression * 0.25 +
    summary.instability * 0.10

  const riskRaw =
    Math.max(0, -summary.consistency) * 0.35 +
    Math.max(0, -summary.avoidance) * 0.25 +
    Math.max(0, -summary.verifiability) * 0.20 +
    Math.max(0, -summary.instability) * 0.20

  const intentScore = toScoreFromSigned(intentRaw, -30, 30)
  const consistencyRiskScore = Math.round(clamp(riskRaw * 2.5, 0, 100))

  const evidenceLevel = deriveEvidenceLevel(params.answers)
  const confidenceLevel = deriveConfidenceLevel(evidenceLevel)
  const primaryLabels = deriveLabels(summary, evidenceLevel)
  const nextAction = deriveNextAction(intentScore, consistencyRiskScore, evidenceLevel)
  const explanation = buildExplanation(intentScore, consistencyRiskScore, evidenceLevel, primaryLabels, summary)

  return {
    assessmentId: params.assessmentId,
    version: 'v0.1',
    intentScore,
    intentBucket: bucketize(intentScore),
    consistencyRiskScore,
    riskBucket: bucketize(consistencyRiskScore),
    evidenceLevel,
    confidenceLevel,
    primaryLabels,
    nextAction,
    explanation,
    signalSummary: summary
  }
}

module.exports = {
  evaluateAssessment,
  deriveLabels
}
