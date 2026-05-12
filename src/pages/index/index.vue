<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中...</view>

    <!-- 空状态：显示 AssessmentForm -->
    <template v-else-if="cases.length === 0">
      <view class="card hero-card">
        <text class="hero-topline">Relationship Signal Lab</text>
        <text class="h1">先做一次初次评估</text>
        <text class="hero-subtext">第一次进入时先完成一轮结构化问答。后续你更常做的动作会是补记录、看时间线和重新评估，而不是每次都重答整套题。</text>
      </view>

      <AssessmentForm @submit="onCreateCase" />
    </template>

    <!-- 有案例：显示最近案例 KPI + 快速记录 -->
    <template v-else>
      <view class="card hero-card">
        <view class="section-head">
          <text class="hero-topline">Home / Active Cases</text>
          <text class="h1">优先追录新事件</text>
          <text class="hero-subtext">你已经有 {{ cases.length }} 个关系对象。先确认当前在追谁，再继续记录。</text>
        </view>

        <view class="case-kpis">
          <view class="kpi-item">
            <text class="kpi-label">对象</text>
            <view class="case-identity">
              <view class="profile-avatar sm">
                <image v-if="latestCase.profile?.avatar" :src="latestCase.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(latestCase.name) }}</text>
              </view>
              <text class="kpi-value">{{ latestCase.name }}</text>
            </view>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">意向</text>
            <text class="kpi-value">{{ latestCase.latestResult?.intentScore ?? '--' }}</text>
            <text class="muted">{{ mapIntentLabel(latestCase.latestResult?.intentBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">风险</text>
            <text class="kpi-value">{{ latestCase.latestResult?.consistencyRiskScore ?? '--' }}</text>
            <text class="muted">{{ mapRiskLabel(latestCase.latestResult?.riskBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">记录数量</text>
            <text class="kpi-value">{{ latestCase.timeline?.length ?? 0 }}</text>
            <text class="muted">时间线事件</text>
          </view>
        </view>

        <view v-if="latestProfileItems.length > 0" class="badges">
          <text v-for="item in latestProfileItems" :key="item" class="badge">{{ item }}</text>
        </view>

        <!-- 快速记录 -->
        <view class="quick-record-box">
          <text class="h3">一句话快速记录</text>
          <text class="muted">直接记到最近对象。</text>
          <textarea
            v-model="quickDesc"
            class="text-area"
            placeholder="例如：他今天主动约我吃饭，提前把时间地点都定好了。"
          />
          <view class="field">
            <text class="field-label">这句话主要在说谁</text>
            <view class="role-segments">
              <view
                v-for="item in subjectRoleOptions"
                :key="item.value"
                :class="['role-segment', quickSubjectRole === item.value ? 'active' : '']"
                @click="setQuickSubjectRole(item.value)"
              >
                {{ item.label }}
              </view>
            </view>
            <text class="muted">{{ quickSubjectRoleHint }}</text>
          </view>
          <view class="field">
            <text class="field-label">具体发生时间</text>
            <view class="datetime-row">
              <picker mode="date" :value="quickDate" @change="onQuickDateChange">
                <view class="picker-view">{{ quickDate }}</view>
              </picker>
              <picker mode="time" :value="quickTime" @change="onQuickTimeChange">
                <view class="picker-view">{{ quickTime }}</view>
              </picker>
            </view>
          </view>
          <view class="field">
            <text class="field-label">附件</text>
            <view class="actions attachment-actions">
              <button class="btn-secondary" :disabled="quickUploading" @click="chooseQuickImages">
                {{ quickUploading ? '上传中...' : '上传图片' }}
              </button>
            </view>
            <view v-if="quickAttachments.length > 0" class="attachment-list">
              <view
                v-for="(item, index) in quickAttachments"
                :key="item.fileID"
                class="attachment-item"
                @click="previewQuickAttachment(index)"
              >
                <text class="attachment-name">{{ item.name }}</text>
                <text class="attachment-link" selectable>{{ item.url || '授权链接生成中...' }}</text>
                <button class="link-button danger" @click.stop="removeQuickAttachment(index)">删除</button>
              </view>
            </view>
          </view>
          <view class="actions">
            <button class="btn-primary" :disabled="quickSubmitting" @click="submitQuickRecord">
              {{ quickSubmitting ? '保存中...' : '保存到最近对象' }}
            </button>
          </view>
        </view>

        <view
          v-if="showQuickFeedback && latestCase.latestResult && latestTrend && latestTriggerEvent"
          :class="['card', 'status-card', latestFeedbackEventType === 'risk' ? 'warning' : 'success']"
        >
          <text class="status-strong">已记录：{{ latestTriggerEvent.title }}</text>
          <text class="muted">{{ mapTimelineTypeLabel(latestFeedbackEventType) }}</text>
          <view class="feedback-stats">
            <text class="badge">意向 {{ latestTrend.intentDelta > 0 ? `+${latestTrend.intentDelta}` : latestTrend.intentDelta }}</text>
            <text class="badge">风险 {{ latestTrend.riskDelta > 0 ? `+${latestTrend.riskDelta}` : latestTrend.riskDelta }}</text>
            <text class="badge">{{ mapAction(latestCase.latestResult.nextAction) }}</text>
          </view>
          <text class="muted feedback-headline">{{ latestCase.latestResult.explanation?.headline }}</text>
          <view class="quick-section">
            <view class="section-mini-head">
              <text class="mini-title">系统当前判断</text>
              <text class="mini-sub">保存后生成的即时反馈快照</text>
            </view>
            <text v-if="latestCase.latestResult.explanation?.headline" class="feedback-headline strong">{{ latestCase.latestResult.explanation.headline }}</text>
            <text v-if="latestKeywordText" class="muted keyword-line">判断关键词：{{ latestKeywordText }}</text>
          </view>
          <view class="score-panel instant-score-panel">
            <view class="section-mini-head">
              <text class="mini-title">意向 / 风险</text>
              <text class="mini-sub">这次即时反馈的当前分数</text>
            </view>
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">意向</text>
                <text class="score-value">{{ clampScore(latestCase.latestResult.intentScore) }}</text>
                <text class="score-bucket">{{ mapIntentLabel(latestCase.latestResult.intentBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill intent-fill" :style="scoreFillStyle(latestCase.latestResult.intentScore, 'intent')"></view>
              </view>
            </view>
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">风险</text>
                <text class="score-value">{{ clampScore(latestCase.latestResult.consistencyRiskScore) }}</text>
                <text class="score-bucket">{{ mapRiskLabel(latestCase.latestResult.riskBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill risk-fill" :style="scoreFillStyle(latestCase.latestResult.consistencyRiskScore, 'risk')"></view>
              </view>
            </view>
          </view>
          <view class="instant-delta-panel">
            <view class="instant-delta-item">
              <text class="delta-label">意向变化</text>
              <text class="delta-value" :class="deltaClass(latestTrend.intentDelta)">{{ formatDelta(latestTrend.intentDelta) }}</text>
            </view>
            <view class="instant-delta-item">
              <text class="delta-label">风险变化</text>
              <text class="delta-value" :class="deltaClass(latestTrend.riskDelta)">{{ formatDelta(latestTrend.riskDelta) }}</text>
            </view>
          </view>
          <view v-if="quickReasonBullets.length > 0" class="quick-reason-panel">
            <view class="section-mini-head">
              <text class="mini-title">判断依据</text>
              <text class="mini-sub">为什么这次会这么判断</text>
            </view>
            <text v-for="reason in quickReasonBullets" :key="reason" class="quick-reason">• {{ reason }}</text>
          </view>
          <view v-if="latestStatusCard" class="quick-status-panel">
            <view class="section-mini-head">
              <text class="mini-title">当前状态</text>
              <text class="mini-sub">阶段、状态和关系体感</text>
            </view>
            <text class="status-meta">{{ latestStatusMeta }}</text>
            <text class="status-summary">{{ latestStatusCard.summary }}</text>
            <text v-if="latestStatusCautionText" class="muted">{{ latestStatusCautionText }}</text>
          </view>
          <view v-if="latestActionAdvice" class="quick-guidance-panel">
            <text class="ai-panel-label">你接下来怎么做</text>
            <view class="guidance-item">
              <text class="guidance-label">先别这样做</text>
              <text class="guidance-text">{{ latestActionAdvice.dont }}</text>
            </view>
            <view class="guidance-item">
              <text class="guidance-label">怎么做</text>
              <text class="guidance-text">{{ latestActionAdvice.do }}</text>
            </view>
            <view class="guidance-item">
              <text class="guidance-label">可以这样说</text>
              <text class="guidance-text">{{ latestActionAdvice.say }}</text>
            </view>
            <view class="guidance-item">
              <text class="guidance-label">表情和情绪节奏</text>
              <text class="guidance-text">{{ latestActionAdvice.tone }}</text>
            </view>
            <view class="guidance-item">
              <text class="guidance-label">这次观察重点</text>
              <text class="guidance-text">{{ latestActionAdvice.observe }}</text>
            </view>
            <view v-if="latestPrimaryFocus?.nextRecordPrompt" class="guidance-item">
              <text class="guidance-label">下一次重点记录什么</text>
              <text class="guidance-text">{{ formatFocusPrompt(latestPrimaryFocus.nextRecordPrompt) }}</text>
            </view>
          </view>
          <view class="actions">
            <button class="btn-secondary" @click="goCaseDetail(latestCase.caseId)">查看当前主页</button>
          </view>
        </view>

        <view v-if="profileSideRead" class="card profile-side-card">
          <view class="section-mini-head">
            <text class="mini-title">{{ profileSideRead.title }}</text>
            <text class="mini-sub">即时反馈下方参考</text>
          </view>
          <text class="muted">{{ profileSideRead.summary }}</text>
          <view class="side-read-grid">
            <view v-for="item in profileSideRead.sections" :key="item.label" class="side-read-item">
              <text class="side-read-label">{{ item.label }}</text>
              <text class="side-read-text">{{ item.text }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { getCases, createCase, createTimeline, analyzeAttachment, getCachedSelfProfile, getCurrentUserId, getSelfProfile, getTempFileURL, uploadFile } from '@/utils/api'
import { combineDateAndTimeToISOString, getActiveCaseId, getDateInputValue, getTimeInputValue, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { buildProfileItems, compareAssessments, buildObjectStatusCard, buildFocusItems, buildReadableActionAdvice, buildZodiacConstellationSideRead } from '@/utils/insights'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const activeCaseId = ref('')
const selfProfile = ref<any>(getCachedSelfProfile())
const quickDesc = ref('')
const quickDate = ref(getDateInputValue())
const quickTime = ref(getTimeInputValue())
const quickSubmitting = ref(false)
const quickUploading = ref(false)
const quickSubjectRole = ref<'target' | 'self' | 'both'>('target')
const quickSubjectRoleConfidence = ref<'auto' | 'user_selected'>('auto')
const quickAttachments = ref<any[]>([])
const quickFeedback = ref<{ caseId: string; eventType: string } | null>(null)

const subjectRoleOptions = [
  { value: 'target', label: '对方' },
  { value: 'self', label: '自己' },
  { value: 'both', label: '互动' }
] as const

const latestCase = computed(() => {
  const active = activeCaseId.value
  if (active) {
    const matched = cases.value.find((item: any) => item.caseId === active || item._id === active)
    if (matched) return matched
  }
  return cases.value[0] || {} as any
})

const latestProfileItems = computed(() => {
  const p = latestCase.value?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
})

const latestTriggerEvent = computed(() => {
  const triggerEventId = latestCase.value?.latestResult?.triggerEventId
  if (!triggerEventId) return null
  return latestCase.value?.timeline?.find((item: any) => (item.id || item._id) === triggerEventId) || null
})

const latestFeedbackEventType = computed(() => {
  return latestTriggerEvent.value?.type || latestCase.value?.latestResult?.triggerEventType || 'note'
})

const latestTrend = computed(() => {
  if (!latestCase.value?.latestResult || !latestCase.value?.assessments?.length) return null
  const previous = latestCase.value.assessments.length > 1
    ? latestCase.value.assessments[latestCase.value.assessments.length - 2]
    : null
  return compareAssessments(previous, latestCase.value.latestResult)
})

const latestStatusCard = computed(() => {
  if (!latestCase.value?.latestResult) return null
  return buildObjectStatusCard({
    ...latestCase.value,
    timeline: latestCase.value.timeline || [],
    assessments: latestCase.value.assessments || [latestCase.value.latestResult]
  })
})

const latestPrimaryFocus = computed(() => {
  if (!latestCase.value?.latestResult) return null
  const persistedFocus = latestCase.value.latestResult.nextRecordFocus
  if (persistedFocus && typeof persistedFocus === 'object') return persistedFocus
  return buildFocusItems({
    ...latestCase.value,
    timeline: latestCase.value.timeline || [],
    assessments: latestCase.value.assessments || [latestCase.value.latestResult]
  })[0] || null
})

const latestActionAdvice = computed(() => {
  if (!latestCase.value?.latestResult) return null
  return buildReadableActionAdvice(latestCase.value, latestCase.value.latestResult, latestTriggerEvent.value, latestPrimaryFocus.value)
})

const latestKeywordText = computed(() => {
  const labels = latestCase.value?.latestResult?.primaryLabels
  return Array.isArray(labels) ? labels.slice(0, 4).join(' / ') : ''
})

const quickReasonBullets = computed(() => {
  const bullets = latestCase.value?.latestResult?.explanation?.bullets
  return Array.isArray(bullets) ? bullets.slice(0, 3) : []
})

const latestStatusMeta = computed(() => {
  if (!latestStatusCard.value) return ''
  return `当前处于${latestStatusCard.value.phase}，整体表现更像${latestStatusCard.value.state}，关系体感偏${latestStatusCard.value.weather}。`
})

const latestStatusCautionText = computed(() => {
  const caution = String(latestStatusCard.value?.caution || '').trim()
  if (!caution) return ''
  if (caution.startsWith('下一次最值得记录的是：') && latestPrimaryFocus.value) return ''
  return caution
})

const profileSideRead = computed(() => {
  return buildZodiacConstellationSideRead({
    profile: latestCase.value?.profile,
    selfProfile: selfProfile.value,
    event: latestTriggerEvent.value
  })
})

const quickSubjectRoleHint = computed(() => {
  const label = mapSubjectRoleLabel(quickSubjectRole.value)
  if (quickSubjectRoleConfidence.value === 'user_selected') return `已手动设为：${label}。`
  if (quickSubjectRole.value === 'self') return 'AI 判断这更像你的心理感受或自我状态，已归为“自己”。'
  if (quickSubjectRole.value === 'both') return 'AI 判断这更像双方互动，建议重点区分谁主动、谁回应、谁拒绝。'
  return '默认按“对方”记录；如果写的是你的心理感受，请改为“自己”。'
})

const showQuickFeedback = computed(() => {
  return Boolean(
    latestCase.value?.latestResult
    && latestTrend.value
    && latestTriggerEvent.value
  )
})

watch(quickDesc, (value) => {
  if (quickSubjectRoleConfidence.value === 'user_selected') return
  quickSubjectRole.value = inferSubjectRole(value)
})

function mapIntentLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低意向'
    case 'low_medium': return '偏低意向'
    case 'medium': return '中等意向'
    case 'medium_high': return '中高意向'
    case 'high': return '高意向'
    default: return '未评估'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未评估'
  }
}

function mapTimelineTypeLabel(type?: string) {
  switch (type) {
    case 'positive': return '推进事件'
    case 'risk': return '风险事件'
    case 'verification': return '验证事件'
    case 'note': return '普通记录'
    default: return '关系记录'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'observe': return '继续观察'
    case 'verify': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    case 'insufficient_data': return '样本还不够'
    default: return '继续观察'
  }
}

function mapSubjectRoleLabel(role?: string) {
  switch (role) {
    case 'self': return '自己'
    case 'both': return '互动'
    case 'target': return '对方'
    default: return '对方'
  }
}

function inferSubjectRole(value?: string): 'target' | 'self' | 'both' {
  const text = String(value || '').trim()
  if (!text) return 'target'
  const selfFeeling = /(我.*(感觉|觉得|感到|心理|心里|焦虑|难受|失落|开心|期待|害怕|纠结|想他|想她|想对方|放不下|不安|委屈|生气|吃醋)|自己.*(状态|感受|情绪|心理|心里))/.test(text)
  if (selfFeeling) return 'self'
  const hasSelf = /(我|我们|本人|自己|这边)/.test(text)
  const hasTarget = /(他|她|对方|对象|男生|女生|ta|TA)/i.test(text)
  const hasInteraction = /(一起|互相|聊天|见面|约|吃饭|看电影|通话|视频|见了|碰面|散步|出游|互动)/.test(text)
  if ((hasSelf && hasTarget) || hasInteraction) return 'both'
  if (hasSelf) return 'self'
  return 'target'
}

function setQuickSubjectRole(role: 'target' | 'self' | 'both') {
  quickSubjectRole.value = role
  quickSubjectRoleConfidence.value = 'user_selected'
}

function mapConfidenceLabel(level?: string) {
  switch (level) {
    case 'low': return '低'
    case 'medium': return '中'
    case 'high': return '高'
    default: return level || '--'
  }
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function scoreFillStyle(score: any, kind: 'intent' | 'risk') {
  const value = clampScore(score)
  const alpha = 0.18 + (value / 100) * 0.72
  const background = kind === 'risk'
    ? `linear-gradient(90deg, rgba(184, 74, 58, ${alpha}), rgba(126, 43, 35, ${alpha}))`
    : `linear-gradient(90deg, rgba(53, 111, 96, ${alpha}), rgba(18, 60, 54, ${alpha}))`
  return { width: `${value}%`, background }
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '持平'
}

function deltaClass(delta: number) {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function formatFocusPrompt(value?: string) {
  return String(value || '')
    .replace(/^本次重点记录[:：]?\s*/, '')
    .replace(/^下一次重点记录[:：]?\s*/, '')
    .replace(/^下一次最值得记录的是[:：]?\s*/, '')
    .trim()
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

onShow(() => {
  activeCaseId.value = getActiveCaseId()
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const [list, profileRes] = await Promise.all([
      getCases(uid),
      getSelfProfile().catch(() => null)
    ])
    if (profileRes?.success) selfProfile.value = profileRes.selfProfile
    const normalizedCases = (list || []).map((c: any) => ({ ...c, caseId: c.caseId || c._id }))
    cases.value = normalizedCases
    const storedActiveCaseId = getActiveCaseId()
    const activeExists = Boolean(storedActiveCaseId && normalizedCases.some((item: any) => item.caseId === storedActiveCaseId || item._id === storedActiveCaseId))
    if (activeExists) {
      activeCaseId.value = storedActiveCaseId
    } else {
      const firstCaseId = normalizedCases[0]?.caseId || ''
      activeCaseId.value = firstCaseId
      if (firstCaseId) setActiveCaseId(firstCaseId)
    }
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onCreateCase(payload: { name: string; answers: any[]; profile: any }) {
  uni.showLoading({ title: '创建中...' })
  try {
    const res = await createCase({
      userId: userId.value,
      name: payload.name,
      answers: payload.answers,
      profile: payload.profile
    })
    uni.hideLoading()
    if (res.success) {
      showSuccess('已创建')
      const caseId = res.caseId || res.case?.caseId
      if (caseId) {
        setActiveCaseId(caseId)
        activeCaseId.value = caseId
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      } else {
        await loadData()
      }
    } else {
      showError(res.message || '创建失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    showError(e?.message || '创建失败')
  }
}

function onQuickDateChange(e: any) {
  quickDate.value = e.detail.value
}

function onQuickTimeChange(e: any) {
  quickTime.value = e.detail.value
}

function getFileName(filePath: string, fallback: string) {
  const clean = String(filePath || '').split('?')[0]
  return clean.split('/').pop() || fallback
}

function buildQuickCloudPath(filePath: string, index: number) {
  const ext = getFileName(filePath, '').split('.').pop() || 'jpg'
  return `timeline/${userId.value || 'user'}/${Date.now()}-${index}.${ext}`
}

async function chooseQuickImages() {
  if (quickUploading.value) return
  const remain = Math.max(0, 6 - quickAttachments.value.length)
  if (remain === 0) {
    showError('最多上传 6 张图片')
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res: any) => {
      const files = res.tempFiles || []
      if (!files.length) return
      quickUploading.value = true
      uni.showLoading({ title: '上传图片...' })
      try {
        const uploaded = []
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i]
          const filePath = file.path || file.tempFilePath
          if (!filePath) continue
          const fileID = await uploadFile(filePath, buildQuickCloudPath(filePath, i))
          const analysisRes = await analyzeAttachment({ fileID, mediaType: 'image' }).catch(() => null)
          const url = await getTempFileURL(fileID).catch(() => '')
          uploaded.push({
            type: 'image',
            fileID,
            name: getFileName(filePath, `图片${quickAttachments.value.length + uploaded.length + 1}`),
            size: file.size || 0,
            url,
            analysis: analysisRes?.success ? analysisRes.analysis : undefined
          })
        }
        quickAttachments.value = [...quickAttachments.value, ...uploaded]
      } catch (error: any) {
        showError(error?.message || '图片上传失败')
      } finally {
        uni.hideLoading()
        quickUploading.value = false
      }
    }
  })
}

function removeQuickAttachment(index: number) {
  quickAttachments.value = quickAttachments.value.filter((_, i) => i !== index)
}

async function previewQuickAttachment(index = 0) {
  const urls = quickAttachments.value.map((item: any) => item.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

async function submitQuickRecord() {
  if (quickSubmitting.value) return
  if (!quickDesc.value.trim()) {
    showError('请填写描述')
    return
  }
  if (!latestCase.value?.caseId) return
  quickSubmitting.value = true
  try {
    const desc = quickDesc.value.trim()
    const currentCaseId = latestCase.value.caseId
    const res = await createTimeline({
      userId: userId.value,
      caseId: currentCaseId,
      description: desc,
      subjectRole: quickSubjectRole.value,
      subjectRoleConfidence: quickSubjectRoleConfidence.value === 'user_selected' ? 'user_selected' : 'confirmed',
      attachments: quickAttachments.value.map(({ url: _url, ...item }: any) => item),
      occurrenceAt: combineDateAndTimeToISOString(quickDate.value, quickTime.value)
    })
    if (res.success) {
      showSuccess('已记录')
      quickDesc.value = ''
      quickSubjectRole.value = 'target'
      quickSubjectRoleConfidence.value = 'auto'
      quickAttachments.value = []
      quickDate.value = getDateInputValue()
      quickTime.value = getTimeInputValue()
      await loadData()
      quickFeedback.value = {
        caseId: currentCaseId,
        eventType: res.eventType || latestCase.value?.latestResult?.triggerEventType || 'note'
      }
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    quickSubmitting.value = false
  }
}

function goCaseDetail(caseId: string) {
  setActiveCaseId(caseId)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f4ede2;
  padding: 24rpx;
  box-sizing: border-box;
}
.loading {
  text-align: center;
  padding: 80rpx 0;
  color: #786857;
}
.card {
  background: #fbf6ee;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.hero-card {
  background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%);
}
.hero-topline {
  display: block;
  font-size: 22rpx;
  color: #786857;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-bottom: 8rpx;
}
.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #143f3a;
  margin: 8rpx 0;
}
.h2 {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #241b12;
  margin-bottom: 12rpx;
}
.h3 {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #241b12;
}
.hero-subtext {
  display: block;
  font-size: 26rpx;
  color: #786857;
  line-height: 1.6;
  margin-top: 8rpx;
}
.muted {
  display: block;
  font-size: 24rpx;
  color: #786857;
  margin: 6rpx 0;
}
.section-head { margin-bottom: 18rpx; }
.case-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}
.kpi-item {
  flex: 1 1 40%;
  background: #fff;
  border-radius: 14rpx;
  padding: 20rpx;
  min-width: 200rpx;
}
.kpi-label {
  display: block;
  font-size: 22rpx;
  color: #786857;
}
.kpi-value {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #143f3a;
  margin-top: 4rpx;
}
.case-identity {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 8rpx;
}
.badges { margin-top: 18rpx; }
.badge {
  display: inline-block;
  padding: 8rpx 16rpx;
  background: #efe7d8;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #241b12;
  margin: 4rpx;
}
.quick-record-box {
  margin-top: 28rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 14rpx;
}
.text-area {
  width: 100%;
  min-height: 160rpx;
  padding: 18rpx;
  margin-top: 12rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #241b12;
  box-sizing: border-box;
}
.field { margin-top: 16rpx; }
.field-label {
  display: block;
  font-size: 24rpx;
  color: #241b12;
  margin-bottom: 8rpx;
}
.picker-view {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 22rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #241b12;
}
.datetime-row {
  display: grid;
  grid-template-columns: 1fr 220rpx;
  gap: 12rpx;
}
.role-segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}
.role-segment {
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  border-radius: 12rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  color: #786857;
  font-size: 24rpx;
}
.role-segment.active {
  background: rgba(20, 63, 58, 0.1);
  border-color: #143f3a;
  color: #143f3a;
  font-weight: 700;
}
.attachment-actions {
  margin-top: 0;
}
.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}
.attachment-item {
  padding: 16rpx;
  border-radius: 12rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
}
.attachment-name {
  display: block;
  color: #241b12;
  font-size: 24rpx;
  font-weight: 700;
}
.attachment-link {
  display: block;
  margin-top: 6rpx;
  color: #14633a;
  font-size: 22rpx;
  line-height: 1.4;
  word-break: break-all;
}
.link-button {
  margin-top: 10rpx;
  padding: 0;
  height: 48rpx;
  line-height: 48rpx;
  background: transparent;
  border: none;
  color: #143f3a;
  font-size: 24rpx;
  text-align: left;
}
.link-button.danger {
  color: #b85c38;
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.btn-primary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #143f3a;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.btn-secondary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #fff;
  color: #143f3a;
  border: 2rpx solid #143f3a;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: #efe7d8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar.sm {
  width: 68rpx;
  height: 68rpx;
}
.profile-avatar image {
  width: 100%;
  height: 100%;
}
.avatar-placeholder {
  font-size: 24rpx;
  font-weight: 700;
  color: #786857;
}
.status-card {
  margin-top: 20rpx;
  border-left: 8rpx solid #143f3a;
}
.status-card.success {
  border-left-color: #14633a;
  background: #dff5e8;
}
.status-card.warning {
  border-left-color: #b85c38;
  background: #f9d8d2;
}
.status-strong {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #241b12;
}
.feedback-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.feedback-headline {
  margin-top: 10rpx;
}
.quick-section,
.quick-reason-panel,
.quick-status-panel,
.quick-guidance-panel,
.score-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.section-mini-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.mini-title {
  color: #241b12;
  font-size: 26rpx;
  font-weight: 700;
}
.mini-sub,
.score-label,
.score-bucket,
.delta-label,
.status-meta {
  color: #786857;
  font-size: 22rpx;
}
.feedback-headline.strong,
.status-summary {
  display: block;
  color: #241b12;
  font-size: 26rpx;
  font-weight: 650;
  line-height: 1.55;
}
.score-row + .score-row {
  margin-top: 18rpx;
}
.score-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.score-value {
  color: #143f3a;
  font-size: 36rpx;
  line-height: 1;
  font-weight: 800;
}
.score-track {
  width: 100%;
  height: 18rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
}
.score-fill {
  height: 18rpx;
  min-width: 4rpx;
  border-radius: 999rpx;
}
.instant-delta-panel {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
.instant-delta-item {
  flex: 1;
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.delta-value {
  display: block;
  margin-top: 6rpx;
  color: #786857;
  font-size: 38rpx;
  font-weight: 800;
}
.delta-value.up { color: #14633a; }
.delta-value.down { color: #b85c38; }
.quick-reason {
  display: block;
  margin-top: 10rpx;
  color: #241b12;
  font-size: 24rpx;
  line-height: 1.55;
}
.ai-panel-label,
.guidance-label {
  display: block;
  color: #143f3a;
  font-size: 22rpx;
  font-weight: 750;
}
.guidance-item {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.72);
  border: 1rpx solid rgba(18, 60, 54, 0.06);
}
.guidance-text {
  display: block;
  margin-top: 6rpx;
  color: #241b12;
  font-size: 24rpx;
  line-height: 1.55;
}
.profile-side-card {
  border-left: 8rpx solid rgba(20, 63, 58, 0.28);
}
.side-read-grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 16rpx;
}
.side-read-item {
  padding: 18rpx;
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.side-read-label {
  display: block;
  color: #143f3a;
  font-size: 22rpx;
  font-weight: 750;
}
.side-read-text {
  display: block;
  margin-top: 8rpx;
  color: #241b12;
  font-size: 24rpx;
  line-height: 1.58;
}
</style>
