<template>
  <view class="panel">
    <view class="commission-tabs">
      <button :class="['commission-tab', panelTab === 'claims' ? 'active' : '']" @click="panelTab = 'claims'">邀请关系</button>
      <button :class="['commission-tab', panelTab === 'commission' ? 'active' : '']" @click="panelTab = 'commission'">充值分佣</button>
    </view>
    <template v-if="panelTab === 'claims'">
    <view class="panel-head">
      <view>
        <text class="panel-title">邀请奖励</text>
        <text class="panel-meta">
          共 {{ total }} 条 · 已发放发出 {{ totalInviter.toLocaleString() }} / 收到 {{ totalInvitee.toLocaleString() }} Crush
        </text>
        <text class="panel-meta">
          pending {{ statusCounts.pending_relation }} · waiting {{ statusCounts.waiting_first_event }} · retry {{ statusCounts.retry }} ·
          rewarded {{ statusCounts.rewarded }} · rejected {{ statusCounts.rejected }} · failed {{ statusCounts.failed }} ·
          review {{ statusCounts.needs_review }} · manual {{ statusCounts.manual_resolved }}
        </text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="loading" @click="reload">{{ loading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="loading && rows.length === 0" class="empty">加载中...</view>
    <view v-else-if="rows.length === 0" class="empty">暂无邀请奖励记录。</view>
    <view v-else class="table">
      <view class="table-row table-header">
        <text style="flex:1;">被邀请人</text>
        <text style="flex:1;">邀请人</text>
        <text style="width:80rpx;">邀请码</text>
        <text style="width:130rpx;">邀请时间</text>
        <text style="width:100rpx;">状态</text>
        <text style="width:150rpx;">发放状态</text>
        <text style="width:60rpx;">次数</text>
        <text style="width:110rpx;">错误码</text>
        <text style="width:160rpx;">操作</text>
      </view>
      <view v-for="row in rows" :key="row.id" class="table-row">
        <text class="cell">{{ row.inviteeLabel }}</text>
        <text class="cell">{{ row.inviterLabel }}</text>
        <text style="width:80rpx;font-size:22rpx;">{{ row.inviteCode || '-' }}</text>
        <text style="width:130rpx;font-size:22rpx;">{{ formatTime(row.createdAt) }}</text>
        <text style="width:100rpx;" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</text>
        <view style="width:150rpx;font-size:22rpx;display:flex;flex-direction:column;gap:4rpx;">
          <text :class="grantClass(row, 'inviter')">邀 {{ grantLabel(row, 'inviter') }}</text>
          <text :class="grantClass(row, 'invitee')">被邀 {{ grantLabel(row, 'invitee') }}</text>
        </view>
        <text style="width:60rpx;">{{ row.attempts || 0 }}</text>
        <text style="width:110rpx;font-size:22rpx;color:#999;">{{ row.lastErrorCode || row.statusReason || '-' }}</text>
        <view style="width:160rpx;display:flex;flex-direction:column;gap:6rpx;">
          <button
            v-if="row.status === 'retry' || row.status === 'failed'"
            class="ghost-btn"
            :disabled="actingId === row.id"
            @click="onRetry(row)"
          >重新排队</button>
          <button
            class="ghost-btn"
            :disabled="actingId === row.id"
            @click="onRecheck(row)"
          >重新对账</button>
          <button
            v-if="row.status === 'failed' || row.status === 'needs_review'"
            class="ghost-btn"
            :disabled="actingId === row.id"
            @click="onCompensate(row)"
          >人工补偿</button>
        </view>
      </view>
    </view>
    <view v-if="hasMore" style="margin-top:16rpx;text-align:center;">
      <button class="ghost-btn" :disabled="loading" @click="loadMore">加载更多</button>
    </view>
    <view v-if="actionMsg" class="save-message">{{ actionMsg }}</view>
    </template>
    <template v-else>
      <view class="panel-head">
        <view><text class="panel-title">充值分佣</text><text class="panel-meta">邀请 {{ commissionOverview.inviteCount || 0 }} · 付费好友 {{ commissionOverview.paidInviteCount || 0 }} · 实付 {{ (commissionOverview.paidAmountFen || 0) / 100 }} 元</text><text class="panel-meta">累计 {{ commissionOverview.totalEarnedFen / 100 }} 元 · 待结算 {{ commissionOverview.pendingFen / 100 }} 元 · 可用 {{ commissionOverview.availableFen / 100 }} 元</text></view>
        <button class="ghost-btn wide-btn" :disabled="commissionLoading" @click="loadCommissionData">{{ commissionLoading ? '加载中' : '刷新' }}</button>
      </view>
      <view class="commission-config">
        <view class="config-row"><text>启用新佣金</text><switch :checked="commissionForm.enabled" @change="commissionForm.enabled = $event.detail.value" /></view>
        <view class="config-row"><text>暂停解冻/提现</text><switch :checked="commissionForm.payoutPaused" @change="commissionForm.payoutPaused = $event.detail.value" /></view>
        <view class="config-row"><text>分成比例</text><view class="rate-input"><input v-model.number="commissionForm.ratePercent" type="number" class="config-input" placeholder="10" /><text class="rate-suffix">%</text></view></view>
        <view class="config-row"><text>冻结天数</text><input v-model.number="commissionForm.settlementDays" type="number" class="config-input" /></view>
        <view class="config-row channels"><text>参与渠道</text><view class="channel-list"><label><checkbox :checked="commissionForm.includeSubscription" @click="commissionForm.includeSubscription = !commissionForm.includeSubscription" />套餐</label><label><checkbox :checked="commissionForm.includeRecharge" @click="commissionForm.includeRecharge = !commissionForm.includeRecharge" />加油包</label><label><checkbox :checked="commissionForm.includeProp" @click="commissionForm.includeProp = !commissionForm.includeProp" />道具</label></view></view>
        <button class="primary-btn" :disabled="commissionSaving" @click="saveCommissionConfig">{{ commissionSaving ? '保存中' : '保存分佣配置' }}</button>
      </view>
      <view v-if="commissionActionMsg" class="save-message">{{ commissionActionMsg }}</view>
      <view class="withdraw-box">
        <text class="withdraw-title">提现登记</text>
        <input v-model="withdrawForm.userId" class="config-input wide-input" placeholder="邀请人 userId" />
        <input v-model.number="withdrawForm.amountFen" class="config-input wide-input" type="number" placeholder="金额（分）" />
        <input v-model="withdrawForm.proof" class="config-input wide-input" placeholder="打款凭证" />
        <input v-model="withdrawForm.businessId" class="config-input wide-input" placeholder="业务号（幂等）" />
        <button class="ghost-btn" :disabled="withdrawSaving" @click="submitWithdraw">{{ withdrawSaving ? '登记中' : '登记提现' }}</button>
      </view>
      <view v-if="commissionRows.length" class="commission-table">
        <view v-for="row in commissionRows" :key="row._id" class="commission-row"><view><text class="commission-order">{{ row.productType }} · {{ row.orderId }}</text><text class="panel-meta">邀请人 {{ row.inviterUserId }} · 被邀请人 {{ row.inviteeUserId }}</text><text class="panel-meta">任务 {{ row.jobStatus || '未创建' }}</text></view><view class="commission-actions"><text :class="statusClass(row.status)">{{ row.status }} · ¥{{ (Number(row.commissionFen || 0) / 100).toFixed(2) }}</text><button v-if="row.jobStatus === 'retry' || row.jobStatus === 'needs_review'" class="ghost-btn" @click="retryCommission(row)">重试</button><button v-if="row.status === 'pending' || row.status === 'available'" class="ghost-btn" @click="reverseCommission(row)">冲正</button></view></view>
      </view>
      <view v-else class="empty">暂无充值分佣记录</view>
      <view class="reversal-ledger">
        <view class="ledger-head"><text class="withdraw-title">冲正账本</text><text class="panel-meta">仅展示退款或人工冲正流水</text></view>
        <view v-if="reversalRows.length" class="commission-table">
          <view v-for="row in reversalRows" :key="row._id" class="commission-row"><view><text class="commission-order">订单 {{ row.orderId || '-' }}</text><text class="panel-meta">邀请人 {{ row.userId || '-' }} · 原佣金 {{ row.commissionId || '-' }}</text><text class="panel-meta">{{ row.reason || '退款冲正' }} · {{ formatTime(row.createdAt) }}</text></view><view class="commission-actions"><text :class="statusClass(row.status)">冲正 · -¥{{ (Math.abs(Number(row.amountFen || 0)) / 100).toFixed(2) }}</text><text class="panel-meta">{{ row.status }}</text></view></view>
        </view>
        <view v-else class="empty ledger-empty">暂无冲正流水</view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  adminListReferralClaims,
  adminRetryReferralClaim,
  adminRecheckReferralClaim,
  adminGrantReferralCompensation,
  getReferralCommissionConfig,
  updateReferralCommissionConfig,
  listReferralCommissions,
  listReferralCommissionReversals,
  getReferralCommissionOverview,
  retryReferralCommissionJob,
  reverseReferralCommission,
  markReferralCommissionWithdrawn
} from '@/utils/api'

const panelTab = ref<'claims' | 'commission'>('claims')
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const totalInviter = ref(0)
const totalInvitee = ref(0)
const hasMore = ref(false)
const offset = ref(0)
const actingId = ref('')
const actionMsg = ref('')
const statusCounts = ref<Record<string, number>>({
  pending_relation: 0,
  waiting_first_event: 0,
  retry: 0,
  rewarded: 0,
  rejected: 0,
  failed: 0,
  needs_review: 0,
  manual_resolved: 0
})
const commissionLoading = ref(false)
const commissionSaving = ref(false)
const commissionActionMsg = ref('')
const commissionRows = ref<any[]>([])
const reversalRows = ref<any[]>([])
const commissionOverview = ref({ totalEarnedFen: 0, pendingFen: 0, availableFen: 0, inviteCount: 0, paidInviteCount: 0, paidAmountFen: 0 })
const commissionForm = ref({ enabled: false, payoutPaused: false, ratePercent: 10, settlementDays: 7, includeSubscription: true, includeRecharge: true, includeProp: true })
const withdrawSaving = ref(false)
const withdrawForm = ref({ userId: '', amountFen: 0, proof: '', businessId: '' })

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_relation: '待绑定',
    waiting_first_event: '等首事件',
    retry: '重试中',
    rewarded: '已发放',
    rejected: '已拒绝',
    failed: '失败',
    needs_review: '待复核',
    manual_resolved: '人工已处理'
  }
  return map[status] || status || '-'
}

