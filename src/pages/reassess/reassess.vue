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
          <button class="btn btn-secondary btn-sm" @click="goCaseDetail">返回我们</button>
          <button class="btn btn-secondary btn-sm" @click="goTimeline">打开往事</button>
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
      <AiLoading v-if="assessing" label="AI 分析中..." :seconds="assessingSeconds" />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import AiLoading from '@/components/AiLoading'
import { getCaseDetail, reassess, getCurrentUserId } from '@/utils/api'
import { setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const themeVars = ref(getThemeStyle())
const lastDataVersion = ref(0)
const assessing = ref(false)
const assessingSeconds = ref(0)
let assessingTimer: any = null

onLoad((options) => {
  caseId.value = options?.caseId || ''
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dv > lastDataVersion.value || !caseFile.value) {
    loadData()
  }
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
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  }
}

async function onSubmit(payload: { name: string; answers: any[]; profile: any }) {
  assessing.value = true
  assessingSeconds.value = 0
  assessingTimer = setInterval(() => { assessingSeconds.value++ }, 1000)
  try {
    const res = await reassess({
      userId: userId.value,
      caseId: caseId.value,
      answers: payload.answers
    })
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
    showError(e?.message || '分析失败')
  } finally {
    assessing.value = false
    clearInterval(assessingTimer)
    assessingTimer = null
  }
}

onBeforeUnmount(() => {
  if (assessingTimer) clearInterval(assessingTimer)
})

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

<style scoped lang="scss">
.page { min-height: 100vh; background: #f4ede2; padding: 18rpx; box-sizing: border-box; }

.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }

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
  font-size: $fs-caption;
  font-weight: $fw-hero;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.v2-mode .hero-title-v2 {
  display: block;
  font-size: $fs-hero-title;
  font-weight: $fw-hero;
  color: #111;
  line-height: 1.15;
  letter-spacing: -2rpx;
  text-transform: uppercase;
}
.v2-mode .hero-copy-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
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
  font-size: $fs-body;
  font-weight: $fw-hero;
  color: #111;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 10rpx;
}
.v2-mode .card-text-v2 {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: #666;
  line-height: 1.6;
  margin: 6rpx 0;
}

</style>
