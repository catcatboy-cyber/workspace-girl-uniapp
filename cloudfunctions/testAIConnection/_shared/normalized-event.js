const SCHEMA_VERSION = 2
const POLICY_VERSION = 2

const ACTORS = ['target', 'self', 'both', 'unknown']
const ACTION_ACTORS = ['target', 'self', 'unknown']
const ACTION_MAX = 4
const INTERACTIONS = ['initiated', 'responded', 'rejected', 'delayed', 'promised', 'fulfilled', 'observed', 'unclear']
const COMMITMENT_STATUSES = ['none', 'promised', 'fulfilled', 'broken', 'unclear']
const COMMITMENT_TYPES = ['meal_invitation', 'movie_invitation', 'meet_invitation', 'chat_followup', 'gift_or_help', 'other', 'none']
const EVIDENCE_TYPES = ['fact', 'feeling', 'mixed', 'unclear']
const STRENGTHS = ['weak', 'medium', 'strong']
const SIGNALS = ['initiative', 'investment', 'progression', 'consistency', 'avoidance', 'coldness', 'verifiability', 'instability']
const SCENES = ['offline_meet', 'movie', 'meal', 'coffee_tea', 'walk', 'chat', 'gift', 'phone_call', 'online_chat', 'shopping', 'activity', 'study', 'work', 'travel', 'game', 'sport', 'music', 'pet', 'food', 'group_social']
const PET_MOODS = ['cheerful', 'cautious', 'encouraging', 'neutral', 'warning']

const INTERACTION_SCORE = {
  initiated: { intent: 6, risk: -2 },
  responded: { intent: 3, risk: -1 },
  rejected: { intent: -8, risk: 10 },
  delayed: { intent: -4, risk: 7 },
  promised: { intent: 5, risk: -1 },
  fulfilled: { intent: 6, risk: -2 },
  observed: { intent: 0, risk: 0 },
  unclear: { intent: 0, risk: 0 }
}

const COMMITMENT_SCORE = {
  none: { intent: 0, risk: 0 },
  promised: { intent: 2, risk: -1 },
  fulfilled: { intent: 4, risk: -4 },
  broken: { intent: -5, risk: 10 },
  unclear: { intent: 0, risk: 0 }
}

const EVIDENCE_FACTOR = { fact: 1, mixed: 0.5, feeling: 0, unclear: 0 }
const STRENGTH_FACTOR = { weak: 0.6, medium: 1, strong: 1.4 }
const ACTOR_FACTOR = { target: 1, both: 0.75, self: 0, unknown: 0 }
const INTERACTION_PRIORITY = {
  unclear: 0,
  observed: 1,
  initiated: 2,
  responded: 3,
  promised: 4,
  fulfilled: 5,
  delayed: 6,
  rejected: 7
}

const SIGNAL_CATEGORY = {
  initiative: 'initiative',
  investment: 'investment',
  progression: 'progression',
  consistency: 'consistency',
  avoidance: 'avoidance',
  coldness: 'avoidance',
  verifiability: 'verifiability',
  instability: 'instability'
}

const SIGNAL_LABEL = {
  initiative: '主动信号',
  investment: '投入信号',
  progression: '关系推进',
  consistency: '言行一致',
  avoidance: '回避信号',
  coldness: '冷淡信号',
  verifiability: '待验证',
  instability: '节奏波动'
}

