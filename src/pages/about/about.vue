<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">ABOUT</text>
      <text class="hero-title-v2">关<text class="hl-v2">于</text></text>
      <text class="hero-copy-v2">Signal Board · 关系信号看板</text>
    </view>
    <!-- #ifdef H5 -->
    <view class="card-v2" @click="handleAdminTap">
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
    <!-- #endif -->
    <!-- #ifndef H5 -->
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
    <!-- #endif -->
    <view class="card-v2">
      <text class="section-title-v2">技术说明</text>
      <text class="card-text-v2">基于微信云开发构建。{{ aiLabel() }} 能力由 DeepSeek / 腾讯混元等国内大模型驱动，通过 CloudBase 云函数代理调用。</text>
      <text class="card-text-v2" style="margin-top:14rpx">Crush Credits 额度用于 {{ aiLabel() }} 调用计费，每次生成分析、月度复盘等均会消耗对应 token。</text>
      <text class="card-text-v2" style="margin-top:14rpx">语音识别由腾讯云 ASR 单独计费，不消耗 Crush Credits。</text>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">隐私政策</text>
      <text class="card-text-v2">本小程序仅收集提供服务所必需的信息：</text>
      <text class="card-text-v2" style="margin-top:10rpx">1. 微信 OpenID — 用于识别用户身份，登录时由微信自动分配，不含任何个人资料。</text>
      <text class="card-text-v2">2. 你主动填写或授权获取的信息 — 包括本人画像（昵称、头像、年龄阶段、性别、身份等）、关系记录、互动描述。这些信息仅用于 {{ aiLabel() }} 分析。</text>
      <text class="card-text-v2">3. 语音录音 — 用于语音转文字功能，仅在识别过程中使用，不会长期存储。</text>
      <text class="card-text-v2">4. 你主动上传的图片 — 如 Crush 头像、定制宠物形象等，存储于云开发环境。</text>
      <text class="card-text-v2" style="margin-top:10rpx">经你主动授权后（点击微信头像按钮或在昵称输入框聚焦），我们会获取你的微信头像和昵称，仅用于个人画像展示。你可以随时在画像编辑页修改或清除这些信息。所有数据存储在微信云开发环境中，不会分享给第三方。你可以随时在"我"页面删除账号，所有数据将被清除。</text>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">服务条款</text>
      <text class="card-text-v2">1. 本小程序提供 {{ aiLabel() }} 辅助分析服务，分析结果仅供娱乐参考，不构成专业建议。</text>
      <text class="card-text-v2" style="margin-top:8rpx">2. 用户应自行判断和承担基于分析结果所采取行动的风险。</text>
      <text class="card-text-v2" style="margin-top:8rpx">3. 禁止利用本服务进行骚扰、侵犯他人隐私或其他违法活动。</text>
      <text class="card-text-v2" style="margin-top:8rpx">4. 未成年人应在监护人指导下使用。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

const themeVars = ref(getThemeStyle())

// #ifdef H5
const ADMIN_TAP_COUNT = 5
const ADMIN_TAP_WINDOW_MS = 2000
let adminTapCount = 0
let adminTapStartedAt = 0

function handleAdminTap() {
  const now = Date.now()
  if (!adminTapStartedAt || now - adminTapStartedAt > ADMIN_TAP_WINDOW_MS) {
    adminTapCount = 1
    adminTapStartedAt = now
    return
  }

  adminTapCount += 1
  if (adminTapCount < ADMIN_TAP_COUNT) return

  adminTapCount = 0
  adminTapStartedAt = 0
  uni.navigateTo({ url: '/pages/admin-login/admin-login' })
}
// #endif

onLoad(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }
.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: var(--font-weight-hero, $fw-hero); color: var(--hero-text-color, #111); line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .info-row-v2 { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-bottom: 2rpx dashed var(--divider-strong, #111); }
.v2-mode .info-row-v2:last-child { border-bottom: none; }
.v2-mode .info-label-v2 { font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-muted, #666); }
.v2-mode .info-value-v2 { font-size: $fs-body-lg; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); }
</style>
