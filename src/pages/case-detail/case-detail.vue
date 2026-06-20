<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <view v-if="syncing" class="sync-bar"></view>
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else-if="!caseFile" class="empty-v2">
        <text class="empty-title-v2">结果不可用</text>
        <text class="empty-sub-v2">当前 Crush 不存在或已被删除。</text>
      </view>
      <template v-else>
        <view v-if="profileUpdated" class="notice-v2 ok"><text class="notice-title-v2">画像已更新</text><text class="notice-sub-v2">Crush 画像信息已保存。</text></view>
        <!-- Hero -->
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">WE / {{ caseFile.name }}</text>
          <text class="hero-title-v2">{{ result?.explanation?.petLine || result?.explanation?.bullets?.[0] || '暂无分析结果' }}</text>
          <text class="hero-copy-v2">AI 辅助分析 · 帮你梳理线索，不代表最终结论。</text>
          <view v-if="result" class="tag-row-v2" style="margin-top:16rpx;"><text class="tag-v2 black">最新 · {{ mapIntentLabel(result.intentBucket) }}</text><text class="tag-v2">风险 · {{ mapRiskLabel(result.riskBucket) }}</text><text class="tag-v2">证据 {{ result.evidenceLevel }}</text><text v-if="isCurrentResultAIReviewed" class="tag-v2 black">AI 分析</text></view>
        </view>
        <!-- 里程碑进度 -->
        <ProgressMilestone :count="timelineCount" />
        <!-- 补初评入口 -->
        <view v-if="!isCurrentResultAIReviewed" class="card-v2 anim-card" style="animation-delay:0.15s" @click="goNewAssessment">
          <text class="section-title-v2">还没有进行初评</text>
          <text class="remind-text-v2">回答几个问题，让小咪帮你看看有没有戏。点击前往 →</text>
        </view>
        <!-- Profile -->
        <view class="card-v2 anim-card" style="animation-delay:0.2s">
          <view class="card-head-v2">
            <view class="avatar-v2 lg"><image v-if="caseFile.profile?.avatar" :src="caseFile.profile.avatarUrl || caseFile.profile.avatar" mode="aspectFill" /><text v-else class="avatar-placeholder-v2">{{ avatarLabel(caseFile.name) }}</text></view>
            <view><text class="profile-name-v2">{{ caseFile.name }}</text><text v-if="objectTypeLabel" class="profile-type-v2">{{ objectTypeLabel }}</text></view>
          </view>
          <view v-if="profileItems.length > 0" class="tag-row-v2"><text v-for="item in profileItems" :key="item" class="tag-v2">{{ item }}</text></view>
        </view>
        <!-- 桃花匹配度入口（详情已搬至「命理桃花」页） -->
        <view class="card-v2 anim-card" style="animation-delay:0.22s;background:#FFFBEB;" @click="goTaohuaMatch">
          <text class="section-title-v2">桃花匹配度</text>
          <text class="weekly-desc-v2">查看你和 TA 的生肖星座匹配 + AI 深度解读 →</text>
        </view>

        <!-- ===== 新增板块 ===== -->

        <!-- 1. 关系雷达 -->
        <view class="card-v2 anim-card" style="animation-delay:0.23s">
          <view style="display:flex;align-items:center;gap:12rpx;">
            <text class="section-title-v2">关系雷达</text>
            <text class="info-dot-v2" @click="showSignalInfo = true">ⓘ</text>
          </view>
          <text class="section-sub-v2">五个维度看关系，不只盯意向和风险</text>
          <view v-if="showSignalInfo" class="info-overlay" @click="showSignalInfo = false">
            <view class="info-sheet" @click.stop>
              <view class="info-sheet-head">
                <text class="info-sheet-title">关系雷达 · 说明</text>
                <text class="info-sheet-close" @click="showSignalInfo = false">×</text>
              </view>
              <scroll-view scroll-y class="info-sheet-body">
                <view class="info-tree-item"><text class="info-tree-q">数据来源</text><text class="info-tree-a">全部基于结构化数据（timeline 事件标签 + assessments 趋势），不依赖 AI 主观打分。样本不足（&lt;3）时自动向 50 收敛，避免小样本误判。</text></view>
                <view class="info-tree-item"><text class="info-tree-q">主动性</text><text class="info-tree-a">50 + (TA主动 − 你主动) ÷ 总数 × 50。&gt;60 TA更主动，&lt;40 主要是你在推。</text></view>
                <view class="info-tree-item"><text class="info-tree-q">回应度</text><text class="info-tree-a">加权正向回应率：兑现+1，计划/承诺+0.7，待确认+0.45，拖延+0.2，拒绝/冷淡+0。÷ 总回应权重×100。</text></view>
                <view class="info-tree-item"><text class="info-tree-q">承诺度</text><text class="info-tree-a">(兑现×1 + 待确认×0.45 + 拖延×0.15) ÷ 承诺总数 × 100。专门衡量"说了算不算"。</text></view>
                <view class="info-tree-item"><text class="info-tree-q">情绪温度</text><text class="info-tree-a">50 + 最近意向变化×1.2 + 正向事件占比×25 − 风险事件占比×25。综合衡量关系走向。</text></view>
                <view class="info-tree-item"><text class="info-tree-q">稳定性</text><text class="info-tree-a">100 − 最近波动幅度×2.5。&gt;80走势稳定，50-80正常波动，&lt;50信号摇摆不宜下结论。</text></view>
              </scroll-view>
            </view>
          </view>
          <view v-for="d in radarDims" :key="d.key" class="radar-row-v2">
            <text class="radar-label-v2">{{ d.label }}</text>
            <view class="radar-bar-v2">
              <view class="radar-bar-fill-v2" :style="{ width: d.score + '%', background: d.color }"></view>
            </view>
            <text class="radar-desc-v2">{{ d.desc }}</text>
          </view>
          <view class="radar-meta-v2">
            <text>基于本月 {{ radarSampleCount }} 条事件</text>
            <text v-if="radarAssessmentCount > 0"> · {{ radarAssessmentCount }} 次分析</text>
            <text v-if="radarSampleCount === 0 && radarAssessmentCount > 0">（仅分析，暂无事件记录）</text>
            <text v-else-if="radarSampleCount < 3" class="radar-meta-warn-v2"> · 样本偏少，数据向中性收敛</text>
          </view>
        </view>

        <!-- Trends -->
        <view v-if="trendDataPanel" class="card-v2 anim-card" style="animation-delay:0.24s">
          <view class="trend-block-v2">
            <text class="section-title-v2">趋势数据 · 月度</text>
            <view class="trend-grid-v2">
              <view class="trend-item-v2"><view class="trend-item-row-v2"><text class="trend-num-v2">{{ trendDataPanel.latestIntent }}</text><text class="trend-chg-v2" :class="deltaClass(trendDataPanel.intentDelta14)">{{ formatSignedDelta(trendDataPanel.intentDelta14) }}</text></view><text class="trend-unit-v2">意向</text></view>
              <view class="trend-item-v2"><view class="trend-item-row-v2"><text class="trend-num-v2 risk">{{ trendDataPanel.latestRisk }}</text><text class="trend-chg-v2" :class="deltaClass(-trendDataPanel.riskDelta14)">{{ formatSignedDelta(trendDataPanel.riskDelta14) }}</text></view><text class="trend-unit-v2">风险</text></view>
              <view class="trend-item-v2"><text class="trend-num-v2">{{ trendDataPanel.stability }}%</text><text class="trend-unit-v2">稳定性 · {{ trendDataPanel.sampleCount }}次</text></view>
              <view class="trend-item-v2"><text class="trend-num-v2">{{ trendDataPanel.evidenceCount }}</text><text class="trend-unit-v2">证据量 · 月度</text></view>
            </view>
            <view v-if="trendDataPanel.tags.length" class="tag-row-v2" style="margin-top:12rpx;"><text v-for="tag in trendDataPanel.tags" :key="tag" class="tag-v2">{{ tag }}</text></view>
            <view v-if="trendDataPanel.lineChart.points.length > 1" class="relationship-line-chart-v2">
              <view class="line-legend-v2">
                <view class="line-legend-item-v2"><view class="line-legend-mark-v2 intent"></view><text>关系动能</text></view>
                <view class="line-legend-item-v2"><view class="line-legend-mark-v2 risk"></view><text>风险压力</text></view>
                <text class="line-legend-tip-v2">点击节点查看事件解读</text>
              </view>
              <scroll-view class="line-scroll-v2" scroll-x>
                <view class="line-canvas-v2" :style="{ width: trendDataPanel.lineChart.width + 'rpx' }">
                  <view class="line-grid-v2 top"><text>100</text></view>
                  <view class="line-grid-v2 middle"><text>50</text></view>
                  <view class="line-grid-v2 bottom"><text>0</text></view>
                  <view v-for="segment in trendDataPanel.lineChart.intentSegments" :key="segment.key" class="line-segment-v2 intent" :style="segment.style"></view>
                  <view v-for="segment in trendDataPanel.lineChart.riskSegments" :key="segment.key" class="line-segment-v2 risk" :style="segment.style"></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'intent-'+point.index" class="line-point-v2 intent" :style="{ left: point.x + 'rpx', top: point.intentY + 'rpx' }"><text>{{ point.intent }}</text></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'risk-'+point.index" class="line-point-v2 risk" :style="{ left: point.x + 'rpx', top: point.riskY + 'rpx' }"><text>{{ point.risk }}</text></view>
                  <view v-for="point in trendDataPanel.lineChart.points" :key="'label-'+point.index" class="line-x-label-v2" :style="{ left: point.x + 'rpx' }"><text class="line-x-index-v2">第 {{ point.index }} 次</text><text>{{ point.timeLabel }}</text></view>
                  <!-- 事件标记 -->
                  <view v-for="m in trajectoryMarkers" :key="'marker-'+m.index" class="trajectory-marker-v2" :class="'marker-'+m.type" :style="{ left: m.x + 'rpx', top: m.y + 'rpx' }" @click="selectedTrajectoryIdx = selectedTrajectoryIdx === m.index ? -1 : m.index">
                    <text class="trajectory-marker-icon-v2">{{ m.icon }}</text>
                  </view>
                </view>
              </scroll-view>
              <!-- 事件解读展开 -->
              <view v-if="selectedTrajectoryIdx >= 0" class="trajectory-detail-v2">
                <view class="trajectory-detail-head-v2">
                  <text class="trajectory-detail-label-v2">{{ trajectoryMarkers[selectedTrajectoryIdx]?.label || '事件' }}</text>
                  <text class="trajectory-detail-close-v2" @click="selectedTrajectoryIdx = -1">✕</text>
                </view>
                <text v-if="trajectoryMarkers[selectedTrajectoryIdx]?.event" class="trajectory-detail-title-v2">{{ trajectoryMarkers[selectedTrajectoryIdx].event.title }}</text>
                <text v-if="trajectoryMarkers[selectedTrajectoryIdx]?.event" class="trajectory-detail-desc-v2">{{ trajectoryMarkers[selectedTrajectoryIdx].event.description }}</text>
                <view v-if="trajectoryMarkers[selectedTrajectoryIdx]?.assessment" class="trajectory-detail-ai-v2">
                  <text class="trajectory-detail-ai-label-v2">AI 解读</text>
                  <text class="trajectory-detail-ai-text-v2">{{ trajectoryMarkers[selectedTrajectoryIdx].assessment.explanation?.petLine || trajectoryMarkers[selectedTrajectoryIdx].assessment.explanation?.headline || '暂无解读' }}</text>
                </view>
              </view>
            </view>
            <view v-if="trendDataPanel.turningPoints.length > 0" class="turning-v2"><text class="section-title-v2">关键拐点</text><view v-for="tp in trendDataPanel.turningPoints" :key="tp.key" class="turning-row-v2"><text class="turning-name-v2">{{ tp.title }}</text><view class="turning-deltas-v2"><text :class="['delta-chip-v2', deltaClass(tp.intentDelta)]">意 {{ formatSignedDelta(tp.intentDelta) }}</text><text :class="['delta-chip-v2', deltaClass(-tp.riskDelta)]">险 {{ formatSignedDelta(tp.riskDelta) }}</text></view></view></view>
          </view>
        </view>
        <!-- 信号解释卡 -->
        <view v-if="signalCards.length > 0" class="card-v2 anim-card" style="animation-delay:0.27s">
          <text class="section-title-v2">信号解释卡</text>
          <text class="section-sub-v2">本月最关键变化，每条附证据来源</text>
          <view v-for="card in signalCards" :key="card.type" class="signal-card-v2" :class="'signal-card-' + card.type">
            <view class="signal-card-head-v2">
              <text class="signal-card-icon-v2">{{ card.icon }}</text>
              <text class="signal-card-label-v2">{{ card.label }}</text>
            </view>
            <text class="signal-card-title-v2">{{ card.data.title }}</text>
            <text class="signal-card-detail-v2">{{ card.data.detail }}</text>
            <view class="signal-card-evidence-v2">
              <text class="signal-card-evidence-label-v2">证据来源</text>
              <text class="signal-card-evidence-text-v2">{{ card.data.evidence }}</text>
            </view>
          </view>
        </view>

        <!-- 场景气泡图 -->
        <view v-if="timelineCount > 0 && sceneBubbles.length > 0" class="card-v2 mint-card anim-card" style="animation-delay:0.29s">
          <view class="section-head-v2">
            <view>
              <text class="section-title-v2">场景分布</text>
              <text class="section-sub-v2">气泡越大，出现次数越多</text>
            </view>
            <text class="tag-v2 black">Top {{ sceneBubbles.length }}</text>
          </view>
          <view class="scene-chart-v2">
            <view class="scene-axis-h-v2"></view>
            <view class="scene-axis-v-v2"></view>
            <text class="scene-axis-label-v2 top">少</text>
            <text class="scene-axis-label-v2 bottom">多</text>
            <text class="scene-axis-label-v2 left">线下 / 关系推进</text>
            <text class="scene-axis-label-v2 right">线上 / 日常互动</text>
            <view v-for="b in sceneBubbles" :key="b.key" class="scene-bubble-v2" :class="b.tone" :style="{ left: b.x + 'rpx', top: b.y + 'rpx', width: b.size + 'rpx', height: b.size + 'rpx' }">
              <text class="scene-bubble-name-v2">{{ b.label }}</text>
              <text class="scene-bubble-count-v2">{{ b.count }}</text>
            </view>
          </view>
          <view class="scene-legend-v2">
            <text class="scene-legend-item-v2"><view class="scene-legend-dot-v2 mint"></view>高频</text>
            <text class="scene-legend-item-v2"><view class="scene-legend-dot-v2 yellow"></view>中频</text>
            <text class="scene-legend-item-v2"><view class="scene-legend-dot-v2 white"></view>低频</text>
          </view>
          <view class="scene-chips-v2">
            <text v-for="c in sceneChips" :key="c.key" class="scene-chip-v2" :class="c.tone">{{ c.label }} <text class="scene-chip-count-v2">{{ c.count }}</text></text>
          </view>
        </view>

        <!-- 互动天平 -->
        <view class="card-v2 cream-card anim-card" style="animation-delay:0.31s">
          <view class="section-head-v2">
            <view>
              <text class="section-title-v2">互动天平</text>
              <text class="section-sub-v2">中轴左边是你，右边是 TA</text>
            </view>
            <text class="tag-v2 black">本月</text>
          </view>
          <template v-if="timelineCount > 0">
            <view class="balance-summary-v2">
              <view class="balance-summary-cell-v2"><text class="balance-summary-num-v2">{{ thisMoStats.selfInitiatedCount }} : {{ thisMoStats.targetInitiatedCount }}</text><text class="balance-summary-lbl-v2">主动发起</text></view>
              <view class="balance-summary-cell-v2"><text class="balance-summary-num-v2">{{ thisMoStats.fulfilledCount }} : {{ thisMoStats.targetCommittedCount }}</text><text class="balance-summary-lbl-v2">回应接住</text></view>
              <view class="balance-summary-cell-v2"><text class="balance-summary-num-v2">{{ thisMoStats.fulfilledCount }} : {{ thisMoStats.targetCommittedCount }}</text><text class="balance-summary-lbl-v2">承诺兑现</text></view>
            </view>
            <view class="diverging-panel-v2">
              <view class="diverging-head-v2"><text>你</text><text>0</text><text>TA</text></view>
              <view v-for="b in divergingBars" :key="b.label" class="diverging-row-v2">
                <text class="diverging-label-v2">{{ b.label }}</text>
                <view class="diverging-bar-left-v2"><view class="diverging-fill-left-v2" :style="{ width: b.youPct + '%' }"></view></view>
                <text class="diverging-axis-v2">|</text>
                <view class="diverging-bar-right-v2" :class="b.taClass"><view class="diverging-fill-right-v2" :style="{ width: b.taPct + '%' }"></view></view>
                <text class="diverging-num-v2">{{ b.you }} / {{ b.ta }}</text>
              </view>
            </view>
            <view class="balance-callout-v2">
              <text>{{ balanceCallout }}</text>
            </view>
          </template>
          <view v-else class="empty-section-v2">
            <text class="empty-section-text-v2">暂无互动数据。记录互动事件后可生成天平。</text>
          </view>
        </view>

        <!-- 4. 机会/风险矩阵 -->
        <view class="card-v2 anim-card" style="animation-delay:0.31s">
          <text class="section-title-v2">机会 / 风险矩阵</text>
          <text class="section-sub-v2">把状态落到决策象限</text>
          <view class="matrix-grid-v2">
            <view :class="['matrix-cell-v2', matrixActive === 'high-low' ? 'active' : '']">
              <text class="matrix-cell-label-v2">高机会 · 低风险</text>
              <text class="matrix-cell-sub-v2">可以轻推</text>
              <view v-if="matrixActive === 'high-low'" class="matrix-dot-v2"></view>
            </view>
            <view :class="['matrix-cell-v2', matrixActive === 'high-high' ? 'active' : '']">
              <text class="matrix-cell-label-v2">高机会 · 高风险</text>
              <text class="matrix-cell-sub-v2">谨慎试探</text>
              <view v-if="matrixActive === 'high-high'" class="matrix-dot-v2"></view>
            </view>
            <view :class="['matrix-cell-v2', matrixActive === 'low-low' ? 'active' : '']">
              <text class="matrix-cell-label-v2">低机会 · 低风险</text>
              <text class="matrix-cell-sub-v2">继续观察</text>
              <view v-if="matrixActive === 'low-low'" class="matrix-dot-v2"></view>
            </view>
            <view :class="['matrix-cell-v2', matrixActive === 'low-high' ? 'active' : '']">
              <text class="matrix-cell-label-v2">低机会 · 高风险</text>
              <text class="matrix-cell-sub-v2">减少投入</text>
              <view v-if="matrixActive === 'low-high'" class="matrix-dot-v2"></view>
            </view>
          </view>
        </view>

        <!-- 6. 月度复盘全文 -->
        <view v-if="aiWeeklyPreview" class="card-v2 anim-card" style="animation-delay:0.33s">
          <text class="section-title-v2">月度复盘全文</text>
          <text class="section-sub-v2">详细报告下沉，按需阅读</text>
          <view class="full-review-v2">
            <text class="full-review-p-v2"><text class="full-review-bold-v2">本月关系整体状况：</text>{{ aiWeeklyPreview.summary }}</text>
            <text v-if="aiWeeklyPreview.keyChanges?.length" class="full-review-p-v2"><text class="full-review-bold-v2">关键变化：</text>{{ aiWeeklyPreview.keyChanges.join('；') }}</text>
            <text v-if="aiWeeklyPreview.keyEvents?.length" class="full-review-p-v2"><text class="full-review-bold-v2">关键事件：</text>{{ aiWeeklyPreview.keyEvents.join('；') }}</text>
            <text v-if="aiWeeklyPreview.avoidMisread?.length" class="full-review-p-v2"><text class="full-review-bold-v2">避免误读：</text>{{ aiWeeklyPreview.avoidMisread.join('；') }}</text>
            <view v-if="weeklyFocusItems.length > 0" class="focus-box-v2" style="margin-top:16rpx;">
              <text class="focus-label-v2">后续验证重点</text>
              <text class="focus-question-v2">{{ primaryWeeklyFocus }}</text>
              <view v-if="weeklyFocusItems.length > 1" class="bullet-list-v2" style="margin-top:8rpx;"><text v-for="item in weeklyFocusItems.slice(1)" :key="item" class="bullet-v2">• {{ item }}</text></view>
            </view>
          </view>
        </view>

        <!-- Bottom action -->
        <view class="bottom-action-v2">
          <button class="btn-v2-bottom" style="width:100%;" :disabled="reviewGenerating || (aiWeeklyPreview && !hasNewEventsSinceReview)" @click="generateThisMonthReview">{{ reviewGenerating ? '生成中...' : (aiWeeklyPreview ? '重新生成本月复盘' : '生成本月复盘') }}</button>
          <view v-if="reviewGenerating" class="action-box" style="margin-top:12rpx;">
            <text class="action-label">月度复盘 生成中...</text>
            <view class="ai-row"><view class="ai-dot"></view><text class="action-text muted">后台分析中，完成后将自动刷新</text></view>
          </view>
        </view>
      </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId, getMonthlyReviews, getCases, generateMonthlyReview, handleInsufficientBalance } from '@/utils/api'
