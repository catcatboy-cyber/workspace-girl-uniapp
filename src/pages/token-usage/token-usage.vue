<template>
  <view class="page v2-mode">
        <view class="hero-block-v2"><text class="hero-tag-v2">TOKEN USAGE</text><text class="hero-title-v2">消费<text class="hl-v2">明细</text></text><text class="hero-copy-v2">当前账号的 token 调用和额度变动记录。</text></view>
        <view class="tabs-v2"><view :class="['tab-btn-v2', activeTab === 'usage' ? 'active' : '']" @click="switchTab('usage')">消费明细</view><view :class="['tab-btn-v2', activeTab === 'ledger' ? 'active' : '']" @click="switchTab('ledger')">充值记录</view></view>
        <view v-if="activeTab === 'usage'">
          <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">汇总</text><button class="btn-v2-t sm" :disabled="loading" @click="loadUsage">{{ loading ? '读取中' : '刷新' }}</button></view><text class="card-text-v2">最近 {{ records.length }} 条记录</text><view class="stats-grid-v2"><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.totalTokens }}</text><text class="stat-lbl-v2">总 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.callCount }}</text><text class="stat-lbl-v2">调用次数</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.promptTokens }}</text><text class="stat-lbl-v2">输入 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.completionTokens }}</text><text class="stat-lbl-v2">输出 token</text></view></view><text v-if="summary.unavailableCount" class="card-text-v2 muted">有 {{ summary.unavailableCount }} 次未返回 usage。</text></view>
          <view class="card-v2"><text class="section-title-v2">明细</text><view v-if="records.length > 0" class="usage-list-v2"><view v-for="item in records" :key="item.id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapFeature(item.feature) }}</text><text class="usage-meta-v2">{{ item.model || '未知模型' }} · {{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text class="usage-total-v2">{{ item.totalTokens }}</text><text class="usage-meta-v2">in {{ item.promptTokens }} / out {{ item.completionTokens }}</text></view></view></view><text v-else class="card-text-v2">{{ loading ? '正在读取...' : '暂无记录。' }}</text></view>
        </view>
        <view v-if="activeTab === 'ledger'">
          <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">额度变动记录</text><button class="btn-v2-t sm" :disabled="ledgerLoading" @click="loadLedger">{{ ledgerLoading ? '读取中' : '刷新' }}</button></view>
            <view v-if="ledgerRecords.length > 0" class="usage-list-v2"><view v-for="item in ledgerRecords" :key="item._id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapLedgerType(item.type) }}{{ item.remark ? ' · ' + item.remark : '' }}</text><text class="usage-meta-v2">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text :class="['usage-total-v2', item.amountTokens > 0 ? 'positive' : 'negative']">{{ item.amountTokens > 0 ? '+' : '' }}{{ item.amountTokens }}</text><text class="usage-meta-v2">余额 {{ item.balanceAfter }}</text></view></view></view>
            <text v-else class="card-text-v2">{{ ledgerLoading ? '正在读取...' : '暂无记录。' }}</text>
          </view>
        </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getTokenUsage, getTokenLedger } from '@/utils/api'

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
    attachmentAnalysis: '附件识别',
    petReply: '宠物帮说'
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
.v2-mode .tabs-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-bottom: 18rpx; }
.v2-mode .tab-btn-v2 { text-align: center; padding: 16rpx; border: 3rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .tab-btn-v2.active { background: #111; color: #FFD93D; }
.v2-mode .positive { color: #27ae60 !important; }
.v2-mode .negative { color: #e74c3c !important; }
</style>
