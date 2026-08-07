<template>
  <view class="panel archetype-admin">
    <view class="panel-head">
      <view>
        <text class="panel-title">题库管理</text>
        <text class="panel-meta">草稿编辑 · 校验 · 发布</text>
      </view>
      <view class="panel-actions">
        <button v-if="bank && isPublished" class="primary-btn draft-entry-btn" :disabled="loading" @click="createDraft">创建草稿并编辑</button>
        <button class="ghost-btn" :disabled="loading" @click="loadBank">刷新</button>
      </view>
    </view>

    <view class="feature-switch">
      <button v-for="item in features" :key="item.id" :class="['feature-btn', featureKey === item.key && subjectGender === item.subjectGender ? 'active' : '']" @click="selectFeature(item)">
        {{ item.label }}
      </button>
    </view>

    <view v-if="message" :class="['notice', messageOk ? 'ok' : 'fail']">{{ message }}</view>
    <view v-if="loading" class="empty">正在读取题库...</view>

    <template v-else-if="!bank">
      <view class="empty">当前功能尚未初始化题库。</view>
      <button class="primary-btn" @click="seedBank">导入 V1 首发种子</button>
    </template>

    <template v-else>
      <view class="bank-meta">
        <text v-if="bank.displayTitle">{{ bank.displayTitle }}</text>
        <text>版本 {{ bank.contentVersion }}</text>
        <text :class="['status', bank.status]">{{ statusText(bank.status) }}</text>
        <text>revision {{ bank.revision }}</text>
        <text class="mono">{{ String(bank.checksum || '').slice(0, 12) }}</text>
      </view>

      <view v-if="isPublished" class="published-editor-notice">
        <view>
          <text class="notice-title">已发布版本 · 可查看配置</text>
          <text class="notice-desc">发布中的题库不会被直接改写。创建新草稿后，会自动进入完整编辑页。</text>
        </view>
        <view class="new-version-row">
          <input v-model="nextVersion" placeholder="下一个版本，如 1.0.1" />
          <button class="primary-btn" @click="createDraft">创建草稿并编辑</button>
        </view>
      </view>

      <view class="editor-content">
        <view class="editor-tabs">
          <button v-for="tab in tabs" :key="tab.key" :class="['tab-btn', activeTab === tab.key ? 'active' : '']" @click="activeTab = tab.key">{{ tab.label }}</button>
        </view>

        <view v-if="activeTab === 'questions'" class="editor-layout">
          <view class="editor-nav">
            <template v-if="isRelation">
              <text class="field-label">人物</text>
              <button v-for="item in content.archetypes" :key="item.key" :class="['nav-btn', selectedPersonKey === item.key ? 'active' : '']" @click="selectedPersonKey = item.key">{{ item.name }}</button>
              <text class="field-label">题目类型</text>
              <button v-for="item in relationGroups" :key="item.key" :class="['nav-btn', relationGroup === item.key ? 'active' : '']" @click="relationGroup = item.key">{{ item.label }}</button>
              <template v-if="relationGroup !== 'universal'">
                <text class="field-label">关系阶段</text>
                <button v-for="stage in content.stages" :key="stage.key" :class="['nav-btn compact', selectedStageKey === stage.key ? 'active' : '']" @click="selectedStageKey = stage.key">{{ stage.label }}</button>
              </template>
            </template>
            <view class="question-buttons">
              <button v-for="(question, index) in questionList" :key="question.id" :class="['question-btn', selectedQuestionIndex === index ? 'active' : '']" @click="selectedQuestionIndex = index">{{ question.id }}</button>
            </view>
          </view>

          <view v-if="selectedQuestion" :class="['editor-form', { 'is-readonly': isPublished }]">
            <text class="field-label">测自己文案</text>
            <textarea v-model="selectedQuestion.textSelf" auto-height maxlength="500" />
            <text class="field-label">测当前 Crush 文案</text>
            <textarea v-model="selectedQuestion.textTarget" auto-height maxlength="500" />
            <template v-if="selectedQuestion.options">
              <view v-for="option in selectedQuestion.options" :key="option.key" class="option-editor">
                <text class="option-key">{{ option.key }}</text>
                <view class="option-fields">
                  <input v-if="option.textSelf !== undefined" v-model="option.textSelf" placeholder="self 选项" />
                  <input v-if="option.textTarget !== undefined" v-model="option.textTarget" placeholder="target 选项" />
                  <input v-if="option.text !== undefined" v-model="option.text" placeholder="选项文案" />
                  <view v-if="option.scores" class="score-grid">
                    <label v-for="dimension in celebrityDimensionKeys" :key="dimension">
                      <text>{{ dimension }}</text>
                      <input v-model.number="option.scores[dimension]" type="number" placeholder="-" />
                    </label>
                  </view>
                </view>
              </view>
            </template>
            <view class="phone-preview">
              <text class="preview-label">手机预览</text>
              <text class="preview-question">{{ selectedQuestion.textTarget }}</text>
              <view v-for="option in previewOptions" :key="option.key" class="preview-option">{{ option.key }} · {{ option.text }}</view>
            </view>
          </view>
        </view>

        <view v-else-if="activeTab === 'people'" :class="['people-editor', { 'is-readonly': isPublished }]">
          <template v-if="isRelation">
            <view v-for="archetype in content.archetypes" :key="archetype.key" class="person-card">
              <view class="person-line"><text class="person-title">稳定 key：<text class="mono">{{ archetype.key }}</text></text><switch :checked="archetype.enabled !== false" @change="archetype.enabled = $event.detail.value" /></view>
              <text class="field-label">人物显示名称</text>
              <input v-model="archetype.name" class="person-input" maxlength="40" placeholder="例如：霍启刚型" />
              <text class="field-label">风格副标题</text>
              <input v-model="archetype.label" class="person-input" maxlength="40" placeholder="例如：稳健共建派" />
              <view v-for="dimension in archetype.dimensions" :key="dimension.key" class="dimension-row">
                <input v-model="dimension.name" />
                <input v-model.number="dimension.weight" type="digit" />
                <input v-model="dimension.highText" />
                <input v-model="dimension.lowText" />
              </view>
              <text class="field-label">结果页吸引点</text>
              <textarea v-model="archetype.resultCopy.attraction" auto-height />
              <text class="field-label">结果页注意点</text>
              <textarea v-model="archetype.resultCopy.caution" auto-height />
              <button class="ghost-btn result-config-toggle" @click="toggleResultPage(archetype.key)">
                {{ expandedResultPageKey === archetype.key ? '收起完整报告配置' : '编辑完整报告配置' }}
              </button>
              <view v-if="expandedResultPageKey === archetype.key" class="result-page-config">
                <text class="config-title">不同关系阶段建议</text>
                <view v-for="stage in content.stages" :key="stage.key" class="config-group">
                  <text class="field-label">{{ stage.label }}</text>
                  <input v-model="archetype.resultPage.stageAdvice[stage.key].shortLabel" class="person-input" maxlength="20" placeholder="短标签，如：刚接触" />
                  <input v-model="archetype.resultPage.stageAdvice[stage.key].title" class="person-input" maxlength="120" placeholder="阶段标题；留空使用系统默认" />
                  <textarea v-model="archetype.resultPage.stageAdvice[stage.key].summary" auto-height maxlength="500" placeholder="阶段建议；留空使用系统默认" />
                  <textarea v-model="archetype.resultPage.stageAdvice[stage.key].question" auto-height maxlength="160" placeholder="可以直接问的问题；留空使用系统默认" />
                </view>
                <text class="config-title">红黄绿灯信号</text>
                <view v-for="signal in resultSignalLevels" :key="signal.key" class="config-group compact-config">
                  <text class="field-label">{{ signal.label }}</text>
                  <input v-model="archetype.resultPage.trafficSignals[signal.key].title" class="person-input" maxlength="120" placeholder="信号标题；留空使用系统默认" />
                  <textarea v-model="archetype.resultPage.trafficSignals[signal.key].text" auto-height maxlength="500" placeholder="具体行为说明；留空使用系统默认" />
                </view>
                <text class="config-title">三步行动</text>
                <view v-for="(action, actionIndex) in archetype.resultPage.actionSteps" :key="actionIndex" class="config-group compact-config">
                  <text class="field-label">第 {{ actionIndex + 1 }} 步</text>
                  <input v-model="action.title" class="person-input" maxlength="80" placeholder="行动标题；留空使用系统默认" />
                  <textarea v-model="action.text" auto-height maxlength="500" placeholder="行动说明；留空使用系统默认" />
                </view>
              </view>
            </view>
          </template>
          <template v-else>
            <view class="era-filter">
              <button v-for="era in (isCharacter ? categories : eras)" :key="era.key" :class="['nav-btn', selectedEra === era.key ? 'active' : '']" @click="selectedEra = era.key">{{ era.label }}</button>
            </view>
            <view v-for="person in filteredPeople" :key="person.key" class="person-card celebrity-row">
              <view class="person-line"><text class="person-title">稳定 key：<text class="mono">{{ person.key }}</text></text><switch :checked="person.enabled" @change="person.enabled = $event.detail.value" /></view>
              <text class="field-label">人物显示名称</text>
              <input v-model="person.name" class="person-input" maxlength="60" />
              <template v-if="isCharacter">
                <text class="field-label">来源作品</text><input v-model="person.source" class="person-input" maxlength="80" />
                <text class="field-label">分类 / 阵营</text><view class="dimension-row"><input v-model="person.category" class="person-input" /><input v-model="person.alignment" class="person-input" /></view>
                <text class="field-label">受众标签（逗号分隔）</text><input :value="(person.audienceTags || []).join(',')" class="person-input" @input="person.audienceTags = $event.detail.value.split(',').map((item: string) => item.trim()).filter(Boolean)" />
                <text class="field-label">角色摘要</text><textarea v-model="person.summary" auto-height maxlength="500" />
                <text class="field-label">吸引点</text><textarea v-model="person.attraction" auto-height maxlength="500" />
                <text class="field-label">注意点</text><textarea v-model="person.caution" auto-height maxlength="500" />
              </template>
              <view class="score-grid">
                <label v-for="dimension in celebrityDimensionKeys" :key="dimension">
                  <text>{{ dimension }}</text>
                  <input v-model.number="person.profile[dimension]" type="number" />
                </label>
              </view>
              <button class="ghost-btn result-config-toggle" @click="toggleResultPage(person.key)">
                {{ expandedResultPageKey === person.key ? '收起完整报告配置' : '编辑完整报告配置' }}
              </button>
              <view v-if="expandedResultPageKey === person.key" class="result-page-config">
                <text class="config-title">红黄绿灯信号</text>
                <view v-for="signal in resultSignalLevels" :key="signal.key" class="config-group compact-config">
                  <text class="field-label">{{ signal.label }}</text>
                  <input v-model="person.resultPage.trafficSignals[signal.key].title" class="person-input" maxlength="120" placeholder="信号标题；留空使用系统默认" />
                  <textarea v-model="person.resultPage.trafficSignals[signal.key].text" auto-height maxlength="500" placeholder="具体行为说明；留空使用系统默认" />
                </view>
                <text class="config-title">三步行动</text>
                <view v-for="(action, actionIndex) in person.resultPage.actionSteps" :key="actionIndex" class="config-group compact-config">
                  <text class="field-label">第 {{ actionIndex + 1 }} 步</text>
                  <input v-model="action.title" class="person-input" maxlength="80" placeholder="行动标题；留空使用系统默认" />
                  <textarea v-model="action.text" auto-height maxlength="500" placeholder="行动说明；留空使用系统默认" />
                </view>
              </view>
            </view>
            <view class="person-card">
              <text class="person-title">五维确定性结果文案</text>
              <view v-for="dimension in content.dimensions || []" :key="dimension.key" class="result-copy-row">
                <text class="field-label">{{ dimension.name }} · 高分表达</text>
                <textarea v-model="content.resultCopy[dimension.key].high" auto-height maxlength="500" />
                <text class="field-label">{{ dimension.name }} · 低分观察</text>
                <textarea v-model="content.resultCopy[dimension.key].low" auto-height maxlength="500" />
              </view>
              <view class="result-copy-row">
                <text class="field-label">分享文案模板</text>
                <textarea v-model="content.resultCopy.shareTemplate" auto-height maxlength="500" />
              </view>
            </view>
          </template>
        </view>

        <view v-else :class="['raw-editor', { 'is-readonly': isPublished }]">
          <text class="field-label">完整 JSON（修改后点击“应用 JSON”）</text>
          <textarea v-model="rawContent" class="raw-textarea" maxlength="-1" />
          <button class="ghost-btn" @click="applyRaw">应用 JSON</button>
        </view>

        <view v-if="!isPublished" class="editor-actions">
          <button class="ghost-btn" :disabled="saving" @click="saveDraft">{{ saving ? '保存中...' : '保存草稿' }}</button>
          <button class="ghost-btn" :disabled="saving" @click="validateDraft">校验题库</button>
          <button v-if="!isRelation" class="ghost-btn" :disabled="saving" @click="runCalibration">运行 20 万组校准</button>
          <button class="primary-btn" :disabled="saving || !lastValidation?.valid" @click="publishBank">首次/正式发布</button>
        </view>

        <view v-if="lastValidation" :class="['validation-box', lastValidation.valid ? 'ok' : 'fail']">
          <text>{{ lastValidation.valid ? '校验通过，可以发布。' : `发现 ${lastValidation.errors?.length || 0} 个问题` }}</text>
          <text v-for="item in lastValidation.errors || []" :key="item.path + item.code" class="validation-error">{{ item.path }}：{{ item.message }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  adminCreateArchetypeQuestionDraft,
  adminGetArchetypeQuestionBank,
  adminPublishArchetypeQuestionBank,
  adminRunCelebrityCalibration,
  adminSaveArchetypeQuestionDraft,
  adminSeedArchetypeQuestionBanks,
  adminValidateArchetypeQuestionDraft
} from '@/utils/api'

