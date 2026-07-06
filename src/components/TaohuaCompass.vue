<template>
  <view class="luopan-wrap">
    <view class="luopan-card" :aria-label="`今日桃花方位${props.direction}`">
      <view class="luopan">
        <view class="plate plate-outer" />
        <view class="plate plate-mountain" />
        <view class="plate plate-direction" />
        <view class="plate plate-zhi" />
        <view class="plate plate-gua" />
        <view class="plate plate-inner" />

        <view
          v-for="tick in ticks"
          :key="tick.key"
          :class="['tick', tick.major ? 'major' : '', tick.mid ? 'mid' : '']"
          :style="tick.style"
        />

        <view
          v-for="item in mountainLabels"
          :key="item.label"
          class="mountain-label"
          :style="item.style"
        >
          <text :class="['mountain-text', { on: item.zhi === directionZhi }]">{{ item.label }}</text>
        </view>

        <view
          v-for="item in dirLabels"
          :key="item.label"
          class="dir-label"
          :style="item.style"
        >
          <text :class="['dir-label-text', { on: item.label === shortDir }]">{{ item.label }}</text>
        </view>

        <view
          v-for="item in dizhiLabels"
          :key="item.zhi"
          class="dz-label"
          :style="item.style"
        >
          <text :class="['dz-text', { on: item.zhi === directionZhi }]">{{ item.zhi }}</text>
        </view>

        <view
          v-for="item in guaLabels"
          :key="item.label"
          class="gua-label"
          :style="item.style"
        >
          <text class="gua-text">{{ item.label }}</text>
        </view>

        <view class="crosshair">
          <view class="crosshair-line north" />
          <view class="crosshair-line east" />
          <view class="crosshair-line south" />
          <view class="crosshair-line west" />
        </view>

        <view class="tianchi">
          <view class="inner-pointer" :style="pointerStyle">
            <view class="inner-pointer-line" />
            <view class="inner-pointer-arrow" />
          </view>
          <view class="tianchi-glow" />
          <view class="tianchi-inner" />
        </view>
      </view>

      <view class="compass-caption">
        <text class="caption-kicker">今日桃花位</text>
        <text class="caption-main">{{ props.direction }} · {{ directionZhi }}位</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { aiLabel } from '@/utils/labels'

const props = withDefaults(defineProps<{
  direction?: string
  directionZhi?: string
}>(), {
  direction: '正南',
  directionZhi: '午',
})

const DIR_MAP: Record<string, string> = {
  '正北': '北',
  '东北偏北': '东北',
  '东北偏东': '东北',
  '正东': '东',
  '东南偏东': '东南',
  '东南偏南': '东南',
  '正南': '南',
  '西南偏南': '西南',
  '西南偏西': '西南',
  '正西': '西',
  '西北偏西': '西北',
  '西北偏北': '西北',
}

const D_ANGLE: Record<string, number> = {
  '北': 0,
  '东北': 45,
  '东': 90,
  '东南': 135,
  '南': 180,
  '西南': 225,
  '西': 270,
  '西北': 315,
}

const shortDir = computed(() => DIR_MAP[props.direction] || props.direction || '南')
const activeAngle = computed(() => D_ANGLE[shortDir.value] ?? 180)
const pointerStyle = computed(() => ({ transform: `rotate(${activeAngle.value}deg)` }))

function pointStyle(angle: number, radius: number, extra: Record<string, string> = {}) {
  const rad = (angle * Math.PI) / 180
  return {
    left: `${50 + radius * Math.sin(rad)}%`,
    top: `${50 - radius * Math.cos(rad)}%`,
    ...extra,
  }
}

const ticks = computed(() => Array.from({ length: 72 }, (_, i) => {
  const major = i % 6 === 0
  const mid = i % 3 === 0
  return {
    key: `tick-${i}`,
    major,
    mid,
    style: { transform: `rotate(${i * 5}deg)` },
  }
}))

const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const dirLabels = computed(() => DIRS.map(label => ({
  label,
  style: pointStyle(D_ANGLE[label], 33),
})))

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const dizhiLabels = computed(() => DIZHI.map((zhi, i) => ({
  zhi,
  style: pointStyle(i * 30, 22),
})))