const FALLBACK_COPY = {
  summary: '这条记录暂时没有完成语义判断，先作为普通记录保存。',
  answer: '这次暂时无法稳定判断是谁释放了什么信号。',
  targetMind: '现有信息不足，先不替对方下结论。',
  nextStep: '可以继续记录后续明确发生的回应或行动。',
  caution: '不要把暂时无法判断理解成正向或负向结论。',
  petLine: '这条先记下来，等有更明确的行动再判断。',
  petMood: 'neutral'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function roundScore(value) {
  const rounded = Math.round(value)
  return Object.is(rounded, -0) ? 0 : rounded
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function buildSafeTitle(description) {
  const text = cleanText(description, 200)
  const first = text.split(/[。！？!?；;，,\n]/).map((item) => item.trim()).find(Boolean) || text
  return cleanText(first, 30) || '关系记录'
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value)
}

function normalizeList(value, allowed, maxItems, warningCode, warnings) {
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null) warnings.push(`${warningCode}_NOT_ARRAY`)
    return []
  }
  const result = []
  let changed = false
  for (const item of value) {
    const normalized = typeof item === 'string' ? item.trim() : ''
    if (!allowed.includes(normalized)) {
      changed = true
      continue
    }
    if (!result.includes(normalized)) result.push(normalized)
    else changed = true
  }
  if (result.length > maxItems) changed = true
  if (changed) warnings.push(`${warningCode}_FILTERED`)
  return result.slice(0, maxItems)
}

function failure(error, warnings = []) {
  return { ok: false, error, warnings: warnings.slice(0, 5) }
}

function normalizeCopy(value, description, warnings) {
  const source = value && typeof value === 'object' ? value : {}
  if (!value || typeof value !== 'object') warnings.push('COPY_MISSING')
  const title = cleanText(source.title, 30) || buildSafeTitle(description)
  const summary = cleanText(source.summary, 100) || '已完成本次事件语义判断。'
  const reason = cleanText(source.reason, 30)
  const answer = cleanText(source.answer, 160) || summary
  const targetMind = cleanText(source.targetMind, 160) || FALLBACK_COPY.targetMind
  const nextStep = cleanText(source.nextStep, 160) || FALLBACK_COPY.nextStep
  const caution = cleanText(source.caution, 160) || FALLBACK_COPY.caution
  const petLine = cleanText(source.petLine, 50) || summary
  const petMood = PET_MOODS.includes(source.petMood) ? source.petMood : 'neutral'
  if (source.petMood && petMood === 'neutral' && source.petMood !== 'neutral') warnings.push('PET_MOOD_NORMALIZED')
  return { title, summary, reason, answer, targetMind, nextStep, caution, petLine, petMood }
}

function repairSemanticCombination(event, warnings) {
  let repaired = false
  const hasCommitment = ['promised', 'fulfilled', 'broken'].includes(event.commitmentStatus)

  // 承诺状态比普通互动更具体，按主结果优先级统一 interaction。
  if (event.commitmentStatus === 'fulfilled' && event.interaction !== 'fulfilled') {
    event.interaction = 'fulfilled'
    repaired = true
  } else if (event.commitmentStatus === 'promised' && event.interaction !== 'promised') {
    event.interaction = 'promised'
    repaired = true
  } else if (event.commitmentStatus === 'broken' && !['rejected', 'delayed'].includes(event.interaction)) {
    event.interaction = 'delayed'
    repaired = true
  } else if (!hasCommitment && event.interaction === 'promised') {
    event.commitmentStatus = 'promised'
    repaired = true
  } else if (!hasCommitment && event.interaction === 'fulfilled') {
    event.commitmentStatus = 'fulfilled'
    repaired = true
  }

  const commitmentExists = ['promised', 'fulfilled', 'broken'].includes(event.commitmentStatus)
  if (commitmentExists && event.commitmentType === 'none') {
    event.commitmentType = 'other'
    repaired = true
  } else if (!commitmentExists && event.commitmentType !== 'none') {
    event.commitmentType = 'none'
    repaired = true
  }

  if (repaired) warnings.push('SEMANTIC_COMBINATION_REPAIRED')
}

function actionPriority(action) {
  const commitmentPriority = action?.commitmentStatus === 'broken' ? 8 : 0
  return commitmentPriority + (INTERACTION_PRIORITY[action?.interaction] || 0)
}

