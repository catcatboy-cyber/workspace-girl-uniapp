<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']">
      <view class="hero-block-v2">
        <text class="hero-tag-v2">BOOST</text>
        <text class="hero-title-v2">Token<text class="hl-v2">加油包</text></text>
        <text class="hero-copy-v2">套餐 Token 不够？买加油包，不过期。当前额外 Token：{{ extraTokens.toLocaleString() }}</text>
      </view>

      <view v-if="plansLoading" class="card-v2">
        <text class="card-text-v2">正在加载...</text>
      </view>

      <view v-else-if="plans.length === 0" class="card-v2">
        <text class="card-text-v2">{{ plansError || '暂无可用档位。' }}</text>
      </view>

      <view v-else class="recharge-plan-card" v-for="plan in plans" :key="plan.id">
        <view class="plan-card-badge" v-if="plan.bonusTokens > 0">赠 {{ plan.bonusTokens.toLocaleString() }} Token</view>
        <text class="plan-card-name">{{ plan.name }}</text>
        <view class="plan-card-token-row">
          <text class="plan-card-token-num">+{{ totalTokens(plan).toLocaleString() }}</text>
          <text class="plan-card-token-unit">Token</text>
        </view>
        <text v-if="plan.tagline" class="plan-card-tagline">{{ plan.tagline }}</text>
        <button class="plan-card-btn" :disabled="orderingId === plan.id" @click="createOrder(plan.id)">
          {{ orderingId === plan.id ? '处理中…' : '¥ ' + plan.amountYuan + ' 立即充值' }}
        </button>
      </view>

      <view v-if="orderMessage" class="card-v2">
        <text :class="['card-text-v2', orderOk ? '' : '']" :style="orderOk ? '' : 'color: #e74c3c;'">{{ orderMessage }}</text>
        <view v-if="orderOk && createdOrderId" style="margin-top: 12rpx;">
          <button class="btn btn-secondary btn-sm btn-auto" @click="orderMessage = ''; createdOrderId = ''; orderOk = false">关闭</button>
        </view>
      </view>  </view>
    <TokenCoinOverlay :visible="showCoin" :amount="coinAmount" :subtitle="coinSubtitle" @close="showCoin = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getRechargePlans, unifiedOrder, queryOrder, confirmPayment, getSubscriptionStatus } from '@/utils/api'
import TokenCoinOverlay from '@/components/TokenCoinOverlay.vue'
import { bumpDataVersion } from '@/utils/helpers'

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

async function createOrder(planId: string) {
  orderingId.value = planId
  orderMessage.value = ''
  orderOk.value = false
  createdOrderId.value = ''
  try {
    // 1. 服务端统一下单（创建DB订单 + 微信V3下单 + 生成支付参数，一站式）
    // #ifdef MP-WEIXIN
    const result = await unifiedOrder({ productType: 'recharge', productId: planId })
    if (!result?.success) {
      orderMessage.value = result?.message || '创建订单失败'
      return
    }
    createdOrderId.value = result.order?._id || ''
    const payParams = result.payParams
    const orderNo = result.order?.orderNo

    if (!payParams?.timeStamp) {
      orderMessage.value = '支付参数缺失，请重试'
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
        orderMessage.value = '已取消支付'
      } else {
        orderMessage.value = '支付失败: ' + (payErr?.errMsg || '')
      }
      return
    }
    // #endif

    // #ifdef H5
    orderMessage.value = '请在小程序中完成支付'
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
        orderOk.value = true
        coinAmount.value = result.order?.grantTokens || 0
        coinSubtitle.value = result.order?.planName || ''
        showCoin.value = true
        bumpDataVersion()
        await loadStatus()
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
        // 检查是否已成功发货
        if (confirm.order.fulfillmentStatus === 'succeeded') {
          paid = true; break
        }
        // 已支付但未完成发货 → 状态为"到账处理中"
        paid = true
        pendingFulfillment = true
        break
      }
    }
    if (paid) {
      const grantTokens = result.order?.grantTokens || 0
      if (pendingFulfillment) {
        orderOk.value = true
        orderMessage.value = `支付成功，到账处理中… 请稍后在"我"页确认余额`
      } else {
        orderOk.value = true
        coinAmount.value = grantTokens
        coinSubtitle.value = result.order?.planName || ''
        showCoin.value = true
        await loadStatus()
      }
      bumpDataVersion()
    } else {
      orderOk.value = true
      orderMessage.value = '支付确认中，可稍后在"我"页查看余额'
      bumpDataVersion()
    }
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
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; text-transform: uppercase; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; margin-bottom: 6rpx; }

/* ── 充值计划卡片 ── */
.recharge-plan-card {
  position: relative;
  background: $c-card;
  border: 3rpx solid $c-ink;
  box-shadow: 6rpx 6rpx 0 $c-ink;
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
  background: $c-accent;
  color: $c-ink;
  border: 2rpx solid $c-ink;
  padding: 4rpx 18rpx;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  letter-spacing: 1rpx;
}
.plan-card-name {
  display: block;
  font-size: $fs-body;
  font-weight: $fw-heading;
  color: $c-soft;
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
  color: $c-ink;
  line-height: 1;
  letter-spacing: -2rpx;
}
.plan-card-token-unit {
  font-size: $fs-body;
  font-weight: $fw-label;
  color: $c-muted;
}
.plan-card-tagline {
  display: block;
  font-size: $fs-caption;
  font-weight: $fw-body;
  color: $c-muted;
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
  color: $c-ink;
  background: $c-mint;
  border: 3rpx solid $c-ink;
  box-shadow: 4rpx 4rpx 0 $c-ink;
  padding: 0;
  margin: 0;
}
.plan-card-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
</style>
