<template>
  <view class="page v2-mode" :style="themeVars">
    <view v-if="loadingSummary" class="hero-skeleton" />
    <view v-else class="hero-block-v2">
      <view class="hero-tag-v2">
        <image class="tag-icon" src="/static/icons/taohua/sparkles.svg" mode="aspectFit" />
        <text>邀请奖励</text>
      </view>
      <text class="hero-amount">{{ money(summary.availableFen) }}</text>
      <text class="hero-label">可用奖励</text>
      <text class="hero-copy">好友完成有效付费后，你可获得分成。</text>
      <view class="pending-row">
        <image class="inline-icon" src="/static/icons/taohua/hourglass.svg" mode="aspectFit" />
        <text>待结算 {{ money(summary.pendingFen) }} · {{ rule.settlementDays }} 天后到账</text>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <button v-if="shareReady" class="btn-v2 btn-primary share-button" open-type="share">
        <image class="button-icon" src="/static/icons/taohua/share-2.svg" mode="aspectFit" />
        <text>立即邀请</text>
      </button>
      <button v-else class="btn-v2 share-button share-disabled" disabled>
        <text>{{ sharePreparing ? '邀请码准备中' : '暂时无法分享' }}</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button class="btn-v2 btn-primary share-button" @click="copyInviteLink">
        <image class="button-icon" src="/static/icons/taohua/share-2.svg" mode="aspectFit" />
        <text>立即邀请</text>
      </button>
      <!-- #endif -->
    </view>

    <view v-if="summaryError" class="hint-v2 risk-hint">
      <text>{{ summaryError }}</text>
      <text class="retry-link" @click="loadSummary">重试</text>
    </view>

    <view class="stats-grid">
      <view class="stat-card"><text class="stat-value">{{ summary.inviteCount }}</text><text class="stat-label">累计邀请</text></view>
      <view class="stat-card accent"><text class="stat-value">{{ summary.paidInviteCount }}</text><text class="stat-label">已付费好友</text></view>
      <view class="stat-card mint"><text class="stat-value">{{ money(summary.netEarnedFen) }}</text><text class="stat-label">累计净奖励</text></view>
    </view>

    <view class="hint-v2 rule-hint">
      <image class="inline-icon" src="/static/icons/taohua/check-circle.svg" mode="aspectFit" />
      <view class="hint-content">
        <text class="hint-title">当前分成比例 {{ rule.rateText }}</text>
        <text class="hint-copy">{{ ruleCopy }}</text>
      </view>
    </view>

    <view class="section-head">
      <text class="section-title-v2">邀请与奖励</text>
      <text class="section-sub">只展示与你绑定的记录</text>
    </view>
    <view class="tabs" role="tablist">
      <view :class="['tab', activeTab === 'invitees' ? 'active' : '']" @click="activeTab = 'invitees'"><text>邀请好友</text></view>
      <view :class="['tab', activeTab === 'ledger' ? 'active' : '']" @click="activeTab = 'ledger'"><text>奖励明细</text></view>
    </view>

    <view v-if="activeTab === 'invitees'">
      <view v-if="inviteesError" class="list-error"><text>{{ inviteesError }}</text><text class="retry-link" @click="loadInvitees(true)">重试</text></view>
      <view v-else-if="loadingInvitees && invitees.length === 0" class="list-skeleton"><view v-for="i in 3" :key="i" class="skeleton-row" /></view>
      <view v-else-if="invitees.length === 0" class="empty-state"><text class="empty-title">还没有邀请记录</text><text class="empty-copy">分享测试题或结果给好友，第一条记录会出现在这里。</text></view>
      <view v-else class="record-list">
        <view v-for="item in invitees" :key="item.id" class="record-row">
          <view class="avatar"><text>{{ item.nickname.slice(0, 1) }}</text></view>
          <view class="record-main">
            <view class="record-title-row"><text class="record-title">{{ item.nickname }}</text><text :class="['status-tag', item.paid ? 'mint' : 'accent']">{{ item.paid ? '已付费' : statusText(item.status) }}</text></view>
            <text class="record-meta">{{ dateText(item.joinedAt) }}</text>
          </view>
          <view class="record-value"><text>{{ item.paid ? `+${money(item.totalCommissionFen)}` : '--' }}</text><text class="record-value-sub">{{ item.paid ? '累计贡献' : '等待付费' }}</text></view>
        </view>
      </view>
    </view>

    <view v-else>
      <scroll-view class="filters" scroll-x :show-scrollbar="false">
        <view class="filter-row">
          <view v-for="item in filters" :key="item.value" :class="['filter', ledgerStatus === item.value ? 'active' : '']" @click="selectFilter(item.value)"><text>{{ item.label }}</text></view>
        </view>
      </scroll-view>
      <view v-if="ledgerError" class="list-error"><text>{{ ledgerError }}</text><text class="retry-link" @click="loadLedger(true)">重试</text></view>
      <view v-else-if="loadingLedger && ledger.length === 0" class="list-skeleton"><view v-for="i in 3" :key="i" class="skeleton-row" /></view>
      <view v-else-if="ledger.length === 0" class="empty-state"><text class="empty-title">暂无奖励明细</text><text class="empty-copy">好友完成有效付费后，奖励会显示在这里。</text></view>
      <view v-else class="record-list">
        <view v-for="item in ledger" :key="item.id" class="ledger-row">
          <view class="product-icon"><image src="/static/icons/taohua/gem.svg" mode="aspectFit" /></view>
          <view class="record-main"><view class="record-title-row"><text class="record-title">{{ item.productLabel }}</text><text :class="['status-tag', statusClass(item.status)]">{{ item.statusText }}</text></view><text class="record-meta">订单 {{ money(item.paidAmountFen) }} · {{ dateText(item.createdAt) }}</text></view>
          <text :class="['record-value', item.commissionFen < 0 ? 'risk' : '']">{{ signedMoney(item.commissionFen) }}</text>
        </view>
      </view>
    </view>

    <view v-if="activeLoading" class="loading-more"><text>正在加载</text></view>
    <view v-else-if="activeEnd && activeItems.length > 0" class="loading-more"><text>已经到底了</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getMyReferralCommissionSummary, listMyReferralCommissionLedger, listMyReferralInvitees, prepareCurrentUserReferralShare } from '@/utils/api'
