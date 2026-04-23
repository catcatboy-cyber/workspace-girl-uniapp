<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中...</view>

    <!-- 空状态：显示 AssessmentForm -->
    <template v-else-if="cases.length === 0">
      <view class="card hero-card">
        <text class="hero-topline">Relationship Signal Lab</text>
        <text class="h1">先做一次初次评估</text>
        <text class="hero-subtext">第一次进入时先完成一轮结构化问答。后续你更常做的动作会是补记录、看时间线和重新评估，而不是每次都重答整套题。</text>
      </view>

      <AssessmentForm @submit="onCreateCase" />
    </template>

    <!-- 有案例：显示最近案例 KPI + 快速记录 -->
    <template v-else>
      <view class="card hero-card">
        <view class="section-head">
          <text class="hero-topline">Home / Active Cases</text>
          <text class="h1">优先追录新事件</text>
          <text class="hero-subtext">你已经有 {{ cases.length }} 个关系对象。先确认当前在追谁，再继续记录。</text>
        </view>

        <view class="case-kpis">
          <view class="kpi-item">
            <text class="kpi-label">对象</text>
            <view class="case-identity">
              <view class="profile-avatar sm">
                <image v-if="latestCase.profile?.avatar" :src="latestCase.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(latestCase.name) }}</text>
              </view>
              <text class="kpi-value">{{ latestCase.name }}</text>
            </view>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">意向</text>
            <text class="kpi-value">{{ latestCase.latestResult?.intentScore ?? '--' }}</text>
            <text class="muted">{{ mapIntentLabel(latestCase.latestResult?.intentBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">风险</text>
            <text class="kpi-value">{{ latestCase.latestResult?.consistencyRiskScore ?? '--' }}</text>
            <text class="muted">{{ mapRiskLabel(latestCase.latestResult?.riskBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">记录数量</text>
            <text class="kpi-value">{{ latestCase.timeline?.length ?? 0 }}</text>
            <text class="muted">时间线事件</text>
          </view>
        </view>

        <view v-if="latestProfileItems.length > 0" class="badges">
          <text v-for="item in latestProfileItems" :key="item" class="badge">{{ item }}</text>
        </view>

        <!-- 快速记录 -->
        <view class="quick-record-box">
          <text class="h3">一句话快速记录</text>
          <text class="muted">直接记到最近对象。</text>
          <textarea
            v-model="quickDesc"
            class="text-area"
            placeholder="例如：他今天主动约我吃饭，提前把时间地点都定好了。"
          />
          <view class="field">
            <text class="field-label">具体发生时间</text>
            <view class="datetime-row">
              <picker mode="date" :value="quickDate" @change="onQuickDateChange">
                <view class="picker-view">{{ quickDate }}</view>
              </picker>
              <picker mode="time" :value="quickTime" @change="onQuickTimeChange">
                <view class="picker-view">{{ quickTime }}</view>
              </picker>
            </view>
          </view>
          <view class="actions">
            <button class="btn-primary" :disabled="quickSubmitting" @click="submitQuickRecord">
              {{ quickSubmitting ? '保存中...' : '保存到最近对象' }}
            </button>
          </view>
        </view>

        <view
          v-if="showQuickFeedback && latestCase.latestResult && latestTrend && latestTriggerEvent"
          :class="['card', 'status-card', quickFeedback?.eventType === 'risk' ? 'warning' : 'success']"
        >
          <text class="status-strong">已记录：{{ latestTriggerEvent.title }}</text>
          <text class="muted">{{ mapTimelineTypeLabel(quickFeedback?.eventType) }}</text>
          <view class="feedback-stats">
            <text class="badge">意向 {{ latestTrend.intentDelta > 0 ? `+${latestTrend.intentDelta}` : latestTrend.intentDelta }}</text>
            <text class="badge">风险 {{ latestTrend.riskDelta > 0 ? `+${latestTrend.riskDelta}` : latestTrend.riskDelta }}</text>
            <text class="badge">{{ mapAction(latestCase.latestResult.nextAction) }}</text>
          </view>
          <text class="muted feedback-headline">{{ latestCase.latestResult.explanation?.headline }}</text>
          <view class="actions">
            <button class="btn-secondary" @click="goCaseDetail(latestCase.caseId)">查看当前主页</button>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="h2">下一步建议</text>
        <view class="actions vertical">
          <button class="btn-primary" @click="goTimeline(latestCase.caseId)">给最近对象追加事件</button>
          <button class="btn-secondary" @click="goReassess(latestCase.caseId)">重新评估最近对象</button>
          <button class="btn-secondary" @click="goCases">查看所有关系对象</button>
          <button class="btn-secondary" @click="goNew">创建新的关系对象</button>
        </view>
      </view>

      <!-- 周复盘 -->
      <view v-if="weeklyReview" class="card">
        <text class="h2">{{ weeklyReview.title }}</text>
        <view class="case-kpis">
          <view v-for="stat in weeklyReview.stats" :key="stat.label" class="kpi-item">
            <text class="kpi-label">{{ stat.label }}</text>
            <text class="kpi-value">{{ stat.value }}</text>
          </view>
        </view>
        <text class="muted">{{ weeklyReview.summary }}</text>
        <text class="muted highlight-text">{{ weeklyReview.highlight }}</text>
        <text v-if="weeklyReview.warning" class="muted warning-text">{{ weeklyReview.warning }}</text>
      </view>

      <!-- 观察成就 -->
      <view v-if="achievements.length > 0" class="card">
        <text class="h2">观察成就</text>
        <view class="grid">
          <view v-for="item in achievements" :key="item.title" class="achievement-item">
            <text class="achievement-title">{{ item.title }}</text>
            <text class="achievement-value">{{ item.value }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="h2">最近更新列表</text>
        <text class="muted">按最近更新时间展示前 3 个对象。</text>
        <view class="grid">
          <view
            v-for="item in cases.slice(0, 3)"
            :key="item.caseId"
            class="case-mini"
          >
            <view class="case-mini-head">
              <view class="profile-avatar xs">
                <image v-if="item.profile?.avatar" :src="item.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(item.name) }}</text>
              </view>
              <view class="mini-meta">
                <text class="mini-name">{{ item.name }}</text>
                <text class="muted">更新于 {{ formatDateTime(item.updatedAt) }}</text>
              </view>
            </view>
            <view v-if="getCaseProfileItems(item).length > 0" class="badges mini-badges">
              <text v-for="profileItem in getCaseProfileItems(item)" :key="profileItem" class="badge">{{ profileItem }}</text>
            </view>
            <view class="actions case-mini-actions">
              <button class="btn-secondary compact" @click="goCaseDetail(item.caseId)">关系主页</button>
              <button class="btn-secondary compact" @click="goTimeline(item.caseId)">继续记录</button>
              <button class="btn-secondary compact" @click="goEditProfile(item.caseId)">画像</button>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { getCases, createCase, createTimeline, getCurrentUserId } from '@/utils/api'
import { combineDateAndTimeToISOString, formatDateTime, getDateInputValue, getTimeInputValue, showError, showSuccess } from '@/utils/helpers'
import { buildCaseWeeklyReview, buildObservationAchievements, buildProfileItems, compareAssessments } from '@/utils/insights'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const quickDesc = ref('')
const quickDate = ref(getDateInputValue())
const quickTime = ref(getTimeInputValue())
const quickSubmitting = ref(false)
const quickFeedback = ref<{ caseId: string; eventType: string } | null>(null)

const latestCase = computed(() => cases.value[0] || {} as any)

const latestProfileItems = computed(() => {
  const p = latestCase.value?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
})

const weeklyReview = computed(() => {
  if (!latestCase.value?.latestResult) return null
  const safeCase = {
    ...latestCase.value,
    timeline: latestCase.value.timeline || [],
    assessments: latestCase.value.assessments || [latestCase.value.latestResult]
  }
  return buildCaseWeeklyReview(safeCase)
})

const achievements = computed(() => {
  const safeCases = cases.value.map((c: any) => ({
    ...c,
    timeline: c.timeline || [],
    assessments: c.assessments || (c.latestResult ? [c.latestResult] : [])
  }))
  return buildObservationAchievements(safeCases)
})

const latestTriggerEvent = computed(() => {
  const triggerEventId = latestCase.value?.latestResult?.triggerEventId
  if (!triggerEventId) return null
  return latestCase.value?.timeline?.find((item: any) => (item.id || item._id) === triggerEventId) || null
})

const latestTrend = computed(() => {
  if (!latestCase.value?.latestResult || !latestCase.value?.assessments?.length) return null
  const previous = latestCase.value.assessments.length > 1
    ? latestCase.value.assessments[latestCase.value.assessments.length - 2]
    : null
  return compareAssessments(previous, latestCase.value.latestResult)
})

const showQuickFeedback = computed(() => {
  return Boolean(
    quickFeedback.value
    && quickFeedback.value.caseId === latestCase.value?.caseId
    && latestCase.value?.latestResult
    && latestTrend.value
    && latestTriggerEvent.value
  )
})

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

function mapTimelineTypeLabel(type?: string) {
  switch (type) {
    case 'positive': return '推进事件'
    case 'risk': return '风险事件'
    case 'verification': return '验证事件'
    case 'note': return '普通记录'
    default: return '关系记录'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'observe': return '继续观察'
    case 'verify': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    case 'insufficient_data': return '样本还不够'
    default: return '继续观察'
  }
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

function getCaseProfileItems(item: any) {
  return buildProfileItems(item?.profile || {}).slice(0, 3)
}

onShow(() => {
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

async function onCreateCase(payload: { name: string; answers: any[]; profile: any }) {
  uni.showLoading({ title: '创建中...' })
  try {
    const res = await createCase({
      userId: userId.value,
      name: payload.name,
      answers: payload.answers,
      profile: payload.profile
    })
    uni.hideLoading()
    if (res.success) {
      showSuccess('已创建')
      const caseId = res.caseId || res.case?.caseId
      if (caseId) {
        uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId}` })
      } else {
        await loadData()
      }
    } else {
      showError(res.message || '创建失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    showError(e?.message || '创建失败')
  }
}

function onQuickDateChange(e: any) {
  quickDate.value = e.detail.value
}

function onQuickTimeChange(e: any) {
  quickTime.value = e.detail.value
}

async function submitQuickRecord() {
  if (quickSubmitting.value) return
  if (!quickDesc.value.trim()) {
    showError('请填写描述')
    return
  }
  if (!latestCase.value?.caseId) return
  quickSubmitting.value = true
  try {
    const desc = quickDesc.value.trim()
    const currentCaseId = latestCase.value.caseId
    const res = await createTimeline({
      userId: userId.value,
      caseId: currentCaseId,
      description: desc,
      occurrenceAt: combineDateAndTimeToISOString(quickDate.value, quickTime.value)
    })
    if (res.success) {
      showSuccess('已记录')
      quickDesc.value = ''
      quickDate.value = getDateInputValue()
      quickTime.value = getTimeInputValue()
      await loadData()
      quickFeedback.value = {
        caseId: currentCaseId,
        eventType: res.eventType || latestCase.value?.latestResult?.triggerEventType || 'note'
      }
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    quickSubmitting.value = false
  }
}

function goTimeline(caseId: string) {
  uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId}` })
}
function goReassess(caseId: string) {
  uni.navigateTo({ url: `/pages/reassess/reassess?caseId=${caseId}` })
}
function goCaseDetail(caseId: string) {
  uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId}` })
}
function goEditProfile(caseId: string) {
  uni.navigateTo({ url: `/pages/edit-profile/edit-profile?caseId=${caseId}` })
}
function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}
function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f4ede2;
  padding: 24rpx;
  box-sizing: border-box;
}
.loading {
  text-align: center;
  padding: 80rpx 0;
  color: #786857;
}
.card {
  background: #fbf6ee;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.hero-card {
  background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%);
}
.hero-topline {
  display: block;
  font-size: 22rpx;
  color: #786857;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-bottom: 8rpx;
}
.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #143f3a;
  margin: 8rpx 0;
}
.h2 {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #241b12;
  margin-bottom: 12rpx;
}
.h3 {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #241b12;
}
.hero-subtext {
  display: block;
  font-size: 26rpx;
  color: #786857;
  line-height: 1.6;
  margin-top: 8rpx;
}
.muted {
  display: block;
  font-size: 24rpx;
  color: #786857;
  margin: 6rpx 0;
}
.section-head { margin-bottom: 18rpx; }
.case-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}
.kpi-item {
  flex: 1 1 40%;
  background: #fff;
  border-radius: 14rpx;
  padding: 20rpx;
  min-width: 200rpx;
}
.kpi-label {
  display: block;
  font-size: 22rpx;
  color: #786857;
}
.kpi-value {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #143f3a;
  margin-top: 4rpx;
}
.case-identity {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 8rpx;
}
.badges { margin-top: 18rpx; }
.badge {
  display: inline-block;
  padding: 8rpx 16rpx;
  background: #efe7d8;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #241b12;
  margin: 4rpx;
}
.quick-record-box {
  margin-top: 28rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 14rpx;
}
.text-area {
  width: 100%;
  min-height: 160rpx;
  padding: 18rpx;
  margin-top: 12rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #241b12;
  box-sizing: border-box;
}
.field { margin-top: 16rpx; }
.field-label {
  display: block;
  font-size: 24rpx;
  color: #241b12;
  margin-bottom: 8rpx;
}
.picker-view {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 22rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #241b12;
}
.datetime-row {
  display: grid;
  grid-template-columns: 1fr 220rpx;
  gap: 12rpx;
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.actions.vertical { flex-direction: column; }
.btn-primary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #143f3a;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.btn-secondary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #fff;
  color: #143f3a;
  border: 2rpx solid #143f3a;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 14rpx;
}
.case-mini {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  border: 2rpx solid #efe7d8;
}
.case-mini-head {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}
.mini-meta {
  flex: 1;
  min-width: 0;
}
.mini-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #241b12;
}
.mini-badges {
  margin-top: 14rpx;
}
.case-mini-actions {
  margin-top: 16rpx;
  flex-wrap: wrap;
}
.btn-secondary.compact {
  flex: 1 1 30%;
  min-width: 160rpx;
  height: 68rpx;
  line-height: 68rpx;
  font-size: 24rpx;
}
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: #efe7d8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar.sm {
  width: 68rpx;
  height: 68rpx;
}
.profile-avatar.xs {
  width: 52rpx;
  height: 52rpx;
}
.profile-avatar image {
  width: 100%;
  height: 100%;
}
.avatar-placeholder {
  font-size: 24rpx;
  font-weight: 700;
  color: #786857;
}
.highlight-text {
  color: #14633a;
  font-weight: 500;
}
.warning-text {
  color: #b85c38;
  font-weight: 500;
}
.achievement-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  border: 2rpx solid #efe7d8;
}
.achievement-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #241b12;
  margin-bottom: 4rpx;
}
.achievement-value {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #143f3a;
  margin: 4rpx 0;
}
.status-card {
  margin-top: 20rpx;
  border-left: 8rpx solid #143f3a;
}
.status-card.success {
  border-left-color: #14633a;
  background: #dff5e8;
}
.status-card.warning {
  border-left-color: #b85c38;
  background: #f9d8d2;
}
.status-strong {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #241b12;
}
.feedback-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.feedback-headline {
  margin-top: 10rpx;
}
</style>
