<template>
  <view class="page">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">结果不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view v-if="profileUpdated" class="card status-card success">
        <text class="status-strong">画像已更新</text>
        <text class="muted">对象画像信息已保存，后续侧写会更有意思。</text>
      </view>

      <view class="hero-card card">
        <text class="hero-topline">关系主页 / {{ caseFile.name }}</text>
        <text class="h1">{{ result?.explanation?.headline || '暂无评估结果' }}</text>
        <text class="hero-subtext">这是一份结构化判断结果，帮助你减少误判，但不代表事实裁决。</text>
        <view v-if="result" class="pills">
          <text class="pill" :class="intentTone">{{ mapIntentLabel(result.intentBucket) }}</text>
          <text class="pill" :class="riskTone">{{ mapRiskLabel(result.riskBucket) }}</text>
          <text class="pill neutral">证据等级 {{ result.evidenceLevel }}</text>
        </view>
      </view>

      <!-- 对象画像 -->
      <view class="card">
        <view class="section-head">
          <view>
            <text class="h2">对象画像</text>
            <text class="muted">仅作辅助理解和趣味补充，不参与核心评分。</text>
          </view>
        </view>
        <view class="profile-inline-head">
          <view class="profile-avatar md">
            <image v-if="caseFile.profile?.avatar" :src="caseFile.profile.avatar" mode="aspectFill" />
            <text v-else class="avatar-placeholder">{{ avatarLabel(caseFile.name) }}</text>
          </view>
          <text class="profile-name">{{ caseFile.name }}</text>
        </view>
        <view v-if="profileItems.length > 0" class="badges">
          <text v-for="item in profileItems" :key="item" class="badge">{{ item }}</text>
        </view>
        <text v-else class="muted">你还没有为这个对象补充画像信息。</text>
        <view class="actions">
          <button class="btn-secondary" @click="goEditProfile">{{ profileItems.length > 0 ? '编辑画像' : '去补充画像' }}</button>
        </view>
      </view>

      <!-- 解释 -->
      <view v-if="result?.explanation?.bullets?.length" class="card">
        <text class="h2">你为什么会得到这个结果</text>
        <view class="bullets">
          <text v-for="b in result.explanation.bullets" :key="b" class="bullet">• {{ b }}</text>
        </view>
      </view>

      <!-- 指标 -->
      <view v-if="result" class="grid two metrics-grid">
        <view class="card metric-card">
          <text class="metric-title">意向倾向</text>
          <view class="metric-row">
            <text class="kpi">{{ result.intentScore }}</text>
            <text class="score-chip" :class="intentTone">{{ mapIntentLabel(result.intentBucket) }}</text>
          </view>
          <view class="meter">
            <view class="meter-fill" :class="intentTone" :style="{ width: result.intentScore + '%' }" />
          </view>
          <text class="muted">看的是主动性、投入度、推进关系的意愿。</text>
        </view>
        <view class="card metric-card">
          <text class="metric-title">一致性风险</text>
          <view class="metric-row">
            <text class="kpi">{{ result.consistencyRiskScore }}</text>
            <text class="score-chip" :class="riskTone">{{ mapRiskLabel(result.riskBucket) }}</text>
          </view>
          <view class="meter risk">
            <view class="meter-fill" :class="labelTone(result.consistencyRiskScore)" :style="{ width: result.consistencyRiskScore + '%' }" />
          </view>
          <text class="muted">看的是改口、回避、兑现不足和节奏反复等风险。</text>
        </view>
      </view>

      <!-- 当前建议和可信度 -->
      <view v-if="result" class="grid two">
        <view class="card info-card">
          <text class="h2">当前建议</text>
          <view class="advice-box">{{ mapAction(result.nextAction) }}</view>
          <text class="muted">如果证据还薄，最好的动作通常不是判断，而是再观察一轮关键互动。</text>
        </view>
        <view class="card info-card">
          <text class="h2">可信度</text>
          <view class="evidence-display">{{ result.evidenceLevel }}</view>
          <text class="muted">当前可信度：{{ result.confidenceLevel }}</text>
          <text class="muted">证据等级越低，越不应该根据单次细节提前下强结论。</text>
        </view>
      </view>

      <!-- 对象状态卡 -->
      <view v-if="statusCard" class="card status-overview-card">
        <view class="section-head">
          <view>
            <text class="h2">对象状态卡</text>
            <text class="muted">把这个对象最近的关系阶段、状态和气候放在一张卡里看。</text>
          </view>
        </view>
        <view class="badges">
          <text class="badge">{{ statusCard.phase }}</text>
          <text class="badge">{{ statusCard.state }}</text>
          <text class="badge">{{ statusCard.weather }}</text>
        </view>
        <text class="status-summary">{{ statusCard.summary }}</text>
        <text class="muted">{{ statusCard.spotlight }}</text>
        <text class="muted warning-text">{{ statusCard.caution }}</text>
      </view>

      <!-- 焦点事项 -->
      <view v-if="focusItems.length > 0" class="card">
        <text class="h2">当前需要注意什么</text>
        <text class="muted">每一行都是一组完整关系：左边是它对应的时间线证据，右边是这组证据现在说明了什么。</text>
        <view class="focus-pairs">
          <view v-for="(item, index) in focusItems" :key="item.label" class="focus-pair">
            <text class="focus-pair-rank">{{ mapFocusRank(index) }}</text>
            <view class="focus-pair-rail">
              <text class="case-kpi-label">相关时间线</text>
              <view class="focus-board-timeline">
                <view v-for="ev in item.evidences" :key="ev.id" class="focus-board-event" @click="goTimelineEvent(ev.id)">
                  <view class="focus-board-axis">
                    <text class="focus-board-axis-time">{{ ev.occurrenceTime }}</text>
                    <text v-if="ev.sequenceLabel" class="focus-board-axis-seq">{{ ev.sequenceLabel }}</text>
                  </view>
                  <view class="focus-board-track">
                    <view class="focus-board-line" />
                    <view class="focus-board-dot" />
                  </view>
                  <view class="focus-board-content">
                    <view class="focus-board-chip-row">
                      <text class="badge">{{ item.label }}</text>
                    </view>
                    <text class="focus-board-title">{{ ev.title }}</text>
                    <text v-if="ev.recordedAt" class="focus-board-subtime">补录：{{ ev.recordedAt }}</text>
                  </view>
                </view>
              </view>
            </view>
            <view class="question focus-pair-card">
              <view class="section-head">
                <view>
                  <text class="badge">{{ item.label }}</text>
                  <text class="pill neutral">{{ item.status }}</text>
                </view>
              </view>
              <text class="focus-meaning">{{ item.meaning }}</text>
              <text class="muted">更适合做的动作：{{ item.action }}</text>
              <text class="muted">{{ item.nextRecordPrompt }}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="card">
        <text class="h2">当前需要注意什么</text>
        <text class="muted">当前没有特别突出的结构性提醒。重点继续看后续是否稳定、是否兑现。</text>
      </view>

      <!-- 娱乐洞察 -->
      <view v-if="entertainmentInsight" class="card">
        <text class="h2">{{ entertainmentInsight.title }}</text>
        <text class="entertainment-summary">{{ entertainmentInsight.summary }}</text>
        <view class="grid">
          <view v-for="item in entertainmentInsight.sections" :key="item.label" class="question">
            <text class="entertainment-label">{{ item.label }}</text>
            <text class="entertainment-text">{{ item.text }}</text>
          </view>
        </view>
        <text class="muted">{{ entertainmentInsight.disclaimer }}</text>
      </view>

      <!-- 最近 7 天回顾 -->
      <view v-if="weeklyReview" class="card">
        <view class="section-head">
          <view>
            <text class="h2">{{ weeklyReview.title }}</text>
            <text class="muted">让你回头看最近 7 天发生了什么，而不是只盯着最新一条。</text>
          </view>
        </view>
        <view class="case-kpis">
          <view v-for="stat in weeklyReview.stats" :key="stat.label" class="kpi-item">
            <text class="case-kpi-label">{{ stat.label }}</text>
            <text class="case-kpi-value">{{ stat.value }}</text>
          </view>
        </view>
        <text class="status-summary">{{ weeklyReview.summary }}</text>
        <text class="muted">{{ weeklyReview.highlight }}</text>
        <text class="muted">{{ weeklyReview.warning }}</text>
      </view>

      <!-- 评估趋势图 -->
      <view v-if="assessmentsList.length > 0" class="card">
        <AssessmentTrendChart
          :assessments="assessmentsList"
          title="趋势图"
          subtitle="把这个对象的多次评估放在一张图里，能更快看出意向和风险到底怎么变。"
        />
      </view>

      <!-- 趋势变化 -->
      <view v-if="trend && trend.hasPrevious" class="card trend-card">
        <view class="section-head">
          <view>
            <text class="h2">趋势对比</text>
            <text class="muted">看这次相对上一次，到底是变好、变差，还是只是感觉在变。</text>
          </view>
          <text class="muted">{{ trend.hasPrevious ? '上次 vs 这次' : '首次评估' }}</text>
        </view>
        <text class="status-summary">{{ trend.summaryText }}</text>
        <text v-if="trend.warningText" class="trend-warning">{{ trend.warningText }}</text>
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

      <!-- 主要标签 -->
      <view v-if="result?.primaryLabels?.length" class="card">
        <text class="h2">主要标签</text>
        <view class="badges">
          <text v-for="l in result.primaryLabels" :key="l" class="badge">{{ l }}</text>
        </view>
      </view>

      <!-- 使用提醒 -->
      <view v-if="result?.explanation?.cautions?.length" class="card">
        <text class="h2">使用提醒</text>
        <view class="bullets">
          <text v-for="c in result.explanation.cautions" :key="c" class="bullet">• {{ c }}</text>
        </view>
      </view>

      <!-- 关系时间线 -->
      <view class="card">
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
      <view class="grid two">
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

      <!-- 操作（保留原有的删除功能） -->
      <view class="card">
        <view class="actions vertical">
          <button class="btn-danger" @click="onDelete">删除案例</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCaseDetail, deleteCase, getCurrentUserId } from '@/utils/api'
