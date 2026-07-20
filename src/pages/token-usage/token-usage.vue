<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
        <view class="hero-block-v2"><text class="hero-tag-v2">CRUSH CREDITS</text><text class="hero-title-v2">消费<text class="hl-v2">明细</text></text><text class="hero-copy-v2">当前账号的 Crush Credits 调用和额度变动记录。</text></view>
        <view class="tabs-v2"><view :class="['tab-btn-v2', activeTab === 'usage' ? 'active' : '']" @click="switchTab('usage')">消费明细</view><view :class="['tab-btn-v2', activeTab === 'ledger' ? 'active' : '']" @click="switchTab('ledger')">充值记录</view><view :class="['tab-btn-v2', activeTab === 'voice' ? 'active' : '']" @click="switchTab('voice')">语音识别</view></view>
        <view v-if="activeTab === 'usage'">
          <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">汇总</text><button class="btn btn-secondary btn-sm btn-auto" :disabled="loading" @click="loadUsage">{{ loading ? '读取中' : '刷新' }}</button></view><text class="card-text-v2">最近 {{ records.length }} 条记录</text><view class="stats-grid-v2" style="grid-template-columns: repeat(3, 1fr);"><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.monthlyTokensUsed.toLocaleString() }}</text><text class="stat-lbl-v2">本月已用</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.recentRecordsTokens.toLocaleString() }}</text><text class="stat-lbl-v2">最近合计</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ summary.callCount }}</text><text class="stat-lbl-v2">调用次数</text></view></view></view>
          <view class="card-v2"><text class="section-title-v2">明细</text><view v-if="records.length > 0" class="usage-list-v2"><view v-for="item in records" :key="item._id || item.recordId || item.id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapFeature(item.feature || (item.remark || '').split(' · ')[0]) }}</text><text class="usage-meta-v2">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text class="usage-total-v2">-{{ (Math.abs(Number(item.amountTokens || 0)) || Number(item.platformTokens || item.totalTokens) || 0).toLocaleString() }}</text><text class="usage-meta-v2">Crush</text></view></view></view><text v-else class="card-text-v2">{{ loading ? '正在读取...' : '暂无记录。' }}</text></view>
        </view>
        <view v-if="activeTab === 'ledger'">
          <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">额度变动记录</text><button class="btn btn-secondary btn-sm btn-auto" :disabled="ledgerLoading" @click="loadLedger">{{ ledgerLoading ? '读取中' : '刷新' }}</button></view>
            <view v-if="ledgerRecords.length > 0" class="usage-list-v2"><view v-for="item in ledgerRecords" :key="item._id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">{{ mapLedgerType(item) }}</text><text class="usage-meta-v2">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text :class="['usage-total-v2', item.amountTokens > 0 ? 'positive' : 'negative']">{{ item.amountTokens > 0 ? '+' : '' }}{{ item.amountTokens }}</text><text class="usage-meta-v2">余额 {{ item.balanceAfter }}</text></view></view></view>
            <text v-else class="card-text-v2">{{ ledgerLoading ? '正在读取...' : '暂无记录。' }}</text>
          </view>
        </view>
        <view v-if="activeTab === 'voice'">
          <view class="card-v2"><view class="card-head-v2"><text class="section-title-v2">语音识别汇总</text><button class="btn btn-secondary btn-sm btn-auto" :disabled="voiceLoading" @click="loadVoice">{{ voiceLoading ? '读取中' : '刷新' }}</button></view>
            <view class="stats-grid-v2" style="grid-template-columns: repeat(2, 1fr);"><view class="stat-box-v2"><text class="stat-num-v2">{{ voiceSummary.totalCount }}</text><text class="stat-lbl-v2">识别次数</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ formatSeconds(voiceSummary.totalDurationMs) }}</text><text class="stat-lbl-v2">累计时长</text></view></view>
          </view>
          <view class="card-v2"><text class="section-title-v2">明细</text>
            <view v-if="voiceRecords.length > 0" class="usage-list-v2"><view v-for="item in voiceRecords" :key="item.id" class="usage-row-v2"><view class="usage-main-v2"><text class="usage-feature-v2">语音识别</text><text class="usage-meta-v2">{{ formatDate(item.createdAt) }}</text></view><view class="usage-counts-v2"><text class="usage-total-v2">{{ formatSeconds(item.durationMs) }}</text><text class="usage-meta-v2">时长</text></view></view></view>
            <text v-else class="card-text-v2">{{ voiceLoading ? '正在读取...' : '暂无记录。' }}</text>
          </view>
        </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getConsumeHistory, getTokenLedger, getVoiceUsage } from '@/utils/api'
