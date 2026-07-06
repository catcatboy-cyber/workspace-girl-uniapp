<template>
  <view :class="['register-page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">


<view class="container">
              <view class="header-v2"><text class="title-v2">创建<text class="hl-v2">账号</text></text><text class="subtitle-v2">开始记录和判断你的关系</text></view>
        <view class="card-v2">
          <input v-model="email" type="text" placeholder="请输入邮箱" class="input-v2" @input="clearError" />
          <input v-model="password" type="password" placeholder="请输入密码（至少8位）" class="input-v2" style="margin-top:20rpx;" @input="clearError" />
          <input v-model="confirmPassword" type="password" placeholder="请再次输入密码" class="input-v2" style="margin-top:20rpx;" @input="clearError" />
          <input v-model="inviteCode" type="text" placeholder="邀请码（选填）" class="input-v2" style="margin-top:20rpx;" @input="clearError" />
          <view v-if="errorMessage" class="error-v2" style="margin-top:18rpx;">{{ errorMessage }}</view>
          <button class="btn btn-primary btn-lg btn-full" :disabled="loading" @click="handleRegister">{{ loading ? '注册中...' : '注册' }}</button>
          <text class="privacy-v2" @click="goAbout">{{ privacyCopy }}</text>
          <text class="footer-v2" @click="goLogin">已有账号？立即登录 →</text>
        </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { register, shouldCompleteSelfProfile } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

const INVITE_CODE_KEY = 'pendingInviteCode'
const privacyCopy = '请阅读并了解《隐私政策》和《服务条款》（点击查看）'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')
const themeVars = ref(getThemeStyle())
const inviteCode = ref('')

onLoad((options: any) => {
  // 从分享链接参数或存储中获取邀请码
  const fromParam = options?.inviteCode || options?.invite_code || ''
  const fromStorage = uni.getStorageSync(INVITE_CODE_KEY) || ''
  const code = (fromParam || fromStorage).trim().toUpperCase()
  if (code && code.length >= 4) {
    inviteCode.value = code
    uni.removeStorageSync(INVITE_CODE_KEY)
  }
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

const clearError = () => {
  errorMessage.value = ''
}

const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const handleRegister = async () => {
  // 验证输入
  if (!email.value.trim()) {
    errorMessage.value = '请输入邮箱'
    return
  }
  if (!validateEmail(email.value)) {
    errorMessage.value = '请输入有效的邮箱地址'
    return
  }
  if (!password.value) {
    errorMessage.value = '请输入密码'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = '密码至少需要8位'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await register(email.value, password.value, inviteCode.value || undefined)

    if (result.success) {
      // 受邀奖励通知
      if (result?.referral?.inviteeReward > 0) {
        uni.setStorageSync('showInviteeNotice', true)
        uni.setStorageSync('inviteeNoticeAmount', result.referral.inviteeReward)
      }
      if (shouldCompleteSelfProfile(result)) {
        uni.redirectTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    } else {
      errorMessage.value = result.message || '注册失败'
    }
  } catch {
    errorMessage.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

const goLogin = () => {
  uni.navigateBack()
}

const goAbout = () => {
  uni.navigateTo({ url: '/pages/about/about' })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.register-page {
  min-height: 100vh;
  background: var(--app-bg, #FFFDF5);
  padding: 40rpx;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .header-v2 { text-align: left; padding: 40rpx 0 32rpx; }
.v2-mode .title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--text-main, #111); letter-spacing: -2rpx; line-height: 1.1; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .subtitle-v2 { display: block; font-size: $fs-heading; font-weight: $fw-body; color: var(--text-muted, #666); margin-top: 10rpx; }

.v2-mode .card-v2 { @include card-v2; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; padding: 0 28rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); background: var(--surface, #fff); box-sizing: border-box; }
.v2-mode .input-v2::placeholder { color: var(--placeholder, #999); }

.v2-mode .error-v2 { padding: 16rpx; border: var(--border-width, 2rpx) solid var(--risk, #FF5252); background: var(--risk-soft, #FFEEEC); font-size: $fs-body; font-weight: $fw-body; color: var(--risk, #FF5252); }

.v2-mode .privacy-v2 { display: block; margin: 16rpx 0; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); text-align: center; line-height: 1.5; text-decoration: underline; }

</style>
