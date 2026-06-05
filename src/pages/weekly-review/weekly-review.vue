<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
      <view v-if="syncing" class="sync-bar"></view>
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else>
        <view class="hero-block-v2"><text class="hero-tag-v2">14-DAY REVIEW / {{ caseName }}</text><text class="hero-title-v2">近14天<text class="hl-v2">复盘</text></text><text class="hero-copy-v2">按近14天窗口回看真实事件和分数净变化，避免被单次情绪带着走。</text><view class="btn-row-v2"><button class="btn-v2-wr" @click="goCaseDetail">回去</button><button class="btn-v2-wr" @click="goTimeline">往事</button></view></view>
        <!-- Generate -->
        <view class="card-v2"><text class="section-title-v2">近14天 AI 复盘</text><text class="card-text-v2">上下文只看基础画像、近14天真实事件和分数净变化。</text><button class="btn-v2-wr primary full" style="margin-top:14rpx;" :disabled="generating || (currentReview && !hasNewEventsSinceReview)" @click="generateCurrentWeek">{{ generating ? '生成中...' : (currentReview && !hasNewEventsSinceReview) ? '还没新事件' : (currentReview ? '重新生成近14天复盘' : '生成近14天复盘') }}</button></view>
        <!-- Current review -->
        <view v-if="currentReview" class="card-v2 review-v2">
          <view class="review-head-v2"><view><text class="review-week-v2">{{ currentReview.weekStart }} - {{ currentReview.weekEnd }}</text><text class="review-title-v2">{{ currentReview.title }}</text></view><view class="tag-row-v2"><text class="tag-v2 black">{{ mapWeeklyTrendLabel(currentReview.trendLabel) }}</text><text v-if="currentReview.aiUsed" class="tag-v2 black">AI 复盘</text></view></view>
          <text class="review-summary-v2" user-select>{{ currentReview.summary }}</text>
          <view class="tag-row-v2" style="margin-top:10rpx;"><text class="tag-v2">事件 {{ currentReview.eventCount }}</text><text class="tag-v2">分析 {{ currentReview.assessmentCount }}</text><text class="tag-v2">意向 {{ formatDelta(currentReview.intentDelta) }}</text><text class="tag-v2">风险 {{ formatDelta(currentReview.riskDelta) }}</text></view>
          <view v-if="currentReview.keyChanges?.length" class="review-block-v2"><text class="section-title-v2">近14天关键变化</text><text v-for="item in currentReview.keyChanges" :key="item" class="bullet-v2" user-select>• {{ item }}</text></view>
          <view v-if="currentReview.keyEvents?.length" class="review-block-v2"><text class="section-title-v2">关键事件</text><text v-for="item in currentReview.keyEvents" :key="item" class="bullet-v2" user-select>• {{ item }}</text></view>
          <view v-if="currentReview.nextWeekFocus?.length" class="review-block-v2"><text class="section-title-v2">下个14天观察重点</text><text v-for="item in currentReview.nextWeekFocus" :key="item" class="bullet-v2" user-select>• {{ item }}</text></view>
          <view v-if="currentReview.avoidMisread?.length" class="review-block-v2"><text class="section-title-v2">近14天避免误判</text><text v-for="item in currentReview.avoidMisread" :key="item" class="bullet-v2" user-select>• {{ item }}</text></view>
        </view>
        <view v-else class="empty-v2"><text class="empty-title-v2">近14天还没有复盘</text><text class="empty-sub-v2">先生成一次近14天复盘，后续会沉淀为历史。</text></view>
        <!-- Side read -->
        <view class="card-v2"><text class="section-title-v2">近14天星象速写</text><text class="card-text-v2">结合属相、星座和近14天事件，给出近14天星象速写。</text><button class="btn-v2-wr primary full" style="margin-top:14rpx;" :disabled="!currentReview || sideReadLoading || (currentWeeklySideRead && !hasNewEventsSinceSideRead)" @click="generateCurrentWeeklySideRead">{{ sideReadLoading ? '生成中...' : (currentWeeklySideRead && !hasNewEventsSinceSideRead) ? '还没新事件' : (currentWeeklySideRead ? '重新生成近14天星象速写' : '生成近14天星象速写') }}</button>
          <view v-if="currentWeeklySideRead" class="side-body-v2"><text class="review-title-v2">{{ currentWeeklySideRead.title }}</text><text class="review-summary-v2" user-select>{{ currentWeeklySideRead.summary }}</text><view v-for="item in currentWeeklySideRead.sections" :key="item.label" class="side-item-v2"><text class="side-label-v2">{{ item.label }}</text><text class="side-text-v2" user-select>{{ item.text }}</text></view></view>
          <text v-else-if="currentReview" class="card-text-v2 muted" style="margin-top:10rpx;">近14天还没有星象速写，可以单独生成。</text>
          <text v-else class="card-text-v2 muted" style="margin-top:10rpx;">请先生成近14天复盘，再生成近14天星象速写。</text>
        </view>
        <!-- History -->
        <view class="card-v2"><text class="section-title-v2">历史14天复盘</text><text class="card-text-v2">按近14天窗口保存，帮助你看连续趋势。</text></view>
        <view v-if="historyReviews.length === 0" class="empty-v2"><text class="empty-sub-v2">暂无历史14天复盘。</text></view>
        <view v-else class="history-list-v2"><view v-for="item in historyReviews" :key="item._id" class="card-v2 history-card-v2"><view class="review-head-v2"><view><text class="review-week-v2">{{ item.weekStart }} - {{ item.weekEnd }}</text><text class="review-title-v2">{{ item.title }}</text></view><text class="tag-v2">{{ mapWeeklyTrendLabel(item.trendLabel) }}</text></view><text class="review-summary-v2" user-select>{{ item.summary }}</text><view class="tag-row-v2" style="margin-top:8rpx;"><text class="tag-v2">意向 {{ formatDelta(item.intentDelta) }}</text><text class="tag-v2">风险 {{ formatDelta(item.riskDelta) }}</text><text class="tag-v2">事件 {{ item.eventCount }}</text></view></view></view>
      </view>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
  generateWeeklyReview,
  generateWeeklySideRead,
  getCaseDetail,
  getCases,
  getCurrentUserId,
  handleInsufficientBalance,
  getWeeklyReviews
} from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { bumpDataVersion, getActiveCaseId, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'

const loading = ref(true)
const syncing = ref(false)
const generating = ref(false)
const sideReadLoading = ref(false)
const userId = ref('')
const caseId = ref('')
const caseName = ref('当前 Crush')
const reviews = ref<any[]>([])
const caseTimeline = ref<any[]>([])
const currentWeekStart = ref('')
const themeVars = ref(getThemeStyle())
const initialized = ref(false)

const currentReview = computed(() => {
  return reviews.value.find((item) => item.weekStart === currentWeekStart.value) || null
})

const currentWeeklySideRead = computed(() => {
  return currentReview.value?.weeklySideRead || null
})

const latestEventTime = computed(() => {
  let max = 0
  for (const item of caseTimeline.value) {
    if (!item || !item.occurrenceAt) continue
    if (item.type === 'assessment' || item.type === 'trend' || item.type === 'weekly_review') continue
    if (item.type === 'note' && item.feature === 'weeklySideRead') continue
    const t = new Date(item.occurrenceAt).getTime()
    if (t > max) max = t
  }
  return max
})

const hasNewEventsSinceReview = computed(() => {
  const r = currentReview.value
  if (!r) return true
  const reviewTime = r.generatedAt ? new Date(r.generatedAt).getTime() : 0
  return latestEventTime.value > reviewTime
})

const hasNewEventsSinceSideRead = computed(() => {
  const r = currentReview.value
  const side = currentWeeklySideRead.value
  if (!r) return false
  if (!side) return true
  const t = side.generatedAt || r.weeklySideReadGeneratedAt || r.generatedAt
  const sideTime = t ? new Date(t).getTime() : 0
  return latestEventTime.value > sideTime
})

const historyReviews = computed(() => {
  return reviews.value.filter((item) => item.weekStart !== currentWeekStart.value)
})

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || getActiveCaseId()
  if (caseId.value) setActiveCaseId(caseId.value)
  initialized.value = true
  loadData()
})

