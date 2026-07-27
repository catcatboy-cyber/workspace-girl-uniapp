const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  parseJSONContent,
  getAIErrorMessage
} = require('./ai-http')
const { buildPromptMessages } = require('./ai-prompt-config')

const EVENT_TYPES = ['positive', 'risk', 'verification', 'note']
const SEMANTIC_SCENES = ['offline_meet', 'movie', 'meal', 'coffee_tea', 'walk', 'chat', 'gift', 'phone_call', 'online_chat', 'shopping', 'activity', 'study', 'work', 'travel', 'game', 'sport', 'music', 'pet', 'food', 'group_social']
const SEMANTIC_BEHAVIORS = ['target_side', 'self_side', 'self_initiated', 'both_interaction', 'target_initiated']
const SEMANTIC_OUTCOMES = ['planned', 'fulfilled', 'cancelled_delayed', 'pending', 'ai_reviewed']
const SEMANTIC_RISKS = ['risk_event', 'rejected', 'cold', 'vague_delay']
const INITIATORS = ['target', 'self', 'both', 'unknown']
const RESPONSES = ['accepted', 'rejected', 'pending', 'unclear', 'none']
const COMMITMENT_TYPES = ['meal_invitation', 'movie_invitation', 'meet_invitation', 'chat_followup', 'gift_or_help', 'other', 'none']

function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildTimelineRecordTitle(input) {
  const normalized = trimText(input)
  if (!normalized) return ''

  const firstChunk = normalized
    .split(/[。！？!?；;，,\n]/)
    .map((item) => item.trim())
    .find(Boolean) || normalized

  if (firstChunk.length <= 20) return firstChunk
  return `${firstChunk.slice(0, 20).trim()}...`
}

// mapRelationType 已从 case-profile.js 导入，不再本地定义

const { serializeCaseProfileForAI: _serializeCaseProfileForAI, mapRelationType } = require('./case-profile')

function serializeCaseProfile(profile) {
  return _serializeCaseProfileForAI(profile)
}

function describeSubjectRole(role) {
  if (role === 'self') {
    return 'self：这条记录主要描述用户自己。文本里的“我”是用户本人，不是关系对象。不要把用户的穿着、化妆、准备、情绪、表达当成对方释放的信号；“我主动问对方/我问他/我问她/我问对方”表示用户主动向关系对象提问，不能写成对方主动问用户；请分析它可能怎样影响互动，以及后续应该观察对方什么反应。'
  }
  if (role === 'both') {
    return 'both：这条记录描述双方互动。请先拆开“用户做了什么”和“关系对象回应/做了什么”，不要把用户自己的主动当成对方主动；尤其“我主动问对方/我问他/我问她/我问对方”是用户发起询问，不是对方问用户；只有对方的回应、承诺、兑现、回避等动作才能作为对方信号。'
  }
  if (role === 'unknown') {
    return 'unknown：行为主体不确定。请弱化权重，优先判为 note；除非文本明确写出对方回应、承诺、兑现、回避或失约，否则不要把它当成对方意向或风险信号。'
  }
  return 'target：这条记录主要描述关系对象。文本里的“他/她/对方”才是主要分析对象，请分析对方行为释放的关系信号。'
}

