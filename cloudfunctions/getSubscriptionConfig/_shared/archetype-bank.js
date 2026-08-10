'use strict'

const crypto = require('crypto')
const { runCelebrityCalibration } = require('./crush-celebrity-calibration')
const { scoreCrushCelebrity } = require('./crush-celebrity-score')

const COLLECTION = 'archetype_question_banks'
const FEATURE_RELATION = '关系女主角'
const FEATURE_CELEBRITY = 'Crush名人图鉴'
const FEATURE_CHARACTER = '次元角色图鉴'
const RELATION_STAGES = ['pre_relationship', 'early_dating', 'steady_relationship', 'long_term']
const CELEBRITY_DIMENSIONS = ['initiative', 'warmth', 'reliability', 'romance', 'boundary']
const CHARACTER_CATEGORIES = ['classic', 'wuxia', 'tomb_raiding', 'chinese_screen', 'international', 'anime']

function normalizeSubjectGender(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'male' || raw === '男') return 'male'
  if (raw === 'female' || raw === '女') return 'female'
  return 'unknown'
}

function normalizeDoc(result) {
  const data = result?.data
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value).sort().reduce((output, key) => {
      output[key] = stableValue(value[key])
      return output
    }, {})
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function checksumContent(content) {
  return crypto.createHash('sha256').update(stableStringify(content), 'utf8').digest('hex')
}

