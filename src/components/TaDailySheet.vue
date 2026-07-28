<template>
  <view v-if="visible" class="bs-mask" @click.stop="$emit('close')">
    <view class="bs-sheet" @click.stop>
      <!-- Topbar -->
      <view class="bs-topbar">
        <view class="bs-topbar-title"><image class="bs-topbar-title-icon" src="/static/icons/taohua/heart-filled.svg" mode="aspectFit" /><text>今日的TA</text></view>
        <view class="bs-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
      </view>

      <!-- Body -->
      <view class="bs-body">
        <!-- ❶ 今日气场 -->
        <view class="bs-aura-card">
          <text class="bs-aura-label">今日气场</text>
          <text class="bs-aura-text">{{ aura || '加载中...' }}</text>
        </view>

        <!-- ❷ 日支关系 -->
        <text class="bs-subtitle">日支 {{ dayZhi }} · 对你们的影响</text>
        <view class="bs-ta-row">
          <view class="bs-ta-col">
            <text class="bs-ta-col-head">我 · {{ selfZhi || '--' }}</text>
            <text :class="['bs-ta-chip', selfRel === 'good' ? 'good' : selfRel === 'bad' ? 'bad' : 'mid']">{{ selfRelText || '平' }}</text>
            <text class="bs-ta-col-desc">{{ selfRel === 'good' ? '今天气场支持你主动推进，状态在线。' : selfRel === 'bad' ? '今天日支冲你的地支，容易敏感，别把小事放大。' : '今天能量平稳，按平常节奏就好。' }}</text>
          </view>
          <view class="bs-ta-col">
            <text class="bs-ta-col-head">TA · {{ crushZhi || '--' }}</text>
            <text :class="['bs-ta-chip', crushRel === 'good' ? 'good' : crushRel === 'bad' ? 'bad' : 'mid']">{{ crushRelText || '平' }}</text>
            <text class="bs-ta-col-desc">{{ crushRel === 'bad' ? 'TA今天可能比较冷淡或回避，别逼太紧，给TA空间。' : crushRel === 'good' ? 'TA今天气场顺，适合轻松互动。' : 'TA今天状态平稳，正常相处就好。' }}</text>
          </view>
        </view>

        <!-- ❸ 综合建议 -->
        <view v-if="advice" class="bs-advice">
          <text class="bs-advice-label">💡 综合建议</text>
          <text class="bs-advice-text">{{ advice }}</text>
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
  advice: string
}>()

defineEmits<{ close: [] }>()
</script>

<style scoped>
/* ═══ MASK + SHEET（复用 BalanceSheet 同款） ═══ */
.bs-mask { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; }
.bs-sheet { width: 100%; max-height: 88vh; overflow-y: auto; padding: 0 0 calc(140rpx + env(safe-area-inset-bottom)); background: var(--app-bg, #FFFDF5); border-radius: 24rpx 24rpx 0 0; border-top: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hero, 0 -8rpx 0 #111); animation: bs-slide-up 0.3s ease-out; box-sizing: border-box; }
@keyframes bs-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

.bs-topbar { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx 20rpx; background: var(--app-bg, #FFFDF5); border-bottom: 1rpx solid var(--divider, #ddd); }
.bs-topbar-title { display: flex; align-items: center; gap: 10rpx; font-size: var(--fs-heading, 38rpx); font-weight: var(--font-weight-heading, 800); color: var(--text-main, #111); }
.bs-topbar-title-icon { width: 30rpx; height: 30rpx; }
.bs-topbar-close { font-size: 44rpx; line-height: 1; color: var(--text-soft, #999); padding: 0 8rpx; }

.bs-body { padding: 24rpx 32rpx; }
.bs-subtitle { display: block; font-size: var(--fs-body-lg, 34rpx); font-weight: var(--font-weight-heading, 800); color: var(--text-muted, #666); margin-bottom: 16rpx; }

/* ❶ 今日气场 */
.bs-aura-card { padding: 18rpx 22rpx; background: var(--accent-soft, #FFFBEB); border: var(--border-width, 2rpx) solid var(--border, #111); margin-bottom: 20rpx; }
.bs-aura-label { display: block; font-size: var(--fs-caption, 24rpx); color: var(--text-muted, #666); margin-bottom: 4rpx; }
.bs-aura-text { display: block; font-size: var(--fs-body, 32rpx); font-weight: var(--font-weight-heading, 800); color: var(--text-main, #111); line-height: 1.4; }

/* ❷ 日支关系 */
.bs-ta-row { display: flex; gap: 20rpx; }
.bs-ta-col { flex: 1; text-align: center; padding: 24rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); }
.bs-ta-col-head { font-size: var(--fs-caption, 24rpx); color: var(--text-muted, #666); margin-bottom: 8rpx; }
.bs-ta-chip { display: inline-block; margin-top: 8rpx; padding: 6rpx 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); font-size: var(--fs-body, 32rpx); font-weight: var(--font-weight-heading, 800); }
.bs-ta-chip.good { background: var(--mint-soft, #E0FFF0); color: var(--relation-good, #4ECDC4); }
.bs-ta-chip.bad { background: var(--risk-soft, #FFEEEC); color: var(--relation-bad, #D33F49); }
.bs-ta-chip.mid { background: var(--surface, #fff); color: var(--text-muted, #666); }
.bs-ta-col-desc { margin-top: 12rpx; font-size: var(--fs-caption, 24rpx); color: var(--text-muted, #666); line-height: 1.5; }

/* ❸ 综合建议 */
.bs-advice { margin-top: 20rpx; padding: 18rpx 22rpx; background: var(--brand-cool, #f5f5ff); border: var(--border-width, 2rpx) solid var(--border, #111); }
.bs-advice-label { display: block; font-size: var(--fs-body, 32rpx); font-weight: var(--font-weight-heading, 800); color: var(--text-main, #111); margin-bottom: 6rpx; }
.bs-advice-text { display: block; font-size: var(--fs-body, 32rpx); color: var(--text-main, #111); line-height: 1.5; }
</style>