import { appendReferralParams, buildSafeTimelineShare, isReferralShareBlocked, SAFE_SHARE_IMAGE } from '@/utils/share'
import { getThemeStyle } from '@/utils/theme'

type Summary = { inviteCount: number; paidInviteCount: number; totalEarnedFen: number; netEarnedFen: number; pendingFen: number; availableFen: number; withdrawnFen: number; reversedFen: number }
type Invitee = { id: string; nickname: string; joinedAt: string | null; status: string; paid: boolean; totalCommissionFen: number }
type LedgerItem = { id: string; productLabel: string; paidAmountFen: number; commissionFen: number; status: string; statusText: string; availableAt: string | null; createdAt: string | null }
type Rule = { enabled: boolean; rateBps: number; rateText: string; settlementDays: number; mode: string; includeSubscription: boolean; includeRecharge: boolean; includeProp: boolean; refundNote: string }

const themeVars = ref(getThemeStyle())
const summary = ref<Summary>({ inviteCount: 0, paidInviteCount: 0, totalEarnedFen: 0, netEarnedFen: 0, pendingFen: 0, availableFen: 0, withdrawnFen: 0, reversedFen: 0 })
const rule = ref<Rule>({ enabled: false, rateBps: 0, rateText: '0%', settlementDays: 7, mode: 'all_orders', includeSubscription: true, includeRecharge: true, includeProp: true, refundNote: '' })
const invitees = ref<Invitee[]>([])
const ledger = ref<LedgerItem[]>([])
const activeTab = ref<'invitees' | 'ledger'>('invitees')
const ledgerStatus = ref('')
const inviteesCursor = ref<string | null>(null)
const ledgerCursor = ref<string | null>(null)
const inviteesEnd = ref(false)
const ledgerEnd = ref(false)
const loadingSummary = ref(true)
const loadingInvitees = ref(false)
const loadingLedger = ref(false)
const summaryError = ref('')
const inviteesError = ref('')
const ledgerError = ref('')
const shareReady = ref(false)
const sharePreparing = ref(false)
const initialized = ref(false)
const filters = [{ value: '', label: '全部' }, { value: 'pending', label: '待结算' }, { value: 'available', label: '已到账' }, { value: 'reversed', label: '已撤销' }]

const activeLoading = computed(() => activeTab.value === 'invitees' ? loadingInvitees.value : loadingLedger.value)
const activeEnd = computed(() => activeTab.value === 'invitees' ? inviteesEnd.value : ledgerEnd.value)
const activeItems = computed(() => activeTab.value === 'invitees' ? invitees.value : ledger.value)

// P2-3：按服务端返回的实际参与产品动态生成规则文案，不固定承诺「套餐、加油包、道具均参与」
const ruleCopy = computed(() => {
  const products = []
  if (rule.value.includeSubscription !== false) products.push('套餐')
  if (rule.value.includeRecharge !== false) products.push('加油包')
  if (rule.value.includeProp !== false) products.push('道具')
  const productText = products.length ? `参与产品：${products.join('、')}；` : '当前没有参与分佣的产品；'
  return `${productText}${rule.value.refundNote || ''}`
})