function selectPrimaryAction(actions, actor) {
  const candidates = Array.isArray(actions)
    ? actions.filter((item) => item?.actor === actor)
    : []
  return candidates.reduce((best, item) => {
    if (!best) return item
    const currentRank = actionPriority(item)
    const bestRank = actionPriority(best)
    if (currentRank > bestRank) return item
    if (currentRank === bestRank && Number(item.sequence || 0) > Number(best.sequence || 0)) return item
    return best
  }, null)
}

function normalizeActions(value, warnings) {
  if (!Array.isArray(value) || value.length === 0) {
    return failure('NORMALIZED_EVENT_ACTIONS_REQUIRED')
  }
  if (value.length > ACTION_MAX) return failure('NORMALIZED_EVENT_ACTIONS_TOO_MANY')
  const actions = []
  for (let index = 0; index < value.length; index += 1) {
    const source = value[index]
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return failure('NORMALIZED_EVENT_ACTION_INVALID')
    }
    if (
      Object.prototype.hasOwnProperty.call(source, 'intentDelta') ||
      Object.prototype.hasOwnProperty.call(source, 'riskDelta') ||
      Object.prototype.hasOwnProperty.call(source, 'evidenceDelta') ||
      Object.prototype.hasOwnProperty.call(source, 'eventType')
    ) {
      return failure('NORMALIZED_EVENT_ACTION_FORBIDDEN_FIELD')
    }
    const required = [
      ['actor', ACTION_ACTORS],
      ['interaction', INTERACTIONS],
      ['commitmentStatus', COMMITMENT_STATUSES],
      ['commitmentType', COMMITMENT_TYPES],
      ['evidenceType', EVIDENCE_TYPES],
      ['strength', STRENGTHS]
    ]
    for (const [key, allowed] of required) {
      if (typeof source[key] !== 'string' || !allowed.includes(source[key].trim())) {
        return failure('NORMALIZED_EVENT_ACTION_ENUM_INVALID')
      }
    }
    const action = {
      actor: source.actor.trim(),
      interaction: source.interaction.trim(),
      commitmentStatus: source.commitmentStatus.trim(),
      commitmentType: source.commitmentType.trim(),
      evidenceType: source.evidenceType.trim(),
      strength: source.strength.trim(),
      sequence: index + 1
    }
    repairSemanticCombination(action, warnings)
    actions.push(action)
  }
  return { ok: true, value: actions }
}

function deriveSubjectRoleFromEvent(event) {
  const actions = Array.isArray(event?.actions) ? event.actions : []
  if (actions.length > 0) {
    const hasTarget = actions.some((item) => item.actor === 'target')
    const hasSelf = actions.some((item) => item.actor === 'self')
    if (hasTarget && hasSelf) return 'both'
    if (hasTarget) return 'target'
    if (hasSelf) return 'self'
    return 'unknown'
  }
  return ACTORS.includes(event?.actor) ? event.actor : 'unknown'
}

function deriveLegacyEventFields(event, actions) {
  const primary = selectPrimaryAction(actions, 'target') || selectPrimaryAction(actions, 'self') || actions[0]
  if (!primary) return event
  event.actor = primary.actor
  event.interaction = primary.interaction
  event.commitmentStatus = primary.commitmentStatus
  event.commitmentType = primary.commitmentType
  event.evidenceType = primary.evidenceType
  event.strength = primary.strength
  return event
}

