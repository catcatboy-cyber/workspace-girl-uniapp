<template>
  <view :class="['page v2-mode anim-ready', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <view class="hero-block-v2 anim-hero"><text class="hero-tag-v2">SETTINGS</text><text class="hero-title-v2">我<text class="hl-v2">的</text></text><text class="hero-copy-v2">管理账号、系统能力说明和个人设置。</text></view>
      <!-- Profile -->
      <view class="card-v2 anim-card" style="animation-delay:0.15s"><text class="section-title-v2">本人画像</text><text class="card-text-v2">{{ selfProfileSummary }}</text><button class="btn btn-secondary btn-md" @click="goSelfProfile">编辑本人画像</button></view>
      <!-- Account -->
      <view class="card-v2 anim-card" style="animation-delay:0.2s"><text class="section-title-v2">账号信息</text><text class="card-text-v2">当前登录：{{ userEmail || '未登录' }}</text><text class="card-text-v2">Crushes 数：{{ caseCount }}</text><view class="switch-row-v2"><text class="card-text-v2" style="flex:1">显示陪伴助手</text><switch :checked="showPetBar" color="#111" @change="onPetBarChange" /></view><view class="btn-row-v2"><button class="btn btn-secondary btn-md" open-type="share">分享小程序</button><button class="btn btn-danger btn-md" @click="onLogout">退出登录</button></view></view>
      <!-- Pet picker -->
      <view class="card-v2 anim-card" style="animation-delay:0.25s"><text class="section-title-v2">陪伴形象</text><view class="pet-row-v2"><image :src="currentPet.avatarPath" class="pet-avatar-img-v2" mode="aspectFit" @click="showPetSheet = true" /><view class="pet-row-info-v2"><text class="pet-row-name-v2">{{ currentPet.displayName }}</text><text class="pet-row-desc-v2">{{ currentPet.description }}</text><button class="btn btn-secondary btn-sm" style="margin-top:10rpx" @click="showPetSheet = true">换只宠物</button></view></view></view>
      <!-- Pet select sheet -->
      <view v-if="showPetSheet" class="sheet-mask" @click="showPetSheet = false"><view class="sheet-panel" @click.stop><view class="sheet-head"><text class="sheet-title">选择陪伴形象</text><text class="sheet-close" @click="showPetSheet = false">&times;</text></view><scroll-view scroll-y class="pet-sheet-scroll-v2"><view class="pet-sheet-grid-inner-v2"><view v-for="pet in petOptions" :key="pet.id" :class="['pet-option-v2', currentPetId === pet.id ? 'active' : '']" @click="choosePet(pet.id)"><image :src="pet.avatarPath" class="pet-option-img-v2" mode="aspectFit" /><view class="pet-option-text-v2"><view class="pet-option-name-row-v2"><text class="pet-option-name-v2">{{ pet.displayName }}</text><text v-if="isCloudPet(pet.id) && isPetCachedLocally(pet.id)" class="pet-option-badge-v2">已下载</text><text v-else-if="isCloudPet(pet.id)" class="pet-option-badge-v2 download">下载</text></view><text class="pet-option-desc-v2">{{ pet.description }}</text></view><text v-if="currentPetId === pet.id" class="pet-option-check-v2">&#10003;</text></view></view></scroll-view><view class="pet-sheet-footer-v2"><view class="pet-sheet-divider-v2"><text class="pet-sheet-divider-text-v2">定制专属宠物</text></view><view class="pet-custom-entry-v2" @click="goCustomPet"><text class="pet-custom-icon-v2">&#9998;</text><text class="pet-custom-text-v2">描述你心中的专属宠物形象</text><text class="pet-custom-arrow-v2">&rarr;</text></view></view></view></view>
      <!-- Token（订阅体系 v3.2） -->
      <view class="card-v2 anim-card" style="animation-delay:0.3s">
        <view style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx;">
          <text class="section-title-v2" style="margin-bottom:0;">Token</text>
          <view :class="['plan-badge', planBadgeClass]">
            <text v-if="isTrial" class="plan-badge-text">✦ 试用期 · 剩{{ trialDaysLeft }}天</text>
            <text v-else class="plan-badge-text">{{ planBadgeLabel }}</text>
          </view>
        </view>
        <view class="balance-hero-v2">
            <text class="balance-num-v2">{{ totalAvailableDisplay }}</text>
            <text class="balance-unit-v2">Token 可用</text>
          </view>
          <view class="stats-grid-v2" style="margin-top:16rpx;">
            <view class="stat-box-v2">
              <text class="stat-num-v2">{{ monthlyRemainingDisplay }}</text>
              <text class="stat-lbl-v2">本月套餐</text>
            </view>
            <view class="stat-box-v2">
              <text class="stat-num-v2">{{ extraTokens }}</text>
              <text class="stat-lbl-v2">加油包</text>
            </view>
            <view class="stat-box-v2">
              <text class="stat-num-v2">{{ subMonthlyUsed }}/{{ subMonthlyLimit }}</text>
              <text class="stat-lbl-v2">已用/上限</text>
            </view>
            <view class="stat-box-v2">
              <text class="stat-num-v2">{{ referralCount }}</text>
              <text class="stat-lbl-v2">已邀请</text>
            </view>
          </view>
          <view class="voice-row-v2">
            <text class="voice-row-lbl-v2">语音识别</text>
            <text class="voice-row-val-v2">{{ voiceUsageSummary.totalCount }} 次 · 累计 {{ formatSeconds(voiceUsageSummary.totalDurationMs) }}</text>
          </view>
          <view class="btn-row-v2" style="margin-top:14rpx;">
            <button class="btn btn-secondary btn-sm" @click="goSubscriptionPlan">升级套餐</button>
            <button class="btn btn-secondary btn-sm" @click="goRecharge">买加油包</button>
            <button class="btn btn-secondary btn-sm" open-type="share">邀请好友 +{{ referralRewardTokens }}</button>
            <button class="btn btn-ghost btn-sm" @click="goTokenUsage">消费明细</button>
          </view>
      </view>
      <!-- Theme picker -->
      <view class="card-v2"><text class="section-title-v2">界面风格</text><text class="card-text-v2">选择更适合你的视觉氛围。</text><view class="theme-grid-v2"><view v-for="theme in themeOptions" :key="theme.id" :class="['theme-card-v2', currentThemeId === theme.id ? 'active' : '']" @click="chooseTheme(theme.id)"><view class="theme-dot-v2" :style="{ background: theme.vars['--hero-bg'] }"></view><text class="theme-name-v2">{{ theme.name }}</text><text class="theme-desc-v2">{{ theme.description }}</text></view></view></view>
      <!-- Font size -->
      <view class="card-v2"><text class="section-title-v2">字体大小</text><text class="card-text-v2">调整全应用文字显示大小。</text><view class="font-size-row-v2"><view :class="['font-size-option-v2', fontSizeMode === 'default' ? 'active' : '']" @click="setFontSize('default')"><text class="font-size-label-v2">默认</text><text class="font-size-sample-v2" style="font-size: $fs-heading;">Crush Master</text></view><view :class="['font-size-option-v2', fontSizeMode === 'large' ? 'active' : '']" @click="setFontSize('large')"><text class="font-size-label-v2">大字体</text><text class="font-size-sample-v2" style="font-size: $fs-heading;">Crush Master</text></view></view></view>
      <!-- AI analysis style -->
      <view class="card-v2 ai-style-panel-v2"><text class="section-title-v2">AI 分析风格</text><text class="card-text-v2">你在这里选风格，后台提示词会真正跟着变，不是只改文案皮肤。</text><text class="sub-title-v2">陪伴风格</text><view class="chip-grid-v2"><view v-for="item in aiStyleOptions" :key="item.value" :class="['chip-v2', aiStyle === item.value ? 'active' : '']" @click="aiStyle = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view><text class="sub-title-v2">建议力度</text><view class="chip-grid-v2 cols3"><view v-for="item in aiBoldnessOptions" :key="item.value" :class="['chip-v2', aiBoldness === item.value ? 'active' : '']" @click="aiBoldness = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view><view class="ai-status-v2"><text class="sub-title-v2 compact">AI 风格状态</text><text class="card-text-v2">{{ aiStatusSummary }}</text></view><button class="btn btn-primary btn-md btn-full" :disabled="!canSaveAIPersona || aiSaving" @click="saveAIPersona">{{ aiSaving ? '保存中...' : '保存 AI 风格' }}</button></view>
      <view v-if="currentUserIsAdmin" class="card-v2 admin-entry-v2" @click="goAdmin"><text class="section-title-v2">后台管理</text><text class="card-text-v2">进入用户、AI、Token 和反馈管理 →</text></view>
      <view class="card-v2" @click="goSystemTracks"><text class="section-title-v2">系统轨迹</text><text class="card-text-v2">查看系统自动生成的分析和趋势记录 →</text></view>
      <view class="card-v2" @click="goExplain"><text class="section-title-v2">判断说明</text><text class="card-text-v2">查看系统判断标签的含义说明 →</text></view>
      <view class="card-v2" @click="goFeedback"><text class="section-title-v2">系统反馈</text><text class="card-text-v2">告诉我们你的使用体验或建议 →</text></view>
      <view class="card-v2" @click="goReferences"><text class="section-title-v2">引用经典</text><text class="card-text-v2">本小程序引用的古今中外经典文献 →</text></view>
      <view class="card-v2" @click="goAbout"><text class="section-title-v2">关于</text><text class="card-text-v2">v1.0.0 · 查看版本信息 →</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import {
  getCachedSelfProfile,
  getCases,
  checkFeatureAccess,
  getCurrentUserId,
  getSelfProfile,
  getSubscriptionConfig,
  getSubscriptionStatus,
  getTokenUsage,
  getVoiceUsage,
  hasUsableSelfProfile,
  logout,
  updateSelfProfile,
  type AIBoldnessValue,
  type AIStyleValue,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getCurrentThemeId, getFontSizeMode, getThemeStyle, setCurrentTheme, setFontSizeMode, themeOptions, type ThemeId } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'
