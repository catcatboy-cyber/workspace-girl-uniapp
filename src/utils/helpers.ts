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

/* ====== 小咪情绪联动 ====== */

export interface PetMood {
  emoji: string
  message: string
  sprite: string
  level: PetMoodLevel
  label: string
}

export type PetMoodLevel = 'full' | 'good' | 'tired' | 'low'
export type PetEnergyAction = 'record' | 'chat' | 'petting' | 'reply'

export interface PetEnergyDailyCounts {
  date: string
  record: number
  chat: number
  petting: number
  reply: number
}

export interface PetEnergy {
  score: number
  updatedAt: number
  lastRunAt: number
  dailyCounts: PetEnergyDailyCounts
}

export interface PetFeedResult {
  action: PetEnergyAction
  previousScore: number
  score: number
  bonus: number
  configuredBonus: number
  applied: boolean
  dailyCount: number
  dailyCap: number
  previousMood: PetMoodLevel
  mood: PetMoodLevel
  crossedMoodBoundary: boolean
  reachedFull: boolean
}

export interface PetEnergyActionSnapshot {
  action: PetEnergyAction
  label: string
  count: number
  cap: number
  bonus: number
}

export interface PetEnergySnapshot {
  score: number
  level: PetMoodLevel
  label: string
  sprite: string
  message: string
  nextTarget: number
  pointsToNext: number
  runCooldownRemainingMs: number
  actions: PetEnergyActionSnapshot[]
}

export interface PendingPetEnergyFeedback {
  type: 'gain' | 'level-change' | 'full' | 'cap'
  bonus: number
  score: number
  action?: PetEnergyAction | 'multiple'
  level: PetMoodLevel
  createdAt: number
}

// ====== 宠物精力值系统 ======

const PET_ENERGY_KEY = 'petEnergy'
const PET_ENERGY_FEEDBACK_KEY = 'pendingPetEnergyFeedback'
const PET_ENERGY_CAP_NOTICE_KEY = 'petEnergyCapNotice'
const DECAY_INTERVAL_MS = 4 * 60 * 60 * 1000  // 4 小时
const DECAY_PER_STEP = 5
export const PET_RUN_COOLDOWN_MS = 30 * 60 * 1000

export const PET_FEED_BONUS: Record<PetEnergyAction, number> = {
  record: 30,
  chat: 15,
  reply: 10,
  petting: 10
}

export const PET_FEED_DAILY_CAP: Record<PetEnergyAction, number> = {
  record: 3,
  chat: 3,
  reply: 3,
  petting: 2
}

const PET_ACTION_LABEL: Record<PetEnergyAction, string> = {
  record: '记录事件',
  chat: '和宠物聊',
  reply: '帮回复 / 主动开口',
  petting: '陪伴宠物'
}

function getLocalDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultPetEnergy(): PetEnergy {
  return {
    score: 60,
    updatedAt: Date.now(),
    lastRunAt: 0,
    dailyCounts: { date: getLocalDateKey(), record: 0, chat: 0, petting: 0, reply: 0 }
  }
}

function normalizePetCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isFinite(count)) return 0
  return Math.max(0, Math.floor(count))
}

function normalizePetEnergy(raw: any): PetEnergy {
  const today = getLocalDateKey()
  const rawCounts = raw?.dailyCounts && typeof raw.dailyCounts === 'object' ? raw.dailyCounts : {}
  const sameDay = String(rawCounts.date || '') === today
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw?.score) || 0))),
    updatedAt: typeof raw?.updatedAt === 'number' && isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    lastRunAt: typeof raw?.lastRunAt === 'number' && isFinite(raw.lastRunAt) ? raw.lastRunAt : 0,
    dailyCounts: {
      date: today,
      record: sameDay ? normalizePetCount(rawCounts.record) : 0,
      chat: sameDay ? normalizePetCount(rawCounts.chat) : 0,
      petting: sameDay ? normalizePetCount(rawCounts.petting) : 0,
      reply: sameDay ? normalizePetCount(rawCounts.reply) : 0
    }
  }
}

