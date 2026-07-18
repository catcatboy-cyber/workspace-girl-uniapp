<template>
  <view :class="['landing-page', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <!-- 小咪 avatar -->
    <view class="landing-pet">
      <image :src="petAvatar" mode="aspectFit" class="landing-pet-img" />
    </view>

    <!-- Hero -->
    <view class="landing-hero">
      <text class="landing-hero-tag">{{ aiLabel() }} CRUSH ANALYZER</text>
      <text class="landing-hero-title">Crush<text class="landing-hero-hl">Master</text></text>
      <text class="landing-hero-sub">read the signals, not your mind.</text>
    </view>

    <!-- 功能介绍 -->
    <view class="landing-features">
      <view class="landing-feat">
        <text class="landing-feat-icon">📝</text>
        <text class="landing-feat-text">记录互动，{{ aiLabel() }} 实时分析 TA 的态度变化</text>
      </view>
      <view class="landing-feat">
        <image class="landing-feat-icon-img" src="/static/icons/taohua/search.svg" mode="aspectFit" />
        <text class="landing-feat-text">解读 TA 的真实意图，看清关系信号</text>
      </view>
      <view class="landing-feat">
        <image class="landing-feat-icon-img" src="/static/icons/taohua/bulb.svg" mode="aspectFit" />
        <text class="landing-feat-text">判断关系走向，给你下一步行动建议</text>
      </view>
    </view>

    <!-- 关闭按钮 -->
    <button class="landing-btn" :disabled="entering" @click="handleEnter">
      {{ entering ? '正在准备...' : '关  闭' }}
    </button>

    <!-- checkbox -->
    <view class="landing-checkbox" @click="skipNext = !skipNext">
      <view :class="['landing-check', skipNext ? 'checked' : '']">
        <text v-if="skipNext">✓</text>
      </view>
      <text class="landing-check-label">下次不再弹出此页面</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, shouldCompleteSelfProfile } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { getPetById, getSelectedPetId } from '@/utils/pets.js'
import { aiLabel } from '@/utils/labels'

const LANDING_SHOWN_KEY = 'landingShown:v1'
const INVITE_CODE_KEY = 'pendingInviteCode'

const themeVars = ref(getThemeStyle())
const petAvatar = getPetById(getSelectedPetId()).avatarPath
const entering = ref(false)
const skipNext = ref(false)
const pendingRedirect = ref('')

let loginCheckTimer: ReturnType<typeof setInterval> | null = null

