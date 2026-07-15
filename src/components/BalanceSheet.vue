<template>
  <view v-if="visible" class="bs-mask" @click.stop="$emit('close')">
    <view class="bs-sheet" @click.stop>
      <!-- Topbar -->
      <view class="bs-topbar">
        <text class="bs-topbar-title">⚖️ 互动天平</text>
        <view class="bs-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
      </view>

      <!-- Body -->
      <view class="bs-body">
        <text class="bs-subtitle">本月你与 TA 的互动对比</text>

        <view v-for="(bar, i) in bars" :key="i" :class="['bs-card', bar.taClass === 'risk' ? 'bs-card-risk' : '']">
          <text class="bs-card-label">{{ bar.label }}</text>
          <view class="bs-bar-row">
            <text class="bs-bar-num bs-bar-you">你 {{ bar.you }}</text>
            <view class="bs-bar-track">
              <view class="bs-bar-fill bs-bar-fill-you" :style="{ flex: bar.you || 0.1 }" />
              <view class="bs-bar-sep" />
              <view class="bs-bar-fill bs-bar-fill-ta" :style="{ flex: bar.ta || 0.1 }" />
            </view>
            <text class="bs-bar-num bs-bar-ta">TA {{ bar.ta }}</text>
          </view>
        </view>

        <view v-if="callout" class="bs-callout">💬 {{ callout }}</view>

        <view class="bs-link" @click="$emit('close'); $emit('openCaseDetail')">查看完整分析 →</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  bars: { label: string; you: number; ta: number; taClass: string }[]
  callout: string
}>()

defineEmits<{ close: []; openCaseDetail: [] }>()
</script>

<style scoped>
/* ═══ MASK + SHEET ═══ */
.bs-mask { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; }
.bs-sheet { width: 100%; max-height: 88vh; overflow-y: auto; padding: 0 0 calc(140rpx + env(safe-area-inset-bottom)); background: var(--app-bg, #FFFDF5); border-radius: 24rpx 24rpx 0 0; border-top: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hero, 0 -8rpx 0 #111); animation: bs-slide-up 0.3s ease-out; box-sizing: border-box; }
@keyframes bs-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* ═══ TOPBAR ═══ */
.bs-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 28rpx 12rpx; }
.bs-topbar-title { font-size: 38rpx; font-weight: 900; color: var(--text-main, #111); }
.bs-topbar-close { width: 56rpx; height: 56rpx; border-radius: 50%; border: var(--border-width, 2rpx) solid var(--border, #111); display: flex; align-items: center; justify-content: center; font-size: 38rpx; color: var(--text-muted, #666); }

/* ═══ BODY ═══ */
.bs-body { padding: 0 24rpx 24rpx; }
.bs-subtitle { display: block; font-size: 24rpx; color: var(--text-muted, #666); font-weight: 700; margin-bottom: 16rpx; }

/* ═══ BAR CARDS ═══ */
.bs-card { border-radius: var(--shape-radius-card, 0); padding: 20rpx 24rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); margin-bottom: 12rpx; background: linear-gradient(160deg, #E0FFF0 0%, #C8F0E0 100%); }
.bs-card-risk { background: linear-gradient(160deg, #FFEEEC 0%, #FFD8D4 100%); }
.bs-card-label { font-size: 24rpx; font-weight: 700; color: var(--text-main, #111); margin-bottom: 6rpx; display: block; }
.bs-bar-row { display: flex; align-items: center; gap: 8rpx; }
.bs-bar-num { font-size: 22rpx; font-weight: 700; color: var(--text-muted, #666); min-width: 50rpx; }
.bs-bar-ta { text-align: right; }
.bs-bar-track { flex: 1; display: flex; align-items: center; height: 24rpx; }
.bs-bar-fill { height: 100%; border-radius: 4rpx; }
.bs-bar-fill-you { background: var(--mint, #4ECDC4); }
.bs-bar-fill-ta { background: var(--accent, #FFD93D); }
.bs-bar-sep { width: var(--border-width, 3rpx); height: 100%; background: var(--border, #111); flex-shrink: 0; }

/* ═══ FOOTER ═══ */
.bs-callout { font-size: 24rpx; color: var(--text-muted, #666); font-weight: 400; margin-top: 16rpx; line-height: 1.5; }
.bs-link { font-size: 28rpx; font-weight: 700; color: var(--text-main, #111); text-align: center; margin-top: 16rpx; padding: 12rpx; }
</style>
