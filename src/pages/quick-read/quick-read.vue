<template>
  <view :class="['page v2-mode', fontMode === 'large' ? 'font-large' : '', ready ? 'anim-ready' : '']">
    <view v-if="!ready" class="loading-v2">LOADING...</view>

    <template v-else>
      <!-- ====== Snapshot from A ====== -->
      <template v-if="hasSnapshot">
        <!-- Hero -->
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">SIGNAL REPORT</text>
          <text class="hero-title-v2">{{ title }}</text>
          <text class="hero-copy-v2">一位朋友的真实分析 · 小咪辅助分析</text>
        </view>

        <!-- KPI Row -->
        <view class="card-v2 anim-card" style="animation-delay:0.1s">
          <view class="qr-kpi-row">
            <view class="qr-kpi-item">
              <text class="qr-kpi-num" :style="{ color: intentNum >= 60 ? '#4ECDC4' : intentNum >= 40 ? '#FFD93D' : '#999' }">{{ intentNum }}</text>
              <text class="qr-kpi-lbl">意向指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: intentNum + '%', background: intentNum >= 60 ? '#4ECDC4' : intentNum >= 40 ? '#FFD93D' : '#ccc' }"></view></view>
            </view>
            <view class="qr-kpi-split"></view>
            <view class="qr-kpi-item">
              <text class="qr-kpi-num" :style="{ color: riskNum >= 60 ? '#FF5252' : riskNum >= 35 ? '#FFD93D' : '#4ECDC4' }">{{ riskNum }}</text>
              <text class="qr-kpi-lbl">风险指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: riskNum + '%', background: riskNum >= 60 ? '#FF5252' : riskNum >= 35 ? '#FFD93D' : '#4ECDC4' }"></view></view>
            </view>
          </view>
        </view>

        <!-- Signal Tag -->
        <view v-if="signal" class="card-v2 anim-card" style="animation-delay:0.15s;padding:20rpx 28rpx;">
          <view class="tag-row-v2">
            <text class="tag-v2 black">{{ signal }}</text>
          </view>
        </view>

        <!-- Reason Bullets -->
        <view v-if="bullets.length > 0" class="card-v2 anim-card" style="animation-delay:0.2s">
          <text class="section-title-v2">分析依据</text>
          <view v-for="b in bullets" :key="b" class="qr-bullet"><view class="qr-bullet-dot"></view><text>{{ b }}</text></view>
        </view>

        <!-- Action Plan -->
        <view v-if="actionText" class="card-v2 anim-card" style="animation-delay:0.23s;background:#FFFBEB;">
          <text class="section-title-v2">小咪帮你看看</text>
          <text class="qr-action-text">{{ actionText }}</text>
        </view>

        <text class="page-hint anim-card" style="animation-delay:0.26s">以上是朋友的匿名分析快照 · 不含隐私信息</text>
      </template>

      <!-- ====== Organic entry ====== -->
      <template v-else>
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">SIGNAL REPORT</text>
          <text class="hero-title-v2">别猜了，让小咪帮你看清关系信号</text>
          <text class="hero-copy-v2">记录你和 TA 的真实互动，小咪帮你分析意向和风险</text>
        </view>
      </template>

      <!-- Not logged in -->
      <view v-if="ready && !loggedIn" class="cta-card anim-card" style="animation-delay:0.3s">
        <text class="cta-title">需要微信授权</text>
        <text class="cta-desc">请点击下方按钮完成登录后继续。</text>
        <button class="btn btn-primary btn-lg btn-full" @click="retryLogin">重新登录</button>
      </view>

      <!-- CTA -->
      <view v-else-if="loggedIn" class="cta-card anim-card" style="animation-delay:0.3s">
        <text class="cta-title">想知道你的 TA 是什么信号？</text>
        <text class="cta-desc">记录第一条事件，小咪就会帮你分析你和 TA 的关系走向。</text>
        <button class="btn btn-primary btn-lg btn-full" @click="onCTA">{{ ctaLoading ? '进入中...' : '开始追踪 →' }}</button>
      </view>

      <text class="page-disclaimer">小咪辅助分析 · 仅供参考，不构成专业意见</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCurrentUserId, getOrCreateDefaultCase, getCachedSelfProfile, hasUsableSelfProfile, wechatLogin } from '@/utils/api'
import { captureLandingContext, readLandingContext } from '@/utils/landing'

const fontMode = ref(uni.getStorageSync('fontSizeMode') || '')
const ready = ref(false)
const loggedIn = ref(false)
const ctaLoading = ref(false)

