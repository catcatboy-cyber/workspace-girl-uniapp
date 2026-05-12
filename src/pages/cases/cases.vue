<template>
  <view class="page" :style="themeVars">
    <view class="hero-card card">
      <text class="hero-topline">Case 列表</text>
      <text class="h1">先切换，再进入当前对象</text>
      <text class="hero-subtext">所有核心页面都跟随当前对象。想看另一个对象时，先在这里切换，再回首页继续记录或查看。</text>
      <button class="btn-primary" @click="goNew">创建新的关系对象</button>
    </view>

    <view v-if="deleted" class="card status-card success">
      <text class="status-strong">对象已删除。</text>
      <text class="muted">相关主页、时间线和评估历史已经一起移除。</text>
    </view>

    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else>
      <view class="card">
        <view class="section-head">
          <text class="h2">关系对象列表</text>
          <text class="muted">按最近更新时间排序。共 {{ cases.length }} 个 case</text>
        </view>
      </view>

      <view v-if="cases.length === 0" class="card">
        <text class="h3">还没有关系对象</text>
        <text class="muted">先回到首页做一次初评，系统会自动创建第一个入口。</text>
      </view>

      <view v-else class="grid">
        <view v-for="item in cases" :key="item.caseId" class="case-card card">
          <view class="case-header">
            <view class="case-title">
              <view class="profile-avatar sm">
                <image v-if="item.profile?.avatar" :src="item.profile.avatarUrl || item.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(item.name) }}</text>
              </view>
              <view>
                <text class="case-name">{{ item.name }}</text>
                <text class="muted">caseId: {{ item.caseId }}</text>
              </view>
            </view>
            <text class="muted">更新于 {{ formatDateTime(item.updatedAt) }}</text>
          </view>

          <view v-if="profileItems(item.profile).length > 0" class="badges">
            <text v-for="p in profileItems(item.profile)" :key="p" class="badge">{{ p }}</text>
          </view>

          <view class="case-kpis">
            <view class="kpi-item">
              <text class="kpi-label">意向</text>
              <text class="kpi-value">{{ item.latestResult?.intentScore ?? '--' }}</text>
              <text class="muted">{{ mapIntentLabel(item.latestResult?.intentBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">风险</text>
              <text class="kpi-value">{{ item.latestResult?.consistencyRiskScore ?? '--' }}</text>
              <text class="muted">{{ mapRiskLabel(item.latestResult?.riskBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">证据等级</text>
              <text class="kpi-value">{{ item.latestResult?.evidenceLevel ?? '--' }}</text>
              <text class="muted">手动 {{ item.timeline?.length ?? 0 }} 条</text>
            </view>
          </view>

          <view class="actions">
            <button
              :class="[isActiveCase(item.caseId) ? 'btn-secondary' : 'btn-primary', 'small']"
              :disabled="isActiveCase(item.caseId)"
              @click="switchActiveCase(item.caseId)"
            >
              {{ isActiveCase(item.caseId) ? '当前对象' : '切换到首页' }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCases, getCurrentUserId } from '@/utils/api'
import { formatDateTime, getActiveCaseId, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const deleted = ref(false)
const themeVars = ref(getThemeStyle())
const activeCaseId = ref('')

onLoad((options) => {
  deleted.value = options?.deleted === '1'
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  activeCaseId.value = getActiveCaseId()
  deleted.value = uni.getStorageSync('casesDeletedFlag') === '1'
  if (deleted.value) {
    uni.removeStorageSync('casesDeletedFlag')
  }
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const list = await getCases(uid)
    cases.value = (list || []).map((c: any) => ({ ...c, caseId: c.caseId || c._id }))
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
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
    default: return '未评估'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未评估'
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
  showSuccess('已切换当前对象')
  setTimeout(() => {
    uni.switchTab({ url: '/pages/index/index' })
  }, 300)
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; letter-spacing: 2rpx; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 8rpx; }
.h3 { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; margin: 8rpx 0 16rpx; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 4rpx 0; }
.center { text-align: center; padding: 60rpx 0; }
.section-head { display: flex; justify-content: space-between; align-items: flex-start; }
.grid { display: flex; flex-direction: column; gap: 18rpx; }
.case-card { padding: 28rpx; }
.case-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.case-title { display: flex; align-items: center; gap: 14rpx; }
.case-name { display: block; font-size: 32rpx; font-weight: 700; color: #143f3a; }
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: #efe7d8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar.sm { width: 68rpx; height: 68rpx; }
.profile-avatar image { width: 100%; height: 100%; }
.avatar-placeholder { font-size: 24rpx; font-weight: 700; color: #786857; }
.badges { margin: 12rpx 0; }
.badge { display: inline-block; padding: 8rpx 16rpx; background: #efe7d8; border-radius: 999rpx; font-size: 22rpx; color: #241b12; margin: 4rpx; }
.case-kpis { display: flex; gap: 12rpx; margin: 16rpx 0; flex-wrap: wrap; }
.kpi-item { flex: 1 1 28%; background: #fff; border-radius: 12rpx; padding: 16rpx; min-width: 180rpx; }
.kpi-label { display: block; font-size: 22rpx; color: #786857; }
.kpi-value { display: block; font-size: 32rpx; font-weight: 700; color: #143f3a; }
.actions { display: flex; gap: 12rpx; margin-top: 16rpx; flex-wrap: wrap; }
.btn-primary { height: 76rpx; line-height: 76rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; padding: 0 28rpx; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 28rpx; }
.btn-primary.small, .btn-secondary.small { flex: 1; min-width: 160rpx; }
.btn-primary[disabled], .btn-secondary[disabled] {
  opacity: 0.72;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  box-shadow: none;
}
.status-card {
  border-left: 8rpx solid #143f3a;
}
.status-card.success {
  border-left-color: #14633a;
  background: #dff5e8;
}
.status-strong {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #241b12;
  margin-bottom: 6rpx;
}

/* Premium visual pass */
.page {
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
}

.card {
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 18rpx;
  box-shadow: 0 16rpx 36rpx rgba(32, 25, 20, 0.06);
}

.hero-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
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
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.hero-card .h1 {
  color: #fffaf0;
  line-height: 1.25;
}

.hero-subtext {
  color: rgba(255, 252, 247, 0.76);
}

.h1,
.h2,
.h3,
.case-name,
.status-strong {
  color: var(--text-main, #201914);
}

.hero-card .h1,
.hero-card .hero-topline,
.hero-card .hero-subtext {
  color: #fffaf0;
}

.hero-card .hero-topline,
.hero-card .hero-subtext {
  color: rgba(255, 252, 247, 0.76);
}

.muted,
.kpi-label {
  color: var(--text-muted, #76695c);
}

.case-card,
.kpi-item {
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.kpi-item {
  background: var(--card-soft, #fffaf3);
}

.case-name,
.kpi-value {
  color: var(--primary, #123c36);
  letter-spacing: 0;
}

.badge {
  background: var(--accent-soft, rgba(201, 164, 92, 0.14));
  border: 1rpx solid rgba(201, 164, 92, 0.24);
  color: #6f5225;
}

.profile-avatar {
  border: 2rpx solid rgba(201, 164, 92, 0.45);
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  border-radius: 14rpx;
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.18);
  font-weight: 650;
}

.btn-secondary {
  background: rgba(255, 252, 247, 0.92);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  color: var(--primary, #123c36);
  border-radius: 14rpx;
  font-weight: 600;
}

.status-card {
  border-left: 6rpx solid var(--success, #0f6b45);
  box-shadow: 0 14rpx 28rpx rgba(32, 25, 20, 0.05);
}

.status-card.success {
  background: #eef7ef;
}

/* Second visual pass: make non-hero cards less flat */
.card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
}

.card .h2,
.card .h3 {
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  line-height: 1.35;
}

.case-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.72);
}

.case-header {
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.08);
}

.kpi-item {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0) 100rpx),
    var(--card-soft, #fffaf3);
  border-radius: 16rpx;
}

.kpi-value {
  font-size: 38rpx;
}
</style>
