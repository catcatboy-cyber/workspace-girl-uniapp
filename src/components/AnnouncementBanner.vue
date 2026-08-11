<template>
  <view v-if="visibleAnnouncements.length > 0" class="announce-stack">
    <view v-for="item in visibleAnnouncements" :key="item.id" class="announce-banner">
      <view class="announce-main">
        <text class="announce-tag">公告</text>
        <text class="announce-title">{{ item.title }}</text>
        <text class="announce-content">{{ item.content }}</text>
      </view>
      <view class="announce-close" @click.stop="dismiss(item.id)">
        <text>×</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getActiveAnnouncements } from '@/utils/api'

type Announcement = { id: string; title: string; content: string; createdAt: string | null }

const visibleAnnouncements = ref<Announcement[]>([])

function dismissedKey(id: string) {
  return `announcementDismissed:${id}`
}

function loadAnnouncements() {
  getActiveAnnouncements()
    .then((result: any) => {
      const all: Announcement[] = result?.success ? (result.announcements || []) : []
      const dismissed = new Set<string>()
      for (const item of all) {
        try {
          if (uni.getStorageSync(dismissedKey(item.id))) dismissed.add(item.id)
        } catch (_) { /* ignore */ }
      }
      visibleAnnouncements.value = all.filter((item) => !dismissed.has(item.id))
    })
    .catch(() => { /* 静默失败，不打扰用户 */ })
}

function dismiss(id: string) {
  visibleAnnouncements.value = visibleAnnouncements.value.filter((item) => item.id !== id)
  try {
    uni.setStorageSync(dismissedKey(id), true)
  } catch (_) { /* ignore */ }
}

onShow(() => { loadAnnouncements() })
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.announce-stack { display: flex; flex-direction: column; gap: 14rpx; margin: 0 20rpx 20rpx; }
.announce-banner { display: flex; align-items: flex-start; gap: 14rpx; padding: 22rpx 20rpx; background: var(--accent-soft, #FFFBEB); border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-left: 10rpx solid var(--accent, #FFD93D); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); box-sizing: border-box; }
.announce-main { flex: 1; min-width: 0; }
.announce-tag { display: inline-block; padding: 2rpx 12rpx; background: var(--text-main, #111); color: var(--accent, #FFD93D); font-size: $fs-micro; font-weight: $fw-heading; letter-spacing: 4rpx; margin-right: 12rpx; vertical-align: middle; }
.announce-title { display: inline; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); vertical-align: middle; }
.announce-content { display: block; margin-top: 8rpx; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.6; }
.announce-close { flex-shrink: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
</style>
