<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">心动人设局支付管理</text>
        <text class="panel-meta">订单与重复付款退款待办分开处理，不展示 attach、签名或密钥</text>
      </view>
      <button class="ghost-btn" :disabled="loading" @click="load">刷新</button>
    </view>

    <view class="mode-tabs">
      <button :class="['mode-tab', { active: mode === 'orders' }]" @click="switchMode('orders')">报告订单</button>
      <button :class="['mode-tab', { active: mode === 'refunds' }]" @click="switchMode('refunds')">退款待办</button>
    </view>

    <view class="filters">
      <input v-model="filters.userId" placeholder="用户 ID" />
      <input v-model="filters.resultId" placeholder="resultId" />
      <input v-model="filters.outTradeNo" placeholder="outTradeNo" />
      <picker :range="activeStatuses" range-key="label" @change="filters.status = activeStatuses[$event.detail.value].value">
        <view class="picker-like">状态：{{ statusLabel(filters.status) }}</view>
      </picker>
      <button class="small-btn" @click="page = 1; load()">查询</button>
    </view>

    <template v-if="mode === 'orders'">
      <view v-if="!loading && !orders.length" class="empty">暂无报告订单</view>
      <view v-for="order in orders" :key="order._id" class="record-card">
        <view class="record-head">
          <view><text class="trade">{{ order.outTradeNo }}</text><text class="meta">{{ order.userId }} · {{ order.resultId }}</text></view>
          <text :class="['status', order.status]">{{ statusLabel(order.status) }}</text>
        </view>
        <view class="grid">
          <text>类型：{{ order.featureKey }}</text><text>道具：{{ order.productId }} / {{ order.amountFen }} 分</text>
          <text>环境：{{ order.env === 1 ? '沙箱' : '现网' }}</text><text>发货：{{ order.fulfillmentSource || '-' }}</text>
          <text>微信状态：{{ order.lastQueryStatus ?? '-' }}</text><text>查单次数：{{ order.queryAttempts || 0 }}</text>
          <text>退款状态：{{ refundStatusLabel(order.refundRequestStatus) }}</text><text>退款单号：{{ order.refundOrderId || '-' }}</text>
          <text v-if="order.duplicatePaid">重复付款：已生成退款待办</text>
          <text v-if="order.requestedRefundFen">请求退款：{{ order.requestedRefundFen }} 分</text>
          <text v-if="order.refundRequestError" class="error-text">退款异常：{{ order.refundRequestError }}</text>
          <text v-if="order.lastErrorCode" class="error-text">异常：{{ order.lastErrorCode }} {{ order.lastErrorMessage }}</text>
        </view>
        <view class="action-row">
          <input v-model="notes[order.outTradeNo]" placeholder="查微信订单/补发原因（必填）" />
          <button class="small-btn" :disabled="working === order.outTradeNo" @click="reconcile(order)">{{ working === order.outTradeNo ? '处理中' : '查单并按凭据补发' }}</button>
          <button
            v-if="['requesting', 'processing'].includes(order.refundRequestStatus)"
            class="small-btn"
            :disabled="working === order.outTradeNo"
            @click="queryRefundStatus(order)"
          >{{ working === order.outTradeNo ? '处理中' : '查微信退款状态' }}</button>
          <button
            v-if="order.status === 'fulfilled' && !['requesting', 'processing', 'refunded'].includes(order.refundRequestStatus)"
            class="small-btn danger"
            :disabled="working === order.outTradeNo"
            @click="requestRefund(order)"
          >微信退款</button>
          <text v-else-if="order.refundRequestStatus === 'processing'" class="refund-tip">等待微信退款完成</text>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="notice">这里只管理人工退款复核状态，不自动发起退款。最终“已退款”只由微信退款通知写入。</view>
      <view v-if="!loading && !refundTasks.length" class="empty">暂无退款待办</view>
      <view v-for="task in refundTasks" :key="task._id" class="record-card">
        <view class="record-head">
          <view><text class="trade">{{ task.outTradeNo }}</text><text class="meta">{{ task.userId }} · {{ task.resultId }}</text></view>
          <text :class="['status', task.status]">{{ statusLabel(task.status) }}</text>
        </view>
        <view class="grid">
          <text>原因：{{ refundReasonLabel(task.reason) }}</text><text>金额：{{ task.amountFen }} 分</text>
          <text>处理人：{{ task.handledBy || '-' }}</text><text>处理说明：{{ task.handleNote || '-' }}</text>
        </view>
        <view v-if="!['refunded', 'dismissed'].includes(task.status)" class="action-row">
          <input v-model="notes[task._id]" placeholder="处理原因（必填）" />
          <button class="small-btn" :disabled="working === task._id" @click="updateRefundTask(task, 'processing')">标记处理中</button>
          <button class="small-btn danger" :disabled="working === task._id" @click="updateRefundTask(task, 'dismissed')">驳回待办</button>
        </view>
      </view>
    </template>

    <view v-if="total > pageSize" class="pager">
      <button class="small-btn" :disabled="page <= 1" @click="page--; load()">上一页</button>
      <text>{{ page }} / {{ Math.ceil(total / pageSize) }}</text>
      <button class="small-btn" :disabled="page >= Math.ceil(total / pageSize)" @click="page++; load()">下一页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  adminGetArchetypeReportOrders,
  adminGetArchetypeReportRefundTasks,
  adminRequestArchetypeReportRefund,
  adminReconcileArchetypeReportOrder,
  adminQueryArchetypeReportRefund,
  adminUpdateArchetypeReportRefundTask
} from '@/utils/api'