import { downloadPetAssets, getPetById, getSelectedPetId, isCloudPet, isPetCachedLocally, petOptions, setSelectedPetId } from '@/utils/pets.js'

type PetId = 'xiaomi' | 'doggo'

const userEmail = ref('')
const caseCount = ref(0)
const selfProfileSummary = ref('还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。')
const aiStatusSummary = ref('当前：温柔陪伴 · 平衡。未满 18 岁时会自动切换为谨慎守护 + 保守建议。')
const currentThemeId = ref<ThemeId>(getCurrentThemeId())
const themeVars = ref(getThemeStyle())
const fontSizeMode = ref(getFontSizeMode())
function setFontSize(mode: 'default' | 'large') {
  fontSizeMode.value = mode
  setFontSizeMode(mode)
}
const currentSelfProfile = ref<SelfProfile | null>(getCachedSelfProfile())
const aiStyle = ref<AIStyleValue>('gentle_bestie')
const aiBoldness = ref<AIBoldnessValue>('balanced')
const aiSaving = ref(false)
const tokenUsageLoading = ref(false)
const tokenUsageSummary = ref({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  callCount: 0,
  unavailableCount: 0
})
const voiceUsageSummary = ref({ totalCount: 0, totalDurationMs: 0 })
const voiceUsageLoading = ref(false)
// 次数（订阅体系）
const subPlan = ref('free')
const subPlanName = ref('免费版')
const subIsTrial = ref(false)
const subTrialDaysLeft = ref(0)
const subMonthlyUsed = ref(0)
const subMonthlyLimit = ref(20)
const subExtraTokens = ref(0)
const subInviteCode = ref('')
const subReferralCount = ref(0)
const subReferralRewardTokens = ref(3000)
const currentUserIsAdmin = ref(false)
const canSaveAIPersona = computed(() => hasUsableSelfProfile(currentSelfProfile.value) && !aiSaving.value)

