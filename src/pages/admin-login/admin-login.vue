<template>
  <view :class="['admin-login-page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="admin-login-shell">
      <view class="header-v2">
        <text class="title-v2">管理<text class="hl-v2">员登录</text></text>
        <text class="subtitle-v2">使用后台管理账号继续</text>
      </view>

      <view class="card-v2">
        <input
          v-model="account"
          class="input-v2"
          type="text"
          placeholder="邮箱或管理员账号"
          autocomplete="username"
          @input="clearError"
        />
        <input
          v-model="password"
          class="input-v2 input-spaced"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
          confirm-type="done"
          @input="clearError"
          @confirm="handleLogin"
        />
        <view v-if="errorMessage" class="error-v2">{{ errorMessage }}</view>
        <button class="btn btn-primary btn-lg btn-full login-button" :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '登录后台' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { login, logout } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const account = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const themeVars = ref(getThemeStyle())

onLoad(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

function clearError() {
  errorMessage.value = ''
}

async function handleLogin() {
  const normalizedAccount = account.value.trim()
  if (!normalizedAccount) {
    errorMessage.value = '请输入管理员账号'
    return
  }
  if (!password.value) {
    errorMessage.value = '请输入密码'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await login(normalizedAccount, password.value)
    if (!result?.success) {
      errorMessage.value = result?.message || '登录失败'
      return
    }
    if (!result.isAdmin && result.role !== 'admin') {
      await logout()
      errorMessage.value = '该账号没有后台管理权限'
      return
    }
    uni.reLaunch({ url: '/pages/admin/admin' })
  } catch (error: any) {
    errorMessage.value = error?.message || '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.admin-login-page {
  min-height: 100vh;
  background: var(--app-bg, #FFFDF5);
  padding: 18rpx;
  box-sizing: border-box;
}

.admin-login-shell {
  width: 100%;
  max-width: 720rpx;
  margin: 0 auto;
}

.header-v2 {
  padding: 72rpx 0 36rpx;
}

.title-v2 {
  display: block;
  font-size: $fs-hero-title;
  font-weight: $fw-hero;
  color: var(--text-main, #111);
  line-height: 1.1;
}

.hl-v2 {
  display: inline-block;
  background: var(--accent, #FFD93D);
  padding: 0 8rpx;
}

.subtitle-v2 {
  display: block;
  margin-top: 12rpx;
  font-size: $fs-heading;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
}

.card-v2 {
  @include card-v2;
}

.input-v2 {
  width: 100%;
  height: 88rpx;
  padding: 0 28rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  box-sizing: border-box;
}

.input-spaced {
  margin-top: 20rpx;
}

.error-v2 {
  margin-top: 18rpx;
  padding: 16rpx;
  border: var(--border-width, 2rpx) solid var(--risk, #FF5252);
  background: var(--risk-soft, #FFEEEC);
  color: var(--risk, #FF5252);
  font-size: $fs-body;
}

.login-button {
  margin-top: 28rpx;
}
</style>
