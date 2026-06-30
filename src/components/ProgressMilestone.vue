<template>
  <view class="pm-card">
    <text class="pm-title">📊 已记录 {{ countNum }} 条 · {{ hint }}</text>
    <view class="pm-track">
      <view class="pm-fill" :style="{ width: pct + '%' }"></view>
    </view>
    <view class="pm-ticks">
      <view v-for="t in ticks" :key="t.label" :class="['pm-tick', countNum >= t.threshold ? 'done' : '']">
        <view class="pm-dot"></view>
        <text class="pm-label">{{ t.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ count: number | string }>(), { count: 0 })
const countNum = computed(() => Number(props.count || 0))

const milestones = [
  { threshold: 3, label: '场景分布' },
  { threshold: 7, label: '互动天平' },
  { threshold: 14, label: '趋势信号' },
  { threshold: 30, label: '月度复盘' }
]
const ticks = [{ threshold: 0, label: '0' }, ...milestones]

const next = computed(() => milestones.find(m => countNum.value < m.threshold))
const hint = computed(() => {
  if (countNum.value === 0) return '记录第一条事件，开启分析旅程'
  if (!next.value) return '全部解锁！可查看完整分析面板'
  return `再记 ${next.value.threshold - countNum.value} 条解锁「${next.value.label}」`
})
const pct = computed(() => Math.min(100, Math.round((countNum.value / 30) * 100)))
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.pm-card { @include card-v2; padding: 20rpx 28rpx; margin-bottom: 24rpx; background: #fff; }
.pm-title { display: block; font-size: $fs-body; font-weight: $fw-heading; color: #111; margin-bottom: 12rpx; }
.pm-track { height: 12rpx; background: #f0f0f0; border: 1rpx solid #111; overflow: hidden; }
.pm-fill { height: 100%; background: #4ECDC4; transition: width 0.5s ease; }
.pm-ticks { display: flex; justify-content: space-between; margin-top: 10rpx; gap: 8rpx; }
.pm-tick { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2rpx; min-width: 0; }
.pm-dot { width: 10rpx; height: 10rpx; border-radius: 50%; border: 2rpx solid #999; background: #fff; }
.pm-tick.done .pm-dot { background: #4ECDC4; border-color: #111; }
.pm-label { font-size: 24rpx; font-weight: $fw-label; color: #999; text-align: center; white-space: nowrap; }
.pm-tick.done .pm-label { color: #111; }
</style>
