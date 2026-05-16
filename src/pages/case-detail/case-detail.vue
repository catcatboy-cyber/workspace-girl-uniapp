<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">结果不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view v-if="profileUpdated" class="card status-card success">
        <text class="status-strong">画像已更新</text>
        <text class="muted">对象画像信息已保存。</text>
      </view>

      <view class="hero-card card">
        <text class="hero-topline">关系主页 / {{ caseFile.name }}</text>
        <text class="h1">{{ result?.explanation?.headline || '暂无评估结果' }}</text>
        <text class="hero-subtext">这是一份结构化判断结果，帮助你减少误判，但不代表事实裁决。</text>
        <view v-if="result" class="pills">
          <text class="pill" :class="intentTone">{{ mapIntentLabel(result.intentBucket) }}</text>
          <text class="pill" :class="riskTone">{{ mapRiskLabel(result.riskBucket) }}</text>
          <text class="pill neutral">证据等级 {{ result.evidenceLevel }}</text>
          <text v-if="isCurrentResultAIReviewed" class="ai-badge">AI 已参与研判</text>
        </view>
      </view>

      <!-- 对象画像 -->
      <view class="card">
        <view class="section-head">
          <view>
            <text class="h2">对象画像</text>
            <text class="object-card-name-head">{{ caseFile.name }}</text>
          </view>
        </view>
        <view v-if="overviewStats.length > 0" class="overview-stats-legacy">
          <view class="section-mini-head">
            <text class="mini-title">关系统计</text>
            <text class="mini-sub">先把最近互动、主动、兑现和受阻情况看清楚。</text>
          </view>
          <view class="overview-stats-grid">
            <view
              v-for="item in overviewStats"
              :key="item.key"
              :class="['overview-stat-box', item.tone ? `tone-${item.tone}` : '']"
            >
              <text class="case-kpi-label">{{ item.label }}</text>
              <text class="case-kpi-value">{{ item.value }}</text>
              <text class="muted overview-stat-hint">{{ item.hint }}</text>
            </view>
          </view>
        </view>
        <view class="profile-inline-head">
          <view class="profile-avatar md">
            <image v-if="caseFile.profile?.avatar" :src="caseFile.profile.avatarUrl || caseFile.profile.avatar" mode="aspectFill" />
            <text v-else class="avatar-placeholder">{{ avatarLabel(caseFile.name) }}</text>
          </view>
        </view>
        <view v-if="objectTypeLabel || objectStatusTags.length" class="object-card-tag-row">
          <text v-if="objectTypeLabel" class="badge badge-primary">{{ objectTypeLabel }}</text>
          <text v-for="tag in objectStatusTags" :key="tag" class="badge badge-soft">{{ tag }}</text>
        </view>
        <view v-if="profileItems.length > 0" class="badges">
          <text v-for="item in profileItems" :key="item" class="badge">{{ item }}</text>
        </view>
        <text v-else class="muted">你还没有为这个对象补充画像信息。</text>
        <view v-if="overviewStats.length > 0" class="overview-stats-current">
          <view class="section-mini-head">
            <text class="mini-title">关系统计</text>
            <text class="mini-sub">放在名字和画像标签下面，先看客观记录和关系变化。</text>
          </view>
          <view class="overview-stats-grid">
            <view
              v-for="item in overviewStats"
              :key="item.key"
              :class="['overview-stat-box', item.tone ? `tone-${item.tone}` : '']"
            >
              <text class="case-kpi-label">{{ item.label }}</text>
              <text class="case-kpi-value">{{ item.value }}</text>
              <text class="muted overview-stat-hint">{{ item.hint }}</text>
            </view>
          </view>
        </view>
        <view v-if="trendDataPanel" class="trend-data-panel">
          <view class="section-mini-head">
            <text class="mini-title">趋势数据</text>
            <text class="mini-sub">14 天净变化、稳定性和关键拐点。</text>
          </view>
          <view class="trend-data-grid">
            <view class="trend-data-box">
              <text class="case-kpi-label">意向</text>
              <view class="trend-data-main">
                <text class="trend-data-score">{{ trendDataPanel.latestIntent }}</text>
                <text class="trend-data-delta" :class="deltaClass(trendDataPanel.intentDelta14)">
                  {{ formatSignedDelta(trendDataPanel.intentDelta14) }}/14天
                </text>
              </view>
            </view>
            <view class="trend-data-box">
              <text class="case-kpi-label">风险</text>
              <view class="trend-data-main">
                <text class="trend-data-score">{{ trendDataPanel.latestRisk }}</text>
                <text class="trend-data-delta" :class="deltaClass(-trendDataPanel.riskDelta14)">
                  {{ formatSignedDelta(trendDataPanel.riskDelta14) }}/14天
                </text>
              </view>
            </view>
            <view class="trend-data-box">
              <text class="case-kpi-label">稳定性</text>
              <view class="trend-data-main">
                <text class="trend-data-score">{{ trendDataPanel.stability }}%</text>
                <text class="trend-data-delta neutral">{{ trendDataPanel.sampleCount }}次评估</text>
              </view>
            </view>
            <view class="trend-data-box">
              <text class="case-kpi-label">证据量</text>
              <view class="trend-data-main">
                <text class="trend-data-score">{{ trendDataPanel.evidenceCount }}</text>
                <text class="trend-data-delta neutral">近14天</text>
              </view>
            </view>
          </view>
          <view class="trend-tag-row">
            <text v-for="tag in trendDataPanel.tags" :key="tag" class="badge">{{ tag }}</text>
          </view>
          <view v-if="trendDataPanel.points.length > 1" class="trend-dot-panel">
            <view class="trend-dot-row">
              <text class="case-kpi-label">意向</text>
              <view class="trend-dot-track">
                <view
                  v-for="point in trendDataPanel.points"
                  :key="`intent-${point.key}`"
                  class="trend-dot"
                  :class="scoreTone(point.intent)"
                  :style="{ left: `${point.x}%`, bottom: `${point.intentY}%` }"
                />
              </view>
            </view>
            <view class="trend-dot-row">
              <text class="case-kpi-label">风险</text>
              <view class="trend-dot-track">
                <view
                  v-for="point in trendDataPanel.points"
                  :key="`risk-${point.key}`"
                  class="trend-dot risk"
                  :class="scoreTone(point.risk)"
                  :style="{ left: `${point.x}%`, bottom: `${point.riskY}%` }"
                />
              </view>
            </view>
          </view>
          <view v-if="trendDataPanel.turningPoints.length > 0" class="turning-list">
            <text class="case-kpi-label">关键拐点 Top 3</text>
            <view v-for="item in trendDataPanel.turningPoints" :key="item.key" class="turning-row">
              <text class="turning-title">{{ item.title }}</text>
              <view class="turning-deltas">
                <text class="delta-pill" :class="deltaClass(item.intentDelta)">意向 {{ formatSignedDelta(item.intentDelta) }}</text>
                <text class="delta-pill" :class="deltaClass(-item.riskDelta)">风险 {{ formatSignedDelta(item.riskDelta) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 本周复盘 -->
      <view class="card weekly-preview-card">
        <view class="section-head">
          <view>
            <text class="h2">本周复盘</text>
            <text class="muted">把本周复盘、当前状态、最近变化和下一步验证重点收在一起。</text>
          </view>
        </view>
        <view v-if="aiWeeklyPreview" class="weekly-preview-content">
          <view class="weekly-preview-head">
            <view>
              <text class="preview-time">{{ aiWeeklyPreview.weekStart }} 至 {{ aiWeeklyPreview.weekEnd }}</text>
              <text class="preview-title">{{ aiWeeklyPreview.title }}</text>
            </view>
            <view class="preview-chip-row">
              <text class="badge">{{ aiWeeklyPreview.trendLabel }}</text>
              <text v-if="statusCard" class="badge">{{ statusCard.phase }}</text>
              <text v-if="statusCard" class="badge">{{ statusCard.state }}</text>
              <text v-if="statusCard" class="badge">{{ statusCard.weather }}</text>
              <text class="ai-badge">AI 已参与研判</text>
            </view>
          </view>
          <text class="preview-desc strong" user-select>{{ aiWeeklyPreview.summary }}</text>
          <view class="preview-chip-row">
            <text class="badge">事件 {{ aiWeeklyPreview.eventCount }}</text>
            <text class="badge">评估 {{ aiWeeklyPreview.assessmentCount }}</text>
            <text class="badge">意向 {{ formatDelta(aiWeeklyPreview.intentDelta) }}</text>
            <text class="badge">风险 {{ formatDelta(aiWeeklyPreview.riskDelta) }}</text>
          </view>
          <view class="weekly-detail-grid">
            <view v-if="aiWeeklyPreview.keyChanges?.length" class="weekly-detail-box">
              <text class="case-kpi-label">最近阶段关键变化</text>
              <text v-for="item in aiWeeklyPreview.keyChanges" :key="item" class="bullet" user-select>• {{ item }}</text>
            </view>
            <view v-if="aiWeeklyPreview.keyEvents?.length" class="weekly-detail-box">
              <text class="case-kpi-label">关键事件</text>
              <text v-for="item in aiWeeklyPreview.keyEvents" :key="item" class="bullet" user-select>• {{ item }}</text>
            </view>
            <view v-if="aiWeeklyPreview.avoidMisread?.length" class="weekly-detail-box">
              <text class="case-kpi-label">这一阶段避免误判</text>
              <text v-for="item in aiWeeklyPreview.avoidMisread" :key="item" class="bullet" user-select>• {{ item }}</text>
            </view>
          </view>

          <view v-if="weeklyFocusItems.length > 0" class="weekly-focus-block">
            <view class="section-mini-head">
              <text class="mini-title">后续验证重点</text>
              <text class="mini-sub">下一次只看这一件事</text>
            </view>
            <view class="focus-verify-card">
              <text class="case-kpi-label">最该看</text>
              <text class="focus-verify-question" user-select>{{ primaryWeeklyFocus }}</text>
            </view>
            <view v-if="weeklyFocusItems.length > 1" class="weekly-focus-list">
              <text v-for="item in weeklyFocusItems.slice(1)" :key="item" class="bullet" user-select>• {{ item }}</text>
            </view>
          </view>
          <view v-if="false" class="weekly-focus-block">
            <view class="section-mini-head">
              <text class="mini-title">本周侧写</text>
              <text class="mini-sub">{{ currentWeeklySideRead ? '属相和星座本周侧写' : '进入复盘页后可单独生成' }}</text>
            </view>
            <template v-if="currentWeeklySideRead">
              <text v-if="currentWeeklySideRead.summary" class="preview-desc strong" user-select>{{ currentWeeklySideRead.summary }}</text>
              <view v-if="currentWeeklySideRead.sections?.length" class="weekly-detail-grid">
                <view v-for="item in currentWeeklySideRead.sections" :key="item.label" class="weekly-detail-box">
                  <text class="case-kpi-label">{{ item.label }}</text>
                  <text class="bullet" user-select>• {{ item.text }}</text>
                </view>
              </view>
            </template>
            <text v-else class="muted">本周侧写还没有生成。</text>
          </view>
        </view>
        <view v-else-if="hasFallbackWeeklyPreview" class="weekly-empty">
          <text class="muted">本周只生成了规则兜底版本。关系主页不再展示这类文案，请去周复盘页重新生成 AI 版本。</text>
        </view>
        <view v-else class="weekly-empty">
          <text class="muted">本周还没有 AI 复盘。这张卡现在只接 AI 周复盘的结果，请先去生成。</text>
        </view>
        <view v-if="false" class="preview-actions">
          <button class="link-button secondary" @click="goWeeklyReview">
            {{ aiWeeklyPreview ? '看复盘历史记录' : '去生成本周 AI 复盘' }}
          </button>
        </view>
      </view>

      <!-- 趋势变化 -->
      <view class="card weekly-preview-card">
        <view class="section-head">
          <view>
            <text class="h2">本周侧写</text>
            <text class="muted">属相和星座本周侧写，和本周复盘并列展示。</text>
          </view>
        </view>
        <view v-if="currentWeeklySideRead" class="weekly-preview-content">
          <text v-if="currentWeeklySideRead.title" class="preview-title">{{ currentWeeklySideRead.title }}</text>
          <text v-if="currentWeeklySideRead.summary" class="preview-desc strong" user-select>{{ currentWeeklySideRead.summary }}</text>
          <view v-if="currentWeeklySideRead.sections?.length" class="weekly-detail-grid">
            <view v-for="item in currentWeeklySideRead.sections" :key="item.label" class="weekly-detail-box">
              <text class="case-kpi-label">{{ item.label }}</text>
              <text class="bullet" user-select>• {{ item.text }}</text>
            </view>
          </view>
        </view>
        <view v-else class="weekly-empty">
          <text class="muted">{{ weeklyPreview ? '本周侧写还没有生成，进入复盘页后可单独生成。' : '请先生成本周复盘，再生成本周侧写。' }}</text>
        </view>
        <view v-if="false" class="preview-actions">
          <button class="link-button secondary" @click="goWeeklyReview">
            {{ currentWeeklySideRead ? '看复盘历史记录' : '去本周复盘页生成侧写' }}
          </button>
        </view>
      </view>

      <view class="preview-actions single-bottom-action">
        <button class="link-button secondary" @click="goWeeklyReview">
          {{ weeklyPreview ? '看复盘历史记录' : '去生成本周 AI 复盘' }}
        </button>
      </view>

      <view v-if="showRelationshipLegacySections && trend && trend.hasPrevious" class="card trend-card">
        <view class="section-head">
          <view>
            <text class="h2">趋势对比</text>
            <text class="muted">看这次相对上一次，到底是变好、变差，还是只是感觉在变。</text>
          </view>
          <text class="muted">{{ trend.hasPrevious ? '上次 vs 这次' : '首次评估' }}</text>
        </view>
        <text class="status-summary" user-select>{{ trend.summaryText }}</text>
        <text v-if="trend.warningText" class="trend-warning" user-select>{{ trend.warningText }}</text>
        <view class="grid two">
          <view class="trend-box">
            <text class="case-kpi-label">意向变化</text>
            <text class="trend-number" :class="trend.intentDirection === 'up' ? 'up' : trend.intentDirection === 'down' ? 'down' : 'flat'">
              {{ trend.intentDelta > 0 ? '+' : '' }}{{ trend.intentDelta }}
            </text>
            <text class="muted">
              {{ trend.intentDirection === 'up' ? '比上次更强' : trend.intentDirection === 'down' ? '比上次更弱' : '与上次持平' }}
            </text>
          </view>
          <view class="trend-box">
            <text class="case-kpi-label">风险变化</text>
            <text class="trend-number" :class="trend.riskDirection === 'up' ? 'up' : trend.riskDirection === 'down' ? 'down' : 'flat'">
              {{ trend.riskDelta > 0 ? '+' : '' }}{{ trend.riskDelta }}
            </text>
            <text class="muted">
              {{ trend.riskDirection === 'up' ? '比上次更高' : trend.riskDirection === 'down' ? '比上次更低' : '与上次持平' }}
            </text>
          </view>
        </view>
      </view>


      <!-- 关系时间线 -->
      <view v-if="showRelationshipLegacySections" class="card">
        <view class="section-head">
          <view>
            <text class="h2">关系时间线</text>
            <text class="muted">当前对象的记录与评估会进入同一个 case 桶里持续保存。</text>
          </view>
          <view class="case-actions">
            <button class="link-button" @click="goTimeline">打开完整时间线</button>
            <button class="link-button secondary" @click="goAssessments">查看评估历史</button>
          </view>
        </view>
      </view>

      <!-- 下一步建议 -->
      <view v-if="showRelationshipLegacySections" class="grid two">
        <view class="card">
          <text class="h2">下一步更适合观察什么</text>
          <view class="bullets">
            <text class="bullet">• 下一次是否由对方主动发起或推进</text>
            <text class="bullet">• 答应过的事情是否会兑现</text>
            <text class="bullet">• 关键问题是否愿意更具体地回应</text>
            <text class="bullet">• 热度是否稳定，而不是短期波动</text>
          </view>
        </view>
        <view class="card">
          <text class="h2">继续记录</text>
          <text class="muted">你现在可以重新评估同一个 case，并把新的结果追加进历史。</text>
          <view class="case-actions">
            <button class="link-button secondary" @click="goReassess">重新评估这个 case</button>
            <button class="link-button secondary" @click="goNew">创建新的关系对象</button>
          </view>
        </view>
      </view>

    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId, getWeeklyReviews, getCases } from '@/utils/api'
import { consumeActiveCaseProfileUpdated, getActiveCaseId, setActiveCaseId, setPendingTimelineContext, showError } from '@/utils/helpers'
import { buildCaseOverviewStats, buildFocusItems, buildObjectStatusCard, compareAssessments } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const profileUpdated = ref(false)
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const showRelationshipLegacySections = false
const weeklyReviews = ref<any[]>([])
const currentWeekStart = ref('')
const initialized = ref(false)
const skipNextShowRefresh = ref(false)

const result = computed(() => caseFile.value?.latestResult)

const profileItems = computed(() => {
  const p = caseFile.value?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
})

const objectTypeLabel = computed(() => {
  const relationType = String(caseFile.value?.profile?.relationType || '').trim()
  if (relationType === 'close_friend') return '亲密朋友'
  if (relationType === 'romantic') return '恋爱对象'
  return ''
})

const overviewStatsData = computed(() => {
  if (!caseFile.value) return null
  return buildCaseOverviewStats(caseFile.value)
})

const overviewStats = computed(() => overviewStatsData.value?.items || [])

const focusItems = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.timeline) return []
  return buildFocusItems(caseFile.value)
})
const primaryFocusItem = computed(() => focusItems.value[0] || null)
const focusVerifyQuestion = computed(() => {
  const item = primaryFocusItem.value
  if (!item) return ''
  const prompt = cleanFocusPrompt(item.nextRecordPrompt)
  if (prompt) return prompt
  const meaning = cleanFocusPrompt(item.meaning)
  if (meaning) return meaning
  return `${item.label}是否会继续出现，而不是只停留在单次表现。`
})
const focusEvidenceItems = computed(() => {
  const evidences = primaryFocusItem.value?.evidences || []
  return evidences.slice(0, 2).map((item: any, index: number) => ({
    ...item,
    index: index + 1,
    timeText: [item.occurrenceTime, item.sequenceLabel].filter(Boolean).join(' · ') || item.recordedAt || ''
  }))
})

