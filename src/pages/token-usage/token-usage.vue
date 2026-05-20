<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']">
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>

    <!-- Tab 切换 -->
    <view class="tabs">
      <button :class="['tab-btn', activeTab === 'usage' ? 'active' : '']" @click="switchTab('usage')">模型用量</button>
      <button :class="['tab-btn', activeTab === 'ledger' ? 'active' : '']" @click="switchTab('ledger')">额度流水</button>
    </view>

    <!-- 模型用量 Tab -->
    <block v-if="activeTab === 'usage'">
      <block v-if="!showV2">
        <view class="card hero-card"><text class="hero-topline">Token Usage</text><text class="h1">消费明细</text><text class="hero-subtext">这里展示当前账号最近的大模型调用 token 记录。</text></view>
        <view class="card"><view class="section-head"><view><text class="h2">汇总</text><text class="muted">最近 {{ records.length }} 条记录</text></view><button class="btn-secondary mini-button" :disabled="loading" @click="loadUsage">{{ loading ? '读取中' : '刷新' }}</button></view><view class="summary-grid"><view class="summary-item"><text class="summary-number">{{ summary.totalTokens }}</text><text class="muted">总 token</text></view><view class="summary-item"><text class="summary-number">{{ summary.callCount }}</text><text class="muted">调用次数</text></view><view class="summary-item"><text class="summary-number">{{ summary.promptTokens }}</text><text class="muted">输入 token</text></view><view class="summary-item"><text class="summary-number">{{ summary.completionTokens }}</text><text class="muted">输出 token</text></view></view><text v-if="summary.unavailableCount" class="muted">有 {{ summary.unavailableCount }} 次模型没有返回 usage，用量按 0 记录。</text></view>
        <view class="card"><text class="h2">明细</text><view v-if="records.length > 0" class="usage-list"><view v-for="item in records" :key="item.id" class="usage-row"><view class="usage-main"><text class="row-title">{{ mapFeature(item.feature) }}</text><text class="muted">{{ item.model || '未知模型' }}</text><text class="muted">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts"><text class="token-total">{{ item.totalTokens }}</text><text class="muted">in {{ item.promptTokens }}</text><text class="muted">out {{ item.completionTokens }}</text></view></view></view><text v-else class="muted">{{ loading ? '正在读取...' : '暂无 token 消费记录。' }}</text></view>
      </block>
      <block v-if="showV2">
        <view class="hero-block-v2"><text class="hero-tag-v2">TOKEN USAGE</text><text class="hero-title-v2">消费<text class="hl-v2">明细</text></text><text class="hero-copy-v2">当前账号最近的大模型调用 token 记录。</text></view>
        <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">汇总</text><button class="btn-v2-t sm" :disabled="loading" @click="loadUsage">{{ loading ? '读取中' : '刷新' }}</button></view><text class="card-text-v2">最近 {{ records.length }} 条记录</text><view class="stats-grid-v2"><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.totalTokens }}</text><text class="stat-lbl-v2">总 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.callCount }}</text><text class="stat-lbl-v2">调用次数</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.promptTokens }}</text><text class="stat-lbl-v2">输入 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.completionTokens }}</text><text class="stat-lbl-v2">输出 token</text></view></view><text v-if="summary.unavailableCount" class="card-text-v2 muted">有 {{ summary.unavailableCount }} 次未返回 usage。</text></view>
        <view class="card-v2"><text class="section-title-v2">明细</text><view v-if="records.length > 0" class="usage-list-v2"><view v-for="item in records" :key="item.id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapFeature(item.feature) }}</text><text class="usage-meta-v2">{{ item.model || '未知模型' }} · {{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text class="usage-total-v2">{{ item.totalTokens }}</text><text class="usage-meta-v2">in {{ item.promptTokens }} / out {{ item.completionTokens }}</text></view></view></view><text v-else class="card-text-v2">{{ loading ? '正在读取...' : '暂无记录。' }}</text></view>
      </block>
    </block>

    <!-- 额度流水 Tab -->
    <block v-if="activeTab === 'ledger'">
      <block v-if="!showV2">
        <view class="card hero-card"><text class="hero-topline">Token Ledger</text><text class="h1">额度流水</text><text class="hero-subtext">展示赠送、充值、消费等所有额度变动记录。</text></view>
        <view class="card"><view class="section-head"><view><text class="h2">流水</text><text class="muted">最近 {{ ledgerRecords.length }} 条</text></view><button class="btn-secondary mini-button" :disabled="ledgerLoading" @click="loadLedger">{{ ledgerLoading ? '读取中' : '刷新' }}</button></view>
        <view v-if="ledgerRecords.length > 0" class="usage-list"><view v-for="item in ledgerRecords" :key="item._id || item.id" class="usage-row"><view class="usage-main"><text class="row-title">{{ mapLedgerType(item.type) }}</text><text class="muted">{{ item.remark || '' }}</text><text class="muted">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts"><text :class="['token-total', item.amountTokens > 0 ? 'positive' : 'negative']">{{ item.amountTokens > 0 ? '+' : '' }}{{ item.amountTokens }}</text><text class="muted">余额 {{ (item.balanceAfter || 0).toLocaleString() }}</text></view></view></view><text v-else class="muted">{{ ledgerLoading ? '正在读取...' : '暂无流水记录。' }}</text></view>
      </block>
      <block v-if="showV2">
        <view class="hero-block-v2"><text class="hero-tag-v2">TOKEN LEDGER</text><text class="hero-title-v2">额度<text class="hl-v2">流水</text></text><text class="hero-copy-v2">赠送、充值、消费等所有额度变动记录。</text></view>
        <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">流水</text><button class="btn-v2-t sm" :disabled="ledgerLoading" @click="loadLedger">{{ ledgerLoading ? '读取中' : '刷新' }}</button></view><text class="card-text-v2">最近 {{ ledgerRecords.length }} 条</text>
        <view v-if="ledgerRecords.length > 0" class="usage-list-v2"><view v-for="item in ledgerRecords" :key="item._id || item.id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapLedgerType(item.type) }}</text><text class="usage-meta-v2">{{ item.remark || '' }}</text><text class="usage-meta-v2">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text :class="['usage-total-v2', item.amountTokens > 0 ? 'positive' : 'negative']">{{ item.amountTokens > 0 ? '+' : '' }}{{ item.amountTokens }}</text><text class="usage-meta-v2">余额 {{ (item.balanceAfter || 0).toLocaleString() }}</text></view></view></view><text v-else class="card-text-v2">{{ ledgerLoading ? '正在读取...' : '暂无流水记录。' }}</text></view>
      </block>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getTokenUsage, getTokenLedger } from '@/utils/api'