function normalizeSettings(settings) {
  // 新版多模型格式
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const defaultModel = settings.aiModels.find((m) => m.id === defaultId) || settings.aiModels[0] || {}
    const provider = typeof defaultModel.provider === 'string' && defaultModel.provider.trim()
      ? defaultModel.provider.trim()
      : ''
    return {
      enabled: Boolean(settings.aiEnabled),
      provider,
      apiKey: typeof defaultModel.apiKey === 'string' ? defaultModel.apiKey.trim() : '',
      baseUrl: typeof defaultModel.baseUrl === 'string' && defaultModel.baseUrl.trim()
        ? defaultModel.baseUrl.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'https://api.anthropic.com'
          : '',
      model: typeof defaultModel.model === 'string' && defaultModel.model.trim()
        ? defaultModel.model.trim()
        : provider.toLowerCase() === 'anthropic'
          ? 'claude-3-5-sonnet-20241022'
          : '',
      fallbackToRules: settings.aiFallbackToRules !== false,
      maxTokens: Number.isFinite(Number(settings.runtimeConfig?.eventUnderstandingMaxTokens))
        ? Math.round(Number(settings.runtimeConfig.eventUnderstandingMaxTokens))
        : 260,
      temperature: Number.isFinite(Number(settings.runtimeConfig?.eventUnderstandingTemperature))
        ? Number(settings.runtimeConfig.eventUnderstandingTemperature)
        : 0.1
    }
  }

  // 旧版单模型格式（兼容）
  const provider = typeof settings?.aiProvider === 'string' && settings.aiProvider.trim()
    ? settings.aiProvider.trim()
    : ''
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider,
    apiKey: typeof settings?.aiApiKey === 'string' ? settings.aiApiKey.trim() : '',
    baseUrl: typeof settings?.aiBaseUrl === 'string' && settings.aiBaseUrl.trim()
      ? settings.aiBaseUrl.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'https://api.anthropic.com'
        : '',
    model: typeof settings?.aiModel === 'string' && settings.aiModel.trim()
      ? settings.aiModel.trim()
      : provider.toLowerCase() === 'anthropic'
        ? 'claude-3-5-sonnet-20241022'
        : '',
    fallbackToRules: settings?.aiFallbackToRules !== false,
    maxTokens: Number.isFinite(Number(settings?.runtimeConfig?.eventUnderstandingMaxTokens))
      ? Math.round(Number(settings.runtimeConfig.eventUnderstandingMaxTokens))
      : 260,
    temperature: Number.isFinite(Number(settings?.runtimeConfig?.eventUnderstandingTemperature))
      ? Number(settings.runtimeConfig.eventUnderstandingTemperature)
      : 0.1
  }
}

function classifyTimelineEvent(description) {
  const content = String(description || '').toLowerCase()

  if (['验证', '核实', '查证', '求证', '证实', '兑现', '对上', '对不上', '截图', '账单', '定位', '录音'].some((item) => content.includes(item))) {
    return 'verification'
  }

  if ([
    '失联', '消失', '敷衍', '冷淡', '拖延', '推迟', '取消', '放鸽子', '失约', '回避', '拉黑',
    '矛盾', '骗', '撒谎', '借口', '没来', '拒绝', '婉拒', '不想', '不愿意', '不合适', '算了',
    '别联系', '没感觉', '不要', '不见', '不考虑'
  ].some((item) => content.includes(item))) {
    return 'risk'
  }

  if (['主动', '约', '见面', '吃饭', '礼物', '送我', '接我', '安排', '介绍朋友', '带我', '公开', '报备', '解释清楚', '道歉', '补偿'].some((item) => content.includes(item))) {
    return 'positive'
  }

  return 'note'
}

function includesAnyText(text, keywords) {
  return keywords.some((item) => text.includes(item))
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value)
}

function normalizeSemanticList(value, allowed) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter((item, index, list) => allowed.includes(item) && list.indexOf(item) === index)
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim()
  return allowed.includes(normalized) ? normalized : fallback
}

