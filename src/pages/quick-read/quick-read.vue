<template>
  <view :class="['page v2-mode', fontMode === 'large' ? 'font-large' : '', ready ? 'anim-ready' : '']">
    <view v-if="!ready" class="loading-v2">LOADING...</view>

    <template v-else>
      <!-- ====== Snapshot from A ====== -->
      <template v-if="hasSnapshot">
        <!-- Hero -->
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">SIGNAL REPORT</text>
          <text class="hero-title-v2">{{ title }}</text>
          <text class="hero-copy-v2">一位朋友的真实分析 · 小咪辅助分析</text>
        </view>

        <!-- KPI Row -->
        <view class="card-v2 anim-card" style="animation-delay:0.1s">
          <view class="qr-kpi-row">
            <view class="qr-kpi-item">
              <text class="qr-kpi-num" :style="{ color: intentNum >= 60 ? '#4ECDC4' : intentNum >= 40 ? '#FFD93D' : '#999' }">{{ intentNum }}</text>
              <text class="qr-kpi-lbl">意向指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: intentNum + '%', background: intentNum >= 60 ? '#4ECDC4' : intentNum >= 40 ? '#FFD93D' : '#ccc' }"></view></view>
            </view>
            <view class="qr-kpi-split"></view>
            <view class="qr-kpi-item">
              <text class="qr-kpi-num" :style="{ color: riskNum >= 60 ? '#FF5252' : riskNum >= 35 ? '#FFD93D' : '#4ECDC4' }">{{ riskNum }}</text>
              <text class="qr-kpi-lbl">风险指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: riskNum + '%', background: riskNum >= 60 ? '#FF5252' : riskNum >= 35 ? '#FFD93D' : '#4ECDC4' }"></view></view>
            </view>
          </view>
        </view>

        <!-- Signal Tag -->
        <view v-if="signal || snapshotCrushTypeLabel" class="card-v2 anim-card" style="animation-delay:0.15s;padding:20rpx 28rpx;">
          <view class="tag-row-v2">
            <text v-if="snapshotCrushTypeLabel" class="tag-v2 black">{{ snapshotCrushTypeLabel }}</text>
            <text class="tag-v2 black">{{ signal }}</text>
          </view>
          <text v-if="snapshotCrushTypeSummary" class="qr-action-text">{{ snapshotCrushTypeSummary }}</text>
        </view>

        <!-- Reason Bullets -->
        <view v-if="bullets.length > 0" class="card-v2 anim-card" style="animation-delay:0.2s">
          <text class="section-title-v2">分析依据</text>
          <view v-for="b in bullets" :key="b" class="qr-bullet"><view class="qr-bullet-dot"></view><text>{{ b }}</text></view>
        </view>

        <!-- Action Plan -->
        <view v-if="actionText" class="card-v2 anim-card" style="animation-delay:0.23s;background:#FFFBEB;">
          <text class="section-title-v2">小咪帮你看看</text>
          <text class="qr-action-text">{{ actionText }}</text>
        </view>

        <text class="page-hint anim-card" style="animation-delay:0.26s">以上是朋友的匿名分析快照 · 不含隐私信息</text>
      </template>

      <!-- ====== Organic entry ====== -->
      <template v-else>
        <view class="hero-block-v2 anim-hero">
          <text class="hero-tag-v2">SIGNAL REPORT</text>
          <text class="hero-title-v2">别猜了，让小咪帮你看清关系信号</text>
          <text class="hero-copy-v2">记录你和 TA 的真实互动，小咪帮你分析意向和风险</text>
        </view>
      </template>

      <!-- Not logged in -->
      <view v-if="ready && !loggedIn" class="cta-card anim-card" style="animation-delay:0.3s">
        <text class="cta-title">需要微信授权</text>
        <text class="cta-desc">请点击下方按钮完成登录后继续。</text>
        <button class="btn btn-primary btn-lg btn-full" @click="retryLogin">重新登录</button>
      </view>

      <!-- Try mine -->
      <view v-else-if="loggedIn && !quickResult" class="card-v2 anim-card" style="animation-delay:0.3s">
        <view class="qr-form-head">
          <text class="section-title-v2">测测我的 TA</text>
          <text class="qr-step">{{ quickStep + 1 }} / 3</text>
        </view>

        <template v-if="quickStep === 0">
          <text class="qr-form-title">这次更像哪种情况？</text>
          <view class="qr-chip-grid">
            <view v-for="item in sceneOptions" :key="item.value" :class="['qr-chip', form.scene === item.value ? 'active' : '']" @click="form.scene = item.value">{{ item.label }}</view>
          </view>
        </template>

        <template v-else-if="quickStep === 1">
          <text class="qr-form-title">TA 做了什么？原话是什么？</text>
          <textarea v-model="form.text" class="qr-textarea" maxlength="600" placeholder="比如：他昨天说下次约我，但一直没定时间..." />
        </template>

        <template v-else>
          <text class="qr-form-title">你现在最想知道什么？</text>
          <view class="qr-chip-grid">
            <view v-for="item in questionOptions" :key="item" :class="['qr-chip', form.question === item ? 'active' : '']" @click="form.question = item">{{ item }}</view>
          </view>
        </template>

        <view class="qr-form-actions">
          <button v-if="quickStep > 0" class="btn btn-secondary btn-md btn-auto" :disabled="quickLoading" @click="quickStep--">上一步</button>
          <button v-if="quickStep < 2" class="btn btn-primary btn-md btn-auto" @click="nextQuickStep">下一步</button>
          <button v-else class="btn btn-primary btn-md btn-auto" :disabled="quickLoading" @click="submitQuickRead">{{ quickLoading ? '分析中...' : '看结果' }}</button>
        </view>
        <text class="qr-skip-link" @click="onCTA">{{ ctaLoading ? '进入中...' : '跳过，直接开始追踪' }}</text>
      </view>

      <view v-else-if="loggedIn && quickResult" class="card-v2 anim-card" style="animation-delay:0.3s;background:#FFFBEB;">
        <text class="section-title-v2">小咪测出</text>
        <text class="qr-type-label">{{ quickCrushType.label }}</text>
        <text class="qr-type-summary">{{ quickCrushType.summary }}</text>
        <view class="qr-kpi-row compact">
          <view class="qr-kpi-item"><text class="qr-kpi-num">{{ quickIntentScore }}</text><text class="qr-kpi-lbl">意向</text></view>
          <view class="qr-kpi-split"></view>
          <view class="qr-kpi-item"><text class="qr-kpi-num risk">{{ quickRiskScore }}</text><text class="qr-kpi-lbl">风险</text></view>
        </view>
        <text v-if="quickResult.directAnswer" class="qr-direct-answer">{{ quickResult.directAnswer }}</text>
        <text class="qr-action-text">{{ quickResult.analysis }}</text>
        <view v-if="quickReasons.length > 0" class="tag-row-v2" style="margin-top:14rpx;">
          <text v-for="item in quickReasons" :key="item" class="tag-v2 black">{{ item }}</text>
        </view>
        <view class="qr-result-actions">
          <button class="btn btn-secondary btn-md btn-auto" @click="resetQuickRead">重新测</button>
          <button class="btn btn-primary btn-md btn-auto" @click="onCTA">{{ ctaLoading ? '进入中...' : '保存并持续追踪' }}</button>
        </view>
        <text class="page-hint">保存后可以继续追踪 TA 会不会从「{{ quickCrushType.label.replace('型', '') }}」变成「认真推进」。</text>
      </view>

      <text class="page-disclaimer">小咪辅助分析 · 仅供参考，不构成专业意见</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCurrentUserId, getOrCreateDefaultCase, getCachedSelfProfile, hasUsableSelfProfile, quickRead, wechatLogin } from '@/utils/api'
