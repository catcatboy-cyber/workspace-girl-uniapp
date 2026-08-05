'use strict'

const DIMENSIONS = ['initiative', 'warmth', 'reliability', 'romance', 'boundary']
const DIMENSION_WEIGHTS = Object.freeze({
  initiative: 0.2,
  warmth: 0.2,
  reliability: 0.2,
  romance: 0.2,
  boundary: 0.2
})

function fail(code, message) {
  const error = new Error(message || code)
  error.code = code
  throw error
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSubjectGender(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'male' || raw === '男') return 'male'
  if (raw === 'female' || raw === '女') return 'female'
  return 'unknown'
}

function scoreCrushCelebrity(content, payload = {}) {
  const mode = payload.mode === 'target' ? 'target' : payload.mode === 'self' ? 'self' : ''
  if (!mode) fail('INVALID_ARGUMENT', 'mode 无效')
  const questions = Array.isArray(content?.questions) ? content.questions : []
  if (questions.length !== 12) fail('INVALID_ARGUMENT', '题库必须包含 12 道题')
  const expectedIds = new Set(questions.map((item) => item.id))
  if (expectedIds.size !== 12) fail('INVALID_ARGUMENT', '题目 ID 重复')
  if (!Array.isArray(payload.answers) || payload.answers.length !== 12) fail('INVALID_ARGUMENT', '答案数量必须为 12')
  const allowedKeys = new Set(mode === 'self' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'U'])
  const answerMap = new Map()
  for (const answer of payload.answers) {
    const id = String(answer?.questionId || '').trim()
    const optionKey = String(answer?.optionKey || '').trim()
    if (!expectedIds.has(id) || answerMap.has(id) || !allowedKeys.has(optionKey)) {
      fail('INVALID_ARGUMENT', '答案包含无效题号、重复题号或选项')
    }
    answerMap.set(id, optionKey)
  }

  const buckets = Object.fromEntries(DIMENSIONS.map((key) => [key, []]))
  let unknownCount = 0
  const normalizedAnswers = []
  for (const question of questions) {
    const optionKey = answerMap.get(question.id)
    if (optionKey === 'U') {
      unknownCount += 1
      normalizedAnswers.push({ questionId: question.id, optionKey })
      continue
    }
    const option = Array.isArray(question.options) ? question.options.find((item) => item.key === optionKey) : null
    if (!option || !option.scores || typeof option.scores !== 'object') fail('INVALID_ARGUMENT', '选项评分配置无效')
    for (const [dimension, rawScore] of Object.entries(option.scores)) {
      if (!DIMENSIONS.includes(dimension)) fail('INVALID_ARGUMENT', '存在未知评分维度')
      const score = Number(rawScore)
      if (!Number.isFinite(score) || score < 0 || score > 100) fail('INVALID_ARGUMENT', '选项评分超出范围')
      buckets[dimension].push(score)
    }
    normalizedAnswers.push({ questionId: question.id, optionKey })
  }

  const answeredCount = 12 - unknownCount
  if (mode === 'target' && answeredCount < 8) fail('INSUFFICIENT_OBSERVATION', '有效答案不足 8 道')
  const dimensions = {}
  for (const dimension of DIMENSIONS) {
    const values = buckets[dimension]
    if (values.length < 2) fail('INSUFFICIENT_OBSERVATION', `维度 ${dimension} 有效贡献不足`)
    dimensions[dimension] = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  }

  const subjectGender = normalizeSubjectGender(payload.subjectGender)
  if (!['female', 'male'].includes(subjectGender)) fail('PROFILE_GENDER_REQUIRED', '请先补全被测对象画像中的性别信息')
  const people = (Array.isArray(content?.people) ? content.people : []).filter((item) =>
    item?.enabled !== false && normalizeSubjectGender(item?.gender) === subjectGender
  )
  if (people.length === 0) fail('INVALID_ARGUMENT', '没有可参与计算的人物')
  const ranked = people.map((person) => {
    let squared = 0
    for (const dimension of DIMENSIONS) {
      const target = Number(person?.profile?.[dimension])
      if (!Number.isFinite(target) || target < 0 || target > 100) fail('INVALID_ARGUMENT', `人物 ${person?.key || ''} 向量无效`)
      squared += DIMENSION_WEIGHTS[dimension] * ((dimensions[dimension] - target) ** 2)
    }
    const distance = Math.sqrt(squared)
    return {
      personKey: person.key,
      name: person.name,
      sortOrder: Number(person.sortOrder) || Number.MAX_SAFE_INTEGER,
      distance,
      similarity: Math.round(clamp(100 - distance, 0, 100))
    }
  }).sort((a, b) =>
    b.similarity - a.similarity ||
    a.distance - b.distance ||
    a.sortOrder - b.sortOrder ||
    String(a.personKey).localeCompare(String(b.personKey), 'en')
  )

  const primary = ranked[0]
  const secondary = ranked[1]
  const secondaryPersonKey = secondary && primary.similarity >= 60 && secondary.similarity >= 60 && primary.similarity - secondary.similarity <= 3
    ? secondary.personKey
    : undefined
  const observationConfidence = answeredCount >= 11 ? 'high' : answeredCount >= 9 ? 'medium' : 'low'
  return {
    primaryPersonKey: primary.personKey,
    secondaryPersonKey,
    similarities: Object.fromEntries(ranked.map((item) => [item.personKey, item.similarity])),
    topFive: ranked.slice(0, 5).map(({ personKey, name, similarity }) => ({ personKey, name, similarity })),
    dimensions,
    answeredCount,
    unknownCount,
    observationConfidence,
    subjectGender,
    answers: normalizedAnswers
  }
}

module.exports = {
  DIMENSIONS,
  DIMENSION_WEIGHTS,
  normalizeSubjectGender,
  scoreCrushCelebrity
}
