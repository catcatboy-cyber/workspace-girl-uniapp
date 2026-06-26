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

      <view v-else class="card-v2" v-for="plan in plans" :key="plan.id">
        <view class="card-head-v2">
          <text class="section-title-v2">{{ plan.name }}</text>
          <button class="btn btn-primary btn-md btn-full" :disabled="orderingId === plan.id" @click="createOrder(plan.id)">
            {{ orderingId === plan.id ? '处理中' : '¥' + plan.amountYuan }}
          </button>
        </view>
        <text class="card-text-v2 recharge-token-amount-v2">+{{ totalTokens(plan).toLocaleString() }} Token</text>
        <text v-if="plan.bonusTokens > 0" class="card-text-v2" style="color:#e67e22;">含赠送 {{ plan.bonusTokens.toLocaleString() }} Token</text>
        <text v-if="plan.tagline" class="card-text-v2 recharge-tagline-v2">{{ plan.tagline }}</text>
      </view>

      <view v-if="orderMessage" class="card-v2">
        <text :class="['card-text-v2', orderOk ? '' : '']" :style="orderOk ? '' : 'color: #e74c3c;'">{{ orderMessage }}</text>
        <view v-if="orderOk && createdOrderId" style="margin-top: 12rpx;">
          <button class="btn btn-secondary btn-sm btn-auto" @click="orderMessage = ''; createdOrderId = ''; orderOk = false">关闭</button>
        </view>
      </view>  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getRechargePlans, createPaymentOrder, queryPaymentOrder, getSubscriptionStatus } from '@/utils/api'
import { bumpDataVersion } from '@/utils/helpers'

const extraTokens = ref(0)
const plans = ref<Array<any>>([])
const plansLoading = ref(false)
const plansError = ref('')
const orderingId = ref('')
const orderMessage = ref('')
const orderOk = ref(false)
const createdOrderId = ref('')

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
    // 1. 服务端创建订单（查配置算价，写 recharge_orders）
    const result = await createPaymentOrder({ productType: 'recharge', productId: planId })
    if (!result?.success) {
      orderMessage.value = result?.message || '创建订单失败'
      return
    }
    createdOrderId.value = result.order?._id || ''

    // 2. 调用集成中心 HTTP 云函数统一下单
    // #ifdef MP-WEIXIN
    let prepayData: any = {}
    let payRes: any
    try {
      payRes = await new Promise((resolve, reject) => {
        wx.cloud.callHTTPFunction({
          name: 'CrushRadar-uty6nxqu-demo-scfweb',
          config: { env: 'cloud1-d0gvhqu2c8a2b61fd' },
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          path: '/wx-pay/wxpay_order',
          data: {
            description: result.order.productName,
            out_trade_no: result.order.orderNo,
            amount: { total: result.order.amountFen, currency: 'CNY' }
          },
          success: resolve,
          fail: reject
        })
      })

      // callHTTPFunction 自动解析 JSON → { code:0, data:{ status:200, data:{ timeStamp... } } }
      // 穿透两层 data 取支付参数
      const body = payRes?.data
      prepayData = body?.data?.data || body?.data || body
    } catch (payCreateErr: any) {
      orderMessage.value = '统一下单: ' + (payCreateErr?.errMsg || payCreateErr?.message || '')
      return
    }

    if (!prepayData?.timeStamp) {
      orderMessage.value = 'timeStamp缺失:' + JSON.stringify(payRes?.data).slice(0, 300)
      return
    }

    // 3. 调起微信支付
    try {
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: String(prepayData.timeStamp || ''),
          nonceStr: String(prepayData.nonceStr || ''),
          package: prepayData.packageVal || prepayData.package || '',
          signType: prepayData.signType || 'RSA',
          paySign: String(prepayData.paySign || ''),
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

    // 4. 支付成功 → 触发发货 → 查单确认
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const confirm = await queryPaymentOrder({ orderNo: result.order?.orderNo })
    if (confirm?.order?.status === 'paid') {
      orderOk.value = true
      orderMessage.value = `支付成功！已充值 ${((result.order?.grantTokens || 0)).toLocaleString()} Token`
      bumpDataVersion()
      await loadStatus()
    } else {
      orderMessage.value = '支付处理中，稍后自动到账'
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
.v2-mode .recharge-token-amount-v2 { font-size: $fs-heading; font-weight: $fw-hero; }
.v2-mode .recharge-tagline-v2 { font-size: $fs-body; color: $c-soft; }
</style>
