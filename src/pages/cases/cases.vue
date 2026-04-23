<template>
  <view class="page">
    <view class="hero-card card">
      <text class="hero-topline">Case 列表</text>
      <text class="h1">所有关系对象都有自己的入口</text>
      <text class="hero-subtext">从这里可以看到所有 case，分别进入关系主页和时间线。</text>
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
                <image v-if="item.profile?.avatar" :src="item.profile.avatar" mode="aspectFill" />
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
            <button class="btn-primary small" @click="goDetail(item.caseId)">查看主页</button>
            <button class="btn-secondary small" @click="goTimeline(item.caseId)">继续记录</button>
            <button class="btn-secondary small" @click="goEditProfile(item.caseId)">画像</button>
            <button class="btn-secondary small" @click="goAssessments(item.caseId)">评估历史</button>
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
import { formatDateTime, showError } from '@/utils/helpers'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const deleted = ref(false)

onLoad((options) => {
  deleted.value = options?.deleted === '1'
})

onShow(() => {
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
function goDetail(caseId: string) {
  uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId}` })
}
function goTimeline(caseId: string) {
  uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId}` })
}
function goEditProfile(caseId: string) {
  uni.navigateTo({ url: `/pages/edit-profile/edit-profile?caseId=${caseId}` })
}
function goAssessments(caseId: string) {
  uni.navigateTo({ url: `/pages/assessments/assessments?caseId=${caseId}` })
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
</style>