// 次数显示用 computed
const monthlyRemainingDisplay = computed(() => {
  if (subIsTrial.value || subPlan.value === 'ultra' || subMonthlyLimit.value === -1) return '∞'
  return Math.max(0, subMonthlyLimit.value - subMonthlyUsed.value)
})
const extraTokens = computed(() => subExtraTokens.value)
const planName = computed(() => subPlanName.value)
const isTrial = computed(() => subIsTrial.value)
const trialDaysLeft = computed(() => subTrialDaysLeft.value)
const referralCount = computed(() => subReferralCount.value)
const referralRewardTokens = computed(() => subReferralRewardTokens.value)
const totalAvailableDisplay = computed(() => {
  if (subIsTrial.value || subPlan.value === 'ultra' || subMonthlyLimit.value === -1) return '∞'
  return (Math.max(0, subMonthlyLimit.value - subMonthlyUsed.value) + subExtraTokens.value).toLocaleString()
})
const planBadgeLabel = computed(() => {
  if (subPlan.value === 'pro') return 'PRO 会员'
  if (subPlan.value === 'ultra') return 'ULTRA 会员'
  return '免费用户'
})
const planBadgeClass = computed(() => {
  if (subIsTrial.value) return 'badge-trial'
  if (subPlan.value === 'pro') return 'badge-pro'
  if (subPlan.value === 'ultra') return 'badge-ultra'
  return 'badge-free'
})

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())

