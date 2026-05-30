<template>
  <view class="page v2-mode">
      <view class="hero-block-v2">
        <text class="hero-tag-v2">ENERGY</text>
        <text class="hero-title-v2">充点<text class="hl-v2">Token能量</text></text>
        <text class="hero-copy-v2">当前可用额度：{{ balance.toLocaleString() }} token</text>
      </view>

      <view v-if="plansLoading" class="card-v2">
        <text class="card-text-v2">正在加载充值档位...</text>
      </view>

      <view v-else-if="plans.length === 0" class="card-v2">
        <text class="card-text-v2">{{ plansError || '暂无可用充值档位。' }}</text>
      </view>

      <view v-else class="card-v2" v-for="plan in plans" :key="plan.id">
        <view class="card-head-v2">
          <text class="section-title-v2">{{ plan.name }}</text>
          <button class="btn-v2-t" :disabled="orderingId === plan.id" @click="createOrder(plan.id)">
            {{ orderingId === plan.id ? '处理中' : '购买' }}
          </button>
        </view>
        <text class="card-text-v2">¥{{ plan.amountYuan }} · 到账 {{ plan.grantTokens.toLocaleString() }} token</text>
        <text v-if="plan.bonusTokens > 0" class="card-text-v2" style="color: #e67e22;">含赠送 {{ plan.bonusTokens.toLocaleString() }} token</text>
      </view>

      <view v-if="orderMessage" class="card-v2">
        <text :class="['card-text-v2', orderOk ? '' : '']" :style="orderOk ? '' : 'color: #e74c3c;'">{{ orderMessage }}</text>
        <view v-if="orderOk && createdOrderId" style="margin-top: 12rpx;">
          <button class="btn-v2-t sm" @click="orderMessage = ''; createdOrderId = ''; orderOk = false">关闭</button>
        </view>
      </view>  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCurrentUserId, getTokenAccount, getRechargePlans, createRechargeOrder, adminConfirmRecharge } from '@/utils/api'

const balance = ref(0)
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
  loadBalance()
  loadPlans()
})

async function loadBalance() {
  try {
    const result = await getTokenAccount()
    if (result?.success && result?.account) {
      balance.value = Number(result.account.balanceTokens || 0)
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
    const result = await createRechargeOrder(planId)
    if (!result?.success) {
      orderMessage.value = result?.message || '创建订单失败'
      return
    }
    createdOrderId.value = result.order?._id || ''
    // 自动尝试管理员确认（过渡方案）
    if (createdOrderId.value) {
      const confirmResult = await adminConfirmRecharge(createdOrderId.value)
      if (confirmResult?.success) {
        orderOk.value = true
        orderMessage.value = '充值成功！额度已到账。'
        await loadBalance()
      } else if (confirmResult?.alreadyConfirmed) {
        orderOk.value = true
        orderMessage.value = '该订单已确认，额度已到账。'
        await loadBalance()
      } else {
        orderOk.value = false
        orderMessage.value = confirmResult?.message || '确认失败，请联系管理员'
      }
    }
  } catch (error: any) {
    orderMessage.value = error?.message || '操作失败'
  } finally {
    orderingId.value = ''
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 18rpx; box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; text-transform: uppercase; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .btn-v2-t { height: 52rpx; line-height: 52rpx; padding: 0 24rpx; background: #fff; border: 3rpx solid #111; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-t.sm { height: 44rpx; line-height: 44rpx; padding: 0 16rpx; font-size: 20rpx; }
.v2-mode .btn-v2-t[disabled] { opacity: 0.6; }
</style>
