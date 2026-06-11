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
      <view class="stats-grid-v2 stats-gap">
        <view class="stat-box-v2"><text class="stat-num-v2">{{ monthlyDisplay }}</text><text class="stat-lbl-v2">本月可用</text></view>
        <view class="stat-box-v2"><text class="stat-num-v2">{{ (currentPlan.extraTokens || 0).toLocaleString() }}</text><text class="stat-lbl-v2">加油包</text></view>
        <view class="stat-box-v2"><text class="stat-num-v2">{{ currentPlan.maxCrushes === -1 ? '∞' : currentPlan.maxCrushes }}</text><text class="stat-lbl-v2">Crush 上限</text></view>
      </view>
    </view>

    <!-- 套餐卡片 -->
    <text class="section-title-v2 section-gap">选择套餐</text>
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
          <view v-if="plan.key !== 'free'" class="price-choice-grid">
            <view
              v-for="option in getPriceOptions(plan)"
              :key="option.key"
              :class="['price-choice', isSelectedPriceOption(plan.key, option) ? 'active' : '']"
              @click="selectPriceOption(plan.key, option)"
            >
              <text class="price-choice-label">{{ option.label }}</text>
              <text class="price-choice-value">{{ option.priceText }}</text>
            </view>
          </view>
          <button
            v-if="plan.key !== currentPlan.plan"
            :class="['plan-btn', plan.key === 'pro' ? 'primary' : '']"
            :disabled="upgradingPlan === plan.key"
            @click="onUpgrade(plan.key)"
          >{{ upgradingPlan === plan.key ? '处理中...' : (plan.key === 'free' ? '切换至免费版' : '升级 ' + plan.name) }}</button>
          <button v-else class="plan-btn current" disabled>当前套餐</button>
        </view>
      </view>
    </view>

    <!-- 升级结果提示 -->
    <view v-if="upgradeMessage" :class="['card-v2', 'upgrade-msg', upgradeOk ? 'upgrade-ok' : 'upgrade-err']">
      <text class="upgrade-msg-icon">{{ upgradeOk ? '✓' : '⚠' }}</text>
      <text class="upgrade-msg-text">{{ upgradeMessage }}</text>
      <view v-if="upgradeOk" class="upgrade-msg-hint">
        <text class="upgrade-msg-note">管理员确认后将自动升级套餐。如需加急请联系客服。</text>
      </view>
    </view>

    <!-- 年付/学生价说明 -->
    <view class="card-v2 section-gap">
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
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSubscriptionConfig, getSubscriptionStatus, createSubscriptionPayment } from '@/utils/api'
import { getCurrentThemeId, getFontSizeMode, getThemeStyle, applyThemeChrome } from '@/utils/theme'
import { bumpDataVersion } from '@/utils/helpers'

const fontSizeMode = ref(getFontSizeMode())
const themeVars = ref(getThemeStyle())
const plansLoading = ref(false)

const plans = ref<any[]>([])
const currentPlan = ref<any>(null)
const discounts = ref<any[]>([])
const selectedPriceOptions = ref<Record<string, { billingCycle: 'monthly' | 'annual'; priceVariant: 'standard' | 'student' }>>({})

const monthlyDisplay = computed(() => {
  if (!currentPlan.value) return '...'
  const limit = currentPlan.value.monthlyTokensLimit
  const used = currentPlan.value.monthlyTokensUsed || 0
  if (currentPlan.value.isTrial) return '∞（试用中）'
  if (limit === -1) return '∞'
  const rem = Math.max(0, (limit || 0) - used)
  return rem >= 1000 ? `${(rem / 1000).toFixed(0)}K` : rem.toLocaleString()
})

// 后台配置功能名 → 前端统一显示名
const FEATURE_DISPLAY: Record<string, string> = {
  '记录': '互动记录',
  '时间轴': '时间轴',
  '时间线': '时间轴',
  '规则分析': 'AI 规则分析',
  '即时反馈': 'AI 即时反馈',
  '事件理解': 'AI 事件理解',
  '周复盘': '14 天复盘',
  '附件识别': '附件识别',
  '星象速写': '星象速写',
  '小咪帮你说': '小咪帮你说（单轮）',
  '小咪帮你说（单轮）': '小咪帮你说（单轮）',
  '小咪多轮策略': '小咪多轮策略',
  '自定义宠物': '自定义宠物',
  '自定义AI风格': '自定义 AI 风格',
  '自定义 AI 风格': '自定义 AI 风格',
  '命理桃花': '命理桃花',
}
const normalizeFeature = (name: string) => FEATURE_DISPLAY[name] || name

