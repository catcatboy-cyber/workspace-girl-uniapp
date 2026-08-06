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
  primaryPersonKey: celebrity.people.find((item) => item.gender === 'female').key,
  similarities: {}, topFive: [], dimensions: { initiative: 50, warmth: 60, reliability: 70, romance: 40, boundary: 80 },
  answeredCount: 10, observationConfidence: 'medium', contentVersion: '1.1.0'
}
result.similarities[result.primaryPersonKey] = 78
result.topFive = [{ personKey: result.primaryPersonKey, name: '测试人物', similarity: 78 }]
const access = { canPurchase: true, payment: { priceFen: 199, sandboxProductId: '0001' } }
const preview = buildPreviewReport(result, celebrity, access)
assert.equal(preview.accessLevel, 'preview')
assert.equal(preview.similarityBand.label, '约 75%-79%')
assert.equal(Object.prototype.hasOwnProperty.call(preview, 'exactSimilarity'), false)
assert.equal(hasKeyDeep(preview, new Set(['similarities', 'topFive', 'dimensions', 'answers', 'profile'])), false)

const full = buildFullReport(result, celebrity, { permanentResultUnlock: true })
assert.equal(full.accessLevel, 'full')
assert.equal(full.exactSimilarity, 78)
assert.ok(Array.isArray(full.dimensions) && full.dimensions.length === 5)
assert.equal(hasKeyDeep(full, new Set(['profile', 'calibration', 'goldenAnswers'])), false)
assert.equal(Object.prototype.hasOwnProperty.call(full.primaryDetail || {}, 'profile'), false)

console.log('archetype report projection tests passed')
