<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <view v-if="syncing" class="sync-bar"></view>
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else-if="!caseFile" class="empty-v2">
        <text class="empty-title-v2">结果不可用</text>
        <text class="empty-sub-v2">当前 Crush 不存在或已被删除。</text>
      </view>
      <template v-else>
        <view v-if="profileUpdated" class="notice-v2 ok"><text class="notice-title-v2">画像已更新</text><text class="notice-sub-v2">Crush 画像信息已保存。</text></view>
        <!-- Hero -->
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">WE / {{ caseFile.name }}</text>
          <text class="hero-title-v2">{{ result?.explanation?.petLine || result?.explanation?.bullets?.[0] || '暂无分析结果' }}</text>
          <text class="hero-copy-v2">AI 辅助分析 · 帮你梳理线索，不代表最终结论。</text>
          <view v-if="result" class="tag-row-v2" style="margin-top:16rpx;"><text class="tag-v2 black">最新 · {{ mapIntentLabel(result.intentBucket) }}</text><text class="tag-v2">风险 · {{ mapRiskLabel(result.riskBucket) }}</text><text class="tag-v2">证据 {{ result.evidenceLevel }}</text><text v-if="isCurrentResultAIReviewed" class="tag-v2 black">AI 分析</text></view>
        </view>
        <!-- 补初评入口 -->
        <view v-if="!isCurrentResultAIReviewed" class="card-v2 anim-card" style="animation-delay:0.15s" @click="goNewAssessment">
          <text class="section-title-v2">还没有进行初评</text>
          <text class="remind-text-v2">回答几个问题，让小咪帮你看看有没有戏。点击前往 →</text>
        </view>
        <!-- Profile -->
        <view class="card-v2 anim-card" style="animation-delay:0.2s">
          <view class="card-head-v2">
            <view class="avatar-v2 lg"><image v-if="caseFile.profile?.avatar" :src="caseFile.profile.avatarUrl || caseFile.profile.avatar" mode="aspectFill" /><text v-else class="avatar-placeholder-v2">{{ avatarLabel(caseFile.name) }}</text></view>
            <view><text class="profile-name-v2">{{ caseFile.name }}</text><text v-if="objectTypeLabel" class="profile-type-v2">{{ objectTypeLabel }}</text></view>
          </view>
          <view v-if="profileItems.length > 0" class="tag-row-v2"><text v-for="item in profileItems" :key="item" class="tag-v2">{{ item }}</text></view>
        </view>
        <!-- 桃花匹配度入口（详情已搬至「命理桃花」页） -->
        <view class="card-v2 anim-card" style="animation-delay:0.22s;background:#FFFBEB;" @click="goTaohuaMatch">
          <text class="section-title-v2">桃花匹配度</text>
          <text class="weekly-desc-v2">查看你和 TA 的生肖星座匹配 + AI 深度解读 →</text>
        </view>
        <!-- Stats + Trends -->
        <view class="card-v2 anim-card" style="animation-delay:0.24s">
          <view v-if="overviewStats.length > 0" class="stats-grid-v2 stats-compact-v2"><view v-for="item in overviewStats" :key="item.key" :class="['stat-box-v2', item.tone === 'risk' ? 'warn' : '']"><text class="stat-num-v2">{{ item.value }}</text><text class="stat-lbl-v2">{{ item.label }}</text></view></view>
          <view v-if="trendDataPanel" class="trend-block-v2" style="margin-top:0;padding-top:0;border-top:none;">
            <text class="section-title-v2">趋势数据 · 月度</text>
            <view class="trend-grid-v2">
              <view class="trend-item-v2"><view class="trend-item-row-v2"><text class="trend-num-v2">{{ trendDataPanel.latestIntent }}</text><text class="trend-chg-v2" :class="deltaClass(trendDataPanel.intentDelta14)">{{ formatSignedDelta(trendDataPanel.intentDelta14) }}</text></view><text class="trend-unit-v2">意向</text></view>
              <view class="trend-item-v2"><view class="trend-item-row-v2"><text class="trend-num-v2 risk">{{ trendDataPanel.latestRisk }}</text><text class="trend-chg-v2" :class="deltaClass(-trendDataPanel.riskDelta14)">{{ formatSignedDelta(trendDataPanel.riskDelta14) }}</text></view><text class="trend-unit-v2">风险</text></view>
              <view class="trend-item-v2"><text class="trend-num-v2">{{ trendDataPanel.stability }}%</text><text class="trend-unit-v2">稳定性 · {{ trendDataPanel.sampleCount }}次</text></view>
              <view class="trend-item-v2"><text class="trend-num-v2">{{ trendDataPanel.evidenceCount }}</text><text class="trend-unit-v2">证据量 · 月度</text></view>
            </view>
            <view v-if="trendDataPanel.tags.length" class="tag-row-v2" style="margin-top:12rpx;"><text v-for="tag in trendDataPanel.tags" :key="tag" class="tag-v2">{{ tag }}</text></view>
            <view v-if="trendDataPanel.lineChart.points.length > 1" class="relationship-line-chart-v2">
              <view class="line-legend-v2">
                <view class="line-legend-item-v2"><view class="line-legend-mark-v2 intent"></view><text>意向</text></view>
                <view class="line-legend-item-v2"><view class="line-legend-mark-v2 risk"></view><text>风险</text></view>
                <text class="line-legend-tip-v2">左右滑动查看更多</text>
              </view>
              <scroll-view class="line-scroll-v2" scroll-x>
                <view class="line-canvas-v2" :style="{ width: trendDataPanel.lineChart.width + 'rpx' }">
                  <view class="line-grid-v2 top"><text>100</text></view>
                  <view class="line-grid-v2 middle"><text>50</text></view>
                  <view class="line-grid-v2 bottom"><text>0</text></view>
                  <view v-for="segment in trendDataPanel.lineChart.intentSegments" :key="segment.key" class="line-segment-v2 intent" :style="segment.style"></view>
                  <view v-for="segment in trendDataPanel.lineChart.riskSegments" :key="segment.key" class="line-segment-v2 risk" :style="segment.style"></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'intent-'+point.index" class="line-point-v2 intent" :style="{ left: point.x + 'rpx', top: point.intentY + 'rpx' }"><text>{{ point.intent }}</text></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'risk-'+point.index" class="line-point-v2 risk" :style="{ left: point.x + 'rpx', top: point.riskY + 'rpx' }"><text>{{ point.risk }}</text></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'label-'+point.index" class="line-x-label-v2" :style="{ left: point.x + 'rpx' }"><text class="line-x-index-v2">第 {{ point.index }} 次</text><text>{{ point.timeLabel }}</text></view>
                </view>
              </scroll-view>
            </view>
            <view v-if="trendDataPanel.turningPoints.length > 0" class="turning-v2"><text class="section-title-v2">关键拐点</text><view v-for="tp in trendDataPanel.turningPoints" :key="tp.key" class="turning-row-v2"><text class="turning-name-v2">{{ tp.title }}</text><view class="turning-deltas-v2"><text :class="['delta-chip-v2', deltaClass(tp.intentDelta)]">意 {{ formatSignedDelta(tp.intentDelta) }}</text><text :class="['delta-chip-v2', deltaClass(-tp.riskDelta)]">险 {{ formatSignedDelta(tp.riskDelta) }}</text></view></view></view>
          </view>
        </view>
        <!-- Monthly review -->
        <view v-if="aiWeeklyPreview" class="card-v2 anim-card" style="animation-delay:0.25s">
          <text class="section-title-v2">{{ aiWeeklyPreview.monthStart }} - {{ aiWeeklyPreview.monthEnd }}</text>
          <text class="weekly-title-v2">{{ aiWeeklyPreview.title }}</text>
          <view class="tag-row-v2" style="margin:10rpx 0;"><text class="tag-v2 black">{{ mapWeeklyTrendLabel(aiWeeklyPreview.trendLabel) }}</text><text class="tag-v2 black">AI 复盘</text></view>
          <view class="tag-row-v2" style="margin-bottom:10rpx;"><text class="tag-v2">事件 {{ aiWeeklyPreview.eventCount }}</text><text class="tag-v2">分析 {{ aiWeeklyPreview.assessmentCount }}</text><text class="tag-v2">意向 {{ formatDelta(aiWeeklyPreview.intentDelta) }}</text><text class="tag-v2">风险 {{ formatDelta(aiWeeklyPreview.riskDelta) }}</text></view>
          <text class="weekly-desc-v2">{{ aiWeeklyPreview.summary }}</text>
          <view v-if="aiWeeklyPreview.keyChanges?.length" class="bullet-list-v2"><text v-for="item in aiWeeklyPreview.keyChanges" :key="item" class="bullet-v2">• {{ item }}</text></view>
          <view v-if="aiWeeklyPreview.keyEvents?.length" class="bullet-list-v2"><text v-for="item in aiWeeklyPreview.keyEvents" :key="item" class="bullet-v2">• {{ item }}</text></view>
          <view v-if="aiWeeklyPreview.avoidMisread?.length" class="bullet-list-v2"><text v-for="item in aiWeeklyPreview.avoidMisread" :key="item" class="bullet-v2">• {{ item }}</text></view>
          <view v-if="weeklyFocusItems.length > 0" class="focus-box-v2"><text class="focus-label-v2">后续验证重点 · 最该看</text><text class="focus-question-v2">{{ primaryWeeklyFocus }}</text><view v-if="weeklyFocusItems.length > 1" class="bullet-list-v2" style="margin-top:8rpx;"><text v-for="item in weeklyFocusItems.slice(1)" :key="item" class="bullet-v2">• {{ item }}</text></view></view>
        </view>
        <view v-else class="empty-v2" style="text-align:left;"><text class="empty-sub-v2">本月还没有复盘。有新事件后可生成。</text></view>
        <!-- Bottom action -->
        <view class="bottom-action-v2">
          <button class="btn-v2-bottom" style="width:100%;" :disabled="reviewGenerating || (aiWeeklyPreview && !hasNewEventsSinceReview)" @click="generateThisMonthReview">{{ reviewGenerating ? '生成中...' : (aiWeeklyPreview ? '重新生成本月复盘' : '生成本月复盘') }}</button>
          <view v-if="reviewGenerating" class="action-box" style="margin-top:12rpx;">
            <text class="action-label">月度复盘 生成中...</text>
            <view class="ai-row"><view class="ai-dot"></view><text class="action-text muted">后台分析中，完成后将自动刷新</text></view>
          </view>
        </view>
      </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId, getMonthlyReviews, getCases, generateMonthlyReview, handleInsufficientBalance } from '@/utils/api'