const statusCard = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.assessments || !caseFile.value?.timeline) return null
  return buildObjectStatusCard(caseFile.value)
})

const objectStatusTags = computed(() => {
  if (!statusCard.value) return []
  return [statusCard.value.phase, statusCard.value.state, statusCard.value.weather].filter(Boolean)
})

const trend = computed(() => {
  const assessments = caseFile.value?.assessments || []
  if (assessments.length < 2) return null
  // 约定：后端按 createdAt asc 返回，数组末尾是最新评估
  const previous = assessments[assessments.length - 2]
  const current = assessments[assessments.length - 1]
  return compareAssessments(previous, current)
})

const assessmentsList = computed(() => {
  const list = [...(caseFile.value?.assessments || [])]
  const latest = caseFile.value?.latestResult
  if (latest && !list.some((item: any) => getAssessmentKey(item) === getAssessmentKey(latest))) {
    list.push(latest)
  }
  return list
})

const assessmentPreview = computed(() => {
  return [...assessmentsList.value]
    .sort((a: any, b: any) => getAssessmentTimestamp(b) - getAssessmentTimestamp(a))
    .slice(0, 5)
})

const latestAssessmentPreview = computed(() => {
  return assessmentPreview.value[0] || null
})

const latestAssessmentStatus = computed(() => {
  if (!latestAssessmentPreview.value) return null
  const chronological = [...assessmentsList.value].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
  const index = chronological.findIndex((item: any) => getAssessmentKey(item) === getAssessmentKey(latestAssessmentPreview.value))
  const history = index >= 0 ? chronological.slice(0, index + 1) : chronological
  return buildObjectStatusCard({
    ...caseFile.value,
    latestResult: latestAssessmentPreview.value,
    assessments: history.length > 0 ? history : [latestAssessmentPreview.value],
    timeline: caseFile.value?.timeline || []
  })
})

