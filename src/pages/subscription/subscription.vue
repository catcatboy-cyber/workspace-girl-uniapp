<template>
  <view :class="['page v2-mode', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2"><text class="hero-tag-v2">UPGRADE</text><text class="hero-title-v2">升级<text class="hl-v2">套餐</text></text><text class="hero-copy-v2">更多 Token，更多功能，更懂你的关系。</text></view>

    <!-- 当前套餐 -->
    <view class="card-v2" v-if="currentPlan">
      <text class="section-title-v2">当前套餐</text>
      <view class="current-plan-row">
        <text class="current-plan-name">{{ currentPlan.planName }}</text>
        <text v-if="currentPlan.isTrial" class="trial-badge">试用期剩{{ currentPlan.trialDaysLeft }}天</text>
      </view>
      <view class="stats-grid-v2" style="margin-top:16rpx">
        <view class="stat-box-v2"><text class="stat-num-v2">{{ monthlyDisplay }}</text><text class="stat-lbl-v2">本月可用</text></view>
        <view class="stat-box-v2"><text class="stat-num-v2">{{ (currentPlan.extraTokens || 0).toLocaleString() }}</text><text class="stat-lbl-v2">加油包</text></view>
        <view class="stat-box-v2"><text class="stat-num-v2">{{ currentPlan.maxCrushes === -1 ? '∞' : currentPlan.maxCrushes }}</text><text class="stat-lbl-v2">Crush 上限</text></view>
      </view>
    </view>

    <!-- 套餐卡片 -->
    <text class="section-title-v2" style="margin-top:24rpx;">选择套餐</text>
    <view class="plan-grid">
      <view v-for="plan in plans" :key="plan.key" :class="['plan-card-v2', plan.key === currentPlan.plan ? 'current' : '', plan.key === 'pro' ? 'recommended' : '']">
        <view v-if="plan.key === 'pro'" class="plan-recommend-badge">推荐</view>
        <view class="plan-card-header">
          <text class="plan-name">{{ plan.name }}</text>
          <view class="plan-price-row">
            <text class="plan-price">{{ plan.priceText }}</text>
            <text v-if="plan.priceSub" class="plan-price-sub">{{ plan.priceSub }}</text>
          </view>
        </view>
        <view class="plan-card-body">
          <view class="plan-highlight">
            <text class="plan-calls">{{ plan.callsText }}</text>
          </view>
          <view class="plan-features">
            <view v-for="f in plan.featureList" :key="f.label" class="plan-feature-row">
              <text :class="['plan-feature-icon', f.ok ? 'yes' : 'no']">{{ f.ok ? '✓' : '✗' }}</text>
              <text :class="f.ok ? '' : 'dim'">{{ f.label }}</text>
            </view>
          </view>
          <button
            v-if="plan.key !== currentPlan.plan"
            :class="['plan-btn', plan.key === 'pro' ? 'primary' : '']"
            @click="onUpgrade(plan.key)"
          >{{ plan.key === 'free' ? '切换至免费版' : '升级 ' + plan.name }}</button>
          <button v-else class="plan-btn current" disabled>当前套餐</button>
        </view>
      </view>
    </view>

    <!-- 年付/学生价说明 -->
    <view class="card-v2" style="margin-top:24rpx;">
      <text class="section-title-v2">优惠方案</text>
      <view class="discount-row" v-for="d in discounts" :key="d.label">
        <text class="discount-label">{{ d.label }}</text>
        <text class="discount-value">{{ d.value }}</text>
      </view>
      <button class="btn-v2-me sm outline" style="margin-top:16rpx;" @click="goRecharge">只需临时补 Token？买加油包 →</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getSubscriptionConfig, getSubscriptionStatus, getRechargePlans } from '@/utils/api'
import { getCurrentThemeId, getFontSizeMode, getThemeStyle, applyThemeChrome } from '@/utils/theme'

const fontSizeMode = ref(getFontSizeMode())
const themeVars = ref(getThemeStyle())

const plans = ref<any[]>([])
const currentPlan = ref<any>(null)
const discounts = ref<any[]>([])

const monthlyDisplay = computed(() => {
  if (!currentPlan.value) return '...'
  const limit = currentPlan.value.monthlyTokensLimit
  const used = currentPlan.value.monthlyTokensUsed || 0
  if (currentPlan.value.isTrial) return '∞（试用中）'
  if (limit === -1) return '∞'
  const rem = Math.max(0, (limit || 0) - used)
  return rem >= 1000 ? `${(rem / 1000).toFixed(0)}K` : rem.toLocaleString()
})

function buildPlanCards(config: any, status: any) {
  const s = status?.subscription || {}
  const planDefs = [
    { key: 'free', name: '免费版', monthlyTokens: 30000, priceText: '¥0', priceSub: '永久', callsText: '30K Token/月', features: ['记录 & 时间轴', 'AI 事件理解', 'AI 即时反馈', '周复盘', '附件识别'] },
    { key: 'pro', name: 'Pro', monthlyTokens: 300000, priceText: '¥19', priceSub: '/月 · 年付 ¥168', callsText: '300K Token/月', features: ['免费版全部', '星象速写', '小咪帮你说（单轮）', '3 个 Crush', '更多附件识别'] },
    { key: 'ultra', name: 'Ultra', monthlyTokens: -1, priceText: '¥39', priceSub: '/月 · 年付 ¥298', callsText: '不限', features: ['Pro 全部', '不限 Crush', '小咪多轮策略', '自定义宠物', '自定义 AI 风格'] }
  ]

  if (config?.config?.plans) {
    const cfg = config.config.plans
    for (const d of planDefs) {
      const pc = cfg[d.key]
      if (pc) {
        d.name = pc.name || d.name
        const mt = pc.monthlyTokens ?? pc.monthlyCalls
        d.monthlyTokens = mt
        d.callsText = mt === -1 ? '不限' : `${(mt / 1000).toFixed(0)}K Token/月`
        if (d.key !== 'free' && pc.priceYuan) {
          d.priceText = `¥${pc.priceYuan}`
          if (pc.priceYuanAnnual) d.priceSub = `/月 · 年付 ¥${pc.priceYuanAnnual}`
        }
      }
    }
  }

  return planDefs.map(d => ({
    ...d,
    featureList: d.features.map(f => {
      // 免费版在试用期也可以看到高级功能说明
      return { label: f, ok: d.key === 'free' ? !f.includes('星象速写') && !f.includes('小咪') : true }
    })
  }))
}

