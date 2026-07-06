<template>
  <view :class="['page', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view class="hero">
      <text class="brand">Crush Master · 命理桃花</text>
      <text class="title">TA 的桃花人格卡</text>
      <text class="subtitle">{{ zodiac }} · {{ sign }} · {{ crossData?.chinese?.name || '中国星次' }}</text>
    </view>

    <view class="poster">
      <view class="seal">
        <text class="seal-text">{{ zodiac.slice(0, 1) || '桃' }}</text>
      </view>

      <view class="persona">
        <text class="kicker">吸引力关键词</text>
        <text class="persona-title">{{ personaTitle }}</text>
        <text class="persona-desc">{{ personaDesc }}</text>
      </view>

      <view class="tag-row">
        <text class="tag black">{{ zodiac }}</text>
        <text class="tag warm">{{ sign }}</text>
        <text class="tag">{{ crossData?.chinese?.zhi || '--' }} · {{ crossData?.chinese?.wuxing || '--' }}</text>
      </view>

      <view class="section">
        <text class="section-title">桃花风格</text>
        <text class="section-text">{{ crossData?.western?.personality || fallbackText }}</text>
      </view>

      <view class="split">
        <view class="mini-card">
          <text class="mini-title">西方星座</text>
          <text class="mini-main">{{ crossData?.western?.planet || '--' }}守护</text>
          <text class="mini-sub">{{ crossData?.western?.element || '--' }}象 · {{ westMode }}</text>
        </view>
        <view class="mini-card">
          <text class="mini-title">中国星次</text>
          <text class="mini-main">{{ crossData?.chinese?.name || '--' }}</text>
          <text class="mini-sub">{{ crossData?.chinese?.character || fallbackText }}</text>
        </view>
      </view>

      <view v-if="bestMatch.length" class="match">
        <text class="match-label">高频适配</text>
        <text v-for="item in bestMatch" :key="item" class="match-pill">{{ item }}</text>
      </view>
    </view>

    <view v-if="!ready" class="cta-card">
      <text class="cta-title">正在登录...</text>
      <text class="cta-copy">请稍候</text>
    </view>
    <view v-else class="cta-card">
      <text class="cta-title">想看你的桃花人格和今日桃花位？</text>
      <text class="cta-copy">先测自己的生肖、星座和互动画像，再生成你的专属人格卡。</text>
      <button class="primary-btn" @click="startMine">我也测一下</button>
      <button class="ghost-btn" @click="goHome">先逛逛</button>
    </view>

    <text class="disclaimer">{{ aiLabel() }} 辅助分析 · 仅供文化娱乐参考</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getCachedSelfProfile, getCurrentUserId, hasUsableSelfProfile } from '@/utils/api'
import { TAOHUA_SHARE_IMAGE, appendReferralParams } from '@/utils/share'
import { captureLandingContext } from '@/utils/landing'
import { SIGN_NAMES, ZODIAC_NAMES, zodiacSignMatch } from '@/utils/taohua'
import { aiLabel } from '@/utils/labels'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'

const zodiac = ref('兔')
const sign = ref('双鱼座')
const ready = ref(false)
const fontSizeMode = ref(getFontSizeMode())
const pageStyle = ref(getThemeStyle())
const fallbackText = '自带吸引力，越真实越容易被看见。'

const crossData = computed<any>(() => {
  try { return zodiacSignMatch(zodiac.value, sign.value) } catch { return null }
})
const personality = computed(() => crossData.value?.western?.personality || fallbackText)
const personaTitle = computed(() => String(personality.value).split('——')[0] || '桃花吸引型')
const personaDesc = computed(() => String(personality.value).split('——')[1] || personality.value)
const westMode = computed(() => String(crossData.value?.western?.mode || '--').split('（')[0])
const bestMatch = computed(() => Array.isArray(crossData.value?.western?.bestMatch) ? crossData.value.western.bestMatch.slice(0, 3) : [])

onLoad(async (options: any) => {
  captureLandingContext(options || {})
  const z = decodeURIComponent(String(options?.zodiac || ''))
  const s = decodeURIComponent(String(options?.sign || ''))
  if (ZODIAC_NAMES.includes(z)) zodiac.value = z
  if (SIGN_NAMES.includes(s)) sign.value = s
  await waitForSilentLogin()
  ready.value = true
})

onShow(() => {
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
  applyThemeChrome()
})

onShareAppMessage(() => {
  let path = `/pages/taohua-share/taohua-share?zodiac=${encodeURIComponent(zodiac.value)}&sign=${encodeURIComponent(sign.value)}&from=reshare`
  path = appendReferralParams(path, 'taohua_card')
  return { title: `${zodiac.value} · ${sign.value} 的桃花人格卡`, path, imageUrl: TAOHUA_SHARE_IMAGE }
})

async function waitForSilentLogin() {
  if (getCurrentUserId()) return
  const maxWait = 3000; const start = Date.now()
  while (Date.now() - start < maxWait) {
    if (getCurrentUserId()) return
    if (uni.getStorageSync('silentLoginDone')) { await new Promise(r => setTimeout(r, 300)); return }
    await new Promise(r => setTimeout(r, 150))
  }
}

function startMine() {
  const target = '/pages/taohua-persona-result/taohua-persona-result'
  if (!getCurrentUserId()) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(target) })
    return
  }
  const profile = getCachedSelfProfile()
  if (hasUsableSelfProfile(profile) && profile?.zodiac && profile?.constellation) {
    uni.navigateTo({ url: target })
    return
  }
  uni.navigateTo({ url: `/pages/self-profile/self-profile?mode=onboarding&redirect=${encodeURIComponent(target)}` })
}

