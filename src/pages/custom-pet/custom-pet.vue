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
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { callFunction } from '@/utils/cloudbase'
import { checkFeatureAccess, getCurrentUserId } from '@/utils/api'
import { getCurrentThemeId, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

const themeVars = ref(getThemeStyle())

const nickname = ref('')
const description = ref('')
const images = ref<string[]>([])
const submitting = ref(false)

const canSubmit = computed(() => nickname.value.trim() && description.value.trim())

onMounted(async () => {
  try {
    const access = await checkFeatureAccess('自定义宠物')
    if (access?.allowed === false) {
      uni.showModal({
        title: '功能不可用',
        content: access.reason || '当前月卡不支持自定义宠物功能，请购买月卡。',
        confirmText: '返回',
        showCancel: false,
        success: () => uni.navigateBack({ delta: 1 })
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
      if (res.fileID) uploadedUrls.push(res.fileID)
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
      setTimeout(() => uni.navigateBack(), 2500)
    } else {
      uni.showToast({ title: result.message || '提交失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
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
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: #666; line-height: 1.4; margin-bottom: 10rpx; }

.v2-mode .input-v2 { width: 100%; height: 80rpx; border: 2rpx solid #111; padding: 0 20rpx; font-size: $fs-body-lg; font-weight: $fw-label; color: #111; box-sizing: border-box; background: #fff; }
.v2-mode .textarea-v2 { width: 100%; height: 240rpx; border: 2rpx solid #111; padding: 16rpx 20rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; box-sizing: border-box; background: #fff; line-height: 1.6; }

.v2-mode .img-grid-v2 { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 12rpx; }
.v2-mode .img-box-v2 { width: 180rpx; height: 180rpx; border: 2rpx solid #111; position: relative; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; }
.v2-mode .img-del-v2 { position: absolute; top: -12rpx; right: -12rpx; width: 44rpx; height: 44rpx; border-radius: 50%; background: #FF5252; color: #fff; font-size: $fs-body-lg; font-weight: $fw-hero; text-align: center; line-height: 44rpx; border: 2rpx solid #111; }
.v2-mode .img-add-v2 { width: 180rpx; height: 180rpx; border: 2rpx dashed #111; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; background: #f9f9f9; }
.v2-mode .img-add-icon-v2 { font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1; }
.v2-mode .img-add-label-v2 { font-size: $fs-caption; font-weight: $fw-label; color: #999; }

</style>