const emit = defineEmits<{ error: [string] }>()
const mode = ref<'orders' | 'refunds'>('orders')
const loading = ref(false)
const working = ref('')
const orders = ref<any[]>([])
const refundTasks = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const notes = reactive<Record<string, string>>({})
const filters = reactive({ userId: '', resultId: '', outTradeNo: '', status: 'all' })
const orderStatuses = [
  { value: 'all', label: '全部' }, { value: 'pending', label: '待支付' }, { value: 'paid', label: '已支付' },
  { value: 'fulfilling', label: '发货中' }, { value: 'fulfilled', label: '已发货' }, { value: 'closed', label: '已关闭' },
  { value: 'refunded', label: '已退款' }, { value: 'exception', label: '异常' }
]
const refundStatuses = [
  { value: 'all', label: '全部' }, { value: 'pending', label: '待处理' }, { value: 'processing', label: '处理中' },
  { value: 'refunded', label: '已退款' }, { value: 'dismissed', label: '已驳回' }
]
const activeStatuses = computed(() => mode.value === 'orders' ? orderStatuses : refundStatuses)

function statusLabel(value: string) {
  return activeStatuses.value.find((item) => item.value === value)?.label || value || '全部'
}
function refundReasonLabel(value: string) { return value === 'duplicate_paid' ? '同一结果重复付款' : value || '-' }
function switchMode(next: 'orders' | 'refunds') { mode.value = next; page.value = 1; filters.status = 'all'; load() }
function refundStatusLabel(value: string) {
  const map: Record<string, string> = {
    requesting: '请求中',
    processing: '退款中',
    refunded: '已退款',
    failed: '退款失败'
  }
  return map[value] || value || '-'
}

function promptValue(title: string, defaultValue = ''): Promise<string> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      editable: true,
      content: defaultValue,
      placeholderText: defaultValue,
      success: (result: any) => resolve(result.confirm ? String(result.content || defaultValue).trim() : ''),
      fail: () => resolve('')
    })
  })
}

async function load() {
  loading.value = true
  try {
    const payload = {
      targetUserId: filters.userId,
      resultId: filters.resultId,
      outTradeNo: filters.outTradeNo,
      status: filters.status,
      page: page.value,
      pageSize
    }
    const result = mode.value === 'orders'
      ? await adminGetArchetypeReportOrders(payload)
      : await adminGetArchetypeReportRefundTasks(payload)
    if (!result?.success) throw new Error(result?.message || '加载失败')
    if (mode.value === 'orders') orders.value = result.orders || []
    else refundTasks.value = result.tasks || []
    total.value = result.total || 0
    emit('error', '')
  } catch (error: any) {
    emit('error', error?.message || '加载支付管理数据失败')
  } finally {
    loading.value = false
  }
}

async function reconcile(order: any) {
  const reason = String(notes[order.outTradeNo] || '').trim()
  if (!reason) { emit('error', '请先填写人工查单原因'); return }
  working.value = order.outTradeNo
  try {
    const result = await adminReconcileArchetypeReportOrder(order.outTradeNo, reason)
    if (!result?.success) throw new Error(result?.message || '查单失败')
    emit('error', result.warning || '')
    await load()
  } catch (error: any) {
    emit('error', error?.message || '查单失败，未补发')
  } finally {
    working.value = ''
  }
}