function fallbackSemanticTags(params) {
  const text = String(params.description || '').toLowerCase()
  const scene = []
  const behavior = []
  const outcome = []
  const risk = []

  if (includesAnyText(text, ['电影', '影院', '看电影', '看片', '观影'])) pushUnique(scene, 'movie')
  if (includesAnyText(text, ['吃饭', '晚饭', '午饭', '早餐', '夜宵', '火锅', '烧烤', '餐厅', '美食', '小吃'])) pushUnique(scene, 'meal')
  if (includesAnyText(text, ['咖啡', '奶茶', '喝咖啡', '喝奶茶', '饮料', '下午茶', '喝茶'])) pushUnique(scene, 'coffee_tea')
  if (includesAnyText(text, ['散步', '走走', '压马路', '逛公园', '逛'])) pushUnique(scene, 'walk')
  if (includesAnyText(text, ['逛街', '购物', '买东西', '逛商场', '买'])) pushUnique(scene, 'shopping')
  if (includesAnyText(text, ['朋友局', '朋友一起', '同学聚会', '多人活动', '聚会', '带我见朋友', '介绍朋友'])) pushUnique(scene, 'group_social')
  if (includesAnyText(text, ['旅行', '旅游', '出游', '郊游', '露营', '出行', '自驾'])) pushUnique(scene, 'travel')
  if (includesAnyText(text, ['聊天', '微信', '消息', '回复', '发消息', '语音', '视频'])) pushUnique(scene, 'chat')
  if (includesAnyText(text, ['打电话', '打电话给我', '打给我', '来电', '通话', '打电话', '拨电话'])) pushUnique(scene, 'phone_call')
  if (includesAnyText(text, ['微信聊', '线上聊', '语音聊', '发语音', '网上聊'])) pushUnique(scene, 'online_chat')
  if (includesAnyText(text, ['礼物', '送礼物', '送了', '送给', '礼物给我', '给我买了'])) pushUnique(scene, 'gift')
  if (includesAnyText(text, ['运动', '打球', '篮球', '足球', '羽毛球', '乒乓球', '网球', '游泳', '健身', '跑步', '锻炼', '爬山'])) pushUnique(scene, 'sport')
  if (includesAnyText(text, ['游戏', '打游戏', '玩游戏', '组队', '开黑', '电竞', '王者', '吃鸡'])) pushUnique(scene, 'game')
  if (includesAnyText(text, ['音乐', '听歌', '唱歌', 'ktv', '演唱会', '音乐会', '看演出', '看音乐剧', 'livehouse', '音乐节'])) pushUnique(scene, 'music')
  if (includesAnyText(text, ['宠物', '猫', '狗', '宠物', '遛狗'])) pushUnique(scene, 'pet')
  if (includesAnyText(text, ['看戏', '看剧', '看展', '看话剧', '看舞台剧', '看脱口秀', '看相声', '看展览', '博物馆', '美术馆', '活动', '参加活动', '看演出', '去演出', '演出'])) pushUnique(scene, 'activity')
  if (includesAnyText(text, ['学习', '上课', '图书馆', '自习', '一起学习', '读书', '看书'])) pushUnique(scene, 'study')
  if (includesAnyText(text, ['工作', '加班', '同事', '开会', '出差', '项目'])) pushUnique(scene, 'work')
  if (includesAnyText(text, ['美食', '探店', '甜品', '冰淇淋', '蛋糕', '小吃', '吃东西', '好吃的'])) pushUnique(scene, 'food')
  // 无具体活动时才归为"线下见面"，避免与电影/吃饭/运动等重叠
  if (scene.length === 0 && includesAnyText(text, ['见面', '碰面', '线下见', '出来见', '约会', '赴约', '见到了', '碰面了', '出来了'])) pushUnique(scene, 'offline_meet')

  const subjectRole = ['target', 'self', 'both', 'unknown'].includes(params.subjectRole) ? params.subjectRole : 'target'
  if (subjectRole === 'target') pushUnique(behavior, 'target_side')
  if (subjectRole === 'self') pushUnique(behavior, 'self_side')
  if (subjectRole === 'both') pushUnique(behavior, 'both_interaction')
  if (includesAnyText(text, ['主动约我', '主动找我', '主动联系我', '主动问我', '他问我', '她问我', '对方问我', '他主动', '她主动', '对方主动', '邀请我', '来找我', '主动确认'])) pushUnique(behavior, 'target_initiated')
  if (includesAnyText(text, ['我主动', '我先', '我约', '我问', '我问他', '我问她', '我问对方', '我主动问他', '我主动问她', '我主动问对方', '我发', '我联系'])) pushUnique(behavior, 'self_initiated')

  if (includesAnyText(text, ['答应', '说好', '确定', '确认', '约好', '安排', '计划', '下次', '改天', '周末'])) pushUnique(outcome, 'planned')
  if (includesAnyText(text, [
    '兑现', '落实', '说到做到', '真的来了', '来了', '到了', '赴约', '见到了',
    '一起去了', '一起看了', '一起吃了', '一起吃饭了', '一起吃饭', '吃完饭',
    '吃过饭', '实际吃饭', '真的一起吃', '真的去吃', '按时到了', '到场了',
    '安排好了', '定好了'
  ])) pushUnique(outcome, 'fulfilled')
  if (includesAnyText(text, ['取消', '改期', '推迟', '放鸽子', '失约', '没来', '拖延', '改口'])) pushUnique(outcome, 'cancelled_delayed')
  if (includesAnyText(text, ['待确认', '再看', '看情况', '以后再说', '不确定', '到时候再说'])) pushUnique(outcome, 'pending')

  if (classifyTimelineEvent(params.description) === 'risk') pushUnique(risk, 'risk_event')
  if (includesAnyText(text, ['拒绝', '被拒', '婉拒', '不去', '不想', '没答应', '算了', '推掉', '来不了'])) pushUnique(risk, 'rejected')
  if (includesAnyText(text, ['已读不回', '没回', '不回', '冷淡', '敷衍', '消失', '回避'])) pushUnique(risk, 'cold')
  if (includesAnyText(text, ['再看', '看情况', '以后再说', '不确定', '拖延', '改口'])) pushUnique(risk, 'vague_delay')

  let commitmentType = 'none'
  if (scene.includes('meal')) commitmentType = 'meal_invitation'
  else if (scene.includes('movie')) commitmentType = 'movie_invitation'
  else if (scene.includes('offline_meet')) commitmentType = 'meet_invitation'
  else if (scene.includes('chat')) commitmentType = 'chat_followup'

  return {
    scene,
    behavior,
    outcome,
    risk,
    initiator: behavior.includes('target_initiated') ? 'target' : behavior.includes('self_initiated') ? 'self' : subjectRole === 'both' ? 'both' : subjectRole === 'self' ? 'unknown' : subjectRole,
    response: risk.includes('rejected') ? 'rejected' : outcome.includes('fulfilled') || outcome.includes('planned') ? 'accepted' : outcome.includes('pending') ? 'pending' : 'unclear',
    commitment: {
      exists: outcome.includes('planned') || outcome.includes('fulfilled') || commitmentType !== 'none',
      type: commitmentType,
      promisedBy: subjectRole === 'self' ? 'self' : subjectRole === 'both' ? 'unknown' : 'target',
      fulfilled: outcome.includes('fulfilled')
    },
    source: 'rules'
  }
}