function makeError(path, code, message) {
  return { path, code, message }
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validateParallelText(item, path, errors) {
  if (!isNonEmptyText(item?.textSelf)) errors.push(makeError(`${path}.textSelf`, 'REQUIRED', '缺少 self 文案'))
  if (!isNonEmptyText(item?.textTarget)) errors.push(makeError(`${path}.textTarget`, 'REQUIRED', '缺少 target 文案'))
  if (isNonEmptyText(item?.textSelf) && item.textSelf.trim() === String(item?.textTarget || '').trim()) {
    errors.push(makeError(path, 'PARALLEL_TEXT_REQUIRED', 'self 与 target 文案不能完全相同'))
  }
}

function validateRelationContent(content) {
  const errors = []
  const archetypes = Array.isArray(content?.archetypes) ? content.archetypes : []
  const relationArchetypeKeys = archetypes.map((item) => item?.key).filter(Boolean)
  const stages = Array.isArray(content?.stages) ? content.stages : []
  const stageKeys = stages.map((item) => item?.key)
  if (stageKeys.length !== 4 || RELATION_STAGES.some((key) => !stageKeys.includes(key))) {
    errors.push(makeError('stages', 'STAGE_SET_INVALID', '关系阶段必须包含固定四阶段'))
  }
  stages.forEach((stage, index) => {
    if (!isNonEmptyText(stage?.label)) errors.push(makeError(`stages[${index}].label`, 'REQUIRED', '关系阶段文案不能为空'))
  })
  const screener = Array.isArray(content?.screener) ? content.screener : []
  if (screener.length !== 6) errors.push(makeError('screener', 'COUNT_INVALID', '快筛必须为 6 题'))
  const screenerIds = new Set()
  screener.forEach((question, index) => {
    const path = `screener[${index}]`
    if (!question?.id || screenerIds.has(question.id)) errors.push(makeError(`${path}.id`, 'ID_INVALID', '快筛 ID 缺失或重复'))
    screenerIds.add(question?.id)
    validateParallelText(question, path, errors)
    const options = Array.isArray(question?.options) ? question.options : []
    const keys = options.map((item) => item?.key).sort().join('')
    if (keys !== 'RTX') errors.push(makeError(`${path}.options`, 'OPTIONS_INVALID', '快筛选项必须为 R/T/X'))
    options.forEach((option, optionIndex) => {
      if (!isNonEmptyText(option?.textSelf) || !isNonEmptyText(option?.textTarget)) {
        errors.push(makeError(`${path}.options[${optionIndex}]`, 'COPY_REQUIRED', '快筛 self/target 选项文案不能为空'))
      }
      if (!relationArchetypeKeys.includes(option?.voteFor)) {
        errors.push(makeError(`${path}.options[${optionIndex}].voteFor`, 'VOTE_INVALID', '快筛投票人物无效'))
      }
    })
  })

  if (archetypes.length !== 3) errors.push(makeError('archetypes', 'COUNT_INVALID', '首发必须为 3 个人物'))
  const archetypeKeys = new Set()
  const archetypeNames = new Set()
  const globalUniversalIds = new Set()
  archetypes.forEach((archetype, archetypeIndex) => {
    const base = `archetypes[${archetypeIndex}]`
    if (!archetype?.key || archetypeKeys.has(archetype.key)) errors.push(makeError(`${base}.key`, 'ID_INVALID', '人物 key 缺失或重复'))
    archetypeKeys.add(archetype?.key)
    const normalizedName = String(archetype?.name || '').trim()
    if (!normalizedName) errors.push(makeError(`${base}.name`, 'REQUIRED', '人物名称不能为空'))
    else if (archetypeNames.has(normalizedName)) errors.push(makeError(`${base}.name`, 'DUPLICATE', '三个人物名称不能重复'))
    archetypeNames.add(normalizedName)
    if (!isNonEmptyText(archetype?.label)) errors.push(makeError(`${base}.label`, 'REQUIRED', '人物风格副标题不能为空'))
    if (typeof archetype?.enabled !== 'boolean') errors.push(makeError(`${base}.enabled`, 'TYPE_INVALID', 'enabled 必须为布尔值'))
    const dimensions = Array.isArray(archetype?.dimensions) ? archetype.dimensions : []
    if (dimensions.length !== 3) errors.push(makeError(`${base}.dimensions`, 'COUNT_INVALID', '每个人物必须有 3 个维度'))
    const dimensionKeys = new Set(dimensions.map((item) => item?.key))
    const weightSum = dimensions.reduce((sum, item) => sum + Number(item?.weight || 0), 0)
    if (Math.abs(weightSum - 1) > 0.0001) errors.push(makeError(`${base}.dimensions`, 'WEIGHT_INVALID', '维度权重之和必须为 1'))
    dimensions.forEach((dimension, index) => {
      if (!isNonEmptyText(dimension?.name) || !isNonEmptyText(dimension?.highText) || !isNonEmptyText(dimension?.lowText)) {
        errors.push(makeError(`${base}.dimensions[${index}]`, 'COPY_REQUIRED', '维度名称和高低分文案不能为空'))
      }
    })

    const universal = Array.isArray(archetype?.universalQuestions) ? archetype.universalQuestions : []
    if (universal.length !== 10) errors.push(makeError(`${base}.universalQuestions`, 'COUNT_INVALID', '通用题必须为 10 道'))
    universal.forEach((question, index) => {
      const path = `${base}.universalQuestions[${index}]`
      if (!question?.id || globalUniversalIds.has(question.id)) errors.push(makeError(`${path}.id`, 'ID_INVALID', '通用题 ID 缺失或全局重复'))
      globalUniversalIds.add(question?.id)
      if (!dimensionKeys.has(question?.dimensionKey)) errors.push(makeError(`${path}.dimensionKey`, 'DIMENSION_INVALID', '题目维度无效'))
      validateParallelText(question, path, errors)
      if (typeof question?.reverse !== 'boolean') errors.push(makeError(`${path}.reverse`, 'TYPE_INVALID', 'reverse 必须为布尔值'))
    })

    let expectedStageQuestionIds = null
    let expectedScenarioIds = null
    for (const stageKey of RELATION_STAGES) {
      const stageQuestions = Array.isArray(archetype?.stageQuestions?.[stageKey]) ? archetype.stageQuestions[stageKey] : []
      const stagePath = `${base}.stageQuestions.${stageKey}`
      if (stageQuestions.length !== 5) errors.push(makeError(stagePath, 'COUNT_INVALID', '每阶段必须有 5 道题'))
      const ids = stageQuestions.map((item) => item?.id)
      if (new Set(ids).size !== ids.length) errors.push(makeError(stagePath, 'ID_INVALID', '同阶段题号重复'))
      const signature = [...ids].sort().join('|')
      if (expectedStageQuestionIds === null) expectedStageQuestionIds = signature
      else if (signature !== expectedStageQuestionIds) errors.push(makeError(stagePath, 'STAGE_ID_MISMATCH', '四阶段必须复用同一组题号'))
      stageQuestions.forEach((question, index) => {
        const path = `${stagePath}[${index}]`
        if (!dimensionKeys.has(question?.dimensionKey)) errors.push(makeError(`${path}.dimensionKey`, 'DIMENSION_INVALID', '题目维度无效'))
        validateParallelText(question, path, errors)
        if (typeof question?.reverse !== 'boolean') errors.push(makeError(`${path}.reverse`, 'TYPE_INVALID', 'reverse 必须为布尔值'))
      })

      const scenarios = Array.isArray(archetype?.scenarios?.[stageKey]) ? archetype.scenarios[stageKey] : []
      const scenarioPath = `${base}.scenarios.${stageKey}`
      if (scenarios.length !== 3) errors.push(makeError(scenarioPath, 'COUNT_INVALID', '每阶段必须有 3 道情景题'))
      const scenarioIds = scenarios.map((item) => item?.id)
      if (new Set(scenarioIds).size !== scenarioIds.length) errors.push(makeError(scenarioPath, 'ID_INVALID', '同阶段情景题号重复'))
      const scenarioSignature = [...scenarioIds].sort().join('|')
      if (expectedScenarioIds === null) expectedScenarioIds = scenarioSignature
      else if (scenarioSignature !== expectedScenarioIds) errors.push(makeError(scenarioPath, 'STAGE_ID_MISMATCH', '四阶段必须复用同一组情景题号'))
      scenarios.forEach((scenario, index) => {
        const path = `${scenarioPath}[${index}]`
        validateParallelText(scenario, path, errors)
        const keys = (Array.isArray(scenario?.options) ? scenario.options : []).map((item) => item?.key).sort().join('')
        if (keys !== 'ABC') errors.push(makeError(`${path}.options`, 'OPTIONS_INVALID', '情景选项必须为 A/B/C'))
        if (scenario?.typicalOptionKey !== 'A') errors.push(makeError(`${path}.typicalOptionKey`, 'TYPICAL_INVALID', '首发典型答案固定为 A'))
      })
    }
    if (!isNonEmptyText(archetype?.resultCopy?.attraction) || !isNonEmptyText(archetype?.resultCopy?.caution)) {
      errors.push(makeError(`${base}.resultCopy`, 'COPY_REQUIRED', '结果吸引点和注意点不能为空'))
    }
  })
  return errors
}

function validateCelebrityContent(content, options = {}) {
  const isCharacter = options.featureKey === FEATURE_CHARACTER
  const expectedPeopleCount = isCharacter ? 72 : 48
  const errors = []
  const dimensions = Array.isArray(content?.dimensions) ? content.dimensions : []
  const dimensionKeys = dimensions.map((item) => item?.key)
  if (dimensions.length !== CELEBRITY_DIMENSIONS.length || CELEBRITY_DIMENSIONS.some((key) => !dimensionKeys.includes(key)) || new Set(dimensionKeys).size !== dimensionKeys.length) {
    errors.push(makeError('dimensions', 'DIMENSION_SET_INVALID', '名人图鉴必须包含固定五维'))
  }
  dimensions.forEach((dimension, index) => {
    if (!isNonEmptyText(dimension?.name) || !isNonEmptyText(dimension?.description)) {
      errors.push(makeError(`dimensions[${index}]`, 'COPY_REQUIRED', '维度名称和说明不能为空'))
    }
  })
  const resultCopy = content?.resultCopy && typeof content.resultCopy === 'object' ? content.resultCopy : {}
  CELEBRITY_DIMENSIONS.forEach((key) => {
    if (!isNonEmptyText(resultCopy?.[key]?.high) || !isNonEmptyText(resultCopy?.[key]?.low)) {
      errors.push(makeError(`resultCopy.${key}`, 'COPY_REQUIRED', '高分表达和低分观察文案不能为空'))
    }
  })
  if (!isNonEmptyText(resultCopy.shareTemplate)) {
    errors.push(makeError('resultCopy.shareTemplate', 'COPY_REQUIRED', '分享文案模板不能为空'))
  }
  const questions = Array.isArray(content?.questions) ? content.questions : []
  if (questions.length !== 12) errors.push(makeError('questions', 'COUNT_INVALID', '名人题必须为 12 道'))
  const questionIds = new Set()
  const dimensionContributions = Object.fromEntries(CELEBRITY_DIMENSIONS.map((key) => [key, 0]))
  questions.forEach((question, index) => {
    const path = `questions[${index}]`
    if (!/^CQ(0[1-9]|1[0-2])$/.test(String(question?.id || '')) || questionIds.has(question.id)) {
      errors.push(makeError(`${path}.id`, 'ID_INVALID', '题号必须为唯一 CQ01-CQ12'))
    }
    questionIds.add(question?.id)
    validateParallelText(question, path, errors)
    const optionsList = Array.isArray(question?.options) ? question.options : []
    const keys = optionsList.map((item) => item?.key).sort().join('')
    if (keys !== 'ABCD') errors.push(makeError(`${path}.options`, 'OPTIONS_INVALID', '每题必须只有 A-D'))
    optionsList.forEach((option, optionIndex) => {
      if (!isNonEmptyText(option?.textSelf) || !isNonEmptyText(option?.textTarget)) {
        errors.push(makeError(`${path}.options[${optionIndex}]`, 'COPY_REQUIRED', 'self/target 选项文案不能为空'))
      }
      const scores = option?.scores && typeof option.scores === 'object' ? option.scores : {}
      Object.entries(scores).forEach(([key, rawValue]) => {
        if (!CELEBRITY_DIMENSIONS.includes(key)) errors.push(makeError(`${path}.options[${optionIndex}].scores.${key}`, 'DIMENSION_INVALID', '未知维度'))
        const value = Number(rawValue)
        if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(makeError(`${path}.options[${optionIndex}].scores.${key}`, 'SCORE_INVALID', '分值必须在 0..100'))
        else if (CELEBRITY_DIMENSIONS.includes(key)) dimensionContributions[key] += 1
      })
    })
  })
  CELEBRITY_DIMENSIONS.forEach((key) => {
    if (dimensionContributions[key] === 0) errors.push(makeError(`dimensions.${key}`, 'NO_CONTRIBUTION', '维度没有题目贡献'))
  })

  const people = Array.isArray(content?.people) ? content.people : []
  if (people.length !== expectedPeopleCount) errors.push(makeError('people', 'COUNT_INVALID', `首发人物必须为 ${expectedPeopleCount} 人`))
  const peopleKeys = new Set()
  const sortOrders = new Set()
  const eraCounts = { history: 0, modern: 0, contemporary: 0 }
  const genderCounts = { female: 0, male: 0 }
  const categoryCounts = Object.fromEntries(CHARACTER_CATEGORIES.map((key) => [key, 0]))
  people.forEach((person, index) => {
    const path = `people[${index}]`
    if (!person?.key || peopleKeys.has(person.key)) errors.push(makeError(`${path}.key`, 'ID_INVALID', '人物 key 缺失或重复'))
    peopleKeys.add(person?.key)
    if (!isCharacter) {
      if (!(person?.era in eraCounts)) errors.push(makeError(`${path}.era`, 'ERA_INVALID', '时代分类无效'))
      else eraCounts[person.era] += 1
    }
    const gender = normalizeSubjectGender(person?.gender)
    if (!['female', 'male'].includes(gender)) errors.push(makeError(`${path}.gender`, 'GENDER_INVALID', '人物性别必须为 male/female'))
    else genderCounts[gender] += 1
    if (!isNonEmptyText(person?.name)) errors.push(makeError(`${path}.name`, 'REQUIRED', '人物名不能为空'))
    const sortOrder = Number(person?.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > expectedPeopleCount || sortOrders.has(sortOrder)) {
      errors.push(makeError(`${path}.sortOrder`, 'SORT_ORDER_INVALID', `sortOrder 必须为唯一的 1..${expectedPeopleCount}`))
    }
    sortOrders.add(sortOrder)
    if (typeof person?.enabled !== 'boolean') errors.push(makeError(`${path}.enabled`, 'TYPE_INVALID', 'enabled 必须为布尔值'))
    CELEBRITY_DIMENSIONS.forEach((dimension) => {
      const value = Number(person?.profile?.[dimension])
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(makeError(`${path}.profile.${dimension}`, 'SCORE_INVALID', '人物向量必须在 0..100'))
    })
    if (isCharacter) {
      if (!isNonEmptyText(person?.source)) errors.push(makeError(`${path}.source`, 'REQUIRED', '角色来源作品不能为空'))
      if (!CHARACTER_CATEGORIES.includes(person?.category)) errors.push(makeError(`${path}.category`, 'CATEGORY_INVALID', '角色分类无效'))
      else categoryCounts[person.category] += 1
      if (!Array.isArray(person?.audienceTags) || !person.audienceTags.length) errors.push(makeError(`${path}.audienceTags`, 'REQUIRED', '受众标签不能为空'))
      if (!['heroic', 'gray', 'villain'].includes(person?.alignment)) errors.push(makeError(`${path}.alignment`, 'ALIGNMENT_INVALID', '角色阵营无效'))
      if (!isNonEmptyText(person?.summary) || !isNonEmptyText(person?.attraction) || !isNonEmptyText(person?.caution)) errors.push(makeError(`${path}.copy`, 'COPY_REQUIRED', '角色文案不能为空'))
    }
  })
  if (isCharacter) Object.entries(categoryCounts).forEach(([category, count]) => { if (count !== 12) errors.push(makeError(`people.${category}`, 'CATEGORY_COUNT_INVALID', '每个角色分类必须为 12 人')) })
  else Object.entries(eraCounts).forEach(([era, count]) => { if (count !== 16) errors.push(makeError(`people.${era}`, 'ERA_COUNT_INVALID', '每个时代必须为 16 人')) })
  if (genderCounts.female !== expectedPeopleCount / 2 || genderCounts.male !== expectedPeopleCount / 2) errors.push(makeError('people.gender', 'GENDER_COUNT_INVALID', `人物必须严格男女各 ${expectedPeopleCount / 2} 人`))

  if (options.requireCalibration) {
    const golden = content?.goldenAnswers && typeof content.goldenAnswers === 'object' ? content.goldenAnswers : {}
    for (const person of people) {
      const answers = golden[person.key]
      const path = `goldenAnswers.${person.key}`
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        errors.push(makeError(path, 'GOLDEN_REQUIRED', '每个人物必须有 golden answers'))
        continue
      }
      const answerKeys = Object.keys(answers)
      if (answerKeys.length !== questions.length || questions.some((question) => !answerKeys.includes(question.id))) {
        errors.push(makeError(path, 'GOLDEN_INVALID', 'golden answers 必须完整覆盖 12 道题'))
        continue
      }
      if (answerKeys.some((questionId) => !questionIds.has(questionId) || !['A', 'B', 'C', 'D'].includes(answers[questionId]))) {
        errors.push(makeError(path, 'GOLDEN_INVALID', 'golden answers 含未知题号或选项'))
        continue
      }
      try {
        const result = scoreCrushCelebrity(content, {
          mode: 'self',
          subjectGender: person.gender,
          answers: questions.map((question) => ({ questionId: question.id, optionKey: answers[question.id] }))
        })
        if (result.primaryPersonKey !== person.key) {
          errors.push(makeError(path, 'GOLDEN_NOT_WINNER', 'golden answers 未使该人物成为稳定第一名'))
        }
      } catch (error) {
        errors.push(makeError(path, 'GOLDEN_INVALID', error?.message || 'golden answers 无法评分'))
      }
    }
    const summary = content?.calibrationSummary
    const calibrationPassed = summary?.passed === true &&
      isNonEmptyText(summary?.reportChecksum) &&
      ['female', 'male'].every((gender) => summary?.genders?.[gender]?.passed === true && Number(summary.genders[gender].iterations) >= 200000 && Array.isArray(summary.genders[gender].missingGolden) && summary.genders[gender].missingGolden.length === 0)
    if (!calibrationPassed) {
      errors.push(makeError('calibrationSummary', 'CALIBRATION_REQUIRED', '必须先通过 20 万组校准'))
    }
  }
  return errors
}

