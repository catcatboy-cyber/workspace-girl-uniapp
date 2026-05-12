// ============================================================================
// Timeline utilities (extracted from timeline.ts)
// ============================================================================

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

function findTimestampInId(id) {
  if (!id) return null
  const match = id.match(/(\d{13})/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

export function getTimelineRecordTimestamp(record) {
  if (record.occurrenceAt) {
    const parsed = new Date(record.occurrenceAt).getTime()
    if (!Number.isNaN(parsed)) return parsed
  }
  if (record.createdAt) {
    const parsed = new Date(record.createdAt).getTime()
    if (!Number.isNaN(parsed)) return parsed
  }
  return findTimestampInId(record.id || record._id)
}

export function sortTimelineRecordsDesc(records) {
  return records
    .slice()
    .sort((a, b) => {
      const left = getTimelineRecordTimestamp(a) ?? 0
      const right = getTimelineRecordTimestamp(b) ?? 0
      return right - left
    })
}

export function isSystemTimelineRecord(record) {
  const recordId = record?.id || record?._id
  if (!record || !recordId) return false
  return record.type === 'assessment'
    || record.type === 'trend'
    || recordId.startsWith('assessment-')
    || recordId.startsWith('trend-')
    || /^t\d+$/.test(recordId)
}

function getTimelineTagText(record) {
  return `${record?.title || ''} ${record?.description || ''} ${record?.dateLabel || ''}`.toLowerCase()
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value)
}

function normalizeStoredSemanticTags(record) {
  const semantic = record?.semanticTags
  if (!semantic || typeof semantic !== 'object') return null

  const scene = Array.isArray(semantic.scene) ? semantic.scene.filter(Boolean) : []
  const behavior = Array.isArray(semantic.behavior) ? semantic.behavior.filter(Boolean) : []
  const outcome = Array.isArray(semantic.outcome) ? semantic.outcome.filter(Boolean) : []
  const risk = Array.isArray(semantic.risk) ? semantic.risk.filter(Boolean) : []

  if (semantic.initiator === 'target') pushUnique(behavior, 'target_initiated')
  if (semantic.initiator === 'self') pushUnique(behavior, 'self_initiated')
  if (semantic.response === 'rejected') pushUnique(risk, 'rejected')
  if (semantic.response === 'pending') pushUnique(outcome, 'pending')
  if (semantic.commitment?.fulfilled) pushUnique(outcome, 'fulfilled')
  if (semantic.commitment?.exists && !semantic.commitment?.fulfilled) pushUnique(outcome, 'planned')

  const hasAny = scene.length || behavior.length || outcome.length || risk.length
  if (!hasAny) return null

  return {
    scene,
    behavior,
    outcome,
    risk,
    all: [...scene, ...behavior, ...outcome, ...risk]
  }
}

export function getTimelineRecordTags(record) {
  const semanticTags = normalizeStoredSemanticTags(record)
  if (semanticTags) return semanticTags

  const text = getTimelineTagText(record)
  const scene = []
  const behavior = []
  const outcome = []
  const risk = []

  if (includesAny(text, ['见面', '碰面', '线下见', '出来见', '约会', '赴约', '见到了', '碰面了', '出来了'])) pushUnique(scene, 'offline_meet')
  if (includesAny(text, ['电影', '影院', '看电影'])) pushUnique(scene, 'movie')
  if (includesAny(text, ['吃饭', '晚饭', '午饭', '早餐', '夜宵', '火锅', '烧烤', '餐厅'])) pushUnique(scene, 'meal')
  if (includesAny(text, ['咖啡', '奶茶', '喝咖啡', '喝奶茶'])) pushUnique(scene, 'coffee_tea')
  if (includesAny(text, ['散步', '逛街', '走走', '压马路'])) pushUnique(scene, 'walk_shop')
  if (includesAny(text, ['朋友局', '朋友一起', '同学聚会', '多人活动', '聚会', '带我见朋友', '介绍朋友'])) pushUnique(scene, 'group_social')
  if (includesAny(text, ['旅行', '旅游', '出游', '郊游', '露营'])) pushUnique(scene, 'trip')
  if (includesAny(text, ['聊天', '微信', '消息', '回复', '发消息', '语音', '电话', '视频'])) pushUnique(scene, 'chat')

  if (record?.subjectRole === 'self') pushUnique(behavior, 'self_initiated')
  if (record?.subjectRole === 'target') pushUnique(behavior, 'target_side')
  if (record?.subjectRole === 'both') pushUnique(behavior, 'both_interaction')
  if (includesAny(text, ['主动约我', '主动找我', '主动联系我', '他主动', '她主动', '对方主动', '邀请我', '来找我', '主动确认'])) pushUnique(behavior, 'target_initiated')
  if (includesAny(text, ['我主动', '我先', '我约', '我问', '我发', '我联系'])) pushUnique(behavior, 'self_initiated')

  if (includesAny(text, ['答应', '说好', '确定', '确认', '约好', '安排', '计划', '下次', '改天', '周末'])) pushUnique(outcome, 'planned')
  if (includesAny(text, [
    '兑现', '落实', '说到做到', '真的来了', '来了', '到了', '赴约', '见到了',
    '一起去了', '一起看了', '一起吃了', '一起吃饭了', '一起吃饭', '吃完饭',
    '吃过饭', '实际吃饭', '真的一起吃', '真的去吃', '按时到了', '到场了',
    '安排好了', '定好了'
  ])) pushUnique(outcome, 'fulfilled')
  if (includesAny(text, ['取消', '改期', '推迟', '放鸽子', '失约', '没来', '拖延', '改口'])) pushUnique(outcome, 'cancelled_delayed')
  if (includesAny(text, ['待确认', '再看', '看情况', '以后再说', '不确定', '到时候再说'])) pushUnique(outcome, 'pending')

  if (record?.type === 'risk') pushUnique(risk, 'risk_event')
  if (includesAny(text, ['拒绝', '被拒', '婉拒', '不去', '不想', '没答应', '算了', '推掉', '来不了'])) pushUnique(risk, 'rejected')
  if (includesAny(text, ['已读不回', '没回', '不回', '冷淡', '敷衍', '消失', '回避'])) pushUnique(risk, 'cold')
  if (includesAny(text, ['再看', '看情况', '以后再说', '不确定', '拖延', '改口'])) pushUnique(risk, 'vague_delay')
  if (record?.aiUsed) pushUnique(outcome, 'ai_reviewed')

  return {
    scene,
    behavior,
    outcome,
    risk,
    all: [...scene, ...behavior, ...outcome, ...risk]
  }
}

export function buildTimelineStats(records) {
  const manualRecords = (records || []).filter((item) => !isSystemTimelineRecord(item))
  const count = (tag) => manualRecords.filter((item) => getTimelineRecordTags(item).all.includes(tag)).length

  return {
    totalCount: manualRecords.length,
    offlineMeetCount: count('offline_meet'),
    movieCount: count('movie'),
    mealCount: count('meal'),
    coffeeTeaCount: count('coffee_tea'),
    targetInitiatedCount: count('target_initiated'),
    fulfilledCount: count('fulfilled'),
    rejectedCount: count('rejected'),
    cancelledDelayedCount: count('cancelled_delayed'),
    aiReviewedCount: count('ai_reviewed')
  }
}

// ============================================================================
// Trend comparison (from trend.ts)
// ============================================================================

function direction(delta) {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

export function compareAssessments(previous, current) {
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

  const intentDelta = current.intentScore - previous.intentScore
  const riskDelta = current.consistencyRiskScore - previous.consistencyRiskScore
  const evidenceChanged = current.evidenceLevel !== previous.evidenceLevel

  const intentDirection = direction(intentDelta)
  const riskDirection = direction(riskDelta)

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
    intentDirection,
    riskDirection,
    summaryText: summaryParts.join(' / '),
    warningText
  }
}

// ============================================================================
// Weekly review (from review-insights.ts)
// ============================================================================

function getTimelineRecordTime(record) {
  const timestamp = getTimelineRecordTimestamp(record)
  return timestamp ? new Date(timestamp) : null
}

function isWithinLastDays(date, now, days) {
  if (!date || Number.isNaN(date.getTime())) return false
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000
}

function summarizeWeeklyDirection(caseFile, now) {
  const recentAssessments = caseFile.assessments
    .filter((item) => isWithinLastDays(item.createdAt ? new Date(item.createdAt) : null, now, 7))
    .sort((a, b) => (a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1)

  if (recentAssessments.length >= 2) {
    return compareAssessments(recentAssessments[0], recentAssessments[recentAssessments.length - 1])
  }

  if (recentAssessments.length === 1 && caseFile.assessments.length >= 2) {
    return compareAssessments(caseFile.assessments[caseFile.assessments.length - 2], recentAssessments[0])
  }

  return null
}

export function buildCaseWeeklyReview(caseFile, now = new Date()) {
  const recentTimeline = caseFile.timeline.filter((item) => isWithinLastDays(getTimelineRecordTime(item), now, 7))
  const userFacingTimeline = recentTimeline.filter((item) => item.type === 'positive' || item.type === 'risk' || item.type === 'verification' || item.type === 'note')
  const verificationCount = userFacingTimeline.filter((item) => item.type === 'verification').length
  const riskEvent = userFacingTimeline.find((item) => item.type === 'risk')
  const positiveEvent = userFacingTimeline.find((item) => item.type === 'positive')
  const direction = summarizeWeeklyDirection(caseFile, now)

  if (!caseFile.latestResult) return null

  const summary =
    userFacingTimeline.length === 0
      ? '最近 7 天还没有新增事件，下一次关键互动出现时更适合回来记录。'
      : direction?.warningText
        ? direction.warningText
        : direction?.intentDirection === 'up' && direction.riskDirection !== 'up'
          ? '最近 7 天关系信号在变清晰，重点继续看后续是否稳定落地。'
          : direction?.riskDirection === 'up'
            ? '最近 7 天风险线索更活跃，最值得做的是回看有没有回避、改口或失约。'
            : '最近 7 天有新变化，但还需要更多连续事件才能把方向看清。'

  const highlight = positiveEvent
    ? `本周最真实的一次推进：${positiveEvent.title}`
    : direction?.intentDelta && direction.intentDelta > 0
      ? '本周意向有抬升，但还没有特别明确的一次推进事件。'
      : '本周还没有特别明确的推进事件。'

  const warning = riskEvent
    ? `本周最该警惕的信号：${riskEvent.title}`
    : direction?.riskDelta && direction.riskDelta > 0
      ? '本周风险在抬头，但还没有单个特别突出的风险事件。'
      : '本周暂时没有特别尖锐的风险信号。'

  return {
    title: '最近 7 天回顾',
    summary,
    highlight,
    warning,
    stats: [
      { label: '新记录', value: String(userFacingTimeline.length) },
      { label: '验证次数', value: String(verificationCount) },
      { label: '当前意向', value: String(caseFile.latestResult.intentScore) },
      { label: '当前风险', value: String(caseFile.latestResult.consistencyRiskScore) }
    ]
  }
}

export function buildObservationAchievements(cases, now = new Date()) {
  const allTimeline = cases.flatMap((item) => item.timeline || [])
  const allAssessments = cases.flatMap((item) => item.assessments || [])
  const userEvents = allTimeline.filter((item) => item && (item.type === 'positive' || item.type === 'risk' || item.type === 'verification' || item.type === 'note'))
  const verificationCount = userEvents.filter((item) => item.type === 'verification').length
  const recentEventCount = userEvents.filter((item) => isWithinLastDays(getTimelineRecordTime(item), now, 7)).length

  const achievements = []

  if (userEvents.length > 0) {
    achievements.push({
      title: '关键事件观察者',
      value: `${userEvents.length} 条`,
      description: `已记录第 ${userEvents.length} 个关键事件。`
    })
  }

  if (verificationCount > 0) {
    achievements.push({
      title: '验证行动派',
      value: `${verificationCount} 次`,
      description: `已完成第 ${verificationCount} 次验证。`
    })
  }

  if (allAssessments.length >= 3) {
    achievements.push({
      title: '趋势追踪者',
      value: `${allAssessments.length} 次`,
      description: `已经累计 ${allAssessments.length} 次评估，开始看得到长期变化。`
    })
  }

  if (recentEventCount >= 3) {
    achievements.push({
      title: '本周持续观察',
      value: `${recentEventCount} 条`,
      description: '最近 7 天没有只靠感觉，持续在补真实互动。'
    })
  }

  if (cases.filter((item) => item.profile.relationType || item.profile.age || item.profile.gender || item.profile.occupation || item.profile.zodiac || item.profile.constellation).length > 0) {
    achievements.push({
      title: '画像补全中',
      value: `${cases.filter((item) => item.profile.relationType || item.profile.age || item.profile.gender || item.profile.occupation || item.profile.zodiac || item.profile.constellation).length} 个`,
      description: '已经开始给对象补充画像，后续侧写会更有意思。'
    })
  }

  return achievements.slice(0, 4)
}

// ============================================================================
// Profile insights (from profile-insights.ts)
// ============================================================================

function isFilled(value) {
  return Boolean(value && value.trim())
}

export function hasProfile(profile) {
  if (!profile) return false
  return [profile.relationType, profile.age, profile.gender, profile.occupation, profile.zodiac, profile.constellation].some(isFilled)
}

export function buildProfileItems(profile) {
  if (!profile) return []

  const items = []
  if (profile.relationType === 'close_friend') items.push('类型 亲密朋友')
  else if (profile.relationType === 'romantic') items.push('类型 恋爱对象')
  if (profile.age) items.push(`年龄 ${profile.age}`)
  if (profile.gender) items.push(`性别 ${profile.gender}`)
  if (profile.occupation) items.push(`工作 ${profile.occupation}`)
  if (profile.zodiac) items.push(`属相 ${profile.zodiac}`)
  if (profile.constellation) items.push(`星座 ${profile.constellation}`)

  return items.filter(Boolean)
}

function ageNote(age) {
  if (!age) return ''
  const numeric = Number(age)
  if (Number.isNaN(numeric)) return `年龄信息是 ${age}，更建议结合当下生活阶段去理解关系节奏。`
  if (numeric < 23) return '当前更像是在探索阶段，热情和稳定不一定同步出现。'
  if (numeric < 30) return '通常会同时考虑情绪体验和现实匹配，节奏感很关键。'
  if (numeric < 40) return '更容易把时间成本和现实安排纳入判断，兑现度会很重要。'
  return '生活结构通常更明确，稳定和边界感往往比暧昧氛围更重要。'
}

function occupationNote(occupation) {
  if (!occupation) return ''
  return `工作是“${occupation}”，联系频率和见面节奏可能会受现实安排影响，所以更要看忙的时候是否仍然有交代。`
}

function getRelationTypeLabel(relationType) {
  if (relationType === 'close_friend') return '亲密朋友'
  if (relationType === 'romantic') return '恋爱对象'
  return relationType || '未说明'
}

export function buildProfileInsight(profile) {
  if (!hasProfile(profile)) return null

  const bullets = [
    ageNote(profile?.age),
    occupationNote(profile?.occupation),
    profile?.zodiac ? `属相娱乐解读：${zodiacNotes[profile.zodiac] ?? '可以当作一个聊天切口，但别拿来代替事实判断。'}` : '',
    profile?.constellation ? `星座娱乐解读：${constellationNotes[profile.constellation] ?? '可以增加趣味感，但真正有用的仍然是行动证据。'}` : ''
  ].filter(Boolean)

  const tags = [
    profile?.relationType ? `关系类型：${getRelationTypeLabel(profile.relationType)}` : '',
    profile?.occupation ? `工作节奏：${profile.occupation}` : '',
    profile?.zodiac ? `属相：${profile.zodiac}` : '',
    profile?.constellation ? `星座：${profile.constellation}` : ''
  ].filter(Boolean)

  return {
    title: '趣味画像解读',
    summary: tags.length > 0
      ? `AI 辅助上下文会参考这些资料：${tags.join(' / ')}。这里的解读只增加一点趣味，不参与核心评分。`
      : '这部分会作为 AI 的辅助上下文，主要用来增加一点趣味感，不参与核心评分。',
    bullets: bullets.length > 0 ? bullets : ['当前画像信息较少，暂时只作为轻量辅助上下文。'],
    disclaimer: '仅供娱乐和辅助理解，不能代替事实、证据和实际互动表现。'
  }
}

// ============================================================================
// Focus insights (from focus-insights.ts)
// ============================================================================

const riskLabelMap = {
  '单向投入': {
    meaning: '大部分推进成本还在你这边，对方并没有持续拿出相称的主动和投入。',
    action: '先停掉补位式推进，看对方会不会自己补动作。'
  },
  '口头热情，行动不足': {
    meaning: '嘴上表达不差，但真正落到见面、兑现、安排这些动作上还不够。',
    action: '不要按话术加码投入，重点看下一次是否真的落地。'
  },
  '关键问题难验证': {
    meaning: '一些关键说法、身份、时间线或承诺，当前还对不上或很难核实。',
    action: '优先做事实验证，不要在模糊区继续脑补。'
  },
  '节奏明显不稳定': {
    meaning: '热度、态度或推进节奏前后反复，单次高点不代表整体趋势。',
    action: '把注意力从单点体感切回连续记录，至少再看几轮互动。'
  },
  '证据不足': {
    meaning: '现阶段样本还太少，很多判断仍停留在感觉层，不够稳。',
    action: '先补真实事件和重复模式，再决定要不要下结论。'
  }
}

function eventText(event) {
  return `${event.title} ${event.description}`.toLowerCase()
}

function formatRecordedAt(event) {
  if (!event.createdAt) return undefined
  const timestamp = new Date(event.createdAt).getTime()
  if (Number.isNaN(timestamp)) return undefined
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function toFocusEvidence(event, sequenceLabel) {
  return {
    id: event.id || event._id,
    title: event.title,
    occurrenceTime: event.date || '时间未说明',
    recordedAt: formatRecordedAt(event),
    sequenceLabel,
    type: event.type,
    aiUsed: Boolean(event.aiUsed)
  }
}

function buildSequenceMap(caseFile) {
  const manualTimeline = caseFile.timeline
    .filter((item) => item.type !== 'assessment' && item.type !== 'trend')
    .slice()
    .sort((a, b) => {
      const left = getTimelineRecordTimestamp(a) ?? 0
      const right = getTimelineRecordTimestamp(b) ?? 0
      return left - right
    })

  return new Map(
    manualTimeline.map((item, index) => [item.id || item._id, `第${index + 1}次`])
  )
}

function scoreEvidence(label, event) {
  const text = eventText(event)
  let score = 0

  if (label === '单向投入') {
    if (includesAny(text, ['我主动', '我先', '没找我', '没有主动', '回得慢', '敷衍'])) score += 4
    if (event.type === 'risk' || event.type === 'note') score += 2
  }

  if (label === '口头热情，行动不足') {
    if (includesAny(text, ['答应', '说好', '安排', '约', '计划', '以后', '下次'])) score += 2
    if (includesAny(text, ['取消', '推迟', '失约', '没来', '拖延', '没有兑现'])) score += 4
    if (event.type === 'risk') score += 2
  }

  if (label === '关键问题难验证') {
    if (event.type === 'verification') score += 5
    if (includesAny(text, ['验证', '核实', '查证', '对不上', '解释', '真假', '承诺'])) score += 3
  }

  if (label === '节奏明显不稳定') {
    if (event.type === 'risk' || event.type === 'trend') score += 3
    if (includesAny(text, ['忽冷忽热', '失联', '突然', '又', '反复', '回避', '拖延'])) score += 3
    if (includesAny(text, ['主动', '见面', '解释清楚', '补偿'])) score += 1
  }

  if (label === '证据不足') {
    if (event.type === 'note' || event.type === 'assessment') score += 1
    if (includesAny(text, ['不确定', '感觉', '猜', '说不清'])) score += 3
  }

  return score
}

function isPlainRejectionEvent(text) {
  return includesAny(text, ['拒绝', '被拒', '婉拒', '没答应', '不去', '不想', '算了', '推掉', '来不了'])
}

function hasCommitmentOrArrangementText(text) {
  return includesAny(text, [
    '答应', '说好', '确定', '确认', '约好', '安排', '计划', '时间', '地点',
    '兑现', '落实', '定了', '订了', '下次', '周末', '今晚', '明天', '改天补上',
    '取消', '推迟', '改期', '放鸽子', '失约', '没来', '拖延', '改口', '没有兑现'
  ])
}

function isFocusEvidenceCompatible(label, event) {
  const text = eventText(event)

  if (label === '口头热情，行动不足') {
    if (!hasCommitmentOrArrangementText(text)) return false
    // 单纯“被拒绝一次”不能证明“之前答应过的安排是否落地”。
    // 只有同时出现承诺/安排/改期/兑现语义时，才归入这个验证重点。
    if (isPlainRejectionEvent(text) && !includesAny(text, ['答应', '说好', '约好', '安排', '计划', '确定', '确认', '取消', '推迟', '改期', '失约', '改口', '没有兑现'])) {
      return false
    }
    return true
  }

  if (label === '单向投入') {
    return includesAny(text, ['我主动', '我先', '我约', '我问', '我发', '没找我', '没有主动', '只有我', '回得慢', '敷衍'])
  }

  if (label === '关键问题难验证') {
    return event.type === 'verification' || includesAny(text, ['验证', '核实', '查证', '对不上', '解释', '真假', '承诺', '说法'])
  }

  if (label === '节奏明显不稳定') {
    return includesAny(text, ['忽冷忽热', '失联', '突然', '又', '反复', '回避', '拖延', '取消', '推迟', '改口', '补偿', '解释清楚'])
  }

  if (label === '证据不足') {
    return event.type === 'note' || includesAny(text, ['不确定', '感觉', '猜', '说不清'])
  }

  return true
}

function pickEvidence(caseFile, label) {
  const sequenceMap = buildSequenceMap(caseFile)
  const manualTimeline = caseFile.timeline.filter((item) => item.type !== 'assessment')
  const scored = manualTimeline
    .filter((event) => isFocusEvidenceCompatible(label, event))
    .map((event) => ({ event, score: scoreEvidence(label, event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      ...toFocusEvidence(item.event, sequenceMap.get(item.event.id || item.event._id))
    }))

  if (scored.length > 0) return scored

  return []
}

function buildStatus(label, evidences) {
  const latest = evidences[0]
  if (!latest) return '样本偏少'
  if (label === '证据不足') return '继续补样本'
  if (latest.type === 'risk') return '待验证'
  if (latest.type === 'verification' || latest.type === 'positive') return '观察中'
  return '暂时持平'
}

function buildNextPrompt(label) {
  switch (label) {
    case '单向投入':
      return '本次重点记录：如果你先停一下，对方会不会自己来推进。'
    case '口头热情，行动不足':
      return '本次重点记录：答应过的见面、安排或回应，这次有没有真正落地。'
    case '关键问题难验证':
      return '本次重点记录：有没有新的可核实事实，或者原说法能不能对上。'
    case '节奏明显不稳定':
      return '本次重点记录：后续两三次互动是继续反复，还是开始稳定。'
    case '证据不足':
      return '本次重点记录：一条具体、可复盘、不是纯感觉的真实互动。'
    default:
      return '本次重点记录：能直接改变判断方向的一条真实事件。'
  }
}

export function buildFocusItems(caseFile) {
  const sequenceMap = buildSequenceMap(caseFile)
  const baseLabels = caseFile.latestResult?.primaryLabels ?? []
  const insights = baseLabels.map((label) => ({
    label,
    meaning: riskLabelMap[label]?.meaning ?? '这是一条当前结构性提醒，说明某个风险维度正在偏弱或偏不稳。',
    action: riskLabelMap[label]?.action ?? '把它当作下一轮观察重点，而不是当成最终定论。'
  }))

  if (insights.length === 0) {
    return [{
      label: '继续观察后续是否稳定',
      meaning: '当前没有特别突出的结构性提醒，重点不是下结论，而是看后续动作能不能持续。',
      action: '继续记录关键互动，优先盯兑现、主动和明确回应。',
      status: '暂时平稳',
      nextRecordPrompt: '本次重点记录：有没有新的主动推进，或者有没有一次明确兑现。',
      evidences: caseFile.timeline.slice(0, 2).map((item) => toFocusEvidence(item, sequenceMap.get(item.id)))
    }]
  }

  return insights.map((item) => {
    const evidences = pickEvidence(caseFile, item.label)
    return {
      label: item.label,
      meaning: item.meaning,
      action: item.action,
      status: buildStatus(item.label, evidences),
      nextRecordPrompt: buildNextPrompt(item.label),
      evidences
    }
  })
}

// ============================================================================
// Object status card (from object-status.ts)
// ============================================================================

export function buildObjectStatusCard(caseFile) {
  const latest = caseFile.latestResult
  if (!latest) return null

  const previous = caseFile.assessments.length > 1 ? caseFile.assessments[caseFile.assessments.length - 2] : null
  const trend = compareAssessments(previous, latest)
  const latestEvent = latest.triggerEventTitle || caseFile.timeline.find((item) => !isSystemTimelineRecord(item))?.title || caseFile.timeline[0]?.title || ''
  const recentSignals = analyzeRecentManualSignals(caseFile)

  let phase = '观察期'
  if (latest.evidenceLevel === 'E1' || latest.evidenceLevel === 'E2') phase = '试探期'
  else if (latest.nextAction === 'verify') phase = '验证期'
  else if (latest.nextAction === 'pause') phase = '降温期'
  else if (latest.intentScore >= 60 && latest.consistencyRiskScore < 45) phase = '升温期'
  else if (latest.intentScore >= 45 && latest.consistencyRiskScore >= 45) phase = '拉扯期'

  let state = '继续观察'
  if (latest.intentScore >= 65 && latest.consistencyRiskScore < 45) state = '稳步推进'
  else if (latest.intentScore >= 55 && latest.consistencyRiskScore >= 55) state = '忽冷忽热'
  else if (latest.intentScore < 45 && latest.consistencyRiskScore >= 60) state = '高消耗信号'
  else if (latest.intentScore >= 50 && latest.consistencyRiskScore >= 60) state = '有热度但不稳'
  else if (latest.intentScore < 45) state = '投入偏弱'

  let weather = '多云'
  if (latest.consistencyRiskScore >= 75) weather = '雷阵雨'
  else if (latest.consistencyRiskScore >= 60) weather = '阵风'
  else if (latest.intentScore >= 70 && latest.consistencyRiskScore < 35) weather = '晴'
  else if (trend.intentDirection === 'up' && trend.riskDirection === 'down') weather = '转晴'
  else if (trend.riskDirection === 'up') weather = '起风'

  let summary =
    latest.nextAction === 'verify'
      ? '当前最重要的不是继续猜，而是把关键说法和承诺核实清楚。'
      : latest.nextAction === 'pause'
        ? '这段关系现在更适合降速观察，别被局部热度带着走。'
        : latest.intentScore >= 60 && latest.consistencyRiskScore < 45
          ? '关系信号在往前走，但真正的加分点仍然是连续兑现。'
          : '现在还没到可以下重结论的时候，继续看后续动作更重要。'

  const spotlight = latestEvent
    ? `最近的关键触发点是"${latestEvent}"。`
    : '最近还没有足够强的关键触发点。'

  let caution =
    trend.warningText
      ?? (latest.consistencyRiskScore >= 60
        ? '近期风险已经不低，后面要优先看有没有解释、兑现和补动作。'
        : latest.evidenceLevel === 'E1' || latest.evidenceLevel === 'E2'
          ? '证据还薄，任何强烈感觉都先别急着定性。'
          : '下一次最值得记录的是：对方会不会主动、会不会落地、会不会持续。')

  if (recentSignals.rejectionCount >= 2) {
    phase = '降温期'
    state = '连续受阻'
    weather = '雷阵雨'
    summary = '最近连续两次互动都出现了明确拒绝或婉拒，这已经不是单次波动，当前更应该按真实受阻信号理解。'
    caution = '先暂停新邀约和补偿式推进，重点看对方后面会不会主动补解释、补安排或补行动。'
  } else if (recentSignals.negativeCount >= 2) {
    if (phase === '升温期') phase = '拉扯期'
    if (state === '稳步推进') state = '明显转弱'
    else if (state === '继续观察') state = '有热度但不稳'
    if (weather === '晴' || weather === '转晴') weather = '阵风'
    summary = '最近两三次互动已经连续偏负向或偏被动，当前状态不能再按单次正向信号理解。'
    caution = '先别继续加码投入，优先观察对方会不会主动补回应、补兑现或补安排。'
  }

  return {
    phase,
    state,
    weather,
    summary,
    spotlight,
    caution
  }
}

function normalizeMeaningText(parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function hasAnyMeaning(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

function getActionEventText(event, current) {
  return normalizeMeaningText([
    event?.title,
    event?.description,
    current?.triggerEventTitle,
    current?.explanation?.headline,
    ...(Array.isArray(current?.primaryLabels) ? current.primaryLabels : [])
  ])
}

function inferActionScene(event, current) {
  const text = getActionEventText(event, current)
  const hasMeet = hasAnyMeaning(text, ['见面', '约', '吃饭', '电影', '咖啡', '散步', '出来', '线下', '碰面', '聚会', '旅行', '活动', '打掼蛋'])
  const hasChat = hasAnyMeaning(text, ['消息', '微信', '聊天', '回复', '电话', '语音', '视频', '已读', '不回'])
  const hasCommitment = hasAnyMeaning(text, ['承诺', '答应', '确定', '安排', '计划', '时间', '地点', '兑现', '改口', '临时', '取消'])
  const hasClarify = hasAnyMeaning(text, ['解释', '澄清', '误会', '问清', '确认', '说法', '理由'])
  const rejected = hasAnyMeaning(text, ['拒绝', '被拒', '婉拒', '没答应', '不去', '不想', '算了', '推掉'])
  const delayed = hasAnyMeaning(text, ['再看', '看情况', '改天', '下次吧', '以后再说', '不确定', '到时候再说', '先这样'])
  const broken = hasAnyMeaning(text, ['取消', '推迟', '改期', '放鸽子', '失约', '没来', '拖延', '改口'])
  const cold = hasAnyMeaning(text, ['没回', '已读不回', '冷淡', '敷衍', '消失', '回避'])

  if (hasClarify) return 'clarify'
  if ((event?.type === 'risk' || current?.nextAction === 'pause') && (rejected || delayed || broken || cold)) return 'risk_after_pullback'
  if (hasMeet && rejected) return 'meet_rejected'
  if (hasMeet && (delayed || broken)) return 'meet_unstable'
  if (hasCommitment && (broken || delayed)) return 'commitment_unstable'
  if (hasCommitment || event?.type === 'verification' || current?.nextAction === 'verify') return 'commitment'
  if (hasChat && cold) return 'chat_cold'
  if (hasChat) return 'chat'
  if (event?.type === 'risk' || current?.nextAction === 'pause') return 'risk'
  if (hasMeet || event?.type === 'positive') return 'meet'
  return 'general'
}

function buildSceneAdvice(scene, eventTitle) {
  switch (scene) {
    case 'meet_rejected':
      return {
        do: `“${eventTitle}”已经出现明确拒绝，这次不要继续补邀约，也不要立刻换一个新活动再试。穿着和状态都回到自己的日常安排，把注意力放回自己，不为了挽回局面刻意表现。`,
        say: '可以简短回：“好，没事，你先忙。”或者“收到，那这次就先这样。”点到为止，不再追问原因。',
        tone: '表情和语气保持自然、平静、不过度失落。不要阴阳怪气，也不要立刻热情找补。',
        observe: '重点看拒绝之后，对方后面会不会主动补一个新时间、新安排，或者至少给出更明确解释。如果后面完全没有补动作，这次拒绝就要按真实负向信号记。'
      }
    case 'meet_unstable':
      return {
        do: `“${eventTitle}”涉及邀约但节奏已经不稳，这次不要急着重新约。先把节奏降下来，保留正常回应，不主动承担安排者角色。`,
        say: '可以说：“那你这边确定好了再和我说。”把球放回对方，不替他继续推进。',
        tone: '状态轻一点、礼貌一点，不催、不逼、不长篇解释。',
        observe: '重点看他后面是否会主动补时间、补地点、补解释，而不是继续让你等、让你猜。'
      }
    case 'commitment_unstable':
      return {
        do: `“${eventTitle}”已经显示安排或承诺不稳，这次重点不是继续投入，而是把不一致的地方记清楚。先别替对方圆场，也别自己脑补合理化。`,
        say: '可以说：“那你确定下来再告诉我。”或者“这件事现在就先按没定算。”把事实落稳，不帮对方模糊过去。',
        tone: '语气平、短、清楚，像确认事实，不像情绪对抗。',
        observe: '重点看他后面会不会主动修正、补兑现、补说明。如果还是反复变动，就按连续不稳定信号看。'
      }
    case 'chat_cold':
      return {
        do: `如果“${eventTitle}”主要是聊天冷掉或敷衍，这次不要继续用更多消息把气氛拉回来。先停在一个自然句号上，别追着补话题。`,
        say: '可以收一句：“好，先这样。”或者“你忙你的，回头再说。”不给自己加更多暴露感。',
        tone: '情绪压低一点，表情和话都收一点。重点是稳住自己，不表现出急着求回应。',
        observe: '重点看后面是不是只有你主动时他才回，还是他会自己回来补一句、补解释、补互动。'
      }
    case 'commitment':
      return {
        do: `把“${eventTitle}”里的时间、地点、承诺或安排单独拎出来验证，不要只听态度。`,
        say: '可以说：“这个安排现在能确定吗？”或者“你前面说的那件事，准备怎么落实？”',
        tone: '像确认事实一样问，不要像质问。你要看的是兑现能力，不是逼对方马上表态。',
        observe: '重点看他说法是否前后一致、有没有明确时间点、是否主动推进落实。说得好听但迟迟不落地，要继续记录。'
      }
    case 'clarify':
      return {
        do: `围绕“${eventTitle}”只问一个最关键的问题，先把事实问清楚。`,
        say: '可以说：“我想确认一下，你刚刚说的意思是……吗？”或者“这件事你现在是怎么想的？”',
        tone: '少评价，多确认；先听对方怎么解释，不急着马上反驳或下判断。',
        observe: '重点看他是否愿意把话说清楚、解释后有没有对应行动。如果解释很顺但行动没有变化，仍然要按行动记录。'
      }
    case 'risk_after_pullback':
    case 'risk':
      return {
        do: `如果“${eventTitle}”已经让你感觉不稳，先降低主动推进，不要继续用更高投入换回应。把注意力先放回自己，减少主动试探。`,
        say: '可以简短说：“我知道了，那你先处理你的事。”或者“好，那就先这样。”先把空间留出来。',
        tone: '保持冷静、少补偿、少追问。你的目标是观察对方会不会主动修复，而不是马上把关系拉回来。',
        observe: '重点看他是否主动补解释、补行动，还是只有在你追问时才回应。反复失约、改口、回避或拒绝要单独记录。'
      }
    case 'chat':
      return {
        do: `如果“${eventTitle}”主要发生在聊天里，先围绕一个具体点回应，不要把话题扩大成关系审判。`,
        say: '可以说：“我想确认一下，你刚刚这句话是指已经确定了，还是只是先这样想？”',
        tone: '语气尽量短、清楚，把情绪放低；不要连续追问，也不要用很长一段话证明自己在意。',
        observe: '重点看他是否正面回答、回复是否具体、后续是否主动补充。如果他只用“再说吧”“看情况”带过，就把它记录成含糊信号。'
      }
    case 'meet':
      return {
        do: `如果“${eventTitle}”涉及见面或邀约，而且没有出现拒绝、取消或拖延，可以正常赴约，但不要一上来就急着定关系。穿着保持干净舒服，不用刻意讨好；聊天多围绕当下安排、近况和具体计划。`,
        say: '可以轻松问：“这次你想怎么安排？”或者“你后面那天大概几点方便？”让对方把想法说具体。',
        tone: '保持松弛和有边界感：热情可以有，但别因为一次邀约就主动把节奏推太满。',
        observe: '重点看他是否提前确认时间地点、见面中是否自然投入、见面后是否有后续联系。如果他主动补充下一次安排，比单纯说好听话更有参考价值。'
      }
    default:
      return {
        do: `围绕“${eventTitle}”继续看后续动作，不要只凭这一次就做最终判断。`,
        say: '可以保持自然互动，必要时只问一个具体问题，不要一次问太多。',
        tone: '节奏放稳，既不要过度热情，也不要突然冷处理。',
        observe: '重点看后续是否主动、是否兑现、回应是否具体，以及这次信号能不能连续出现。'
      }
  }
}

function buildRecentPatternNote(caseFile) {
  const manualRecords = sortTimelineRecordsDesc(caseFile?.timeline || [])
    .filter((item) => !isSystemTimelineRecord(item))
    .slice(0, 3)

  if (manualRecords.length < 2) return null

  const negativeCount = manualRecords.filter((item) => {
    const text = normalizeMeaningText([item?.title, item?.description])
    return item?.type === 'risk' || hasAnyMeaning(text, ['拒绝', '被拒', '取消', '推迟', '失约', '没回', '冷淡', '敷衍', '回避', '再看', '看情况'])
  }).length

  if (negativeCount >= 2) {
    return {
      do: '最近两三次事件已经连续偏被动或偏负向，这次不要再追加新邀约或长解释。',
      tone: '表情和语气都收一点，礼貌、稳定就够，不要急着救场。',
      observe: '如果后面没有对方主动补邀约、补解释或补行动，就按连续负向信号看。'
    }
  }

  return null
}

function analyzeRecentManualSignals(caseFile) {
  const manualRecords = sortTimelineRecordsDesc(caseFile?.timeline || [])
    .filter((item) => !isSystemTimelineRecord(item))
    .slice(0, 3)

  const counts = {
    rejectionCount: 0,
    delayedCount: 0,
    coldCount: 0,
    negativeCount: 0
  }

  manualRecords.forEach((item) => {
    const text = normalizeMeaningText([item?.title, item?.description])
    const rejected = hasAnyMeaning(text, ['拒绝', '被拒', '婉拒', '没答应', '不去', '不想', '算了', '推掉'])
    const delayed = hasAnyMeaning(text, ['再看', '看情况', '改天', '下次吧', '以后再说', '不确定', '到时候再说', '先这样', '取消', '推迟', '改期', '放鸽子', '失约', '没来', '拖延', '改口'])
    const cold = item?.type === 'risk' || hasAnyMeaning(text, ['没回', '已读不回', '冷淡', '敷衍', '消失', '回避'])
    if (rejected) counts.rejectionCount += 1
    if (delayed) counts.delayedCount += 1
    if (cold) counts.coldCount += 1
    if (rejected || delayed || cold) counts.negativeCount += 1
  })

  return counts
}

function isUserFacingTimelineRecord(item) {
  return Boolean(
    item
    && !isSystemTimelineRecord(item)
    && (item.type === 'positive' || item.type === 'risk' || item.type === 'verification' || item.type === 'note')
  )
}

function isWithinRecentDays(timestamp, now, days) {
  if (!timestamp) return false
  return timestamp >= now.getTime() - days * 24 * 60 * 60 * 1000
}

function formatRelativeTime(timestamp, now = new Date()) {
  if (!timestamp) return '暂无'
  const diff = Math.max(0, now.getTime() - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`
  if (diff < day * 30) return `${Math.max(1, Math.floor(diff / day))} 天前`
  return `${Math.max(1, Math.floor(diff / (day * 30)))} 个月前`
}

function isNegativeManualSignal(item) {
  const text = normalizeMeaningText([item?.title, item?.description])
  const rejected = hasAnyMeaning(text, ['拒绝', '被拒', '婉拒', '没答应', '不去', '不想', '算了', '推掉'])
  const delayed = hasAnyMeaning(text, ['再看', '看情况', '改天', '下次吧', '以后再说', '不确定', '到时候再说', '先这样', '取消', '推迟', '改期', '放鸽子', '失约', '没来', '拖延', '改口'])
  const cold = item?.type === 'risk' || hasAnyMeaning(text, ['没回', '已读不回', '冷淡', '敷衍', '消失', '回避'])
  return rejected || delayed || cold
}

function hasTargetInitiative(item) {
  if (!item || item.subjectRole === 'self') return false
  const text = normalizeMeaningText([item?.title, item?.description])
  if (item.subjectRole === 'target' && item.type === 'positive' && hasAnyMeaning(text, ['主动', '约我', '找我', '联系我', '发我', '问我', '确认', '安排', '邀请', '解释', '补'])) {
    return true
  }
  return hasAnyMeaning(text, ['主动约我', '主动找我', '主动联系我', '他约我', '她约我', '他找我', '她找我', '他主动', '她主动', '对方主动', '邀请我', '给我发', '来找我', '主动确认'])
}

function isTargetSideRecord(item) {
  return Boolean(item && item.subjectRole !== 'self')
}

function summarizeRecordTitle(item) {
  if (!item) return '还没有事件记录'
  return item.title || item.description || '最近一次互动'
}

const commitmentTopicLibrary = [
  { key: 'movie', keywords: ['看电影', '电影', '影院'] },
  { key: 'meal', keywords: ['吃饭', '晚饭', '午饭', '早餐', '夜宵', '火锅', '烧烤'] },
  { key: 'coffee', keywords: ['咖啡', '喝咖啡'] },
  { key: 'walk', keywords: ['散步', '遛弯', '走走'] },
  { key: 'meet', keywords: ['见面', '碰面', '线下见', '出来见', '约会', '赴约'] },
  { key: 'trip', keywords: ['旅行', '旅游', '出游', '郊游'] },
  { key: 'game', keywords: ['打掼蛋', '掼蛋', '打牌', '桌游'] },
  { key: 'gift_bag', keywords: ['买包', '包包', '包'] },
  { key: 'gift_flower', keywords: ['花', '鲜花'] },
  { key: 'gift_general', keywords: ['礼物', '送我', '送你', '送东西'] },
  { key: 'pickup', keywords: ['接我', '来接', '送我回', '送我'] },
  { key: 'contact', keywords: ['联系我', '找我', '回我', '回复我', '给我发消息', '给我打电话'] }
]

function extractCommitmentTopics(item) {
  const text = normalizeMeaningText([item?.title, item?.description])
  const topics = new Set()

  commitmentTopicLibrary.forEach((entry) => {
    if (hasAnyMeaning(text, entry.keywords)) topics.add(entry.key)
  })

  if (topics.has('gift_bag')) topics.delete('gift_general')
  if (topics.has('movie') || topics.has('meal') || topics.has('coffee') || topics.has('walk') || topics.has('trip') || topics.has('game')) {
    topics.add('meet')
  }

  return [...topics]
}

function extractCommitmentRole(item) {
  const topics = extractCommitmentTopics(item)
  if (topics.some((topic) => topic.startsWith('gift_'))) return 'gift'
  if (topics.includes('contact')) return 'contact'
  if (topics.includes('meet')) return 'meet'
  const text = normalizeMeaningText([item?.title, item?.description])
  if (hasAnyMeaning(text, ['时间', '地点', '周末', '今晚', '明天', '周六', '周日', '赴约', '见面', '碰面', '出来'])) return 'meet'
  if (hasAnyMeaning(text, ['买', '送', '礼物', '包', '花', '收到', '拿到'])) return 'gift'
  if (hasAnyMeaning(text, ['联系我', '找我', '回我', '回复我', '回电', '消息', '电话'])) return 'contact'
  return 'generic'
}

function hasCommitmentStarter(text) {
  return hasAnyMeaning(text, [
    '答应', '说好', '确定', '确认', '约好', '安排好', '定了', '订了',
    '会来', '会去', '会找我', '会联系', '下次一定', '改天补上', '到时候见', '之后见',
    '给我买', '送我', '帮我买'
  ])
}

function isCommitmentRecord(item) {
  if (!isTargetSideRecord(item)) return false
  const text = normalizeMeaningText([item?.title, item?.description])
  const topics = extractCommitmentTopics(item)
  return hasCommitmentStarter(text) && (topics.length > 0 || extractCommitmentRole(item) !== 'generic' || hasAnyMeaning(text, ['时间', '地点', '安排', '计划']))
}

function isCommitmentDeliveredRecord(item) {
  if (!isTargetSideRecord(item)) return false
  const text = normalizeMeaningText([item?.title, item?.description])
  const role = extractCommitmentRole(item)
  const topics = extractCommitmentTopics(item)
  return hasAnyMeaning(text, [
    '兑现', '落实', '说到做到', '安排好了', '定好了', '订好了', '准时', '按时',
    '来了', '到了', '赴约', '见到了', '补上了', '真的来了', '确认好了'
  ]) || (
    topics.length > 0
    && hasAnyMeaning(text, ['收到', '拿到', '一起去了', '一起看了', '一起吃了', '已经买了', '已经送了'])
  ) || (
    role === 'meet'
    && hasAnyMeaning(text, ['赴约', '见到了', '碰面了', '出来了', '一起去了', '一起看了', '一起吃了', '到场了'])
  ) || (
    role === 'gift'
    && hasAnyMeaning(text, ['收到', '拿到', '已经买了', '已经送了', '送到了'])
  ) || (
    role === 'contact'
    && hasAnyMeaning(text, ['联系我了', '找我了', '回我了', '回复我了', '给我发消息了', '给我打电话了'])
  )
}

function isCommitmentBrokenRecord(item) {
  if (!isTargetSideRecord(item)) return false
  const text = normalizeMeaningText([item?.title, item?.description])
  const role = extractCommitmentRole(item)
  return hasAnyMeaning(text, [
    '取消', '推迟', '改期', '放鸽子', '失约', '没来', '拖延', '改口', '再看', '看情况', '下次吧', '以后再说'
  ]) || (
    role === 'meet'
    && hasAnyMeaning(text, ['来不了', '不去了', '临时取消', '临时改期'])
  ) || (
    role === 'gift'
    && hasAnyMeaning(text, ['没买', '没送', '不给了'])
  ) || (
    role === 'contact'
    && hasAnyMeaning(text, ['没回', '不回', '不联系', '没消息'])
  )
}

function isSameCommitmentTopic(pending, item) {
  const currentTopics = extractCommitmentTopics(item)

  if (pending.topics.length > 0 && currentTopics.length > 0) {
    return pending.topics.some((topic) => currentTopics.includes(topic))
  }

  if (pending.role !== 'generic') {
    return pending.role === extractCommitmentRole(item)
  }

  return currentTopics.length === 0
}

function summarizeCommitmentDeliveryStats(records) {
  const chronological = [...records].sort((a, b) => {
    const left = getTimelineRecordTimestamp(a) || 0
    const right = getTimelineRecordTimestamp(b) || 0
    return left - right
  })

  let commitmentCount = 0
  let deliveredCount = 0
  const pendingCommitments = []

  chronological.forEach((item) => {
    if (isCommitmentRecord(item)) {
      commitmentCount += 1
      pendingCommitments.push({
        topics: extractCommitmentTopics(item),
        role: extractCommitmentRole(item)
      })
      return
    }

    if (pendingCommitments.length <= 0) return

    if (isCommitmentDeliveredRecord(item)) {
      const matchedIndex = pendingCommitments.findIndex((pending) => isSameCommitmentTopic(pending, item))
      if (matchedIndex >= 0) {
        deliveredCount += 1
        pendingCommitments.splice(matchedIndex, 1)
      }
      return
    }

    if (isCommitmentBrokenRecord(item)) {
      const matchedIndex = pendingCommitments.findIndex((pending) => isSameCommitmentTopic(pending, item))
      if (matchedIndex >= 0) {
        pendingCommitments.splice(matchedIndex, 1)
      }
    }
  })

  return { commitmentCount, deliveredCount }
}

function isActualMeetRecord(item) {
  if (!isTargetSideRecord(item)) return false

  const text = normalizeMeaningText([item?.title, item?.description])
  const topics = extractCommitmentTopics(item)
  const meetRelated = topics.includes('meet') || topics.includes('pickup')

  if (!meetRelated) return false

  if (hasAnyMeaning(text, [
    '见到了', '碰面了', '赴约', '出来了', '线下见了', '约会了',
    '一起去了', '一起看了', '一起吃了', '一起喝了咖啡', '一起散步了',
    '看了电影', '吃了饭', '喝了咖啡', '散了步', '到场了', '来接我了'
  ])) {
    return true
  }

  if (item?.type !== 'positive') return false
  if (hasAnyMeaning(text, ['答应', '约好', '安排', '计划', '打算', '准备', '下次', '周末再', '改天'])) return false

  return hasAnyMeaning(text, [
    '见面', '碰面', '线下见', '出来见', '约会',
    '看电影', '吃饭', '喝咖啡', '散步', '旅行', '出游', '郊游', '打掼蛋', '桌游', '接我'
  ])
}

export function buildCaseOverviewStats(caseFile, now = new Date()) {
  const manualTimeline = sortTimelineRecordsDesc((caseFile?.timeline || []).filter((item) => isUserFacingTimelineRecord(item)))
  const latestRecord = manualTimeline[0] || null
  const recent7Days = manualTimeline.filter((item) => isWithinRecentDays(getTimelineRecordTimestamp(item), now, 7))
  const recent14Days = manualTimeline.filter((item) => isWithinRecentDays(getTimelineRecordTimestamp(item), now, 14))
  const recent10Records = manualTimeline.slice(0, 10)

  let blockedStreak = 0
  for (const item of manualTimeline) {
    if (!isNegativeManualSignal(item)) break
    blockedStreak += 1
  }

  const targetInitiatedCount = recent14Days.filter((item) => hasTargetInitiative(item)).length
  const recentMeetCount = recent14Days.filter((item) => isActualMeetRecord(item)).length
  const { commitmentCount, deliveredCount } = summarizeCommitmentDeliveryStats(recent10Records)
  const trendAssessments = [...(caseFile?.assessments || [])]
    .sort((a, b) => {
      const left = new Date(a?.createdAt || 0).getTime() || 0
      const right = new Date(b?.createdAt || 0).getTime() || 0
      return left - right
    })
    .slice(-4)

  return {
    items: [
      {
        key: 'last-contact',
        label: '最近互动',
        value: latestRecord ? formatRelativeTime(getTimelineRecordTimestamp(latestRecord), now) : '暂无',
        hint: summarizeRecordTitle(latestRecord)
      },
      {
        key: 'week-records',
        label: '本周记录',
        value: `${recent7Days.length} 条`,
        hint: recent7Days.length > 0 ? '最近 7 天新增的真实事件数' : '最近 7 天还没有新记录'
      },
      {
        key: 'target-initiative',
        label: '对方主动',
        value: `${targetInitiatedCount} 次`,
        hint: '近 14 天里由对方发起或推进的次数'
      },
      {
        key: 'recent-meetings',
        label: '近14天见面',
        value: `${recentMeetCount} 次`,
        hint: recentMeetCount > 0 ? '只统计已实际发生的线下见面，不把计划中的约见算进去' : '近 14 天还没有记录到实际发生的线下见面'
      },
      {
        key: 'blocked-streak',
        label: '连续受阻',
        value: `${blockedStreak} 次`,
        hint: blockedStreak > 0 ? '从最近一次开始连续出现拒绝、拖延或冷淡' : '最近没有连续受阻信号',
        tone: blockedStreak >= 2 ? 'risk' : 'neutral'
      },
      {
        key: 'commitment-delivery',
        label: '承诺兑现',
        value: commitmentCount > 0 ? `${Math.min(deliveredCount, commitmentCount)}/${commitmentCount}` : '--',
        hint: commitmentCount > 0
          ? '口径：先识别对方答应过的具体事项，再只和后续同事项的落地或失约配对。约看电影不会和收到包串在一起。'
          : '近10条里还没有识别到对方明确答应、确认或安排过的具体承诺事项'
      }
    ],
    trendAssessments
  }
}

export function buildReadableActionAdvice(caseFile, current, event, primaryFocus) {
  const eventTitle = event?.title || current?.triggerEventTitle || '这次互动'
  const semanticAdvice = buildSemanticActionAdvice(event, current, eventTitle)
  const sceneAdvice = semanticAdvice || buildSceneAdvice(inferActionScene(event, current), eventTitle)
  const focusPrompt = primaryFocus?.nextRecordPrompt || '本次重点记录：看他后续是否主动、是否兑现、是否持续稳定。'
  const focusAction = primaryFocus?.action || '继续把后续真实发生的互动记录下来。'
  const intentScore = Number(current?.intentScore || 0)
  const riskScore = Number(current?.consistencyRiskScore || 0)
  const recentPattern = buildRecentPatternNote(caseFile)

  const withRecentDo = recentPattern ? `${sceneAdvice.do} ${recentPattern.do}` : sceneAdvice.do
  const withRecentTone = recentPattern ? `${sceneAdvice.tone} ${recentPattern.tone}` : sceneAdvice.tone
  const withRecentObserve = recentPattern ? `${sceneAdvice.observe} ${recentPattern.observe}` : sceneAdvice.observe
  const role = event?.subjectRole || current?.triggerSubjectRole || 'target'
  const roleAdvice = buildSubjectRoleActionAdvice(role, eventTitle)
  const rolePrefix = role === 'self'
    ? '这条更像你的感受记录，先把自己的情绪和事实分开；'
    : role === 'both'
      ? '先拆清楚谁发起、谁回应、有没有兑现；'
      : ''
  const titleMap = {
    clarify: '先问清一个具体点，再决定下一步',
    verify: '先验证关键事实，再继续投入',
    pause: '先降速，把主动权放回真实行动',
    insufficient_data: '样本还少，先补一条可验证互动',
    observe: intentScore >= 60 && riskScore < 45 ? '顺着正向信号轻推进' : '稳住节奏，看连续表现'
  }
  const actionTailMap = {
    clarify: '下一步只确认一个关键点，别把问题扩大成关系审判。',
    verify: '把重点放在时间、地点、安排、兑现这些可核实信息上。',
    pause: riskScore >= 60 ? '先减少主动推进，把空间留出来看对方是否会补动作。' : '节奏放慢一点，先看对方后续会不会自然补充。',
    insufficient_data: '先补充一条真实互动记录，再判断关系方向。',
    observe: focusAction
  }
  const action = `${rolePrefix}${withRecentDo} ${actionTailMap[current?.nextAction] || actionTailMap.observe}`
  const say = roleAdvice.say || sceneAdvice.say
  const context = `${roleAdvice.tone} ${withRecentTone}`
  const contextLabel = sceneAdvice.contextLabel || '情绪和场合细节'
  const observeAndRecord = `${roleAdvice.observe} ${withRecentObserve} ${focusPrompt}`

  switch (current?.nextAction) {
    case 'clarify':
    case 'verify':
    case 'pause':
    case 'insufficient_data':
    case 'observe':
    default:
      return {
        title: titleMap[current?.nextAction] || titleMap.observe,
        action,
        say,
        contextLabel,
        context,
        observeAndRecord,
        dont: '',
        do: action,
        tone: context,
        observe: observeAndRecord
      }
  }
}

function buildSemanticActionAdvice(event, current, eventTitle) {
  const semantic = event?.semanticTags || current?.semanticTags || event?.eventUnderstanding?.semanticTags || null
  const fallbackTags = event ? getTimelineRecordTags(event) : null
  const role = event?.subjectRole || current?.triggerSubjectRole || 'target'
  const scene = new Set([...(semantic?.scene || []), ...(fallbackTags?.scene || [])])
  const outcome = new Set([...(semantic?.outcome || []), ...(fallbackTags?.outcome || [])])
  const risk = new Set([...(semantic?.risk || []), ...(fallbackTags?.risk || [])])
  const response = semantic?.response || (risk.has('rejected') ? 'rejected' : outcome.has('pending') ? 'pending' : outcome.has('fulfilled') ? 'accepted' : '')
  const commitment = semantic?.commitment || {}
  const fulfilled = outcome.has('fulfilled') || commitment.fulfilled
  const planned = outcome.has('planned') || commitment.exists
  const pending = outcome.has('pending') || response === 'pending'
  const rejected = risk.has('rejected') || response === 'rejected'
  const cancelled = outcome.has('cancelled_delayed') || risk.has('vague_delay')
  const cold = risk.has('cold')
  const hasMeal = scene.has('meal')
  const hasMovie = scene.has('movie')
  const hasCoffee = scene.has('coffee_tea')
  const hasMeet = scene.has('offline_meet') || scene.has('walk_shop') || scene.has('group_social') || hasMeal || hasMovie || hasCoffee
  const hasChat = scene.has('chat')
  const selfFeelingAfterEvent = role === 'self' && fulfilled

  if (selfFeelingAfterEvent) {
    return {
      do: `“${eventTitle}”更像你对这次互动的感受记录。下一步不要把自己的开心或不安直接当成对方态度，先用一个轻松动作承接：正常聊天一次，看看对方会不会自然延续。`,
      say: '可以说：“今天这个安排我感觉还挺舒服的。” 或“刚才聊到的那个话题挺有意思，下次可以继续说。” 重点是分享体验，不急着要对方表态。',
      contextLabel: '情绪处理',
      tone: '先把情绪落回事实：你感到开心、紧张或在意，都可以记录，但暂时不需要因此准备礼物、换穿搭或加大投入。保持自然回应，让下一次互动来验证对方态度。',
      observe: '观察与记录重点：记录对方后续有没有主动找你、有没有延续你提到的话题、有没有把下一次互动说具体；同时记录你的感受是否来自事实变化，还是来自期待上升。'
    }
  }

  if (hasMeal && fulfilled) {
    return {
      do: `“${eventTitle}”已经是线下吃饭并且真实发生了，下一步适合轻轻承接这次愉快体验，不要立刻把话题推成表白或关系确认。可以隔几个小时或当天晚些时候自然跟进一次，再顺手埋一个低压力的下次机会。`,
      say: '线上可以说：“今天吃得挺开心，那家店比我想的舒服。下次你说的那家咖啡/电影也可以试试。” 线下收尾可以说：“今天挺开心的，回去路上注意安全，到了说一声。”',
      contextLabel: '后续推进节奏',
      tone: '这是见面后承接，不是见面前准备。重点放在轻松复盘和下一次话题，不需要再补穿着、小礼物这类建议；聊天节奏自然一点，别因为一次开心就突然升温太猛。',
      observe: '观察与记录重点：饭后对方是否主动延续聊天、是否提到下次、是否记得你说过的小细节、是否愿意把下一次安排说得更具体。'
    }
  }

  if (hasMeet && fulfilled) {
    return {
      do: `“${eventTitle}”已经兑现，先把这次线下体验当成正向样本。下一步可以轻推进一次具体但轻量的后续安排，别连续加码多个邀约。`,
      say: '可以说：“今天见面感觉挺自然的，下次有个轻松点的安排也可以一起。” 如果对方主动提到某个兴趣，就顺着说：“那下次可以按你刚说的那个来。”',
      contextLabel: '后续推进节奏',
      tone: '这是见面后的推进阶段，重点不是再准备穿着或礼物，而是保持稳定、轻松、可继续的联系。回应及时即可，不用突然变得很黏。',
      observe: '观察与记录重点：对方见面后的主动性、回复速度是否稳定、是否愿意给出下次时间，以及线下热度能不能延续到线上。'
    }
  }

  if ((hasMeet || planned) && (rejected || cancelled)) {
    return {
      do: `“${eventTitle}”里出现了拒绝、取消或拖延，下一步不要马上补一个新邀约。先把球放回对方，看对方会不会主动补时间、补解释或补安排。`,
      say: '可以短一点说：“好，那你确定方便的时候再跟我说。” 或“没事，那这次先这样。” 说完就停，不连续解释也不追问。',
      contextLabel: '被拒或改期后的状态',
      tone: '语气平稳、表情正常，别显得生气，也别用更热情去补偿。当天穿着和状态回到自己的正常节奏，不为挽回场面额外表现。',
      observe: '观察与记录重点：对方后面是否主动补新时间、是否给出清楚原因、是否只用“再看”“以后”带过。'
    }
  }

  if (hasChat && cold) {
    return {
      do: `“${eventTitle}”主要是聊天冷淡或断联，下一步先停止连续补消息。保留一个自然收口，观察对方会不会自己回来接话。`,
      say: '线上可以说：“好，你先忙。” 或“那回头再说。” 之后不要再追加解释型长消息。线下见到时正常打招呼，不把线上冷淡拿出来当场审问。',
      contextLabel: '聊天节奏',
      tone: '情绪压低一点，语气短、清楚、体面。不要用阴阳怪气、连续表情包或长篇说明来要回应。',
      observe: '观察与记录重点：对方是否主动回来补一句、是否解释消失原因、是否只有你发起时才回应。'
    }
  }

  if (pending || planned) {
    return {
      do: `“${eventTitle}”里有计划或待确认信息，下一步要把模糊意向落到一个具体点：时间、地点、由谁安排，三选一先确认一个。`,
      say: '可以说：“那我们先定个大概时间吧，你周五晚还是周末更方便？” 或“你确定以后告诉我，我这边就按没定先安排自己的事。”',
      contextLabel: hasMeet ? '见面前准备' : '确认节奏',
      tone: hasMeet
        ? '如果接下来确实要见面，穿着按场合干净舒服即可：吃饭偏轻松、电影偏舒适、咖啡偏自然。小礼物只有在对方明确提过喜好、且价值很轻时才适合；否则不要用礼物制造压力。'
        : '语气像确认日程，不像逼问态度。线上文字短一点；线下可以带笑说，别让气氛变成压力测试。',
      observe: '观察与记录重点：对方是否愿意给具体选项、是否主动推进安排、是否反复停在“再看”“有空再说”。'
    }
  }

  if (hasChat) {
    return {
      do: `“${eventTitle}”主要发生在线上，下一步围绕一个具体信息回应，不要把一次聊天直接扩大成关系判断。`,
      say: '可以说：“我理解你的意思是……对吗？” 或“那这件事你更倾向怎么安排？” 如果气氛轻松，可以接一句和当下话题有关的具体回应。',
      contextLabel: '聊天节奏',
      tone: '文字少一点、清楚一点，别连续追问。表情包和语气词可以少量用来降压，但不要代替关键问题。',
      observe: '观察与记录重点：对方是否正面回答、是否给具体信息、是否主动延续话题，还是只用模糊话带过。'
    }
  }

  return null
}

function buildSubjectRoleActionAdvice(role, eventTitle) {
  if (role === 'self') {
    return {
      dont: '这条主要是你的心理感受，不要把它直接当成对方已经有明确态度。',
      do: '先把自己的情绪、期待和触发点分开写清楚；下一条最好补一个对方真实动作。',
      say: '如果要表达，可以短一点说：“我刚才有点在意这件事，想先确认一下你的想法。”',
      tone: '语气先稳住，少解释、少试探，不用急着证明自己为什么会这样想。',
      observe: `这次“${eventTitle}”更适合作为自我状态记录；下一次重点看对方有没有清楚动作、明确回应或主动补充。`
    }
  }
  if (role === 'both') {
    return {
      dont: '不要把“我主动做了什么”和“对方真实回应了什么”混在一起下结论。',
      do: '把这次互动拆成三件事：谁先发起、谁同意或拒绝、后面有没有兑现。',
      say: '',
      tone: '表达可以自然，但记录时要冷静拆主体，避免因为互动氛围好就自动推高判断。',
      observe: `围绕“${eventTitle}”，重点看对方那一侧的动作：是否主动、是否明确、是否有后续。`
    }
  }
  return {
    dont: '不要替对方补动机，也不要只看一句话的情绪浓度。',
    do: '重点看对方有没有主动、明确、兑现和持续，而不是只看当下氛围。',
    say: '',
    tone: '保持自然、有边界，不因为一次对方动作就立刻把节奏推满。',
    observe: `围绕“${eventTitle}”，下一步继续看对方是否会主动补动作或把说法落到具体安排。`
  }
}

// ============================================================================
// Risk labels (from risk-labels.ts)
// ============================================================================

export function getRiskLabels(riskBucket) {
  return riskLabelMap[riskBucket] || null
}

// ============================================================================
// Entertainment insights (from profile-insights.ts)
// ============================================================================

const zodiacNotes = {
  鼠: '更适合看连续性，不要只看一次热情。',
  牛: '节奏通常偏稳，关键看承诺后的执行。',
  虎: '热启动可能很快，后续更要看稳定度。',
  兔: '相处体验常常细腻，边界和回应方式很重要。',
  龙: '表达可能偏强势，关键看是否愿意落实细节。',
  蛇: '观察期往往比表面更长，别急着补脑结论。',
  马: '行动感可能较强，但也要看能否持续。',
  羊: '氛围感可能不错，核心还是看明确回应。',
  猴: '互动可能灵活机动，更要看信息是否一致。',
  鸡: '细节感和标准感可能更明显，留意磨合方式。',
  狗: '安全感建立后更稳定，前期主要看可靠性。',
  猪: '相处体感可能轻松，仍要看关键节点是否认真。'
}

const constellationNotes = {
  白羊座: '推进感如果很强，通常会更直接地表现出来。',
  金牛座: '慢一点不一定是冷淡，关键看是否持续投入。',
  双子座: '表达变化可能快，判断时更要看前后是否一致。',
  巨蟹座: '情绪照顾感可能比较重要，安全感建立后更稳。',
  狮子座: '表达存在感可能较强，但真正关键是兑现度。',
  处女座: '细节反馈可能比较多，越具体越容易判断真假。',
  天秤座: '氛围和关系平衡感很重要，含糊时要看是否愿意明确。',
  天蝎座: '如果真的投入，通常会在关键节点给出更明确信号。',
  射手座: '轻松热烈不等于长期投入，仍要看稳定性。',
  摩羯座: '节奏可能偏务实，承诺和执行的一致性尤其重要。',
  水瓶座: '表达方式可能不按常规，最好用事实而不是感觉判断。',
  双鱼座: '氛围感可能很足，越需要回到具体行动和承诺。'
}

function inferEventScenario(event) {
  const content = `${event.title} ${event.description}`.toLowerCase()
  const hasFriendContext = includesAny(content, ['朋友', '同事', '同学', '闺蜜', '兄弟', '社交圈'])
  const hasOutingContext = includesAny(content, ['郊游', '露营', '出游', '野餐', '爬山', '聚会', '旅行', '一起玩'])

  if (hasFriendContext && hasOutingContext) return 'social_outing_with_friends'
  if (hasFriendContext) return 'social_circle_exposure'
  if (includesAny(content, ['约', '见面', '吃饭', '看电影', '咖啡', '散步', '接你', '送你'])) return 'direct_invitation'
  if (includesAny(content, ['兑现', '落实', '说到做到', '安排好了', '订好了', '准时'])) return 'delivery'
  if (includesAny(content, ['解释', '坦白', '交代', '说明', '沟通'])) return 'clarification'
  if (includesAny(content, ['失联', '消失', '没回', '冷淡', '回避', '拖延', '推迟', '取消', '敷衍'])) return 'retreat_or_delay'
  if (event.type === 'verification') return 'verification'
  if (event.type === 'positive') return 'positive_signal'
  if (event.type === 'risk') return 'risk_signal'
  return 'daily_interaction'
}

function classifyOccupation(occupation) {
  if (!occupation) return 'general'
  const text = occupation.toLowerCase()
  if (includesAny(text, ['销售', 'bd', '商务', '顾问', '中介'])) return 'sales'
  if (includesAny(text, ['it', '程序', '开发', '工程师', '技术', '产品', '运营', '测试'])) return 'tech'
  if (includesAny(text, ['教师', '老师', '医生', '护士', '律师', '财务', '公务员'])) return 'structured'
  if (includesAny(text, ['自由职业', '创业', '个体', '自媒体'])) return 'flexible'
  return 'general'
}

function buildZodiacMeaning(zodiac, event) {
  if (!zodiac || !event) return ''
  const scenario = inferEventScenario(event)

  if (zodiac === '兔' && scenario === 'social_outing_with_friends') {
    return '属兔的人愿意带你去朋友局或郊游，往往像是想靠近，但不想一下子压得太近。这不太像完全没意思，更像先用温和场景试探你能不能融进他的生活边缘。'
  }
  if (zodiac === '兔' && scenario === 'retreat_or_delay') {
    return '属兔这类表现常像是心里不是没感觉，但动作先往后缩。细腻和在意可能有，但主动未必同步。'
  }

  if (scenario === 'social_outing_with_friends') {
    return `属${zodiac}的人如果把你带进朋友和出游场景，通常像是愿意让你先接触他的生活外圈。这比纯聊天更进一步，但还没到彻底摊牌。`
  }
  if (scenario === 'social_circle_exposure') {
    return `属${zodiac}的人愿意把你带到社交圈里，通常算一种轻度放行，至少不是完全把你隔绝在私人边界外。`
  }
  if (scenario === 'direct_invitation') {
    return `属${zodiac}的人这次有直接动作，更像是感受开始往行为里落地，不只是停留在嘴上。`
  }
  if (scenario === 'retreat_or_delay') {
    return `属${zodiac}的人这次更像是情绪和行动没有对齐。他未必没感觉，但眼下更想先退半步。`
  }
  return `属${zodiac}这次的表现更适合当作一个小气质线索看，能增加趣味，但还得回到连续行为。`
}

function buildConstellationMeaning(constellation, event) {
  if (!constellation || !event) return ''
  const scenario = inferEventScenario(event)

  if (constellation === '处女座' && scenario === 'social_outing_with_friends') {
    return '处女座如果这样安排，通常像是先把你放进自己可控的生活场景里观察兼容度。比起直接上头，更像认真看你能不能融入他的节奏和圈层。'
  }
  if (constellation === '处女座' && scenario === 'retreat_or_delay') {
    return '处女座往后撤时，常像是在先整理判断，再决定要不要继续推进。看起来冷一点，不一定等于彻底没兴趣。'
  }

  if (scenario === 'social_outing_with_friends') {
    return `${constellation}这次愿意把你带进朋友或出游场景，更像是生活场域，比单独暧昧多了一层现实感。`
  }
  if (scenario === 'direct_invitation') {
    return `${constellation}这次既然给了动作，说明态度比之前更愿意明牌一点，至少不是纯氛围流。`
  }
  if (scenario === 'retreat_or_delay') {
    return `${constellation}这次的退缩感，重点更该放在节奏变化上。不是看他说了什么，而是看他有没有后续补动作。`
  }
  return `${constellation}更像一种观察角度，重点是帮助理解这类人会怎么表现，不代替事实。`
}

function buildOccupationMeaning(occupation, event) {
  if (!occupation || !event) return ''
  const scenario = inferEventScenario(event)
  const family = classifyOccupation(occupation)

  if (family === 'tech' && scenario === 'social_outing_with_friends') {
    return `${occupation}这类偏技术/IT画像的人，如果主动把你带进朋友局或郊游，往往不会只是随手社交，更像是在熟悉场景里试探你能不能被放进他的生活系统。`
  }
  if (family === 'sales' && scenario === 'social_outing_with_friends') {
    return `${occupation}这类偏销售/商务画像的人这么做，像是愿意把场域打开给你，但也要留一点心眼，看这是不是他对很多人都很熟练的标准动作。`
  }
  if (family === 'tech' && scenario === 'retreat_or_delay') {
    return `${occupation}这类画像里，忙和抽离经常混在一起。所以这次的退后不一定全是冷淡，关键看他会不会主动补解释和补安排。`
  }
  if (family === 'sales' && scenario === 'direct_invitation') {
    return `${occupation}这类人通常不缺表达和推进技巧，所以更要看的不是会不会约，而是约完以后会不会持续跟进。`
  }
  if (scenario === 'delivery') {
    return `工作是"${occupation}"，这次如果还能把承诺落地，会比嘴上热情更有含金量。`
  }
  return `工作是"${occupation}"，这次行为更适合放进他的现实节奏里理解。重点不是他忙不忙，而是忙的时候会不会仍然给你交代。`
}

function hasSelfProfile(profile) {
  if (!profile) return false
  return [profile.gender, profile.ageRange, profile.identity, profile.zodiac, profile.constellation].some(isFilled)
}

function getSelfGenderLabel(value) {
  switch (value) {
    case 'male': return '男生'
    case 'female': return '女生'
    case 'private': return '暂不说性别'
    default: return value || ''
  }
}

function getAgeRangeLabel(value) {
  switch (value) {
    case 'under18': return '18 岁以下'
    case '18_22': return '18-22 岁'
    case '23_26': return '23-26 岁'
    case '27_plus': return '27 岁以上'
    default: return value || ''
  }
}

function getIdentityLabel(value) {
  switch (value) {
    case 'high_school': return '高中 / 中专'
    case 'college': return '大学生'
    case 'graduate': return '研究生'
    case 'worker': return '已工作'
    case 'other': return '其他身份'
    default: return value || ''
  }
}

function buildSelfProfileFacts(profile) {
  if (!profile) return []
  return [
    getSelfGenderLabel(profile.gender),
    getAgeRangeLabel(profile.ageRange),
    getIdentityLabel(profile.identity),
    profile.zodiac ? `属${profile.zodiac}` : '',
    profile.constellation || ''
  ].filter(Boolean)
}

function buildZodiacPairMeaning(selfZodiac, targetZodiac, event) {
  if (!selfZodiac || !targetZodiac) return ''
  const scenario = event ? inferEventScenario(event) : 'daily_interaction'
  const pair = `${selfZodiac}-${targetZodiac}`
  const reversePair = `${targetZodiac}-${selfZodiac}`
  const eventTail = scenario === 'retreat_or_delay'
    ? '放到这次事件里，重点不是继续加情绪，而是看对方会不会主动补一个明确动作。'
    : scenario === 'direct_invitation'
      ? '放到这次事件里，重点看邀约之后有没有具体时间、地点和兑现。'
      : '放到这次事件里，重点仍然是连续行为，而不是只靠性格想象。'

  if (pair === '牛-羊' || reversePair === '牛-羊') {
    return `按传统属相说法，牛和羊常被看成节奏不太一样：牛更重稳定、兑现和慢慢确认，羊更重氛围、感受和被照顾的体感。${eventTail}`
  }
  if (selfZodiac === targetZodiac) {
    return `按传统属相说法，同属${selfZodiac}容易在熟悉节奏上有共鸣，但也可能把相似的犹豫或固执放大。${eventTail}`
  }
  return `按传统属相看，你属${selfZodiac}、对方属${targetZodiac}，更适合当作一个互动节奏的小切口：谁更重行动，谁更重感受，要回到这次事件里的具体表现。${eventTail}`
}

function buildConstellationPairMeaning(selfConstellation, targetConstellation, event) {
  if (!selfConstellation || !targetConstellation) return ''
  const scenario = event ? inferEventScenario(event) : 'daily_interaction'
  const pair = `${selfConstellation}-${targetConstellation}`
  const reversePair = `${targetConstellation}-${selfConstellation}`
  const eventTail = scenario === 'retreat_or_delay'
    ? '这次如果出现拖延、冷淡或模糊回应，就不要只解读成性格慢热，要看后续有没有补解释、补时间。'
    : scenario === 'direct_invitation'
      ? '这次如果涉及邀约，就看对方有没有把暧昧氛围变成可执行安排。'
      : '这次更适合把星座当观察角度，最后仍然落回行动证据。'

  if (pair === '双鱼座-处女座' || reversePair === '双鱼座-处女座') {
    return `从西方星座的趣味视角看，双鱼更容易被氛围、语气和想象牵动，处女更看细节、确定性和兑现。${eventTail}`
  }
  if (selfConstellation === targetConstellation) {
    return `你和对方同为${selfConstellation}，趣味上容易理解彼此的表达习惯，但也可能互相放大同一种敏感点。${eventTail}`
  }
  return `从星座侧写看，你是${selfConstellation}、对方是${targetConstellation}，可以把它当成沟通风格差异的小提示：一个人怎么表达热度，另一个人怎么确认安全感。${eventTail}`
}

export function buildProfileSideRead(params) {
  const { profile, selfProfile, event, latestResult, trend } = params
  return buildZodiacConstellationSideRead({ profile, selfProfile, event })
  if ((!hasProfile(profile) && !hasSelfProfile(selfProfile)) || !latestResult) return null

  const intentScore = Number(latestResult.intentScore || 0)
  const riskScore = Number(latestResult.consistencyRiskScore || 0)
  const relationType = getRelationTypeLabel(profile?.relationType)
  const eventTitle = event?.title || latestResult.triggerEventTitle || ''
  const eventType = event?.type || latestResult.triggerEventType || 'note'

  const trendText = trend?.hasPrevious
    ? `最近一次变化是意向${trend.intentDelta > 0 ? '+' : ''}${trend.intentDelta}、风险${trend.riskDelta > 0 ? '+' : ''}${trend.riskDelta}。`
    : '当前还缺少足够多的连续评估来判断长期趋势。'

  const eventBase =
    eventTitle
      ? eventType === 'risk'
        ? `这次围绕"${eventTitle}"，更适合先看退缩、拖延或一致性风险是否真实存在。`
        : eventType === 'positive'
          ? `这次围绕"${eventTitle}"，更适合看主动和投入是否会继续落地。`
          : eventType === 'verification'
            ? `这次围绕"${eventTitle}"，重点是事实、承诺和说法能不能对上。`
            : `这次围绕"${eventTitle}"，先把它放进连续行为里看，不单独下结论。`
      : '当前还没有明确触发事件，侧写会更多参考画像和当前分数。'

  const facts = [
    profile?.age ? `${profile.age}岁` : '',
    profile?.gender || '',
    profile?.occupation ? `工作是${profile.occupation}` : '',
    relationType ? `对象类别是${relationType}` : '',
    profile?.zodiac ? `属${profile.zodiac}` : '',
    profile?.constellation || ''
  ].filter(Boolean)

  const sections = []
  const selfFacts = []

  if (false && (selfFacts.length > 0 || facts.length > 0)) {
    sections.push({
      label: '画像对照',
      text: `${selfFacts.length ? `你这边：${selfFacts.join('、')}。` : ''}${facts.length ? `对方这边：${facts.join('、')}。` : ''}这部分只作为侧写入口，不参与意向和风险评分。`
    })
  }

  sections.push({
    label: '综合侧写',
    text: `${facts.length > 0 ? `结合${facts.join('、')}来看，` : ''}${eventBase} 当前意向分是${intentScore}，风险分是${riskScore}。${trendText}${intentScore >= 60 && riskScore < 45
      ? '这类组合更适合看持续兑现，不要只看一时热度。'
      : riskScore >= 60
        ? '这类组合需要优先看稳定性和可验证性，避免被局部积极信号带偏。'
        : '这类组合还处在需要继续积累样本的阶段，重点看后续是否连续。'}${event && profile?.occupation ? ` ${buildOccupationMeaning(profile.occupation, event)}` : ''}`
  })

  if (false && (eventTitle || profile?.occupation)) {
    const occupationMeaning = event ? buildOccupationMeaning(profile?.occupation, event) : occupationNote(profile?.occupation)
    sections.push({
      label: '事件与现实节奏',
      text: occupationMeaning ? `${eventBase} ${occupationMeaning}` : eventBase
    })
  }

  if (false && profile?.zodiac) {
    sections.push({
      label: `属相角度 (${profile.zodiac})`,
      text: event
        ? buildZodiacMeaning(profile.zodiac, event)
        : zodiacNotes[profile.zodiac] || '属相只能作为轻量观察角度，真正要看的仍然是连续行为和事实证据。'
    })
  }

  if (selfProfile?.zodiac && profile?.zodiac) {
    sections.push({
      label: `属相相处 (${selfProfile.zodiac} / ${profile.zodiac})`,
      text: buildZodiacPairMeaning(selfProfile.zodiac, profile.zodiac, event)
    })
  }

  if (false && profile?.constellation) {
    sections.push({
      label: `星座角度 (${profile.constellation})`,
      text: event
        ? buildConstellationMeaning(profile.constellation, event)
        : constellationNotes[profile.constellation] || '星座只能帮助增加一点观察角度，不能替代实际沟通和证据。'
    })
  }

  if (selfProfile?.constellation && profile?.constellation) {
    sections.push({
      label: `星座相处 (${selfProfile.constellation} / ${profile.constellation})`,
      text: buildConstellationPairMeaning(selfProfile.constellation, profile.constellation, event)
    })
  }

  return {
    title: '侧写',
    summary: '结合本人画像、对方画像、最新事件和趋势变化做趣味解读，不参与核心评分。',
    sections: sections.filter((item) => item.text)
  }
}

export function buildZodiacConstellationSideRead(params) {
  const { profile, selfProfile, event } = params || {}
  const targetZodiac = profile?.zodiac
  const targetConstellation = profile?.constellation
  const selfZodiac = selfProfile?.zodiac
  const selfConstellation = selfProfile?.constellation
  const hasSelfAstroProfile = Boolean(selfZodiac || selfConstellation)
  const sections = []

  if (hasSelfAstroProfile) {
    if (selfZodiac && targetZodiac) {
      sections.push({
        label: `属相相处 (${selfZodiac} / ${targetZodiac})`,
        text: buildZodiacPairMeaning(selfZodiac, targetZodiac, event)
      })
    }
    if (selfConstellation && targetConstellation) {
      sections.push({
        label: `星座相处 (${selfConstellation} / ${targetConstellation})`,
        text: buildConstellationPairMeaning(selfConstellation, targetConstellation, event)
      })
    }
  } else {
    if (targetZodiac) {
      sections.push({
        label: `属相侧写 (${targetZodiac})`,
        text: event
          ? buildZodiacMeaning(targetZodiac, event)
          : zodiacNotes[targetZodiac] || '属相只能作为轻量观察角度，真正要看的仍然是连续行为和事实证据。'
      })
    }
    if (targetConstellation) {
      sections.push({
        label: `星座侧写 (${targetConstellation})`,
        text: event
          ? buildConstellationMeaning(targetConstellation, event)
          : constellationNotes[targetConstellation] || '星座只能帮助增加一点观察角度，不能替代实际沟通和证据。'
      })
    }
  }

  const availableSections = sections.filter((item) => item.text)
  if (availableSections.length === 0) return null

  return {
    title: hasSelfAstroProfile ? '相处侧写参考' : '对象侧写参考',
    summary: hasSelfAstroProfile
      ? '根据你和对象的属相、星座做相处参考，不参与意向和风险评分。'
      : '根据对象的属相、星座做轻量参考，不参与意向和风险评分。',
    sections: availableSections
  }
}

// ============================================================================
// Timeline classifier (from timeline-classifier.ts)
// ============================================================================

export function classifyTimelineEvent(description) {
  const content = description.toLowerCase()

  if (includesAny(content, ['验证', '核实', '查证', '求证', '证实', '兑现', '对上', '对不上', '截图', '账单', '定位', '录音'])) {
    return 'verification'
  }

  if (includesAny(content, ['失联', '消失', '敷衍', '冷淡', '拖延', '推迟', '取消', '放鸽子', '失约', '回避', '拉黑', '矛盾', '骗', '撒谎', '借口', '没来'])) {
    return 'risk'
  }

  if (includesAny(content, ['主动', '约', '见面', '吃饭', '礼物', '送我', '接我', '安排', '介绍朋友', '带我', '公开', '报备', '解释清楚', '道歉', '补偿'])) {
    return 'positive'
  }

  return 'note'
}

function buildSystemTimelineDate(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

function mapIntentBucketLabel(bucket) {
  switch (bucket) {
    case 'low': return '低意向'
    case 'low_medium': return '偏低意向'
    case 'medium': return '中等意向'
    case 'medium_high': return '中高意向'
    case 'high': return '高意向'
    default: return '意向未评估'
  }
}

function mapRiskBucketLabel(bucket) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '风险未评估'
  }
}

function mapEvidenceLabel(level) {
  switch (level) {
    case 'E1': return '证据很少（E1）'
    case 'E2': return '证据偏少（E2）'
    case 'E3': return '已有初步模式（E3）'
    case 'E4': return '证据较充分（E4）'
    case 'E5': return '证据很充分（E5）'
    default: return level || '证据未评估'
  }
}

export function buildTimelineFromLatestResult(latestResult) {
  if (!latestResult) return []

  const createdAt = latestResult.createdAt
  const items = [
    {
      id: 't1',
      title: '完成首次结构化评估',
      type: 'assessment',
      date: '刚刚',
      dateLabel: '刚刚',
      description: `当前判断：${mapIntentBucketLabel(latestResult.intentBucket)}，${mapRiskBucketLabel(latestResult.riskBucket)}，${mapEvidenceLabel(latestResult.evidenceLevel)}。`,
      occurrenceAt: createdAt,
      createdAt
    }
  ]

  if (latestResult.intentBucket === 'medium_high' || latestResult.intentBucket === 'high') {
    items.push({
      id: 't2',
      title: '检测到较明显的意向信号',
      type: 'positive',
      date: '本次评估',
      dateLabel: '本次评估',
      description: '主动性、投入度或推进关系相关信号整体偏正向。',
      occurrenceAt: createdAt,
      createdAt
    })
  }

  if (latestResult.riskBucket === 'medium_high' || latestResult.riskBucket === 'high') {
    items.push({
      id: 't3',
      title: '检测到一致性风险',
      type: 'risk',
      date: '本次评估',
      dateLabel: '本次评估',
      description: '存在改口、回避、兑现不足或节奏反复等风险线索。',
      occurrenceAt: createdAt,
      createdAt
    })
  }

  if ((latestResult.primaryLabels || []).includes('关键问题难验证')) {
    items.push({
      id: 't4',
      title: '建议优先验证关键事实',
      type: 'verification',
      date: '建议动作',
      dateLabel: '建议动作',
      description: '下一轮观察应优先关注能否核实关键说法、承诺和后续兑现。',
      occurrenceAt: createdAt,
      createdAt
    })
  }

  items.push({
    id: 't5',
    title: '下一步建议',
    type: 'note',
    date: buildSystemTimelineDate(latestResult.nextAction, '接下来'),
    dateLabel: buildSystemTimelineDate(latestResult.nextAction, '接下来'),
    description: latestResult.nextAction || '继续观察',
    occurrenceAt: createdAt,
    createdAt
  })

  return items
}
