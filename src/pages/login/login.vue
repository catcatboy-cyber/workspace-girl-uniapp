<template>
  <view :class="['login-page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">


<view class="container">
              <view class="header-v2"><text class="title-v2 en-title">Dom-Crush</text><text class="subtitle-v2">read the signals, not your mind.</text></view>
        <view v-if="isWechatMiniProgram" class="card-v2">
          <button class="btn-v2-l primary" :disabled="wechatLoading" @click="handleWechatLogin">{{ wechatLoading ? wechatLoadingCopy : wechatLoginCopy }}</button>
          <text class="privacy-v2" @click="goAbout">{{ privacyCopy }}</text>
          <text v-if="wechatErrorMessage" class="error-v2">{{ wechatErrorMessage }}</text>
          <button class="btn-v2-l" @click="showEmailLogin = !showEmailLogin">{{ showEmailLogin ? hideEmailCopy : useEmailCopy }}</button>
        </view>
        <view v-if="showEmailLogin" class="card-v2">
          <input v-model="email" type="text" placeholder="请输入邮箱" class="input-v2" @input="clearError" />
          <input v-model="password" type="password" placeholder="请输入密码" class="input-v2" @input="clearError" style="margin-top:20rpx;" />
          <view class="remember-v2" @click="toggleRemember"><view :class="['check-v2', rememberLogin ? 'checked' : '']"><text v-if="rememberLogin">✓</text></view><text class="remember-text-v2">记住邮箱</text><text class="remember-note-v2">仅保存在当前设备，不保存密码。</text></view>
          <view v-if="errorMessage" class="error-v2">{{ errorMessage }}</view>
          <button class="btn-v2-l primary" :disabled="loading" @click="handleLogin">{{ loading ? '登录中...' : '登录' }}</button>
          <text class="footer-v2" @click="goRegister">还没有账号？立即注册 →</text>
        </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, login, shouldCompleteSelfProfile, wechatLogin } from '@/utils/api'
import { resetCloudAuthState } from '@/utils/cloudbase'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const INVITE_CODE_KEY = 'pendingInviteCode'
const pendingRedirect = ref('')

