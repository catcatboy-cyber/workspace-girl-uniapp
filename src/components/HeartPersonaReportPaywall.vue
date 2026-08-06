<template>
  <view class="paywall">
    <view class="preview-head">
      <image v-if="report?.primary?.coverUrl" :src="report.primary.coverUrl" mode="aspectFill" class="avatar" />
      <view v-else class="avatar fallback">{{ String(report?.primary?.name || '人').slice(0, 1) }}</view>
      <view class="preview-copy">
        <text class="eyebrow">免费预览</text>
        <text class="title">{{ report?.primary?.name || '人物原型' }}</text>
        <text class="band">{{ report?.similarityBand?.label || '相似度区间生成中' }}</text>
      </view>
    </view>
    <text class="summary">{{ report?.summary }}</text>
    <text class="coverage">观察覆盖 {{ report?.observation?.answeredCount || 0 }}/{{ report?.observation?.total || 0 }}</text>

    <view class="locked-list">
      <view><text>精确相似度与完整人物排序</text><text>已锁定</text></view>
      <view><text>关系信号、优势与风险拆解</text><text>已锁定</text></view>
      <view><text>继续投入、观察或回避建议</text><text>已锁定</text></view>
    </view>

    <text v-if="message" :class="['message', state === 'payment_failed' || state === 'payment_unsupported' ? 'error' : '']">{{ message }}</text>

    <!-- #ifdef MP-WEIXIN -->
    <button v-if="report?.unlockOptions?.canPurchase" class="pay-button" :disabled="busy" @click="startPayment">
      {{ busy ? actionLabel : `¥${priceYuan} 解锁本次完整报告` }}
    </button>
    <!-- #endif -->
    <button class="pro-button" @click="goPro">升级 Pro · 所有已开放测试直接看完整报告</button>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getHeartPersonaReportOrderStatus,
  prepareHeartPersonaReportOrder,
  reconcileHeartPersonaReportOrder
} from '@/utils/api'

const props = defineProps<{ resultId: string; report: any }>()
const emit = defineEmits<{ unlocked: []; stateChange: [string] }>()

const state = ref('preview_locked')
const message = ref('')
const busy = computed(() => ['creating_order', 'payment_sheet', 'payment_pending', 'reconciling'].includes(state.value))
const priceYuan = computed(() => ((Number(props.report?.unlockOptions?.priceFen) || 199) / 100).toFixed(2))
const actionLabel = computed(() => ({
  creating_order: '正在创建订单...',
  payment_sheet: '正在打开微信支付...',
  payment_pending: '正在确认支付结果...',
  reconciling: '正在核验微信订单...'
} as Record<string, string>)[state.value] || '处理中...')

