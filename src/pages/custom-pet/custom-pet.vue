<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">CUSTOM PET</text>
      <text class="hero-title-v2">定制<text class="hl-v2">宠物</text></text>
      <text class="hero-copy-v2">描述你心中的专属陪伴形象，我们会为你制作。</text>
    </view>

    <view class="card-v2">
      <text class="section-title-v2">宠物昵称</text>
      <input v-model="nickname" class="input-v2" placeholder="给你的宠物起个名字" maxlength="20" />
    </view>

    <view class="card-v2">
      <text class="section-title-v2">定制说明</text>
      <text class="card-text-v2">描述你想要的外观、性格和风格，越详细越好。</text>
      <textarea v-model="description" class="textarea-v2" placeholder="比如：我想要一只圆脸垂耳的柴犬，毛色偏奶油，性格温柔但偶尔调皮，眼神要灵动一点..." maxlength="500" />
    </view>

    <view class="card-v2">
      <text class="section-title-v2">参考图片（可选）</text>
      <text class="card-text-v2">最多上传 3 张参考图。</text>
      <view class="img-grid-v2">
        <view v-for="(img, idx) in images" :key="idx" class="img-box-v2">
          <image :src="img" class="img-preview-v2" mode="aspectFill" />
          <text class="img-del-v2" @click="removeImg(idx)">x</text>
        </view>
        <view v-if="images.length < 3" class="img-add-v2" @click="pickImage">
          <text class="img-add-icon-v2">+</text>
          <text class="img-add-label-v2">上传图片</text>
        </view>
      </view>
    </view>

    <button class="btn btn-primary btn-lg btn-full" style="margin-bottom:40rpx;" :disabled="!canSubmit || submitting" @click="submit">
      {{ submitting ? '提交中...' : '提交定制需求' }}
    </button>

    <view class="history-head-v2">
      <text class="section-title-v2">我的定制记录</text>
      <text class="history-refresh-v2" @click="loadMyRequests(true)">刷新</text>
    </view>
    <view v-if="requestsLoading && !myRequests.length" class="card-v2 history-state-v2">记录加载中...</view>
    <view v-else-if="requestsError && !myRequests.length" class="card-v2 history-state-v2 error">{{ requestsError }}</view>
    <view v-else-if="!myRequests.length" class="card-v2 history-state-v2">还没有定制记录。</view>
    <view v-else class="request-list-v2">
      <view v-for="req in myRequests" :key="req.requestId" class="card-v2 request-item-v2">
        <view class="request-head-v2">
          <text class="request-name-v2">{{ req.nickname }}</text>
          <text :class="['request-status-v2', req.status]">{{ statusLabel(req.status) }}</text>
        </view>
        <text class="request-desc-v2">{{ req.description }}</text>
        <view v-if="req.referenceImageURLs?.length" class="request-images-v2">
          <image v-for="(url, index) in req.referenceImageURLs" :key="url" :src="url" class="request-image-v2" mode="aspectFill" @click="previewRequestImage(req.referenceImageURLs, index)" />
        </view>
        <text class="request-time-v2">提交于 {{ formatDate(req.createdAt) }}</text>
        <view v-if="req.status === 'delivered'" class="delivery-notice-v2">
          <text class="delivery-title-v2">你的专属宠物已制作完成</text>
          <text class="delivery-copy-v2">请前往「我的 → 更换宠物」选择使用。</text>
        </view>
      </view>
      <button v-if="nextCursor" class="btn btn-secondary btn-full load-more-v2" :disabled="requestsLoading" @click="loadMyRequests(false)">
        {{ requestsLoading ? '加载中...' : '加载更多' }}
      </button>
      <text v-if="requestsError" class="history-inline-error-v2">{{ requestsError }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/cloudbase'
import { checkFeatureAccess, getCurrentUserId, contentSecCheck, getContentSecurityMessage, getMyCustomPetRequests } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

const themeVars = ref(getThemeStyle())

const nickname = ref('')
const description = ref('')
const images = ref<string[]>([])
const submitting = ref(false)
const featureAllowed = ref(true)
const myRequests = ref<any[]>([])
const requestsLoading = ref(false)
const requestsError = ref('')
const nextCursor = ref<string | null>(null)

const canSubmit = computed(() => featureAllowed.value && nickname.value.trim() && description.value.trim())

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (getCurrentUserId()) loadMyRequests(true)
})

onMounted(async () => {
  try {
    const access = await checkFeatureAccess('自定义宠物')
    if (access?.allowed === false) {
      featureAllowed.value = false
      uni.showModal({
        title: '功能不可用',
        content: access.reason || '当前月卡不支持自定义宠物功能，请购买月卡。',
        confirmText: '知道了',
        showCancel: false,
      })
    }
  } catch (_) { /* ignore */ }
})

async function pickImage() {
  // 先确保隐私协议已同意（微信 2023.09 起要求）
  try {
    const wxApi = (globalThis as any)?.wx
    if (wxApi?.requirePrivacyAuthorize) {
      await new Promise<void>((resolve, reject) => {
        wxApi.requirePrivacyAuthorize({ success: () => resolve(), fail: reject })
      })
    }
  } catch {
    uni.showToast({ title: '请先同意隐私政策', icon: 'none' })
    return
  }

  uni.chooseImage({
    count: 3 - images.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      images.value.push(...res.tempFilePaths)
    },
    fail: (err: any = {}) => {
      const msg = String(err?.errMsg || err?.message || '')
      if (!msg.includes('cancel')) uni.showToast({ title: '无法打开相册', icon: 'none' })
    }
  })
}