import { bumpDataVersion, consumeActiveCaseProfileUpdated, getActiveCaseId, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import { buildCaseOverviewStats, buildFocusItems, buildObjectStatusCard, compareAssessments } from '@/utils/insights'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const loading = ref(true)
const syncing = ref(false)
const fontSizeMode = ref(getFontSizeMode())
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const profileUpdated = ref(false)
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const showRelationshipLegacySections = false
const weeklyReviews = ref<any[]>([])
const currentMonthStart = ref('')
const initialized = ref(false)
const skipNextShowRefresh = ref(false)
const CASE_DETAIL_CACHE_PREFIX = 'caseDetailCache:v1:'
const RELATION_CHART_TOP = 44
const RELATION_CHART_HEIGHT = 260
const RELATION_CHART_LEFT = 72
const RELATION_CHART_GAP = 140
const RELATION_CHART_VISIBLE = 5

const result = computed(() => caseFile.value?.latestResult)

const profileItems = computed(() => {
  const p = caseFile.value?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
})

const objectTypeLabel = computed(() => {
  const relationType = String(caseFile.value?.profile?.relationType || '').trim()
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
  return ''
})

const overviewStatsData = computed(() => {
  if (!caseFile.value) return null
  return buildCaseOverviewStats(caseFile.value)
})

const overviewStats = computed(() => overviewStatsData.value?.items || [])

const focusItems = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.timeline) return []
  return buildFocusItems(caseFile.value)
})
const primaryFocusItem = computed(() => focusItems.value[0] || null)
const focusVerifyQuestion = computed(() => {
  const item = primaryFocusItem.value
  if (!item) return ''
  const prompt = cleanFocusPrompt(item.nextRecordPrompt)
  if (prompt) return prompt
  const meaning = cleanFocusPrompt(item.meaning)
  if (meaning) return meaning
  return `${item.label}是否会继续出现，而不是只停留在单次表现。`
})
const focusEvidenceItems = computed(() => {
  const evidences = primaryFocusItem.value?.evidences || []
  return evidences.slice(0, 2).map((item: any, index: number) => ({
    ...item,
    index: index + 1,
    timeText: [item.occurrenceTime, item.sequenceLabel].filter(Boolean).join(' · ') || item.recordedAt || ''
  }))
})

