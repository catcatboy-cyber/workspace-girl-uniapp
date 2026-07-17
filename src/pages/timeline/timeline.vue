<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <view v-if="syncing" class="sync-bar"></view>
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else-if="!caseFile" class="empty-v2"><text class="empty-title-v2">往事按时间线展示</text><text class="empty-sub-v2">记录互动后，这里会按时间顺序排列你和 TA 的每一个重要瞬间。</text><button class="btn btn-primary btn-md btn-auto" style="margin-top:16rpx;" @click="goHome">去首页记录互动</button></view>
      <template v-else>
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">TIMELINE</text>
          <text class="hero-title-v2">往<text class="hl-v2">事</text></text>
          <text class="hero-copy-v2">把真实发生过的互动按时间看清楚。</text>
          <hr class="hero-divider">
          <view class="hero-bottom">
            <view class="hero-avatar-lg"><image v-if="caseFile.profile?.avatar" :src="caseFile.profile.avatarUrl || caseFile.profile.avatar" mode="aspectFill" class="hero-avatar-img" /><text v-else>{{ caseFile.name?.slice(0,1) || '?' }}</text></view>
            <view class="hero-info-col">
              <view class="hero-main-row">
                <view class="hero-main-left">
                  <text class="hero-name-v2">{{ caseFile.name || '--' }}</text>
                  <text class="hero-chip primary">{{ timelineHeroTypeLabel }}</text>
                </view>
              </view>
              <view class="hero-meta-row">
                <text v-if="heroProfileItems.length === 0" class="hero-chip muted">暂无画像</text>
                <text v-for="item in heroProfileItems" :key="item" class="hero-chip">{{ item }}</text>
              </view>
            </view>
          </view>
        </view>
        <view>
          <view class="timeline-tools-v2 anim-card" style="animation-delay:0.15s">
  <view class="search-row-v2"><input class="search-input-v2" v-model="searchQuery" placeholder="搜索事件标题或描述..." confirm-type="search" /><view v-if="searchQuery" class="search-clear-v2" @click="searchQuery = ''">✕</view></view>
  <view v-if="topFilterOptions.length > 0" class="filter-row-v2"><view v-for="item in topFilterOptions" :key="item.key" :class="['filter-chip-v2', activeTimelineFilter === item.key ? 'active' : '']" @click="setTimelineFilter(item.key)">{{ item.label }} {{ item.count }}</view><view v-if="timelineFilterOptions.length > topFilterOptions.length" :class="['filter-chip-v2', showAllFilters ? 'active' : '']" @click="showAllFilters = !showAllFilters">更多 ▽</view></view>
  <view v-if="showAllFilters" class="filter-row-v2 more"><view v-for="item in remainingFilterOptions" :key="item.key" :class="['filter-chip-v2', activeTimelineFilter === item.key ? 'active' : '']" @click="setTimelineFilter(item.key)">{{ item.label }} {{ item.count }}</view></view>
