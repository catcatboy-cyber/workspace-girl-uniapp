<template>
  <view class="page">
    <view v-if="loading" class="muted center">加载中...</view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">Settings / AI</text>
        <text class="h1">AI 事件研判设置</text>
        <text class="hero-subtext">支持配置多个模型，可随时切换默认使用的模型。新增时间线事件时会优先用 AI 做结构化事件理解。</text>
      </view>

      <!-- 保存/测试结果反馈 -->
      <view v-if="saved" class="card status-card success">
        <text class="status-title">设置已保存</text>
        <text class="muted">模型配置和默认模型已更新。</text>
      </view>

      <view v-if="tested" :class="['card', 'status-card', testOk ? 'success' : 'warning']">
        <text class="status-title">{{ testOk ? '✅ 连接测试成功' : '⚠️ 连接测试失败' }}</text>
        <text class="muted">{{ testMessage || (testOk ? '模型接口可用。' : '当前没有拿到有效测试结果。') }}</text>
        <text v-if="testModelName" class="muted">模型：{{ testModelName }}</text>
        <text v-if="testSummary" class="muted">返回摘要：{{ testSummary }}</text>
      </view>

      <!-- 启用状态 -->
      <view class="card">
        <text class="h2">启用状态</text>
        <view class="switch-row">
          <text class="switch-label">启用 AI 事件研判</text>
          <switch :checked="enabled" color="#143f3a" @change="onEnabledChange" />
        </view>
        <view class="switch-row">
          <text class="switch-label">AI 调用失败时自动回退规则模式</text>
          <switch :checked="fallbackToRules" color="#143f3a" @change="onFallbackChange" />
        </view>
      </view>

      <!-- 模型列表 -->
      <view class="card">
        <view class="section-head">
          <text class="h2">模型配置</text>
          <text class="muted">默认模型会在 AI 事件分析中使用。可添加多个模型以便切换。</text>
          <text class="muted">切换模型时，点击对应卡片左侧“设为默认”，再点底部“保存所有设置”。</text>
        </view>

        <view v-for="(model, index) in models" :key="model.id" class="model-card">
          <view class="model-header">
            <view class="model-name-row">
              <view
                class="default-badge"
                :class="{ active: defaultModelId === model.id }"
                @click="setDefault(model.id)"
              >
                {{ defaultModelId === model.id ? '⭐ 默认' : '○ 设为默认' }}
              </view>
              <text class="model-label">{{ model.name || '未命名模型' }}</text>
            </view>
            <view v-if="models.length > 1" class="model-actions">
              <text class="delete-btn" @click="removeModel(index)">删除</text>
            </view>
          </view>

          <view class="field">
            <text class="field-label">名称</text>
            <input v-model="model.name" class="text-input" placeholder="例如：GPT-4o、Claude" />
          </view>
          <view class="grid two">
            <view class="field">
              <text class="field-label">Provider</text>
              <input v-model="model.provider" class="text-input" placeholder="openai-compatible" />
            </view>
            <view class="field">
              <text class="field-label">Model</text>
              <input v-model="model.model" class="text-input" placeholder="gpt-4o-mini" />
            </view>
          </view>
          <view class="field">
            <text class="field-label">Base URL</text>
            <input v-model="model.baseUrl" class="text-input" placeholder="https://api.openai.com/v1" />
          </view>
          <view class="field">
            <text class="field-label">API Key</text>
            <input v-model="model.apiKey" type="text" password class="text-input" placeholder="sk-..." />
            <text v-if="model._hasStoredKey && !model.apiKey" class="muted">当前已保存 Key（{{ model._maskedKey }}），留空保持不变。</text>
            <text v-else-if="model.apiKey" class="muted">将使用此 Key 覆盖保存。</text>
            <text v-else class="muted">未配置 API Key。</text>
          </view>

          <view class="actions">
            <button class="btn-secondary compact" :disabled="testingId === model.id" @click="runModelTest(model)">
              {{ testingId === model.id ? '测试中...' : '测试连接' }}
            </button>
            <text v-if="model._lastTestResult !== undefined" class="test-result" :class="model._lastTestResult ? 'pass' : 'fail'">
              {{ model._lastTestResult ? '✅ 测试通过' : '❌ 测试失败' }}
            </text>
          </view>
        </view>

        <view class="actions" style="margin-top: 20rpx;">
          <button class="btn-secondary" @click="addModel">+ 添加模型</button>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="card">
        <view class="actions vertical">
          <button class="btn-primary" :disabled="submitting" @click="onSave">
            {{ submitting ? '保存中...' : '保存所有设置' }}
          </button>
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