const aiStyleOptions: Array<{
  value: AIStyleValue
  label: string
  description: string
}> = [
  { value: 'gentle_bestie', label: '温柔陪伴', description: '更像体贴闺蜜，先接住情绪，再给清楚动作。' },
  { value: 'calm_strategist', label: '冷静军师', description: '更看节奏、证据和推进效率，语气克制。' },
  { value: 'playful_flirty', label: '轻痞幽默', description: '更会撩一点，语气活，但不会乱越界。' },
  { value: 'direct_sharp', label: '不绕弯子', description: '直接给结论，适合想听真话。' },
  { value: 'careful_guardian', label: '谨慎守护', description: '更重边界和风险，先稳住，再决定推不推进。' }
]

const aiBoldnessOptions: Array<{
  value: AIBoldnessValue
  label: string
  description: string
}> = [
  { value: 'conservative', label: '保守', description: '优先观察、验证和降误判。' },
  { value: 'balanced', label: '平衡', description: '该推进时推进，该收口时收口。' },
  { value: 'bold', label: '大胆', description: '更敢给动作建议，但高风险场景仍会自动收口。' }
]

const showPetBar = ref(true)
const showPetSheet = ref(false)
const currentPetId = ref<PetId>(getSelectedPetId())
const currentPet = computed(() => getPetById(currentPetId.value))

function setCustomTabBarHidden(hidden: boolean) {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    const tabBar = current?.getTabBar?.()
    tabBar?.setHidden?.(hidden)
  } catch {}
}

watch(showPetSheet, (visible) => {
  setCustomTabBarHidden(visible)
})

onUnmounted(() => {
  setCustomTabBarHidden(false)
})

function onPetBarChange(e: any) {
  const v = Boolean(e.detail.value)
  showPetBar.value = v
  uni.setStorageSync('showPetBar', v)
}

async function choosePet(id: PetId) {
  currentPetId.value = id
  setSelectedPetId(id)
  showPetSheet.value = false
  if (isCloudPet(id) && !isPetCachedLocally(id)) {
    uni.showLoading({ title: '下载宠物资源...' })
    try {
      await downloadPetAssets(id)
      uni.hideLoading()
      uni.showToast({ title: `已切换为 ${getPetById(id).displayName}`, icon: 'none' })
    } catch {
      uni.hideLoading()
      uni.showToast({ title: '下载失败，请重试', icon: 'none' })
    }
  } else {
    uni.showToast({ title: `已切换为 ${getPetById(id).displayName}`, icon: 'none' })
  }
}

const lastDataVersion = ref(0)

onShow(() => {
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
  syncTheme()
  syncAdminState()
  showPetBar.value = uni.getStorageSync('showPetBar') !== false
  currentPetId.value = getSelectedPetId()
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  const changed = !userEmail.value || dv > lastDataVersion.value
  if (changed) loadData()
  if (changed) loadSubscriptionStatus()
  if (changed) loadTokenUsage()
  if (changed) loadVoiceUsage()
  if (changed) lastDataVersion.value = dv
})