function normalizeSemanticTags(value, params, source = 'ai') {
  const semantic = value && typeof value === 'object' ? value : {}
  const fallback = fallbackSemanticTags(params)
  const commitment = semantic.commitment && typeof semantic.commitment === 'object' ? semantic.commitment : {}
  const scene = normalizeSemanticList(semantic.scene, SEMANTIC_SCENES)
  const behavior = normalizeSemanticList(semantic.behavior, SEMANTIC_BEHAVIORS)
  const outcome = normalizeSemanticList(semantic.outcome, SEMANTIC_OUTCOMES)
  const risk = normalizeSemanticList(semantic.risk, SEMANTIC_RISKS)
  return {
    scene: scene.length ? scene : fallback.scene,
    behavior: behavior.length ? behavior : fallback.behavior,
    outcome: outcome.length ? outcome : fallback.outcome,
    risk: risk.length ? risk : fallback.risk,
    initiator: normalizeEnum(semantic.initiator, INITIATORS, fallback.initiator),
    response: normalizeEnum(semantic.response, RESPONSES, fallback.response),
    commitment: {
      exists: typeof commitment.exists === 'boolean' ? commitment.exists : fallback.commitment.exists,
      type: normalizeEnum(commitment.type, COMMITMENT_TYPES, fallback.commitment.type),
      promisedBy: normalizeEnum(commitment.promisedBy, INITIATORS, fallback.commitment.promisedBy),
      fulfilled: typeof commitment.fulfilled === 'boolean' ? commitment.fulfilled : fallback.commitment.fulfilled
    },
    source
  }
}