function normalizeNormalizedEventV1(payload, options = {}) {
  const warnings = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return failure('NORMALIZED_EVENT_JSON_INVALID')
  }
  const schemaVersion = Number(payload.schemaVersion)
  if (![1, SCHEMA_VERSION].includes(schemaVersion)) {
    return failure('NORMALIZED_EVENT_VERSION_UNSUPPORTED')
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'intentDelta') ||
    Object.prototype.hasOwnProperty.call(payload, 'riskDelta') ||
    Object.prototype.hasOwnProperty.call(payload, 'evidenceDelta') ||
    Object.prototype.hasOwnProperty.call(payload, 'eventType')
  ) {
    return failure('NORMALIZED_EVENT_FORBIDDEN_FIELD')
  }

  const source = payload.event
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return failure('NORMALIZED_EVENT_REQUIRED_FIELD_MISSING')
  }
  if (
    Object.prototype.hasOwnProperty.call(source, 'intentDelta') ||
    Object.prototype.hasOwnProperty.call(source, 'riskDelta') ||
    Object.prototype.hasOwnProperty.call(source, 'evidenceDelta') ||
    Object.prototype.hasOwnProperty.call(source, 'eventType')
  ) {
    return failure('NORMALIZED_EVENT_FORBIDDEN_FIELD')
  }

  const required = [
    ['actor', ACTORS],
    ['interaction', INTERACTIONS],
    ['commitmentStatus', COMMITMENT_STATUSES],
    ['commitmentType', COMMITMENT_TYPES],
    ['evidenceType', EVIDENCE_TYPES],
    ['strength', STRENGTHS]
  ]
  for (const [key, allowed] of required) {
    if (typeof source[key] !== 'string' || !source[key].trim()) {
      return failure('NORMALIZED_EVENT_REQUIRED_FIELD_MISSING')
    }
    if (!allowed.includes(source[key].trim())) {
      return failure('NORMALIZED_EVENT_ENUM_INVALID')
    }
  }

  const event = {
    actor: source.actor.trim(),
    interaction: source.interaction.trim(),
    commitmentStatus: source.commitmentStatus.trim(),
    commitmentType: source.commitmentType.trim(),
    evidenceType: source.evidenceType.trim(),
    scene: normalizeList(source.scene, SCENES, 2, 'SCENE', warnings),
    signals: normalizeList(source.signals, SIGNALS, 4, 'SIGNALS', warnings),
    strength: source.strength.trim()
  }

  repairSemanticCombination(event, warnings)
  if (schemaVersion === SCHEMA_VERSION) {
    const normalizedActions = normalizeActions(source.actions, warnings)
    if (!normalizedActions.ok) return normalizedActions
    event.actions = normalizedActions.value
    deriveLegacyEventFields(event, event.actions)
  }

  const copy = normalizeCopy(payload.copy, options.description, warnings)
  return {
    ok: true,
    value: { schemaVersion, event, copy },
    warnings: warnings.slice(0, 5)
  }
}

function evidenceDelta(event) {
  if (event.actor === 'self' || event.actor === 'unknown') return 0
  if (event.evidenceType === 'fact') return event.strength === 'strong' ? 2 : 1
  if (event.evidenceType === 'mixed') return 1
  return 0
}

function getScoreBearingAction(event) {
  if (Array.isArray(event?.actions) && event.actions.length > 0) {
    return selectPrimaryAction(event.actions, 'target')
  }
  if (!event || event.actor === 'self' || event.actor === 'unknown') return null
  return event
}

function calculateEventScore(event) {
  const scoreAction = getScoreBearingAction(event)
  if (!scoreAction) {
    return { intentDelta: 0, riskDelta: 0, evidenceDelta: 0, policyVersion: POLICY_VERSION }
  }
  const interaction = INTERACTION_SCORE[scoreAction.interaction] || INTERACTION_SCORE.unclear
  const commitment = COMMITMENT_SCORE[scoreAction.commitmentStatus] || COMMITMENT_SCORE.unclear
  const factor = (EVIDENCE_FACTOR[scoreAction.evidenceType] ?? 0)
    * (STRENGTH_FACTOR[scoreAction.strength] ?? 1)
    * (ACTOR_FACTOR[scoreAction.actor] ?? 0)
  return {
    intentDelta: clamp(roundScore((interaction.intent + commitment.intent) * factor), -20, 20),
    riskDelta: clamp(roundScore((interaction.risk + commitment.risk) * factor), -20, 20),
    evidenceDelta: clamp(evidenceDelta(scoreAction), 0, 2),
    policyVersion: POLICY_VERSION
  }
}

