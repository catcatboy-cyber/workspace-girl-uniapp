<template>
  <view class="page">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">评估历史不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">Assessment History / {{ caseFile.name }}</text>
        <text class="h1">一个 case 已经支持多次评估历史</text>
        <text class="hero-subtext">初评、手动重评和事件驱动重算都会累计到这里，方便你回看判断是怎么变化的。</text>
        <view class="actions">
          <button class="btn-secondary" @click="goCaseDetail">返回关系主页</button>
          <button class="btn-secondary" @click="goTimeline">打开时间线</button>
        </view>
      </view>

      <view class="card">
        <text class="h2">评估记录</text>
        <text class="muted">最新评估排在最上面。共 {{ assessments.length }} 次评估</text>
      </view>

      <view class="card">
        <AssessmentTrendChart
          :assessments="assessments"
          title="评估趋势"
          subtitle="意向与风险的历史变化"
        />
      </view>

      <view v-if="assessments.length === 0" class="card">
        <text class="muted">还没有评估历史，先做一次初评或补一条会触发重算的事件。</text>
      </view>

      <view v-else class="grid">
        <view
          v-for="(item, index) in assessments"
          :key="item.assessmentId || index"
          class="card a-card"
        >
          <view class="a-header">
            <text class="a-title">第 {{ assessments.length - index }} 次评估</text>
            <text class="muted">版本：{{ item.version || '--' }}</text>
          </view>

          <view class="case-kpis">
            <view class="kpi-item">
              <text class="kpi-label">意向</text>
              <text class="kpi-value">{{ item.intentScore }}</text>
              <text class="muted">{{ mapIntentLabel(item.intentBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">风险</text>
              <text class="kpi-value">{{ item.consistencyRiskScore }}</text>
              <text class="muted">{{ mapRiskLabel(item.riskBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">证据等级</text>
              <text class="kpi-value">{{ item.evidenceLevel }}</text>
              <text class="muted">可信度：{{ item.confidenceLevel }}</text>
            </view>
          </view>

          <text class="headline">{{ item.explanation?.headline }}</text>
          <view v-if="trendSummaries[index]" class="trend-summary-box">
            <text class="trend-summary">{{ trendSummaries[index].summaryText }}</text>
            <text v-if="trendSummaries[index].warningText" class="trend-warning">{{ trendSummaries[index].warningText }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId } from '@/utils/api'
import { showError } from '@/utils/helpers'
import { compareAssessments } from '@/utils/insights'
import AssessmentTrendChart from '@/components/AssessmentTrendChart.vue'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')

const assessments = computed(() => {
  const list = caseFile.value?.assessments || []
  // 约定：后端按 createdAt asc 返回，这里反转为倒序展示（最新在前）
  return [...list].reverse()
})

const trendSummaries = computed(() => {
  return assessments.value.map((item: any, index: number) => {
    const previous = assessments.value[index + 1] || null
    const trend = compareAssessments(previous, item)
    return trend.hasPrevious ? trend : null
  })
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

onLoad((options) => {
  caseId.value = options?.caseId || ''
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    showError('缺少 caseId')
    return
  }
  userId.value = uid
  loading.value = true
  try {
    caseFile.value = await getCaseDetail(uid, caseId.value)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function goCaseDetail() {
  uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId.value}` })
}

function goTimeline() {
  uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId.value}` })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 36rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.actions { display: flex; gap: 12rpx; margin-top: 18rpx; flex-wrap: wrap; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 24rpx; }
.grid { display: flex; flex-direction: column; gap: 16rpx; }
.a-card { padding: 24rpx; }
.a-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.a-title { font-size: 30rpx; font-weight: 700; color: #143f3a; }
.case-kpis { display: flex; gap: 12rpx; flex-wrap: wrap; margin: 12rpx 0; }
.kpi-item { flex: 1 1 28%; min-width: 180rpx; background: #fff; border-radius: 12rpx; padding: 16rpx; }
.kpi-label { display: block; font-size: 22rpx; color: #786857; }
.kpi-value { display: block; font-size: 32rpx; font-weight: 700; color: #143f3a; }
.headline { display: block; font-size: 26rpx; font-weight: 600; color: #241b12; margin-top: 12rpx; }
.trend-summary-box { margin-top: 14rpx; padding: 18rpx; background: #fff; border-radius: 12rpx; border: 2rpx solid #efe7d8; }
.trend-summary { display: block; font-size: 24rpx; color: #241b12; font-weight: 600; }
.trend-warning { display: block; font-size: 24rpx; color: #b85c38; margin-top: 8rpx; }
</style>
