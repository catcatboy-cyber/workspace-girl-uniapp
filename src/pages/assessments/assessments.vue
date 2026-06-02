<template>
  <view class="page v2-mode" :style="themeVars">
    <view v-if="loading" class="loading-v2">加载中...</view>

    <view v-else-if="!caseFile" class="card-v2">
      <text class="section-title-v2">分析记录不可用</text>
      <text class="card-text-v2">当前 Crush 不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">DECISION RECORDS / {{ caseFile.name }}</text>
        <text class="hero-title-v2">一个 Crush 已经支持多次分析记录</text>
        <text class="hero-copy-v2">初评、手动重判和事件驱动重算都会累计到这里，方便你回看判断是怎么变化的。</text>
        <view class="hero-actions-v2">
          <button class="btn-v2 sm" @click="goCaseDetail">返回我们</button>
          <button class="btn-v2 sm" @click="goTimeline">打开往事</button>
        </view>
      </view>

      <view class="card-v2">
        <text class="section-title-v2">分析记录</text>
        <text class="card-text-v2">最新分析排在最上面。共 {{ assessments.length }} 次分析。每条记录包含趋势变化、AI 分析、证据等级和触发事件。</text>
      </view>

      <view v-if="assessments.length === 0" class="card-v2">
        <text class="card-text-v2">还没有分析记录，先做一次初评或补一条会触发重算的事件。</text>
      </view>

      <view v-else class="grid-v2">
        <view
          v-for="(item, index) in assessments"
          :key="item.assessmentId || index"
          class="card-v2 a-card-v2"
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
                <button class="mini-link" @click="goTimelineEvent(getAssessmentEvent(item).id || getAssessmentEvent(item)._id)">跳到这条事件</button>
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
              <text class="ai-panel-label">Crush 状态</text>
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
            <text class="ai-panel-label">星象速写快照</text>
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
.page { min-height: 100vh; background: #f4ede2; padding: 18rpx; box-sizing: border-box; }

.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: 26rpx; font-weight: 600; color: #666; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B);
  border: 3rpx solid #111;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 8rpx 8rpx 0 #111;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .hero-actions-v2 { display: flex; gap: 12rpx; margin-top: 20rpx; flex-wrap: wrap; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; padding: 28rpx; margin-bottom: 24rpx; box-shadow: 6rpx 6rpx 0 #111; }
.v2-mode .section-title-v2 { display: block; font-size: 32rpx; font-weight: 900; color: #111; margin-bottom: 14rpx; line-height: 1.3; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.6; margin: 6rpx 0; }

.v2-mode .btn-v2 { height: 56rpx; line-height: 56rpx; padding: 0 24rpx; background: #fff; color: #111; border: 3rpx solid #111; font-size: 24rpx; font-weight: 800; }
.v2-mode .btn-v2.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2.sm { height: 56rpx; line-height: 56rpx; padding: 0 24rpx; font-size: 24rpx; }

.v2-mode .grid-v2 { display: flex; flex-direction: column; gap: 18rpx; }

/* Assessment cards */
.v2-mode .a-card-v2 {
  background: #fff;
  border: 3rpx solid #111;
  border-left: 12rpx solid #FFD93D;
  padding: 28rpx;
  box-shadow: 6rpx 6rpx 0 #111;
}
.v2-mode .a-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; padding-bottom: 18rpx; border-bottom: 2rpx solid #111; }
.v2-mode .a-title-group { flex: 1; min-width: 0; }
.v2-mode .a-title { display: block; font-size: 30rpx; line-height: 1.35; font-weight: 900; color: #111; }
.v2-mode .a-time { display: block; margin-top: 4rpx; font-size: 22rpx; font-weight: 600; color: #999; }
.v2-mode .a-meta-pills { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8rpx; max-width: 330rpx; }

.v2-mode .source-pill,
.v2-mode .ai-badge,
.v2-mode .delta-pill { display: inline-block; min-height: 40rpx; padding: 0 14rpx; border: 2rpx solid #111; font-size: 21rpx; line-height: 40rpx; font-weight: 800; }
.v2-mode .source-pill { background: #111; color: #FFD93D; }
.v2-mode .ai-badge { background: #FFD93D; color: #111; }

/* Event strip */
.v2-mode .event-strip { display: flex; align-items: stretch; justify-content: space-between; gap: 18rpx; margin-top: 20rpx; padding: 20rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .event-label,
.v2-mode .ai-panel-label { display: block; margin-bottom: 8rpx; font-size: 22rpx; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .event-title { display: block; font-size: 27rpx; line-height: 1.45; font-weight: 800; color: #111; }
.v2-mode .label-row { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.v2-mode .label-chip,
.v2-mode .status-chip { display: inline-block; min-height: 38rpx; padding: 0 14rpx; border: 2rpx solid #111; background: #fff; font-size: 21rpx; line-height: 38rpx; font-weight: 700; color: #111; }
.v2-mode .event-actions { margin-top: 14rpx; }
.v2-mode .mini-link { display: inline-flex; align-items: center; justify-content: center; height: 48rpx; line-height: 48rpx; margin: 0; padding: 0 18rpx; border: 2rpx solid #111; background: #fff; color: #111; font-size: 22rpx; font-weight: 800; }
.v2-mode .mini-link::after { border: 0; }

/* Evidence */
.v2-mode .evidence-pair { flex: 0 0 170rpx; display: flex; flex-direction: column; justify-content: center; padding-left: 18rpx; border-left: 2rpx solid #111; }
.v2-mode .evidence-main { display: block; font-size: 26rpx; font-weight: 900; color: #111; }
.v2-mode .evidence-sub { display: block; margin-top: 4rpx; font-size: 22rpx; font-weight: 600; color: #999; }

/* Score panel */
.v2-mode .score-panel { margin-top: 20rpx; padding: 20rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .score-row + .score-row { margin-top: 18rpx; }
.v2-mode .score-head { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 10rpx; }
.v2-mode .score-label { font-size: 23rpx; font-weight: 700; color: #111; }
.v2-mode .score-value { font-size: 36rpx; line-height: 1; font-weight: 900; color: #111; }
.v2-mode .score-bucket { font-size: 23rpx; font-weight: 700; color: #111; }
.v2-mode .score-track { width: 100%; height: 18rpx; overflow: hidden; border: 2rpx solid #111; background: #fff; }
.v2-mode .score-fill { height: 18rpx; min-width: 4rpx; }

/* Panels */
.v2-mode .trend-summary-box,
.v2-mode .status-snapshot-box,
.v2-mode .trace-panel,
.v2-mode .side-snapshot-box,
.v2-mode .ai-panel { margin-top: 18rpx; padding: 20rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .status-snapshot-box { border-left: 12rpx solid #FFD93D; }
.v2-mode .trace-panel { background: #FFFBEB; }
.v2-mode .side-snapshot-box { border-left: 12rpx solid #111; }
.v2-mode .trace-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 12rpx 0; }
.v2-mode .trace-label { color: #111; font-size: 22rpx; font-weight: 800; }
.v2-mode .trace-value { color: #111; font-size: 24rpx; font-weight: 700; }
.v2-mode .image-link-list { display: flex; flex-direction: column; gap: 12rpx; margin-top: 10rpx; }
.v2-mode .image-link-item { min-width: 0; overflow: hidden; padding: 14rpx 16rpx; background: #fff; border: 2rpx solid #111; }
.v2-mode .image-link-item .trace-label { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v2-mode .image-link-url { display: block; margin-top: 6rpx; color: #666; font-size: 21rpx; line-height: 1.35; word-break: break-all; font-weight: 600; }
.v2-mode .side-grid { display: flex; flex-direction: column; gap: 12rpx; margin-top: 14rpx; }
.v2-mode .side-item { padding: 16rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .side-label { display: block; color: #111; font-size: 23rpx; font-weight: 800; }
.v2-mode .side-text { display: block; margin-top: 8rpx; color: #666; font-size: 24rpx; font-weight: 600; line-height: 1.55; }

.v2-mode .status-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14rpx; margin-bottom: 12rpx; }
.v2-mode .status-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8rpx; max-width: 430rpx; }
.v2-mode .status-chip { background: #fff; }
.v2-mode .status-summary { display: block; color: #111; font-size: 25rpx; line-height: 1.55; font-weight: 800; }
.v2-mode .status-caution { display: block; margin-top: 8rpx; color: #666; font-size: 24rpx; font-weight: 600; line-height: 1.55; }

/* Trend deltas */
.v2-mode .trend-deltas { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 12rpx; }
.v2-mode .delta-pill { border: 2rpx solid #111; }
.v2-mode .delta-up { background: #E0FFF0; color: #111; border-color: #4ECDC4; }
.v2-mode .delta-down { background: #FFEEEC; color: #111; border-color: #FF6B6B; }
.v2-mode .delta-flat { background: #f9f9f9; color: #999; }
.v2-mode .evidence-delta { background: #FFD93D; color: #111; }
.v2-mode .trend-summary { display: block; font-size: 25rpx; line-height: 1.55; font-weight: 800; color: #111; }
.v2-mode .trend-warning { display: block; margin-top: 8rpx; font-size: 24rpx; line-height: 1.55; font-weight: 700; color: #FF5252; }
.v2-mode .first-summary { background: #f9f9f9; }

.v2-mode .headline { display: block; font-size: 26rpx; line-height: 1.55; font-weight: 800; color: #111; }
.v2-mode .bullets { margin-top: 12rpx; }
.v2-mode .caution-list { margin-top: 16rpx; padding-top: 14rpx; border-top: 2rpx solid #111; }
.v2-mode .bullet { display: block; margin-top: 8rpx; font-size: 24rpx; font-weight: 600; line-height: 1.55; color: #666; }
</style>
