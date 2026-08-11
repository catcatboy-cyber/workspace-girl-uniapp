const assert = require('node:assert/strict')
const path = require('path')

const {
  createFakeCloudbase,
  installCloudbaseMock,
  setCurrentFakeCloudbase,
  clearCloudFunctionCache
} = require('./support/fake-cloudbase.cjs')

const projectRoot = path.resolve(__dirname, '..')

installCloudbaseMock()

const sampleAnswers = [
  { questionId: 'Q5', value: 'mostly_me' },
  { questionId: 'Q7', value: 'engaged' },
  { questionId: 'Q9', value: 'sometimes' },
  { questionId: 'Q11', value: 'mostly_me' },
  { questionId: 'Q13', value: 'sometimes_critical' },
  { questionId: 'Q14', value: 'sometimes_not_followed_through' },
  { questionId: 'Q15', value: 'vague' },
  { questionId: 'Q16', value: 'partially_can' },
  { questionId: 'Q17', value: 'noticeable' },
  { questionId: 'Q20', value: 'half_half' },
  { questionId: 'Q21', value: 'two_or_three' },
  { questionId: 'Q22', value: 'one_to_two_weeks' }
]

function loadFunction(name) {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions', name, 'index.js')).main
}

function asUser(fake, userId) {
  fake.__setAuthUser(userId)
}