function validateArchetypeContent(featureKey, content, options = {}) {
  if (featureKey === FEATURE_RELATION) return validateRelationContent(content)
  if (featureKey === FEATURE_CELEBRITY || featureKey === FEATURE_CHARACTER) return validateCelebrityContent(content, { ...options, featureKey })
  return [makeError('featureKey', 'FEATURE_INVALID', '未知题库功能')]
}

function errorResponse(code, message, extras = {}) {
  return { success: false, code, message, ...extras }
}

function semverValid(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || ''))
}

function buildBankId(featureKey, subjectGenderOrVersion, maybeVersion) {
  const isRelation = featureKey === FEATURE_RELATION
  const subjectGender = isRelation ? normalizeSubjectGender(subjectGenderOrVersion) : 'unknown'
  const version = isRelation ? maybeVersion : (maybeVersion || subjectGenderOrVersion)
  const prefix = isRelation ? `relation_${subjectGender}` : featureKey === FEATURE_CELEBRITY ? 'crush_celebrity' : featureKey === FEATURE_CHARACTER ? 'dimension_character' : ''
  if (isRelation && !['female', 'male'].includes(subjectGender)) return ''
  if (!prefix || !semverValid(version)) return ''
  return `archetype_bank_${prefix}_${String(version).replace(/\./g, '_')}`
}

