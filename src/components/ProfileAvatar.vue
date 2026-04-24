<template>
  <view :class="['profile-avatar', size]">
    <image v-if="src" :src="src" mode="aspectFill" />
    <text v-else class="avatar-placeholder">{{ initial }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
  background: linear-gradient(135deg, #e8dcc8 0%, #d4c4a8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  font-size: 28rpx;
  font-weight: 600;
  color: #786857;
  text-transform: uppercase;
}

.profile-avatar.xs .avatar-placeholder {
  font-size: 20rpx;
}

.profile-avatar.sm .avatar-placeholder {
  font-size: 24rpx;
}

.profile-avatar.md .avatar-placeholder {
  font-size: 32rpx;
}

.profile-avatar.lg .avatar-placeholder {
  font-size: 40rpx;
}
</style>
