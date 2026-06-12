<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view v-if="loading" class="loading-v2">加载中...</view>

    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">AI SETTINGS</text>
        <text class="hero-title-v2">AI 事件分析设置</text>
        <text class="hero-copy-v2">支持配置多个模型，可随时切换默认使用的模型。新增往事记录时会优先用 AI 做结构化事件理解。</text>
      </view>

      <!-- 保存/测试结果反馈 -->
      <view v-if="saved" class="notice-v2 ok">
        <text class="section-title-v2">设置已保存</text>
        <text class="card-text-v2">模型配置和默认模型已更新。</text>
      </view>

      <view v-if="tested" :class="['notice-v2', testOk ? 'ok' : 'warn']">
        <text class="section-title-v2">{{ testOk ? '连接测试成功' : '连接测试失败' }}</text>
        <text class="card-text-v2">{{ testMessage || (testOk ? '模型接口可用。' : '当前没有拿到有效测试结果。') }}</text>
        <text v-if="testModelName" class="card-text-v2">模型：{{ testModelName }}</text>
        <text v-if="testSummary" class="card-text-v2">返回摘要：{{ testSummary }}</text>
      </view>

      <!-- 启用状态 -->
      <view class="card-v2">
        <text class="section-title-v2">启用状态</text>
        <view class="switch-row-v2">
          <text class="switch-label-v2">启用 AI 事件分析</text>
          <switch :checked="enabled" color="#4ECDC4" @change="onEnabledChange" />
        </view>
        <view class="switch-row-v2">
          <text class="switch-label-v2">AI 调用失败时自动回退规则模式</text>
          <switch :checked="fallbackToRules" color="#4ECDC4" @change="onFallbackChange" />
        </view>
      </view>

      <!-- 模型列表 -->
      <view class="card-v2">
        <view class="section-head-v2">
          <text class="section-title-v2">模型配置</text>
          <text class="card-text-v2">默认模型会在 AI 事件分析中使用。可添加多个模型以便切换。</text>
          <text class="card-text-v2">切换模型时，点击对应卡片左侧"设为默认"，再点底部"保存所有设置"。</text>
        </view>

        <view v-for="(model, index) in models" :key="model.id" class="model-card-v2">
          <view class="model-header-v2">
            <view class="model-name-row-v2">
              <view
                class="default-badge-v2"
                :class="{ active: defaultModelId === model.id }"
                @click="setDefault(model.id)"
              >
                {{ defaultModelId === model.id ? '默认' : '设为默认' }}
              </view>
              <text class="model-label-v2">{{ model.name || '未命名模型' }}</text>
            </view>
            <view v-if="models.length > 1" class="model-actions-v2">
              <text class="btn btn-danger btn-sm" style="display:inline-flex;padding:4rpx 12rpx;" @click="removeModel(index)">删除</text>
            </view>
          </view>

          <view class="field-v2">
            <text class="field-label-v2">名称</text>
            <input v-model="model.name" class="input-v2" placeholder="例如：GPT-4o、Claude" />
          </view>
          <view class="grid-two-v2">
            <view class="field-v2">
              <text class="field-label-v2">Provider</text>
              <input v-model="model.provider" class="input-v2" placeholder="openai-compatible" />
            </view>
            <view class="field-v2">
              <text class="field-label-v2">Model</text>
              <input v-model="model.model" class="input-v2" placeholder="gpt-4o-mini" />
            </view>
          </view>
          <view class="field-v2">
            <text class="field-label-v2">Base URL</text>
            <input v-model="model.baseUrl" class="input-v2" placeholder="https://api.openai.com/v1" />
          </view>
          <view class="field-v2">
            <text class="field-label-v2">API Key</text>
            <input v-model="model.apiKey" type="text" password class="input-v2" placeholder="sk-..." />
            <text v-if="model._hasStoredKey && !model.apiKey" class="card-text-v2">当前已保存 Key（{{ model._maskedKey }}），留空保持不变。</text>
            <text v-else-if="model.apiKey" class="card-text-v2">将使用此 Key 覆盖保存。</text>
            <text v-else class="card-text-v2">未配置 API Key。</text>
          </view>

          <view class="actions-v2">
            <button class="btn btn-secondary btn-sm btn-auto" :disabled="testingId === model.id" @click="runModelTest(model)">
              {{ testingId === model.id ? '测试中...' : '测试连接' }}
            </button>
            <text v-if="model._lastTestResult !== undefined" class="test-result-v2" :class="model._lastTestResult ? 'pass' : 'fail'">
              {{ model._lastTestResult ? '测试通过' : '测试失败' }}
            </text>
          </view>
        </view>

        <view class="actions-v2" style="margin-top: 20rpx;">
          <button class="btn btn-secondary btn-sm btn-auto" @click="addModel">+ 添加模型</button>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="card-v2">
        <view class="actions-v2 vertical">
          <button class="btn btn-primary btn-lg btn-full" :disabled="submitting" @click="onSave">
            {{ submitting ? '保存中...' : '保存所有设置' }}
          </button>
          <button class="btn btn-secondary btn-lg btn-full" @click="goBack">返回</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAISettings, updateAISettings, testAIConnection, getCurrentUserId } from '@/utils/api'
import { showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

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
const themeVars = ref(getThemeStyle())

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
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

<style scoped lang="scss">
.page { min-height: 100vh; background: #f4ede2; padding: 18rpx; box-sizing: border-box; }

/* V2 Mode */
.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B);
  border: 3rpx solid #111;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 8rpx 8rpx 0 #111;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 {
  display: inline-block;
  background: #111;
  color: #FFD93D;
  padding: 6rpx 16rpx;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.v2-mode .hero-title-v2 {
  display: block;
  font-size: $fs-hero-title;
  font-weight: $fw-hero;
  color: #111;
  line-height: $lh-hero;
  letter-spacing: -2rpx;
  text-transform: uppercase;
}
.v2-mode .hero-copy-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: rgba(0,0,0,0.7);
  line-height: $lh-loose;
  margin-top: 8rpx;
}

.v2-mode .card-v2 {
  background: #fff;
  border: 3rpx solid #111;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 6rpx 6rpx 0 #111;
}
.v2-mode .section-title-v2 {
  display: block;
  font-size: $fs-body;
  font-weight: $fw-hero;
  color: #111;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 10rpx;
}
.v2-mode .card-text-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: #666;
  line-height: $lh-loose;
  margin: 6rpx 0;
}
.v2-mode .section-head-v2 { margin-bottom: 20rpx; }

/* Notice blocks */
.v2-mode .notice-v2 {
  border: 3rpx solid #111;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 6rpx 6rpx 0 #111;
}
.v2-mode .notice-v2.ok {
  background: #E0FFF0;
  border-left: 12rpx solid #4ECDC4;
}
.v2-mode .notice-v2.warn {
  background: #FFEEEC;
  border-left: 12rpx solid #FF6B6B;
}

/* Switch rows */
.v2-mode .switch-row-v2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: 2rpx solid #111;
}
.v2-mode .switch-row-v2:last-child { border-bottom: 0; }
.v2-mode .switch-label-v2 {
  flex: 1;
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  color: #111;
  line-height: 1.5;
}

/* Model cards */
.v2-mode .model-card-v2 {
  background: #f9f9f9;
  border: 2rpx solid #111;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 4rpx 4rpx 0 #111;
}
.v2-mode .model-header-v2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #111;
}
.v2-mode .model-name-row-v2 {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.v2-mode .default-badge-v2 {
  padding: 4rpx 14rpx;
  font-size: $fs-body;
  font-weight: $fw-hero;
  border: 2rpx solid #111;
  color: #666;
  cursor: pointer;
}
.v2-mode .default-badge-v2.active {
  background: #111;
  color: #FFD93D;
}
.v2-mode .model-label-v2 {
  font-size: $fs-heading;
  font-weight: $fw-hero;
  color: #111;
}
.v2-mode .model-actions-v2 {
  display: flex;
  gap: 8rpx;
}

/* Form fields */
.v2-mode .field-v2 { margin: 16rpx 0; }
.v2-mode .field-label-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  color: #111;
  margin-bottom: 8rpx;
}
.v2-mode .input-v2 {
  width: 100%;
  height: 72rpx;
  padding: 0 22rpx;
  background: #fff;
  border: 2rpx solid #111;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: #111;
  box-sizing: border-box;
}
.v2-mode .grid-two-v2 { display: flex; gap: 16rpx; }
.v2-mode .grid-two-v2 .field-v2 { flex: 1; }

/* Actions */
.v2-mode .actions-v2 { display: flex; gap: 12rpx; align-items: center; flex-wrap: wrap; }
.v2-mode .actions-v2.vertical { flex-direction: column; }

/* Buttons */

/* Test result */
.v2-mode .test-result-v2 { font-size: $fs-body-lg; font-weight: $fw-label; }
.v2-mode .test-result-v2.pass { color: #4ECDC4; }
.v2-mode .test-result-v2.fail { color: #FF5252; }
</style>