const showV2 = ref(true)
const activeTab = ref<'usage' | 'ledger'>('usage')
const loading = ref(false)
const summary = ref({ promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0, unavailableCount: 0 })
const records = ref<Array<any>>([])
const ledgerRecords = ref<Array<any>>([])
const ledgerLoading = ref(false)

onShow(() => {
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loadUsage()
})

function switchTab(tab: 'usage' | 'ledger') {
  activeTab.value = tab
  if (tab === 'usage' && records.value.length === 0) loadUsage()
  if (tab === 'ledger' && ledgerRecords.value.length === 0) loadLedger()
}

async function loadUsage() {
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

async function loadLedger() {
  if (ledgerLoading.value) return
  ledgerLoading.value = true
  try {
    const result = await getTokenLedger(100)
    if (!result?.success) {
      uni.showToast({ title: result?.message || '读取失败', icon: 'none' })
      return
    }
    ledgerRecords.value = Array.isArray(result.records) ? result.records : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '读取失败', icon: 'none' })
  } finally {
    ledgerLoading.value = false
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

function mapLedgerType(type: string) {
  const map: Record<string, string> = {
    gift: '赠送',
    recharge: '充值',
    consume: '消费',
    refund: '退款',
    adjust: '调整'
  }
  return map[type] || type || '未知'
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
.usage-counts { min-width: 180rpx; text-align: right; }
.token-total { font-size: 32rpx; }
.positive { color: #27ae60 !important; }
.negative { color: #e74c3c !important; }

/* Tabs */
.tabs { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #143f3a; border-radius: 12rpx; overflow: hidden; background: #fff; }
.tab-btn { flex: 1; text-align: center; padding: 18rpx 0; font-size: 28rpx; font-weight: 700; border: none; background: #fff; color: #143f3a; }
.tab-btn.active { background: #143f3a; color: #fbf6ee; }

/* ===== CAMPUS POP V2 ===== */
.version-toggle { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #111; overflow: hidden; background: #fff; }
.toggle-tab { flex: 1; text-align: center; padding: 14rpx 0; font-size: 26rpx; font-weight: 700; color: #999; }
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }
.v2-mode .tabs { border-color: #111; }
.v2-mode .tab-btn.active { background: #111; color: #FFD93D; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }

.v2-mode .btn-v2-t { height: 52rpx; line-height: 52rpx; padding: 0 20rpx; background: #fff; border: 2rpx solid #111; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-t.sm { flex-shrink: 0; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx 8rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 4rpx; }

.v2-mode .usage-list-v2 { display: flex; flex-direction: column; gap: 10rpx; margin-top: 12rpx; }
.v2-mode .usage-row-v2 { display: flex; justify-content: space-between; align-items: center; gap: 14rpx; padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .usage-main-v2 { flex: 1; min-width: 0; }
.v2-mode .usage-feature-v2 { display: block; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .usage-meta-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 2rpx; }
.v2-mode .usage-counts-v2 { text-align: right; flex-shrink: 0; }
.v2-mode .usage-total-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .positive { color: #27ae60 !important; }
.v2-mode .negative { color: #e74c3c !important; }
</style>