</view>
          <view class="timeline-section-head-v2 anim-card" style="animation-delay:0.2s"><text class="section-title-v2">事件流 · {{ activeTimelineFilterLabel }}</text></view>
          <view v-if="filteredManualTimeline.length === 0" class="empty-sub-v2 anim-card" style="animation-delay:0.25s">当前筛选下还没有记录。</view>
          <view v-else class="event-list-v2 anim-card" style="animation-delay:0.25s"><view v-for="item in visibleManualTimeline" :key="item._id || item.id" class="event-row-v2"><view :class="['event-axis-v2', toneClass(item.type)]"><text class="event-date-v2">{{ formatAxisDate(item) }}</text><text class="event-clock-v2">{{ formatAxisTime(item) }}</text></view><view class="event-body-v2"><text class="event-desc-v2">{{ item.description }}</text><view v-if="item.subjectRole || getTimelineRecordTags(item).scene.length > 0" class="tag-row-v2" style="margin-top:4rpx;"><text v-if="item.subjectRole" class="tag-v2 sm">{{ mapSubjectRoleLabel(item.subjectRole) }}</text><text v-for="tag in getTimelineRecordTags(item).scene" :key="tag" class="tag-v2 sm">{{ sceneLabel(tag) }}</text></view><view v-if="item.sections && item.sections.length" class="side-body-v2"><view v-for="sec in item.sections" :key="sec.label" class="side-item-v2"><text class="side-label-v2">{{ sec.label }}</text><text class="side-text-v2">{{ sec.text }}</text></view></view><view v-if="getImageAttachments(item).length > 0" class="img-grid-v2" style="margin-top:12rpx;"><view v-for="(att, ai) in getImageAttachments(item)" :key="att.fileID" class="img-box-v2" @click="previewTimelineImages(item, ai)"><image :src="imageUrlMap[att.fileID] || ''" class="img-preview-v2" mode="aspectFill" /><text v-if="att.analysis?.isChatRecord" class="img-chat-badge">聊</text></view></view><view v-if="getImageAnalyses(item).length > 0" class="img-analysis-list"><view v-for="att in getImageAnalyses(item)" :key="'analysis-' + att.fileID" class="img-analysis-card"><view v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-label">聊天截图 · {{ aiLabel() }} 提取</view><view v-else class="img-analysis-label">图片 · {{ aiLabel() }} 摘要</view><text v-if="att.analysis.isChatRecord && att.analysis.extractedText" class="img-analysis-extracted">{{ att.analysis.extractedText }}</text><text v-if="att.analysis.summary" class="img-analysis-summary">{{ att.analysis.summary }}</text><view v-if="att.analysis.confidence" class="img-analysis-footer"><text :class="['tag-v2 sm', confidenceClass(att.analysis.confidence)]">{{ mapConfidenceLabel(att.analysis.confidence) }}</text></view></view></view><view v-if="getAudioBadges(item).length > 0" class="tag-row-v2" style="margin-top:6rpx;"><text v-for="badge in getAudioBadges(item)" :key="badge" class="tag-v2 sm">{{ badge }}</text></view>
                <view class="event-meta-v2"><text>发生时间：{{ item.date }}</text><text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text></view>
                <view v-if="getLinkedAssessment(item)" class="analysis-summary-v2" @click="toggleExpandedAnalysis(getLinkedAssessmentKey(item))">
                  <view class="summary-line-v2">
                    <text class="summary-score-v2">意向<text class="summary-score-num-v2">{{ clampScore(getLinkedAssessment(item).intentScore) }}</text></text>
                    <text :class="'summary-delta-v2 ' + deltaClass(getAssessmentTrendForItem(item).intentDelta)">{{ formatDelta(getAssessmentTrendForItem(item).intentDelta) }}</text>
                    <view class="summary-mini-bar"><view class="summary-mini-fill" :style="{ width: clampScore(getLinkedAssessment(item).intentScore) + '%' }"></view></view>
                  </view>
                  <view class="summary-line-v2">
                    <text class="summary-score-v2 risk">风险<text class="summary-score-num-v2 risk">{{ clampScore(getLinkedAssessment(item).consistencyRiskScore) }}</text></text>
                    <text :class="'summary-delta-v2 ' + deltaClass(getAssessmentTrendForItem(item).riskDelta)">{{ formatDelta(getAssessmentTrendForItem(item).riskDelta) }}</text>
                    <view class="summary-mini-bar risk"><view class="summary-mini-fill risk" :style="{ width: clampScore(getLinkedAssessment(item).consistencyRiskScore) + '%' }"></view></view>
                  </view>
                  <text class="summary-expand-v2">{{ isAnalysisExpanded(getLinkedAssessmentKey(item)) ? '收起' : '展开' }}</text>
                </view>
                <view v-if="isAnalysisExpanded(getLinkedAssessmentKey(item))" class="expanded-analysis-v2">
                  <view v-if="getAssessmentReasonBullets(getLinkedAssessment(item)).length > 0" class="reason-box-v2"><text class="section-title-v2">判断依据</text><text v-for="reason in getAssessmentReasonBullets(getLinkedAssessment(item))" :key="reason" class="reason-line-v2">• {{ reason }}</text></view>
                  <view v-if="getAssessmentLinkedStatusTags(item).length" class="status-box-v2" style="margin-top:10rpx;"><text class="section-title-v2">状态标签</text><view class="tag-row-v2"><text v-for="tag in getAssessmentLinkedStatusTags(item)" :key="tag" class="tag-v2 sm">{{ tag }}</text></view></view>
                  <view v-if="getAssessmentProblemTypeTags(getLinkedAssessment(item)).length && getAssessmentProblemTypeTags(getLinkedAssessment(item))[0] !== '暂无突出问题'" class="tag-row-v2" style="margin-top:6rpx;"><text v-for="tag in getAssessmentProblemTypeTags(getLinkedAssessment(item))" :key="tag" class="tag-v2 sm linked-assessment-tag-v2">{{ tag }}</text></view>
                  <view v-if="getAssessmentActionPlanPanel(getLinkedAssessment(item)).show" class="action-box-v2" style="margin-top:10rpx;"><text class="action-label-v2">{{ getPetById(getSelectedPetId()).displayName }} 帮你看看</text><text v-if="getAssessmentActionPlanPanel(getLinkedAssessment(item)).missing" class="trend-summary-v2">{{ getAssessmentActionPlanPanel(getLinkedAssessment(item)).text }}</text><view v-else><view v-for="s in getAssessmentActionPlanPanel(getLinkedAssessment(item)).sections" :key="s.label" class="action-item-v2"><text class="action-item-label-v2">{{ petLabel(s.label) }}</text><text class="action-item-text-v2">{{ s.text }}</text></view></view></view>
                  <view v-if="getAssessmentSideRead(getLinkedAssessment(item))" class="side-inline-v2" style="margin-top:10rpx;">
                    <text class="focus-label-v2">{{ getAssessmentSideRead(getLinkedAssessment(item)).title }}</text>
                    <text class="weekly-desc-v2">{{ getAssessmentSideRead(getLinkedAssessment(item)).summary }}</text>
                    <view v-if="getAssessmentSideRead(getLinkedAssessment(item)).sections && getAssessmentSideRead(getLinkedAssessment(item)).sections.length" class="side-body-v2" style="margin-top:10rpx;">
                      <view v-for="sec in getAssessmentSideRead(getLinkedAssessment(item)).sections" :key="sec.label" class="side-item-v2">
                        <text class="side-label-v2">{{ sec.label }}</text>
                        <text class="side-text-v2">{{ sec.text }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view></view></view><view v-if="filteredManualTimeline.length > 5" class="expand-row-v2 anim-card" style="animation-delay:0.3s"><view class="tag-v2" @click="toggleManualTimelineExpanded">{{ manualTimelineExpanded ? '收起' : '展开更多（还有 ' + (filteredManualTimeline.length - 5) + ' 条）' }}</view></view>
        </view>
        <view v-if="selectedStatusInfo" class="info-mask-v2" @click="selectedStatusInfo = null"><view class="info-modal-v2" @click.stop><view class="info-head-v2"><text class="info-title-v2">当前状态怎么看</text><text class="info-close-v2" @click="selectedStatusInfo = null">X</text></view><scroll-view scroll-y class="info-body-v2"><view v-if="selectedStatusInfo.summary || selectedStatusInfo.caution" class="info-section-v2 ylw"><text class="info-sec-title-v2">这次状态说明</text><text v-if="selectedStatusInfo.summary" class="info-sec-copy-v2 strong">{{ selectedStatusInfo.summary }}</text><text v-if="selectedStatusInfo.caution" class="info-sec-copy-v2">{{ selectedStatusInfo.caution }}</text></view><view class="info-section-v2"><text class="info-sec-title-v2">状态标签</text><view v-for="item in selectedStatusStateItems" :key="`${item.group}-${item.tag}`" class="info-tag-row-v2"><text class="info-chip-v2">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">{{ item.group }}</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view><view class="info-section-v2"><text class="info-sec-title-v2">问题类型</text><view v-for="item in selectedProblemItems" :key="item.tag" class="info-tag-row-v2"><text class="info-chip-v2 muted">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">问题类型</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view></scroll-view></view></view>
      </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">{{ aiLabel() }} 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { batchTagEvents, getCaseDetail, getCurrentUserId, getCases, getCachedSelfProfile, getSelfProfile, getTempFileURL } from '@/utils/api'
import { consumePendingTimelineContext, getActiveCaseId, setActiveCaseId, showError } from '@/utils/helpers'
import { getSelectedPetId, getPetById } from '@/utils/pets.js'
import { explainProblemLabel, explainStatusTag } from '@/utils/insights'
import { buildTimelineFromLatestResult, compareAssessments, sortTimelineRecordsDesc, isSystemTimelineRecord, getTimelineRecordTimestamp } from '@/utils/insights'
import { buildTimelineStats, getTimelineRecordTags, buildObjectStatusCard } from '@/utils/insights'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeTimelineShare, appendReferralParams, SAFE_SHARE_IMAGE } from '@/utils/share'
import { aiLabel } from '@/utils/labels'

