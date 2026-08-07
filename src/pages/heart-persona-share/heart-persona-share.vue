<template>
  <view class="page">
    <view v-if="loading" class="state-card">正在打开好友的人设结果...</view>
    <view v-else-if="errorMessage" class="state-card error-card">
      <text class="state-title">这份分享暂时打不开</text>
      <text class="state-copy">{{ errorMessage }}</text>
      <button v-if="needsLogin" class="primary-button" @click="goLogin">登录后继续</button>
      <button v-else class="primary-button" @click="loadPreview">重新加载</button>
      <button class="ghost-button" @click="goHome">进入首页</button>
    </view>

    <template v-else-if="share">
      <view class="hero">
        <view class="topbar">
          <view class="brand-mark">心</view>
          <text class="brand">心动人设局</text>
          <text class="public-chip">好友公开版</text>
        </view>
        <view class="shared-by">
          <image v-if="share.sharer?.avatarUrl" :src="share.sharer.avatarUrl" mode="aspectFill" class="shared-avatar" />
          <view v-else class="shared-avatar fallback">{{ String(share.sharer?.displayName || '友').slice(0, 1) }}</view>
          <view>
            <text class="shared-name">{{ share.sharer?.displayName || '一位朋友' }} 分享了{{ share.mode === 'target' ? ' TA 的' : '自己的' }}结果</text>
            <text class="shared-meta">{{ share.displayTitle }} · 公开版报告</text>
          </view>
        </view>

        <view class="result-grid">
          <view class="result-copy">
            <text class="result-kicker">{{ share.mode === 'target' ? 'TA' : '这位朋友' }}更接近</text>
            <text class="result-name">{{ share.primary?.name || '人物原型' }}</text>
            <text class="result-type">{{ share.displayTitle }}</text>
            <text class="result-summary">{{ share.summary }}</text>
          </view>
          <view class="portrait-wrap">
            <view class="score-badge">
              <text class="score-value">{{ scoreText }}</text>
              <text class="score-label">人物相似度</text>
            </view>
            <image v-if="share.primary?.coverUrl" :src="share.primary.coverUrl" mode="aspectFill" class="portrait" />
            <view v-else class="portrait portrait-fallback">{{ String(share.primary?.name || '人').slice(0, 1) }}</view>
          </view>
        </view>
      </view>

      <view class="content">
        <scroll-view v-if="share.tags?.length" scroll-x class="tag-scroll">
          <view class="tag-row"><text v-for="tag in share.tags" :key="tag" class="tag">{{ tag }}</text></view>
        </scroll-view>

        <view class="verdict-card">
          <text class="section-label">一句话看懂</text>
          <text class="verdict-title">{{ share.primary?.label || share.primary?.name }}</text>
          <text class="verdict-copy">{{ share.summary }}</text>
        </view>

        <view class="private-card">
          <view class="lock-mark">锁</view>
          <text class="private-title">好友的完整报告保持私密</text>
          <text class="private-copy">完成你自己的测试，才能看到属于你的精确相似度、关系信号和相处提醒。</text>
        </view>

        <view class="atlas-card">
          <text class="atlas-title">你和 TA，到底是哪一挂？</text>
          <text class="atlas-copy">关系主角、古今名人、影视动漫角色都可能出现。</text>
          <view class="atlas-dots"><text>名</text><text>史</text><text>影</text><text>漫</text><text>+</text></view>
        </view>
      </view>

      <view class="sticky-action"><button class="start-button" @click="openSheet">我也测测</button></view>
    </template>

    <view v-if="sheetOpen" class="overlay" @click.self="closeSheet">
      <view class="sheet">
        <view class="sheet-handle" />
        <template v-if="sheetStep === 'mode'">
          <text class="sheet-title">这次你想测谁？</text>
          <text class="sheet-copy">只用于这次测试，不会创建或更换 Crush。</text>
          <button class="choice" @click="selectMode('self')"><text class="choice-title">测我自己</text><text class="choice-copy">看看我是哪种人物风格</text></button>
          <button class="choice mint" @click="selectMode('target')"><text class="choice-title">测 TA</text><text class="choice-copy">按你观察到的相处表现来回答</text></button>
        </template>
        <template v-else-if="sheetStep === 'gender'">
          <text class="sheet-title">{{ selectedMode === 'target' ? 'TA' : '你' }}的性别是？</text>
          <text class="sheet-copy">性别只用于选择本次人物池，不写入个人画像。</text>
          <button class="choice" :disabled="quizRouting" @click="selectGender('female')"><text class="choice-title">女性</text><text class="choice-copy">进入女性人物与角色池</text></button>
          <button class="choice mint" :disabled="quizRouting" @click="selectGender('male')"><text class="choice-title">男性</text><text class="choice-copy">进入男性人物与角色池</text></button>
          <button class="back-button" @click="sheetStep = 'mode'">返回上一步</button>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getArchetypeSharedPreview, getCurrentUserId, waitForCurrentUserId } from '@/utils/api'