function removeImg(idx: number) {
  images.value.splice(idx, 1)
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true

  try {
    const uploadedUrls: string[] = []

    for (const path of images.value) {
      const cloudPath = `custom-pets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const res: any = await uni.cloud.uploadFile({ cloudPath, filePath: path })
      if (res.fileID) {
        // 内容安全检测
        const securityResult = await contentSecCheck(res.fileID, 'custom_pet')
        if (!securityResult.pass) {
          submitting.value = false
          uni.showToast({ title: getContentSecurityMessage(securityResult), icon: 'none', duration: 2000 })
          return
        }
        uploadedUrls.push(res.fileID)
      }
    }

    const uid = getCurrentUserId()
    const res = await callFunction({
      name: 'customPet',
      data: {
        userId: uid,
        action: 'submit',
        nickname: nickname.value.trim(),
        description: description.value.trim(),
        referenceImages: uploadedUrls
      }
    })
    const result = (res as any).result || {}

    if (result.success) {
      uni.showToast({ title: '已提交，我们会尽快为你制作！', icon: 'none', duration: 2500 })
      nickname.value = ''
      description.value = ''
      images.value = []
      await loadMyRequests(true)
    } else {
      uni.showToast({ title: result.message || '提交失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function loadMyRequests(reset = false) {
  if (requestsLoading.value || !getCurrentUserId()) return
  requestsLoading.value = true
  requestsError.value = ''
  try {
    const result = await getMyCustomPetRequests(reset ? null : nextCursor.value, 20)
    if (!result?.success) throw new Error(result?.message || '读取定制记录失败')
    const requests = Array.isArray(result.requests) ? result.requests : []
    myRequests.value = reset ? requests : [...myRequests.value, ...requests]
    nextCursor.value = result.nextCursor || null
  } catch (error: any) {
    requestsError.value = error?.message || '读取定制记录失败'
  } finally {
    requestsLoading.value = false
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待处理',
    in_progress: '制作中',
    delivered: '已完成',
    rejected: '未通过'
  }
  return labels[status] || status
}

function formatDate(value: any) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function previewRequestImage(urls: string[], index: number) {
  uni.previewImage({ urls, current: urls[index] })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page {
  min-height: 100vh;
  padding: 18rpx;
  box-sizing: border-box;
}
.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.4; margin-bottom: 10rpx; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); padding: 0 20rpx; font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); box-sizing: border-box; background: var(--surface, #fff); }
.v2-mode .textarea-v2 { width: 100%; height: 240rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); padding: 16rpx 20rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); box-sizing: border-box; background: var(--surface, #fff); line-height: 1.6; }

.v2-mode .img-grid-v2 { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 12rpx; }
.v2-mode .img-box-v2 { width: 180rpx; height: 180rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); position: relative; overflow: hidden; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; }
.v2-mode .img-del-v2 { position: absolute; top: -12rpx; right: -12rpx; width: 44rpx; height: 44rpx; border-radius: 50%; background: var(--risk, #FF5252); color: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-hero; text-align: center; line-height: 44rpx; border: var(--border-width, 2rpx) solid var(--border, #111); }
.v2-mode .img-add-v2 { width: 180rpx; height: 180rpx; border: var(--border-width, 2rpx) dashed var(--border, #111); border-radius: var(--shape-radius-inner, 0); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; background: var(--surface-dim, #f9f9f9); }
.v2-mode .img-add-icon-v2 { font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1; }
.v2-mode .img-add-label-v2 { font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #999); }

.history-head-v2 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14rpx; }
.history-head-v2 .section-title-v2 { margin-bottom: 0; }
.history-refresh-v2 { font-size: $fs-caption; font-weight: $fw-hero; color: var(--accent-cool, #168f88); padding: 10rpx; }
.history-state-v2 { display: block; color: var(--text-muted, #666); font-size: $fs-body-lg; }
.history-state-v2.error, .history-inline-error-v2 { color: var(--risk, #d43d3d); }
.request-list-v2 { display: flex; flex-direction: column; gap: 18rpx; padding-bottom: 32rpx; }
.request-item-v2 { margin-bottom: 0 !important; }
.request-head-v2 { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.request-name-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.request-status-v2 { flex-shrink: 0; padding: 6rpx 14rpx; border: 2rpx solid var(--border, #111); font-size: $fs-caption; font-weight: $fw-hero; background: var(--surface-dim, #f4f4f4); }
.request-status-v2.pending { background: #fff3c4; }
.request-status-v2.in_progress { background: #dff3ff; }
.request-status-v2.delivered { background: #dff8e9; }
.request-status-v2.rejected { background: #ffe1e1; }
.request-desc-v2 { display: block; margin-top: 12rpx; color: var(--text-muted, #666); font-size: $fs-body-lg; line-height: 1.55; }
.request-images-v2 { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 14rpx; }
.request-image-v2 { width: 132rpx; height: 132rpx; border: 2rpx solid var(--border, #111); }
.request-time-v2 { display: block; margin-top: 14rpx; color: var(--text-soft, #999); font-size: $fs-caption; }
.delivery-notice-v2 { margin-top: 16rpx; padding: 16rpx; border: 2rpx solid var(--border, #111); background: var(--success-soft, #dff8e9); }
.delivery-title-v2 { display: block; color: var(--text-main, #111); font-size: $fs-body-lg; font-weight: $fw-hero; }
.delivery-copy-v2 { display: block; margin-top: 6rpx; color: var(--text-muted, #555); font-size: $fs-body; }
.load-more-v2 { margin-top: 0; }
.history-inline-error-v2 { display: block; text-align: center; font-size: $fs-caption; }

</style>