function getSeed(featureKey, subjectGender) {
  if (featureKey === FEATURE_RELATION) {
    if (normalizeSubjectGender(subjectGender) === 'female') return require('./relation-female-v1.json')
    if (normalizeSubjectGender(subjectGender) === 'male') return require('./relation-male-v1.json')
    return null
  }
  if (featureKey === FEATURE_CELEBRITY) return require('./crush-celebrity-v1.json')
  if (featureKey === FEATURE_CHARACTER) return require('./dimension-character-v1.json')
  return null
}

async function getBankById(dbLike, bankId) {
  return normalizeDoc(await dbLike.collection(COLLECTION).doc(bankId).get().catch(() => null))
}

async function findBank(dbLike, { featureKey, subjectGender, status, contentVersion }) {
  const normalizedGender = featureKey === FEATURE_RELATION ? normalizeSubjectGender(subjectGender) : 'unknown'
  if (featureKey === FEATURE_RELATION && !['female', 'male'].includes(normalizedGender)) return null
  if (contentVersion) {
    const bankId = buildBankId(featureKey, normalizedGender, contentVersion)
    return bankId ? getBankById(dbLike, bankId) : null
  }
  let query = dbLike.collection(COLLECTION).where({ featureKey, ...(featureKey === FEATURE_RELATION ? { subjectGender: normalizedGender } : {}), ...(status ? { status } : {}) })
  if (status === 'published') query = query.orderBy('publishedAt', 'desc')
  else query = query.orderBy('updatedAt', 'desc')
  const result = await query.limit(1).get().catch(() => null)
  return normalizeDoc(result)
}

