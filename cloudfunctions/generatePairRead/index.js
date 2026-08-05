/**
 * generatePairRead — AI增强双人桃花解读（结合当日/当月气场）
 *
 * 静态层：生肖地支关系 + 星座元素碰撞
 * 动态层：当日流日桃花方位 + 日支与两人属相关系 + 月令五行
 * AI层：综合静态+动态+timeline 上下文
 *
 * 依赖：_shared/auth, _shared/subscription, _shared/ai-http, _shared/token-usage
 */
const cloudbase = require('@cloudbase/node-sdk')
const { Solar } = require('lunar-javascript')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const { checkFeatureAccess, checkTokenBalance } = require('./_shared/subscription')
const { postChatCompletions, parseJSONContent, AI_REQUEST_TIMEOUT_MS } = require('./_shared/ai-http')
const { recordTokenUsage } = require('./_shared/token-usage')
const { resolveIdentityLabel } = require('./_shared/case-profile')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const ZODIAC_TO_ZHI = {
  '鼠':'子','牛':'丑','虎':'寅','兔':'卯','龙':'辰','蛇':'巳',
  '马':'午','羊':'未','猴':'申','鸡':'酉','狗':'戌','猪':'亥',
}
const ZHI_WUXING = { '寅':'木','卯':'木','巳':'火','午':'火','申':'金','酉':'金','亥':'水','子':'水','辰':'土','未':'土','戌':'土','丑':'土' }
const ZHI_DIR = { '子':'正北','丑':'东北','寅':'东北','卯':'正东','辰':'东南','巳':'东南','午':'正南','未':'西南','申':'西南','酉':'正西','戌':'西北','亥':'西北' }

const LIUHE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' }
const LIUCHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' }
const SANHE_TAOHUA = { '申':'酉','子':'酉','辰':'酉', '亥':'子','卯':'子','未':'子', '寅':'卯','午':'卯','戌':'卯', '巳':'午','酉':'午','丑':'午' }

function sanheMembers(zhi) {
  const m = { '申':['子','辰'],'子':['申','辰'],'辰':['申','子'],'亥':['卯','未'],'卯':['亥','未'],'未':['亥','卯'],'寅':['午','戌'],'午':['寅','戌'],'戌':['寅','午'],'巳':['酉','丑'],'酉':['巳','丑'],'丑':['巳','酉'] }
  return m[zhi] || []
}

function buildDailyGanzhi() {
  const solar = Solar.fromDate(new Date())
  const lunar = solar.getLunar()
  return {
    dayZhi: lunar.getDayZhi(),
    monthZhi: lunar.getMonthZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    monthPillar: lunar.getMonthInGanZhi(),
  }
}

// ── 静态匹配 ──
function staticPairMatch(selfZodiac, selfSign, partnerZodiac, partnerSign) {
  const selfZhi = ZODIAC_TO_ZHI[selfZodiac]
  const partnerZhi = ZODIAC_TO_ZHI[partnerZodiac]
  if (!selfZhi || !partnerZhi) return null

  let relation = '平', relationDesc = ''
  if (partnerZhi === selfZhi) { relation = '同宫'; relationDesc = '地支相同，个性强烈纯粹。' }
  else if (LIUHE[selfZhi] === partnerZhi) { relation = '六合（大吉）'; relationDesc = '地支六合，阴阳互补，天作之合。' }
  else if (sanheMembers(selfZhi).includes(partnerZhi)) { relation = '三合（吉利）'; relationDesc = '同属三合局，五行相互助力。' }
  else if (LIUCHONG[selfZhi] === partnerZhi) { relation = '六冲（冲突）'; relationDesc = '地支六冲，激情与波动并存。' }

  return { self: { zodiac: selfZodiac, zhi: selfZhi, sign: selfSign }, partner: { zodiac: partnerZodiac, zhi: partnerZhi, sign: partnerSign }, relation, relationDesc }
}