import { callFunction } from '@/utils/cloudbase'
import { aiLabel } from '@/utils/labels'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const activeTab = ref<'usage' | 'ledger' | 'voice'>('usage')
const themeVars = ref(getThemeStyle())
const loading = ref(false)
const summary = ref({ monthlyTokensUsed: 0, recentRecordsTokens: 0, callCount: 0 })
const records = ref<Array<any>>([])
const ledgerRecords = ref<Array<any>>([])
const ledgerLoading = ref(false)
const voiceRecords = ref<Array<any>>([])
const voiceLoading = ref(false)
const voiceSummary = ref({ totalCount: 0, totalDurationMs: 0 })

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loadUsage()
})

function switchTab(tab: 'usage' | 'ledger' | 'voice') {
  activeTab.value = tab
  if (tab === 'usage' && records.value.length === 0) loadUsage()
  if (tab === 'ledger' && ledgerRecords.value.length === 0) loadLedger()
  if (tab === 'voice' && voiceRecords.value.length === 0) loadVoice()
}

async function loadUsage() {
  if (loading.value) return
  loading.value = true
  try {
    // 优先新系统账户口径；records 只作为最近明细展示。
    const result = await getConsumeHistory(100)
    if (result?.success && Array.isArray(result.records)) {
      const recs = result.records
      const recentRecordsTokens = Number(result.summary?.recentRecordsTokens)
      const monthlyTokensUsed = Number(result.summary?.monthlyTokensUsed)
      records.value = recs
      summary.value = {
        monthlyTokensUsed: Number.isFinite(monthlyTokensUsed) ? monthlyTokensUsed : 0,
        recentRecordsTokens: Number.isFinite(recentRecordsTokens)
          ? recentRecordsTokens
          : recs.reduce((sum: number, r: any) => sum + (Number(r.platformTokens) || 0), 0),
        callCount: recs.length
      }
      if (recs.length > 0) {
        loading.value = false
        return
      }
      // 新系统没有明细时再回退旧记录，但不覆盖账户本月已用口径。
    }
    const currentMonthlyUsed = summary.value.monthlyTokensUsed
    // 回退到旧系统 token_ledger_records（amountTokens 是真实平台 Token，已乘倍率）
    const old = await callFunction({ name: 'getCallUsageHistory', data: { source: 'ledger', limit: 100 } })
    if (!old?.result?.success) {
      if (!result?.success) uni.showToast({ title: '读取失败', icon: 'none' })
      loading.value = false
      return
    }
    const recs = Array.isArray(old.result.records) ? old.result.records : []
    const oldRecentRecordsTokens = recs.reduce((sum: number, r: any) => sum + Math.abs(Number(r.amountTokens || 0)), 0)
    records.value = recs
    summary.value = {
      monthlyTokensUsed: currentMonthlyUsed || oldRecentRecordsTokens,
      recentRecordsTokens: oldRecentRecordsTokens,
      callCount: recs.length
    }
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
    ledgerRecords.value = Array.isArray(result.records)
      ? result.records
        .filter((item: any) => item.type !== 'consume')
        .map((item: any) => ({
          ...item,
          amountTokens: getLedgerAmount(item),
          balanceAfter: item.balanceAfter ?? ''
        }))
      : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '读取失败', icon: 'none' })
  } finally {
    ledgerLoading.value = false
  }
}

