<template>
  <view class="pet" @click="$emit('click')">
    <view class="pet-body">
      <text class="pet-icon">🐱</text>
    </view>
    <text class="pet-hint">点我帮你说</text>
  </view>
</template>

<script setup lang="ts">
defineEmits(['click'])
</script>

<style scoped>
.pet {
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  padding: 12rpx; cursor: pointer;
}
.pet-body {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: #FFD93D; border: 3px solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
  display: flex; align-items: center; justify-content: center;
}
.pet-icon { font-size: 40rpx; }
.pet-hint {
  font-size: 18rpx; font-weight: 700; color: #666;
  background: #fff; padding: 4rpx 12rpx; border: 2px solid #ddd;
}
</style>