import { captureLandingContext } from '@/utils/landing'
import { appendReferralParams } from '@/utils/share'
import { ensureSilentWechatLogin } from '@/utils/silent-login'

const loading = ref(true)
const errorMessage = ref('')
const needsLogin = ref(false)
const resultShareId = ref('')
const share = ref<any>(null)
const sheetOpen = ref(false)
const sheetStep = ref<'mode' | 'gender'>('mode')
const selectedMode = ref<'self' | 'target' | ''>('')
const selectedGender = ref<'female' | 'male' | ''>('')
const quizRouting = ref(false)
let loadedForUserId = ''

function shouldOfferExplicitLogin() {
  let offerExplicitLogin = true
  // #ifdef MP-WEIXIN
  offerExplicitLogin = false
  // #endif
  return offerExplicitLogin
}

const scoreText = computed(() => share.value?.scoreDisplay?.type === 'exact'
  ? `${share.value.scoreDisplay.exact}%`
  : share.value?.scoreDisplay?.band?.label || '生成中')

function sharePath() {
  return `/pages/heart-persona-share/heart-persona-share?resultShareId=${encodeURIComponent(resultShareId.value)}`
}

function currentPath() {
  const query = [`resultShareId=${encodeURIComponent(resultShareId.value)}`]
  if (selectedMode.value) query.push(`mode=${selectedMode.value}`)
  if (selectedGender.value) query.push(`subjectGender=${selectedGender.value}`)
  return `/pages/heart-persona-share/heart-persona-share?${query.join('&')}`
}

function selectionStorageKey() { return `heartPersonaShareSelection:${resultShareId.value}` }

function persistSelection() {
  if (!resultShareId.value) return
  try {
    uni.setStorageSync(selectionStorageKey(), {
      mode: selectedMode.value,
      subjectGender: selectedGender.value
    })
  } catch {}
}

function restoreSelection(options: any) {
  let cached: any = null
  try { cached = uni.getStorageSync(selectionStorageKey()) || null } catch {}
  const mode = options?.mode || cached?.mode
  const gender = options?.subjectGender || cached?.subjectGender
  selectedMode.value = mode === 'target' ? 'target' : mode === 'self' ? 'self' : ''
  selectedGender.value = gender === 'male' ? 'male' : gender === 'female' ? 'female' : ''
}

function clearSelection() {
  try { uni.removeStorageSync(selectionStorageKey()) } catch {}
}

async function loadPreview() {
  if (!resultShareId.value) {
    loading.value = false
    errorMessage.value = '分享参数不完整。'
    return
  }
  loading.value = true
  errorMessage.value = ''
  needsLogin.value = false
  let userId = getCurrentUserId() || ''
  if (!userId) userId = await ensureSilentWechatLogin() || await waitForCurrentUserId() || ''
  if (!userId) {
    loading.value = false
    const offerExplicitLogin = shouldOfferExplicitLogin()
    needsLogin.value = offerExplicitLogin
    errorMessage.value = offerExplicitLogin
      ? '登录后即可查看好友公开结果并开始测试。'
      : '网络有点慢，请重新加载。'
    return
  }
  try {
    const response = await getArchetypeSharedPreview(resultShareId.value)
    if (!response?.success || !response?.share) {
      if (response?.code === 'AUTH_REQUIRED') {
        needsLogin.value = shouldOfferExplicitLogin()
        loadedForUserId = ''
      }
      throw new Error(response?.message || '分享结果不存在或已失效。')
    }
    share.value = response.share
    loadedForUserId = userId
  } catch (error: any) {
    errorMessage.value = error?.message || '读取分享结果失败。'
  } finally {
    loading.value = false
  }
}

