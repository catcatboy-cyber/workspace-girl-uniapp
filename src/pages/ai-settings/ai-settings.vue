<template>
  <view class="page">
    <view v-if="loading" class="muted center">加载中...</view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">Settings / AI</text>
        <text class="h1">AI 事件研判设置</text>
        <text class="hero-subtext">配置模型、Base URL 和 API Key。配置后，新增时间线事件时会优先用 AI 做结构化事件理解；失败时可回退到规则模式。</text>
      </view>

      <view v-if="saved" class="card status-card success">
        <text class="status-title">设置已保存</text>
        <text class="muted">新的模型 / Base URL / Key 已写入配置。</text>
      </view>

      <view v-if="tested" :class="['card', 'status-card', testOk ? 'success' : 'warning']">
        <text class="status-title">{{ testOk ? '✅ 连接测试成功' : '⚠️ 连接测试失败' }}</text>
        <text class="muted">{{ testMessage || (testOk ? '模型接口可用，并已返回结构化 JSON。' : '当前没有拿到有效测试结果。') }}</text>
        <text v-if="testModel" class="muted">模型：{{ testModel }}</text>
        <text v-if="testSummary" class="muted">返回摘要：{{ testSummary }}</text>
      </view>

      <view class="card">
        <text class="h2">启用状态</text>
        <view class="switch-row">
          <text class="switch-label">启用 AI 事件研判</text>
          <switch :checked="form.enabled" color="#143f3a" @change="onEnabledChange" />
        </view>
        <view class="switch-row">
          <text class="switch-label">AI 调用失败时自动回退规则模式</text>
          <switch :checked="form.fallbackToRules" color="#143f3a" @change="onFallbackChange" />
        </view>
      </view>

      <view class="card">
        <text class="h2">模型连接配置</text>
        <view class="field">
          <text class="field-label">Provider</text>
          <input v-model="form.provider" class="text-input" placeholder="openai-compatible" />
        </view>
        <view class="field">
          <text class="field-label">Model</text>
          <input v-model="form.model" class="text-input" placeholder="例如：gpt-4o-mini" />
        </view>
        <view class="field">
          <text class="field-label">Base URL</text>
          <input v-model="form.baseUrl" class="text-input" placeholder="https://api.openai.com/v1" />
        </view>
        <view class="field">
          <text class="field-label">API Key</text>
          <input v-model="form.apiKey" type="text" password class="text-input" placeholder="sk-..." />
          <text v-if="hasStoredApiKey" class="muted">当前已保存：{{ maskedApiKey }}。这里留空则保持不变。</text>
          <text v-else class="muted">当前未保存 API Key。</text>
        </view>
      </view>

      <view class="card">
        <text class="h2">当前状态</text>
        <view class="kpis">
          <view class="kpi-item">
            <text class="kpi-label">AI 开关</text>
            <text class="kpi-value">{{ form.enabled ? 'ON' : 'OFF' }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">当前模型</text>
            <text class="kpi-value small">{{ form.model || '--' }}</text>
          </view>
        </view>
        <text class="muted">API Key 状态：{{ hasStoredApiKey || form.apiKey ? '已配置' : '未配置' }} / Fallback：{{ form.fallbackToRules ? '开启' : '关闭' }}</text>
      </view>

      <view class="card">
        <view class="actions vertical">
          <button class="btn-primary" :disabled="submitting" @click="onSave">
            {{ submitting ? '保存中...' : '保存 AI 设置' }}
          </button>
          <button class="btn-secondary" :disabled="testing" @click="onTest">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <text class="muted">测试连接最长等待约 15 秒，超时会直接返回错误提示。</text>
          <button class="btn-secondary" @click="goBack">返回</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAISettings, updateAISettings, testAIConnection, getCurrentUserId } from '@/utils/api'
import { showError, showSuccess } from '@/utils/helpers'

const loading = ref(true)
const submitting = ref(false)
const testing = ref(false)
const saved = ref(false)
const tested = ref(false)
const testOk = ref(false)
const testMessage = ref('')
const testModel = ref('')
const testSummary = ref('')
const hasStoredApiKey = ref(false)
const maskedApiKey = ref('')

const defaultForm = () => ({
  enabled: false,
  provider: 'openai-compatible',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  fallbackToRules: true
})

const form = ref(defaultForm())

onMounted(() => {
  loadData()
})

