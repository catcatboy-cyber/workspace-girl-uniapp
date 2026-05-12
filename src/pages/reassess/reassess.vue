<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">无法重新评估</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">重新评估 / {{ caseFile.name }}</text>
        <text class="h1">给同一个 case 再做一次评估</text>
        <text class="hero-subtext">提交后不会覆盖历史，会追加成新的 assessment 记录。</text>
        <text class="muted">对象名称、关系类型和画像不在这里修改，避免你改了但本次提交并不会保存。</text>
        <view class="actions">
          <button class="btn-secondary" @click="goCaseDetail">返回关系主页</button>
          <button class="btn-secondary" @click="goTimeline">打开时间线</button>
        </view>
      </view>

      <AssessmentForm
        :relation-type="caseFile.profile?.relationType"
        :initial-name="caseFile.name"
        :initial-profile="caseFile.profile"
        :questions-only="true"
        submit-label="提交新的评估版本"
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
  uni.showLoading({ title: '评估中...' })
  try {
    const res = await reassess({
      userId: userId.value,
      caseId: caseId.value,
      answers: payload.answers
    })
    uni.hideLoading()
    if (res.success) {
      showSuccess('评估完成')
      setTimeout(() => {
        setActiveCaseId(caseId.value)
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      }, 600)
    } else {
      showError(res.message || '评估失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    showError(e?.message || '评估失败')
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
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 36rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.actions { display: flex; gap: 12rpx; margin-top: 16rpx; }
.btn-secondary { height: 64rpx; line-height: 64rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 26rpx; }

/* Premium visual pass */
.page {
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
}

.card {
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 18rpx;
  box-shadow: 0 16rpx 36rpx rgba(32, 25, 20, 0.06);
}

.hero-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: 0 22rpx 44rpx rgba(18, 60, 54, 0.18);
}

.hero-card::after {
  content: "";
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}

.hero-topline {
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.hero-card .h1 {
  color: #fffaf0;
  font-size: 42rpx;
  line-height: 1.25;
}

.hero-subtext,
.hero-card .muted {
  color: rgba(255, 252, 247, 0.76);
}

.h1 {
  color: var(--text-main, #201914);
}

.muted {
  color: var(--text-muted, #76695c);
}

.btn-secondary {
  background: rgba(255, 252, 247, 0.92);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  color: var(--primary, #123c36);
  border-radius: 14rpx;
  font-weight: 600;
}

/* Second visual pass */
.card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
}
</style>
