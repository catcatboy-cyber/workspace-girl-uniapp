<template>
  <view :class="['page v2-mode', themeClass, fontMode === 'large' ? 'font-large' : '', ready ? 'anim-ready' : '']" :style="themeVars">
    <view v-if="!ready" class="loading-v2">LOADING...</view>

    <template v-else>
      <!-- ====== Snapshot from A ====== -->
      <template v-if="hasSnapshot && !started">
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
              <text class="qr-kpi-num" :style="{ color: intentNum >= 60 ? 'var(--accent-cool,#4ECDC4)' : intentNum >= 40 ? 'var(--accent,#FFD93D)' : 'var(--text-soft,#999)' }">{{ intentNum }}</text>
              <text class="qr-kpi-lbl">意向指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: intentNum + '%', background: intentNum >= 60 ? 'var(--accent-cool,#4ECDC4)' : intentNum >= 40 ? 'var(--accent,#FFD93D)' : 'var(--divider,#ccc)' }"></view></view>
            </view>
            <view class="qr-kpi-split"></view>
            <view class="qr-kpi-item">
              <text class="qr-kpi-num" :style="{ color: riskNum >= 60 ? 'var(--risk,#FF5252)' : riskNum >= 35 ? 'var(--accent,#FFD93D)' : 'var(--accent-cool,#4ECDC4)' }">{{ riskNum }}</text>
              <text class="qr-kpi-lbl">风险指数</text>
              <view class="qr-kpi-bar"><view class="qr-kpi-fill" :style="{ width: riskNum + '%', background: riskNum >= 60 ? 'var(--risk,#FF5252)' : riskNum >= 35 ? 'var(--accent,#FFD93D)' : 'var(--accent-cool,#4ECDC4)' }"></view></view>
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
        <view v-if="actionText" class="card-v2 anim-card" style="animation-delay:0.23s;background:var(--brand-warm,#FFFBEB);">
          <text class="section-title-v2">小咪帮你看看</text>
          <text class="qr-action-text">{{ actionText }}</text>
        </view>

        <text class="page-hint anim-card" style="animation-delay:0.26s">以上是朋友的匿名分析快照 · 不含隐私信息</text>
      </template>

      <!-- ====== Organic entry ====== -->
      <template v-else-if="!started">
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
        <text class="qr-skip-link light" @click="onCTA">{{ ctaLoading ? '进入中...' : '先去首页看看' }}</text>
      </view>

      <view v-else-if="loggedIn && hasSnapshot && !started" class="cta-card anim-card" style="animation-delay:0.3s">
        <text class="cta-title">别自己反复猜了</text>
        <text class="cta-desc">把你最纠结的那一幕说清楚，小咪帮你判断 TA 是有意思、试探，还是只是在吊着。</text>
        <button class="btn btn-primary btn-lg btn-full" @click="startMine">帮我看看 TA 什么意思</button>
        <text class="qr-skip-link light" @click="onCTA">{{ ctaLoading ? '进入中...' : '先去首页看看' }}</text>
      </view>

      <view v-else-if="loggedIn && !started" class="cta-card anim-card" style="animation-delay:0.3s">
        <text class="cta-title">TA 这一句，到底怎么理解？</text>
        <text class="cta-desc">把关系和原话丢给小咪，先生成一条属于你的本次分析。</text>
        <button class="btn btn-primary btn-lg btn-full" @click="startMine">我也想让小咪分析</button>
        <text class="qr-skip-link light" @click="onCTA">{{ ctaLoading ? '进入中...' : '先去首页看看' }}</text>
      </view>

      <view v-else-if="loggedIn && started && !targetProfileMode" class="card-v2 anim-card" style="animation-delay:0.3s">
        <view class="qr-form-head">
          <text class="section-title-v2">让小咪看我的这条</text>
          <text class="qr-skip-link inline" @click="onCTA">{{ ctaLoading ? '进入中...' : '先逛逛' }}</text>
        </view>

        <view class="qr-field-block">
          <text class="qr-form-title">你和 TA 现在是什么关系？</text>
          <view class="qr-chip-grid">
            <view v-for="item in relationOptions" :key="item.value" :class="['qr-chip', form.relationType === item.value ? 'active' : '']" @click="form.relationType = item.value">{{ item.label }}</view>
          </view>
        </view>

        <view class="qr-field-block">
          <text class="qr-form-title">TA 做了什么？原话是什么？</text>
          <textarea v-model="form.text" class="qr-textarea" maxlength="6000" placeholder="比如：他昨天说下次约我，但一直没定时间..." />
          <text class="qr-text-count">当前 {{ form.text.length }}/6000</text>
        </view>

        <view class="qr-field-block">
          <text class="qr-form-title">你现在最想知道什么？</text>
          <view class="qr-chip-grid">
            <view v-for="item in questionOptions" :key="item.key" :class="['qr-chip', form.questionKey === item.key ? 'active' : '']" @click="form.questionKey = item.key">{{ item.label }}</view>
          </view>
        </view>

        <view class="qr-form-actions">
          <button class="btn btn-primary btn-md btn-auto" :disabled="quickLoading" @click="submitFirstAnalysis">{{ quickLoading ? '生成中...' : '让小咪帮我分析' }}</button>
        </view>
        <text class="page-hint">为了不瞎猜，按下后小咪会补几个基础信息，再给你本次分析。</text>
      </view>

      <view v-else-if="loggedIn && targetProfileMode" class="card-v2 anim-card" style="animation-delay:0.3s">
        <view class="qr-form-head">
          <text class="section-title-v2">再确认一下 TA</text>
          <text class="qr-step">最后一步</text>
        </view>
        <view class="qr-chat-row">
          <view class="qr-chat-avatar">小咪</view>
          <view class="qr-chat-bubble">
            <text>为了不把你们的情况看偏，我再确认几个 TA 的基础信息。</text>
            <text class="muted">不知道也可以跳过，不影响继续分析。</text>
          </view>
        </view>
        <view class="qr-field-block">
          <text class="qr-form-title">TA 怎么称呼？</text>
          <input v-model="form.targetName" class="qr-input" maxlength="20" placeholder="TA 或昵称" />
        </view>
        <view class="qr-field-block">
          <text class="qr-form-title">TA 是？</text>
          <view class="qr-chip-grid">
            <view v-for="item in targetGenderOptions" :key="item.value" :class="['qr-chip', form.targetGender === item.value ? 'active' : '']" @click="form.targetGender = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="qr-field-block">
          <text class="qr-form-title">TA 的属相知道吗？</text>
          <view class="qr-chip-grid compact">
            <view v-for="item in zodiacOptions" :key="item" :class="['qr-chip', form.targetZodiac === item ? 'active' : '']" @click="form.targetZodiac = item">{{ item }}</view>
          </view>
        </view>
        <view class="qr-field-block">
          <text class="qr-form-title">TA 的星座知道吗？</text>
          <view class="qr-chip-grid compact">
            <view v-for="item in signOptions" :key="item" :class="['qr-chip', form.targetConstellation === item ? 'active' : '']" @click="form.targetConstellation = item">{{ item }}</view>
          </view>
        </view>
        <view class="qr-form-actions">
          <button class="btn btn-secondary btn-md btn-auto" :disabled="quickLoading" @click="targetProfileMode = false">上一步</button>
          <button class="btn btn-primary btn-md btn-auto" :disabled="quickLoading" @click="confirmTargetProfile">{{ quickLoading ? '生成中...' : '生成本次分析' }}</button>
        </view>
        <text class="qr-skip-link" @click="onCTA">{{ ctaLoading ? '进入中...' : '先逛逛，回头再测' }}</text>
      </view>

      <text class="page-disclaimer">小咪辅助分析 · 仅供参考，不构成专业意见</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createCase, createTimeline, generateAssessmentAI, getCurrentUserId, getCachedSelfProfile, hasUsableSelfProfile, wechatLogin } from '@/utils/api'