import { bumpDataVersion, consumeActiveCaseProfileUpdated, getActiveCaseId, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import { buildCaseOverviewStats, buildFocusItems, buildObjectStatusCard, compareAssessments, buildTimelineStats, getTimelineRecordTags } from '@/utils/insights'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeTimelineShare, appendReferralParams, SAFE_SHARE_IMAGE } from '@/utils/share'
import ProgressMilestone from '@/components/ProgressMilestone.vue'

const loading = ref(true)
const syncing = ref(false)
const fontSizeMode = ref(getFontSizeMode())
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const profileUpdated = ref(false)
const showSignalInfo = ref(false)
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => {
  let path = caseId.value ? `/pages/case-detail/case-detail?caseId=${caseId.value}` : '/pages/case-detail/case-detail'
  path = appendReferralParams(path, 'we_card')
  return { title: `我和 ${caseFile.value?.name || 'TA'} 的关系分析`, path, imageUrl: SAFE_SHARE_IMAGE }
})

onShareTimeline(() => buildSafeTimelineShare())
const weeklyReviews = ref<any[]>([])
const currentMonthStart = ref('')
const initialized = ref(false)
const skipNextShowRefresh = ref(false)
const CASE_DETAIL_CACHE_PREFIX = 'caseDetailCache:v1:'
const RELATION_CHART_TOP = 44
const RELATION_CHART_HEIGHT = 260
const RELATION_CHART_LEFT = 72
const RELATION_CHART_GAP = 140
const RELATION_CHART_VISIBLE = 5

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
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
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

