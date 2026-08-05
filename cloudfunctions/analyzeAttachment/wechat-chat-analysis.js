const MAX_WECHAT_SCREENSHOTS = 6
const MAX_EXTRACTED_TEXT_LENGTH = 6000

const FIXED_WECHAT_CHAT_PROMPT = `
任务：把图片中的两个人微信聊天记录提取为文字版，并严格保留聊天在截图中的阅读顺序。

身份判定标准：
- 右边发出的聊天气泡是“我”。气泡和右边我的头像行对齐，且气泡的小箭头指向右边头像。
- 左边发出的聊天气泡是“对方”。气泡顶部和左边对方头像行对齐，且气泡的小箭头指向左边头像。

严格规则：
1. 只支持微信一对一双人聊天截图。
2. 微信群聊、朋友圈、个人资料页、其他聊天软件、普通照片必须拒绝。
3. 不得根据气泡颜色判断身份，必须根据头像位置、气泡方向和箭头方向判断。
4. 忽略状态栏、导航栏、输入框、按钮等非聊天内容。
5. 不要仅按 HH:mm 重新排序。每张截图内按从上到下的阅读顺序输出；多张截图按输入 imageIndex 顺序输出。sequence 只表示这个阅读顺序。
6. 识别到日期分隔线时，把日期原样写入其后消息的 dateLabel，例如“8月4日”“昨天”；只有 HH:mm 不能用于跨日期排序。没有可见日期时 dateLabel 为空字符串。
7. 多张截图存在重叠消息时只保留一次；日期不同的相同文本不是重叠消息。
8. 看不清的文字写为“无法辨认”，禁止猜测或补写。只有说话人和时间能够确认时才保留该条；说话人无法确认时不要强行归为“我”或“对方”。
9. imageIndex 从 0 开始，对应输入截图编号减 1。
10. sequence 是所有有效截图合并后的全局阅读顺序，从 1 开始连续递增。
11. 只输出可解析 JSON，不要输出 Markdown。

输出结构：
{
  "isWechatChatScreenshot": true,
  "isTwoPartyChat": true,
  "confidence": "low|medium|high",
  "images": [
    { "imageIndex": 0, "accepted": true, "reason": "" }
  ],
  "messages": [
    { "sequence": 1, "imageIndex": 0, "dateLabel": "8月4日", "time": "14:32", "speaker": "self|other", "text": "聊天文字" }
  ],
  "rejectReason": ""
}
`.trim()

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
}

function normalizeImageIndex(value, imageCount) {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0 || index >= imageCount) return -1
  return index
}

