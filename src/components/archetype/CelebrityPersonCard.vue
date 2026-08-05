<template>
  <view class="person-card" @click="emit('select', person.key)">
    <image v-if="person.coverUrl" :src="person.coverUrl" mode="aspectFill" class="avatar" />
    <text v-else class="avatar avatar-fallback">{{ person.name?.slice(0, 1) || '?' }}</text>
    <text class="name">{{ person.name }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{ person: any }>()
const emit = defineEmits<{ select: [personKey: string] }>()
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.person-card{display:inline-flex;flex-direction:column;align-items:center;min-width:100rpx;padding:12rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-inner, 0);background:var(--surface, #fff)}.avatar{width:54rpx;height:54rpx;border-radius:50%;background:var(--hero-tag-bg, #111);color:var(--hero-tag-color, #FFD93D)}.avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:var(--font-weight-hero, $fw-hero);font-size:$fs-micro}.name{font-size:$fs-micro;font-weight:$fw-label;color:var(--text-main, #111)}
</style>