const features = [
  { id: 'relation-female', key: '关系女主角', subjectGender: 'female', label: '关系女主角' },
  { id: 'relation-male', key: '关系女主角', subjectGender: 'male', label: '关系男主角' },
  { id: 'celebrity', key: 'Crush名人图鉴', subjectGender: undefined, label: 'Crush 名人图鉴' },
  { id: 'character', key: '次元角色图鉴', subjectGender: undefined, label: '次元角色图鉴' }
] as const
const tabs = [{ key: 'questions', label: '题目' }, { key: 'people', label: '人物与维度' }, { key: 'raw', label: '完整 JSON' }]
const relationGroups = [{ key: 'universal', label: '10 道通用题' }, { key: 'stage', label: '5 道阶段题' }, { key: 'scenario', label: '3 道情景题' }]
const eras = [{ key: 'history', label: '历史' }, { key: 'modern', label: '近代' }, { key: 'contemporary', label: '当代' }]
const categories = [{ key: 'classic', label: '名著经典' }, { key: 'wuxia', label: '金庸武侠' }, { key: 'tomb_raiding', label: '盗墓题材' }, { key: 'chinese_screen', label: '国产影视' }, { key: 'international', label: '国际书影音' }, { key: 'anime', label: '动漫' }]
const celebrityDimensionKeys = ['initiative', 'warmth', 'reliability', 'romance', 'boundary']
const resultSignalLevels = [{ key: 'green', label: '绿灯 · 可继续' }, { key: 'yellow', label: '黄灯 · 要观察' }, { key: 'red', label: '红灯 · 要回避' }]

