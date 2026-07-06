<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2"><text class="hero-tag-v2">NEW CRUSH</text><text class="hero-title-v2">新建<text class="hl-v2">Crush</text></text><text class="hero-copy-v2">只有当你要开始判断一个新的 Crush 时，才需要重新填写这份初次分析。已有 Crush 更适合继续追加事件和滚动观察。</text><view class="btn-row-v2"><button class="btn btn-secondary btn-md" @click="goHome">返回首页</button><button class="btn btn-secondary btn-md" @click="goCases">查看 Crushes</button></view></view>
    <AssessmentForm @submit="onSubmit" />
    <view class="ai-note-bar">
      <text class="ai-note-text">{{ aiLabel() }} 辅助分析 · 帮你梳理线索，不代表最终结论</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createCase, getCurrentUserId } from '@/utils/api'
import { bumpDataVersion, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { aiLabel } from '@/utils/labels'

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

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, var(--page-wash, rgba(18, 60, 54, 0.07)), transparent 360rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .ai-note-bar { text-align: center; padding: 24rpx 18rpx; margin-top: 18rpx; border-top: 2rpx dashed var(--divider, #ccc); }
.v2-mode .ai-note-text { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); }
</style>
