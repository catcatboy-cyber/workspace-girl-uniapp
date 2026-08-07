<template>
  <view class="storybook-paywall">
    <view class="decor-sprig"><view /><view /><view /><view /></view>
    <view class="preview-hero">
      <view class="preview-copy">
        <text class="eyebrow">免费预览 · 魔镜已找到原型</text>
        <text class="subject">{{ subjectLabel }}最像</text>
        <text class="title">{{ report?.primary?.name || '人物原型' }}型</text>
        <text class="summary">{{ report?.summary }}</text>
      </view>
      <view class="mirror-shell">
        <view class="mirror-crown"><view /><view /><view /></view>
        <view class="mirror-inner">
          <image v-if="report?.primary?.coverUrl" :src="report.primary.coverUrl" mode="aspectFill" class="avatar" />
          <view v-else class="avatar fallback">{{ primaryInitial }}</view>
        </view>
      </view>
      <view class="band-ribbon"><text>人物相似度</text><text>{{ report?.similarityBand?.label || '区间生成中' }}</text></view>
    </view>

    <view class="preview-tags"><text>#{{ displayTitle }}</text><text>#免费先看结论</text><text>#完整报告本人可见</text></view>

    <view class="chapter oracle-card">
      <view class="chapter-head"><text>第一章 · 魔镜判词</text><text>公开预览</text></view>
      <view class="chapter-body"><text class="oracle-title">已经找到最接近的人物风格</text><text class="oracle-copy">{{ report?.summary }}</text><text class="coverage">观察覆盖 {{ report?.observation?.answeredCount || 0 }}/{{ report?.observation?.total || 0 }}</text></view>
    </view>

    <view class="chapter locked-chapter">
      <view class="chapter-head"><text>完整报告 · 后续章节</text><text>已封存</text></view>
      <view class="locked-preview"><view /><view /><view /><view /></view>
      <view class="lock-cover">
        <view class="lock-seal"><view class="lock-body" /><view class="lock-loop" /></view>
        <text class="lock-title">后面的答案，被魔镜封存了</text>
        <text class="lock-copy">解锁精确相似度、完整人物排序、关系信号、优势风险和下一步建议。</text>
      </view>
    </view>

    <view class="chapter purchase-card">
      <view class="chapter-head"><text>解锁完整报告</text><text>一单解锁本次结果</text></view>
      <view class="chapter-body">
        <view class="goods-row">
          <view class="goods-art"><view class="mini-mirror"><text>心</text></view></view>
          <view class="goods-copy"><text>心动人设局 · 完整报告</text><text>只解锁当前测试结果，不消耗 Crush credits</text></view>
          <text class="price"><text>¥</text>{{ priceYuan }}</text>
        </view>

        <view class="benefit-list">
          <view><text>✓</text><text>精确相似度与完整人物排序</text></view>
          <view><text>✓</text><text>关系优势、风险和回避信号</text></view>
          <view><text>✓</text><text>具体沟通建议与下一步行动</text></view>
        </view>

        <text v-if="message" :class="['message', state === 'payment_failed' || state === 'payment_unsupported' ? 'error' : '']">{{ message }}</text>

        <!-- #ifdef MP-WEIXIN -->
        <button v-if="report?.unlockOptions?.canPurchase" class="pay-button" :disabled="busy" @click="startPayment">
          {{ busy ? actionLabel : `支付 ¥${priceYuan} · 解锁本次报告` }}
        </button>
        <!-- #endif -->
        <button class="pro-button" @click="goPro">升级 Pro · 已开放测试全部解锁</button>
        <text class="purchase-note">支付成功后可从测试记录再次查看，本次结果无需重复购买。</text>
      </view>
    </view>
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
const primaryInitial = computed(() => String(props.report?.primary?.name || '人').slice(0, 1))
const subjectLabel = computed(() => props.report?.subjectLabel || (props.report?.mode === 'target' ? 'TA' : '你'))
const displayTitle = computed(() => props.report?.kind === 'relation_archetype'
  ? props.report?.subjectGender === 'male' ? '关系男主角' : '关系女主角'
  : props.report?.kind === 'dimension_character' ? '次元角色图鉴' : 'Crush 名人图鉴')
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
  uni.navigateTo({ url: `/pages/subscription/subscription?from=heart_persona_result&resultId=${encodeURIComponent(props.resultId)}` })
}
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.storybook-paywall{--persona-paper:var(--surface,#fff);--persona-soft:var(--surface-soft,var(--card-soft,#f6f6f6));--persona-ink:var(--text-main,#111);--persona-muted:var(--text-muted,#666);--persona-deep:var(--primary,var(--hero-bg,#4b6674));--persona-gold:var(--accent,#f0c65a);--persona-leaf:var(--accent-cool,#6f9787);position:relative;overflow:hidden;color:var(--persona-ink)}
.decor-sprig{position:absolute;z-index:0;right:-68rpx;top:48rpx;width:190rpx;height:80rpx;opacity:.26;pointer-events:none;transform:rotate(24deg)}.decor-sprig::before{content:"";position:absolute;left:10rpx;top:39rpx;width:166rpx;height:3rpx;background:var(--persona-leaf);transform:rotate(-12deg)}.decor-sprig view{position:absolute;width:42rpx;height:20rpx;border-radius:100% 0 100% 0;background:var(--persona-leaf);transform:rotate(-25deg)}.decor-sprig view:nth-child(1){left:20rpx;top:18rpx}.decor-sprig view:nth-child(2){left:59rpx;top:40rpx;transform:rotate(145deg)}.decor-sprig view:nth-child(3){left:98rpx;top:9rpx}.decor-sprig view:nth-child(4){left:137rpx;top:29rpx;transform:rotate(145deg)}
.preview-hero{position:relative;z-index:1;min-height:540rpx;padding:42rpx 26rpx 28rpx;border:var(--border-width,2rpx) solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--shape-radius-hero,var(--radius-lg,36rpx));overflow:hidden;background:var(--persona-soft);box-shadow:var(--shadow-hero,0 22rpx 48rpx rgba(0,0,0,.1))}.preview-copy{position:relative;z-index:2;display:flex;flex-direction:column;width:58%;padding-top:24rpx}.eyebrow{color:var(--persona-muted);font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading);letter-spacing:2rpx}.subject{margin-top:28rpx;font-size:$fs-caption;font-weight:var(--font-weight-heading,$fw-heading)}.title{margin-top:5rpx;font-family:var(--font-display,var(--font-ui));font-size:58rpx;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.08;letter-spacing:-2rpx}.summary{display:block;margin-top:22rpx;font-size:$fs-caption;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.7}.mirror-shell{position:absolute;z-index:1;right:-18rpx;top:70rpx;width:306rpx;height:372rpx;padding:13rpx;border:8rpx solid var(--persona-gold);border-radius:50% 50% 44% 44% / 39% 39% 55% 55%;background:var(--persona-paper);box-shadow:var(--shadow-md,0 12rpx 28rpx rgba(0,0,0,.12));transform:rotate(2deg)}.mirror-inner{width:100%;height:100%;overflow:hidden;border:3rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:inherit;background:var(--persona-soft)}.avatar{width:100%;height:100%}.fallback{display:flex;align-items:center;justify-content:center;font-family:var(--font-display,var(--font-ui));font-size:104rpx;font-weight:var(--font-weight-hero,$fw-hero);color:var(--persona-deep);background:linear-gradient(155deg,var(--persona-soft),var(--brand-cool,var(--persona-paper)))}.mirror-crown{position:absolute;z-index:3;left:50%;top:-42rpx;display:flex;align-items:flex-end;justify-content:center;width:120rpx;height:58rpx;transform:translateX(-50%)}.mirror-crown view{width:34rpx;height:50rpx;border:3rpx solid var(--persona-ink);background:var(--persona-gold);clip-path:polygon(50% 0,100% 100%,0 100%)}.mirror-crown view:nth-child(2){height:62rpx;margin:0 -5rpx}.band-ribbon{position:absolute;z-index:4;right:18rpx;bottom:22rpx;display:grid;grid-template-columns:1fr 150rpx;align-items:center;width:356rpx;min-height:96rpx;overflow:hidden;border:3rpx solid var(--persona-ink);border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));color:var(--primary-contrast,#fff);background:var(--persona-deep);box-shadow:6rpx 7rpx 0 var(--persona-gold);transform:rotate(-2deg)}.band-ribbon text{padding:18rpx;font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero)}.band-ribbon text:last-child{align-self:stretch;display:flex;align-items:center;justify-content:center;color:var(--persona-ink);background:var(--persona-paper);font-size:$fs-body}
.preview-tags{display:flex;flex-wrap:wrap;gap:12rpx;padding:22rpx 8rpx 24rpx}.preview-tags text{padding:12rpx 18rpx;border:2rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--radius-pill,999rpx);background:var(--persona-paper);font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading)}
.chapter{position:relative;z-index:1;margin-bottom:24rpx;overflow:hidden;border:var(--border-width,2rpx) solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--shape-radius-card,var(--radius-lg,36rpx));background:var(--persona-paper);box-shadow:var(--shadow-md,0 12rpx 32rpx rgba(0,0,0,.06))}.chapter-head{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:18rpx 24rpx;color:var(--primary-contrast,#fff);background:var(--persona-deep)}.chapter-head text:first-child{font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero)}.chapter-head text:last-child{color:var(--on-active-muted,rgba(255,255,255,.7));font-size:$fs-micro}.chapter-body{padding:28rpx}.oracle-title{display:block;font-family:var(--font-display,var(--font-ui));font-size:34rpx;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.45}.oracle-copy{display:block;margin-top:14rpx;color:var(--persona-muted);font-size:$fs-body;line-height:1.7}.coverage{display:block;margin-top:18rpx;color:var(--persona-muted);font-size:$fs-caption}
.locked-chapter{min-height:430rpx}.locked-preview{display:flex;flex-direction:column;gap:16rpx;padding:30rpx;filter:blur(6rpx);opacity:.26}.locked-preview view{height:80rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--persona-muted)}.locked-preview view:nth-child(3),.locked-preview view:nth-child(4){height:18rpx}.locked-preview view:nth-child(4){width:72%}.lock-cover{position:absolute;inset:70rpx 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28rpx;background:linear-gradient(180deg,rgba(255,255,255,.08),var(--persona-paper) 58%);text-align:center}.lock-seal{position:relative;display:flex;align-items:center;justify-content:center;width:88rpx;height:88rpx;border:3rpx solid var(--persona-ink);border-radius:50%;background:var(--persona-gold);box-shadow:5rpx 5rpx 0 var(--persona-ink)}.lock-body{position:absolute;left:26rpx;top:39rpx;width:36rpx;height:30rpx;border:3rpx solid var(--persona-ink);border-radius:5rpx}.lock-loop{position:absolute;left:30rpx;top:19rpx;width:28rpx;height:28rpx;border:3rpx solid var(--persona-ink);border-bottom:0;border-radius:50% 50% 0 0}.lock-title{margin-top:22rpx;font-family:var(--font-display,var(--font-ui));font-size:36rpx;font-weight:var(--font-weight-hero,$fw-hero)}.lock-copy{max-width:520rpx;margin-top:10rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.65}
.goods-row{display:grid;grid-template-columns:104rpx 1fr auto;gap:18rpx;align-items:center}.goods-art{display:flex;align-items:center;justify-content:center;width:104rpx;height:104rpx;border:3rpx solid var(--persona-ink);border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--accent-soft,var(--brand-warm,var(--persona-paper)));box-shadow:5rpx 5rpx 0 var(--persona-ink)}.mini-mirror{display:flex;align-items:center;justify-content:center;width:62rpx;height:78rpx;border:5rpx solid var(--persona-gold);border-radius:50%;background:var(--persona-paper)}.mini-mirror text{font-family:var(--font-display,var(--font-ui));font-weight:var(--font-weight-hero,$fw-hero)}.goods-copy{display:flex;flex-direction:column;min-width:0}.goods-copy text:first-child{font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.goods-copy text:last-child{margin-top:6rpx;color:var(--persona-muted);font-size:$fs-micro;line-height:1.5}.price{font-size:38rpx;font-weight:var(--font-weight-hero,$fw-hero)}.price>text{font-size:$fs-caption}.benefit-list{display:flex;flex-direction:column;gap:12rpx;margin-top:26rpx;padding:22rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--persona-soft)}.benefit-list view{display:grid;grid-template-columns:34rpx 1fr;gap:10rpx;font-size:$fs-caption;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.55}.benefit-list view text:first-child{color:var(--success,var(--persona-leaf));font-weight:var(--font-weight-hero,$fw-hero)}.message{display:block;margin-top:20rpx;padding:16rpx;border-radius:var(--radius-sm,18rpx);background:var(--brand-warm,#fffbea);font-size:$fs-caption;line-height:1.55}.message.error{color:var(--risk,#b42318);background:var(--risk-soft,#ffeeec)}.pay-button,.pro-button{min-height:var(--control-height-lg,88rpx);margin-top:20rpx;border:var(--border-width,2rpx) solid var(--border,var(--persona-ink));border-radius:var(--shape-radius-control,var(--radius-md,28rpx));font-weight:var(--font-weight-hero,$fw-hero)}.pay-button{color:var(--primary-contrast,#fff);background:var(--persona-deep);box-shadow:6rpx 7rpx 0 var(--persona-gold)}.pro-button{background:var(--success-soft,#e7f2ea)}.pay-button::after,.pro-button::after{border:0}.purchase-note{display:block;margin-top:18rpx;color:var(--persona-muted);font-size:$fs-micro;line-height:1.55;text-align:center}
@media (max-width:370px){.preview-hero{min-height:520rpx}.mirror-shell{right:-42rpx;width:278rpx;height:354rpx}.title{font-size:52rpx}.band-ribbon{width:326rpx;grid-template-columns:1fr 136rpx}.goods-row{grid-template-columns:92rpx 1fr}.goods-art{width:92rpx;height:92rpx}.price{grid-column:2}}
</style>
