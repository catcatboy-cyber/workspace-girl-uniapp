<!--
  CampusSignalHome — 关系信号雷达首页（纯展示组件）
  数据通过 props 传入，事件通过 emits 传出。
  不调用 API，不修改状态，不写本地存储。
-->
<template>
  <view class="campus-signal" :style="pageStyle">
    <!-- ===== 1. 顶部状态条 ===== -->
    <view class="cs-top-bar">
      <view class="cs-brand">
        <text class="cs-brand-label">TODAY SIGNAL</text>
        <text class="cs-brand-name">Crush Master</text>
      </view>
      <view class="cs-status-chip">
        <view class="cs-status-dot" :class="statusDotClass"></view>
        <text>{{ statusLabel }}</text>
      </view>
    </view>

    <!-- ===== 2. 标题区 ===== -->
    <view v-if="!hasCase" class="cs-empty-hero">
      <text class="cs-empty-title">先做一次初次分析</text>
      <text class="cs-empty-sub">完成一轮结构化问答，然后补记录、看往事、重新分析。</text>
      <view class="cs-empty-actions">
        <view class="cs-empty-card" @click="$emit('start-assessment')">
          <text class="cs-empty-card-title">开始初评</text>
          <text class="cs-empty-card-sub">填 Crush 画像 + 回答 14 题 → AI 分析结果</text>
        </view>
        <view class="cs-empty-card" @click="$emit('quick-create')">
          <text class="cs-empty-card-title">快速创建</text>
          <text class="cs-empty-card-sub">只填 Crush 画像 → 30 秒建好</text>
        </view>
      </view>
    </view>

    <template v-else>
      <view class="cs-headline">
        <text class="cs-headline-title">今天的关系信号图</text>
      </view>

      <!-- ===== 3. 关系雷达 ===== -->
      <view class="cs-radar-map">
        <!-- 中心 Crush -->
        <view class="cs-center-orb" @click="$emit('open-case-detail')">
          <view class="cs-avatar-ring">
            <image v-if="caseAvatar" :src="caseAvatar" mode="aspectFill" class="cs-avatar-img" />
            <text v-else class="cs-avatar-text">{{ avatarInitial }}</text>
          </view>
        </view>
        <view class="cs-center-name">{{ caseName }}</view>
        <view class="cs-center-type">{{ caseTypeLabel }}</view>

        <!-- 光环（纯装饰） -->
        <view class="cs-halo cs-halo-h1"></view>
        <view class="cs-halo cs-halo-h2"></view>
        <view class="cs-halo cs-halo-h3"></view>

        <!-- 脉冲 -->
        <view v-if="hasLatestResult" class="cs-pulse"></view>

        <!-- 连线（从中心到节点） -->
        <view class="cs-line cs-line-record"></view>
        <view class="cs-line cs-line-voice"></view>
        <view class="cs-line cs-line-ai"></view>
        <view class="cs-line cs-line-taohua"></view>

        <!-- 节点：最新信号 -->
        <view class="cs-node cs-node-signal" @click="$emit('open-latest-signal')">
          <text class="cs-node-icon">{{ latestSignal?.emoji || '🔍' }}</text>
          <text class="cs-node-label">{{ latestSignal?.label || '最新信号' }}</text>
          <text class="cs-node-hint">{{ latestSignal ? '查看详情' : '记录后解锁' }}</text>
        </view>

        <!-- 节点：互动天平 -->
        <view class="cs-node cs-node-balance" @click="$emit('open-interaction-balance')">
          <text class="cs-node-icon">⚖️</text>
          <text class="cs-node-label">互动天平</text>
          <text class="cs-node-hint">{{ balanceCallout || '记录更多互动后解锁' }}</text>
        </view>

        <!-- 节点：今日桃花 -->
        <view class="cs-node cs-node-taohua" @click="$emit('open-taohua')">
          <text class="cs-node-icon">🌸</text>
          <text class="cs-node-label">今日桃花</text>
          <text class="cs-node-hint">{{ taohuaTeaserData ? taohuaTeaserData.direction : '加载中' }}</text>
        </view>

        <!-- 节点：桃花匹配 -->
        <view class="cs-node cs-node-pair" @click="$emit('open-pair-match')">
          <text class="cs-node-icon">💞</text>
          <text class="cs-node-label">桃花匹配</text>
          <text class="cs-node-hint">{{ pairMatch ? '查看匹配' : hasSelfProfile ? '开始匹配' : '完善画像后解锁' }}</text>
        </view>

        <!-- ===== 4. 指标区 ===== -->
        <view class="cs-metrics">
          <view class="cs-metric cs-metric-intent">
            <text class="cs-metric-value">{{ intentScore }}</text>
            <text class="cs-metric-label">意向</text>
          </view>
          <view class="cs-metric cs-metric-risk">
            <text class="cs-metric-value">{{ riskScore }}</text>
            <text class="cs-metric-label">风险</text>
          </view>
          <view class="cs-metric cs-metric-verify">
            <text class="cs-metric-value">{{ pendingVerificationLabel }}</text>
            <text class="cs-metric-label">待验证</text>
          </view>
        </view>
      </view>

      <!-- ===== 5. 快速记录 dock ===== -->
      <view class="cs-dock">
        <view class="cs-dock-row">
          <view class="cs-dock-title">
            <view class="cs-dock-live"></view>
            <view>
              <text class="cs-dock-title-text">小咪正在读信号</text>
              <text class="cs-dock-title-sub">截图 / 对话 / 语音都可投喂</text>
            </view>
          </view>
        </view>
        <view class="cs-dock-actions">
          <view class="cs-dock-btn cs-dock-btn-main" @click="$emit('open-quick-record', 'text')">
            <text>记一条</text>
          </view>
          <view class="cs-dock-btn" @click="$emit('open-quick-record', 'image')">
            <text>截图</text>
          </view>
          <view class="cs-dock-btn" @click="$emit('open-quick-record', 'voice')">
            <text>语音</text>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 6. 底部导航占位（由 tabBar 管理） ===== -->
    <view class="cs-tabbar-spacer"></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// ---- Props ----
