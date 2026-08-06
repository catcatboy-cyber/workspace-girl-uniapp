'use strict'

function textOption(option) {
  return {
    key: String(option?.key || ''),
    ...(option?.text !== undefined ? { text: String(option.text || '') } : {}),
    ...(option?.textSelf !== undefined ? { textSelf: String(option.textSelf || '') } : {}),
    ...(option?.textTarget !== undefined ? { textTarget: String(option.textTarget || '') } : {})
  }
}

function displayQuestion(question, options = {}) {
  return {
    id: String(question?.id || ''),
    textSelf: String(question?.textSelf || ''),
    textTarget: String(question?.textTarget || ''),
    ...(Array.isArray(question?.options)
      ? {
          options: question.options.map((item) => ({
            ...textOption(item),
            ...(options.includeVoteFor ? { voteFor: String(item?.voteFor || '') } : {})
          }))
        }
      : {})
  }
}

function projectRelationContent(content) {
  return {
    stages: (Array.isArray(content?.stages) ? content.stages : []).map((item) => ({ key: item.key, label: item.label })),
    screener: (Array.isArray(content?.screener) ? content.screener : []).map((item) => displayQuestion(item, { includeVoteFor: true })),
    archetypes: (Array.isArray(content?.archetypes) ? content.archetypes : []).map((person) => ({
      key: person.key,
      name: person.name,
      label: person.label || '',
      enabled: person.enabled !== false,
      universalQuestions: (Array.isArray(person?.universalQuestions) ? person.universalQuestions : []).map(displayQuestion),
      stageQuestions: Object.fromEntries(Object.entries(person?.stageQuestions || {}).map(([key, questions]) => [
        key,
        (Array.isArray(questions) ? questions : []).map(displayQuestion)
      ])),
      scenarios: Object.fromEntries(Object.entries(person?.scenarios || {}).map(([key, scenarios]) => [
        key,
        (Array.isArray(scenarios) ? scenarios : []).map((item) => ({
          id: item.id,
          textSelf: item.textSelf || '',
          textTarget: item.textTarget || '',
          options: (Array.isArray(item?.options) ? item.options : []).map(textOption)
        }))
      ]))
    }))
  }
}

function projectPortraitContent(content) {
  return {
    dimensions: (Array.isArray(content?.dimensions) ? content.dimensions : []).map((item) => ({ key: item.key, name: item.name })),
    questions: (Array.isArray(content?.questions) ? content.questions : []).map(displayQuestion),
    people: (Array.isArray(content?.people) ? content.people : []).map((person) => ({
      key: person.key,
      name: person.name,
      enabled: person.enabled !== false,
      sortOrder: person.sortOrder,
      gender: person.gender,
      coverUrl: person.coverUrl || '',
      ...(person.era ? { era: person.era } : {}),
      ...(person.source ? { source: person.source } : {}),
      ...(person.category ? { category: person.category } : {}),
      ...(person.summary ? { summary: person.summary } : {})
    }))
  }
}

function projectQuestionBankForClient(bank) {
  const content = bank?.featureKey === '关系女主角'
    ? projectRelationContent(bank?.content)
    : projectPortraitContent(bank?.content)
  return {
    featureKey: bank?.featureKey,
    ...(bank?.subjectGender ? { subjectGender: bank.subjectGender } : {}),
    ...(bank?.displayTitle ? { displayTitle: bank.displayTitle } : {}),
    contentVersion: bank?.contentVersion,
    checksum: bank?.checksum,
    content,
    publishedAt: bank?.publishedAt || null
  }
}

function similarityBand(value) {
  const exact = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const min = Math.floor(exact / 5) * 5
  const max = Math.min(100, min + 4)
  return { min, max, label: `约 ${min}%-${max}%` }
}

function getPrimary(result, bankContent) {
  if (result?.kind === 'relation_archetype') {
    const person = (bankContent?.archetypes || []).find((item) => item?.key === result.personKey) || result.personSnapshot || {}
    return { key: result.personKey || person.key || '', name: person.name || '关系主角', label: person.label || result.personSnapshot?.label || '' }
  }
  const person = (bankContent?.people || []).find((item) => item?.key === result.primaryPersonKey) || {}
  return {
    key: result.primaryPersonKey || '',
    name: person.name || result.topFive?.[0]?.name || '人物原型',
    label: person.summary || person.era || person.source || '',
    ...(person.coverUrl ? { coverUrl: person.coverUrl } : {})
  }
}

