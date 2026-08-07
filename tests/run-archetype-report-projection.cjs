'use strict'

const assert = require('assert')
const { projectQuestionBankForClient, buildPreviewReport, buildFullReport } = require('../cloudfunctions/_shared/archetype-report-projection')

function hasKeyDeep(value, forbidden) {
  if (!value || typeof value !== 'object') return false
  if (Object.keys(value).some((key) => forbidden.has(key))) return true
  return Object.values(value).some((item) => hasKeyDeep(item, forbidden))
}

const relation = require('../cloudfunctions/_shared/relation-female-v1.json')
const celebrity = require('../cloudfunctions/_shared/crush-celebrity-v1.json')
const relationProjection = projectQuestionBankForClient({ featureKey: '关系女主角', subjectGender: 'female', contentVersion: '1.0.0', checksum: 'x', content: relation })
const celebrityProjection = projectQuestionBankForClient({ featureKey: 'Crush名人图鉴', contentVersion: '1.1.0', checksum: 'x', content: celebrity })

assert.equal(hasKeyDeep(relationProjection, new Set(['dimensionKey', 'reverse', 'typicalOptionKey', 'weight', 'highText', 'lowText'])), false)
assert.equal(hasKeyDeep(celebrityProjection, new Set(['scores', 'profile', 'calibrationSummary', 'goldenAnswers'])), false)
assert.ok(relationProjection.content.screener[0].options[0].voteFor, '筛选题仍需保留客户端路由所需 voteFor')

const result = {
  _id: 'r1', userId: 'u1', kind: 'crush_celebrity', mode: 'target', subjectGender: 'female',
  entryMode: 'share_quick', sourceResultShareId: 'hps_source_secret', sourceResultId: 'source-secret',
  primaryPersonKey: celebrity.people.find((item) => item.gender === 'female').key,
  similarities: {}, topFive: [], dimensions: { initiative: 50, warmth: 60, reliability: 70, romance: 40, boundary: 80 },
  answeredCount: 10, observationConfidence: 'medium', contentVersion: '1.1.0'
}
result.similarities[result.primaryPersonKey] = 78
result.topFive = [{ personKey: result.primaryPersonKey, name: '测试人物', similarity: 78 }]
const access = { canPurchase: true, payment: { priceFen: 199, sandboxProductId: '0001' } }
const preview = buildPreviewReport(result, celebrity, access)
assert.equal(preview.accessLevel, 'preview')
assert.equal(preview.subjectLabel, 'TA（快速测试）')
assert.equal(preview.similarityBand.label, '约 75%-79%')
assert.equal(Object.prototype.hasOwnProperty.call(preview, 'exactSimilarity'), false)
assert.equal(Object.prototype.hasOwnProperty.call(preview, 'sourceResultShareId'), false)
assert.equal(Object.prototype.hasOwnProperty.call(preview, 'sourceResultId'), false)
assert.equal(hasKeyDeep(preview, new Set(['similarities', 'topFive', 'dimensions', 'answers', 'profile', 'stageGuidance', 'trafficSignals', 'actionSteps'])), false)

const full = buildFullReport(result, celebrity, { permanentResultUnlock: true })
assert.equal(full.accessLevel, 'full')
assert.equal(full.subjectLabel, 'TA（快速测试）')
assert.equal(full.exactSimilarity, 78)
assert.equal(Object.prototype.hasOwnProperty.call(full, 'sourceResultShareId'), false)
assert.equal(Object.prototype.hasOwnProperty.call(full, 'sourceResultId'), false)
assert.ok(Array.isArray(full.dimensions) && full.dimensions.length === 5)
assert.ok(Array.isArray(full.trafficSignals) && full.trafficSignals.length === 3)
assert.deepEqual(full.trafficSignals.map((item) => item.level), ['green', 'yellow', 'red'])
assert.ok(Array.isArray(full.actionSteps) && full.actionSteps.length === 3)
assert.equal(hasKeyDeep(full, new Set(['profile', 'calibration', 'goldenAnswers'])), false)
assert.equal(Object.prototype.hasOwnProperty.call(full.primaryDetail || {}, 'profile'), false)

const relationPerson = relation.archetypes[0]
const relationResult = {
  _id: 'relation-r1',
  userId: 'u1',
  kind: 'relation_archetype',
  mode: 'target',
  subjectGender: 'female',
  personKey: relationPerson.key,
  similarity: 82,
  stageKey: 'early_dating',
  dimensionScores: Object.fromEntries(relationPerson.dimensions.map((item, index) => [item.key, 58 + index * 12])),
  answers: relationPerson.universalQuestions.slice(0, 3).map((item, index) => ({ questionId: item.id, value: 5 - index })),
  answeredCount: 15,
  observationConfidence: 'high',
  contentVersion: '1.0.0'
}
const relationFull = buildFullReport(relationResult, relation, { permanentResultUnlock: true })
assert.equal(relationFull.exactSimilarity, 82)
assert.ok(Array.isArray(relationFull.stageGuidance) && relationFull.stageGuidance.length === relation.stages.length)
assert.ok(relationFull.stageGuidance.every((item) => item.key && item.title && item.summary && item.question))
assert.ok(Array.isArray(relationFull.trafficSignals) && relationFull.trafficSignals.length === 3)
assert.ok(Array.isArray(relationFull.actionSteps) && relationFull.actionSteps.length === 3)

const configuredRelation = JSON.parse(JSON.stringify(relation))
configuredRelation.archetypes[0].resultPage = {
  stageAdvice: { early_dating: { title: '后台阶段标题', summary: '后台阶段建议', question: '后台阶段问题？' } },
  trafficSignals: { green: { title: '后台绿灯标题', text: '后台绿灯说明' } },
  actionSteps: [{ title: '后台第一步', text: '后台第一步说明' }]
}
const configuredFull = buildFullReport(relationResult, configuredRelation, { permanentResultUnlock: true })
assert.equal(configuredFull.stageGuidance.find((item) => item.key === 'early_dating').title, '后台阶段标题')
assert.equal(configuredFull.trafficSignals[0].title, '后台绿灯标题')
assert.equal(configuredFull.actionSteps[0].title, '后台第一步')

console.log('archetype report projection tests passed')
