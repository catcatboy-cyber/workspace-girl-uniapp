<template>
  <view class="avatar-picker">
    <view class="avatar-preview">
      <view class="profile-avatar lg">
        <image v-if="avatarPreviewSrc" :src="avatarPreviewSrc" mode="aspectFill" class="avatar-img" />
        <text v-else class="avatar-placeholder">像</text>
      </view>
      <view class="avatar-info">
        <text class="field-label">头像</text>
        <text class="muted">{{ currentLabel }}</text>
        <text class="muted">可选本地动漫头像，也可以直接从相册选择照片。</text>
      </view>
    </view>

    <view class="avatar-presets">
      <view
        v-for="item in presetAvatarOptions"
        :key="item.value"
        :class="['avatar-preset', { active: avatarValue === item.value }]"
        @click="selectPreset(item.value)"
      >
        <view class="profile-avatar md">
          <image :src="item.value" mode="aspectFill" class="avatar-img" />
        </view>
        <text class="preset-label">{{ item.label }}</text>
      </view>
    </view>

    <view class="avatar-actions">
      <button class="btn-secondary" :disabled="uploading" @click="chooseImage">
        {{ uploading ? '上传中...' : '从相册选择照片' }}
      </button>
      <button v-if="avatarValue" class="btn-secondary" :disabled="uploading" @click="clearAvatar">清空头像</button>
    </view>

    <text v-if="!isPresetAvatar(avatarValue) && avatarValue" class="muted">
      当前使用的是你上传到云存储的自定义头像。
    </text>
    <text v-if="uploadError" class="error-text">{{ uploadError }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { presetAvatarOptions, isPresetAvatar } from '@/utils/avatar-options'
import { uploadFile } from '@/utils/api'
import { createAvatarCloudPath, resolveAvatarSrc } from '@/utils/avatar'
import { aiLabel } from '@/utils/labels'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'preview-change', value: string): void
}>()

const avatarValue = ref('')
const avatarPreviewSrc = ref('')
const uploadError = ref('')
const uploading = ref(false)

const currentLabel = computed(() => {
  if (!avatarValue.value) return '未设置头像'
  const preset = presetAvatarOptions.find((item) => item.value === avatarValue.value)
  if (preset) return `当前已选：${preset.label}`
  return '当前已选：自定义头像'
})

watch(avatarValue, (newVal) => {
  emit('update:modelValue', newVal)
})

watch(avatarPreviewSrc, (newVal) => {
  emit('preview-change', newVal)
})

watch(() => props.modelValue, async (newVal) => {
  const nextValue = newVal || ''
  if (nextValue !== avatarValue.value) {
    avatarValue.value = nextValue
  }
  avatarPreviewSrc.value = await resolveAvatarSrc(nextValue)
}, { immediate: true })

function selectPreset(value: string) {
  avatarValue.value = value
  avatarPreviewSrc.value = value
  uploadError.value = ''
}

async function chooseImage() {
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
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res: any = {}) => {
      const tempFilePath = res?.tempFilePaths?.[0] || res?.tempFiles?.[0]?.path || res?.tempFiles?.[0]?.tempFilePath
      if (!tempFilePath) return

      uni.getFileInfo({
        filePath: tempFilePath,
        success: (fileInfo: any = {}) => {
          if (Number(fileInfo?.size || 0) > 2 * 1024 * 1024) {
            uploadError.value = '图片请控制在 2MB 以内。'
            return
          }

          ;(async () => {
            try {
              uploading.value = true
              uploadError.value = ''

              let uploadSource: any = tempFilePath
              // #ifdef H5
              uploadSource = (res.tempFiles && (res.tempFiles[0] as any)?.file) || (res.tempFiles && res.tempFiles[0]) || tempFilePath
              // #endif

              const fileID = await uploadFile(uploadSource, createAvatarCloudPath(tempFilePath))
              avatarValue.value = fileID
              avatarPreviewSrc.value = await resolveAvatarSrc(fileID)
            } catch (error) {
              uploadError.value = '上传图片失败'
            } finally {
              uploading.value = false
            }
          })()
        },
        fail: () => {
          uploadError.value = '获取文件信息失败'
        }
      })
    },
    fail: (err: any) => {
      const msg = String(err?.errMsg || '')
      if (msg.includes('cancel')) return // 用户取消
      uploadError.value = '选择图片失败，请检查相册权限'
    }
  })
}

function clearAvatar() {
  avatarValue.value = ''
  avatarPreviewSrc.value = ''
  uploadError.value = ''
}
</script>

<style scoped>
/* ===== ProfileAvatarPicker — Campus Pop ===== */
.avatar-picker { padding: 24rpx 0; }

.avatar-preview { display: flex; align-items: center; gap: 24rpx; margin-bottom: 32rpx; }

.profile-avatar { border-radius: 50%; overflow: hidden; background: #FFD93D; display: flex; align-items: center; justify-content: center; border: 3rpx solid #111; }
.profile-avatar.lg { width: 120rpx; height: 120rpx; }
.profile-avatar.md { width: 80rpx; height: 80rpx; }
.profile-avatar .avatar-img { width: 100%; height: 100%; }

.avatar-placeholder { font-size: 44rpx; font-weight: 900; color: #111; }

.avatar-info { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.field-label { font-size: 34rpx; color: #111; font-weight: 800; }
.muted { display: block; font-size: 34rpx; color: #666; line-height: 1.5; font-weight: 600; }

.avatar-presets { display: flex; gap: 16rpx; margin-bottom: 24rpx; flex-wrap: wrap; }
.avatar-preset { display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 16rpx; border: 2rpx solid #111; background: #fff; }
.avatar-preset.active { background: #111; }
.avatar-preset.active .preset-label { color: #FFD93D; }

.preset-label { font-size: 34rpx; font-weight: 700; color: #111; }

.avatar-actions { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.btn-secondary { flex: 1; height: 72rpx; line-height: 72rpx; background: #fff; color: #111; border: 3rpx solid #111; font-size: 36rpx; font-weight: 800; }
.btn-secondary:disabled { opacity: 0.6; }

.error-text { display: block; font-size: 34rpx; color: #FF5252; margin-top: 12rpx; font-weight: 600; }
</style>