// ── 当日/当月气场分析 ──
function dailyContext(match) {
  const dailyGanzhi = buildDailyGanzhi()
  const dayZhi = dailyGanzhi.dayZhi
  const monthZhi = dailyGanzhi.monthZhi
  const taohuaZhi = SANHE_TAOHUA[dayZhi] || '午'
  const taohuaDir = ZHI_DIR[taohuaZhi] || '正南'
  const taohuaWuxing = ZHI_WUXING[taohuaZhi] || '火'
  const tianxiZhi = LIUHE[dayZhi] || ''
  const tianxiDir = tianxiZhi ? ZHI_DIR[tianxiZhi] || '' : ''
  const monthWuxing = ZHI_WUXING[monthZhi] || '土'

  // 日支与两人属相的关系
  const selfDayRel = dayZhi === match.self.zhi ? '同宫' : LIUHE[dayZhi] === match.self.zhi ? `六合（日支${dayZhi}合你的${match.self.zhi}）` : LIUCHONG[dayZhi] === match.self.zhi ? `六冲（日支${dayZhi}冲你的${match.self.zhi}）` : sanheMembers(dayZhi).includes(match.self.zhi) ? `三合（日支${dayZhi}扶你的${match.self.zhi}）` : '平'
  const partnerDayRel = dayZhi === match.partner.zhi ? '同宫' : LIUHE[dayZhi] === match.partner.zhi ? `六合` : LIUCHONG[dayZhi] === match.partner.zhi ? `六冲` : sanheMembers(dayZhi).includes(match.partner.zhi) ? `三合` : '平'

  return {
    dayZhi, monthZhi,
    dayGanZhi: dailyGanzhi.dayGanZhi,
    monthPillar: dailyGanzhi.monthPillar,
    taohuaZhi, taohuaDir, taohuaWuxing,
    tianxiZhi, tianxiDir,
    monthWuxing,
    selfDayRel, partnerDayRel,
  }
}

// ── AI 配置 ──
function getAISettings() {
  return db.collection('system_settings').doc('settings_global_ai').get()
    .then(res => (res?.data && res.data.length > 0) ? res.data[0] : null)
    .catch(() => null)
}

