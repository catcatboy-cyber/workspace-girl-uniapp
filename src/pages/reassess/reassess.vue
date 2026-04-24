<template>
  <view class="page">
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
import { showError, showSuccess } from '@/utils/helpers'

const loading = ref(true)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')

onLoad((options) => {
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
        uni.redirectTo({ url: `/pages/case-detail/case-detail?caseId=${caseId.value}` })
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
  uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId.value}` })
}

function goTimeline() {
  uni.navigateTo({ url: `/pages/timeline/timeline?caseId=${caseId.value}` })
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
</style>