function syncTheme() {
  currentThemeId.value = getCurrentThemeId()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
}

function syncAdminState() {
  try {
    const cached = uni.getStorageSync('currentUser')
    const role = String(uni.getStorageSync('userRole') || cached?.role || '').trim()
    currentUserIsAdmin.value = Boolean(uni.getStorageSync('userIsAdmin') || cached?.isAdmin || role === 'admin')
  } catch {
    currentUserIsAdmin.value = false
  }
}

function chooseTheme(themeId: ThemeId) {
  const theme = setCurrentTheme(themeId)
  currentThemeId.value = theme.id
  themeVars.value = getThemeStyle(theme)
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  userEmail.value = uni.getStorageSync('userEmail') || ''
  syncProfileState(getCachedSelfProfile())

  try {
    const [list, result] = await Promise.all([
      getCases(uid, { mode: 'count' }).catch(() => []),
      getSelfProfile().catch(() => null)
    ])
    caseCount.value = (list || []).length
    if (result?.success) syncProfileState(result.selfProfile)
  } catch {
    // ignore
  }

  lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
}

async function loadSubscriptionStatus() {
  try {
    const result = await getSubscriptionStatus()
    if (!result?.success || !result?.subscription) return
    const s = result.subscription
    subPlan.value = s.plan || 'free'
    subPlanName.value = s.planName || '免费版'
    subIsTrial.value = !!s.isTrial
    subTrialDaysLeft.value = s.trialDaysLeft || 0
    subMonthlyUsed.value = s.monthlyTokensUsed || 0
    subMonthlyLimit.value = s.monthlyTokensLimit || 0
    subExtraTokens.value = s.extraTokens || 0
    subInviteCode.value = s.inviteCode || ''
    subReferralCount.value = s.referralCount || 0
  } catch {
    // ignore
  }
  try {
    const cfg = await getSubscriptionConfig()
    if (cfg?.success && cfg?.config?.referral) {
      subReferralRewardTokens.value = cfg.config.referral.inviterRewardTokens || 3000
    }
  } catch { /* ignore */ }
}

async function refreshSubStatus() {
  await Promise.all([loadSubscriptionStatus(), loadTokenUsage(), loadVoiceUsage()])
}