let modelIdCounter = 1

type EditableModel = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  _hasStoredKey?: boolean
  _maskedKey?: string
  _lastTestResult?: boolean
}

function generateModelId() {
  return `model_${Date.now()}_${modelIdCounter++}`
}

function createEmptyModel(): EditableModel {
  return {
    id: generateModelId(),
    name: '',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    apiKey: '',
    _hasStoredKey: false,
    _maskedKey: ''
  }
}

const loading = ref(true)
const submitting = ref(false)
const saved = ref(false)
const enabled = ref(false)
const fallbackToRules = ref(true)
const models = ref<EditableModel[]>([])
const defaultModelId = ref('')

const tested = ref(false)
const testOk = ref(false)
const testMessage = ref('')
const testModelName = ref('')
const testSummary = ref('')

const testingId = ref('')

onMounted(() => {
  loadData()
})

function redactKey(key: string) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return `***${key.slice(-4)}`
}

function applySettings(settings: any) {
  if (!settings) {
    enabled.value = false
    fallbackToRules.value = true
    const m = createEmptyModel()
    m.name = '默认模型'
    models.value = [m]
    defaultModelId.value = m.id
    return
  }

  enabled.value = Boolean(settings.aiEnabled)
  fallbackToRules.value = settings.aiFallbackToRules !== false

  if (settings.settingsVersion === 2 && Array.isArray(settings.aiModels)) {
    models.value = settings.aiModels.map((m: any) => ({
      id: m.id || generateModelId(),
      name: m.name || '',
      provider: m.provider || 'openai-compatible',
      baseUrl: m.baseUrl || 'https://api.openai.com/v1',
      model: m.model || '',
      apiKey: '',
      _hasStoredKey: Boolean(m.apiKey),
      _maskedKey: m.apiKey ? redactKey(m.apiKey) : ''
    }))
    defaultModelId.value = settings.aiDefaultModelId || (settings.aiModels[0]?.id || '')
  } else {
    // 旧版格式兼容
    const m = createEmptyModel()
    m.name = '默认模型'
    m.provider = settings.aiProvider || 'openai-compatible'
    m.baseUrl = settings.aiBaseUrl || 'https://api.openai.com/v1'
    m.model = settings.aiModel || 'gpt-4o-mini'
    m._hasStoredKey = Boolean(settings.aiApiKey)
    m._maskedKey = settings.aiApiKey ? redactKey(settings.aiApiKey) : ''
    models.value = [m]
    defaultModelId.value = m.id
  }

  if (!models.value.find((m) => m.id === defaultModelId.value)) {
    defaultModelId.value = models.value[0]?.id || ''
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
  enabled.value = Boolean(e.detail.value)
}

function onFallbackChange(e: any) {
  fallbackToRules.value = Boolean(e.detail.value)
}

function addModel() {
  models.value.push(createEmptyModel())
}

function removeModel(index: number) {
  const removed = models.value[index]
  models.value.splice(index, 1)

  // 如果删除的是默认模型，重新设置
  if (removed.id === defaultModelId.value && models.value.length > 0) {
    defaultModelId.value = models.value[0].id
  }
}

function setDefault(modelId: string) {
  defaultModelId.value = modelId
  saved.value = false
}

function collectNonEmptyModels() {
  return models.value.map((m) => ({
    id: m.id,
    name: m.name || '未命名模型',
    provider: m.provider || 'openai-compatible',
    baseUrl: m.baseUrl || 'https://api.openai.com/v1',
    model: m.model || 'gpt-4o-mini',
    apiKey: m.apiKey || ''
  }))
}

async function onSave() {
  const uid = getCurrentUserId()
  if (!uid) return

  submitting.value = true
  saved.value = false
  try {
    const collected = collectNonEmptyModels()
    await updateAISettings({
      userId: uid,
      aiEnabled: enabled.value,
      aiFallbackToRules: fallbackToRules.value,
      models: collected,
      defaultModelId: defaultModelId.value
    })

    // 清空已提交的 apiKey 显示
    models.value.forEach((m) => {
      if (m.apiKey) {
        m._hasStoredKey = true
        m._maskedKey = redactKey(m.apiKey)
        m.apiKey = ''
      }
    })

    await loadData()
    saved.value = true
    showSuccess('设置已保存')
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function runModelTest(model: EditableModel) {
  const uid = getCurrentUserId()
  if (!uid) return

  const hasUsableKey = Boolean(model.apiKey || model._hasStoredKey)
  if (!hasUsableKey) {
    showError('请先填写此模型的 API Key')
    return
  }

  testingId.value = model.id
  tested.value = false
  testMessage.value = ''
  testSummary.value = ''
  testModelName.value = model.name || model.model || model.id

  try {
    if (models.value.some((item) => item.apiKey)) {
      // 仅在存在新输入 key 时先保存，避免把已存 key 覆盖成空字符串。
      const allModels = collectNonEmptyModels()
      await updateAISettings({
        userId: uid,
        aiEnabled: enabled.value,
        aiFallbackToRules: fallbackToRules.value,
        models: allModels,
        defaultModelId: defaultModelId.value
      })
    }

    const result = await testAIConnection({
      userId: uid,
      modelId: model.id
    })

    tested.value = true
    testOk.value = Boolean(result.success)
    testMessage.value = result.message || (result.success ? '连接成功' : '测试失败')
    testModelName.value = result.model || model.name || model.model || model.id
    testSummary.value = result.summary || ''

    model._lastTestResult = result.success

    if (result.success) {
      showSuccess(`"${model.name || model.model || model.id}" 连接成功`)
    } else {
      showError(`"${model.name || model.model || model.id}" 测试失败：${result.message}`)
    }
  } catch (e: any) {
    tested.value = true
    testOk.value = false
    testMessage.value = e?.message || '测试失败'
    testSummary.value = ''
    model._lastTestResult = false
    showError(e?.message || '测试失败')
  } finally {
    testingId.value = ''
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

.section-head { margin-bottom: 20rpx; }

.status-card { border-left: 8rpx solid #143f3a; }
.status-card.success { border-left-color: #14633a; background: #dff5e8; }
.status-card.warning { border-left-color: #b85c38; background: #f9d8d2; }
.status-title { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin-bottom: 8rpx; }

.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; margin: 16rpx 0; }
.switch-label { flex: 1; font-size: 26rpx; color: #241b12; line-height: 1.5; }

.model-card {
  background: #fff;
  border: 2rpx solid #e5ddd0;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.default-badge {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  border: 2rpx solid #e5ddd0;
  color: #786857;
}

.default-badge.active {
  background: #143f3a;
  color: #fff;
  border-color: #143f3a;
}

.model-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #241b12;
}

.model-actions {
  display: flex;
  gap: 8rpx;
}

.delete-btn {
  color: #b85c38;
  font-size: 24rpx;
  padding: 4rpx 12rpx;
}

.field { margin: 16rpx 0; }
.field-label { display: block; font-size: 24rpx; color: #241b12; margin-bottom: 8rpx; }
.text-input { width: 100%; height: 72rpx; padding: 0 22rpx; background: #fbf6ee; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 26rpx; color: #241b12; box-sizing: border-box; }

.grid.two { display: flex; gap: 16rpx; }
.grid.two .field { flex: 1; }

.actions { display: flex; gap: 12rpx; align-items: center; flex-wrap: wrap; }
.actions.vertical { flex-direction: column; }

.btn-primary { height: 80rpx; line-height: 80rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.btn-secondary { height: 80rpx; line-height: 80rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; }
.btn-secondary.compact { height: 56rpx; line-height: 56rpx; font-size: 24rpx; padding: 0 20rpx; }

.test-result { font-size: 24rpx; font-weight: 500; }
.test-result.pass { color: #14633a; }
.test-result.fail { color: #b85c38; }
</style>
