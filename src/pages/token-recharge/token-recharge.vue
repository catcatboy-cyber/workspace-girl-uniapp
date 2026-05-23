<template>
  <view class="page v2-mode">
      <view class="hero-block-v2">
        <text class="hero-tag-v2">TOKEN RECHARGE</text>
        <text class="hero-title-v2">Token<text class="hl-v2">充值</text></text>
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
.page {
  min-height: 100vh;
  background: #eef3ef;
  padding: 24px;
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; }
.hero-block-v2 { padding: 32rpx 24rpx; }
.hero-tag-v2 { font-size: 22rpx; text-transform: uppercase; letter-spacing: 3rpx; color: var(--tag-color, #999); display: block; }
.hero-title-v2 { font-size: 56rpx; font-weight: 900; display: block; margin: 8rpx 0; }
.hl-v2 { color: var(--accent-color, #FFD93D); }
.hero-copy-v2 { font-size: 26rpx; color: var(--muted-color, #999); display: block; margin-top: 12rpx; }
.card-v2 { background: var(--card-bg, #fff); border: var(--card-border, 1px solid #eee); border-radius: 20rpx; padding: 28rpx; margin-bottom: 18rpx; box-shadow: var(--card-shadow, 0 6rpx 18rpx rgba(0,0,0,0.04)); }
.card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.section-title-v2 { font-size: 30rpx; font-weight: 700; }
.card-text-v2 { font-size: 26rpx; color: var(--muted-color, #999); display: block; margin-top: 6rpx; }
.btn-v2-t { background: var(--btn-bg, #111); color: var(--btn-color, #FFD93D); border: none; padding: 10rpx 24rpx; border-radius: 12rpx; font-size: 24rpx; font-weight: 700; }
.btn-v2-t.sm { padding: 6rpx 16rpx; font-size: 22rpx; }
</style>
