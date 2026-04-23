<template>
  <view class="page">
    <view class="hero-card card">
      <text class="hero-topline">New Relationship Case</text>
      <text class="h1">新建一个关系对象</text>
      <text class="hero-subtext">只有当你要开始判断一个新的对象时，才需要重新填写这份初次评估。已有对象更适合继续追加事件和滚动观察。</text>
      <view class="actions">
        <button class="btn-secondary" @click="goHome">返回首页</button>
        <button class="btn-secondary" @click="goCases">查看已有对象</button>
      </view>
    </view>

    <AssessmentForm @submit="onSubmit" />
  </view>
</template>

<script setup lang="ts">
import { createCase, getCurrentUserId } from '@/utils/api'
import { showError, showSuccess } from '@/utils/helpers'
import AssessmentForm from '@/components/AssessmentForm.vue'

async function onSubmit(payload: { name: string; answers: any[]; profile: any }) {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  uni.showLoading({ title: '创建中...' })
  try {
    const res = await createCase({
      userId: uid,
      name: payload.name,
      answers: payload.answers,
      profile: payload.profile
    })

    uni.hideLoading()
    console.log('[createCase] result:', res)

    if (res.success) {
      showSuccess('已创建')
      const caseId = res.caseId || res.case?.caseId
      if (caseId) {
        uni.navigateTo({ url: `/pages/case-detail/case-detail?caseId=${caseId}` })
      } else {
        uni.switchTab({ url: '/pages/cases/cases' })
      }
    } else {
      showError(res.message || '创建失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    console.error('[createCase] error:', e)
    showError(e?.message || '创建失败')
  }
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; letter-spacing: 2rpx; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; margin: 8rpx 0 16rpx; }
.actions { display: flex; gap: 12rpx; margin-top: 16rpx; }
.btn-secondary { flex: 1; height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; }
</style>
