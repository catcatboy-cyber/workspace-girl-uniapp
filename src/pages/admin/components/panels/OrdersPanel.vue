<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">订单管理</text>
        <text class="panel-meta">{{ orderTotal }} 条订单</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="ordersLoading" @click="loadOrders">{{ ordersLoading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="notice" class="ok-alert">{{ notice }}</view>
    <!-- 状态筛选 -->
    <view style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button v-for="s in orderStatusOptions" :key="s.value"
        :class="['small-btn', orderStatusFilter === s.value ? 'active' : '']"
        @click="orderStatusFilter = s.value; loadOrders()">{{ s.label }}</button>
    </view>
    <!-- 订单列表 -->
    <view v-if="orders.length === 0 && !ordersLoading" class="empty">暂无订单。</view>
    <view v-else class="table" style="max-height:600px;overflow-y:auto;">
      <view class="table-row table-header">
        <text style="width:130rpx;">订单号</text>
        <text style="flex:1.2;">商品</text>
        <text style="width:90rpx;">金额</text>
        <text style="width:70rpx;">类型</text>
        <text style="width:70rpx;">状态</text>
        <text style="width:100rpx;">Crush</text>
        <text style="flex:0.8;">用户ID</text>
        <text style="flex:1;">创建时间</text>
      </view>
      <view v-for="row in orders" :key="row._id"
        :class="['table-row', expandedOrderId === row._id ? 'selected' : '']"
        style="cursor:pointer;font-size:20rpx;" @click="expandedOrderId = expandedOrderId === row._id ? '' : row._id">
        <text style="width:130rpx;font-family:monospace;font-size:18rpx;overflow:hidden;text-overflow:ellipsis;">{{ (row.orderNo || '').slice(-8) }}</text>
        <text style="flex:1.2;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ row.planName }}</text>
        <text style="width:90rpx;font-weight:800;">¥{{ row.amountYuan }}</text>
        <text style="width:70rpx;">{{ row.productType === 'subscription' ? '会员' : '充值' }}</text>
        <text style="width:70rpx;font-weight:800;" :style="{ color: orderStatusColor(row.status) }">{{ orderStatusLabel(row.status) }}</text>
        <text style="width:100rpx;">{{ (row.grantTokens || 0).toLocaleString() }}</text>
        <text style="flex:0.8;font-size:18rpx;overflow:hidden;text-overflow:ellipsis;">{{ row.userId }}</text>
        <text style="flex:1;font-size:18rpx;">{{ formatDateTime(row.createdAt) }}</text>
      </view>
      <!-- 展开详情 -->
      <view v-if="expandedOrderId" class="order-detail">
        <view style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <text style="font-weight:800;">订单详情</text>
          <text style="font-size:20rpx;color:#999;">{{ expandedOrderId }}</text>
        </view>
        <view class="order-detail-grid">
          <text>订单号：{{ expandedOrder?.orderNo || '-' }}</text>
          <text>用户ID：{{ expandedOrder?.userId }}</text>
          <text>商品：{{ expandedOrder?.planName }}</text>
          <text>类型：{{ expandedOrder?.productType === 'subscription' ? '会员升级' : '加油包充值' }}</text>
          <text>金额：¥{{ expandedOrder?.amountYuan }}（{{ expandedOrder?.amountFen || 0 }}分）</text>
          <text>Crush Credits：{{ (expandedOrder?.grantTokens || 0).toLocaleString() }}</text>
          <text>状态：{{ orderStatusLabel(expandedOrder?.status) }}</text>
          <text v-if="expandedOrder?.refundRequestStatus && expandedOrder?.refundRequestStatus !== 'refunded'">退款状态：{{ refundStatusLabel(expandedOrder.refundRequestStatus) }}</text>
          <text v-if="expandedOrder?.refundOrderId">退款单号：{{ expandedOrder.refundOrderId }}</text>
          <text v-if="expandedOrder?.refundRequestError">退款错误：{{ expandedOrder.refundRequestError }}</text>
          <text>创建时间：{{ formatDateTime(expandedOrder?.createdAt) }}</text>
          <text v-if="expandedOrder?.paidAt">支付时间：{{ formatDateTime(expandedOrder.paidAt) }}</text>
          <text v-if="expandedOrder?.transactionId">微信流水：{{ expandedOrder.transactionId }}</text>
          <text v-if="expandedOrder?.remark">备注：{{ expandedOrder.remark }}</text>
        </view>
        <view v-if="expandedOrder?.status === 'paid'" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="small-btn danger" :disabled="refundingOrderId === expandedOrderId || queryingOrderId === expandedOrderId" @click="doRefundOrder(expandedOrderId)">
            {{ refundingOrderId === expandedOrderId ? '退款中...' : '微信退款' }}
          </button>
          <button class="small-btn" :disabled="refundingOrderId === expandedOrderId || queryingOrderId === expandedOrderId" @click="doManualRefund(expandedOrderId)">线下退款标记</button>
          <button class="small-btn" :disabled="refundingOrderId === expandedOrderId || queryingOrderId === expandedOrderId" @click="doQueryOrder(expandedOrderId)">
            {{ queryingOrderId === expandedOrderId ? '查单中...' : '查微信状态' }}
          </button>
        </view>
        <view v-if="expandedOrder?.refundRequestStatus === 'processing'" style="margin-top:12px;">
          <button class="small-btn" :disabled="queryingOrderId === expandedOrderId" @click="doQueryOrder(expandedOrderId)">刷新退款状态</button>
        </view>
      </view>
    </view>
    <!-- 分页 -->
    <view v-if="orderTotal > orderPageSize" style="display:flex;justify-content:center;gap:8px;margin-top:16px;">
      <button class="small-btn" :disabled="orderPage <= 1" @click="orderPage--; loadOrders()">上一页</button>
      <text style="line-height:34px;font-size:22rpx;color:#666;">{{ orderPage }} / {{ Math.ceil(orderTotal / orderPageSize) }}</text>
      <button class="small-btn" :disabled="orderPage >= Math.ceil(orderTotal / orderPageSize)" @click="orderPage++; loadOrders()">下一页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
// 订单管理面板 —— 自 admin.vue 抽出。
// 注意：原代码里 orders 的 <view v-if="activeTab==='orders'"> 被误嵌在 customPet 面板内，
// 两个 v-if 永不同时成立，导致「订单管理」整个 tab 从不渲染。抽成独立兄弟组件后修复。
import { ref, computed, onMounted } from 'vue'
import { adminGetOrders, adminRefundOrder, adminQueryRechargeOrderPayment } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const emit = defineEmits<{ error: [string] }>()

const orders = ref<any[]>([])
const ordersLoading = ref(false)
const orderTotal = ref(0)
const orderPage = ref(1)
const orderPageSize = 20
const orderStatusFilter = ref('all')
const expandedOrderId = ref('')
const refundingOrderId = ref('')
const queryingOrderId = ref('')
const notice = ref('')

const orderStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'refunded', label: '已退款' }
]

