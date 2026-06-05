<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '']" :style="themeVars">
      <view v-if="syncing" class="sync-bar"></view>
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else-if="!caseFile" class="empty-v2"><text class="empty-title-v2">往事不可用</text><text class="empty-sub-v2">当前 Crush 不存在或已被删除。</text></view>
      <template v-else>
        <view class="hero-block-v2 anim-hero"><text class="hero-tag-v2">MEMORIES / {{ caseFile.name }}</text><text class="hero-title-v2">往<text class="hl-v2">事</text></text><text class="hero-copy-v2">把真实发生过的互动按时间看清楚。</text><view v-if="profileItems.length > 0" class="tag-row-v2"><text v-for="item in profileItems" :key="item" class="tag-v2">{{ item }}</text></view></view>
        <view class="tab-switch-v2"><view v-for="item in timelineViewOptions" :key="item.key" :class="['tab-btn-v2', activeTimelineView === item.key ? 'active' : '']" @click="setTimelineView(item.key)">{{ item.label }} {{ item.count }}</view></view>
        <view v-if="activeTimelineView === 'events'">
          <view class="card-v2 anim-card" style="animation-delay:0.15s;border-color:#4ECDC4;">
  <view class="stat-pair-grid-v2">
    <view :class="['stat-pair-box-v2', activeTimelineFilter === 'target_initiated' ? 'active' : '', activeTimelineFilter === 'self_initiated' ? 'active' : '']" @click="toggleStatFilter('target_initiated', 'self_initiated')">
      <text class="section-title-v2" style="margin-bottom:8rpx;">谁更主动</text>
      <view class="stat-pair-row-v2">
        <view :class="['stat-pair-item-v2', activeTimelineFilter === 'target_initiated' ? 'hl' : '']"><text class="stat-pair-num-v2">{{ timelineStats.targetInitiatedCount }}</text><text class="stat-pair-lbl-v2">对方主动</text></view>
        <view :class="['stat-pair-item-v2', activeTimelineFilter === 'self_initiated' ? 'hl' : '']"><text class="stat-pair-num-v2">{{ timelineStats.selfInitiatedCount }}</text><text class="stat-pair-lbl-v2">我方主动</text></view>
      </view>
    </view>
    <view :class="['stat-pair-box-v2', ['target_committed','fulfilled','cancelled_delayed'].includes(activeTimelineFilter) ? 'active' : '']">
      <text class="section-title-v2" style="margin-bottom:8rpx;">承诺与兑现</text>
      <view class="stat-pair-row-v2">
        <view :class="['stat-pair-item-v2', activeTimelineFilter === 'target_committed' ? 'hl' : '']" @click="setTimelineFilter('target_committed')"><text class="stat-pair-num-v2">{{ timelineStats.targetCommittedCount }}</text><text class="stat-pair-lbl-v2">对方承诺</text></view>
        <view :class="['stat-pair-item-v2', activeTimelineFilter === 'fulfilled' ? 'hl' : '']" @click="setTimelineFilter('fulfilled')"><text class="stat-pair-num-v2">{{ timelineStats.fulfilledCount }}</text><text class="stat-pair-lbl-v2">已兑现</text></view>
        <view :class="['stat-pair-item-v2', activeTimelineFilter === 'cancelled_delayed' ? 'hl' : '']" @click="setTimelineFilter('cancelled_delayed')"><text class="stat-pair-num-v2">{{ timelineStats.cancelledDelayedCount + timelineStats.rejectedCount }}</text><text class="stat-pair-lbl-v2">取消/拒绝</text></view>
      </view>
    </view>
  </view>
  <scroll-view scroll-x class="filter-scroll-v2"><view class="filter-row-v2"><view v-for="item in timelineFilterOptions" :key="item.key" :class="['filter-chip-v2', activeTimelineFilter === item.key ? 'active' : '']" @click="setTimelineFilter(item.key)">{{ item.label }} {{ item.count }}</view></view></scroll-view>
