<template>
  <view class="panel">
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
        <text style="width:100rpx;">状态</text>
        <text style="width:80rpx;">次数</text>
        <text style="width:120rpx;">错误码</text>
        <text style="width:160rpx;">操作</text>
      </view>
      <view v-for="row in rows" :key="row.id" class="table-row">
        <text class="cell">{{ row.inviteeLabel }}</text>
        <text class="cell">{{ row.inviterLabel }}</text>
        <text style="width:80rpx;font-size:22rpx;">{{ row.inviteCode || '-' }}</text>
        <text style="width:100rpx;" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</text>
        <text style="width:80rpx;">{{ row.attempts || 0 }}</text>
        <text style="width:120rpx;font-size:22rpx;color:#999;">{{ row.lastErrorCode || row.statusReason || '-' }}</text>
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
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  adminListReferralClaims,
  adminRetryReferralClaim,
  adminRecheckReferralClaim,
  adminGrantReferralCompensation
} from '@/utils/api'

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
</style>