function money(fen: number) { return `¥${(Number(fen || 0) / 100).toFixed(2)}` }
function signedMoney(fen: number) { return `${fen >= 0 ? '+' : '-'}${money(Math.abs(fen))}` }
function dateText(value: string | null) { if (!value) return '时间待更新'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '时间待更新' : `${date.getMonth() + 1} 月 ${date.getDate()} 日` }
function statusText(status: string) { return status === 'waiting_first_event' ? '待体验' : status === 'needs_review' ? '待确认' : '已邀请' }
function statusClass(status: string) { return status === 'available' ? 'mint' : status === 'reversed' || status === 'blocked' ? 'risk' : 'accent' }

async function loadSummary() {
  loadingSummary.value = true; summaryError.value = ''
  try { const result = await getMyReferralCommissionSummary(); if (!result?.success) throw new Error(result?.message || '读取失败'); summary.value = result.summary; rule.value = result.rule }
  catch (error: any) { summaryError.value = error?.message || '奖励概览加载失败' }
  finally { loadingSummary.value = false }
}
async function loadInvitees(reset = false) {
  if (loadingInvitees.value || (!reset && inviteesEnd.value)) return
  if (reset) { invitees.value = []; inviteesCursor.value = null; inviteesEnd.value = false }
  loadingInvitees.value = true; inviteesError.value = ''
  try { const result = await listMyReferralInvitees({ cursor: inviteesCursor.value || undefined, limit: 20 }); if (!result?.success) throw new Error(result?.message || '读取失败'); invitees.value.push(...(result.items || [])); inviteesCursor.value = result.nextCursor || null; inviteesEnd.value = !result.nextCursor }
  catch (error: any) { inviteesError.value = error?.message || '好友记录加载失败' }
  finally { loadingInvitees.value = false }
}
async function loadLedger(reset = false) {
  if (loadingLedger.value || (!reset && ledgerEnd.value)) return
  if (reset) { ledger.value = []; ledgerCursor.value = null; ledgerEnd.value = false }
  loadingLedger.value = true; ledgerError.value = ''
  try { const result = await listMyReferralCommissionLedger({ cursor: ledgerCursor.value || undefined, limit: 20, status: ledgerStatus.value || undefined }); if (!result?.success) throw new Error(result?.message || '读取失败'); ledger.value.push(...(result.items || [])); ledgerCursor.value = result.nextCursor || null; ledgerEnd.value = !result.nextCursor }
  catch (error: any) { ledgerError.value = error?.message || '奖励明细加载失败' }
  finally { loadingLedger.value = false }
}
async function prepareShare() { sharePreparing.value = true; try { shareReady.value = await prepareCurrentUserReferralShare() } finally { sharePreparing.value = false } }
async function refreshAll() { await Promise.allSettled([loadSummary(), loadInvitees(true), loadLedger(true), prepareShare()]) }
function selectFilter(value: string) { if (ledgerStatus.value === value) return; ledgerStatus.value = value; void loadLedger(true) }
function copyInviteLink() { const path = appendReferralParams('/pages/index/index', 'invite', 'referral_page'); if (!path) return uni.showToast({ title: '邀请码尚未准备好', icon: 'none' }); uni.setClipboardData({ data: path }) }

