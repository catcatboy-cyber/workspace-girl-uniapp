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
          <view v-for="(img, i) in req.referenceImages" :key="i" class="pet-request-img-wrapper" @click="downloadImage(img)">
            <image :src="img" class="pet-request-img" mode="aspectFill" />
            <text class="pet-request-img-download">下载原图</text>
          </view>
        </view>
        <view v-if="req.adminNote" class="pet-request-note">
          <text>后台备注：{{ req.adminNote }}</text>
        </view>
        <view v-if="req.deliveredPet || req.deliveredPetId" class="pet-request-note">
          <text>已交付 Pet ID：{{ req.deliveredPet?.id || req.deliveredPetId }}</text>
          <text class="pet-request-version">版本：{{ req.deliveredPet?.version || req.deliveredResourceVersion || 'legacy' }}</text>
        </view>
        <view v-if="req.status === 'pending'" class="pet-request-actions">
          <button class="small-btn" @click="updatePetRequest(req._id, 'in_progress')">标记制作中</button>
          <button class="small-btn danger" @click="updatePetRequest(req._id, 'rejected')">拒绝</button>
        </view>
        <view v-if="req.status === 'in_progress'" class="pet-request-actions">
          <view class="pet-delivery-fields">
            <text class="pet-delivery-label">资源目录</text>
            <text class="pet-delivery-id">{{ req.expectedPetId }}</text>
            <input :value="tempVersions[req._id] || 'v1'" class="pet-request-version-input" placeholder="版本，如 v1" @input="onVersionInput(req._id, $event)" />
          </view>
          <button class="small-btn" :disabled="deliveringId === req._id" @click="deliverPetRequest(req, false)">{{ deliveringId === req._id ? '校验中...' : '校验并交付' }}</button>
        </view>
        <view v-if="req.status === 'delivered'" class="pet-request-actions">
          <view class="pet-delivery-fields">
            <text class="pet-delivery-label">重新交付目录</text>
            <text class="pet-delivery-id">{{ req.expectedPetId }}</text>
            <input :value="tempVersions[req._id] || nextVersion(req)" class="pet-request-version-input" placeholder="新版本，如 v2" @input="onVersionInput(req._id, $event)" />
          </view>
          <button class="small-btn" :disabled="deliveringId === req._id" @click="deliverPetRequest(req, true)">{{ deliveringId === req._id ? '校验中...' : '重新交付' }}</button>
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
const tempVersions = reactive<Record<string, string>>({})
const deliveringId = ref('')

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
      for (const req of requests) {
        if (req.status === 'in_progress' && !tempVersions[req._id]) tempVersions[req._id] = 'v1'
        if (req.status === 'delivered' && !tempVersions[req._id]) tempVersions[req._id] = nextVersion(req)
      }
    }
  } catch { /* ignore */ }
  finally { petRequestsLoading.value = false }
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '待处理', in_progress: '制作中', delivered: '已交付', rejected: '已拒绝' }
  return map[status] || status
}

function onVersionInput(requestId: string, e: any) {
  tempVersions[requestId] = String(e?.detail?.value || '').trim()
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

function nextVersion(request: any) {
  const current = String(request?.deliveredPet?.version || request?.deliveredResourceVersion || 'v0')
  const match = current.match(/^v([1-9]\d{0,8})$/)
  return `v${match ? Number(match[1]) + 1 : 1}`
}

async function deliverPetRequest(request: any, redelivery: boolean) {
  const requestId = String(request?._id || '')
  if (!requestId) return
  const version = String(tempVersions[requestId] || 'v1').trim()
  if (!version) { emit('error', '请填写资源版本'); return }

  emit('error', '')
  deliveringId.value = requestId
  try {
    if (!/^v[1-9]\d{0,8}$/.test(version)) {
      emit('error', '资源版本格式无效，请使用 v1、v2 等递增版本')
      return
    }
    const result = await adminUpdateCustomPetRequest(requestId, { status: 'delivered', version, redelivery })
    if (result?.success) {
      const req = petRequests.value.find((r: any) => r._id === requestId)
      if (req) {
        req.status = 'delivered'
        req.deliveredPetId = result.expectedPetId || req.expectedPetId
        req.deliveredResourceVersion = version
        req.deliveredPet = { id: req.deliveredPetId, version }
      }
      tempVersions[requestId] = `v${Number(version.slice(1)) + 1}`
    } else {
      emit('error', result?.message || '交付失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '交付失败')
  } finally {
    deliveringId.value = ''
  }
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function downloadImage(url: string) {
  if (!url) return
  // H5: 打开原图 URL 供下载/查看
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef MP-WEIXIN
  uni.previewImage({ urls: [url], current: url })
  // #endif
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
.pet-request-img-wrapper { position: relative; width: 100px; height: 100px; cursor: pointer; border-radius: 6px; overflow: hidden; border: 1px solid rgba(23, 35, 31, 0.12); }
.pet-request-img { width: 100%; height: 100%; display: block; }
.pet-request-img-download { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; text-align: center; padding: 2px 0; opacity: 0; transition: opacity 0.15s; }
.pet-request-img-wrapper:hover .pet-request-img-download { opacity: 1; }
.pet-request-note { margin-top: 6px; font-size: 13px; color: #68766f; }
.pet-request-version { display: block; margin-top: 3px; }
.pet-request-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(23, 35, 31, 0.08); }
.pet-delivery-fields { display: flex; flex: 1; align-items: center; gap: 8px; flex-wrap: wrap; }
.pet-delivery-label { font-size: 12px; color: #68766f; }
.pet-delivery-id { padding: 6px 8px; border-radius: 4px; background: #f1f5f3; font-family: monospace; font-size: 12px; color: #17231f; }
.pet-request-version-input { width: 90px; height: 34px; padding: 0 10px; border: 1px solid rgba(23, 35, 31, 0.18); border-radius: 6px; font-size: 13px; }
</style>
