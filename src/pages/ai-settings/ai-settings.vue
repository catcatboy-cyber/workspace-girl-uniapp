<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view v-if="loading" class="loading-v2">加载中...</view>

    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">{{ aiLabel() }} SETTINGS</text>
        <text class="hero-title-v2">{{ aiLabel() }} 事件分析设置</text>
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
          <switch :checked="enabled" :color="switchColor" @change="onEnabledChange" />
        </view>
        <text class="card-text-v2">AI 关闭或调用失败时，新记录会按主体不明、普通记录和零分保守保存。</text>
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
            <input v-model="model.name" class="input-v2" placeholder="例如：DeepSeek、混元" />
          </view>
          <view class="grid-two-v2">
            <view class="field-v2">
              <text class="field-label-v2">Provider</text>
              <input v-model="model.provider" class="input-v2" placeholder="如: deepseek / hunyuan" />
            </view>
            <view class="field-v2">
              <text class="field-label-v2">Model</text>
              <input v-model="model.model" class="input-v2" placeholder="deepseek-chat" />
            </view>
          </view>
          <view class="field-v2">
            <text class="field-label-v2">Base URL</text>
            <input v-model="model.baseUrl" class="input-v2" placeholder="https://api.deepseek.com/v1" />
          </view>
          <view class="field-v2">
            <text class="field-label-v2">API Key</text>
            <input v-model="model.apiKey" type="text" password class="input-v2" placeholder="sk-..." />
            <text v-if="model._hasStoredKey && !model.apiKey" class="card-text-v2">当前已保存 Key（{{ model._maskedKey }}），留空保持不变。</text>
            <text v-else-if="model.apiKey" class="card-text-v2">将使用此 Key 覆盖保存。</text>
            <text v-else class="card-text-v2">未配置 API Key。</text>
          </view>

          <button
            class="vision-model-toggle-v2"
            role="checkbox"
            :aria-checked="model.supportsVision"
            @click="toggleVisionModel(model)"
          >
            <view :class="['vision-model-check-v2', model.supportsVision ? 'checked' : '']">
              <text v-if="model.supportsVision">✓</text>
            </view>
            <view class="vision-model-copy-v2">
              <text class="vision-model-label-v2">视觉模型</text>
              <text class="vision-model-hint-v2">勾选后，微信聊天截图识别会优先调用此模型</text>
            </view>
          </button>

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
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAISettings, updateAISettings, testAIConnection, getCurrentUserId } from '@/utils/api'
import { showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

let modelIdCounter = 1

type EditableModel = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  supportsVision: boolean
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
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: '',
    apiKey: '',
    supportsVision: false,
    _hasStoredKey: false,
    _maskedKey: ''
  }
}

const loading = ref(true)
const submitting = ref(false)
const saved = ref(false)
const enabled = ref(false)
const models = ref<EditableModel[]>([])
const defaultModelId = ref('')

const tested = ref(false)
const testOk = ref(false)
const testMessage = ref('')
const testModelName = ref('')
const testSummary = ref('')