</view>
          <view class="card-v2 anim-card" style="animation-delay:0.2s"><text class="section-title-v2">关键事件流 · {{ activeTimelineFilterLabel }}</text><view v-if="filteredManualTimeline.length === 0" class="empty-sub-v2">当前筛选下还没有记录。</view><view v-else class="event-list-v2"><view v-for="item in visibleManualTimeline" :key="item._id || item.id" class="event-row-v2"><view class="event-time-v2"><text class="event-date-v2">{{ formatAxisDate(item) }}</text><text class="event-clock-v2">{{ formatAxisTime(item) }}</text><view :class="['event-dot-v2', toneClass(item.type)]"></view></view><view class="event-body-v2"><view class="event-meta-v2"><text>发生时间：{{ item.date }}</text><text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text></view><text class="event-title-v2">{{ item.title }}</text><text v-if="item.subjectRole" class="tag-v2 sm">{{ mapSubjectRoleLabel(item.subjectRole) }}</text><text v-if="didAIReview(item)" class="tag-v2 black sm">AI</text><text class="event-desc-v2">{{ item.description }}</text><view v-if="item.sections && item.sections.length" class="side-body-v2"><view v-for="sec in item.sections" :key="sec.label" class="side-item-v2"><text class="side-label-v2">{{ sec.label }}</text><text class="side-text-v2">{{ sec.text }}</text></view></view><view v-if="getImageAttachments(item).length > 0" class="img-grid-v2" style="margin-top:12rpx;"><view v-for="(att, ai) in getImageAttachments(item)" :key="att.fileID" class="img-box-v2" @click="previewTimelineImages(item, ai)"><image :src="imageUrlMap[att.fileID] || ''" class="img-preview-v2" mode="aspectFill" /><text v-if="att.analysis?.isChatRecord" class="img-chat-badge">聊</text></view></view><view v-if="getImageAnalyses(item).length > 0" class="img-analysis-list"><view v-for="att in getImageAnalyses(item)" :key="'analysis-' + att.fileID" class="img-analysis-card"><view v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-label">聊天截图 · AI 提取</view><view v-else class="img-analysis-label">图片 · AI 摘要</view><text v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-extracted">{{ att.analysis.extractedText }}</text><text v-if="att.analysis.summary" class="img-analysis-summary">{{ att.analysis.summary }}</text><view v-if="att.analysis.confidence" class="img-analysis-footer"><text :class="['tag-v2 sm', confidenceClass(att.analysis.confidence)]">{{ mapConfidenceLabel(att.analysis.confidence) }}</text></view></view></view><view v-if="getAudioBadges(item).length > 0" class="tag-row-v2" style="margin-top:6rpx;"><text v-for="badge in getAudioBadges(item)" :key="badge" class="tag-v2 sm">{{ badge }}</text></view></view></view></view><view v-if="filteredManualTimeline.length > 5" class="expand-row-v2"><view class="tag-v2" @click="toggleManualTimelineExpanded">{{ manualTimelineExpanded ? '收起' : '展开更多（还有 ' + (filteredManualTimeline.length - 5) + ' 条）' }}</view></view></view>
        </view>
        <view v-if="activeTimelineView === 'weeklyReviews'">
          <view class="card-v2 anim-card" style="animation-delay:0.25s">
            <text class="section-title-v2">14天复盘 · 按日历双周归档</text>
            <text class="section-hint-v2">按自然双周划分，每周期仅保留最新生成记录。</text>
            <view v-if="weeklyReviewTimeline.length === 0" class="empty-sub-v2">还没有14天复盘记录。先在14天复盘页生成一次，本页会自动沉淀到这里。</view>
            <view v-else class="event-list-v2">
              <view v-for="item in weeklyReviewTimeline" :key="item._id || item.id" class="event-row-v2 system">
                <view class="event-time-v2 week-range">
                  <text class="week-range-start">{{ formatAxisWeekRange(item).start }}</text>
                  <text class="week-range-connector">↓</text>
                  <text class="week-range-end">{{ formatAxisWeekRange(item).end }}</text>
                  <view :class="['event-dot-v2', isWeeklySideReadRecord(item) ? 'note' : 'trend']"></view>
                </view>
                <view class="event-body-v2 assessment-card-v2">
                  <text class="event-title-v2">{{ item.title || '近14天复盘' }}</text>
                  <view class="tag-row-v2" style="margin:6rpx 0;">
                    <text class="tag-v2 black sm">{{ isWeeklySideReadRecord(item) ? '星象速写' : '14天复盘' }}</text>
                    <text v-if="!isWeeklySideReadRecord(item) && item.trendLabel" class="tag-v2 sm">{{ mapWeeklyTrendLabel(item.trendLabel) }}</text>
                    <text v-if="item.aiUsed" class="tag-v2 sm">{{ isWeeklySideReadRecord(item) ? 'AI 星象速写' : 'AI 复盘' }}</text>
                  </view>
                  <text class="event-desc-v2">{{ item.description }}</text>
                  <view v-if="!isWeeklySideReadRecord(item) && (item.eventCount || item.assessmentCount || item.intentDelta || item.riskDelta)" class="tag-row-v2" style="margin-top:8rpx;">
                    <text v-if="item.eventCount" class="tag-v2 sm">事件 {{ item.eventCount }}</text>
                    <text v-if="item.assessmentCount" class="tag-v2 sm">分析 {{ item.assessmentCount }}</text>
                    <text v-if="item.intentDelta !== undefined" class="tag-v2 sm">意向 {{ item.intentDelta > 0 ? '+' : '' }}{{ item.intentDelta }}</text>
                    <text v-if="item.riskDelta !== undefined" class="tag-v2 sm">风险 {{ item.riskDelta > 0 ? '+' : '' }}{{ item.riskDelta }}</text>
                  </view>
                  <view v-if="item.keyChanges && item.keyChanges.length" class="review-block-v2"><text class="section-title-v2">近14天关键变化</text><text v-for="change in item.keyChanges" :key="change" class="bullet-v2">• {{ change }}</text></view>
                  <view v-if="item.keyEvents && item.keyEvents.length" class="review-block-v2 events"><text class="section-title-v2">关键事件</text><text v-for="evt in item.keyEvents" :key="evt" class="bullet-v2">• {{ evt }}</text></view>
                  <view v-if="item.nextWeekFocus && item.nextWeekFocus.length" class="review-block-v2 focus"><text class="section-title-v2">下个14天观察重点</text><text v-for="focus in item.nextWeekFocus" :key="focus" class="bullet-v2">• {{ focus }}</text></view>
                  <view v-if="item.avoidMisread && item.avoidMisread.length" class="review-block-v2 avoid"><text class="section-title-v2">近14天避免误判</text><text v-for="avoid in item.avoidMisread" :key="avoid" class="bullet-v2">• {{ avoid }}</text></view>
                  <view v-if="item.sections && item.sections.length" class="review-block-v2 sideread"><view v-for="sec in item.sections" :key="sec.label" class="side-item-v2"><text class="side-label-v2">{{ sec.label }}</text><text class="side-text-v2">{{ sec.text }}</text></view></view>
                  <text v-if="formatRecordedAt(item)" class="event-meta-recorded">{{ formatRecordedAt(item) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="activeTimelineView === 'assessments'">
          <view class="card-v2" style="border-color:#4ECDC4;"><view class="stats-grid-v2 stats-grid-4col-v2"><view v-for="item in assessmentStatItems" :key="item.key" :class="['stat-box-v2', activeAssessmentFilter === item.key ? 'active' : '']" @click="toggleAssessmentStatFilter(item.key)"><text class="stat-num-v2">{{ item.value }}</text><text class="stat-lbl-v2">{{ item.label }}</text></view></view></view>
          <view v-if="filteredAssessmentEntries.length > 0" class="card-v2">
            <text class="section-title-v2">分析记录 · {{ activeAssessmentFilterLabel }}</text>
            <view class="event-list-v2">
            <view v-for="entry in visibleAssessmentEntriesV2" :key="getAssessmentKey(entry.item)" class="event-row-v2">
              <view class="event-time-v2"><text class="event-date-v2">{{ formatAssessmentAxisDate(entry.item) }}</text><text class="event-clock-v2">{{ formatAssessmentAxisTime(entry.item) }}</text><view class="event-dot-v2 assessment"></view></view>
              <view class="event-body-v2 assessment-card-v2">
                <text class="event-title-v2">已记录：{{ getAssessmentTitle(entry.item) }}</text>
                <view class="tag-row-v2" style="margin:6rpx 0;"><text v-if="hasAIReview(entry.item)" class="tag-v2 black sm">AI 分析</text></view>
                <text class="event-desc-v2">{{ getAssessmentOriginalRecordText(entry.item) }}</text>
                <!-- Scores + Deltas -->
                <view class="score-block-v2">
                  <view class="score-row-v2"><text class="score-lbl-v2">意向</text><text class="score-val-v2">{{ clampScore(entry.item.intentScore) }}</text><text class="score-tag-v2">{{ mapIntentLabel(entry.item.intentBucket) }}</text><view class="score-bar-v2"><view class="score-fill-v2" :style="'width:' + clampScore(entry.item.intentScore) + '%'"></view></view></view>
                  <view class="score-row-v2"><text class="score-lbl-v2">风险</text><text class="score-val-v2 risk">{{ clampScore(entry.item.consistencyRiskScore) }}</text><text class="score-tag-v2">{{ mapRiskLabel(entry.item.riskBucket) }}</text><view class="score-bar-v2"><view class="score-fill-v2 risk" :style="'width:' + clampScore(entry.item.consistencyRiskScore) + '%'"></view></view></view>
                  <view class="delta-row-v2"><text class="delta-lbl-v2">意向变化</text><text :class="['delta-val-v2', deltaClass(entry.trend.intentDelta)]">{{ formatDelta(entry.trend.intentDelta) }}</text><text class="delta-lbl-v2" style="margin-left:20rpx;">风险变化</text><text :class="['delta-val-v2', deltaClass(entry.trend.riskDelta)]">{{ formatDelta(entry.trend.riskDelta) }}</text></view>
                </view>
                <text v-if="entry.trend.warningText" class="trend-warn-v2">{{ entry.trend.warningText }}</text>
                <!-- Reason bullets -->
                <view v-if="getAssessmentReasonBullets(entry.item).length > 0" class="reason-box-v2"><text class="section-title-v2">判断依据</text><text v-for="reason in getAssessmentReasonBullets(entry.item)" :key="reason" class="reason-line-v2">• {{ reason }}</text></view>
                <!-- Status tags -->
                <view v-if="assessmentStatusSnapshots[entry.index]" class="status-box-v2">
                  <view class="status-head-v2"><text class="section-title-v2">当前状态</text><text class="info-icon-v2" @click="openAssessmentStatusInfo(entry.item, assessmentStatusSnapshots[entry.index])">i</text></view>
                  <view v-if="getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index]).length" class="tag-row-v2"><text v-for="tag in getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index])" :key="tag" class="tag-v2 sm">{{ tag }}</text></view>
                  <view v-if="getAssessmentProblemTypeTags(entry.item).length" class="tag-row-v2"><text class="tag-v2 muted sm" v-for="tag in getAssessmentProblemTypeTags(entry.item)" :key="tag">{{ tag }}</text></view>
                </view>
                <!-- Action plan -->
                <view v-if="getAssessmentActionPlanPanel(entry.item).show" class="action-box-v2"><text class="action-label-v2">{{ getPetById(getSelectedPetId()).displayName }} 帮你看看</text><text v-if="getAssessmentActionPlanPanel(entry.item).missing" class="trend-summary-v2">{{ getAssessmentActionPlanPanel(entry.item).text }}</text><view v-else><view v-for="item in getAssessmentActionPlanPanel(entry.item).sections" :key="item.label" class="action-item-v2"><text class="action-item-label-v2">{{ petLabel(item.label) }}</text><text class="action-item-text-v2">{{ item.text }}</text></view></view></view>
                <!-- Side read -->
                <view v-if="getAssessmentSideRead(entry.item)" class="side-inline-v2">
                  <text class="focus-label-v2">{{ getAssessmentSideRead(entry.item).title }}</text>
                  <text class="weekly-desc-v2">{{ getAssessmentSideRead(entry.item).summary }}</text>
                  <view v-if="getAssessmentSideRead(entry.item).sections && getAssessmentSideRead(entry.item).sections.length" class="side-body-v2" style="margin-top:10rpx;">
                    <view v-for="sec in getAssessmentSideRead(entry.item).sections" :key="sec.label" class="side-item-v2">
                      <text class="side-label-v2">{{ sec.label }}</text>
                      <text class="side-text-v2">{{ sec.text }}</text>
                    </view>
                  </view>
                </view>
                <!-- Image links -->
                <view v-if="getAssessmentImageLinkItems(entry.item).length > 0" class="img-grid-v2" style="margin-top:12rpx;"><view v-for="(link, li) in getAssessmentImageLinkItems(entry.item)" :key="link.fileID" class="img-box-v2" @click="previewAssessmentImages(entry.item, li)"><image :src="link.url || imageUrlMap[link.fileID] || ''" class="img-preview-v2" mode="aspectFill" /><text v-if="link.isChatRecord" class="img-chat-badge">聊</text></view></view>
                <view v-if="getAssessmentImageAnalyses(entry.item).length > 0" class="img-analysis-list"><view v-for="att in getAssessmentImageAnalyses(entry.item)" :key="'analysis-' + att.fileID" class="img-analysis-card"><view v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-label">聊天截图 · AI 提取</view><view v-else class="img-analysis-label">图片 · AI 摘要</view><text v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-extracted">{{ att.analysis.extractedText }}</text><text v-if="att.analysis.summary" class="img-analysis-summary">{{ att.analysis.summary }}</text><view v-if="att.analysis.confidence" class="img-analysis-footer"><text :class="['tag-v2 sm', confidenceClass(att.analysis.confidence)]">{{ mapConfidenceLabel(att.analysis.confidence) }}</text></view></view></view>
              </view>
            </view>
          </view>
          <view v-if="filteredAssessmentEntries.length > assessmentVisibleMax" class="expand-row-v2"><view class="tag-v2" @click="assessmentVisibleMax = assessmentVisibleMax + 7">加载更多（还有 {{ filteredAssessmentEntries.length - assessmentVisibleMax }} 条）</view></view>
          </view>
        </view>
        <view v-if="selectedStatusInfo" class="info-mask-v2" @click="selectedStatusInfo = null"><view class="info-modal-v2" @click.stop><view class="info-head-v2"><text class="info-title-v2">当前状态怎么看</text><text class="info-close-v2" @click="selectedStatusInfo = null">X</text></view><scroll-view scroll-y class="info-body-v2"><view v-if="selectedStatusInfo.summary || selectedStatusInfo.caution" class="info-section-v2 ylw"><text class="info-sec-title-v2">这次状态说明</text><text v-if="selectedStatusInfo.summary" class="info-sec-copy-v2 strong">{{ selectedStatusInfo.summary }}</text><text v-if="selectedStatusInfo.caution" class="info-sec-copy-v2">{{ selectedStatusInfo.caution }}</text></view><view class="info-section-v2"><text class="info-sec-title-v2">状态标签</text><view v-for="item in selectedStatusStateItems" :key="`${item.group}-${item.tag}`" class="info-tag-row-v2"><text class="info-chip-v2">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">{{ item.group }}</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view><view class="info-section-v2"><text class="info-sec-title-v2">问题类型</text><view v-for="item in selectedProblemItems" :key="item.tag" class="info-tag-row-v2"><text class="info-chip-v2 muted">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">问题类型</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view></scroll-view></view></view>
      </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { batchTagEvents, getCaseDetail, getCurrentUserId, getCases, getCachedSelfProfile, getSelfProfile, getTempFileURL } from '@/utils/api'
import { consumePendingTimelineContext, getActiveCaseId, setActiveCaseId, showError } from '@/utils/helpers'
import { getSelectedPetId, getPetById } from '@/utils/pets.js'
import { buildProfileItems, explainProblemLabel, explainStatusTag } from '@/utils/insights'
import { buildTimelineFromLatestResult, compareAssessments, sortTimelineRecordsDesc, isSystemTimelineRecord, getTimelineRecordTimestamp } from '@/utils/insights'
import { buildTimelineStats, getTimelineRecordTags, buildObjectStatusCard } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const loading = ref(true)
const syncing = ref(false)
const caseFile = ref<any>(null)
const assessmentVisibleMax = ref(7)
const userId = ref('')
const caseId = ref('')
const selfProfile = ref<any>(getCachedSelfProfile())
const classified = ref(false)
const classifiedType = ref('')
const recorded = ref(false)
const targetEventId = ref('')
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const manualTimelineExpanded = ref(false)
const activeTimelineView = ref<'events' | 'weeklyReviews' | 'assessments'>('events')
const activeTimelineFilter = ref('all')
const activeAssessmentFilter = ref('all')
const initialized = ref(false)
const skipNextShowRefresh = ref(false)
const imageUrlMap = ref<Record<string, string>>({})
const selectedStatusInfo = ref<any>(null)
const TIMELINE_CACHE_PREFIX = 'timelineCaseCache:v1:'

const profileItems = computed(() => buildProfileItems(caseFile.value?.profile))

const assessmentTimeline = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(b) - getAssessmentTimestamp(a))
})

