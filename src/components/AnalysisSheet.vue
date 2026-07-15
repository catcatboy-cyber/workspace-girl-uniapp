<template>
  <view v-if="visible" class="as-mask" @click.stop="$emit('close')">
    <view class="as-sheet" @click.stop>
      <!-- Topbar -->
      <view class="as-topbar">
        <text class="as-topbar-title">本次分析</text>
        <view class="as-topbar-actions">
          <button class="as-share-btn" open-type="share">
            <image class="as-share-icon" src="/static/icons/taohua/share-2.svg" mode="aspectFit" />
          </button>
          <view class="as-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
        </view>
      </view>

      <!-- Content -->
      <view class="as-body">
        <!-- Meta info -->
        <text v-if="meta.questionLabel" class="as-meta">{{ meta.questionLabel }}</text>
        <text v-if="meta.rawDescription" class="as-desc">{{ meta.rawDescription }}</text>

        <!-- State A: loading -->
        <view v-if="aiState.loading" class="as-state-card">
          <text class="as-state-emoji">🤖</text>
          <text class="as-state-text">AI 分析中，已用时 {{ aiState.seconds }} 秒</text>
        </view>

        <!-- State B: pending -->
        <view v-else-if="aiState.pending" class="as-state-card as-state-pending">
          <text class="as-state-emoji">⏳</text>
          <text class="as-state-text">AI 分析尚未开始，请稍候</text>
        </view>

        <!-- State C: error -->
        <view v-else-if="aiState.error" class="as-state-card as-state-error">
          <text class="as-state-text">{{ aiState.errorMsg }}</text>
        </view>

        <!-- State D: normal result -->
        <template v-else>
          <!-- Signal tag -->
          <view v-if="signal.label" class="as-signal-tag">
            <text>{{ signal.emoji }} {{ signal.label }}</text>
          </view>

          <!-- Score cards -->
          <!-- Score cards: side by side -->
          <view class="as-score-row-cards">
            <view class="as-card as-card-intent">
              <text class="as-card-kicker">📊 意向</text>
              <text class="as-score-num">{{ clampScore(scores.intentScore) }}</text>
              <text :class="['as-score-delta', deltaClass(scores.intentDelta)]">{{ formatDelta(scores.intentDelta) }}</text>
              <view class="as-bar-track"><view class="as-bar-fill as-bar-intent" :style="{ width: clampScore(scores.intentScore) + '%' }" /></view>
              <text class="as-card-sub">{{ scores.intentBucket }}</text>
            </view>
            <view class="as-card as-card-risk">
              <text class="as-card-kicker">⚠️ 风险</text>
              <text class="as-score-num risk">{{ clampScore(scores.riskScore) }}</text>
              <text :class="['as-score-delta', deltaClass(scores.riskDelta)]">{{ formatDelta(scores.riskDelta) }}</text>
              <view class="as-bar-track"><view class="as-bar-fill as-bar-risk" :style="{ width: clampScore(scores.riskScore) + '%' }" /></view>
              <text class="as-card-sub">{{ scores.riskBucket }}</text>
            </view>
          </view>

          <!-- Reason bullets -->
          <view v-if="reasonBullets.length > 0" class="as-card as-card-reason">
            <text class="as-card-kicker">📋 原因分析</text>
            <text v-for="(r, i) in reasonBullets" :key="i" class="as-bullet">• {{ r }}</text>
          </view>

          <!-- Action plan -->
          <view v-if="actionMissing || actionSections.length > 0" class="as-card as-card-action">
            <text class="as-card-kicker">💡 小咪建议</text>
            <text v-if="actionMissing" class="as-action-missing">{{ actionMissingText }}</text>
            <template v-else>
              <view v-for="(item, i) in actionSections" :key="i" class="as-action-item">
                <text class="as-action-label">{{ item.label }}</text>
                <text class="as-action-text">{{ item.text }}</text>
              </view>
            </template>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  aiState: { loading: boolean; pending: boolean; seconds: number; error: boolean; errorMsg: string }
  scores: { intentScore: number; riskScore: number; intentBucket: string; riskBucket: string; intentDelta: number; riskDelta: number }
  signal: { emoji: string; label: string }
  meta: { questionLabel?: string; rawDescription?: string }
  reasonBullets: string[]
  actionSections: { label: string; text: string }[]
  actionMissing: boolean
  actionMissingText: string
}>()

defineEmits<{ close: [] }>()

function clampScore(v: number) { return Math.max(0, Math.min(100, Math.round(v || 0))) }
function formatDelta(d: number) { return d > 0 ? `+${d}` : d < 0 ? String(d) : '持平' }
function deltaClass(d: number) { return d > 0 ? 'up' : d < 0 ? 'down' : 'flat' }
</script>

