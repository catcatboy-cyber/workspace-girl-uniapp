<template>
  <view :class="['page v2-mode', ready ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view v-if="loading" class="loading-v2">LOADING...</view>

    <template v-else-if="payload">
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">PAIR MATCH</text>
        <text class="hero-title-v2">我和 <text class="hl-v2">{{ partnerLabel }}</text></text>
        <text class="hero-copy-v2">{{ payload.self.zodiac }} · {{ payload.self.sign }} × {{ payload.partner.zodiac }} · {{ payload.partner.sign }}</text>
      </view>

      <view class="result-card anim-card">
        <view class="pair-grid">
          <view class="party">
            <text class="role">我</text>
            <image class="symbol-icon" :src="getZodiacSvg(payload.self.zodiac)" mode="aspectFit" />
            <text class="token">{{ payload.self.zodiac }}</text>
            <text class="token sign">{{ payload.self.sign }}</text>
          </view>

          <view class="match-core">
            <text class="kicker">匹配</text>
            <text :class="['relation', toneClass]">{{ payload.match.relation }}</text>
            <text :class="['relation sign', signToneClass]">{{ payload.match.signRelation || '星座节奏平衡' }}</text>
          </view>

          <view class="party">
            <text class="role">{{ partnerLabel }}</text>
            <image class="symbol-icon" :src="getZodiacSvg(payload.partner.zodiac)" mode="aspectFit" />
            <text class="token">{{ payload.partner.zodiac }}</text>
            <text class="token sign">{{ payload.partner.sign }}</text>
          </view>
        </view>

        <view class="summary-block">
          <text class="summary-title">一句话结论</text>
          <text class="summary-copy">{{ payload.match.combinedRelationDesc }}</text>
        </view>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.12s">
        <text class="section-title-v2">适合一起</text>
        <view class="tag-row">
          <text v-for="item in payload.insight.activities.slice(0, 4)" :key="item" class="tag good">{{ item }}</text>
        </view>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.18s">
        <text class="section-title-v2">需要注意</text>
        <view class="line-list">
          <text v-for="item in payload.insight.watchOut.slice(0, 3)" :key="item" class="line">{{ item }}</text>
        </view>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.24s">
        <text class="section-title-v2">{{ partnerLabel }} 的桃花风格</text>
        <text class="style-copy">{{ payload.partnerStyle || '节奏自然，适合继续观察真实行动。' }}</text>
      </view>

      <view class="actions anim-card" style="animation-delay:0.3s">
        <button class="btn-v2 primary" @click="goHome">回到首页</button>
        <button class="btn-v2 ghost" @click="goTaohua">继续看今日桃花</button>
      </view>

      <text class="page-disclaimer">命理桃花 · 仅供文化娱乐参考</text>
    </template>

    <view v-else class="empty-card">
      <text class="empty-title">暂时看不了匹配度</text>
      <text class="empty-copy">{{ errorMessage || '双方生肖和星座还不完整。' }}</text>
      <button class="btn-v2 primary" @click="goHome">回到首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCachedSelfProfile, getCaseDetail, getCurrentUserId, getSelfProfile } from '@/utils/api'
import { SIGN_NAMES, ZODIAC_NAMES, buildPairMatchPayload, type PairMatchPayload } from '@/utils/taohua'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { getZodiacSvg } from '@/utils/zodiac-icons'
import { aiLabel } from '@/utils/labels'

const ready = ref(false)
const loading = ref(true)
const caseId = ref('')
const partnerLabel = ref('TA')
const payload = ref<PairMatchPayload | null>(null)
const errorMessage = ref('')
const fontSizeMode = ref(getFontSizeMode())
const pageStyle = ref(getThemeStyle())

const toneClass = computed(() => relationTone(payload.value?.match?.relation || ''))
const signToneClass = computed(() => relationTone(payload.value?.match?.signRelation || ''))

onLoad(async (options: any) => {
  caseId.value = String(options?.caseId || '').trim()
  await loadResult()
})

onShow(() => {
  applyThemeChrome()
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
})

async function loadResult() {
  loading.value = true
  errorMessage.value = ''
  try {
    const uid = getCurrentUserId()
    if (!uid) {
      errorMessage.value = '请先完成登录。'
      return
    }
    if (!caseId.value) {
      errorMessage.value = '没有找到 TA 档案。'
      return
    }

    const detail = await getCaseDetail(uid, caseId.value)
    const profile = detail?.profile || {}
    partnerLabel.value = String(detail?.name || 'TA').trim() || 'TA'

    let self = getCachedSelfProfile()
    if (!self?.zodiac || !self?.constellation) {
      const profileRes = await getSelfProfile().catch(() => null)
      self = profileRes?.selfProfile || getCachedSelfProfile()
    }

    const selfZodiac = normalizeOption(self?.zodiac, ZODIAC_NAMES)
    const selfSign = normalizeOption(self?.constellation, SIGN_NAMES)
    const taZodiac = normalizeOption(profile?.zodiac, ZODIAC_NAMES)
    const taSign = normalizeOption(profile?.constellation, SIGN_NAMES)
    if (!selfZodiac || !selfSign || !taZodiac || !taSign) {
      errorMessage.value = '双方生肖和星座还不完整。'
      return
    }
    payload.value = buildPairMatchPayload(selfZodiac, selfSign, taZodiac, taSign)
  } catch (error: any) {
    errorMessage.value = error?.message || '匹配结果生成失败。'
  } finally {
    loading.value = false
    ready.value = true
  }
}