import { showError, showSuccess, confirm } from '@/utils/helpers'
import { buildFocusItems, buildObjectStatusCard, compareAssessments, buildCaseWeeklyReview, buildEventEntertainmentInsight } from '@/utils/insights'
import AssessmentTrendChart from '@/components/AssessmentTrendChart.vue'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const profileUpdated = ref(false)

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
  if (p.relationType === 'close_friend') items.push('亲密朋友')
  else if (p.relationType === 'romantic') items.push('恋爱对象')
  return items
})

const focusItems = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.timeline) return []
  return buildFocusItems(caseFile.value)
})

const statusCard = computed(() => {
  if (!caseFile.value?.latestResult || !caseFile.value?.assessments || !caseFile.value?.timeline) return null
  return buildObjectStatusCard(caseFile.value)
})

const trend = computed(() => {
  const assessments = caseFile.value?.assessments || []
  if (assessments.length < 2) return null
  // 约定：后端按 createdAt asc 返回，数组末尾是最新评估
  const previous = assessments[assessments.length - 2]
  const current = assessments[assessments.length - 1]
  return compareAssessments(previous, current)
})

const weeklyReview = computed(() => {
  if (!caseFile.value?.latestResult) return null
  const safeCase = {
    ...caseFile.value,
    timeline: caseFile.value.timeline || [],
    assessments: caseFile.value.assessments || [caseFile.value.latestResult]
  }
  return buildCaseWeeklyReview(safeCase)
})

