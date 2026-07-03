<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">宠物定制需求</text>
        <text class="panel-meta">{{ petRequests.length }} 条需求</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="petRequestsLoading" @click="loadPetRequests">{{ petRequestsLoading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="petRequests.length === 0 && !petRequestsLoading" class="empty">暂无宠物定制需求。</view>
    <view v-else class="pet-request-list">
      <view v-for="(req, index) in petRequests" :key="req._id || index" class="pet-request-item" :class="req.status">
        <view class="pet-request-head">
          <view>
            <text class="pet-request-nickname">{{ req.nickname }}</text>
            <text class="pet-request-user">用户：{{ req.userId || '未知' }}</text>
            <text class="pet-request-time">{{ formatDate(req.createdAt) }}</text>
          </view>
          <view class="pet-request-status-row">
            <text :class="['pet-request-status', req.status]">{{ statusLabel(req.status) }}</text>
          </view>
        </view>
        <text class="pet-request-desc">{{ req.description }}</text>
        <view v-if="req.referenceImages && req.referenceImages.length" class="pet-request-images">
          <image v-for="(img, i) in req.referenceImages" :key="i" :src="img" class="pet-request-img" mode="aspectFill" />
        </view>
        <view v-if="req.adminNote" class="pet-request-note">
          <text>后台备注：{{ req.adminNote }}</text>
        </view>
        <view v-if="req.deliveredPetId" class="pet-request-note">
          <text>已交付 Pet ID：{{ req.deliveredPetId }}</text>
        </view>
        <view v-if="req.status === 'pending'" class="pet-request-actions">
          <button class="small-btn" @click="updatePetRequest(req._id, 'in_progress')">标记制作中</button>
          <button class="small-btn danger" @click="updatePetRequest(req._id, 'rejected')">拒绝</button>
        </view>
        <view v-if="req.status === 'in_progress'" class="pet-request-actions">
          <input :value="tempDeliveredPetIds[req._id] || ''" class="pet-request-petid-input" placeholder="输入交付的 Pet ID" @input="onDeliveredPetIdInput(req._id, $event)" />
          <button class="small-btn" @click="deliverPetRequest(req._id)">标记已交付</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 宠物定制需求面板 —— 自 admin.vue 抽出。
// 修复：原模板里交付输入框的 v-if 用了未定义变量 deliveredPetIds（in_progress 项渲染即崩），已移除该 v-if。
import { ref, reactive, onMounted } from 'vue'
import { adminListCustomPetRequests, adminUpdateCustomPetRequest } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const emit = defineEmits<{ error: [string] }>()

const petRequests = ref<any[]>([])
const petRequestsLoading = ref(false)
const tempDeliveredPetIds = reactive<Record<string, string>>({})

async function loadPetRequests() {
  petRequestsLoading.value = true
  try {
    const result = await adminListCustomPetRequests()
    if (result?.success) {
      const requests = result.requests || []
      // Resolve cloud:// file IDs to temp URLs for H5 display
      const allFileIds: string[] = []
      for (const req of requests) {
        if (req.referenceImages && req.referenceImages.length) {
          for (const img of req.referenceImages) {
            if (img && img.startsWith('cloud://')) allFileIds.push(img)
          }
        }
      }
      if (allFileIds.length) {
        try {
          const urlRes: any = await uni.cloud.getTempFileURL({ fileList: allFileIds })
          const fileMap: Record<string, string> = {}
          const files = urlRes?.fileList || []
          for (const f of files) {
            if (f.fileID && f.tempFileURL) fileMap[f.fileID] = f.tempFileURL
          }
          for (const req of requests) {
            if (req.referenceImages && req.referenceImages.length) {
              req.referenceImages = req.referenceImages.map((img: string) => fileMap[img] || img)
            }
          }
        } catch { /* ignore resolution errors */ }
      }
      petRequests.value = requests
    }
  } catch { /* ignore */ }
  finally { petRequestsLoading.value = false }
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '待处理', in_progress: '制作中', delivered: '已交付', rejected: '已拒绝' }
  return map[status] || status
}

function onDeliveredPetIdInput(requestId: string, e: any) {
  tempDeliveredPetIds[requestId] = String(e?.detail?.value || '').trim()
}

async function updatePetRequest(requestId: string, status: string) {
  if (!requestId) return
  emit('error', '')
  try {
    const result = await adminUpdateCustomPetRequest(requestId, { status })
    if (result?.success) {
      const req = petRequests.value.find((r: any) => r._id === requestId)
      if (req) req.status = status
    } else {
      emit('error', result?.message || '更新失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '更新失败')
  }
}

async function deliverPetRequest(requestId: string) {
  if (!requestId) return
  const deliveredPetId = tempDeliveredPetIds[requestId] || ''
  if (!deliveredPetId) { emit('error', '请填写交付的 Pet ID'); return }

  emit('error', '')
  try {
    const result = await adminUpdateCustomPetRequest(requestId, { status: 'delivered', deliveredPetId })
    if (result?.success) {
      const req = petRequests.value.find((r: any) => r._id === requestId)
      if (req) { req.status = 'delivered'; req.deliveredPetId = deliveredPetId }
      delete tempDeliveredPetIds[requestId]
    } else {
      emit('error', result?.message || '交付失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '交付失败')
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

onMounted(() => { loadPetRequests() })
</script>

<style scoped lang="scss">
@import '../../styles/admin-common.scss';

.pet-request-list { display: flex; flex-direction: column; gap: 12px; }
.pet-request-item { padding: 16px; border: 1px solid rgba(23, 35, 31, 0.12); border-radius: 8px; background: #fff; }
.pet-request-item.delivered { opacity: 0.7; background: #f6f9f6; }
.pet-request-item.rejected { opacity: 0.5; background: #fef5f5; }
.pet-request-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.pet-request-nickname { display: block; font-size: 17px; font-weight: 700; color: #17231f; }
.pet-request-user { font-size: 12px; color: #68766f; margin-left: 10px; }
.pet-request-time { display: block; font-size: 12px; color: #9ea7a3; margin-top: 2px; }
.pet-request-status { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
.pet-request-status.pending { background: #fff8e1; color: #b45309; }
.pet-request-status.in_progress { background: #e3f2fd; color: #1e40af; }
.pet-request-status.delivered { background: #e6f4ec; color: #0f6b45; }
.pet-request-status.rejected { background: #fde8e8; color: #c62828; }
.pet-request-desc { display: block; font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 8px; }
.pet-request-images { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pet-request-img { width: 100px; height: 100px; border-radius: 6px; border: 1px solid rgba(23, 35, 31, 0.12); }
.pet-request-note { margin-top: 6px; font-size: 13px; color: #68766f; }
.pet-request-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(23, 35, 31, 0.08); }
.pet-request-petid-input { width: 200px; height: 34px; padding: 0 10px; border: 1px solid rgba(23, 35, 31, 0.18); border-radius: 6px; font-size: 13px; }
</style>
