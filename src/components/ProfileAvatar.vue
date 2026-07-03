<template>
  <view :class="['profile-avatar', size]">
    <image v-if="src" :src="src" mode="aspectFill" />
    <text v-else class="avatar-placeholder">{{ initial }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { aiLabel } from '@/utils/labels'

const props = withDefaults(defineProps<{
  name?: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}>(), {
  size: 'md'
})

const initial = computed(() => {
  const normalized = String(props.name || '').trim()
  return normalized ? normalized.charAt(0) : '?'
})
</script>

<style scoped>
.profile-avatar {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  background: #FFD93D;
  border: 3rpx solid #111;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.profile-avatar.xs {
  width: 48rpx;
  height: 48rpx;
}

.profile-avatar.sm {
  width: 64rpx;
  height: 64rpx;
}

.profile-avatar.md {
  width: 96rpx;
  height: 96rpx;
}

.profile-avatar.lg {
  width: 128rpx;
  height: 128rpx;
}

.profile-avatar image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 36rpx;
  font-weight: 900;
  color: #111;
  text-transform: uppercase;
}

.profile-avatar.xs .avatar-placeholder {
  font-size: 32rpx;
}

.profile-avatar.sm .avatar-placeholder {
  font-size: 34rpx;
}

.profile-avatar.md .avatar-placeholder {
  font-size: 38rpx;
}

.profile-avatar.lg .avatar-placeholder {
  font-size: 38rpx;
}
</style>