function normalizeSettings(raw) {
  if (!raw) return { enabled: false }
  if (raw.settingsVersion === 2 && Array.isArray(raw.aiModels)) {
    const defaultId = raw.aiDefaultModelId || 'default'
    const model = raw.aiModels.find(m => m.id === defaultId) || raw.aiModels[0] || {}
    return { enabled: Boolean(raw.aiEnabled), provider: model.provider || 'openai-compatible', apiKey: model.apiKey || '', baseUrl: model.baseUrl || 'https://api.openai.com/v1', model: model.model || 'gpt-4o-mini' }
  }
  return { enabled: Boolean(raw?.aiEnabled), provider: raw?.aiProvider || 'openai-compatible', apiKey: raw?.aiApiKey || '', baseUrl: raw?.aiBaseUrl || 'https://api.openai.com/v1', model: raw?.aiModel || 'gpt-4o-mini' }
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

// ── 静态兜底（AI不可用时） ──
function fallbackInsight(match, dayCtx) {
  const parts = []
  // 基础关系
  parts.push(`你们的地支关系是${match.relation}。${match.relationDesc}`)
  // 今日气场
  const selfHint = dayCtx.selfDayRel.includes('冲') ? `今天日支${dayCtx.dayZhi}冲你的属相${match.self.zhi}，你容易敏感，别把小事放大。` : dayCtx.selfDayRel.includes('合') ? `今天日支${dayCtx.dayZhi}合你的属相，你状态在线，适合主动。` : ''
  if (selfHint) parts.push(selfHint)
  const partnerHint = dayCtx.partnerDayRel.includes('冲') ? `日支也冲TA的属相，TA今天可能比较冷淡。` : dayCtx.partnerDayRel.includes('合') ? `日支也合TA的属相，TA今天比较愿意回应。` : ''
  if (partnerHint) parts.push(partnerHint)
  // 今日桃花 + 五行
  parts.push(`今日桃花在${dayCtx.taohuaDir}（${dayCtx.taohuaZhi}位，属${dayCtx.taohuaWuxing}），月令${dayCtx.monthWuxing}。`)
  return { relationshipDynamics: parts.join(' '), dayEnergy: `今日日支${dayCtx.dayZhi}，桃花在${dayCtx.taohuaDir}`, monthTrend: `月令${dayCtx.monthWuxing}，${match.relation}`+'基础上叠加当月气场', advice: '结合今日气场：重点关注对方的回应模式。', dayContext: dayCtx, fallback: true }
}

// ── 主入口 ──
exports.main = async (event = {}) => {
  const { caseId } = event || {}

  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const access = await checkFeatureAccess(db, userId, '命理桃花')
    if (!access.allowed) return { success: false, code: 'FEATURE_NOT_AVAILABLE', message: access.reason }

    const settings = normalizeSettings(await getAISettings())
    const tokCheck = await checkTokenBalance(db, userId, {
      featureKey: 'pairRead',
      modelId: settings?.model,
      fallbackTokens: 2000
    })
    if (!tokCheck.ok) return { success: false, code: tokCheck.code, message: tokCheck.message, ...tokCheck }

    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const selfRes = await db.collection('users').doc(userId).get().catch(() => null)
    const selfProfile = (selfRes?.data && selfRes.data.length > 0) ? selfRes.data[0].selfProfile : null
    const caseProfile = caseDoc?.profile || {}

    if (!selfProfile?.zodiac || !selfProfile?.constellation || !caseProfile?.zodiac || !caseProfile?.constellation) {
      return { success: false, message: '双方画像信息不完整，请先完善生肖和星座' }
    }

    const match = staticPairMatch(selfProfile.zodiac, selfProfile.constellation, caseProfile.zodiac, caseProfile.constellation)
    if (!match) return { success: false, message: '无法计算匹配度' }

    const dayCtx = dailyContext(match)

    let aiEnhanced = null

    if (settings.enabled && settings.apiKey) {
      try {
        const systemPrompt = `你是命理桃花解读助手。结合生肖地支、星座元素、当日流日桃花气场，给出个性化动态双人关系解读。不要涉及具体互动记录，专注命理层面的分析。

今日背景（重要——每次解读都会变化）：
- 日支：${dayCtx.dayZhi}（今日咸池桃花在${dayCtx.taohuaZhi}位，${dayCtx.taohuaDir}方向，属${dayCtx.taohuaWuxing}）
- 天喜：${dayCtx.tianxiZhi ? `${dayCtx.tianxiZhi}位（${dayCtx.tianxiDir}方向）` : '无'}
- 月令五行：${dayCtx.monthWuxing}（农历${dayCtx.monthZhi}月）
- 日支与本人(属${match.self.zodiac}，地支${match.self.zhi})的关系：${dayCtx.selfDayRel}
- 日支与对方(属${match.partner.zodiac}，地支${match.partner.zhi})的关系：${dayCtx.partnerDayRel}

输出JSON格式：
{
  "dayEnergy": "一句话总结今日气场对你们的影响（50字以内）",
  "monthTrend": "本月整体五行趋势对你们关系的长期影响（50字以内）",
  "relationshipDynamics": "综合静态匹配+当日气场的关系动态分析（80字以内）",
  "advice": "结合今日桃花方位和日支关系给出的具体建议（60字以内）"
}`

        const personalityContext = {}
        if (selfProfile.mbtiCode) personalityContext.selfMbti = selfProfile.mbtiCode
        if (caseProfile.mbtiCode) personalityContext.partnerMbti = caseProfile.mbtiCode
        const identityResolved = resolveIdentityLabel(caseProfile)
        if (identityResolved) personalityContext.partnerIdentity = identityResolved
        const personalityContextStr = Object.keys(personalityContext).length > 0
          ? `\n性格与关系参考（可选，用于调整沟通语气，不据此断言对方意图）：${JSON.stringify(personalityContext)}`
          : ''

        const userPrompt = `本人：属${selfProfile.zodiac}（${match.self.zhi}），${selfProfile.constellation}\n对方：属${caseProfile.zodiac}（${match.partner.zhi}），${caseProfile.constellation}\n地支关系：${match.relation}（${match.relationDesc}）\n今日：日支${dayCtx.dayZhi}，桃花在${dayCtx.taohuaDir}，日支与本人${dayCtx.selfDayRel}，与对方${dayCtx.partnerDayRel}${personalityContextStr}`

        const response = await postChatCompletions({
          provider: settings.provider,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
          responseFormat: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          maxTokens: 800
        })

        if (response.ok) {
          const data = await response.json()
          const raw = data?.choices?.[0]?.message?.content
          aiEnhanced = parseJSONContent(raw)
          await recordTokenUsage(db, { userId, caseId, feature: 'pairRead', provider: settings.provider, model: settings.model, usage: data?.usage })
        }
      } catch (err) {
        console.warn('pairRead AI failed:', err.message)
        aiEnhanced = fallbackInsight(match, dayCtx)
      }
    }

    if (!aiEnhanced) aiEnhanced = fallbackInsight(match, dayCtx)

    return {
      success: true,
      staticMatch: match,
      aiEnhanced: { ...aiEnhanced, day: dayCtx.dayZhi, taohuaDir: dayCtx.taohuaDir },
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('generatePairRead error:', error)
    return { success: false, message: '双人解读生成失败' }
  }
}
