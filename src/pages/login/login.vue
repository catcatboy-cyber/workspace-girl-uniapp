<template>
  <view :class="['login-page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>
    <view class="container">
      <block v-if="!showV2">
      <view class="header"><text class="title">关系评估</text><text class="subtitle">登录您的账号</text></view>
      <view v-if="isWechatMiniProgram" class="wechat-panel"><button class="btn-primary wechat-btn" open-type="getPhoneNumber" :disabled="wechatLoading" @getphonenumber="handleWechatPhoneLogin"><text>{{ wechatLoading ? wechatLoadingCopy : wechatLoginCopy }}</text></button><text class="privacy-note">{{ privacyCopy }}</text><text v-if="wechatErrorMessage" class="wechat-error">{{ wechatErrorMessage }}</text><button class="btn-secondary email-toggle" @click="showEmailLogin = !showEmailLogin">{{ showEmailLogin ? hideEmailCopy : useEmailCopy }}</button></view>
      <view v-if="showEmailLogin" class="form email-form"><view class="form-item"><input v-model="email" type="text" placeholder="请输入邮箱" placeholder-class="placeholder" @input="clearError" /></view><view class="form-item"><input v-model="password" type="password" placeholder="请输入密码" placeholder-class="placeholder" @input="clearError" /></view><view class="remember-row" @click="toggleRemember"><view :class="['remember-check', rememberLogin ? 'checked' : '']"><text v-if="rememberLogin">✓</text></view><view class="remember-copy"><text class="remember-title">记住邮箱</text><text class="remember-note">仅保存在当前设备，不保存密码。</text></view></view><view v-if="errorMessage" class="error-message">{{ errorMessage }}</view><button class="btn-primary" :disabled="loading" @click="handleLogin">{{ loading ? '登录中...' : '登录' }}</button><view class="footer"><text class="link" @click="goRegister">还没有账号？立即注册</text></view></view>
      </block>

      <!-- Campus Pop -->
      <block v-if="showV2">
        <view class="header-v2"><text class="title-v2">关系<text class="hl-v2">评估</text></text><text class="subtitle-v2">登录您的账号</text></view>
        <view v-if="isWechatMiniProgram" class="card-v2">
          <button class="btn-v2-l primary" open-type="getPhoneNumber" :disabled="wechatLoading" @getphonenumber="handleWechatPhoneLogin">{{ wechatLoading ? wechatLoadingCopy : wechatLoginCopy }}</button>
          <text class="privacy-v2">{{ privacyCopy }}</text>
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
      </block>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { login, shouldCompleteSelfProfile, wechatLogin } from '@/utils/api'
import { resetCloudAuthState } from '@/utils/cloudbase'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const showV2 = ref(true)
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
const wechatLoginCopy = '\u5fae\u4fe1\u624b\u673a\u53f7\u4e00\u952e\u767b\u5f55'
const privacyCopy = '\u4ec5\u7528\u4e8e\u4fdd\u5b58\u4f60\u7684\u8bb0\u5f55\u548c\u627e\u56de\u8d26\u53f7\uff0c\u4e0d\u4f1a\u516c\u5f00\u5c55\u793a\u3002'
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
  console.log('[page:login] show')
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
    uni.redirectTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

