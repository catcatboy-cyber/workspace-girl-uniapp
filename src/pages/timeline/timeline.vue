<template>
  <view class="page">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">时间线不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">关系记录 / {{ caseFile.name }}</text>
        <text class="h1">这是一条可继续累积的判断路径</text>
        <text class="hero-subtext">当前对象已经拥有独立 case 桶。评估结果和手动补充记录都会归到这个 case 下面。</text>
        <view v-if="profileItems.length > 0" class="badges">
          <text v-for="item in profileItems" :key="item" class="badge">{{ item }}</text>
        </view>
      </view>

      <!-- 事件分类提示 -->
      <view v-if="classified" class="card status-card" :class="classifiedType === 'risk' ? 'warning' : 'success'">
        <text class="status-strong">{{ mapTimelineTypeLabel(classifiedType) }}</text>
        <text class="muted">{{ mapTimelineTypeMessage(classifiedType) }}</text>
      </view>

      <!-- 当前观察重点 -->
      <view v-if="primaryFocus" class="card trend-card">
        <view class="section-head">
          <view>
            <text class="h2">当前观察重点</text>
            <text class="muted">让时间线不是散着记，而是围绕当前最该盯的那条主线继续补证据。</text>
          </view>
          <button class="link-button secondary" @click="goCaseDetail">回关系主页</button>
        </view>
        <view class="focus-badges">
          <text class="badge">{{ primaryFocus.label }}</text>
          <text class="pill neutral">{{ primaryFocus.status }}</text>
        </view>
        <text class="focus-summary">{{ primaryFocus.meaning }}</text>
        <text class="muted">现在更适合做的动作：{{ primaryFocus.action }}</text>
        <text class="muted">{{ primaryFocus.nextRecordPrompt }}</text>
        <view v-if="primaryFocus.evidences.length > 0" class="focus-evidence-list">
          <view v-for="item in primaryFocus.evidences" :key="item.id" class="focus-evidence-link" @click="scrollToEvent(item.id)">
            <text class="evidence-title">{{ item.title }}</text>
            <text class="evidence-time">{{ item.occurrenceTime }}</text>
          </view>
        </view>
      </view>

      <!-- 即时反馈卡片 -->
      <view v-if="recorded && triggerEvent && latestResult" class="card trend-summary-card">
        <view class="section-head">
          <view>
            <text class="h2">即时反馈</text>
            <text class="muted">这条新记录已经进入评估系统，下面是它带来的即时变化。</text>
          </view>
          <text class="muted">{{ triggerEvent.date }}</text>
        </view>
        <text class="latest-trend-title">{{ triggerEvent.title }}</text>
        <text class="latest-trend-desc">{{ latestResult.explanation?.headline }}</text>
        <view class="feedback-badges">
          <text class="badge">{{ mapTimelineTypeLabel(classifiedType) }}</text>
          <text class="badge">{{ mapAction(latestResult.nextAction) }}</text>
          <text class="badge">证据 {{ latestResult.evidenceLevel }}</text>
        </view>
        <view class="grid two trend-grid">
          <view class="trend-box">
            <text class="case-kpi-label">意向变化</text>
            <text class="trend-number" :class="immediateTrend.intentDirection === 'up' ? 'up' : immediateTrend.intentDirection === 'down' ? 'down' : 'flat'">
              {{ immediateTrend.intentDelta > 0 ? '+' : '' }}{{ immediateTrend.intentDelta }}
            </text>
            <text class="muted">当前 {{ latestResult.intentScore }} / {{ latestResult.intentBucket }}</text>
            <text class="muted">{{ mapDirectionCopy(immediateTrend.intentDirection, '对方的主动或投入感在上升', '这次没有把关系继续往前推') }}</text>
          </view>
          <view class="trend-box">
            <text class="case-kpi-label">风险变化</text>
            <text class="trend-number" :class="immediateTrend.riskDirection === 'up' ? 'up' : immediateTrend.riskDirection === 'down' ? 'down' : 'flat'">
              {{ immediateTrend.riskDelta > 0 ? '+' : '' }}{{ immediateTrend.riskDelta }}
            </text>
            <text class="muted">当前 {{ latestResult.consistencyRiskScore }} / {{ latestResult.riskBucket }}</text>
            <text class="muted">{{ mapDirectionCopy(immediateTrend.riskDirection, '一致性风险在抬头', '这次反而让风险稍微回落') }}</text>
          </view>
        </view>
        <text class="trend-summary-text">{{ immediateTrend.summaryText }}</text>
        <text v-if="immediateTrend.warningText" class="trend-warning">{{ immediateTrend.warningText }}</text>
        <view class="grid two feedback-grid">
          <view class="question">
            <text class="question-title">一句清醒提醒</text>
            <text class="question-text">{{ latestResult.explanation?.bullets?.[0] || '先看后续有没有连续动作，不要只看这一次。' }}</text>
          </view>
          <view class="question">
            <text class="question-title">现在更适合做什么</text>
            <text class="question-text">{{ mapAction(latestResult.nextAction) }}</text>
          </view>
        </view>
      </view>

      <!-- 娱乐化洞察 -->
      <view v-if="entertainmentInsight" class="card">
        <text class="h2">{{ entertainmentInsight.title }}</text>
        <text class="entertainment-summary">{{ entertainmentInsight.summary }}</text>
        <view class="grid entertainment-grid">
          <view v-for="item in entertainmentInsight.sections" :key="item.label" class="question">
            <text class="question-title">{{ item.label }}</text>
            <text class="question-text">{{ item.text }}</text>
          </view>
        </view>
        <text class="muted">{{ entertainmentInsight.disclaimer }}</text>
      </view>

      <!-- 关键事件流（双栏布局） -->
      <view class="grid two timeline-grid">
        <view class="card">
          <view class="section-head">
            <view>
              <text class="h2">关键事件流</text>
              <text class="muted">最新手动事件会优先排在前面。系统判断轨迹单独放在下面，避免把你的真实事件冲掉。</text>
            </view>
            <button class="link-button secondary" @click="goCaseDetail">返回关系主页</button>
          </view>
          <view v-if="manualTimeline.length === 0" class="muted">还没有手动记录。</view>
          <view v-else class="timeline-list large">
            <view v-for="item in manualTimeline" :key="item._id || item.id" :id="`event-${item._id || item.id}`" class="timeline-item">
              <view class="timeline-time">
                <text class="timeline-axis-date">{{ formatAxisDate(item) }}</text>
                <text class="timeline-axis-time">{{ formatAxisTime(item) }}</text>
                <view class="timeline-marker" :class="toneClass(item.type)" />
              </view>
              <view class="timeline-content">
                <view class="timeline-meta">
                  <text>发生时间：{{ item.date }}</text>
                  <text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text>
                </view>
                <text class="timeline-title">{{ item.title }}</text>
                <text class="timeline-desc">{{ item.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="card">
          <text class="h2">系统判断轨迹</text>
          <text class="muted">这里放的是评估完成、趋势变化这类系统自动生成的判断记录。</text>
          <view class="timeline-list large">
            <view v-for="item in supportTimeline" :key="item._id || item.id" class="timeline-item">
              <view class="timeline-time">
                <text class="timeline-axis-date">{{ formatAxisDate(item) }}</text>
                <text class="timeline-axis-time">{{ formatAxisTime(item) }}</text>
                <view class="timeline-marker" :class="toneClass(item.type)" />
              </view>
              <view class="timeline-content">
                <view class="timeline-meta">
                  <text>发生时间：{{ item.date }}</text>
                  <text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text>
                </view>
                <text class="timeline-title">{{ item.title }}</text>
                <text class="timeline-desc">{{ item.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 快速记录表单 -->
        <view class="card">
          <text class="h2">一句话快速记录</text>
          <text class="muted">这次新增后会写入当前 case 文件，而不是所有时间线共用一个文件。</text>
          <text class="muted">你只需要写发生了什么，并补一个具体发生时间。系统会自动生成标题，并判断它更像推进、风险、验证还是普通记录。</text>
          <text v-if="profileItems.length > 0" class="muted">当前对象画像也会作为后续 AI 事件理解的辅助上下文。</text>

          <view class="field">
            <text class="field-label">发生了什么</text>
            <textarea v-model="newDesc" class="text-area" placeholder="例如：他今天带朋友一起约我去郊游，还提前把集合时间和地点都发给我了。" />
          </view>

          <view class="field">
            <text class="field-label">具体发生时间</text>
            <view class="datetime-row">
              <picker mode="date" :value="newDate" @change="onDateChange">
                <view class="picker-view">{{ newDate }}</view>
              </picker>
              <picker mode="time" :value="newTime" @change="onTimeChange">
                <view class="picker-view">{{ newTime }}</view>
              </picker>
            </view>
          </view>

          <view class="actions">
            <button class="btn-primary" :disabled="submitting" @click="submitEvent">
              {{ submitting ? '保存中...' : '加入时间线并保存到当前 case' }}
            </button>
          </view>
        </view>
      </view>

      <!-- 引导卡片 -->
   <view class="grid two guide-grid">
        <view class="card">
          <text class="h2">接下来建议记录什么</text>
          <view class="bullets">
            <text class="bullet">• 一次新的主动联系是否出现</text>
            <text class="bullet">• 一次承诺是否被兑现</text>
            <text class="bullet">• 一次关键问题是否得到明确回应</text>
            <text class="bullet">• 是否再次出现忽冷忽热或明显反复</text>
          </view>
        </view>
        <view class="card">
          <text class="h2">存储说明</text>
          <text class="muted">当前 case 文件路径：workspace-girl/data/cases/&lt;caseId&gt;.json</text>
          <text class="muted">这意味着不同关系对象已经可以分桶保存，不再混在同一个 timeline 文件里。</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId, createTimeline } from '@/utils/api'
import { combineDateAndTimeToISOString, showError, showSuccess, getDateInputValue, getTimeInputValue } from '@/utils/helpers'
import { buildProfileItems } from '@/utils/insights'
import { buildFocusItems, buildEventEntertainmentInsight, buildTimelineFromLatestResult, compareAssessments, sortTimelineRecordsDesc, isSystemTimelineRecord, getTimelineRecordTimestamp } from '@/utils/insights'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const classified = ref(false)
const classifiedType = ref('')
const recorded = ref(false)
const targetEventId = ref('')

const newDesc = ref('')
const newDate = ref(getDateInputValue())
const newTime = ref(getTimeInputValue())
const submitting = ref(false)

const profileItems = computed(() => {
  return buildProfileItems(caseFile.value?.profile)
})

const manualTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => !isSystemTimelineRecord(item)))
})

const systemTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => isSystemTimelineRecord(item)))
})

const supportTimeline = computed(() => {
  if (systemTimeline.value.length > 0) return systemTimeline.value
  return sortTimelineRecordsDesc(buildTimelineFromLatestResult(caseFile.value?.latestResult))
})

const latestResult = computed(() => caseFile.value?.latestResult)

const triggerEvent = computed(() => {
  if (!latestResult.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === latestResult.value.triggerEventId) || null
})

const previousAssessment = computed(() => {
  const assessments = caseFile.value?.assessments || []
  // 约定：后端按 createdAt asc 返回，数组末尾是最新评估
  return assessments.length > 1 ? assessments[assessments.length - 2] : null
})

const immediateTrend = computed(() => {
  if (!latestResult.value) return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat', summaryText: '' }
  return compareAssessments(previousAssessment.value, latestResult.value)
})

const entertainmentInsight = computed(() => {
  if (!triggerEvent.value) return null
  return buildEventEntertainmentInsight({
    profile: caseFile.value?.profile,
    event: triggerEvent.value
  })
})

const focusItems = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.timeline) return []
  return buildFocusItems(caseFile.value)
})

const primaryFocus = computed(() => focusItems.value[0] || null)

function toneClass(type: string) {
  switch (type) {
    case 'positive': return 'positive'
    case 'risk': return 'risk'
    case 'verification': return 'verification'
    case 'assessment': return 'assessment'
    case 'trend': return 'trend'
    default: return 'note'
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

function mapTimelineTypeMessage(type?: string) {
  switch (type) {
    case 'positive': return '系统判定：这更像一次推进事件，会更关注主动、投入和关系推进信号。'
    case 'risk': return '系统判定：这更像一次风险事件，会更关注回避、拖延、失约和一致性问题。'
    case 'verification': return '系统判定：这更像一次验证事件，会更关注事实核实和承诺兑现。'
    case 'note': return '系统判定：这更像一条普通记录，先保留，等待后续更多线索。'
    default: return '系统已经完成本次事件分类。'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'observe': return '继续观察'
    case 'verify': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    case 'insufficient_data': return '样本还不够'
    default: return action || '继续观察'
  }
}

function mapDirectionCopy(direction: 'up' | 'down' | 'flat', positiveWhenUp: string, positiveWhenDown: string) {
  if (direction === 'up') return positiveWhenUp
  if (direction === 'down') return positiveWhenDown
  return '基本持平'
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
  uni.pageScrollTo({
    selector: `#event-${eventId}`,
    duration: 300
  })
}

function goCaseDetail() {
  uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId.value}` })
}

onLoad((options) => {
  caseId.value = options?.caseId || ''
  classified.value = options?.classified === '1'
  classifiedType.value = options?.eventType || ''
  recorded.value = options?.recorded === '1'
  targetEventId.value = options?.targetEventId ? decodeURIComponent(options.targetEventId) : ''
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
    caseFile.value = await getCaseDetail(uid, caseId.value)
    if (targetEventId.value) {
      await nextTick()
      setTimeout(() => {
        scrollToEvent(targetEventId.value)
      }, 80)
    }
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onDateChange(e: any) {
  newDate.value = e.detail.value
}

function onTimeChange(e: any) {
  newTime.value = e.detail.value
}

async function submitEvent() {
  if (!newDesc.value.trim()) {
    showError('请填写描述')
    return
  }
  submitting.value = true
  try {
    const res = await createTimeline({
      userId: userId.value,
      caseId: caseId.value,
      description: newDesc.value.trim(),
      occurrenceAt: combineDateAndTimeToISOString(newDate.value, newTime.value)
    })
    if (res.success) {
      showSuccess('已记录')
      newDesc.value = ''
      newDate.value = getDateInputValue()
      newTime.value = getTimeInputValue()

      // 重定向到带参数的时间线页面
      const eventType = res.eventType || 'note'
      uni.redirectTo({
        url: `/pages/timeline/timeline?caseId=${caseId.value}&classified=1&eventType=${eventType}&recorded=1`
      })
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 36rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.badges { margin-top: 14rpx; }
.badge { display: inline-block; padding: 8rpx 16rpx; background: #efe7d8; border-radius: 999rpx; font-size: 22rpx; color: #241b12; margin: 4rpx; }
.pill { display: inline-block; padding: 8rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; margin: 4rpx; }
.pill.neutral { background: #efe7d8; color: #241b12; }
.status-card { border-left: 8rpx solid #143f3a; }
.status-card.success { border-left-color: #14633a; background: #dff5e8; }
.status-card.warning { border-left-color: #b85c38; background: #f9d8d2; }
.status-strong { display: block; font-size: 28rpx; font-weight: 700; color: #241b12; margin-bottom: 6rpx; }
.trend-card { background: #fbf6ee; }
.section-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14rpx; }
.link-button { height: 64rpx; line-height: 64rpx; padding: 0 20rpx; background: #143f3a; color: #fff; border: none; border-radius: 10rpx; font-size: 24rpx; }
.link-button.secondary { background: #fff; color: #143f3a; border: 2rpx solid #143f3a; }
.focus-badges { margin: 12rpx 0; }
.focus-summary { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin: 12rpx 0; }
.focus-evidence-list { display: flex; flex-direction: column; gap: 8rpx; margin-top: 12rpx; }
.focus-evidence-link { display: flex; justify-content: space-between; padding: 12rpx; background: #fff; border-radius: 10rpx; }
.evidence-title { font-size: 26rpx; font-weight: 600; color: #241b12; }
.evidence-time { font-size: 22rpx; color: #786857; }
.trend-summary-card { background: #fbf6ee; }
.latest-trend-title { display: block; font-size: 30rpx; font-weight: 700; color: #143f3a; margin: 12rpx 0; }
.latest-trend-desc { display: block; font-size: 26rpx; color: #241b12; margin: 8rpx 0; }
.feedback-badges { margin: 12rpx 0; }
.grid { display: flex; gap: 16rpx; flex-wrap: wrap; }
.grid.two { display: flex; gap: 16rpx; flex-wrap: wrap; }
.trend-grid { margin-top: 14rpx; }
.trend-box { flex: 1; min-width: 280rpx; background: #fff; border-radius: 12rpx; padding: 20rpx; }
.case-kpi-label { display: block; font-size: 22rpx; color: #786857; margin-bottom: 4rpx; }
.trend-number { display: block; font-size: 48rpx; font-weight: 700; margin: 8rpx 0; }
.trend-number.up { color: #14633a; }
.trend-number.down { color: #b85c38; }
.trend-number.flat { color: #786857; }
.trend-summary-text { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin: 14rpx 0; }
.trend-warning { display: block; font-size: 26rpx; color: #b85c38; font-weight: 600; margin: 12rpx 0; }
.feedback-grid { margin-top: 10rpx; }
.question { flex: 1; min-width: 280rpx; padding: 16rpx; background: #fff; border-radius: 12rpx; }
.question-title { display: block; font-size: 24rpx; font-weight: 600; color: #241b12; margin-bottom: 8rpx; }
.question-text { display: block; font-size: 26rpx; color: #241b12; line-height: 1.6; }
.entertainment-summary { display: block; font-size: 26rpx; color: #241b12; margin: 12rpx 0; }
.entertainment-grid { margin-top: 14rpx; }
.timeline-grid { display: flex; gap: 16rpx; flex-wrap: wrap; }
.timeline-list { display: flex; flex-direction: column; gap: 16rpx; margin-top: 16rpx; }
.timeline-list.large { gap: 20rpx; }
.timeline-item { display: flex; gap: 18rpx; padding: 18rpx; background: #fff; border-radius: 14rpx; }
.timeline-time { display: flex; flex-direction: column; align-items: center; min-width: 100rpx; }
.timeline-axis-date { font-size: 22rpx; color: #786857; }
.timeline-axis-time { font-size: 20rpx; color: #786857; margin-top: 2rpx; }
.timeline-marker { width: 16rpx; height: 16rpx; border-radius: 50%; margin-top: 8rpx; }
.timeline-marker.positive { background: #14633a; }
.timeline-marker.risk { background: #b85c38; }
.timeline-marker.verification { background: #c08a14; }
.timeline-marker.assessment { background: #5c7cfa; }
.timeline-marker.trend { background: #8f5cf6; }
.timeline-marker.note { background: #786857; }
.timeline-content { flex: 1; }
.timeline-meta { display: flex; flex-direction: column; gap: 4rpx; margin-bottom: 8rpx; }
.timeline-meta text { font-size: 22rpx; color: #786857; }
.timeline-title { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin: 4rpx 0; }
.timeline-desc { display: block; font-size: 26rpx; color: #241b12; line-height: 1.5; }
.field { margin-top: 16rpx; }
.field-label { display: block; font-size: 24rpx; color: #241b12; margin-bottom: 8rpx; }
.text-area { width: 100%; min-height: 160rpx; padding: 18rpx; background: #fff; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 26rpx; box-sizing: border-box; }
.picker-view { height: 76rpx; line-height: 76rpx; padding: 0 22rpx; background: #fff; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 26rpx; }
.datetime-row { display: grid; grid-template-columns: 1fr 220rpx; gap: 12rpx; }
.actions { margin-top: 20rpx; }
.btn-primary { width: 100%; height: 80rpx; line-height: 80rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.guide-grid { margin-top: 0; }
.bullets { display: flex; flex-direction: column; gap: 8rpx; margin-top: 8rpx; }
.bullet { font-size: 26rpx; color: #241b12; line-height: 1.6; }
</style>
