/**
 * 辅助工具函数
 */

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

/**
 * 当前本地日期输入值
 */
export function getDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 当前本地时间输入值
 */
export function getTimeInputValue(date = new Date()): string {
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

/**
 * 组合日期和时间并转成 ISO 字符串
 */
export function combineDateAndTimeToISOString(dateValue: string, timeValue: string): string {
  const safeDate = dateValue || getDateInputValue()
  const safeTime = timeValue || getTimeInputValue()
  const parsed = new Date(`${safeDate}T${safeTime}:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

/**
 * 获取意向分数的颜色类
 */
export function getIntentColor(score: number): string {
  if (score >= 70) return 'good'
  if (score >= 40) return 'mid'
  return 'bad'
}

/**
 * 获取风险分数的颜色类
 */
export function getRiskColor(score: number): string {
  if (score >= 60) return 'bad'
  if (score >= 30) return 'mid'
  return 'good'
}

/**
 * 获取事件类型的颜色类
 */
export function getEventTypeColor(type: string): string {
  switch (type) {
    case 'positive':
      return 'good'
    case 'risk':
      return 'bad'
    case 'verification':
      return 'mid'
    case 'note':
    case 'system':
    default:
      return 'neutral'
  }
}

/**
 * 获取意向分数的文本描述
 */
export function getIntentText(score: number): string {
  if (score >= 80) return '非常积极'
  if (score >= 60) return '较为积极'
  if (score >= 40) return '中等'
  if (score >= 20) return '较为消极'
  return '非常消极'
}

/**
 * 获取风险分数的文本描述
 */
export function getRiskText(score: number): string {
  if (score >= 75) return '高风险'
  if (score >= 60) return '中高风险'
  if (score >= 45) return '中等风险'
  if (score >= 30) return '中低风险'
  return '低风险'
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait) as unknown as number
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  let previous = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    const remaining = wait - (now - previous)
    if (remaining <= 0 || remaining > wait) {
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func.apply(this, args)
    } else if (timeout === null) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func.apply(this, args)
      }, remaining) as unknown as number
    }
  }
}

/**
 * 显示加载提示
 */
export function showLoading(title = '加载中...') {
  uni.showLoading({ title, mask: true })
}

/**
 * 隐藏加载提示
 */
export function hideLoading() {
  uni.hideLoading()
}

/**
 * 显示成功提示
 */
export function showSuccess(title: string) {
  uni.showToast({ title, icon: 'success', duration: 2000 })
}

/**
 * 显示错误提示
 */
export function showError(title: string) {
  uni.showToast({ title, icon: 'none', duration: 2000 })
}

/**
 * 确认对话框
 */
export function confirm(content: string, title = '提示'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      success: (res: any = {}) => {
        resolve(Boolean(res?.confirm))
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

const ACTIVE_CASE_KEY = 'homeActiveCaseId'
const PROFILE_UPDATED_KEY = 'activeCaseProfileUpdated'
const PENDING_TIMELINE_CONTEXT_KEY = 'pendingTimelineContext'

export type PendingTimelineContext = {
  caseId?: string
  classified?: boolean
  eventType?: string
  recorded?: boolean
  targetEventId?: string
}

export function getActiveCaseId(): string {
  try {
    return String(uni.getStorageSync(ACTIVE_CASE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function setActiveCaseId(caseId?: string) {
  const normalized = String(caseId || '').trim()
  if (!normalized) return
  try {
    uni.setStorageSync(ACTIVE_CASE_KEY, normalized)
  } catch {}
}

export function clearActiveCaseId() {
  try {
    uni.removeStorageSync(ACTIVE_CASE_KEY)
  } catch {}
}

export function bumpDataVersion() {
  try {
    const current = Number(uni.getStorageSync('dataVersion')) || 0
    uni.setStorageSync('dataVersion', current + 1)
  } catch {}
}

export function markActiveCaseProfileUpdated(caseId?: string) {
  const normalized = String(caseId || '').trim()
  if (!normalized) return
  try {
    uni.setStorageSync(PROFILE_UPDATED_KEY, normalized)
  } catch {}
}

export function consumeActiveCaseProfileUpdated(caseId?: string): boolean {
  const normalized = String(caseId || '').trim()
  if (!normalized) return false
  try {
    const stored = String(uni.getStorageSync(PROFILE_UPDATED_KEY) || '').trim()
    if (stored !== normalized) return false
    uni.removeStorageSync(PROFILE_UPDATED_KEY)
    return true
  } catch {
    return false
  }
}

export function setPendingTimelineContext(context: PendingTimelineContext = {}) {
  const payload = {
    caseId: String(context.caseId || '').trim(),
    classified: Boolean(context.classified),
    eventType: String(context.eventType || '').trim(),
    recorded: Boolean(context.recorded),
    targetEventId: String(context.targetEventId || '').trim()
  }

  if (!payload.caseId && !payload.classified && !payload.recorded && !payload.targetEventId && !payload.eventType) {
    try {
      uni.removeStorageSync(PENDING_TIMELINE_CONTEXT_KEY)
    } catch {}
    return
  }

  try {
    uni.setStorageSync(PENDING_TIMELINE_CONTEXT_KEY, payload)
  } catch {}
}

export function consumePendingTimelineContext(): PendingTimelineContext | null {
  try {
    const raw = uni.getStorageSync(PENDING_TIMELINE_CONTEXT_KEY)
    uni.removeStorageSync(PENDING_TIMELINE_CONTEXT_KEY)
    if (!raw || typeof raw !== 'object') return null

    const payload = raw as PendingTimelineContext
    const normalized = {
      caseId: String(payload.caseId || '').trim(),
      classified: Boolean(payload.classified),
      eventType: String(payload.eventType || '').trim(),
      recorded: Boolean(payload.recorded),
      targetEventId: String(payload.targetEventId || '').trim()
    }

    if (!normalized.caseId && !normalized.classified && !normalized.recorded && !normalized.targetEventId && !normalized.eventType) {
      return null
    }

    return normalized
  } catch {
    return null
  }
}