const chronologicalAssessments = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
})

const timelineById = computed(() => {
  const map = new Map<string, any>()
  for (const item of caseFile.value?.timeline || []) {
    const id = String(item.id || item._id || '').trim()
    if (id) map.set(id, item)
  }
  return map
})

const manualTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => !isSystemTimelineRecord(item) && !isWeeklyReviewTimelineRecord(item) && !isEventSideReadRecord(item)))
})

const weeklyReviewTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => isWeeklyReviewTimelineRecord(item)))
})

const timelineStats = computed(() => buildTimelineStats(manualTimeline.value))

const timelineStatItems = computed(() => [])

const timelineFilterOptions = computed(() => {
  const sceneKeys = new Set<string>()
  for (const item of manualTimeline.value) {
    const scene = getTimelineRecordTags(item).scene || []
    for (const s of scene) sceneKeys.add(s)
  }
  const sceneItems = Array.from(sceneKeys).map((key) => {
    const count = manualTimeline.value.filter((item: any) => getTimelineRecordTags(item).all.includes(key)).length
    const labelMap = { offline_meet: '碰面', movie: '电影', meal: '吃饭', coffee_tea: '咖啡奶茶', walk: '散步', walk_shop: '散步逛街', chat: '聊天', gift: '礼物', phone_call: '电话', online_chat: '线上聊天', shopping: '逛街', activity: '活动', study: '学习', work: '工作', travel: '出行', trip: '出行', game: '游戏', sport: '运动', music: '音乐', pet: '宠物', food: '美食', group_social: '朋友聚会' }
    const label = labelMap[key] || key
    return { key, label, count }
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
  return [
    { key: 'all', label: '全部', count: timelineStats.value.totalCount },
    ...sceneItems
  ]
})

const activeTimelineFilterLabel = computed(() => {
  const item = timelineFilterOptions.value.find((option) => option.key === activeTimelineFilter.value)
  return item && item.key !== 'all' ? `当前只看：${item.label}` : '当前查看全部事件'
})

const filteredManualTimeline = computed(() => {
  if (activeTimelineFilter.value === 'all') return manualTimeline.value
  return manualTimeline.value.filter((item: any) => getTimelineRecordTags(item).all.includes(activeTimelineFilter.value))
})

const visibleManualTimeline = computed(() => {
  if (manualTimelineExpanded.value || targetEventId.value) return filteredManualTimeline.value
  return filteredManualTimeline.value.slice(0, 5)
})

const systemTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => isSystemTimelineRecord(item)))
})

