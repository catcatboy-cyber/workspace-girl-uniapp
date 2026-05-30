<template>
  <view class="trend-panel">
    <view v-if="title || subtitle" class="trend-header">
      <view>
        <text v-if="title" class="trend-title">{{ title }}</text>
        <text v-if="subtitle" class="trend-subtitle">{{ subtitle }}</text>
      </view>
      <text v-if="points.length > 0" class="trend-count">{{ points.length }} 次</text>
    </view>

    <view v-if="points.length === 0" class="empty-state">
      <text class="muted">还没有足够的分析记录来生成趋势。</text>
    </view>

    <template v-else>
      <view class="legend-row">
        <view class="legend-item">
          <view class="legend-line intent" />
          <text>意向</text>
        </view>
        <view class="legend-item">
          <view class="legend-line risk" />
          <text>风险</text>
        </view>
        <text class="legend-tip">左右滑动查看更多</text>
      </view>

      <scroll-view class="chart-scroll" scroll-x :scroll-left="initialScrollLeft" enhanced show-scrollbar="false">
        <view class="line-chart" :style="{ width: chartWidth + 'rpx' }">
          <view class="grid-line top"><text>100</text></view>
          <view class="grid-line middle"><text>50</text></view>
          <view class="grid-line bottom"><text>0</text></view>

          <view
            v-for="segment in intentSegments"
            :key="segment.key"
            class="line-segment intent"
            :style="segment.style"
          />
          <view
            v-for="segment in riskSegments"
            :key="segment.key"
            class="line-segment risk"
            :style="segment.style"
          />

          <view
            v-for="point in points"
            :key="`intent-${point.index}`"
            class="point intent"
            :style="{ left: point.x + 'rpx', top: point.intentY + 'rpx' }"
          >
            <text>{{ point.intentScore }}</text>
          </view>
          <view
            v-for="point in points"
            :key="`risk-${point.index}`"
            class="point risk"
            :style="{ left: point.x + 'rpx', top: point.riskY + 'rpx' }"
          >
            <text>{{ point.riskScore }}</text>
          </view>

          <view
            v-for="point in points"
            :key="`label-${point.index}`"
            class="x-label"
            :style="{ left: point.x + 'rpx' }"
          >
            <text class="x-index">第 {{ point.index }} 次</text>
            <text class="x-time">{{ point.createdAtLabel }}</text>
          </view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Assessment = {
  intentScore: number
  consistencyRiskScore: number
  triggerEventTitle?: string
  source?: string
  createdAt?: string
}

type ChartPoint = {
  index: number
  intentScore: number
  riskScore: number
  x: number
  intentY: number
  riskY: number
  createdAtLabel: string
}

type Segment = {
  key: string
  style: Record<string, string>
}

const props = defineProps<{
  assessments: Assessment[]
  title?: string
  subtitle?: string
}>()

const chartTop = 44
const chartHeight = 260
const chartLeft = 72
const pointGap = 140
const visiblePoints = 5

const sortedAssessments = computed(() => {
  return [...props.assessments].sort((a, b) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
})

const chartWidth = computed(() => {
  return Math.max(680, chartLeft * 2 + Math.max(points.value.length - 1, visiblePoints - 1) * pointGap)
})

const initialScrollLeft = computed(() => {
  if (points.value.length <= visiblePoints) return 0
  return chartWidth.value
})

const points = computed<ChartPoint[]>(() => {
  return sortedAssessments.value.map((item, index) => {
    const x = chartLeft + index * pointGap
    const intentScore = clamp(item.intentScore, 0, 100)
    const riskScore = clamp(item.consistencyRiskScore, 0, 100)
    return {
      index: index + 1,
      intentScore,
      riskScore,
      x,
      intentY: scoreToY(intentScore),
      riskY: scoreToY(riskScore),
      createdAtLabel: formatTime(item.createdAt)
    }
  })
})

const intentSegments = computed(() => buildSegments('intent', points.value.map((point) => ({ x: point.x, y: point.intentY }))))
const riskSegments = computed(() => buildSegments('risk', points.value.map((point) => ({ x: point.x, y: point.riskY }))))

function scoreToY(score: number) {
  return chartTop + chartHeight - (score / 100) * chartHeight
}

function buildSegments(prefix: string, source: Array<{ x: number; y: number }>): Segment[] {
  const segments: Segment[] = []
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function getAssessmentTimestamp(item: Assessment) {
  const raw = item?.createdAt
  if (!raw) return 0
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatTime(createdAt?: string) {
  if (!createdAt) return '时间未说明'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return '时间未说明'
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`
}
</script>

<style scoped>
.trend-panel { margin: 8rpx 0; }

.trend-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 18rpx;
}
.trend-title { display: block; font-size: 32rpx; font-weight: 900; color: #111; }
.trend-subtitle { display: block; margin-top: 8rpx; font-size: 24rpx; line-height: 1.55; color: #666; font-weight: 600; }
.trend-count {
  flex-shrink: 0; padding: 8rpx 16rpx;
  border: 2rpx solid #111; color: #111; font-size: 22rpx; font-weight: 800;
  background: #FFD93D;
}

.empty-state { padding: 56rpx 0; text-align: center; }
.muted { font-size: 24rpx; color: #666; font-weight: 600; }

.legend-row { display: flex; align-items: center; flex-wrap: wrap; gap: 16rpx; margin-bottom: 14rpx; }
.legend-item { display: flex; align-items: center; gap: 8rpx; color: #111; font-size: 23rpx; font-weight: 700; }
.legend-line { width: 34rpx; height: 5rpx; }
.legend-line.intent { background: #111; }
.legend-line.risk { background: #FF5252; }
.legend-tip { color: #666; font-size: 21rpx; font-weight: 600; }

.chart-scroll {
  width: 100%; border: 3rpx solid #111;
  background: #fff;
}
.line-chart { position: relative; height: 410rpx; box-sizing: border-box; }

.grid-line {
  position: absolute; left: 34rpx; right: 28rpx; height: 2rpx;
  background: #e0e0e0;
}
.grid-line text {
  position: absolute; left: -4rpx; top: -18rpx; transform: translateX(-100%);
  color: #666; font-size: 19rpx; font-weight: 600;
}
.grid-line.top { top: 44rpx; }
.grid-line.middle { top: 174rpx; }
.grid-line.bottom { top: 304rpx; }

.line-segment { position: absolute; height: 5rpx; transform-origin: 0 50%; }
.line-segment.intent { background: #111; }
.line-segment.risk { background: #FF5252; }

.point {
  position: absolute; width: 34rpx; height: 34rpx;
  margin-left: -17rpx; margin-top: -17rpx;
  border-radius: 50%;
  border: 4rpx solid #fff;
  box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
}
.point text { position: absolute; top: -34rpx; color: #111; font-size: 19rpx; font-weight: 800; }
.point.intent { background: #111; }
.point.risk { background: #FF5252; }
.point.risk text { top: 28rpx; }

.x-label { position: absolute; top: 330rpx; width: 116rpx; margin-left: -58rpx; text-align: center; }
.x-index, .x-time { display: block; color: #666; font-size: 20rpx; line-height: 1.3; font-weight: 600; }
.x-index { color: #111; font-weight: 800; }
</style>
