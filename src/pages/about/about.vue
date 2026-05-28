<template>
  <view class="page v2-mode" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">ABOUT</text>
      <text class="hero-title-v2">关<text class="hl-v2">于</text></text>
      <text class="hero-copy-v2">Signal Board · 关系信号看板</text>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">版本信息</text>
      <view class="info-row-v2">
        <text class="info-label-v2">当前版本</text>
        <text class="info-value-v2">v1.0.0</text>
      </view>
      <view class="info-row-v2">
        <text class="info-label-v2">版本代号</text>
        <text class="info-value-v2">100</text>
      </view>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">技术说明</text>
      <text class="card-text-v2">基于 uni-app (Vue 3) + 微信云开发构建。AI 能力由 Claude 模型驱动，通过 CloudBase 云函数代理调用。</text>
      <text class="card-text-v2" style="margin-top:14rpx">Token 额度用于 AI 调用计费，每次生成分析、侧写、周复盘、语音识别等均会消耗对应 token。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())

onLoad(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
</script>

<style scoped>
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }
.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .info-row-v2 { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-bottom: 2rpx dashed #e0e0e0; }
.v2-mode .info-row-v2:last-child { border-bottom: none; }
.v2-mode .info-label-v2 { font-size: 24rpx; font-weight: 700; color: #666; }
.v2-mode .info-value-v2 { font-size: 24rpx; font-weight: 900; color: #111; }
</style>
