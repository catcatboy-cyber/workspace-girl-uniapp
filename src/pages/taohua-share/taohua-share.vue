<template>
  <view class="page">
    <view class="hero">
      <text class="brand">Dom-Crush · 命理桃花</text>
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

    <view class="cta-card">
      <text class="cta-title">想看你的桃花人格和今日桃花位？</text>
      <text class="cta-copy">先测自己的生肖、星座和互动画像，再生成你的专属人格卡。</text>
      <button class="primary-btn" @click="startMine">我也测一下</button>
      <button class="ghost-btn" @click="goHome">先逛逛</button>
    </view>

    <text class="disclaimer">AI 辅助分析 · 仅供文化娱乐参考</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getCurrentUserId } from '@/utils/api'
import { SIGN_NAMES, ZODIAC_NAMES, zodiacSignMatch } from '@/utils/taohua'

const zodiac = ref('兔')
const sign = ref('双鱼座')
const fallbackText = '自带吸引力，越真实越容易被看见。'

const crossData = computed<any>(() => {
  try {
    return zodiacSignMatch(zodiac.value, sign.value)
  } catch {
    return null
  }
})

const personality = computed(() => crossData.value?.western?.personality || fallbackText)
const personaTitle = computed(() => String(personality.value).split('——')[0] || '桃花吸引型')
const personaDesc = computed(() => String(personality.value).split('——')[1] || personality.value)
const westMode = computed(() => String(crossData.value?.western?.mode || '--').split('（')[0])
const bestMatch = computed(() => Array.isArray(crossData.value?.western?.bestMatch) ? crossData.value.western.bestMatch.slice(0, 3) : [])

onLoad((options: any) => {
  const z = decodeURIComponent(String(options?.zodiac || ''))
  const s = decodeURIComponent(String(options?.sign || ''))
  if (ZODIAC_NAMES.includes(z)) zodiac.value = z
  if (SIGN_NAMES.includes(s)) sign.value = s
})

onShareAppMessage(() => ({
  title: `${zodiac.value} · ${sign.value} 的桃花人格卡`,
  path: `/pages/taohua-share/taohua-share?zodiac=${encodeURIComponent(zodiac.value)}&sign=${encodeURIComponent(sign.value)}&from=reshare`,
}))

function startMine() {
  const redirect = encodeURIComponent('/pages/taohua/taohua')
  if (getCurrentUserId()) {
    uni.navigateTo({ url: '/pages/self-profile/self-profile?redirect=/pages/taohua/taohua' })
    return
  }
  uni.navigateTo({ url: `/pages/login/login?redirect=${redirect}` })
}

function goHome() {
  if (getCurrentUserId()) {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  uni.navigateTo({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(160deg, #fff6e4 0%, #ffe2d8 46%, #fffdf5 100%);
  box-sizing: border-box;
}

.hero {
  padding: 26rpx 10rpx 20rpx;
}

.brand {
  display: inline-block;
  padding: 8rpx 18rpx;
  background: #111;
  color: #ffd93d;
  font-size: 20rpx;
  font-weight: 900;
  box-shadow: 4rpx 4rpx 0 #c84a3d;
}

.title {
  display: block;
  margin-top: 28rpx;
  color: #111;
  font-size: 56rpx;
  line-height: 1.1;
  font-weight: 900;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: #7f2b1d;
  font-size: 26rpx;
  font-weight: 800;
}

.poster {
  position: relative;
  padding: 38rpx 34rpx;
  background: #fff;
  border: 4rpx solid #111;
  box-shadow: 10rpx 10rpx 0 #111;
}

.poster::after {
  content: '';
  position: absolute;
  right: 28rpx;
  top: 28rpx;
  width: 160rpx;
  height: 160rpx;
  border: 3rpx solid rgba(127, 43, 29, 0.2);
  border-radius: 50%;
  pointer-events: none;
}

.seal {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  border: 5rpx solid #111;
  background: linear-gradient(135deg, #ffd93d, #ff8e7d);
  display: flex;
  align-items: center;
  justify-content: center;
}

.seal-text {
  font-size: 58rpx;
  font-weight: 900;
  color: #111;
}

.persona {
  margin-top: 30rpx;
}

.kicker,
.section-title,
.mini-title,
.match-label {
  display: block;
  color: #8a3a28;
  font-size: 22rpx;
  font-weight: 900;
}

.persona-title {
  display: block;
  margin-top: 10rpx;
  color: #111;
  font-size: 48rpx;
  line-height: 1.15;
  font-weight: 900;
}

.persona-desc {
  display: block;
  margin-top: 16rpx;
  color: #5f5148;
  font-size: 27rpx;
  line-height: 1.55;
  font-weight: 700;
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
  border: 3rpx solid #111;
  background: #f5f0e8;
  color: #111;
  font-size: 22rpx;
  font-weight: 900;
}

.tag.black {
  background: #111;
  color: #ffd93d;
}

.tag.warm,
.match-pill {
  background: #fff0e5;
  color: #8a3a28;
}

.section {
  margin-top: 34rpx;
  padding: 28rpx;
  background: #ffe7e1;
  border: 3rpx solid #111;
}

.section-text {
  display: block;
  margin-top: 16rpx;
  color: #111;
  font-size: 27rpx;
  line-height: 1.55;
  font-weight: 800;
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
  background: #fff4c7;
  border: 3rpx solid #111;
}

.mini-card:nth-child(2) {
  background: #f2f0ea;
}

.mini-main {
  display: block;
  margin-top: 14rpx;
  color: #111;
  font-size: 28rpx;
  font-weight: 900;
}

.mini-sub {
  display: block;
  margin-top: 10rpx;
  color: #5f5148;
  font-size: 21rpx;
  line-height: 1.45;
  font-weight: 700;
}

.cta-card {
  margin-top: 34rpx;
  padding: 30rpx;
  background: #111;
  color: #fff;
  border: 4rpx solid #111;
  box-shadow: 8rpx 8rpx 0 #c84a3d;
}

.cta-title {
  display: block;
  color: #ffd93d;
  font-size: 32rpx;
  font-weight: 900;
}

.cta-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255,255,255,0.78);
  font-size: 24rpx;
  line-height: 1.45;
  font-weight: 700;
}

.primary-btn,
.ghost-btn {
  margin-top: 22rpx;
  width: 100%;
  height: 82rpx;
  line-height: 82rpx;
  border: 3rpx solid #111;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-btn {
  background: #ffd93d;
  color: #111;
}

.ghost-btn {
  background: #fff;
  color: #111;
}

.disclaimer {
  display: block;
  padding: 30rpx 0 10rpx;
  text-align: center;
  color: #8e8177;
  font-size: 20rpx;
  font-weight: 700;
}
</style>
