<template>
  <view class="page" :style="themeVars">
    <view class="hero"><text class="title">关系主角测试记录</text><text>男主角、女主角，以及测自己和测 TA 都会标明</text></view>
    <view class="filters"><button :class="{ active: filter === 'all' }" @click="filter='all'">全部</button><button :class="{ active: filter === 'self' }" @click="filter='self'">测自己</button><button :class="{ active: filter === 'target' }" @click="filter='target'">测 TA</button></view>
    <view v-if="loading" class="empty">读取中...</view>
    <view v-else-if="!filtered.length" class="empty">还没有测试记录</view>
    <view v-for="item in filtered" :key="item.resultId" class="record" @click="openResult(item.resultId)">
      <view><text class="name">{{ personName(item) }}</text><text class="meta">{{ item.subjectGender === 'male' ? '关系男主角' : '关系女主角' }} · {{ subjectName(item) }} · {{ formatDate(item.createdAt) }}</text></view>
      <text class="score">{{ item.similarityBand?.label || '-' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getArchetypeResults } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const filter = ref('all')
const results = ref<any[]>([])
const filtered = computed(() => filter.value === 'all' ? results.value : results.value.filter((item) => item.mode === filter.value))
function personName(item: any) { return item.primary?.name || item.primary?.key || '关系主角' }
function subjectName(item: any) { return item.mode !== 'target' ? '测自己' : item.entryMode === 'share_quick' ? 'TA（快速测试）' : item.caseSnapshot?.name || '当前 Crush' }
function formatDate(value: any) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function openResult(id: string) { uni.navigateTo({ url: `/pages/relation-heroine-result/relation-heroine-result?id=${id}` }) }
async function load() { loading.value=true; const [female, male] = await Promise.all([getArchetypeResults({kind:'relation_archetype',subjectGender:'female',limit:50}),getArchetypeResults({kind:'relation_archetype',subjectGender:'male',limit:50})]); results.value=[...(female?.results||[]),...(male?.results||[])].sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,50); loading.value=false }
onShow(() => { themeVars.value = getThemeStyle(); applyThemeChrome(); load() })
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5)}.hero,.record,.empty{padding:28rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-card, 6rpx 6rpx 0 #111)}.hero{background:var(--hero-bg, #FF6B6B)}.title{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero, $fw-hero)}.filters{display:flex;gap:14rpx;margin:24rpx 0}.filters button{border:var(--border-width-strong, 3rpx) solid var(--border, #111);background:var(--surface, #fff);font-size:$fs-caption;font-weight:$fw-label}.filters button.active{background:var(--accent, #FFD93D)}.record{display:flex;justify-content:space-between;align-items:center;margin-bottom:20rpx}.name{display:block;font-size:$fs-body;font-weight:var(--font-weight-heading, $fw-heading)}.meta{display:block;margin-top:6rpx;color:var(--text-soft, #999);font-size:$fs-micro}.score{font-size:$fs-kpi;font-weight:var(--font-weight-hero, $fw-hero)}.empty{text-align:center;font-size:$fs-body;color:var(--text-muted, #666)}
</style>
