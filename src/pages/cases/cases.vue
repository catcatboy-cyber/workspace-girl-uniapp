<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <!-- Hero -->
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">CRUSHES</text>
        <text class="hero-title-v2">Crushes <text class="hl-v2">列表</text></text>
        <text class="hero-copy-v2">先切换，再进入当前 Crush。共 <text class="strong">{{ cases.length }}</text> 个 Crushes。</text>
        <button class="btn-v2-hero anim-pulse" @click="goNew">+ 开个新的</button>
      </view>

      <!-- Deleted notice -->
      <view v-if="deleted" class="notice-v2 ok">
        <text class="notice-title-v2">Crush 已删除</text>
        <text class="notice-sub-v2">相关主页、往事和分析记录已经一起移除。</text>
      </view>

      <view v-if="loading" class="loading-v2">LOADING...</view>

      <view v-else>
        <view v-if="cases.length === 0" class="empty-v2">
          <text class="empty-title-v2">还没有 Crush</text>
          <text class="empty-sub-v2">先回到首页做一次初评，系统会自动创建第一个入口。</text>
        </view>

        <view v-else class="case-list-v2">
          <view v-for="(item, idx) in cases" :key="item.caseId" :class="['case-block-v2', idx === 0 ? 'anim-card' : '']" :style="idx === 0 ? 'animation-delay:0.15s' : ''">
            <!-- Case head -->
            <view class="case-head-v2">
              <view class="case-identity-v2">
                <view class="avatar-v2">
                  <image v-if="item.profile?.avatar" :src="item.profile.avatarUrl || item.profile.avatar" mode="aspectFill" />
                  <text v-else class="avatar-placeholder-v2">{{ avatarLabel(item.name) }}</text>
                </view>
                <view>
                  <text class="case-name-v2">{{ item.name }}</text>
                  <text class="case-id-v2">{{ item.caseId }}</text>
                </view>
              </view>
              <text class="case-updated-v2">更新于 {{ formatDateTime(item.updatedAt) }}</text>
            </view>

            <!-- Tags -->
            <view v-if="item.cardTypeLabel" class="tag-row-v2">
              <text v-if="item.cardTypeLabel" class="tag-v2 black">{{ item.cardTypeLabel }}</text>
            </view>
            <view v-if="item.cardProfileItems.length > 0" class="tag-row-v2">
              <text v-for="p in item.cardProfileItems" :key="p" class="tag-v2">{{ p }}</text>
            </view>

            <!-- KPI strip -->
            <view class="kpi-strip-v2">
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2">{{ item.latestResult?.intentScore ?? '--' }}</text>
                <text class="kpi-lbl-v2">意向 · {{ mapIntentLabel(item.latestResult?.intentBucket) }}</text>
              </view>
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2 risk">{{ item.latestResult?.consistencyRiskScore ?? '--' }}</text>
                <text class="kpi-lbl-v2">风险 · {{ mapRiskLabel(item.latestResult?.riskBucket) }}</text>
              </view>
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2">{{ item.latestResult?.evidenceLevel ?? '--' }}</text>
                <text class="kpi-lbl-v2">记录 · {{ item.timelineCount ?? item.timeline?.length ?? 0 }} 条</text>
              </view>
            </view>

            <!-- Action -->
            <button
              :class="['btn-v2-action', isActiveCase(item.caseId) ? 'disabled' : '']"
              :disabled="isActiveCase(item.caseId)"
              @click="switchActiveCase(item.caseId)"
            >
              {{ isActiveCase(item.caseId) ? '当前 Crush' : '切换到首页' }}
            </button>
          </view>
        </view>
      </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCases, getCurrentUserId } from '@/utils/api'