onShow(() => { themeVars.value = getThemeStyle(); if (!initialized.value) { initialized.value = true; void refreshAll() } })
onPullDownRefresh(async () => { await refreshAll(); uni.stopPullDownRefresh() })
onReachBottom(() => { if (activeTab.value === 'invitees') void loadInvitees(); else void loadLedger() })
onShareAppMessage(() => isReferralShareBlocked() ? {} : ({ title: '来测测你的关系信号，完成后还能一起解锁更多内容', path: appendReferralParams('/pages/index/index', 'invite', 'referral_page'), imageUrl: SAFE_SHARE_IMAGE }))
onShareTimeline(() => { if (isReferralShareBlocked()) return {}; const path = appendReferralParams('/pages/index/index', 'invite', 'referral_timeline'); return buildSafeTimelineShare({ query: path.includes('?') ? path.split('?')[1] : '' }) })
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page { min-height: 100vh; padding: 24rpx 24rpx 80rpx; background: var(--app-bg, #FFFDF5); color: var(--text-main, #111); box-sizing: border-box; }
.hero-block-v2 { @include hero-block-v2; }
.hero-tag-v2 { @include tag-v2; @include tag-v2-black; gap: 8rpx; }
.tag-icon, .inline-icon, .button-icon { width: 32rpx; height: 32rpx; flex-shrink: 0; }
.hero-amount { display: block; margin-top: 22rpx; font-size: $fs-display; font-weight: $fw-hero; line-height: 1; letter-spacing: 0; }
.hero-label { display: block; margin-top: 10rpx; font-size: $fs-body; font-weight: $fw-heading; }
.hero-copy { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-label; line-height: 1.5; }
.pending-row { display: flex; align-items: center; gap: 8rpx; margin-top: 20rpx; font-size: $fs-caption; font-weight: $fw-label; }
.share-button { width: 100%; height: 80rpx; margin-top: 26rpx; display: flex; align-items: center; justify-content: center; gap: 12rpx; font-size: $fs-heading; }
.btn-v2 { @include btn-v2; }
.btn-primary { @include btn-v2-primary; }
.share-disabled { background: var(--surface-dim, #eee); color: var(--text-muted, #666); box-shadow: none; }
.hero-skeleton { height: 430rpx; margin-bottom: 28rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface-dim, #eee); box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111); }
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-bottom: 24rpx; }
.stat-card { min-width: 0; padding: 22rpx 16rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111); }
.stat-card.accent { background: var(--accent-soft, #FFFBEB); }
.stat-card.mint { background: var(--success-soft, #E0FFF0); }
.stat-value { display: block; overflow: hidden; font-size: $fs-kpi; font-weight: $fw-hero; line-height: 1; white-space: nowrap; text-overflow: ellipsis; letter-spacing: 0; }
.stat-label { display: block; margin-top: 10rpx; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); }
.hint-v2 { display: flex; align-items: flex-start; gap: 14rpx; padding: 22rpx; margin-bottom: 28rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-left-width: 10rpx; }
.rule-hint { border-left-color: var(--accent, #FFD93D); background: var(--accent-soft, #FFFBEB); }
.risk-hint { justify-content: space-between; border-left-color: var(--risk, #FF5252); background: var(--risk-soft, #FFEEEC); font-size: $fs-body; }
.hint-content { flex: 1; min-width: 0; }
.hint-title { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; }
.hint-copy { display: block; margin-top: 4rpx; font-size: $fs-caption; color: var(--text-muted, #666); }
.retry-link { flex-shrink: 0; font-size: $fs-caption; font-weight: $fw-heading; text-decoration: underline; }
.section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.section-title-v2 { @include section-title-v2; }
.section-sub { font-size: $fs-caption; color: var(--text-muted, #666); }
.tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-bottom: 18rpx; }
.tab { min-height: 64rpx; display: flex; align-items: center; justify-content: center; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body; font-weight: $fw-heading; }
.tab.active { background: var(--text-main, #111); color: var(--accent, #FFD93D); }
.record-list { display: flex; flex-direction: column; gap: 14rpx; }
.record-row, .ledger-row { min-height: 104rpx; display: grid; grid-template-columns: 80rpx minmax(0, 1fr) auto; align-items: center; gap: 16rpx; padding: 18rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); box-sizing: border-box; }
.avatar, .product-icon { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--accent, #FFD93D); font-size: $fs-body-lg; font-weight: $fw-hero; }
.product-icon image { width: 38rpx; height: 38rpx; }
.record-main { min-width: 0; }
.record-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.record-title { font-size: $fs-body; font-weight: $fw-heading; }
.record-meta { display: block; margin-top: 6rpx; font-size: $fs-caption; color: var(--text-muted, #666); }
.status-tag { padding: 2rpx 10rpx; border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-micro; font-weight: $fw-heading; white-space: nowrap; }
.status-tag.mint { background: var(--accent-cool, #4ECDC4); }
.status-tag.accent { background: var(--accent, #FFD93D); }
.status-tag.risk { background: var(--risk-soft, #FFEEEC); color: var(--risk, #FF5252); }
.record-value { display: flex; flex-direction: column; align-items: flex-end; font-size: $fs-body; font-weight: $fw-hero; white-space: nowrap; letter-spacing: 0; }
.record-value.risk { color: var(--risk, #FF5252); }
.record-value-sub { font-size: $fs-micro; font-weight: $fw-body; color: var(--text-muted, #666); }
.filters { width: 100%; margin-bottom: 16rpx; white-space: nowrap; }
.filter-row { display: inline-flex; gap: 10rpx; }
.filter { min-height: 48rpx; display: flex; align-items: center; padding: 0 18rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-caption; font-weight: $fw-heading; }
.filter.active { background: var(--accent, #FFD93D); }
.list-error, .empty-state { padding: 34rpx 24rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); text-align: center; }
.list-error { display: flex; align-items: center; justify-content: center; gap: 16rpx; font-size: $fs-body; }
.empty-title { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; }
.empty-copy { display: block; margin-top: 8rpx; font-size: $fs-caption; color: var(--text-muted, #666); }
.skeleton-row { height: 108rpx; margin-bottom: 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface-dim, #eee); }
.loading-more { padding: 24rpx 0; text-align: center; font-size: $fs-caption; color: var(--text-muted, #666); }

@media (min-width: 768px) { .page { max-width: 860px; margin: 0 auto; } }
</style>
