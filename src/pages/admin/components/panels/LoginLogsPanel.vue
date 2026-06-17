<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">登录日志</text>
        <text class="panel-meta">{{ total }} 条记录</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="loading" @click="loadLogs(1)">{{ loading ? '加载中' : '刷新' }}</button>
    </view>

    <!-- 筛选条件 -->
    <view class="filter-bar" style="margin-bottom:20rpx;">
      <view class="filter-row">
        <text class="filter-label">用户ID</text>
        <input v-model="filterUserId" class="filter-input" placeholder="输入 userId" @confirm="loadLogs(1)" />
      </view>
      <view class="filter-row">
        <text class="filter-label">邮箱</text>
        <input v-model="filterEmail" class="filter-input" placeholder="输入邮箱" @confirm="loadLogs(1)" />
      </view>
      <view class="filter-row">
        <text class="filter-label">类型</text>
        <picker :range="loginTypeOptions" :value="loginTypeIndex" @change="onLoginTypeChange">
          <view class="filter-picker">{{ loginTypeOptions[loginTypeIndex] }}</view>
        </picker>
      </view>
      <view class="filter-row">
        <text class="filter-label">开始日期</text>
        <picker mode="date" :value="filterStartDate" @change="onStartDateChange">
          <view class="filter-picker">{{ filterStartDate || '不限' }}</view>
        </picker>
      </view>
      <view class="filter-row">
        <text class="filter-label">结束日期</text>
        <picker mode="date" :value="filterEndDate" @change="onEndDateChange">
          <view class="filter-picker">{{ filterEndDate || '不限' }}</view>
        </picker>
      </view>
      <view class="filter-actions">
        <button class="small-btn" @click="clearFilters">清空</button>
        <button class="small-btn primary" :disabled="loading" @click="loadLogs(1)">查询</button>
      </view>
    </view>

    <!-- 用户统计 -->
    <view v-if="userStats.length > 0" class="stats-section">
      <text class="stats-title">用户登录统计（Top {{ userStats.length }}）</text>
      <view class="stats-table">
        <view class="stats-row stats-header">
          <text class="stats-cell wide">用户</text>
          <text class="stats-cell">登录次数</text>
          <text class="stats-cell wide">最后登录</text>
        </view>
        <view v-for="stat in userStats" :key="stat.userId" class="stats-row" @click="filterByUser(stat)">
          <text class="stats-cell wide">{{ stat.email || stat.userId }}</text>
          <text class="stats-cell bold">{{ stat.totalLogins }}</text>
          <text class="stats-cell wide">{{ formatDate(stat.lastLogin) }}</text>
        </view>
      </view>
    </view>

    <!-- 详细日志列表 -->
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="logs.length === 0" class="empty">暂无登录日志。</view>
    <view v-else class="log-list">
      <view v-for="(log, index) in logs" :key="log._id || index" class="log-item">
        <view class="log-head">
          <text class="log-time">{{ formatDate(log.createdAt) }}</text>
          <text :class="['log-type', log.loginType === 'wechat' ? 'wechat' : 'email']">{{ log.loginType === 'wechat' ? '微信' : '邮箱' }}</text>
          <text class="log-platform">{{ log.platform || '-' }}</text>
        </view>
        <view class="log-body">
          <text class="log-uid" @click="filterByUserId(log.userId)">用户：{{ log.email || log.userId }}</text>
        </view>
      </view>
    </view>

    <!-- 分页 -->
    <view v-if="totalPages > 1" class="pager">
      <button class="small-btn" :disabled="page <= 1" @click="loadLogs(page - 1)">上一页</button>
      <text class="pager-text">{{ page }} / {{ totalPages }}</text>
      <button class="small-btn" :disabled="page >= totalPages" @click="loadLogs(page + 1)">下一页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { getLoginLogs } from '@/utils/api'

const emit = defineEmits<{ error: [string] }>()

const logs = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const totalPages = ref(0)
const userStats = ref<any[]>([])

// 筛选条件
const filterUserId = ref('')
const filterEmail = ref('')
const filterLoginType = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')

const loginTypeOptions = ['全部', '邮箱', '微信', '小程序']
const loginTypeIndex = ref(0)

function onLoginTypeChange(e: any) {
  const idx = Number(e.detail.value)
  loginTypeIndex.value = idx
  if (idx === 0) filterLoginType.value = ''
  else if (idx === 1) filterLoginType.value = 'email'
  else if (idx === 2) filterLoginType.value = 'wechat'
  else if (idx === 3) filterLoginType.value = 'miniprogram'
}

function onStartDateChange(e: any) {
  filterStartDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  filterEndDate.value = e.detail.value
}

function clearFilters() {
  filterUserId.value = ''
  filterEmail.value = ''
  filterLoginType.value = ''
  filterStartDate.value = ''
  filterEndDate.value = ''
  loginTypeIndex.value = 0
  loadLogs(1)
}

