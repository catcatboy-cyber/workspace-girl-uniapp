<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">各用户 Crush Credits 消耗</text>
        <text class="panel-meta">{{ tokenUserRows.length }} 个用户 · 点击展开明细</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="tokenUsersLoading" @click="loadTokenUsers">{{ tokenUsersLoading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="tokenUserRows.length === 0 && !tokenUsersLoading" class="empty">暂无数据。</view>
    <view v-else>
      <view class="table" style="max-height:500px;overflow-y:auto;margin-bottom:16px;">
        <view class="table-row table-header">
          <text style="width:40rpx;"></text>
          <text style="flex:1;">用户</text>
          <text style="width:130rpx;text-align:right;">平台 Crush</text>
          <text style="width:130rpx;text-align:right;">模型 Crush</text>
          <text style="width:80rpx;text-align:right;">次数</text>
          <text style="width:140rpx;text-align:right;">最近使用</text>
        </view>
        <view v-for="row in tokenUserRows" :key="row.userId" :class="['table-row', tokenDetailUserId === row.userId ? 'selected' : '']" @click="toggleTokenUserDetail(row.userId)" style="cursor:pointer;">
          <text style="width:40rpx;font-weight:900;">{{ tokenDetailUserId === row.userId ? '▼' : '▶' }}</text>
          <text style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ row.email || row.phone || row.userId }}</text>
          <text style="width:130rpx;text-align:right;font-weight:800;color:#111;">{{ row.platformTokens.toLocaleString() }}</text>
          <text style="width:130rpx;text-align:right;color:#999;">{{ row.modelTokens.toLocaleString() }}</text>
          <text style="width:80rpx;text-align:right;color:#999;">{{ row.callCount }}</text>
          <text style="width:140rpx;text-align:right;color:#999;font-size:18rpx;">{{ formatShortDate(row.lastUsed) }}</text>
        </view>
      </view>

      <!-- 明细展开 -->
      <view v-if="tokenDetailUserId && tokenDetailRecords.length > 0" class="token-detail-panel">
        <view class="token-detail-head">
          <text class="token-detail-title">{{ tokenDetailUserLabel }} · 最近 {{ tokenDetailRecords.length }} 次调用</text>
          <button class="small-btn" @click="tokenDetailUserId = ''">收起</button>
        </view>
        <view class="table" style="max-height:400px;overflow-y:auto;">
          <view class="table-row table-header" style="font-size:18rpx;">
            <text style="flex:1.2;">功能</text>
            <text style="width:80rpx;text-align:center;">模型</text>
            <text style="width:100rpx;text-align:right;">入 Crush</text>
            <text style="width:100rpx;text-align:right;">出 Crush</text>
            <text style="width:100rpx;text-align:right;">平台 Crush</text>
            <text style="width:120rpx;text-align:right;">时间</text>
          </view>
          <view v-for="rec in tokenDetailRecords" :key="rec._id" class="table-row" style="font-size:20rpx;">
            <text style="flex:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ formatTokenFeature(rec.feature) }}</text>
            <text style="width:80rpx;text-align:center;color:#999;font-size:18rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ shortModelName(rec.model) }}</text>
            <text style="width:100rpx;text-align:right;color:#999;">{{ (rec.inputTokens || 0).toLocaleString() }}</text>
            <text style="width:100rpx;text-align:right;color:#999;">{{ (rec.outputTokens || 0).toLocaleString() }}</text>
            <text style="width:100rpx;text-align:right;font-weight:700;color:#111;">{{ rec.platformTokens.toLocaleString() }}</text>
            <text style="width:120rpx;text-align:right;color:#999;font-size:16rpx;">{{ formatShortDate(rec.createdAt) }}</text>
          </view>
        </view>
      </view>
      <view v-if="tokenDetailUserId && tokenDetailLoading" class="empty">加载中…</view>
      <view v-if="tokenDetailUserId && !tokenDetailLoading && tokenDetailRecords.length === 0" class="empty">暂无明细。</view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 各用户 Token 消耗面板 —— 自 admin.vue 抽出（Phase 1 样板）。自包含：自己加载数据、无共享状态依赖。
