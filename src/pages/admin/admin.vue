<template>
  <view class="admin-page">
    <view class="admin-shell">
      <view class="topbar">
        <view>
          <text class="eyebrow">Admin Console</text>
          <text class="title">后台管理</text>
        </view>
        <button class="ghost-btn" @click="refresh">刷新</button>
      </view>

      <view v-if="errorMessage" class="alert">
        <text>{{ errorMessage }}</text>
      </view>

      <view class="stats-grid">
        <view class="stat-card">
          <text class="stat-label">用户</text>
          <text class="stat-value">{{ stats.userCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">关系对象</text>
          <text class="stat-value">{{ stats.caseCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">AI 状态</text>
          <text class="stat-value">{{ stats.aiEnabled ? '已启用' : '未启用' }}</text>
        </view>
      </view>

      <view class="tabs">
        <button :class="['tab-btn', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">用户管理</button>
        <button :class="['tab-btn', activeTab === 'ai' ? 'active' : '']" @click="activeTab = 'ai'">AI 设置</button>
      </view>

      <view v-if="activeTab === 'users'" class="content-grid">
        <view class="panel">
          <view class="panel-head">
            <text class="panel-title">登录用户</text>
            <text class="panel-meta">{{ users.length }} 个账号</text>
          </view>
          <view class="table">
            <view class="table-row table-header">
              <text>账号</text>
              <text>方式</text>
              <text>对象</text>
              <text>权限</text>
            </view>
            <view
              v-for="user in users"
              :key="user.id"
              :class="['table-row', selectedUserId === user.id ? 'selected' : '']"
              @click="selectUser(user.id)"
            >
              <text class="mono">{{ user.email || user.phone || user.id }}</text>
              <text>{{ user.loginType || 'email' }}</text>
              <text>{{ user.caseCount }}</text>
              <text>{{ user.isAdmin ? '管理员' : '用户' }}</text>
            </view>
          </view>
        </view>

        <view class="panel">
          <view class="panel-head">
            <text class="panel-title">用户详情</text>
            <text class="panel-meta">{{ selectedUser?.email || selectedUser?.phone || '未选择' }}</text>
          </view>
          <view v-if="detailLoading" class="empty">正在读取用户数据...</view>
          <view v-else-if="!selectedDetail" class="empty">选择左侧用户查看关系对象和记录概况。</view>
          <view v-else>
            <view class="detail-line">
              <text class="detail-label">用户 ID</text>
              <text class="detail-value mono">{{ selectedDetail.user.id }}</text>
            </view>
            <view class="detail-line">
              <text class="detail-label">注册时间</text>
              <text class="detail-value">{{ formatDate(selectedDetail.user.createdAt) }}</text>
            </view>
            <view class="case-list">
              <view v-for="item in selectedDetail.cases" :key="item.id" class="case-item">
                <view>
                  <text class="case-name">{{ item.name }}</text>
                  <text class="case-meta">{{ formatDate(item.updatedAt || item.createdAt) }}</text>
                </view>
                <view class="case-counts">
                  <text>{{ item.assessmentCount }} 次评估</text>
                  <text>{{ item.timelineCount }} 条记录</text>
                </view>
              </view>
              <view v-if="selectedDetail.cases.length === 0" class="empty">暂无关系对象。</view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'ai'" class="panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">全局 AI 设置</text>
            <text class="panel-meta">支持多模型配置，默认模型会被时间线 AI 研判优先使用。</text>
          </view>
          <button class="ghost-btn wide-btn" @click="addModel">添加模型</button>
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">启用 AI 事件研判</text>
            <text class="field-desc">关闭后前台会回退到规则分析。</text>
          </view>
          <switch :checked="aiForm.aiEnabled" @change="onAIEnabledChange" />
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">AI 失败时回退规则</text>
            <text class="field-desc">建议保持开启，避免用户保存记录失败。</text>
          </view>
          <switch :checked="aiForm.aiFallbackToRules" @change="onFallbackChange" />
        </view>

        <view v-for="(model, index) in models" :key="model.id" class="model-card">
          <view class="model-head">
            <view>
              <text class="model-title">{{ model.name || model.model || '未命名模型' }}</text>
              <text class="model-subtitle">{{ model.provider }} / {{ model.model || '未填写模型名' }}</text>
            </view>
            <view class="model-actions">
              <button
                :class="['small-btn', defaultModelId === model.id ? 'active' : '']"
                @click="setDefaultModel(model.id)"
              >
                {{ defaultModelId === model.id ? '默认' : '设为默认' }}
              </button>
              <button class="small-btn" :disabled="testingModelId === model.id" @click="testModel(model)">
                {{ testingModelId === model.id ? '测试中' : '测试' }}
              </button>
              <button v-if="models.length > 1" class="small-btn danger" @click="removeModel(index)">删除</button>
            </view>
          </view>

          <view class="form-grid">
            <view class="field">
              <text>显示名称</text>
              <input v-model="model.name" placeholder="例如：GPT-4o" />
            </view>
            <view class="field">
              <text>供应商</text>
              <input v-model="model.provider" placeholder="openai-compatible" />
            </view>
            <view class="field wide">
              <text>Base URL</text>
              <input v-model="model.baseUrl" placeholder="https://api.openai.com/v1" />
            </view>
            <view class="field">
              <text>模型名</text>
              <input v-model="model.model" placeholder="gpt-4o-mini" />
            </view>
            <view class="field">
              <text>API Key</text>
              <input v-model="model.apiKey" password placeholder="留空则沿用已保存密钥" />
            </view>
          </view>

          <view class="model-foot">
            <text v-if="model.hasApiKey && !model.apiKey" class="hint">已保存密钥；留空保存时会继续沿用旧密钥。</text>
            <text v-if="model.testMessage" :class="['test-result', model.testOk ? 'pass' : 'fail']">{{ model.testMessage }}</text>
          </view>
        </view>

        <view v-if="saveMessage" class="save-message">{{ saveMessage }}</view>
        <button class="primary-btn" :disabled="savingAI" @click="saveAISettings">
          {{ savingAI ? '保存中...' : '保存 AI 设置' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  adminGetOverview,
  adminGetUserDetail,
  adminUpdateAISettings,
  getCurrentUserId,
  testAIConnection
} from '@/utils/api'

type AdminUser = {
  id: string
  email: string
  phone: string
  loginType: string
  role: string
  isAdmin: boolean
  caseCount: number
}

type AdminDetail = {
  user: {
    id: string
    email: string
    phone: string
    createdAt: string
  }
  cases: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
    assessmentCount: number
    timelineCount: number
  }>
}

type AdminAIModel = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey: boolean
  testMessage?: string
  testOk?: boolean
}

let modelIdCounter = 1

const activeTab = ref<'users' | 'ai'>('users')
const users = ref<AdminUser[]>([])
const selectedUserId = ref('')
const selectedDetail = ref<AdminDetail | null>(null)
const detailLoading = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const savingAI = ref(false)
const testingModelId = ref('')
const defaultModelId = ref('default')
const models = ref<AdminAIModel[]>([createEmptyModel('default')])
const stats = reactive({
  userCount: 0,
  caseCount: 0,
  aiEnabled: false
})
const aiForm = reactive({
  aiEnabled: false,
  aiFallbackToRules: true
})

const selectedUser = computed(() => users.value.find((user) => user.id === selectedUserId.value))

onShow(() => {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  refresh()
})

function generateModelId() {
  return `model_${Date.now()}_${modelIdCounter++}`
}

function createEmptyModel(id = generateModelId()): AdminAIModel {
  return {
    id,
    name: id === 'default' ? '默认模型' : '',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    hasApiKey: false
  }
}

function normalizeModel(raw: any, index: number): AdminAIModel {
  return {
    id: raw?.id || (index === 0 ? 'default' : generateModelId()),
    name: raw?.name || '',
    provider: raw?.provider || 'openai-compatible',
    baseUrl: raw?.baseUrl || 'https://api.openai.com/v1',
    model: raw?.model || 'gpt-4o-mini',
    apiKey: '',
    hasApiKey: Boolean(raw?.hasApiKey || raw?.apiKey)
  }
}

function applyOverview(result: any) {
  users.value = result.users || []
  stats.userCount = result.stats?.userCount || 0
  stats.caseCount = result.stats?.caseCount || 0
  stats.aiEnabled = Boolean(result.stats?.aiEnabled)

  const settings = result.aiSettings || {}
  aiForm.aiEnabled = Boolean(settings.aiEnabled)
  aiForm.aiFallbackToRules = settings.aiFallbackToRules !== false

  if (Array.isArray(settings.aiModels) && settings.aiModels.length > 0) {
    models.value = settings.aiModels.map(normalizeModel)
  } else {
    models.value = [createEmptyModel('default')]
  }

  defaultModelId.value = settings.aiDefaultModelId || models.value[0]?.id || 'default'
  if (!models.value.some((model) => model.id === defaultModelId.value)) {
    defaultModelId.value = models.value[0]?.id || 'default'
  }
}

async function refresh() {
  errorMessage.value = ''
  saveMessage.value = ''
  try {
    const result = await adminGetOverview()
    if (!result?.success) {
      errorMessage.value = result?.message || '后台数据读取失败'
      return
    }
    applyOverview(result)
  } catch (error: any) {
    errorMessage.value = error?.message || '后台数据读取失败'
  }
}

async function selectUser(userId: string) {
  selectedUserId.value = userId
  selectedDetail.value = null
  detailLoading.value = true
  errorMessage.value = ''
  try {
    const result = await adminGetUserDetail(userId)
    if (result?.success) {
      selectedDetail.value = result
    } else {
      errorMessage.value = result?.message || '用户详情读取失败'
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '用户详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

function onAIEnabledChange(event: any) {
  aiForm.aiEnabled = Boolean(event.detail?.value)
}

function onFallbackChange(event: any) {
  aiForm.aiFallbackToRules = Boolean(event.detail?.value)
}

function addModel() {
  const model = createEmptyModel()
  models.value.push(model)
  if (!defaultModelId.value) defaultModelId.value = model.id
}

function removeModel(index: number) {
  const removed = models.value[index]
  models.value.splice(index, 1)
  if (removed?.id === defaultModelId.value) {
    defaultModelId.value = models.value[0]?.id || ''
  }
}

function setDefaultModel(modelId: string) {
  defaultModelId.value = modelId
  saveMessage.value = ''
}

function collectModels() {
  return models.value.map((model, index) => ({
    id: model.id || (index === 0 ? 'default' : generateModelId()),
    name: model.name || '未命名模型',
    provider: model.provider || 'openai-compatible',
    baseUrl: model.baseUrl || 'https://api.openai.com/v1',
    model: model.model || 'gpt-4o-mini',
    apiKey: model.apiKey || ''
  }))
}

async function saveAISettings() {
  if (models.value.length === 0) {
    errorMessage.value = '至少保留一个 AI 模型'
    return
  }

  savingAI.value = true
  saveMessage.value = ''
  errorMessage.value = ''
  try {
    const result = await adminUpdateAISettings({
      aiEnabled: aiForm.aiEnabled,
      aiFallbackToRules: aiForm.aiFallbackToRules,
      defaultModelId: defaultModelId.value || models.value[0].id,
      models: collectModels()
    })
    if (!result?.success) {
      errorMessage.value = result?.message || 'AI 设置保存失败'
      return
    }
    saveMessage.value = 'AI 设置已保存'
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.message || 'AI 设置保存失败'
  } finally {
    savingAI.value = false
  }
}

async function testModel(model: AdminAIModel) {
  const hasUsableKey = Boolean(model.apiKey || model.hasApiKey)
  if (!hasUsableKey) {
    model.testOk = false
    model.testMessage = '请先填写 API Key'
    return
  }

  testingModelId.value = model.id
  model.testMessage = ''
  try {
    const result = model.apiKey
      ? await testAIConnection({
        aiProvider: model.provider,
        aiApiKey: model.apiKey,
        aiBaseUrl: model.baseUrl,
        aiModel: model.model
      })
      : await testAIConnection({ modelId: model.id })

    model.testOk = Boolean(result?.success)
    model.testMessage = result?.success
      ? `测试通过：${result.summary || result.model || '连接成功'}`
      : `测试失败：${result?.message || '连接失败'}`
  } catch (error: any) {
    model.testOk = false
    model.testMessage = `测试失败：${error?.message || '连接失败'}`
  } finally {
    testingModelId.value = ''
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #eef3ef;
  color: #17231f;
  padding: 24px;
  box-sizing: border-box;
}

.admin-shell {
  max-width: 1180px;
  margin: 0 auto;
}

.topbar,
.panel,
.stat-card {
  background: #fbfdfb;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(23, 35, 31, 0.06);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 24px;
  margin-bottom: 18px;
}

.eyebrow,
.panel-meta,
.stat-label,
.field-desc,
.hint,
.case-meta {
  display: block;
  color: #68766f;
  font-size: 13px;
  line-height: 1.5;
}

.title {
  display: block;
  margin-top: 4px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.15;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 18px;
}

.stat-value {
  display: block;
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

button {
  margin: 0;
}

.tab-btn,
.ghost-btn,
.primary-btn,
.small-btn {
  border-radius: 6px;
  font-size: 15px;
}

.tab-btn {
  width: auto;
  min-width: 120px;
  height: 42px;
  line-height: 42px;
  color: #26433b;
  background: #fbfdfb;
  border: 1px solid rgba(38, 67, 59, 0.16);
}

.tab-btn.active,
.primary-btn,
.small-btn.active {
  color: #fff;
  background: #123c36;
}

.ghost-btn {
  width: 88px;
  height: 38px;
  line-height: 38px;
  color: #123c36;
  background: #eef6f2;
  border: 1px solid rgba(18, 60, 54, 0.18);
}

.wide-btn {
  width: 104px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
  gap: 16px;
}

.panel {
  padding: 20px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.panel-title {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.table {
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.table-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.7fr) minmax(90px, 0.7fr) 70px 80px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-top: 1px solid rgba(23, 35, 31, 0.08);
  font-size: 14px;
}

.table-row:first-child {
  border-top: 0;
}

.table-header {
  color: #68766f;
  background: #f3f7f4;
  font-weight: 700;
}

.table-row.selected {
  background: #edf7f2;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.empty {
  padding: 22px;
  color: #68766f;
  background: #f4f7f4;
  border-radius: 8px;
}

.detail-line {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(23, 35, 31, 0.08);
}

.detail-label {
  color: #68766f;
}

.case-list {
  margin-top: 16px;
}

.case-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  margin-top: 10px;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  background: #f8faf7;
}

.case-name {
  display: block;
  font-weight: 700;
}

.case-counts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #42524b;
  font-size: 13px;
  text-align: right;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-top: 1px solid rgba(23, 35, 31, 0.08);
}

.switch-row:first-of-type {
  border-top: 0;
}

.field-title {
  display: block;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.model-card {
  padding: 18px;
  margin-top: 12px;
  background: #f7faf7;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
}

.model-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.model-title {
  display: block;
  font-size: 17px;
  font-weight: 700;
}

.model-subtitle {
  display: block;
  margin-top: 4px;
  color: #68766f;
  font-size: 13px;
}

.model-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.small-btn {
  width: auto;
  min-width: 74px;
  height: 34px;
  line-height: 34px;
  padding: 0 12px;
  color: #123c36;
  background: #fbfdfb;
  border: 1px solid rgba(18, 60, 54, 0.18);
  font-size: 13px;
}

.small-btn.danger {
  color: #9c2f22;
  border-color: rgba(156, 47, 34, 0.25);
  background: #fff6f4;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #42524b;
  font-size: 13px;
}

.field.wide {
  grid-column: span 2;
}

input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(23, 35, 31, 0.14);
  border-radius: 6px;
  background: #fff;
  color: #17231f;
  font-size: 14px;
}

.model-foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.test-result {
  display: block;
  font-size: 13px;
  line-height: 1.45;
}

.test-result.pass {
  color: #0f6b45;
}

.test-result.fail {
  color: #9c2f22;
}

.primary-btn {
  width: 180px;
  height: 44px;
  line-height: 44px;
  margin-top: 18px;
}

.alert,
.save-message {
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 8px;
  font-size: 14px;
}

.alert {
  color: #9c2f22;
  background: #fff0ed;
  border: 1px solid rgba(156, 47, 34, 0.18);
}

.save-message {
  color: #123c36;
  background: #edf7f2;
  border: 1px solid rgba(18, 60, 54, 0.14);
}

@media (max-width: 760px) {
  .admin-page {
    padding: 14px;
  }

  .topbar,
  .content-grid,
  .stats-grid,
  .form-grid,
  .model-head {
    display: flex;
    flex-direction: column;
  }

  .table-row {
    grid-template-columns: minmax(0, 1fr) 72px 52px 66px;
    gap: 8px;
    font-size: 12px;
  }

  .field.wide {
    grid-column: auto;
  }

  .model-actions {
    justify-content: flex-start;
  }
}
</style>