const lastDataVersion = ref(0)

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  const active = getActiveCaseId()
  if (active && active !== caseId.value) {
    caseId.value = active
    loadData()
    return
  }
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dv > lastDataVersion.value) { lastDataVersion.value = dv; loadData({ silent: true }) }
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

const WEEKLY_CACHE_PREFIX = 'weeklyCache:v1:'

function readWeeklyCache(uid, id) {
  try {
    const cached = uni.getStorageSync(`${WEEKLY_CACHE_PREFIX}${uid}:${id}`)
    return cached || null
  } catch { return null }
}

function writeWeeklyCache(uid, id, data) {
  try {
    uni.setStorageSync(`${WEEKLY_CACHE_PREFIX}${uid}:${id}`, {
      cachedAt: Date.now(),
      caseName: data.caseName,
      reviews: data.reviews,
      currentWeekStart: data.currentWeekStart
    })
  } catch {}
}

async function loadData(options?: { silent?: boolean }) {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid

  // Show cached data immediately on first load
  if (!reviews.value.length) {
    const cacheKey = caseId.value || getActiveCaseId()
    const cached = cacheKey ? readWeeklyCache(uid, cacheKey) : null
    if (cached) {
      caseName.value = cached.caseName || '当前 Crush'
      reviews.value = cached.reviews || []
      currentWeekStart.value = cached.currentWeekStart || ''
      loading.value = false
    }
  }

  if (!reviews.value.length) loading.value = true
  else syncing.value = true
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      reviews.value = []
      caseName.value = '当前 Crush'
      return
    }
    setActiveCaseId(caseId.value)
    const [caseFile, reviewRes] = await Promise.all([
      getCaseDetail(uid, caseId.value).catch(() => null),
      getWeeklyReviews(uid, caseId.value).catch(() => null)
    ])
    if (!caseFile && !reviewRes) {
      showError('加载14天复盘失败')
      return
    }
    caseName.value = caseFile?.name || '当前 Crush'
    caseTimeline.value = Array.isArray(caseFile?.timeline) ? caseFile.timeline : []
    reviews.value = reviewRes?.reviews || []
    currentWeekStart.value = reviewRes?.currentWeekStart || ''
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
    writeWeeklyCache(uid, caseId.value, {
      caseName: caseName.value,
      reviews: reviews.value,
      currentWeekStart: currentWeekStart.value
    })
  } catch (error: any) {
    showError(error?.message || '加载14天复盘失败')
  } finally {
    loading.value = false
    syncing.value = false
  }
}