const loading = ref(true)
const syncing = ref(false)
const fontSizeMode = ref(getFontSizeMode())
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

onShareAppMessage(() => ({ title: 'Crush Master｜关系时间线', path: appendReferralParams('/pages/index/index', 'timeline'), imageUrl: SAFE_SHARE_IMAGE }))

onShareTimeline(() => buildSafeTimelineShare())

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

const manualTimelineExpanded = ref(false)
const activeTimelineFilter = ref('all')
const activeAssessmentFilter = ref('all')
const searchQuery = ref('')
const showAllFilters = ref(false)
const initialized = ref(false)
const skipNextShowRefresh = ref(false)
const imageUrlMap = ref<Record<string, string>>({})
const selectedStatusInfo = ref<any>(null)
const TIMELINE_CACHE_PREFIX = 'timelineCaseCache:v1:'

const heroProfileItems = computed(() => {
  const p = caseFile.value?.profile
  if (!p) return []
  return [
    p.age ? `${p.age} 岁` : '',
    p.gender || '',
    p.zodiac ? `属${p.zodiac}` : '',
    p.constellation || '',
    p.occupation || ''
  ].filter(Boolean)
})
const timelineHeroTypeLabel = computed(() => {
  const relationType = String(caseFile.value?.profile?.relationType || '').trim()
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
  return 'Crush 档案'
})

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

