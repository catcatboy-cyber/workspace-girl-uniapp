<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else class="content">
      <view class="hero-card card">
        <text class="hero-topline">Weekly Review / {{ caseName }}</text>
        <text class="h1">本周复盘</text>
        <text class="hero-subtext">按周回看真实事件和分数净变化，避免被单次情绪带着走。</text>
        <view class="actions">
          <button class="btn-secondary" @click="goCaseDetail">返回关系主页</button>
          <button class="btn-secondary" @click="goTimeline">打开时间轴</button>
        </view>
      </view>

      <view class="card">
        <view class="section-head">
          <view>
            <text class="h2">本周 AI 复盘</text>
            <text class="muted">上下文只看基础画像、本周真实事件和分数净变化；再次生成会覆盖本周复盘版本。</text>
          </view>
        </view>
        <view class="actions">
          <button class="btn-primary" :disabled="generating" @click="generateCurrentWeek">
            {{ generating ? '生成中...' : currentReview ? '重新生成本周复盘' : '生成本周复盘' }}
          </button>
        </view>
      </view>

      <view v-if="currentReview" class="card review-card current">
        <view class="review-head">
          <view>
            <text class="review-week">{{ currentReview.weekStart }} 至 {{ currentReview.weekEnd }}</text>
            <text class="review-title">{{ currentReview.title }}</text>
          </view>
          <view class="review-pills">
            <text class="trend-pill">{{ currentReview.trendLabel }}</text>
            <text v-if="currentReview.aiUsed" class="ai-badge">AI 已参与研判</text>
          </view>
        </view>
        <text class="review-summary" user-select>{{ currentReview.summary }}</text>
        <view class="score-strip">
          <text class="score-chip">事件 {{ currentReview.eventCount }}</text>
          <text class="score-chip">评估 {{ currentReview.assessmentCount }}</text>
          <text class="score-chip">意向 {{ formatDelta(currentReview.intentDelta) }}</text>
          <text class="score-chip">风险 {{ formatDelta(currentReview.riskDelta) }}</text>
        </view>
        <view class="review-section">
          <text class="section-title">本周关键变化</text>
          <text v-for="item in currentReview.keyChanges" :key="item" class="bullet" user-select>• {{ item }}</text>
        </view>
        <view class="review-section">
          <text class="section-title">关键事件</text>
          <text v-for="item in currentReview.keyEvents" :key="item" class="bullet" user-select>• {{ item }}</text>
        </view>
        <view class="review-section">
          <text class="section-title">下周观察重点</text>
          <text v-for="item in currentReview.nextWeekFocus" :key="item" class="bullet" user-select>• {{ item }}</text>
        </view>
        <view class="review-section">
          <text class="section-title">本周避免误判</text>
          <text v-for="item in currentReview.avoidMisread" :key="item" class="bullet" user-select>• {{ item }}</text>
        </view>
      </view>

      <view v-else class="card empty-card">
        <text class="h2">本周还没有复盘</text>
        <text class="muted">先生成一次本周复盘，后续会沉淀为历史周复盘，方便对比长期趋势。</text>
      </view>

      <view class="card side-read-card">
        <view class="section-head">
          <view>
            <text class="h2">本周侧写</text>
            <text class="muted">单独触发 AI 生成。结合属相、星座和本周事件，给出本周侧写。</text>
          </view>
        </view>
        <view class="actions">
          <button class="btn-primary" :disabled="!currentReview || sideReadLoading" @click="generateCurrentWeeklySideRead">
            {{ sideReadLoading ? '生成中...' : currentWeeklySideRead ? '重新生成本周侧写' : '生成本周属相星座侧写' }}
          </button>
        </view>

        <view v-if="currentWeeklySideRead" class="side-read-body">
          <text class="review-title">{{ currentWeeklySideRead.title }}</text>
          <text class="side-read-summary" user-select>{{ currentWeeklySideRead.summary }}</text>
          <view v-for="item in currentWeeklySideRead.sections" :key="item.label" class="side-read-section">
            <text class="side-read-label">{{ item.label }}</text>
            <text class="side-read-text" user-select>{{ item.text }}</text>
          </view>
        </view>
        <text v-else-if="currentReview" class="muted empty-inline">这周还没有侧写，可以单独生成。</text>
        <text v-else class="muted empty-inline">请先生成本周复盘，再生成本周侧写。</text>
      </view>

      <view class="card">
        <text class="h2">历史周复盘</text>
        <text class="muted">按周保存，帮助你看连续趋势，而不是被某一天的情绪牵着走。</text>
      </view>

      <view v-if="historyReviews.length === 0" class="card empty-card">
        <text class="muted">暂无历史周复盘。</text>
      </view>

      <view v-else class="history-list">
        <view v-for="item in historyReviews" :key="item._id" class="card review-card compact">
          <view class="review-head">
            <view>
              <text class="review-week">{{ item.weekStart }} 至 {{ item.weekEnd }}</text>
              <text class="review-title">{{ item.title }}</text>
            </view>
            <text class="trend-pill">{{ item.trendLabel }}</text>
          </view>
          <text class="review-summary" user-select>{{ item.summary }}</text>
          <view class="score-strip">
            <text class="score-chip">意向 {{ formatDelta(item.intentDelta) }}</text>
            <text class="score-chip">风险 {{ formatDelta(item.riskDelta) }}</text>
            <text class="score-chip">事件 {{ item.eventCount }}</text>
          </view>
        </view>
      </view>
    </view>
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
  getWeeklyReviews
} from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { getActiveCaseId, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'

const loading = ref(true)
const generating = ref(false)
const sideReadLoading = ref(false)
const userId = ref('')
const caseId = ref('')
const caseName = ref('当前对象')
const reviews = ref<any[]>([])
const currentWeekStart = ref('')
const themeVars = ref(getThemeStyle())
const initialized = ref(false)

const currentReview = computed(() => {
  return reviews.value.find((item) => item.weekStart === currentWeekStart.value) || null
})

const currentWeeklySideRead = computed(() => {
  return currentReview.value?.weeklySideRead || null
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

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  const active = getActiveCaseId()
  if (active && active !== caseId.value) {
    caseId.value = active
    loadData()
  }
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

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      reviews.value = []
      caseName.value = '当前对象'
      return
    }
    setActiveCaseId(caseId.value)
    const [caseFile, reviewRes] = await Promise.all([
      getCaseDetail(uid, caseId.value),
      getWeeklyReviews(uid, caseId.value)
    ])
    caseName.value = caseFile?.name || '当前对象'
    reviews.value = reviewRes.reviews || []
    currentWeekStart.value = reviewRes.currentWeekStart || ''
  } catch (error: any) {
    showError(error?.message || '加载周复盘失败')
  } finally {
    loading.value = false
  }
}

