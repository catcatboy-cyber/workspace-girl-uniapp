<template>
  <view :class="['page v2-mode', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2"><text class="hero-tag-v2">月卡</text><text class="hero-title-v2">权益<text class="hl-v2">月卡</text></text><text class="hero-copy-v2">一次购买，畅享 30 天。到期自动结束，不续费不扣款。</text></view>

    <view class="sub-current-card" v-if="currentPlan">
      <text class="sub-current-label">当前</text>
      <view class="sub-current-name-row">
        <text class="sub-current-name">{{ currentPlan.planName }}</text>
        <text v-if="currentPlan.isTrial" class="sub-trial-badge">试用 · 剩{{ currentPlan.trialDaysLeft }}天</text>
      </view>
      <view class="sub-current-stats">
        <view class="sub-stat-item"><text class="sub-stat-num">{{ monthlyDisplay }}</text><text class="sub-stat-lbl">本月可用</text></view>
        <view class="sub-stat-item"><text class="sub-stat-num">{{ (currentPlan.extraTokens || 0).toLocaleString() }}</text><text class="sub-stat-lbl">加油包</text></view>
        <view class="sub-stat-item"><text class="sub-stat-num">{{ currentPlan.maxCrushes === -1 ? '∞' : currentPlan.maxCrushes }}</text><text class="sub-stat-lbl">Crush 上限</text></view>
      </view>
    </view>

    <text class="section-title-v2 sub-section-title">选择套餐</text>
    <view class="sub-plan-grid">
      <view v-for="plan in plans" :key="plan.key" :class="['sub-plan-card', plan.key === currentPlan.plan ? 'is-current' : '', plan.key === 'pro' ? 'is-recommended' : '']">
        <view v-if="plan.key === 'pro'" class="sub-plan-badge">推荐</view>
        <view class="sub-plan-top">
          <text class="sub-plan-name">{{ plan.name }}</text>
          <view class="sub-plan-token">
            <text class="sub-plan-token-num">{{ plan.callsText }}</text>
          </view>
        </view>
        <view class="sub-plan-features">
          <view v-if="plan.summary" class="sub-summary-row">
            <text class="sub-summary-text">{{ plan.summary }}</text>
          </view>
          <view v-for="f in plan.featureList" :key="f.label" class="sub-feature-row">
            <text :class="['sub-feature-mark', f.ok ? 'on' : 'off']">{{ f.ok ? '+' : '—' }}</text>
            <text :class="['sub-feature-label', f.ok ? '' : 'off']">{{ f.label }}</text>
          </view>
        </view>
        <view v-if="plan.key !== 'free'" class="sub-plan-price-options">
          <view
            v-for="option in getPriceOptions(plan)"
            :key="option.key"
            :class="['sub-price-chip', isSelectedPriceOption(plan.key, option) ? 'active' : '']"
            @click="selectPriceOption(plan.key, option)"
          >
            <text class="sub-price-chip-label">{{ option.label }}</text>
            <text class="sub-price-chip-val">{{ option.priceText }}</text>
          </view>
        </view>
        <view v-if="plan.key !== 'free'" class="sub-plan-reassure">
          <text class="sub-reassure-text">🛡️ 一次购买 · 不自动续费 · 到期自动结束</text>
        </view>
        <button
          v-if="plan.key !== currentPlan.plan"
          :class="['sub-plan-btn', plan.key === 'pro' ? 'btn-primary' : '']"
          :disabled="upgradingPlan === plan.key"
          @click="onUpgrade(plan.key)"
        >{{ upgradingPlan === plan.key ? '处理中…' : (plan.key === 'free' ? '切换至免费版' : '¥' + getPlanButtonPrice(plan) + ' 立即开通') }}</button>
        <button v-else class="sub-plan-btn is-current-btn" disabled>当前月卡</button>
      </view>
    </view>

    <view v-if="upgradeMessage" :class="['sub-upgrade-msg', upgradeOk ? 'ok' : 'err']">
      <text class="sub-upgrade-icon">{{ upgradeOk ? '✓' : '⚠' }}</text>
      <text class="sub-upgrade-text">{{ upgradeMessage }}</text>
    </view>

    <view class="sub-bottom-links">
      <view class="sub-bottom-link" @click="goRecharge">
        <text class="sub-bottom-link-text">只需临时补 Credits？买加油包 →</text>
      </view>
    </view>
  </view>
  <TokenCoinOverlay :visible="showCoin" :amount="coinAmount" :subtitle="coinSubtitle" @close="showCoin = false" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSubscriptionConfig, getSubscriptionStatus, getRechargePlans, unifiedOrder, queryOrder, confirmPayment, createVirtualPayOrder, confirmVirtualPay } from '@/utils/api'