const SCENE_LABEL_MAP: Record<string, string> = {
  offline_meet: '碰面', movie: '电影', meal: '吃饭', coffee_tea: '咖啡奶茶',
  walk: '散步', walk_shop: '散步逛街', chat: '聊天', gift: '礼物',
  phone_call: '电话', online_chat: '线上聊天', shopping: '逛街', activity: '活动',
  study: '学习', work: '工作', travel: '出行', trip: '出行', game: '游戏',
  sport: '运动', music: '音乐', pet: '宠物', food: '美食', group_social: '朋友聚会'
}
function sceneLabel(key: string): string { return SCENE_LABEL_MAP[key] || key }

const activeTimelineFilterLabel = computed(() => {
  const item = timelineFilterOptions.value.find((option) => option.key === activeTimelineFilter.value)
  return item && item.key !== 'all' ? `当前只看：${item.label}` : '当前查看全部事件'
})

const topFilterOptions = computed(() => timelineFilterOptions.value.slice(0, 6))
const remainingFilterOptions = computed(() => timelineFilterOptions.value.slice(6))
const filteredManualTimeline = computed(() => {
  let items = manualTimeline.value
  if (activeTimelineFilter.value !== 'all') {
    items = items.filter((item: any) => getTimelineRecordTags(item).all.includes(activeTimelineFilter.value))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    items = items.filter((item: any) =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    )
  }
  return items
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
  { key: 'events', label: '事件流', count: manualTimeline.value.length },
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
  return normalizeRawReplyText(latestResult.value?.rawReply)
})