function filterByUser(stat: any) {
  filterUserId.value = stat.userId
  filterEmail.value = ''
  loadLogs(1)
}

function filterByUserId(uid: string) {
  filterUserId.value = uid
  filterEmail.value = ''
  loadLogs(1)
}

async function loadLogs(p: number) {
  loading.value = true
  page.value = p
  try {
    const params: any = { page: p, pageSize: pageSize.value }
    if (filterUserId.value.trim()) params.userId = filterUserId.value.trim()
    if (filterEmail.value.trim()) params.email = filterEmail.value.trim()
    if (filterLoginType.value) params.loginType = filterLoginType.value
    if (filterStartDate.value) params.startDate = filterStartDate.value
    if (filterEndDate.value) params.endDate = filterEndDate.value

    const result = await getLoginLogs(params)
    if (result?.success) {
      logs.value = result.data || []
      total.value = result.total || 0
      totalPages.value = result.totalPages || 0
      userStats.value = result.userStats || []
    } else {
      emit('error', result?.message || '加载失败')
    }
  } catch {
    emit('error', '网络错误')
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 初始化加载
loadLogs(1)
</script>

<style scoped>
.panel {
  padding: 0;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.panel-title {
  font-size: 32rpx;
  font-weight: 900;
  color: #111;
  display: block;
}
.panel-meta {
  font-size: 20rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}
.empty {
  text-align: center;
  padding: 60rpx 0;
  font-size: 24rpx;
  color: #999;
}

/* 筛选 */
.filter-bar {
  background: #f9f9f9;
  border: 2rpx solid #111;
  padding: 20rpx;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.filter-label {
  width: 120rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #111;
  flex-shrink: 0;
}
.filter-input {
  flex: 1;
  height: 56rpx;
  padding: 0 16rpx;
  border: 2rpx solid #111;
  font-size: 22rpx;
  background: #fff;
}
.filter-picker {
  flex: 1;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 16rpx;
  border: 2rpx solid #111;
  font-size: 22rpx;
  background: #fff;
  color: #111;
}
.filter-actions {
  display: flex;
  gap: 10rpx;
  justify-content: flex-end;
  margin-top: 8rpx;
}

/* 统计 */
.stats-section {
  margin-top: 24rpx;
  margin-bottom: 24rpx;
}
.stats-title {
  display: block;
  font-size: 24rpx;
  font-weight: 900;
  color: #111;
  margin-bottom: 12rpx;
}
.stats-table {
  border: 2rpx solid #111;
}
.stats-row {
  display: flex;
  padding: 12rpx 16rpx;
  border-bottom: 1rpx solid #ddd;
  align-items: center;
}
.stats-row:last-child {
  border-bottom: none;
}
.stats-row.stats-header {
  background: #111;
}
.stats-row.stats-header .stats-cell {
  color: #FFD93D;
  font-weight: 900;
}
.stats-cell {
  flex: 1;
  font-size: 20rpx;
  color: #111;
  text-align: center;
}
.stats-cell.wide {
  flex: 2;
  text-align: left;
}
.stats-cell.bold {
  font-weight: 900;
  color: #FF6B6B;
}

/* 日志列表 */
.log-list {
  margin-top: 16rpx;
}
.log-item {
  padding: 16rpx;
  border: 2rpx solid #111;
  background: #fff;
  margin-bottom: 10rpx;
}
.log-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.log-time {
  font-size: 20rpx;
  color: #999;
}
.log-type {
  padding: 2rpx 12rpx;
  border: 2rpx solid #111;
  font-size: 18rpx;
  font-weight: 700;
}
.log-type.email {
  background: #e3f2fd;
  color: #1565c0;
}
.log-type.wechat {
  background: #e8f5e9;
  color: #2e7d32;
}
.log-platform {
  font-size: 20rpx;
  color: #999;
}
.log-body {
  display: flex;
}
.log-uid {
  font-size: 22rpx;
  color: #111;
  font-weight: 600;
  text-decoration: underline;
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 16rpx 0;
}
.pager-text {
  font-size: 24rpx;
  font-weight: 700;
  color: #111;
}

/* 按钮 */
.ghost-btn {
  border: 2rpx solid #111;
  background: #fff;
  padding: 8rpx 20rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: #111;
}
.ghost-btn:disabled {
  opacity: 0.5;
}
.wide-btn {
  min-width: 100rpx;
}
.small-btn {
  padding: 8rpx 20rpx;
  border: 2rpx solid #111;
  background: #fff;
  font-size: 20rpx;
  font-weight: 700;
  color: #111;
}
.small-btn:disabled {
  opacity: 0.4;
}
.small-btn.primary {
  background: #111;
  color: #FFD93D;
}
</style>
