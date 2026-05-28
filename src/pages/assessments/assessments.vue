<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">分析记录不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">Decision Records / {{ caseFile.name }}</text>
        <text class="h1">一个对象已经支持多次分析记录</text>
        <text class="hero-subtext">初评、手动重判和事件驱动重算都会累计到这里，方便你回看判断是怎么变化的。</text>
        <view class="actions">
          <button class="btn-secondary" @click="goCaseDetail">返回关系主页</button>
          <button class="btn-secondary" @click="goTimeline">打开时间线</button>
        </view>
      </view>

      <view class="card">
        <text class="h2">分析记录</text>
        <text class="muted">最新分析排在最上面。共 {{ assessments.length }} 次分析。每条记录包含趋势变化、AI 分析、证据等级和触发事件。</text>
      </view>

      <view v-if="assessments.length === 0" class="card">
        <text class="muted">还没有分析记录，先做一次初评或补一条会触发重算的事件。</text>
      </view>

      <view v-else class="grid">
        <view
          v-for="(item, index) in assessments"
          :key="item.assessmentId || index"
          class="card a-card"
        >
          <view class="a-header">
            <view class="a-title-group">
              <text class="a-title">第 {{ assessments.length - index }} 次分析</text>
              <text class="a-time">{{ formatAssessmentTime(item.createdAt) }}</text>
            </view>
            <view class="a-meta-pills">
              <text class="source-pill">{{ mapSourceLabel(item.source) }}</text>
              <text v-if="hasAIReview(item)" class="ai-badge">AI 已参与分析</text>
            </view>
          </view>

          <view class="event-strip">
            <view>
              <text class="event-label">触发事件</text>
              <text class="event-title">{{ item.triggerEventTitle || '本次分析未绑定具体事件' }}</text>
              <view v-if="item.primaryLabels?.length" class="label-row">
                <text v-for="label in item.primaryLabels" :key="label" class="label-chip">{{ label }}</text>
              </view>
              <view v-if="getAssessmentEvent(item)" class="event-actions">
                <button class="mini-link" @click="goTimelineEvent(getAssessmentEvent(item).id || getAssessmentEvent(item)._id)">回到时间轴事件</button>
              </view>
            </view>
            <view class="evidence-pair">
              <text class="evidence-main">证据 {{ item.evidenceLevel || '--' }}</text>
              <text class="evidence-sub">可信度 {{ mapConfidenceLabel(item.confidenceLevel) }}</text>
            </view>
          </view>

          <view class="score-panel">
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">意向</text>
                <text class="score-value">{{ normalizedScore(item.intentScore) }}</text>
                <text class="score-bucket">{{ mapIntentLabel(item.intentBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill intent-fill" :style="scoreFillStyle(item.intentScore, 'intent')"></view>
              </view>
            </view>
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">风险</text>
                <text class="score-value">{{ normalizedScore(item.consistencyRiskScore) }}</text>
                <text class="score-bucket">{{ mapRiskLabel(item.riskBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill risk-fill" :style="scoreFillStyle(item.consistencyRiskScore, 'risk')"></view>
              </view>
            </view>
          </view>

          <view v-if="trendSummaries[index]" class="trend-summary-box">
            <view class="trend-deltas">
              <text class="delta-pill" :class="deltaClass(trendSummaries[index].intentDelta)">意向 {{ formatDelta(trendSummaries[index].intentDelta) }}</text>
              <text class="delta-pill" :class="deltaClass(trendSummaries[index].riskDelta)">风险 {{ formatDelta(trendSummaries[index].riskDelta) }}</text>
              <text v-if="trendSummaries[index].evidenceChanged" class="delta-pill evidence-delta">证据变化</text>
            </view>
            <text v-if="trendSummaries[index].summaryText" class="trend-summary" user-select>{{ trendSummaries[index].summaryText }}</text>
            <text v-if="trendNote(trendSummaries[index])" class="trend-summary" user-select>{{ trendNote(trendSummaries[index]) }}</text>
            <text v-if="trendSummaries[index].warningText" class="trend-warning" user-select>{{ trendSummaries[index].warningText }}</text>
          </view>

          <view v-else class="trend-summary-box first-summary">
            <text class="trend-summary">这是第一条分析记录，后续新增事件或手动重判后会开始形成趋势对比。</text>
          </view>

          <view v-if="statusSnapshots[index]" class="status-snapshot-box">
            <view class="status-head">
              <text class="ai-panel-label">对象状态</text>
              <view class="status-tags">
                <text class="status-chip">{{ statusSnapshots[index].phase }}</text>
                <text class="status-chip">{{ statusSnapshots[index].vibe }}</text>
              </view>
            </view>
            <text class="status-summary" user-select>{{ statusSnapshots[index].summary }}</text>
            <text class="status-caution" user-select>{{ statusSnapshots[index].caution }}</text>
          </view>

          <view v-if="item.nextAction || getImageLinkItems(item).length > 0" class="trace-panel">
            <text class="ai-panel-label">即时反馈追溯</text>
            <view v-if="item.nextAction" class="trace-row">
              <text class="trace-label">下一步动作</text>
              <text class="trace-value">{{ mapAction(item.nextAction) }}</text>
            </view>
            <view v-if="getImageLinkItems(item).length > 0" class="image-link-list">
              <view
                v-for="(link, linkIndex) in getImageLinkItems(item)"
                :key="link.fileID"
                class="image-link-item"
                @click="previewAssessmentImages(item, linkIndex)"
              >
                <text class="trace-label">{{ link.name }}</text>
                <text class="image-link-url" selectable>{{ link.url || '授权链接生成中...' }}</text>
              </view>
            </view>
          </view>

          <view v-if="sideSnapshots[index]" class="side-snapshot-box">
            <text class="ai-panel-label">侧写快照</text>
            <text class="headline" user-select>{{ sideSnapshots[index].summary }}</text>
            <view class="side-grid">
              <view v-for="section in sideSnapshots[index].sections" :key="section.label" class="side-item">
                <text class="side-label">{{ section.label }}</text>
                <text class="side-text" user-select>{{ section.text }}</text>
              </view>
            </view>
          </view>

          <view v-if="item.explanation?.petLine || item.explanation?.bullets?.length" class="ai-panel">
            <text class="ai-panel-label">{{ hasAIReview(item) ? 'AI 分析内容' : '分析内容' }}</text>
            <text v-if="item.explanation?.petLine" class="headline" user-select>{{ item.explanation.petLine }}</text>
            <view v-if="item.explanation?.bullets?.length" class="bullets">
              <text v-for="bullet in item.explanation.bullets?.slice(0, 3)" :key="bullet" class="bullet" user-select>• {{ bullet }}</text>
            </view>
            <view v-if="item.explanation?.cautions?.length" class="caution-list">
              <text class="ai-panel-label">使用提醒</text>
              <text v-for="caution in item.explanation.cautions?.slice(0, 2)" :key="caution" class="bullet" user-select>• {{ caution }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCachedSelfProfile, getCaseDetail, getCurrentUserId, getSelfProfile, getTempFileURL } from '@/utils/api'
import { setActiveCaseId, setPendingTimelineContext, showError } from '@/utils/helpers'
import { buildObjectStatusCard, buildProfileSideRead, compareAssessments } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const themeVars = ref(getThemeStyle())
const selfProfile = ref<any>(getCachedSelfProfile())
const imageUrlMap = ref<Record<string, string>>({})

const assessments = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(b) - getAssessmentTimestamp(a))
})

const trendSummaries = computed(() => {
  return assessments.value.map((item: any, index: number) => {
    const previous = assessments.value[index + 1] || null
    const trend = compareAssessments(previous, item)
    return trend.hasPrevious ? trend : null
  })
})

const chronologicalAssessments = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
})

const statusSnapshots = computed(() => {
  return assessments.value.map((item: any) => {
    const index = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
    const history = index >= 0
      ? chronologicalAssessments.value.slice(0, index + 1)
      : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
    return buildObjectStatusCard({
      ...caseFile.value,
      latestResult: item,
      assessments: history.length > 0 ? history : [item],
      timeline: caseFile.value?.timeline || []
    })
  })
})

const sideSnapshots = computed(() => {
  return assessments.value.map((item: any, index: number) => {
    const event = getAssessmentEvent(item)
    const trend = trendSummaries.value[index]
    const chronologicalIndex = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
    const history = chronologicalIndex >= 0
      ? chronologicalAssessments.value.slice(0, chronologicalIndex + 1)
      : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
    return buildProfileSideRead({
      profile: caseFile.value?.profile,
      selfProfile: selfProfile.value,
      event,
      latestResult: item,
      trend,
      history
    })
  })
})

const timelineById = computed(() => {
  const map = new Map<string, any>()
  for (const item of caseFile.value?.timeline || []) {
    const id = String(item.id || item._id || '').trim()
    if (id) map.set(id, item)
  }
  return map
})

function mapIntentLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低意向'
    case 'low_medium': return '偏低意向'
    case 'medium': return '中等意向'
    case 'medium_high': return '中高意向'
    case 'high': return '高意向'
    default: return '未分析'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未分析'
  }
}

