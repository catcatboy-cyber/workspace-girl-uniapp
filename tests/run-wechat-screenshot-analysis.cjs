const assert = require('node:assert/strict')
const path = require('node:path')

const {
  FIXED_WECHAT_CHAT_PROMPT,
  MAX_EXTRACTED_TEXT_LENGTH,
  normalizeWechatAnalysis
} = require(path.resolve(__dirname, '../cloudfunctions/analyzeAttachment/wechat-chat-analysis.js'))
const { findVisionModel } = require(path.resolve(__dirname, '../cloudfunctions/analyzeAttachment/vision-model.js'))

function run() {
  assert.equal(findVisionModel({ aiModels: [] }), null)
  assert.equal(findVisionModel({
    aiDefaultModelId: 'text-default',
    aiModels: [
      { id: 'text-default', supportsVision: false },
      { id: 'vision-1', supportsVision: true }
    ]
  }).id, 'vision-1')
  assert.equal(findVisionModel({
    aiDefaultModelId: 'vision-2',
    aiModels: [
      { id: 'vision-1', supportsVision: true },
      { id: 'vision-2', supportsVision: true }
    ]
  }).id, 'vision-2')

  assert.match(FIXED_WECHAT_CHAT_PROMPT, /右边发出的聊天气泡是“我”/)
  assert.match(FIXED_WECHAT_CHAT_PROMPT, /左边发出的聊天气泡是“对方”/)
  assert.match(FIXED_WECHAT_CHAT_PROMPT, /不得根据气泡颜色判断身份/)
  assert.match(FIXED_WECHAT_CHAT_PROMPT, /只支持微信一对一双人聊天截图/)
  assert.match(FIXED_WECHAT_CHAT_PROMPT, /不要仅按 HH:mm 重新排序/)

  const merged = normalizeWechatAnalysis({
    isWechatChatScreenshot: true,
    isTwoPartyChat: true,
    confidence: 'high',
    images: [
      { imageIndex: 0, accepted: true, reason: '' },
      { imageIndex: 1, accepted: true, reason: '' }
    ],
    messages: [
      { sequence: 3, imageIndex: 1, time: '14:33', speaker: 'other', text: '刚下班' },
      { sequence: 1, imageIndex: 0, time: '14:32', speaker: 'self', text: '在干嘛' },
      { sequence: 2, imageIndex: 1, time: '14:32', speaker: 'self', text: '在干嘛' },
      { sequence: 4, imageIndex: 1, time: '', speaker: 'self', text: '那你先休息' }
    ]
  }, 2)

  assert.deepEqual(merged.acceptedIndexes, [0, 1])
  assert.equal(merged.messages.length, 3)
  assert.equal(merged.messages[0].speaker, 'self')
  assert.equal(merged.messages[1].speaker, 'other')
  assert.equal(merged.extractedText, [
    '[14:32] 我：在干嘛',
    '[14:33] 对方：刚下班',
    '[时间未显示] 我：那你先休息'
  ].join('\n'))

  const crossDate = normalizeWechatAnalysis({
    isWechatChatScreenshot: true,
    isTwoPartyChat: true,
    images: [{ imageIndex: 0, accepted: true }],
    messages: [
      { sequence: 1, imageIndex: 0, dateLabel: '8月4日', time: '20:05', speaker: 'self', text: '说明你娃运气爆棚' },
      { sequence: 2, imageIndex: 0, dateLabel: '8月3日', time: '14:53', speaker: 'other', text: '通话时长 00:37' },
      { sequence: 3, imageIndex: 0, dateLabel: '8月3日', time: '12:53', speaker: 'other', text: '王总，下午在公司不' }
    ]
  }, 1)

  assert.deepEqual(crossDate.messages.map((item) => item.time), ['20:05', '14:53', '12:53'])
  assert.equal(crossDate.extractedText, [
    '[8月4日 20:05] 我：说明你娃运气爆棚',
    '[8月3日 14:53] 对方：通话时长 00:37',
    '[8月3日 12:53] 对方：王总，下午在公司不'
  ].join('\n'))

  const repeatedInOneScreenshot = normalizeWechatAnalysis({
    isWechatChatScreenshot: true,
    isTwoPartyChat: true,
    images: [{ imageIndex: 0, accepted: true }],
    messages: [
      { sequence: 1, imageIndex: 0, time: '15:00', speaker: 'self', text: '哈哈' },
      { sequence: 2, imageIndex: 0, time: '15:00', speaker: 'self', text: '哈哈' }
    ]
  }, 1)
  assert.equal(repeatedInOneScreenshot.messages.length, 2)

  const partial = normalizeWechatAnalysis({
    isWechatChatScreenshot: true,
    isTwoPartyChat: true,
    confidence: 'medium',
    images: [
      { imageIndex: 0, accepted: true },
      { imageIndex: 1, accepted: false, reason: '这是微信群聊' }
    ],
    messages: [
      { sequence: 1, imageIndex: 0, time: '09:00', speaker: 'other', text: '早上好' },
      { sequence: 2, imageIndex: 1, time: '09:01', speaker: 'self', text: '这条不应保留' }
    ]
  }, 2)

  assert.deepEqual(partial.acceptedIndexes, [0])
  assert.deepEqual(partial.rejectedImages, [{ index: 1, reason: '这是微信群聊' }])
  assert.equal(partial.messages.length, 1)
  assert.equal(partial.extractedText, '[09:00] 对方：早上好')

  const rejected = normalizeWechatAnalysis({
    isWechatChatScreenshot: false,
    isTwoPartyChat: false,
    confidence: 'high',
    images: [{ imageIndex: 0, accepted: false, reason: '不是微信聊天截图' }],
    messages: []
  }, 1)

  assert.equal(rejected.isWechatChatScreenshot, false)
  assert.equal(rejected.extractedText, '')
  assert.equal(rejected.rejectReason, '不是微信聊天截图')

  const longText = normalizeWechatAnalysis({
    isWechatChatScreenshot: true,
    isTwoPartyChat: true,
    images: [{ imageIndex: 0, accepted: true }],
    messages: Array.from({ length: 9 }, (_, index) => ({
      sequence: index + 1,
      imageIndex: 0,
      time: `10:${String(index).padStart(2, '0')}`,
      speaker: index % 2 === 0 ? 'self' : 'other',
      text: String(index) + '字'.repeat(790)
    }))
  }, 1)

  assert.ok(longText.extractedText.length > MAX_EXTRACTED_TEXT_LENGTH)
  assert.equal(longText.exceedsTextLimit, true)

  console.log('PASS WeChat screenshot prompt locks left/right bubble identity rules')
  console.log('PASS screenshot messages preserve reading order, dates, and overlap-deduplication')
  console.log('PASS invalid and mixed image batches are filtered without leaking messages')
  console.log('PASS oversized OCR text is rejected before quick-record insertion')
  console.log('PASS screenshot analysis selects only configured vision-capable models')
}

run()