type ArchetypeFeatureKey = '关系女主角' | 'Crush名人图鉴' | '次元角色图鉴'

const featureKey = ref<ArchetypeFeatureKey>('关系女主角')
const subjectGender = ref<'female' | 'male' | undefined>('female')
const bank = ref<any>(null)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageOk = ref(false)
const nextVersion = ref('1.0.1')
const activeTab = ref('questions')
const selectedPersonKey = ref('ran_yingying')
const relationGroup = ref('universal')
const selectedStageKey = ref('pre_relationship')
const selectedQuestionIndex = ref(0)
const selectedEra = ref('history')
const rawContent = ref('')
const lastValidation = ref<any>(null)
const expandedResultPageKey = ref('')

const content = computed(() => bank.value?.content || {})
const isRelation = computed(() => featureKey.value === '关系女主角')
const isCharacter = computed(() => featureKey.value === '次元角色图鉴')
const isPublished = computed(() => bank.value?.status === 'published')
const selectedArchetype = computed(() => content.value?.archetypes?.find((item: any) => item.key === selectedPersonKey.value) || content.value?.archetypes?.[0])
const questionList = computed<any[]>(() => {
  if (!bank.value) return []
  if (!isRelation.value) return content.value.questions || []
  const archetype = selectedArchetype.value
  if (!archetype) return []
  if (relationGroup.value === 'stage') return archetype.stageQuestions?.[selectedStageKey.value] || []
  if (relationGroup.value === 'scenario') return archetype.scenarios?.[selectedStageKey.value] || []
  return archetype.universalQuestions || []
})
const selectedQuestion = computed(() => questionList.value[selectedQuestionIndex.value] || null)
const filteredPeople = computed(() => {
  const people = content.value.people || []
  return isCharacter.value
    ? people.filter((item: any) => item.category === selectedEra.value)
    : people.filter((item: any) => item.era === selectedEra.value)
})
const previewOptions = computed(() => {
  const options = selectedQuestion.value?.options || []
  if (options.length) return options.map((item: any) => ({ key: item.key, text: item.textTarget || item.text || '' }))
  return ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({ key, text: ['非常像 TA', '比较像 TA', '一般 / 看情况', '不太像 TA', '完全不像 TA'][index] }))
})