export function readPetEnergy(): PetEnergy {
  try {
    const raw = uni.getStorageSync(PET_ENERGY_KEY)
    if (raw && typeof raw === 'object' && typeof raw.score === 'number') {
      return normalizePetEnergy(raw)
    }
  } catch {}
  return defaultPetEnergy()
}

export function writePetEnergy(energy: PetEnergy): void {
  try { uni.setStorageSync(PET_ENERGY_KEY, normalizePetEnergy(energy)) } catch {}
}

// ====== 精力值 → 情绪映射 ======

export function getPetMoodForScore(value: number): PetMood {
  const score = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  if (score >= 80) return { emoji: '\u{1F604}', message: '今天状态超好！想记什么？', sprite: 'jumping', level: 'full', label: '活力充沛' }
  if (score >= 50) return { emoji: '\u{1F642}', message: '嗯，在呢。今天有什么新发现？', sprite: 'idle', level: 'good', label: '状态不错' }
  if (score >= 25) return { emoji: '\u{1F615}', message: '有点没精神…来陪陪我吧', sprite: 'waiting', level: 'tired', label: '有点疲惫' }
  return { emoji: '\u{1F615}', message: '我有点没精神，来陪我一下吧', sprite: 'failed', level: 'low', label: '需要陪伴' }
}

export function getPetMood(): PetMood {
  return getPetMoodForScore(readPetEnergy().score)
}

export function getPetEnergySnapshot(): PetEnergySnapshot {
  const energy = readPetEnergy()
  const mood = getPetMoodForScore(energy.score)
  const nextTarget = energy.score < 25 ? 25 : energy.score < 50 ? 50 : energy.score < 80 ? 80 : 100
  return {
    score: energy.score,
    level: mood.level,
    label: mood.label,
    sprite: mood.sprite,
    message: mood.message,
    nextTarget,
    pointsToNext: Math.max(0, nextTarget - energy.score),
    runCooldownRemainingMs: Math.max(0, PET_RUN_COOLDOWN_MS - (Date.now() - energy.lastRunAt)),
    actions: (Object.keys(PET_FEED_BONUS) as PetEnergyAction[]).map(action => ({
      action,
      label: PET_ACTION_LABEL[action],
      count: energy.dailyCounts[action],
      cap: PET_FEED_DAILY_CAP[action],
      bonus: PET_FEED_BONUS[action]
    }))
  }
}

function storePendingPetEnergyFeedback(feedback: PendingPetEnergyFeedback): void {
  try {
    const previous = uni.getStorageSync(PET_ENERGY_FEEDBACK_KEY) as PendingPetEnergyFeedback | null
    if (
      previous && previous.type === 'gain' && feedback.type === 'gain'
      && Date.now() - Number(previous.createdAt || 0) < 5 * 60 * 1000
    ) {
      uni.setStorageSync(PET_ENERGY_FEEDBACK_KEY, {
        ...feedback,
        bonus: Math.max(0, Number(previous.bonus || 0)) + feedback.bonus,
        action: previous.action === feedback.action ? feedback.action : 'multiple'
      })
      return
    }
    uni.setStorageSync(PET_ENERGY_FEEDBACK_KEY, feedback)
  } catch {}
}

function shouldShowCapNotice(action: PetEnergyAction): boolean {
  try {
    const today = getLocalDateKey()
    const raw = uni.getStorageSync(PET_ENERGY_CAP_NOTICE_KEY)
    const current = raw && raw.date === today && raw.actions && typeof raw.actions === 'object'
      ? raw
      : { date: today, actions: {} }
    if (current.actions[action]) return false
    current.actions[action] = true
    uni.setStorageSync(PET_ENERGY_CAP_NOTICE_KEY, current)
    return true
  } catch {
    return false
  }
}