async function generateCurrentWeek() {
  if (generating.value) return
  generating.value = true
  try {
    const res = await generateWeeklyReview(userId.value, caseId.value, currentWeekStart.value)
    reviews.value = res.reviews || []
    currentWeekStart.value = res.review?.weekStart || currentWeekStart.value
    showSuccess('已生成本周复盘')
  } catch (error: any) {
    showError(error?.message || '生成周复盘失败')
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
    showSuccess('已生成本周侧写')
  } catch (error: any) {
    showError(error?.message || '生成本周侧写失败')
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

.center {
  text-align: center;
  padding: 80rpx 0;
}

.card {
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
  padding: 32rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background: linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: 0 22rpx 44rpx rgba(18, 60, 54, 0.18);
}

.hero-card::after {
  content: "";
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}

.hero-topline {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.h1,
.h2,
.review-title,
.review-summary,
.section-title,
.side-read-label,
.side-read-text,
.side-read-summary {
  color: var(--text-main, #201914);
}

.h1 {
  display: block;
  margin: 8rpx 0;
  font-size: 42rpx;
  line-height: 1.3;
  font-weight: 700;
  color: #fffaf0;
}

.h2 {
  display: block;
  margin-bottom: 10rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 700;
}

.hero-subtext,
.muted,
.review-week,
.bullet,
.empty-inline {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--text-muted, #76695c);
}

.hero-subtext {
  font-size: 26rpx;
  color: rgba(255, 252, 247, 0.76);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  min-width: 220rpx;
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 650;
}

.btn-primary {
  border: none;
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  color: #fff;
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.18);
}

.btn-secondary {
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  background: rgba(255, 252, 247, 0.92);
  color: var(--primary, #123c36);
}

.review-card,
.side-read-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.72);
}

.review-card.current {
  border-left-color: var(--primary, #123c36);
}

.review-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18rpx;
}

.review-title {
  display: block;
  margin-top: 4rpx;
  font-size: 30rpx;
  line-height: 1.4;
  font-weight: 700;
}

.review-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.trend-pill,
.ai-badge,
.score-chip {
  display: inline-block;
  min-height: 40rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  line-height: 40rpx;
  font-weight: 700;
}

.trend-pill {
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
}

.ai-badge {
  background: rgba(201, 164, 92, 0.2);
  color: #7c5b18;
}

.score-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 18rpx;
}

.score-chip {
  background: rgba(201, 164, 92, 0.14);
  color: #6f5225;
}

.review-summary,
.side-read-summary,
.side-read-text {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  line-height: 1.6;
  font-weight: 650;
}

.review-section,
.side-read-section {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: var(--card-soft, #fffaf3);
}

.section-title,
.side-read-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 26rpx;
  line-height: 1.4;
  font-weight: 700;
}

.bullet {
  margin-top: 8rpx;
}

.empty-inline {
  margin-top: 16rpx;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>