const statusCard = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.assessments || !caseFile.value?.timeline) return null
  return buildObjectStatusCard(caseFile.value)
})

const trend = computed(() => {
  const assessments = caseFile.value?.assessments || []
  if (assessments.length < 2) return null
  // 约定：后端按 createdAt asc 返回，数组末尾是最新分析
  const previous = assessments[assessments.length - 2]
  const current = assessments[assessments.length - 1]
  return compareAssessments(previous, current)
})

const assessmentsList = computed(() => {
  const list = [...(caseFile.value?.assessments || [])]
  const latest = caseFile.value?.latestResult
  if (latest && !list.some((item: any) => getAssessmentKey(item) === getAssessmentKey(latest))) {
    list.push(latest)
  }
  return list
})

const assessmentPreview = computed(() => {
  return [...assessmentsList.value]
    .sort((a: any, b: any) => getAssessmentTimestamp(b) - getAssessmentTimestamp(a))
    .slice(0, 5)
})

const latestAssessmentPreview = computed(() => {
  return assessmentPreview.value[0] || null
})

const latestAssessmentStatus = computed(() => {
  if (!latestAssessmentPreview.value) return null
  const chronological = [...assessmentsList.value].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
  const index = chronological.findIndex((item: any) => getAssessmentKey(item) === getAssessmentKey(latestAssessmentPreview.value))
  const history = index >= 0 ? chronological.slice(0, index + 1) : chronological
  return buildObjectStatusCard({
    ...caseFile.value,
    latestResult: latestAssessmentPreview.value,
    assessments: history.length > 0 ? history : [latestAssessmentPreview.value],
    timeline: caseFile.value?.timeline || []
  })
})

