<template>
  <view v-if="visible" class="tds-mask" @click.stop="$emit('close')">
    <view class="tds-sheet" @click.stop>
      <!-- Topbar -->
      <view class="tds-topbar">
        <text class="tds-topbar-title">今日的TA</text>
        <view class="tds-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
      </view>

      <!-- Body -->
      <view class="tds-body">
        <!-- ❶ 今日气场 -->
        <view class="tds-aura-card">
          <view class="tds-aura-head">
            <view class="tds-card-kicker">
              <image class="tds-card-kicker-icon" src="/static/icons/taohua/star-filled.svg" mode="aspectFit" />
              <text>今日气场</text>
            </view>
            <text v-if="jianchu" class="tds-aura-badge">建除 · {{ jianchu }}</text>
          </view>
          <text class="tds-aura-text">{{ aura || '加载中...' }}</text>
        </view>

        <!-- ❷ 日支关系 -->
        <view class="tds-section-heading">
          <image class="tds-card-kicker-icon" src="/static/icons/taohua/heart-filled.svg" mode="aspectFit" />
          <text>日支 {{ dayZhi }} · 对你们的影响</text>
        </view>
        <view class="tds-ta-row">
          <view :class="['tds-ta-col', 'subject-self', selfRel === 'good' ? 'rel-good' : selfRel === 'bad' ? 'rel-bad' : 'rel-mid']">
            <text class="tds-ta-col-head">我 · {{ selfZhi || '--' }}</text>
            <text :class="['tds-ta-chip', selfRel === 'good' ? 'good' : selfRel === 'bad' ? 'bad' : 'mid']">{{ selfRelText || '平' }}</text>
            <text class="tds-ta-col-desc">{{ selfRel === 'good' ? '今天气场支持你主动推进，状态在线。' : selfRel === 'bad' ? '今天日支冲你的地支，容易敏感，别把小事放大。' : '今天能量平稳，按平常节奏就好。' }}</text>
          </view>
          <view :class="['tds-ta-col', 'subject-ta', crushRel === 'good' ? 'rel-good' : crushRel === 'bad' ? 'rel-bad' : 'rel-mid']">
            <text class="tds-ta-col-head">TA · {{ crushZhi || '--' }}</text>
            <text :class="['tds-ta-chip', crushRel === 'good' ? 'good' : crushRel === 'bad' ? 'bad' : 'mid']">{{ crushRelText || '平' }}</text>
            <text class="tds-ta-col-desc">{{ crushRel === 'bad' ? 'TA今天可能比较冷淡或回避，别逼太紧，给TA空间。' : crushRel === 'good' ? 'TA今天气场顺，适合轻松互动。' : 'TA今天状态平稳，正常相处就好。' }}</text>
          </view>
        </view>

        <!-- ❸ 综合建议 -->
        <view v-if="advice" class="tds-advice">
          <view class="tds-card-kicker">
            <image class="tds-card-kicker-icon" src="/static/icons/taohua/bulb.svg" mode="aspectFit" />
            <text>综合建议</text>
          </view>
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
  animation: tds-slide-up .3s ease-out;
  box-sizing: border-box;
}
@keyframes tds-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* ═══ TOPBAR ═══ */
.tds-topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 28rpx 12rpx;
}
.tds-topbar-title { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.tds-topbar-close { width: 56rpx; height: 56rpx; border-radius: 50%; @include border-soft; display: flex; align-items: center; justify-content: center; font-size: $fs-heading; color: var(--text-muted, #666); }

/* ═══ BODY ═══ */
.tds-body { padding: 0 24rpx 24rpx; }
.tds-card-kicker,
.tds-section-heading { display: flex; align-items: center; gap: 6rpx; font-size: $fs-body-sm; font-weight: $fw-label; color: var(--text-main, #111); }
.tds-card-kicker-icon { width: 26rpx; height: 26rpx; flex-shrink: 0; }
.tds-section-heading { margin: 0 0 12rpx; }

/* ❶ 今日气场 */
.tds-aura-card {
  padding: 20rpx 24rpx; margin-bottom: 16rpx;
  background: var(--insight-gradient-warm, linear-gradient(160deg, #FFFBEA 0%, #FFF3D0 100%));
  border-radius: var(--shape-radius-card, 0);
  @include border-hard;
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.tds-aura-head { display: flex; justify-content: space-between; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.tds-aura-head .tds-card-kicker { color: var(--insight-accent-warm, #9A7200); }
.tds-aura-badge { @include tag-v2; @include tag-v2-black; flex-shrink: 0; min-height: 36rpx; font-size: $fs-caption; padding: 2rpx 12rpx; }
.tds-aura-text { display: block; font-size: $fs-body-sm; font-weight: $fw-body; color: var(--text-main, #111); line-height: $lh-body; }

/* ❷ 日支关系 */
.tds-ta-row { display: flex; gap: $sp-section-gap; }
.tds-ta-col {
  flex: 1; min-width: 0; text-align: center; padding: 20rpx 16rpx;
  @include border-hard;
  border-radius: var(--shape-radius-card, 0);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
  box-sizing: border-box;
}
.tds-ta-col.subject-self { background: var(--insight-gradient-cool, linear-gradient(160deg, #F7F4FF 0%, #E9E2FA 52%, #DDD3F3 100%)); }
.tds-ta-col.subject-ta { background: var(--insight-gradient-peach, linear-gradient(160deg, #FFF8F0 0%, #FFE8D0 52%, #FFD8BC 100%)); }
.tds-ta-col.rel-good { border-left: 8rpx solid var(--relation-good, #1A6B5A); }
.tds-ta-col.rel-bad { border-left: 8rpx solid var(--relation-bad, #D33F49); }
.tds-ta-col.rel-mid { border-left: 8rpx solid var(--text-soft, #999); }
.tds-ta-col-head { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #666); }
.tds-ta-chip { display: inline-block; margin: 10rpx 0 12rpx; padding: 6rpx 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-body-sm; font-weight: $fw-label; }
.tds-ta-chip.good { background: var(--mint-soft, #E0FFF0); color: var(--relation-good, #1A6B5A); }
.tds-ta-chip.bad  { background: var(--risk-soft, #FFEEEC); color: var(--relation-bad, #D33F49); }
.tds-ta-chip.mid  { background: var(--surface, #fff); color: var(--text-muted, #666); }
.tds-ta-col-desc { display: block; text-align: left; font-size: $fs-body-sm; font-weight: $fw-body; color: var(--text-main, #111); line-height: $lh-body; }

/* ❸ 综合建议 */
.tds-advice {
  margin-top: 16rpx; padding: 20rpx 24rpx;
  background: var(--insight-gradient-mint, linear-gradient(160deg, #F5FFFA 0%, #D8F0E4 52%, #C0E8D4 100%));
  border-radius: var(--shape-radius-card, 0);
  @include border-hard;
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.tds-advice .tds-card-kicker { margin-bottom: 6rpx; color: var(--insight-accent-mint, #1A6B5A); }
.tds-advice-text { display: block; font-size: $fs-body-sm; font-weight: $fw-body; color: var(--text-main, #111); line-height: $lh-body; }
</style>