const handleLogin = async () => {
  console.log('[page:login] handleLogin')
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

const handleWechatPhoneLogin = async (event: any) => {
  console.log('[page:login] handleWechatPhoneLogin', event?.detail)
  const detail = event?.detail || {}
  const code = detail.code

  if (!code) {
    const errMsg = String(detail.errMsg || '')
    const noPermission = errMsg.includes('no permission') || errMsg.includes('has no permission') || detail.errno === 102
    wechatErrorMessage.value = noPermission
      ? '\u5f53\u524d\u5c0f\u7a0b\u5e8f\u8fd8\u6ca1\u6709\u5fae\u4fe1\u624b\u673a\u53f7\u6388\u6743\u80fd\u529b\uff0c\u9700\u5728\u5fae\u4fe1\u5c0f\u7a0b\u5e8f\u540e\u53f0\u5b8c\u6210\u8ba4\u8bc1\u5e76\u5f00\u901a\u3002'
      : '\u672a\u83b7\u5f97\u624b\u673a\u53f7\u6388\u6743\uff0c\u4f60\u53ef\u4ee5\u91cd\u8bd5\u6216\u4f7f\u7528\u90ae\u7bb1\u767b\u5f55\u3002'
    console.warn('[page:login] getPhoneNumber failed:', detail)
    return
  }

  wechatLoading.value = true
  errorMessage.value = ''
  wechatErrorMessage.value = ''

  try {
    const result = await wechatLogin(code)
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
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f4ede2 0%, #fbf6ee 100%);
  padding: 40rpx;
}

.container {
  max-width: 600rpx;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-top: 120rpx;
  margin-bottom: 80rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #143f3a;
  margin-bottom: 16rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: #786857;
}

.form {
  background: rgba(255, 252, 247, 0.9);
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.wechat-panel {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 160rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 60%),
    var(--card-bg, #fffcf7);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 20rpx;
  padding: 44rpx 40rpx;
  margin-bottom: 24rpx;
  box-shadow:
    0 22rpx 46rpx rgba(32, 25, 20, 0.09),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.wechat-panel::before {
  content: "";
  position: absolute;
  left: 36rpx;
  right: 36rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}

.privacy-note {
  display: block;
  margin: 18rpx 0 20rpx;
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  line-height: 1.55;
  text-align: center;
}

.wechat-error {
  display: block;
  margin: 0 0 20rpx;
  padding: 18rpx 20rpx;
  color: var(--risk, #b84a3a);
  background: var(--risk-soft, #f7dfd8);
  border: 1rpx solid rgba(184, 74, 58, 0.18);
  border-radius: 14rpx;
  font-size: 24rpx;
  line-height: 1.55;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-item input {
  width: 100%;
  height: 88rpx;
  padding: 0 32rpx;
  background: #fff;
  border: 2rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #241b12;
}

.form-item input:focus {
  border-color: #143f3a;
}

.placeholder {
  color: #999;
}

.remember-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin: -8rpx 0 28rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.62);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}

.remember-check {
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  margin-top: 4rpx;
  border-radius: 8rpx;
  border: 2rpx solid rgba(18, 60, 54, 0.28);
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
  box-sizing: border-box;
}

.remember-check.checked {
  background: var(--primary, #123c36);
  border-color: var(--primary, #123c36);
}

.remember-copy {
  flex: 1;
  min-width: 0;
}

.remember-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.35;
}

.remember-note {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  line-height: 1.4;
}

.error-message {
  margin-bottom: 24rpx;
  padding: 20rpx;
  background: #f9d8d2;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #b85c38;
  text-align: center;
}

.btn-primary {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #143f3a;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
}

.btn-primary:disabled {
  opacity: 0.6;
}

.btn-secondary {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  background: rgba(255, 252, 247, 0.92);
  color: var(--primary, #123c36);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}

.wechat-btn {
  margin: 0;
}

.footer {
  margin-top: 32rpx;
  text-align: center;
}

.link {
  font-size: 26rpx;
  color: #143f3a;
  text-decoration: underline;
}

/* Premium entry pass */
.login-page {
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.12), rgba(18, 60, 54, 0) 420rpx),
    var(--app-bg, #f6f1e8);
}

.header {
  text-align: left;
  padding-top: 32rpx;
}

.title {
  color: var(--primary, #123c36);
  font-size: 54rpx;
  line-height: 1.15;
}

.subtitle {
  color: var(--text-muted, #76695c);
}

.form {
  position: relative;
  overflow: hidden;
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 20rpx;
  box-shadow: 0 18rpx 42rpx rgba(32, 25, 20, 0.08);
}

.form::before {
  content: "";
  position: absolute;
  left: 36rpx;
  right: 36rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}

.form-item input {
  background: var(--card-soft, #fffaf3);
  border: 1rpx solid rgba(18, 60, 54, 0.12);
  border-radius: 14rpx;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  border-radius: 14rpx;
  box-shadow: 0 12rpx 24rpx rgba(18, 60, 54, 0.18);
}

.link {
  color: var(--primary, #123c36);
  text-decoration: none;
  font-weight: 600;
}

/* Second visual pass */
.form {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 160rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 60%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 22rpx 46rpx rgba(32, 25, 20, 0.09),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.form-item {
  padding-bottom: 4rpx;
}

.form-item input {
  box-shadow: inset 0 2rpx 8rpx rgba(32, 25, 20, 0.03);
}

.error-message { border: 1rpx solid rgba(184, 74, 58, 0.18); box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.55); }

/* ===== CAMPUS POP V2 ===== */
.version-toggle { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #111; overflow: hidden; background: #fff; }
.toggle-tab { flex: 1; text-align: center; padding: 14rpx 0; font-size: 26rpx; font-weight: 700; color: #999; }
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .header-v2 { text-align: left; padding: 40rpx 0 32rpx; }
.v2-mode .title-v2 { display: block; font-size: 54rpx; font-weight: 900; color: #111; letter-spacing: -2rpx; line-height: 1.1; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .subtitle-v2 { display: block; font-size: 28rpx; font-weight: 600; color: #666; margin-top: 10rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }

.v2-mode .btn-v2-l { width: 100%; height: 80rpx; line-height: 80rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 28rpx; font-weight: 800; color: #111; margin-top: 14rpx; }
.v2-mode .btn-v2-l:first-child { margin-top: 0; }
.v2-mode .btn-v2-l.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-l[disabled] { opacity: 0.6; }

.v2-mode .privacy-v2 { display: block; margin: 16rpx 0; font-size: 22rpx; font-weight: 600; color: #999; text-align: center; line-height: 1.5; }
.v2-mode .error-v2 { display: block; margin: 0 0 18rpx; padding: 16rpx; border: 2rpx solid #FF5252; background: #FFEEEC; font-size: 22rpx; font-weight: 600; color: #FF5252; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; padding: 0 28rpx; border: 3rpx solid #111; font-size: 28rpx; font-weight: 600; color: #111; background: #fff; box-sizing: border-box; }
.v2-mode .input-v2::placeholder { color: #ccc; }

.v2-mode .remember-v2 { display: flex; align-items: center; gap: 10rpx; margin: 20rpx 0; padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .check-v2 { width: 34rpx; height: 34rpx; line-height: 32rpx; border: 2rpx solid #111; text-align: center; font-size: 22rpx; font-weight: 900; color: #fff; }
.v2-mode .check-v2.checked { background: #111; }
.v2-mode .remember-text-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .remember-note-v2 { font-size: 18rpx; font-weight: 600; color: #999; margin-left: auto; }

.v2-mode .footer-v2 { display: block; margin-top: 24rpx; text-align: center; font-size: 26rpx; font-weight: 700; color: #111; text-decoration: underline; }
</style>