const olderAssessmentPreview = computed(() => {
  return assessmentPreview.value.slice(1, 5)
})

const trendDataPanel = computed(() => {
  const assessments = [...assessmentsList.value]
    .sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
    .filter((item: any) => getAssessmentTimestamp(item) > 0)
  if (!assessments.length) return null

  const latest = assessments[assessments.length - 1]
  const latestTime = getAssessmentTimestamp(latest)
  const rangeStart = latestTime - 14 * 24 * 60 * 60 * 1000
  const rangeBase = assessments.find((item: any) => getAssessmentTimestamp(item) >= rangeStart) || assessments[0]
  const recentAssessments = assessments.slice(-6)
  const transitions = assessments
    .map((item: any, index: number) => {
      if (index === 0) return null
      const previous = assessments[index - 1]
      const intentDelta = clampScore(item.intentScore) - clampScore(previous.intentScore)
      const riskDelta = clampScore(item.consistencyRiskScore) - clampScore(previous.consistencyRiskScore)
      return {
        key: getAssessmentKey(item),
        title: item.triggerEventTitle || mapSourceLabel(item.source),
        intentDelta,
        riskDelta,
        impact: Math.abs(intentDelta) + Math.abs(riskDelta),
        time: getAssessmentTimestamp(item)
      }
    })
    .filter(Boolean)
  const recentTransitions = transitions.slice(-5)
  const avgMove = recentTransitions.length
    ? recentTransitions.reduce((sum: number, item: any) => sum + item.impact, 0) / recentTransitions.length
    : 0
  const stability = Math.max(0, Math.min(100, Math.round(100 - avgMove * 2.4)))
  const latestIntent = clampScore(latest.intentScore)
  const latestRisk = clampScore(latest.consistencyRiskScore)
  const intentDelta14 = latestIntent - clampScore(rangeBase.intentScore)
  const riskDelta14 = latestRisk - clampScore(rangeBase.consistencyRiskScore)
  return {
    latestIntent,
    latestRisk,
    intentDelta14,
    riskDelta14,
    stability,
    sampleCount: recentAssessments.length,
    evidenceCount: countRecentEvidence(caseFile.value?.timeline || [], latestTime),
    tags: buildTrendDataTags(intentDelta14, riskDelta14, stability, recentAssessments.length),
    lineChart: buildRelationshipLineChart(recentAssessments),
    turningPoints: transitions
      .filter((item: any) => item.impact > 0)
      .sort((a: any, b: any) => b.impact - a.impact || b.time - a.time)
      .slice(0, 3)
  }
})

const weeklyPreview = computed(() => {
  if (!weeklyReviews.value.length) return null
  return weeklyReviews.value.find((item: any) => item.monthStart === currentMonthStart.value || item.weekStart === currentMonthStart.value) || weeklyReviews.value[0]
})

const aiWeeklyPreview = computed(() => {
  return weeklyPreview.value || null
})

const hasNewEventsSinceReview = computed(() => {
  const review = weeklyPreview.value
  if (!review) return true
  const timeline = caseFile.value?.timeline || []
  const latestEventTime = Math.max(0, ...timeline
    .filter((item: any) => {
      if (!item.occurrenceAt) return false
      if (['assessment', 'trend', 'weekly_review', 'monthly_review'].includes(item.type)) return false
      if (item.type === 'note' && item.feature === 'weeklySideRead') return false
      return true
    })
    .map((item: any) => new Date(item.occurrenceAt).getTime())
  )
  const reviewTime = review.generatedAt ? new Date(review.generatedAt).getTime() : 0
  return latestEventTime > reviewTime
})

const weeklyButtonLabel = computed(() => {
  const review = weeklyPreview.value
  if (!review) return '生成本月复盘'
  if (!hasNewEventsSinceReview.value) return '还没新事件'
  return '重新生成本月复盘'
})