const trend = computed(() => {
  const assessments = caseFile.value?.assessments || []
  if (assessments.length < 2) return null
  // 约定：后端按 createdAt asc 返回，数组末尾是最新分析
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
  return {
    latestIntent,
    latestRisk,
    intentDelta14,
    riskDelta14,
    stability,
    sampleCount: recentAssessments.length,
    evidenceCount: countRecentEvidence(caseFile.value?.timeline || [], latestTime),
    tags: buildTrendDataTags(intentDelta14, riskDelta14, stability, recentAssessments.length),
    lineChart: buildRelationshipLineChart(recentAssessments),
    turningPoints: transitions
      .filter((item: any) => item.impact > 0)
      .sort((a: any, b: any) => b.impact - a.impact || b.time - a.time)
      .slice(0, 3)
  }
})

const weeklyPreview = computed(() => {
  if (!weeklyReviews.value.length) return null
  return weeklyReviews.value.find((item: any) => item.monthStart === currentMonthStart.value || item.weekStart === currentMonthStart.value) || weeklyReviews.value[0]
})

const aiWeeklyPreview = computed(() => {
  return weeklyPreview.value || null
})

const hasNewEventsSinceReview = computed(() => {
  const review = weeklyPreview.value
  if (!review) return true
  const timeline = caseFile.value?.timeline || []
  const latestEventTime = Math.max(0, ...timeline
    .filter((item: any) => {
      if (!item.occurrenceAt) return false
      if (['assessment', 'trend', 'weekly_review', 'monthly_review'].includes(item.type)) return false
      if (item.type === 'note' && item.feature === 'weeklySideRead') return false
      return true
    })
    .map((item: any) => new Date(item.occurrenceAt).getTime())
  )
  const reviewTime = review.generatedAt ? new Date(review.generatedAt).getTime() : 0
  return latestEventTime > reviewTime
})

const weeklyButtonLabel = computed(() => {
  const review = weeklyPreview.value
  if (!review) return '生成本月复盘'
  if (!hasNewEventsSinceReview.value) return '还没新事件'
  return '重新生成本月复盘'
})

const hasFallbackWeeklyPreview = computed(() => {
  return false
})

const weeklyFocusItems = computed(() => {
  return (weeklyPreview.value?.nextWeekFocus || [])
    .map((item: any) => String(item || '').trim())
    .filter(Boolean)
})

const primaryWeeklyFocus = computed(() => {
  return weeklyFocusItems.value[0] || ''
})

// ===== 关系雷达 =====
const signalData = computed(() => result.value?.signalSummary || null)
const radarSampleCount = computed(() => thisMoStats.value.totalCount)
const radarAssessmentCount = computed(() => trendDataPanel.value?.sampleCount || 0)

// 样本不足时向 50 收敛：score × 0.6 + 50 × 0.4
function confidenceAdjust(score, samples) {
  if (samples >= 3 || score === 50) return score
  return Math.round(score * 0.6 + 50 * 0.4)
}
function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))) }

// 1. 主动性：50 + (TA主动 - 你主动) / 总数 × 50
const radarInitiative = computed(() => {
  var t = thisMoStats.value.targetInitiatedCount
  var s = thisMoStats.value.selfInitiatedCount
  if (t + s === 0) return 50
  return clamp(50 + (t - s) / (t + s) * 50)
})

// 2. 回应度：加权正向回应 / 总回应权重 × 100
// 权重：fulfilled=1, planned=0.7, target_committed=0.7, pending=0.45, cancelled_delayed=0.2, rejected=0, cold=0
const radarResponsive = computed(() => {
  var recs = thisMonthRecs.value
  var weighted = 0, total = 0
  for (var i = 0; i < recs.length; i++) {
    var tags = getTimelineRecordTags(recs[i])
    if (tags.all.includes('fulfilled')) weighted += 1
    if (tags.all.includes('planned')) weighted += 0.7
    if (tags.all.includes('target_committed')) weighted += 0.7
    if (tags.all.includes('pending')) weighted += 0.45
    if (tags.all.includes('cancelled_delayed')) weighted += 0.2
    if (tags.all.includes('rejected')) weighted += 0
    if (tags.all.includes('cold')) weighted += 0
    var hasAny = tags.all.some(function(t) { return ['fulfilled','planned','target_committed','pending','cancelled_delayed','rejected','cold'].indexOf(t) >= 0 })
    if (hasAny) total += 1
  }
  if (total === 0) return 50
  return confidenceAdjust(clamp(weighted / total * 100), total)
})

// 3. 承诺度：(fulfilled×1 + pending×0.45 + cancelledDelayed×0.15) / total × 100
const radarCommitment = computed(() => {
  var f = thisMoStats.value.fulfilledCount
  var c = thisMoStats.value.cancelledDelayedCount
  // count pending tag separately
  var pending = 0
  for (var i = 0; i < thisMonthRecs.value.length; i++) {
    if (getTimelineRecordTags(thisMonthRecs.value[i]).all.includes('pending')) pending++
  }
  var total = f + pending + c
  if (total === 0) return 50
  var raw = (f * 1 + pending * 0.45 + c * 0.15) / total * 100
  return confidenceAdjust(clamp(raw), total)
})