const supportTimeline = computed(() => {
  if (systemTimeline.value.length > 0) return systemTimeline.value
  return sortTimelineRecordsDesc(buildTimelineFromLatestResult(caseFile.value?.latestResult))
})

const timelineViewOptions = computed(() => [
  { key: 'events', label: '关键事件', count: manualTimeline.value.length },
  { key: 'assessments', label: '分析记录', count: assessmentTimeline.value.length },
  { key: 'weeklyReviews', label: '14天复盘', count: weeklyReviewTimeline.value.length },
])

const latestResult = computed(() => caseFile.value?.latestResult)

const triggerEvent = computed(() => {
  if (!latestResult.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === latestResult.value.triggerEventId) || null
})

const previousAssessment = computed(() => {
  const assessments = caseFile.value?.assessments || []
  return assessments.length > 1 ? assessments[assessments.length - 2] : null
})

const immediateTrend = computed(() => {
  if (!latestResult.value) {
    return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat', summaryText: '' }
  }
  return compareAssessments(previousAssessment.value, latestResult.value)
})

const profileSideRead = computed(() => {
  const sideRead = latestResult.value?.sideReadAdvice
  return sideRead?.summary || sideRead?.sections?.length ? sideRead : null
})

const latestRawReply = computed(() => {
  return String(latestResult.value?.rawReply || '').trim()
})

function parseRawReplySections(text: string) {
  const source = String(text || '').trim()
  if (!source) return []
  const labels = ['小咪觉得对方可能在想', '小咪觉得可以这样', '小咪说留个心眼']
  const normalized = source
    .replace(/\r/g, '')
    .replace(/(小咪觉得对方可能在想|小咪觉得可以这样|小咪说留个心眼)\s*[：:]/g, '\n$1：')
    .trim()
  const sections = labels.map((label, index) => {
    const start = normalized.indexOf(`${label}：`)
    if (start < 0) return null
    const contentStart = start + label.length + 1
    const nextStarts = labels
      .slice(index + 1)
      .map((nextLabel) => normalized.indexOf(`${nextLabel}：`, contentStart))
      .filter((pos) => pos >= 0)
    const end = nextStarts.length ? Math.min(...nextStarts) : normalized.length
    const text = normalized.slice(contentStart, end).replace(/^\s+|\s+$/g, '')
    return text ? { label, text } : null
  }).filter(Boolean) as Array<{ label: string; text: string }>
  return sections.length ? sections : [{ label: '回复建议', text: source }]
}

function petLabel(label: string) {
  return label.replace(/小咪/g, getPetById(getSelectedPetId()).displayName)
}

const latestActionPlanPanel = computed(() => {
  if (latestRawReply.value) {
    return { show: true, text: latestRawReply.value, missing: false, sections: parseRawReplySections(latestRawReply.value) }
  }
  if (latestResult.value?.source === 'event_recalculation') {
    return {
      show: true,
      text: latestResult.value.aiUsed === false
        ? '这次 AI 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 AI 原文回复没有返回，下面先显示结构化建议。',
      missing: true,
      sections: []
    }
  }
  return { show: false, text: '', missing: false, sections: [] }
})

const isLatestResultAIReviewed = computed(() => {
  return Boolean(
    triggerEvent.value?.aiUsed ||
    String(latestResult.value?.explanation?.headline || '').startsWith('AI 分析后：') ||
    String(latestResult.value?.explanation?.headline || '').startsWith('AI 研判后：')
  )
})

const triggerImageAttachments = computed(() => getImageAttachments(triggerEvent.value))

const triggerImageLinkItems = computed(() => {
  return triggerImageAttachments.value.map((attachment: any, index: number) => ({
    fileID: attachment.fileID,
    name: attachment.name || `图片${index + 1}`,
    url: imageUrlMap.value[attachment.fileID] || ''
  }))
})

const assessmentTrendSummaries = computed(() => {
  return assessmentTimeline.value.map((item: any, index: number) => {
    const previous = assessmentTimeline.value[index + 1] || null
    const trend = compareAssessments(previous, item)
    return trend.hasPrevious ? trend : null
  })
})

const assessmentEntries = computed(() => {
  return assessmentTimeline.value.map((item: any, index: number) => ({
    item,
    index,
    trend: getAssessmentTrend(index)
  }))
})

const assessmentStats = computed(() => {
  const entries = assessmentEntries.value
  const comparableEntries = entries.filter((entry) => entry.trend.hasPrevious)
  const countBy = (predicate: (entry: any) => boolean) => entries.filter(predicate).length
  const countComparableBy = (predicate: (entry: any) => boolean) => comparableEntries.filter(predicate).length
  return {
    total: entries.length,
    highRisk: countBy((entry) => entry.item?.riskBucket === 'high' || entry.item?.riskBucket === 'medium_high'),
    intentUp: countComparableBy((entry) => entry.trend.intentDirection === 'up'),
    intentDown: countComparableBy((entry) => entry.trend.intentDirection === 'down'),
    intentFlat: countComparableBy((entry) => entry.trend.intentDirection === 'flat'),
    riskUp: countComparableBy((entry) => entry.trend.riskDirection === 'up'),
    riskDown: countComparableBy((entry) => entry.trend.riskDirection === 'down'),
    riskFlat: countComparableBy((entry) => entry.trend.riskDirection === 'flat')
  }
})

const assessmentStatItems = computed(() => [
  { key: 'all', label: '全部', value: `${assessmentStats.value.total} 次` },
  { key: 'intent_up', label: '意向上升', value: `${assessmentStats.value.intentUp} 次` },
  { key: 'intent_flat', label: '意向持平', value: `${assessmentStats.value.intentFlat} 次` },
  { key: 'intent_down', label: '意向下降', value: `${assessmentStats.value.intentDown} 次` },
  { key: 'high_risk', label: '高风险', value: `${assessmentStats.value.highRisk} 次` },
  { key: 'risk_up', label: '风险上升', value: `${assessmentStats.value.riskUp} 次` },
  { key: 'risk_flat', label: '风险持平', value: `${assessmentStats.value.riskFlat} 次` },
  { key: 'risk_down', label: '风险下降', value: `${assessmentStats.value.riskDown} 次` }
])

const activeAssessmentFilterLabel = computed(() => {
  const item = assessmentStatItems.value.find((option) => option.key === activeAssessmentFilter.value)
  return item && item.key !== 'all' ? `当前只看：${item.label}` : '当前查看全部记录'
})

const filteredAssessmentEntries = computed(() => {
  if (activeAssessmentFilter.value === 'all') return assessmentEntries.value
  return assessmentEntries.value.filter((entry) => {
    switch (activeAssessmentFilter.value) {
      case 'intent_up': return entry.trend.hasPrevious && entry.trend.intentDirection === 'up'
      case 'intent_down': return entry.trend.hasPrevious && entry.trend.intentDirection === 'down'
      case 'intent_flat': return entry.trend.hasPrevious && entry.trend.intentDirection === 'flat'
      case 'risk_up': return entry.trend.hasPrevious && entry.trend.riskDirection === 'up'
      case 'risk_down': return entry.trend.hasPrevious && entry.trend.riskDirection === 'down'
      case 'risk_flat': return entry.trend.hasPrevious && entry.trend.riskDirection === 'flat'
      case 'high_risk': return entry.item?.riskBucket === 'high' || entry.item?.riskBucket === 'medium_high'
      default: return true
    }
  })
})

const visibleAssessmentEntries = computed(() => filteredAssessmentEntries.value)
const visibleAssessmentEntriesV2 = computed(() => filteredAssessmentEntries.value.slice(0, assessmentVisibleMax.value))