const props = defineProps({
  pageStyle: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: true },
  hasCase: { type: Boolean, default: false },
  caseName: { type: String, default: '' },
  caseAvatar: { type: String, default: '' },
  caseTypeLabel: { type: String, default: 'Crush' },
  hasLatestResult: { type: Boolean, default: false },
  intentScore: { type: [Number, String], default: '暂无' },
  riskScore: { type: [Number, String], default: '暂无' },
  pendingVerificationLabel: { type: String, default: '暂无' },
  latestSignal: { type: Object as any, default: null },
  interactionBalance: { type: Object as any, default: null },
  balanceCallout: { type: String, default: '' },
  taohuaTeaserData: { type: Object as any, default: null },
  pairMatch: { type: Object as any, default: null },
  hasSelfProfile: { type: Boolean, default: false },
})

// ---- Emits ----
defineEmits([
  'open-case-detail',
  'open-latest-signal',
  'open-interaction-balance',
  'open-taohua',
  'open-pair-match',
  'open-quick-record',
  'start-assessment',
  'quick-create',
])

// ---- Computed ----
const avatarInitial = computed(() => {
  const name = props.caseName?.trim?.()
  return name ? name.slice(0, 1) : 'TA'
})

const statusDotClass = computed(() => {
  if (props.loading) return 'cs-status-idle'
  if (!props.hasCase) return 'cs-status-empty'
  if (props.hasLatestResult) return 'cs-status-active'
  return 'cs-status-idle'
})

const statusLabel = computed(() => {
  if (props.loading) return '加载中'
  if (!props.hasCase) return '未分析'
  if (props.hasLatestResult) return '在线研判'
  return '分析中'
})
</script>