const hasFallbackWeeklyPreview = computed(() => {
  return false
})

const weeklyFocusItems = computed(() => {
  return (weeklyPreview.value?.nextWeekFocus || [])
    .map((item: any) => String(item || '').trim())
    .filter(Boolean)
})

const primaryWeeklyFocus = computed(() => {
  return weeklyFocusItems.value[0] || ''
})

const triggerEvent = computed(() => {
  if (!result.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === result.value.triggerEventId) || null
})

const isCurrentResultAIReviewed = computed(() => {
  return Boolean(
    triggerEvent.value?.aiUsed ||
    String(result.value?.explanation?.headline || '').startsWith('AI 分析后：') ||
    String(result.value?.explanation?.headline || '').startsWith('AI 研判后：')
  )
})

const intentTone = computed(() => {
  const s = result.value?.intentScore ?? 0
  if (s >= 70) return 'good'
  if (s >= 40) return 'mid'
  return 'bad'
})
const riskTone = computed(() => {
  const s = result.value?.consistencyRiskScore ?? 0
  if (s >= 60) return 'bad'
  if (s >= 30) return 'mid'
  return 'good'
})

function mapIntentLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低意向'
    case 'low_medium': return '偏低意向'
    case 'medium': return '中等意向'
    case 'medium_high': return '中高意向'
    case 'high': return '高意向'
    default: return '未分析'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未分析'
  }
}

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '分析'
  }
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}



onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || getActiveCaseId()
  if (caseId.value) setActiveCaseId(caseId.value)
  profileUpdated.value = options?.profileUpdated === '1'
  initialized.value = true
  skipNextShowRefresh.value = true
  loadData()
})

const lastDataVersion = ref(0)

onShow(() => {
  const _t0 = Date.now()
  console.log('[PERF] case-detail onShow start')
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
    fontSizeMode.value = getFontSizeMode()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  if (skipNextShowRefresh.value) {
    skipNextShowRefresh.value = false
    return
  }
  const active = getActiveCaseId()
  if (active && active !== caseId.value) {
    caseId.value = active
    profileUpdated.value = consumeActiveCaseProfileUpdated(active)
    loadData({ silent: true })
    return
  }
  if (consumeActiveCaseProfileUpdated(caseId.value)) {
    profileUpdated.value = true
    loadData({ silent: true })
    return
  }
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dv > lastDataVersion.value) { lastDataVersion.value = dv; loadData({ silent: true }) }
  console.log('[PERF] case-detail onShow end', Date.now() - _t0, 'ms')
})

async function ensureCaseId(uid: string) {
  if (caseId.value) return true
  const active = getActiveCaseId()
  if (active) {
    caseId.value = active
    return true
  }
  const list = await getCases(uid)
  const firstCaseId = list?.[0]?.caseId || list?.[0]?._id || ''
  if (!firstCaseId) return false
  caseId.value = firstCaseId
  setActiveCaseId(firstCaseId)
  return true
}

async function loadData(options: { silent?: boolean } = {}) {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  if (!caseFile.value && caseId.value) {
    const cached = readCaseDetailCache(uid, caseId.value)
    if (cached) {
      caseFile.value = cached
      loading.value = false
    }
  }
  if (!caseFile.value) {
    loading.value = true
  } else {
    syncing.value = true
  }
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      caseFile.value = null
      return
    }
    setActiveCaseId(caseId.value)
    const detail = await getCaseDetail(uid, caseId.value)
    caseFile.value = detail
    writeCaseDetailCache(uid, caseId.value, detail)
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
    loadWeeklyReviewsInBackground(uid)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
    syncing.value = false
  }
}

function readCaseDetailCache(uid: string, id: string) {
  try {
    const cached = uni.getStorageSync(`${CASE_DETAIL_CACHE_PREFIX}${uid}:${id}`)
    return cached && cached.caseFile ? cached.caseFile : null
  } catch {
    return null
  }
}

function writeCaseDetailCache(uid: string, id: string, detail: any) {
  try {
    uni.setStorageSync(`${CASE_DETAIL_CACHE_PREFIX}${uid}:${id}`, {
      cachedAt: Date.now(),
      caseFile: detail
    })
  } catch {}
}

async function loadWeeklyReviewsInBackground(uid: string) {
  try {
    const monthlyRes = await getMonthlyReviews(uid, caseId.value)
    weeklyReviews.value = monthlyRes.reviews || []
    currentMonthStart.value = monthlyRes.currentMonthStart || ''
  } catch (error) {
    console.warn('[page:case-detail] load weekly reviews failed:', error)
  }
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}

