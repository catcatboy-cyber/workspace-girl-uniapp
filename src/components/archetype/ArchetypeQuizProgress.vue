<template>
  <view class="quiz-progress" aria-label="答题进度">
    <view class="quiz-progress__head">
      <text>{{ label }}</text>
      <text>{{ current }}/{{ total }}</text>
    </view>
    <view class="quiz-progress__track">
      <view class="quiz-progress__fill" :style="{ width: percentage + '%' }" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ current: number; total: number; label?: string }>(), {
  label: '测试进度'
})

const percentage = computed(() => {
  if (!props.total) return 0
  return Math.max(0, Math.min(100, Math.round((props.current / props.total) * 100)))
})
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.quiz-progress { margin-bottom: 28rpx; }
.quiz-progress__head { display:flex; justify-content:space-between; margin-bottom:12rpx; font-size:$fs-caption; font-weight:$fw-label; color:var(--text-muted, #666); }
.quiz-progress__track { height:14rpx; overflow:hidden; border:var(--border-width, 2rpx) solid var(--border, #111); border-radius:var(--shape-radius-xs, 0); background:var(--surface, #fff); }
.quiz-progress__fill { height:100%; background:var(--accent, #FFD93D); transition:width .2s ease; }
</style>