import { bumpDataVersion, formatDateTime, getActiveCaseId, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const deleted = ref(false)
const themeVars = ref(getThemeStyle())
const fontSizeMode = ref(getFontSizeMode())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const activeCaseId = ref('')
const CASES_CACHE_KEY = 'casesListCache:v1'

onLoad((options) => {
  deleted.value = options?.deleted === '1'
})

const lastDataVersion = ref(0)

onShow(() => {
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
    fontSizeMode.value = getFontSizeMode()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  activeCaseId.value = getActiveCaseId()
  deleted.value = uni.getStorageSync('casesDeletedFlag') === '1'
  if (deleted.value) {
    uni.removeStorageSync('casesDeletedFlag')
  }
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  const activeMissing = Boolean(
    activeCaseId.value
    && cases.value.length > 0
    && !cases.value.some((item: any) => item.caseId === activeCaseId.value || item._id === activeCaseId.value)
  )
  if (!cases.value.length || dv > lastDataVersion.value || activeMissing) loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  if (!cases.value.length) {
    const cached = readCasesCache(uid)
    if (cached.length > 0) {
      applyCasesList(cached)
      loading.value = false
    }
  }
  if (!cases.value.length) loading.value = true
  try {
    const list = await getCases(uid, { mode: 'list' })
    applyCasesList(list || [])
    writeCasesCache(uid, cases.value)
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function readCasesCache(uid: string) {
  try {
    const cached = uni.getStorageSync(CASES_CACHE_KEY)
    if (!cached || cached.userId !== uid || !Array.isArray(cached.cases)) return []
    return cached.cases
  } catch {
    return []
  }
}

function writeCasesCache(uid: string, list: any[]) {
  try {
    uni.setStorageSync(CASES_CACHE_KEY, {
      userId: uid,
      cachedAt: Date.now(),
      cases: list
    })
  } catch {}
}

function applyCasesList(list: any[]) {
  cases.value = (list || []).map((c: any) => ({
      ...c,
      caseId: c.caseId || c._id,
      cardTypeLabel: getRelationTypeLabel(c.profile),
      cardProfileItems: profileItems(c.profile),
    }))
}

function getRelationTypeLabel(p: any): string {
  const relationType = String(p?.relationType || '').trim()
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
  return ''
}

function profileItems(p: any): string[] {
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

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

function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}

function isActiveCase(caseId: string) {
  return Boolean(caseId && caseId === activeCaseId.value)
}

function switchActiveCase(caseId: string) {
  if (!caseId) return
  setActiveCaseId(caseId)
  activeCaseId.value = caseId
  bumpDataVersion()
  showSuccess('已切换当前 Crush')
  setTimeout(() => {
    uni.switchTab({ url: '/pages/index/index' })
  }, 300)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx),
    var(--app-bg, #f6f1e8);
  padding: var(--spacing-page, 28rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111;
  box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .hero-copy-v2 .strong { color: #111; font-weight: 900; }
.v2-mode .btn-v2-hero {
  margin-top: 20rpx; width: 100%; height: 72rpx; line-height: 72rpx;
  text-align: center; background: #fff; border: 3rpx solid #111;
  font-size: 26rpx; font-weight: 800; color: #111;
  box-shadow: 4rpx 4rpx 0 #111;
}

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; border-left: 12rpx solid #4ECDC4; }
.v2-mode .notice-v2.warn { background: #FFEEEC; border-left: 12rpx solid #FF6B6B; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; }

.v2-mode .loading-v2 { text-align: center; padding: 80rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }

.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; text-align: center; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .case-list-v2 { display: flex; flex-direction: column; gap: 18rpx; }

.v2-mode .case-block-v2 {
  background: #fff; border: 3rpx solid #111;
  box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx;
}
.v2-mode .case-head-v2 {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 16rpx; border-bottom: 3rpx solid #111; margin-bottom: 14rpx;
}
.v2-mode .case-identity-v2 { display: flex; align-items: center; gap: 14rpx; }
.v2-mode .avatar-v2 {
  width: 68rpx; height: 68rpx; border-radius: 50%; overflow: hidden;
  border: 3rpx solid #111; background: #FFD93D;
  display: flex; align-items: center; justify-content: center;
}
.v2-mode .avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .case-name-v2 { display: block; font-size: 30rpx; font-weight: 900; color: #111; }
.v2-mode .case-id-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-top: 2rpx; }
.v2-mode .case-updated-v2 { font-size: 20rpx; font-weight: 600; color: #999; white-space: nowrap; }

.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 12rpx; }
.v2-mode .tag-v2 {
  display: inline-flex; align-items: center; min-height: 36rpx;
  padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D;
  font-size: 20rpx; font-weight: 800; color: #111;
}
.v2-mode .tag-v2.black { background: #111; color: #fff; }

.v2-mode .kpi-strip-v2 { display: flex; margin-bottom: 16rpx; border: 3rpx solid #111; background: #f9f9f9; }
.v2-mode .kpi-cell-v2 { flex: 1; text-align: center; padding: 18rpx 8rpx; border-right: 3rpx solid #111; }
.v2-mode .kpi-cell-v2:last-child { border-right: none; }
.v2-mode .kpi-num-v2 { display: block; font-size: 40rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .kpi-num-v2.risk { color: #FF5252; }
.v2-mode .kpi-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 4rpx; text-transform: uppercase; letter-spacing: 2rpx; }

.v2-mode .btn-v2-action {
  width: 100%; height: 68rpx; line-height: 68rpx; text-align: center;
  background: #4ECDC4; border: 3rpx solid #111; box-shadow: 4rpx 4rpx 0 #111;
  font-size: 26rpx; font-weight: 800; color: #111;
}
.v2-mode .btn-v2-action.disabled,
.v2-mode .btn-v2-action[disabled] { opacity: 0.5; box-shadow: none; }
</style>
