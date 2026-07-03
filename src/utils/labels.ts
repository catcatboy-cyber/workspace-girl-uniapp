/**
 * 前端展示文案工具
 * - aiLabel(): 受后台开关控制，返回 "AI" 或 "Crush算法"
 * - tokenLabel(): 返回 "Credits"（Token 前端展示名称）
 */

const AI_LABEL_KEY = 'displayAILabel'
let _aiLabelCached: boolean | null = null

/** 后台调用：设置 AI 展示开关 */
export function setAILabel(show: boolean) {
  _aiLabelCached = show
  try {
    uni.setStorageSync(AI_LABEL_KEY, show ? '1' : '0')
  } catch { /* noop */ }
}

/** 获取当前 AI 展示文案 */
export function aiLabel(): string {
  if (_aiLabelCached === null) {
    try {
      _aiLabelCached = uni.getStorageSync(AI_LABEL_KEY) !== '0'
    } catch {
      _aiLabelCached = true
    }
  }
  return _aiLabelCached ? 'AI' : 'Crush算法'
}

/** Token 的前端展示名称 */
export function tokenLabel(): string {
  return 'Credits'
}

/** 带单位的 Token 展示 */
export function tokenUnit(): string {
  return 'Credits'
}
