const assert = require('node:assert/strict')
const path = require('node:path')

const normalized = require(path.join(__dirname, '..', 'cloudfunctions', '_shared', 'normalized-event.js'))
const { replayAssessmentFromEvent } = require(path.join(__dirname, '..', 'cloudfunctions', '_shared', 'event-recalculate.js'))
const { buildSemanticInstruction } = require(path.join(__dirname, '..', 'cloudfunctions', '_shared', 'ai-event.js'))

function payload(event, copy = {}) {
  return {
    schemaVersion: 1,
    event: {
      actor: 'target',
      interaction: 'observed',
      commitmentStatus: 'none',
      commitmentType: 'none',
      evidenceType: 'fact',
      scene: [],
      signals: [],
      strength: 'medium',
      ...event
    },
    copy: {
      title: '测试事件',
      summary: '测试摘要',
      reason: '测试原因',
      answer: '测试回答',
      targetMind: '测试想法',
      nextStep: '测试下一步',
      caution: '测试提醒',
      petLine: '测试小咪文案',
      petMood: 'neutral',
      ...copy
    }
  }
}

function action(actor, interaction, overrides = {}) {
  return {
    actor,
    interaction,
    commitmentStatus: 'none',
    commitmentType: 'none',
    evidenceType: 'fact',
    strength: 'strong',
    ...overrides
  }
}

function payloadV2(actions, event = {}, copy = {}) {
  const result = payload(event, copy)
  result.schemaVersion = 2
  result.event.actions = actions
  return result
}

function normalizeEvent(event) {
  const result = normalized.normalizeNormalizedEventV1(payload(event), { description: '测试事件' })
  assert.equal(result.ok, true, result.error)
  return result.value
}

