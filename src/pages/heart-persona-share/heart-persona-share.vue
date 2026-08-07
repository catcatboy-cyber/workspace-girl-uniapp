<template>
  <view class="page storybook-page">
    <view class="paper-texture"></view>
    <view class="flower flower-a"><view class="flower-core"></view></view>
    <view class="flower flower-b"><view class="flower-core"></view></view>
    <view class="flower flower-c"><view class="flower-core"></view></view>
    <view class="leaf-sprig sprig-a"><view></view><view></view><view></view><view></view></view>
    <view class="leaf-sprig sprig-b"><view></view><view></view><view></view><view></view></view>

    <view v-if="loading" class="state-card">正在打开好友的人设结果...</view>
    <view v-else-if="errorMessage" class="state-card error-card">
      <text class="state-title">这份分享暂时打不开</text>
      <text class="state-copy">{{ errorMessage }}</text>
      <button v-if="needsLogin" class="primary-button" @click="goLogin">登录后继续</button>
      <button v-else class="primary-button" @click="loadPreview">重新加载</button>
      <button class="ghost-button" @click="goHome">进入首页</button>
    </view>

    <template v-else-if="share">
      <view class="topbar">
        <view class="brand-wrap"><view class="brand-mark">心</view><text class="brand">心动人设局</text></view>
        <text class="public-chip">好友结果 · 公开版</text>
      </view>

      <view class="shared-by">
        <image v-if="share.sharer?.avatarUrl" :src="share.sharer.avatarUrl" mode="aspectFill" class="shared-avatar" />
        <view v-else class="shared-avatar fallback">{{ sharerInitial }}</view>
        <view class="shared-copy">
          <text class="shared-name">{{ share.sharer?.displayName || '一位朋友' }} 分享了{{ share.mode === 'target' ? ' TA 的' : '自己的' }}测试结果</text>
          <text class="shared-meta">{{ share.displayTitle }} · 完成于最近</text>
        </view>
      </view>

      <view class="hero" aria-labelledby="result-title">
        <view class="hero-copy">
          <text class="result-kicker">魔镜正在揭晓{{ subjectText }}的人物风格</text>
          <text id="result-title" class="result-name">{{ share.primary?.name || '人物原型' }}</text>
          <text class="result-type">{{ share.displayTitle }}</text>
          <text class="result-summary">{{ share.summary }}</text>
        </view>

        <view class="mirror-wrap">
          <view class="mirror-crown"><view></view><view></view><view></view></view>
          <view class="mirror-frame">
            <view class="mirror-inner">
              <image v-if="share.primary?.coverUrl" :src="share.primary.coverUrl" mode="aspectFill" class="portrait" />
              <view v-else class="portrait portrait-fallback">{{ primaryInitial }}</view>
            </view>
          </view>
          <view class="mirror-tail tail-left"></view><view class="mirror-tail tail-right"></view>
        </view>

        <view class="score-ribbon">
          <text class="score-label">{{ scoreCaption }}</text>
          <text :class="['score-value', scoreText.length > 6 ? 'compact' : '']">{{ scoreText }}</text>
        </view>
      </view>

      <scroll-view v-if="publicTags.length" scroll-x class="tag-scroll">
        <view class="tag-row"><text v-for="tag in publicTags" :key="tag" class="tag">#{{ tag }}</text></view>
      </scroll-view>

      <view class="report-grid">
        <view class="panel wide oracle-panel">
          <view class="panel-head">魔镜说{{ subjectText }}</view>
          <view class="panel-body">
            <text class="oracle-title">{{ share.primary?.label || share.primary?.name || '人物风格摘要' }}</text>
            <text class="oracle-copy">{{ share.summary }}</text>
            <view class="public-signals"><view><text>人物</text><text class="signal-value">{{ share.primary?.name || '待揭晓' }}</text></view><view><text>玩法</text><text class="signal-value">{{ share.displayTitle }}</text></view><view><text>结果</text><text class="signal-value">{{ scoreText }}</text></view></view>
          </view>
        </view>

        <view class="panel radar-panel">
          <view class="panel-head">关系雷达</view>
          <view class="panel-body radar-body">
            <view class="radar-chart"><view class="radar-ring ring-a"></view><view class="radar-ring ring-b"></view><view class="radar-ring ring-c"></view><view class="radar-shape"></view><view class="radar-axis axis-a"></view><view class="radar-axis axis-b"></view><view class="radar-axis axis-c"></view></view>
            <view class="mini-lock"><text>私</text></view>
            <text class="radar-note">完整维度仅本人可见</text>
          </view>
        </view>

        <view class="panel quote-panel">
          <view class="panel-head">魔镜箴言</view>
          <view class="panel-body quote-body">
            <text class="quote-mark">“</text>
            <text class="quote-text">{{ subjectText }}最接近「{{ share.primary?.name || '人物原型' }}」风格。</text>
            <text class="quote-note">相似不等于合适，真实关系仍要看持续行动和边界。</text>
          </view>
        </view>

        <view class="panel wide">
          <view class="panel-head">相处提示</view>
          <view class="panel-body compatibility"><view class="compat-card good"><text class="compat-title">一拍即合</text><text class="compat-copy">完成自己的测试后揭晓</text></view><view class="compat-card risk"><text class="compat-title">容易踩雷</text><text class="compat-copy">完成自己的测试后揭晓</text></view></view>
        </view>

        <view class="panel wide private-panel">
          <view class="panel-head">好友的完整相处报告</view>
          <view class="private-preview"><view class="fake-line"></view><view class="fake-line"></view><view class="fake-line"></view></view>
          <view class="private-cover"><view class="lock-mark">私</view><text class="private-title">好友的完整报告保持私密</text><text class="private-copy">完成你自己的测试，查看属于你的精确结果、关系信号和相处提醒。</text></view>
        </view>

        <view class="atlas-card">
          <view><text class="atlas-title">你和 TA，到底是哪一挂？</text><text class="atlas-copy">关系主角、古今名人、影视动漫角色都可能出现。</text></view>
          <view class="atlas-dots"><text>名</text><text>史</text><text>影</text><text>漫</text><text>+</text></view>
        </view>
        <view class="proof-row"><text>3 种人物风格玩法</text><text>约 3 分钟完成</text></view>
      </view>

      <view class="sticky-action"><button class="start-button" :disabled="quizRouting" @click="openSheet">我也测测</button></view>
    </template>

    <view v-if="sheetOpen" class="overlay" @click.self="closeSheet">
      <view class="sheet">
        <view class="sheet-handle"></view>
        <template v-if="sheetStep === 'mode'">
          <text class="sheet-title">这次你想测谁？</text>
          <text class="sheet-copy">只用于这次测试，不会创建或更换 Crush。</text>
          <button class="choice" @click="selectMode('self')"><view class="choice-icon">我</view><view><text class="choice-title">测我自己</text><text class="choice-copy">看看我是哪种人物风格</text></view><text class="choice-arrow">›</text></button>
          <button class="choice mint" @click="selectMode('target')"><view class="choice-icon">TA</view><view><text class="choice-title">测 TA</text><text class="choice-copy">按你观察到的相处表现来回答</text></view><text class="choice-arrow">›</text></button>
        </template>
        <template v-else-if="sheetStep === 'gender'">
          <text class="sheet-title">{{ selectedMode === 'target' ? 'TA' : '你' }}的性别是？</text>
          <text class="sheet-copy">性别只用于选择本次人物池，不写入个人画像。</text>
          <button class="choice" :disabled="quizRouting" @click="selectGender('female')"><view class="choice-icon">女</view><view><text class="choice-title">女性</text><text class="choice-copy">进入女性人物与角色池</text></view><text class="choice-arrow">›</text></button>
          <button class="choice mint" :disabled="quizRouting" @click="selectGender('male')"><view class="choice-icon">男</view><view><text class="choice-title">男性</text><text class="choice-copy">进入男性人物与角色池</text></view><text class="choice-arrow">›</text></button>
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
const scoreCaption = computed(() => share.value?.scoreDisplay?.type === 'exact' ? '人物相似度' : '公开相似区间')
const subjectText = computed(() => share.value?.mode === 'target' ? 'TA' : '这位朋友')
const sharerInitial = computed(() => String(share.value?.sharer?.displayName || '友').slice(0, 1))
const primaryInitial = computed(() => String(share.value?.primary?.name || '人').slice(0, 1))
const publicTags = computed(() => (Array.isArray(share.value?.tags) ? share.value.tags : [])
  .map((tag: unknown) => String(tag || '').replace(/^#+/, '').trim())
  .filter(Boolean)
  .slice(0, 5))

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
/* 绘本魔镜版：覆盖样式只作用于正式分享页。 */
.storybook-page{position:relative;min-height:100vh;padding-bottom:180rpx;overflow:hidden;background:#a9bac5;color:#294351}.storybook-page .paper-texture{position:absolute;z-index:0;inset:0;opacity:.28;pointer-events:none;background-image:radial-gradient(circle at 16% 12%,rgba(255,255,255,.72) 0 2rpx,transparent 3rpx),radial-gradient(circle at 72% 66%,rgba(41,67,81,.18) 0 2rpx,transparent 3rpx);background-size:32rpx 32rpx,44rpx 44rpx;mix-blend-mode:soft-light}.storybook-page .flower{position:absolute;z-index:0;width:70rpx;height:70rpx;opacity:.82}.storybook-page .flower::before,.storybook-page .flower::after{content:"";position:absolute;left:28rpx;top:4rpx;width:26rpx;height:62rpx;border-radius:999rpx;background:#f1a1a7;box-shadow:0 0 0 1rpx rgba(41,67,81,.08)}.storybook-page .flower::after{transform:rotate(90deg)}.storybook-page .flower-core{position:absolute;z-index:2;left:31rpx;top:25rpx;width:20rpx;height:20rpx;border-radius:50%;background:#e8bd55}.storybook-page .flower-a{top:210rpx;left:-22rpx;transform:rotate(-12deg) scale(.78)}.storybook-page .flower-b{top:760rpx;right:-18rpx;transform:rotate(18deg)}.storybook-page .flower-c{top:1470rpx;left:8rpx;transform:rotate(-18deg) scale(.7)}.storybook-page .leaf-sprig{position:absolute;z-index:0;width:270rpx;height:100rpx;opacity:.48}.storybook-page .leaf-sprig::before{content:"";position:absolute;left:8rpx;top:48rpx;width:250rpx;height:4rpx;background:#658778;transform:rotate(-12deg)}.storybook-page .leaf-sprig view{position:absolute;width:54rpx;height:28rpx;border-radius:100% 0 100% 0;background:#739383;transform:rotate(-25deg)}.storybook-page .leaf-sprig view:nth-child(1){left:26rpx;top:22rpx}.storybook-page .leaf-sprig view:nth-child(2){left:80rpx;top:51rpx;transform:rotate(145deg)}.storybook-page .leaf-sprig view:nth-child(3){left:132rpx;top:11rpx}.storybook-page .leaf-sprig view:nth-child(4){left:188rpx;top:43rpx;transform:rotate(145deg)}.storybook-page .sprig-a{top:145rpx;right:-90rpx;transform:rotate(25deg)}.storybook-page .sprig-b{top:1160rpx;left:-120rpx;transform:rotate(200deg)}
.storybook-page .state-card{position:relative;z-index:3;margin:calc(80rpx + env(safe-area-inset-top)) 28rpx 0;border:3rpx solid #294351;border-radius:26rpx;background:#f8f7f2;box-shadow:9rpx 9rpx 0 rgba(41,67,81,.2)}.storybook-page .error-card{background:#f7e9e4}.storybook-page .primary-button{border-color:#294351;background:#365563;box-shadow:7rpx 7rpx 0 #e8bd55}.storybook-page .ghost-button{border-color:#294351;background:#f8f7f2}.storybook-page .topbar{position:relative;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:calc(28rpx + env(safe-area-inset-top)) 30rpx 0}.storybook-page .brand-wrap{display:flex;align-items:center;gap:12rpx}.storybook-page .brand-mark{display:flex;align-items:center;justify-content:center;width:62rpx;height:62rpx;border:3rpx solid #294351;border-radius:50%;background:#f5d58c;box-shadow:5rpx 5rpx 0 #294351;font-size:$fs-caption;font-weight:$fw-hero}.storybook-page .brand{color:#294351;font-size:$fs-body;font-weight:$fw-hero}.storybook-page .public-chip{margin-left:auto;padding:11rpx 17rpx;border:2rpx solid #294351;border-radius:999rpx;background:rgba(248,247,242,.76);color:#294351;font-size:$fs-micro;font-weight:$fw-heading}.storybook-page .shared-by{position:relative;z-index:4;display:flex;align-items:center;gap:14rpx;margin:34rpx 30rpx 0}.storybook-page .shared-avatar{display:flex;align-items:center;justify-content:center;width:70rpx;height:70rpx;flex:0 0 70rpx;border:3rpx solid #294351;border-radius:50%;background:#f8f7f2}.storybook-page .shared-copy{min-width:0}.storybook-page .shared-name,.storybook-page .shared-meta{display:block}.storybook-page .shared-name{font-size:$fs-caption;font-weight:$fw-heading}.storybook-page .shared-meta{margin-top:4rpx;color:rgba(41,67,81,.76);font-size:$fs-micro}
.storybook-page .hero{position:relative;z-index:2;min-height:730rpx;padding:34rpx 30rpx 16rpx;overflow:visible;background:transparent}.storybook-page .hero-copy{position:relative;z-index:4;width:58%;padding-top:18rpx}.storybook-page .result-kicker,.storybook-page .result-name,.storybook-page .result-type,.storybook-page .result-summary{display:block}.storybook-page .result-kicker{font-size:$fs-micro;font-weight:$fw-hero;letter-spacing:2rpx}.storybook-page .result-name{margin-top:10rpx;color:#294351;font-family:"STKaiti","KaiTi","Songti SC",serif;font-size:76rpx;font-weight:$fw-hero;line-height:.98;letter-spacing:-5rpx}.storybook-page .result-type{margin-top:10rpx;font-size:$fs-heading;font-weight:$fw-hero}.storybook-page .result-summary{margin-top:24rpx;font-size:$fs-caption;font-weight:$fw-heading;line-height:1.72}.storybook-page .mirror-wrap{position:absolute;z-index:2;right:-12rpx;top:62rpx;width:350rpx;height:500rpx}.storybook-page .mirror-frame{position:absolute;left:22rpx;top:34rpx;width:292rpx;height:396rpx;padding:16rpx;border:5rpx solid #294351;border-radius:50% 50% 42% 42%;background:#e2b95d;box-shadow:12rpx 15rpx 0 rgba(41,67,81,.22)}.storybook-page .mirror-inner{width:100%;height:100%;overflow:hidden;border:8rpx solid #f2dfa9;border-radius:50% 50% 40% 40%;background:#d8ded8}.storybook-page .portrait{position:static;display:flex;align-items:center;justify-content:center;width:100%;height:100%;border:0;border-radius:0;background:#cad5d0;box-shadow:none;transform:none}.storybook-page .portrait-fallback{color:#365563;font-family:"STKaiti","KaiTi",serif;font-size:110rpx;font-weight:$fw-hero}.storybook-page .mirror-crown{position:absolute;z-index:3;left:104rpx;top:0;display:flex;align-items:flex-end;gap:4rpx}.storybook-page .mirror-crown view{width:40rpx;height:70rpx;border:4rpx solid #294351;background:#e5b755;transform:skew(-10deg) rotate(-8deg)}.storybook-page .mirror-crown view:nth-child(2){height:86rpx;transform:none}.storybook-page .mirror-crown view:nth-child(3){transform:skew(10deg) rotate(8deg)}.storybook-page .mirror-tail{position:absolute;bottom:18rpx;width:110rpx;height:70rpx;border:5rpx solid #294351;background:#c8704e}.storybook-page .tail-left{left:12rpx;border-radius:90% 10% 80% 20%;transform:rotate(18deg)}.storybook-page .tail-right{right:0;border-radius:10% 90% 20% 80%;transform:rotate(-18deg)}.storybook-page .score-ribbon{position:absolute;z-index:5;right:18rpx;bottom:28rpx;display:grid;grid-template-columns:1fr minmax(138rpx,auto);align-items:stretch;width:390rpx;min-height:112rpx;overflow:hidden;border:4rpx solid #294351;border-radius:24rpx;background:#365563;color:#fff;transform:rotate(-2deg)}.storybook-page .score-label{display:flex;align-items:center;padding:20rpx 22rpx;font-size:$fs-caption;font-weight:$fw-hero;letter-spacing:2rpx}.storybook-page .score-value{display:flex;align-items:center;justify-content:center;padding:0 20rpx;color:#294351;background:#eff2ef;font-size:$fs-display;font-weight:$fw-hero;white-space:nowrap}.storybook-page .score-value.compact{font-size:$fs-heading}.storybook-page .tag-scroll{position:relative;z-index:3;margin-top:-12rpx;white-space:nowrap}.storybook-page .tag-row{display:flex;gap:12rpx;padding:0 30rpx 26rpx}.storybook-page .tag{flex:0 0 auto;padding:13rpx 19rpx;border:2rpx solid rgba(41,67,81,.58);border-radius:999rpx;background:rgba(248,247,242,.84);color:#294351;font-size:$fs-micro;font-weight:$fw-heading}.storybook-page .tag:nth-child(2){background:#dce8e2}.storybook-page .tag:nth-child(3){background:#deddf0}
.storybook-page .report-grid{position:relative;z-index:3;display:grid;grid-template-columns:1fr 1fr;gap:18rpx;padding:0 26rpx 42rpx}.storybook-page .panel{position:relative;overflow:hidden;border:3rpx solid rgba(41,67,81,.5);border-radius:26rpx;background:rgba(248,247,242,.93);box-shadow:0 10rpx 0 rgba(41,67,81,.08)}.storybook-page .panel.wide{grid-column:1/-1}.storybook-page .panel-head{padding:15rpx 18rpx;color:#fff;background:#365563;font-size:$fs-caption;font-weight:$fw-hero;text-align:center;letter-spacing:2rpx}.storybook-page .panel-body{padding:23rpx}.storybook-page .oracle-title,.storybook-page .oracle-copy{display:block}.storybook-page .oracle-title{font-size:$fs-heading;font-weight:$fw-hero;line-height:1.45}.storybook-page .oracle-copy{margin-top:12rpx;color:#4f6570;font-size:$fs-caption;line-height:1.72}.storybook-page .public-signals{display:grid;grid-template-columns:repeat(3,1fr);gap:12rpx;margin-top:22rpx}.storybook-page .public-signals view{min-width:0;padding:15rpx 8rpx;border-radius:17rpx;background:#e7ecec;text-align:center}.storybook-page .public-signals text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#63757d;font-size:18rpx}.storybook-page .public-signals .signal-value{margin-top:4rpx;color:#294351;font-size:$fs-micro;font-weight:$fw-hero}
.storybook-page .radar-body{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:350rpx}.storybook-page .radar-chart{position:relative;width:240rpx;height:240rpx}.storybook-page .radar-ring{position:absolute;left:50%;top:50%;border:3rpx solid #9babb1;border-radius:28%;transform:translate(-50%,-50%) rotate(30deg)}.storybook-page .ring-a{width:210rpx;height:210rpx}.storybook-page .ring-b{width:142rpx;height:142rpx}.storybook-page .ring-c{width:76rpx;height:76rpx}.storybook-page .radar-shape{position:absolute;left:50%;top:50%;width:145rpx;height:160rpx;border-radius:35% 55% 40% 55%;background:rgba(83,110,183,.42);transform:translate(-50%,-50%) rotate(18deg)}.storybook-page .radar-axis{position:absolute;left:50%;top:10rpx;width:3rpx;height:220rpx;background:#9babb1;transform-origin:center}.storybook-page .axis-a{transform:rotate(0)}.storybook-page .axis-b{transform:rotate(60deg)}.storybook-page .axis-c{transform:rotate(120deg)}.storybook-page .mini-lock{position:absolute;left:50%;top:50%;display:flex;align-items:center;justify-content:center;width:62rpx;height:62rpx;border:3rpx solid #294351;border-radius:50%;background:#f5d58c;transform:translate(-50%,-50%);font-size:$fs-micro;font-weight:$fw-hero}.storybook-page .radar-note{margin-top:10rpx;color:#63757d;font-size:18rpx}.storybook-page .quote-body{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:350rpx}.storybook-page .quote-mark{position:absolute;left:13rpx;top:0;color:#e8bd55;font-family:Georgia,serif;font-size:100rpx;line-height:1}.storybook-page .quote-text,.storybook-page .quote-note{position:relative;z-index:1;display:block}.storybook-page .quote-text{font-family:"STKaiti","KaiTi",serif;font-size:$fs-body-lg;font-weight:$fw-hero;line-height:1.55}.storybook-page .quote-note{margin-top:18rpx;color:#6b7c84;font-size:$fs-micro;line-height:1.65}
.storybook-page .compatibility{display:grid;grid-template-columns:1fr 1fr;gap:15rpx}.storybook-page .compat-card{padding:22rpx 16rpx;border-radius:18rpx;text-align:center}.storybook-page .compat-card.good{background:#e8efe3}.storybook-page .compat-card.risk{background:#f5e7e3}.storybook-page .compat-title,.storybook-page .compat-copy{display:block}.storybook-page .compat-title{font-size:$fs-caption;font-weight:$fw-hero}.storybook-page .compat-copy{margin-top:8rpx;color:#536a75;font-size:18rpx;line-height:1.5}.storybook-page .private-panel{min-height:280rpx}.storybook-page .private-preview{padding:27rpx;opacity:.24}.storybook-page .fake-line{height:18rpx;margin-top:16rpx;border-radius:99rpx;background:#72848c}.storybook-page .fake-line:nth-child(2){width:84%}.storybook-page .fake-line:nth-child(3){width:68%}.storybook-page .private-cover{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;padding:26rpx;background:linear-gradient(180deg,rgba(248,247,242,.2),rgba(248,247,242,.98));text-align:center}.storybook-page .lock-mark{display:flex;align-items:center;justify-content:center;width:65rpx;height:65rpx;margin:0;border:3rpx solid #294351;border-radius:50%;background:#f5d58c;font-size:$fs-micro;font-weight:$fw-hero}.storybook-page .private-title,.storybook-page .private-copy{display:block}.storybook-page .private-title{margin-top:10rpx;font-size:$fs-caption;font-weight:$fw-hero}.storybook-page .private-copy{margin-top:7rpx;color:#687b84;font-size:$fs-micro;line-height:1.55}.storybook-page .atlas-card{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin:0;padding:24rpx;border:3rpx solid rgba(41,67,81,.4);border-radius:26rpx;background:rgba(54,85,99,.9);color:#fff;box-shadow:none}.storybook-page .atlas-title,.storybook-page .atlas-copy{display:block}.storybook-page .atlas-title{font-size:$fs-caption;font-weight:$fw-hero}.storybook-page .atlas-copy{margin-top:6rpx;color:#d8e2e4;font-size:18rpx;line-height:1.5}.storybook-page .atlas-dots{display:flex;flex:0 0 auto;margin:0}.storybook-page .atlas-dots text{display:flex;align-items:center;justify-content:center;width:55rpx;height:55rpx;margin-left:-10rpx;border:3rpx solid #365563;border-radius:50%;background:#f1a1a7;color:#294351;font-size:18rpx;font-weight:$fw-hero}.storybook-page .atlas-dots text:first-child{margin-left:0}.storybook-page .atlas-dots text:nth-child(2){background:#c7ded5}.storybook-page .atlas-dots text:nth-child(3){background:#c6cae6}.storybook-page .atlas-dots text:nth-child(4){background:#f5d58c}.storybook-page .atlas-dots text:last-child{color:#fff;background:#ef806f}.storybook-page .proof-row{grid-column:1/-1;display:flex;justify-content:space-between;padding:0 5rpx;color:#48616d;font-size:18rpx}
.storybook-page .sticky-action{position:fixed;z-index:10;left:50%;right:auto;bottom:0;width:100%;max-width:920rpx;padding:24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(169,186,197,0),#a9bac5 28%);transform:translateX(-50%)}.storybook-page .start-button{min-height:96rpx;height:auto;border:4rpx solid #294351;border-radius:24rpx;background:#365563;color:#fff;box-shadow:9rpx 9rpx 0 #e8bd55;font-weight:$fw-hero}.storybook-page .start-button[disabled]{opacity:.68}.storybook-page .overlay{position:fixed;z-index:20;inset:0;display:flex;align-items:flex-end;background:rgba(32,52,62,.58)}.storybook-page .sheet{width:100%;max-width:920rpx;margin:0 auto;padding:18rpx 28rpx calc(34rpx + env(safe-area-inset-bottom));border-radius:38rpx 38rpx 0 0;background:#f8f7f2}.storybook-page .sheet-handle{width:72rpx;height:8rpx;margin:0 auto 24rpx;border-radius:99rpx;background:#c2c9c8}.storybook-page .sheet-title,.storybook-page .sheet-copy{display:block}.storybook-page .sheet-title{font-size:$fs-heading;font-weight:$fw-hero}.storybook-page .sheet-copy{margin-top:8rpx;color:#657881;font-size:$fs-caption}.storybook-page .choice{display:grid;grid-template-columns:76rpx minmax(0,1fr) 34rpx;gap:18rpx;align-items:center;width:100%;min-height:122rpx;margin-top:18rpx;padding:18rpx 20rpx;border:3rpx solid #b9c5c7;border-radius:22rpx;background:#fff;text-align:left}.storybook-page .choice.mint{background:#eef6f1}.storybook-page .choice-icon{display:flex;align-items:center;justify-content:center;width:70rpx;height:70rpx;border-radius:50%;background:#f3c2bc;font-size:$fs-micro;font-weight:$fw-hero}.storybook-page .choice.mint .choice-icon{background:#c7ded5}.storybook-page .choice-title,.storybook-page .choice-copy{display:block}.storybook-page .choice-title{font-size:$fs-body;font-weight:$fw-hero}.storybook-page .choice-copy{margin-top:5rpx;color:#667982;font-size:$fs-micro}.storybook-page .choice-arrow{color:#667982;font-size:$fs-heading}.storybook-page .back-button{min-height:88rpx;margin-top:12rpx;background:transparent;color:#667982}.storybook-page .back-button::after{border:0}@media(max-width:370px){.storybook-page .result-name{font-size:66rpx}.storybook-page .mirror-wrap{right:-38rpx;width:320rpx}.storybook-page .hero-copy{width:62%}.storybook-page .score-ribbon{width:350rpx}.storybook-page .report-grid{padding-left:20rpx;padding-right:20rpx}.storybook-page .public-signals .signal-value{font-size:18rpx}}
</style>
