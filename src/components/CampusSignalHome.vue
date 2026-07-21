<!--
  CampusSignalHome — 关系信号雷达首页（纯展示组件）
  数据通过 props 传入，事件通过 emits 传出。
  不调用 API，不修改状态，不写本地存储。
  视觉完全走主题 CSS 变量（丝绒日记 / 青春硬边），不硬编码黑边黑硬阴影。
-->
<template>
  <view :class="['campus-signal', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
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
        <text class="cs-headline-title">今日心动雷达</text>
      </view>

      <!-- ===== 3. 关系雷达 ===== -->
      <view class="cs-radar-map">
        <!-- 中心 Crush -->
        <view class="cs-center-orb" @click="onAvatarClick">
          <view class="cs-avatar-ring">
            <image v-if="caseAvatar" :src="caseAvatar" mode="aspectFill" class="cs-avatar-img" />
            <text v-else class="cs-avatar-text">{{ avatarInitial }}</text>
          </view>
        </view>
        <view class="cs-center-name">{{ caseName }}</view>
        <view class="cs-center-type">{{ caseTypeLabel }}</view>
        <view v-if="profileItems && profileItems.length > 0" class="cs-center-tags">
          <text v-for="item in profileItems" :key="item" class="cs-center-tag">{{ item }}</text>
        </view>

        <!-- 扫描光束 -->
        <view class="cs-beam"></view>

        <!-- 光环 -->
        <view class="cs-halo cs-halo-h1"></view>
        <view class="cs-halo cs-halo-h2"></view>
        <view class="cs-halo cs-halo-h3"></view>

        <!-- 脉冲 -->
        <view v-if="hasLatestResult" class="cs-pulse"></view>

        <!-- 节点：最新信号 -->
        <view class="cs-node cs-node-signal" @click="$emit('open-latest-signal')">
          <image v-if="signalIconSrc" class="cs-node-icon-img" :src="signalIconSrc" mode="aspectFit" />
          <text class="cs-node-label">{{ latestSignal?.label || '最新信号' }}</text>
          <text class="cs-node-hint">{{ latestSignal ? '查看详情' : '记录后解锁' }}</text>
        </view>

        <!-- 节点：互动天平 -->
        <view class="cs-node cs-node-balance" @click="$emit('open-interaction-balance')">
          <image class="cs-node-icon-img" src="/static/icons/taohua/scale.svg" mode="aspectFit" />
          <text class="cs-node-label">互动天平</text>
          <text class="cs-node-hint">{{ balanceCallout || '记录更多互动后解锁' }}</text>
        </view>

        <!-- 节点：今日桃花 -->
        <view class="cs-node cs-node-taohua" @click="$emit('open-taohua')">
          <image class="cs-node-icon-img" src="/static/icons/taohua/flower.svg" mode="aspectFit" />
          <text class="cs-node-label">今日桃花</text>
          <text class="cs-node-hint">{{ taohuaTeaserData ? taohuaTeaserData.direction : '加载中' }}</text>
        </view>

        <!-- 节点：行动指南 -->
        <view class="cs-node cs-node-pair" @click="$emit('open-guidance')">
          <image class="cs-node-icon-img" src="/static/icons/taohua/compass.svg" mode="aspectFit" />
          <text class="cs-node-label">行动指南</text>
          <view class="cs-node-hint"><block v-for="(seg, si) in guidanceHint" :key="si"><image v-if="seg.type === 'icon'" class="cs-hint-icon" :src="seg.src" mode="aspectFit" /><text v-else>{{ seg.value }}</text></block></view>
        </view>

        <!-- 花瓣飘落 -->
        <view class="cs-petals">
          <view v-for="i in 8" :key="i" class="cs-petal" :style="petalStyle(i)" />
        </view>
      </view>

      <!-- 头像放大预览 -->
      <view v-if="showPhotoPreview" class="cs-photo-overlay"
        @click="showPhotoPreview = false"
        @touchmove.stop.prevent="() => {}"
      >
        <image :src="caseAvatar" mode="aspectFit" class="cs-photo-full" />
      </view>

      <!-- ===== 4. 指标区 ===== -->
      <view class="cs-metrics">
        <view class="cs-metric cs-metric-intent">
          <text class="cs-metric-value">{{ intentScore }}</text>
          <text class="cs-metric-label">意向分</text>
        </view>
        <view class="cs-metric cs-metric-risk">
          <text class="cs-metric-value">{{ riskScore }}</text>
          <text class="cs-metric-label">风险分</text>
        </view>
        <view class="cs-metric cs-metric-taohua">
          <text class="cs-metric-value">{{ taohuaScore }}</text>
          <text class="cs-metric-label">桃花运</text>
        </view>
      </view>

      <!-- ===== 5. 快速记录 dock ===== -->
      <view class="cs-dock">
        <view class="cs-dock-row">
          <view class="cs-dock-title">
            <view class="cs-dock-live"></view>
            <view>
              <text class="cs-dock-title-text">把今天的心动，留下一点线索</text>
              <text class="cs-dock-title-sub">一句话、一个画面，或一段声音，都值得被记住。</text>
            </view>
          </view>
        </view>
        <view class="cs-dock-actions">
          <view class="cs-dock-btn cs-dock-btn-main" @click="$emit('open-quick-record', 'text')">
            <image class="cs-dock-btn-icon-img" src="/static/icons/taohua/pencil.svg" mode="aspectFit" />
            <text>记一条</text>
          </view>
          <view class="cs-dock-btn" @click="$emit('open-quick-record', 'image')">
            <image class="cs-dock-btn-icon-img" src="/static/icons/taohua/image.svg" mode="aspectFit" />
            <text>截图</text>
          </view>
          <view class="cs-dock-btn" @click="$emit('open-quick-record', 'voice')">
            <image class="cs-dock-btn-icon-img" src="/static/icons/taohua/mic.svg" mode="aspectFit" />
            <text>语音</text>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 6. 底部导航占位（由 tabBar 管理） ===== -->
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseEmojiText } from '@/utils/zodiac-icons'

  // 信号图标：直接用 mapEventSignal 返回的 svg 路径
  const signalIconSrc = computed(() => props.latestSignal?.svg || '')
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
  taohuaScore: { type: [Number, String], default: '--' },
  profileItems: { type: Array as any, default: () => [] },
  latestSignal: { type: Object as any, default: null },
  interactionBalance: { type: Object as any, default: null },
  balanceCallout: { type: String, default: '' },
  taohuaTeaserData: { type: Object as any, default: null },
  petName: { type: String, default: '小咪' },
  guidanceText: { type: String, default: '' },
  hasSelfProfile: { type: Boolean, default: false },
  fontSizeMode: { type: String, default: 'default' },
})

