// ============================================================================
// Shared insight functions — extracted from case-detail.vue
// Pure functions: take data as input, return computed results.
// Importable by both case-detail.vue and index.vue.
// ============================================================================

import { getTimelineRecordTags } from './insights.js'

// ---- Types ----

export interface TimelineStats {
  totalCount: number
  offlineMeetCount: number
  movieCount: number
  mealCount: number
  coffeeTeaCount: number
  targetCommittedCount: number
  targetInitiatedCount: number
  selfInitiatedCount: number
  fulfilledCount: number
  rejectedCount: number
  cancelledDelayedCount: number
}

export interface RadarDim {
  key: string
  label: string
  score: number
  desc: string
  color: string
}

export interface SignalCardData {
  title: string
  detail: string
  evidence: string
}

export interface SignalCard {
  type: string
  icon: string
  label: string
  data: SignalCardData
}

export interface DivergingBar {
  label: string
  you: number
  ta: number
  youPct: number
  taPct: number
  taClass: string
}

// ---- Helpers ----

export function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

export function confidenceAdjust(score: number, samples: number): number {
  if (samples >= 3 || score === 50) return score
  return Math.round(score * 0.6 + 50 * 0.4)
}

// ---- Radar sub-computations ----

export function computeInitiative(targetInitiated: number, selfInitiated: number): number {
  if (targetInitiated + selfInitiated === 0) return 50
  return clamp(50 + (targetInitiated - selfInitiated) / (targetInitiated + selfInitiated) * 50)
}

export function computeResponsive(records: any[]): number {
  let weighted = 0
  let total = 0
  const responseTags = ['fulfilled', 'planned', 'target_committed', 'pending', 'cancelled_delayed', 'rejected', 'cold']
  for (let i = 0; i < records.length; i++) {
    const tags = (getTimelineRecordTags as any)(records[i])
    const all: string[] = tags.all || []
    if (all.includes('fulfilled')) weighted += 1
    if (all.includes('planned')) weighted += 0.7
    if (all.includes('target_committed')) weighted += 0.7
    if (all.includes('pending')) weighted += 0.45
    if (all.includes('cancelled_delayed')) weighted += 0.2
    // rejected/cold = 0, no-op
    const hasAny = responseTags.some(t => all.includes(t))
    if (hasAny) total += 1
  }
  if (total === 0) return 50
  return confidenceAdjust(clamp(weighted / total * 100), total)
}

export function computeCommitment(fulfilled: number, cancelledDelayed: number, records: any[]): number {
  let pending = 0
  for (let i = 0; i < records.length; i++) {
    const tags = (getTimelineRecordTags as any)(records[i])
    if ((tags.all || []).includes('pending')) pending++
  }
  const total = fulfilled + pending + cancelledDelayed
  if (total === 0) return 50
  const raw = (fulfilled * 1 + pending * 0.45 + cancelledDelayed * 0.15) / total * 100
  return confidenceAdjust(clamp(raw), total)
}

export function computeTemperature(intentDelta: number, records: any[]): number {
  let posCount = 0
  let riskCount = 0
  let totalTagged = 0
  const posTags = ['fulfilled', 'target_initiated', 'planned']
  const riskTags = ['rejected', 'cancelled_delayed', 'cold', 'risk_event']
  for (let i = 0; i < records.length; i++) {
    const all: string[] = ((getTimelineRecordTags as any)(records[i])).all || []
    const isPos = posTags.some(t => all.includes(t))
    const isRisk = riskTags.some(t => all.includes(t))
    if (isPos || isRisk) totalTagged++
    if (isPos) posCount++
    if (isRisk) riskCount++
  }
  const posRatio = totalTagged > 0 ? posCount / totalTagged : 0.5
  const riskRatio = totalTagged > 0 ? riskCount / totalTagged : 0.25
  return clamp(50 + intentDelta * 1.2 + posRatio * 25 - riskRatio * 25)
}

// ---- Composite functions ----

export function buildRadarDims(scores: {
  initiative: number
  responsive: number
  commitment: number
  temperature: number
  stability: number
}): RadarDim[] {
  function desc(v: number): string {
    if (v >= 70) return '强'
    if (v >= 58) return '偏强'
    if (v >= 43) return '中性'
    if (v >= 30) return '偏弱'
    return '弱'
  }
  function color(v: number): string {
    if (v >= 58) return 'var(--dot-positive, #4ECDC4)'
    if (v >= 43) return 'var(--accent, #FFD93D)'
    return 'var(--risk, #FF6B6B)'
  }
  return [
    { key: 'initiative',  label: '主动性',  score: scores.initiative,  desc: '谁更常发起互动 · ' + desc(scores.initiative),  color: color(scores.initiative) },
    { key: 'responsive',  label: '回应度',  score: scores.responsive,  desc: '对方是否接得住你的信号 · ' + desc(scores.responsive),  color: color(scores.responsive) },
    { key: 'commitment',  label: '承诺度',  score: scores.commitment,  desc: '说过的话有没有兑现 · ' + desc(scores.commitment),  color: color(scores.commitment) },
    { key: 'temperature', label: '情绪温度', score: scores.temperature, desc: '升温、平淡还是回避 · ' + desc(scores.temperature), color: color(scores.temperature) },
    { key: 'stability',   label: '稳定性',  score: scores.stability,   desc: '最近波动大不大 · ' + desc(scores.stability),   color: color(scores.stability) },
  ]
}

