<template>
  <view :class="['register-page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">


<view class="container">
              <view class="header-v2"><text class="title-v2">创建<text class="hl-v2">账号</text></text><text class="subtitle-v2">开始记录和判断你的关系</text></view>
        <view class="card-v2">
          <input v-model="email" type="text" placeholder="请输入邮箱" class="input-v2" @input="clearError" />
          <input v-model="password" type="password" placeholder="请输入密码（至少8位）" class="input-v2" style="margin-top:20rpx;" @input="clearError" />
          <input v-model="confirmPassword" type="password" placeholder="请再次输入密码" class="input-v2" style="margin-top:20rpx;" @input="clearError" />
          <view v-if="errorMessage" class="error-v2" style="margin-top:18rpx;">{{ errorMessage }}</view>
          <button class="btn-v2-r primary" :disabled="loading" @click="handleRegister">{{ loading ? '注册中...' : '注册' }}</button>
          <text class="footer-v2" @click="goLogin">已有账号？立即登录 →</text>
        </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { register, shouldCompleteSelfProfile } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')
const themeVars = ref(getThemeStyle())

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
    const result = await register(email.value, password.value)

    if (result.success) {
      if (shouldCompleteSelfProfile(result)) {
        uni.redirectTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    } else {
      errorMessage.value = result.message || '注册失败'
    }
  } catch (error: any) {
    console.error('注册错误:', error)
    errorMessage.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

const goLogin = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f4ede2 0%, #fbf6ee 100%);
  padding: 40rpx;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .header-v2 { text-align: left; padding: 40rpx 0 32rpx; }
.v2-mode .title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; letter-spacing: -2rpx; line-height: 1.1; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .subtitle-v2 { display: block; font-size: 28rpx; font-weight: 600; color: #666; margin-top: 10rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; padding: 0 28rpx; border: 3rpx solid #111; font-size: 26rpx; font-weight: 600; color: #111; background: #fff; box-sizing: border-box; }
.v2-mode .input-v2::placeholder { color: #999; }

.v2-mode .error-v2 { padding: 16rpx; border: 2rpx solid #FF5252; background: #FFEEEC; font-size: 22rpx; font-weight: 600; color: #FF5252; }

.v2-mode .btn-v2-r { width: 100%; height: 80rpx; line-height: 80rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 28rpx; font-weight: 800; color: #111; margin-top: 20rpx; }
.v2-mode .btn-v2-r.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-r[disabled] { opacity: 0.6; }

.v2-mode .footer-v2 { display: block; margin-top: 24rpx; text-align: center; font-size: 26rpx; font-weight: 700; color: #111; text-decoration: underline; }
</style>