const assessmentStatusSnapshots = computed(() => {
  return assessmentTimeline.value.map((item: any) => {
    const chronologicalIndex = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
    const history = chronologicalIndex >= 0
      ? chronologicalAssessments.value.slice(0, chronologicalIndex + 1)
      : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
    return buildObjectStatusCard({
      ...caseFile.value,
      latestResult: item,
      assessments: history.length > 0 ? history : [item],
      timeline: caseFile.value?.timeline || []
    })
  })
})

function toneClass(type: string) {
  switch (type) {
    case 'positive': return 'positive'
    case 'risk': return 'risk'
    case 'verification': return 'verification'
    case 'weekly_review': return 'weekly'
    case 'assessment': return 'assessment'
    case 'trend': return 'trend'
    default: return 'note'
  }
}

function isWeeklySideReadRecord(record: any) {
  return String(record?.feature || '') === 'weeklySideRead'
}

function isEventSideReadRecord(record: any) {
  return String(record?.feature || '') === 'sideRead'
}

function isWeeklyReviewTimelineRecord(record: any) {
  if (String(record?.type || '') === 'weekly_review') return true
  if (isWeeklySideReadRecord(record)) return true
  return false
}

function isSemanticTaggableTimelineRecord(record: any) {
  if (!record) return false
  if (isSystemTimelineRecord(record)) return false
  if (isWeeklyReviewTimelineRecord(record)) return false
  if (isEventSideReadRecord(record)) return false
  return true
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

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '分析'
  }
}

function mapWeeklyTrendLabel(label: any) {
  const normalized = String(label || '').trim()
  const map: Record<string, string> = {
    持续向好: '近14天回暖',
    持续走低: '近14天转弱',
    风险抬头: '近14天承压',
    起伏不定: '近14天波动',
    基本持平: '近14天平稳',
    稳定观察: '近14天观察',
    升温期: '近14天回暖',
    升温中: '近14天回暖',
    走弱期: '近14天转弱',
    暂时平稳: '近14天平稳'
  }
  return map[normalized] || (normalized ? `近14天${normalized.replace(/^近14天/, '')}` : '近14天复盘')
}

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

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
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
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function getAssessmentTrend(index: number) {
  return assessmentTrendSummaries.value[index] || {
    intentDelta: 0,
    riskDelta: 0,
    intentDirection: 'flat',
    riskDirection: 'flat',
    summaryText: '',
    warningText: ''
  }
}

function getAssessmentType(item: any) {
  return item?.triggerEventType || getAssessmentEvent(item)?.type || 'note'
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

function formatAssessmentAxisDate(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '--/--'
  const date = new Date(timestamp)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function formatAssessmentAxisTime(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '--:--'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function hasAIReview(item: any) {
  return Boolean(
    item?.aiUsed ||
    String(item?.explanation?.headline || '').startsWith('AI 分析后：') ||
    String(item?.explanation?.headline || '').startsWith('AI 研判后：')
  )
}

function getAssessmentEvent(item: any) {
  const eventId = String(item?.triggerEventId || '').trim()
  return eventId ? timelineById.value.get(eventId) || null : null
}

function getAssessmentTitle(item: any) {
  return getAssessmentEvent(item)?.title || item?.triggerEventTitle || mapSourceLabel(item?.source)
}

function getAssessmentOriginalRecordText(item: any) {
  const event = getAssessmentEvent(item)
  const description = String(event?.description || '').trim()
  if (description) return description
  return getAssessmentTitle(item)
}

function getAssessmentSideRead(item: any) {
  const sideRead = item?.sideReadAdvice
  if (!sideRead) return null
  return (sideRead.summary || (sideRead.sections && sideRead.sections.length)) ? sideRead : null
}

function getAssessmentImageLinkItems(item: any) {
  return getImageAttachments(getAssessmentEvent(item)).map((attachment: any, index: number) => ({
    fileID: attachment.fileID,
    name: attachment.name || `图片${index + 1}`,
    url: imageUrlMap.value[attachment.fileID] || '',
    isChatRecord: Boolean(attachment?.analysis?.isChatRecord)
  }))
}

function getAssessmentImageAnalyses(item: any) {
  return getImageAttachments(getAssessmentEvent(item)).filter((att: any) => att?.analysis && typeof att.analysis === 'object')
}

function getAssessmentHistory(item: any) {
  const chronologicalIndex = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
  return chronologicalIndex >= 0
    ? chronologicalAssessments.value.slice(0, chronologicalIndex + 1)
    : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
}

function getAssessmentReasonBullets(item: any) {
  const bullets = item?.explanation?.bullets
  return Array.isArray(bullets) ? bullets.slice(0, 3) : []
}

function getAssessmentStatusStateTags(item: any, status: any) {
  const tags = [
    mapTimelineTypeLabel(getAssessmentType(item)),
    ...(Array.isArray(status?.tags) ? status.tags : [])
  ]
  return [...new Set(tags.filter(Boolean))].slice(0, 5)
}

function getAssessmentProblemTypeTags(item: any) {
  const labels = Array.isArray(item?.primaryLabels) ? item.primaryLabels : []
  const list = labels.filter(Boolean).slice(0, 4)
  return list.length ? list : ['暂无突出问题']
}

function openAssessmentStatusInfo(item: any, status: any) {
  selectedStatusInfo.value = {
    stateTags: getAssessmentStatusStateTags(item, status),
    problemTags: getAssessmentProblemTypeTags(item),
    summary: String(status?.summary || '').trim(),
    caution: String(status?.caution || '').trim()
  }
}

const selectedStatusStateItems = computed(() => {
  return (selectedStatusInfo.value?.stateTags || []).map((tag: string) => explainStatusTag(tag))
})

const selectedProblemItems = computed(() => {
  return (selectedStatusInfo.value?.problemTags || []).map((tag: string) => explainProblemLabel(tag))
})

function getRecentTrendAssessments(item: any) {
  const history = getAssessmentHistory(item)
  return history
    .filter((assessment: any) => getAssessmentTimestamp(assessment) > 0)
    .sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
    .slice(-4)
}

function getAssessmentRawReply(item: any) {
  return String(item?.rawReply || '').trim()
}

function getAssessmentActionPlanPanel(item: any) {
  const rawReply = getAssessmentRawReply(item)
  if (rawReply) {
    return { show: true, text: rawReply, missing: false, sections: parseRawReplySections(rawReply) }
  }
  if (item?.source === 'event_recalculation') {
    return {
      show: true,
      text: item.aiUsed === false
        ? '这次 AI 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 AI 原文回复没有返回。',
      missing: true,
      sections: []
    }
  }
  return { show: false, text: '', missing: false, sections: [] }
}

function getAttachmentBadges(item: any) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : []
  if (attachments.length === 0) return []
  const imageCount = attachments.filter((attachment: any) => attachment?.type === 'image').length
  const audioCount = attachments.filter((attachment: any) => attachment?.type === 'audio').length
  const chatCount = attachments.filter((attachment: any) => attachment?.analysis?.isChatRecord).length
  const badges: string[] = []
  if (imageCount) badges.push(`图片 ${imageCount}`)
  if (audioCount) badges.push(`语音 ${audioCount}`)
  if (chatCount) badges.push(`聊天截图 ${chatCount}`)
  return badges
}

function isImageAttachmentBadge(badge: string) {
  return badge.startsWith('图片') || badge.startsWith('聊天截图')
}

function getAudioBadges(item: any) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : []
  if (attachments.length === 0) return []
  const audioCount = attachments.filter((a: any) => a?.type === 'audio').length
  return audioCount ? [`语音 ${audioCount}`] : []
}

function getImageAttachments(item: any) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : []
  return attachments.filter((attachment: any) => attachment?.type === 'image' && attachment?.fileID)
}

