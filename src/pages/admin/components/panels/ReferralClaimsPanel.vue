<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">邀请奖励</text>
        <text class="panel-meta">{{ rows.length }} 条 · 发出 {{ totalInviter.toLocaleString() }} Credits · 收到 {{ totalInvitee.toLocaleString() }} Credits</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="loading" @click="load">{{ loading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="rows.length === 0" class="empty">暂无邀请奖励记录。</view>
    <view v-else class="table">
      <view class="table-row table-header">
        <text style="flex:1;">被邀请人</text>
        <text style="flex:1;">邀请人</text>
        <text style="width:80rpx;">邀请码</text>
        <text style="width:80rpx;">渠道</text>
        <text style="width:100rpx;">邀请人得</text>
        <text style="width:100rpx;">被邀请人得</text>
        <text style="width:80rpx;">状态</text>
        <text style="width:120rpx;">时间</text>
      </view>
      <view v-for="row in rows" :key="row.id" class="table-row">
        <text class="cell">{{ row.inviteeLabel }}</text>
        <text class="cell">{{ row.inviterLabel }}</text>
        <text style="width:80rpx;font-size:18rpx;">{{ row.inviteCode }}</text>
        <text style="width:80rpx;font-size:18rpx;">{{ row.channel || '-' }}</text>
        <text style="width:100rpx;color:#4ECDC4;font-weight:800;">+{{ row.inviterTokens.toLocaleString() }}</text>
        <text style="width:100rpx;color:#FFD93D;font-weight:800;">+{{ row.inviteeTokens.toLocaleString() }}</text>
        <text style="width:80rpx;" :class="row.status === 'rewarded' ? 'tag-ok' : 'tag-blocked'">{{ row.status === 'rewarded' ? '已发放' : '已封禁' }}</text>
        <text style="width:120rpx;font-size:18rpx;color:#999;">{{ formatTime(row.rewardedAt || row.createdAt) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminListReferralClaims } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const loading = ref(false)
const rows = ref<any[]>([])
const totalInviter = ref(0)
const totalInvitee = ref(0)

async function load() {
  loading.value = true
  try {
    const result = await adminListReferralClaims()
    if (result?.success) {
      rows.value = result.rows || []
      totalInviter.value = result.totalInviterRewards || 0
      totalInvitee.value = result.totalInviteeRewards || 0
    }
  } catch {} finally { loading.value = false }
}

function formatTime(v: string) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(() => load())
</script>

<style scoped>
.panel { padding: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.panel-title { font-size: 38rpx; font-weight: 900; color: #111; display: block; }
.panel-meta { font-size: 32rpx; color: #999; margin-top: 4rpx; display: block; }
.empty { text-align: center; padding: 60rpx 0; font-size: 34rpx; color: #999; }
.table { border: 2rpx solid #111; }
.table-row { display: flex; padding: 12rpx 16rpx; border-bottom: 1rpx solid #ddd; align-items: center; font-size: 32rpx; gap: 8rpx; }
.table-row:last-child { border-bottom: none; }
.table-header { background: #111; }
.table-header text { color: #FFD93D; font-weight: 900; }
.cell { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-ok { color: #4ECDC4; font-weight: 800; }
.tag-blocked { color: #FF5252; font-weight: 800; }
.ghost-btn { border: 2rpx solid #111; background: #fff; padding: 8rpx 20rpx; font-size: 32rpx; font-weight: 700; color: #111; }
.ghost-btn:disabled { opacity: 0.5; }
.wide-btn { min-width: 100rpx; }
</style>
