const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { evaluateAssessment } = require('./_shared/engine')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { checkBalance } = require('./_shared/billing')
const { recordTokenUsage } = require('./_shared/token-usage')
const { analyzeTextSignals } = require('./_shared/ai-text-analyzer')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'
const AI_FEATURE_NAME = 'initial_assessment_text'
const AI_ESTIMATED_TOKENS = 800

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

async function getAISettings() {
  try {
    const res = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get()
    return res?.data || null
  } catch {
    return null
  }
}

async function analyzeTextAnswers(answers, userId) {
  const t1Text = String((answers || []).find(a => a.questionId === 'T1')?.value || '').trim()
  const t2Text = String((answers || []).find(a => a.questionId === 'T2')?.value || '').trim()

  if (!t1Text && !t2Text) return { signals: [], aiUsed: false }

  // 总有效字符过短则跳过
  const meaningfulChars = (t1Text + t2Text).replace(/\s/g, '')
  if (meaningfulChars.length < 5) return { signals: [], aiUsed: false }

  try {
    const settings = await getAISettings()
    if (!settings?.aiEnabled) return { signals: [], aiUsed: false }

    const models = Array.isArray(settings.aiModels) ? settings.aiModels : []
    const defaultId = settings.aiDefaultModelId || ''
    const model = models.find(m => m.id === defaultId) || models[0]
    if (!model?.apiKey) return { signals: [], aiUsed: false }

    // 检查余额（block 模式下余额不足则跳过）
    const bal = await checkBalance(db, userId, AI_ESTIMATED_TOKENS)
    if (!bal.ok) {
      console.log('[createCase] insufficient balance for AI text analysis, skipping')
      return { signals: [], aiUsed: false, balanceInsufficient: true }
    }

    const result = await analyzeTextSignals({ t1Text, t2Text, model })
    if (!result || !Array.isArray(result.signals) || result.signals.length === 0) {
      return { signals: [], aiUsed: false }
    }

    return {
      signals: result.signals,
      aiUsed: true,
      aiUsage: result.usage || null,
      aiModel: result.model || model.model,
      aiProvider: model.provider || ''
    }
  } catch (error) {
    console.warn('[createCase] AI text analysis failed, falling back to rules:', error?.message || error)
    return { signals: [], aiUsed: false }
  }
}

exports.main = async (event) => {
  const { name, answers, profile } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { success: false, message: '名称不能为空' }
    }

    const caseId = `case_${Date.now()}_${randomHex(4)}`
    const now = new Date()
    const answersList = answers || []
    const hasAnswers = answersList.length > 0

    let assessmentId = ''
    let aiAnalysis = { signals: [], aiUsed: false }

    if (hasAnswers) {
      assessmentId = `assessment_${Date.now()}_${randomHex(4)}`

      // 分析 T1/T2 主观文本（如果填写了）
      aiAnalysis = await analyzeTextAnswers(answersList, userId)

      const result = evaluateAssessment({
        assessmentId,
        answers: answersList,
        extractedTextSignals: aiAnalysis.signals
      })

      await db.collection('assessments').add({
        _id: assessmentId,
        caseId,
        source: 'initial_questionnaire',
        createdAt: now,
        ...result
      })

      // 记录 AI token 消耗（非阻塞）
      if (aiAnalysis.aiUsed && aiAnalysis.aiUsage) {
        recordTokenUsage(db, {
          userId,
          caseId,
          assessmentId,
          feature: AI_FEATURE_NAME,
          provider: aiAnalysis.aiProvider,
          model: aiAnalysis.aiModel,
          usage: aiAnalysis.aiUsage
        }).catch(err => {
          console.warn('[createCase] token usage recording failed:', err?.message || err)
        })
      }
    }

    const caseDoc = {
      _id: caseId,
      userId,
      name: name.trim(),
      profile: profile || {},
      createdAt: now,
      updatedAt: now
    }
    if (assessmentId) {
      caseDoc.latestResultId = assessmentId
    }

    await db.collection('cases').add(caseDoc)

    return { success: true, caseId, assessmentId: assessmentId || null }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('createCase error:', error)
    return { success: false, message: '创建档案失败' }
  }
}