import { bumpDataVersion, combineDateAndTimeToISOString, getDateInputValue, getTimeInputValue, setActiveCaseId, setPendingTimelineContext } from '@/utils/helpers'
import { captureLandingContext, readLandingContext } from '@/utils/landing'
import { SIGN_NAMES, ZODIAC_NAMES } from '@/utils/taohua'
import { aiLabel } from '@/utils/labels'
import { applyThemeChrome, getThemeClass, getThemeStyle } from '@/utils/theme'

const DRAFT_KEY = 'quickReadAnalysisDraft'

const fontMode = ref(uni.getStorageSync('fontSizeMode') || '')
const themeVars = ref(getThemeStyle())
const themeClass = ref(getThemeClass())
const ready = ref(false)
const loggedIn = ref(false)
const selfProfileReady = ref(false)
const started = ref(false)
const targetProfileMode = ref(false)
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
const quickLoading = ref(false)
const form = reactive({
  relationType: 'romantic',
  text: '',
  questionKey: 'like',
  targetName: 'TA',
  targetGender: '',
  targetZodiac: '不知道',
  targetConstellation: '不知道'
})

const relationOptions = [
  { value: 'romantic', label: '暧昧 / Crush' },
  { value: 'close_friend', label: '朋友心动' },
  { value: 'new_contact', label: '刚认识' },
  { value: 'ex', label: '前任 / 旧关系' }
]