import { buildCrushTypeReasons, deriveCrushType } from '@/utils/crush-type.js'
import { captureLandingContext, readLandingContext } from '@/utils/landing'

const fontMode = ref(uni.getStorageSync('fontSizeMode') || '')
const ready = ref(false)
const loggedIn = ref(false)
const ctaLoading = ref(false)

const title = ref('别猜了，让小咪帮你看清关系信号')
const intentNum = ref(50)
const riskNum = ref(35)
const signal = ref('')
const bullets = ref<string[]>([])
const actionText = ref('')
const hasSnapshot = ref(false)
const snapshotCrushTypeLabel = ref('')
const snapshotCrushTypeSummary = ref('')
const quickStep = ref(0)
const quickLoading = ref(false)
const quickResult = ref<any>(null)
const form = reactive({
  scene: 'chat_reply',
  text: '',
  question: '他喜欢我吗'
})

const sceneOptions = [
  { value: 'chat_reply', label: '聊天回复' },
  { value: 'date_progress', label: '约见推进' },
  { value: 'hot_cold', label: '忽冷忽热' },
  { value: 'ex_contact', label: '前任暧昧' },
  { value: 'after_meet', label: '见面后变化' }
]
const questionOptions = ['他喜欢我吗', '我该不该主动', '他是不是养鱼', '怎么回复']

const quickIntentScore = computed(() => normalizeScore(
  quickResult.value?.intentScore ?? quickResult.value?.intent ?? quickResult.value?.intentNum,
  50
))
const quickRiskScore = computed(() => normalizeScore(
  quickResult.value?.riskScore ?? quickResult.value?.consistencyRiskScore ?? quickResult.value?.risk ?? quickResult.value?.riskNum,
  35
))
const normalizedQuickResult = computed(() => ({
  ...(quickResult.value || {}),
  intentScore: quickIntentScore.value,
  riskScore: quickRiskScore.value,
  consistencyRiskScore: quickRiskScore.value
}))
const quickCrushType = computed(() => deriveCrushType(normalizedQuickResult.value))
const quickReasons = computed(() => buildCrushTypeReasons(normalizedQuickResult.value, quickCrushType.value))

