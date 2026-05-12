<template>
  <view class="page" :style="themeVars">
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
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createCase, getCurrentUserId } from '@/utils/api'
import { setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

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
        setActiveCaseId(caseId)
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
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

.hero-subtext {
  color: rgba(255, 252, 247, 0.76);
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