function deriveEventType(event, score) {
  const scoreAction = getScoreBearingAction(event)
  if (!scoreAction) return 'note'
  if (scoreAction.commitmentStatus === 'broken') return 'risk'
  if (scoreAction.interaction === 'rejected' || scoreAction.interaction === 'delayed') return 'risk'
  if (event.signals.includes('verifiability')) return 'verification'
  if (Number(score?.intentDelta || 0) > 0 && Number(score?.riskDelta || 0) <= 0) return 'positive'
  return 'note'
}

function projectCategoriesFromSignals(signals) {
  const result = []
  for (const signal of Array.isArray(signals) ? signals : []) pushUnique(result, SIGNAL_CATEGORY[signal])
  return result
}

function projectSemanticTagsFromNormalizedEvent(event, source = 'ai') {
  const behavior = []
  const outcome = []
  const risk = []
  const actions = Array.isArray(event?.actions) && event.actions.length > 0
    ? [...event.actions].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
    : [event]
  const hasTarget = actions.some((item) => item?.actor === 'target')
  const hasSelf = actions.some((item) => item?.actor === 'self')
  if (hasTarget || event.actor === 'target') pushUnique(behavior, 'target_side')
  if (hasSelf || event.actor === 'self') pushUnique(behavior, 'self_side')
  if ((hasTarget && hasSelf) || event.actor === 'both') pushUnique(behavior, 'both_interaction')
  if (actions.some((item) => item?.actor === 'target' && ['initiated', 'promised'].includes(item.interaction))) {
    pushUnique(behavior, 'target_initiated')
  }
  if (actions.some((item) => item?.actor === 'self' && ['initiated', 'promised'].includes(item.interaction))) {
    pushUnique(behavior, 'self_initiated')
  }

  const scoreAction = getScoreBearingAction(event)
  if (scoreAction && (scoreAction.interaction === 'promised' || scoreAction.commitmentStatus === 'promised')) pushUnique(outcome, 'planned')
  if (scoreAction && (scoreAction.interaction === 'fulfilled' || scoreAction.commitmentStatus === 'fulfilled')) pushUnique(outcome, 'fulfilled')
  if (scoreAction && (scoreAction.interaction === 'delayed' || scoreAction.commitmentStatus === 'broken')) pushUnique(outcome, 'cancelled_delayed')

  if (scoreAction?.interaction === 'rejected') {
    pushUnique(risk, 'rejected')
    pushUnique(risk, 'risk_event')
  }
  if (scoreAction?.interaction === 'delayed') {
    pushUnique(risk, 'vague_delay')
    pushUnique(risk, 'risk_event')
  }
  if (scoreAction?.commitmentStatus === 'broken') pushUnique(risk, 'risk_event')
  if (event.signals.includes('coldness')) pushUnique(risk, 'cold')
  if ((event.signals.includes('avoidance') || event.signals.includes('instability')) && risk.length === 0) pushUnique(risk, 'risk_event')

  const initiatorAction = actions.find((item) => ['initiated', 'promised'].includes(item?.interaction))
  const initiator = initiatorAction && ['target', 'self', 'both'].includes(initiatorAction.actor)
    ? initiatorAction.actor
    : 'unknown'
  const responseAction = initiatorAction
    ? actions.find((item) => Number(item?.sequence || 0) > Number(initiatorAction.sequence || 0) && item?.actor !== initiatorAction.actor)
    : actions.length === 1 ? actions[0] : null
  let response = 'none'
  if (responseAction?.interaction === 'rejected') response = 'rejected'
  else if (responseAction?.interaction === 'delayed') response = 'pending'
  else if (responseAction && ['promised', 'fulfilled'].includes(responseAction.interaction)) response = 'accepted'
  else if (responseAction?.interaction === 'responded') {
    response = ['promised', 'fulfilled'].includes(responseAction.commitmentStatus) ? 'accepted' : 'unclear'
  } else if (initiatorAction && !responseAction) {
    response = 'pending'
  }

  const commitmentAction = scoreAction || selectPrimaryAction(actions, 'self') || actions[0]
  const exists = ['promised', 'fulfilled', 'broken'].includes(commitmentAction?.commitmentStatus)
  const scene = Array.isArray(event.scene) ? [...event.scene] : []
  const all = [...scene, ...behavior, ...outcome, ...risk].filter((item, index, list) => list.indexOf(item) === index)
  return {
    scene,
    behavior,
    outcome,
    risk,
    initiator,
    response,
    responseActor: responseAction?.actor || 'unknown',
    commitment: {
      exists,
      type: exists ? commitmentAction.commitmentType : 'none',
      promisedBy: exists && ['target', 'self', 'both'].includes(commitmentAction.actor) ? commitmentAction.actor : 'unknown',
      fulfilled: commitmentAction?.commitmentStatus === 'fulfilled'
    },
    all,
    source
  }
}