onLoad(async (options: any) => {
  captureLandingContext(options || {})

  const t = decodeURIComponent(String(options?.title || ''))
  const i = Number(options?.intent)
  const r = Number(options?.risk)
  if (t || !isNaN(i)) {
    hasSnapshot.value = true
    if (t) title.value = t
    if (!isNaN(i)) intentNum.value = Math.max(0, Math.min(100, i))
    if (!isNaN(r)) riskNum.value = Math.max(0, Math.min(100, r))
  }

  signal.value = decodeURIComponent(String(options?.signal || ''))
  snapshotCrushTypeLabel.value = decodeURIComponent(String(options?.crushTypeLabel || ''))
  snapshotCrushTypeSummary.value = decodeURIComponent(String(options?.crushTypeSummary || ''))
  const rawBullets = decodeURIComponent(String(options?.bullets || ''))
  bullets.value = rawBullets ? rawBullets.split('|').filter(Boolean).slice(0, 3) : []
  actionText.value = decodeURIComponent(String(options?.action || ''))

  await waitForSilentLogin()
  loggedIn.value = !!getCurrentUserId()
  ready.value = true
})

async function waitForSilentLogin() {
  const start = Date.now()
  while (Date.now() - start < 3000) {
    const uid = getCurrentUserId()
    if (uid) { console.log('[quick-read] login ok, userId:', uid.slice(0, 20)); return }
    if (uni.getStorageSync('silentLoginDone')) { await new Promise(r => setTimeout(r, 300)); return }
    await new Promise(r => setTimeout(r, 150))
  }
  console.warn('[quick-read] login timeout after 3s')
}

async function retryLogin() {
  try {
    const wxApi = (globalThis as any)?.wx
    if (!wxApi?.login) { uni.navigateTo({ url: '/pages/login/login' }); return }
    const loginCode = await new Promise<string>(resolve => {
      wxApi.login({ success(res: any) { resolve(res?.code || '') }, fail() { resolve('') } })
    })
    if (!loginCode) { uni.navigateTo({ url: '/pages/login/login' }); return }
    const ctx = readLandingContext()
    const result = await wechatLogin('', { loginCode, channel: ctx.channel, scene: ctx.scene, ref: ctx.ref, shareId: ctx.shareId })
    if (result?.success) { loggedIn.value = true; return }
  } catch {}
  uni.navigateTo({ url: '/pages/login/login' })
}

function nextQuickStep() {
  if (quickStep.value === 0 && !form.scene) { uni.showToast({ title: '先选一个场景', icon: 'none' }); return }
  if (quickStep.value === 1 && form.text.trim().length < 2) { uni.showToast({ title: '写一句真实互动', icon: 'none' }); return }
  quickStep.value += 1
}

async function submitQuickRead() {
  if (!form.question) { uni.showToast({ title: '先选一个困惑', icon: 'none' }); return }
  quickLoading.value = true
  try {
    const result = await quickRead(form.text, form.scene, { question: form.question })
    if (!result?.success) {
      uni.showToast({ title: result?.message || '分析失败', icon: 'none' })
      return
    }
    quickResult.value = normalizeQuickReadResult(result)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '分析失败', icon: 'none' })
  } finally {
    quickLoading.value = false
  }
}

