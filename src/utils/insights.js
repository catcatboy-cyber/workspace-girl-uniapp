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
    type: event.type
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

function pickEvidence(caseFile, label) {
  const sequenceMap = buildSequenceMap(caseFile)
  const manualTimeline = caseFile.timeline.filter((item) => item.type !== 'assessment')
  const scored = manualTimeline
    .map((event) => ({ event, score: scoreEvidence(label, event) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      ...toFocusEvidence(item.event, sequenceMap.get(item.event.id))
    }))

  if (scored.length > 0) return scored

  return manualTimeline.slice(0, 2).map((item) => toFocusEvidence(item, sequenceMap.get(item.id)))
}

function buildStatus(label, evidences) {
  const latest = evidences[0]
  if (!latest) return '样本偏少'
  if (label === '证据不足') return '继续补样本'
  if (latest.type === 'risk') return '升温中'
  if (latest.type === 'verification' || latest.type === 'positive') return '观察中'
  return '暂时持平'
}

function buildNextPrompt(label) {
  switch (label) {
    case '单向投入':
      return '下一次重点记录：如果你先停一下，对方会不会自己来推进。'
    case '口头热情，行动不足':
      return '下一次重点记录：答应过的见面、安排或回应，这次有没有真正落地。'
    case '关键问题难验证':
      return '下一次重点记录：有没有新的可核实事实，或者原说法能不能对上。'
    case '节奏明显不稳定':
      return '下一次重点记录：后续两三次互动是继续反复，还是开始稳定。'
    case '证据不足':
      return '下一次重点记录：一条具体、可复盘、不是纯感觉的真实互动。'
    default:
      return '下一次重点记录：能直接改变判断方向的一条真实事件。'
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
      nextRecordPrompt: '下一次重点记录：有没有新的主动推进，或者有没有一次明确兑现。',
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

  const summary =
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

  const caution =
    trend.warningText
      ?? (latest.consistencyRiskScore >= 60
        ? '近期风险已经不低，后面要优先看有没有解释、兑现和补动作。'
        : latest.evidenceLevel === 'E1' || latest.evidenceLevel === 'E2'
          ? '证据还薄，任何强烈感觉都先别急着定性。'
          : '下一次最值得记录的是：对方会不会主动、会不会落地、会不会持续。')

  return {
    phase,
    state,
    weather,
    summary,
    spotlight,
    caution
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

export function buildEventEntertainmentInsight(params) {
  const { profile, event } = params
  if (!hasProfile(profile) || !event) return null

  const eventReadBase =
    event.type === 'risk'
      ? `这次是"${event.title}"。动作往后缩了，重点要看这是不是一次真实的回避或风险抬头。`
      : event.type === 'positive'
        ? `这次是"${event.title}"。动作已经往前走了一步，重点要看后续会不会继续落地。`
        : event.type === 'verification'
          ? `这次是"${event.title}"。关键不在气氛，而在能不能把事实和承诺对上。`
          : `这次是"${event.title}"。先记下来，后面要看它会不会和更多事件连成方向。`

  const occupationMeaning = buildOccupationMeaning(profile?.occupation, event)
  const sections = [
    {
      label: '事件怎么读',
      text: occupationMeaning ? `${eventReadBase} ${occupationMeaning}` : eventReadBase
    },
    profile?.zodiac ? {
      label: `属相怎么看${profile.zodiac ? ` (${profile.zodiac})` : ''}`,
      text: buildZodiacMeaning(profile.zodiac, event)
    } : null,
    profile?.constellation ? {
      label: `星座怎么看${profile.constellation ? ` (${profile.constellation})` : ''}`,
      text: buildConstellationMeaning(profile.constellation, event)
    } : null
  ].filter((item) => Boolean(item && item.text))

  return {
    title: '侧写',
    summary: event.type === 'risk'
      ? '这次更像在看他为什么会缩回去。'
      : event.type === 'positive'
        ? '这次更像在看他到底愿不愿意往前动一下。'
        : '这次更像在看他遇到事情时会怎么表现。',
    sections,
    disclaimer: '这是娱乐向观察，不参与评分，也不能代替真实沟通和证据。'
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
      description: `当前结果：${latestResult.intentBucket} / ${latestResult.riskBucket} / ${latestResult.evidenceLevel}`,
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
