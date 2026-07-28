<template>
  <view v-if="visible" class="pes-mask" @click.stop="$emit('close')">
    <view class="pes-sheet" @click.stop>
      <view class="pes-topbar">
        <text class="pes-topbar-title">宠物活力</text>
        <view class="pes-topbar-close" aria-label="关闭宠物活力" hover-class="pes-close-pressed" @click.stop="$emit('close')">
          <view class="pes-close-visual"><text>×</text></view>
        </view>
      </view>

      <view class="pes-body">
        <view class="pes-hero">
          <view class="pes-score-head">
            <view class="pes-title-row">
              <image class="pes-title-icon" src="/static/icons/taohua/star-filled.svg" mode="aspectFit" />
              <text class="pes-status">{{ snapshot.label }}</text>
            </view>
            <view class="pes-score"><text class="pes-score-num">{{ snapshot.score }}</text><text class="pes-score-unit">/100</text></view>
          </view>
          <view class="pes-progress" :aria-label="`当前活力 ${snapshot.score} 分，共 100 分`">
            <view class="pes-progress-fill" :style="{ width: `${snapshot.score}%` }" />
          </view>
          <text class="pes-next">{{ nextHint }}</text>
        </view>

        <text class="pes-section-title">今日获得</text>
        <view class="pes-card pes-actions">
          <view v-for="item in snapshot.actions" :key="item.action" class="pes-action-row">
            <view class="pes-action-copy">
              <text class="pes-action-label">{{ actionLabel(item.label) }}</text>
              <text class="pes-action-bonus">每次 +{{ item.bonus }}</text>
            </view>
            <text :class="['pes-action-count', item.count >= item.cap ? 'done' : '']">
              {{ item.count >= item.cap ? '今日已完成' : `${item.count}/${item.cap}` }}
            </text>
          </view>
        </view>

        <text class="pes-section-title">活力规则</text>
        <view class="pes-card pes-rules">
          <text class="pes-rule">每完整 4 小时自然减少 5 点活力。</text>
          <text class="pes-rule">达到 100 后，{{ petName }}会出去跑一圈，回来时保留 85 点活力。</text>
          <text class="pes-device-note">活力保存在当前设备，不影响关系分析分数。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PetEnergySnapshot } from '@/utils/helpers'

const props = withDefaults(defineProps<{
  visible: boolean
  snapshot: PetEnergySnapshot
  petName?: string
}>(), { petName: '小咪' })

defineEmits<{ close: [] }>()

const nextHint = computed(() => {
  if (props.snapshot.score >= 100) {
    return props.snapshot.runCooldownRemainingMs > 0
      ? '活力已满，休息一下再出发'
      : `${props.petName}已经准备好出去跑一圈啦`
  }
  if (props.snapshot.pointsToNext <= 0) return '今天也要轻松陪伴彼此'
  if (props.snapshot.nextTarget === 100) return `再获得 ${props.snapshot.pointsToNext} 点，${props.petName}就会出去跑一圈`
  return `再获得 ${props.snapshot.pointsToNext} 点，状态会继续提升`
})

function actionLabel(label: string) {
  return String(label || '').replaceAll('宠物', props.petName)
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.pes-mask { position: fixed; inset: 0; z-index: 110; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; }
.pes-sheet {
  width: 100%; max-height: 88vh; overflow-y: auto;
  padding: 0 0 calc(140rpx + env(safe-area-inset-bottom));
  background: var(--app-bg, #FFFDF5);
  border-radius: 24rpx 24rpx 0 0;
  border-top: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hero, 0 -8rpx 0 #111);
  animation: pes-slide-up .3s ease-out;
  box-sizing: border-box;
}
@keyframes pes-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

.pes-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 28rpx 12rpx; }
.pes-topbar-title { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.pes-topbar-close { width: 88rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; }
.pes-close-visual { width: 56rpx; height: 56rpx; border-radius: 50%; @include border-soft; display: flex; align-items: center; justify-content: center; font-size: $fs-heading; color: var(--text-muted, #666); }
.pes-close-pressed { opacity: .75; }

.pes-body { padding: 0 24rpx 24rpx; }
.pes-hero,
.pes-card {
  border-radius: var(--shape-radius-card, 0);
  @include border-hard;
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.pes-hero { padding: 24rpx; margin-bottom: 20rpx; background: linear-gradient(160deg, var(--accent-soft, #FFFBEA) 0%, #FFF3D0 100%); }
.pes-score-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.pes-title-row { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.pes-title-icon { width: 30rpx; height: 30rpx; flex-shrink: 0; }
.pes-status { font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.pes-score { display: flex; align-items: baseline; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.pes-score-num { font-size: $fs-display; font-weight: $fw-hero; line-height: 1; color: var(--text-main, #111); }
.pes-score-unit { font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); }
.pes-progress { height: 14rpx; margin: 18rpx 0 12rpx; overflow: hidden; background: rgba(0,0,0,.08); border-radius: 999rpx; }
.pes-progress-fill { height: 100%; border-radius: inherit; background: var(--accent-cool, #4ECDC4); transition: width .25s ease-out; }
.pes-next { display: block; font-size: $fs-body-sm; font-weight: $fw-body; line-height: $lh-body; color: var(--text-main, #111); }

.pes-section-title { display: block; margin: 0 0 10rpx; font-size: $fs-body-sm; font-weight: $fw-label; color: var(--text-main, #111); }
.pes-card { margin-bottom: 20rpx; background: var(--surface, #fff); }
.pes-actions { padding: 0 20rpx; }
.pes-action-row { min-height: 80rpx; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; border-bottom: 1rpx solid var(--divider, #ddd); }
.pes-action-row:last-child { border-bottom: 0; }
.pes-action-copy { min-width: 0; display: flex; flex-direction: column; gap: 2rpx; }
.pes-action-label { font-size: $fs-body-sm; font-weight: $fw-label; color: var(--text-main, #111); }
.pes-action-bonus { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #666); }
.pes-action-count { flex-shrink: 0; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-main, #111); font-variant-numeric: tabular-nums; }
.pes-action-count.done { color: var(--relation-good, #1A6B5A); }
.pes-rules { padding: 20rpx 24rpx; }
.pes-rule { display: block; font-size: $fs-body-sm; font-weight: $fw-body; color: var(--text-main, #111); line-height: $lh-body; margin-bottom: 8rpx; }
.pes-device-note { display: block; margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx dashed var(--divider, #ccc); font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #666); line-height: $lh-body; }

@media (prefers-reduced-motion: reduce) {
  .pes-sheet { animation: none; }
  .pes-progress-fill { transition: none; }
}
</style>
