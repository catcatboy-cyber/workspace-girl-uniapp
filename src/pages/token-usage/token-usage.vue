<template>
  <view class="page">
    <view class="card hero-card">
      <text class="hero-topline">Token Usage</text>
      <text class="h1">消费明细</text>
      <text class="hero-subtext">这里展示当前账号最近的大模型调用 token 记录。</text>
    </view>

    <view class="card">
      <view class="section-head">
        <view>
          <text class="h2">汇总</text>
          <text class="muted">最近 {{ records.length }} 条记录</text>
        </view>
        <button class="btn-secondary mini-button" :disabled="loading" @click="loadData">{{ loading ? '读取中' : '刷新' }}</button>
      </view>
      <view class="summary-grid">
        <view class="summary-item"><text class="summary-number">{{ summary.totalTokens }}</text><text class="muted">总 token</text></view>
        <view class="summary-item"><text class="summary-number">{{ summary.callCount }}</text><text class="muted">调用次数</text></view>
        <view class="summary-item"><text class="summary-number">{{ summary.promptTokens }}</text><text class="muted">输入 token</text></view>
        <view class="summary-item"><text class="summary-number">{{ summary.completionTokens }}</text><text class="muted">输出 token</text></view>
      </view>
      <text v-if="summary.unavailableCount" class="muted">有 {{ summary.unavailableCount }} 次模型没有返回 usage，用量按 0 记录。</text>
    </view>

    <view class="card">
      <text class="h2">明细</text>
      <view v-if="records.length > 0" class="usage-list">
        <view v-for="item in records" :key="item.id" class="usage-row">
          <view class="usage-main">
            <text class="row-title">{{ mapFeature(item.feature) }}</text>
            <text class="muted">{{ item.model || '未知模型' }}</text>
            <text class="muted">{{ formatDate(item.createdAt) }}</text>
          </view>
          <view class="usage-counts">
            <text class="token-total">{{ item.totalTokens }}</text>
            <text class="muted">in {{ item.promptTokens }}</text>
            <text class="muted">out {{ item.completionTokens }}</text>
          </view>
        </view>
      </view>
      <text v-else class="muted">{{ loading ? '正在读取...' : '暂无 token 消费记录。' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getTokenUsage } from '@/utils/api'

const loading = ref(false)
const summary = ref({ promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0, unavailableCount: 0 })
const records = ref<Array<any>>([])

onShow(() => {
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loadData()
})

async function loadData() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await getTokenUsage(100)
    if (!result?.success) {
      uni.showToast({ title: result?.message || '读取失败', icon: 'none' })
      return
    }
    summary.value = {
      promptTokens: Number(result.summary?.promptTokens || 0),
      completionTokens: Number(result.summary?.completionTokens || 0),
      totalTokens: Number(result.summary?.totalTokens || 0),
      callCount: Number(result.summary?.callCount || 0),
      unavailableCount: Number(result.summary?.unavailableCount || 0)
    }
    records.value = Array.isArray(result.records) ? result.records : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '读取失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function mapFeature(feature: string) {
  const map: Record<string, string> = {
    eventAssessment: '即时反馈',
    weeklyReview: '本周复盘',
    weeklySideRead: '本周侧写',
    sideRead: '侧写',
    attachmentAnalysis: '附件识别'
  }
  return map[feature] || feature || '未知调用'
}

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.hero-subtext, .muted { display: block; font-size: 24rpx; color: #786857; line-height: 1.6; margin: 6rpx 0; }
.section-head { display: flex; justify-content: space-between; gap: 18rpx; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 24rpx; }
.mini-button { height: 60rpx; line-height: 60rpx; font-size: 24rpx; padding: 0 18rpx; flex-shrink: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; }
.summary-item, .usage-row { background: #fff; border: 1rpx solid rgba(20, 63, 58, 0.08); border-radius: 14rpx; }
.summary-item { padding: 18rpx; }
.summary-number, .token-total { display: block; color: #143f3a; font-weight: 750; }
.summary-number { font-size: 34rpx; }
.usage-list { display: flex; flex-direction: column; gap: 12rpx; margin-top: 18rpx; }
.usage-row { display: flex; justify-content: space-between; gap: 18rpx; padding: 18rpx; }
.row-title { display: block; font-size: 28rpx; font-weight: 650; color: #241b12; }
.usage-main { flex: 1; }
.usage-counts { min-width: 150rpx; text-align: right; }
.token-total { font-size: 32rpx; }
</style>