export function buildSignalCards(input: {
  thisMoStats: TimelineStats
  trendDataPanel: { turningPoints?: any[]; latestIntent?: number } | null
  radarInitiative: number
  radarCommitment: number
  radarStability: number
  riskFocusData: { label: string; meaning: string; commitmentRatio: string } | null
}): SignalCard[] {
  // 1. warmingSignal
  let warmingData: SignalCardData | null = null
  const tps = input.trendDataPanel?.turningPoints || []
  const positive = tps.filter((tp: any) => tp.intentDelta > 0)
  if (positive.length > 0) {
    positive.sort((a: any, b: any) => b.impact - a.impact)
    const best = positive[0]
    warmingData = {
      title: best.title || '关系出现积极变化',
      detail: '本次意向 +' + best.intentDelta + '，属本月最显著的升温信号。',
      evidence: '分析节点：' + best.key
    }
  }

  // 2. riskSignal2
  let riskData: SignalCardData | null = null
  if (input.riskFocusData) {
    riskData = {
      title: input.riskFocusData.label,
      detail: input.riskFocusData.meaning,
      evidence: '承诺兑现率 ' + input.riskFocusData.commitmentRatio
    }
  }

  // 3. anomalySignal
  let anomalyData: SignalCardData | null = null
  const s = input.thisMoStats
  if (s.totalCount >= 3) {
    const initiativeGood = input.radarInitiative >= 55
    const commitmentBad = input.radarCommitment < 45
    if (initiativeGood && commitmentBad) {
      anomalyData = {
        title: 'TA 更主动了，但兑现没跟上',
        detail: 'TA 本月主动 ' + s.targetInitiatedCount + ' 次，但承诺兑现率偏低。主动性可能是表面升温，建议继续观察后续行动。',
        evidence: 'TA 主动 ' + s.targetInitiatedCount + ' 次 · 兑现 ' + s.fulfilledCount + '/' + s.targetCommittedCount
      }
    } else {
      const stabilityLow = input.radarStability < 45
      const intentHigh = (input.trendDataPanel?.latestIntent || 0) >= 60
      if (stabilityLow && intentHigh) {
        anomalyData = {
          title: '分数不错，但波动偏大',
          detail: '本月意向分较高但走势不稳定。单一高分不构成确认信号，建议等多几次分析再下判断。',
          evidence: '稳定性 ' + input.radarStability + ' · 意向 ' + (input.trendDataPanel?.latestIntent || 0)
        }
      }
    }
  }

  const cards: SignalCard[] = []
  if (warmingData) cards.push({ type: 'warming', icon: '🔥', label: '升温信号', data: warmingData })
  if (riskData) cards.push({ type: 'risk', icon: '⚠️', label: '风险信号', data: riskData })
  if (anomalyData) cards.push({ type: 'anomaly', icon: '🔍', label: '反常信号', data: anomalyData })
  return cards
}

export function buildDivergingBars(stats: TimelineStats): DivergingBar[] {
  const maxVal = Math.max(
    stats.selfInitiatedCount, stats.targetInitiatedCount,
    stats.fulfilledCount, stats.targetCommittedCount,
    stats.cancelledDelayedCount + stats.rejectedCount, 1
  )
  function pct(v: number) { return Math.round(v / maxVal * 100) }
  return [
    { label: '主动', you: stats.selfInitiatedCount, ta: stats.targetInitiatedCount,
      youPct: pct(stats.selfInitiatedCount), taPct: pct(stats.targetInitiatedCount), taClass: '' },
    { label: '回应', you: stats.fulfilledCount, ta: stats.targetCommittedCount,
      youPct: pct(stats.fulfilledCount), taPct: pct(stats.targetCommittedCount), taClass: '' },
    { label: '兑现', you: stats.fulfilledCount, ta: stats.targetCommittedCount,
      youPct: pct(stats.fulfilledCount), taPct: pct(stats.targetCommittedCount), taClass: '' },
    { label: '受阻', you: stats.rejectedCount, ta: stats.cancelledDelayedCount,
      youPct: pct(stats.rejectedCount), taPct: pct(stats.cancelledDelayedCount), taClass: 'risk' },
  ]
}

export function buildBalanceCallout(stats: TimelineStats): string {
  const { selfInitiatedCount, targetInitiatedCount, fulfilledCount, targetCommittedCount, cancelledDelayedCount } = stats
  if (targetInitiatedCount + selfInitiatedCount === 0) return '暂无足够互动数据形成判断。'
  const parts: string[] = []
  if (targetInitiatedCount > selfInitiatedCount) parts.push('TA 的主动性更强')
  else if (targetInitiatedCount < selfInitiatedCount) parts.push('你更主动')
  else parts.push('双方主动性持平')
  const ratio = targetCommittedCount > 0 ? fulfilledCount + '/' + targetCommittedCount : '--'
  if (targetCommittedCount > 0 && fulfilledCount < targetCommittedCount)
    parts.push('承诺兑现率 ' + ratio + '，兑现落后于承诺')
  else if (targetCommittedCount > 0)
    parts.push('承诺兑现率 ' + ratio + '，兑现尚可')
  if (cancelledDelayedCount > 0) parts.push('存在拖延/取消信号')
  parts.push('下一步重点观察是否主动确认时间地点。')
  return parts.join('，')
}
