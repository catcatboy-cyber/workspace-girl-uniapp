<template>
  <view :class="['page v2-mode', ready ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view v-if="loading" class="loading-v2">LOADING...</view>

    <template v-else-if="crossData">
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">PERSONA</text>
        <text class="hero-title-v2">我的<text class="hl-v2">桃花人设</text></text>
        <text class="hero-copy-v2">{{ selfZodiac }} · {{ selfSign }} · {{ chinesePersonaLine }}</text>
      </view>

      <view class="persona-card anim-card">
        <view class="persona-head">
          <view class="avatar-stack">
            <view class="avatar-photo" v-if="avatarUrl">
              <image :src="avatarUrl" mode="aspectFill" style="width:100%;height:100%;border-radius:50%;" />
            </view>
            <image v-else class="avatar-icon" :src="getZodiacSvg(selfZodiac)" mode="aspectFit" />
            <view class="avatar sign">{{ getSignEmoji(selfSign) }}</view>
          </view>
          <view class="persona-copy">
            <text class="kicker">吸引力关键词</text>
            <text class="persona-title">{{ personaTitle }}</text>
            <text class="persona-desc">{{ personaDesc }}</text>
          </view>
        </view>

        <view class="identity-strip">
          <view class="identity-item">
            <text class="identity-label">我的生肖</text>
            <text class="identity-value">{{ selfZodiac }}</text>
          </view>
          <view class="identity-item alt">
            <text class="identity-label">我的星座</text>
            <text class="identity-value">{{ selfSign }}</text>
          </view>
        </view>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.12s">
        <text class="section-title-v2">桃花风格</text>
        <text class="body-copy">{{ crossData.western.personality }}</text>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.18s">
        <text class="section-title-v2">中国星次</text>
        <text class="body-copy">{{ crossData.chinese.character }}</text>
        <text class="source-copy">{{ crossData.chinese.name }} · {{ crossData.chinese.zhi }} · {{ crossData.chinese.wuxing }} · {{ crossData.chinese.yinyang }}</text>
      </view>

      <view class="card-v2 anim-card" style="animation-delay:0.24s">
        <text class="section-title-v2">高频适配</text>
        <view class="tag-row">
          <text v-for="item in bestMatch" :key="item" class="tag">{{ item }}</text>
        </view>
        <text class="source-copy">{{ crossData.western.bestMatchReason }}</text>
      </view>

      <view class="actions anim-card" style="animation-delay:0.3s">
        <button class="btn-v2 primary" @click="goRelationHeroine">测测我的{{ relationSelfTitle }}</button>
        <button class="btn-v2 ghost" @click="goCelebrity">我像哪位古今名人？</button>
        <button class="btn-v2 ghost" @click="goDimensionCharacter">我是哪位次元角色？</button>
        <button class="btn-v2 primary" @click="goHome">回到首页</button>
        <button class="btn-v2 ghost" @click="goTaohua">继续看今日桃花</button>
      </view>

      <text class="page-disclaimer">命理桃花 · 仅供文化娱乐参考</text>
    </template>

    <view v-else class="empty-card">
      <text class="empty-title">还不能生成桃花人设</text>
      <text class="empty-copy">{{ errorMessage || '请先补齐你的本人画像。' }}</text>
      <button class="btn-v2 primary" @click="goProfile">补齐本人画像</button>
      <button class="btn-v2 ghost" @click="goHome">先逛逛</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCachedSelfProfile, getCurrentUserId, getSelfProfile } from '@/utils/api'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { SIGN_NAMES, ZODIAC_NAMES, zodiacSignMatch, type CrossMatchResult } from '@/utils/taohua'
import { getZodiacSvg } from '@/utils/zodiac-icons'
import { aiLabel } from '@/utils/labels'

const ready = ref(false)
const loading = ref(true)
const errorMessage = ref('')
const selfZodiac = ref('')
const selfSign = ref('')
const avatarUrl = ref('')
const selfGender = ref('')
const fontSizeMode = ref(getFontSizeMode())
const pageStyle = ref(getThemeStyle())
const relationSelfTitle = computed(() => selfGender.value === 'male' ? '关系男主角' : selfGender.value === 'female' ? '关系女主角' : '关系主角')

const crossData = computed<CrossMatchResult | null>(() => {
  try {
    if (!selfZodiac.value || !selfSign.value) return null
    return zodiacSignMatch(selfZodiac.value, selfSign.value)
  } catch {
    return null
  }
})
const personaParts = computed(() => {
  const personality = String(crossData.value?.western?.personality || '桃花吸引型——越真实越容易被看见')
  const parts = personality.split('——').map(item => item.trim()).filter(Boolean)
  if (parts.length >= 2) return { title: parts[0], desc: parts.slice(1).join('——') }
  return { title: personality || '桃花吸引型', desc: '越真实越容易被看见，适合用自然互动慢慢升温。' }
})
const personaTitle = computed(() => personaParts.value.title)
const personaDesc = computed(() => personaParts.value.desc)
const chinesePersonaLine = computed(() => {
  const c = crossData.value?.chinese
  if (!c) return ''
  return `${c.name || ''} · ${c.zhi || ''} · ${c.wuxing || ''} · ${c.yinyang || ''}`.replace(/\s*·\s*$/g, '')
})
const bestMatch = computed(() => Array.isArray(crossData.value?.western?.bestMatch) ? crossData.value!.western.bestMatch.slice(0, 4) : [])

