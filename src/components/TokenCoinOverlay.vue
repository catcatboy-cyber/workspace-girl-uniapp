<template>
  <view v-if="visible" class="coin-overlay" @click="dismiss">
    <view class="coin-stage" @click.stop>
      <!-- 粒子 -->
      <view class="coin-particles">
        <view v-for="i in 12" :key="i" class="coin-particle" :style="{ '--i': i }">✦</view>
      </view>
      <!-- 金币 -->
      <view class="coin-body">
        <view class="coin-shine"></view>
        <text class="coin-label">TOKEN</text>
      </view>
      <!-- 到账数量 -->
      <text class="coin-amount">+{{ displayAmount.toLocaleString() }}</text>
      <!-- 副标题 -->
      <text v-if="subtitle" class="coin-sub">{{ subtitle }}</text>
      <!-- 提示 -->
      <text class="coin-hint">点击任意处关闭</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { aiLabel } from '@/utils/labels'

const props = withDefaults(defineProps<{
  visible: boolean
  amount: number
  subtitle?: string
}>(), { visible: false, amount: 0 })

const emit = defineEmits<{ close: [] }>()

const displayAmount = ref(0)
let countTimer: ReturnType<typeof setInterval> | null = null
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.visible, (val) => {
  if (val) {
    displayAmount.value = 0
    // 数字滚动动画
    const target = props.amount
    const duration = 800
    const step = Math.max(1, Math.ceil(target / 40))
    const interval = duration / Math.ceil(target / step)
    countTimer = setInterval(() => {
      displayAmount.value = Math.min(target, displayAmount.value + step)
      if (displayAmount.value >= target && countTimer) {
        clearInterval(countTimer)
        countTimer = null
      }
    }, interval)
    // 3 秒后自动关闭
    autoCloseTimer = setTimeout(() => dismiss(), 3000)
  } else {
    stopTimers()
  }
})

function stopTimers() {
  if (countTimer) { clearInterval(countTimer); countTimer = null }
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null }
}

function dismiss() {
  stopTimers()
  emit('close')
}

onUnmounted(stopTimers)
</script>

<style scoped lang="scss">
.coin-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
}
.coin-stage {
  display: flex; flex-direction: column; align-items: center; gap: 24rpx;
}

// ── 金币 ──
.coin-body {
  width: 220rpx; height: 220rpx; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #FFD700, #E6A800 50%, #B8860B 100%);
  border: 6rpx solid #8B6914;
  box-shadow: 0 0 60rpx rgba(255,215,0,0.5), 0 0 120rpx rgba(255,215,0,0.25);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  animation: coin-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  overflow: hidden;
}
.coin-shine {
  position: absolute; inset: -50%;
  background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 50%);
  animation: coin-shine-move 2s ease-in-out infinite;
}
.coin-label {
  font-size: 44rpx; font-weight: 900; color: #5C3D00;
  text-shadow: 0 2rpx 0 rgba(255,255,255,0.3);
  letter-spacing: 4rpx;
  position: relative; z-index: 1;
}

// ── 粒子 ──
.coin-particles {
  position: absolute; width: 300rpx; height: 300rpx;
  animation: coin-particles-rotate 3s linear infinite;
}
.coin-particle {
  position: absolute; top: 50%; left: 50%;
  font-size: 28rpx; color: #FFD700;
  transform: rotate(calc(var(--i) * 30deg)) translateY(-140rpx);
  animation: coin-particle-blink 1.5s ease-in-out calc(var(--i) * 0.1s) infinite;
}

// ── 文字 ──
.coin-amount {
  font-size: 64rpx; font-weight: 900; color: #FFD700;
  text-shadow: 0 4rpx 0 #8B6914, 0 0 40rpx rgba(255,215,0,0.6);
  animation: coin-text-pop 0.5s 0.3s both;
}
.coin-sub {
  font-size: 28rpx; font-weight: 700; color: #fff;
  text-align: center; line-height: 1.4;
  animation: coin-text-pop 0.5s 0.5s both;
}
.coin-hint {
  font-size: 22rpx; color: rgba(255,255,255,0.5);
  margin-top: 16rpx;
}

// ── 动画关键帧 ──
@keyframes coin-bounce {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes coin-shine-move {
  0%, 100% { transform: translate(-10%, -10%) rotate(0deg); }
  50% { transform: translate(10%, 10%) rotate(180deg); }
}
@keyframes coin-particles-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes coin-particle-blink {
  0%, 100% { opacity: 0; transform: rotate(calc(var(--i) * 30deg)) translateY(-140rpx) scale(0.5); }
  50% { opacity: 1; transform: rotate(calc(var(--i) * 30deg)) translateY(-140rpx) scale(1); }
}
@keyframes coin-text-pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