function run() {
  const semanticInstruction = buildSemanticInstruction('unspecified')
  assert.ok(semanticInstruction.includes('\u6211\u8bf7\u4ed6\u5403\u996d\uff0c\u4ed6\u62d2\u7edd\u4e86\u6211'))
  assert.ok(semanticInstruction.includes('actions=[self initiated,target rejected]'))
  assert.ok(semanticInstruction.includes('actions=[target initiated,self rejected]'))
  const chatSemanticInstruction = buildSemanticInstruction('both')
  assert.ok(chatSemanticInstruction.includes('微信对话记录的文字转写'))
  assert.ok(chatSemanticInstruction.includes('绝不能仅按 HH:mm 重排消息'))
  assert.ok(chatSemanticInstruction.includes('[无法辨认] 不构成任何动作'))
  assert.ok(semanticInstruction.includes('intentScore is based only on target actions'))
  assert.ok(semanticInstruction.includes('\u62d2\u7edd\u4e00\u4e2a\u65b0\u9080\u7ea6\u4e0d\u662f broken'))
  assert.ok(semanticInstruction.includes('copy \u662f\u5426\u540c\u65f6\u51c6\u786e\u63cf\u8ff0\u53cc\u65b9\u52a8\u4f5c'))

  const targetInvitesSelfRejects = normalized.normalizeNormalizedEventV1(payloadV2([
    action('target', 'initiated'),
    action('self', 'rejected')
  ], {
    actor: 'self', interaction: 'rejected', evidenceType: 'fact', strength: 'strong', signals: ['initiative']
  }))
  assert.equal(targetInvitesSelfRejects.ok, true, targetInvitesSelfRejects.error)
  assert.equal(targetInvitesSelfRejects.value.event.actor, 'target')
  assert.equal(targetInvitesSelfRejects.value.event.interaction, 'initiated')
  assert.equal(normalized.deriveSubjectRoleFromEvent(targetInvitesSelfRejects.value.event), 'both')
  assert.deepEqual(
    Object.values(normalized.calculateEventScore(targetInvitesSelfRejects.value.event)).slice(0, 3),
    [8, -3, 2]
  )
  const targetInviteTags = normalized.projectSemanticTagsFromNormalizedEvent(targetInvitesSelfRejects.value.event)
  assert.equal(targetInviteTags.initiator, 'target')
  assert.equal(targetInviteTags.response, 'rejected')
  assert.equal(targetInviteTags.responseActor, 'self')
  assert.equal(targetInviteTags.risk.includes('rejected'), false)

  const selfInvitesTargetRejects = normalized.normalizeNormalizedEventV1(payloadV2([
    action('self', 'initiated'),
    action('target', 'rejected')
  ], {
    actor: 'self', interaction: 'initiated', evidenceType: 'fact', strength: 'strong'
  }))
  assert.equal(selfInvitesTargetRejects.ok, true, selfInvitesTargetRejects.error)
  assert.equal(selfInvitesTargetRejects.value.event.actor, 'target')
  assert.equal(selfInvitesTargetRejects.value.event.interaction, 'rejected')
  assert.equal(normalized.deriveSubjectRoleFromEvent(selfInvitesTargetRejects.value.event), 'both')
  assert.deepEqual(
    Object.values(normalized.calculateEventScore(selfInvitesTargetRejects.value.event)).slice(0, 3),
    [-11, 14, 2]
  )
  const targetRejectTags = normalized.projectSemanticTagsFromNormalizedEvent(selfInvitesTargetRejects.value.event)
  assert.equal(targetRejectTags.initiator, 'self')
  assert.equal(targetRejectTags.response, 'rejected')
  assert.equal(targetRejectTags.responseActor, 'target')
  assert.equal(targetRejectTags.risk.includes('rejected'), true)

  const missingActions = normalized.normalizeNormalizedEventV1({ ...payload({}), schemaVersion: 2 })
  assert.equal(missingActions.ok, false)
  assert.equal(missingActions.error, 'NORMALIZED_EVENT_ACTIONS_REQUIRED')

  const tooManyActions = normalized.normalizeNormalizedEventV1(payloadV2([
    action('target', 'initiated'),
    action('self', 'responded'),
    action('target', 'responded'),
    action('self', 'responded'),
    action('target', 'fulfilled')
  ]))
  assert.equal(tooManyActions.ok, false)
  assert.equal(tooManyActions.error, 'NORMALIZED_EVENT_ACTIONS_TOO_MANY')

  const actionWithScore = normalized.normalizeNormalizedEventV1(payloadV2([
    action('target', 'initiated', { intentDelta: 20 })
  ]))
  assert.equal(actionWithScore.ok, false)
  assert.equal(actionWithScore.error, 'NORMALIZED_EVENT_ACTION_FORBIDDEN_FIELD')

  const meal = normalizeEvent({
    actor: 'target',
    interaction: 'promised',
    commitmentStatus: 'promised',
    commitmentType: 'meal_invitation',
    evidenceType: 'fact',
    scene: ['meal'],
    signals: ['initiative'],
    strength: 'medium'
  })
  const mealAnalysis = normalized.buildAnalysisFromNormalizedEvent(meal)
  assert.deepEqual(
    [mealAnalysis.intentDelta, mealAnalysis.riskDelta, mealAnalysis.evidenceDelta],
    [7, -2, 1]
  )
  assert.equal(mealAnalysis.eventType, 'positive')
  assert.equal(mealAnalysis.semanticTags.commitment.type, 'meal_invitation')
  assert.ok(mealAnalysis.semanticTags.behavior.includes('target_initiated'))

  const rejected = normalizeEvent({
    actor: 'target', interaction: 'rejected', commitmentStatus: 'none', commitmentType: 'none',
    evidenceType: 'fact', strength: 'strong'
  })
  const rejectedScore = normalized.calculateEventScore(rejected.event)
  assert.deepEqual([rejectedScore.intentDelta, rejectedScore.riskDelta, rejectedScore.evidenceDelta], [-11, 14, 2])
  assert.equal(normalized.deriveEventType(rejected.event, rejectedScore), 'risk')

  const both = normalizeEvent({
    actor: 'both', interaction: 'responded', commitmentStatus: 'promised', commitmentType: 'meet_invitation',
    evidenceType: 'fact', strength: 'medium'
  })
  const bothScore = normalized.calculateEventScore(both.event)
  assert.deepEqual([bothScore.intentDelta, bothScore.riskDelta, bothScore.evidenceDelta], [5, -1, 1])

  const selfFeeling = normalizeEvent({
    actor: 'self', interaction: 'observed', commitmentStatus: 'none', commitmentType: 'none',
    evidenceType: 'feeling', strength: 'strong'
  })
  const selfScore = normalized.calculateEventScore(selfFeeling.event)
  assert.deepEqual([selfScore.intentDelta, selfScore.riskDelta, selfScore.evidenceDelta], [0, 0, 0])
  assert.equal(normalized.deriveEventType(selfFeeling.event, selfScore), 'note')

  const invalid = normalized.normalizeNormalizedEventV1(payload({
    actor: 'target', interaction: 'fulfilled', commitmentStatus: 'broken', commitmentType: 'other'
  }))
  assert.equal(invalid.ok, true)
  assert.equal(invalid.value.event.interaction, 'delayed')
  assert.ok(invalid.warnings.includes('SEMANTIC_COMBINATION_REPAIRED'))

  const repairedInvitationPromise = normalized.normalizeNormalizedEventV1(payload({
    actor: 'target', interaction: 'initiated', commitmentStatus: 'promised', commitmentType: 'meal_invitation'
  }))
  assert.equal(repairedInvitationPromise.ok, true)
  assert.equal(repairedInvitationPromise.value.event.interaction, 'promised')
  assert.ok(repairedInvitationPromise.warnings.includes('SEMANTIC_COMBINATION_REPAIRED'))

  const sceneIsNotCommitment = normalizeEvent({
    actor: 'target', interaction: 'observed', commitmentStatus: 'none', commitmentType: 'none', scene: ['meal']
  })
  const sceneTags = normalized.projectSemanticTagsFromNormalizedEvent(sceneIsNotCommitment.event)
  assert.deepEqual(sceneTags.scene, ['meal'])
  assert.equal(sceneTags.commitment.exists, false)
  assert.equal(sceneTags.commitment.type, 'none')

  const forbiddenScore = normalized.normalizeNormalizedEventV1({ ...payload({}), intentDelta: 10 })
  assert.equal(forbiddenScore.ok, false)
  assert.equal(forbiddenScore.error, 'NORMALIZED_EVENT_FORBIDDEN_FIELD')

  let combinations = 0
  for (const actor of normalized.ACTORS) {
    for (const interaction of normalized.INTERACTIONS) {
      for (const commitmentStatus of normalized.COMMITMENT_STATUSES) {
        for (const evidenceType of normalized.EVIDENCE_TYPES) {
          for (const strength of normalized.STRENGTHS) {
            combinations++
            const commitmentType = ['promised', 'fulfilled', 'broken'].includes(commitmentStatus) ? 'other' : 'none'
            const result = normalized.normalizeNormalizedEventV1(payload({
              actor, interaction, commitmentStatus, commitmentType, evidenceType, strength
            }))
            assert.equal(result.ok, true, result.error)
            const score = normalized.calculateEventScore(result.value.event)
            for (const value of [score.intentDelta, score.riskDelta, score.evidenceDelta]) {
              assert.equal(Number.isFinite(value), true)
              assert.equal(Number.isInteger(value), true)
            }
            assert.ok(score.intentDelta >= -20 && score.intentDelta <= 20)
            assert.ok(score.riskDelta >= -20 && score.riskDelta <= 20)
            assert.ok(score.evidenceDelta >= 0 && score.evidenceDelta <= 2)
            if (actor === 'self' || actor === 'unknown' || evidenceType === 'feeling' || evidenceType === 'unclear') {
              assert.deepEqual([score.intentDelta, score.riskDelta, score.evidenceDelta], [0, 0, 0])
            }
          }
        }
      }
    }
  }
  assert.equal(combinations, 1920)

  const fallback = normalized.buildFallbackAnalysis('这事感觉怪怪的', 'AI_RESPONSE_EMPTY')
  assert.equal(fallback.eventType, 'note')
  assert.equal(fallback.eventInsight.actor, 'unknown')
  assert.deepEqual([fallback.intentDelta, fallback.riskDelta, fallback.evidenceDelta], [0, 0, 0])
  assert.equal(fallback.analysisSnapshot.policyVersion, 2)
  assert.equal(fallback.validationError, 'AI_RESPONSE_EMPTY')
  assert.equal(normalized.replayAnalysisSnapshot(fallback.analysisSnapshot).ok, true)
  assert.equal(normalized.replayAnalysisSnapshot(null).error, 'LEGACY_EVENT_SEMANTICS_MISSING')

  const replayedAssessment = replayAssessmentFromEvent({
    previous: {
      intentScore: 50,
      consistencyRiskScore: 50,
      evidenceLevel: 'E1',
      signalSummary: {}
    },
    event: {
      id: 'event_replay',
      title: mealAnalysis.eventTitle,
      description: '他答应请我吃饭',
      type: mealAnalysis.eventType,
      semanticTags: mealAnalysis.semanticTags,
      analysisSnapshot: mealAnalysis.analysisSnapshot,
      aiUsed: true
    },
    assessmentId: 'assessment_replay'
  })
  assert.equal(replayedAssessment.intentScore, 57)
  assert.equal(replayedAssessment.consistencyRiskScore, 48)
  assert.equal(replayedAssessment.triggerEventType, 'positive')
  assert.deepEqual(replayedAssessment.analysisSnapshot, mealAnalysis.analysisSnapshot)

  const legacyReplay = replayAssessmentFromEvent({
    previous: { intentScore: 50, consistencyRiskScore: 50, evidenceLevel: 'E1', signalSummary: {} },
    event: { id: 'legacy_event', title: '旧事件', description: '旧事件' },
    assessmentId: 'legacy_assessment'
  })
  assert.deepEqual([legacyReplay.intentScore, legacyReplay.consistencyRiskScore], [50, 50])
  assert.equal(legacyReplay.triggerEventType, 'note')
  assert.equal(legacyReplay.validationError, 'LEGACY_EVENT_SEMANTICS_MISSING')

  console.log(`PASS NormalizedEventV1/V2 scoring and projection (${combinations} V1 combinations + 2 V2 exchanges)`)
}

run()