function goLogin() {
  persistSelection()
  uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(currentPath())}` })
}
function goHome() { uni.switchTab({ url: '/pages/index/index' }) }
function openSheet() {
  if (quizRouting.value) return
  sheetStep.value = selectedMode.value ? 'gender' : 'mode'
  sheetOpen.value = true
}
function closeSheet() { sheetOpen.value = false }
function selectMode(value: 'self' | 'target') {
  selectedMode.value = value
  selectedGender.value = ''
  persistSelection()
  sheetStep.value = 'gender'
}
function selectGender(value: 'female' | 'male') {
  if (quizRouting.value) return
  selectedGender.value = value
  persistSelection()
  startQuiz()
}

function startQuiz() {
  if (quizRouting.value) return
  if (!share.value?.kind || !selectedMode.value || !selectedGender.value) {
    uni.showToast({ title: '请先选择测试对象和性别', icon: 'none' })
    return
  }
  const routeByKind: Record<string, string> = {
    relation_archetype: '/pages/relation-heroine/relation-heroine',
    crush_celebrity: '/pages/crush-celebrity/crush-celebrity',
    dimension_character: '/pages/dimension-character/dimension-character'
  }
  const route = routeByKind[share.value.kind]
  if (!route) return
  quizRouting.value = true
  sheetOpen.value = false
  const query = [
    'entryMode=share_quick',
    `resultShareId=${encodeURIComponent(resultShareId.value)}`,
    `mode=${selectedMode.value}`,
    `subjectGender=${selectedGender.value}`
  ]
  uni.navigateTo({
    url: `${route}?${query.join('&')}`,
    success: clearSelection,
    fail: () => {
      sheetOpen.value = true
      uni.showToast({ title: '页面打开失败，请重试', icon: 'none' })
    },
    complete: () => { quizRouting.value = false }
  })
}

onLoad((options: any) => {
  captureLandingContext(options || {})
  resultShareId.value = String(options?.resultShareId || '').trim()
  restoreSelection(options || {})
  loadPreview()
})

onShow(() => {
  const userId = getCurrentUserId() || ''
  if (userId && userId !== loadedForUserId && !loading.value) loadPreview()
})

onShareAppMessage(() => ({
  title: `${share.value?.sharer?.displayName || '好友'}分享了一个${share.value?.displayTitle || '人物风格'}结果`,
  path: appendReferralParams(sharePath(), 'heart_persona_result') || sharePath()
}))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;background:#fffaf5;color:#251d25;padding-bottom:150rpx}.state-card{margin:40rpx 28rpx;padding:34rpx;border:3rpx solid #251d25;background:#fff;box-shadow:8rpx 8rpx 0 rgba(37,29,37,.14)}.state-title,.state-copy{display:block}.state-title{font-size:$fs-heading;font-weight:$fw-hero}.state-copy{margin-top:12rpx;color:#776d72;line-height:1.6}.error-card{background:#fff2ef}.hero{padding:calc(30rpx + env(safe-area-inset-top)) 32rpx 52rpx;background:#ef5d62;overflow:hidden}.topbar{display:flex;align-items:center;gap:14rpx}.brand-mark{display:flex;align-items:center;justify-content:center;width:58rpx;height:58rpx;border:3rpx solid #251d25;background:#fff0d9;box-shadow:5rpx 5rpx 0 #251d25;font-weight:$fw-hero}.brand{font-weight:$fw-hero;font-size:$fs-body-lg}.public-chip{margin-left:auto;padding:8rpx 14rpx;border:2rpx solid rgba(37,29,37,.55);background:rgba(255,250,245,.5);font-size:$fs-micro;font-weight:$fw-label}.shared-by{display:flex;align-items:center;gap:14rpx;margin-top:40rpx}.shared-avatar{display:flex;align-items:center;justify-content:center;width:68rpx;height:68rpx;border:3rpx solid #251d25;border-radius:50%;background:#fff0d9}.fallback{font-weight:$fw-hero}.shared-name,.shared-meta{display:block}.shared-name{font-size:$fs-body;font-weight:$fw-heading}.shared-meta{margin-top:4rpx;font-size:$fs-micro;color:rgba(37,29,37,.7)}.result-grid{display:grid;grid-template-columns:minmax(0,1fr) 220rpx;gap:16rpx;align-items:end;margin-top:34rpx}.result-kicker,.result-name,.result-type,.result-summary{display:block}.result-kicker{font-size:$fs-caption;font-weight:$fw-heading}.result-name{margin-top:8rpx;font-size:$fs-hero-title;font-weight:$fw-hero;line-height:1.08}.result-type{font-size:$fs-heading;font-weight:$fw-heading}.result-summary{margin-top:18rpx;font-size:$fs-body;line-height:1.6}.portrait-wrap{position:relative;min-height:300rpx}.portrait{position:absolute;right:0;bottom:0;display:flex;align-items:center;justify-content:center;width:190rpx;height:260rpx;border:5rpx solid #251d25;border-radius:96rpx 96rpx 20rpx 20rpx;background:#fff0d9;box-shadow:10rpx 10rpx 0 #251d25;transform:rotate(3deg)}.portrait-fallback{font-size:$fs-display;font-weight:$fw-hero}.score-badge{position:absolute;z-index:2;left:-20rpx;top:0;display:flex;flex-direction:column;align-items:center;justify-content:center;width:132rpx;height:132rpx;border:5rpx solid #251d25;border-radius:50%;background:#fff0d9;box-shadow:7rpx 7rpx 0 #251d25;transform:rotate(-8deg)}.score-value{font-size:$fs-heading;font-weight:$fw-hero}.score-label{font-size:18rpx;font-weight:$fw-label}.content{margin-top:-24rpx;padding:0 28rpx 40rpx;border-radius:32rpx 32rpx 0 0;background:#fffaf5;position:relative}.tag-scroll{white-space:nowrap}.tag-row{display:flex;gap:12rpx;padding:34rpx 0 10rpx}.tag{flex:0 0 auto;padding:10rpx 18rpx;border:2rpx solid #251d25;border-radius:999rpx;background:#fff0d9;font-size:$fs-caption;font-weight:$fw-heading}.tag:nth-child(2){background:#cceadb}.tag:nth-child(3){background:#d9d1ff}.verdict-card,.private-card,.atlas-card{margin-top:24rpx;padding:28rpx;border:2rpx solid #251d25;background:#fff;box-shadow:6rpx 6rpx 0 rgba(37,29,37,.12)}.section-label{display:block;color:#c93646;font-size:$fs-micro;font-weight:$fw-hero}.verdict-title{display:block;margin-top:12rpx;font-size:$fs-heading;font-weight:$fw-hero}.verdict-copy{display:block;margin-top:12rpx;color:#5e5358;line-height:1.7}.private-card{text-align:center;background:#f9eee8}.lock-mark{display:flex;align-items:center;justify-content:center;width:76rpx;height:76rpx;margin:0 auto;border:2rpx solid #251d25;border-radius:50%;background:#fff0d9;font-weight:$fw-hero}.private-title,.private-copy{display:block}.private-title{margin-top:12rpx;font-weight:$fw-hero}.private-copy{margin-top:8rpx;color:#776d72;font-size:$fs-caption;line-height:1.6}.atlas-title,.atlas-copy{display:block}.atlas-title{font-size:$fs-heading;font-weight:$fw-hero}.atlas-copy{margin-top:8rpx;color:#776d72;font-size:$fs-caption}.atlas-dots{display:flex;margin-top:20rpx}.atlas-dots text{display:flex;align-items:center;justify-content:center;width:70rpx;height:70rpx;margin-left:-10rpx;border:3rpx solid #fffaf5;border-radius:50%;background:#ffd5d7;font-weight:$fw-hero}.atlas-dots text:first-child{margin-left:0}.atlas-dots text:nth-child(2){background:#cceadb}.atlas-dots text:nth-child(3){background:#d9d1ff}.atlas-dots text:nth-child(4){background:#fff0d9}.atlas-dots text:last-child{background:#251d25;color:#fff}.sticky-action{position:fixed;z-index:10;left:0;right:0;bottom:0;padding:24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(255,250,245,0),#fffaf5 24%)}.start-button,.primary-button{height:92rpx;border:3rpx solid #251d25;background:#251d25;color:#fff;box-shadow:8rpx 8rpx 0 #ef5d62;font-weight:$fw-hero}.primary-button,.ghost-button{margin-top:24rpx}.ghost-button{border:2rpx solid #251d25;background:#fff}.overlay{position:fixed;z-index:20;inset:0;display:flex;align-items:flex-end;background:rgba(37,29,37,.48)}.sheet{width:100%;padding:18rpx 28rpx calc(34rpx + env(safe-area-inset-bottom));border-radius:32rpx 32rpx 0 0;background:#fffaf5}.sheet-handle{width:72rpx;height:8rpx;margin:0 auto 24rpx;border-radius:99rpx;background:#d2c7c9}.sheet-title,.sheet-copy{display:block}.sheet-title{font-size:$fs-heading;font-weight:$fw-hero}.sheet-copy{margin-top:8rpx;color:#776d72;font-size:$fs-caption}.choice{display:flex;flex-direction:column;align-items:flex-start;width:100%;margin-top:18rpx;padding:22rpx;border:2rpx solid #251d25;background:#ffd5d7;text-align:left}.choice.mint{background:#cceadb}.choice-title{font-size:$fs-body-lg;font-weight:$fw-hero}.choice-copy{margin-top:5rpx;color:#5e5358;font-size:$fs-caption}.back-button{margin-top:18rpx;background:transparent;color:#776d72}.back-button::after{border:0}@media(max-width:370px){.result-grid{grid-template-columns:minmax(0,1fr) 180rpx}.portrait{width:160rpx;height:236rpx}.score-badge{width:112rpx;height:112rpx}.result-name{font-size:$fs-heading}}
</style>
