const { postChatCompletions, parseJSONContent } = require('./ai-http')

const VALID_CATEGORIES = [
  'initiative',
  'investment',
  'progression',
  'consistency',
  'avoidance',
  'verifiability',
  'instability',
  'evidence_strength'
]

const VALID_DIRECTIONS = ['positive', 'negative', 'neutral', 'uncertain']

const SYSTEM_PROMPT = `你是一个关系信号提取器。用户会提供两段文字描述（可能为空），你需要从中提取结构化关系信号。

## 8 个信号类别

| 类别 | 含义 | 正向示例 | 负向示例 |
|------|------|----------|----------|
| initiative | 主动性 | 对方主动约、主动发消息 | 总是你在推动 |
| investment | 投入度 | 认真回应、记住细节、花时间 | 敷衍、不走心 |
| progression | 关系推进 | 从陌生到熟悉、互动加深 | 停滞、退步 |
| consistency | 一致性 | 言行一致、前后不矛盾 | 说一套做一套 |
| avoidance | 回避度 | 愿意面对问题 | 逃避关键话题、不回应 |
| verifiability | 可验证性 | 说的有事实支撑 | 只有口头承诺、无法验证 |
| instability | 稳定性 | 互动频率可预期 | 忽冷忽热、突然消失又出现 |
| evidence_strength | 证据强度 | 有具体行为记录 | 只有主观感受 |

## 输入

- T1：用户描述"关系有推进/有好感迹象"的互动（正面信号为主）
- T2：用户描述"不一致、回避或不舒服"的互动（风险信号为主）

## 规则

1. 每道题最多提取 3 个信号
2. 每个信号的 weight（重要程度）和 magnitude（强度）为 1-3 的整数
3. 如果文字描述模糊、空洞或不包含实质互动信息，返回空数组
4. 只提取能从文字中直接或合理推断的信号，不要编造
5. direction 取值：positive（正向）、negative（负向）、neutral（中性）、uncertain（不确定）

## 输出格式

必须是纯 JSON：
{
  "signals": [
    {"category": "initiative", "direction": "positive", "weight": 2, "magnitude": 2}
  ]
}`

function buildUserPrompt(t1Text, t2Text) {
  const parts = []
  if (t1Text) {
    parts.push(`T1（关系推进/好感迹象）：\n${t1Text}`)
  } else {
    parts.push('T1（关系推进/好感迹象）：\n（未填写）')
  }
  if (t2Text) {
    parts.push(`T2（不一致/回避/不舒服的互动）：\n${t2Text}`)
  } else {
    parts.push('T2（不一致/回避/不舒服的互动）：\n（未填写）')
  }
  return parts.join('\n\n')
}

function validateSignal(signal) {
  if (!signal || typeof signal !== 'object') return false
  if (!VALID_CATEGORIES.includes(signal.category)) return false
  if (!VALID_DIRECTIONS.includes(signal.direction)) return false
  if (typeof signal.weight !== 'number' || signal.weight < 1 || signal.weight > 3) return false
  if (typeof signal.magnitude !== 'number' || signal.magnitude < 1 || signal.magnitude > 3) return false
  return true
}

/**
 * 分析 T1/T2 文本，提取结构化关系信号。
 *
 * @param {Object} params
 * @param {string} params.t1Text - T1 文本（可能为空）
 * @param {string} params.t2Text - T2 文本（可能为空）
 * @param {Object} params.model - AI 模型配置 { provider, apiKey, baseUrl, model }
 * @returns {Promise<{signals: Array}|null>} 有效信号数组，失败返回 null
 */
async function analyzeTextSignals(params) {
  const { t1Text, t2Text, model } = params
  const text1 = String(t1Text || '').trim()
  const text2 = String(t2Text || '').trim()

  if (!text1 && !text2) return null

  // 极短文本（少于 5 个有效字符）不调 AI
  const meaningfulChars = (text1 + text2).replace(/\s/g, '')
  if (meaningfulChars.length < 5) return null

  try {
    const response = await postChatCompletions({
      provider: model.provider,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      model: model.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text1, text2) }
      ],
      temperature: 0.2,
      maxTokens: 256,
      timeoutMs: 12000,
      responseFormat: { type: 'json_object' }
    })

    if (!response?.ok) {
      console.warn('[ai-text-analyzer] AI request failed:', response?.status)
      return null
    }

    const content = response.choices?.[0]?.message?.content
    if (!content) {
      console.warn('[ai-text-analyzer] empty response content')
      return null
    }

    const parsed = parseJSONContent(content)
    if (!parsed || !Array.isArray(parsed.signals)) {
      console.warn('[ai-text-analyzer] invalid response format:', content.slice(0, 200))
      return null
    }

    const validSignals = parsed.signals.filter(validateSignal)

    return {
      signals: validSignals,
      usage: response.usage || null,
      model: response.model || model.model
    }
  } catch (error) {
    console.error('[ai-text-analyzer] error:', error?.message || error)
    return null
  }
}

module.exports = {
  analyzeTextSignals,
  VALID_CATEGORIES,
  VALID_DIRECTIONS
}
