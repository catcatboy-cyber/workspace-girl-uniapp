<template>
  <view class="avatar-picker">
    <view class="avatar-preview">
      <view class="profile-avatar lg">
        <image v-if="avatarPreviewSrc" :src="avatarPreviewSrc" mode="aspectFill" />
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
          <image :src="item.value" mode="aspectFill" />
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

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]

      uni.getFileInfo({
        filePath: tempFilePath,
        success: (fileInfo) => {
          if (fileInfo.size > 2 * 1024 * 1024) {
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
              console.error('avatar upload failed:', error)
              uploadError.value = '上传图片失败'
            } finally {
              uploading.value = false
            }
          })()
        },
        fail: () => {
          uploadError.value = '获��文件信息失败'
        }
      })
    },
    fail: () => {
      // 用户取消选择
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
.avatar-picker { padding: 24rpx 0; }

.avatar-preview {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: #efe7d8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar.lg {
  width: 120rpx;
  height: 120rpx;
}

.profile-avatar.md {
  width: 80rpx;
  height: 80rpx;
}

.profile-avatar image {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  font-size: 48rpx;
  font-weight: 700;
  color: #786857;
}

.avatar-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.field-label {
  font-size: 24rpx;
  color: #241b12;
  font-weight: 600;
}

.muted {
  display: block;
  font-size: 22rpx;
  color: #786857;
  line-height: 1.5;
}

.avatar-presets {
  display: flex;
  gap: 20rpx;
  margin-bottom: 24rpx;
  flex-wrap: wrap;
}

.avatar-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #fff;
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.avatar-preset.active {
  border-color: #143f3a;
  background: #dff5e8;
}

.preset-label {
  font-size: 22rpx;
  color: #241b12;
}

.avatar-actions {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.btn-secondary {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  background: #fff;
  color: #143f3a;
  border: 2rpx solid #143f3a;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.error-text {
  display: block;
  font-size: 24rpx;
  color: #b85c38;
  margin-top: 12rpx;
}

/* Premium visual pass */
.profile-avatar {
  background: var(--accent-soft, #efe6d6);
  border: 2rpx solid rgba(201, 164, 92, 0.42);
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.1);
}

.avatar-placeholder {
  color: var(--text-muted, #76695c);
}

.field-label,
.preset-label {
  color: var(--text-main, #201914);
}

.muted {
  color: var(--text-muted, #76695c);
}

.avatar-preset {
  background: var(--card-soft, #fffaf3);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}

.avatar-preset.active {
  background: var(--accent-soft, #efe6d6);
  border-color: var(--accent, #c9a45c);
  box-shadow: 0 10rpx 22rpx rgba(32, 25, 20, 0.08);
}

.btn-secondary {
  background: rgba(255, 252, 247, 0.92);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  color: var(--primary, #123c36);
  border-radius: 14rpx;
  font-weight: 600;
}

.error-text {
  color: var(--risk, #b84a3a);
}
</style>