// 4. 情绪温度：50 + intentDelta×1.2 + positiveRatio×25 - riskRatio×25
const radarTemperature = computed(() => {
  var delta = trendDataPanel.value?.intentDelta14 || 0
  var recs = thisMonthRecs.value
  var posCount = 0, riskCount = 0, totalTagged = 0
  for (var i = 0; i < recs.length; i++) {
    var tags = getTimelineRecordTags(recs[i]).all
    var isPos = tags.some(function(t) { return ['fulfilled','target_initiated','planned'].indexOf(t) >= 0 })
    var isRisk = tags.some(function(t) { return ['rejected','cancelled_delayed','cold','risk_event'].indexOf(t) >= 0 })
    if (isPos || isRisk) totalTagged++
    if (isPos) posCount++
    if (isRisk) riskCount++
  }
  var posRatio = totalTagged > 0 ? posCount / totalTagged : 0.5
  var riskRatio = totalTagged > 0 ? riskCount / totalTagged : 0.25
  return clamp(50 + delta * 1.2 + posRatio * 25 - riskRatio * 25)
})

// 5. 稳定性：100 - avgVolatility × 2.5（直接复用 trendDataPanel.stability 微调）
const radarStability = computed(() => {
  return trendDataPanel.value?.stability != null ? trendDataPanel.value.stability : 50
})

const radarDims = computed(() => {
  try {
    function desc(v) { if (v >= 70) return '强'; if (v >= 58) return '偏强'; if (v >= 43) return '中性'; if (v >= 30) return '偏弱'; return '弱' }
    function color(v) { if (v >= 58) return '#4ECDC4'; if (v >= 43) return '#FFD93D'; return '#FF6B6B' }
    return [
      { key: 'initiative',  label: '主动性',  score: radarInitiative.value,  desc: '谁更常发起互动 · ' + desc(radarInitiative.value),  color: color(radarInitiative.value) },
      { key: 'responsive',  label: '回应度',  score: radarResponsive.value,  desc: '对方是否接得住你的信号 · ' + desc(radarResponsive.value),  color: color(radarResponsive.value) },
      { key: 'commitment',  label: '承诺度',  score: radarCommitment.value,  desc: '说过的话有没有兑现 · ' + desc(radarCommitment.value),  color: color(radarCommitment.value) },
      { key: 'temperature', label: '情绪温度', score: radarTemperature.value, desc: '升温、平淡还是回避 · ' + desc(radarTemperature.value), color: color(radarTemperature.value) },
      { key: 'stability',   label: '稳定性',  score: radarStability.value,   desc: '最近波动大不大 · ' + desc(radarStability.value),   color: color(radarStability.value) },
    ]
  } catch(e) { console.warn('[radar]', e); return [] }
})

// ===== 信号解释卡 =====
const warmingSignal = computed(() => {
  var tps = trendDataPanel.value?.turningPoints || []
  var positive = tps.filter(function(tp) { return tp.intentDelta > 0 })
  if (positive.length === 0) return null
  positive.sort(function(a, b) { return b.impact - a.impact })
  var best = positive[0]
  return { title: best.title || '关系出现积极变化', detail: '本次意向 +' + best.intentDelta + '，属近期最显著的升温信号。', evidence: '分析节点：' + best.key }
})
const riskSignal2 = computed(() => {
  if (!riskFocusData.value) return null
  var f = riskFocusData.value
  return { title: f.label, detail: f.meaning, evidence: '承诺兑现率 ' + f.commitmentRatio }
})
const anomalySignal = computed(() => {
  var s = thisMoStats.value
  if (s.totalCount < 3) return null
  var initiativeGood = radarInitiative.value >= 55
  var commitmentBad = radarCommitment.value < 45
  if (initiativeGood && commitmentBad) {
    return { title: 'TA 更主动了，但兑现没跟上', detail: 'TA 本月主动 ' + s.targetInitiatedCount + ' 次，但承诺兑现率偏低。主动性可能是表面升温，建议继续观察后续行动。', evidence: 'TA 主动 ' + s.targetInitiatedCount + ' 次 · 兑现 ' + s.fulfilledCount + '/' + s.targetCommittedCount }
  }
  var stabilityLow = radarStability.value < 45
  var intentHigh = (trendDataPanel.value?.latestIntent || 0) >= 60
  if (stabilityLow && intentHigh) {
    return { title: '分数不错，但波动偏大', detail: '最近意向分较高但走势不稳定。单一高分不构成确认信号，建议等多几次分析再下判断。', evidence: '稳定性 ' + radarStability.value + ' · 意向 ' + (trendDataPanel.value?.latestIntent || 0) }
  }
  return null
})
const signalCards = computed(() => {
  var cards = []
  if (warmingSignal.value) cards.push({ type: 'warming', icon: '🔥', label: '升温信号', data: warmingSignal.value })
  if (riskSignal2.value) cards.push({ type: 'risk', icon: '⚠️', label: '风险信号', data: riskSignal2.value })
  if (anomalySignal.value) cards.push({ type: 'anomaly', icon: '🔍', label: '反常信号', data: anomalySignal.value })
  return cards
})

const riskFocusData = computed(() => {
  const items = focusItems.value
  if (!items || items.length === 0) return null
  const first = items[0]
  const stats = overviewStats.value
  const commitStat = stats.find((s: any) => s.key === 'commitmentDelivery')
  return {
    label: first.label || '承诺兑现',
    meaning: first.meaning || 'TA 的承诺中有部分尚未兑现，需要继续观察。',
    action: first.action || '下次关注对方是否主动确认具体时间和地点。',
    commitmentRatio: commitStat?.value || '--'
  }
})

// 机会/风险矩阵
const matrixActive = computed(() => {
  const intent = result.value?.intentScore
  const risk = result.value?.consistencyRiskScore
  if (intent == null || risk == null) return ''
  const i = Number(intent)
  const r = Number(risk)
  if (i >= 50 && r < 50) return 'high-low'
  if (i >= 50 && r >= 50) return 'high-high'
  if (i < 50 && r < 50) return 'low-low'
  return 'low-high'
})

// 互动画像
const timelineRecords = computed(() => caseFile.value?.timeline || [])
const timelineCount = computed(() => timelineRecords.value.length)
const timelineStats = computed(() => {
  const records = timelineRecords.value
  return records.length > 0 ? buildTimelineStats(records) : { totalCount: 0, offlineMeetCount: 0, movieCount: 0, mealCount: 0, coffeeTeaCount: 0, targetInitiatedCount: 0, selfInitiatedCount: 0, targetCommittedCount: 0, fulfilledCount: 0, rejectedCount: 0, cancelledDelayedCount: 0 }
})
const sceneSummary = computed(() => {
  const s = thisMoStats.value
  const parts: string[] = []
  if (s.mealCount) parts.push(`吃饭 ${s.mealCount}`)
  if (s.movieCount) parts.push(`电影 ${s.movieCount}`)
  if (s.coffeeTeaCount) parts.push(`咖啡 ${s.coffeeTeaCount}`)
  if (s.offlineMeetCount) parts.push(`见面 ${s.offlineMeetCount}`)
  return parts.join(' · ') || '暂无场景数据'
})
const behaviorSummary = computed(() => {
  const s = thisMoStats.value
  const parts: string[] = []
  if (s.targetInitiatedCount) parts.push(`TA 主动 ${s.targetInitiatedCount}`)
  if (s.selfInitiatedCount) parts.push(`你主动 ${s.selfInitiatedCount}`)
  return parts.join(' · ') || `${timelineCount.value} 条记录`
})
const outcomeSummary = computed(() => {
  const s = thisMoStats.value
  const parts: string[] = []
  if (s.fulfilledCount) parts.push(`已兑现 ${s.fulfilledCount}`)
  if (s.rejectedCount) parts.push(`被拒 ${s.rejectedCount}`)
  if (s.cancelledDelayedCount) parts.push(`取消/拖延 ${s.cancelledDelayedCount}`)
  return parts.join(' · ') || '暂无结果数据'
})

// 场景气泡图数据
const sceneTypeMap = { meal: '线下', movie: '线下', offline_meet: '线下', walk_shop: '线下', group_social: '线下', trip: '线下', coffee_tea: '线上', chat: '线上', phone_call: '线上', game: '线上', sport: '线下', shopping: '线下', study: '线上', work: '线上', music: '线上', pet: '线下', food: '线下', travel: '线下' }
const sceneLabelMap = { meal: '吃饭', movie: '电影', offline_meet: '见面', walk_shop: '散步', group_social: '朋友局', trip: '旅行', coffee_tea: '咖啡', chat: '聊天', phone_call: '电话', game: '游戏', sport: '运动', shopping: '逛街', study: '学习', work: '工作', music: '音乐', pet: '宠物', food: '美食', travel: '出行' }
const sceneSlots = [
  { key: 'chat', x: 72, y: 42, label: '聊天' },
  { key: 'meal', x: 20, y: 80, label: '吃饭' },
  { key: 'movie', x: 170, y: 88, label: '电影' },
  { key: 'coffee', x: 50, y: 150, label: '咖啡' },
  { key: 'walk', x: 130, y: 158, label: '散步' },
  { key: 'group', x: 210, y: 162, label: '朋友局' },
  { key: 'trip', x: 236, y: 40, label: '旅行' },
]
const sceneBubbles = computed(() => {
  var s = thisMoStats.value
  var items = [
    { key: 'meal', label: '吃饭', count: s.mealCount, type: '线下' },
    { key: 'movie', label: '电影', count: s.movieCount, type: '线下' },
    { key: 'coffee', label: '咖啡', count: s.coffeeTeaCount, type: '线上' },
    { key: 'meet', label: '见面', count: s.offlineMeetCount, type: '线下' },
    { key: 'chat', label: '聊天', count: 0, type: '线上' }, // chat tag count not in buildTimelineStats
  ].filter(function(t) { return t.count > 0 })
  // 额外场景：遍历本月事件，统计 chat/walk/group/trip 标签
  var extra = {}
  for (var i = 0; i < thisMonthRecs.value.length; i++) {
    var tags = getTimelineRecordTags(thisMonthRecs.value[i])
    for (var j = 0; j < tags.scene.length; j++) {
      var k = tags.scene[j]
      if (['meal','movie','coffee_tea','offline_meet'].indexOf(k) >= 0) continue
      extra[k] = (extra[k] || 0) + 1
    }
  }
  var extraItems = Object.keys(extra).map(function(k) { return { key: k, label: sceneLabelMap[k] || k, count: extra[k], type: sceneTypeMap[k] || '线下' } }).filter(function(t) { return t.count > 0 })
  var allItems = items.concat(extraItems).sort(function(a, b) { return b.count - a.count }).slice(0, 7)
  if (allItems.length === 0) return []
  var maxCount = allItems[0].count
  var minCount = allItems[allItems.length - 1].count
  return allItems.map(function(t, i) {
    var slot = sceneSlots[i] || { x: 20 + i * 50, y: 100 + (i % 3) * 60 }
    var size = 44 + Math.round((t.count / maxCount) * 74)
    var tone = t.count >= maxCount * 0.7 ? 'hot' : t.count >= minCount + (maxCount - minCount) * 0.5 ? 'mid' : 'cool'
    return { key: t.key, label: t.label, count: t.count, size: size, x: slot.x, y: slot.y, tone: tone }
  })
})
const sceneChips = computed(() => sceneBubbles.value.map(function(b) { return { key: b.key, label: b.label, count: b.count, tone: b.tone } }))

