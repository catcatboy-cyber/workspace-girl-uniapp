// event-tagger.js — 批量语义打标
// 打开时间轴时懒加载调用，不阻塞页面

const TAG_VOCAB = {
  scene: ['offline_meet', 'movie', 'meal', 'coffee_tea', 'walk_shop', 'chat', 'group_social', 'trip'],
  behavior: ['target_initiated', 'self_initiated', 'both_interaction'],
  outcome: ['planned', 'fulfilled', 'cancelled_delayed', 'pending', 'rejected'],
  risk: ['cold', 'vague_delay', 'risk_event']
}

const SYSTEM_PROMPT = `你是关系事件标签分类器。只输出 JSON，不输出任何解释文字。

标签词表：
- scene: ${TAG_VOCAB.scene.join(' | ')}
- behavior: ${TAG_VOCAB.behavior.join(' | ')}
- outcome: ${TAG_VOCAB.outcome.join(' | ')}
- risk: ${TAG_VOCAB.risk.join(' | ')}

关键规则：
1. 如果前一条事件有 planned（计划/承诺），后一条描述了对应行为，标记为 fulfilled
2. 如果前一条有计划但后续无对应事件，不强行标记
3. 只根据事件描述判断，不猜测
4. 每条事件可以同时有 scene、behavior、outcome、risk 标签
5. 同一维度可以有多个标签

输出 JSON 格式：{"results": [{"index": 0, "scene": [], "behavior": [], "outcome": [], "risk": []}]}`

/**
 * 构建事件列表上下文
 */
function buildEventsContext(events) {
  return events.map((item, i) => {
    const date = item.occurrenceAt
      ? new Date(item.occurrenceAt).toISOString().slice(0, 10)
      : '未知日期'
    return `${i}. [${date}] ${item.title || ''} | ${item.description || ''}`
  }).join('\n')
}

/**
 * 解析 AI 返回的标签结果
 */
function parseTagResults(raw, count) {
  try {
    const parsed = JSON.parse(raw)
    const results = Array.isArray(parsed && parsed.results) ? parsed.results : []
    return results.map((item) => {
      const index = Number(item.index)
      if (!Number.isFinite(index) || index < 0 || index >= count) return null
      return {
        index,
        scene: filterTags(item.scene, TAG_VOCAB.scene),
        behavior: filterTags(item.behavior, TAG_VOCAB.behavior),
        outcome: filterTags(item.outcome, TAG_VOCAB.outcome),
        risk: filterTags(item.risk, TAG_VOCAB.risk)
      }
    }).filter(Boolean)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try { return parseTagResults(match[0], count) } catch { return [] }
    }
    return []
  }
}

function filterTags(values, vocab) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((tag) => vocab.includes(tag)))].slice(0, 4)
}

module.exports = {
  TAG_VOCAB,
  SYSTEM_PROMPT,
  buildEventsContext,
  parseTagResults
}
