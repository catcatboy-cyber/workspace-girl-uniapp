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

function resultSubjectLabel(result) {
  if (result?.mode !== 'target') return '你'
  if (result?.entryMode === 'share_quick') return 'TA（快速测试）'
  return cleanPublicText(result?.caseSnapshot?.name, '当前 Crush', 40)
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
    entryMode: result?.entryMode === 'share_quick' ? 'share_quick' : 'standard',
    subjectLabel: resultSubjectLabel(result),
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

function sharedPreviewSummary(result, primary) {
  const subject = result?.mode === 'target' ? 'TA' : '这位朋友'
  return `${subject}在这次答题中最接近「${primary.name}」风格，完整报告仍由本人私密保管。`
}

function cleanPublicText(value, fallback = '', maxLength = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return (text || fallback).slice(0, maxLength)
}

function sharedTags(result, bankContent, primary) {
  const candidates = []
  if (result?.kind === 'relation_archetype') {
    const stage = (bankContent?.stages || []).find((item) => item?.key === result?.stageKey)
    candidates.push(primary?.label, stage?.label, result?.subjectGender === 'male' ? '关系男主角' : '关系女主角')
  } else {
    const person = (bankContent?.people || []).find((item) => item?.key === result?.primaryPersonKey)
    candidates.push(person?.category, person?.era, person?.source)
  }
  return [...new Set(candidates.map((item) => cleanPublicText(item, '', 24)).filter(Boolean))].slice(0, 3)
}

function displayTitleForSharedResult(result) {
  if (result?.kind === 'relation_archetype') return result?.subjectGender === 'male' ? '关系男主角' : '关系女主角'
  if (result?.kind === 'crush_celebrity') return 'Crush 名人图鉴'
  if (result?.kind === 'dimension_character') return '次元角色图鉴'
  return '心动人设局'
}

function buildSharedReportPreview(result, bankContent, owner, access) {
  const primary = getPrimary(result, bankContent)
  const exact = result?.kind === 'relation_archetype'
    ? result?.similarity
    : result?.similarities?.[result?.primaryPersonKey] ?? result?.topFive?.[0]?.similarity
  const hasFullAccess = access?.accessLevel === 'full'
  const profile = owner?.selfProfile && typeof owner.selfProfile === 'object' ? owner.selfProfile : {}
  const nickname = cleanPublicText(profile.nickname || owner?.nickname, '一位朋友', 24)
  const avatarUrl = cleanPublicText(profile.avatarUrl || profile.avatar || owner?.avatarUrl || owner?.avatar, '', 500)
  return {
    kind: cleanPublicText(result?.kind, '', 40),
    mode: result?.mode === 'target' ? 'target' : 'self',
    subjectGender: result?.subjectGender === 'male' ? 'male' : 'female',
    displayTitle: displayTitleForSharedResult(result),
    sharer: {
      displayName: nickname,
      ...(avatarUrl ? { avatarUrl } : {})
    },
    primary: {
      key: cleanPublicText(primary?.key, '', 80),
      name: cleanPublicText(primary?.name, '人物原型', 40),
      label: cleanPublicText(primary?.label, '', 80),
      ...(primary?.coverUrl ? { coverUrl: cleanPublicText(primary.coverUrl, '', 500) } : {})
    },
    scoreDisplay: hasFullAccess
      ? { type: 'exact', exact: Math.max(0, Math.min(100, Math.round(Number(exact) || 0))) }
      : { type: 'band', band: similarityBand(exact) },
    summary: cleanPublicText(sharedPreviewSummary(result, primary), '', 140),
    tags: sharedTags(result, bankContent, primary),
    createdAt: result?.createdAt || null
  }
}

function decisionForSimilarity(value) {
  const score = Number(value) || 0
  if (score >= 80) return { level: 'clear_match', label: '这个类型命中很明显', text: '相似度不等于合适度。如果你本来就回避这类相处方式，现在适合减速并核对下面的现实信号；如果你喜欢，也要先验证风险点。' }
  if (score >= 60) return { level: 'observe', label: '有明显苗头，边相处边验证', text: '先观察承诺、边界和长期兑现，再决定继续投入还是及时止损。' }
  return { level: 'insufficient', label: '暂时别按这个类型下结论', text: '当前证据与该原型的匹配度有限，不要只凭标签决定去留，优先看对方持续、可验证的现实表现。' }
}

const STAGE_PRESENTATION = {
  pre_relationship: {
    shortLabel: '刚接触',
    title: '刚接触：先看 TA 是否尊重你的节奏',
    summary: '这个阶段不急着谈工资和父母态度，先看 TA 会不会因为回复慢、暂时不确定关系，就开始施压或情绪惩罚。',
    question: '如果我需要慢一点确认关系，你会怎么想？'
  },
  early_dating: {
    shortLabel: '刚交往',
    title: '刚交往：看热情能不能稳定又平衡',
    summary: '重点看 TA 是否稳定安排见面、愿意公开关系，也看高频联系会不会慢慢变成查岗和全天候要求。',
    question: '我们都忙的时候，你觉得多久联系一次最舒服？'
  },
  steady_relationship: {
    shortLabel: '稳定期',
    title: '稳定期：看分歧之后还能不能合作',
    summary: '甜蜜已经不是唯一重点。观察意见不同时，TA 是愿意听完、一起重分工，还是冷处理、翻旧账或替两个人拍板。',
    question: '我们意见不一样时，你希望怎样一起做决定？'
  },
  long_term: {
    shortLabel: '长期/婚姻',
    title: '长期或婚姻：把“为你好”变成可讨论的方案',
    summary: '此时再具体谈家庭边界、金钱、居住安排和家务分工。能落地很重要，但不能由一个人包办全部决定。',
    question: '涉及家庭、金钱和居住安排时，最终怎样共同决定？'
  }
}

function configuredText(value, fallback = '', maxLength = 500) {
  return cleanPublicText(value, fallback, maxLength)
}

function buildStageGuidance(bankContent, archetype) {
  const configured = archetype?.resultPage?.stageAdvice || {}
  const caution = configuredText(archetype?.resultCopy?.caution)
  return (Array.isArray(bankContent?.stages) ? bankContent.stages : []).map((stage) => {
    const defaults = STAGE_PRESENTATION[stage?.key] || {
      shortLabel: configuredText(stage?.label, '当前阶段', 20),
      title: `${configuredText(stage?.label, '当前阶段', 40)}：观察持续、可验证的相处行为`,
      summary: '先核对对方是否尊重边界、稳定兑现承诺，再决定要不要继续投入。',
      question: '遇到分歧时，你希望我们怎样一起做决定？'
    }
    const item = configured?.[stage?.key] || {}
    const summary = configuredText(item.summary, defaults.summary)
    return {
      key: configuredText(stage?.key, '', 40),
      label: configuredText(stage?.label, defaults.shortLabel, 80),
      shortLabel: configuredText(item.shortLabel, defaults.shortLabel, 20),
      title: configuredText(item.title, defaults.title, 120),
      summary: caution && !item.summary ? `${summary} 这类风格还要特别留意：${caution}` : summary,
      question: configuredText(item.question, defaults.question, 160)
    }
  })
}

function buildTrafficSignals(resultPage, context = {}) {
  const configured = resultPage?.trafficSignals || {}
  const rows = [
    {
      level: 'green',
      badge: '可继续',
      title: '绿灯：尊重你的节奏，也愿意用行动回应',
      text: configuredText(context.positive, 'TA 能表达投入，同时保留你的决定权。')
    },
    {
      level: 'yellow',
      badge: '要观察',
      title: '黄灯：说得很明确，但兑现还不稳定',
      text: configuredText(context.communication, '可以沟通，但要继续观察 TA 是否接受你的边界和节奏。')
    },
    {
      level: 'red',
      badge: '要回避',
      title: '红灯：用付出、冷落或施压要求你服从',
      text: configuredText(context.caution, '如果同类行为反复发生，不要只听解释，要优先保护自己的边界。')
    }
  ]
  return rows.map((fallback) => {
    const item = configured?.[fallback.level] || {}
    return {
      level: fallback.level,
      badge: configuredText(item.badge, fallback.badge, 20),
      title: configuredText(item.title, fallback.title, 120),
      text: configuredText(item.text, fallback.text, 500)
    }
  })
}

function buildActionSteps(resultPage, context = {}) {
  const configured = Array.isArray(resultPage?.actionSteps) ? resultPage.actionSteps : []
  const defaults = [
    {
      title: '提出一个小边界',
      text: '例如今晚想独处，观察 TA 是尊重、追问，还是立刻情绪化。'
    },
    {
      title: '讨论一次真实分歧',
      text: configuredText(context.communication, '不要只看甜的时候，看看意见不同时 TA 是否还能听完你的话。')
    },
    {
      title: '对照行为，不对照承诺',
      text: configuredText(context.caution, '连续观察一段时间：TA 说的尊重、投入和共同承担，有没有稳定发生。')
    }
  ]
  return defaults.map((fallback, index) => ({
    title: configuredText(configured[index]?.title, fallback.title, 80),
    text: configuredText(configured[index]?.text, fallback.text, 500)
  }))
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
    entryMode: result?.entryMode === 'share_quick' ? 'share_quick' : 'standard',
    subjectLabel: resultSubjectLabel(result),
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
    const communicationAdvice = '把具体行为和感受说清楚，少用“你总是”这类定性表达，再观察对方是否愿意调整。'
    const resultPage = archetype?.resultPage || {}
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
      stageGuidance: buildStageGuidance(bankContent, archetype),
      trafficSignals: buildTrafficSignals(resultPage, {
        positive: archetype?.resultCopy?.attraction,
        caution: archetype?.resultCopy?.caution,
        communication: communicationAdvice
      }),
      actionSteps: buildActionSteps(resultPage, {
        caution: archetype?.resultCopy?.caution,
        communication: communicationAdvice
      }),
      communicationAdvice,
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
  const primaryPerson = personByKey.get(result.primaryPersonKey) || {}
  const communicationAdvice = rankedDimensions.slice(-1)[0]?.key === 'boundary'
    ? '先把关系边界和彼此期待说清楚，再看对方是否用行动回应。'
    : '围绕最需要观察的具体行为沟通，不替对方找理由，也不只听口头承诺。'
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
    primaryDetail: publicPersonDetail(primaryPerson),
    evidence,
    strengths: rankedDimensions.slice(0, 2).map((item) => item.copy).filter(Boolean),
    watchSignals: rankedDimensions.slice(-2).reverse().map((item) => item.copy).filter(Boolean),
    trafficSignals: buildTrafficSignals(primaryPerson?.resultPage, {
      positive: primaryPerson?.attraction || rankedDimensions[0]?.copy,
      caution: primaryPerson?.caution || rankedDimensions.slice(-1)[0]?.copy,
      communication: communicationAdvice
    }),
    actionSteps: buildActionSteps(primaryPerson?.resultPage, {
      caution: primaryPerson?.caution || rankedDimensions.slice(-1)[0]?.copy,
      communication: communicationAdvice
    }),
    communicationAdvice,
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
  buildSharedReportPreview,
  publicPersonDetail
}