function statusClass(status: string) {
  if (status === 'rewarded' || status === 'manual_resolved') return 'tag-ok'
  if (status === 'failed' || status === 'needs_review' || status === 'rejected') return 'tag-blocked'
  return 'tag-muted'
}

function formatTime(value: any): string {
  if (!value) return '-'
  let d: Date
  if (value instanceof Date) d = value
  else if (typeof value === 'number') d = new Date(value)
  else {
    const t = Date.parse(String(value))
    if (Number.isNaN(t)) return String(value)
    d = new Date(t)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function sideTokens(row: any, side: 'inviter' | 'invitee') {
  return Number(side === 'inviter' ? row.inviterTokens : row.inviteeTokens || 0)
}

function grantLabel(row: any, side: 'inviter' | 'invitee') {
  if (sideTokens(row, side) <= 0) return '—'
  const exists = side === 'inviter' ? row.inviterGrantExists : row.inviteeGrantExists
  return exists ? '已发放' : '未发放'
}

function grantClass(row: any, side: 'inviter' | 'invitee') {
  if (sideTokens(row, side) <= 0) return 'tag-muted'
  const exists = side === 'inviter' ? row.inviterGrantExists : row.inviteeGrantExists
  return exists ? 'tag-ok' : 'tag-blocked'
}

async function fetchPage(nextOffset: number, append: boolean) {
  loading.value = true
  try {
    const result = await adminListReferralClaims({ limit: 100, offset: nextOffset })
    if (!result?.success) {
      actionMsg.value = result?.message || '加载失败'
      return
    }
    rows.value = append ? [...rows.value, ...(result.rows || [])] : (result.rows || [])
    total.value = result.total || 0
    totalInviter.value = result.totalInviterRewards || 0
    totalInvitee.value = result.totalInviteeRewards || 0
    hasMore.value = Boolean(result.hasMore)
    offset.value = nextOffset + (result.rows || []).length
    statusCounts.value = { ...statusCounts.value, ...(result.statusCounts || {}) }
  } catch {
    actionMsg.value = '加载失败'
  } finally {
    loading.value = false
  }
}

async function reload() {
  offset.value = 0
  await fetchPage(0, false)
}

async function loadMore() {
  await fetchPage(offset.value, true)
}

async function loadCommissionData() {
  commissionLoading.value = true
  commissionActionMsg.value = ''
  try {
    const [config, overview, rowsResult, reversalsResult] = await Promise.all([getReferralCommissionConfig(), getReferralCommissionOverview(), listReferralCommissions({ page: 1, pageSize: 50 }), listReferralCommissionReversals({ page: 1, pageSize: 50 })])
    if (config?.success) {
      const rateBps = Number(config.config?.rateBps)
      commissionForm.value = {
        ...commissionForm.value,
        ...config.config,
        ratePercent: Number.isFinite(rateBps) ? Number((rateBps / 100).toFixed(2)) : commissionForm.value.ratePercent
      }
    }
    if (overview?.success) commissionOverview.value = { ...commissionOverview.value, ...overview.overview }
    commissionRows.value = rowsResult?.success ? (rowsResult.items || []) : []
    reversalRows.value = reversalsResult?.success ? (reversalsResult.items || []) : []
  } catch (error: any) { commissionActionMsg.value = error?.message || '分佣数据加载失败' } finally { commissionLoading.value = false }
}

async function saveCommissionConfig() {
  commissionSaving.value = true
  try {
    const ratePercent = Number(commissionForm.value.ratePercent)
    const rateBps = Number.isFinite(ratePercent) ? Math.round(Math.max(0, Math.min(100, ratePercent)) * 100) : 0
    const { ratePercent: _ratePercent, ...config } = commissionForm.value
    const result = await updateReferralCommissionConfig({ ...config, rateBps })
    commissionActionMsg.value = result?.success ? '分佣配置已保存，新订单按新规则计算' : (result?.message || '保存失败')
    if (result?.success) await loadCommissionData()
  } finally { commissionSaving.value = false }
}

function promptValue(title: string, defaultValue = ''): Promise<string> {
  return new Promise((resolve) => {
    uni.showModal({ title, editable: true, placeholderText: defaultValue, content: defaultValue, success: (result: any) => resolve(result.confirm ? String(result.content || defaultValue).trim() : '') , fail: () => resolve('') })
  })
}

async function retryCommission(row: any) {
  const result = await retryReferralCommissionJob(row.jobId)
  commissionActionMsg.value = result?.success ? '佣金任务已重新排队' : (result?.message || '重试失败')
  if (result?.success) await loadCommissionData()
}

async function reverseCommission(row: any) {
  const amount = await promptValue('退款金额（分）', String(row.paidAmountFen || 0))
  if (!amount) return
  const reason = await promptValue('冲正原因', '管理员退款冲正')
  if (!reason) return
  const result = await reverseReferralCommission({ commissionId: row._id, refundAmountFen: Number(amount), confirmText: `确认冲正 ${row._id}`, reason })
  commissionActionMsg.value = result?.success ? '冲正已登记' : (result?.message || result?.reason || '冲正失败')
  if (result?.success) await loadCommissionData()
}

async function submitWithdraw() {
  withdrawSaving.value = true
  try {
    const result = await markReferralCommissionWithdrawn({ ...withdrawForm.value, amountFen: Number(withdrawForm.value.amountFen) })
    commissionActionMsg.value = result?.success ? '提现登记成功' : (result?.message || '提现登记失败')
    if (result?.success) await loadCommissionData()
  } finally { withdrawSaving.value = false }
}

async function onRetry(row: any) {
  actingId.value = row.id
  actionMsg.value = ''
  try {
    const result = await adminRetryReferralClaim(row.id)
    actionMsg.value = result?.success ? '已重新排队' : (result?.message || '操作失败')
    if (result?.success) await reload()
  } finally {
    actingId.value = ''
  }
}

async function onRecheck(row: any) {
  actingId.value = row.id
  actionMsg.value = ''
  try {
    const result = await adminRecheckReferralClaim(row.id)
    actionMsg.value = result?.success ? `对账完成：${result.status}` : (result?.message || '对账失败')
    if (result?.success) await reload()
  } finally {
    actingId.value = ''
  }
}

async function onCompensate(row: any) {
  const repairSides = Array.isArray(row.missingSides)
    ? row.missingSides.filter((side: string) => side === 'inviter' || side === 'invitee')
    : []
  if (repairSides.length === 0) {
    actionMsg.value = '当前没有可补偿的缺失奖励，请先重新对账'
    return
  }
  const confirmText = `确认补偿 ${row.id}`
  const sideText = repairSides.map((side: string) => side === 'inviter' ? '邀请人' : '被邀请人').join('、')
  const ok = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '人工补偿确认',
      content: `仅补偿当前缺失侧：${sideText}。金额按 claim 快照执行（邀请人 +${row.inviterTokens} / 被邀请人 +${row.inviteeTokens}）。`,
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
  if (!ok) return

  actingId.value = row.id
  actionMsg.value = ''
  try {
    const result = await adminGrantReferralCompensation({
      claimId: row.id,
      confirmText,
      inviterUserId: row.inviterId,
      inviteeUserId: row.inviteeId,
      inviterTokens: Number(row.inviterTokens || 0),
      inviteeTokens: Number(row.inviteeTokens || 0),
      repairSides,
      reason: 'admin_panel_compensation'
    })
    actionMsg.value = result?.success ? '补偿完成' : (result?.message || '补偿失败')
    if (result?.success) await reload()
  } finally {
    actingId.value = ''
  }
}

onMounted(() => reload())
watch(panelTab, (value) => { if (value === 'commission') void loadCommissionData() })
</script>

<style scoped>
.panel { padding: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20rpx; gap: 16rpx; }
.panel-title { font-size: 38rpx; font-weight: 900; color: #111; display: block; }
.panel-meta { font-size: 24rpx; color: #999; margin-top: 4rpx; display: block; }
.empty { text-align: center; padding: 60rpx 0; font-size: 34rpx; color: #999; }
.table { border: 2rpx solid #111; }
.table-row { display: flex; padding: 12rpx 16rpx; border-bottom: 1rpx solid #ddd; align-items: flex-start; font-size: 24rpx; gap: 8rpx; }
.table-row:last-child { border-bottom: none; }
.table-header { background: #111; }
.table-header text { color: #FFD93D; font-weight: 900; }
.cell { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-ok { color: #4ECDC4; font-weight: 800; }
.tag-blocked { color: #FF5252; font-weight: 800; }
.tag-muted { color: #666; font-weight: 700; }
.ghost-btn { border: 2rpx solid #111; background: #fff; padding: 6rpx 12rpx; font-size: 22rpx; font-weight: 700; color: #111; line-height: 1.2; }
.ghost-btn:disabled { opacity: 0.5; }
.wide-btn { min-width: 100rpx; }
.save-message { margin-top: 16rpx; font-size: 24rpx; color: #666; }
.commission-tabs { display: flex; gap: 10rpx; margin-bottom: 20rpx; }
.commission-tab { min-height: 64rpx; padding: 0 24rpx; border: 2rpx solid #111; background: #fff; font-size: 28rpx; font-weight: 800; }
.commission-tab.active { background: #111; color: #FFD93D; }
.commission-config { padding: 20rpx; border: 2rpx solid #111; background: #FFFBEB; margin-bottom: 20rpx; }
.config-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 14rpx 0; border-bottom: 1rpx solid #ddd; font-size: 28rpx; font-weight: 700; }
.config-row:last-of-type { border-bottom: none; }
.config-input { width: 180rpx; padding: 8rpx 12rpx; border: 2rpx solid #111; background: #fff; text-align: right; }
.rate-input { display: flex; align-items: center; gap: 10rpx; }
.rate-suffix { min-width: 24rpx; font-size: 28rpx; font-weight: 800; }
.channels { align-items: flex-start; }
.channel-list { display: flex; flex-wrap: wrap; gap: 14rpx; justify-content: flex-end; font-size: 24rpx; }
.commission-row { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 16rpx; margin-bottom: 10rpx; border: 2rpx solid #111; background: #fff; }
.commission-order { display: block; font-size: 26rpx; font-weight: 800; }
.commission-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.withdraw-box { display: flex; flex-wrap: wrap; align-items: center; gap: 10rpx; padding: 16rpx; margin-bottom: 18rpx; border: 2rpx solid #111; background: #E0FFF0; }
.reversal-ledger { margin-top: 28rpx; padding-top: 20rpx; border-top: 3rpx solid #111; }
.ledger-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.ledger-head .withdraw-title { width: auto; }
.ledger-empty { padding: 28rpx 0; font-size: 28rpx; }
.withdraw-title { width: 100%; font-size: 28rpx; font-weight: 800; }
.wide-input { flex: 1 1 220rpx; min-width: 180rpx; box-sizing: border-box; text-align: left; }
</style>
