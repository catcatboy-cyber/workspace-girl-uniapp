<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
    <view v-if="refreshing" class="sync-bar-v2"></view>
    <view class="hero-block-v2 anim-hero">
      <text class="hero-tag-v2">MONTHLY REVIEW</text>
      <text class="hero-title-v2">月度<text class="hl-v2">复盘</text></text>
      <text class="hero-copy-v2">按自然月查看系统对这段关系的阶段总结。</text>
      <view v-if="caseName" class="tag-row-v2">
        <text class="tag-v2 black">{{ caseName }}</text>
        <text v-if="reviews.length" class="tag-v2">{{ reviews.length }} 个月</text>
      </view>
    </view>

    <view class="card-v2 action-card-v2">
      <view class="section-head-v2">
        <view>
          <text class="section-title-v2">本月复盘</text>
          <text class="section-sub-v2">{{ currentReview ? '已有本月复盘，可在有新事件后重新生成。' : '还没有本月复盘。' }}</text>
        </view>
        <button class="btn btn-primary btn-sm btn-auto" :disabled="generating" @click="generateCurrentReview">{{ generating ? '生成中' : currentReview ? '重新生成' : '生成' }}</button>
      </view>
      <view v-if="generating" class="ai-row-v2"><view class="ai-dot-v2"></view><text>后台分析中，完成后会刷新列表。</text></view>
      <text v-else-if="refreshing" class="refresh-text-v2">正在同步最新复盘...</text>
    </view>

    <view v-if="loading && reviews.length === 0" class="loading-v2">LOADING...</view>
    <view v-else-if="reviews.length === 0" class="empty-v2">
      <text class="empty-title-v2">还没有月度复盘</text>
      <text class="empty-sub-v2">先生成一次，本页会按月份保存每次复盘。</text>
    </view>
    <view v-else class="review-list-v2">
      <view v-for="item in reviews" :key="reviewKey(item)" class="review-card-v2">
        <view class="review-axis-v2">
          <text class="review-axis-start-v2">{{ formatMonthRange(item).start }}</text>
          <text class="review-axis-connector-v2">↓</text>
          <text class="review-axis-end-v2">{{ formatMonthRange(item).end }}</text>
          <view class="review-dot-v2"></view>
        </view>
        <view class="review-body-v2">
          <view class="review-head-v2">
            <text class="review-title-v2">{{ item.title || monthTitle(item) }}</text>
            <text v-if="item.generatedAt" class="review-time-v2">{{ formatGeneratedAt(item.generatedAt) }}</text>
          </view>
          <view class="tag-row-v2">
            <text class="tag-v2 black sm">月度复盘</text>
            <text v-if="item.trendLabel" class="tag-v2 sm">{{ mapMonthlyTrendLabel(item.trendLabel) }}</text>
            <text v-if="item.aiUsed" class="tag-v2 sm">AI 复盘</text>
          </view>
          <text v-if="item.summary" class="review-desc-v2">{{ item.summary }}</text>
          <view v-if="item.eventCount || item.assessmentCount || item.intentDelta !== undefined || item.riskDelta !== undefined" class="tag-row-v2 review-metrics-v2">
            <text v-if="item.eventCount" class="tag-v2 sm">事件 {{ item.eventCount }}</text>
            <text v-if="item.assessmentCount" class="tag-v2 sm">分析 {{ item.assessmentCount }}</text>
            <text v-if="item.intentDelta !== undefined" class="tag-v2 sm">意向 {{ signed(item.intentDelta) }}</text>
            <text v-if="item.riskDelta !== undefined" class="tag-v2 sm">风险 {{ signed(item.riskDelta) }}</text>
          </view>
          <view v-if="item.keyChanges?.length" class="review-block-v2">
            <text class="section-title-v2">本月关键变化</text>
            <text v-for="change in item.keyChanges" :key="change" class="bullet-v2">• {{ change }}</text>
          </view>
          <view v-if="item.keyEvents?.length" class="review-block-v2 events">
            <text class="section-title-v2">关键事件</text>
            <text v-for="event in item.keyEvents" :key="event" class="bullet-v2">• {{ event }}</text>
          </view>
          <view v-if="item.nextWeekFocus?.length" class="review-block-v2 focus">
            <text class="section-title-v2">下月观察重点</text>
            <text v-for="focus in item.nextWeekFocus" :key="focus" class="bullet-v2">• {{ focus }}</text>
          </view>
          <view v-if="item.avoidMisread?.length" class="review-block-v2 avoid">
            <text class="section-title-v2">本月避免误判</text>
            <text v-for="avoid in item.avoidMisread" :key="avoid" class="bullet-v2">• {{ avoid }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { generateMonthlyReview, getCaseDetail, getCurrentUserId, getMonthlyReviews } from '@/utils/api'
import { getActiveCaseId, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { appendReferralParams, buildSafeTimelineShare, SAFE_SHARE_IMAGE } from '@/utils/share'

const loading = ref(true)
const refreshing = ref(false)
const generating = ref(false)
const fontSizeMode = ref(getFontSizeMode())
const themeVars = ref(getThemeStyle())
const caseId = ref('')
const caseName = ref('')
const userId = ref('')
const currentMonthStart = ref('')
const reviews = ref<any[]>([])
const initialized = ref(false)
const MONTHLY_REVIEW_CACHE_PREFIX = 'monthlyReviewCache:v1:'

const currentReview = computed(() => {
  if (!currentMonthStart.value) return null
  return reviews.value.find((item: any) => item.monthStart === currentMonthStart.value || item.weekStart === currentMonthStart.value) || null
})

onLoad((options) => {
  caseId.value = String(options?.caseId || getActiveCaseId() || '').trim()
  if (caseId.value) setActiveCaseId(caseId.value)
  applyMonthlyReviewCache()
})

onShow(() => {
  fontSizeMode.value = getFontSizeMode()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  const hasLocalData = reviews.value.length > 0 || !!caseName.value
  loadData({ silent: initialized.value || hasLocalData })
})

onShareAppMessage(() => {
  const path = appendReferralParams(`/pages/monthly-review/monthly-review?caseId=${caseId.value}`, 'monthly_review')
  return { title: `我和 ${caseName.value || 'TA'} 的月度复盘`, path, imageUrl: SAFE_SHARE_IMAGE }
})

onShareTimeline(() => buildSafeTimelineShare())

async function loadData(options: { silent?: boolean } = {}) {
  const silent = Boolean(options.silent)
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    caseId.value = getActiveCaseId()
  }
  if (!caseId.value) {
    showError('缺少 Crush')
    loading.value = false
    return
  }
  userId.value = uid
  if (silent) {
    refreshing.value = true
  } else {
    loading.value = true
  }
  try {
    const [detail, monthly] = await Promise.all([
      getCaseDetail(uid, caseId.value).catch(() => null),
      getMonthlyReviews(uid, caseId.value)
    ])
    caseName.value = detail?.name || ''
    reviews.value = monthly.reviews || []
    currentMonthStart.value = monthly.currentMonthStart || ''
    writeMonthlyReviewCache()
  } catch (error: any) {
    if (silent && (reviews.value.length > 0 || caseName.value)) {
      // keep cached content visible on silent refresh failure
    } else {
      showError(error?.message || '加载月度复盘失败')
    }
  } finally {
    loading.value = false
    refreshing.value = false
    initialized.value = true
  }
}

async function generateCurrentReview() {
  if (generating.value || !caseId.value) return
  if (!userId.value) userId.value = getCurrentUserId()
  if (!userId.value) return
  generating.value = true
  try {
    const res = await generateMonthlyReview(userId.value, caseId.value)
    reviews.value = res.reviews || []
    currentMonthStart.value = res.currentMonthStart || currentMonthStart.value
    writeMonthlyReviewCache()
    showSuccess('本月复盘已生成')
  } catch (error: any) {
    if (error?.code === 'INSUFFICIENT_BALANCE') {
      showError(error?.message || 'Token 不足')
    } else {
      showError(error?.message || '生成失败')
    }
  } finally {
    generating.value = false
  }
}

function cacheKey() {
  return `${MONTHLY_REVIEW_CACHE_PREFIX}${caseId.value || 'default'}`
}

function applyMonthlyReviewCache() {
  if (!caseId.value) return false
  try {
    const cached = uni.getStorageSync(cacheKey())
    if (!cached || !Array.isArray(cached.reviews)) return false
    caseName.value = cached.caseName || ''
    reviews.value = cached.reviews || []
    currentMonthStart.value = cached.currentMonthStart || ''
    loading.value = false
    initialized.value = true
    return true
  } catch {
    return false
  }
}

function writeMonthlyReviewCache() {
  if (!caseId.value) return
  try {
    uni.setStorageSync(cacheKey(), {
      caseId: caseId.value,
      caseName: caseName.value,
      reviews: reviews.value,
      currentMonthStart: currentMonthStart.value,
      cachedAt: Date.now()
    })
  } catch {}
}

function reviewKey(item: any) {
  return item._id || item.id || item.monthStart || item.weekStart || item.generatedAt
}

function monthTitle(item: any) {
  const range = formatMonthRange(item)
  return `${range.start.replace('1日', '')}复盘`
}

function formatMonthRange(item: any) {
  const anchor = item?.monthStart || item?.monthEnd || item?.weekEnd || item?.weekStart || item?.generatedAt || item?.createdAt
  if (!anchor) return { start: '--', end: '' }
  const parts = String(anchor).split('-')
  let year = 0
  let monthIdx = -1
  if (parts.length >= 2 && /^\d{4}$/.test(parts[0])) {
    year = Number(parts[0])
    monthIdx = Number(parts[1]) - 1
  } else {
    const date = new Date(anchor)
    if (Number.isNaN(date.getTime())) return { start: '--', end: '' }
    year = date.getFullYear()
    monthIdx = date.getMonth()
  }
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  return { start: `${monthIdx + 1}月1日`, end: `${monthIdx + 1}月${lastDay}日` }
}

function formatGeneratedAt(value: any) {
  const timestamp = new Date(value).getTime()
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `生成于 ${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function signed(value: any) {
  const n = Number(value || 0)
  return n > 0 ? `+${n}` : String(n)
}

function mapMonthlyTrendLabel(label: any) {
  const normalized = String(label || '').trim()
  const map: Record<string, string> = {
    持续向好: '本月回暖',
    持续走低: '本月转弱',
    风险抬头: '本月承压',
    起伏不定: '本月波动',
    基本持平: '本月平稳',
    稳定观察: '本月观察',
    升温期: '本月回暖',
    升温中: '本月回暖',
    走弱期: '本月转弱',
    暂时平稳: '本月平稳'
  }
  return map[normalized] || (normalized ? `本月${normalized.replace(/^本月/, '')}` : '本月复盘')
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page { min-height: 100vh; background: var(--app-bg, #FFFDF5); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { padding-bottom: calc(120rpx + env(safe-area-inset-bottom)); }
.v2-mode .sync-bar-v2 { position: fixed; top: 0; left: 0; right: 0; z-index: 20; height: 6rpx; background: linear-gradient(90deg, #4ECDC4, #FFD93D, #FF6B6B); animation: sync-slide 1s linear infinite; }
.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 36rpx; font-weight: 900; color: #111; letter-spacing: 4rpx; }
.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 32rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 44rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hero-title-v2 .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 36rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; }
.v2-mode .action-card-v2 { margin-bottom: 18rpx; }
.v2-mode .section-head-v2 { display: flex; justify-content: space-between; align-items: flex-start; gap: 12rpx; }
.v2-mode .section-title-v2 { @include section-title-v2; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .section-sub-v2 { display: block; font-size: 32rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .refresh-text-v2 { display: block; margin-top: 12rpx; font-size: 32rpx; font-weight: 700; color: #999; }
.v2-mode .tag-row-v2 { @include tag-row-v2; margin-top: 10rpx; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { @include tag-v2-black; }
.v2-mode .tag-v2.sm { padding: 4rpx 10rpx; font-size: 24rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; }
.v2-mode .empty-title-v2 { display: block; font-size: 36rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 34rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .review-list-v2 { display: flex; flex-direction: column; gap: 18rpx; }
.v2-mode .review-card-v2 { display: flex; gap: 18rpx; }
.v2-mode .review-axis-v2 { width: 92rpx; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding-top: 8rpx; color: #666; font-size: 24rpx; font-weight: 800; }
.v2-mode .review-axis-start-v2, .v2-mode .review-axis-end-v2 { display: block; text-align: center; line-height: 1.2; }
.v2-mode .review-axis-connector-v2 { margin: 6rpx 0; color: #111; }
.v2-mode .review-dot-v2 { width: 20rpx; height: 20rpx; border: 3rpx solid #111; background: #4ECDC4; margin-top: 8rpx; }
.v2-mode .review-body-v2 { flex: 1; min-width: 0; background: #fff; border: 3rpx solid #111; box-shadow: 5rpx 5rpx 0 #111; padding: 22rpx; }
.v2-mode .review-head-v2 { display: flex; justify-content: space-between; align-items: flex-start; gap: 12rpx; }
.v2-mode .review-title-v2 { flex: 1; font-size: 36rpx; font-weight: 900; color: #111; line-height: 1.3; }
.v2-mode .review-time-v2 { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: #999; }
.v2-mode .review-desc-v2 { display: block; margin-top: 12rpx; font-size: 34rpx; font-weight: 600; color: #555; line-height: 1.55; }
.v2-mode .review-metrics-v2 { margin-top: 12rpx; }
.v2-mode .review-block-v2 { margin-top: 12rpx; padding: 14rpx; border-left: 3rpx solid #FFD93D; background: #FFFBEB; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .review-block-v2.events { border-left-color: #111; background: #f9f9f9; }
.v2-mode .review-block-v2.focus { border-left-color: #4ECDC4; background: #f5f5ff; }
.v2-mode .review-block-v2.avoid { border-left-color: #FF6B6B; background: #FFFBEB; }
.v2-mode .bullet-v2 { display: block; font-size: 34rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }
.v2-mode .ai-row-v2 { display: flex; align-items: center; gap: 12rpx; margin-top: 14rpx; font-size: 34rpx; font-weight: 700; color: #555; }
.v2-mode .ai-dot-v2 { width: 18rpx; height: 18rpx; border: 2rpx solid #111; background: #FFD93D; animation: blink-dot 1s ease-in-out infinite; }
@keyframes blink-dot { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes sync-slide { 0% { transform: translateX(-40%); } 100% { transform: translateX(40%); } }

/* Global typography alignment: keep the standalone monthly review page on shared tokens. */
.v2-mode .hero-tag-v2,
.v2-mode .tag-v2.sm,
.v2-mode .review-axis-v2,
.v2-mode .review-time-v2 {
  font-size: $fs-caption;
  font-weight: $fw-label;
}

.v2-mode .loading-v2,
.v2-mode .empty-title-v2,
.v2-mode .review-title-v2 {
  font-size: $fs-heading;
  font-weight: $fw-heading;
  color: $c-ink;
}

.v2-mode .hero-title-v2 {
  font-size: $fs-hero-title;
  font-weight: $fw-hero;
  color: $c-ink;
  letter-spacing: 0;
}

.v2-mode .hero-copy-v2,
.v2-mode .section-sub-v2,
.v2-mode .empty-sub-v2,
.v2-mode .review-desc-v2,
.v2-mode .bullet-v2,
.v2-mode .ai-row-v2 {
  font-size: $fs-body;
  font-weight: $fw-body;
  color: $c-muted;
  line-height: $lh-body;
}

.v2-mode .refresh-text-v2,
.v2-mode .review-time-v2 {
  color: $c-soft;
}
</style>