<style scoped>
.campus-signal {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

/* ---- 顶部状态 ---- */
.cs-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 42rpx 22rpx 0;
}
.cs-brand-label {
  font-size: 18rpx;
  letter-spacing: 0.22em;
  color: var(--text-muted, #666);
  font-weight: 800;
  display: block;
}
.cs-brand-name {
  font-size: 36rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-status-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--text-main, #111);
  background: var(--card, #fff);
  font-size: 22rpx;
  font-weight: 800;
}
.cs-status-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  border: 2rpx solid var(--text-main, #111);
}
.cs-status-active { background: var(--mint, #4ECDC4); }
.cs-status-idle { background: var(--text-muted, #666); }
.cs-status-empty { background: var(--text-soft, #999); }

/* ---- 空状态 ---- */
.cs-empty-hero {
  margin: 40rpx 28rpx;
  padding: 40rpx 28rpx;
  border: 3rpx solid #111;
  box-shadow: 8rpx 8rpx 0 #111;
  background: var(--hero, #FF6B6B);
  transform: rotate(-0.5deg);
}
.cs-empty-title {
  font-size: 42rpx;
  font-weight: 900;
  color: #fff;
}
.cs-empty-sub {
  font-size: 28rpx;
  color: rgba(255,255,255,0.85);
  margin-top: 16rpx;
  display: block;
}
.cs-empty-actions {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.cs-empty-card {
  padding: 24rpx;
  background: #fff;
  border: 3rpx solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
}
.cs-empty-card-title {
  font-size: 34rpx;
  font-weight: 800;
}
.cs-empty-card-sub {
  font-size: 24rpx;
  color: var(--text-muted, #666);
  margin-top: 6rpx;
}

/* ---- 标题 ---- */
.cs-headline {
  padding: 28rpx 22rpx 8rpx;
}
.cs-headline-title {
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.1;
  color: var(--text-main, #111);
}

/* ---- 雷达地图 ---- */
.cs-radar-map {
  position: relative;
  height: 560rpx;
  margin: 8rpx 10rpx 0;
}
.cs-center-orb {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 140rpx;
  height: 140rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 3rpx solid #111;
  background: var(--hero, #FF6B6B);
  box-shadow: 6rpx 6rpx 0 #111;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.cs-avatar-ring {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: 3rpx solid #111;
  background: #fff;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cs-avatar-text {
  font-size: 42rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-center-name {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, 52rpx);
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-main, #111);
  text-align: center;
  z-index: 4;
}
.cs-center-type {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, 88rpx);
  font-size: 20rpx;
  font-weight: 700;
  color: var(--text-muted, #666);
  background: #111;
  color: #FFD93D;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  z-index: 4;
}

/* 光环 */
.cs-halo {
  position: absolute;
  left: 50%;
  top: 42%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.cs-halo-h1 {
  width: 320rpx;
  height: 320rpx;
  border: 2rpx solid var(--text-main, #111);
  opacity: 0.15;
}
.cs-halo-h2 {
  width: 260rpx;
  height: 260rpx;
  border: 2rpx dashed var(--text-main, #111);
  opacity: 0.1;
}
.cs-halo-h3 {
  width: 190rpx;
  height: 190rpx;
  border: 2rpx solid var(--mint, #4ECDC4);
  opacity: 0.12;
}

/* 脉冲 */
.cs-pulse {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2rpx solid var(--hero, #FF6B6B);
  opacity: 0;
  animation: cs-pulse-anim 2.6s ease-out infinite;
}
@keyframes cs-pulse-anim {
  0% { width: 140rpx; height: 140rpx; opacity: 0.5; }
  100% { width: 260rpx; height: 260rpx; opacity: 0; }
}

/* 连线 */
.cs-line {
  position: absolute;
  height: 1rpx;
  background: var(--text-main, #111);
  opacity: 0.2;
  transform-origin: left center;
}
.cs-line-record { left: 180rpx; top: 210rpx; width: 120rpx; transform: rotate(25deg); }
.cs-line-voice { right: 180rpx; top: 216rpx; width: 120rpx; transform: rotate(155deg); }
.cs-line-ai { left: 176rpx; top: 370rpx; width: 128rpx; transform: rotate(-28deg); }
.cs-line-taohua { right: 176rpx; top: 360rpx; width: 128rpx; transform: rotate(208deg); }

/* 节点 */
.cs-node {
  position: absolute;
  width: 130rpx;
  height: 100rpx;
  border-radius: 20rpx;
  border: 3rpx solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  z-index: 2;
}
.cs-node-icon { font-size: 28rpx; }
.cs-node-label { font-size: 22rpx; font-weight: 900; color: var(--text-main, #111); }
.cs-node-hint { font-size: 16rpx; color: var(--text-muted, #666); font-weight: 700; }

.cs-node-signal { left: 12rpx; top: 130rpx; }
.cs-node-balance { right: 12rpx; top: 140rpx; }
.cs-node-ai { left: 12rpx; top: 340rpx; }
.cs-node-taohua { right: 12rpx; top: 330rpx; }

/* 指标区 */
.cs-metrics {
  position: absolute;
  left: 50%;
  bottom: 12rpx;
  width: 420rpx;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
}
.cs-metric {
  height: 80rpx;
  border-radius: 12rpx;
  border: 3rpx solid #111;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cs-metric-value {
  font-size: 28rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-metric-label {
  font-size: 18rpx;
  color: var(--text-muted, #666);
  font-weight: 700;
  margin-top: 2rpx;
}
.cs-metric-intent .cs-metric-value { color: var(--mint, #4ECDC4); }
.cs-metric-risk .cs-metric-value { color: var(--risk, #FF5252); }
.cs-metric-verify .cs-metric-value { font-size: 24rpx; }

/* ---- dock ---- */
.cs-dock {
  margin: 20rpx 18rpx;
  padding: 20rpx;
  border: 3rpx solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
  background: #fff;
  border-radius: 16rpx;
}
.cs-dock-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.cs-dock-live {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--risk, #FF5252);
  margin-right: 10rpx;
}
.cs-dock-title-text {
  font-size: 26rpx;
  font-weight: 900;
  color: var(--text-main, #111);
  display: block;
}
.cs-dock-title-sub {
  font-size: 20rpx;
  color: var(--text-muted, #666);
  font-weight: 800;
}
.cs-dock-actions {
  display: grid;
  grid-template-columns: 1.25fr 0.75fr 0.75fr;
  gap: 10rpx;
}
.cs-dock-btn {
  height: 64rpx;
  border-radius: 12rpx;
  border: 3rpx solid #111;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-dock-btn-main {
  background: var(--hero, #FF6B6B);
  color: #fff;
  border-color: #111;
  box-shadow: 4rpx 4rpx 0 #111;
}

/* ---- tabbar spacer ---- */
.cs-tabbar-spacer {
  height: 120rpx;
}

@media (prefers-reduced-motion: reduce) {
  .cs-pulse { animation: none; }
}
</style>