const questionOptions = [
  { key: 'like', label: '他喜欢我吗' },
  { key: 'initiative', label: '我该不该主动' },
  { key: 'fishing', label: '他是不是养鱼' },
  { key: 'reply', label: '怎么回复' }
]
const selectedQuestion = computed(() => questionOptions.find(item => item.key === form.questionKey) || questionOptions[0])
const targetGenderOptions = [
  { value: '', label: '不确定' },
  { value: '女', label: '女生' },
  { value: '男', label: '男生' },
  { value: '其他', label: '其他' }
]
const zodiacOptions = ['不知道', ...ZODIAC_NAMES]
const signOptions = ['不知道', ...SIGN_NAMES]

onLoad(async (options: any) => {
  themeVars.value = getThemeStyle()
  themeClass.value = getThemeClass()
  applyThemeChrome()
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
  selfProfileReady.value = hasUsableSelfProfile(getCachedSelfProfile())
  restoreDraft()
  ready.value = true
})

async function waitForSilentLogin() {
  const start = Date.now()
  while (Date.now() - start < 3000) {
    const uid = getCurrentUserId()
    if (uid) return
    if (uni.getStorageSync('silentLoginDone')) { await new Promise(r => setTimeout(r, 300)); return }
    await new Promise(r => setTimeout(r, 150))
  }
}

