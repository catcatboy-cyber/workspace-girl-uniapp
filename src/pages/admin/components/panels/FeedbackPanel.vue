<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">用户反馈</text>
        <text class="panel-meta">{{ feedbacks.length }} 条反馈</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="feedbackLoading" @click="loadFeedbacks">{{ feedbackLoading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="feedbacks.length === 0 && !feedbackLoading" class="empty">暂无用户反馈。</view>
    <view v-else class="feedback-list">
      <view v-for="(fb, index) in feedbacks" :key="fb._id || index" class="feedback-item" :class="{ resolved: fb.resolved }">
        <view class="feedback-head">
          <view>
            <text class="feedback-time">{{ formatDate(fb.createdAt) }}</text>
            <text class="feedback-user">用户：{{ fb.userId || fb.openid || '未知' }}</text>
          </view>
          <text v-if="fb.contact" class="feedback-contact">{{ fb.contact }}</text>
        </view>
        <text class="feedback-content">{{ fb.content }}</text>
        <view v-if="fb.resolved" class="feedback-resolved-badge">已采纳 · 奖励 {{ fb.rewardTokens || 0 }} token</view>
        <view v-else class="feedback-actions">
          <input v-if="!fb.userId" :value="targetUserIds[fb._id] || ''" class="reward-input" placeholder="用户ID" @input="onTargetUserInput(fb._id, $event)" />
          <input :value="rewardInputs[fb._id] || ''" type="number" class="reward-input" placeholder="奖励 token" @input="onRewardInput(fb._id, $event)" />
          <button class="small-btn" :disabled="resolvingId === fb._id" @click="resolveFeedback(fb._id)">{{ resolvingId === fb._id ? '处理中' : '采纳' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 用户反馈面板 —— 自 admin.vue 抽出。自包含；错误通过 @error 上报给 admin 顶栏 alert。
import { ref, reactive, onMounted } from 'vue'
import { adminListFeedbacks, adminResolveFeedback } from '@/utils/api'

const emit = defineEmits<{ error: [string] }>()

const feedbacks = ref<any[]>([])
const feedbackLoading = ref(false)
const rewardInputs = reactive<Record<string, number>>({})
const targetUserIds = reactive<Record<string, string>>({})
const resolvingId = ref('')

async function loadFeedbacks() {
  feedbackLoading.value = true
  try {
    const result = await adminListFeedbacks()
    if (result?.success) feedbacks.value = result.feedbacks || []
  } catch { /* ignore */ }
  finally { feedbackLoading.value = false }
}

function onRewardInput(feedbackId: string, e: any) {
  rewardInputs[feedbackId] = Number(e?.detail?.value) || 0
}

function onTargetUserInput(feedbackId: string, e: any) {
  targetUserIds[feedbackId] = String(e?.detail?.value || '').trim()
}

async function resolveFeedback(feedbackId: string) {
  if (!feedbackId || resolvingId.value) return
  const tokens = Number(rewardInputs[feedbackId]) || 0
  if (tokens <= 0) { emit('error', '奖励 token 必须大于 0'); return }
  emit('error', '')
  resolvingId.value = feedbackId
  try {
    const result = await adminResolveFeedback(feedbackId, tokens, targetUserIds[feedbackId] || undefined)
    if (result?.success) {
      const fb = feedbacks.value.find((f: any) => f._id === feedbackId)
      if (fb) { fb.resolved = true; fb.rewardTokens = tokens }
    } else {
      emit('error', result?.message || '处理失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '处理失败')
  }
  finally { resolvingId.value = '' }
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

onMounted(() => { loadFeedbacks() })
</script>

<style scoped lang="scss">
@import '../../styles/admin-common.scss';

.feedback-list { display: flex; flex-direction: column; gap: 12px; }
.feedback-item { padding: 16px; border: 1px solid rgba(23, 35, 31, 0.1); border-radius: 8px; background: #fbfdfb; }
.feedback-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.feedback-time { color: #68766f; font-size: 13px; }
.feedback-contact { color: #42524b; font-size: 13px; }
.feedback-content { display: block; color: #17231f; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
.feedback-item.resolved { opacity: 0.7; background: #f4f8f5; }
.feedback-user { color: #68766f; font-size: 12px; margin-left: 12px; }
.feedback-resolved-badge { display: inline-block; margin-top: 10px; padding: 4px 10px; border-radius: 4px; background: #e6f4ec; color: #0f6b45; font-size: 13px; font-weight: 700; }
.feedback-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(23, 35, 31, 0.08); }
.reward-input { width: 140px; height: 34px; padding: 0 10px; border: 1px solid rgba(23, 35, 31, 0.18); border-radius: 6px; font-size: 13px; }
</style>