async function runCase(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

async function main() {
  await runCase('normalized event protocol trusts model enums without keyword correction', async () => {
    const aiEvent = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'ai-event.js'))
    const { buildSubjectPrompt } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'subject-role-prompt.js'))
    const { projectSemanticTagsFromNormalizedEvent } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'normalized-event.js'))

    const unknown = aiEvent.normalizeEventInsight({ actor: 'unknown', interaction: 'unclear', commitmentStatus: 'none', evidenceType: 'unclear' })
    assert.deepEqual(unknown, { actor: 'unknown', interaction: 'unclear', commitmentStatus: 'none', evidenceType: 'unclear' })
    const valid = aiEvent.normalizeEventInsight({ actor: 'target', interaction: 'rejected', commitmentStatus: 'none', evidenceType: 'fact' })
    assert.deepEqual(valid, { actor: 'target', interaction: 'rejected', commitmentStatus: 'none', evidenceType: 'fact' })
    assert.equal(typeof aiEvent.reconcileAnalysisWithExplicitRules, 'undefined')

    const currentEvent = aiEvent.buildCurrentEventContext({
      id: 'event_1',
      description: '他邀请我去惠州玩',
      subjectRole: 'unknown',
      subjectRoleSource: 'pending',
      inputSubjectRole: 'unspecified'
    })
    assert.equal(Object.prototype.hasOwnProperty.call(currentEvent, 'subjectRole'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(currentEvent, 'subjectRoleSource'), false)

    const semanticTags = projectSemanticTagsFromNormalizedEvent({
      actor: 'target', interaction: 'rejected', commitmentStatus: 'none', commitmentType: 'none',
      evidenceType: 'fact', scene: ['offline_meet'], signals: ['avoidance'], strength: 'strong'
    })
    assert.equal(semanticTags.initiator, 'unknown')
    assert.equal(semanticTags.response, 'rejected')
    assert.ok(semanticTags.risk.includes('rejected'))

    assert.equal(buildSubjectPrompt('unspecified'), '')
    assert.ok(buildSubjectPrompt('both').length > 0)
  })

  await runCase('register and login return current session data', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const register = loadFunction('register')
    const login = loadFunction('login')

    const registered = await register({ email: 'tester@example.com', password: 'password123' })
    assert.equal(registered.success, true)
    assert.equal(typeof registered.userId, 'string')
    assert.equal(registered.email, 'tester@example.com')

    const loggedIn = await login({ email: 'tester@example.com', password: 'password123' })
    assert.equal(loggedIn.success, true)
    assert.equal(loggedIn.userId, registered.userId)
    assert.equal(loggedIn.email, 'tester@example.com')
  })

  await runCase('register rejects passwords shorter than 8 characters', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const register = loadFunction('register')
    const result = await register({ email: 'short@example.com', password: 'short1' })

    assert.equal(result.success, false)
    assert.equal(result.message, '密码至少需要8位')
  })

  await runCase('createCase and createTimeline update latest result', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const getCaseDetail = loadFunction('getCaseDetail')

    asUser(fake, 'user_case_owner')
    const created = await createCase({
      name: '测试对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_case_owner')
    const before = await getCaseDetail({
      caseId: created.caseId
    })
    assert.equal(before.success, true)
    assert.equal(before.case.assessments.length, 1)

    asUser(fake, 'user_case_owner')
    const timelineResult = await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })
    assert.equal(timelineResult.success, true)
    assert.ok(timelineResult.assessmentId)
    assert.equal(timelineResult.eventType, 'note')
    assert.equal(timelineResult.eventTitle, '他主动约我吃饭')
    assert.equal(timelineResult.subjectRole, 'unknown')
    assert.equal(timelineResult.subjectRoleSource, 'pending')

    asUser(fake, 'user_case_owner')
    const after = await getCaseDetail({
      caseId: created.caseId
    })
    assert.equal(after.success, true)
    assert.equal(after.case.assessments.length, 2)
    assert.equal(after.case.latestResult.source, 'ai_pending')
    assert.equal(after.case.latestResult.triggerEventTitle, '他主动约我吃饭')
    assert.ok(after.case.timeline.length >= 1)
    assert.ok(after.case.timeline.some((item) => item._id === timelineResult.recordId))
  })

  await runCase('createCase persists Crush MBTI and identity profile fields', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const getCaseDetail = loadFunction('getCaseDetail')

    asUser(fake, 'user_crush_profile_fields')
    const created = await createCase({
      name: '画像字段测试',
      answers: [],
      profile: {
        relationType: 'romantic',
        mbtiCode: 'INFJ',
        identityLabel: '__custom__',
        identityLabelCustom: '学长'
      }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_crush_profile_fields')
    const detail = await getCaseDetail({ caseId: created.caseId })
    assert.equal(detail.success, true)
    assert.equal(detail.case.profile.mbtiCode, 'INFJ')
    assert.equal(detail.case.profile.identityLabel, '__custom__')
    assert.equal(detail.case.profile.identityLabelCustom, '学长')
  })

  await runCase('generateAssessmentAI applies zero-score fallback and clears pending when tokens are insufficient', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const generateAssessmentAI = loadFunction('generateAssessmentAI')

    asUser(fake, 'user_assessment_no_tokens')
    const created = await createCase({
      name: '测试对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_assessment_no_tokens')
    const pending = await createTimeline({
      caseId: created.caseId,
      description: '他拒绝和我见面',
      inputSubjectRole: 'unspecified',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })
    assert.equal(pending.success, true)
    Object.assign(fake.__store.getCollection('users').get('user_assessment_no_tokens'), {
      plan: 'free',
      monthlyTokensUsed: 30000,
      extraTokens: 0
    })

    asUser(fake, 'user_assessment_no_tokens')
    const result = await generateAssessmentAI({
      caseId: created.caseId,
      assessmentId: pending.assessmentId,
      recordId: pending.recordId
    })
    assert.equal(result.success, false)
    assert.equal(result.code, 'TOKEN_INSUFFICIENT')
    assert.equal(result.fallbackApplied, true)
    assert.equal(result.latestResult.triggerEventType, 'note')
    assert.equal(result.trend.intentDelta, 0)
    assert.equal(result.trend.riskDelta, 0)
    assert.equal(result.latestResult.validationError, 'AI_REQUEST_FAILED')
    assert.equal(result.latestResult.analysisSnapshot.score.intentDelta, 0)

    const assessment = fake.__store.getCollection('assessments').get(pending.assessmentId)
    assert.equal(assessment.aiPending, false)
    assert.equal(assessment.aiUsed, false)
    const record = fake.__store.getCollection('timeline_records').get(pending.recordId)
    assert.equal(record.subjectRole, 'unknown')
    assert.equal(record.subjectRoleSource, 'fallback_unknown')
    assert.equal(record.type, 'note')
    assert.equal(record.semanticTagsSource, 'fallback')
    assert.equal(record.analysisSnapshot.score.riskDelta, 0)
  })

  await runCase('generateAssessmentAI persists one NormalizedEventV2 result across the full chain', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    asUser(fake, 'user_normalized_chain')
    await updateAISettings({
      models: [{
        id: 'model_normalized', name: 'Mock', provider: 'openai-compatible',
        baseUrl: 'https://mock.example.com/v1', model: 'mock-normalizer', apiKey: 'sk-mock-normalizer'
      }],
      defaultModelId: 'model_normalized',
      aiEnabled: true,
      promptModules: {
        eventAssessment: {
          enabled: true,
          businessPrompt: {
            nameZh: '即时反馈', roleZh: '关系语义分析助手', taskZh: '把当前事件归一化。',
            rules: [{ zh: '旧规则不得进入提示词：看到吃饭一律算承诺。' }],
            outputSchema: { legacy: true },
            outputNotes: [{ zh: '返回旧评分字段。' }]
          }
        }
      }
    })

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    asUser(fake, 'user_normalized_chain')
    const created = await createCase({ name: '归一化对象', answers: sampleAnswers, profile: { relationType: 'romantic' } })
    asUser(fake, 'user_normalized_chain')
    const pending = await createTimeline({
      caseId: created.caseId,
      description: '张三：周末要不要吃饭。\n夏红：我不想去',
      inputSubjectRole: 'both',
      chatSelfName: '夏红',
      chatTargetName: '张三',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })
    Object.assign(fake.__store.getCollection('users').get('user_normalized_chain'), { extraTokens: 10000 })

    clearCloudFunctionCache(projectRoot)
    const aiHttpPath = path.join(projectRoot, 'cloudfunctions', 'generateAssessmentAI', '_shared', 'ai-http.js')
    const originalAiHttp = require(aiHttpPath)
    let capturedMessages = []
    require.cache[aiHttpPath] = {
      id: aiHttpPath,
      filename: aiHttpPath,
      loaded: true,
      exports: {
        ...originalAiHttp,
        postChatCompletions: async (params) => {
          capturedMessages = params.messages
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model: 'mock-normalizer',
              usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
              choices: [{ message: { content: JSON.stringify({
                schemaVersion: 2,
                event: {
                  actor: 'target', interaction: 'initiated', commitmentStatus: 'none',
                  commitmentType: 'none', evidenceType: 'fact', scene: ['meal'],
                  signals: ['initiative', 'progression'], strength: 'medium',
                  actions: [
                    {
                      actor: 'target', interaction: 'initiated', commitmentStatus: 'none',
                      commitmentType: 'none', evidenceType: 'fact', strength: 'medium', sequence: 1
                    },
                    {
                      actor: 'self', interaction: 'rejected', commitmentStatus: 'none',
                      commitmentType: 'none', evidenceType: 'fact', strength: 'strong', sequence: 2
                    }
                  ]
                },
                copy: {
                  title: '对方发起邀约，我方拒绝', summary: '对方主动邀约，你明确拒绝', reason: '双方动作明确',
                  answer: '对方有主动意向，但你拒绝了这次邀约。', targetMind: '愿意主动发起见面邀约。',
                  nextStep: '按照你的边界决定是否继续互动。', caution: '不要把你的拒绝写成对方拒绝。',
                  petLine: '双方动作都要分别记录。', petMood: 'neutral'
                }
              }) } }]
            })
          }
        }
      }
    }
    const generateAssessmentAI = require(path.join(projectRoot, 'cloudfunctions', 'generateAssessmentAI', 'index.js')).main
    asUser(fake, 'user_normalized_chain')
    const result = await generateAssessmentAI({
      caseId: created.caseId,
      assessmentId: pending.assessmentId,
      recordId: pending.recordId
    })

    assert.equal(result.success, true)
    assert.equal(result.aiUsed, true)
    assert.equal(result.trend.intentDelta, 6)
    assert.equal(result.latestResult.analysisSnapshot.score.riskDelta, -2)
    const record = fake.__store.getCollection('timeline_records').get(pending.recordId)
    assert.equal(record.subjectRole, 'both')
    assert.equal(record.subjectRoleSource, 'ai_inferred')
    assert.equal(record.semanticTagsSource, 'ai')
    assert.equal(record.normalizedEvent.commitmentType, 'none')
    assert.equal(record.normalizedEvent.actions.length, 2)
    assert.equal(record.semanticTags.responseActor, 'self')
    assert.equal(record.semanticTags.risk.includes('rejected'), false)
    assert.equal(record.analysisSnapshot.eventType, 'positive')
    const promptText = capturedMessages.map((item) => item.content).join('\n')
    assert.equal(promptText.includes('旧规则不得进入提示词'), false)
    assert.equal(promptText.includes('返回旧评分字段'), false)
    assert.ok(promptText.includes('schemaVersion=2'))
    assert.ok(promptText.includes('\u6211\u8bf7\u4ed6\u5403\u996d\uff0c\u4ed6\u62d2\u7edd\u4e86\u6211'))
    assert.ok(promptText.includes('actions=[self initiated,target rejected]'))
    assert.ok(promptText.includes('actions=[target initiated,self rejected]'))
    assert.ok(promptText.includes('\u62d2\u7edd\u4e00\u4e2a\u65b0\u9080\u7ea6\u4e0d\u662f broken'))
  })

  await runCase('getCases returns timeline and assessments for homepage insights', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const getCases = loadFunction('getCases')

    asUser(fake, 'user_home_owner')
    const created = await createCase({
      name: '首页对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_home_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })

    asUser(fake, 'user_home_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '后来又失约了',
      occurrenceAt: '2026-04-21T21:15:00.000Z'
    })

    asUser(fake, 'user_home_owner')
    const listed = await getCases({})
    assert.equal(listed.success, true)
    assert.equal(listed.cases.length, 1)
    assert.ok(Array.isArray(listed.cases[0].timeline))
    assert.ok(Array.isArray(listed.cases[0].assessments))
    assert.ok(listed.cases[0].timeline.length >= 2)
    assert.equal(listed.cases[0].assessments.length, 3)
    assert.equal(listed.cases[0].latestResult.source, 'ai_pending')
  })

  await runCase('getCaseDetail returns assessments in ascending order with latestResult aligned', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const getCaseDetail = loadFunction('getCaseDetail')

    asUser(fake, 'user_detail_owner')
    const created = await createCase({
      name: '详情对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_detail_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })

    asUser(fake, 'user_detail_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '后来又失约了',
      occurrenceAt: '2026-04-21T21:15:00.000Z'
    })

    asUser(fake, 'user_detail_owner')
    const detail = await getCaseDetail({ caseId: created.caseId })
    assert.equal(detail.success, true)
    assert.equal(detail.case.assessments.length, 3)

    const createdAtList = detail.case.assessments.map((item) => new Date(item.createdAt).getTime())
    assert.deepEqual(createdAtList, [...createdAtList].sort((a, b) => a - b))
    assert.equal(detail.case.latestResult._id, detail.case.assessments[detail.case.assessments.length - 1]._id)
    assert.equal(detail.case.latestResult.triggerEventTitle, '后来又失约了')
  })

  await runCase('createTimeline keeps pending subject without keyword semantic tags', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const getTimeline = loadFunction('getTimeline')

    asUser(fake, 'user_risk_owner')
    const created = await createCase({
      name: '风险对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })

    asUser(fake, 'user_risk_owner')
    const result = await createTimeline({
      caseId: created.caseId,
      description: '我约她见面，她明确拒绝了，说不想再继续接触。',
      occurrenceAt: '2026-04-21T22:10:00.000Z'
    })

    assert.equal(result.success, true)
    assert.equal(result.eventType, 'note')
    assert.equal(result.subjectRole, 'unknown')
    assert.equal(result.subjectRoleSource, 'pending')

    asUser(fake, 'user_risk_owner')
    const timeline = await getTimeline({
      caseId: created.caseId
    })
    assert.equal(timeline.success, true)
    const saved = timeline.timeline.find((item) => /不想再继续接触/.test(item.description || ''))
    assert.ok(saved)
    assert.equal(saved.aiPending, true)
    assert.equal(saved.subjectRoleSource, 'pending')
    assert.equal(saved.semanticTags, undefined)
  })

  await runCase('createTimeline does not call legacy synchronous recalculation', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')

    asUser(fake, 'user_chain_owner')
    const created = await createCase({
      name: '链路对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    const createTimeline = loadFunction('createTimeline')

    asUser(fake, 'user_chain_owner')
    const result = await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })

    assert.equal(result.success, true)
    assert.equal(result.aiPending, true)
    assert.ok(result.assessmentId)

    const cases = fake.__store.dumpCollection('cases')
    const assessments = fake.__store.dumpCollection('assessments')
    const timelineRecords = fake.__store.dumpCollection('timeline_records')

    assert.equal(cases.length, 1)
    assert.equal(cases[0].latestResultId, result.assessmentId)
    assert.equal(assessments.length, 2)
    assert.equal(timelineRecords.length, 1)
  })

  await runCase('createTimeline transaction keeps store clean when write phase fails', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')

    asUser(fake, 'user_tx_write_owner')
    const created = await createCase({
      name: '事务对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    fake.__failNext('doc.update:cases', 'mock tx case update failed')

    asUser(fake, 'user_tx_write_owner')
    const result = await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })

    assert.equal(result.success, false)
    assert.equal(result.message, '保存失败，评估未完成，请重试')

    const cases = fake.__store.dumpCollection('cases')
    const assessments = fake.__store.dumpCollection('assessments')
    const timelineRecords = fake.__store.dumpCollection('timeline_records')

    assert.equal(cases.length, 1)
    assert.equal(cases[0].latestResultId, created.assessmentId)
    assert.equal(assessments.length, 1)
    assert.equal(timelineRecords.length, 0)
  })

  await runCase('protected functions reject anonymous access and ignore forged userId payloads', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const getCaseDetail = loadFunction('getCaseDetail')

    fake.__setAuthUser(null)
    const anonymousCreate = await createCase({
      name: '匿名对象',
      answers: sampleAnswers,
      profile: {}
    })
    assert.equal(anonymousCreate.success, false)
    assert.equal(anonymousCreate.message, '请先登录')

    asUser(fake, 'user_real_owner')
    const created = await createCase({
      userId: 'forged_user_id',
      name: '真实归属对象',
      answers: sampleAnswers,
      profile: {}
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_intruder')
    const stolen = await getCaseDetail({
      userId: 'user_real_owner',
      caseId: created.caseId
    })
    assert.equal(stolen.success, false)
    assert.equal(stolen.message, '无权访问')
  })

  await runCase('petLines maintenance actions are disabled', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const petLines = loadFunction('petLines')

    fake.__setAuthUser(null)
    for (const action of ['seed', 'tagLines', 'tagQAStrategies', 'normalizeQASelfReply']) {
      const result = await petLines({ action })
      assert.equal(result.success, false)
      assert.equal(result.message, `${action} is disabled`)
    }

    assert.equal(fake.__store.dumpCollection('pet_lines').length, 0)
    assert.equal(fake.__store.dumpCollection('qa_strategy_tags').length, 0)
    assert.equal(fake.__store.dumpCollection('qa_normalize_results').length, 0)
  })

  await runCase('petLines replyPair uses users.extraTokens instead of legacy token_accounts balance', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const petLines = loadFunction('petLines')

    asUser(fake, 'user_pet_invitee')
    Object.assign(fake.__store.getCollection('users').get('user_pet_invitee'), {
      plan: 'free',
      monthlyTokensUsed: 30000,
      extraTokens: 110000
    })

    assert.equal(fake.__store.dumpCollection('token_accounts').length, 0)

    const result = await petLines({
      action: 'replyPair',
      content: '对方说今天有点累，我想自然地关心一下'
    })

    assert.equal(result.success, false)
    assert.notEqual(result.code, 'INSUFFICIENT_BALANCE')
    assert.notEqual(result.code, 'TOKEN_INSUFFICIENT')
    assert.equal(result.message, '无可用 AI 模型，请检查配置')
  })

  await runCase('petLines replyBundle preserves TOKEN_INSUFFICIENT details', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const petLines = loadFunction('petLines')

    asUser(fake, 'user_pet_empty')
    Object.assign(fake.__store.getCollection('users').get('user_pet_empty'), {
      plan: 'free',
      monthlyTokensUsed: 30000,
      extraTokens: 0
    })

    const result = await petLines({
      action: 'replyBundle',
      content: '对方说今天有点累，我想自然地关心一下'
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'TOKEN_INSUFFICIENT')
    assert.equal(result.extraTokens, 0)
    assert.equal(result.required, 700)
  })

  await runCase('petLines loadHistory returns owned case and last 20 pet chat messages', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const petLines = loadFunction('petLines')

    asUser(fake, 'user_pet_chat_owner')
    const users = fake.__store.getCollection('users')
    Object.assign(users.get('user_pet_chat_owner'), {
      petChatHistory: Array.from({ length: 24 }, (_, index) => ({
        id: `m_${index}`,
        role: index % 2 === 0 ? 'user' : 'pet',
        caseId: 'case_pet_chat_owned',
        text: `message ${index}`,
        time: new Date(2026, 6, 8, 12, index)
      })).concat([
        {
          id: 'other_case_message',
          role: 'pet',
          caseId: 'case_pet_chat_other',
          text: 'other case should not leak',
          time: new Date(2026, 6, 8, 13, 0)
        }
      ])
    })
    fake.__store.getCollection('cases').set('case_pet_chat_owned', {
      _id: 'case_pet_chat_owned',
      userId: 'user_pet_chat_owner',
      name: '小王',
      profile: { constellation: '天蝎座', zodiac: '蛇' }
    })
    fake.__store.getCollection('cases').set('case_pet_chat_other', {
      _id: 'case_pet_chat_other',
      userId: 'user_other',
      name: '不该看到的人',
      profile: {}
    })

    const owned = await petLines({ action: 'loadhistory', caseId: 'case_pet_chat_owned' })
    assert.equal(owned.success, true)
    assert.equal(owned.history.length, 20)
    assert.equal(owned.history[0].text, 'message 4')
    assert.equal(owned.activeCase.name, '小王')
    assert.equal(owned.activeCase.constellation, '天蝎座')

    const forbidden = await petLines({ action: 'loadhistory', caseId: 'case_pet_chat_other' })
    assert.equal(forbidden.success, true)
    assert.equal(forbidden.history.length, 0)
    assert.equal(forbidden.activeCase, null)
  })

  await runCase('petLines chatMessage uses token gate without featureAccess gate', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const petLines = loadFunction('petLines')

    asUser(fake, 'user_pet_chat_empty')
    Object.assign(fake.__store.getCollection('users').get('user_pet_chat_empty'), {
      plan: 'free',
      monthlyTokensUsed: 30000,
      extraTokens: 0
    })

    const result = await petLines({
      action: 'chatMessage',
      sessionId: 'session_regression',
      text: '对方突然冷淡了，我该怎么回？',
      messages: [{ role: 'user', text: '对方突然冷淡了，我该怎么回？' }]
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'TOKEN_INSUFFICIENT')
    assert.equal(result.required, 700)
  })

  await runCase('AI settings save and masked readback work', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    const getAISettings = loadFunction('getAISettings')

    asUser(fake, 'user_ai_owner')
    const updated = await updateAISettings({
      models: [{
        id: 'model_openai',
        name: 'OpenAI',
        provider: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: 'sk-live-123456'
      }],
      defaultModelId: 'model_openai',
      aiEnabled: true,
      aiFallbackToRules: true
    })
    assert.equal(updated.success, true)

    asUser(fake, 'user_ai_owner')
    const fetched = await getAISettings({})
    assert.equal(fetched.success, true)
    assert.equal(fetched.settings.aiEnabled, true)
    assert.equal(fetched.settings.aiModel, 'gpt-4o-mini')
    assert.equal(fetched.settings.aiBaseUrl, 'https://api.openai.com/v1')
    assert.ok(fetched.settings.aiApiKey.startsWith('***'))
    assert.ok(fetched.settings.aiApiKey.endsWith('3456'))
  })

  await runCase('reassess appends latest result and system timeline records', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const reassess = loadFunction('reassess')
    const getCaseDetail = loadFunction('getCaseDetail')

    asUser(fake, 'user_reassess_owner')
    const created = await createCase({
      name: '重评对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_reassess_owner')
    const reassessed = await reassess({
      caseId: created.caseId,
      answers: sampleAnswers
    })
    assert.equal(reassessed.success, true)

    asUser(fake, 'user_reassess_owner')
    const detail = await getCaseDetail({ caseId: created.caseId })
    assert.equal(detail.success, true)
    assert.equal(detail.case.assessments.length, 2)
    assert.equal(detail.case.latestResult._id, reassessed.assessmentId)
    assert.equal(detail.case.latestResult.source, 'manual_reassessment')
    assert.ok(detail.case.timeline.some((item) => item.type === 'assessment'))
  })

  await runCase('AI connection test uses stored key and current form overrides', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    asUser(fake, 'user_ai_test_owner')
    await updateAISettings({
      models: [{
        id: 'model_stored',
        name: 'Stored',
        provider: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: 'sk-stored-7890'
      }],
      defaultModelId: 'model_stored',
      aiEnabled: true,
      aiFallbackToRules: true
    })

    clearCloudFunctionCache(projectRoot)
    const aiHttpPath = path.join(projectRoot, 'cloudfunctions', 'testAIConnection', '_shared', 'ai-http.js')
    const originalAiHttp = require(aiHttpPath)
    let capturedParams = null

    require.cache[aiHttpPath] = {
      id: aiHttpPath,
      filename: aiHttpPath,
      loaded: true,
      exports: {
        ...originalAiHttp,
        postChatCompletions: async (params) => {
          capturedParams = params
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model: 'mock-model',
              choices: [{ message: { content: '连接成功，模型工作正常。' } }]
            })
          }
        }
      }
    }

    const testAIConnection = require(path.join(projectRoot, 'cloudfunctions', 'testAIConnection', 'index.js')).main
    asUser(fake, 'user_ai_test_owner')
    const result = await testAIConnection({
      aiBaseUrl: 'https://proxy.example.com/v1',
      aiModel: 'gpt-4.1-mini'
    })

    assert.equal(result.success, true)
    assert.equal(result.model, 'mock-model')
    assert.match(result.summary, /连接成功/)
    assert.equal(capturedParams.apiKey, 'sk-stored-7890')
    assert.equal(capturedParams.baseUrl, 'https://proxy.example.com/v1')
    assert.equal(capturedParams.model, 'gpt-4.1-mini')
  })

  await runCase('AI connection test reports HTML responses clearly', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    asUser(fake, 'user_ai_html_owner')
    await updateAISettings({
      models: [{
        id: 'model_html',
        name: 'HTML 响应模型',
        provider: 'openai-compatible',
        baseUrl: 'https://example.com',
        model: 'gpt-4o-mini',
        apiKey: 'sk-html-1234'
      }],
      defaultModelId: 'model_html',
      aiEnabled: true,
      aiFallbackToRules: true
    })

    clearCloudFunctionCache(projectRoot)
    const aiHttpPath = path.join(projectRoot, 'cloudfunctions', 'testAIConnection', '_shared', 'ai-http.js')
    const originalAiHttp = require(aiHttpPath)

    require.cache[aiHttpPath] = {
      id: aiHttpPath,
      filename: aiHttpPath,
      loaded: true,
      exports: {
        ...originalAiHttp,
        postChatCompletions: async () => ({
          ok: true,
          status: 200,
          text: async () => '<!doctype html><html><body>Not JSON</body></html>'
        })
      }
    }

    const testAIConnection = require(path.join(projectRoot, 'cloudfunctions', 'testAIConnection', 'index.js')).main
    asUser(fake, 'user_ai_html_owner')
    const result = await testAIConnection({
      modelId: 'model_html'
    })

    assert.equal(result.success, false)
    assert.match(result.message, /HTML 页面/)
    assert.match(result.message, /https:\/\/example\.com/)
  })

  await runCase('AI connection test passes anthropic provider through', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    asUser(fake, 'user_ai_anthropic_owner')
    await updateAISettings({
      models: [{
        id: 'model_anthropic',
        name: 'Claude',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'sk-ant-1234'
      }],
      defaultModelId: 'model_anthropic',
      aiEnabled: true,
      aiFallbackToRules: true
    })

    clearCloudFunctionCache(projectRoot)
    const aiHttpPath = path.join(projectRoot, 'cloudfunctions', 'testAIConnection', '_shared', 'ai-http.js')
    const originalAiHttp = require(aiHttpPath)
    let capturedParams = null

    require.cache[aiHttpPath] = {
      id: aiHttpPath,
      filename: aiHttpPath,
      loaded: true,
      exports: {
        ...originalAiHttp,
        postChatCompletions: async (params) => {
          capturedParams = params
          return {
            ok: true,
            status: 200,
            json: async () => ({
              model: 'claude-3-5-sonnet-20241022',
              choices: [{ message: { content: '连接成功，Anthropic 正常。' } }]
            })
          }
        }
      }
    }

    const testAIConnection = require(path.join(projectRoot, 'cloudfunctions', 'testAIConnection', 'index.js')).main
    asUser(fake, 'user_ai_anthropic_owner')
    const result = await testAIConnection({
      modelId: 'model_anthropic'
    })

    assert.equal(result.success, true)
    assert.equal(capturedParams.provider, 'anthropic')
    assert.equal(capturedParams.baseUrl, 'https://api.anthropic.com')
    assert.equal(capturedParams.model, 'claude-3-5-sonnet-20241022')
  })

  await runCase('AI HTTP prefers /v1 endpoints before root endpoints', async () => {
    const aiHttp = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'ai-http.js'))

    assert.deepEqual(
      aiHttp.buildChatCompletionUrls('https://proxy.example.com', 'openai-compatible'),
      [
        'https://proxy.example.com/v1/chat/completions',
        'https://proxy.example.com/chat/completions'
      ]
    )

    assert.deepEqual(
      aiHttp.buildChatCompletionUrls('https://proxy.example.com', 'anthropic'),
      [
        'https://proxy.example.com/v1/messages',
        'https://proxy.example.com/messages'
      ]
    )
  })

  await runCase('deleteCase removes case, assessments and timeline records', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const deleteCase = loadFunction('deleteCase')

    asUser(fake, 'user_delete_owner')
    const created = await createCase({
      name: '待删除对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_delete_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T20:15:00.000Z'
    })

    asUser(fake, 'user_delete_owner')
    const removed = await deleteCase({
      caseId: created.caseId
    })
    assert.equal(removed.success, true)

    assert.equal(fake.__store.dumpCollection('cases').length, 0)
    assert.equal(fake.__store.dumpCollection('assessments').length, 0)
    assert.equal(fake.__store.dumpCollection('timeline_records').length, 0)
  })

  await runCase('deleteCase reports failure when part of the delete chain fails', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const deleteCase = loadFunction('deleteCase')

    asUser(fake, 'user_delete_rollback_owner')
    const created = await createCase({
      name: '回滚对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_delete_rollback_owner')
    await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T20:15:00.000Z'
    })

    fake.__failNext('doc.remove:cases', 'mock case remove failed')

    asUser(fake, 'user_delete_rollback_owner')
    const removed = await deleteCase({
      caseId: created.caseId
    })
    assert.equal(removed.success, false)

    assert.equal(fake.__store.dumpCollection('cases').length, 1)
  })

  await runCase('deleteTimeline rebuilds remaining events with snapshot-safe fallback', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const createCase = loadFunction('createCase')
    const createTimeline = loadFunction('createTimeline')
    const deleteTimeline = loadFunction('deleteTimeline')
    const getCaseDetail = loadFunction('getCaseDetail')

    asUser(fake, 'user_delete_timeline_owner')
    const created = await createCase({
      name: '删除事件对象',
      answers: sampleAnswers,
      profile: { relationType: 'romantic' }
    })
    assert.equal(created.success, true)

    asUser(fake, 'user_delete_timeline_owner')
    const firstEvent = await createTimeline({
      caseId: created.caseId,
      description: '他主动约我吃饭',
      occurrenceAt: '2026-04-21T19:45:00.000Z'
    })
    assert.equal(firstEvent.success, true)

    const normalizedEvent = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'normalized-event.js'))
    const firstAnalysis = normalizedEvent.buildAnalysisFromNormalizedEvent({
      schemaVersion: 1,
      event: {
        actor: 'target', interaction: 'initiated', commitmentStatus: 'none', commitmentType: 'none',
        evidenceType: 'fact', scene: ['meal'], signals: ['initiative'], strength: 'medium'
      },
      copy: {
        title: '他主动约我吃饭', summary: '对方主动发起邀约', reason: '主动邀约', answer: '这是主动信号',
        targetMind: '愿意推进互动', nextStep: '观察是否落实', caution: '继续看兑现', petLine: '先看行动落地。', petMood: 'neutral'
      }
    })
    Object.assign(fake.__store.getCollection('timeline_records').get(firstEvent.recordId), {
      type: firstAnalysis.eventType,
      subjectRole: 'target',
      subjectRoleSource: 'ai_inferred',
      semanticTags: firstAnalysis.semanticTags,
      semanticTagsSource: 'ai',
      normalizedEvent: firstAnalysis.normalizedEvent,
      analysisSnapshot: firstAnalysis.analysisSnapshot,
      aiPending: false,
      aiUsed: true
    })
    Object.assign(fake.__store.getCollection('assessments').get(firstEvent.assessmentId), {
      source: 'event_recalculation',
      aiPending: false,
      aiUsed: true
    })

    asUser(fake, 'user_delete_timeline_owner')
    const secondEvent = await createTimeline({
      caseId: created.caseId,
      description: '后来又失约了',
      occurrenceAt: '2026-04-21T21:15:00.000Z'
    })
    assert.equal(secondEvent.success, true)

    const riskRecord = fake.__store
      .dumpCollection('timeline_records')
      .find((item) => item.caseId === created.caseId && item._id === secondEvent.recordId)
    assert.ok(riskRecord)

    asUser(fake, 'user_delete_timeline_owner')
    const removed = await deleteTimeline({
      caseId: created.caseId,
      recordId: riskRecord._id
    })
    assert.equal(removed.success, true)

    asUser(fake, 'user_delete_timeline_owner')
    const detail = await getCaseDetail({ caseId: created.caseId })
    assert.equal(detail.success, true)
    assert.ok(detail.case.assessments.length >= 2)
    assert.ok(detail.case.latestResult)
    assert.ok(!detail.case.timeline.some((item) => item._id === riskRecord._id))
    assert.equal(detail.case.latestResult.triggerEventId, firstEvent.recordId)
    assert.equal(detail.case.latestResult.analysisSnapshot.score.intentDelta, 6)
  })

  await runCase('manual recharge fulfillment grants only users.extraTokens once', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const recharge = loadFunction('recharge')

    asUser(fake, 'user_recharge_owner')
    const created = await recharge({ action: 'createRechargeOrder', planId: 'p9_9' })
    assert.equal(created.success, true)
    assert.ok(created.order._id)

    const beforeUser = fake.__store.dumpCollection('users').find((item) => item._id === 'user_recharge_owner')
    const beforeExtraTokens = beforeUser.extraTokens

    asUser(fake, 'admin_recharge_operator')
    const confirmed = await recharge({ action: 'adminConfirmRecharge', orderId: created.order._id })
    assert.equal(confirmed.success, true)
    assert.equal(confirmed.order.status, 'paid')

    const afterFirst = fake.__store.dumpCollection('users').find((item) => item._id === 'user_recharge_owner')
    assert.equal(afterFirst.extraTokens, beforeExtraTokens + created.order.grantTokens)

    asUser(fake, 'admin_recharge_operator')
    const repeated = await recharge({ action: 'adminConfirmRecharge', orderId: created.order._id })
    assert.equal(repeated.success, false)

    const afterRepeat = fake.__store.dumpCollection('users').find((item) => item._id === 'user_recharge_owner')
    assert.equal(afterRepeat.extraTokens, afterFirst.extraTokens)

    const grantRecords = fake.__store.dumpCollection('call_usage_records')
      .filter((item) => item.userId === 'user_recharge_owner' && item.type === 'grant' && item.source === 'recharge' && item.sourceId === created.order._id)
    assert.equal(grantRecords.length, 1)
    assert.equal(grantRecords[0].amountTokens, created.order.grantTokens)
    assert.equal(grantRecords[0].remark, `recharge_${created.order._id}`)
    assert.equal(fake.__store.dumpCollection('token_ledger_records').length, 0)
    const commissionJobs = fake.__store.dumpCollection('referral_commission_jobs')
      .filter((item) => item._id === `job_recharge_order_${created.order._id}`)
    assert.equal(commissionJobs.length, 1)
    assert.equal(commissionJobs[0].paidAmountFen, created.order.amountFen)
    const repeatedJobs = fake.__store.dumpCollection('referral_commission_jobs')
      .filter((item) => item._id === `job_recharge_order_${created.order._id}`)
    assert.equal(repeatedJobs.length, 1)
  })

  await runCase('repairOrder repairs paid recharge order missing token grant', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_paid_recharge_owner')
    Object.assign(fake.__store.getCollection('users').get('user_paid_recharge_owner'), {
      extraTokens: 0
    })
    fake.__store.getCollection('recharge_orders').set('order_paid_missing_grant', {
      _id: 'order_paid_missing_grant',
      userId: 'user_paid_recharge_owner',
      orderNo: 'PAY_REPAIR_001',
      status: 'paid',
      productType: 'recharge',
      planName: 'repair pack',
      amountFen: 100,
      grantTokens: 7000,
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const recharge = loadFunction('recharge')
    asUser(fake, 'user_paid_recharge_owner')
    const repaired = await recharge({ action: 'repairOrder', orderNo: 'PAY_REPAIR_001' })
    assert.equal(repaired.success, true)
    assert.equal(repaired.order.status, 'paid')

    const afterRepair = fake.__store.getCollection('users').get('user_paid_recharge_owner')
    assert.equal(afterRepair.extraTokens, 7000)

    const repeated = await recharge({ action: 'repairOrder', orderNo: 'PAY_REPAIR_001' })
    assert.equal(repeated.success, true)
    const afterRepeat = fake.__store.getCollection('users').get('user_paid_recharge_owner')
    assert.equal(afterRepeat.extraTokens, 7000)

    const grantRecords = fake.__store.dumpCollection('call_usage_records')
      .filter((item) => item.userId === 'user_paid_recharge_owner' && item.type === 'grant' && item.source === 'recharge' && item.sourceId === 'order_paid_missing_grant')
    assert.equal(grantRecords.length, 1)
    assert.equal(grantRecords[0].amountTokens, 7000)
    assert.equal(grantRecords[0].remark, 'recharge_order_paid_missing_grant')
  })

  await runCase('queryOrder repairs paid recharge order missing token grant', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_paid_query_repair_owner')
    Object.assign(fake.__store.getCollection('users').get('user_paid_query_repair_owner'), {
      extraTokens: 0
    })
    fake.__store.getCollection('recharge_orders').set('order_paid_query_missing_grant', {
      _id: 'order_paid_query_missing_grant',
      userId: 'user_paid_query_repair_owner',
      orderNo: 'PAY_QUERY_REPAIR_001',
      status: 'paid',
      fulfillmentStatus: 'failed',
      productType: 'recharge',
      planName: 'query repair pack',
      amountFen: 100,
      grantTokens: 5000,
      transactionId: 'wx_txn_query_repair',
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const recharge = loadFunction('recharge')
    asUser(fake, 'user_paid_query_repair_owner')
    const repaired = await recharge({ action: 'queryOrder', orderNo: 'PAY_QUERY_REPAIR_001' })
    assert.equal(repaired.success, true)
    assert.equal(repaired.order.status, 'paid')
    assert.equal(repaired.order.fulfillmentStatus, 'succeeded')

    const afterRepair = fake.__store.getCollection('users').get('user_paid_query_repair_owner')
    assert.equal(afterRepair.extraTokens, 5000)

    const repeated = await recharge({ action: 'queryOrder', orderNo: 'PAY_QUERY_REPAIR_001' })
    assert.equal(repeated.success, true)
    const afterRepeat = fake.__store.getCollection('users').get('user_paid_query_repair_owner')
    assert.equal(afterRepeat.extraTokens, 5000)
  })

  await runCase('repairOrder honors legacy recharge grant marker idempotently', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_legacy_recharge_owner')
    Object.assign(fake.__store.getCollection('users').get('user_legacy_recharge_owner'), {
      extraTokens: 7000
    })
    fake.__store.getCollection('recharge_orders').set('order_legacy_granted', {
      _id: 'order_legacy_granted',
      userId: 'user_legacy_recharge_owner',
      orderNo: 'PAY_REPAIR_LEGACY_001',
      status: 'paid',
      productType: 'recharge',
      planName: 'legacy grant marker pack',
      amountFen: 100,
      grantTokens: 7000,
      createdAt: new Date(),
      paidAt: new Date(),
      updatedAt: new Date()
    })
    fake.__store.getCollection('call_usage_records').set('legacy_recharge_grant_marker', {
      _id: 'legacy_recharge_grant_marker',
      userId: 'user_legacy_recharge_owner',
      type: 'grant',
      source: 'recharge_order_legacy_granted',
      amount: 7000,
      createdAt: new Date()
    })

    const recharge = loadFunction('recharge')
    asUser(fake, 'user_legacy_recharge_owner')
    const repaired = await recharge({ action: 'repairOrder', orderNo: 'PAY_REPAIR_LEGACY_001' })
    assert.equal(repaired.success, true)

    const user = fake.__store.getCollection('users').get('user_legacy_recharge_owner')
    assert.equal(user.extraTokens, 7000)

    const grantRecords = fake.__store.dumpCollection('call_usage_records')
      .filter((item) => item.userId === 'user_legacy_recharge_owner' && item.type === 'grant')
    assert.equal(grantRecords.length, 1)
  })

  await runCase('repairOrder repairs paid subscription order missing entitlement', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_paid_subscription_owner')
    Object.assign(fake.__store.getCollection('users').get('user_paid_subscription_owner'), {
      plan: 'free',
      planExpiresAt: null,
      trialEndsAt: null
    })
    fake.__store.getCollection('recharge_orders').set('order_paid_subscription_missing_entitlement', {
      _id: 'order_paid_subscription_missing_entitlement',
      userId: 'user_paid_subscription_owner',
      orderNo: 'PAY_REPAIR_SUB_001',
      status: 'paid',
      productType: 'subscription',
      planKey: 'pro',
      grantPlan: 'pro',
      grantDurationDays: 30,
      planName: 'Pro',
      amountFen: 1900,
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const recharge = loadFunction('recharge')
    asUser(fake, 'user_paid_subscription_owner')
    const repaired = await recharge({ action: 'repairOrder', orderNo: 'PAY_REPAIR_SUB_001' })
    assert.equal(repaired.success, true)
    assert.equal(repaired.order.status, 'paid')

    const afterRepair = fake.__store.getCollection('users').get('user_paid_subscription_owner')
    assert.equal(afterRepair.plan, 'pro')
    assert.ok(afterRepair.planExpiresAt)

    const firstExpiresAt = afterRepair.planExpiresAt
    const repeated = await recharge({ action: 'repairOrder', orderNo: 'PAY_REPAIR_SUB_001' })
    assert.equal(repeated.success, true)
    const afterRepeat = fake.__store.getCollection('users').get('user_paid_subscription_owner')
    assert.equal(afterRepeat.planExpiresAt, firstExpiresAt)
    const subscriptionJobs = fake.__store.dumpCollection('referral_commission_jobs')
      .filter((item) => item._id === 'job_recharge_order_order_paid_subscription_missing_entitlement')
    assert.equal(subscriptionJobs.length, 1)
    assert.equal(subscriptionJobs[0].orderType, 'subscription')
  })

  await runCase('getTokenAccount returns subscription token fields from users collection', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_token_account_owner')
    const user = fake.__store.dumpCollection('users').find((item) => item._id === 'user_token_account_owner')
    Object.assign(fake.__store.getCollection('users').get(user._id), {
      monthlyTokensUsed: 12345,
      extraTokens: 67890
    })

    const getTokenAccount = loadFunction('getTokenAccount')
    asUser(fake, 'user_token_account_owner')
    const result = await getTokenAccount({ action: 'getAccount' })

    assert.equal(result.success, true)
    assert.equal(result.account.source, 'subscription')
    assert.equal(result.account.extraTokens, 67890)
    assert.equal(result.account.balanceTokens, 67890)
    assert.equal(result.account.monthlyTokensUsed, 12345)
  })

  await runCase('admin refund deducts grantTokens from users.extraTokens', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    fake.__store.getCollection('recharge_orders').set('order_refund_grant_tokens', {
      _id: 'order_refund_grant_tokens',
      userId: 'user_refund_owner',
      status: 'paid',
      productType: 'recharge',
      planName: 'refund smoke',
      amountFen: 100,
      grantTokens: 5000,
      createdAt: new Date(),
      paidAt: new Date()
    })

    asUser(fake, 'user_refund_owner')
    Object.assign(fake.__store.getCollection('users').get('user_refund_owner'), {
      extraTokens: 9000
    })

    const adminManage = loadFunction('adminManage')
    asUser(fake, 'admin_refund_operator')
    // 默认路径现为微信退款 API（需 openid，测试无网络）；线下退款标记（manual）保留即时结算语义
    const result = await adminManage({ action: 'refundOrder', orderId: 'order_refund_grant_tokens', manual: true })

    assert.equal(result.success, true)
    const user = fake.__store.dumpCollection('users').find((item) => item._id === 'user_refund_owner')
    assert.equal(user.extraTokens, 4000)

    const records = fake.__store.dumpCollection('call_usage_records')
      .filter((item) => item.userId === 'user_refund_owner' && item.source === 'refund')
    assert.equal(records.length, 1)
    assert.equal(records[0].amount, -5000)
  })

  await runCase('register writes welcome grant to call_usage_records', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const register = loadFunction('register')
    const result = await register({ email: 'welcometest@example.com', password: 'password123' })
    assert.equal(result.success, true)

    const grantRecords = fake.__store.dumpCollection('call_usage_records')
      .filter((item) => item.userId === result.userId && item.type === 'grant' && item.source === 'welcome')
    assert.equal(grantRecords.length, 1)
    assert.equal(grantRecords[0].amountTokens, 1000000)
    assert.equal(grantRecords[0].remark, '新用户首次赠送')
  })

  await runCase('trial user: checkTokenBalance returns monthlyLimit=0 and consumeTokens deducts extraTokens', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_trial_smoke')
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    Object.assign(fake.__store.getCollection('users').get('user_trial_smoke'), {
      plan: 'free',
      trialEndsAt: trialEnd,
      monthlyTokensUsed: 0,
      extraTokens: 500000
    })

    const db = fake.init().database()

    // 1. checkTokenBalance
    const { checkTokenBalance } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'subscription.js'))
    const checkResult = await checkTokenBalance(db, 'user_trial_smoke', 800)
    assert.equal(checkResult.ok, true)
    // 试用期 monthlyLimit 应为 0，余额来自 extraTokens
    const userAfterCheck = fake.__store.getCollection('users').get('user_trial_smoke')
    assert.equal(userAfterCheck.extraTokens, 500000)

    // 2. consumeTokens — 应该扣 extraTokens 而不是 monthlyTokensUsed
    const { consumeTokens } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'subscription.js'))
    const consumeResult = await consumeTokens(db, 'user_trial_smoke', 800, 'quickRead', 'test-model', { totalTokens: 800, promptTokens: 560, completionTokens: 240 })
    assert.ok(consumeResult.deducted > 0)
    assert.equal(consumeResult.fromMonthly, 0)
    assert.equal(consumeResult.fromExtra, 800)

    const userAfterConsume = fake.__store.getCollection('users').get('user_trial_smoke')
    assert.equal(userAfterConsume.monthlyTokensUsed, 0)
    assert.equal(userAfterConsume.extraTokens, 499200)
  })

  await runCase('token gate does not let monthly overuse offset available extra tokens', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    asUser(fake, 'user_monthly_overuse')
    Object.assign(fake.__store.getCollection('users').get('user_monthly_overuse'), {
      plan: 'free',
      trialEndsAt: null,
      monthlyTokensReset: new Date(),
      monthlyTokensUsed: 1000,
      extraTokens: 200
    })
    const db = fake.init().database()
    // CloudBase 不允许 doc(id).set 的 payload 中带 _id（会报"不能更新_id的值"），夹具必须移除
    await db.collection('system_settings').doc('settings_subscription').set({
      plans: {
        free: { monthlyTokens: 60 },
        pro: { monthlyTokens: 0 },
        ultra: { monthlyTokens: -1 }
      },
      featureEstTokens: { attachmentAnalysis: 100 }
    })
    await db.collection('system_settings').doc('settings_billing').set({
      modelPricing: [
        { modelId: '*', costMultiplier: 1 },
        { modelId: 'deepseek-chat', costMultiplier: 0.1 }
      ]
    })

    const { checkTokenBalance } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'subscription.js'))
    const result = await checkTokenBalance(db, 'user_monthly_overuse', {
      featureKey: 'attachmentAnalysis',
      modelId: 'deepseek-chat',
      fallbackTokens: 100
    })

    assert.equal(result.ok, true)
    assert.equal(result.required, 10)
    assert.equal(result.monthlyRemaining, 0)
    assert.equal(result.extraTokens, 200)
  })

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