function redactKey(key: string) {
  if (!key) return ''
  if (key.length <= 4) return '***'
  return `***${key.slice(-4)}`
}

function applySettings(settings: any) {
  if (!settings) {
    form.value = defaultForm()
    hasStoredApiKey.value = false
    maskedApiKey.value = ''
    return
  }

  hasStoredApiKey.value = Boolean(settings.aiApiKey)
  maskedApiKey.value = settings.aiApiKey || ''
  form.value = {
    enabled: Boolean(settings.aiEnabled),
    provider: settings.aiProvider || 'openai-compatible',
    apiKey: '',
    baseUrl: settings.aiBaseUrl || 'https://api.openai.com/v1',
    model: settings.aiModel || 'gpt-4o-mini',
    fallbackToRules: settings.aiFallbackToRules !== false
  }
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loading.value = true
  try {
    const settings = await getAISettings(uid)
    applySettings(settings)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onEnabledChange(e: any) {
  form.value.enabled = Boolean(e.detail.value)
}

function onFallbackChange(e: any) {
  form.value.fallbackToRules = Boolean(e.detail.value)
}

async function onSave() {
  const uid = getCurrentUserId()
  if (!uid) return

  submitting.value = true
  saved.value = false
  try {
    const apiKey = form.value.apiKey.trim()
    await updateAISettings({
      userId: uid,
      aiEnabled: form.value.enabled,
      aiProvider: form.value.provider,
      ...(apiKey ? { aiApiKey: apiKey } : {}),
      aiBaseUrl: form.value.baseUrl,
      aiModel: form.value.model,
      aiFallbackToRules: form.value.fallbackToRules
    })
    if (apiKey) {
      hasStoredApiKey.value = true
      maskedApiKey.value = redactKey(apiKey)
      form.value.apiKey = ''
    }
    saved.value = true
    showSuccess('设置已保存')
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function onTest() {
  const uid = getCurrentUserId()
  if (!uid) return

  if (!form.value.apiKey.trim() && !hasStoredApiKey.value) {
    showError('请先配置 API Key')
    return
  }

  testing.value = true
  tested.value = false

  try {
    const result = await testAIConnection({
      userId: uid,
      aiProvider: form.value.provider,
      ...(form.value.apiKey.trim() ? { aiApiKey: form.value.apiKey.trim() } : {}),
      aiBaseUrl: form.value.baseUrl,
      aiModel: form.value.model
    })

    tested.value = true
    testOk.value = result.success
    testMessage.value = result.message
    testModel.value = result.model || ''
    testSummary.value = result.summary || ''

    if (result.success) {
      showSuccess('连接测试成功')
    } else {
      showError(result.message)
    }
  } catch (e: any) {
    tested.value = true
    testOk.value = false
    testMessage.value = e?.message || '测试失败'
    showError('测试连接失败')
  } finally {
    testing.value = false
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 60rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; letter-spacing: 2rpx; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 12rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; margin-top: 8rpx; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }

.status-card { border-left: 8rpx solid #143f3a; }
.status-card.success { border-left-color: #14633a; background: #dff5e8; }
.status-card.warning { border-left-color: #b85c38; background: #f9d8d2; }
.status-title { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin-bottom: 8rpx; }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; margin: 16rpx 0; }
.switch-label { flex: 1; font-size: 26rpx; color: #241b12; line-height: 1.5; }

.field { margin: 20rpx 0; }
.field-label { display: block; font-size: 24rpx; color: #241b12; margin-bottom: 8rpx; }
.text-input { width: 100%; height: 72rpx; padding: 0 22rpx; background: #fff; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 26rpx; color: #241b12; box-sizing: border-box; }

.kpis { display: flex; gap: 16rpx; margin: 16rpx 0; }
.kpi-item { flex: 1; background: #fff; border-radius: 12rpx; padding: 20rpx; }
.kpi-label { display: block; font-size: 22rpx; color: #786857; }
.kpi-value { display: block; font-size: 36rpx; font-weight: 700; color: #143f3a; margin-top: 4rpx; }
.kpi-value.small { font-size: 28rpx; }

.actions { display: flex; gap: 12rpx; }
.actions.vertical { flex-direction: column; }
.btn-primary { height: 80rpx; line-height: 80rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.btn-secondary { height: 80rpx; line-height: 80rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; }
</style>
