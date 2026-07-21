<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
      <view class="hero-block-v2">
        <text class="hero-tag-v2">BOOST</text>
        <text class="hero-title-v2">Crush Credits<text class="hl-v2">加油包</text></text>
        <text class="hero-copy-v2">套餐 Crush Credits 不够？买加油包，不过期。当前额外 Crush Credits：{{ extraTokens.toLocaleString() }}</text>
      </view>

      <view v-if="plansLoading" class="card-v2">
        <text class="card-text-v2">正在加载...</text>
      </view>

      <view v-else-if="plans.length === 0" class="card-v2">
        <text class="card-text-v2">{{ plansError || '暂无可用档位。' }}</text>
      </view>

      <view v-else class="recharge-plan-card" v-for="plan in plans" :key="plan.id">
        <view class="plan-card-badge" v-if="plan.bonusTokens > 0">赠 {{ plan.bonusTokens.toLocaleString() }} Crush Credits</view>
        <text class="plan-card-name">{{ plan.name }}</text>
        <view class="plan-card-token-row">
          <text class="plan-card-token-num">+{{ totalTokens(plan).toLocaleString() }}</text>
          <text class="plan-card-token-unit">Crush Credits</text>
        </view>
        <text v-if="plan.tagline" class="plan-card-tagline">{{ plan.tagline }}</text>
        <button class="plan-card-btn" :disabled="orderingId === plan.id" @click="createOrder(plan.id)">
          {{ orderingId === plan.id ? '处理中…' : '¥ ' + plan.amountYuan + ' 立即充值' }}
        </button>
      </view>

      <view v-if="orderMessage" class="card-v2">
        <text :class="['card-text-v2', orderOk ? '' : 'error']">{{ orderMessage }}</text>
        <view v-if="orderOk && createdOrderId" style="margin-top: 12rpx;">
          <button class="btn btn-secondary btn-sm btn-auto" @click="orderMessage = ''; createdOrderId = ''; orderOk = false">关闭</button>
        </view>
      </view>  </view>
    <TokenCoinOverlay :visible="showCoin" :amount="coinAmount" :subtitle="coinSubtitle" @close="showCoin = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getRechargePlans, getSubscriptionStatus, createVirtualPayOrder, confirmVirtualPay } from '@/utils/api'
import TokenCoinOverlay from '@/components/TokenCoinOverlay.vue'
import { bumpDataVersion } from '@/utils/helpers'
import { aiLabel } from '@/utils/labels'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const extraTokens = ref(0)
const plans = ref<Array<any>>([])
const plansLoading = ref(false)
const plansError = ref('')
const orderingId = ref('')
const orderMessage = ref('')
const orderOk = ref(false)
const createdOrderId = ref('')
const showCoin = ref(false)
const coinAmount = ref(0)
const coinSubtitle = ref('')

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  loadStatus()
  loadPlans()
})

function totalTokens(plan: any) {
  return plan.grantTokens || plan.grantCalls || 0
}

async function loadStatus() {
  try {
    const result = await getSubscriptionStatus()
    if (result?.success && result?.subscription) {
      extraTokens.value = result.subscription.extraTokens || 0
    }
  } catch { /* ignore */ }
}

async function loadPlans() {
  if (plansLoading.value) return
  plansLoading.value = true
  plansError.value = ''
  try {
    const result = await getRechargePlans()
    if (result?.success) {
      plans.value = Array.isArray(result.tiers) ? result.tiers : []
      if (plans.value.length === 0) plansError.value = '暂无启用的充值档位，请联系管理员配置。'
    } else {
      plansError.value = result?.message || '加载充值档位失败'
    }
  } catch {
    plansError.value = '网络异常，请重试'
  } finally {
    plansLoading.value = false
  }
}

async function doVirtualRecharge(planId: string) {
  try {
    const result = await createVirtualPayOrder({ productType: 'recharge', productId: planId })
    if (!result?.success) { orderMessage.value = result?.message || '创建订单失败'; return }
    const { paySig, signature, signData, outTradeNo, mode } = result

    // 调起虚拟支付 — signData 是后端序列化好的 JSON 字符串，原样传，不能改动
    const payResult: any = await new Promise((resolve, reject) => {
      wx.requestVirtualPayment({
        mode,
        paySig,
        signature,
        signData,
        success: resolve,
        fail: reject
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
      orderOk.value = true
      coinAmount.value = result.order?.grantTokens || 0
      coinSubtitle.value = result.order?.planName || ''
      showCoin.value = true
      bumpDataVersion()
      await loadStatus()
    } else {
      // 支付面板已回调成功、但服务端未在窗口内确认发货 → 到账处理中（非失败），可稍后自动/手动补货
      orderOk.value = true
      orderMessage.value = '支付成功，到账处理中，可稍后在“我”页查看余额'
      bumpDataVersion()
    }
  } catch (err: any) {
    if (err?.errMsg?.includes('cancel')) { orderMessage.value = '已取消支付' }
    else { orderMessage.value = '支付失败: ' + (err?.errMsg || err?.message || '') }
  }
}

async function createOrder(planId: string) {
  orderingId.value = planId
  orderMessage.value = ''
  orderOk.value = false
  createdOrderId.value = ''
  try {
    // #ifdef MP-WEIXIN
    await doVirtualRecharge(planId)
    // #endif
    // #ifdef H5
    orderMessage.value = '请在小程序中完成支付'
    // #endif
  } catch (error: any) {
    orderMessage.value = error?.message || '操作失败'
  } finally {
    orderingId.value = ''
  }
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page { min-height: 100vh; padding: 18rpx; box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; text-transform: uppercase; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .card-text-v2.error { color: var(--risk, #e74c3c); }

/* ── 充值计划卡片 ── */
.recharge-plan-card {
  position: relative;
  background: var(--surface, #fff);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111);
  padding: 32rpx 28rpx 24rpx;
  margin-bottom: $sp-card-gap;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.plan-card-badge {
  position: absolute;
  top: -14rpx;
  right: 20rpx;
  background: var(--accent, #FFD93D);
  color: var(--text-main, #111);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  padding: 4rpx 18rpx;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  letter-spacing: 1rpx;
}
.plan-card-name {
  display: block;
  font-size: $fs-body;
  font-weight: $fw-heading;
  color: var(--text-soft, #999);
  text-transform: uppercase;
  letter-spacing: 4rpx;
  margin-bottom: 12rpx;
}
.plan-card-token-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 8rpx;
}
.plan-card-token-num {
  font-size: $fs-display;
  font-weight: $fw-hero;
  color: var(--text-main, #111);
  line-height: 1;
  letter-spacing: -2rpx;
}
.plan-card-token-unit {
  font-size: $fs-body;
  font-weight: $fw-label;
  color: var(--text-muted, #666);
}
.plan-card-tagline {
  display: block;
  font-size: $fs-caption;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
  line-height: 1.4;
  margin-bottom: 20rpx;
  max-width: 80%;
}
.plan-card-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  font-size: $fs-body-lg;
  font-weight: $fw-heading;
  color: var(--text-main, #111);
  background: var(--accent-cool, #4ECDC4);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
  padding: 0;
  margin: 0;
}
.plan-card-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
</style>