import { ref, computed, onMounted } from 'vue'
import { adminGetUsersTokenConsumption, adminGetUserTokenDetails } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const tokenUsersLoading = ref(false)
const tokenUserRows = ref<Array<{ userId: string; email: string; phone: string; platformTokens: number; modelTokens: number; callCount: number; lastUsed: string }>>([])
const tokenDetailUserId = ref('')
const tokenDetailRecords = ref<Array<any>>([])
const tokenDetailLoading = ref(false)

const tokenDetailUserLabel = computed(() => {
  const row = tokenUserRows.value.find(r => r.userId === tokenDetailUserId.value)
  return row ? (row.email || row.phone || row.userId) : ''
})

async function loadTokenUsers() {
  if (tokenUsersLoading.value) return
  tokenUsersLoading.value = true
  try {
    const result = await adminGetUsersTokenConsumption(500)
    if (result?.success) {
      tokenUserRows.value = result.rows || []
    }
  } catch { /* ignore */ }
  finally { tokenUsersLoading.value = false }
}

async function toggleTokenUserDetail(userId: string) {
  if (tokenDetailUserId.value === userId) {
    tokenDetailUserId.value = ''
    return
  }
  tokenDetailUserId.value = userId
  tokenDetailRecords.value = []
  tokenDetailLoading.value = true
  try {
    const result = await adminGetUserTokenDetails(userId, 200)
    if (result?.success) {
      tokenDetailRecords.value = result.records || []
    }
  } catch { /* ignore */ }
  finally { tokenDetailLoading.value = false }
}

function shortModelName(model: string) {
  if (!model) return '-'
  // deepseek-chat → deepseek / gpt-4o-mini → gpt-4o
  return model.replace(/-chat|-instruct|-completion|-preview/g, '').slice(0, 12)
}

function formatTokenFeature(feature: string) {
  const map: Record<string, string> = {
    eventAssessment: '即时反馈',
    eventUnderstanding: '事件理解',
    weeklyReview: '近月度复盘',
    attachmentAnalysis: '附件识别',
    petReply: '宠物帮说',
    batchTag: '批量标签',
    unknown: '未知调用'
  }
  const clean = (feature || '').split(' · ')[0].trim()
  return map[clean] || clean || aiLabel() + ' 调用'
}

function formatShortDate(value: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => { loadTokenUsers() })
</script>

<style scoped>
/* 共享基础类（自 admin.vue scoped 复制，admin.vue 原样保留；后续多面板后再统一进 admin-common.scss） */
.panel { background: #fbfdfb; border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; box-shadow: 0 12px 28px rgba(23, 35, 31, 0.06); padding: 20px; }
.panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
.panel-title { display: block; font-size: 20px; font-weight: 700; }
.panel-meta { display: block; color: #68766f; font-size: 13px; line-height: 1.5; }
button { margin: 0; }
.ghost-btn { border-radius: 6px; font-size: 15px; width: 88px; height: 38px; line-height: 38px; color: #123c36; background: #eef6f2; border: 1px solid rgba(18, 60, 54, 0.18); }
.wide-btn { width: 104px; }
.small-btn { border-radius: 6px; font-size: 13px; width: auto; min-width: 74px; height: 34px; line-height: 34px; padding: 0 12px; color: #123c36; background: #fbfdfb; border: 1px solid rgba(18, 60, 54, 0.18); }
.table { border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; overflow: hidden; }
.table-row { display: grid; grid-template-columns: minmax(220px, 1.7fr) minmax(90px, 0.7fr) 70px 80px; gap: 12px; align-items: center; padding: 12px 14px; border-top: 1px solid rgba(23, 35, 31, 0.08); font-size: 14px; }
.table-row:first-child { border-top: 0; }
.table-header { color: #68766f; background: #f3f7f4; font-weight: 700; }
.table-row.selected { background: #edf7f2; }
.empty { padding: 22px; color: #68766f; background: #f4f7f4; border-radius: 8px; }
</style>