// 标签分布分组数据（旧，保留兼容）
const tagSceneItems = computed(() => {
  var s = thisMoStats.value; var max = Math.max(s.mealCount, s.movieCount, s.coffeeTeaCount, s.offlineMeetCount, 1)
  return [
    { key: 'meal', label: '吃饭', count: s.mealCount, pct: Math.round(s.mealCount/max*100) },
    { key: 'movie', label: '电影', count: s.movieCount, pct: Math.round(s.movieCount/max*100) },
    { key: 'coffee', label: '咖啡', count: s.coffeeTeaCount, pct: Math.round(s.coffeeTeaCount/max*100) },
    { key: 'meet', label: '见面', count: s.offlineMeetCount, pct: Math.round(s.offlineMeetCount/max*100) },
  ].filter(function(t) { return t.count > 0 })
})
const tagBehaviorItems = computed(() => {
  var s = thisMoStats.value; var max = Math.max(s.targetInitiatedCount, s.selfInitiatedCount, 1)
  return [
    { key: 'ta', label: 'TA主动', count: s.targetInitiatedCount, pct: Math.round(s.targetInitiatedCount/max*100), barClass: 'mint' },
    { key: 'self', label: '你主动', count: s.selfInitiatedCount, pct: Math.round(s.selfInitiatedCount/max*100), barClass: '' },
  ].filter(function(t) { return t.count > 0 })
})
const tagOutcomeItems = computed(() => {
  var s = thisMoStats.value; var max = Math.max(s.fulfilledCount, s.cancelledDelayedCount, s.rejectedCount, 1)
  return [
    { key: 'done', label: '兑现', count: s.fulfilledCount, pct: Math.round(s.fulfilledCount/max*100), barClass: 'mint' },
    { key: 'cancel', label: '拖延', count: s.cancelledDelayedCount, pct: Math.round(s.cancelledDelayedCount/max*100), barClass: 'risk' },
    { key: 'reject', label: '拒绝', count: s.rejectedCount, pct: Math.round(s.rejectedCount/max*100), barClass: 'risk' },
  ].filter(function(t) { return t.count > 0 })
})

// ===== 互动天平 =====
function getRecordTs(r) { return new Date(r?.occurrenceAt || r?.createdAt || r?.date || 0).getTime() }
const thisMonthRecs = computed(() => {
  var now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return timelineRecords.value.filter(function(r) { return getRecordTs(r) >= start })
})
const lastMonthRecs = computed(() => {
  var now = new Date(), start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  var end = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return timelineRecords.value.filter(function(r) { var t = getRecordTs(r); return t >= start && t < end })
})
const thisMoStats = computed(() => buildTimelineStats(thisMonthRecs.value))
const lastMoStats = computed(() => buildTimelineStats(lastMonthRecs.value))
const taInitiativeRatio = computed(() => {
  var t = thisMoStats.value.targetInitiatedCount, s = thisMoStats.value.selfInitiatedCount
  if (t + s === 0) return null
  return Math.round(t / (t + s) * 100)
})
const taRatioChange = computed(() => {
  if (taInitiativeRatio.value == null) return null
  var p = lastMoStats.value, pt = p.targetInitiatedCount, ps = p.selfInitiatedCount
  if (pt + ps === 0) return null
  return taInitiativeRatio.value - Math.round(pt / (pt + ps) * 100)
})
const fulfillStats = computed(() => ({
  committed: thisMoStats.value.targetCommittedCount,
  fulfilled: thisMoStats.value.fulfilledCount,
  broken: thisMoStats.value.cancelledDelayedCount + thisMoStats.value.rejectedCount
}))
// 发散条形图数据（你｜TA）
const divergingBars = computed(() => {
  var s = thisMoStats.value
  var maxVal = Math.max(s.selfInitiatedCount, s.targetInitiatedCount, s.fulfilledCount, s.targetCommittedCount, s.cancelledDelayedCount + s.rejectedCount, 1)
  function pct(v) { return Math.round(v / maxVal * 100) }
  return [
    { label: '主动', you: s.selfInitiatedCount, ta: s.targetInitiatedCount, youPct: pct(s.selfInitiatedCount), taPct: pct(s.targetInitiatedCount), taClass: '' },
    { label: '回应', you: s.fulfilledCount, ta: s.targetCommittedCount, youPct: pct(s.fulfilledCount), taPct: pct(s.targetCommittedCount), taClass: '' },
    { label: '兑现', you: s.fulfilledCount, ta: s.targetCommittedCount, youPct: pct(s.fulfilledCount), taPct: pct(s.targetCommittedCount), taClass: '' },
    { label: '受阻', you: s.rejectedCount, ta: s.cancelledDelayedCount, youPct: pct(s.rejectedCount), taPct: pct(s.cancelledDelayedCount), taClass: 'risk' },
  ]
})
const balanceCallout = computed(() => {
  var s = thisMoStats.value
  var t = s.targetInitiatedCount, f = s.fulfilledCount, c = s.targetCommittedCount
  if (t + s.selfInitiatedCount === 0) return '暂无足够互动数据形成判断。'
  var parts = []
  if (t > s.selfInitiatedCount) parts.push('TA 的主动性更强')
  else if (t < s.selfInitiatedCount) parts.push('你更主动')
  else parts.push('双方主动性持平')
  var ratio = c > 0 ? f + '/' + c : '--'
  if (c > 0 && f < c) parts.push('承诺兑现率 ' + ratio + '，兑现落后于承诺')
  else if (c > 0) parts.push('承诺兑现率 ' + ratio + '，兑现尚可')
  if (s.cancelledDelayedCount > 0) parts.push('存在拖延/取消信号')
  parts.push('下一步重点观察是否主动确认时间地点。')
  return parts.join('，')
})

const balanceConclusion = computed(() => {
  var r = taInitiativeRatio.value, f = fulfillStats.value, parts = []
  if (r != null) {
    if (r >= 55) parts.push('TA 主动性占优')
    else if (r >= 40) parts.push('双方主动性接近')
    else parts.push('目前你更主动')
  }
  if (f.committed > 0) {
    var rate = Math.round(f.fulfilled / f.committed * 100)
    if (rate >= 70) parts.push('兑现率良好（' + rate + '%）')
    else if (rate >= 40) parts.push('兑现需继续观察（' + rate + '%）')
    else parts.push('兑现偏弱（' + rate + '%）')
  } else { parts.push('暂无承诺记录') }
  return parts.join('，') + '。'
})

const triggerEvent = computed(() => {
  if (!result.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === result.value.triggerEventId) || null
})

const isCurrentResultAIReviewed = computed(() => {
  return Boolean(
    triggerEvent.value?.aiUsed ||
    String(result.value?.explanation?.headline || '').startsWith('AI 分析后：') ||
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

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '分析'
  }
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
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

const lastDataVersion = ref(0)

onShow(() => {
  const _t0 = Date.now()
  console.log('[PERF] case-detail onShow start')
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
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dv > lastDataVersion.value) { lastDataVersion.value = dv; loadData({ silent: true }) }
  console.log('[PERF] case-detail onShow end', Date.now() - _t0, 'ms')
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
  if (!caseFile.value && caseId.value) {
    const cached = readCaseDetailCache(uid, caseId.value)
    if (cached) {
      caseFile.value = cached
      loading.value = false
    }
  }
  if (!caseFile.value) {
    loading.value = true
  } else {
    syncing.value = true
  }
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      caseFile.value = null
      return
    }
    setActiveCaseId(caseId.value)
    const detail = await getCaseDetail(uid, caseId.value)
    caseFile.value = detail
    writeCaseDetailCache(uid, caseId.value, detail)
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
    loadWeeklyReviewsInBackground(uid)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
    syncing.value = false
  }
}