import TokenCoinOverlay from '@/components/TokenCoinOverlay.vue'
import { getCurrentThemeId, getFontSizeMode, getThemeStyle, applyThemeChrome } from '@/utils/theme'
import { bumpDataVersion } from '@/utils/helpers'
import { aiLabel } from '@/utils/labels'

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
  '规则分析': aiLabel() + ' 规则分析',
  '即时反馈': aiLabel() + ' 即时反馈',
  '事件理解': aiLabel() + ' 事件理解',
  '周复盘': '月度复盘',
  '附件识别': '附件识别',
  '小咪帮你说': '小咪帮你说（单轮）',
  '小咪帮你说（单轮）': '小咪帮你说（单轮）',
  '小咪多轮策略': '小咪多轮策略',
  '自定义宠物': '自定义宠物',
  '自定义AI风格': '自定义 ' + aiLabel() + ' 风格',
  '命理桃花': '命理桃花',
}
const SUMMARY_MARKERS = ['免费版全部', 'Pro全部']
const normalizeFeature = (name: string) => FEATURE_DISPLAY[name] || name

function buildPlanCards(config: any, status: any) {
  const s = status?.subscription || {}
  const planDefs: any[] = [
    { key: 'free', name: '免费版', monthlyTokens: 30000, priceText: '¥0', priceSub: '永久', callsText: '30K Credits/30天' },
    { key: 'pro', name: 'Pro 月卡', monthlyTokens: 300000, priceText: '¥19', priceSub: '/月 · 年付 ¥168', callsText: '300K Credits/30天' },
    { key: 'ultra', name: 'Ultra 月卡', monthlyTokens: -1, priceText: '¥39', priceSub: '/月 · 年付 ¥298', callsText: '不限' }
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
        d.callsText = mt === -1 ? '不限' : `${(mt / 1000).toFixed(0)}K Credits/30天`
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

    // 汇总行 + 去重：只显示当前套餐比下一级多出的功能，动态对比实际配置
    const SUMMARY_BY_KEY: Record<string, string> = {
      pro: '含免费版全部功能',
      ultra: '含 Pro 全部功能',
    }
    const summary = SUMMARY_BY_KEY[d.key] || ''

    // 收集所有套餐实际拥有的功能（排除标记），用于动态去重
    const actualFeatures: Record<string, string[]> = {}
    for (const pd of planDefs) {
      actualFeatures[pd.key] = (pd.backendFeatures || [])
        .filter((f: string) => !SUMMARY_MARKERS.includes(f))
    }

    // 有汇总的套餐：被覆盖的功能 = 下一级套餐实际拥有的全部功能
    const COVERED_BY_LOWER: Record<string, string[]> = {
      pro: actualFeatures.free || [],
      ultra: actualFeatures.pro || [],
    }
    const covered = COVERED_BY_LOWER[d.key] || []

    // 有汇总行的套餐只显示比下级多出的功能，不显示"没有的功能"
    const displayOnlyIncluded = Boolean(summary)
    const uniqueIncluded = included
      .filter((f: string) => !SUMMARY_MARKERS.includes(f))
      .filter((f: string) => !covered.includes(f))

    const featureList = [
      ...uniqueIncluded.map((f: string) => ({ label: normalizeFeature(f), ok: true })),
    ]
    if (!displayOnlyIncluded) {
      const uniqueExcluded = excluded.filter((f: string) => !covered.includes(f))
      featureList.push(...uniqueExcluded.map((f: string) => ({ label: normalizeFeature(f), ok: false })))
    }
    if (featureList.length === 0 && !summary) {
      featureList.push({ label: '后台配置未加载，请刷新', ok: false })
    }
    return { ...d, featureList, summary }
  })
}

function getSelectedPriceOption(planKey: string) {
  return selectedPriceOptions.value[planKey] || { billingCycle: 'monthly' as const, priceVariant: 'standard' as const }
}