onLoad((options: any) => {
  const code = options?.inviteCode || options?.invite_code || ''
  if (code && typeof code === 'string' && code.trim()) {
    uni.setStorageSync(INVITE_CODE_KEY, code.trim().toUpperCase())
  }
  pendingRedirect.value = normalizeRedirect(options?.redirect || '')
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

onShow(() => {
  const uid = getCurrentUserId()
  if (uid && isLandingShown(uid)) {
    goHome()
    return
  }
  startLoginCheck()
})

onUnmounted(() => {
  stopLoginCheck()
})

function isLandingShown(uid: string): boolean {
  try { return !!uni.getStorageSync(`${LANDING_SHOWN_KEY}:${uid}`) } catch { return false }
}

function markLandingShown(uid: string) {
  try { uni.setStorageSync(`${LANDING_SHOWN_KEY}:${uid}`, true) } catch {}
}

function startLoginCheck() {
  stopLoginCheck()
  loginCheckTimer = setInterval(() => {
    const uid = getCurrentUserId()
    if (uid && isLandingShown(uid)) {
      stopLoginCheck()
      goHome()
    }
  }, 500)
  setTimeout(() => stopLoginCheck(), 5000)
}

function stopLoginCheck() {
  if (loginCheckTimer) { clearInterval(loginCheckTimer); loginCheckTimer = null }
}

const TAB_PAGES = ['/pages/index/index', '/pages/case-detail/case-detail', '/pages/cases/cases', '/pages/timeline/timeline', '/pages/me/me']

function normalizeRedirect(value: string) {
  const decoded = decodeURIComponent(String(value || '')).trim()
  if (!decoded.startsWith('/pages/')) return ''
  if (decoded.includes('://') || decoded.includes('\\')) return ''
  return decoded
}

// redirectTo 不能打开 tab 页（会 fail 且页面不动），tab 页必须走 switchTab
function jumpTo(url: string) {
  const path = url.split('?')[0]
  if (TAB_PAGES.includes(path)) {
    uni.switchTab({ url: path })
    return
  }
  uni.redirectTo({ url })
}

function goHome() {
  if (pendingRedirect.value) {
    jumpTo(pendingRedirect.value)
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

async function handleEnter() {
  entering.value = true

  let uid = getCurrentUserId()
  if (!uid) {
    uid = await waitForUserId(3000)
  }

  if (skipNext.value && uid) {
    markLandingShown(uid)
  }

  if (!uid) {
    uni.showToast({ title: '登录中，请稍后刷新', icon: 'none' })
  }

  if (uid && shouldCompleteSelfProfile()) {
    const suffix = pendingRedirect.value ? `&redirect=${encodeURIComponent(pendingRedirect.value)}` : ''
    uni.redirectTo({ url: `/pages/self-profile/self-profile?mode=onboarding${suffix}` })
  } else if (uid && pendingRedirect.value) {
    jumpTo(pendingRedirect.value)
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }

  entering.value = false
}

function waitForUserId(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const timer = setInterval(() => {
      const uid = getCurrentUserId()
      if (uid) { clearInterval(timer); resolve(uid); return }
      if (Date.now() - start > timeoutMs) { clearInterval(timer); resolve(null) }
    }, 300)
  })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.landing-page {
  min-height: 100vh;
  background: var(--app-bg, #FFFDF5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 36rpx;
  // safe area for iPhone notch
  padding-top: calc(48rpx + env(safe-area-inset-top));
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

// ── 小咪头像 ──
.landing-pet {
  margin-bottom: 36rpx;
}
.landing-pet-img {
  width: 200rpx;
  height: 200rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: 50%;
  background: var(--brand-warm, #FFFBEB);
}

// ── Hero ──
.landing-hero {
  text-align: center;
  margin-bottom: 36rpx;
}
.landing-hero-tag {
  display: inline-block;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  color: var(--text-main, #111);
  background: var(--accent, #FFD93D);
  padding: 6rpx 20rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  margin-bottom: 16rpx;
  letter-spacing: 4rpx;
}
.landing-hero-title {
  display: block;
  font-size: $fs-display;
  font-weight: $fw-hero;
  color: var(--text-main, #111);
  line-height: 1.1;
  letter-spacing: -1rpx;
}
.landing-hero-hl {
  display: inline-block;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  padding: 0 10rpx;
}
.landing-hero-sub {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
  margin-top: 12rpx;
  font-style: italic;
}

// ── 功能介绍 ──
.landing-features {
  width: calc(100% - 48rpx);
  max-width: 640rpx;
  background: var(--surface, #fff);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
  padding: 32rpx 28rpx;
  margin: 0 auto 40rpx;
  box-sizing: border-box;
}
.landing-feat {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 18rpx;
  &:last-child { margin-bottom: 0; }
}
.landing-feat-icon-img { width: 48rpx; height: 48rpx; } .landing-feat-icon {
  font-size: $fs-body-lg;
  flex-shrink: 0;
  line-height: 1.4;
}
.landing-feat-text {
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: var(--text-main, #111);
  line-height: 1.5;
}

// ── 关闭按钮 ──
.landing-btn {
  width: calc(100% - 48rpx);
  max-width: 640rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--accent-cool, #4ECDC4);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
  font-size: $fs-heading;
  font-weight: $fw-heading;
  color: var(--text-main, #111);
  text-align: center;
  margin: 0 auto 28rpx;
  box-sizing: border-box;
  &[disabled] {
    opacity: 0.6;
    box-shadow: none;
  }
}

// ── checkbox ──
.landing-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.landing-check {
  width: 34rpx;
  height: 34rpx;
  line-height: 32rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  text-align: center;
  font-size: $fs-body;
  font-weight: $fw-hero;
  color: var(--surface, #fff);
  flex-shrink: 0;
}
.landing-check.checked {
  background: var(--text-main, #111);
}
.landing-check-label {
  font-size: $fs-body;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
}
</style>
