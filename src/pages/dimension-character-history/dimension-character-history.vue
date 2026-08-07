<template>
  <view class="page" :style="themeVars">
    <view class="hero"><text class="eyebrow">CHARACTER HISTORY</text><text class="title">次元角色记录</text><text class="subtitle">每次测试都保留相似度与被测对象快照</text></view>
    <view v-if="loading" class="card">正在读取记录...</view>
    <view v-else-if="errorMessage" class="card error">{{ errorMessage }}</view>
    <view v-else-if="!results.length" class="card">还没有次元角色测试记录。</view>
    <view v-else class="card">
      <view v-for="item in results" :key="item.resultId" class="history-row" @click="openResult(item.resultId)">
        <view><text class="row-title">{{ subjectName(item) }} · {{ item.primary?.name || '角色原型' }}</text><text class="row-meta">{{ formatDate(item.createdAt) }} · 主要相似度 {{ item.similarityBand?.label || '-' }}</text></view>
        <text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getArchetypeResults } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const results = ref<any[]>([])
function formatDate(value: any) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}` : '刚刚' }
function subjectName(item: any) { return item.mode !== 'target' ? '我自己' : item.entryMode === 'share_quick' ? 'TA（快速测试）' : item.caseSnapshot?.name || '当前 Crush' }
function openResult(id: string) { uni.navigateTo({ url: `/pages/dimension-character-result/dimension-character-result?id=${encodeURIComponent(id)}` }) }
async function load() { try { const response = await getArchetypeResults({ kind: 'dimension_character', limit: 50 }); if (!response?.success) throw new Error(response?.message || '读取记录失败'); results.value = response.results || [] } catch (error: any) { errorMessage.value = error?.message || '读取记录失败' } finally { loading.value = false } }
onLoad(load)
onShow(() => { themeVars.value = getThemeStyle(); applyThemeChrome() })
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg,#FFFDF5);color:var(--text-main,#111)}.hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);background:var(--surface,#fff);box-shadow:var(--shadow-hero,8rpx 8rpx 0 #111)}.hero{background:var(--hero-bg,#FF6B6B)}.eyebrow{display:block;font-size:$fs-micro;letter-spacing:3rpx;font-weight:$fw-label}.title{display:block;font-size:$fs-hero-title;font-weight:$fw-hero}.subtitle{display:block;margin-top:8rpx}.history-row{display:flex;justify-content:space-between;align-items:center;padding:20rpx 0;border-bottom:2rpx dashed var(--divider,#aaa)}.row-title,.row-meta{display:block}.row-title{font-weight:$fw-heading}.row-meta{margin-top:6rpx;color:var(--text-muted,#666);font-size:$fs-micro}.arrow{font-size:44rpx}.error{background:var(--risk-soft,#FFEEEC)}
</style>