async function generateCurrentWeek() {
  if (generating.value) return
  generating.value = true
  try {
    const res = await generateWeeklyReview(userId.value, caseId.value, currentWeekStart.value)
    reviews.value = res.reviews || []
    currentWeekStart.value = res.review?.weekStart || currentWeekStart.value
    bumpDataVersion()
    writeWeeklyCache(userId.value, caseId.value, { caseName: caseName.value, reviews: reviews.value, currentWeekStart: currentWeekStart.value })
    showSuccess('已生成近14天复盘')
  } catch (error: any) {
    if (handleInsufficientBalance(error)) return
    showError(error?.message || '生成14天复盘失败')
  } finally {
    generating.value = false
  }
}

async function generateCurrentWeeklySideRead() {
  if (sideReadLoading.value || !currentReview.value) return
  sideReadLoading.value = true
  try {
    const res = await generateWeeklySideRead(userId.value, caseId.value, currentWeekStart.value)
    reviews.value = res.reviews || reviews.value
    currentWeekStart.value = res.review?.weekStart || currentWeekStart.value
    bumpDataVersion()
    writeWeeklyCache(userId.value, caseId.value, { caseName: caseName.value, reviews: reviews.value, currentWeekStart: currentWeekStart.value })
    showSuccess('已生成近14天星象速写')
  } catch (error: any) {
    if (handleInsufficientBalance(error)) return
    showError(error?.message || '生成近14天星象速写失败')
  } finally {
    sideReadLoading.value = false
  }
}

function formatDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  if (numeric < 0) return String(numeric)
  return '持平'
}

function mapWeeklyTrendLabel(label: any) {
  const normalized = String(label || '').trim()
  const map: Record<string, string> = {
    持续向好: '近14天回暖',
    持续走低: '近14天转弱',
    风险抬头: '近14天承压',
    起伏不定: '近14天波动',
    基本持平: '近14天平稳',
    稳定观察: '近14天观察',
    升温期: '近14天回暖',
    升温中: '近14天回暖',
    走弱期: '近14天转弱',
    暂时平稳: '近14天平稳'
  }
  return map[normalized] || (normalized ? `近14天${normalized.replace(/^近14天/, '')}` : '近14天复盘')
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28rpx;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; text-align: center; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .btn-v2-wr { flex: 1; height: 64rpx; line-height: 64rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-wr.full { flex: none; width: 100%; height: 72rpx; line-height: 72rpx; font-size: 26rpx; }
.v2-mode .btn-v2-wr.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-wr[disabled] { opacity: 0.6; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 26rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }

.v2-mode .review-v2 { border-left: 10rpx solid #4ECDC4; }
.v2-mode .review-head-v2 { display: flex; justify-content: space-between; align-items: flex-start; gap: 12rpx; padding-bottom: 14rpx; border-bottom: 3rpx solid #111; margin-bottom: 14rpx; }
.v2-mode .review-week-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #666; }
.v2-mode .review-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1.3; margin-top: 4rpx; }
.v2-mode .review-summary-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.6; }
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; }
.v2-mode .tag-v2 { display: inline-flex; align-items: center; min-height: 36rpx; padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }

.v2-mode .review-block-v2 { margin-top: 16rpx; padding-top: 14rpx; border-top: 2rpx solid #111; }
.v2-mode .bullet-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .side-body-v2 { margin-top: 14rpx; padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .side-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed #111; }
.v2-mode .side-item-v2:last-child { border-bottom: none; }
.v2-mode .side-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .side-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; margin-top: 4rpx; }

.v2-mode .history-list-v2 { display: flex; flex-direction: column; gap: 18rpx; }
.v2-mode .history-card-v2 { border-left: 6rpx solid #FFD93D; }
.sync-bar { position: fixed; top: 0; left: 0; height: 3rpx; z-index: 9999; background: linear-gradient(90deg, transparent, #FF6B6B, transparent); animation: sync-slide 0.8s ease-in-out infinite; }
@keyframes sync-slide {
  0% { width: 30%; left: -30%; }
  100% { width: 30%; left: 130%; }
}
</style>