function buildPlanCards(config: any, status: any) {
  const s = status?.subscription || {}
  const planDefs: any[] = [
    { key: 'free', name: '免费版', monthlyTokens: 30000, priceText: '¥0', priceSub: '永久', callsText: '30K Token/月' },
    { key: 'pro', name: 'Pro', monthlyTokens: 300000, priceText: '¥19', priceSub: '/月 · 年付 ¥168', callsText: '300K Token/月' },
    { key: 'ultra', name: 'Ultra', monthlyTokens: -1, priceText: '¥39', priceSub: '/月 · 年付 ¥298', callsText: '不限' }
  ]
  planDefs.forEach((d) => {
    const monthly = d.key === 'pro' ? 19 : d.key === 'ultra' ? 39 : 0
    const annual = d.key === 'pro' ? 168 : d.key === 'ultra' ? 298 : 0
    d.prices = { standardMonthly: monthly, standardAnnual: annual }
  })

  if (config?.config?.plans) {
    const cfg = config.config.plans
    for (const d of planDefs) {
      const pc = cfg[d.key]
      if (pc) {
        d.name = pc.name || d.name
        const mt = pc.monthlyTokens ?? pc.monthlyCalls
        d.monthlyTokens = mt
        d.callsText = mt === -1 ? '不限' : `${(mt / 1000).toFixed(0)}K Token/月`
        if (d.key !== 'free' && pc.priceYuan !== undefined && pc.priceYuan !== null) {
          d.priceText = `¥${pc.priceYuan}`
          if (pc.priceYuanAnnual !== undefined && pc.priceYuanAnnual !== null) d.priceSub = `/月 · 年付 ¥${pc.priceYuanAnnual}`
        }
        d.prices = {
          standardMonthly: Number(pc.priceYuan ?? d.prices.standardMonthly),
          standardAnnual: Number(pc.priceYuanAnnual ?? d.prices.standardAnnual)
        }
        // 从后台配置读取功能和限制
        d.backendFeatures = (pc.features || []).slice()
        d.backendExcluded = (pc.excludedFeatures || []).slice()
      }
    }
  }

  return planDefs.map(d => {
    const included = d.backendFeatures || []
    const excluded = d.backendExcluded || []
    const featureList = [
      ...included.map((f: string) => ({ label: normalizeFeature(f), ok: true })),
      ...excluded.map((f: string) => ({ label: normalizeFeature(f), ok: false })),
    ]
    if (featureList.length === 0) {
      featureList.push({ label: '后台配置未加载，请刷新', ok: false })
    }
    return { ...d, featureList }
  })
}

function getSelectedPriceOption(planKey: string) {
  return selectedPriceOptions.value[planKey] || { billingCycle: 'monthly' as const, priceVariant: 'standard' as const }
}

function getPriceOptions(plan: any) {
  const p = plan?.prices || {}
  return [
    { key: 'standard-monthly', label: '月付', priceText: `¥${Number(p.standardMonthly || 0)}/月`, billingCycle: 'monthly' as const, priceVariant: 'standard' as const, amount: Number(p.standardMonthly || 0) },
    { key: 'standard-annual', label: '年付', priceText: `¥${Number(p.standardAnnual || 0)}/年`, billingCycle: 'annual' as const, priceVariant: 'standard' as const, amount: Number(p.standardAnnual || 0) }
  ].filter((item) => item.key === 'standard-monthly' || item.amount > 0)
}

function selectPriceOption(planKey: string, option: any) {
  selectedPriceOptions.value = {
    ...selectedPriceOptions.value,
    [planKey]: {
      billingCycle: option.billingCycle,
      priceVariant: option.priceVariant
    }
  }
}