function goHome() {
  if (getCurrentUserId()) { uni.switchTab({ url: '/pages/index/index' }); return }
  uni.navigateTo({ url: '/pages/login/login' })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--taohua-card-bg, linear-gradient(160deg, #fff6e4 0%, #ffe2d8 44%, #fffdf5 100%));
  box-sizing: border-box;
}

.hero {
  padding: 30rpx 10rpx 22rpx;
}

.brand {
  display: inline-block;
  padding: 8rpx 18rpx;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #ffd93d);
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
  box-shadow: 5rpx 5rpx 0 var(--accent-cool, #4ecdc4);
}

.title {
  display: block;
  margin-top: 28rpx;
  color: var(--text-main, #111);
  font-size: $fs-display;
  line-height: $lh-hero;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: var(--relation-good, #0a6f69);
  font-size: $fs-body-lg;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.poster {
  position: relative;
  overflow: hidden;
  padding: 42rpx 34rpx 36rpx;
  background: var(--surface, #fffdf5);
  border: 4rpx solid var(--border, #111);
  box-shadow: var(--shadow-hero, 10rpx 10rpx 0 #111);
}

.poster::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 16rpx;
  background: var(--taohua-bar-gradient, linear-gradient(90deg, #FFD93D 0 28%, #FF6B6B 28% 58%, #4ECDC4 58% 100%));
  pointer-events: none;
}

.seal {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--border, #111);
  background: var(--accent, #FFD93D);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 7rpx 7rpx 0 var(--hero-bg, #FF6B6B);
  transform: rotate(-4deg);
}

.seal-text {
  font-size: $fs-display;
  font-weight: var(--font-weight-hero, $fw-hero);
  color: var(--text-main, #111);
  transform: rotate(4deg);
}

.persona {
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: var(--border-width-strong, 3rpx) solid var(--divider-strong, #111);
}

.kicker,
.section-title,
.mini-title,
.match-label {
  display: block;
  color: var(--primary, #8a3a28);
  font-size: $fs-body;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.persona-title {
  display: block;
  margin-top: 10rpx;
  color: var(--text-main, #111);
  font-size: $fs-hero-title;
  line-height: $lh-hero;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 0;
}

.persona-desc {
  display: block;
  margin-top: 16rpx;
  color: var(--text-muted, #5f5148);
  font-size: $fs-body-lg;
  line-height: $lh-loose;
  font-weight: $fw-label;
}

.tag-row,
.match {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 26rpx;
}

.tag,
.match-pill {
  padding: 10rpx 18rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  font-size: $fs-body;
  font-weight: var(--font-weight-hero, $fw-hero);
  box-shadow: 4rpx 4rpx 0 var(--divider, rgba(17,17,17,0.18));
}

.tag.black {
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #ffd93d);
}

.tag.warm,
.match-pill {
  background: var(--brand-warm, #fff0e5);
  color: var(--primary, #8a3a28);
}

.section {
  margin-top: 34rpx;
  padding: 28rpx;
  background: var(--onboard-primary-bg, #F7FFF7);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: 6rpx 6rpx 0 var(--accent-cool, #4ECDC4);
}

.section-text {
  display: block;
  margin-top: 16rpx;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  line-height: $lh-loose;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 24rpx;
}

.mini-card {
  min-height: 180rpx;
  padding: 24rpx;
  background: var(--brand-warm, #fff4c7);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: 5rpx 5rpx 0 var(--divider, rgba(17,17,17,0.16));
}

.mini-card:nth-child(2) {
  background: var(--brand-cool, #EAF7FF);
}

.mini-main {
  display: block;
  margin-top: 14rpx;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.mini-sub {
  display: block;
  margin-top: 10rpx;
  color: var(--text-muted, #5f5148);
  font-size: $fs-body;
  line-height: 1.45;
  font-weight: $fw-label;
}

.cta-card {
  margin-top: 34rpx;
  padding: 30rpx;
  background: var(--hero-tag-bg, #111);
  color: var(--surface, #fff);
  border: 4rpx solid var(--border, #111);
  box-shadow: 8rpx 8rpx 0 var(--accent-cool, #4ECDC4);
}

.cta-title {
  display: block;
  color: var(--hero-tag-color, #ffd93d);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.cta-copy {
  display: block;
  margin-top: 12rpx;
  color: var(--on-active-muted, rgba(255,255,255,0.78));
  font-size: $fs-body-lg;
  line-height: 1.45;
  font-weight: $fw-label;
}

.primary-btn,
.ghost-btn {
  margin-top: 22rpx;
  width: 100%;
  height: 82rpx;
  line-height: 82rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
}

.primary-btn {
  background: var(--accent, #ffd93d);
  color: var(--text-main, #111);
  box-shadow: 5rpx 5rpx 0 var(--hero-bg, #FF6B6B);
}

.ghost-btn {
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  box-shadow: 5rpx 5rpx 0 var(--accent-cool, #4ECDC4);
}

.disclaimer {
  display: block;
  padding: 30rpx 0 10rpx;
  text-align: center;
  color: var(--text-soft, #8e8177);
  font-size: $fs-caption;
  font-weight: $fw-label;
}

.font-large .brand,
.font-large .kicker,
.font-large .section-title,
.font-large .mini-title,
.font-large .match-label {
  font-size: $fs-body;
}

.font-large .title,
.font-large .seal-text {
  font-size: 56rpx;
}

.font-large .persona-title {
  font-size: 47rpx;
}

.font-large .subtitle,
.font-large .persona-desc,
.font-large .section-text,
.font-large .cta-copy {
  font-size: 38rpx;
}

.font-large .tag,
.font-large .match-pill,
.font-large .mini-sub {
  font-size: 36rpx;
}

.font-large .mini-main,
.font-large .cta-title,
.font-large .primary-btn,
.font-large .ghost-btn {
  font-size: 43rpx;
}
</style>