const olderAssessmentPreview = computed(() => {
  return assessmentPreview.value.slice(1, 5)
})

const trendDataPanel = computed(() => {
  const assessments = [...assessmentsList.value]
    .sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
    .filter((item: any) => getAssessmentTimestamp(item) > 0)
  if (!assessments.length) return null

  const latest = assessments[assessments.length - 1]
  const latestTime = getAssessmentTimestamp(latest)
  const rangeStart = latestTime - 14 * 24 * 60 * 60 * 1000
  const rangeBase = assessments.find((item: any) => getAssessmentTimestamp(item) >= rangeStart) || assessments[0]
  const recentAssessments = assessments.slice(-6)
  const transitions = assessments
    .map((item: any, index: number) => {
      if (index === 0) return null
      const previous = assessments[index - 1]
      const intentDelta = clampScore(item.intentScore) - clampScore(previous.intentScore)
      const riskDelta = clampScore(item.consistencyRiskScore) - clampScore(previous.consistencyRiskScore)
      return {
        key: getAssessmentKey(item),
        title: item.triggerEventTitle || mapSourceLabel(item.source),
        intentDelta,
        riskDelta,
        impact: Math.abs(intentDelta) + Math.abs(riskDelta),
        time: getAssessmentTimestamp(item)
      }
    })
    .filter(Boolean)
  const recentTransitions = transitions.slice(-5)
  const avgMove = recentTransitions.length
    ? recentTransitions.reduce((sum: number, item: any) => sum + item.impact, 0) / recentTransitions.length
    : 0
  const stability = Math.max(0, Math.min(100, Math.round(100 - avgMove * 2.4)))
  const latestIntent = clampScore(latest.intentScore)
  const latestRisk = clampScore(latest.consistencyRiskScore)
  const intentDelta14 = latestIntent - clampScore(rangeBase.intentScore)
  const riskDelta14 = latestRisk - clampScore(rangeBase.consistencyRiskScore)
  const points = recentAssessments.map((item: any, index: number) => {
    const denominator = Math.max(recentAssessments.length - 1, 1)
    const intent = clampScore(item.intentScore)
    const risk = clampScore(item.consistencyRiskScore)
    return {
      key: getAssessmentKey(item),
      x: Math.round(6 + (index / denominator) * 88),
      intent,
      risk,
      intentY: Math.round(6 + intent * 0.88),
      riskY: Math.round(6 + risk * 0.88)
    }
  })

  return {
    latestIntent,
    latestRisk,
    intentDelta14,
    riskDelta14,
    stability,
    sampleCount: recentAssessments.length,
    evidenceCount: countRecentEvidence(caseFile.value?.timeline || [], latestTime),
    tags: buildTrendDataTags(intentDelta14, riskDelta14, stability, recentAssessments.length),
    points,
    turningPoints: transitions
      .filter((item: any) => item.impact > 0)
      .sort((a: any, b: any) => b.impact - a.impact || b.time - a.time)
      .slice(0, 3)
  }
})