const MOUNTAINS = [
  { label: '壬', zhi: '', angle: 345 }, { label: '子', zhi: '子', angle: 0 }, { label: '癸', zhi: '', angle: 15 },
  { label: '丑', zhi: '丑', angle: 30 }, { label: '艮', zhi: '', angle: 45 }, { label: '寅', zhi: '寅', angle: 60 },
  { label: '甲', zhi: '', angle: 75 }, { label: '卯', zhi: '卯', angle: 90 }, { label: '乙', zhi: '', angle: 105 },
  { label: '辰', zhi: '辰', angle: 120 }, { label: '巽', zhi: '', angle: 135 }, { label: '巳', zhi: '巳', angle: 150 },
  { label: '丙', zhi: '', angle: 165 }, { label: '午', zhi: '午', angle: 180 }, { label: '丁', zhi: '', angle: 195 },
  { label: '未', zhi: '未', angle: 210 }, { label: '坤', zhi: '', angle: 225 }, { label: '申', zhi: '申', angle: 240 },
  { label: '庚', zhi: '', angle: 255 }, { label: '酉', zhi: '酉', angle: 270 }, { label: '辛', zhi: '', angle: 285 },
  { label: '戌', zhi: '戌', angle: 300 }, { label: '乾', zhi: '', angle: 315 }, { label: '亥', zhi: '亥', angle: 330 },
]
const mountainLabels = computed(() => MOUNTAINS.map(item => ({
  ...item,
  style: pointStyle(item.angle, 43, { transform: `translate(-50%, -50%) rotate(${item.angle}deg)` }),
})))

const GUAS = [
  { label: '坎', angle: 0 }, { label: '艮', angle: 45 }, { label: '震', angle: 90 }, { label: '巽', angle: 135 },
  { label: '离', angle: 180 }, { label: '坤', angle: 225 }, { label: '兑', angle: 270 }, { label: '乾', angle: 315 },
]
const guaLabels = computed(() => GUAS.map(item => ({
  ...item,
  style: pointStyle(item.angle, 15),
})))
</script>

<style scoped>
.luopan-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0 28rpx;
}

.luopan-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.luopan {
  width: 520rpx;
  height: 520rpx;
  max-width: 86vw;
  max-height: 86vw;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  background: #d49a32;
  border: 5rpx solid #6f351b;
  box-shadow: 0 14rpx 0 #111, 0 20rpx 36rpx rgba(77, 38, 18, 0.22);
}