onMounted(async () => {
  try {
    const [configRes, statusRes] = await Promise.all([
      getSubscriptionConfig(),
      getSubscriptionStatus()
    ])
    if (configRes?.success) {
      plans.value = buildPlanCards(configRes, statusRes)
      if (configRes.config?.plans?.pro?.priceYuanAnnual) {
        discounts.value = [
          { label: 'Pro 年付', value: `¥${configRes.config.plans.pro.priceYuanAnnual}/年（约 ¥${Math.round(configRes.config.plans.pro.priceYuanAnnual / 12)}/月）` },
          { label: 'Pro 学生价', value: `¥${configRes.config.plans.pro.priceYuanStudent || 12}/月（需认证）` },
          { label: 'Ultra 年付', value: `¥${configRes.config.plans.ultra.priceYuanAnnual || 298}/年` }
        ]
      }
    }
    if (statusRes?.success) {
      currentPlan.value = statusRes.subscription
    }
  } catch {}
})

function onUpgrade(planKey: string) {
  if (planKey === 'free') {
    uni.showToast({ title: '已是免费版', icon: 'none' })
    return
  }
  // 暂跳充值页（后续对接微信支付）
  uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: var(--app-bg, #FFFDF5); padding: 18rpx 18rpx calc(80rpx + env(safe-area-inset-bottom)) 18rpx; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; }
.hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }
.hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.hero-title-v2 { font-size: 40rpx; font-weight: 900; display: block; }
.hl-v2 { background: var(--accent, #FFD93D); padding: 0 8rpx; }
.hero-copy-v2 { font-size: 26rpx; color: #fff; display: block; margin-top: 12rpx; }

.card-v2 { border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; background: #fff; padding: 28rpx; margin-bottom: 16rpx; }
.section-title-v2 { font-size: 22rpx; font-weight: 900; text-transform: uppercase; letter-spacing: 4rpx; color: #999; display: block; margin-bottom: 16rpx; }

.current-plan-row { display: flex; align-items: center; gap: 12rpx; }
.current-plan-name { font-size: 32rpx; font-weight: 900; }
.trial-badge { background: #4ECDC4; color: #fff; padding: 4rpx 12rpx; font-size: 22rpx; font-weight: 700; border-radius: 4rpx; }

.stats-grid-v2 { display: flex; gap: 8rpx; }
.stat-box-v2 { flex: 1; text-align: center; padding: 16rpx 8rpx; border: 2rpx solid #eee; }
.stat-num-v2 { font-size: 32rpx; font-weight: 900; display: block; }
.stat-lbl-v2 { font-size: 20rpx; color: #999; display: block; margin-top: 4rpx; }

.plan-grid { display: flex; flex-direction: column; gap: 16rpx; }
.plan-card-v2 { border: 3rpx solid #111; background: #fff; padding: 0; position: relative; }
.plan-card-v2.current { border-color: #4ECDC4; border-width: 4rpx; }
.plan-card-v2.recommended { border-color: #111; }
.plan-recommend-badge { position: absolute; top: -12rpx; right: 16rpx; background: #FFD93D; border: 2rpx solid #111; padding: 4rpx 16rpx; font-size: 20rpx; font-weight: 900; }
.plan-card-header { padding: 24rpx; border-bottom: 2rpx solid #eee; }
.plan-name { font-size: 28rpx; font-weight: 900; }
.plan-price-row { display: flex; align-items: baseline; gap: 8rpx; margin-top: 8rpx; }
.plan-price { font-size: 48rpx; font-weight: 900; }
.plan-price-sub { font-size: 22rpx; color: #999; }
.plan-card-body { padding: 24rpx; }
.plan-highlight { text-align: center; margin-bottom: 20rpx; }
.plan-calls { font-size: 28rpx; font-weight: 900; background: #111; color: #FFD93D; padding: 8rpx 24rpx; }
.plan-features { margin-bottom: 20rpx; }
.plan-feature-row { display: flex; align-items: center; gap: 10rpx; padding: 8rpx 0; }
.plan-feature-icon { font-weight: 900; font-size: 26rpx; width: 36rpx; text-align: center; }
.plan-feature-icon.yes { color: #27ae60; }
.plan-feature-icon.no { color: #ccc; }
.dim { color: #ccc; }
.plan-btn { width: 100%; padding: 14rpx 0; border: 2rpx solid #111; background: #fff; font-size: 26rpx; font-weight: 700; }
.plan-btn.primary { background: #111; color: #FFD93D; }
.plan-btn.current { background: #eee; color: #999; border-color: #ccc; }

.discount-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #eee; }
.discount-label { font-size: 24rpx; font-weight: 700; }
.discount-value { font-size: 24rpx; color: #666; }

.btn-v2-me { border: 2rpx solid #111; background: #fff; padding: 14rpx 28rpx; font-size: 24rpx; font-weight: 700; }
.btn-v2-me.sm { padding: 10rpx 20rpx; font-size: 22rpx; }
.btn-v2-me.outline { border-style: dashed; }
</style>
