<template>
  <view v-if="visible" class="tds-mask" @click.stop="$emit('close')">
    <view class="tds-sheet" @click.stop>
      <!-- Topbar -->
      <view class="tds-topbar">
        <view class="tds-topbar-title"><image class="tds-topbar-title-icon" src="/static/icons/taohua/heart-filled.svg" mode="aspectFit" /><text>今日的TA</text></view>
        <view class="tds-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
      </view>

      <!-- Body -->
      <view class="tds-body">
        <!-- ❶ 今日气场 -->
        <view class="tds-aura-card">
          <view class="tds-aura-head">
            <text class="tds-aura-label">今日气场</text>
            <text v-if="jianchu" class="tds-aura-badge">建除 · {{ jianchu }}</text>
          </view>
          <text class="tds-aura-text">{{ aura || '加载中...' }}</text>
        </view>

        <!-- ❷ 日支关系 -->
        <text class="tds-subtitle">日支 {{ dayZhi }} · 对你们的影响</text>
        <view class="tds-ta-row">
          <view class="tds-ta-col">
            <text class="tds-ta-col-head">我 · {{ selfZhi || '--' }}</text>
            <text :class="['tds-ta-chip', selfRel === 'good' ? 'good' : selfRel === 'bad' ? 'bad' : 'mid']">{{ selfRelText || '平' }}</text>
            <text class="tds-ta-col-desc">{{ selfRel === 'good' ? '今天气场支持你主动推进，状态在线。' : selfRel === 'bad' ? '今天日支冲你的地支，容易敏感，别把小事放大。' : '今天能量平稳，按平常节奏就好。' }}</text>
          </view>
          <view class="tds-ta-col">
            <text class="tds-ta-col-head">TA · {{ crushZhi || '--' }}</text>
            <text :class="['tds-ta-chip', crushRel === 'good' ? 'good' : crushRel === 'bad' ? 'bad' : 'mid']">{{ crushRelText || '平' }}</text>
            <text class="tds-ta-col-desc">{{ crushRel === 'bad' ? 'TA今天可能比较冷淡或回避，别逼太紧，给TA空间。' : crushRel === 'good' ? 'TA今天气场顺，适合轻松互动。' : 'TA今天状态平稳，正常相处就好。' }}</text>
          </view>
        </view>

        <!-- ❸ 综合建议 -->
        <view v-if="advice" class="tds-advice">
          <text class="tds-advice-label">💡 综合建议</text>
          <text class="tds-advice-text">{{ advice }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  dayZhi: string
  selfZhi: string
  crushZhi: string
  selfRel: string
  crushRel: string
  selfRelText: string
  crushRelText: string
  aura: string
  jianchu: string
  advice: string
}>()

defineEmits<{ close: [] }>()
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

/* ═══ MASK + SHEET ═══ */
.tds-mask { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; }
.tds-sheet {
  width: 100%; max-height: 88vh; overflow-y: auto;
  padding: 0 0 calc(140rpx + env(safe-area-inset-bottom));
  background: var(--app-bg, #FFFDF5);
  border-radius: 24rpx 24rpx 0 0;
  border-top: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hero, 0 -8rpx 0 #111);
  box-sizing: border-box;
}
@keyframes tds-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* ═══ TOPBAR ═══ */
.tds-topbar {
  position: sticky; top: 0; z-index: 3;
  display: flex; align-items: center; justify-content: space-between;
  padding: $sp-card-pad $sp-card-pad 20rpx;
  background: var(--app-bg, #FFFDF5);
  border-bottom: 1rpx solid var(--divider, #ddd);
}
.tds-topbar-title { display: flex; align-items: center; gap: 10rpx; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.tds-topbar-title-icon { width: 30rpx; height: 30rpx; }
.tds-topbar-close { width: 56rpx; height: 56rpx; border-radius: 50%; @include border-soft; display: flex; align-items: center; justify-content: center; font-size: $fs-heading; color: var(--text-muted, #666); }

/* ═══ BODY ═══ */
.tds-body { padding: $sp-card-pad; }
.tds-subtitle { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: var(--text-muted, #666); margin-bottom: 20rpx; }

/* ❶ 今日气场 */
.tds-aura-card { padding: 20rpx 24rpx; margin-bottom: 20rpx; background: var(--accent-soft, #FFFBEB); @include border-soft; }
.tds-aura-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.tds-aura-label { font-size: $fs-caption; color: var(--text-muted, #666); }
.tds-aura-badge { @include tag-v2-black; font-size: $fs-caption; padding: 2rpx 12rpx; }
.tds-aura-text { display: block; font-size: $fs-body; font-weight: $fw-heading; color: var(--text-main, #111); line-height: 1.5; }

/* ❷ 日支关系 */
.tds-ta-row { display: flex; gap: $sp-section-gap; }
.tds-ta-col { flex: 1; text-align: center; padding: 24rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); }
.tds-ta-col-head { font-size: $fs-caption; color: var(--text-muted, #666); margin-bottom: 8rpx; }
.tds-ta-chip { display: inline-block; margin-top: 8rpx; padding: 6rpx 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-body; font-weight: $fw-heading; }
.tds-ta-chip.good { background: var(--mint-soft, #E0FFF0); color: var(--relation-good, #4ECDC4); }
.tds-ta-chip.bad  { background: var(--risk-soft, #FFEEEC); color: var(--relation-bad, #D33F49); }
.tds-ta-chip.mid  { background: var(--surface, #fff); color: var(--text-muted, #666); }
.tds-ta-col-desc { margin-top: 12rpx; font-size: $fs-caption; color: var(--text-muted, #666); line-height: 1.5; }

/* ❸ 综合建议 */
.tds-advice { margin-top: 20rpx; padding: 20rpx 24rpx; background: var(--brand-cool, #f5f5ff); @include border-soft; }
.tds-advice-label { display: block; font-size: $fs-body; font-weight: $fw-heading; color: var(--text-main, #111); margin-bottom: 6rpx; }
.tds-advice-text { display: block; font-size: $fs-body; color: var(--text-main, #111); line-height: 1.5; }

/* ═══ .font-large ═══ */
.font-large .tds-topbar-title { font-size: 44rpx; }
.font-large .tds-subtitle { font-size: 38rpx; }
.font-large .tds-aura-text { font-size: 36rpx; }
.font-large .tds-ta-chip { font-size: 36rpx; }
.font-large .tds-ta-col-desc { font-size: 28rpx; }
.font-large .tds-advice-label { font-size: 36rpx; }
.font-large .tds-advice-text { font-size: 36rpx; }
</style>