function setState(value: string, text = '') {
  state.value = value
  message.value = text
  emit('stateChange', value)
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function pollOrder(outTradeNo: string, candidate = '') {
  setState('payment_pending', '支付结果确认中，请不要重复支付。')
  for (let index = 1; index <= 20; index += 1) {
    const shouldReconcile = [3, 8, 15].includes(index)
    const response = shouldReconcile
      ? await reconcileHeartPersonaReportOrder(outTradeNo, index === 3 ? candidate : '')
      : await getHeartPersonaReportOrderStatus(outTradeNo)
    if (response?.success && response?.data?.reportAvailable) {
      setState('full_report', '')
      emit('unlocked')
      return
    }
    if (response?.code === 'ORDER_CLOSED') {
      setState('payment_failed', '本次订单已关闭，请重新点击支付。')
      return
    }
    if (response?.code === 'REFUNDED' || response?.data?.status === 'refunded') {
      setState('refunded', '本次订单已退款，完整报告未解锁。')
      return
    }
    if (response?.code && !['ORDER_PENDING', 'WECHAT_QUERY_FAILED'].includes(response.code)) {
      setState('payment_failed', response.message || '订单确认失败，报告未解锁。')
      return
    }
    if (index < 20) await sleep(1500)
  }
  setState('payment_pending', '支付结果仍在确认中，可稍后刷新页面查看。')
}

async function confirmUnknownFailure(outTradeNo: string) {
  const response = await reconcileHeartPersonaReportOrder(outTradeNo)
  if (response?.success && response?.data?.reportAvailable) {
    emit('unlocked')
    return
  }
  setState('payment_pending', '支付结果确认中，可稍后刷新；未确认前不会解锁。')
}

async function startPayment() {
  if (busy.value) return
  // #ifdef MP-WEIXIN
  try {
    // @ts-ignore wx 为微信小程序全局
    if (!wx.canIUse || !wx.canIUse('requestVirtualPayment')) {
      setState('payment_unsupported', '当前微信版本不支持道具支付，请升级微信或使用 Pro。')
      return
    }
    setState('creating_order')
    const prepared = await prepareHeartPersonaReportOrder(props.resultId)
    if (!prepared?.success) {
      if (['REPORT_ALREADY_AVAILABLE', 'REPORT_ALREADY_UNLOCKED'].includes(prepared?.code)) {
        emit('unlocked')
        return
      }
      setState('payment_failed', prepared?.message || '暂时无法创建订单。')
      return
    }
    const order = prepared.data
    setState('payment_sheet')
    // @ts-ignore wx 为微信小程序全局
    wx.requestVirtualPayment({
      mode: 'short_series_goods',
      paySig: order.paySig,
      signature: order.signature,
      signData: order.signData,
      success: (response: any) => {
        const candidate = typeof response?.orderId === 'string' ? response.orderId : ''
        pollOrder(order.outTradeNo, candidate).catch(() => setState('payment_pending', '支付结果确认中，可稍后刷新。'))
      },
      fail: (failure: any) => {
        const code = Number(failure?.errCode ?? failure?.errno)
        if (code === -2) {
          setState('payment_cancelled', '已取消支付，本次报告仍保持锁定。')
          return
        }
        if ([-15002, -15005, -15007, -15012].includes(code)) {
          setState('payment_failed', '本次支付尝试已失效，请重新点击支付。')
          return
        }
        if (code === -15008) {
          setState('payment_failed', '支付暂不可用，请稍后再试或升级 Pro。')
          return
        }
        if ([-15010, -15013, -15014].includes(code)) {
          setState('payment_failed', '道具配置暂不可用，请稍后再试。')
          return
        }
        confirmUnknownFailure(order.outTradeNo).catch(() => setState('payment_pending', '支付结果确认中，可稍后刷新。'))
      }
    })
  } catch (error: any) {
    setState('payment_failed', error?.message || '支付操作失败，请稍后重试。')
  }
  // #endif
}

function goPro() {
  uni.navigateTo({ url: '/pages/subscription/subscription' })
}
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.paywall{padding:30rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);background:var(--surface,#fff);box-shadow:var(--shadow-hero,8rpx 8rpx 0 #111)}
.preview-head{display:flex;align-items:center;gap:22rpx}.avatar{width:128rpx;height:128rpx;flex:0 0 128rpx;border:4rpx solid var(--border,#111);border-radius:50%;background:#fff}.fallback{display:flex;align-items:center;justify-content:center;font-size:$fs-heading;font-weight:$fw-hero}.preview-copy{display:flex;flex-direction:column;min-width:0}.eyebrow{font-size:$fs-micro;font-weight:$fw-label}.title{font-size:$fs-heading;font-weight:$fw-hero}.band{margin-top:6rpx;color:var(--text-muted,#666);font-weight:$fw-heading}.summary,.coverage,.message{display:block;margin-top:20rpx;line-height:1.6}.coverage{font-size:$fs-caption;color:var(--text-muted,#666)}
.locked-list{margin-top:22rpx;border-top:2rpx dashed var(--divider,#aaa)}.locked-list view{display:flex;justify-content:space-between;gap:16rpx;padding:18rpx 0;border-bottom:2rpx dashed var(--divider,#aaa)}.locked-list text:last-child{flex:0 0 auto;color:var(--text-muted,#666)}
.message{padding:14rpx;background:var(--brand-warm,#FFFBEB);font-size:$fs-caption}.message.error{background:var(--risk-soft,#FFEEEC);color:var(--risk,#B42318)}
.pay-button,.pro-button{margin-top:20rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);border-radius:var(--shape-radius-control,0);box-shadow:var(--shadow-hard,4rpx 4rpx 0 #111);font-weight:$fw-hero}.pay-button{background:var(--accent,#FFD93D)}.pro-button{background:var(--accent-cool,#4ECDC4)}
</style>