async function queryRefundStatus(order: any) {
  const reason = String(notes[order.outTradeNo] || '').trim()
  if (!reason) { emit('error', '请先填写人工查单原因'); return }
  working.value = order.outTradeNo
  try {
    const result = await adminQueryArchetypeReportRefund(order.outTradeNo, reason)
    if (!result?.success) throw new Error(result?.message || '查微信退款状态失败')
    emit('error', result?.message || '')
    await load()
  } catch (error: any) {
    emit('error', error?.message || '查微信退款状态失败')
  } finally {
    working.value = ''
  }
}

async function requestRefund(order: any) {
  const refundStatus = String(order.refundRequestStatus || '').trim()
  if (order.status !== 'fulfilled') {
    emit('error', '仅已发货订单可发起退款')
    return
  }
  if (refundStatus === 'requesting' || refundStatus === 'processing') {
    emit('error', '该订单退款已在处理中')
    return
  }

  const reason = await promptValue('退款原因', '微信退款')
  if (!reason) {
    emit('error', '请先填写退款原因')
    return
  }

  const confirmText = `确认退款 ${order._id || order.outTradeNo}`
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '微信退款确认',
      content: `订单 ${order.outTradeNo}\n金额 ${(Number(order.actualPriceFen || order.amountFen || 0) / 100).toFixed(2)} 元\n确认文本：${confirmText}`,
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return

  working.value = order.outTradeNo
  try {
    const result = await adminRequestArchetypeReportRefund(order._id || order.outTradeNo, reason, confirmText)
    if (!result?.success && !result?.alreadyProcessing) throw new Error(result?.message || result?.code || '退款提交失败')
    emit('error', result?.message || '退款请求已提交')
    await load()
  } catch (error: any) {
    emit('error', error?.errMsg || error?.message || '退款提交失败')
  } finally {
    working.value = ''
  }
}

async function updateRefundTask(task: any, nextStatus: 'processing' | 'dismissed') {
  const reason = String(notes[task._id] || '').trim()
  if (!reason) { emit('error', '请先填写退款待办处理原因'); return }
  working.value = task._id
  try {
    const result = await adminUpdateArchetypeReportRefundTask(task._id, nextStatus, reason)
    if (!result?.success) throw new Error(result?.message || '退款待办更新失败')
    await load()
  } catch (error: any) {
    emit('error', error?.message || '退款待办更新失败')
  } finally {
    working.value = ''
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/admin-common.scss';
.mode-tabs{display:flex;gap:8px;margin-bottom:14px}.mode-tab{height:36px;padding:0 16px;border:1px solid rgba(23,35,31,.14);border-radius:6px;background:#fff;color:#526059;font-size:13px}.mode-tab.active{border-color:#194f3d;background:#194f3d;color:#fff}.filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}.picker-like{height:40px;line-height:40px;padding:0 12px;border:1px solid rgba(23,35,31,.14);border-radius:6px;background:#fff}.notice{padding:10px 12px;border-left:3px solid #9c6a20;background:#fff8e9;color:#654b24;font-size:13px}.record-card{padding:16px;margin-top:12px;border:1px solid rgba(23,35,31,.1);border-radius:8px;background:#fff}.record-head,.action-row,.pager{display:flex;align-items:center;justify-content:space-between;gap:12px}.trade{display:block;font-family:monospace;font-weight:800}.meta{display:block;margin-top:4px;color:#68766f;font-size:12px}.status{padding:4px 10px;border-radius:4px;background:#eef2ef;font-size:12px;font-weight:700}.status.fulfilled,.status.refunded{color:#0f6b45;background:#e6f4ec}.status.exception,.status.dismissed{color:#9c2f22;background:#fff0ed}.status.processing{color:#875810;background:#fff4d8}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px;color:#42524b;font-size:13px}.error-text{color:#9c2f22}.action-row{margin-top:14px;padding-top:12px;border-top:1px solid rgba(23,35,31,.08)}.action-row input{flex:1}.small-btn.danger{border-color:#b34b3d;color:#9c2f22;background:#fff}.refund-tip{padding:0 10px;color:#875810;font-size:12px;font-weight:700}.pager{justify-content:center;margin-top:16px}@media(max-width:760px){.filters,.grid{grid-template-columns:1fr}.action-row{align-items:stretch;flex-direction:column}.action-row input,.action-row button{width:100%}}
</style>