function getImageAnalyses(item: any) {
  return getImageAttachments(item).filter((att: any) => att?.analysis && typeof att.analysis === 'object')
}

function mapConfidenceLabel(confidence: string) {
  const map: Record<string, string> = { low: '可信度：低', medium: '可信度：中', high: '可信度：高' }
  return map[confidence] || ''
}

function confidenceClass(confidence: string) {
  return confidence === 'high' ? 'conf-high' : confidence === 'low' ? 'conf-low' : ''
}

async function previewTimelineImages(item: any, index = 0) {
  const imageAttachments = getImageAttachments(item)
  if (imageAttachments.length === 0) return
  try {
    const urls = (await Promise.all(
      imageAttachments.map((attachment: any) => {
        if (imageUrlMap.value[attachment.fileID]) return imageUrlMap.value[attachment.fileID]
        return getTempFileURL(attachment.fileID).catch(() => '')
      })
    )).filter(Boolean)
    if (urls.length === 0) {
      showError('图片暂时无法预览')
      return
    }
    uni.previewImage({
      current: urls[Math.min(index, urls.length - 1)] || urls[0],
      urls
    })
  } catch (error: any) {
    uni.hideLoading()
    showError(error?.message || '图片预览失败')
  }
}

async function loadTriggerImageLinks() {
  const attachments = triggerImageAttachments.value
  if (attachments.length === 0) return
  const nextMap = { ...imageUrlMap.value }
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function loadAssessmentImageLinks() {
  const nextMap = { ...imageUrlMap.value }
  const attachments = assessmentTimeline.value.flatMap((item: any) => getImageAttachments(getAssessmentEvent(item)))
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function loadEventImageLinks() {
  const nextMap = { ...imageUrlMap.value }
  const attachments = manualTimeline.value.flatMap((item: any) => getImageAttachments(item))
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function previewTriggerImage(index = 0) {
  await loadTriggerImageLinks()
  const urls = triggerImageLinkItems.value.map((item) => item.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

async function previewAssessmentImages(item: any, index = 0) {
  await loadAssessmentImageLinks()
  const urls = getAssessmentImageLinkItems(item).map((link: any) => link.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

function mapSystemTrackTypeLabel(type?: string) {
  switch (type) {
    case 'assessment': return '系统分析'
    case 'trend': return '趋势重算'
    case 'positive': return '推进分析'
    case 'risk': return '风险分析'
    case 'verification': return '验证分析'
    case 'note': return '普通记录'
    default: return '系统日志'
  }
}

function mapTimelineTypeMessage(type?: string) {
  switch (type) {
    case 'positive': return '系统分析：这更像一次推进事件，会更关注主动、投入和关系推进信号。'
    case 'risk': return '系统分析：这更像一次风险事件，会更关注回避、拖延、失约和一致性问题。'
    case 'verification': return '系统分析：这更像一次验证事件，会更关注事实核实和承诺兑现。'
    case 'note': return '系统分析：这更像一条普通记录，先保留，等待后续更多线索。'
    default: return '系统已经完成本次事件分类。'
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

function mapSubjectRoleLabel(role?: string) {
  switch (role) {
    case 'self': return '我的记录'
    case 'both': return '双方互动'
    case 'target': return '对方记录'
    default: return ''
  }
}

function mapDirectionCopy(direction: 'up' | 'down' | 'flat', positiveWhenUp: string, positiveWhenDown: string) {
  if (direction === 'up') return positiveWhenUp
  if (direction === 'down') return positiveWhenDown
  return '基本持平'
}

function didAIReview(record: any) {
  return Boolean(record?.aiUsed)
}

function toggleManualTimelineExpanded() {
  manualTimelineExpanded.value = !manualTimelineExpanded.value
}

function setTimelineView(key: 'events' | 'weeklyReviews' | 'assessments') {
  activeTimelineView.value = key
}

function setTimelineFilter(key: string) {
  activeTimelineFilter.value = key
  manualTimelineExpanded.value = false
}

function toggleStatFilter(key1: string, key2: string) {
  if (activeTimelineFilter.value === key1) {
    activeTimelineFilter.value = key2
  } else if (activeTimelineFilter.value === key2) {
    activeTimelineFilter.value = 'all'
  } else {
    activeTimelineFilter.value = key1
  }
  manualTimelineExpanded.value = false
}

function setAssessmentFilter(key: string) {
  activeAssessmentFilter.value = key
  assessmentVisibleMax.value = 7
}

function toggleAssessmentStatFilter(key: string) {
  if (activeAssessmentFilter.value === key) {
    activeAssessmentFilter.value = 'all'
  } else {
    activeAssessmentFilter.value = key
  }
  assessmentVisibleMax.value = 7
}

function formatAxisWeekRange(record: any) {
  const ws = record?.weekStart
  const we = record?.weekEnd
  if (!ws || !we) return { start: formatAxisDate(record), end: '' }
  const s = new Date(ws)
  const e = new Date(we)
  return {
    start: `${s.getMonth() + 1}/${s.getDate()}`,
    end: `${e.getMonth() + 1}/${e.getDate()}`
  }
}

function formatAxisDate(record: any) {
  const timestamp = getTimelineRecordTimestamp(record)
  if (!timestamp) return '--/--'
  const date = new Date(timestamp)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function formatAxisTime(record: any) {
  const timestamp = getTimelineRecordTimestamp(record)
  if (!timestamp) return '--:--'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatRecordedAt(record: any) {
  if (!record.createdAt) return ''
  const timestamp = new Date(record.createdAt).getTime()
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `记录于 ${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function scrollToEvent(eventId: string) {
  // #ifdef MP-ALIPAY || MP-BAIDU
  uni.createSelectorQuery().select(`#event-${eventId}`)
    .boundingClientRect((rect: any) => {
      if (rect) uni.pageScrollTo({ scrollTop: rect.top, duration: 300 })
    }).exec()
  // #else
  uni.pageScrollTo({
    selector: `#event-${eventId}`,
    duration: 300
  })
  // #endif
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimelineEvent(eventId: string) {
  activeTimelineView.value = 'events'
  targetEventId.value = String(eventId || '').trim()
  manualTimelineExpanded.value = Boolean(targetEventId.value)
  nextTick(() => {
    if (targetEventId.value) {
      setTimeout(() => scrollToEvent(targetEventId.value), 80)
    }
  })
}

function applyEntryContext(options?: Record<string, any>) {
  const pending = (options as any)?._pending || consumePendingTimelineContext()
  caseId.value = String(options?.caseId || pending?.caseId || getActiveCaseId() || '').trim()
  classified.value = pending ? Boolean(pending.classified) : options?.classified === '1'
  classifiedType.value = String(pending?.eventType || options?.eventType || '').trim()
  recorded.value = pending ? Boolean(pending.recorded) : options?.recorded === '1'
  targetEventId.value = String(
    pending?.targetEventId
      || (options?.targetEventId ? decodeURIComponent(options.targetEventId) : '')
      || ''
  ).trim()
  if (targetEventId.value) {
    activeTimelineView.value = 'events'
    activeTimelineFilter.value = 'all'
  }
  if (caseId.value) setActiveCaseId(caseId.value)
}

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  applyEntryContext(options)
  initialized.value = true
  skipNextShowRefresh.value = true
  loadData()
})

const lastDataVersion = ref(0)

onShow(() => {
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  if (skipNextShowRefresh.value) {
    skipNextShowRefresh.value = false
    return
  }
  const hadContext = consumePendingTimelineContext()
  if (hadContext) applyEntryContext({ _pending: hadContext })
  const active = getActiveCaseId()
  if (!hadContext && active && active !== caseId.value) {
    caseId.value = active
    loadData({ silent: true })
    return
  }
  if (!hadContext) applyEntryContext(undefined)
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dv > lastDataVersion.value || hadContext) {
    lastDataVersion.value = dv
    loadData({ silent: true })
  }
})

onHide(() => {
  selectedStatusInfo.value = null
})

onUnload(() => {
  selectedStatusInfo.value = null
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

async function loadData(options?: { silent?: boolean }) {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  if (!caseFile.value && caseId.value) {
    const cached = readTimelineCache(uid, caseId.value)
    if (cached) {
      caseFile.value = cached
      loading.value = false
    }
  }
  if (!caseFile.value) loading.value = true
  else syncing.value = true
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      caseFile.value = null
      return
    }
    manualTimelineExpanded.value = Boolean(targetEventId.value)
    const detail = await getCaseDetail(uid, caseId.value)
    caseFile.value = detail
    writeTimelineCache(uid, caseId.value, detail)
    loadTimelineExtras(uid)
    if (activeTimelineFilter.value !== 'all') {
      const stillAvailable = timelineFilterOptions.value.some((item) => item.key === activeTimelineFilter.value && item.count > 0)
      if (!stillAvailable) activeTimelineFilter.value = 'all'
    }
    if (activeAssessmentFilter.value !== 'all') {
      const stillAvailable = assessmentFilterOptions.value.some((item) => item.key === activeAssessmentFilter.value && item.count > 0)
      if (!stillAvailable) activeAssessmentFilter.value = 'all'
    }
    if (targetEventId.value) {
      await nextTick()
      setTimeout(() => {
        scrollToEvent(targetEventId.value)
      }, 80)
    }
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
    syncing.value = false
  }
}

function readTimelineCache(uid: string, id: string) {
  try {
    const cached = uni.getStorageSync(`${TIMELINE_CACHE_PREFIX}${uid}:${id}`)
    return cached && cached.caseFile ? cached.caseFile : null
  } catch {
    return null
  }
}

function writeTimelineCache(uid: string, id: string, detail: any) {
  try {
    uni.setStorageSync(`${TIMELINE_CACHE_PREFIX}${uid}:${id}`, {
      cachedAt: Date.now(),
      caseFile: detail
    })
  } catch {}
}

async function loadTimelineExtras(uid: string) {
  getSelfProfile()
    .then((res: any) => { if (res?.success) selfProfile.value = res.selfProfile })
    .catch((error: any) => console.warn('[page:timeline] load self profile failed:', error))
  await Promise.all([
    loadTriggerImageLinks(),
    loadAssessmentImageLinks(),
    loadEventImageLinks()
  ]).catch(() => {})
  syncSemanticTags()
}

async function syncSemanticTags() {
  if (!caseFile.value) return
  const timeline = caseFile.value.timeline || []
  const untagged = timeline.filter((item: any) =>
    isSemanticTaggableTimelineRecord(item) &&
    item.semanticTagsSource !== 'user' &&
    !item.semanticTags
  )
  if (untagged.length === 0) return
  try {
    const result = await batchTagEvents(caseId.value)
    if (result?.success && result.tagged > 0) {
      const detail = await getCaseDetail(userId.value, caseId.value)
      if (detail) caseFile.value = detail
    }
  } catch { /* AI tagging is non-critical, silently ignore failures */ }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: var(--spacing-page, 28rpx);
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 390rpx),
    var(--app-bg, #f6f1e8);
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; }
.v2-mode .notice-v2.warn { background: #FFEEEC; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .tag-v2 { display: inline-flex; align-items: center; min-height: 36rpx; padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }
.v2-mode .tag-v2.sm { min-height: 28rpx; padding: 2rpx 10rpx; font-size: 18rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .section-hint-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-bottom: 14rpx; }

.v2-mode .feedback-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1.3; }
.v2-mode .feedback-desc-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 6rpx; }

.v2-mode .trend-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; }
.v2-mode .trend-item-v2 { padding: 18rpx; border: 2rpx solid #111; text-align: center; background: #f9f9f9; }
.v2-mode .trend-num-v2 { display: block; font-size: 40rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .trend-num-v2.risk { color: #FF5252; }
.v2-mode .trend-unit-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; }
.v2-mode .trend-summary-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 10rpx; }
.v2-mode .trend-warn-v2 { display: block; font-size: 22rpx; font-weight: 700; color: #FF5252; margin-top: 6rpx; }

.v2-mode .side-inline-v2 { margin-top: 12rpx; padding: 14rpx; border-left: 3rpx dashed #111; background: #FFFBEB; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .focus-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .weekly-desc-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .action-box-v2 { margin-top: 12rpx; padding: 14rpx; border-left: 3rpx solid #4ECDC4; background: #f5f5ff; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .action-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .action-item-v2 { padding: 10rpx; background: #fff; margin-top: 8rpx; border-radius: 4rpx; }
.v2-mode .action-item-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .action-item-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; margin-top: 4rpx; }

.v2-mode .tab-switch-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin-bottom: 24rpx; }
.v2-mode .tab-btn-v2 { text-align: center; padding: 16rpx 8rpx; border: 3rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .tab-btn-v2.active { background: #111; color: #FFD93D; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin-bottom: 14rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 2rpx; }

.v2-mode .filter-scroll-v2 { width: 100%; margin-top: 8rpx; white-space: nowrap; }
.v2-mode .filter-row-v2 { display: inline-flex; gap: 8rpx; }
.v2-mode .filter-chip-v2 { display: inline-flex; align-items: center; min-height: 48rpx; padding: 0 16rpx; border: 2rpx solid #111; background: #fff; font-size: 20rpx; font-weight: 700; color: #111; }
.v2-mode .filter-chip-v2.active { background: #111; color: #FFD93D; }

.v2-mode .event-list-v2 { display: flex; flex-direction: column; gap: 14rpx; margin-top: 14rpx; }
.v2-mode .event-row-v2 { display: flex; gap: 14rpx; padding: 18rpx; border: 2rpx dashed #111; background: #f9f9f9; }
.v2-mode .event-row-v2.system { background: #fff; border-style: dashed; }
.v2-mode .event-time-v2 { display: flex; flex-direction: column; align-items: center; width: 80rpx; flex-shrink: 0; }
.v2-mode .event-date-v2 { font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .event-clock-v2 { font-size: 18rpx; font-weight: 600; color: #999; }
.v2-mode .week-range-start,
.v2-mode .week-range-end { font-size: 20rpx; font-weight: 800; color: #111; line-height: 1.2; }
.v2-mode .week-range-connector { font-size: 18rpx; font-weight: 700; color: #bbb; line-height: 1; padding: 2rpx 0; }
.v2-mode .event-dot-v2 { width: 14rpx; height: 14rpx; border-radius: 50%; margin-top: 6rpx; border: 2rpx solid #111; }
.v2-mode .event-dot-v2.positive { background: #4ECDC4; }
.v2-mode .event-dot-v2.risk { background: #FF5252; }
.v2-mode .event-dot-v2.verification { background: #FFD93D; }
.v2-mode .event-dot-v2.assessment { background: #111; }
.v2-mode .event-dot-v2.trend { background: #666; }
.v2-mode .event-dot-v2.weekly { background: #B8F35A; }
.v2-mode .event-dot-v2.note { background: #111; }
.v2-mode .event-dot-v2.weekly { background: #4ECDC4; }

.v2-mode .review-block-v2 { margin-top: 12rpx; padding: 14rpx; border-left: 3rpx solid #FFD93D; background: #FFFBEB; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .review-block-v2.events { border-left-color: #111; background: #f9f9f9; }
.v2-mode .review-block-v2.focus { border-left-color: #4ECDC4; background: #f5f5ff; }
.v2-mode .review-block-v2.avoid { border-left-color: #FF6B6B; background: #FFFBEB; }
.v2-mode .review-block-v2.sideread { border-left: 3rpx dashed #111; background: #FFFBEB; }
.v2-mode .bullet-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .side-body-v2 { margin-top: 10rpx; padding: 12rpx 14rpx; background: #f9f9f9; border-radius: 4rpx; }
.v2-mode .side-item-v2 { padding: 10rpx 0; border-bottom: 2rpx dashed rgba(0,0,0,0.08); }
.v2-mode .side-item-v2:last-child { border-bottom: none; }
.v2-mode .side-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .side-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; margin-top: 4rpx; }
.v2-mode .event-body-v2 { flex: 1; min-width: 0; }
.v2-mode .event-meta-v2 { display: flex; flex-direction: column; gap: 2rpx; margin-bottom: 6rpx; }
.v2-mode .event-meta-v2 text { font-size: 18rpx; font-weight: 600; color: #999; }
.v2-mode .event-meta-recorded { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 10rpx; }
.v2-mode .event-title-v2 { display: block; font-size: 26rpx; font-weight: 800; color: #111; line-height: 1.4; }
.v2-mode .event-desc-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .assessment-card-v2 { background: #fff; padding: 16rpx; }
.v2-mode .score-block-v2 { margin-top: 10rpx; padding: 14rpx; background: #f9f9f9; border-radius: 4rpx; }
.v2-mode .score-row-v2 { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .score-row-v2:first-child { margin-top: 0; }
.v2-mode .score-lbl-v2 { width: 40rpx; font-size: 18rpx; font-weight: 700; color: #666; }
.v2-mode .score-val-v2 { width: 44rpx; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .score-val-v2.risk { color: #FF5252; }
.v2-mode .score-tag-v2 { font-size: 18rpx; font-weight: 600; color: #999; margin-right: 6rpx; }
.v2-mode .score-bar-v2 { flex: 1; height: 10rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .score-fill-v2 { height: 10rpx; background: #111; }
.v2-mode .score-fill-v2.risk { background: #FF5252; }

.v2-mode .delta-row-v2 { display: flex; align-items: center; margin-top: 10rpx; padding-top: 10rpx; border-top: 1rpx solid rgba(0,0,0,0.08); }
.v2-mode .delta-lbl-v2 { font-size: 18rpx; font-weight: 600; color: #999; margin-right: 4rpx; }
.v2-mode .delta-val-v2 { font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .delta-val-v2.up { color: #4ECDC4; }
.v2-mode .delta-val-v2.down { color: #FF5252; }
.v2-mode .delta-val-v2.flat { color: #999; }

.v2-mode .reason-box-v2 { margin-top: 10rpx; padding: 14rpx; border-left: 3rpx solid #FFD93D; background: #FFFBEB; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .reason-line-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 2rpx; }

.v2-mode .status-box-v2 { margin-top: 10rpx; padding: 14rpx; border-left: 3rpx solid #111; background: #f9f9f9; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .status-head-v2 { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.v2-mode .info-icon-v2 { width: 44rpx; height: 44rpx; line-height: 42rpx; text-align: center; border: 2rpx solid #111; font-size: 18rpx; font-weight: 900; color: #111; }
.v2-mode .tag-v2.muted { background: #111; color: #666; }

.v2-mode .delta-row-v2 { display: flex; gap: 8rpx; }
.v2-mode .delta-item-v2 { flex: 1; padding: 10rpx; border: 2rpx solid #111; text-align: center; background: #fff; }
.v2-mode .delta-lbl-v2 { font-size: 20rpx; font-weight: 800; color: #111; }

.v2-mode .expand-row-v2 { margin-top: 12rpx; text-align: center; }

/* Image thumbnail grid */
.v2-mode .img-grid-v2 { display: flex; flex-wrap: wrap; gap: 14rpx; }
.v2-mode .img-box-v2 { width: 160rpx; height: 160rpx; position: relative; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; border-radius: 4rpx; }
.v2-mode .img-chat-badge { position: absolute; top: 0; left: 0; padding: 2rpx 10rpx; background: #FFD93D; color: #111; font-size: 18rpx; font-weight: 900; }

/* Image analysis cards */
.v2-mode .img-analysis-list { display: flex; flex-direction: column; gap: 10rpx; margin-top: 10rpx; }
.v2-mode .img-analysis-card { padding: 14rpx 16rpx; border-left: 3rpx solid #999; background: #f9f9f9; border-radius: 0 4rpx 4rpx 0; }
.v2-mode .img-analysis-label { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .img-analysis-extracted { display: block; padding: 12rpx; border: 2rpx dashed #111; background: #fff; font-size: 22rpx; font-weight: 600; color: #333; line-height: 1.6; white-space: pre-wrap; word-break: break-all; margin-bottom: 8rpx; }
.v2-mode .img-analysis-summary { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; }
.v2-mode .img-analysis-footer { display: flex; justify-content: flex-end; margin-top: 8rpx; }
.v2-mode .tag-v2.sm.conf-high { background: #E0FFF0; color: #111; border-color: #4ECDC4; }
.v2-mode .tag-v2.sm.conf-low { background: #fff; color: #999; border-color: #999; }

.v2-mode .info-mask-v2 { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; }
.v2-mode .info-modal-v2 { width: 100%; max-height: 80vh; overflow: hidden; background: #fff; border: 3rpx solid #111; box-shadow: 10rpx 10rpx 0 #111; }
.v2-mode .info-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 3rpx solid #111; }
.v2-mode .info-title-v2 { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .info-close-v2 { width: 48rpx; height: 48rpx; line-height: 46rpx; text-align: center; border: 2rpx solid #111; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .info-body-v2 { max-height: 60vh; padding: 20rpx 24rpx 24rpx; box-sizing: border-box; }
.v2-mode .info-section-v2 { padding: 20rpx; border: 2rpx solid #111; margin-top: 16rpx; }
.v2-mode .info-section-v2.ylw { background: #FFFBEB; }
.v2-mode .info-sec-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }
.v2-mode .info-sec-copy-v2 { display: block; font-size: 22rpx; color: #555; line-height: 1.6; margin-top: 6rpx; }
.v2-mode .info-sec-copy-v2.strong { font-weight: 700; color: #111; }
.v2-mode .info-tag-row-v2 { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; border-top: 2rpx solid #111; }
.v2-mode .info-chip-v2 { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip-v2.muted { background: #111; }
.v2-mode .info-chip-copy-v2 { flex: 1; }
.v2-mode .info-chip-title-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip-desc-v2 { display: block; font-size: 20rpx; color: #666; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .bottom-action-v2 { text-align: center; margin: 10rpx 0 24rpx; }
.v2-mode .btn-v2-bottom { display: inline-block; padding: 14rpx 40rpx; background: #fff; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; box-shadow: 4rpx 4rpx 0 #111; }
.sync-bar { position: fixed; top: 0; left: 0; height: 3rpx; z-index: 9999; background: linear-gradient(90deg, transparent, #FF6B6B, transparent); animation: sync-slide 0.8s ease-in-out infinite; }
@keyframes sync-slide {
  0% { width: 30%; left: -30%; }
  100% { width: 30%; left: 130%; }
}

/* stat pair layout */
.v2-mode .stat-pair-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 14rpx; }
.v2-mode .stat-pair-box-v2 { padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; cursor: pointer; }
.v2-mode .stat-pair-box-v2.active { background: #111; }
.v2-mode .stat-pair-box-v2.active .section-title-v2 { color: #FFD93D; }
.v2-mode .stat-pair-row-v2 { display: flex; gap: 8rpx; }
.v2-mode .stat-pair-item-v2 { flex: 1; text-align: center; padding: 10rpx 4rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .stat-pair-item-v2.hl { background: #FFD93D; }
.v2-mode .stat-pair-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-pair-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 2rpx; }

/* stats grid clickable */
.v2-mode .stats-grid-4col-v2 { grid-template-columns: repeat(4, 1fr); }
.v2-mode .stat-box-v2.active { background: #111; }
.v2-mode .stat-box-v2.active .stat-num-v2 { color: #FFD93D; }
.v2-mode .stat-box-v2.active .stat-lbl-v2 { color: rgba(255,255,255,0.7); }
</style>
