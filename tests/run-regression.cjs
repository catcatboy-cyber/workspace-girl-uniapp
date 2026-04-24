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
  await runCase('register and login return ticketed session data', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const register = loadFunction('register')
    const login = loadFunction('login')

    const registered = await register({ email: 'tester@example.com', password: 'password123' })
    assert.equal(registered.success, true)
    assert.match(registered.ticket, /^ticket-user_/)
    assert.equal(registered.email, 'tester@example.com')

    const loggedIn = await login({ email: 'tester@example.com', password: 'password123' })
    assert.equal(loggedIn.success, true)
    assert.equal(loggedIn.userId, registered.userId)
    assert.match(loggedIn.ticket, /^ticket-user_/)
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
    assert.equal(timelineResult.eventType, 'positive')
    assert.equal(timelineResult.eventTitle, '他主动约我吃饭')

    asUser(fake, 'user_case_owner')
    const after = await getCaseDetail({
      caseId: created.caseId
    })
    assert.equal(after.success, true)
    assert.equal(after.case.assessments.length, 2)
    assert.equal(after.case.latestResult.source, 'event_recalculation')
    assert.equal(after.case.latestResult.triggerEventTitle, '他主动约我吃饭')
    assert.ok(after.case.timeline.length >= 3)
    assert.ok(after.case.timeline.some((item) => item.type === 'assessment'))
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
    assert.ok(listed.cases[0].timeline.length >= 5)
    assert.equal(listed.cases[0].assessments.length, 3)
    assert.equal(listed.cases[0].latestResult.source, 'event_recalculation')
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

  await runCase('createTimeline auto-classifies obvious refusal as risk', async () => {
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
    assert.equal(result.eventType, 'risk')

    asUser(fake, 'user_risk_owner')
    const timeline = await getTimeline({
      caseId: created.caseId
    })
    assert.equal(timeline.success, true)
    assert.ok(
      timeline.timeline.some((item) => item.type === 'risk' && /不想再继续接触/.test(item.description || ''))
    )
  })

  await runCase('createTimeline fails loudly and rolls back when recalculation fails', async () => {
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

    clearCloudFunctionCache(projectRoot)
    const recalcPath = path.join(projectRoot, 'cloudfunctions', 'createTimeline', '_shared', 'event-recalculate.js')
    const originalRecalculate = require(recalcPath)

    require.cache[recalcPath] = {
      id: recalcPath,
      filename: recalcPath,
      loaded: true,
      exports: {
        ...originalRecalculate,
        recalculateAssessmentFromEvent: async () => {
          throw new Error('mock recalculation failed')
        }
      }
    }

    const createTimeline = require(path.join(projectRoot, 'cloudfunctions', 'createTimeline', 'index.js')).main

    asUser(fake, 'user_chain_owner')
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

  await runCase('AI settings save and masked readback work', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const updateAISettings = loadFunction('updateAISettings')
    const getAISettings = loadFunction('getAISettings')

    asUser(fake, 'user_ai_owner')
    const updated = await updateAISettings({
      aiEnabled: true,
      aiProvider: 'openai-compatible',
      aiApiKey: 'sk-live-123456',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
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
      aiEnabled: true,
      aiProvider: 'openai-compatible',
      aiApiKey: 'sk-stored-7890',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
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

  await runCase('deleteCase rolls back when part of the delete chain fails', async () => {
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
    assert.ok(fake.__store.dumpCollection('assessments').length > 0)
    assert.ok(fake.__store.dumpCollection('timeline_records').length > 0)
  })

  await runCase('deleteTimeline rebuilds derived assessments and latest result', async () => {
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

    asUser(fake, 'user_delete_timeline_owner')
    const secondEvent = await createTimeline({
      caseId: created.caseId,
      description: '后来又失约了',
      occurrenceAt: '2026-04-21T21:15:00.000Z'
    })
    assert.equal(secondEvent.success, true)

    const riskRecord = fake.__store
      .dumpCollection('timeline_records')
      .find((item) => item.caseId === created.caseId && item.type === 'risk' && /失约/.test(item.description || ''))
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
    assert.equal(detail.case.assessments.length, 2)
    assert.equal(detail.case.latestResult.triggerEventTitle, '他主动约我吃饭')
    assert.ok(!detail.case.timeline.some((item) => item._id === riskRecord._id))
  })

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
