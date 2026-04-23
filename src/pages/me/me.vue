<template>
  <view class="page">
    <view class="card hero-card">
      <text class="hero-topline">Me / Settings</text>
      <text class="h1">我的</text>
      <text class="hero-subtext">这里管理账号、系统能力和个人设置。</text>
    </view>

    <view class="card">
      <text class="h2">账号信息</text>
      <text class="muted">当前登录账号：{{ userEmail || '未登录' }}</text>
      <text class="muted">关系对象数：{{ caseCount }}</text>
      <view class="actions">
        <button class="btn-danger" @click="onLogout">退出登录</button>
      </view>
    </view>

    <view class="card">
      <text class="h2">功能设置</text>
      <view class="row">
        <view class="row-item">
          <text class="row-title">AI 事件研判</text>
          <text class="muted">{{ aiStatusSummary }}</text>
          <text class="muted" v-if="aiStatusDetail">{{ aiStatusDetail }}</text>
          <button class="btn-secondary" @click="goAISettings">AI 设置</button>
        </view>
      </view>
      <view class="row">
        <view class="row-item">
          <text class="row-title">数据与对象</text>
          <text class="muted">查看所有关系对象、时间线与评估。</text>
          <button class="btn-secondary" @click="goCases">打开对象列表</button>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="h2">判断说明</text>

      <text class="h3">意向倾向</text>
      <view v-for="item in intentLevels" :key="item.label" class="level-item">
        <text class="level-title">{{ item.label }} · {{ item.range }}</text>
        <text class="muted">{{ item.description }}</text>
      </view>

      <text class="h3" style="margin-top: 24rpx;">风险等级</text>
      <view v-for="item in riskLevels" :key="item.label" class="level-item">
        <text class="level-title">{{ item.label }} · {{ item.range }}</text>
        <text class="muted">{{ item.description }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { logout, getCurrentUserId, getCases, getAISettings } from '@/utils/api'

const userEmail = ref('')
const caseCount = ref(0)
const aiStatusSummary = ref('正在读取当前 AI 配置...')
const aiStatusDetail = ref('')

const intentLevels = [
  { label: '低意向', range: '0-24', description: '主动与投入信号都比较弱。' },
  { label: '偏低意向', range: '25-44', description: '偶尔靠近但不稳定。' },
  { label: '中等意向', range: '45-59', description: '已经出现一定兴趣。' },
  { label: '中高意向', range: '60-74', description: '推进信号比较明显。' },
  { label: '高意向', range: '75-100', description: '主动性和投入度整体偏强。' }
]
const riskLevels = [
  { label: '低风险', range: '0-24', description: '一致性整体稳。' },
  { label: '偏低风险', range: '25-44', description: '偶尔会有小波动。' },
  { label: '中等风险', range: '45-59', description: '已有一些回避或反复线索。' },
  { label: '中高风险', range: '60-74', description: '风险信号比较集中。' },
  { label: '高风险', range: '75-100', description: '建议暂停投入，先核实关键事实。' }
]

onShow(() => {
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userEmail.value = uni.getStorageSync('userEmail') || ''
  try {
    const list = await getCases(uid)
    caseCount.value = (list || []).length
  } catch (e) {
    // 静默
  }

  try {
    const settings = await getAISettings(uid)
    if (!settings?.aiEnabled) {
      aiStatusSummary.value = '当前未启用 AI 事件研判，时间线会使用规则兜底。'
      aiStatusDetail.value = ''
      return
    }

    aiStatusSummary.value = `当前已启用 AI 事件研判，模型：${settings.aiModel || '未设置'}。`
    aiStatusDetail.value = settings.aiFallbackToRules === false
      ? 'AI 失败时不会自动回退到规则。'
      : 'AI 失败时会自动回退到规则兜底。'
  } catch (e) {
    aiStatusSummary.value = 'AI 配置读取失败，请进入设置页检查。'
    aiStatusDetail.value = ''
  }
}

function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}

function goAISettings() {
  uni.navigateTo({ url: '/pages/ai-settings/ai-settings' })
}

async function onLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.h3 { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin-top: 12rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.row { padding: 16rpx 0; border-top: 2rpx solid #efe7d8; }
.row:first-of-type { border-top: 0; }
.row-item { display: flex; flex-direction: column; gap: 8rpx; }
.row-title { font-size: 28rpx; font-weight: 600; color: #241b12; }
.actions { margin-top: 18rpx; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 24rpx; align-self: flex-start; }
.btn-danger { width: 100%; height: 80rpx; line-height: 80rpx; background: #b85c38; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.level-item { padding: 12rpx 0; }
.level-title { display: block; font-size: 26rpx; color: #241b12; font-weight: 600; }
</style>