function mapConfidenceLabel(level?: string) {
  switch (level) {
    case 'low': return '低'
    case 'medium': return '中'
    case 'high': return '高'
    default: return level || '--'
  }
}

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '分析'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'verify':
    case 'insufficient_data': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    default: return action || '先做验证'
  }
}

function getAssessmentEvent(item: any) {
  const eventId = String(item?.triggerEventId || '').trim()
  return eventId ? timelineById.value.get(eventId) || null : null
}

function getImageAttachments(item: any) {
  const event = getAssessmentEvent(item)
  const attachments = Array.isArray(event?.attachments) ? event.attachments : []
  return attachments.filter((attachment: any) => attachment?.type === 'image' && attachment?.fileID)
}

function getImageLinkItems(item: any) {
  return getImageAttachments(item).map((attachment: any, index: number) => ({
    fileID: attachment.fileID,
    name: attachment.name || `图片${index + 1}`,
    url: imageUrlMap.value[attachment.fileID] || ''
  }))
}

async function loadAssessmentImageLinks() {
  const nextMap = { ...imageUrlMap.value }
  const attachments = assessments.value.flatMap((item: any) => getImageAttachments(item))
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function previewAssessmentImages(item: any, index = 0) {
  await loadAssessmentImageLinks()
  const urls = getImageLinkItems(item).map((link: any) => link.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

function getAssessmentTimestamp(item: any) {
  const raw = item?.createdAt
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  if (raw instanceof Date) return raw.getTime()
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function getAssessmentKey(item: any) {
  return String(item?._id || item?.assessmentId || `${item?.createdAt || ''}-${item?.triggerEventId || ''}`)
}

function formatAssessmentTime(value: any) {
  const timestamp = getAssessmentTimestamp({ createdAt: value })
  if (!timestamp) return '时间未记录'
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizedScore(score: any) {
  return clampScore(score)
}

function scoreFillStyle(score: any, kind: 'intent' | 'risk') {
  const value = clampScore(score)
  const alpha = 0.18 + (value / 100) * 0.72
  const color = kind === 'risk'
    ? `linear-gradient(90deg, rgba(184, 74, 58, ${alpha}), rgba(126, 43, 35, ${alpha}))`
    : `linear-gradient(90deg, rgba(53, 111, 96, ${alpha}), rgba(18, 60, 54, ${alpha}))`
  return {
    width: `${value}%`,
    background: color
  }
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '持平'
}

function deltaClass(delta: number) {
  if (delta > 0) return 'delta-up'
  if (delta < 0) return 'delta-down'
  return 'delta-flat'
}

function trendNote(trend: any) {
  if (!trend?.evidenceChanged) return ''
  return '证据等级发生变化，本次判断的可靠度需要结合新增事件重新看。'
}

function hasAIReview(item: any) {
  return Boolean(
    item?.aiUsed ||
    String(item?.explanation?.headline || '').startsWith('AI 分析后：') ||
    String(item?.explanation?.headline || '').startsWith('AI 研判后：')
  )
}

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || ''
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    showError('缺少 caseId')
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const [detail, profileRes] = await Promise.all([
      getCaseDetail(uid, caseId.value),
      getSelfProfile().catch(() => null)
    ])
    caseFile.value = detail
    if (profileRes?.success) selfProfile.value = profileRes.selfProfile
    await loadAssessmentImageLinks()
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}

function goTimelineEvent(eventId: string) {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({
    caseId: caseId.value,
    targetEventId: eventId
  })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28rpx;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
}

.center {
  text-align: center;
  padding: 80rpx 0;
}

.card {
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
  padding: 32rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background: linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: 0 22rpx 44rpx rgba(18, 60, 54, 0.18);
}

.hero-card::after {
  content: "";
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}

.hero-topline {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.h1 {
  display: block;
  margin: 8rpx 0;
  font-size: 36rpx;
  line-height: 1.3;
  font-weight: 700;
  color: var(--text-main, #201914);
}

.hero-card .h1 {
  color: #fffaf0;
  font-size: 42rpx;
}

.h2 {
  display: block;
  margin-bottom: 10rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-main, #201914);
}

.hero-subtext,
.muted {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--text-muted, #76695c);
}

.hero-subtext {
  font-size: 26rpx;
  color: rgba(255, 252, 247, 0.76);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.btn-secondary {
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.92);
  color: var(--primary, #123c36);
  font-size: 28rpx;
  font-weight: 600;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.a-card {
  padding: 28rpx;
  border-left: 6rpx solid rgba(201, 164, 92, 0.72);
  background: var(--card-soft, #fffaf3);
}

.a-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.08);
}

.a-title-group {
  flex: 1;
  min-width: 0;
}

.a-title {
  display: block;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 700;
  color: var(--primary, #123c36);
}

.a-time {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-muted, #76695c);
}

.a-meta-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 330rpx;
}

.source-pill,
.ai-badge,
.delta-pill {
  display: inline-block;
  min-height: 40rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  line-height: 40rpx;
  font-weight: 700;
}

.source-pill {
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
}

.ai-badge {
  background: rgba(201, 164, 92, 0.2);
  color: #7c5b18;
}

.event-strip {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background: rgba(255, 255, 255, 0.5);
}

.event-label,
.ai-panel-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: var(--text-muted, #76695c);
}

.event-title {
  display: block;
  font-size: 27rpx;
  line-height: 1.45;
  font-weight: 700;
  color: var(--text-main, #201914);
}

.label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.event-actions {
  margin-top: 14rpx;
}

.mini-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
  line-height: 48rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.18);
  background: rgba(18, 60, 54, 0.06);
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 700;
}

.mini-link::after {
  border: 0;
}

.label-chip,
.status-chip {
  display: inline-block;
  min-height: 38rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.24);
  background: var(--accent-soft, rgba(201, 164, 92, 0.14));
  color: #6f5225;
  font-size: 21rpx;
  line-height: 38rpx;
  font-weight: 700;
}

.evidence-pair {
  flex: 0 0 170rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 18rpx;
  border-left: 1rpx solid rgba(18, 60, 54, 0.09);
}

.evidence-main {
  display: block;
  font-size: 26rpx;
  font-weight: 800;
  color: var(--primary, #123c36);
}

.evidence-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-muted, #76695c);
}

.score-panel {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.72);
  border: 1rpx solid rgba(18, 60, 54, 0.07);
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

.score-label {
  font-size: 23rpx;
  color: var(--text-muted, #76695c);
}

.score-value {
  font-size: 36rpx;
  line-height: 1;
  font-weight: 800;
  color: var(--primary, #123c36);
}

.score-bucket {
  font-size: 23rpx;
  color: var(--text-main, #201914);
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

.trend-summary-box,
.status-snapshot-box,
.trace-panel,
.side-snapshot-box,
.ai-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 110rpx),
    var(--card-bg, #fffcf7);
}

.status-snapshot-box {
  border-left: 5rpx solid rgba(201, 164, 92, 0.62);
}

.trace-panel {
  background: rgba(255, 250, 243, 0.72);
}

.trace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx 0;
}

.trace-label,
.trace-value,
.image-link-url {
  display: block;
}

.trace-label {
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
  font-weight: 700;
}

.trace-value {
  color: var(--text-main, #201914);
  font-size: 24rpx;
  font-weight: 750;
}

.image-link-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 10rpx;
}

.image-link-item {
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(201, 164, 92, 0.12);
  border: 1rpx solid rgba(201, 164, 92, 0.2);
}

.image-link-url {
  margin-top: 6rpx;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  line-height: 1.35;
  word-break: break-all;
}

.side-snapshot-box {
  border-left: 5rpx solid rgba(18, 60, 54, 0.2);
}

.side-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.side-item {
  padding: 16rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.72);
}

.side-label {
  display: block;
  color: var(--primary, #123c36);
  font-size: 23rpx;
  font-weight: 750;
}

.side-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  line-height: 1.55;
}

.status-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 430rpx;
}

.status-summary {
  display: block;
  color: var(--text-main, #201914);
  font-size: 25rpx;
  line-height: 1.55;
  font-weight: 700;
}

.status-caution {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  line-height: 1.55;
}

.trend-deltas {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 12rpx;
}

.delta-up {
  background: rgba(18, 60, 54, 0.1);
  color: var(--primary, #123c36);
}

.delta-down {
  background: rgba(118, 105, 92, 0.12);
  color: #6f5f4c;
}

.delta-flat {
  background: rgba(118, 105, 92, 0.08);
  color: var(--text-muted, #76695c);
}

.evidence-delta {
  background: rgba(201, 164, 92, 0.2);
  color: #7c5b18;
}

.trend-summary {
  display: block;
  font-size: 25rpx;
  line-height: 1.55;
  font-weight: 700;
  color: var(--text-main, #201914);
}

.trend-warning {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: var(--risk, #b84a3a);
}

.first-summary {
  background: rgba(255, 252, 247, 0.62);
}

.headline {
  display: block;
  font-size: 26rpx;
  line-height: 1.55;
  font-weight: 700;
  color: var(--text-main, #201914);
}

.bullets {
  margin-top: 12rpx;
}

.caution-list {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.bullet {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: var(--text-muted, #76695c);
}
</style>
