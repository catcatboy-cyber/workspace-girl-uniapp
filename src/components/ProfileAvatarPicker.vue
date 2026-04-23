<template>
  <view class="avatar-picker">
    <view class="avatar-preview">
      <view class="profile-avatar lg">
        <image v-if="avatarValue" :src="avatarValue" mode="aspectFill" />
        <text v-else class="avatar-placeholder">像</text>
      </view>
      <view class="avatar-info">
        <text class="field-label">头像</text>
        <text class="muted">{{ currentLabel }}</text>
        <text class="muted">可选本地动漫头像，也可以直接从相册选照片。</text>
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
      <button class="btn-secondary" @click="chooseImage">从相册选择照片</button>
      <button v-if="avatarValue" class="btn-secondary" @click="clearAvatar">清空头像</button>
    </view>

    <text v-if="!isPresetAvatar(avatarValue) && avatarValue.startsWith('data:image/')" class="muted">
      当前使用的是你本地选取的照片。
    </text>
    <text v-if="uploadError" class="error-text">{{ uploadError }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { presetAvatarOptions, isPresetAvatar } from '@/utils/avatar-options'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const avatarValue = ref(props.modelValue || '')
const uploadError = ref('')

const currentLabel = computed(() => {
  if (!avatarValue.value) return '未设置头像'
  const preset = presetAvatarOptions.find((item) => item.value === avatarValue.value)
  if (preset) return `当前已选：${preset.label}`
  if (avatarValue.value.startsWith('data:image/')) return '当前已选：本地照片'
  return '当前已选：自定义头像'
})

watch(avatarValue, (newVal) => {
  emit('update:modelValue', newVal)
})

watch(() => props.modelValue, (newVal) => {
  if (newVal !== avatarValue.value) {
    avatarValue.value = newVal || ''
  }
})

function selectPreset(value: string) {
  avatarValue.value = value
  uploadError.value = ''
}

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]

      // 获取文件信息检查大小
      uni.getFileInfo({
        filePath: tempFilePath,
        success: (fileInfo) => {
          if (fileInfo.size > 2 * 1024 * 1024) {
            uploadError.value = '图片请控制在 2MB 以内。'
            return
          }

          // 转换为 base64
          uni.getFileSystemManager().readFile({
            filePath: tempFilePath,
            encoding: 'base64',
            success: (readRes) => {
              avatarValue.value = `data:image/jpeg;base64,${readRes.data}`
              uploadError.value = ''
            },
            fail: () => {
              uploadError.value = '读取图片失败'
            }
          })
        },
        fail: () => {
          uploadError.value = '获取文件信息失败'
        }
      })
    },
    fail: () => {
      // 用户取消选择，不显示错误
    }
  })
}

function clearAvatar() {
  avatarValue.value = ''
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
</style>
