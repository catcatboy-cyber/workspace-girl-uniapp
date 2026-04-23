<template>
  <view class="trend-chart-wrapper">
    <view v-if="title || subtitle" class="chart-header">
      <text v-if="title" class="chart-title">{{ title }}</text>
      <text v-if="subtitle" class="chart-subtitle">{{ subtitle }}</text>
    </view>

    <view v-if="points.length === 0" class="empty-state">
      <text class="muted">还没有足够的评估记录来绘制趋势图</text>
    </view>

    <view v-else class="chart-container">
      <!-- Canvas 图表 -->
      <canvas
        canvas-id="trendCanvas"
        :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        class="trend-canvas"
      />

      <!-- 悬停提示 -->
      <view
        v-if="hoveredPoint"
        :class="['tooltip', tooltipDirection]"
        :style="{ left: tooltipLeft + 'px', top: tooltipTop + 'px' }"
      >
        <text class="tooltip-label">{{ hoveredPoint.label }}</text>
        <text class="tooltip-value">{{ hoveredPoint.series === 'intent' ? '意向' : '风险' }}: {{ hoveredPoint.value }}</text>
        <text class="tooltip-source">{{ hoveredPoint.sourceLabel }}</text>
      </view>

      <!-- 移动端列表视图 -->
      <view class="mobile-list">
        <view v-for="row in mobileRows" :key="row.index" class="mobile-row">
          <view class="mobile-row-header">
            <text class="mobile-row-index">第 {{ row.index }} 次</text>
            <text class="mobile-row-time">{{ formatTime(row.createdAt) }}</text>
          </view>
          <text class="mobile-row-label">{{ row.label }}</text>
          <view class="mobile-row-scores">
            <view class="score-item">
              <text class="score-label">意向</text>
              <text class="score-value">{{ row.intentScore }}</text>
              <text v-if="row.intentDelta !== null" :class="['score-delta', row.intentDelta > 0 ? 'positive' : row.intentDelta < 0 ? 'negative' : '']">
                {{ row.intentDelta > 0 ? '+' : '' }}{{ row.intentDelta }}
              </text>
            </view>
            <view class="score-item">
              <text class="score-label">风险</text>
              <text class="score-value">{{ row.riskScore }}</text>
              <text v-if="row.riskDelta !== null" :class="['score-delta', row.riskDelta > 0 ? 'negative' : row.riskDelta < 0 ? 'positive' : '']">
                {{ row.riskDelta > 0 ? '+' : '' }}{{ row.riskDelta }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

type Assessment = {
  intentScore: number
  consistencyRiskScore: number
  triggerEventTitle?: string
  source?: string
  createdAt?: string
}

type TrendPoint = {
  index: number
  intentScore: number
  riskScore: number
  label: string
  sourceLabel: string
}

type PositionedPoint = TrendPoint & {
  x: number
  intentY: number
  riskY: number
}

type HoveredPoint = {
  series: 'intent' | 'risk'
  x: number
  y: number
  label: string
  value: number
  index: number
  sourceLabel: string
}

type MobileRow = TrendPoint & {
  createdAt?: string
  intentDelta: number | null
  riskDelta: number | null
}

const props = defineProps<{
  assessments: Assessment[]
  title?: string
  subtitle?: string
}>()

const canvasWidth = ref(750)
const canvasHeight = ref(420)
const hoveredPoint = ref<HoveredPoint | null>(null)
const tooltipDirection = ref<'left' | 'right'>('right')
const tooltipLeft = ref(0)
const tooltipTop = ref(0)

let canvasContext: any = null

const points = computed<TrendPoint[]>(() => {
  return props.assessments.map((item, index) => ({
    index: index + 1,
    intentScore: clamp(item.intentScore, 0, 100),
    riskScore: clamp(item.consistencyRiskScore, 0, 100),
    label: item.triggerEventTitle || mapSourceLabel(item),
    sourceLabel: mapSourceLabel(item)
  }))
})

const mobileRows = computed<MobileRow[]>(() => {
  return points.value
    .map((point, index) => {
      const previous = index > 0 ? points.value[index - 1] : null
      return {
        ...point,
        createdAt: props.assessments[index]?.createdAt,
        intentDelta: previous ? point.intentScore - previous.intentScore : null,
        riskDelta: previous ? point.riskScore - previous.riskScore : null
      }
    })
    .slice()
    .reverse()
})

function mapSourceLabel(result: Assessment) {
  if (result.triggerEventTitle) return result.triggerEventTitle
  switch (result.source) {
    case 'initial_questionnaire':
      return '首次结构化评估'
    case 'manual_reassessment':
      return '手动重新评估'
    case 'event_recalculation':
      return '事件触发重算'
    default:
      return '评估记录'
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatTime(createdAt?: string) {
  if (!createdAt) return '时间未说明'
  const parsed = new Date(createdAt)
  if (isNaN(parsed.getTime())) return '时间未说明'
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${parsed.getHours()}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function buildPositionedPoints(
  pts: TrendPoint[],
  width: number,
  paddingX: number,
  laneHeight: number,
  intentLaneTop: number,
  riskLaneTop: number,
  lanePadding: number
): PositionedPoint[] {
  const usableWidth = width - paddingX * 2
  const stepX = pts.length === 1 ? 0 : usableWidth / (pts.length - 1)
  const usableHeight = laneHeight - lanePadding * 2

  return pts.map((point, index) => ({
    ...point,
    x: paddingX + stepX * index,
    intentY: intentLaneTop + laneHeight - lanePadding - (point.intentScore / 100) * usableHeight,
    riskY: riskLaneTop + laneHeight - lanePadding - (point.riskScore / 100) * usableHeight
  }))
}

function drawChart() {
  if (!canvasContext || points.value.length === 0) return

  const width = canvasWidth.value
  const height = canvasHeight.value
  const paddingX = 48
  const laneHeight = 116
  const lanePadding = 18
  const intentLaneTop = 54
  const riskLaneTop = 218

  const positionedPoints = buildPositionedPoints(
    points.value,
    width,
    paddingX,
    laneHeight,
    intentLaneTop,
    riskLaneTop,
    lanePadding
  )

  // 清空画布
  canvasContext.clearRect(0, 0, width, height)

  // 绘制背景
  canvasContext.fillStyle = '#fbf6ee'
  canvasContext.fillRect(0, 0, width, height)

  // 绘制意向轨道
  drawLane(canvasContext, intentLaneTop, laneHeight, '意向倾向', '#143f3a')

  // 绘制风险轨道
  drawLane(canvasContext, riskLaneTop, laneHeight, '一致性风险', '#b85c38')

  // 绘制意向曲线
  drawCurve(canvasContext, positionedPoints, 'intentY', '#143f3a', 0.15)

  // 绘制风险曲线
  drawCurve(canvasContext, positionedPoints, 'riskY', '#b85c38', 0.15)

  // 绘制数据点
  positionedPoints.forEach((point) => {
    // 意向点
    canvasContext.beginPath()
    canvasContext.arc(point.x, point.intentY, 5, 0, 2 * Math.PI)
    canvasContext.fillStyle = '#143f3a'
    canvasContext.fill()

    // 风险点
    canvasContext.beginPath()
    canvasContext.arc(point.x, point.riskY, 5, 0, 2 * Math.PI)
    canvasContext.fillStyle = '#b85c38'
    canvasContext.fill()
  })

  canvasContext.draw()
}

function drawLane(ctx: any, top: number, height: number, label: string, color: string) {
  // 背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillRect(0, top, canvasWidth.value, height)

  // 标签
  ctx.fillStyle = color
  ctx.font = '12px sans-serif'
  ctx.fillText(label, 12, top + 20)

  // 刻度线
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = top + (height / 4) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvasWidth.value, y)
    ctx.stroke()
  }
}

function drawCurve(ctx: any, pts: PositionedPoint[], key: 'intentY' | 'riskY', color: string, alpha: number) {
  if (pts.length === 0) return

  // 绘制填充区域
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0][key])

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const controlX = (prev.x + curr.x) / 2
    ctx.bezierCurveTo(controlX, prev[key], controlX, curr[key], curr.x, curr[key])
  }

  const laneBaseY = key === 'intentY' ? 54 + 116 - 18 : 218 + 116 - 18
  ctx.lineTo(pts[pts.length - 1].x, laneBaseY)
  ctx.lineTo(pts[0].x, laneBaseY)
  ctx.closePath()
  ctx.fillStyle = color.replace(')', `, ${alpha})`)
  ctx.fill()

  // 绘制线条
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0][key])

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const controlX = (prev.x + curr.x) / 2
    ctx.bezierCurveTo(controlX, prev[key], controlX, curr[key], curr.x, curr[key])
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
}