function readCaseDetailCache(uid: string, id: string) {
  try {
    const cached = uni.getStorageSync(`${CASE_DETAIL_CACHE_PREFIX}${uid}:${id}`)
    return cached && cached.caseFile ? cached.caseFile : null
  } catch {
    return null
  }
}

function writeCaseDetailCache(uid: string, id: string, detail: any) {
  try {
    uni.setStorageSync(`${CASE_DETAIL_CACHE_PREFIX}${uid}:${id}`, {
      cachedAt: Date.now(),
      caseFile: detail
    })
  } catch {}
}

async function loadWeeklyReviewsInBackground(uid: string) {
  try {
    const monthlyRes = await getMonthlyReviews(uid, caseId.value)
    weeklyReviews.value = monthlyRes.reviews || []
    currentMonthStart.value = monthlyRes.currentMonthStart || ''
  } catch (error) {
    console.warn('[page:case-detail] load weekly reviews failed:', error)
  }
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}

function goNewAssessment() {
  setActiveCaseId(caseId.value)
  uni.navigateTo({ url: '/pages/reassess/reassess?caseId=' + caseId.value })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
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

function buildRelationshipLineChart(assessments: any[]) {
  const source = [...(assessments || [])].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
  const points = source.map((item: any, index: number) => {
    const x = RELATION_CHART_LEFT + index * RELATION_CHART_GAP
    const intent = clampScore(item.intentScore)
    const risk = clampScore(item.consistencyRiskScore)
    return {
      index: index + 1,
      x,
      intent,
      risk,
      intentY: scoreToLineY(intent),
      riskY: scoreToLineY(risk),
      timeLabel: formatChartTime(item.createdAt)
    }
  })
  const width = Math.max(
    680,
    RELATION_CHART_LEFT * 2 + Math.max(points.length - 1, RELATION_CHART_VISIBLE - 1) * RELATION_CHART_GAP
  )
  return {
    width,
    scrollLeft: points.length <= RELATION_CHART_VISIBLE ? 0 : width,
    points,
    intentSegments: buildLineSegments('intent', points.map((point: any) => ({ x: point.x, y: point.intentY }))),
    riskSegments: buildLineSegments('risk', points.map((point: any) => ({ x: point.x, y: point.riskY })))
  }
}

function scoreToLineY(score: number) {
  return RELATION_CHART_TOP + RELATION_CHART_HEIGHT - (score / 100) * RELATION_CHART_HEIGHT
}

function buildLineSegments(prefix: string, source: Array<{ x: number; y: number }>) {
  const segments: Array<{ key: string; style: Record<string, string> }> = []
  for (let index = 0; index < source.length - 1; index += 1) {
    const from = source[index]
    const to = source[index + 1]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    segments.push({
      key: `${prefix}-${index}`,
      style: {
        left: `${from.x}rpx`,
        top: `${from.y}rpx`,
        width: `${length}rpx`,
        transform: `rotate(${angle}deg)`
      }
    })
  }
  return segments
}

// 关系轨迹图：事件标记
const selectedTrajectoryIdx = ref(-1)
const trajectoryMarkers = computed(() => {
  var assessments = assessmentsList.value
  var timeline = caseFile.value?.timeline || []
  return (trendDataPanel.value?.lineChart?.points || []).map(function(p, i) {
    var assess = assessments[i]
    var eventId = assess?.triggerEventId
    var event = eventId ? timeline.find(function(e) { return (e.id || e._id) === eventId }) : null
    var type = 'other', icon = '⬤', label = '分析'
    if (event) {
      var tags = event.semanticTags || getTimelineRecordTags(event)
      var all = tags.all || tags.scene || []
      if (all.indexOf('offline_meet') >= 0 || all.indexOf('movie') >= 0 || all.indexOf('meal') >= 0) { type = 'meet'; icon = '👥'; label = '见面' }
      else if (all.indexOf('cold') >= 0 || all.indexOf('rejected') >= 0) { type = 'cold'; icon = '❄️'; label = '冷淡' }
      else if (all.indexOf('target_committed') >= 0 || all.indexOf('planned') >= 0) { type = 'commit'; icon = '🤝'; label = '承诺' }
      else if (all.indexOf('cancelled_delayed') >= 0) { type = 'cancel'; icon = '✕'; label = '取消' }
      else if (all.indexOf('target_initiated') >= 0) { type = 'flirt'; icon = '💕'; label = '暧昧' }
    }
    return { index: i, x: p.x, y: p.intentY - 32, type: type, icon: icon, label: label, event: event, assessment: assess }
  })
})

function formatChartTime(createdAt?: string) {
  if (!createdAt) return '时间未说明'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return '时间未说明'
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`
}


function buildTrendDataTags(intentDelta: number, riskDelta: number, stability: number, sampleCount: number) {
  const tags: string[] = []
  if (intentDelta >= 8) tags.push('月度意向上行')
  else if (intentDelta <= -8) tags.push('月度意向回落')
  else tags.push('月度意向平稳')

  if (riskDelta <= -6) tags.push('月度风险回落')
  else if (riskDelta >= 6) tags.push('月度风险抬头')
  else tags.push('月度风险平稳')

  if (stability >= 76) tags.push('波动偏低')
  else if (stability >= 52) tags.push('波动中等')
  else tags.push('波动偏高')

  tags.push(sampleCount >= 4 ? '样本充足' : '样本偏少')
  return tags
}

function mapWeeklyTrendLabel(label: any) {
  const normalized = String(label || '').trim()
  const map: Record<string, string> = {
    持续向好: '本月回暖',
    持续走低: '本月转弱',
    风险抬头: '本月承压',
    基本平稳: '本月平稳',
    稳定观察: '本月观察',
    升温期: '本月回暖',
    升温中: '本月回暖',
    走弱期: '本月转弱',
    暂时平稳: '本月平稳'
  }
  return map[normalized] || (normalized ? `本月${normalized.replace(/^本月/, '')}` : '本月复盘')
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

function formatDelta(value: any) {
  const numeric = Number(value || 0)
  if (numeric > 0) return `+${numeric}`
  if (numeric < 0) return String(numeric)
  return '持平'
}

// 桃花匹配度入口 → 跳转「命理桃花」页（带 caseId）
function goTaohuaMatch() {
  if (caseId.value) setActiveCaseId(caseId.value)
  uni.navigateTo({ url: '/pages/taohua/taohua?caseId=' + caseId.value })
}

// Inline review generation
const reviewGenerating = ref(false)

async function generateThisMonthReview() {
  if (reviewGenerating.value) return
  reviewGenerating.value = true
  try {
    const res = await generateMonthlyReview(userId.value, caseId.value)
    weeklyReviews.value = res.reviews || []
    currentMonthStart.value = res.currentMonthStart || ''
    bumpDataVersion()
    showSuccess('本月复盘已生成')
  } catch (error: any) {
    if (handleInsufficientBalance(error)) return
    showError(error?.message || '生成失败')
  } finally { reviewGenerating.value = false }
}
</script>

<style scoped lang="scss">
@import '@/styles/typography.scss';
@import '@/styles/campus-pop.scss';

.page {
  min-height: 100vh;
  background: linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx), var(--app-bg, #f6f1e8);
  padding: var(--spacing-page, 28rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 26rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; }
.v2-mode .empty-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; border-left: 12rpx solid #4ECDC4; }
.v2-mode .notice-v2.warn { background: #FFEEEC; border-left: 12rpx solid #FF6B6B; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .tag-row-v2 { @include tag-row-v2; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { @include tag-v2-black; }

.v2-mode .profile-block-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .profile-head-v2 { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; padding-bottom: 16rpx; border-bottom: 3rpx solid #111; }
.v2-mode .avatar-v2 { width: 68rpx; height: 68rpx; border-radius: 50%; overflow: hidden; border: 3rpx solid #111; background: #FFD93D; display: flex; align-items: center; justify-content: center; }
.v2-mode .avatar-v2.lg { width: 88rpx; height: 88rpx; }
.v2-mode .avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .profile-name-v2 { display: block; font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .profile-type-v2 { display: block; font-size: 20rpx; font-weight: 700; color: #FF5252; margin-top: 2rpx; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-top: 16rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-box-v2.warn { background: #FFF0EE; }
.v2-mode .stat-num-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 2rpx; }
.v2-mode .stat-hint-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 2rpx; }

.v2-mode .section-title-v2 { @include section-title-v2; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .remind-text-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .trend-block-v2 { margin-top: 18rpx; }
.v2-mode .trend-grid-v2 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8rpx; }
.v2-mode .trend-item-v2 { padding: 14rpx 10rpx; border: 2rpx solid #111; text-align: center; background: #fff; }
.v2-mode .stats-compact-v2 { margin-top: 0; }
.v2-mode .trend-item-row-v2 { display: flex; align-items: baseline; justify-content: center; gap: 6rpx; }
.v2-mode .trend-num-v2 { display: block; font-size: 32rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .trend-num-v2.risk { color: #FF5252; }
.v2-mode .trend-chg-v2 { font-size: 18rpx; font-weight: 800; }
.v2-mode .trend-chg-v2.positive { color: #4ECDC4; }
.v2-mode .trend-chg-v2.negative { color: #FF5252; }
.v2-mode .trend-chg-v2.flat { color: #999; }
.v2-mode .trend-unit-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; }

.v2-mode .weekly-block-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .weekly-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; line-height: 1.3; margin-bottom: 8rpx; }
.v2-mode .weekly-desc-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.6; }
.v2-mode .bullet-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .focus-box-v2 { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .focus-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .focus-question-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-top: 6rpx; line-height: 1.4; }

.v2-mode .side-block-v2 { padding: 20rpx; border: 2rpx dashed #111; background: #FFFBEB; margin-bottom: 24rpx; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .card-head-v2 { display: flex; align-items: center; gap: 16rpx; padding-bottom: 16rpx; border-bottom: 3rpx solid #111; margin-bottom: 14rpx; }

.v2-mode .bullet-list-v2 { margin-top: 10rpx; }
.v2-mode .bullet-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 4rpx; }

.v2-mode .relationship-line-chart-v2 { margin-top: 16rpx; }
.v2-mode .line-legend-v2 { display: flex; align-items: center; flex-wrap: wrap; gap: 14rpx; margin-bottom: 12rpx; }
.v2-mode .line-legend-item-v2 { display: flex; align-items: center; gap: 8rpx; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .line-legend-mark-v2 { width: 34rpx; height: 5rpx; border-radius: 999rpx; background: #111; }
.v2-mode .line-legend-mark-v2.risk { background: #FF5252; }
.v2-mode .line-legend-tip-v2 { font-size: 20rpx; font-weight: 700; color: #999; }
.v2-mode .line-scroll-v2 { width: 100%; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .line-canvas-v2 { position: relative; height: 410rpx; box-sizing: border-box; }
.v2-mode .line-grid-v2 { position: absolute; left: 34rpx; right: 28rpx; height: 1rpx; background: rgba(0,0,0,0.06); }
.v2-mode .line-grid-v2 text { position: absolute; left: -4rpx; top: -18rpx; transform: translateX(-100%); color: #888; font-size: 18rpx; font-weight: 700; }
.v2-mode .line-grid-v2.top { top: 44rpx; }
.v2-mode .line-grid-v2.middle { top: 174rpx; }
.v2-mode .line-grid-v2.bottom { top: 304rpx; }
.v2-mode .line-segment-v2 { position: absolute; height: 3rpx; border-radius: 999rpx; transform-origin: 0 50%; background: #111; }
.v2-mode .line-segment-v2.risk { background: #FF5252; }
.v2-mode .line-point-v2 { position: absolute; width: 12rpx; height: 12rpx; margin-left: -6rpx; margin-top: -6rpx; border-radius: 50%; border: 3rpx solid #fff; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: #111; }
.v2-mode .line-point-v2.risk { background: #FF5252; }
.v2-mode .line-point-v2 text { position: absolute; top: -16rpx; color: #111; font-size: 18rpx; font-weight: 900; }
.v2-mode .line-point-v2.risk text { top: 12rpx; color: #FF5252; }
.v2-mode .line-x-label-v2 { position: absolute; top: 330rpx; width: 116rpx; margin-left: -58rpx; text-align: center; }
.v2-mode .line-x-label-v2 text { display: block; color: #999; font-size: 18rpx; line-height: 1.3; font-weight: 600; }
.v2-mode .line-x-index-v2 { color: #111 !important; font-weight: 900 !important; }

/* Trajectory Markers */
.v2-mode .trajectory-marker-v2 { position: absolute; width: 20rpx; height: 20rpx; margin-left: -10rpx; margin-top: -10rpx; display: flex; align-items: center; justify-content: center; z-index: 2; }
.v2-mode .trajectory-marker-icon-v2 { font-size: 18rpx; }
.v2-mode .trajectory-detail-v2 { margin-top: 16rpx; padding: 20rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .trajectory-detail-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.v2-mode .trajectory-detail-label-v2 { font-size: 20rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .trajectory-detail-close-v2 { font-size: 24rpx; font-weight: 900; color: #999; padding: 4rpx 8rpx; }
.v2-mode .trajectory-detail-title-v2 { display: block; font-size: 24rpx; font-weight: 900; color: #111; line-height: 1.35; }
.v2-mode .trajectory-detail-desc-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.5; margin-top: 6rpx; }
.v2-mode .trajectory-detail-ai-v2 { margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx dashed rgba(0,0,0,0.15); }
.v2-mode .trajectory-detail-ai-label-v2 { display: block; font-size: 18rpx; font-weight: 800; color: #4ECDC4; margin-bottom: 4rpx; }
.v2-mode .trajectory-detail-ai-text-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.5; }

.v2-mode .turning-row-v2 { display: flex; align-items: center; justify-content: space-between; padding: 6rpx 0; }
.v2-mode .turning-name-v2 { font-size: 20rpx; font-weight: 600; color: #111; line-height: 1.5; }
.v2-mode .turning-deltas-v2 { display: flex; gap: 6rpx; }
.v2-mode .delta-chip-v2 { padding: 2rpx 8rpx; border: 1rpx solid #111; font-size: 18rpx; font-weight: 700; }
.v2-mode .delta-chip-v2.positive { background: #E0FFF0; color: #0F6B45; }
.v2-mode .delta-chip-v2.negative { background: #FFEEEC; color: #FF5252; }
.v2-mode .delta-chip-v2.flat { background: #f9f9f9; color: #999; }

.v2-mode .side-grid-v2 { display: flex; flex-direction: column; gap: 10rpx; margin-top: 12rpx; }
.v2-mode .side-item-v2 { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .side-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 4rpx; }
.v2-mode .side-text-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.5; }
.v2-mode .tag-v2.green { background: #4ECDC4; color: #111; }
.v2-mode .tag-v2.ylw { background: #FFD93D; color: #111; }
.v2-mode .tag-v2.red { background: #FF5252; color: #fff; }
.v2-mode .tag-v2.sm { min-height: 28rpx; padding: 2rpx 10rpx; font-size: 18rpx; }

.v2-mode .bottom-action-v2 { text-align: center; margin-bottom: 24rpx; padding: 0 28rpx; }
.v2-mode .btn-v2-bottom { display: block; width: 100%; height: 72rpx; line-height: 72rpx; background: #4ECDC4; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-bottom[disabled] { opacity: 0.5; box-shadow: none; }
.sync-bar { position: fixed; top: 0; left: 0; height: 3rpx; z-index: 9999; background: linear-gradient(90deg, transparent, #FF6B6B, transparent); animation: sync-slide 0.8s ease-in-out infinite; }
@keyframes sync-slide {
  0% { width: 30%; left: -30%; }
  100% { width: 30%; left: 130%; }
}
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }
.v2-mode .action-box { margin-top: 12rpx; padding: 14rpx; border: 2rpx dashed #111; background: #f5f5ff; }
.v2-mode .action-label { display: block; font-size: 20rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .action-text { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; }
.v2-mode .ai-row { display: flex; align-items: center; gap: 14rpx; }
.v2-mode .ai-dot { width: 20rpx; height: 20rpx; border: 2rpx solid #111; background: #FFD93D; display: inline-block; animation: blink-dot 1s ease-in-out infinite; }
@keyframes blink-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.75); }
}

/* ===== 新增板块样式 ===== */

/* Section subtitle */
.v2-mode .section-sub-v2 { @include section-sub-v2; margin-bottom: 16rpx; }

/* Radar 关系雷达 */
.v2-mode .radar-row-v2 { display: flex; align-items: center; gap: 14rpx; margin-top: 16rpx; }
.v2-mode .radar-label-v2 { width: 96rpx; font-size: 20rpx; font-weight: 900; color: #111; flex-shrink: 0; }
.v2-mode .radar-bar-v2 { flex: 1; height: 22rpx; border: 2rpx solid #111; background: #f5f5f5; }
.v2-mode .radar-bar-fill-v2 { height: 100%; min-width: 4rpx; }
.v2-mode .radar-desc-v2 { width: 190rpx; font-size: 20rpx; font-weight: 600; color: #666; flex-shrink: 0; text-align: right; }
.v2-mode .radar-meta-v2 { margin-top: 20rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(0,0,0,0.08); font-size: 20rpx; font-weight: 600; color: #999; }
.v2-mode .radar-meta-warn-v2 { color: #FF6B6B; }

/* Empty section */
.v2-mode .empty-section-v2 { padding: 24rpx; text-align: center; }
.v2-mode .empty-section-text-v2 { font-size: 20rpx; font-weight: 600; color: #999; line-height: 1.5; }

/* Risk Focus */
.v2-mode .risk-layout-v2 { display: flex; gap: 16rpx; }
.v2-mode .risk-meter-v2 { min-width: 140rpx; min-height: 160rpx; border: 2rpx solid #111; background: #fff; padding: 20rpx 16rpx; display: flex; flex-direction: column; justify-content: space-between; }
.v2-mode .risk-meter-num-v2 { display: block; font-size: 40rpx; line-height: 1; font-weight: 900; color: #FF5252; }
.v2-mode .risk-meter-lbl-v2 { display: block; font-size: 18rpx; font-weight: 800; color: #999; line-height: 1.3; white-space: pre-line; }
.v2-mode .risk-text-v2 { flex: 1; border: 2rpx solid #111; background: #fff; padding: 20rpx; }
.v2-mode .risk-text-title-v2 { display: block; font-size: 24rpx; line-height: 1.35; font-weight: 900; color: #111; }
.v2-mode .risk-text-desc-v2 { display: block; margin-top: 10rpx; font-size: 20rpx; line-height: 1.5; font-weight: 600; color: #666; }


/* Matrix */
.v2-mode .matrix-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; border: 2rpx solid #111; background: #111; gap: 2px; }
.v2-mode .matrix-cell-v2 { min-height: 110rpx; background: #fff; padding: 16rpx; position: relative; }
.v2-mode .matrix-cell-v2.active { background: #FFD93D; }
.v2-mode .matrix-cell-label-v2 { display: block; font-size: 20rpx; line-height: 1.3; font-weight: 900; color: #111; }
.v2-mode .matrix-cell-sub-v2 { display: block; margin-top: 6rpx; font-size: 18rpx; font-weight: 700; color: #999; }
.v2-mode .matrix-dot-v2 { position: absolute; right: 14rpx; bottom: 14rpx; width: 22rpx; height: 22rpx; border: 2rpx solid #111; background: #FF5252; border-radius: 50%; }

/* Signal Cards 信号解释卡 */
.v2-mode .signal-card-v2 { padding: 18rpx; border: 2rpx solid #111; margin-top: 14rpx; background: #fff; }
.v2-mode .signal-card-v2.signal-card-warming { background: #E0FFF0; }
.v2-mode .signal-card-v2.signal-card-risk { background: #FFEEEC; }
.v2-mode .signal-card-v2.signal-card-anomaly { background: #FFFBEB; }
.v2-mode .signal-card-head-v2 { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.v2-mode .signal-card-icon-v2 { font-size: 24rpx; }
.v2-mode .signal-card-label-v2 { font-size: 20rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .signal-card-title-v2 { display: block; font-size: 24rpx; font-weight: 900; color: #111; line-height: 1.35; margin-bottom: 6rpx; }
.v2-mode .signal-card-detail-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.5; }
.v2-mode .signal-card-evidence-v2 { margin-top: 10rpx; padding-top: 10rpx; border-top: 1rpx dashed rgba(0,0,0,0.15); display: flex; gap: 8rpx; }
.v2-mode .signal-card-evidence-label-v2 { font-size: 18rpx; font-weight: 800; color: #999; flex-shrink: 0; }
.v2-mode .signal-card-evidence-text-v2 { font-size: 18rpx; font-weight: 600; color: #999; }

/* Card variants */
.v2-mode .cream-card { background: #FFFBEB; }
.v2-mode .mint-card { background: #E0FFF0; }
.v2-mode .section-head-v2 { display: flex; justify-content: space-between; align-items: flex-start; gap: 12rpx; margin-bottom: 14rpx; }

/* Diverging Balance 互动天平 */
.v2-mode .balance-summary-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin-bottom: 14rpx; }
.v2-mode .balance-summary-cell-v2 { border: 2rpx solid #111; background: #fff; padding: 12rpx 8rpx; text-align: center; }
.v2-mode .balance-summary-num-v2 { display: block; font-size: 24rpx; line-height: 1; font-weight: 900; color: #111; }
.v2-mode .balance-summary-lbl-v2 { display: block; margin-top: 6rpx; font-size: 18rpx; font-weight: 800; color: #999; }
.v2-mode .diverging-panel-v2 { border: 2rpx solid #111; background: #fff; padding: 16rpx 14rpx; }
.v2-mode .diverging-head-v2 { display: grid; grid-template-columns: 1fr 28rpx 1fr; color: #999; font-size: 20rpx; font-weight: 800; margin-bottom: 10rpx; text-align: center; }
.v2-mode .diverging-head-v2 text:first-child { text-align: left; }
.v2-mode .diverging-head-v2 text:last-child { text-align: right; color: #111; }
.v2-mode .diverging-row-v2 { display: grid; grid-template-columns: 54rpx 1fr 28rpx 1fr 64rpx; align-items: center; gap: 8rpx; margin-top: 12rpx; }
.v2-mode .diverging-label-v2 { font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .diverging-bar-left-v2 { height: 18rpx; border: 2rpx solid #111; background: #fff; overflow: hidden; }
.v2-mode .diverging-fill-left-v2 { height: 100%; background: #111; float: right; }
.v2-mode .diverging-axis-v2 { text-align: center; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .diverging-bar-right-v2 { height: 18rpx; border: 2rpx solid #111; background: #fff; overflow: hidden; }
.v2-mode .diverging-fill-right-v2 { height: 100%; background: #4ECDC4; }
.v2-mode .diverging-bar-right-v2.risk .diverging-fill-right-v2 { background: #FF5252; }
.v2-mode .diverging-num-v2 { font-size: 20rpx; font-weight: 800; color: #999; text-align: right; }
.v2-mode .balance-callout-v2 { margin-top: 12rpx; border: 2rpx solid #111; background: #FFD93D; padding: 14rpx 16rpx; font-size: 20rpx; line-height: 1.45; font-weight: 700; color: #111; }

/* Scene Bubble 场景气泡图 */
.v2-mode .scene-chart-v2 { position: relative; height: 460rpx; border: 2rpx solid #111; background: linear-gradient(180deg, #fff, #fffcf4); overflow: hidden; }
.v2-mode .scene-axis-h-v2 { position: absolute; left: 16rpx; right: 16rpx; top: 50%; height: 2rpx; background: #111; opacity: .45; }
.v2-mode .scene-axis-v-v2 { position: absolute; top: 16rpx; bottom: 16rpx; left: 50%; width: 2rpx; background: #111; opacity: .45; }
.v2-mode .scene-axis-label-v2 { position: absolute; font-size: 20rpx; font-weight: 800; color: #999; background: #fff; padding: 2rpx 8rpx; }
.v2-mode .scene-axis-label-v2.top { top: 8rpx; left: 50%; transform: translateX(-50%); }
.v2-mode .scene-axis-label-v2.bottom { bottom: 8rpx; left: 50%; transform: translateX(-50%); }
.v2-mode .scene-axis-label-v2.left { left: 10rpx; top: 50%; transform: translateY(-50%); }
.v2-mode .scene-axis-label-v2.right { right: 10rpx; top: 50%; transform: translateY(-50%); }
.v2-mode .scene-bubble-v2 { position: absolute; border: 2rpx solid #111; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-shadow: 2rpx 2rpx 0 rgba(17,17,17,.9); transform: translate(-50%, -50%); }
.v2-mode .scene-bubble-v2.hot { background: #4ECDC4; }
.v2-mode .scene-bubble-v2.mid { background: #FFD93D; }
.v2-mode .scene-bubble-v2.cool { background: #fff; }
.v2-mode .scene-bubble-name-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; line-height: 1.1; }
.v2-mode .scene-bubble-count-v2 { display: block; margin-top: 4rpx; font-size: 20rpx; font-weight: 900; color: rgba(0,0,0,.6); }
.v2-mode .scene-legend-v2 { display: flex; gap: 16rpx; margin-top: 14rpx; }
.v2-mode .scene-legend-item-v2 { display: flex; align-items: center; gap: 8rpx; font-size: 20rpx; font-weight: 800; color: #666; }
.v2-mode .scene-legend-dot-v2 { width: 20rpx; height: 20rpx; border: 2rpx solid #111; }
.v2-mode .scene-legend-dot-v2.mint { background: #4ECDC4; }
.v2-mode .scene-legend-dot-v2.yellow { background: #FFD93D; }
.v2-mode .scene-legend-dot-v2.white { background: #fff; }
.v2-mode .scene-chips-v2 { margin-top: 14rpx; border: 2rpx solid #111; background: #fff; padding: 12rpx; display: flex; flex-wrap: wrap; gap: 8rpx; }
.v2-mode .scene-chip-v2 { display: inline-flex; align-items: center; gap: 6rpx; min-height: 40rpx; border: 2rpx solid #111; background: #fff; padding: 4rpx 12rpx; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .scene-chip-v2.hot { background: #4ECDC4; }
.v2-mode .scene-chip-v2.mid { background: #FFD93D; }
.v2-mode .scene-chip-v2.cool { background: repeating-linear-gradient(45deg, #fff, #fff 6rpx, #f5f5f5 6rpx, #f5f5f5 12rpx); }
.v2-mode .scene-chip-count-v2 { color: rgba(0,0,0,.5); }
.v2-mode .tag-v2.yellow { background: #FFD93D; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }

/* Full Review */
.v2-mode .full-review-v2 { border: 2rpx solid #111; background: #fff; padding: 24rpx; }
.v2-mode .full-review-p-v2 { display: block; font-size: 20rpx; line-height: 1.65; font-weight: 600; color: #666; margin-top: 10rpx; }
.v2-mode .full-review-p-v2:first-child { margin-top: 0; }
.v2-mode .full-review-bold-v2 { color: #111; font-weight: 900; }

/* Info bottom sheet（与命理桃花 info-sheet 同风格） */
.v2-mode .info-dot-v2 { display: inline-flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border: 2rpx solid #111; font-size: 20rpx; font-weight: 900; color: #111; margin-left: auto; }
.v2-mode .info-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); }
.v2-mode .info-sheet { width: 100%; max-width: 500px; max-height: 70vh; background: #FFFDF5; border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; display: flex; flex-direction: column; overflow: hidden; }
.v2-mode .info-sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; border-bottom: 2rpx solid #111; flex-shrink: 0; }
.v2-mode .info-sheet-title { font-size: 26rpx; font-weight: 900; color: #111; }
.v2-mode .info-sheet-close { font-size: 32rpx; font-weight: 900; color: #111; padding: 0 8rpx; line-height: 1; }
.v2-mode .info-sheet-body { padding: 20rpx 28rpx 40rpx; overflow-y: auto; }
.v2-mode .info-tree-item { padding: 16rpx 0; border-bottom: 1rpx solid rgba(0,0,0,0.08); }
.v2-mode .info-tree-item:last-child { border-bottom: none; }
.v2-mode .info-tree-q { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .info-tree-a { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.6; }
</style>