function normalizeScore(value: any, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizeQuickReadResult(result: any) {
  const intentScore = normalizeScore(result?.intentScore ?? result?.intent ?? result?.intentNum, 50)
  const riskScore = normalizeScore(result?.riskScore ?? result?.consistencyRiskScore ?? result?.risk ?? result?.riskNum, 35)
  const directAnswer = String(result?.directAnswer || '').trim() || buildLocalDirectAnswer(form.question, intentScore, riskScore)
  return {
    ...result,
    intentScore,
    riskScore,
    consistencyRiskScore: riskScore,
    directAnswer
  }
}

function buildLocalDirectAnswer(question: string, intentScore: number, riskScore: number) {
  const q = String(question || '').trim()
  if (q.includes('养鱼')) {
    if (riskScore >= 60) return '有养鱼或低成本暧昧风险，但还需要继续看行动证据。'
    if (intentScore >= 55) return '暂时不像明确养鱼，更像有兴趣但节奏还不稳定。'
    return '目前证据不足，不能定性养鱼，但也不建议继续加码。'
  }
  if (q.includes('喜欢')) {
    if (intentScore >= 65) return '有比较明显的好感信号，但还要看后续是否兑现。'
    if (intentScore >= 45) return '有一点兴趣，但还没到能确认喜欢。'
    return '目前喜欢信号偏弱，先不要替对方脑补。'
  }
  if (q.includes('主动')) {
    return riskScore >= 60 ? '不建议继续强主动，先降一点投入观察。' : '可以低压力主动一次，但不要连续追问。'
  }
  if (q.includes('回复')) {
    return '可以轻松接住话题，同时把问题抛回给 TA 看行动。'
  }
  return '这条信息只能先做初步判断，关键看后续行动是否跟上。'
}

function resetQuickRead() {
  quickResult.value = null
  quickStep.value = 0
}

async function onCTA() {
  ctaLoading.value = true
  try {
    const cached = getCachedSelfProfile()
    if (!hasUsableSelfProfile(cached)) {
      uni.navigateTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
      return
    }
    await getOrCreateDefaultCase()
    uni.switchTab({ url: '/pages/index/index' })
  } catch {
    uni.switchTab({ url: '/pages/index/index' })
  } finally {
    ctaLoading.value = false
  }
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: $lh-hero; letter-spacing: -2rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; margin-bottom: $sp-card-gap; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .tag-row-v2 { @include tag-row-v2; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { @include tag-v2-black; }

// KPI
.qr-kpi-row { display: flex; align-items: center; padding: 8rpx 0; }
.qr-kpi-row.compact { margin-top: 16rpx; padding: 16rpx 0; border: 2rpx solid #111; background: #fff; }
.qr-kpi-item { flex: 1; text-align: center; }
.qr-kpi-num { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; line-height: 1; }
.qr-kpi-num.risk { color: #FF5252; }
.qr-kpi-lbl { display: block; font-size: $fs-body; font-weight: $fw-label; color: #666; margin-top: 6rpx; }
.qr-kpi-bar { height: 10rpx; background: #f0f0f0; border: 1rpx solid #ddd; margin-top: 10rpx; }
.qr-kpi-fill { height: 100%; transition: width 0.5s ease; }
.qr-kpi-split { width: 2rpx; height: 72rpx; background: #111; opacity: .25; flex-shrink: 0; margin: 0 28rpx; }

// Bullets
.qr-bullet { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 14rpx; }
.qr-bullet-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #111; margin-top: 10rpx; flex-shrink: 0; }
.qr-bullet text { font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.65; }

// Action
.qr-action-text { display: block; margin-top: 10rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.7; }
.qr-direct-answer { display: block; margin-top: 16rpx; padding: 16rpx; border: 2rpx solid #111; background: #fff; font-size: $fs-body-lg; font-weight: $fw-hero; color: #111; line-height: 1.55; }
.qr-form-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.qr-step { padding: 4rpx 12rpx; border: 2rpx solid #111; background: #FFD93D; font-size: $fs-caption; font-weight: $fw-hero; color: #111; }
.qr-form-title { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: #111; line-height: 1.35; margin-bottom: 14rpx; }
.qr-chip-grid { display: flex; flex-wrap: wrap; gap: 10rpx; }
.qr-chip { padding: 14rpx 18rpx; border: 2rpx solid #111; background: #fff; font-size: $fs-body-lg; font-weight: $fw-label; color: #111; }
.qr-chip.active { background: #111; color: #FFD93D; }
.qr-textarea { width: 100%; min-height: 180rpx; box-sizing: border-box; padding: 18rpx; border: 3rpx solid #111; background: #fff; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.55; }
.qr-form-actions, .qr-result-actions { display: flex; gap: 12rpx; margin-top: 18rpx; }
.qr-form-actions .btn, .qr-result-actions .btn { flex: 1; }
.qr-skip-link { display: block; margin-top: 16rpx; text-align: center; font-size: $fs-body; font-weight: $fw-label; color: #666; text-decoration: underline; }
.qr-type-label { display: block; margin-top: 6rpx; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1.1; }
.qr-type-summary { display: block; margin-top: 10rpx; font-size: $fs-body-lg; font-weight: $fw-label; color: #555; line-height: 1.5; }

// Shared
.page-hint { display: block; text-align: center; font-size: $fs-caption; color: #bbb; margin-bottom: 16rpx; }
.page-disclaimer { display: block; padding: 32rpx 0 16rpx; text-align: center; color: #bbb; font-size: $fs-caption; font-weight: $fw-label; }

.cta-card { margin-top: 24rpx; padding: 32rpx 28rpx; background: #111; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #FF6B6B; }
.cta-title { display: block; color: #FFD93D; font-size: $fs-heading; font-weight: $fw-hero; }
.cta-desc { display: block; margin-top: 12rpx; color: rgba(255,255,255,0.78); font-size: $fs-body-lg; line-height: 1.5; font-weight: $fw-body; }

.loading-v2 { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }
</style>