function isSelectedPriceOption(planKey: string, option: any) {
  const selected = getSelectedPriceOption(planKey)
  return selected.billingCycle === option.billingCycle && selected.priceVariant === option.priceVariant
}

async function loadSubscriptionData() {
  if (plansLoading.value) return
  plansLoading.value = true
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
          { label: 'Ultra 年付', value: `¥${configRes.config.plans.ultra.priceYuanAnnual || 298}/年` }
        ]
      }
    }
    if (statusRes?.success) {
      currentPlan.value = statusRes.subscription
    }
  } catch (_) {
    // 静默降级 — 页面显示空状态即可
  } finally {
    plansLoading.value = false
  }
}

onShow(() => {
  fontSizeMode.value = getFontSizeMode()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  loadSubscriptionData()
})

const upgradingPlan = ref('')
const upgradeMessage = ref('')
const upgradeOk = ref(false)

async function onUpgrade(planKey: string) {
  if (planKey === 'free') {
    uni.showToast({ title: '已是免费版', icon: 'none' })
    return
  }
  if (upgradingPlan.value) return
  upgradingPlan.value = planKey
  upgradeMessage.value = ''
  upgradeOk.value = false

  try {
    const res = await createSubscriptionPayment(planKey, getSelectedPriceOption(planKey))
    if (res?.success) {
      upgradeOk.value = true
      upgradeMessage.value = res.message || `已创建 ${res.order?.planName || planKey} 升级订单`
      bumpDataVersion()
      // 后续接入微信支付：res.order.paymentParams → wx.requestPayment
      if (res.order?.paymentParams) {
        // #ifdef MP-WEIXIN
        // wx.requestPayment({ ...res.order.paymentParams, success: () => ..., fail: () => ... })
        // #endif
      }
    } else {
      upgradeMessage.value = res?.message || '创建订单失败，请稍后重试'
    }
  } catch (e: any) {
    upgradeMessage.value = e?.message || '网络错误，请稍后重试'
  } finally {
    upgradingPlan.value = ''
  }
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
}
</script>