const expandedOrder = computed(() => {
  if (!expandedOrderId.value) return null
  return orders.value.find((o: any) => o._id === expandedOrderId.value) || null
})

function orderStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '待支付', paid: '已支付', refunded: '已退款' }
  return map[status] || status
}

function orderStatusColor(status: string) {
  const map: Record<string, string> = { pending: '#F59E0B', paid: '#10B981', refunded: '#999' }
  return map[status] || '#666'
}

async function loadOrders() {
  if (ordersLoading.value) return
  ordersLoading.value = true
  try {
    const result = await adminGetOrders({
      status: orderStatusFilter.value,
      page: orderPage.value,
      pageSize: orderPageSize
    })
    if (result?.success) {
      orders.value = result.orders || []
      orderTotal.value = result.total || 0
    }
  } catch (e: any) {
    emit('error', e?.message || '加载订单失败')
  } finally {
    ordersLoading.value = false
  }
}

function refundStatusLabel(status: string) {
  const map: Record<string, string> = { requesting: '提交中', processing: '退款中', refunded: '已退款', failed: '失败', anomaly: '异常' }
  return map[status] || status
}

async function doRefundOrder(orderId: string) {
  if (!orderId || refundingOrderId.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '微信退款', content: '将向微信发起退款，退款完成后自动撤销权益与奖励。确认继续？', success: (res: any) => resolve(!!res?.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  refundingOrderId.value = orderId
  try {
    const result = await adminRefundOrder(orderId)
    if (result?.success) {
      notice.value = result?.message || '退款任务已提交，等待微信处理'
      emit('error', '')
      await loadOrders()
    } else {
      emit('error', result?.message || '退款失败' + (result?.manualOption ? '（可尝试线下退款标记）' : ''))
    }
  } catch (e: any) {
    emit('error', e?.message || '退款失败')
  } finally {
    refundingOrderId.value = ''
  }
}

async function doManualRefund(orderId: string) {
  if (!orderId || refundingOrderId.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '线下退款标记', content: '确认已在微信商户平台完成线下退款？标记后系统将撤销权益与奖励。', success: (res: any) => resolve(!!res?.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  refundingOrderId.value = orderId
  try {
    const result = await adminRefundOrder(orderId, { manual: true, reason: 'admin_manual_refund' })
    if (result?.success) {
      notice.value = '已标记线下退款，权益与奖励已撤销'
      emit('error', '')
      await loadOrders()
    } else {
      emit('error', result?.message || '标记失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '标记失败')
  } finally {
    refundingOrderId.value = ''
  }
}

async function doQueryOrder(orderId: string) {
  if (!orderId || queryingOrderId.value) return
  queryingOrderId.value = orderId
  try {
    const result = await adminQueryRechargeOrderPayment(orderId, 'admin_reconcile')
    if (result?.success) {
      if (result?.action === 'fulfilled') notice.value = '微信侧已支付，已补发货'
      else if (result?.action === 'settled_refund') notice.value = '微信侧已退款，已结算'
      else if (result?.alreadyPaid) notice.value = '订单已支付且已发货'
      else notice.value = result?.message || '查单完成'
      emit('error', '')
      await loadOrders()
    } else {
      emit('error', result?.message || '查单失败')
      await loadOrders()
    }
  } catch (e: any) {
    emit('error', e?.message || '查单失败')
  } finally {
    queryingOrderId.value = ''
  }
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

onMounted(() => { loadOrders() })
</script>

<style scoped>
/* 共享基础类（自 admin.vue 复制；后续统一进 admin-common.scss） */
.panel { background: #fbfdfb; border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; box-shadow: 0 12px 28px rgba(23, 35, 31, 0.06); padding: 20px; }
.panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
.panel-title { display: block; font-size: 20px; font-weight: 700; }
.panel-meta { display: block; color: #68766f; font-size: 13px; line-height: 1.5; }
button { margin: 0; }
.ghost-btn { border-radius: 6px; font-size: 15px; width: 88px; height: 38px; line-height: 38px; color: #123c36; background: #eef6f2; border: 1px solid rgba(18, 60, 54, 0.18); }
.wide-btn { width: 104px; }
.small-btn { border-radius: 6px; font-size: 13px; width: auto; min-width: 74px; height: 34px; line-height: 34px; padding: 0 12px; color: #123c36; background: #fbfdfb; border: 1px solid rgba(18, 60, 54, 0.18); }
.small-btn.active { color: #fff; background: #123c36; }
.small-btn.danger { color: #9c2f22; border-color: rgba(156, 47, 34, 0.25); background: #fff6f4; }
.table { border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; overflow: hidden; }
.table-row { display: grid; grid-template-columns: minmax(220px, 1.7fr) minmax(90px, 0.7fr) 70px 80px; gap: 12px; align-items: center; padding: 12px 14px; border-top: 1px solid rgba(23, 35, 31, 0.08); font-size: 14px; }
.table-row:first-child { border-top: 0; }
.table-header { color: #68766f; background: #f3f7f4; font-weight: 700; }
.table-row.selected { background: #edf7f2; }
.empty { padding: 22px; color: #68766f; background: #f4f7f4; border-radius: 8px; }
.ok-alert { padding: 10px 14px; margin-bottom: 12px; border-radius: 6px; color: #1d6b4a; background: #e6f6ee; font-size: 13px; }
/* 订单专属 */
.order-detail { padding: 16px; margin-top: 8px; background: #fbfdfb; border-radius: 8px; border: 1px solid rgba(23, 35, 31, 0.08); }
.order-detail-grid { display: flex; flex-direction: column; gap: 6px; font-size: 34rpx; color: #555; }
</style>