// 接收分享链接中的邀请码
onLoad((options: any) => {
  const code = options?.inviteCode || options?.invite_code || ''
  if (code && typeof code === 'string' && code.trim()) {
    uni.setStorageSync(INVITE_CODE_KEY, code.trim().toUpperCase())
  }
  pendingRedirect.value = normalizeRedirect(options?.redirect || '')
  if (getCurrentUserId()) {
    goRedirectOrHome()
  }
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const wechatLoading = ref(false)
const errorMessage = ref('')
const wechatErrorMessage = ref('')
const themeVars = ref(getThemeStyle())
const showEmailLogin = ref(true)
const isWechatMiniProgram = ref(false)
const rememberLogin = ref(false)
const REMEMBER_LOGIN_KEY = 'rememberedEmailLogin'
const wechatLoadingCopy = '\u767b\u5f55\u4e2d...'
const wechatLoginCopy = '\u5fae\u4fe1\u4e00\u952e\u767b\u5f55'
const privacyCopy = '\u767b\u5f55\u5373\u8868\u793a\u540c\u610f\u300a\u9690\u79c1\u653f\u7b56\u300b\u548c\u300a\u670d\u52a1\u6761\u6b3e\u300b\uff0c\u67e5\u770b\u8bf7\u524d\u5f80\u201c\u5173\u4e8e\u201d\u9875\u3002'
const hideEmailCopy = '\u6536\u8d77\u90ae\u7bb1\u767b\u5f55'
const useEmailCopy = '\u4f7f\u7528\u90ae\u7bb1\u767b\u5f55'

onShow(() => {
  isWechatMiniProgram.value = Boolean((globalThis as any)?.wx?.cloud)
  if (isWechatMiniProgram.value) {
    showEmailLogin.value = false
  }
  loadRememberedLogin()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  resetCloudAuthState().catch(() => {})
})

const clearError = () => {
  errorMessage.value = ''
  wechatErrorMessage.value = ''
}

function loadRememberedLogin() {
  try {
    const saved = uni.getStorageSync(REMEMBER_LOGIN_KEY)
    if (saved?.remember && saved?.email) {
      email.value = saved.email
      rememberLogin.value = true
    }
  } catch (error) {
    console.warn('[page:login] load remembered login failed:', error)
  }
}

function saveRememberedLogin() {
  try {
    if (rememberLogin.value) {
      uni.setStorageSync(REMEMBER_LOGIN_KEY, {
        remember: true,
        email: email.value.trim()
      })
    } else {
      uni.removeStorageSync(REMEMBER_LOGIN_KEY)
    }
  } catch (error) {
    console.warn('[page:login] save remembered login failed:', error)
  }
}

function toggleRemember() {
  rememberLogin.value = !rememberLogin.value
  if (!rememberLogin.value) {
    try {
      uni.removeStorageSync(REMEMBER_LOGIN_KEY)
    } catch {
      // ignore
    }
  }
}

function goAfterLogin(result: any) {
  if (result?.isAdmin || result?.role === 'admin') {
    uni.redirectTo({ url: '/pages/admin/admin' })
    return
  }
  if (shouldCompleteSelfProfile(result)) {
    const redirect = pendingRedirect.value ? `&redirect=${encodeURIComponent(pendingRedirect.value)}` : ''
    uni.redirectTo({ url: `/pages/self-profile/self-profile?mode=onboarding${redirect}` })
    return
  }
  if (pendingRedirect.value) {
    goRedirectOrHome()
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

function normalizeRedirect(value: string) {
  const decoded = decodeURIComponent(String(value || '')).trim()
  if (!decoded.startsWith('/pages/')) return ''
  if (decoded.includes('://') || decoded.includes('\\')) return ''
  return decoded
}

function goRedirectOrHome() {
  const url = pendingRedirect.value
  if (!url) {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  if (url.startsWith('/pages/index/index') || url.startsWith('/pages/me/me')) {
    uni.switchTab({ url })
    return
  }
  uni.redirectTo({ url })
}

function getWechatLoginCode(): Promise<string> {
  const wxApi = (globalThis as any)?.wx
  if (!wxApi?.login) {
    return Promise.resolve('')
  }

  return new Promise((resolve) => {
    wxApi.login({
      success(res: any) {
        resolve(res?.code || '')
      },
      fail(error: any) {
        console.warn('[page:login] wx.login failed:', error)
        resolve('')
      }
    })
  })
}

const handleLogin = async () => {
  // 验证输入
  if (!email.value.trim()) {
    errorMessage.value = '请输入邮箱'
    return
  }
  if (!password.value) {
    errorMessage.value = '请输入密码'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await login(email.value, password.value)

    if (result.success) {
      saveRememberedLogin()
      // 登录成功，跳转到首页
      goAfterLogin(result)
    } else {
      errorMessage.value = result.message || '登录失败'
    }
  } catch (error: any) {
    console.error('登录错误:', error)
    errorMessage.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

const handleWechatLogin = async () => {
  wechatLoading.value = true
  errorMessage.value = ''
  wechatErrorMessage.value = ''

  try {
    const loginCode = await getWechatLoginCode()
    const result = await wechatLogin('', { loginCode })
    if (result?.success) {
      goAfterLogin(result)
    } else {
      wechatErrorMessage.value = result?.message || '\u5fae\u4fe1\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\uff1b\u5982\u679c\u4ecd\u4e0d\u53ef\u7528\uff0c\u53ef\u624b\u52a8\u4f7f\u7528\u90ae\u7bb1\u767b\u5f55\u3002'
    }
  } catch (error: any) {
    console.error('wechat login error:', error)
    wechatErrorMessage.value = '\u5fae\u4fe1\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff1b\u5982\u679c\u4ecd\u4e0d\u53ef\u7528\uff0c\u53ef\u624b\u52a8\u4f7f\u7528\u90ae\u7bb1\u767b\u5f55\u3002'
  } finally {
    wechatLoading.value = false
  }
}

const goRegister = () => {
  uni.navigateTo({
    url: '/pages/register/register'
  })
}

const goAbout = () => {
  uni.navigateTo({
    url: '/pages/about/about'
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f4ede2 0%, #fbf6ee 100%);
  padding: 40rpx;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .header-v2 { text-align: left; padding: 40rpx 0 32rpx; }
.v2-mode .title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; letter-spacing: -2rpx; line-height: 1.1; }
.v2-mode .title-v2.en-title { font-size: 48rpx; font-weight: 900; font-style: italic; letter-spacing: 2rpx; background: #FFD93D; display: inline-block; padding: 6rpx 20rpx; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .subtitle-v2 { display: block; font-size: 28rpx; font-weight: 600; color: #666; margin-top: 10rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }

.v2-mode .btn-v2-l { width: 100%; height: 80rpx; line-height: 80rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 28rpx; font-weight: 800; color: #111; margin-top: 14rpx; }
.v2-mode .btn-v2-l:first-child { margin-top: 0; }
.v2-mode .btn-v2-l.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-l[disabled] { opacity: 0.6; }

.v2-mode .privacy-v2 { display: block; margin: 16rpx 0; font-size: 22rpx; font-weight: 600; color: #666; text-align: center; line-height: 1.5; text-decoration: underline; }
.v2-mode .error-v2 { display: block; margin: 0 0 18rpx; padding: 16rpx; border: 2rpx solid #FF5252; background: #FFEEEC; font-size: 22rpx; font-weight: 600; color: #FF5252; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; padding: 0 28rpx; border: 3rpx solid #111; font-size: 26rpx; font-weight: 600; color: #111; background: #fff; box-sizing: border-box; }
.v2-mode .input-v2::placeholder { color: #999; }

.v2-mode .remember-v2 { display: flex; align-items: center; gap: 10rpx; margin: 20rpx 0; padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .check-v2 { width: 34rpx; height: 34rpx; line-height: 32rpx; border: 2rpx solid #111; text-align: center; font-size: 22rpx; font-weight: 900; color: #fff; }
.v2-mode .check-v2.checked { background: #111; }
.v2-mode .remember-text-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .remember-note-v2 { font-size: 18rpx; font-weight: 600; color: #999; margin-left: auto; }

.v2-mode .footer-v2 { display: block; margin-top: 24rpx; text-align: center; font-size: 26rpx; font-weight: 700; color: #111; text-decoration: underline; }
</style>