.plate {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.plate-outer {
  inset: 10rpx;
  background:
    radial-gradient(circle, transparent 70%, rgba(112, 53, 21, 0.26) 71%, transparent 73%),
    linear-gradient(135deg, #ffefaa 0%, #e6b64e 40%, #9b531f 52%, #f8d878 72%, #b86a27 100%);
  border: 3rpx solid #5b2b16;
}

.plate-mountain {
  inset: 42rpx;
  background: #f7d879;
  border: 3rpx solid #7c3f1c;
  box-shadow: inset 0 0 0 6rpx rgba(255, 246, 190, 0.7);
}

.plate-direction {
  inset: 104rpx;
  background: #8b391d;
  border: 4rpx solid #f8d66c;
  box-shadow: inset 0 0 0 5rpx #6f2f19;
}

.plate-zhi {
  inset: 146rpx;
  background: #ffe899;
  border: 4rpx solid #7a381b;
  box-shadow: inset 0 0 0 6rpx rgba(255, 255, 232, 0.72);
}

.plate-gua {
  inset: 214rpx;
  background: #f2c15f;
  border: 4rpx solid #a85b22;
}

.plate-inner {
  inset: 284rpx;
  background: #dd9a45;
  border: 5rpx solid #f7c54f;
  box-shadow: inset 0 0 24rpx rgba(103, 42, 16, 0.32);
}

.tick {
  position: absolute;
  width: 1rpx;
  height: 18rpx;
  left: 50%;
  top: 12rpx;
  transform-origin: 50% 248rpx;
  background: rgba(75, 34, 18, 0.65);
  z-index: 5;
}

.tick.mid {
  height: 24rpx;
  width: 2rpx;
}

.tick.major {
  height: 34rpx;
  width: 3rpx;
  background: #5a2816;
}

.mountain-label,
.dir-label,
.dz-label,
.gua-label {
  position: absolute;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dir-label,
.dz-label,
.gua-label {
  transform: translate(-50%, -50%);
}

.mountain-text {
  display: block;
  min-width: 24rpx;
  font-size: 32rpx;
  line-height: 1;
  font-weight: 800;
  color: #4d2717;
  text-align: center;
}

.mountain-text.on {
  color: #d93530;
  text-shadow: 0 0 8rpx rgba(217, 53, 48, 0.26);
}

.dir-label-text {
  min-width: 52rpx;
  min-height: 36rpx;
  padding: 5rpx 4rpx;
  border-radius: 2rpx;
  background: rgba(255, 224, 128, 0.9);
  border: 2rpx solid rgba(99, 42, 18, 0.36);
  font-size: 34rpx;
  line-height: 1;
  font-weight: 900;
  color: #421f12;
  text-align: center;
}

.dir-label-text.on {
  background: #c33a2f;
  color: #fff5c8;
  border-color: #5b2414;
  box-shadow: 0 0 0 4rpx rgba(255, 218, 95, 0.7), 0 8rpx 12rpx rgba(110, 35, 22, 0.25);
}

.dz-text {
  min-width: 36rpx;
  min-height: 36rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  line-height: 1;
  font-weight: 900;
  color: #2f2117;
}

.dz-text.on {
  color: #d93530;
  background: rgba(255, 246, 194, 0.88);
  box-shadow: inset 0 0 0 2rpx rgba(122, 56, 27, 0.24);
}

.gua-text {
  font-size: 38rpx;
  line-height: 1;
  font-weight: 900;
  color: #4a2314;
}

.crosshair {
  position: absolute;
  inset: 22rpx;
  z-index: 20;
  pointer-events: none;
}

.crosshair-line {
  position: absolute;
  background: rgba(211, 38, 38, 0.8);
}

.crosshair-line.north,
.crosshair-line.south {
  width: 2rpx;
  left: 50%;
  transform: translateX(-50%);
}

.crosshair-line.north {
  top: 0;
  bottom: calc(50% + 28rpx);
}

.crosshair-line.south {
  top: calc(50% + 28rpx);
  bottom: 0;
}

.crosshair-line.east,
.crosshair-line.west {
  height: 2rpx;
  top: 50%;
  transform: translateY(-50%);
}

.crosshair-line.east {
  left: calc(50% + 28rpx);
  right: 0;
}

.crosshair-line.west {
  left: 0;
  right: calc(50% + 28rpx);
}

.tianchi {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 104rpx;
  height: 104rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  z-index: 32;
  background: #d58b3d;
  border: 5rpx solid #f7ce55;
  box-shadow: inset 0 0 26rpx rgba(101, 42, 17, 0.35), 0 0 0 5rpx rgba(126, 58, 21, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.inner-pointer {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 0;
  height: 50rpx;
  transform-origin: center bottom;
  z-index: 3;
}

.inner-pointer-line {
  position: absolute;
  left: -3rpx;
  bottom: 7rpx;
  width: 6rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #fff0a8 0%, #d3242b 45%, #8e1f1b 100%);
  box-shadow: 0 0 10rpx rgba(211, 36, 43, 0.34);
}

.inner-pointer-arrow {
  position: absolute;
  left: -14rpx;
  top: -3rpx;
  width: 0;
  height: 0;
  border-left: 14rpx solid transparent;
  border-right: 14rpx solid transparent;
  border-bottom: 24rpx solid #d3242b;
  filter: drop-shadow(0 4rpx 5rpx rgba(91, 36, 20, 0.26));
}

.tianchi-glow {
  position: absolute;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: radial-gradient(circle, #ff7680 0%, #e83345 48%, rgba(232, 51, 69, 0.25) 72%, transparent 74%);
  box-shadow: 0 0 22rpx rgba(232, 51, 69, 0.45);
}

.tianchi-inner {
  position: relative;
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background:
    radial-gradient(circle, #fff7d1 0%, #ffd36f 32%, #d93843 34%, #d93843 52%, #fff0b2 54%, #fff0b2 100%);
  border: 2rpx solid rgba(93, 44, 25, 0.36);
  box-shadow: inset 0 0 8rpx rgba(93, 44, 25, 0.18);
  z-index: 5;
}

.compass-caption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.caption-kicker {
  padding: 6rpx 12rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--brand-warm, #ffefaa);
  box-shadow: 3rpx 3rpx 0 var(--border, #111);
  font-size: 24rpx;
  line-height: 1;
  font-weight: 900;
  color: var(--primary, #6f351b);
}

.caption-main {
  font-size: 34rpx;
  line-height: 1;
  font-weight: 900;
  color: var(--text-main, #111);
}
</style>