// ---- Emits ----
const emit = defineEmits([
  'open-case-detail',
  'open-latest-signal',
  'open-interaction-balance',
  'open-taohua',
  'open-guidance',
  'open-quick-record',
  'start-assessment',
  'quick-create',
])

// ---- 头像点击：有照片放大预览，无照片进详情 ----
const showPhotoPreview = ref(false)
function onAvatarClick() {
  if (props.caseAvatar) { showPhotoPreview.value = true }
  else { emit('open-case-detail') }
}

// ---- 花瓣动画 ----
const petalPresets = [
  { top: '2%',  left: '10%', dur: '4.5s', delay: '0s',   drift: '40rpx', spin: '360deg',  size: 22 },
  { top: '5%',  left: '25%', dur: '3.8s', delay: '0.6s', drift: '-30rpx',spin: '-320deg', size: 28 },
  { top: '1%',  left: '45%', dur: '5s',   delay: '1.2s', drift: '50rpx', spin: '400deg',  size: 18 },
  { top: '8%',  left: '60%', dur: '4.2s', delay: '1.8s', drift: '-35rpx',spin: '-350deg', size: 24 },
  { top: '3%',  left: '75%', dur: '3.5s', delay: '0.3s', drift: '30rpx', spin: '280deg',  size: 32 },
  { top: '6%',  left: '88%', dur: '4.8s', delay: '2.1s', drift: '-45rpx',spin: '-380deg', size: 20 },
  { top: '4%',  left: '15%', dur: '4s',   delay: '2.7s', drift: '25rpx', spin: '310deg',  size: 26 },
  { top: '7%',  left: '52%', dur: '5.2s', delay: '3.3s', drift: '-30rpx',spin: '-420deg', size: 16 },
]
function petalStyle(i: number) {
  const p = petalPresets[i - 1] || petalPresets[0]
  return {
    top: p.top, left: p.left,
    '--d': p.dur, '--delay': p.delay,
    '--drift': p.drift, '--spin': p.spin,
    '--sz': p.size + 'rpx',
  }
}