function buildCurrentStatus(event, eventType, copy) {
  const tags = []
  const subjectRole = deriveSubjectRoleFromEvent(event)
  if (eventType === 'risk') pushUnique(tags, '风险信号')
  if (eventType === 'positive') pushUnique(tags, '正向推进')
  if (eventType === 'verification') pushUnique(tags, '待验证')
  if (subjectRole === 'self') pushUnique(tags, '我的记录')
  if (subjectRole === 'both') pushUnique(tags, '双方互动')
  if (subjectRole === 'unknown') pushUnique(tags, '主体不确定')
  for (const signal of event.signals) pushUnique(tags, SIGNAL_LABEL[signal])
  return { tags: tags.slice(0, 3), summary: copy.summary, caution: copy.caution }
}

function buildRawReplyFromCopy(copy) {
  return [
    `小咪先回答你的问题：${copy.answer}`,
    `对方可能在想：${copy.targetMind}`,
    `下一步可以这样推进：${copy.nextStep}`,
    `留个心眼：${copy.caution}`
  ].join('\n\n')
}

function buildAnalysisSnapshot(event, score, eventType, categories, schemaVersion = SCHEMA_VERSION) {
  return {
    schemaVersion,
    policyVersion: POLICY_VERSION,
    event: JSON.parse(JSON.stringify(event)),
    score: {
      intentDelta: Number(score.intentDelta || 0),
      riskDelta: Number(score.riskDelta || 0),
      evidenceDelta: Number(score.evidenceDelta || 0)
    },
    eventType,
    categories: Array.isArray(categories) ? [...categories] : []
  }
}

function buildAnalysisFromNormalizedEvent(normalized, meta = {}) {
  const { event, copy } = normalized
  const score = calculateEventScore(event)
  const eventType = deriveEventType(event, score)
  const categories = projectCategoriesFromSignals(event.signals)
  const semanticTags = projectSemanticTagsFromNormalizedEvent(event, 'ai')
  return {
    eventType,
    eventTitle: copy.title,
    intentDelta: score.intentDelta,
    riskDelta: score.riskDelta,
    evidenceDelta: score.evidenceDelta,
    labels: [],
    summary: copy.summary,
    rationale: copy.reason ? [copy.reason] : [],
    confidence: event.evidenceType === 'fact' ? 'medium' : 'low',
    categories,
    eventInsight: {
      actor: event.actor,
      interaction: event.interaction,
      commitmentStatus: event.commitmentStatus,
      evidenceType: event.evidenceType
    },
    currentStatus: buildCurrentStatus(event, eventType, copy),
    petLine: copy.petLine,
    petMood: copy.petMood,
    rawReply: buildRawReplyFromCopy(copy),
    normalizedEvent: JSON.parse(JSON.stringify(event)),
    semanticTags,
    semanticSchemaVersion: normalized.schemaVersion || SCHEMA_VERSION,
    scoringPolicyVersion: POLICY_VERSION,
    analysisSnapshot: buildAnalysisSnapshot(event, score, eventType, categories, normalized.schemaVersion || SCHEMA_VERSION),
    normalizationWarnings: Array.isArray(meta.warnings) ? meta.warnings.slice(0, 5) : [],
    validationError: '',
    usedAI: true,
    aiProvidedEventInsight: true,
    aiProvider: meta.aiProvider || '',
    aiModel: meta.aiModel || '',
    tokenUsage: meta.tokenUsage || null
  }
}