onLoad(async () => {
  await loadProfile()
})

onShow(() => {
  applyThemeChrome()
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
})

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''
  try {
    const uid = getCurrentUserId()
    if (!uid) {
      errorMessage.value = '请先完成登录。'
      return
    }
    let profile = getCachedSelfProfile()
    if (!profile?.zodiac || !profile?.constellation) {
      const profileRes = await getSelfProfile().catch(() => null)
      profile = profileRes?.selfProfile || getCachedSelfProfile()
    }
    avatarUrl.value = profile?.avatarUrl || ''
    selfGender.value = String(profile?.gender || '')
    const zodiac = normalizeOption(profile?.zodiac, ZODIAC_NAMES)
    const sign = normalizeOption(profile?.constellation, SIGN_NAMES)
    if (!zodiac || !sign) {
      errorMessage.value = '请先补齐你的生肖和星座。'
      return
    }
    selfZodiac.value = zodiac
    selfSign.value = sign
  } catch (error: any) {
    errorMessage.value = error?.message || '桃花人设生成失败。'
  } finally {
    loading.value = false
    ready.value = true
  }
}

function normalizeOption(value: any, options: string[]) {
  const source = String(value || '').trim()
  return options.includes(source) ? source : ''
}

// migrated to getZodiacSvg

function getSignEmoji(sign = '') {
  const map: Record<string, string> = {
    '白羊座': '♈', '金牛座': '♉', '双子座': '♊', '巨蟹座': '♋',
    '狮子座': '♌', '处女座': '♍', '天秤座': '♎', '天蝎座': '♏',
    '射手座': '♐', '摩羯座': '♑', '水瓶座': '♒', '双鱼座': '♓',
  }
  return map[sign] || '✦'
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goTaohua() {
  uni.navigateTo({ url: '/pages/taohua/taohua?from=persona_result' })
}

function goRelationHeroine() {
  uni.navigateTo({ url: '/pages/relation-heroine/relation-heroine?mode=self' })
}

function goCelebrity() {
  uni.navigateTo({ url: '/pages/crush-celebrity/crush-celebrity?mode=self' })
}

function goDimensionCharacter() {
  uni.navigateTo({ url: '/pages/dimension-character/dimension-character?mode=self' })
}

function goProfile() {
  const redirect = encodeURIComponent('/pages/taohua-persona-result/taohua-persona-result')
  uni.navigateTo({ url: `/pages/self-profile/self-profile?mode=onboarding&redirect=${redirect}` })
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
.persona-card,
.empty-card {
  @include card-v2;
  margin-bottom: 20rpx;
}
.section-title-v2 { @include section-title-v2; }
.persona-card {
  background: var(--surface, #fff);
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
}
.persona-head {
  display: flex;
  gap: 18rpx;
  align-items: center;
}
.avatar-stack {
  width: 126rpx;
  flex-shrink: 0;
  position: relative;
}
.avatar-icon { width: 64rpx; height: 64rpx; } .avatar-photo { width: 64rpx; height: 64rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: 50%; overflow: hidden; } .avatar {
  width: 88rpx;
  height: 88rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: 50%;
  background: var(--accent, #FFD93D);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  box-shadow: 5rpx 5rpx 0 var(--border, #111);
}
.avatar.sign {
  position: absolute;
  right: 0;
  bottom: -26rpx;
  width: 62rpx;
  height: 62rpx;
  background: var(--accent-cool, #4ECDC4);
  font-size: 32rpx;
  box-shadow: 4rpx 4rpx 0 var(--border, #111);
}
.persona-copy {
  flex: 1;
  min-width: 0;
}
.kicker {
  display: block;
  color: var(--text-muted, #666);
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.persona-title {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 1.2;
}
.persona-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #555);
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  line-height: 1.45;
}
.identity-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 42rpx;
}
.identity-item {
  padding: 14rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--brand-warm, #FFFBEA);
}
.identity-item.alt {
  background: var(--brand-cool, #EAF7FF);
}
.identity-label {
  display: block;
  color: var(--text-muted, #666);
  font-size: $fs-caption;
  font-weight: $fw-label;
}
.identity-value {
  display: block;
  margin-top: 6rpx;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.body-copy {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  line-height: 1.65;
}
.source-copy {
  display: block;
  margin-top: 12rpx;
  color: var(--text-muted, #666);
  font-size: $fs-body;
  font-weight: $fw-label;
  line-height: 1.45;
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
  box-shadow: 3rpx 3rpx 0 var(--accent-cool, #4ECDC4);
  font-size: $fs-body;
  font-weight: $fw-label;
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