const weeklyPreview = computed(() => {
  if (!weeklyReviews.value.length) return null
  return weeklyReviews.value.find((item: any) => item.weekStart === currentWeekStart.value) || weeklyReviews.value[0]
})

const aiWeeklyPreview = computed(() => {
  return weeklyPreview.value || null
})

const hasFallbackWeeklyPreview = computed(() => {
  return false
})

const currentWeeklySideRead = computed(() => {
  return weeklyPreview.value?.weeklySideRead || null
})

const weeklyFocusItems = computed(() => {
  return (weeklyPreview.value?.nextWeekFocus || [])
    .map((item: any) => String(item || '').trim())
    .filter(Boolean)
})

const primaryWeeklyFocus = computed(() => {
  return weeklyFocusItems.value[0] || ''
})

const triggerEvent = computed(() => {
  if (!result.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === result.value.triggerEventId) || null
})

const isCurrentResultAIReviewed = computed(() => {
  return Boolean(
    triggerEvent.value?.aiUsed ||
    String(result.value?.explanation?.headline || '').startsWith('AI 研判后：')
  )
})

const intentTone = computed(() => {
  const s = result.value?.intentScore ?? 0
  if (s >= 70) return 'good'
  if (s >= 40) return 'mid'
  return 'bad'
})
const riskTone = computed(() => {
  const s = result.value?.consistencyRiskScore ?? 0
  if (s >= 60) return 'bad'
  if (s >= 30) return 'mid'
  return 'good'
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

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '评估'
  }
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

function goTimelineEvent(eventId: string) {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({
    caseId: caseId.value,
    targetEventId: eventId
  })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}

function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || getActiveCaseId()
  if (caseId.value) setActiveCaseId(caseId.value)
  profileUpdated.value = options?.profileUpdated === '1'
  initialized.value = true
  skipNextShowRefresh.value = true
  loadData()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  if (skipNextShowRefresh.value) {
    skipNextShowRefresh.value = false
    return
  }
  const active = getActiveCaseId()
  if (active && active !== caseId.value) {
    caseId.value = active
    profileUpdated.value = consumeActiveCaseProfileUpdated(active)
    loadData({ silent: true })
    return
  }
  if (consumeActiveCaseProfileUpdated(caseId.value)) {
    profileUpdated.value = true
    loadData({ silent: true })
    return
  }
  loadData({ silent: true })
})