function buildFallbackNormalizedEvent(description) {
  return {
    schemaVersion: SCHEMA_VERSION,
    event: {
      actor: 'unknown',
      interaction: 'unclear',
      commitmentStatus: 'unclear',
      commitmentType: 'none',
      evidenceType: 'unclear',
      scene: [],
      signals: [],
      strength: 'weak',
      actions: [{
        actor: 'unknown',
        interaction: 'unclear',
        commitmentStatus: 'unclear',
        commitmentType: 'none',
        evidenceType: 'unclear',
        strength: 'weak',
        sequence: 1
      }]
    },
    copy: { title: buildSafeTitle(description), ...FALLBACK_COPY }
  }
}

function buildFallbackAnalysis(description, validationError = 'AI_REQUEST_FAILED') {
  const normalized = buildFallbackNormalizedEvent(description)
  const analysis = buildAnalysisFromNormalizedEvent(normalized)
  return {
    ...analysis,
    semanticTags: projectSemanticTagsFromNormalizedEvent(normalized.event, 'fallback'),
    analysisSnapshot: buildAnalysisSnapshot(normalized.event, calculateEventScore(normalized.event), 'note', []),
    validationError,
    usedAI: false,
    aiProvidedEventInsight: false,
    confidence: 'low'
  }
}

function replayAnalysisSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || ![1, SCHEMA_VERSION].includes(Number(snapshot.schemaVersion))) {
    return { ok: false, error: 'LEGACY_EVENT_SEMANTICS_MISSING' }
  }
  const score = snapshot.score && typeof snapshot.score === 'object' ? snapshot.score : null
  if (!score || !Number.isFinite(Number(score.intentDelta)) || !Number.isFinite(Number(score.riskDelta)) || !Number.isFinite(Number(score.evidenceDelta))) {
    return { ok: false, error: 'ANALYSIS_SNAPSHOT_INVALID' }
  }
  return {
    ok: true,
    value: {
      event: snapshot.event,
      eventType: ['positive', 'risk', 'verification', 'note'].includes(snapshot.eventType) ? snapshot.eventType : 'note',
      intentDelta: clamp(Math.round(Number(score.intentDelta)), -20, 20),
      riskDelta: clamp(Math.round(Number(score.riskDelta)), -20, 20),
      evidenceDelta: clamp(Math.round(Number(score.evidenceDelta)), 0, 2),
      categories: Array.isArray(snapshot.categories) ? [...snapshot.categories] : [],
      schemaVersion: snapshot.schemaVersion,
      policyVersion: snapshot.policyVersion
    }
  }
}

const normalizeNormalizedEvent = normalizeNormalizedEventV1

module.exports = {
  SCHEMA_VERSION,
  POLICY_VERSION,
  ACTORS,
  ACTION_ACTORS,
  ACTION_MAX,
  INTERACTIONS,
  COMMITMENT_STATUSES,
  COMMITMENT_TYPES,
  EVIDENCE_TYPES,
  STRENGTHS,
  SIGNALS,
  SCENES,
  PET_MOODS,
  normalizeNormalizedEvent,
  normalizeNormalizedEventV1,
  deriveSubjectRoleFromEvent,
  calculateEventScore,
  deriveEventType,
  projectCategoriesFromSignals,
  projectSemanticTagsFromNormalizedEvent,
  buildRawReplyFromCopy,
  buildAnalysisSnapshot,
  buildAnalysisFromNormalizedEvent,
  buildFallbackNormalizedEvent,
  buildFallbackAnalysis,
  replayAnalysisSnapshot
}
