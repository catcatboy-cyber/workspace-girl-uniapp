<template>
  <view class="page v2-mode" :style="themeVars">
    <view class="hero-block-v2"><text class="hero-tag-v2">NEW CASE</text><text class="hero-title-v2">新建<text class="hl-v2">对象</text></text><text class="hero-copy-v2">只有当你要开始判断一个新的对象时，才需要重新填写这份初次评估。已有对象更适合继续追加事件和滚动观察。</text><view class="btn-row-v2"><button class="btn-v2-n" @click="goHome">返回首页</button><button class="btn-v2-n" @click="goCases">查看已有对象</button></view></view>
    <AssessmentForm @submit="onSubmit" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createCase, getCurrentUserId } from '@/utils/api'
import { bumpDataVersion, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
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
        bumpDataVersion()
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      } else {
        bumpDataVersion()
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
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .btn-v2-n { flex: 1; height: 64rpx; line-height: 64rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 24rpx; font-weight: 800; color: #111; }
</style>