async function ensureCaseId(uid: string) {
  if (caseId.value) return true
  const active = getActiveCaseId()
  if (active) {
    caseId.value = active
    return true
  }
  const list = await getCases(uid)
  const firstCaseId = list?.[0]?.caseId || list?.[0]?._id || ''
  if (!firstCaseId) return false
  caseId.value = firstCaseId
  setActiveCaseId(firstCaseId)
  return true
}

async function loadData(options: { silent?: boolean } = {}) {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  if (!options.silent || !caseFile.value) {
    loading.value = true
  }
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      caseFile.value = null
      return
    }
    setActiveCaseId(caseId.value)
    const [detail, weeklyRes] = await Promise.all([
      getCaseDetail(uid, caseId.value),
      getWeeklyReviews(uid, caseId.value).catch((error: any) => {
        console.warn('[page:case-detail] load weekly reviews failed:', error)
        return { reviews: [], currentWeekStart: '' }
      })
    ])
    caseFile.value = detail
    weeklyReviews.value = weeklyRes.reviews || []
    currentWeekStart.value = weeklyRes.currentWeekStart || ''
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}

function getAssessmentTimestamp(item: any) {
  const raw = item?.createdAt
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function getAssessmentKey(item: any) {
  return String(item?._id || item?.assessmentId || `${item?.createdAt || ''}-${item?.triggerEventId || ''}`)
}

function formatAssessmentDate(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '时间未记录'
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function countRecentEvidence(timeline: any[], latestTime: number) {
  const now = latestTime || Date.now()
  const start = now - 14 * 24 * 60 * 60 * 1000
  return (timeline || []).filter((item: any) => {
    const timestamp = getTimelineTimestamp(item)
    if (timestamp < start || timestamp > now) return false
    const type = String(item?.type || '')
    return type !== 'assessment' && type !== 'trend' && type !== 'system'
  }).length
}

function getTimelineTimestamp(item: any) {
  const raw = item?.occurrenceTime || item?.createdAt || item?.date
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function cleanFocusPrompt(text: any) {
  return String(text || '')
    .replace(/^本次重点记录[:：]\s*/, '')
    .replace(/^下一次最值得记录的是[:：]\s*/, '')
    .replace(/^下一次重点记录[:：]\s*/, '')
    .replace(/^重点记录[:：]\s*/, '')
    .trim()
}

function buildTrendDataTags(intentDelta: number, riskDelta: number, stability: number, sampleCount: number) {
  const tags: string[] = []
  if (intentDelta >= 8) tags.push('升温中')
  else if (intentDelta <= -8) tags.push('意向回落')
  else tags.push('意向平稳')

  if (riskDelta <= -6) tags.push('风险下降')
  else if (riskDelta >= 6) tags.push('风险上升')
  else tags.push('风险平稳')

  if (stability >= 76) tags.push('波动偏低')
  else if (stability >= 52) tags.push('波动中等')
  else tags.push('波动偏高')

  tags.push(sampleCount >= 4 ? '证据充足' : '继续补证')
  return tags
}

function formatSignedDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  return String(numeric)
}

function deltaClass(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return 'positive'
  if (numeric < 0) return 'negative'
  return 'neutral'
}

function scoreTone(score: any) {
  const numeric = clampScore(score)
  if (numeric >= 70) return 'high'
  if (numeric >= 40) return 'mid'
  return 'low'
}

function formatDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  if (numeric < 0) return String(numeric)
  return '持平'
}

function goReassess() { uni.navigateTo({ url: `/pages/reassess/reassess?caseId=${caseId.value}` }) }
function goEditProfile() { uni.navigateTo({ url: `/pages/edit-profile/edit-profile?caseId=${caseId.value}` }) }
function goAssessments() { uni.navigateTo({ url: `/pages/assessments/assessments?caseId=${caseId.value}` }) }
function goWeeklyReview() {
  setActiveCaseId(caseId.value)
  uni.navigateTo({ url: `/pages/weekly-review/weekly-review?caseId=${caseId.value}` })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; margin-top: 8rpx; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.section-head { margin-bottom: 14rpx; }
.pills { margin-top: 14rpx; }
.pill { display: inline-block; padding: 8rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; margin: 4rpx; }
.pill.good { background: #dff5e8; color: #14633a; }
.pill.mid { background: #f5e9c8; color: #7a5a14; }
.pill.bad { background: #f9d8d2; color: #b85c38; }
.pill.neutral { background: #efe7d8; color: #241b12; }
.badges { margin: 8rpx 0; }
.badge { display: inline-block; padding: 8rpx 16rpx; background: #efe7d8; border-radius: 999rpx; font-size: 22rpx; color: #241b12; margin: 4rpx; }
.badge-primary {
  background: rgba(18, 60, 54, 0.12);
  border: 1rpx solid rgba(18, 60, 54, 0.22);
  color: #123c36;
  font-weight: 700;
}
.badge-soft {
  background: rgba(201, 164, 92, 0.12);
}
.ai-badge { display: inline-block; padding: 7rpx 14rpx; margin: 4rpx; background: #e7f3ef; border: 1rpx solid rgba(15, 107, 69, 0.22); border-radius: 999rpx; color: #0f6b45; font-size: 21rpx; font-weight: 650; line-height: 1.35; }
.profile-inline-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.object-card-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  width: 100%;
  margin-top: 12rpx;
  margin-bottom: 4rpx;
}
.object-card-tag-row .badge {
  margin: 0;
}
.object-card-name-head {
  display: block;
  margin-top: 6rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #143f3a;
}
.bullets { display: flex; flex-direction: column; gap: 8rpx; }
.bullet { font-size: 26rpx; color: #241b12; line-height: 1.6; }
.grid.two { display: flex; gap: 16rpx; flex-wrap: wrap; }
.metric-card { flex: 1 1 45%; min-width: 280rpx; }
.metric-title { display: block; font-size: 26rpx; color: #786857; }
.kpi-big { display: block; font-size: 64rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.meter { width: 100%; height: 12rpx; background: #efe7d8; border-radius: 6rpx; overflow: hidden; margin: 12rpx 0; }
.meter-fill { height: 100%; background: #143f3a; }
.meter-fill.risk { background: #b85c38; }
.advice { display: block; font-size: 30rpx; color: #143f3a; font-weight: 600; margin: 12rpx 0; }
.actions { display: flex; gap: 12rpx; flex-wrap: wrap; margin-top: 14rpx; }
.actions.vertical { flex-direction: column; }
.case-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.btn-primary { height: 80rpx; line-height: 80rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.btn-secondary { height: 80rpx; line-height: 80rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; }
.btn-danger { height: 80rpx; line-height: 80rpx; background: #b85c38; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.warning-text { color: #b85c38; font-weight: 500; }
.status-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.status-row { display: flex; gap: 16rpx; margin: 16rpx 0; }
.status-item { flex: 1; background: #fff; border-radius: 12rpx; padding: 16rpx; text-align: center; }
.status-label { display: block; font-size: 22rpx; color: #786857; }
.status-value { display: block; font-size: 28rpx; font-weight: 600; color: #143f3a; margin-top: 4rpx; }
.focus-item { margin-top: 16rpx; padding: 16rpx; background: #fff; border-radius: 12rpx; }
.focus-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.focus-label { font-size: 26rpx; font-weight: 600; color: #241b12; }
.focus-status { font-size: 22rpx; color: #786857; padding: 4rpx 12rpx; background: #efe7d8; border-radius: 999rpx; }
.evidences { margin-top: 12rpx; }
.evidence-title { display: block; font-size: 22rpx; color: #786857; margin-bottom: 6rpx; }
.evidence-item { margin: 4rpx 0; }
.evidence-text { font-size: 24rpx; color: #241b12; }
.trend-summary { display: block; font-size: 28rpx; color: #143f3a; font-weight: 600; margin: 12rpx 0; }
.trend-row { display: flex; gap: 16rpx; margin: 16rpx 0; }
.trend-item { flex: 1; background: #fff; border-radius: 12rpx; padding: 16rpx; }
.trend-label { display: block; font-size: 22rpx; color: #786857; }
.trend-value { display: block; font-size: 36rpx; font-weight: 700; color: #241b12; margin-top: 4rpx; }
.trend-value.positive { color: #14633a; }
.trend-value.negative { color: #b85c38; }
.overview-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.overview-stats-current,
.overview-trend-current {
  margin-top: 16rpx;
}

.overview-stats-legacy,
.overview-trend-legacy {
  display: none;
}

.overview-stat-box {
  min-width: 0;
  padding: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  border-radius: 16rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 100rpx),
    var(--card-soft, #fffaf3);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.overview-stat-box.tone-risk {
  border-color: rgba(184, 74, 58, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 100rpx),
    rgba(247, 223, 216, 0.9);
}

.overview-stat-hint {
  margin-top: 10rpx;
  line-height: 1.5;
}

.overview-trend-box {
  padding-top: 8rpx;
}

.trend-data-panel {
  margin-top: 16rpx;
  padding-top: 8rpx;
}

.trend-data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.trend-data-box {
  min-width: 0;
  padding: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  border-radius: 16rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 100rpx),
    var(--card-soft, #fffaf3);
}

.trend-data-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10rpx;
  margin-top: 8rpx;
}

.trend-data-score {
  color: var(--text-main, #201914);
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.1;
}

.trend-data-delta,
.delta-pill {
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.2;
}

.trend-data-delta.positive,
.delta-pill.positive {
  color: var(--success, #0f6b45);
}

.trend-data-delta.negative,
.delta-pill.negative {
  color: var(--risk, #b84a3a);
}

.trend-data-delta.neutral,
.delta-pill.neutral {
  color: var(--text-muted, #76695c);
}

.trend-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.trend-dot-panel {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.66);
}

.trend-dot-row {
  display: grid;
  grid-template-columns: 76rpx minmax(0, 1fr);
  align-items: center;
  gap: 14rpx;
}

.trend-dot-row + .trend-dot-row {
  margin-top: 14rpx;
}

.trend-dot-track {
  position: relative;
  height: 88rpx;
  border-radius: 14rpx;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.05), rgba(18, 60, 54, 0.02)),
    rgba(255, 255, 255, 0.55);
  overflow: hidden;
}

.trend-dot-track::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1rpx dashed rgba(18, 60, 54, 0.16);
}

.trend-dot {
  position: absolute;
  width: 14rpx;
  height: 14rpx;
  margin-left: -7rpx;
  margin-bottom: -7rpx;
  border-radius: 50%;
  background: var(--primary, #123c36);
  box-shadow: 0 0 0 5rpx rgba(18, 60, 54, 0.1);
}

.trend-dot.risk {
  background: var(--risk, #b84a3a);
  box-shadow: 0 0 0 5rpx rgba(184, 74, 58, 0.1);
}

.trend-dot.high {
  opacity: 1;
}

.trend-dot.mid {
  opacity: 0.78;
}

.trend-dot.low {
  opacity: 0.52;
}

.turning-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 16rpx;
}

.turning-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.7);
}

.turning-title {
  flex: 1;
  min-width: 0;
  color: var(--text-main, #201914);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.35;
}

.turning-deltas {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
}

.delta-pill {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.06);
}

/* Premium visual pass */
.page {
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
}

.card {
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 18rpx;
  box-shadow: 0 16rpx 36rpx rgba(32, 25, 20, 0.06);
}

.hero-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
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
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.hero-card .h1 {
  color: #fffaf0;
  font-size: 42rpx;
  line-height: 1.25;
}

.hero-subtext {
  color: rgba(255, 252, 247, 0.76);
}

.h1,
.h2,
.metric-title,
.focus-label {
  color: var(--text-main, #201914);
}

.muted,
.case-kpi-label,
.metric-title,
.status-label {
  color: var(--text-muted, #76695c);
}

.pill,
.badge,
.focus-status {
  border: 1rpx solid rgba(201, 164, 92, 0.24);
}

.pill.good,
.score-chip.good,
.meter-fill.good {
  background: #e4f3e8;
  color: #0f6b45;
}

.pill.mid,
.score-chip.mid,
.meter-fill.mid {
  background: #f3e6c6;
  color: #7a5a14;
}

.pill.bad,
.score-chip.bad,
.meter-fill.bad {
  background: #f7dfd8;
  color: #9a4d36;
}

.metric-card,
.info-card,
.question,
.trend-box,
.focus-item {
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.kpi,
.case-kpi-value,
.evidence-display,
.trend-number {
  color: var(--primary, #123c36);
  letter-spacing: 0;
}

.meter {
  height: 12rpx;
  background: #e9dfcf;
}

.meter-fill {
  background: linear-gradient(90deg, var(--primary, #123c36), var(--primary-2, #2f6a5c));
}

.meter.risk .meter-fill,
.meter-fill.bad {
  background: linear-gradient(90deg, var(--accent, #c9a45c), var(--risk, #b84a3a));
}

.advice-box {
  background: linear-gradient(135deg, rgba(18, 60, 54, 0.08), var(--accent-soft, rgba(201, 164, 92, 0.12)));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  border-radius: 16rpx;
  padding: 22rpx;
  font-weight: 700;
}

.link-button,
.btn-secondary {
  background: var(--card-bg, rgba(255, 252, 247, 0.92));
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  color: var(--primary, #123c36);
  border-radius: 14rpx;
  font-weight: 600;
}

.btn-danger {
  background: var(--risk-soft, #fff6f2);
  border: 1rpx solid rgba(184, 74, 58, 0.35);
  color: var(--risk, #b84a3a);
  border-radius: 14rpx;
}

.profile-avatar {
  border: 2rpx solid rgba(201, 164, 92, 0.45);
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.1);
}

.focus-pair-card,
.focus-board-event,
.trend-box {
  background: rgba(255, 252, 247, 0.88);
}

/* Second visual pass: make analysis cards feel intentionally designed */
.card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
}

.card .h2,
.card .metric-title {
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  line-height: 1.35;
}

.hero-card .h2 {
  padding-left: 0;
  border-left: 0;
}

.metric-card,
.info-card,
.question,
.trend-box,
.kpi-item,
.focus-pair-card,
.focus-board-event {
  border-radius: 16rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 110rpx),
    var(--card-soft, #fffaf3);
}

.metric-card,
.info-card,
.status-overview-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.56);
}

.advice-box,
.evidence-display {
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.65);
}

/* Relationship home typography pass */
.status-overview-card .h2,
.focus-section-card .h2,
.weekly-review-card .h2,
.trend-card .h2 {
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.32;
  margin-bottom: 10rpx;
  letter-spacing: 0;
}

.status-overview-card .muted,
.focus-section-card .muted,
.weekly-review-card .muted,
.trend-card .muted {
  font-size: 24rpx;
  font-weight: 400;
  line-height: 1.58;
  letter-spacing: 0;
}

.status-summary {
  display: block;
  margin: 18rpx 0 10rpx;
  color: var(--text-main, #201914);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.55;
  letter-spacing: 0;
}

.status-overview-card .badges,
.weekly-review-card .case-kpis,
.trend-card .grid.two,
.focus-pairs {
  margin-top: 18rpx;
}

.case-kpis {
  gap: 14rpx;
}

.case-kpi-label {
  display: block;
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0;
}

.case-kpi-value {
  display: block;
  margin-top: 8rpx;
  color: var(--primary, #123c36);
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0;
}

.focus-pairs {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.focus-pair {
  padding-top: 4rpx;
}

.focus-pair-rank {
  display: inline-block;
  margin-bottom: 14rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--accent-soft, #efe6d6);
  color: var(--primary, #123c36);
  font-size: 21rpx;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: 0;
}

.focus-pair-rail {
  margin-bottom: 14rpx;
}

.focus-board-timeline {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 10rpx;
}

.focus-board-event {
  display: flex;
  gap: 14rpx;
  padding: 18rpx;
}

.focus-board-axis {
  width: 100rpx;
  flex-shrink: 0;
}

.focus-board-axis-time {
  display: block;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.3;
}

.focus-board-axis-seq,
.focus-board-subtime {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 20rpx;
  font-weight: 400;
  line-height: 1.35;
}

.focus-board-track {
  width: 18rpx;
  display: flex;
  align-items: stretch;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.focus-board-line {
  width: 2rpx;
  min-height: 100%;
  background: rgba(18, 60, 54, 0.12);
}

.focus-board-dot {
  position: absolute;
  top: 8rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--accent, #c9a45c);
  box-shadow: 0 0 0 6rpx rgba(201, 164, 92, 0.16);
}

.focus-board-content {
  flex: 1;
  min-width: 0;
}

.focus-board-title {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #201914);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.48;
  letter-spacing: 0;
}

.focus-meaning {
  display: block;
  margin: 12rpx 0 8rpx;
  color: var(--text-main, #201914);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.55;
  letter-spacing: 0;
}

.focus-pair-card .badge,
.focus-pair-card .pill {
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.35;
}

.trend-number {
  display: block;
  margin: 10rpx 0 8rpx;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0;
}

.trend-warning {
  display: block;
  margin: 10rpx 0 16rpx;
  color: var(--risk, #b84a3a);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.55;
  letter-spacing: 0;
}

.weekly-review-card .kpi-item,
.trend-card .trend-box {
  padding: 20rpx;
}

.instant-feedback-card,
.trend-overview-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.62);
}

.fold-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.fold-toggle {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.18);
  background: rgba(255, 252, 247, 0.78);
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 650;
}

.instant-top {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.instant-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 30rpx;
  font-weight: 750;
  line-height: 1.45;
}

.instant-headline {
  margin-top: 10rpx;
}

.instant-delta-panel {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
  flex-wrap: wrap;
}

.instant-delta-item {
  flex: 1 1 42%;
  min-width: 240rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 110rpx),
    var(--card-soft, #fffaf3);
}

.trend-number.up {
  color: var(--success, #0f6b45);
}

.trend-number.down {
  color: var(--risk, #b84a3a);
}

.trend-number.flat {
  color: var(--text-muted, #76695c);
}

.mini-trend-panel,
.quick-label-panel,
.quick-status-panel,
.quick-reason-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background: rgba(255, 252, 247, 0.78);
}

.section-mini-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.mini-title {
  color: var(--text-main, #201914);
  font-size: 26rpx;
  font-weight: 700;
}

.mini-sub {
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
}

.mini-trend-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.mini-trend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.52);
}

.mini-trend-row.latest {
  border: 1rpx solid rgba(201, 164, 92, 0.45);
  background: rgba(201, 164, 92, 0.1);
}

.mini-index {
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 20rpx;
  font-weight: 700;
}

.mini-bars {
  flex: 1;
  min-width: 0;
}

.mini-bar-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.mini-bar-row + .mini-bar-row {
  margin-top: 8rpx;
}

.mini-bar-label,
.mini-score {
  width: 46rpx;
  color: var(--text-muted, #76695c);
  font-size: 20rpx;
}

.mini-score {
  text-align: right;
}

.mini-track {
  flex: 1;
  height: 12rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
}

.mini-fill {
  height: 12rpx;
  border-radius: 999rpx;
}

.quick-reason {
  display: block;
  margin-top: 10rpx;
  color: var(--text-main, #201914);
  font-size: 24rpx;
  line-height: 1.55;
}

.action-analysis-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.72);
}

.action-hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(135deg, rgba(18, 60, 54, 0.08), rgba(201, 164, 92, 0.1)),
    var(--card-soft, #fffaf3);
}

.action-main {
  display: block;
  margin: 8rpx 0 6rpx;
  color: var(--primary, #123c36);
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.35;
}

.evidence-info-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 6rpx;
}

.evidence-info-row .muted {
  flex: 1;
  min-width: 0;
}

.info-icon {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(18, 60, 54, 0.24);
  background: rgba(255, 252, 247, 0.84);
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.info-modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34rpx;
  background: rgba(24, 18, 12, 0.42);
  box-sizing: border-box;
}

.info-modal {
  width: 100%;
  max-height: 82vh;
  overflow: hidden;
  border-radius: 22rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.28);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 180rpx),
    var(--card-bg, #fffcf7);
  box-shadow: 0 30rpx 70rpx rgba(18, 60, 54, 0.24);
}

.info-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 30rpx 30rpx 20rpx;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.08);
}

.info-modal-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.35;
}

.info-modal-subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: 1.5;
}

.info-modal-close {
  flex-shrink: 0;
  width: 46rpx;
  height: 46rpx;
  line-height: 42rpx;
  border-radius: 50%;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 36rpx;
  text-align: center;
}

.info-modal-body {
  max-height: 62vh;
  padding: 24rpx 30rpx 30rpx;
  box-sizing: border-box;
}

.info-section {
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: var(--card-soft, #fffaf3);
}

.info-section + .info-section {
  margin-top: 18rpx;
}

.info-section.relation {
  background: rgba(201, 164, 92, 0.12);
}

.info-section-title {
  display: block;
  color: var(--primary, #123c36);
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.35;
}

.info-section-copy {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: 1.55;
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 16rpx;
}

.level-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.level-badge {
  flex-shrink: 0;
  min-width: 58rpx;
  height: 38rpx;
  line-height: 38rpx;
  border-radius: 999rpx;
  background: var(--primary, #123c36);
  color: #fffaf0;
  font-size: 21rpx;
  font-weight: 800;
  text-align: center;
}

.level-badge.soft {
  background: rgba(201, 164, 92, 0.24);
  color: #6f5225;
}

.level-text {
  flex: 1;
  color: var(--text-main, #201914);
  font-size: 23rpx;
  line-height: 1.5;
}

.action-score-pair {
  display: flex;
  gap: 10rpx;
  flex-shrink: 0;
}

.action-score {
  min-width: 92rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.78);
  text-align: center;
}

.action-score text:last-child {
  display: block;
  margin-top: 6rpx;
  color: var(--primary, #123c36);
  font-size: 34rpx;
  font-weight: 800;
}

.action-guide-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 16rpx;
}

.action-guide-item {
  padding: 18rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 90rpx),
    var(--card-soft, #fffaf3);
}

.action-guide-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #201914);
  font-size: 25rpx;
  line-height: 1.6;
}

.focus-pairs.compact {
  gap: 16rpx;
  margin-top: 18rpx;
}

.focus-block {
  margin-top: 20rpx;
}

.focus-pair.compact {
  padding-top: 0;
}

.focus-pair-card.compact {
  padding: 20rpx;
}

.focus-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
}

.focus-evidence-card {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.focus-verify-card {
  padding: 22rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(135deg, rgba(201, 164, 92, 0.14), rgba(18, 60, 54, 0.04)),
    var(--card-soft, #fffaf3);
}

.focus-verify-question {
  display: block;
  margin-top: 10rpx;
  color: var(--text-main, #201914);
  font-size: 30rpx;
  font-weight: 750;
  line-height: 1.48;
  letter-spacing: 0;
}

.focus-evidence-simple {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.68);
}

.focus-evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 12rpx;
}

.focus-evidence-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(18, 60, 54, 0.07);
}

.focus-evidence-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.focus-evidence-index {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: 50%;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 20rpx;
  font-weight: 800;
  text-align: center;
}

.focus-evidence-content {
  flex: 1;
  min-width: 0;
}

.focus-evidence-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.45;
}

.focus-evidence-time {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  line-height: 1.35;
}

.use-reminder-strip {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.22);
  background: rgba(201, 164, 92, 0.1);
}

.preview-card,
.trend-overview-card,
.weekly-preview-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.62);
}

.weekly-preview-content,
.weekly-empty {
  margin-top: 16rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(135deg, rgba(201, 164, 92, 0.14), rgba(18, 60, 54, 0.04)),
    var(--card-soft, #fffaf3);
}

.weekly-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.weekly-focus-list {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.weekly-focus-block {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.weekly-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 16rpx;
}

.weekly-detail-box,
.assessment-status-box,
.assessment-detail-box {
  padding: 16rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.7);
}

.assessment-status-box,
.assessment-detail-box {
  margin-top: 14rpx;
}

.preview-list,
.assessment-preview-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 16rpx;
}

.timeline-preview-item,
.assessment-preview-item {
  display: flex;
  gap: 16rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 110rpx),
    var(--card-soft, #fffaf3);
}

.timeline-preview-item.detailed {
  border-left: 5rpx solid rgba(201, 164, 92, 0.78);
  background:
    linear-gradient(135deg, rgba(201, 164, 92, 0.14), rgba(18, 60, 54, 0.04)),
    var(--card-soft, #fffaf3);
}

.timeline-preview-item.compact {
  padding: 14rpx 18rpx;
}

.assessment-preview-item {
  display: block;
}

.assessment-preview-item.detailed {
  border-left: 5rpx solid rgba(201, 164, 92, 0.78);
  background:
    linear-gradient(135deg, rgba(201, 164, 92, 0.14), rgba(18, 60, 54, 0.04)),
    var(--card-soft, #fffaf3);
}

.assessment-preview-item.compact {
  padding: 16rpx 18rpx;
}

.preview-date {
  width: 92rpx;
  flex-shrink: 0;
  text-align: center;
  padding-top: 4rpx;
}

.preview-date.compact {
  width: 78rpx;
}

.preview-day {
  display: block;
  color: var(--primary, #123c36);
  font-size: 24rpx;
  font-weight: 750;
  line-height: 1.25;
}

.preview-time {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  line-height: 1.25;
}

.preview-content {
  flex: 1;
  min-width: 0;
}

.preview-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.preview-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.45;
}

.preview-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  line-height: 1.55;
}

.preview-desc.strong {
  color: var(--text-main, #201914);
  font-weight: 700;
}

.assessment-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.assessment-preview-head .preview-title {
  flex: 1;
  min-width: 0;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
}

.single-bottom-action {
  justify-content: center;
  margin-top: 0;
  margin-bottom: 24rpx;
}

.preview-actions .link-button {
  min-width: 240rpx;
}
</style>
