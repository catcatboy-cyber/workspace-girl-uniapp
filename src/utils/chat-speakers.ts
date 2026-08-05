/**
 * 聊天记录说话人识别与身份映射
 * - chatSelfName / chatTargetName 存的是「聊天记录里出现的名字」
 * - 不是小程序画像昵称 / Crush 档案名本身
 */

const NOISE_NAME_RE = /^(他|她|系统消息|以下为|撤回一条消息|你撤回了一条消息|时间|日期|地点|标题|内容|备注)$/
const BRACKETED_TIME_THEN_NAME_RE = /^\[[^\]\n]{1,30}\]\s*([^:：\n]{1,20})[：:]\s*\S/
const DATE_TIME_THEN_NAME_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s+([^:：\n]{1,20})[：:]\s*\S/
const COLON_RE = /^([^:：\n]{1,20})[：:]\s*\S/
const NAME_THEN_DATE_RE = /^(.+?)\s+\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?$/
const NAME_THEN_TIME_RE = /^(.{1,20}?)\s+\d{1,2}:\d{2}(?::\d{2})?$/

function isLikelySpeakerName(name: string): boolean {
  const value = String(name || '').trim()
  if (!value || value.length > 20) return false
  if (/^\d+$/.test(value)) return false
  if (NOISE_NAME_RE.test(value)) return false
  if (/^[\d\s:/-]+$/.test(value)) return false
  if (/[\[\]]/.test(value)) return false
  if (/\d{1,2}:\d{2}/.test(value)) return false
  return true
}

function pickSpeakerFromLine(line: string): string {
  const text = String(line || '').trim()
  if (!text) return ''

  let match = text.match(BRACKETED_TIME_THEN_NAME_RE)
  if (match?.[1] && isLikelySpeakerName(match[1])) return match[1].trim()

  match = text.match(DATE_TIME_THEN_NAME_RE)
  if (match?.[1] && isLikelySpeakerName(match[1])) return match[1].trim()

  match = text.match(COLON_RE)
  if (match?.[1] && isLikelySpeakerName(match[1])) return match[1].trim()

  match = text.match(NAME_THEN_DATE_RE)
  if (match?.[1] && isLikelySpeakerName(match[1])) return match[1].trim()

  match = text.match(NAME_THEN_TIME_RE)
  if (match?.[1] && isLikelySpeakerName(match[1])) return match[1].trim()

  return ''
}

/** 从聊天文本提取说话人，按出现频次排序 */
export function extractChatSpeakers(text: string): string[] {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const counts = new Map<string, number>()

  for (const line of lines) {
    const name = pickSpeakerFromLine(line)
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([name]) => name)
    .slice(0, 6)
}

/** 是否像双方聊天记录 */
export function inferIsChatRecord(text: string): boolean {
  const value = String(text || '')
  if (!value.includes('\n')) return false
  return extractChatSpeakers(value).length >= 2
}

function namesLooselyMatch(a: string, b: string): boolean {
  const left = String(a || '').trim()
  const right = String(b || '').trim()
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

/** 用户点选「聊天里哪个是我」后，推导双方映射 */
export function mapChatSpeakers(params: {
  selfSpeaker: string
  speakers: string[]
  crushName?: string
}): { chatSelfName: string; chatTargetName: string } {
  const selfSpeaker = String(params.selfSpeaker || '').trim()
  const speakers = (params.speakers || []).map((item) => String(item || '').trim()).filter(Boolean)
  const others = speakers.filter((name) => name !== selfSpeaker)
  const crushName = String(params.crushName || '').trim()
  const matchedOther = others.find((name) => namesLooselyMatch(name, crushName))
  return {
    chatSelfName: selfSpeaker,
    chatTargetName: matchedOther || others[0] || ''
  }
}

/** 自动建议：若说话人里能匹配个人昵称，则预选 */
export function suggestSelfSpeaker(params: {
  speakers: string[]
  profileNickname?: string
}): string {
  const explicitSelf = (params.speakers || []).find((name) => String(name || '').trim() === '我')
  if (explicitSelf) return explicitSelf
  const nickname = String(params.profileNickname || '').trim()
  if (!nickname) return ''
  return (params.speakers || []).find((name) => namesLooselyMatch(name, nickname)) || ''
}