function publicPersonDetail(person) {
  if (!person || typeof person !== 'object') return null
  return {
    key: String(person.key || ''),
    name: String(person.name || ''),
    label: String(person.label || ''),
    enabled: person.enabled !== false,
    ...(person.gender ? { gender: String(person.gender) } : {}),
    ...(person.coverUrl ? { coverUrl: String(person.coverUrl) } : {}),
    ...(person.era ? { era: String(person.era) } : {}),
    ...(person.source ? { source: String(person.source) } : {}),
    ...(person.category ? { category: String(person.category) } : {}),
    ...(person.summary ? { summary: String(person.summary) } : {}),
    ...(person.attraction ? { attraction: String(person.attraction) } : {}),
    ...(person.caution ? { caution: String(person.caution) } : {})
  }
}

function buildHistoryPreview(result, bankContent, accessLevel = 'preview') {
  const exact = result?.kind === 'relation_archetype'
    ? result.similarity
    : result?.similarities?.[result.primaryPersonKey] ?? result?.topFive?.[0]?.similarity
  return {
    resultId: result?._id || '',
    kind: result?.kind || '',
    mode: result?.mode || '',
    subjectGender: result?.subjectGender || '',
    caseSnapshot: result?.caseSnapshot || null,
    primary: getPrimary(result, bankContent),
    similarityBand: similarityBand(exact),
    accessLevel,
    createdAt: result?.createdAt || null
  }
}

function observation(result) {
  const total = result?.kind === 'relation_archetype' ? 15 : 12
  return {
    answeredCount: Number(result?.answeredCount || 0),
    total,
    confidence: result?.observationConfidence || 'low'
  }
}

function previewSummary(result, primary) {
  const subject = result?.mode === 'target' ? 'TA' : '你'
  return `${subject}在当前答题中最接近「${primary.name}」风格，完整报告会进一步拆解具体信号。`
}

function decisionForSimilarity(value) {
  const score = Number(value) || 0
  if (score >= 80) return { level: 'clear_match', label: '这个类型命中很明显', text: '相似度不等于合适度。如果你本来就回避这类相处方式，现在适合减速并核对下面的现实信号；如果你喜欢，也要先验证风险点。' }
  if (score >= 60) return { level: 'observe', label: '有明显苗头，边相处边验证', text: '先观察承诺、边界和长期兑现，再决定继续投入还是及时止损。' }
  return { level: 'insufficient', label: '暂时别按这个类型下结论', text: '当前证据与该原型的匹配度有限，不要只凭标签决定去留，优先看对方持续、可验证的现实表现。' }
}

function buildPreviewReport(result, bankContent, access) {
  const base = buildHistoryPreview(result, bankContent, 'preview')
  return {
    ...base,
    summary: previewSummary(result, base.primary),
    observation: observation(result),
    unlockOptions: {
      canPurchase: access?.canPurchase === true,
      priceFen: access?.payment?.priceFen === 199 ? 199 : null,
      canUpgradePro: true,
      productId: access?.payment?.sandboxProductId || ''
    }
  }
}