function normalizeWechatAnalysis(parsed, imageCount) {
  const source = parsed && typeof parsed === 'object' ? parsed : {}
  const totalImages = Math.max(0, Math.min(MAX_WECHAT_SCREENSHOTS, Number(imageCount) || 0))
  const acceptedSet = new Set()
  const rejectedMap = new Map()

  const imageResults = Array.isArray(source.images) ? source.images : []
  for (const item of imageResults) {
    if (!item || typeof item !== 'object') continue
    const imageIndex = normalizeImageIndex(item.imageIndex, totalImages)
    if (imageIndex < 0) continue
    if (item.accepted === true) acceptedSet.add(imageIndex)
    if (item.accepted === false) {
      rejectedMap.set(imageIndex, cleanText(item.reason, 120) || '不是有效的微信双人聊天截图')
    }
  }

  const explicitAccepted = Array.isArray(source.acceptedIndexes) ? source.acceptedIndexes : []
  for (const value of explicitAccepted) {
    const imageIndex = normalizeImageIndex(value, totalImages)
    if (imageIndex >= 0) acceptedSet.add(imageIndex)
  }

  const explicitRejected = Array.isArray(source.rejectedImages) ? source.rejectedImages : []
  for (const item of explicitRejected) {
    if (!item || typeof item !== 'object') continue
    const imageIndex = normalizeImageIndex(item.index ?? item.imageIndex, totalImages)
    if (imageIndex < 0) continue
    rejectedMap.set(imageIndex, cleanText(item.reason, 120) || '不是有效的微信双人聊天截图')
  }

  const rawMessages = Array.isArray(source.messages) ? source.messages : []
  const normalizedMessages = rawMessages
    .map((item, position) => {
      if (!item || typeof item !== 'object') return null
      const speaker = item.speaker === 'self' || item.speaker === 'other' ? item.speaker : ''
      const text = cleanText(item.text, 800).replace(/\s*\n\s*/g, ' ')
      if (!speaker || !text) return null
      const imageIndex = normalizeImageIndex(item.imageIndex, totalImages)
      if (imageIndex < 0) return null
      const parsedSequence = Number(item.sequence)
      return {
        sequence: Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : position + 1,
        imageIndex,
        dateLabel: cleanText(item.dateLabel, 40),
        time: cleanText(item.time, 40),
        speaker,
        text,
        _position: position
      }
    })
    .filter(Boolean)

  if (acceptedSet.size === 0 && source.isWechatChatScreenshot === true && source.isTwoPartyChat === true) {
    normalizedMessages.forEach((item) => acceptedSet.add(item.imageIndex))
    if (acceptedSet.size === 0 && totalImages === 1) acceptedSet.add(0)
  }

  const acceptedIndexes = [...acceptedSet]
    .filter((index) => !rejectedMap.has(index))
    .sort((a, b) => a - b)
  const acceptedLookup = new Set(acceptedIndexes)
  const seenAcrossImages = new Map()
  const messages = normalizedMessages
    .filter((item) => acceptedLookup.has(item.imageIndex))
    .sort((a, b) => a.sequence - b.sequence || a._position - b._position)
    .filter((item) => {
      const key = `${item.dateLabel.replace(/\s+/g, '')}|${item.speaker}|${item.time.replace(/\s+/g, '')}|${item.text.replace(/\s+/g, '')}`
      const previousImageIndex = seenAcrossImages.get(key)
      if (previousImageIndex !== undefined && previousImageIndex !== item.imageIndex) return false
      if (previousImageIndex === undefined) seenAcrossImages.set(key, item.imageIndex)
      return true
    })
    .map((item, index) => ({
      sequence: index + 1,
      imageIndex: item.imageIndex,
      dateLabel: item.dateLabel,
      time: item.time,
      speaker: item.speaker,
      text: item.text
    }))

  const extractedText = messages
    .map((item) => {
      const timestamp = [item.dateLabel, item.time || '时间未显示'].filter(Boolean).join(' ')
      return `[${timestamp}] ${item.speaker === 'self' ? '我' : '对方'}：${item.text}`
    })
    .join('\n')
  const isWechatChatScreenshot = source.isWechatChatScreenshot === true && acceptedIndexes.length > 0
  const isTwoPartyChat = source.isTwoPartyChat === true && isWechatChatScreenshot
  const confidence = ['low', 'medium', 'high'].includes(source.confidence) ? source.confidence : 'low'
  const rejectedImages = [...rejectedMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, reason]) => ({ index, reason }))
  const rejectReason = cleanText(source.rejectReason, 160)
    || rejectedImages[0]?.reason
    || (!isWechatChatScreenshot ? '仅支持清晰的微信双人聊天截图' : '')

  return {
    isWechatChatScreenshot,
    isTwoPartyChat,
    confidence,
    acceptedIndexes,
    rejectedImages,
    messages,
    extractedText,
    exceedsTextLimit: extractedText.length > MAX_EXTRACTED_TEXT_LENGTH,
    rejectReason
  }
}

module.exports = {
  MAX_WECHAT_SCREENSHOTS,
  MAX_EXTRACTED_TEXT_LENGTH,
  FIXED_WECHAT_CHAT_PROMPT,
  normalizeWechatAnalysis
}
