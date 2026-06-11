<template>
  <view class="ai-loading">
    <text class="ai-loading-label">{{ label }}</text>
    <view class="ai-loading-row">
      <view class="ai-loading-dot"></view>
      <text v-if="seconds !== undefined" class="ai-loading-text">后台运行中，已用时 {{ seconds }} 秒</text>
      <text v-else class="ai-loading-text">后台运行中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ label: string; seconds?: number }>()
</script>

<style scoped>
.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
  padding: 20rpx 24rpx;
  border: 2rpx solid #111;
  background: #f5f5ff;
  margin: 12rpx 0;
}

.ai-loading-label {
  font-size: 24rpx;
  font-weight: 900;
  color: #111;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.ai-loading-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.ai-loading-dot {
  width: 20rpx;
  height: 20rpx;
  border: 2rpx solid #111;
  background: #FFD93D;
  display: inline-block;
  animation: blink-dot 1s ease-in-out infinite;
}

.ai-loading-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #999;
}

@keyframes blink-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.75); }
}
</style>
