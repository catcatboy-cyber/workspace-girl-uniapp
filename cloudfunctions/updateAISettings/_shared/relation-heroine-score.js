'use strict'

const SELF_VALUES = { A: 5, B: 4, C: 3, D: 2, E: 1 }
const TARGET_VALUES = { ...SELF_VALUES, U: null }
const STAGES = new Set(['pre_relationship', 'early_dating', 'steady_relationship', 'long_term'])

function fail(code, message) {
  const error = new Error(message || code)
  error.code = code
  throw error
}

function roundClamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

function assertUniqueAnswers(answers, expectedIds, allowedKeys, label) {
  if (!Array.isArray(answers) || answers.length !== expectedIds.size) {
    fail('INVALID_ARGUMENT', `${label}答案数量不正确`)
  }
  const byId = new Map()
  for (const answer of answers) {
    const id = String(answer?.questionId || '').trim()
    const optionKey = String(answer?.optionKey || '').trim()
    if (!expectedIds.has(id) || byId.has(id) || !allowedKeys.has(optionKey)) {
      fail('INVALID_ARGUMENT', `${label}答案包含无效题号、重复题号或选项`)
    }
    byId.set(id, optionKey)
  }
  return byId
}

function scoreRelationHeroine(content, payload = {}) {
  const mode = payload.mode === 'target' ? 'target' : payload.mode === 'self' ? 'self' : ''
  if (!mode) fail('INVALID_ARGUMENT', 'mode 无效')
  const stageKey = String(payload.stageKey || '')
  if (!STAGES.has(stageKey)) fail('INVALID_ARGUMENT', 'stageKey 无效')
  const archetypes = Array.isArray(content?.archetypes) ? content.archetypes : []
  const archetype = archetypes.find((item) => item?.key === payload.personKey && item?.enabled !== false)
  if (!archetype) fail('INVALID_ARGUMENT', '人物不存在或未启用')

  const universal = Array.isArray(archetype.universalQuestions) ? archetype.universalQuestions : []
  const stageQuestions = Array.isArray(archetype.stageQuestions?.[stageKey]) ? archetype.stageQuestions[stageKey] : []
  const questions = [...universal, ...stageQuestions]
  if (universal.length !== 10 || stageQuestions.length !== 5 || questions.length !== 15) {
    fail('INVALID_ARGUMENT', '题库结构不完整')
  }
  const questionIds = new Set(questions.map((item) => item.id))
  if (questionIds.size !== 15) fail('INVALID_ARGUMENT', '题号重复')
  const allowedKeys = new Set(Object.keys(mode === 'self' ? SELF_VALUES : TARGET_VALUES))
  const answerMap = assertUniqueAnswers(payload.answers, questionIds, allowedKeys, '专测')

  const dimensionBuckets = new Map()
  const normalizedAnswers = []
  let unknownCount = 0
  for (const question of questions) {
    const optionKey = answerMap.get(question.id)
    const rawValue = (mode === 'self' ? SELF_VALUES : TARGET_VALUES)[optionKey]
    if (rawValue === null) {
      unknownCount += 1
      normalizedAnswers.push({ questionId: question.id, optionKey, value: null })
      continue
    }
    const adjusted = question.reverse ? 6 - rawValue : rawValue
    if (!dimensionBuckets.has(question.dimensionKey)) dimensionBuckets.set(question.dimensionKey, [])
    dimensionBuckets.get(question.dimensionKey).push(adjusted)
    normalizedAnswers.push({ questionId: question.id, optionKey, value: adjusted })
  }

  const dimensions = Array.isArray(archetype.dimensions) ? archetype.dimensions : []
  if (dimensions.length !== 3) fail('INVALID_ARGUMENT', '评分维度不完整')
  const dimensionScores = {}
  let weighted = 0
  let totalWeight = 0
  for (const dimension of dimensions) {
    const values = dimensionBuckets.get(dimension.key) || []
    if (values.length < 3) fail('INSUFFICIENT_OBSERVATION', '每个维度至少需要 3 道有效答案')
    const score = roundClamp(((values.reduce((sum, value) => sum + value, 0) - values.length) / (values.length * 4)) * 100)
    const weight = Number(dimension.weight)
    if (!Number.isFinite(weight) || weight <= 0) fail('INVALID_ARGUMENT', '维度权重无效')
    dimensionScores[dimension.key] = score
    weighted += score * weight
    totalWeight += weight
  }

  const answeredCount = 15 - unknownCount
  if (answeredCount < 9) fail('INSUFFICIENT_OBSERVATION', '有效答案不足 9 道')
  if (Math.abs(totalWeight - 1) > 0.0001) fail('INVALID_ARGUMENT', '维度权重之和必须为 1')

  const scenarioPool = Array.isArray(archetype.scenarios?.[stageKey]) ? archetype.scenarios[stageKey] : []
  if (scenarioPool.length !== 3) fail('INVALID_ARGUMENT', '情景题结构不完整')
  const scenarioIds = new Set(scenarioPool.map((item) => item.id))
  const scenarioKeys = new Set(mode === 'self' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'U'])
  const scenarioMap = assertUniqueAnswers(payload.scenarioAnswers, scenarioIds, scenarioKeys, '情景题')
  let scenarioValid = 0
  let scenarioMatches = 0
  const normalizedScenarioAnswers = []
  for (const scenario of scenarioPool) {
    const optionKey = scenarioMap.get(scenario.id)
    if (optionKey !== 'U') {
      scenarioValid += 1
      if (optionKey === scenario.typicalOptionKey) scenarioMatches += 1
    }
    normalizedScenarioAnswers.push({ questionId: scenario.id, optionKey })
  }
  let scenarioVerification = '观察信息不足'
  if (scenarioValid >= 2) {
    if (scenarioMatches === 3) scenarioVerification = '情景高度吻合'
    else if (scenarioMatches === 2) scenarioVerification = '情景进一步支持'
    else if (scenarioMatches === 1) scenarioVerification = '部分情景吻合'
    else scenarioVerification = '实际处理方式与该风格差异明显'
  }

  const observationConfidence = answeredCount >= 13 ? 'high' : answeredCount >= 11 ? 'medium' : 'low'
  return {
    personKey: archetype.key,
    similarity: roundClamp(weighted / totalWeight),
    dimensionScores,
    answeredCount,
    unknownCount,
    observationConfidence,
    scenarioVerification,
    answers: normalizedAnswers,
    scenarioAnswers: normalizedScenarioAnswers
  }
}

module.exports = {
  SELF_VALUES,
  TARGET_VALUES,
  STAGES,
  scoreRelationHeroine
}