export function takePendingPetEnergyFeedback(maxAgeMs = 5 * 60 * 1000): PendingPetEnergyFeedback | null {
  try {
    const feedback = uni.getStorageSync(PET_ENERGY_FEEDBACK_KEY) as PendingPetEnergyFeedback | null
    uni.removeStorageSync(PET_ENERGY_FEEDBACK_KEY)
    if (!feedback || !feedback.type) return null
    if (Date.now() - Number(feedback.createdAt || 0) > maxAgeMs) return null
    return feedback
  } catch {
    return null
  }
}

// ====== 加分 ======

export function feedPet(action: PetEnergyAction): PetFeedResult {
  const energy = readPetEnergy()
  const today = getLocalDateKey()

  // 跨天重置
  if (energy.dailyCounts.date !== today) {
    energy.dailyCounts = { date: today, record: 0, chat: 0, petting: 0, reply: 0 }
  }

  const cap = PET_FEED_DAILY_CAP[action] ?? 0
  const previousScore = energy.score
  const previousMood = getPetMoodForScore(previousScore).level
  if (energy.dailyCounts[action] >= cap) {
    const result: PetFeedResult = {
      action,
      previousScore,
      score: previousScore,
      bonus: 0,
      configuredBonus: PET_FEED_BONUS[action] ?? 0,
      applied: false,
      dailyCount: energy.dailyCounts[action],
      dailyCap: cap,
      previousMood,
      mood: previousMood,
      crossedMoodBoundary: false,
      reachedFull: previousScore >= 100
    }
    if (shouldShowCapNotice(action)) {
      storePendingPetEnergyFeedback({ type: 'cap', bonus: 0, score: previousScore, action, level: previousMood, createdAt: Date.now() })
    }
    return result
  }

  const configuredBonus = PET_FEED_BONUS[action] ?? 0
  energy.score = Math.min(100, energy.score + configuredBonus)
  energy.dailyCounts[action]++
  energy.updatedAt = Date.now()
  writePetEnergy(energy)
  const bonus = Math.max(0, energy.score - previousScore)
  const mood = getPetMoodForScore(energy.score).level
  const reachedFull = previousScore < 100 && energy.score >= 100
  const crossedMoodBoundary = mood !== previousMood
  const result: PetFeedResult = {
    action,
    previousScore,
    score: energy.score,
    bonus,
    configuredBonus,
    applied: true,
    dailyCount: energy.dailyCounts[action],
    dailyCap: cap,
    previousMood,
    mood,
    crossedMoodBoundary,
    reachedFull
  }
  storePendingPetEnergyFeedback({
    type: reachedFull ? 'full' : crossedMoodBoundary ? 'level-change' : 'gain',
    bonus,
    score: energy.score,
    action,
    level: mood,
    createdAt: Date.now()
  })
  console.log(`[pet][feed] ${action} +${bonus} → score=${energy.score}`)
  return result
}

// ====== 衰减 ======

export function decayPetEnergy(): number {
  const energy = readPetEnergy()
  const elapsed = Date.now() - energy.updatedAt
  const decaySteps = Math.floor(elapsed / DECAY_INTERVAL_MS)
  const decay = decaySteps * DECAY_PER_STEP

  if (decay > 0) {
    energy.score = Math.max(0, energy.score - decay)
    // 保留不足 4h 的余量，防止短间隔重复扣分
    energy.updatedAt = Date.now() - (elapsed % DECAY_INTERVAL_MS)
    writePetEnergy(energy)
    console.log(`[pet][decay] -${decay} (${Math.round(elapsed / 3600000)}h elapsed) → score=${energy.score}`)
  }
  return energy.score
}

// ====== 记录事件 ======

export function markLastRecordDate() {
  feedPet('record')
  try { uni.setStorageSync('lastRecordDate', new Date().toISOString()) } catch {}
}