async function loadVoice() {
  if (voiceLoading.value) return
  voiceLoading.value = true
  try {
    const result = await getVoiceUsage(200)
    if (!result?.success) {
      uni.showToast({ title: result?.message || '读取失败', icon: 'none' })
      return
    }
    voiceSummary.value = {
      totalCount: Number(result.totalCount || 0),
      totalDurationMs: Number(result.totalDurationMs || 0)
    }
    voiceRecords.value = Array.isArray(result.records) ? result.records : []
  } catch (error: any) {
    uni.showToast({ title: error?.message || '读取失败', icon: 'none' })
  } finally {
    voiceLoading.value = false
  }
}

function formatSeconds(ms: number) {
  const seconds = Math.round(Number(ms || 0) / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

function mapFeature(feature: string) {
  const map: Record<string, string> = {
    eventAssessment: '即时反馈',
    initial_assessment_text: '初次评估·文本分析',
    weeklyReview: '月度复盘',
    attachmentAnalysis: '附件识别',
    petReply: '宠物帮说',
    petReplyStrategy: '宠物帮说·策略'
  }
  return map[feature] || feature || '未知调用'
}

function mapLedgerType(item: any) {
  const type = String(item?.type || '')
  const source = String(item?.source || '')

  // grant 类型要按 source 区分来源（normalizeLedgerSource 已将 recharge_xxx → source: 'recharge'）
  if (type === 'grant' && (source === 'recharge' || source.startsWith('recharge_'))) return '充值获赠'
  if (type === 'grant' && (source === 'sub' || source.startsWith('sub_'))) return '开通月卡'
  if (type === 'grant' && (source === 'referral' || source.startsWith('referral_'))) return '邀请获赠'
  if (type === 'grant') return '赠送'

  const map: Record<string, string> = {
    gift: '赠送（旧）',
    recharge: '充值',
    consume: '消费',
    refund: '退款',
    adjust: '调整'
  }
  return map[type] || type || '未知'
}

function getLedgerAmount(item: any) {
  return Number(item?.amount ?? item?.amountTokens ?? item?.platformTokens ?? 0)
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

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: 24rpx; box-sizing: border-box; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }
.v2-mode .tabs { border-color: var(--border, #111); }
.v2-mode .tab-btn.active { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; }
.v2-mode .card-text-v2.muted { color: var(--text-soft, #999); font-size: $fs-caption; }


.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx 8rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface-dim, #f9f9f9); text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); margin-top: 4rpx; }

.v2-mode .usage-list-v2 { display: flex; flex-direction: column; gap: 10rpx; margin-top: 12rpx; }
.v2-mode .usage-row-v2 { display: flex; justify-content: space-between; align-items: center; gap: 14rpx; padding: 16rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface-dim, #f9f9f9); }
.v2-mode .usage-main-v2 { flex: 1; min-width: 0; }
.v2-mode .usage-feature-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .usage-model-v2 { display: inline-block; margin-top: 4rpx; padding: 2rpx 10rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); }
.v2-mode .usage-io-v2 { display: flex; gap: 6rpx; margin-bottom: 4rpx; }
.v2-mode .usage-io-item-v2 { font-size: $fs-micro; font-weight: $fw-body; color: var(--text-soft, #999); white-space: nowrap; }
.v2-mode .usage-meta-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); margin-top: 2rpx; }
.v2-mode .usage-counts-v2 { text-align: right; flex-shrink: 0; }
.v2-mode .usage-total-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .tabs-v2 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8rpx; margin-bottom: 18rpx; }
.v2-mode .tab-btn-v2 { text-align: center; padding: 16rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .tab-btn-v2.active { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.v2-mode .positive { color: var(--success, #27ae60) !important; }
.v2-mode .negative { color: var(--risk, #e74c3c) !important; }
</style>
