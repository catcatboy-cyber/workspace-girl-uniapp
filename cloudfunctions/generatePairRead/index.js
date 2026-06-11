/**
 * generatePairRead — AI增强双人桃花解读
 *
 * 静态层：生肖地支关系 + 星座元素碰撞（纯查表）
 * AI层：结合 timeline 上下文生成个性化双人解读
 *
 * 依赖：_shared/auth, _shared/subscription, _shared/ai-http, _shared/token-usage
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const { checkFeatureAccess, checkTokenBalance, consumeTokens } = require('./_shared/subscription')
const { postChatCompletions, parseJSONContent, AI_REQUEST_TIMEOUT_MS } = require('./_shared/ai-http')
const { recordTokenUsage } = require('./_shared/token-usage')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const ZODIAC_TO_ZHI = {
  '鼠':'子','牛':'丑','虎':'寅','兔':'卯','龙':'辰','蛇':'巳',
  '马':'午','羊':'未','猴':'申','鸡':'酉','狗':'戌','猪':'亥',
}

const LIUHE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' }
const LIUCHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' }

function sanheMembers(zhi) {
  const m = { '申':['子','辰'],'子':['申','辰'],'辰':['申','子'],'亥':['卯','未'],'卯':['亥','未'],'未':['亥','卯'],'寅':['午','戌'],'午':['寅','戌'],'戌':['寅','午'],'巳':['酉','丑'],'酉':['巳','丑'],'丑':['巳','酉'] }
  return m[zhi] || []
}

function staticPairMatch(selfZodiac, selfSign, partnerZodiac, partnerSign) {
  const selfZhi = ZODIAC_TO_ZHI[selfZodiac]
  const partnerZhi = ZODIAC_TO_ZHI[partnerZodiac]
  if (!selfZhi || !partnerZhi) return null

  let relation = '平', relationDesc = ''
  if (partnerZhi === selfZhi) { relation = '同宫'; relationDesc = '地支相同，个性强烈纯粹。' }
  else if (LIUHE[selfZhi] === partnerZhi) { relation = '六合（大吉）'; relationDesc = '地支六合，阴阳互补，天作之合。' }
  else if (sanheMembers(selfZhi).includes(partnerZhi)) { relation = '三合（吉利）'; relationDesc = '同属三合局，五行相互助力。' }
  else if (LIUCHONG[selfZhi] === partnerZhi) { relation = '六冲（冲突）'; relationDesc = '地支六冲，激情与波动并存。' }

  return {
    self: { zodiac: selfZodiac, zhi: selfZhi, sign: selfSign },
    partner: { zodiac: partnerZodiac, zhi: partnerZhi, sign: partnerSign },
    relation, relationDesc
  }
}

function getAISettings() {
  return db.collection('system_settings').doc('settings_global_ai').get()
    .then(res => (res?.data && res.data.length > 0) ? res.data[0] : null)
    .catch(() => null)
}

// Normalize settings
function normalizeSettings(raw) {
  if (!raw) return { enabled: false }
  if (raw.settingsVersion === 2 && Array.isArray(raw.aiModels)) {
    const defaultId = raw.aiDefaultModelId || 'default'
    const model = raw.aiModels.find(m => m.id === defaultId) || raw.aiModels[0] || {}
    return {
      enabled: Boolean(raw.aiEnabled),
      provider: model.provider || 'openai-compatible',
      apiKey: model.apiKey || '',
      baseUrl: model.baseUrl || 'https://api.openai.com/v1',
      model: model.model || 'gpt-4o-mini',
    }
  }
  return {
    enabled: Boolean(raw?.aiEnabled),
    provider: raw?.aiProvider || 'openai-compatible',
    apiKey: raw?.aiApiKey || '',
    baseUrl: raw?.aiBaseUrl || 'https://api.openai.com/v1',
    model: raw?.aiModel || 'gpt-4o-mini',
  }
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

exports.main = async (event = {}) => {
  const { caseId } = event || {}

  try {
    const userId = await requireAuthenticatedUserId(app, event)

    // Feature gate
    const access = await checkFeatureAccess(db, userId, '命理桃花')
    if (!access.allowed) {
      return { success: false, code: 'FEATURE_NOT_AVAILABLE', message: access.reason }
    }

    // Token gate
    const tokCheck = await checkTokenBalance(db, userId, 2000)
    if (!tokCheck.ok) {
      return { success: false, code: tokCheck.code, message: tokCheck.message, ...tokCheck }
    }

    // Get case + profiles
    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const selfRes = await db.collection('users').doc(userId).get().catch(() => null)
    const selfProfile = (selfRes?.data && selfRes.data.length > 0) ? selfRes.data[0].selfProfile : null
    const caseProfile = caseDoc?.profile || {}

    if (!selfProfile?.zodiac || !selfProfile?.constellation || !caseProfile?.zodiac || !caseProfile?.constellation) {
      return { success: false, message: '双方画像信息不完整，请先完善生肖和星座' }
    }

    // Static match
    const staticMatch = staticPairMatch(selfProfile.zodiac, selfProfile.constellation, caseProfile.zodiac, caseProfile.constellation)
    if (!staticMatch) {
      return { success: false, message: '无法计算匹配度' }
    }

    // Get recent timeline for context
    const { data: timeline } = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .limit(10)
      .get()

    const recentEvents = (timeline || [])
      .filter(item => !['assessment', 'trend', 'monthly_review', 'weekly_review'].includes(item.type))
      .slice(0, 5)
      .map(item => ({
        title: cleanText(item.title || '', 60),
        type: item.type || 'note',
        description: cleanText(String(item.description || ''), 120),
      }))

    // AI enhanced reading
    const settings = normalizeSettings(await getAISettings())
    let aiEnhanced = null

    if (settings.enabled && settings.apiKey) {
      try {
        const response = await postChatCompletions({
          provider: settings.provider,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
          responseFormat: { type: 'json_object' },
          messages: [
            { role: 'system', content: '你是命理桃花解读助手。基于生肖地支关系和星座元素，结合互动记录，给出个性化双人关系解读。输出JSON: {"relationshipDynamics":"关系动态","timelineInsight":"从互动记录看出的模式","advice":"建议"}' },
            { role: 'user', content: `本人：属${selfProfile.zodiac}（${staticMatch.self.zhi}），${selfProfile.constellation}\n对方：属${caseProfile.zodiac}（${staticMatch.partner.zhi}），${caseProfile.constellation}\n地支关系：${staticMatch.relation}（${staticMatch.relationDesc}）\n近期互动：${JSON.stringify(recentEvents)}` }
          ],
          temperature: 0.5,
          maxTokens: 600
        })

        if (response.ok) {
          const data = await response.json()
          const raw = data?.choices?.[0]?.message?.content
          aiEnhanced = parseJSONContent(raw)

          await recordTokenUsage(db, {
            userId, caseId,
            feature: 'pairRead',
            provider: settings.provider,
            model: settings.model,
            usage: data?.usage
          })

          await consumeTokens(db, userId, data?.usage?.total_tokens || 1500, 'pairRead', settings.model)
        }
      } catch (err) {
        console.warn('pairRead AI failed:', err.message)
        aiEnhanced = { fallback: true, message: 'AI 解读暂时不可用，以下为静态匹配结果' }
      }
    }

    return {
      success: true,
      staticMatch,
      aiEnhanced: aiEnhanced || { message: 'AI 未启用，升级套餐获取 AI 增强解读' },
      recentEventsCount: recentEvents.length,
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('generatePairRead error:', error)
    return { success: false, message: '双人解读生成失败' }
  }
}