const testingId = ref('')
const themeVars = ref(getThemeStyle())
const switchColor = computed(() => themeVars.value['--accent-cool'] || themeVars.value['--primary-2'] || themeVars.value['--primary'])

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
    const m = createEmptyModel()
    m.name = '默认模型'
    models.value = [m]
    defaultModelId.value = m.id
    return
  }

  enabled.value = Boolean(settings.aiEnabled)

  if (settings.settingsVersion === 2 && Array.isArray(settings.aiModels)) {
    models.value = settings.aiModels.map((m: any) => ({
      id: m.id || generateModelId(),
      name: m.name || '',
      provider: m.provider || 'deepseek',
      baseUrl: m.baseUrl || 'https://api.deepseek.com/v1',
      model: m.model || '',
      apiKey: '',
      supportsVision: m.supportsVision === true,
      _hasStoredKey: Boolean(m.apiKey),
      _maskedKey: m.apiKey ? redactKey(m.apiKey) : ''
    }))
    defaultModelId.value = settings.aiDefaultModelId || (settings.aiModels[0]?.id || '')
  } else {
    // 旧版格式兼容
    const m = createEmptyModel()
    m.name = '默认模型'
    m.provider = settings.aiProvider || 'deepseek'
    m.baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com/v1'
    m.model = settings.aiModel || 'deepseek-chat'
    m.supportsVision = false
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

function toggleVisionModel(model: EditableModel) {
  model.supportsVision = !model.supportsVision
  saved.value = false
}

function collectNonEmptyModels() {
  return models.value.map((m) => ({
    id: m.id,
    name: m.name || '未命名模型',
    provider: m.provider || 'deepseek',
    baseUrl: m.baseUrl || 'https://api.deepseek.com/v1',
    model: m.model || 'deepseek-chat',
    apiKey: m.apiKey || '',
    supportsVision: m.supportsVision === true
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
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 18rpx); box-sizing: border-box; }

/* V2 Mode */
.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: $fs-heading; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); letter-spacing: 4rpx; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
  transform: var(--hero-transform, rotate(-0.5deg));
}
.v2-mode .hero-tag-v2 {
  display: inline-block;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  padding: 6rpx 16rpx;
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.v2-mode .hero-title-v2 {
  display: block;
  font-size: $fs-hero-title;
  font-weight: var(--font-weight-hero, $fw-hero);
  color: var(--hero-text-color, #111);
  line-height: $lh-hero;
  letter-spacing: -2rpx;
  text-transform: uppercase;
}
.v2-mode .hero-copy-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: var(--text-muted, rgba(0,0,0,0.7));
  line-height: $lh-loose;
  margin-top: 8rpx;
}

.v2-mode .card-v2 {
  background: var(--surface, #fff);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
}
.v2-mode .section-title-v2 {
  display: block;
  font-size: $fs-body;
  font-weight: var(--font-weight-hero, $fw-hero);
  color: var(--text-main, #111);
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 10rpx;
}
.v2-mode .card-text-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
  line-height: $lh-loose;
  margin: 6rpx 0;
}
.v2-mode .section-head-v2 { margin-bottom: 20rpx; }

/* Notice blocks */
.v2-mode .notice-v2 {
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
}
.v2-mode .notice-v2.ok {
  background: var(--success-soft, #E0FFF0);
  border-left: 12rpx solid var(--accent-cool, #4ECDC4);
}
.v2-mode .notice-v2.warn {
  background: var(--risk-soft, #FFEEEC);
  border-left: 12rpx solid var(--hero-bg, #FF6B6B);
}

/* Switch rows */
.v2-mode .switch-row-v2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: var(--border-width, 2rpx) solid var(--divider-strong, #111);
}
.v2-mode .switch-row-v2:last-child { border-bottom: 0; }
.v2-mode .switch-label-v2 {
  flex: 1;
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  color: var(--text-main, #111);
  line-height: 1.5;
}

/* Model cards */
.v2-mode .model-card-v2 {
  background: var(--surface-dim, #f9f9f9);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 4rpx 4rpx 0 var(--border, #111);
}
.v2-mode .model-header-v2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: var(--border-width, 2rpx) solid var(--divider-strong, #111);
}
.v2-mode .model-name-row-v2 {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.v2-mode .default-badge-v2 {
  padding: 4rpx 14rpx;
  font-size: $fs-body;
  font-weight: var(--font-weight-hero, $fw-hero);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  color: var(--text-muted, #666);
  cursor: pointer;
}
.v2-mode .default-badge-v2.active {
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
}
.v2-mode .model-label-v2 {
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
  color: var(--text-main, #111);
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
  color: var(--text-main, #111);
  margin-bottom: 8rpx;
}
.v2-mode .input-v2 {
  width: 100%;
  height: 72rpx;
  padding: 0 22rpx;
  background: var(--surface, #fff);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: var(--text-main, #111);
  box-sizing: border-box;
}
.v2-mode .grid-two-v2 { display: flex; gap: 16rpx; }
.v2-mode .grid-two-v2 .field-v2 { flex: 1; }
.v2-mode .vision-model-toggle-v2 {
  width: 100%;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 16rpx;
  margin: 16rpx 0;
  text-align: left;
  color: var(--text-main, #111);
  background: var(--surface, #fff);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  box-sizing: border-box;
  cursor: pointer;
}
.v2-mode .vision-model-toggle-v2::after { border: 0; }
.v2-mode .vision-model-check-v2 {
  width: 36rpx;
  height: 36rpx;
  flex: 0 0 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  box-sizing: border-box;
  font-size: $fs-caption;
  font-weight: $fw-heading;
}
.v2-mode .vision-model-check-v2.checked { background: var(--accent-cool, #4ECDC4); }
.v2-mode .vision-model-copy-v2 { min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.v2-mode .vision-model-label-v2 { font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); }
.v2-mode .vision-model-hint-v2 { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.4; }

/* Actions */
.v2-mode .actions-v2 { display: flex; gap: 12rpx; align-items: center; flex-wrap: wrap; }
.v2-mode .actions-v2.vertical { flex-direction: column; }

/* Buttons */

/* Test result */
.v2-mode .test-result-v2 { font-size: $fs-body-lg; font-weight: $fw-label; }
.v2-mode .test-result-v2.pass { color: var(--success-text, #4ECDC4); }
.v2-mode .test-result-v2.fail { color: var(--risk, #FF5252); }
</style>