async function getArchetypeQuestionBankAdmin(db, event = {}) {
  const featureKey = String(event.featureKey || '').trim()
  if (![FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(featureKey)) return errorResponse('FEATURE_INVALID', '未知题库功能')
  const subjectGender = featureKey === FEATURE_RELATION ? normalizeSubjectGender(event.subjectGender) : undefined
  if (featureKey === FEATURE_RELATION && !['female', 'male'].includes(subjectGender)) return errorResponse('GENDER_REQUIRED', '关系题库必须指定被测对象性别')
  const bank = event.bankId
    ? await getBankById(db, String(event.bankId))
    : await findBank(db, { featureKey, subjectGender, status: String(event.status || '').trim(), contentVersion: String(event.contentVersion || '').trim() })
  return bank ? { success: true, bank } : errorResponse('BANK_NOT_FOUND', '题库不存在')
}

async function seedArchetypeQuestionBanks(db, event = {}, adminUserId) {
  const featureKey = String(event.featureKey || '').trim()
  const subjectGender = featureKey === FEATURE_RELATION ? normalizeSubjectGender(event.subjectGender) : undefined
  if (featureKey === FEATURE_RELATION && !['female', 'male'].includes(subjectGender)) return errorResponse('GENDER_REQUIRED', '关系题库必须指定被测对象性别')
  const seed = getSeed(featureKey, subjectGender)
  if (!seed) return errorResponse('FEATURE_INVALID', '未知题库功能')
  const existing = await findBank(db, { featureKey, subjectGender })
  if (existing) return errorResponse('ALREADY_SEEDED', '题库已经初始化', { bank: existing })
  const contentVersion = featureKey === FEATURE_CELEBRITY ? '1.1.0' : '1.0.0'
  const now = new Date()
  const bank = {
    _id: buildBankId(featureKey, subjectGender, contentVersion),
    featureKey,
    ...(featureKey === FEATURE_RELATION ? { subjectGender, displayTitle: subjectGender === 'male' ? '关系男主角' : '关系女主角' } : {}),
    contentVersion,
    status: 'draft',
    revision: 1,
    content: seed,
    checksum: checksumContent(seed),
    createdBy: adminUserId,
    updatedBy: adminUserId,
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTION).add(bank)
  return { success: true, seeded: true, bank }
}

async function createArchetypeQuestionDraft(db, event = {}, adminUserId) {
  const featureKey = String(event.featureKey || '').trim()
  const subjectGender = featureKey === FEATURE_RELATION ? normalizeSubjectGender(event.subjectGender) : undefined
  if (featureKey === FEATURE_RELATION && !['female', 'male'].includes(subjectGender)) return errorResponse('GENDER_REQUIRED', '关系题库必须指定被测对象性别')
  const nextVersion = String(event.nextVersion || '').trim()
  if (!semverValid(nextVersion)) return errorResponse('INVALID_ARGUMENT', 'nextVersion 必须为 semver')
  const bankId = buildBankId(featureKey, subjectGender, nextVersion)
  if (!bankId) return errorResponse('FEATURE_INVALID', '未知题库功能')
  if (await getBankById(db, bankId)) return errorResponse('VERSION_EXISTS', '版本已存在')
  const published = await findBank(db, { featureKey, subjectGender, status: 'published' })
  if (!published) return errorResponse('BANK_NOT_FOUND', '没有可复制的已发布题库')
  const now = new Date()
  const content = JSON.parse(JSON.stringify(published.content))
  if (featureKey === FEATURE_CELEBRITY || featureKey === FEATURE_CHARACTER) {
    delete content.calibrationSummary
    delete content.goldenAnswers
  }
  const bank = {
    _id: bankId,
    featureKey,
    ...(featureKey === FEATURE_RELATION ? { subjectGender, displayTitle: published.displayTitle || (subjectGender === 'male' ? '关系男主角' : '关系女主角') } : {}),
    contentVersion: nextVersion,
    status: 'draft',
    revision: 1,
    content,
    checksum: checksumContent(content),
    createdBy: adminUserId,
    updatedBy: adminUserId,
    createdAt: now,
    updatedAt: now
  }
  await db.collection(COLLECTION).add(bank)
  return { success: true, bank }
}

async function saveArchetypeQuestionDraft(db, event = {}, adminUserId) {
  const bankId = String(event.bankId || '').trim()
  const expectedRevision = Number(event.expectedRevision)
  if (!bankId || !Number.isInteger(expectedRevision) || expectedRevision < 1 || !event.content) {
    return errorResponse('INVALID_ARGUMENT', '缺少 bankId、expectedRevision 或 content')
  }
  try {
    return await db.runTransaction(async (transaction) => {
      const current = await getBankById(transaction, bankId)
      if (!current) return errorResponse('BANK_NOT_FOUND', '题库不存在')
      if (current.status !== 'draft') return errorResponse('INVALID_ARGUMENT', '只能编辑草稿')
      if (Number(current.revision) !== expectedRevision) return errorResponse('REVISION_CONFLICT', '题库已被其他管理员修改')
      if (current.featureKey === FEATURE_RELATION) {
        const currentKeys = (current.content?.archetypes || []).map((item) => item?.key).sort().join('|')
        const nextKeys = (event.content?.archetypes || []).map((item) => item?.key).sort().join('|')
        if (!currentKeys || currentKeys !== nextKeys) return errorResponse('STABLE_KEY_CHANGED', '人物稳定 key 不允许修改')
      } else if ([FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(current.featureKey)) {
        const currentKeys = (current.content?.people || []).map((item) => item?.key).sort().join('|')
        const nextKeys = (event.content?.people || []).map((item) => item?.key).sort().join('|')
        if (!currentKeys || currentKeys !== nextKeys) return errorResponse('STABLE_KEY_CHANGED', '人物稳定 key 不允许修改')
      }
      const checksum = checksumContent(event.content)
      const updatedAt = new Date()
      const revision = expectedRevision + 1
      await transaction.collection(COLLECTION).doc(bankId).update({
        content: event.content,
        checksum,
        revision,
        updatedBy: adminUserId,
        updatedAt
      })
      return { success: true, revision, checksum, updatedAt }
    })
  } catch (error) {
    return errorResponse(error?.code || 'SAVE_FAILED', error?.message || '保存题库失败')
  }
}

async function validateArchetypeQuestionDraft(db, event = {}) {
  const bank = await getBankById(db, String(event.bankId || '').trim())
  if (!bank) return errorResponse('BANK_NOT_FOUND', '题库不存在')
  if (event.expectedRevision !== undefined && Number(event.expectedRevision) !== Number(bank.revision)) {
    return errorResponse('REVISION_CONFLICT', '题库版本已变化')
  }
  const errors = validateArchetypeContent(bank.featureKey, bank.content, { requireCalibration: [FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(bank.featureKey) })
  const checksum = checksumContent(bank.content)
  return { success: true, valid: errors.length === 0, errors, checksum }
}

async function runCelebrityCalibrationDraft(db, event = {}, adminUserId) {
  const bankId = String(event.bankId || '').trim()
  const expectedRevision = Number(event.expectedRevision)
  const bank = await getBankById(db, bankId)
  if (!bank) return errorResponse('BANK_NOT_FOUND', '题库不存在')
  if (![FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(bank.featureKey) || bank.status !== 'draft') return errorResponse('INVALID_ARGUMENT', '只能校准图鉴草稿')
  if (Number(bank.revision) !== expectedRevision) return errorResponse('REVISION_CONFLICT', '题库版本已变化')
  const structuralErrors = validateCelebrityContent(bank.content, { featureKey: bank.featureKey, requireCalibration: false })
  if (structuralErrors.length) return errorResponse('VALIDATION_FAILED', '题库结构校验失败', { errors: structuralErrors })
  const sourceChecksum = checksumContent(bank.content)
  const report = runCelebrityCalibration(bank.content, { iterations: event.iterations, seed: event.seed })
  try {
    return await db.runTransaction(async (transaction) => {
      const current = await getBankById(transaction, bankId)
      if (!current) return errorResponse('BANK_NOT_FOUND', '题库不存在')
      if (![FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(current.featureKey) || current.status !== 'draft') return errorResponse('INVALID_ARGUMENT', '只能校准图鉴草稿')
      if (Number(current.revision) !== expectedRevision || checksumContent(current.content) !== sourceChecksum) {
        return errorResponse('REVISION_CONFLICT', '校准期间题库已被其他管理员修改')
      }
      const content = JSON.parse(JSON.stringify(current.content))
      content.goldenAnswers = report.goldenAnswers
      content.calibrationSummary = {
        passed: report.passed,
        seed: report.seed,
        iterations: report.iterations,
        maxRatio: report.maxRatio,
        topFiveRatio: report.topFiveRatio,
        genders: report.genders,
        missingGolden: Object.values(report.genders).flatMap((item) => item.missingGolden || []),
        reportChecksum: report.reportChecksum
      }
      const revision = expectedRevision + 1
      const checksum = checksumContent(content)
      const updatedAt = new Date()
      await transaction.collection(COLLECTION).doc(bankId).update({ content, revision, checksum, updatedAt, updatedBy: adminUserId })
      return { success: true, passed: report.passed, revision, checksum, summary: content.calibrationSummary, reportChecksum: report.reportChecksum }
    })
  } catch (error) {
    return errorResponse(error?.code || 'SAVE_FAILED', error?.message || '保存校准结果失败')
  }
}

async function publishArchetypeQuestionBank(db, event = {}, adminUserId) {
  const bankId = String(event.bankId || '').trim()
  const expectedRevision = Number(event.expectedRevision)
  const expectedChecksum = String(event.checksum || '').trim()
  if (!bankId || !Number.isInteger(expectedRevision) || !expectedChecksum) return errorResponse('INVALID_ARGUMENT', '发布参数不完整')
  try {
    return await db.runTransaction(async (transaction) => {
      const bank = await getBankById(transaction, bankId)
      if (!bank) return errorResponse('BANK_NOT_FOUND', '题库不存在')
      if (bank.status !== 'draft') return errorResponse('PUBLISH_CONFLICT', '只有草稿可以发布')
      if (bank.featureKey === FEATURE_RELATION && !['female', 'male'].includes(normalizeSubjectGender(bank.subjectGender))) {
        return errorResponse('GENDER_REQUIRED', '关系题库缺少被测对象性别')
      }
      if (Number(bank.revision) !== expectedRevision) return errorResponse('REVISION_CONFLICT', '题库版本已变化')
      const checksum = checksumContent(bank.content)
      if (checksum !== expectedChecksum || checksum !== bank.checksum) return errorResponse('CHECKSUM_MISMATCH', '题库校验值不一致')
      if ([FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(bank.featureKey)) {
        const expectedReportChecksum = String(event.reportChecksum || '').trim()
        const reportChecksum = String(bank.content?.calibrationSummary?.reportChecksum || '').trim()
        if (!expectedReportChecksum || !reportChecksum) return errorResponse('CALIBRATION_REQUIRED', '缺少校准报告校验值')
        if (expectedReportChecksum !== reportChecksum) return errorResponse('CHECKSUM_MISMATCH', '校准报告校验值不一致')
      }
      const errors = validateArchetypeContent(bank.featureKey, bank.content, { requireCalibration: [FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(bank.featureKey) })
      if (errors.length > 0) return errorResponse('VALIDATION_FAILED', '题库校验失败', { errors })
      const publishScope = { featureKey: bank.featureKey, status: 'published', ...(bank.featureKey === FEATURE_RELATION ? { subjectGender: normalizeSubjectGender(bank.subjectGender) } : {}) }
      const publishedResult = await transaction.collection(COLLECTION).where(publishScope).get()
      const published = Array.isArray(publishedResult?.data) ? publishedResult.data : []
      const now = new Date()
      for (const item of published) {
        if (item._id !== bankId) {
          await transaction.collection(COLLECTION).doc(item._id).update({ status: 'archived', updatedAt: now, updatedBy: adminUserId })
        }
      }
      await transaction.collection(COLLECTION).doc(bankId).update({ status: 'published', publishedAt: now, updatedAt: now, updatedBy: adminUserId })
      return { success: true, contentVersion: bank.contentVersion, publishedAt: now }
    })
  } catch (error) {
    return errorResponse(error?.code || 'PUBLISH_FAILED', error?.message || '发布题库失败')
  }
}

module.exports = {
  COLLECTION,
  FEATURE_RELATION,
  FEATURE_CELEBRITY,
  FEATURE_CHARACTER,
  normalizeSubjectGender,
  RELATION_STAGES,
  CELEBRITY_DIMENSIONS,
  CHARACTER_CATEGORIES,
  stableStringify,
  checksumContent,
  validateRelationContent,
  validateCelebrityContent,
  validateArchetypeContent,
  buildBankId,
  findBank,
  getArchetypeQuestionBankAdmin,
  seedArchetypeQuestionBanks,
  createArchetypeQuestionDraft,
  saveArchetypeQuestionDraft,
  validateArchetypeQuestionDraft,
  runCelebrityCalibrationDraft,
  publishArchetypeQuestionBank
}