function parseRawReplySections(text: string) {
  const source = String(text || '').trim()
  if (!source) return []
  const groups = [
    { label: '小咪先回答你的问题', aliases: ['小咪先回答你的问题'] },
    { label: '对方可能在想', aliases: ['对方可能在想', '小咪觉得对方可能在想'] },
    { label: '下一步可以这样推进', aliases: ['下一步可以这样推进', '小咪觉得可以这样'] },
    { label: '留个心眼', aliases: ['留个心眼', '小咪说留个心眼'] }
  ]
  let normalized = source.replace(/\r/g, '')
  groups.forEach((group) => {
    group.aliases.forEach((alias) => {
      normalized = normalized.replace(new RegExp(`${alias}\\s*[：:]`, 'g'), `\n${group.label}：`)
    })
  })
  if (!groups.some((group) => normalized.includes(`${group.label}：`))) {
    normalized = source.replace(/\r/g, '')
    groups.forEach((group) => {
      group.aliases.forEach((alias) => {
        normalized = normalized.replace(new RegExp(`${alias}\\s*\\/\\s*`, 'g'), `\n${group.label}：`)
      })
    })
  }
  normalized = normalized.trim()
  const labels = groups.map((group) => group.label)
  const sections = labels.map((label) => {
    const start = normalized.indexOf(`${label}：`)
    if (start < 0) return null
    const contentStart = start + label.length + 1
    const nextStarts = labels
      .map((nextLabel) => normalized.indexOf(`${nextLabel}：`, contentStart))
      .filter((pos) => pos >= 0)
    const end = nextStarts.length ? Math.min(...nextStarts) : normalized.length
    const sectionText = normalized.slice(contentStart, end).replace(/^\s+|\s+$/g, '')
    return sectionText ? { label, text: sectionText } : null
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
        ? '这次 ' + aiLabel() + ' 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 ' + aiLabel() + ' 原文回复没有返回，下面先显示结构化建议。',
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
    case 'monthly_review':
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
  const type = String(record?.type || '')
  if (type === 'weekly_review' || type === 'monthly_review') return true
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
  return {
    width: `${value}%`,
    background: kind === 'risk'
      ? 'var(--timeline-risk-gradient, linear-gradient(90deg, rgba(184,74,58,0.75), rgba(126,43,35,0.75)))'
      : 'var(--timeline-positive-gradient, linear-gradient(90deg, rgba(53,111,96,0.75), rgba(18,60,54,0.75)))'
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

// Event→Assessment linkage for merged event stream
function getLinkedAssessment(event: any) {
  const eventId = event?._id || event?.id
  if (!eventId) return null
  return assessmentTimeline.value.find((a: any) => String(a?.triggerEventId || '').trim() === String(eventId).trim()) || null
}
function getAssessmentTrendForItem(event: any) {
  const a = getLinkedAssessment(event)
  if (!a) return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat', summaryText: '', warningText: '', hasPrevious: false }
  const idx = assessmentTimeline.value.findIndex((item: any) => getAssessmentKey(item) === getAssessmentKey(a))
  return getAssessmentTrend(idx)
}
function getLinkedAssessmentKey(item: any) {
  const a = getLinkedAssessment(item)
  return a ? getAssessmentKey(a) : ''
}
function getAssessmentLinkedStatusTags(event: any) {
  const a = getLinkedAssessment(event)
  if (!a) return []
  const tags = [mapTimelineTypeLabel(getAssessmentType(a))]
  const idx = assessmentTimeline.value.findIndex((entry: any) => getAssessmentKey(entry) === getAssessmentKey(a))
  const status = assessmentStatusSnapshots.value[idx]
  if (status?.tags?.length) tags.push(...status.tags)
  return [...new Set(tags.filter(Boolean))].slice(0, 5)
}
const expandedAnalyses = ref<Record<string, boolean>>({})
function isAnalysisExpanded(key: string) { return !!expandedAnalyses.value[key] }
function toggleExpandedAnalysis(key: string) {
  expandedAnalyses.value = { ...expandedAnalyses.value, [key]: !expandedAnalyses.value[key] }
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

function normalizeRawReplyText(value: any): string {
  if (typeof value === 'string') {
    const source = value.trim()
    if (!source) return ''
    if ((source.startsWith('{') && source.endsWith('}')) || (source.startsWith('```') && source.includes('{'))) {
      try {
        const cleaned = source.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        return normalizeRawReplyText(JSON.parse(cleaned))
      } catch (_) {}
    }
    return source
  }
  if (!value || typeof value !== 'object') return ''
  if (value.rawReply || value.reply || value.text || value.content) {
    return normalizeRawReplyText(value.rawReply || value.reply || value.text || value.content)
  }
  const labels = ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼']
  return labels
    .map((label) => {
      const text = normalizeRawReplyText(value[label])
      return text ? `${label}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function getAssessmentRawReply(item: any) {
  return normalizeRawReplyText(item?.rawReply)
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
        ? '这次 ' + aiLabel() + ' 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 ' + aiLabel() + ' 原文回复没有返回。',
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

function toggleManualTimelineExpanded() {
  manualTimelineExpanded.value = !manualTimelineExpanded.value
}

function setTimelineFilter(key: string) {
  activeTimelineFilter.value = key
  manualTimelineExpanded.value = false
  showAllFilters.value = false
}
function applySearch() { /* v-model already reactive, no-op */ }

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

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimelineEvent(eventId: string) {
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
    fontSizeMode.value = getFontSizeMode()
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
    loading.value = false
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
    .catch(() => {})
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

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: var(--spacing-page, 28rpx);
  background:
    linear-gradient(180deg, var(--page-wash, rgba(18, 60, 54, 0.07)), transparent 390rpx),
    var(--app-bg, #f6f1e8);
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); background: var(--surface, #fff); margin-bottom: 18rpx; }
.v2-mode .empty-title-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; border-radius: var(--radius-xs, 0); font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; border-radius: var(--radius-xs, 0); }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--hero-text-color, #111); opacity: 0.78; line-height: 1.5; }
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.sm { min-height: 32rpx; padding: 2rpx 12rpx; font-size: $fs-caption; border: none; background: var(--surface-soft, #f4f4f4); color: var(--text-muted, #666); border-radius: var(--radius-xs, 0); }
.v2-mode .linked-assessment-tag-v2 { background: var(--surface-dim, #f0f0f0); color: var(--text-muted, #666); }

.v2-mode .section-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111); text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }

.v2-mode .trend-summary-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.5; margin-top: 10rpx; }

.v2-mode .side-inline-v2 { margin-top: 12rpx; padding: 12rpx 16rpx; border-left: 1rpx dashed var(--divider-strong, #111); background: var(--accent-soft, #FFFBEB); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }
.v2-mode .focus-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-muted, #666); text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .weekly-desc-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.5; margin-top: 4rpx; }

.v2-mode .action-box-v2 { margin-top: 12rpx; padding: 12rpx 16rpx; border-left: 1rpx solid var(--accent-cool, #4ECDC4); background: var(--surface-soft, #f5f5ff); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }
.v2-mode .action-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .action-item-v2 { padding: 12rpx 0; border-bottom: 1rpx solid var(--divider, rgba(0,0,0,0.08)); background: transparent; margin-top: 0; }
.v2-mode .action-item-v2:last-child { border-bottom: none; padding-bottom: 0; }
.v2-mode .action-item-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .action-item-text-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); margin-top: 4rpx; }

.v2-mode .timeline-tools-v2 { margin: 4rpx 0 24rpx; }
.v2-mode .search-row-v2 { display: flex; align-items: center; gap: 12rpx; }
.v2-mode .search-input-v2 { flex: 1; height: 72rpx; padding: 0 24rpx; box-sizing: border-box; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--surface, #fff); font-size: $fs-body-lg; color: var(--text-main, #111); }
.v2-mode .search-clear-v2 { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--shape-radius-control, 0); background: var(--surface-dim, #f0f0f0); font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-muted, #666); flex-shrink: 0; }
.v2-mode .filter-row-v2 { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .filter-row-v2.more { margin-top: 10rpx; }
.v2-mode .filter-chip-v2 { display: inline-flex; align-items: center; min-height: 52rpx; padding: 0 20rpx; border-radius: var(--shape-radius-control, 0); background: var(--surface-soft, #f4f4f4); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); }
.v2-mode .filter-chip-v2.active { background: var(--primary, #111); color: var(--primary-contrast, #fff); }

.v2-mode .timeline-section-head-v2 { margin: 0 4rpx; }
.v2-mode .timeline-section-head-v2 .section-title-v2 { margin-bottom: 0; }

/* === 时间轴几何：竖线中心 = 日期方块中心 = 事件卡左边框，同一 X（44rpx） === */
.v2-mode .event-list-v2 { position: relative; margin-top: 4rpx; }
.v2-mode .event-list-v2::before { content: ''; position: absolute; left: 44rpx; top: 20rpx; bottom: 20rpx; width: 1rpx; background: var(--divider-strong, #111); }
.v2-mode .event-row-v2 { position: relative; margin: 64rpx 0 0 44rpx; padding: 24rpx 24rpx 24rpx 68rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); background: var(--surface, #fff); box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111); }
.v2-mode .event-axis-v2 { position: absolute; left: -44rpx; top: -44rpx; width: 88rpx; height: 88rpx; box-sizing: border-box; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rpx; overflow: hidden; background: var(--primary, #111); border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); }
.v2-mode .event-axis-v2.risk { background: var(--risk, #FF5252); }
.v2-mode .event-date-v2 { font-size: $fs-caption; font-weight: $fw-hero; color: var(--primary-contrast, #fff); line-height: 1.1; }
.v2-mode .event-clock-v2 { font-size: $fs-micro; font-weight: $fw-body; color: var(--primary-contrast, #fff); opacity: 0.8; line-height: 1.1; }

.v2-mode .side-body-v2 { margin-top: 10rpx; padding: 12rpx 16rpx; background: var(--surface-dim, #f9f9f9); border-left: 1rpx solid var(--accent, #FFD93D); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }
.v2-mode .side-item-v2 { padding: 10rpx 0; border-bottom: 1rpx dashed var(--divider, rgba(0,0,0,0.08)); }
.v2-mode .side-item-v2:last-child { border-bottom: none; }
.v2-mode .side-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .side-text-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); margin-top: 4rpx; }
.v2-mode .event-body-v2 { min-width: 0; }
.v2-mode .event-meta-v2 { display: flex; flex-direction: column; gap: 2rpx; margin-top: 10rpx; }
.v2-mode .event-meta-v2 text { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); }
.v2-mode .event-desc-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.5; margin-top: 4rpx; }

.v2-mode .reason-box-v2 { margin-top: 10rpx; padding: 12rpx 16rpx; border-left: 1rpx solid var(--accent, #FFD93D); background: var(--accent-soft, #FFFBEB); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }
.v2-mode .reason-line-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #555); line-height: $lh-loose; margin-top: 2rpx; }

.v2-mode .status-box-v2 { margin-top: 10rpx; padding: 12rpx 16rpx; border-left: 1rpx solid var(--divider-strong, #111); background: var(--surface-dim, #f9f9f9); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }


.v2-mode .expand-row-v2 { margin-top: 24rpx; text-align: center; }
.v2-mode .expand-row-v2 .tag-v2 { min-height: 64rpx; padding: 0 32rpx; }
.v2-mode .empty-sub-v2.anim-card { padding: 24rpx 8rpx; }

/* Image thumbnail grid */
.v2-mode .img-grid-v2 { display: flex; flex-wrap: wrap; gap: 14rpx; }
.v2-mode .img-box-v2 { width: 160rpx; height: 160rpx; position: relative; border-radius: var(--radius-xs, 0); overflow: hidden; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; border-radius: var(--radius-xs, 0); }
.v2-mode .img-chat-badge { position: absolute; top: 0; left: 0; padding: 2rpx 10rpx; background: var(--accent, #FFD93D); color: var(--text-main, #111); font-size: $fs-caption; font-weight: $fw-hero; }

/* Image analysis cards */
.v2-mode .img-analysis-list { display: flex; flex-direction: column; gap: 10rpx; margin-top: 10rpx; }
.v2-mode .img-analysis-card { padding: 12rpx 16rpx; border-left: 1rpx solid var(--accent, #FFD93D); background: var(--accent-soft, #FFFBEB); border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0; }
.v2-mode .img-analysis-label { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 8rpx; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .img-analysis-extracted { display: block; padding: 12rpx; background: var(--surface, #fff); border-radius: var(--radius-xs, 0); font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #333); line-height: $lh-loose; white-space: pre-wrap; word-break: break-all; margin-bottom: 8rpx; }
.v2-mode .img-analysis-summary { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.5; }
.v2-mode .img-analysis-footer { display: flex; justify-content: flex-end; margin-top: 8rpx; }
.v2-mode .tag-v2.sm.conf-high { background: var(--success-soft, #E0FFF0); color: var(--text-main, #111); }
.v2-mode .tag-v2.sm.conf-low { background: var(--surface-dim, #f0f0f0); color: var(--text-soft, #999); }

.v2-mode .info-mask-v2 { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; background: var(--overlay, rgba(0,0,0,0.6)); display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; }
.v2-mode .info-modal-v2 { width: 100%; max-height: 80vh; overflow: hidden; background: var(--surface, #fff); border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); box-shadow: var(--shadow-hard, 10rpx 10rpx 0 #111); }
.v2-mode .info-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 3rpx solid var(--text-main, #111); }
.v2-mode .info-title-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .info-close-v2 { width: 48rpx; height: 48rpx; line-height: 46rpx; text-align: center; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .info-body-v2 { max-height: 60vh; padding: 20rpx 24rpx 24rpx; box-sizing: border-box; }
.v2-mode .info-section-v2 { padding: 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); margin-top: 16rpx; }
.v2-mode .info-section-v2.ylw { background: var(--brand-warm, #FFFBEB); }
.v2-mode .info-sec-title-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 10rpx; }
.v2-mode .info-sec-copy-v2 { display: block; font-size: $fs-body; color: var(--text-muted, #555); line-height: $lh-loose; margin-top: 6rpx; }
.v2-mode .info-sec-copy-v2.strong { font-weight: $fw-label; color: var(--text-main, #111); }
.v2-mode .info-tag-row-v2 { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; border-top: 2rpx solid var(--text-main, #111); }
.v2-mode .info-chip-v2 { padding: 6rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--accent, #FFD93D); font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .info-chip-v2.muted { background: var(--text-main, #111); }
.v2-mode .info-chip-copy-v2 { flex: 1; }
.v2-mode .info-chip-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .info-chip-desc-v2 { display: block; font-size: $fs-caption; color: var(--text-muted, #666); line-height: 1.5; margin-top: 4rpx; }

.sync-bar { position: fixed; top: 0; left: 0; height: 3rpx; z-index: 9999; background: var(--sync-gradient, linear-gradient(90deg, transparent, var(--hero-bg, #FF6B6B), transparent)); animation: sync-slide 0.8s ease-in-out infinite; }
@keyframes sync-slide {
  0% { width: 30%; left: -30%; }
  100% { width: 30%; left: 130%; }
}

/* === Analysis summary（意向/风险各一行，轻底色 + 细色条 + 细进度条） === */
.v2-mode .analysis-summary-v2 {
  position: relative; margin-top: 12rpx; padding: 14rpx 104rpx 14rpx 16rpx;
  background: var(--surface-soft, #FFFBEB);
  border-left: 1rpx solid var(--accent, #FFD93D);
  border-radius: 0 var(--radius-xs, 0) var(--radius-xs, 0) 0;
  display: flex; flex-direction: column; gap: 8rpx;
  cursor: pointer;
}
.v2-mode .analysis-summary-v2:active { background: var(--surface-dim, #eee8d5); }
.v2-mode .summary-line-v2 { display: flex; align-items: center; gap: 10rpx; min-height: 36rpx; }
.v2-mode .summary-score-v2 { flex-shrink: 0; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); }
.v2-mode .summary-score-num-v2 { font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111); margin-left: 4rpx; }
.v2-mode .summary-score-num-v2.risk { color: var(--risk, #FF5252); }
.v2-mode .summary-score-v2.risk { color: var(--text-muted, #666); }
.v2-mode .summary-delta-v2 { flex-shrink: 0; font-size: $fs-caption; font-weight: $fw-hero; }
.v2-mode .summary-delta-v2.up { color: var(--accent-cool, #4ECDC4); }
.v2-mode .summary-delta-v2.down { color: var(--risk, #FF5252); }
.v2-mode .summary-delta-v2.flat { color: var(--text-soft, #999); }
.v2-mode .summary-expand-v2 { position: absolute; right: 16rpx; top: 50%; transform: translateY(-50%); padding: 12rpx 8rpx; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .summary-mini-bar { flex: 1; max-width: 240rpx; height: 8rpx; background: var(--surface-dim, #eee); border-radius: var(--radius-xs, 0); overflow: hidden; }
.v2-mode .summary-mini-bar .summary-mini-fill { height: 100%; background: var(--chart-intent, #111); border-radius: var(--radius-xs, 0); }
.v2-mode .summary-mini-bar.risk .summary-mini-fill { background: var(--chart-risk, #FF5252); }
.v2-mode .expanded-analysis-v2 { margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx solid var(--divider, rgba(0,0,0,0.08)); }

@media (prefers-reduced-motion: reduce) {
  .v2-mode.anim-ready .anim-hero,
  .v2-mode.anim-ready .anim-card { animation-duration: 0.01s; }
  .sync-bar { animation: none; }
}
</style>