function getPriceOptions(plan: any) {
  const p = plan?.prices || {}
  return [
    { key: 'standard-monthly', label: '30天', priceText: `¥${Number(p.standardMonthly || 0)}`, billingCycle: 'monthly' as const, priceVariant: 'standard' as const, amount: Number(p.standardMonthly || 0) },
    { key: 'standard-annual', label: '365天', priceText: `¥${Number(p.standardAnnual || 0)}`, billingCycle: 'annual' as const, priceVariant: 'standard' as const, amount: Number(p.standardAnnual || 0) }
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

function getPlanButtonPrice(plan: any) {
  const opt = getSelectedPriceOption(plan.key)
  const p = plan?.prices || {}
  if (opt.billingCycle === 'annual') return Number(p.standardAnnual || 0)
  return Number(p.standardMonthly || 0)
}

async function loadSubscriptionData() {
  if (plansLoading.value) return
  plansLoading.value = true
  try {
    const [configRes, statusRes, plansRes] = await Promise.all([
      getSubscriptionConfig(),
      getSubscriptionStatus(),
      getRechargePlans()
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
    if (plansRes?.success) {
      useVirtualPay.value = plansRes.useVirtualPay === true
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
const useVirtualPay = ref(false)
const showCoin = ref(false)
const coinAmount = ref(0)
const coinSubtitle = ref('')

async function doVirtualSubscribe(planKey: string, priceOpt: { billingCycle: string; priceVariant: string }) {
  try {
    const result = await createVirtualPayOrder({
      productType: 'subscription', planKey,
      billingCycle: priceOpt.billingCycle, priceVariant: priceOpt.priceVariant,
      sandbox: false
    })
    if (!result?.success) { upgradeMessage.value = result?.message || '创建订单失败'; return }
    const { paySig, signature, signData, outTradeNo, mode } = result

    const payResult: any = await new Promise((resolve, reject) => {
      uni.requestVirtualPayment({
        mode, paySig, signature,
        signData,
        success: resolve, fail: reject
      })
    })
    // payResult.orderId 就是微信内部订单号 wx_order_id，query_order 必须用它查单
    const wxOrderId = payResult?.orderId || ''

    // 确认发货 —— 首次 confirm 未成功则轮询兜底（服务端查单/发货可能延迟），最多 ~30s
    let confirmed = await confirmVirtualPay(outTradeNo, wxOrderId)
    for (let i = 0; i < 20 && !confirmed?.success; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      try { confirmed = await confirmVirtualPay(outTradeNo, wxOrderId) } catch (_) { /* 继续重试 */ }
    }
    if (confirmed?.success) {
      upgradeOk.value = true
      const targetPlan = plans.value.find((p: any) => p.key === planKey)
      const limit = targetPlan?.monthlyTokens
      coinAmount.value = limit === -1 ? 99999 : (Number.isFinite(limit) && limit > 0 ? limit : 0)
      coinSubtitle.value = `已升级至 ${result.order?.planName || planKey}`
      showCoin.value = true
      bumpDataVersion()
      await loadSubscriptionData()
    } else {
      // 支付面板已回调成功、但服务端未在窗口内确认发货 → 权益处理中（非失败）
      upgradeOk.value = true
      upgradeMessage.value = '支付成功，权益生效处理中（约 1 分钟），可稍后刷新查看'
      bumpDataVersion()
    }
  } catch (err: any) {
    if (err?.errMsg?.includes('cancel')) { upgradeMessage.value = '已取消支付' }
    else { upgradeMessage.value = '支付失败: ' + (err?.errMsg || err?.message || '') }
  }
}

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
    const priceOpt = getSelectedPriceOption(planKey)
    // #ifdef MP-WEIXIN
    if (useVirtualPay.value) {
      await doVirtualSubscribe(planKey, priceOpt)
      return
    }
    // #endif
    // 1. 服务端统一下单（创建DB订单 + 微信V3下单 + 生成支付参数，一站式）
    // #ifdef MP-WEIXIN
    const res = await unifiedOrder({
      productType: 'subscription',
      planKey,
      billingCycle: priceOpt.billingCycle,
      priceVariant: priceOpt.priceVariant
    })
    if (!res?.success) {
      upgradeMessage.value = res?.message || '创建订单失败'
      return
    }
    const payParams = res.payParams
    const orderNo = res.order?.orderNo

    if (!payParams?.timeStamp) {
      upgradeMessage.value = '支付参数缺失，请重试'
      return
    }

    // 2. 调起微信支付（payParams 直接来自服务端，无需穿透 data）
    try {
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: String(payParams.timeStamp || ''),
          nonceStr: String(payParams.nonceStr || ''),
          package: payParams.package || '',
          signType: payParams.signType || 'RSA',
          paySign: String(payParams.paySign || ''),
          success: resolve,
          fail: reject
        })
      })
    } catch (payErr: any) {
      if (payErr?.errMsg?.includes('cancel')) {
        upgradeMessage.value = '已取消支付'
      } else {
        upgradeMessage.value = '支付失败: ' + (payErr?.errMsg || '')
      }
      return
    }
    // #endif

    // #ifdef H5
    upgradeMessage.value = '请在小程序中完成支付'
    return
    // #endif

    // 3. 支付成功 → 确认发货 + 轮询双保险
    let paid = false
    let pendingFulfillment = false

    // 3a. 立即调云函数确认发货（wx.requestPayment success = 微信已扣款）
    try {
      const confirmed = await confirmPayment({ orderNo })
      if (confirmed?.order?.status === 'paid' && confirmed.order.fulfillmentStatus === 'succeeded') {
        paid = true
        upgradeOk.value = true
        const targetPlan = plans.value.find((p: any) => p.key === planKey)
        const limit = targetPlan?.monthlyTokens
        coinAmount.value = limit === -1 ? 99999 : (Number.isFinite(limit) && limit > 0 ? limit : 0)
        coinSubtitle.value = `已升级至 ${res.order?.planName || planKey}`
        showCoin.value = true
        bumpDataVersion()
        await loadSubscriptionData()
        return
      }
    } catch (e: any) {
    }

    // 3b. 轮询兜底（30s 窗口，直接调微信 V3 查单）
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      let confirm: any
      try {
        confirm = await queryOrder({ orderNo })
      } catch (e) { continue }
      if (confirm?.order?.status === 'paid') {
        if (confirm.order.fulfillmentStatus === 'succeeded') {
          paid = true
          break
        }
        paid = true
        pendingFulfillment = true
        break
      }
    }
    if (paid) {
      if (pendingFulfillment) {
        upgradeOk.value = true
        upgradeMessage.value = '支付成功，权益生效处理中（约 1 分钟），可稍后刷新查看'
        bumpDataVersion()
      } else {
        upgradeOk.value = true
        const targetPlan = plans.value.find((p: any) => p.key === planKey)
        const limit = targetPlan?.monthlyTokens
        coinAmount.value = limit === -1 ? 99999 : (Number.isFinite(limit) && limit > 0 ? limit : 0)
        coinSubtitle.value = `已升级至 ${res.order?.planName || planKey}`
        showCoin.value = true
        bumpDataVersion()
        await loadSubscriptionData()
      }
    } else {
      upgradeOk.value = true
      upgradeMessage.value = '支付成功，权益生效处理中（约 1 分钟），可稍后刷新查看'
      bumpDataVersion()
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

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page { min-height: 100vh; background: var(--app-bg, #FFFDF5); padding: 18rpx; box-sizing: border-box; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx 18rpx calc(80rpx + env(safe-area-inset-bottom)) 18rpx; }
.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { background: var(--accent, #FFD93D); padding: 0 8rpx; display: inline-block; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.sub-section-title { margin-bottom: 16rpx; }

.sub-current-card { background: $c-card; border: 3rpx solid $c-ink; box-shadow: 6rpx 6rpx 0 $c-ink; padding: 24rpx 28rpx; margin-bottom: 28rpx; position: relative; }
.sub-current-label { position: absolute; top: -12rpx; left: 20rpx; background: $c-ink; color: $c-accent; padding: 4rpx 18rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 2rpx; }
.sub-current-name-row { display: flex; align-items: center; gap: 12rpx; margin-top: 6rpx; margin-bottom: 18rpx; }
.sub-current-name { font-size: $fs-heading; font-weight: $fw-hero; color: $c-ink; }
.sub-trial-badge { background: $c-mint; color: $c-ink; border: 2rpx solid $c-ink; padding: 4rpx 14rpx; font-size: $fs-caption; font-weight: $fw-label; }
.sub-current-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.sub-stat-item { padding: 14rpx 8rpx; border: 2rpx solid $c-ink; background: $c-card-soft; text-align: center; }
.sub-stat-num { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: $c-ink; }
.sub-stat-lbl { display: block; font-size: $fs-caption; font-weight: $fw-body; color: $c-muted; margin-top: 2rpx; }

.sub-plan-grid { display: flex; flex-direction: column; gap: 20rpx; }
.sub-plan-card { position: relative; background: $c-card; border: 3rpx solid $c-ink; box-shadow: 6rpx 6rpx 0 $c-ink; padding: 28rpx; display: flex; flex-direction: column; }
.sub-plan-card.is-current { border-color: $c-mint; border-width: 4rpx; }
.sub-plan-badge { position: absolute; top: -14rpx; right: 20rpx; background: $c-accent; color: $c-ink; border: 2rpx solid $c-ink; padding: 4rpx 20rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 2rpx; }

.sub-plan-top { text-align: center; margin-bottom: 20rpx; }
.sub-plan-name { display: block; font-size: $fs-body; font-weight: $fw-heading; color: $c-soft; text-transform: uppercase; letter-spacing: 4rpx; margin-bottom: 12rpx; }
.sub-plan-token { display: inline-block; background: $c-ink; padding: 10rpx 28rpx; }
.sub-plan-token-num { font-size: $fs-body-lg; font-weight: $fw-hero; color: $c-accent; }

.sub-plan-features { margin-bottom: 20rpx; flex: 1; }
.sub-summary-row { padding: 14rpx 0; margin-bottom: 6rpx; }
.sub-summary-text { font-size: $fs-body; font-weight: $fw-label; color: $c-muted; }
.sub-feature-row { display: flex; align-items: center; gap: 10rpx; padding: 10rpx 0; border-bottom: 1rpx solid rgba(0,0,0,0.06); }
.sub-feature-row:last-child { border-bottom: none; }
.sub-feature-mark { font-weight: $fw-hero; font-size: $fs-body-lg; width: 32rpx; text-align: center; flex-shrink: 0; }
.sub-feature-mark.on { color: $c-mint; }
.sub-feature-mark.off { color: $c-soft; }
.sub-feature-label { font-size: $fs-body; font-weight: $fw-body; color: $c-ink; }
.sub-feature-label.off { color: $c-soft; }

.sub-plan-price-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 12rpx; }
.sub-plan-reassure { text-align: center; margin-bottom: 20rpx; }
.sub-reassure-text { font-size: $fs-caption; font-weight: $fw-body; color: $c-muted; }
.sub-price-chip { border: 3rpx solid rgba(0,0,0,0.1); padding: 14rpx 12rpx; background: $c-card; text-align: center; }
.sub-price-chip.active { border-color: $c-ink; background: $c-accent; box-shadow: 3rpx 3rpx 0 $c-ink; }
.sub-price-chip-label { display: block; font-size: $fs-caption; font-weight: $fw-label; color: $c-muted; margin-bottom: 4rpx; }
.sub-price-chip.active .sub-price-chip-label { color: $c-ink; }
.sub-price-chip-val { display: block; font-size: $fs-body; font-weight: $fw-heading; color: $c-ink; }

.sub-plan-btn { width: 100%; height: 72rpx; line-height: 72rpx; text-align: center; font-size: $fs-body-lg; font-weight: $fw-heading; color: $c-ink; background: $c-card; border: 3rpx solid $c-ink; box-shadow: 4rpx 4rpx 0 $c-ink; padding: 0; }
.sub-plan-btn.btn-primary { background: $c-mint; }
.sub-plan-btn[disabled] { opacity: 0.5; box-shadow: none; }
.sub-plan-btn.is-current-btn { background: $c-card-soft; color: $c-soft; border-color: rgba(0,0,0,0.15); box-shadow: none; }

.sub-upgrade-msg { display: flex; align-items: center; gap: 10rpx; margin-top: 20rpx; padding: 20rpx 24rpx; border: 3rpx solid $c-ink; background: $c-card; }
.sub-upgrade-msg.ok { border-color: $c-mint; }
.sub-upgrade-msg.err { border-color: $c-risk; }
.sub-upgrade-icon { font-weight: $fw-hero; font-size: $fs-heading; }
.sub-upgrade-msg.ok .sub-upgrade-icon { color: $c-mint; }
.sub-upgrade-msg.err .sub-upgrade-icon { color: $c-risk; }
.sub-upgrade-text { font-size: $fs-body-lg; font-weight: $fw-label; color: $c-ink; }

.sub-bottom-links { margin-top: 28rpx; }
.sub-bottom-link { padding: 20rpx; border: 2rpx dashed $c-ink; text-align: center; background: $c-card-soft; }
.sub-bottom-link-text { font-size: $fs-body; font-weight: $fw-label; color: $c-muted; }
</style>