<style scoped>
.v2-mode .page { min-height: 100vh; background: var(--app-bg, #FFFDF5); padding: 18rpx 18rpx calc(80rpx + env(safe-area-inset-bottom)) 18rpx; }

/* Hero — 和其他页面完全一致 */
.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

/* Card */
.v2-mode .card-v2 { border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; background: #fff; padding: 32rpx; margin-bottom: 16rpx; }
.v2-mode .section-title-v2 { font-size: 22rpx; font-weight: 900; text-transform: uppercase; letter-spacing: 4rpx; color: #999; display: block; margin-bottom: 16rpx; }

/* 当前套餐 */
.v2-mode .current-plan-row { display: flex; align-items: center; gap: 12rpx; }
.v2-mode .current-plan-name { font-size: 32rpx; font-weight: 900; }
.v2-mode .trial-badge { background: #4ECDC4; color: #111; padding: 4rpx 12rpx; font-size: 22rpx; font-weight: 800; border-radius: var(--radius-sm, 12rpx); border: 2rpx solid #111; }

/* Stats grid */
.v2-mode .stats-grid-v2 { display: flex; gap: 8rpx; }
.v2-mode .stat-box-v2 { flex: 1; text-align: center; padding: 16rpx 8rpx; border: 2rpx solid rgba(18,60,54,0.1); }
.v2-mode .stat-num-v2 { font-size: 28rpx; font-weight: 900; display: block; }
.v2-mode .stat-lbl-v2 { font-size: 18rpx; color: #999; display: block; margin-top: 4rpx; }

/* 套餐卡片 */
.v2-mode .plan-grid { display: flex; flex-direction: column; gap: 16rpx; }
.v2-mode .plan-card-v2 { border: 3rpx solid #111; background: #fff; padding: 0; position: relative; }
.v2-mode .plan-card-v2.current { border-color: #4ECDC4; border-width: 4rpx; }
.v2-mode .plan-card-v2.recommended { border-color: #111; }
.v2-mode .plan-recommend-badge { position: absolute; top: -12rpx; right: 16rpx; background: #FFD93D; border: 2rpx solid #111; padding: 4rpx 16rpx; font-size: 20rpx; font-weight: 900; }
.v2-mode .plan-card-header { padding: 24rpx; border-bottom: 2rpx solid rgba(18,60,54,0.1); }
.v2-mode .plan-name { font-size: 28rpx; font-weight: 900; }
.v2-mode .plan-price-row { display: flex; align-items: baseline; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .plan-price { font-size: 48rpx; font-weight: 900; }
.v2-mode .plan-price-sub { font-size: 22rpx; color: #999; }
.v2-mode .plan-card-body { padding: 24rpx; }
.v2-mode .plan-highlight { text-align: center; margin-bottom: 20rpx; }
.v2-mode .plan-calls { font-size: 28rpx; font-weight: 900; background: #111; color: #FFD93D; padding: 8rpx 24rpx; }
.v2-mode .plan-features { margin-bottom: 20rpx; }
.v2-mode .plan-feature-row { display: flex; align-items: center; gap: 10rpx; padding: 8rpx 0; font-size: 24rpx; }
.v2-mode .plan-feature-icon { font-weight: 900; font-size: 26rpx; width: 36rpx; text-align: center; }
.v2-mode .plan-feature-icon.yes { color: #27ae60; }
.v2-mode .plan-feature-icon.no { color: #999; }
.v2-mode .dim { color: #999; }

/* 价格选项 */
.v2-mode .price-choice-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-bottom: 18rpx; }
.v2-mode .price-choice { border: 3rpx solid rgba(18,60,54,0.1); padding: 12rpx; background: #fff; }
.v2-mode .price-choice.active { border-color: #111; background: #FFD93D; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .price-choice-label { display: block; font-size: 22rpx; font-weight: 900; }
.v2-mode .price-choice-value { display: block; margin-top: 4rpx; font-size: 22rpx; color: #666; }

/* 升级按钮 — 遵循 btn-v2 规范 */
.v2-mode .plan-btn { width: 100%; height: 72rpx; line-height: 72rpx; border: 3rpx solid #111; background: #fff; font-size: 26rpx; font-weight: 800; color: #111; padding: 0 24rpx; }
.v2-mode .plan-btn.primary { background: #4ECDC4; color: #111; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .plan-btn.current { background: #f9f9f9; color: #999; border-color: rgba(18,60,54,0.1); }
.v2-mode .plan-btn[disabled] { opacity: 0.6; }

/* 优惠方案 */
.v2-mode .discount-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 2rpx solid rgba(18,60,54,0.1); }
.v2-mode .discount-label { font-size: 24rpx; font-weight: 800; }
.v2-mode .discount-value { font-size: 24rpx; color: #666; }

/* 加油包入口 */
.v2-mode .btn-v2-me { height: 72rpx; line-height: 72rpx; border: 3rpx solid #111; background: #fff; font-size: 26rpx; font-weight: 800; color: #111; padding: 0 24rpx; }
.v2-mode .btn-v2-me.sm { height: 56rpx; line-height: 56rpx; font-size: 22rpx; padding: 0 20rpx; }
.v2-mode .btn-v2-me.outline { border-style: dashed; }

/* 间距工具 */
.v2-mode .section-gap { margin-top: 24rpx; }
.v2-mode .stats-gap { margin-top: 16rpx; }

/* 升级结果提示 */
.v2-mode .upgrade-msg { margin-top: 24rpx; }
.v2-mode .upgrade-ok { border-color: #27ae60; }
.v2-mode .upgrade-err { border-color: #FF5252; }
.v2-mode .upgrade-msg-icon { font-weight: 900; font-size: 26rpx; }
.v2-mode .upgrade-ok .upgrade-msg-icon { color: #27ae60; }
.v2-mode .upgrade-err .upgrade-msg-icon { color: #FF5252; }
.v2-mode .upgrade-msg-text { font-size: 26rpx; font-weight: 700; margin-left: 12rpx; }
.v2-mode .upgrade-ok .upgrade-msg-text { color: #27ae60; }
.v2-mode .upgrade-err .upgrade-msg-text { color: #FF5252; }
.v2-mode .upgrade-msg-hint { margin-top: 12rpx; }
.v2-mode .upgrade-msg-note { font-size: 22rpx; color: #999; }
</style>
