<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view v-if="loading" class="loading-v2">加载中...</view>

    <view v-else-if="!caseFile" class="card-v2">
      <text class="section-title-v2">无法重新分析</text>
      <text class="card-text-v2">当前 Crush 不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">REASSESSMENT / {{ caseFile.name }}</text>
        <text class="hero-title-v2">给同一个 Crush 再做一次分析</text>
        <text class="hero-copy-v2">提交后不会覆盖历史，会追加成新的 assessment 记录。</text>
        <text class="card-text-v2" style="color: rgba(0,0,0,0.5)">Crush 名称、关系类型和画像不在这里修改，避免你改了但本次提交并不会保存。</text>
        <view class="hero-actions-v2">
          <button class="btn-v2 sm" @click="goCaseDetail">返回我们</button>
          <button class="btn-v2 sm" @click="goTimeline">打开往事</button>
        </view>
      </view>

      <AssessmentForm
        :relation-type="caseFile.profile?.relationType"
        :initial-name="caseFile.name"
        :initial-profile="caseFile.profile"
        :questions-only="true"
        submit-label="提交新的分析版本"
        @submit="onSubmit"
      />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { getCaseDetail, reassess, getCurrentUserId } from '@/utils/api'
import { setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const themeVars = ref(getThemeStyle())

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || ''
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    showError('缺少 caseId')
    return
  }
  userId.value = uid
  loading.value = true
  try {
    caseFile.value = await getCaseDetail(uid, caseId.value)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onSubmit(payload: { name: string; answers: any[]; profile: any }) {
  uni.showLoading({ title: '分析中...' })
  try {
    const res = await reassess({
      userId: userId.value,
      caseId: caseId.value,
      answers: payload.answers
    })
    uni.hideLoading()
    if (res.success) {
      showSuccess('分析完成')
      setTimeout(() => {
        setActiveCaseId(caseId.value)
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      }, 600)
    } else {
      showError(res.message || '分析失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    showError(e?.message || '分析失败')
  }
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 18rpx; box-sizing: border-box; }

.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B);
  border: 3rpx solid #111;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 8rpx 8rpx 0 #111;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 {
  display: inline-block;
  background: #111;
  color: #FFD93D;
  padding: 6rpx 16rpx;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.v2-mode .hero-title-v2 {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  color: #111;
  line-height: 1.15;
  letter-spacing: -2rpx;
  text-transform: uppercase;
}
.v2-mode .hero-copy-v2 {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(0,0,0,0.7);
  line-height: 1.6;
  margin-top: 8rpx;
}
.v2-mode .hero-actions-v2 { display: flex; gap: 12rpx; margin-top: 20rpx; flex-wrap: wrap; }

.v2-mode .card-v2 {
  background: #fff;
  border: 3rpx solid #111;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 6rpx 6rpx 0 #111;
}
.v2-mode .section-title-v2 {
  display: block;
  font-size: 22rpx;
  font-weight: 900;
  color: #111;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 10rpx;
}
.v2-mode .card-text-v2 {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #666;
  line-height: 1.6;
  margin: 6rpx 0;
}

.v2-mode .btn-v2 {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  background: #fff;
  color: #111;
  border: 3rpx solid #111;
  font-size: 26rpx;
  font-weight: 800;
}
.v2-mode .btn-v2.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2.sm { height: 56rpx; line-height: 56rpx; padding: 0 24rpx; font-size: 24rpx; }
</style>
