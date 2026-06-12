<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">FEEDBACK</text>
      <text class="hero-title-v2">系统<text class="hl-v2">反馈</text></text>
      <text class="hero-copy-v2">告诉我们你的使用体验、建议或遇到的问题。</text>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">反馈内容</text>
      <textarea v-model="content" class="text-area-v2" placeholder="请输入你的反馈意见..." :maxlength="1000" />
      <text class="char-count-v2">{{ content.length }}/1000</text>
    </view>
    <view class="card-v2">
      <text class="section-title-v2">联系方式（选填）</text>
      <input v-model="contact" class="input-v2" placeholder="微信/邮箱，方便我们回复" />
    </view>
    <button class="btn btn-primary btn-md btn-full" :disabled="submitting || !content.trim()" @click="submit">{{ submitting ? '提交中...' : '提交反馈' }}</button>
    <text v-if="submitResult" :class="['result-text-v2', submitOk ? 'ok' : 'fail']">{{ submitResult }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/cloudbase'
import { getCurrentUserId } from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const content = ref('')
const contact = ref('')
const submitting = ref(false)
const submitResult = ref('')
const submitOk = ref(false)

onLoad(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

async function submit() {
  if (!content.value.trim()) return
  submitting.value = true
  submitResult.value = ''
  try {
    const res = await callFunction({
      name: 'submitFeedback',
      data: { userId: getCurrentUserId(), content: content.value.trim(), contact: contact.value.trim() || undefined }
    })
    const result = res.result || {}
    if (result.success) {
      submitOk.value = true
      submitResult.value = '感谢你的反馈！'
      content.value = ''
      contact.value = ''
    } else {
      submitOk.value = false
      submitResult.value = result.message || '提交失败，请稍后再试'
    }
  } catch (e: any) {
    submitOk.value = false
    submitResult.value = e?.message || '提交失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }
.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .section-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .text-area-v2 { width: 100%; min-height: 200rpx; padding: 18rpx; background: #fff; border: 3rpx solid #111; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; box-sizing: border-box; }
.v2-mode .char-count-v2 { display: block; text-align: right; font-size: $fs-caption; font-weight: $fw-body; color: #999; margin-top: 8rpx; }
.v2-mode .input-v2 { width: 100%; height: 72rpx; padding: 0 18rpx; background: #fff; border: 3rpx solid #111; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; box-sizing: border-box; }
.v2-mode .result-text-v2 { display: block; margin-top: 20rpx; text-align: center; font-size: $fs-body-lg; font-weight: $fw-label; }
.v2-mode .result-text-v2.ok { color: #4ECDC4; }
.v2-mode .result-text-v2.fail { color: #FF5252; }
</style>