function goNewAssessment() {
  setActiveCaseId(caseId.value)
  uni.navigateTo({ url: '/pages/reassess/reassess?caseId=' + caseId.value })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

function getAssessmentTimestamp(item: any) {
  const raw = item?.createdAt
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function getAssessmentKey(item: any) {
  return String(item?._id || item?.assessmentId || `${item?.createdAt || ''}-${item?.triggerEventId || ''}`)
}

function formatAssessmentDate(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '时间未记录'
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function countRecentEvidence(timeline: any[], latestTime: number) {
  const now = latestTime || Date.now()
  const start = now - 14 * 24 * 60 * 60 * 1000
  return (timeline || []).filter((item: any) => {
    const timestamp = getTimelineTimestamp(item)
    if (timestamp < start || timestamp > now) return false
    const type = String(item?.type || '')
    return type !== 'assessment' && type !== 'trend' && type !== 'system'
  }).length
}

function getTimelineTimestamp(item: any) {
  const raw = item?.occurrenceTime || item?.createdAt || item?.date
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function cleanFocusPrompt(text: any) {
  return String(text || '')
    .replace(/^本次重点记录[:：]\s*/, '')
    .replace(/^下一次最值得记录的是[:：]\s*/, '')
    .replace(/^下一次重点记录[:：]\s*/, '')
    .replace(/^重点记录[:：]\s*/, '')
    .trim()
}

function buildRelationshipLineChart(assessments: any[]) {
  const source = [...(assessments || [])].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
  const points = source.map((item: any, index: number) => {
    const x = RELATION_CHART_LEFT + index * RELATION_CHART_GAP
    const intent = clampScore(item.intentScore)
    const risk = clampScore(item.consistencyRiskScore)
    return {
      index: index + 1,
      x,
      intent,
      risk,
      intentY: scoreToLineY(intent),
      riskY: scoreToLineY(risk),
      timeLabel: formatChartTime(item.createdAt)
    }
  })
  const width = Math.max(
    680,
    RELATION_CHART_LEFT * 2 + Math.max(points.length - 1, RELATION_CHART_VISIBLE - 1) * RELATION_CHART_GAP
  )
  return {
    width,
    scrollLeft: points.length <= RELATION_CHART_VISIBLE ? 0 : width,
    points,
    intentSegments: buildLineSegments('intent', points.map((point: any) => ({ x: point.x, y: point.intentY }))),
    riskSegments: buildLineSegments('risk', points.map((point: any) => ({ x: point.x, y: point.riskY })))
  }
}

function scoreToLineY(score: number) {
  return RELATION_CHART_TOP + RELATION_CHART_HEIGHT - (score / 100) * RELATION_CHART_HEIGHT
}

function buildLineSegments(prefix: string, source: Array<{ x: number; y: number }>) {
  const segments: Array<{ key: string; style: Record<string, string> }> = []
  for (let index = 0; index < source.length - 1; index += 1) {
    const from = source[index]
    const to = source[index + 1]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    segments.push({
      key: `${prefix}-${index}`,
      style: {
        left: `${from.x}rpx`,
        top: `${from.y}rpx`,
        width: `${length}rpx`,
        transform: `rotate(${angle}deg)`
      }
    })
  }
  return segments
}

function formatChartTime(createdAt?: string) {
  if (!createdAt) return '时间未说明'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return '时间未说明'
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`
}

function buildTrendDataTags(intentDelta: number, riskDelta: number, stability: number, sampleCount: number) {
  const tags: string[] = []
  if (intentDelta >= 8) tags.push('月度意向上行')
  else if (intentDelta <= -8) tags.push('月度意向回落')
  else tags.push('月度意向平稳')

  if (riskDelta <= -6) tags.push('月度风险回落')
  else if (riskDelta >= 6) tags.push('月度风险抬头')
  else tags.push('月度风险平稳')

  if (stability >= 76) tags.push('波动偏低')
  else if (stability >= 52) tags.push('波动中等')
  else tags.push('波动偏高')

  tags.push(sampleCount >= 4 ? '样本充足' : '样本偏少')
  return tags
}

function mapWeeklyTrendLabel(label: any) {
  const normalized = String(label || '').trim()
  const map: Record<string, string> = {
    持续向好: '本月回暖',
    持续走低: '本月转弱',
    风险抬头: '本月承压',
    基本平稳: '本月平稳',
    稳定观察: '本月观察',
    升温期: '本月回暖',
    升温中: '本月回暖',
    走弱期: '本月转弱',
    暂时平稳: '本月平稳'
  }
  return map[normalized] || (normalized ? `本月${normalized.replace(/^本月/, '')}` : '本月复盘')
}

function formatSignedDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  return String(numeric)
}

function deltaClass(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return 'positive'
  if (numeric < 0) return 'negative'
  return 'neutral'
}

function formatDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  if (numeric < 0) return String(numeric)
  return '持平'
}

// 桃花匹配度入口 → 跳转「命理桃花」页（带 caseId）
function goTaohuaMatch() {
  if (caseId.value) setActiveCaseId(caseId.value)
  uni.navigateTo({ url: '/pages/taohua/taohua?caseId=' + caseId.value })
}

// Inline review generation
const reviewGenerating = ref(false)

async function generateThisMonthReview() {
  if (reviewGenerating.value) return
  reviewGenerating.value = true
  try {
    const res = await generateMonthlyReview(userId.value, caseId.value)
    weeklyReviews.value = res.reviews || []
    currentMonthStart.value = res.currentMonthStart || ''
    bumpDataVersion()
    showSuccess('本月复盘已生成')
  } catch (error: any) {
    if (handleInsufficientBalance(error)) return
    showError(error?.message || '生成失败')
  } finally { reviewGenerating.value = false }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx), var(--app-bg, #f6f1e8);
  padding: var(--spacing-page, 28rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; border-left: 12rpx solid #4ECDC4; }
.v2-mode .notice-v2.warn { background: #FFEEEC; border-left: 12rpx solid #FF6B6B; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; }
.v2-mode .tag-v2 { display: inline-flex; align-items: center; min-height: 36rpx; padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }

.v2-mode .profile-block-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .profile-head-v2 { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; padding-bottom: 16rpx; border-bottom: 3rpx solid #111; }
.v2-mode .avatar-v2 { width: 68rpx; height: 68rpx; border-radius: 50%; overflow: hidden; border: 3rpx solid #111; background: #FFD93D; display: flex; align-items: center; justify-content: center; }
.v2-mode .avatar-v2.lg { width: 88rpx; height: 88rpx; }
.v2-mode .avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .profile-name-v2 { display: block; font-size: 34rpx; font-weight: 900; color: #111; }
.v2-mode .profile-type-v2 { display: block; font-size: 22rpx; font-weight: 700; color: #FF5252; margin-top: 2rpx; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-top: 16rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-box-v2.warn { background: #FFF0EE; }
.v2-mode .stat-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 2rpx; }
.v2-mode .stat-hint-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 2rpx; }

.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .remind-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .trend-block-v2 { margin-top: 18rpx; padding-top: 16rpx; border-top: 3rpx solid #111; }
.v2-mode .trend-grid-v2 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8rpx; }
.v2-mode .trend-item-v2 { padding: 14rpx 10rpx; border: 2rpx solid #111; text-align: center; background: #fff; }
.v2-mode .stats-compact-v2 { margin-top: 0; }
.v2-mode .trend-item-row-v2 { display: flex; align-items: baseline; justify-content: center; gap: 6rpx; }
.v2-mode .trend-num-v2 { display: block; font-size: 32rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .trend-num-v2.risk { color: #FF5252; }
.v2-mode .trend-chg-v2 { font-size: 18rpx; font-weight: 800; }
.v2-mode .trend-chg-v2.positive { color: #4ECDC4; }
.v2-mode .trend-chg-v2.negative { color: #FF5252; }
.v2-mode .trend-chg-v2.flat { color: #999; }
.v2-mode .trend-unit-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; }

.v2-mode .weekly-block-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .weekly-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1.3; margin-bottom: 8rpx; }
.v2-mode .weekly-desc-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.6; }
.v2-mode .bullet-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .focus-box-v2 { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .focus-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .focus-question-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-top: 6rpx; line-height: 1.4; }

.v2-mode .side-block-v2 { padding: 20rpx; border: 2rpx dashed #111; background: #FFFBEB; margin-bottom: 24rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; align-items: center; gap: 16rpx; padding-bottom: 16rpx; border-bottom: 3rpx solid #111; margin-bottom: 14rpx; }

.v2-mode .bullet-list-v2 { margin-top: 10rpx; }
.v2-mode .bullet-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .relationship-line-chart-v2 { margin-top: 16rpx; }
.v2-mode .line-legend-v2 { display: flex; align-items: center; flex-wrap: wrap; gap: 14rpx; margin-bottom: 12rpx; }
.v2-mode .line-legend-item-v2 { display: flex; align-items: center; gap: 8rpx; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .line-legend-mark-v2 { width: 34rpx; height: 5rpx; border-radius: 999rpx; background: #111; }
.v2-mode .line-legend-mark-v2.risk { background: #FF5252; }
.v2-mode .line-legend-tip-v2 { font-size: 20rpx; font-weight: 700; color: #999; }
.v2-mode .line-scroll-v2 { width: 100%; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .line-canvas-v2 { position: relative; height: 410rpx; box-sizing: border-box; }
.v2-mode .line-grid-v2 { position: absolute; left: 34rpx; right: 28rpx; height: 1rpx; background: rgba(0,0,0,0.06); }
.v2-mode .line-grid-v2 text { position: absolute; left: -4rpx; top: -18rpx; transform: translateX(-100%); color: #888; font-size: 18rpx; font-weight: 700; }
.v2-mode .line-grid-v2.top { top: 44rpx; }
.v2-mode .line-grid-v2.middle { top: 174rpx; }
.v2-mode .line-grid-v2.bottom { top: 304rpx; }
.v2-mode .line-segment-v2 { position: absolute; height: 5rpx; border-radius: 999rpx; transform-origin: 0 50%; background: #111; box-shadow: 0 0 0 3rpx rgba(0,0,0,0.06); }
.v2-mode .line-segment-v2.risk { background: #FF5252; box-shadow: 0 0 0 3rpx rgba(255,82,82,0.10); }
.v2-mode .line-point-v2 { position: absolute; width: 34rpx; height: 34rpx; margin-left: -17rpx; margin-top: -17rpx; border-radius: 50%; border: 4rpx solid #fff; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: #111; }
.v2-mode .line-point-v2.risk { background: #FF5252; }
.v2-mode .line-point-v2 text { position: absolute; top: -34rpx; color: #111; font-size: 18rpx; font-weight: 900; }
.v2-mode .line-point-v2.risk text { top: 28rpx; color: #FF5252; }
.v2-mode .line-x-label-v2 { position: absolute; top: 330rpx; width: 116rpx; margin-left: -58rpx; text-align: center; }
.v2-mode .line-x-label-v2 text { display: block; color: #999; font-size: 18rpx; line-height: 1.3; font-weight: 600; }
.v2-mode .line-x-index-v2 { color: #111 !important; font-weight: 900 !important; }

.v2-mode .turning-row-v2 { display: flex; align-items: center; justify-content: space-between; padding: 6rpx 0; }
.v2-mode .turning-name-v2 { font-size: 22rpx; font-weight: 600; color: #111; line-height: 1.5; }
.v2-mode .turning-deltas-v2 { display: flex; gap: 6rpx; }
.v2-mode .delta-chip-v2 { padding: 2rpx 8rpx; border: 1rpx solid #111; font-size: 18rpx; font-weight: 700; }
.v2-mode .delta-chip-v2.positive { background: #E0FFF0; color: #0F6B45; }
.v2-mode .delta-chip-v2.negative { background: #FFEEEC; color: #FF5252; }
.v2-mode .delta-chip-v2.flat { background: #f9f9f9; color: #999; }

.v2-mode .side-grid-v2 { display: flex; flex-direction: column; gap: 10rpx; margin-top: 12rpx; }
.v2-mode .side-item-v2 { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .side-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 4rpx; }
.v2-mode .side-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; }
.v2-mode .tag-v2.green { background: #4ECDC4; color: #111; }
.v2-mode .tag-v2.ylw { background: #FFD93D; color: #111; }
.v2-mode .tag-v2.red { background: #FF5252; color: #fff; }
.v2-mode .tag-v2.sm { min-height: 28rpx; padding: 2rpx 10rpx; font-size: 18rpx; }

.v2-mode .bottom-action-v2 { text-align: center; margin-bottom: 24rpx; padding: 0 28rpx; }
.v2-mode .btn-v2-bottom { display: block; width: 100%; height: 72rpx; line-height: 72rpx; background: #4ECDC4; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-bottom[disabled] { opacity: 0.5; box-shadow: none; }
.sync-bar { position: fixed; top: 0; left: 0; height: 3rpx; z-index: 9999; background: linear-gradient(90deg, transparent, #FF6B6B, transparent); animation: sync-slide 0.8s ease-in-out infinite; }
@keyframes sync-slide {
  0% { width: 30%; left: -30%; }
  100% { width: 30%; left: 130%; }
}
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }
.v2-mode .action-box { margin-top: 12rpx; padding: 14rpx; border: 2rpx dashed #111; background: #f5f5ff; }
.v2-mode .action-label { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .action-text { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; }
.v2-mode .ai-row { display: flex; align-items: center; gap: 14rpx; }
.v2-mode .ai-dot { width: 20rpx; height: 20rpx; border: 2rpx solid #111; background: #FFD93D; display: inline-block; animation: blink-dot 1s ease-in-out infinite; }
@keyframes blink-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.75); }
}
</style>
