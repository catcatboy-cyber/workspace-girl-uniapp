<template>
  <view class="register-page">
    <view class="container">
      <view class="header">
        <text class="title">创建账号</text>
        <text class="subtitle">开始记录和评估您的关系</text>
      </view>

      <view class="form">
        <view class="form-item">
          <input
            v-model="email"
            type="text"
            placeholder="请输入邮箱"
            placeholder-class="placeholder"
            @input="clearError"
          />
        </view>

        <view class="form-item">
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码（至少8位）"
            placeholder-class="placeholder"
            @input="clearError"
          />
        </view>

        <view class="form-item">
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            placeholder-class="placeholder"
            @input="clearError"
          />
        </view>

        <view v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </view>

        <button
          class="btn-primary"
          :disabled="loading"
          @click="handleRegister"
        >
          {{ loading ? '注册中...' : '注册' }}
        </button>

        <view class="footer">
          <text class="link" @click="goLogin">已有账号？立即登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { register } from '@/utils/api'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')

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
      // 注册成功，跳转到首页
      uni.switchTab({
        url: '/pages/index/index'
      })
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

.container {
  max-width: 600rpx;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-top: 80rpx;
  margin-bottom: 60rpx;
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

.footer {
  margin-top: 32rpx;
  text-align: center;
}

.link {
  font-size: 26rpx;
  color: #143f3a;
  text-decoration: underline;
}
</style>