function fallbackUnderstandEvent(params) {
  const subjectRole = ['target', 'self', 'both', 'unknown'].includes(params.subjectRole) ? params.subjectRole : 'target'
  const isWeakContext = subjectRole === 'self' || subjectRole === 'unknown'
  const semanticTags = fallbackSemanticTags(params)
  return {
    eventType: isWeakContext ? 'note' : classifyTimelineEvent(params.description),
    eventTitle: buildTimelineRecordTitle(params.description) || (subjectRole === 'self' ? '我的状态记录' : '关系记录'),
    summary: isWeakContext
      ? '这条记录先作为上下文记录，不直接当作对方信号。'
      : '当前使用规则自动识别事件类型与标题。',
    semanticTags,
    usedAI: false
  }
}

async function inferTimelineRecord(params) {
  const settings = normalizeSettings(params.settings)
  if (!settings.enabled || !settings.apiKey) {
    return fallbackUnderstandEvent(params)
  }

  const messages = buildPromptMessages({
    moduleKey: 'eventUnderstanding',
    settings: params.settings,
    contextLines: [
      '所有输出（eventTitle, summary）必须是简体中文，不允许英文。',
      `semanticTags 可选值：scene=[${SEMANTIC_SCENES.join('|')}] behavior=[${SEMANTIC_BEHAVIORS.join('|')}] outcome=[${SEMANTIC_OUTCOMES.join('|')}] risk=[${SEMANTIC_RISKS.join('|')}]。必须从可选值中选择，不要自创标签。同一事件优先选最具体的场景标签，offline_meet 仅在无更具体场景时使用（如仅描述'见面'而无电影/吃饭/运动等具体活动）。`,
      describeSubjectRole(params.subjectRole),
      `targetProfile=${serializeCaseProfile(params.caseProfile)}`,
      '主体宾语校验：“我主动问对方 / 我问他 / 我问她 / 我问对方”表示用户主动向关系对象提问；不要改写成“对方问我”或“对方主动问用户”。只有“对方问我 / 他问我 / 她问我 / 问我”才表示关系对象主动问用户。',
      `recentTimeline=${JSON.stringify((params.recentTimeline || []).slice(0, 3))}`,
      `newEvent=${JSON.stringify({
        subjectRole: ['target', 'self', 'both', 'unknown'].includes(params.subjectRole) ? params.subjectRole : 'target',
        description: params.description
      })}`
    ]
  })
  if (!messages) {
    return fallbackUnderstandEvent(params)
  }

  try {
    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      messages,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(`AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 180)}` : ''}`)
      if (settings.fallbackToRules) {
        console.error('[AI事件理解失败，回退到规则]', error.message)
        return fallbackUnderstandEvent(params)
      }
      throw error
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw || typeof raw !== 'string') {
      const error = new Error('AI 返回内容为空')
      if (settings.fallbackToRules) {
        console.error('[AI事件理解失败，回退到规则]', error.message)
        return fallbackUnderstandEvent(params)
      }
      throw error
    }

    const parsed = parseJSONContent(raw)
    const eventType = EVENT_TYPES.includes(parsed.eventType) ? parsed.eventType : classifyTimelineEvent(params.description)
    const eventTitle = buildTimelineRecordTitle(parsed.eventTitle) || buildTimelineRecordTitle(params.description) || '关系记录'

    return {
      eventType,
      eventTitle,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'AI 已完成事件理解。',
      semanticTags: normalizeSemanticTags(parsed.semanticTags, params, 'ai'),
      usedAI: true
    }
  } catch (error) {
    if (settings.fallbackToRules) {
      console.error('[AI事件理解失败，回退到规则]', getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS))
      return fallbackUnderstandEvent(params)
    }
    throw error
  }
}

module.exports = {
  buildTimelineRecordTitle,
  classifyTimelineEvent,
  inferTimelineRecord
}