async function retryLogin() {
  try {
    const wxApi = (globalThis as any)?.wx
    const redirect = encodeURIComponent(buildCurrentRedirect())
    if (!wxApi?.login) { uni.navigateTo({ url: `/pages/login/login?redirect=${redirect}` }); return }
    const loginCode = await new Promise<string>(resolve => {
      wxApi.login({ success(res: any) { resolve(res?.code || '') }, fail() { resolve('') } })
    })
    if (!loginCode) { uni.navigateTo({ url: `/pages/login/login?redirect=${redirect}` }); return }
    const ctx = readLandingContext()
    const result = await wechatLogin('', { loginCode, channel: ctx.channel, scene: ctx.scene, ref: ctx.ref, shareId: ctx.shareId })
    if (result?.success) {
      loggedIn.value = true
      selfProfileReady.value = hasUsableSelfProfile(getCachedSelfProfile())
      return
    }
  } catch {}
  uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(buildCurrentRedirect())}` })
}

function startMine() {
  started.value = true
}

function goSelfProfileOnboarding() {
  saveDraft()
  const currentPath = buildCurrentRedirect()
  uni.navigateTo({ url: `/pages/self-profile/self-profile?mode=onboarding&redirect=${encodeURIComponent(currentPath)}` })
}

function buildCurrentRedirect() {
  const params = [
    `intent=${intentNum.value}`,
    `risk=${riskNum.value}`
  ]
  if (signal.value) params.push(`signal=${encodeURIComponent(signal.value)}`)
  if (snapshotCrushTypeLabel.value) params.push(`crushTypeLabel=${encodeURIComponent(snapshotCrushTypeLabel.value)}`)
  if (snapshotCrushTypeSummary.value) params.push(`crushTypeSummary=${encodeURIComponent(snapshotCrushTypeSummary.value)}`)
  if (bullets.value.length) params.push(`bullets=${encodeURIComponent(bullets.value.join('|'))}`)
  if (actionText.value) params.push(`action=${encodeURIComponent(actionText.value)}`)
  params.push('continueDraft=1')
  return `/pages/quick-read/quick-read?${params.join('&')}`
}

function saveDraft(overrides: Record<string, any> = {}) {
  try {
    uni.setStorageSync(DRAFT_KEY, {
      relationType: form.relationType,
      text: form.text,
      questionKey: form.questionKey,
      targetName: form.targetName,
      targetGender: form.targetGender,
      targetZodiac: form.targetZodiac,
      targetConstellation: form.targetConstellation,
      started: started.value,
      targetProfileMode: targetProfileMode.value,
      ...overrides
    })
  } catch {}
}

function restoreDraft() {
  try {
    const draft = uni.getStorageSync(DRAFT_KEY)
    if (!draft || typeof draft !== 'object') return
    form.relationType = draft.relationType || form.relationType
    form.text = draft.text || ''
    form.questionKey = draft.questionKey || form.questionKey
    form.targetName = draft.targetName || 'TA'
    form.targetGender = draft.targetGender || ''
    form.targetZodiac = draft.targetZodiac || '不知道'
    form.targetConstellation = draft.targetConstellation || '不知道'
    started.value = Boolean(draft.started || draft.text)
    targetProfileMode.value = Boolean(draft.targetProfileMode)
  } catch {}
}

function clearDraft() {
  try { uni.removeStorageSync(DRAFT_KEY) } catch {}
}

function validateQuestionForm() {
  if (!form.relationType) { uni.showToast({ title: '先选你们的关系', icon: 'none' }); return false }
  if (form.text.trim().length < 2) { uni.showToast({ title: '写一句真实互动', icon: 'none' }); return false }
  if (!selectedQuestion.value) { uni.showToast({ title: '先选一个困惑', icon: 'none' }); return false }
  return true
}

async function submitFirstAnalysis() {
  if (!validateQuestionForm()) return
  try {
    const uid = getCurrentUserId()
    if (!uid) {
      loggedIn.value = false
      return
    }
    if (!hasUsableSelfProfile(getCachedSelfProfile())) {
      targetProfileMode.value = true
      saveDraft({ targetProfileMode: true, started: true })
      goSelfProfileOnboarding()
      return
    }
    saveDraft()
    targetProfileMode.value = true
  } catch (error: any) {
    uni.showToast({ title: error?.message || '生成失败', icon: 'none' })
  }
}

async function confirmTargetProfile() {
  if (!validateQuestionForm()) return
  quickLoading.value = true
  uni.showLoading({ title: '生成中...' })
  try {
    const uid = getCurrentUserId()
    if (!uid) {
      uni.hideLoading()
      loggedIn.value = false
      return
    }
    if (!hasUsableSelfProfile(getCachedSelfProfile())) {
      uni.hideLoading()
      saveDraft({ targetProfileMode: true, started: true })
      goSelfProfileOnboarding()
      return
    }

    const caseRes = await createCase({
      userId: uid,
      name: String(form.targetName || 'TA').trim() || 'TA',
      answers: [],
      profile: {
        relationType: form.relationType,
        gender: form.targetGender || '',
        age: null,
        zodiac: form.targetZodiac === '不知道' ? '' : form.targetZodiac,
        constellation: form.targetConstellation === '不知道' ? '' : form.targetConstellation,
        occupation: '',
        avatar: ''
      }
    })
    if (!caseRes?.success) {
      uni.hideLoading()
      uni.showToast({ title: caseRes?.message || '创建档案失败', icon: 'none' })
      return
    }

    const caseId = caseRes.caseId || caseRes.case?.caseId || caseRes.case?._id
    if (!caseId) {
      uni.hideLoading()
      uni.showToast({ title: '创建档案失败', icon: 'none' })
      return
    }

    const currentQuestion = { key: selectedQuestion.value.key, label: selectedQuestion.value.label }
    const occurrenceAt = combineDateAndTimeToISOString(getDateInputValue(), getTimeInputValue())
    const timelineRes = await createTimeline({
      userId: uid,
      caseId,
      description: form.text.trim(),
      subjectRole: 'target',
      subjectRoleConfidence: 'confirmed',
      userQuestion: currentQuestion,
      attachments: [],
      occurrenceAt
    })
    if (!timelineRes?.success) {
      uni.hideLoading()
      uni.showToast({ title: timelineRes?.message || '记录失败', icon: 'none' })
      return
    }

    setActiveCaseId(caseId)
    bumpDataVersion()
    if (timelineRes.recordId) {
      setPendingTimelineContext({
        caseId,
        classified: true,
        eventType: timelineRes.eventType || 'note',
        recorded: true,
        targetEventId: timelineRes.recordId
      })
    }
    if (timelineRes.aiPending && timelineRes.assessmentId) {
      generateAssessmentAI({
        caseId,
        assessmentId: timelineRes.assessmentId,
        recordId: timelineRes.recordId
      }).catch(() => {})
    }

    uni.hideLoading()
    clearDraft()
    uni.switchTab({ url: '/pages/index/index' })
  } catch (error: any) {
    uni.hideLoading()
    uni.showToast({ title: error?.message || '生成失败', icon: 'none' })
  } finally {
    quickLoading.value = false
  }
}

async function onCTA() {
  ctaLoading.value = true
  try {
    if (!getCurrentUserId()) {
      uni.navigateTo({ url: '/pages/login/login' })
      return
    }
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
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: $lh-hero; letter-spacing: -2rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; margin-bottom: $sp-card-gap; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .tag-row-v2 { @include tag-row-v2; }
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { @include tag-v2-black; }

// KPI
.qr-kpi-row { display: flex; align-items: center; padding: 8rpx 0; }
.qr-kpi-row.compact { margin-top: 16rpx; padding: 16rpx 0; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); }
.qr-kpi-item { flex: 1; text-align: center; }
.qr-kpi-num { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; line-height: 1; }
.qr-kpi-num.risk { color: var(--risk, #FF5252); }
.qr-kpi-lbl { display: block; font-size: $fs-body; font-weight: $fw-label; color: var(--text-muted, #666); margin-top: 6rpx; }
.qr-kpi-bar { height: 10rpx; background: var(--surface-soft, #f0f0f0); border: 1rpx solid var(--divider, #ddd); margin-top: 10rpx; }
.qr-kpi-fill { height: 100%; transition: width 0.5s ease; }
.qr-kpi-split { width: 2rpx; height: 72rpx; background: var(--text-main, #111); opacity: .25; flex-shrink: 0; margin: 0 28rpx; }

// Bullets
.qr-bullet { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 14rpx; }
.qr-bullet-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: var(--text-main, #111); margin-top: 10rpx; flex-shrink: 0; }
.qr-bullet text { font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.65; }

// Action
.qr-action-text { display: block; margin-top: 10rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.7; }
.qr-direct-answer { display: block; margin-top: 16rpx; padding: 16rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1.55; }
.qr-form-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.qr-step { padding: 4rpx 12rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--accent, #FFD93D); font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.qr-form-title { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1.35; margin-bottom: 14rpx; }
.qr-field-block { margin-top: 26rpx; padding-top: 24rpx; border-top: 2rpx solid var(--divider, rgba(17,17,17,0.12)); }
.qr-field-block:first-of-type { margin-top: 12rpx; padding-top: 0; border-top: 0; }
.qr-chip-grid { display: flex; flex-wrap: wrap; gap: 10rpx; }
.qr-chip-grid.compact { gap: 8rpx; }
.qr-chip { padding: 14rpx 18rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); }
.qr-chip-grid.compact .qr-chip { padding: 10rpx 14rpx; font-size: $fs-body; }
.qr-chip.active { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.qr-input { width: 100%; height: 88rpx; box-sizing: border-box; padding: 0 18rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); }
.qr-textarea { width: 100%; min-height: 180rpx; box-sizing: border-box; padding: 18rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.55; }
.qr-text-count { display: block; margin-top: 8rpx; text-align: right; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #999); }
.qr-form-actions, .qr-result-actions { display: flex; gap: 12rpx; margin-top: 18rpx; }
.qr-form-actions .btn, .qr-result-actions .btn { flex: 1; }
.qr-skip-link { display: block; margin-top: 16rpx; text-align: center; font-size: $fs-body; font-weight: $fw-label; color: var(--text-muted, #666); text-decoration: underline; }
.qr-skip-link.inline { display: inline; margin-top: 0; font-size: $fs-caption; flex-shrink: 0; }
.qr-skip-link.light { color: var(--on-active-muted, rgba(255,255,255,0.72)); text-decoration-color: var(--on-active-muted, rgba(255,255,255,0.45)); }
.qr-chat-row { display: flex; align-items: flex-start; gap: 14rpx; margin: 18rpx 0 8rpx; }
.qr-chat-avatar { width: 76rpx; height: 76rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: 50%; background: var(--accent, #FFD93D); color: var(--text-main, #111); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: $fs-caption; font-weight: $fw-hero; }
.qr-chat-bubble { flex: 1; min-width: 0; padding: 18rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--success-soft, #F7FFF7); box-shadow: 5rpx 5rpx 0 var(--accent-cool, #4ECDC4); }
.qr-chat-bubble text { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.55; }
.qr-chat-bubble .muted { margin-top: 6rpx; font-size: $fs-body; color: var(--text-muted, #666); }
.qr-type-label { display: block; margin-top: 6rpx; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1.1; }
.qr-type-summary { display: block; margin-top: 10rpx; font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-muted, #555); line-height: 1.5; }

// Shared
.page-hint { display: block; text-align: center; font-size: $fs-caption; color: var(--text-soft, #bbb); margin-bottom: 16rpx; }
.page-disclaimer { display: block; padding: 32rpx 0 16rpx; text-align: center; color: var(--text-soft, #bbb); font-size: $fs-caption; font-weight: $fw-label; }

.cta-card { margin-top: 24rpx; padding: 32rpx 28rpx; background: var(--hero-tag-bg, #111); border: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #FF6B6B); }
.cta-title { display: block; color: var(--hero-tag-color, #FFD93D); font-size: $fs-heading; font-weight: $fw-hero; }
.cta-desc { display: block; margin-top: 12rpx; color: var(--on-active-muted, rgba(255,255,255,0.78)); font-size: $fs-body-lg; line-height: 1.5; font-weight: $fw-body; }

.loading-v2 { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); letter-spacing: 4rpx; }
</style>