watch([selectedPersonKey, relationGroup, selectedStageKey], () => { selectedQuestionIndex.value = 0 })
watch(activeTab, (value) => { if (value === 'raw') refreshRaw() })

function statusText(status: string) { return ({ draft: '草稿', published: '已发布', archived: '已归档' } as any)[status] || status }
function notify(text: string, ok = false) { message.value = text; messageOk.value = ok }
function refreshRaw() { rawContent.value = JSON.stringify(content.value, null, 2) }
function toggleResultPage(key: string) { expandedResultPageKey.value = expandedResultPageKey.value === key ? '' : key }
function ensureResultPageConfig() {
  if (!bank.value?.content) return
  const ensureSignalsAndActions = (person: any) => {
    person.resultPage = person.resultPage || {}
    person.resultPage.trafficSignals = person.resultPage.trafficSignals || {}
    for (const signal of resultSignalLevels) {
      person.resultPage.trafficSignals[signal.key] = person.resultPage.trafficSignals[signal.key] || { title: '', text: '' }
    }
    const actions = Array.isArray(person.resultPage.actionSteps) ? person.resultPage.actionSteps : []
    person.resultPage.actionSteps = [0, 1, 2].map((index) => ({ title: '', text: '', ...(actions[index] || {}) }))
  }
  if (isRelation.value) {
    for (const archetype of bank.value.content.archetypes || []) {
      ensureSignalsAndActions(archetype)
      archetype.resultPage.stageAdvice = archetype.resultPage.stageAdvice || {}
      for (const stage of bank.value.content.stages || []) {
        archetype.resultPage.stageAdvice[stage.key] = archetype.resultPage.stageAdvice[stage.key] || { shortLabel: '', title: '', summary: '', question: '' }
      }
    }
  } else {
    for (const person of bank.value.content.people || []) ensureSignalsAndActions(person)
  }
}
function suggestNextVersion(version: string) {
  const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return '1.0.1'
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

async function selectFeature(item: any) {
  featureKey.value = item.key as ArchetypeFeatureKey
  subjectGender.value = item.subjectGender
  selectedEra.value = item.key === '次元角色图鉴' ? 'classic' : 'history'
  selectedPersonKey.value = ''
  expandedResultPageKey.value = ''
  lastValidation.value = null
  await loadBank()
}

async function loadBank() {
  loading.value = true
  message.value = ''
  lastValidation.value = null
  try {
    let result = await adminGetArchetypeQuestionBank({ featureKey: featureKey.value, subjectGender: subjectGender.value, status: 'draft' })
    if (!result?.success) result = await adminGetArchetypeQuestionBank({ featureKey: featureKey.value, subjectGender: subjectGender.value, status: 'published' })
    bank.value = result?.success ? JSON.parse(JSON.stringify(result.bank)) : null
    ensureResultPageConfig()
    if (bank.value && isPublished.value) {
      nextVersion.value = suggestNextVersion(bank.value.contentVersion)
    }
    if (bank.value && !isRelation.value) {
      bank.value.content.resultCopy = bank.value.content.resultCopy || {}
      for (const dimension of bank.value.content.dimensions || []) {
        bank.value.content.resultCopy[dimension.key] = bank.value.content.resultCopy[dimension.key] || { high: '', low: '' }
      }
      bank.value.content.resultCopy.shareTemplate = bank.value.content.resultCopy.shareTemplate || ''
    }
    if (bank.value && isRelation.value && !content.value.archetypes?.some((item: any) => item.key === selectedPersonKey.value)) {
      selectedPersonKey.value = content.value.archetypes?.[0]?.key || ''
    }
    refreshRaw()
  } catch (error: any) {
    bank.value = null
    notify(error?.message || '读取题库失败')
  } finally { loading.value = false }
}

async function seedBank() {
  loading.value = true
  const result = await adminSeedArchetypeQuestionBanks(featureKey.value, subjectGender.value).catch((error: any) => ({ success: false, message: error?.message }))
  loading.value = false
  notify(result?.success ? '首发种子已导入' : result?.message || '导入失败', Boolean(result?.success))
  if (result?.success) await loadBank()
}

async function createDraft() {
  const result = await adminCreateArchetypeQuestionDraft(featureKey.value, nextVersion.value, subjectGender.value).catch((error: any) => ({ success: false, message: error?.message }))
  notify(result?.success ? '新版本草稿已创建' : result?.message || '创建失败', Boolean(result?.success))
  if (result?.success) await loadBank()
}

function applyRaw() {
  try {
    bank.value.content = JSON.parse(rawContent.value)
    ensureResultPageConfig()
    lastValidation.value = null
    notify('JSON 已应用，尚未保存。', true)
  } catch (error: any) { notify(`JSON 格式错误：${error?.message || ''}`) }
}

async function saveDraft() {
  saving.value = true
  const result = await adminSaveArchetypeQuestionDraft({ bankId: bank.value._id, expectedRevision: bank.value.revision, content: bank.value.content }).catch((error: any) => ({ success: false, message: error?.message }))
  saving.value = false
  if (result?.success) {
    bank.value.revision = result.revision
    bank.value.checksum = result.checksum
    lastValidation.value = null
  }
  notify(result?.success ? '草稿已保存' : result?.message || '保存失败', Boolean(result?.success))
}

async function validateDraft() {
  saving.value = true
  const result = await adminValidateArchetypeQuestionDraft(bank.value._id, bank.value.revision).catch((error: any) => ({ success: false, message: error?.message }))
  saving.value = false
  if (result?.success) lastValidation.value = result
  notify(result?.success ? (result.valid ? '校验通过' : '校验未通过') : result?.message || '校验失败', Boolean(result?.success && result.valid))
}

async function runCalibration() {
  saving.value = true
  notify('校准运行中，可能需要几十秒...')
  const result = await adminRunCelebrityCalibration({ bankId: bank.value._id, expectedRevision: bank.value.revision, seed: 20260801, iterations: 200000 }).catch((error: any) => ({ success: false, message: error?.message }))
  saving.value = false
  if (result?.success) {
    bank.value.revision = result.revision
    bank.value.checksum = result.checksum
    await loadBank()
  }
  notify(result?.success ? (result.passed ? '校准通过' : '校准未通过，请查看分布摘要') : result?.message || '校准失败', Boolean(result?.success && result.passed))
}

async function publishBank() {
  if (!lastValidation.value?.valid) return
  saving.value = true
  const result = await adminPublishArchetypeQuestionBank({
    bankId: bank.value._id,
    expectedRevision: bank.value.revision,
    checksum: lastValidation.value.checksum,
    ...(!isRelation.value ? { reportChecksum: bank.value.content?.calibrationSummary?.reportChecksum || '' } : {})
  }).catch((error: any) => ({ success: false, message: error?.message }))
  saving.value = false
  notify(result?.success ? `版本 ${result.contentVersion} 已发布` : result?.message || '发布失败', Boolean(result?.success))
  if (result?.success) await loadBank()
}

onMounted(loadBank)
</script>

<style scoped>
.archetype-admin { display:flex; flex-direction:column; gap:18px; }
.panel-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.draft-entry-btn { white-space:nowrap; }
.feature-switch,.editor-tabs,.editor-actions,.era-filter,.new-version-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.feature-btn,.tab-btn,.nav-btn,.question-btn { padding:8px 12px; border:2px solid #222; background:#fff; border-radius:10px; font-size:13px; }
.feature-btn.active,.tab-btn.active,.nav-btn.active,.question-btn.active { background:#ffe37a; box-shadow:3px 3px 0 #222; }
.notice,.validation-box { padding:12px; border:2px solid #222; border-radius:10px; }
.ok { background:#dbf7df; }.fail { background:#ffe1dc; }
.published-editor-notice { display:flex; gap:14px; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:14px; border:2px solid #222; border-radius:12px; background:#fff7cf; }
.notice-title,.notice-desc { display:block; }.notice-title { font-weight:900; color:#26332e; }.notice-desc { margin-top:4px; font-size:12px; line-height:18px; color:#53615b; }
.is-readonly { opacity:.76; pointer-events:none; }
.bank-meta { display:flex; gap:14px; align-items:center; flex-wrap:wrap; font-size:13px; }.status { padding:4px 8px; border-radius:999px; background:#eee; }.status.published{background:#c9f3d1}.status.draft{background:#fff1a8}
.new-version-row input { width:180px; }
.editor-layout { display:grid; grid-template-columns:220px minmax(0,1fr); gap:18px; }
.editor-nav,.editor-form,.person-card,.raw-editor { border:2px solid #222; border-radius:12px; padding:14px; background:#fff; }
.editor-nav { display:flex; flex-direction:column; gap:8px; align-self:start; }.nav-btn.compact{font-size:11px;text-align:left}.question-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.question-btn{padding:5px 8px}
.field-label { display:block; margin:12px 0 7px; font-size:13px; line-height:20px; font-weight:800; color:#26332e; }.editor-form textarea,.raw-textarea { width:100%; box-sizing:border-box; min-height:70px; border:1px solid #bbb; border-radius:8px; padding:10px; }.raw-textarea{min-height:520px;font-family:monospace;font-size:12px}
.option-editor { display:flex; gap:10px; margin-top:12px; padding-top:12px; border-top:1px dashed #ccc; }.option-key{font-weight:900}.option-fields{flex:1;display:flex;flex-direction:column;gap:8px}.option-fields input,.dimension-row input,.new-version-row input{border:1px solid #bbb;border-radius:8px;padding:8px}
.score-grid { display:grid; grid-template-columns:repeat(5,minmax(80px,1fr)); gap:8px; }.score-grid label{font-size:11px}.score-grid input{width:100%;box-sizing:border-box}
.phone-preview { max-width:360px; margin:20px auto 0; padding:18px; border:3px solid #222; border-radius:22px; background:#fffdf5; box-shadow:6px 6px 0 #222; }.preview-label{font-size:11px;color:#777}.preview-question{display:block;margin:12px 0;font-size:18px;font-weight:800}.preview-option{margin-top:8px;padding:8px;border:2px solid #222;border-radius:10px;background:#fff}
.people-editor{display:flex;flex-direction:column;gap:12px}.person-title{font-weight:900}.person-line{display:flex;justify-content:space-between}.dimension-row{display:grid;grid-template-columns:140px 80px 1fr 1fr;gap:8px;margin-top:8px}.person-card textarea{width:100%;box-sizing:border-box;margin-top:8px}.celebrity-row{display:flex;flex-direction:column;gap:10px}.result-copy-row{margin-top:14px;padding-top:8px;border-top:1px dashed #bbb}.validation-error{display:block;margin-top:5px;font-size:12px}.mono{font-family:monospace}
.result-config-toggle{margin-top:14px}.result-page-config{margin-top:12px;padding:14px;border:1px solid #9aa69f;border-radius:10px;background:#f7faf8}.config-title{display:block;margin-top:16px;padding-bottom:7px;border-bottom:2px solid #26332e;font-size:14px;font-weight:900;color:#26332e}.config-title:first-child{margin-top:0}.config-group{margin-top:10px;padding:12px;border:1px dashed #aab4af;border-radius:8px;background:#fff}.compact-config{padding-top:6px}
.person-input {
  width:100%;
  height:44px;
  min-height:44px;
  box-sizing:border-box;
  padding:0 12px;
  border:1px solid #87938d;
  border-radius:6px;
  background:#fff;
  color:#17231f;
  font-size:15px;
  line-height:44px;
  overflow:hidden;
}
.person-input:focus-within {
  border-color:#123c36;
  box-shadow:0 0 0 3px rgba(18,60,54,.12);
}
.person-input :deep(.uni-input-wrapper),
.person-input :deep(.uni-input-form),
.person-input :deep(.uni-input-input) {
  height:42px;
  min-height:42px;
  line-height:42px;
  color:#17231f;
  font-size:15px;
}
.person-input :deep(.uni-input-placeholder) { color:#77847e; }
@media (max-width: 800px){.editor-layout{grid-template-columns:1fr}.score-grid{grid-template-columns:repeat(2,1fr)}.dimension-row{grid-template-columns:1fr}.editor-actions{position:sticky;bottom:0;background:#fff;padding:10px;border-top:2px solid #222}.published-editor-notice{align-items:stretch}.new-version-row{width:100%}.new-version-row input{flex:1;min-width:0}}
</style>