function buildFullReport(result, bankContent, access) {
  const primary = getPrimary(result, bankContent)
  const base = {
    resultId: result?._id || '',
    kind: result?.kind || '',
    mode: result?.mode || '',
    subjectGender: result?.subjectGender || '',
    caseId: result?.caseId || '',
    caseSnapshot: result?.caseSnapshot || null,
    contentVersion: result?.contentVersion || '',
    accessLevel: 'full',
    accessSource: access?.permanentResultUnlock ? 'purchase' : 'subscription',
    primary,
    observation: observation(result),
    createdAt: result?.createdAt || null
  }
  if (result?.kind === 'relation_archetype') {
    const archetype = (bankContent?.archetypes || []).find((item) => item?.key === result.personKey) || {}
    const questions = [
      ...(archetype?.universalQuestions || []),
      ...(archetype?.stageQuestions?.[result.stageKey] || [])
    ]
    const answerById = new Map((result?.answers || []).map((item) => [item.questionId, item]))
    const evidence = questions
      .map((question) => ({ questionId: question.id, text: result.mode === 'target' ? question.textTarget : question.textSelf, value: answerById.get(question.id)?.value }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
    return {
      ...base,
      exactSimilarity: result.similarity,
      stageKey: result.stageKey,
      dimensions: (archetype?.dimensions || []).map((dimension) => ({
        key: dimension.key,
        name: dimension.name,
        score: result?.dimensionScores?.[dimension.key],
        copy: Number(result?.dimensionScores?.[dimension.key]) >= 60 ? dimension.highText : dimension.lowText
      })),
      resultCopy: archetype?.resultCopy || {},
      scenarioVerification: result?.scenarioVerification || '',
      evidence,
      strengths: archetype?.resultCopy?.attraction ? [archetype.resultCopy.attraction] : [],
      watchSignals: archetype?.resultCopy?.caution ? [archetype.resultCopy.caution] : [],
      communicationAdvice: '把具体行为和感受说清楚，少用“你总是”这类定性表达，再观察对方是否愿意调整。',
      decision: decisionForSimilarity(result.similarity)
    }
  }

  const people = bankContent?.people || []
  const dimensions = bankContent?.dimensions || []
  const personByKey = new Map(people.map((item) => [item.key, item]))
  const dimensionRows = dimensions.map((dimension) => ({
    key: dimension.key,
    name: dimension.name,
    score: result?.dimensions?.[dimension.key],
    copy: Number(result?.dimensions?.[dimension.key]) >= 60
      ? bankContent?.resultCopy?.[dimension.key]?.high || ''
      : bankContent?.resultCopy?.[dimension.key]?.low || ''
  }))
  const rankedDimensions = [...dimensionRows].sort((left, right) => Number(right.score) - Number(left.score))
  const questionById = new Map((bankContent?.questions || []).map((item) => [item.id, item]))
  const evidence = (result?.answers || []).filter((item) => item.optionKey !== 'U').slice(0, 3).map((answer) => {
    const question = questionById.get(answer.questionId) || {}
    const option = (question.options || []).find((item) => item.key === answer.optionKey) || {}
    return {
      questionId: answer.questionId,
      text: result.mode === 'target' ? question.textTarget : question.textSelf,
      answer: result.mode === 'target' ? option.textTarget : option.textSelf
    }
  })
  const exactSimilarity = result?.similarities?.[result.primaryPersonKey] ?? result?.topFive?.[0]?.similarity ?? 0
  return {
    ...base,
    exactSimilarity,
    secondary: result?.secondaryPersonKey ? getPrimary({ ...result, primaryPersonKey: result.secondaryPersonKey }, bankContent) : null,
    topFive: (result?.topFive || []).map((item) => ({
      personKey: String(item?.personKey || ''),
      name: String(item?.name || personByKey.get(item?.personKey)?.name || ''),
      similarity: Number(item?.similarity || 0),
      ...(personByKey.get(item?.personKey)?.coverUrl ? { coverUrl: personByKey.get(item.personKey).coverUrl } : {})
    })),
    dimensions: dimensionRows,
    resultCopy: bankContent?.resultCopy || {},
    primaryDetail: publicPersonDetail(personByKey.get(result.primaryPersonKey)),
    evidence,
    strengths: rankedDimensions.slice(0, 2).map((item) => item.copy).filter(Boolean),
    watchSignals: rankedDimensions.slice(-2).reverse().map((item) => item.copy).filter(Boolean),
    communicationAdvice: rankedDimensions.slice(-1)[0]?.key === 'boundary'
      ? '先把关系边界和彼此期待说清楚，再看对方是否用行动回应。'
      : '围绕最需要观察的具体行为沟通，不替对方找理由，也不只听口头承诺。',
    decision: decisionForSimilarity(exactSimilarity)
  }
}

module.exports = {
  projectQuestionBankForClient,
  similarityBand,
  getPrimary,
  buildHistoryPreview,
  buildPreviewReport,
  buildFullReport,
  publicPersonDetail
}
