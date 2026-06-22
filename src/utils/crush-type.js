const TYPE_MAP = {
  insufficient_evidence: {
    key: 'insufficient_evidence',
    label: '证据不足型',
    summary: '信息还不够，不适合直接下结论。',
    shareTitle: '我测出来是「证据不足型」，是不是我想太多了？',
    tone: 'muted'
  },
  ambiguous_observer: {
    key: 'ambiguous_observer',
    label: '暧昧观望型',
    summary: '有好感或回应，但推进还不够明确。',
    shareTitle: '我测出来是「暧昧观望型」，你帮我看看准不准？',
    tone: 'warm'
  },
  warming_stable: {
    key: 'warming_stable',
    label: '稳定升温型',
    summary: '互动在变清晰，风险暂时不高。',
    shareTitle: '小咪说 TA 是「稳定升温型」，这像不像他？',
    tone: 'good'
  },
  serious_progressor: {
    key: 'serious_progressor',
    label: '认真推进型',
    summary: '不只说，也开始用行动推进关系。',
    shareTitle: '我测出来是「认真推进型」，这次是不是有戏？',
    tone: 'good'
  },
  sweet_talker_low_action: {
    key: 'sweet_talker_low_action',
    label: '嘴甜行动少型',
    summary: '话说得好听，但兑现和行动偏弱。',
    shareTitle: '我测出来是「嘴甜行动少型」，你帮我看看准不准？',
    tone: 'risk'
  },
  hot_cold: {
    key: 'hot_cold',
    label: '忽冷忽热型',
    summary: '热度波动明显，稳定性不足。',
    shareTitle: '小咪说 TA 是「忽冷忽热型」，这像不像他？',
    tone: 'risk'
  },
  low_cost_flirt: {
    key: 'low_cost_flirt',
    label: '低成本暧昧型',
    summary: '有暧昧氛围，但实际投入不够。',
    shareTitle: '我测出来是「低成本暧昧型」，我不信。',
    tone: 'risk'
  },
  friend_boundary: {
    key: 'friend_boundary',
    label: '朋友边界型',
    summary: '互动舒服，但暧昧推进信号不足。',
    shareTitle: '我测出来是「朋友边界型」，这是没戏了吗？',
    tone: 'stable'
  }
}

function asScore(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

function labelsOf(input = {}) {
  return Array.isArray(input.primaryLabels) ? input.primaryLabels.map(String) : []
}

function evidenceRank(level) {
  const match = String(level || '').match(/^E([1-5])$/)
  return match ? Number(match[1]) : 0
}

function includesLabel(labels, keyword) {
  return labels.some((label) => label.includes(keyword))
}

export function deriveCrushType(input = {}) {
  const labels = labelsOf(input)
  const intentScore = asScore(input.intentScore, 50)
  const riskScore = asScore(input.consistencyRiskScore ?? input.riskScore, 50)
  const evidence = evidenceRank(input.evidenceLevel)
  const stats = input.timelineStats || {}
  const fulfilledCount = Number(stats.fulfilledCount || 0)

  if (evidence > 0 && evidence <= 2) return TYPE_MAP.insufficient_evidence
  if (includesLabel(labels, '证据不足')) return TYPE_MAP.insufficient_evidence
  if (includesLabel(labels, '口头热情') || includesLabel(labels, '行动不足')) return TYPE_MAP.sweet_talker_low_action
  if (includesLabel(labels, '节奏明显不稳定') || includesLabel(labels, '不稳定')) return TYPE_MAP.hot_cold
  if (intentScore >= 50 && riskScore >= 60) return TYPE_MAP.low_cost_flirt
  if (intentScore >= 70 && riskScore < 45 && fulfilledCount > 0) return TYPE_MAP.serious_progressor
  if (intentScore >= 60 && riskScore < 45) return TYPE_MAP.warming_stable
  if (intentScore >= 45 && intentScore < 65) return TYPE_MAP.ambiguous_observer
  if (intentScore < 45 && riskScore < 55) return TYPE_MAP.friend_boundary
  return TYPE_MAP.ambiguous_observer
}

export function mapEvidenceLabel(level) {
  switch (level) {
    case 'E1': return '证据很少'
    case 'E2': return '证据偏少'
    case 'E3': return '已有初步模式'
    case 'E4': return '证据较充分'
    case 'E5': return '证据很充分'
    default: return '证据待补充'
  }
}

export function mapNextActionText(nextAction, crushType) {
  switch (nextAction) {
    case 'insufficient_data': return '先补一条真实互动，再判断会更稳。'
    case 'pause': return '先降速，不要被单次热度带着走。'
    case 'verify': return '优先看 TA 会不会把话落到具体行动。'
    case 'clarify': return '可以找一个轻松机会，把关系往明确处推一点。'
    case 'observe': return '继续观察主动、回应和兑现是否连续。'
    default:
      if (crushType?.key === 'sweet_talker_low_action') return '先看 TA 会不会把“下次”变成具体时间。'
      if (crushType?.key === 'hot_cold') return '先观察热度能不能连续稳定两三次。'
      if (crushType?.key === 'friend_boundary') return '先别急着投入，观察有没有超出朋友边界的动作。'
      return '继续记录下一次真实互动。'
  }
}

export function buildCrushTypeReasons(input = {}, crushType = deriveCrushType(input)) {
  const labels = labelsOf(input)
  const reasons = []
  const intentScore = asScore(input.intentScore, 50)
  const riskScore = asScore(input.consistencyRiskScore ?? input.riskScore, 50)

  for (const label of labels) {
    if (label.includes('口头热情')) reasons.push('说得多，落地少。')
    else if (label.includes('节奏明显不稳定')) reasons.push('热度来回波动。')
    else if (label.includes('关键问题难验证')) reasons.push('关键说法还没被行动证明。')
    else if (label.includes('单向投入')) reasons.push('更多是你在推动。')
    else if (label.includes('证据不足')) reasons.push('现在还不能只靠感觉下结论。')
  }

  if (intentScore >= 60 && !reasons.some((item) => item.includes('好感'))) reasons.push('目前有一定好感或回应信号。')
  if (riskScore >= 60 && !reasons.some((item) => item.includes('风险'))) reasons.push('风险分偏高，需要看稳定性和兑现。')
  if (reasons.length === 0) reasons.push(crushType.summary)

  return [...new Set(reasons)].slice(0, 3)
}

export function getCrushTypeByKey(key) {
  return TYPE_MAP[key] || TYPE_MAP.ambiguous_observer
}