<style scoped>
/* ═══ MASK + SHEET ═══ */
.as-mask { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; }
.as-sheet { width: 100%; max-height: 88vh; overflow-y: auto; padding: 0 0 calc(140rpx + env(safe-area-inset-bottom)); background: var(--app-bg, #FFFDF5); border-radius: 24rpx 24rpx 0 0; border-top: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hero, 0 -8rpx 0 #111); animation: as-slide-up 0.3s ease-out; box-sizing: border-box; }
@keyframes as-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* ═══ TOPBAR ═══ */
.as-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 28rpx 12rpx; }
.as-topbar-title { font-size: 38rpx; font-weight: 900; color: var(--text-main, #111); }
.as-topbar-actions { display: flex; align-items: center; gap: 12rpx; }
.as-share-btn { width: 56rpx; height: 56rpx; border-radius: 50%; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
.as-share-icon { width: 26rpx; height: 26rpx; }
.as-topbar-close { width: 56rpx; height: 56rpx; border-radius: 50%; border: var(--border-width, 2rpx) solid var(--border, #111); display: flex; align-items: center; justify-content: center; font-size: 38rpx; color: var(--text-muted, #666); }

/* ═══ BODY ═══ */
.as-body { padding: 0 24rpx 24rpx; }
.as-meta { display: block; font-size: 24rpx; color: var(--text-muted, #666); margin-bottom: 4rpx; }
.as-desc { display: block; font-size: 28rpx; color: var(--text-main, #111); font-weight: 500; margin-bottom: 16rpx; }

/* ═══ STATE CARDS ═══ */
.as-state-card { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 60rpx 20rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); background: var(--surface, #fff); }
.as-state-pending { background: var(--surface-dim, #f5f5f5); box-shadow: none; }
.as-state-error { background: var(--surface-dim, #f5f5f5); border-color: var(--text-soft, #999); box-shadow: none; }
.as-state-emoji { font-size: 64rpx; }
.as-state-text { font-size: 28rpx; font-weight: 700; color: var(--text-main, #111); }

/* ═══ SIGNAL TAG ═══ */
.as-signal-tag { display: inline-block; padding: 8rpx 20rpx; margin-bottom: 12rpx; border-radius: 999rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: 24rpx; font-weight: 800; color: var(--text-main, #111); }

/* ═══ SCORE ROW ═══ */
.as-score-row-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-bottom: 16rpx; }

/* ═══ CONTENT CARDS ═══ */
.as-card { border-radius: var(--shape-radius-card, 0); padding: 20rpx 24rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); display: flex; flex-direction: column; gap: 6rpx; }
.as-card-kicker { font-size: 28rpx; font-weight: 700; color: var(--card-accent, var(--text-main, #111)); }
.as-card-sub { font-size: 22rpx; color: var(--text-muted, #666); }

/* intent card */
.as-card-intent { background: linear-gradient(160deg, #E0FFF0 0%, #C8F0E0 100%); --card-accent: var(--mint, #4ECDC4); }
.as-card-risk { background: linear-gradient(160deg, #FFEEEC 0%, #FFD8D4 100%); --card-accent: var(--risk, #FF5252); }
.as-card-reason { background: linear-gradient(160deg, #FFFBEA 0%, #FFF3D0 100%); --card-accent: var(--accent, #FFD93D); margin-bottom: 16rpx; }
.as-card-action { background: linear-gradient(160deg, #FFF8E0 0%, #FFE8B0 100%); --card-accent: var(--accent, #FFD93D); }

/* score */
.as-score-num { font-size: 50rpx; font-weight: 900; color: var(--text-main, #111); line-height: 1; }
.as-score-num.risk { color: var(--risk, #FF5252); }
.as-score-delta { font-size: 24rpx; font-weight: 700; }
.as-score-delta.up { color: var(--mint, #4ECDC4); }
.as-score-delta.down { color: var(--risk, #FF5252); }
.as-score-delta.flat { color: var(--text-muted, #666); }

/* bar */
.as-bar-track { height: 12rpx; border-radius: 6rpx; background: rgba(0,0,0,.06); overflow: hidden; }
.as-bar-fill { height: 100%; border-radius: 6rpx; }
.as-bar-intent { background: var(--mint, #4ECDC4); }
.as-bar-risk { background: var(--risk, #FF5252); }

/* bullets */
.as-bullet { font-size: 28rpx; color: var(--text-main, #111); line-height: 1.5; font-weight: 400; }

/* action */
.as-action-missing { font-size: 28rpx; color: var(--text-muted, #666); }
.as-action-item { margin-top: 4rpx; }
.as-action-label { font-size: 24rpx; font-weight: 700; color: var(--accent, #FFD93D); background: var(--text-main, #111); padding: 2rpx 10rpx; border-radius: 4rpx; margin-right: 8rpx; }
.as-action-text { font-size: 28rpx; color: var(--text-main, #111); font-weight: 400; }
</style>