const title = ref('别猜了，让小咪帮你看清关系信号')
const intentNum = ref(50)
const riskNum = ref(35)
const signal = ref('')
const bullets = ref<string[]>([])
const actionText = ref('')
const hasSnapshot = ref(false)

onLoad(async (options: any) => {
  captureLandingContext(options || {})

  const t = decodeURIComponent(String(options?.title || ''))
  const i = Number(options?.intent)
  const r = Number(options?.risk)
  if (t || !isNaN(i)) {
    hasSnapshot.value = true
    if (t) title.value = t
    if (!isNaN(i)) intentNum.value = Math.max(0, Math.min(100, i))
    if (!isNaN(r)) riskNum.value = Math.max(0, Math.min(100, r))
  }

  signal.value = decodeURIComponent(String(options?.signal || ''))
  const rawBullets = decodeURIComponent(String(options?.bullets || ''))
  bullets.value = rawBullets ? rawBullets.split('|').filter(Boolean).slice(0, 3) : []
  actionText.value = decodeURIComponent(String(options?.action || ''))

  await waitForSilentLogin()
  loggedIn.value = !!getCurrentUserId()
  ready.value = true
})

async function waitForSilentLogin() {
  const start = Date.now()
  while (Date.now() - start < 3000) {
    const uid = getCurrentUserId()
    if (uid) { console.log('[quick-read] login ok, userId:', uid.slice(0, 20)); return }
    if (uni.getStorageSync('silentLoginDone')) { await new Promise(r => setTimeout(r, 300)); return }
    await new Promise(r => setTimeout(r, 150))
  }
  console.warn('[quick-read] login timeout after 3s')
}

async function retryLogin() {
  try {
    const wxApi = (globalThis as any)?.wx
    if (!wxApi?.login) { uni.navigateTo({ url: '/pages/login/login' }); return }
    const loginCode = await new Promise<string>(resolve => {
      wxApi.login({ success(res: any) { resolve(res?.code || '') }, fail() { resolve('') } })
    })
    if (!loginCode) { uni.navigateTo({ url: '/pages/login/login' }); return }
    const ctx = readLandingContext()
    const result = await wechatLogin('', { loginCode, channel: ctx.channel, scene: ctx.scene, ref: ctx.ref, shareId: ctx.shareId })
    if (result?.success) { loggedIn.value = true; return }
  } catch {}
  uni.navigateTo({ url: '/pages/login/login' })
}

async function onCTA() {
  ctaLoading.value = true
  try {
    const cached = getCachedSelfProfile()
    if (!hasUsableSelfProfile(cached)) {
      uni.navigateTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
      return
    }
    await getOrCreateDefaultCase()
    uni.switchTab({ url: '/pages/index/index' })
  } catch {
    uni.switchTab({ url: '/pages/index/index' })
  } finally {
    ctaLoading.value = false
  }
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: $lh-hero; letter-spacing: -2rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; margin-bottom: $sp-card-gap; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .tag-row-v2 { @include tag-row-v2; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { @include tag-v2-black; }

// KPI
.qr-kpi-row { display: flex; align-items: center; padding: 8rpx 0; }
.qr-kpi-item { flex: 1; text-align: center; }
.qr-kpi-num { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; line-height: 1; }
.qr-kpi-lbl { display: block; font-size: $fs-body; font-weight: $fw-label; color: #666; margin-top: 6rpx; }
.qr-kpi-bar { height: 10rpx; background: #f0f0f0; border: 1rpx solid #ddd; margin-top: 10rpx; }
.qr-kpi-fill { height: 100%; transition: width 0.5s ease; }
.qr-kpi-split { width: 2rpx; height: 72rpx; background: #111; opacity: .25; flex-shrink: 0; margin: 0 28rpx; }

// Bullets
.qr-bullet { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 14rpx; }
.qr-bullet-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #111; margin-top: 10rpx; flex-shrink: 0; }
.qr-bullet text { font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.65; }

// Action
.qr-action-text { display: block; margin-top: 10rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.7; }

// Shared
.page-hint { display: block; text-align: center; font-size: $fs-caption; color: #bbb; margin-bottom: 16rpx; }
.page-disclaimer { display: block; padding: 32rpx 0 16rpx; text-align: center; color: #bbb; font-size: $fs-caption; font-weight: $fw-label; }

.cta-card { margin-top: 24rpx; padding: 32rpx 28rpx; background: #111; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #FF6B6B; }
.cta-title { display: block; color: #FFD93D; font-size: $fs-heading; font-weight: $fw-hero; }
.cta-desc { display: block; margin-top: 12rpx; color: rgba(255,255,255,0.78); font-size: $fs-body-lg; line-height: 1.5; font-weight: $fw-body; }

.loading-v2 { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }
</style>