async function loadVoiceUsage() {
  if (voiceUsageLoading.value) return
  voiceUsageLoading.value = true
  try {
    const result = await getVoiceUsage(200)
    if (!result?.success) return
    voiceUsageSummary.value = {
      totalCount: Number(result.totalCount || 0),
      totalDurationMs: Number(result.totalDurationMs || 0)
    }
  } catch {
    // ignore
  } finally {
    voiceUsageLoading.value = false
  }
}
function formatSeconds(ms: number) {
  const seconds = Math.round(Number(ms || 0) / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

async function loadTokenUsage() {
  if (tokenUsageLoading.value) return
  tokenUsageLoading.value = true
  try {
    const result = await getTokenUsage(100)
    if (!result?.success) return
    tokenUsageSummary.value = {
      promptTokens: Number(result.summary?.promptTokens || 0),
      completionTokens: Number(result.summary?.completionTokens || 0),
      totalTokens: Number(result.summary?.totalTokens || 0),
      callCount: Number(result.summary?.callCount || 0),
      unavailableCount: Number(result.summary?.unavailableCount || 0)
    }
  } finally {
    tokenUsageLoading.value = false
  }
}

function syncProfileState(profile: SelfProfile | null | undefined) {
  currentSelfProfile.value = profile && typeof profile === 'object' ? { ...profile } : null
  syncSelfProfileSummary(currentSelfProfile.value)
  syncAIPersonaState(currentSelfProfile.value)
}

function syncSelfProfileSummary(profile: any) {
  if (!profile || typeof profile !== 'object' || !profile.gender || !profile.ageRange || !profile.identity) {
    selfProfileSummary.value = '还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。'
    return
  }

  const genderMap: Record<string, string> = {
    male: '男生',
    female: '女生',
    private: '暂不说明'
  }
  const ageMap: Record<string, string> = {
    under18: '18 岁以下',
    '18_22': '18-22 岁',
    '23_26': '23-26 岁',
    '27_plus': '27 岁以上'
  }
  const identityMap: Record<string, string> = {
    high_school: '高中 / 中专',
    college: '大学生',
    graduate: '研究生',
    worker: '已工作',
    other: '其他'
  }

  const parts = [
    genderMap[profile.gender] || profile.gender,
    ageMap[profile.ageRange] || profile.ageRange,
    identityMap[profile.identity] || profile.identity,
    profile.zodiac ? `属${profile.zodiac}` : '',
    profile.constellation || ''
  ].filter(Boolean)

  selfProfileSummary.value = parts.join(' · ')
}

function syncAIPersonaState(profile: SelfProfile | null | undefined) {
  const style = aiStyleOptions.find((item) => item.value === profile?.aiStyle)?.value || 'gentle_bestie'
  const boldness = aiBoldnessOptions.find((item) => item.value === profile?.aiBoldness)?.value || 'balanced'
  aiStyle.value = style
  aiBoldness.value = boldness

  const styleLabel = aiStyleOptions.find((item) => item.value === style)?.label || '温柔陪伴'
  const boldnessLabel = aiBoldnessOptions.find((item) => item.value === boldness)?.label || '平衡'
  const safetyNote = profile?.ageRange === 'under18'
    ? '未满 18 岁时会自动切换为谨慎守护 + 保守建议。'
    : '遇到明显越界、私密或高风险事件时，系统会自动收口，不会按大胆风格硬推。'
  aiStatusSummary.value = `当前：${styleLabel} · ${boldnessLabel}。${safetyNote}`
}

async function saveAIPersona() {
  if (!canSaveAIPersona.value || !currentSelfProfile.value) return

  aiSaving.value = true
  try {
    const access = await checkFeatureAccess('自定义AI风格')
    if (!access?.success || !access?.allowed) {
      uni.showToast({ title: access?.message || access?.reason || '当前套餐不支持自定义AI风格', icon: 'none' })
      return
    }

    const result = await updateSelfProfile({
      ...currentSelfProfile.value,
      aiStyle: aiStyle.value,
      aiBoldness: aiBoldness.value
    })
    if (!result?.success) {
      uni.showToast({ title: result?.message || '保存失败', icon: 'none' })
      return
    }
    syncProfileState(result.selfProfile)
    uni.showToast({ title: 'AI 风格已保存', icon: 'none' })
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败', icon: 'none' })
  } finally {
    aiSaving.value = false
  }
}

function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

function goTokenUsage() {
  uni.navigateTo({ url: '/pages/token-usage/token-usage' })
}

function goSubscriptionPlan() {
  uni.navigateTo({ url: '/pages/subscription/subscription' })
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
}

function goSystemTracks() {
  uni.navigateTo({ url: '/pages/system-tracks/system-tracks' })
}

function goExplain() {
  uni.navigateTo({ url: '/pages/explain/explain' })
}

function goFeedback() {
  uni.navigateTo({ url: '/pages/feedback/feedback' })
}

function goAdmin() {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

async function goCustomPet() {
  showPetSheet.value = false
  try {
    const access = await checkFeatureAccess('自定义宠物')
    if (access?.allowed === false) {
      uni.showModal({
        title: '功能不可用',
        content: access.reason || '当前套餐不支持自定义宠物功能，请升级套餐。',
        confirmText: '去升级',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) uni.navigateTo({ url: '/pages/subscription/subscription' })
        }
      })
      return
    }
  } catch (_) { /* ignore */ }
  uni.navigateTo({ url: '/pages/custom-pet/custom-pet' })
}

function goReferences() {
  uni.navigateTo({ url: '/pages/references/references' })
}

function goAbout() {
  uni.navigateTo({ url: '/pages/about/about' })
}

async function onLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: #666; line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .card-text-v2.muted { color: #999; font-size: $fs-caption; }
.v2-mode .balance-hero-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 4rpx 4rpx 0 #111; padding: 20rpx 24rpx; margin-bottom: 12rpx; display: flex; align-items: baseline; gap: 10rpx; }
.v2-mode .balance-num-v2 { font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; letter-spacing: -2rpx; }
.v2-mode .balance-unit-v2 { font-size: $fs-body; font-weight: $fw-hero; color: rgba(0,0,0,0.6); }

/* 套餐身份标签 */
.plan-badge { padding: 8rpx 20rpx; border: 2rpx solid #111; font-size: $fs-body; font-weight: $fw-hero; letter-spacing: 2rpx; }
.plan-badge.badge-trial { background: #4ECDC4; color: #fff; }
.plan-badge.badge-pro { background: #111; color: #FFD93D; }
.plan-badge.badge-ultra { background: #111; color: #FFD93D; }
.plan-badge.badge-free { background: #eee; color: #999; border-color: #ccc; }
.plan-badge-text { }
.v2-mode .balance-sub-row-v2 { margin-bottom: 4rpx; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .switch-row-v2 { display: flex; align-items: center; gap: 24rpx; padding: 12rpx 0; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx 8rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: $fs-caption; font-weight: $fw-label; color: #666; margin-top: 4rpx; }

.v2-mode .voice-row-v2 { display: flex; align-items: center; justify-content: space-between; margin-top: 12rpx; padding: 12rpx 16rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .voice-row-lbl-v2 { font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .voice-row-val-v2 { font-size: $fs-body; font-weight: $fw-label; color: #111; }

.v2-mode .theme-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .theme-card-v2 { padding: 14rpx 10rpx; border: 2rpx solid #111; background: #fff; text-align: center; }
.v2-mode .theme-card-v2.active { background: #111; }
.v2-mode .theme-dot-v2 { width: 32rpx; height: 32rpx; border-radius: 50%; border: 2rpx solid #111; margin: 0 auto 6rpx; }
.v2-mode .theme-card-v2.active .theme-dot-v2 { border-color: #FFD93D; }
.v2-mode .theme-name-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: #111; }
.v2-mode .theme-card-v2.active .theme-name-v2 { color: #FFD93D; }
.v2-mode .theme-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; margin-top: 4rpx; line-height: 1.3; }
.v2-mode .theme-card-v2.active .theme-desc-v2 { color: rgba(255,255,255,0.6); }

/* Font size picker */
.v2-mode .font-size-row-v2 { display: flex; gap: 14rpx; }
.v2-mode .font-size-option-v2 { flex: 1; padding: 20rpx; border: 2rpx solid #111; background: #fff; text-align: center; cursor: pointer; }
.v2-mode .font-size-option-v2.active { background: #111; }
.v2-mode .font-size-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: #111; margin-bottom: 10rpx; }
.v2-mode .font-size-option-v2.active .font-size-label-v2 { color: #FFD93D; }
.v2-mode .font-size-sample-v2 { display: block; font-weight: $fw-hero; color: #111; }
.v2-mode .font-size-option-v2.active .font-size-sample-v2 { color: #FFD93D; }

/* pet row layout: avatar + info + button */
.v2-mode .pet-row-v2 { display: flex; align-items: center; gap: 24rpx; margin-top: 14rpx; }
.v2-mode .pet-avatar-img-v2 { width: 140rpx; height: 140rpx; flex-shrink: 0; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .pet-row-info-v2 { flex: 1; min-width: 0; }
.v2-mode .pet-row-name-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.v2-mode .pet-row-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; line-height: 1.4; margin-top: 6rpx; }

/* bottom sheet */
.v2-mode .sheet-mask { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.v2-mode .sheet-panel { width: 100%; max-width: 500px; max-height: 75vh; background: #FFFDF5; border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 24rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; }
.v2-mode .sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; flex-shrink: 0; }
.v2-mode .sheet-title { font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.v2-mode .sheet-close { font-size: $fs-kpi; font-weight: $fw-hero; color: #111; padding: 0 8rpx; line-height: 1; }

/* pet sheet grid */
.v2-mode .pet-sheet-scroll-v2 { flex: 1; overflow-y: auto; }
.v2-mode .pet-sheet-grid-inner-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; padding-right: 4rpx; }
.v2-mode .pet-option-v2 { display: flex; align-items: center; gap: 14rpx; padding: 16rpx; border: 2rpx solid #111; background: #fff; position: relative; }
.v2-mode .pet-option-v2.active { background: #111; }
.v2-mode .pet-option-img-v2 { width: 80rpx; height: 80rpx; flex-shrink: 0; }
.v2-mode .pet-option-text-v2 { flex: 1; min-width: 0; }
.v2-mode .pet-option-name-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: #111; }
.v2-mode .pet-option-v2.active .pet-option-name-v2 { color: #FFD93D; }
.v2-mode .pet-option-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; line-height: 1.3; margin-top: 4rpx; }
.v2-mode .pet-option-v2.active .pet-option-desc-v2 { color: rgba(255,255,255,0.6); }
.v2-mode .pet-option-check-v2 { position: absolute; top: 8rpx; right: 10rpx; font-size: $fs-body; font-weight: $fw-hero; color: #FFD93D; }
.v2-mode .pet-option-name-row-v2 { display: flex; align-items: center; gap: 8rpx; }
.v2-mode .pet-option-badge-v2 { display: inline-block; padding: 2rpx 10rpx; font-size: $fs-caption; font-weight: $fw-hero; color: #4ECDC4; border: 1rpx solid #4ECDC4; }
.v2-mode .pet-option-badge-v2.download { color: #FF6B6B; border-color: #FF6B6B; }
.v2-mode .pet-option-v2.active .pet-option-badge-v2 { color: #FFD93D; border-color: #FFD93D; }

/* pet sheet footer */
.v2-mode .pet-sheet-footer-v2 { flex-shrink: 0; margin-top: 20rpx; padding-top: 10rpx; }
.v2-mode .pet-sheet-divider-v2 { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; }
.v2-mode .pet-sheet-divider-v2::before,
.v2-mode .pet-sheet-divider-v2::after { content: ''; flex: 1; height: 2rpx; background: #111; }
.v2-mode .pet-sheet-divider-text-v2 { font-size: $fs-caption; font-weight: $fw-hero; color: #111; text-transform: uppercase; letter-spacing: 2rpx; white-space: nowrap; }
.v2-mode .pet-custom-entry-v2 { display: flex; align-items: center; gap: 12rpx; padding: 20rpx; border: 2rpx dashed #111; background: #fcfcfc; }
.v2-mode .pet-custom-icon-v2 { font-size: $fs-heading; }
.v2-mode .pet-custom-text-v2 { flex: 1; font-size: $fs-body-lg; font-weight: $fw-label; color: #666; }
.v2-mode .pet-custom-arrow-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: #111; }

.v2-mode .chip-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .chip-grid-v2.cols3 { grid-template-columns: repeat(3, 1fr); }
.v2-mode .chip-v2 { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .chip-v2.active { background: #111; }
.v2-mode .chip-label-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .chip-v2.active .chip-label-v2 { color: #FFD93D; }
.v2-mode .chip-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; margin-top: 4rpx; line-height: 1.4; }
.v2-mode .chip-v2.active .chip-desc-v2 { color: rgba(255,255,255,0.6); }
.v2-mode .ai-style-panel-v2 { display: flex; flex-direction: column; gap: 12rpx; }
.v2-mode .sub-title-v2 { display: block; padding: 8rpx 12rpx; border: 2rpx solid #111; background: #f9f9f9; color: #666; font-size: $fs-caption; font-weight: $fw-hero; }
.v2-mode .sub-title-v2.compact { margin-bottom: 8rpx; }
.v2-mode .ai-status-v2 { padding-top: 4rpx; }
.v2-mode .explain-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 18rpx; }
.v2-mode .explain-title-v2 { font-size: $fs-body-lg; font-weight: $fw-hero; color: #111; }
.v2-mode .explain-arrow-v2 { padding: 4rpx 14rpx; border: 2rpx solid #111; background: #fff; font-size: $fs-caption; font-weight: $fw-hero; color: #111; }
.v2-mode .explain-body-v2 { padding: 0 18rpx 18rpx; border-top: 2rpx solid #111; }
.v2-mode .explain-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed #111; }
.v2-mode .explain-item-v2:last-child { border-bottom: none; }
.v2-mode .explain-item-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .explain-item-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; margin-top: 2rpx; line-height: 1.4; }
</style>