function normalizeOption(value: any, options: string[]) {
  const source = String(value || '').trim()
  return options.includes(source) ? source : ''
}

function relationTone(relation = '') {
  if (relation.includes('六合') || relation.includes('同频') || relation.includes('助燃') || relation.includes('滋养')) return 'good'
  if (relation.includes('三合') || relation.includes('同宫') || relation.includes('平衡')) return 'mid'
  if (relation.includes('冲') || relation.includes('差') || relation.includes('磨合') || relation.includes('校准')) return 'bad'
  return 'neutral'
}

// migrated to getZodiacSvg

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goTaohua() {
  const url = caseId.value
    ? `/pages/taohua/taohua?caseId=${encodeURIComponent(caseId.value)}&from=pair_result`
    : '/pages/taohua/taohua'
  uni.navigateTo({ url })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page {
  min-height: 100vh;
  padding: 22rpx;
  background: var(--app-bg, #FFFDF5);
  box-sizing: border-box;
}
.hero-block-v2 { @include hero-block-v2; margin-bottom: 20rpx; }
.hero-tag-v2 {
  display: inline-block;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  padding: 6rpx 16rpx;
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.hero-title-v2 {
  display: block;
  color: var(--hero-text-color, #111);
  font-size: $fs-hero-title;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 1.12;
}
.hl-v2 { display: inline-block; padding: 0 8rpx; background: var(--accent, #FFD93D); }
.hero-copy-v2 {
  display: block;
  margin-top: 14rpx;
  color: var(--text-muted, rgba(0,0,0,0.68));
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  line-height: 1.5;
}
.card-v2,
.result-card,
.empty-card {
  @include card-v2;
  margin-bottom: 20rpx;
}
.section-title-v2 { @include section-title-v2; }
.result-card {
  background: var(--surface, #fff);
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
}
.pair-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 176rpx minmax(0, 1fr);
  gap: 12rpx;
  align-items: stretch;
}
.party {
  min-width: 0;
  padding: 16rpx 12rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--app-bg, #FFFDF5);
  text-align: center;
}
.role {
  display: block;
  color: var(--text-muted, #666);
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.symbol-icon { width: 48rpx; height: 48rpx; } .symbol {
  display: block;
  margin-top: 8rpx;
  font-size: 52rpx;
  line-height: 1;
}
.token {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 1.25;
}
.token.sign {
  color: var(--relation-good, #0a6f69);
  font-size: $fs-body;
}
.match-core {
  min-width: 0;
  padding: 14rpx 10rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--hero-tag-bg, #111);
  text-align: center;
}
.kicker {
  display: block;
  color: var(--hero-tag-color, #FFD93D);
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.relation {
  display: block;
  margin-top: 8rpx;
  color: var(--surface, #fff);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 1.2;
}
.relation.sign {
  font-size: $fs-body;
}
.relation.good { color: var(--relation-good, #4ECDC4); }
.relation.mid { color: var(--relation-mid, #FFD93D); }
.relation.bad { color: var(--relation-bad, #FF6B6B); }
.summary-block {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: var(--border-width-strong, 3rpx) solid var(--divider-strong, #111);
}
.summary-title {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-body;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.summary-copy {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  line-height: 1.65;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}
.tag {
  padding: 10rpx 14rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  font-size: $fs-body;
  font-weight: $fw-label;
}
.tag.good {
  background: var(--onboard-primary-bg, #F7FFF7);
  box-shadow: 3rpx 3rpx 0 var(--accent-cool, #4ECDC4);
}
.line-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.line {
  display: block;
  padding: 14rpx 16rpx;
  border-left: 6rpx solid var(--hero-bg, #FF6B6B);
  background: var(--brand-warm, #FFFBEB);
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  line-height: 1.5;
}
.style-copy {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  line-height: 1.65;
}
.actions {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}
.btn-v2 {
  flex: 1;
  height: 88rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: 0;
  font-size: $fs-body-lg;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 82rpx;
}
.btn-v2.primary {
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  box-shadow: 6rpx 6rpx 0 var(--hero-bg, #FF6B6B);
}
.btn-v2.ghost {
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  box-shadow: 6rpx 6rpx 0 var(--accent-cool, #4ECDC4);
}
.empty-title {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.empty-copy {
  display: block;
  margin: 12rpx 0 24rpx;
  color: var(--text-muted, #666);
  font-size: $fs-body-lg;
  line-height: 1.5;
}
.loading-v2 {
  padding: 140rpx 0;
  text-align: center;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 4rpx;
}
.page-disclaimer {
  display: block;
  padding: 30rpx 0 12rpx;
  color: var(--text-soft, #aaa);
  text-align: center;
  font-size: $fs-caption;
  font-weight: $fw-label;
}
</style>