// ---- Computed ----
const guidanceHint = computed(() => {
  if (props.taohuaTeaserData?.summary) return parseEmojiText(props.taohuaTeaserData.summary)
  return parseEmojiText('完善画像后解锁')
})
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
  font-size: 22rpx;
  letter-spacing: 0.22em;
  color: var(--text-muted, #666);
  font-weight: 800;
  display: block;
}
.cs-brand-name {
  font-size: 38rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-status-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  font-size: 22rpx;
  font-weight: 800;
  color: var(--text-main, #111);
}
.cs-status-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  border: var(--border-width, 2rpx) solid var(--border, #111);
}
.cs-status-active { background: var(--accent-cool, #4ECDC4); }
.cs-status-idle { background: var(--text-muted, #666); }
.cs-status-empty { background: var(--text-soft, #999); }

/* ---- 空状态 ---- */
.cs-empty-hero {
  margin: 40rpx 28rpx;
  padding: 40rpx 28rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-card, 0);
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
  background: var(--hero-bg, #FF6B6B);
}
.cs-empty-title {
  font-size: 42rpx;
  font-weight: 900;
  color: #fff;
}
.cs-empty-sub {
  font-size: 34rpx;
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
  background: var(--surface, #fff);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-card, 0);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.cs-empty-card-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-main, #111);
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
  font-size: 50rpx;
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
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--hero-bg, #FF6B6B);
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}
.cs-avatar-ring {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--surface, #fff);
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

/* 头像放大预览 */
.cs-photo-overlay {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  animation: cs-fade-in 0.25s ease;
}
.cs-photo-full {
  width: 80vw; height: 80vw; max-width: 600rpx; max-height: 600rpx;
  border-radius: 24rpx;
  border: 4rpx solid var(--surface, #fff);
  box-shadow: 0 16rpx 48rpx rgba(0,0,0,.4);
  animation: cs-photo-zoom 0.35s cubic-bezier(.34,1.56,.64,1);
}
@keyframes cs-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cs-photo-zoom {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
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
  font-size: 32rpx;
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
  font-size: 22rpx;
  font-weight: 700;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  padding: 2rpx 12rpx;
  border-radius: var(--shape-radius-control, 4rpx);
  z-index: 4;
}
.cs-center-tags {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, 120rpx);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6rpx;
  z-index: 4;
}
.cs-center-tag {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-soft, #999);
  border: 1rpx solid var(--border, #111);
  border-radius: 8rpx;
  padding: 2rpx 10rpx;
  white-space: nowrap;
}

/* 扫描光束 */
.cs-beam {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 320rpx;
  height: 320rpx;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: conic-gradient(from -20deg, transparent, var(--accent-cool, #4ECDC4), transparent 32%);
  opacity: 0.18;
  animation: cs-beam-spin 7s linear infinite;
}
@keyframes cs-beam-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
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
  border: 2rpx solid var(--border, #111);
  opacity: 0.15;
}
.cs-halo-h2 {
  width: 260rpx;
  height: 260rpx;
  border: 2rpx dashed var(--border, #111);
  opacity: 0.1;
  animation: cs-halo-spin 28s linear infinite;
}
.cs-halo-h3 {
  width: 190rpx;
  height: 190rpx;
  border: 2rpx solid var(--accent-cool, #4ECDC4);
  opacity: 0.12;
  animation: cs-halo-spin-rev 18s linear infinite;
}
@keyframes cs-halo-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes cs-halo-spin-rev {
  to { transform: translate(-50%, -50%) rotate(-360deg); }
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
  border: 2rpx solid var(--hero-bg, #FF6B6B);
  opacity: 0;
  animation: cs-pulse-anim 2.6s ease-out infinite;
}
@keyframes cs-pulse-anim {
  0% { width: 140rpx; height: 140rpx; opacity: 0.5; }
  100% { width: 260rpx; height: 260rpx; opacity: 0; }
}

/* 花瓣飘落 */
.cs-petals { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.cs-petal { position: absolute; width: var(--sz, 22rpx); height: var(--sz, 22rpx); background: var(--hero, #FF6B6B); border-radius: 50% 0 50% 50%; opacity: 0; animation: cs-petal-fall var(--d, 4s) var(--delay, 0s) ease-in infinite; }
.cs-petal:nth-child(odd) { background: #f08c80; border-radius: 50% 50% 0 50%; }
@keyframes cs-petal-fall { 0% { opacity: 0; transform: translate(0, -16rpx) rotate(0deg) scale(.5); } 8% { opacity: .7; } 60% { opacity: .35; } 100% { opacity: 0; transform: translate(var(--drift, 36rpx), 440rpx) rotate(var(--spin, 360deg)) scale(.2); } }

/* 节点 — 幽灵模式：平时透明无边框，雷达扫到才亮起 */
.cs-node {
  position: absolute;
  width: 130rpx;
  height: 100rpx;
  border-radius: var(--shape-radius-inner, 20rpx);
  border: 3rpx solid transparent;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  z-index: 2;
  transition: box-shadow 0.6s ease, border-color 0.6s ease;
}
.cs-node-icon-img { width: 32rpx; height: 32rpx; flex-shrink: 0; opacity: 0.65; transition: opacity 0.6s ease; }
.cs-node-label { font-size: 22rpx; font-weight: 900; color: var(--text-main, #111); opacity: 0.7; transition: opacity 0.6s ease; }
.cs-node-hint { display: flex; align-items: center; gap: 2rpx; font-size: 22rpx; color: var(--text-muted, #666); font-weight: 700; max-width: 110rpx; overflow: hidden; opacity: 0.65; transition: opacity 0.6s ease; } .cs-hint-icon { width: 20rpx; height: 20rpx; flex-shrink: 0; }

/* 节点光束扫过：渐亮渐暗 */
.cs-node-signal { left: 12rpx; top: 130rpx; animation: cs-node-hit 7s ease-in-out infinite; animation-delay: 5.25s; }
.cs-node-balance { right: 12rpx; top: 140rpx; animation: cs-node-hit 7s ease-in-out infinite; animation-delay: 0s; }
.cs-node-taohua { right: 12rpx; top: 330rpx; animation: cs-node-hit 7s ease-in-out infinite; animation-delay: 1.75s; }
.cs-node-pair { left: 12rpx; top: 340rpx; animation: cs-node-hit 7s ease-in-out infinite; animation-delay: 3.5s; }
@keyframes cs-node-hit {
  0%, 100% { box-shadow: 0 0 0 transparent; border-color: transparent; }
  15% { box-shadow: 0 0 44rpx var(--accent-cool, #4ECDC4); border-color: var(--accent-cool, #4ECDC4); }
  30% { box-shadow: 0 0 0 transparent; border-color: transparent; }
}
.cs-node-signal .cs-node-icon-img,
.cs-node-signal .cs-node-label,
.cs-node-signal .cs-node-hint {
  animation: cs-node-text-glow 7s ease-in-out infinite;
  animation-delay: 5.25s;
}
.cs-node-balance .cs-node-icon-img,
.cs-node-balance .cs-node-label,
.cs-node-balance .cs-node-hint {
  animation: cs-node-text-glow 7s ease-in-out infinite;
  animation-delay: 0s;
}
.cs-node-taohua .cs-node-icon-img,
.cs-node-taohua .cs-node-label,
.cs-node-taohua .cs-node-hint {
  animation: cs-node-text-glow 7s ease-in-out infinite;
  animation-delay: 1.75s;
}
.cs-node-pair .cs-node-icon-img,
.cs-node-pair .cs-node-label,
.cs-node-pair .cs-node-hint {
  animation: cs-node-text-glow 7s ease-in-out infinite;
  animation-delay: 3.5s;
}
@keyframes cs-node-text-glow {
  0%, 100% { opacity: 0.65; }
  15% { opacity: 1; }
  30% { opacity: 0.65; }
}

/* 指标区 */
.cs-metrics {
  margin: 16rpx 18rpx 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
}
.cs-metric {
  height: 96rpx;
  border-radius: var(--shape-radius-inner, 12rpx);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
  background: var(--surface, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cs-metric-value {
  font-size: 32rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-metric-label {
  font-size: 22rpx;
  color: var(--text-muted, #666);
  font-weight: 700;
  margin-top: 4rpx;
}
.cs-metric-intent .cs-metric-value { color: var(--accent-cool, #4ECDC4); }
.cs-metric-risk .cs-metric-value { color: var(--risk, #FF5252); }
.cs-metric-taohua .cs-metric-value { color: var(--accent, #FFD93D); }

/* ---- dock ---- */
.cs-dock {
  margin: 20rpx 18rpx;
  padding: 20rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
  background: var(--surface, #fff);
  border-radius: var(--shape-radius-card, 16rpx);
}
.cs-dock-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.cs-dock-title {
  display: flex;
  align-items: center;
}
.cs-dock-live {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--risk, #FF5252);
  margin-right: 10rpx;
}
.cs-dock-title-text {
  font-size: 32rpx;
  font-weight: 900;
  color: var(--text-main, #111);
  display: block;
}
.cs-dock-title-sub {
  font-size: 22rpx;
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
  border-radius: var(--shape-radius-control, 12rpx);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  font-size: 24rpx;
  font-weight: 900;
  color: var(--text-main, #111);
}
.cs-dock-btn-icon-img { width: 26rpx; height: 26rpx; flex-shrink: 0; }
.cs-dock-btn-main {
  background: var(--accent-cool, #4ECDC4);
  color: var(--text-main, #111);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}

/* ---- tabbar spacer ---- */

/* ═══ 大字体模式 ═══ */
.font-large .cs-brand-label { font-size: 24rpx; }
.font-large .cs-brand-name { font-size: 42rpx; }
.font-large .cs-status-chip { font-size: 24rpx; }
.font-large .cs-headline-title { font-size: 56rpx; }
.font-large .cs-empty-title { font-size: 50rpx; }
.font-large .cs-empty-sub { font-size: 38rpx; }
.font-large .cs-empty-card-title { font-size: 38rpx; }
.font-large .cs-empty-card-sub { font-size: 28rpx; }
.font-large .cs-center-name { font-size: 38rpx; }
.font-large .cs-center-type { font-size: 24rpx; }
.font-large .cs-center-tag { font-size: 24rpx; }
.font-large .cs-node-label { font-size: 24rpx; }
.font-large .cs-node-hint { font-size: 24rpx; }
.font-large .cs-metric-value { font-size: 38rpx; }
.font-large .cs-metric-label { font-size: 24rpx; }
.font-large .cs-dock-title-text { font-size: 38rpx; }
.font-large .cs-dock-title-sub { font-size: 24rpx; }
.font-large .cs-dock-btn { font-size: 28rpx; }

@media (prefers-reduced-motion: reduce) {
  .cs-pulse, .cs-beam, .cs-halo-h2, .cs-halo-h3,
  .cs-node-signal, .cs-node-balance, .cs-node-taohua, .cs-node-pair { animation: none; }
}
</style>