const assessmentsList = computed(() => {
  return caseFile.value?.assessments || []
})

const triggerEvent = computed(() => {
  if (!result.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === result.value.triggerEventId) || null
})

const entertainmentInsight = computed(() => {
  if (!triggerEvent.value) return null
  return buildEventEntertainmentInsight({
    profile: caseFile.value?.profile,
    event: triggerEvent.value
  })
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
function mapAction(action?: string) {
  switch (action) {
    case 'observe': return '继续观察，不急着加码投入'
    case 'verify': return '先验证关键事实或承诺'
    case 'clarify': return '可以做一次低情绪、具体化确认'
    case 'pause': return '建议暂停推进，先拉开一点观察距离'
    case 'insufficient_data': return '当前样本不足，不建议下结论'
    default: return action || '继续观察'
  }
}

function mapFocusRank(index: number) {
  if (index === 0) return '主关注点'
  return `次关注点 ${index}`
}

function labelTone(score: number, inverse = false) {
  const effective = inverse ? 100 - score : score
  if (effective >= 75) return 'good'
  if (effective >= 45) return 'mid'
  return 'bad'
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

function goTimelineEvent(eventId: string) {
  uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId.value}&targetEventId=${encodeURIComponent(eventId)}` })
}

function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}

onLoad((options) => {
  caseId.value = options?.caseId || ''
  profileUpdated.value = options?.profileUpdated === '1'
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
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function goTimeline() { uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId.value}` }) }
function goReassess() { uni.navigateTo({ url: `/pages/reassess/reassess?caseId=${caseId.value}` }) }
function goEditProfile() { uni.navigateTo({ url: `/pages/edit-profile/edit-profile?caseId=${caseId.value}` }) }
function goAssessments() { uni.navigateTo({ url: `/pages/assessments/assessments?caseId=${caseId.value}` }) }

async function onDelete() {
  const ok = await confirm('删除后该对象的关系主页、时间线和评估历史都会一起移除。')
  if (!ok) return
  try {
    const res = await deleteCase(userId.value, caseId.value)
    if (res.success) {
      showSuccess('已删除')
      setTimeout(() => {
        uni.setStorageSync('casesDeletedFlag', '1')
        uni.switchTab({ url: '/pages/cases/cases' })
      }, 800)
    } else {
      showError(res.message || '删除失败')
    }
  } catch (e: any) {
    showError(e?.message || '删除失败')
  }
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
.entertainment-summary { display: block; font-size: 26rpx; color: #241b12; margin: 12rpx 0; }
.entertainment-label { display: block; font-size: 24rpx; font-weight: 600; color: #241b12; margin-bottom: 8rpx; }
.entertainment-text { display: block; font-size: 26rpx; color: #241b12; line-height: 1.6; }
</style>