function handleTouchStart(e: any) {
  // TODO: 实现触摸交互
}

function handleTouchMove(e: any) {
  // TODO: 实现触摸交互
}

function handleTouchEnd(e: any) {
  // TODO: 实现触摸交互
}

onMounted(() => {
  // 获取 canvas 上下文
  uni.createSelectorQuery()
    .select('.trend-canvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (res[0]) {
        const canvas = res[0].node
        canvasContext = canvas.getContext('2d')

        // 设置 canvas 实际尺寸
        const dpr = uni.getSystemInfoSync().pixelRatio || 1
        canvas.width = canvasWidth.value * dpr
        canvas.height = canvasHeight.value * dpr
        canvasContext.scale(dpr, dpr)

        drawChart()
      } else {
        // H5 环境
        canvasContext = uni.createCanvasContext('trendCanvas')
        drawChart()
      }
    })
})

watch(() => props.assessments, () => {
  drawChart()
}, { deep: true })
</script>

<style scoped>
.trend-chart-wrapper { margin: 24rpx 0; }
.chart-header { margin-bottom: 16rpx; }
.chart-title { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; }
.chart-subtitle { display: block; font-size: 24rpx; color: #786857; margin-top: 4rpx; }
.empty-state { padding: 60rpx 0; text-align: center; }
.muted { font-size: 24rpx; color: #786857; }

.chart-container { position: relative; }
.trend-canvas { width: 100%; background: #fbf6ee; border-radius: 12rpx; }

.tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}
.tooltip.left { transform: translateX(-100%); }
.tooltip-label { display: block; font-weight: 600; margin-bottom: 4rpx; }
.tooltip-value { display: block; margin-bottom: 2rpx; }
.tooltip-source { display: block; opacity: 0.7; }

.mobile-list { margin-top: 24rpx; }
.mobile-row { background: #fff; border-radius: 12rpx; padding: 20rpx; margin-bottom: 12rpx; }
.mobile-row-header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.mobile-row-index { font-size: 22rpx; font-weight: 600; color: #143f3a; }
.mobile-row-time { font-size: 20rpx; color: #786857; }
.mobile-row-label { display: block; font-size: 26rpx; color: #241b12; margin-bottom: 12rpx; }
.mobile-row-scores { display: flex; gap: 24rpx; }
.score-item { flex: 1; }
.score-label { display: block; font-size: 20rpx; color: #786857; }
.score-value { display: block; font-size: 32rpx; font-weight: 700; color: #143f3a; margin: 4rpx 0; }
.score-delta { display: block; font-size: 22rpx; }
.score-delta.positive { color: #14633a; }
.score-delta.negative { color: #b85c38; }
</style>
