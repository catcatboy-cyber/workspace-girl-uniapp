<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="card">正在读取人物...</view>
    <view v-else-if="errorMessage" class="card error">
      <text>{{ errorMessage }}</text>
      <button class="primary" @click="load">重试</button>
    </view>
    <template v-else-if="person">
      <view class="hero">
        <image v-if="person.coverUrl" :src="person.coverUrl" mode="aspectFill" class="avatar" />
        <view v-else class="avatar">{{ person.name.slice(0, 1) }}</view>
        <text class="title">{{ person.name }}</text>
        <text>{{ eraText(person.era) }}人物 · {{ typeLabel }}</text>
      </view>
      <view class="card intro">
        <text class="card-title">人物风格</text>
        <text>{{ introText }}</text>
      </view>
      <view class="card">
        <view v-for="dimension in content.dimensions" :key="dimension.key" class="dimension">
          <view class="dimension-head"><text>{{ dimension.name }}</text><text>{{ person.profile[dimension.key] }}</text></view>
          <text class="dimension-desc">{{ dimension.description }}</text>
          <view class="track"><view class="fill" :style="{ width: person.profile[dimension.key] + '%' }" /></view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getArchetypeQuestionBank } from '@/utils/api'
import { FEATURE_CRUSH_CELEBRITY } from '@/utils/feature-keys'
import { buildCelebritySummary, buildCelebrityTypeLabel } from '@/utils/crush-celebrity-copy'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const personKey = ref('')
const person = ref<any>(null)
const content = ref<any>({ dimensions: [], people: [] })
const loading = ref(true)
const errorMessage = ref('')
const typeLabel = computed(() => buildCelebrityTypeLabel(person.value, content.value.dimensions || []))
const introText = computed(() => buildCelebritySummary(person.value, content.value.dimensions || [], content.value.resultCopy || {}))

function eraText(value: string) { return ({ history: '历史', modern: '近代', contemporary: '当代' } as any)[value] || value }
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await getArchetypeQuestionBank(FEATURE_CRUSH_CELEBRITY)
    if (!result?.success || !result.bank) throw new Error(result?.message || '题库读取失败')
    content.value = result.bank.content
    person.value = (content.value.people || []).find((item: any) => item.key === personKey.value && item.enabled !== false)
    if (!person.value) throw new Error('人物不存在或已下架')
  } catch (error: any) {
    errorMessage.value = error?.message || '读取人物失败'
  } finally {
    loading.value = false
  }
}
onLoad((options: any) => {
  personKey.value = String(options?.personKey || '').trim()
  load()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5);color:var(--text-main, #111)}.hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-hero, 8rpx 8rpx 0 #111)}.hero{text-align:center;background:var(--hero-bg, #FF6B6B)}.avatar{display:flex;align-items:center;justify-content:center;width:160rpx;height:160rpx;margin:auto;border:5rpx solid var(--border, #111);border-radius:50%;background:var(--surface, #fff);font-size:$fs-hero-title;font-weight:var(--font-weight-hero, $fw-hero)}.title{display:block;margin:14rpx;font-size:$fs-hero-title;font-weight:var(--font-weight-hero, $fw-hero)}.card-title{display:block;margin-bottom:14rpx;font-size:$fs-heading;font-weight:var(--font-weight-heading, $fw-heading)}.intro{line-height:1.6;font-size:$fs-body}.dimension{margin-top:18rpx}.dimension-head{display:flex;justify-content:space-between;font-weight:var(--font-weight-heading, $fw-heading)}.dimension-desc{display:block;margin-top:5rpx;color:var(--text-muted, #666);font-size:$fs-micro}.track{height:14rpx;margin-top:8rpx;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-xs, 0);overflow:hidden}.fill{height:100%;background:var(--accent, #FFD93D)}.primary{width:100%;margin-top:20rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);background:var(--accent-cool, #4ECDC4);box-shadow:var(--shadow-hard, 4rpx 4rpx 0 #111);color:var(--text-main, #111);font-size:$fs-body-lg;font-weight:var(--font-weight-heading, $fw-heading)}.error{background:var(--risk-soft, #FFEEEC)}
</style>
