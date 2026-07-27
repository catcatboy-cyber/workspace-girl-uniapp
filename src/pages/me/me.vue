<template>
  <view :class="['page v2-mode anim-ready', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <!-- Hero + 本人画像 -->
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">PROFILE</text>
        <text class="hero-title-v2"><text class="hl-v2">我的</text>主页</text>
        <text class="hero-copy-v2">管理画像、Crush Credits 和偏好设置。</text>
        <hr class="hero-divider">
        <view class="hero-bottom">
          <view class="hero-avatar-lg hero-self-avatar">
            <image v-if="currentSelfProfile?.avatarUrl"
              :src="currentSelfProfile.avatarUrl" mode="aspectFill"
              style="width:100%;height:100%;border-radius:50%;" />
            <text v-else>我</text>
          </view>
          <view class="hero-info-col">
            <view class="hero-main-row">
              <view class="hero-main-left">
                <text class="hero-name-v2">{{ currentSelfProfile?.nickname || (hasProfile ? '个人画像' : '画像未完善') }}</text>
                <text :class="['hero-chip', hasProfile ? 'primary' : 'muted']">{{ hasProfile ? '已同步' : '待补充' }}</text>
              </view>
              <view class="hero-action-pill" @click.stop="goSelfProfile">编辑</view>
            </view>
            <view class="hero-meta-row">
              <text v-for="item in heroProfileTags" :key="item" class="hero-chip">{{ item }}</text>
            </view>
          </view>
        </view>
      </view>
      <!-- Credits -->
      <view class="card-v2 anim-card" style="animation-delay:0.15s">
        <view style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx;">
          <text class="section-title-v2" style="margin-bottom:0;">Crush Credits</text>
          <view :class="['plan-badge', planBadgeClass]">
            <text v-if="isTrial" class="plan-badge-text">✦ 试用期 · 剩{{ trialDaysLeft }}天</text>
            <text v-else class="plan-badge-text">{{ planBadgeLabel }}</text>
          </view>
        </view>
        <view class="balance-hero-v2">
            <text class="balance-num-v2">{{ totalAvailableDisplay }}</text>
            <text class="balance-unit-v2">Crush Credits 可用</text>
          </view>
          <view class="stats-grid-v2" style="margin-top:16rpx;">
            <view class="stat-box-v2">
              <text class="stat-num-sub-v2">{{ monthlyRemainingDisplay }}</text>
              <text class="stat-lbl-v2">月卡配额</text>
            </view>
            <view class="stat-box-v2">
              <text class="stat-num-sub-v2">{{ extraTokens }}</text>
              <text class="stat-lbl-v2">加油包</text>
            </view>
            <view class="stat-box-v2">
              <text class="stat-num-sub-v2">{{ subMonthlyUsed }}/{{ totalLimit }}</text>
              <text class="stat-lbl-v2">月已用/月限额</text>
            </view>
          </view>
          <view class="account-meta-row">
            <text class="account-meta-item">{{ caseCount }} Crushes</text>
            <text class="account-meta-item">已邀请 {{ referralCount }} 人</text>
          </view>
          <view class="account-meta-row">
            <text class="account-meta-item">语音 {{ voiceUsageSummary.totalCount }} 次 · {{ formatSeconds(voiceUsageSummary.totalDurationMs) }}</text>
          </view>
          <view class="btn-row-v2" style="margin-top:14rpx;">
            <button class="btn btn-secondary btn-sm" @click="goSubscriptionPlan">{{ subPlanButtonLabel }}</button>
            <button class="btn btn-secondary btn-sm" @click="goRecharge">买加油包</button>
            <button class="btn btn-secondary btn-sm" @click="goTokenUsage">消费明细</button>
          </view>
      </view>
      <!-- 邀请到账通知 -->
      <view v-if="showReferralNotice" class="referral-notice" style="margin-bottom:8rpx;" @click="dismissReferralNotice">
        <text class="referral-notice-text">🎉 邀请成功！已获得 +{{ referralNoticeAmount }} Crush Credits →</text>
      </view>
      <!-- 受邀奖励通知 -->
      <view v-if="showInviteeNotice" class="referral-notice" @click="dismissInviteeNotice">
        <text class="referral-notice-text">🎉 受邀奖励！已获得 +{{ inviteeNoticeAmount }} Crush Credits →</text>
      </view>
      <!-- 陪伴宠物 -->
      <view class="card-v2 anim-card" style="animation-delay:0.25s">
        <text class="section-title-v2">陪伴宠物</text>
        <view class="pet-row-v2"><image :src="currentPet.avatarPath" class="pet-avatar-img-v2" mode="aspectFit" @click="showPetSheet = true" /><view class="pet-row-info-v2"><text class="pet-row-name-v2">{{ currentPet.displayName }}</text><text class="pet-row-desc-v2">{{ currentPet.description }}</text><button class="btn btn-secondary btn-sm" style="margin-top:10rpx" @click="showPetSheet = true">换只宠物</button></view></view>
        <view class="switch-row-v2" style="margin-top:16rpx;">
          <text class="card-text-v2" style="flex:1">显示陪伴宠物</text>
          <switch :checked="showPetBar" :color="switchColor" @change="onPetBarChange" />
        </view>
      </view>
      <!-- Pet select sheet -->
      <view v-if="showPetSheet" class="sheet-mask" @click="showPetSheet = false"><view class="sheet-panel" @click.stop><view class="sheet-head"><text class="sheet-title">选择陪伴宠物</text><text class="sheet-close" @click="showPetSheet = false">&times;</text></view><scroll-view scroll-y class="pet-sheet-scroll-v2"><view class="pet-sheet-grid-inner-v2"><view v-for="pet in petOptions" :key="pet.id" :class="['pet-option-v2', currentPetId === pet.id ? 'active' : '']" @click="choosePet(pet.id)"><image :src="pet.avatarPath" class="pet-option-img-v2" mode="aspectFit" /><view class="pet-option-text-v2"><view class="pet-option-name-row-v2"><text class="pet-option-name-v2">{{ pet.displayName }}</text><text v-if="isCloudPet(pet.id) && isPetCachedLocally(pet.id)" class="pet-option-badge-v2">已下载</text><text v-else-if="isCloudPet(pet.id)" class="pet-option-badge-v2 download">下载</text></view><text class="pet-option-desc-v2">{{ pet.description }}</text></view><text v-if="currentPetId === pet.id" class="pet-option-check-v2">&#10003;</text></view></view></scroll-view><view class="pet-sheet-footer-v2"><view class="pet-sheet-divider-v2"><text class="pet-sheet-divider-text-v2">定制专属宠物</text></view><view class="pet-custom-entry-v2" @click="goCustomPet"><text class="pet-custom-icon-v2">&#9998;</text><text class="pet-custom-text-v2">描述你心中的专属宠物形象</text><text class="pet-custom-arrow-v2">&rarr;</text></view></view></view></view>
      <!-- 低 Token 提示 -->
      <view v-if="showLowTokenNudge" class="card-v2 anim-card" style="animation-delay:0.32s;background:var(--brand-warm,#FFFBEB);border-style:dashed;">
        <view open-type="share" style="width:100%;">
          <text class="section-title-v2" style="color:var(--warning,#e67e22);">Crush Credits 快不够了</text>
          <text class="card-text-v2">邀请好友注册，双方各得 Crush Credits →</text>
          <button class="btn btn-secondary btn-sm" open-type="share" style="margin-top:12rpx;">+{{ referralRewardTokens }}</button>
        </view>
      </view>
      <!-- Theme picker -->
      <view class="card-v2 theme-picker-v2">
        <text class="section-title-v2">界面风格</text>
        <text class="card-text-v2">按风格系列选择具体氛围。</text>
        <view class="theme-family-list-v2">
          <view v-for="group in themeGroups" :key="group.title" class="theme-family-v2">
            <view class="theme-family-head-v2">
              <text class="theme-family-title-v2">{{ group.title }}</text>
              <text class="theme-family-desc-v2">{{ group.description }}</text>
            </view>
            <view class="theme-grid-v2">
              <view
                v-for="themeId in group.ids"
                :key="themeId"
                :class="['theme-card-v2', currentThemeId === themeId ? 'active' : '']"
                @click="chooseTheme(themeId)"
              >
                <view class="theme-swatch-v2" :style="themePreviewStyle(themeId)"></view>
                <text class="theme-name-v2">{{ themeOption(themeId)?.name }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <!-- Font size -->
      <view class="card-v2"><text class="section-title-v2">字体大小</text><text class="card-text-v2">调整全应用文字显示大小。</text><view class="font-size-row-v2"><view :class="['font-size-option-v2', fontSizeMode === 'default' ? 'active' : '']" @click="setFontSize('default')"><text class="font-size-label-v2">默认</text></view><view :class="['font-size-option-v2', fontSizeMode === 'large' ? 'active' : '']" @click="setFontSize('large')"><text class="font-size-label-v2">大字体</text></view></view></view>
      <!-- AI analysis style -->
      <view class="card-v2 ai-style-panel-v2"><text class="section-title-v2">{{ aiLabel() }} 分析风格</text><text class="card-text-v2">你在这里选风格，后台提示词会真正跟着变，不是只改文案皮肤。</text><view class="chip-grid-v2"><view v-for="item in aiStyleOptions" :key="item.value" :class="['chip-v2', aiStyle === item.value ? 'active' : '', aiSaving ? 'disabled' : '']" @click="chooseAIStyle(item.value)"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view><text class="sub-title-v2">建议力度</text><view class="chip-grid-v2 cols3"><view v-for="item in aiBoldnessOptions" :key="item.value" :class="['chip-v2', aiBoldness === item.value ? 'active' : '', aiSaving ? 'disabled' : '']" @click="chooseAIBoldness(item.value)"><text class="chip-label-v2">{{ item.label }}</text></view></view></view>
      <!-- #ifdef H5 -->
      <view v-if="currentUserIsAdmin" class="card-v2 admin-entry-v2" @click="goAdmin"><text class="section-title-v2">后台管理</text><text class="card-text-v2">进入用户、{{ aiLabel() }}、Crush Credits 和反馈管理 →</text></view>
      <!-- #endif -->
      <view class="card-v2">
        <text class="section-title-v2">系统说明</text>
        <view class="info-link-v2" @click="goExplain"><text class="info-link-label-v2">判断说明</text><text class="info-link-desc-v2">系统判断标签的含义</text><text class="info-link-arrow-v2">→</text></view>
        <view class="info-link-v2" @click="goFeedback"><text class="info-link-label-v2">系统反馈</text><text class="info-link-desc-v2">使用体验或建议</text><text class="info-link-arrow-v2">→</text></view>
        <view class="info-link-v2" @click="goReferences"><text class="info-link-label-v2">引用经典</text><text class="info-link-desc-v2">古今中外经典文献</text><text class="info-link-arrow-v2">→</text></view>
        <view class="info-link-v2" @click="goAbout"><text class="info-link-label-v2">关于</text><text class="info-link-desc-v2">v1.0.0 · 版本信息</text><text class="info-link-arrow-v2">→</text></view>
      </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
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
  updateSelfProfile,
  type AIBoldnessValue,
  type AIStyleValue,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getCurrentThemeId, getFontSizeMode, getThemeStyle, setCurrentTheme, setFontSizeMode, themeOptions, type ThemeId } from '@/utils/theme'
import { buildSafeTimelineShare, appendReferralParams, SAFE_SHARE_IMAGE } from '@/utils/share'
import { downloadPetAssets, getPetById, getSelectedPetId, isCloudPet, isPetCachedLocally, petOptions, setSelectedPetId } from '@/utils/pets.js'
import { aiLabel } from '@/utils/labels'

type PetId = 'xiaomi' | 'doggo'

const userEmail = ref('')
const caseCount = ref(0)
const selfProfileSummary = ref('还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。')
const currentThemeId = ref<ThemeId>(getCurrentThemeId())
const themeVars = ref(getThemeStyle())
const fontSizeMode = ref(getFontSizeMode())
function setFontSize(mode: 'default' | 'large') {
  fontSizeMode.value = mode
  setFontSizeMode(mode)
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  tabBar?.syncFontSizeMode?.()
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
const subPlanExpiresAt = ref('')
const subMonthlyUsed = ref(0)
const subMonthlyLimit = ref(20)
const subExtraTokens = ref(0)
const subInviteCode = ref('')
const subReferralCount = ref(0)
const subReferralRewardTokens = ref(3000)
const currentUserIsAdmin = ref(false)
const hasProfile = computed(() => hasUsableSelfProfile(currentSelfProfile.value))
const heroProfileTags = computed(() => {
  if (!hasProfile.value) return ['完善后分析更贴合你']
  return selfProfileSummary.value.split(' · ').filter(Boolean).slice(0, 5)
})
const themeGroups: Array<{
  title: string
  description: string
  ids: ThemeId[]
}> = [
  {
    title: '青春硬边',
    description: '明亮活泼，卡片感更强',
    ids: ['campus-pop', 'sea-salt-lemon', 'peach-oolong']
  },
  {
    title: '丝绒日记',
    description: '柔和细腻，纸张日记感',
    ids: ['velvet-diary', 'rose-letter', 'seafoam-note']
  }
]
function themeOption(themeId: ThemeId) {
  return themeOptions.find((theme) => theme.id === themeId)
}

function themePreviewStyle(themeId: ThemeId) {
  const theme = themeOption(themeId)
  return {
    background: `linear-gradient(135deg, ${theme?.vars['--hero-bg'] || '#FF6B6B'} 0%, ${theme?.vars['--hero-bg-2'] || '#FFD93D'} 100%)`
  }
}

// 次数显示用 computed
const monthlyRemainingDisplay = computed(() => {
  if (subMonthlyLimit.value === -1) return '∞'
  return Math.max(0, subMonthlyLimit.value - subMonthlyUsed.value)
})
const extraTokens = computed(() => subExtraTokens.value)
const showLowTokenNudge = computed(() => {
  if (subIsTrial.value || subPlan.value === 'ultra' || subMonthlyLimit.value === -1) return false
  const remaining = Math.max(0, subMonthlyLimit.value - subMonthlyUsed.value) + subExtraTokens.value
  return remaining < (subReferralRewardTokens.value || 3000) * 2
})
const showReferralNotice = ref(false)
const referralNoticeAmount = ref(0)
function dismissReferralNotice() {
  showReferralNotice.value = false
  goTokenUsage()
}
const showInviteeNotice = ref(uni.getStorageSync('showInviteeNotice') || false)
const inviteeNoticeAmount = ref(Number(uni.getStorageSync('inviteeNoticeAmount') || 0))
function dismissInviteeNotice() {
  showInviteeNotice.value = false
  uni.removeStorageSync('showInviteeNotice')
  goTokenUsage()
}
const totalLimit = computed(() => {
  if (subMonthlyLimit.value === -1) return '∞'
  return subMonthlyLimit.value.toLocaleString()
})
const planName = computed(() => subPlanName.value)
const isTrial = computed(() => subIsTrial.value)
const trialDaysLeft = computed(() => subTrialDaysLeft.value)
const referralCount = computed(() => subReferralCount.value)
const referralRewardTokens = computed(() => subReferralRewardTokens.value)
const totalAvailableDisplay = computed(() => {
  if (subMonthlyLimit.value === -1) return '∞'
  return (Math.max(0, subMonthlyLimit.value - subMonthlyUsed.value) + subExtraTokens.value).toLocaleString()
})
const planExpiresText = computed(() => {
  if (!subPlanExpiresAt.value) return ''
  const d = new Date(subPlanExpiresAt.value)
  if (isNaN(d.getTime())) return ''
  return ` · 到期 ${d.getMonth() + 1}月${d.getDate()}日`
})
const planBadgeLabel = computed(() => {
  if (subPlan.value === 'pro') return 'Pro 月卡' + planExpiresText.value
  if (subPlan.value === 'ultra') return 'Ultra 月卡' + planExpiresText.value
  return '免费版'
})
const subPlanButtonLabel = computed(() => {
  if (subPlan.value === 'pro' || subPlan.value === 'ultra') return '购买套餐'
  return '买月卡'
})
const planBadgeClass = computed(() => {
  if (subIsTrial.value) return 'badge-trial'
  if (subPlan.value === 'pro') return 'badge-pro'
  if (subPlan.value === 'ultra') return 'badge-ultra'
  return 'badge-free'
})

onShareAppMessage(() => ({ title: 'Crush Master｜读懂关系信号', path: appendReferralParams('/pages/index/index', 'invite'), imageUrl: SAFE_SHARE_IMAGE }))

onShareTimeline(() => buildSafeTimelineShare({
  query: subInviteCode.value ? `inviteCode=${subInviteCode.value}` : ''
}))

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

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
}> = [
  { value: 'conservative', label: '保守' },
  { value: 'balanced', label: '平衡' },
  { value: 'bold', label: '大胆' }
]

const showPetBar = ref(true)
const showPetSheet = ref(false)
const currentPetId = ref<PetId>(getSelectedPetId())
const currentPet = computed(() => getPetById(currentPetId.value))
const switchColor = computed(() => String(themeVars.value['--text-main'] || themeVars.value['--border'] || ''))

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

async function canSwitchPet(id: PetId, showPrompt = true) {
  if (id === 'xiaomi') return true
  try {
    const access = await checkFeatureAccess('更换宠物')
    if (access?.allowed === false) {
      if (showPrompt) {
        uni.showModal({
          title: '功能不可用',
          content: access.reason || '当前套餐不支持更换宠物，请购买月卡。',
          confirmText: '去看看',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) uni.navigateTo({ url: '/pages/subscription/subscription' })
          }
        })
      }
      return false
    }
  } catch (_) {
    if (showPrompt) uni.showToast({ title: '权限校验失败，请稍后再试', icon: 'none' })
    return false
  }
  return true
}

async function ensureSelectedPetAllowed() {
  const selected = getSelectedPetId()
  if (selected === 'xiaomi') {
    currentPetId.value = selected
    return
  }
  const allowed = await canSwitchPet(selected, false)
  if (!allowed) {
    setSelectedPetId('xiaomi')
    currentPetId.value = 'xiaomi'
    return
  }
  currentPetId.value = selected
}

async function choosePet(id: PetId) {
  const allowed = await canSwitchPet(id)
  if (!allowed) return
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
  void ensureSelectedPetAllowed()
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
  applyThemeChrome(theme)
  try {
    const tabBar = getCurrentPages().pop()?.getTabBar?.()
    tabBar?.syncTheme?.()
    tabBar?.updateSelected?.()
  } catch {}
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) return

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
    subPlanExpiresAt.value = s.planExpiresAt || ''
    subMonthlyUsed.value = s.monthlyTokensUsed || 0
    subMonthlyLimit.value = s.monthlyTokensLimit || 0
    subExtraTokens.value = s.extraTokens || 0
    subInviteCode.value = s.inviteCode || ''
    subReferralCount.value = s.referralCount || 0
  } catch {
    // ignore
  }
  // 先加载奖励配置，确保通知用到的额度正确
  try {
    const cfg = await getSubscriptionConfig()
    if (cfg?.success && cfg?.config?.referral) {
      subReferralRewardTokens.value = cfg.config.referral.inviterRewardTokens || 3000
    }
  } catch { /* ignore */ }
  // 检测新邀请，计算获赠数量
  const lastCount = Number(uni.getStorageSync('lastReferralCount') || 0)
  if (subReferralCount.value > lastCount) {
    const newCount = subReferralCount.value - lastCount
    referralNoticeAmount.value = newCount * subReferralRewardTokens.value
    showReferralNotice.value = true
    uni.setStorageSync('lastReferralCount', subReferralCount.value)
    // 同步到 storage，供"今日"页也显示
    uni.setStorageSync('referralNoticeAmount', referralNoticeAmount.value)
    uni.setStorageSync('showReferralNotice', true)
  }
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
    student: '学生',
    worker: '已工作',
    other: '其他'
  }

  const parts = [
    genderMap[profile.gender] || profile.gender,
    ageMap[profile.ageRange] || profile.ageRange,
    identityMap[profile.identity] || profile.identity,
    profile.zodiac ? `属${profile.zodiac}` : '',
    profile.constellation || '',
    profile.mbtiCode ? `MBTI ${profile.mbtiCode}` : ''
  ].filter(Boolean)

  selfProfileSummary.value = parts.join(' · ')
}

function syncAIPersonaState(profile: SelfProfile | null | undefined) {
  const style = aiStyleOptions.find((item) => item.value === profile?.aiStyle)?.value || 'gentle_bestie'
  const boldness = aiBoldnessOptions.find((item) => item.value === profile?.aiBoldness)?.value || 'balanced'
  aiStyle.value = style
  aiBoldness.value = boldness
}

async function chooseAIStyle(value: AIStyleValue) {
  await selectAIPersona({ style: value })
}

async function chooseAIBoldness(value: AIBoldnessValue) {
  await selectAIPersona({ boldness: value })
}

async function selectAIPersona(next: { style?: AIStyleValue; boldness?: AIBoldnessValue }) {
  if (aiSaving.value) return

  const previousStyle = aiStyle.value
  const previousBoldness = aiBoldness.value
  const nextStyle = next.style || previousStyle
  const nextBoldness = next.boldness || previousBoldness
  if (nextStyle === previousStyle && nextBoldness === previousBoldness) return

  aiStyle.value = nextStyle
  aiBoldness.value = nextBoldness

  const saved = await saveAIPersona()
  if (!saved) {
    aiStyle.value = previousStyle
    aiBoldness.value = previousBoldness
  }
}

async function saveAIPersona(): Promise<boolean> {
  if (!currentSelfProfile.value || !hasProfile.value) {
    uni.showToast({ title: '请先完善个人画像', icon: 'none' })
    return false
  }
  if (aiSaving.value) return false

  aiSaving.value = true
  try {
    const access = await checkFeatureAccess('自定义AI风格')
    if (!access?.success || !access?.allowed) {
      uni.showToast({ title: access?.message || access?.reason || '当前套餐不支持自定义AI风格', icon: 'none' })
      return false
    }

    const result = await updateSelfProfile({
      ...currentSelfProfile.value,
      aiStyle: aiStyle.value,
      aiBoldness: aiBoldness.value
    })
    if (!result?.success) {
      uni.showToast({ title: result?.message || '保存失败', icon: 'none' })
      return false
    }
    syncProfileState(result.selfProfile)
    uni.showToast({ title: '已自动保存', icon: 'none' })
    return true
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败', icon: 'none' })
    return false
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

function goExplain() {
  uni.navigateTo({ url: '/pages/explain/explain' })
}

function goFeedback() {
  uni.navigateTo({ url: '/pages/feedback/feedback' })
}

function goAdmin() {
  // #ifdef H5
  uni.navigateTo({ url: '/pages/admin/admin' })
  // #endif
}

async function goCustomPet() {
  showPetSheet.value = false
  try {
    const access = await checkFeatureAccess('自定义宠物')
    if (access?.allowed === false) {
      uni.showModal({
        title: '功能不可用',
        content: access.reason || '当前月卡不支持自定义宠物功能，请购买月卡。',
        confirmText: '去看看',
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
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; min-height: 100vh; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--text-main, #111); line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }
.v2-mode .hero-self-avatar { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); font-size: 34rpx; letter-spacing: 0; }
.v2-mode .hero-profile-inline { margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid var(--hero-divider, rgba(0,0,0,0.12)); display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.v2-mode .hero-profile-text { font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; flex: 1; min-width: 0; }
.v2-mode .hero-profile-link { font-size: $fs-caption; font-weight: $fw-heading; color: var(--accent, #FFD93D); white-space: nowrap; flex-shrink: 0; }

.v2-mode .card-v2 { @include card-v2; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .card-text-v2.muted { color: var(--text-soft, #999); font-size: $fs-caption; }

/* 系统说明链接行 */
.v2-mode .info-link-v2 { display: flex; align-items: center; padding: 14rpx 0; border-bottom: 2rpx dashed var(--divider, #ddd); gap: 12rpx; }
.v2-mode .info-link-v2:last-child { border-bottom: none; }
.v2-mode .info-link-label-v2 { font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); flex-shrink: 0; }
.v2-mode .info-link-desc-v2 { font-size: $fs-body; font-weight: $fw-body; color: var(--text-soft, #999); flex: 1; min-width: 0; }
.v2-mode .info-link-arrow-v2 { font-size: $fs-body; font-weight: $fw-body; color: var(--divider, #ccc); flex-shrink: 0; }
.v2-mode .balance-hero-v2 { background: var(--hero-bg, #FF6B6B); border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); padding: 20rpx 24rpx; margin-bottom: 12rpx; display: flex; align-items: baseline; gap: 10rpx; }
.v2-mode .balance-num-v2 { min-width: 0; font-size: $fs-kpi; font-weight: $fw-heading; color: var(--text-main, #111); letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v2-mode .balance-unit-v2 { flex-shrink: 0; font-size: $fs-body; font-weight: $fw-label; color: var(--text-muted, rgba(0,0,0,0.6)); }

/* 套餐身份标签 */
.plan-badge { padding: 8rpx 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); font-size: $fs-body; font-weight: $fw-hero; letter-spacing: 2rpx; }
.plan-badge.badge-trial { background: var(--accent-cool, #4ECDC4); color: var(--surface, #fff); }
.plan-badge.badge-pro { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.plan-badge.badge-ultra { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.plan-badge.badge-free { background: var(--divider, #eee); color: var(--text-soft, #999); border-color: var(--divider, #ccc); }
.plan-badge-text { }
.v2-mode .balance-sub-row-v2 { margin-bottom: 4rpx; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .switch-row-v2 { display: flex; align-items: center; gap: 24rpx; padding: 12rpx 0; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 14rpx 16rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface-dim, #f9f9f9); display: flex; flex-direction: column; align-items: center; }
.v2-mode .stat-num-v2 { font-size: $fs-body-lg; font-weight: $fw-heading; color: var(--text-main, #111); line-height: 1; white-space: nowrap; }
.v2-mode .stat-num-sub-v2 { font-size: 28rpx; font-weight: $fw-label; }
.v2-mode .stat-lbl-v2 { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); margin-top: 2rpx; }

.v2-mode .account-meta-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10rpx; padding: 6rpx 0; }
.v2-mode .account-meta-row + .account-meta-row { margin-top: 0; padding-top: 0; }
.v2-mode .account-meta-item { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); }

.v2-mode .theme-picker-v2 { display: flex; flex-direction: column; gap: 12rpx; }
.v2-mode .theme-family-list-v2 { display: flex; flex-direction: column; gap: 14rpx; margin-top: 2rpx; }
.v2-mode .theme-family-v2 { padding: 14rpx; border: var(--border-width, 2rpx) solid var(--divider-strong, var(--border, #111)); border-radius: var(--shape-radius-card, 0); background: var(--surface-soft, var(--surface, #fff)); }
.v2-mode .theme-family-head-v2 { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; margin-bottom: 12rpx; }
.v2-mode .theme-family-title-v2 { flex-shrink: 0; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .theme-family-desc-v2 { min-width: 0; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #666); text-align: right; line-height: 1.35; }
.v2-mode .theme-grid-v2 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10rpx; }
.v2-mode .theme-card-v2 { position: relative; min-height: 116rpx; padding: 12rpx 8rpx 10rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); text-align: center; box-sizing: border-box; overflow: hidden; }
.v2-mode .theme-card-v2.active { background: var(--text-main, #111); border-color: var(--text-main, #111); }
.v2-mode .theme-swatch-v2 { height: 38rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); margin-bottom: 10rpx; position: relative; }
.v2-mode .theme-card-v2.active .theme-swatch-v2 { border-color: var(--accent, #FFD93D); }
.v2-mode .theme-name-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1.2; white-space: nowrap; }
.v2-mode .theme-card-v2.active .theme-name-v2 { color: var(--accent, #FFD93D); }

/* Font size picker */
.v2-mode .font-size-row-v2 { display: flex; gap: 14rpx; }
.v2-mode .font-size-option-v2 { flex: 1; padding: 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); text-align: center; cursor: pointer; }
.v2-mode .font-size-option-v2.active { background: var(--text-main, #111); }
.v2-mode .font-size-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .font-size-option-v2.active .font-size-label-v2 { color: var(--accent, #FFD93D); }

/* pet row layout: avatar + info + button */
.v2-mode .pet-row-v2 { display: flex; align-items: center; gap: 24rpx; margin-top: 14rpx; }
.v2-mode .pet-avatar-img-v2 { width: 140rpx; height: 140rpx; flex-shrink: 0; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface-dim, #f9f9f9); }
.v2-mode .pet-row-info-v2 { flex: 1; min-width: 0; }
.v2-mode .pet-row-name-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .pet-row-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); line-height: 1.4; margin-top: 6rpx; }

/* bottom sheet */
.v2-mode .sheet-mask { position: fixed; inset: 0; z-index: 1000; background: var(--overlay, rgba(0,0,0,0.5)); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.v2-mode .sheet-panel { width: 100%; max-width: 500px; max-height: 75vh; background: var(--app-bg, #FFFDF5); border: 3px solid var(--text-main, #111); border-radius: var(--shape-radius-hero, 0) var(--shape-radius-hero, 0) 0 0; box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111); padding: 24rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; }
.v2-mode .sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; flex-shrink: 0; }
.v2-mode .sheet-title { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .sheet-close { font-size: $fs-kpi; font-weight: $fw-hero; color: var(--text-main, #111); padding: 0 8rpx; line-height: 1; }

/* pet sheet grid */
.v2-mode .pet-sheet-scroll-v2 { flex: 1; overflow-y: auto; }
.v2-mode .pet-sheet-grid-inner-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; padding-right: 4rpx; }
.v2-mode .pet-option-v2 { display: flex; align-items: center; gap: 14rpx; padding: 16rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); position: relative; }
.v2-mode .pet-option-v2.active { background: var(--text-main, #111); }
.v2-mode .pet-option-img-v2 { width: 80rpx; height: 80rpx; flex-shrink: 0; }
.v2-mode .pet-option-text-v2 { flex: 1; min-width: 0; }
.v2-mode .pet-option-name-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .pet-option-v2.active .pet-option-name-v2 { color: var(--accent, #FFD93D); }
.v2-mode .pet-option-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); line-height: 1.3; margin-top: 4rpx; }
.v2-mode .pet-option-v2.active .pet-option-desc-v2 { color: var(--on-active-muted, rgba(255,255,255,0.6)); }
.v2-mode .pet-option-check-v2 { position: absolute; top: 8rpx; right: 10rpx; font-size: $fs-body; font-weight: $fw-hero; color: var(--accent, #FFD93D); }
.v2-mode .pet-option-name-row-v2 { display: flex; align-items: center; gap: 8rpx; }
.v2-mode .pet-option-badge-v2 { display: inline-block; padding: 2rpx 10rpx; font-size: $fs-caption; font-weight: $fw-hero; color: var(--accent-cool, #4ECDC4); border: 1rpx solid var(--accent-cool, #4ECDC4); border-radius: var(--shape-radius-control, 0); }
.v2-mode .pet-option-badge-v2.download { color: var(--hero-bg, #FF6B6B); border-color: var(--hero-bg, #FF6B6B); }
.v2-mode .pet-option-v2.active .pet-option-badge-v2 { color: var(--accent, #FFD93D); border-color: var(--accent, #FFD93D); }

/* pet sheet footer */
.v2-mode .pet-sheet-footer-v2 { flex-shrink: 0; margin-top: 20rpx; padding-top: 10rpx; }
.v2-mode .pet-sheet-divider-v2 { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; }
.v2-mode .pet-sheet-divider-v2::before,
.v2-mode .pet-sheet-divider-v2::after { content: ''; flex: 1; height: 2rpx; background: var(--text-main, #111); }
.v2-mode .pet-sheet-divider-text-v2 { font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); text-transform: uppercase; letter-spacing: 2rpx; white-space: nowrap; }
.v2-mode .pet-custom-entry-v2 { display: flex; align-items: center; gap: 12rpx; padding: 20rpx; border: 2rpx dashed var(--text-main, #111); border-radius: var(--shape-radius-card, 0); background: var(--surface-bright, #fcfcfc); }
.v2-mode .pet-custom-icon-v2 { font-size: $fs-heading; }
.v2-mode .pet-custom-text-v2 { flex: 1; font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-muted, #666); }
.v2-mode .pet-custom-arrow-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); }

.v2-mode .chip-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .chip-grid-v2.cols3 { grid-template-columns: repeat(3, 1fr); }
.v2-mode .chip-v2 { padding: 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); }
.v2-mode .chip-v2.active { background: var(--text-main, #111); }
.v2-mode .chip-v2.disabled { opacity: 0.65; pointer-events: none; }
.v2-mode .chip-label-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .chip-v2.active .chip-label-v2 { color: var(--accent, #FFD93D); }
.v2-mode .chip-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); margin-top: 4rpx; line-height: 1.4; }
.v2-mode .chip-v2.active .chip-desc-v2 { color: var(--on-active-muted, rgba(255,255,255,0.6)); }
.v2-mode .ai-style-panel-v2 { display: flex; flex-direction: column; gap: 12rpx; }
.v2-mode .sub-title-v2 { display: block; padding: 8rpx 12rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--surface-dim, #f9f9f9); color: var(--text-muted, #666); font-size: $fs-caption; font-weight: $fw-hero; }
.v2-mode .explain-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 18rpx; }
.v2-mode .explain-title-v2 { font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .explain-arrow-v2 { padding: 4rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--surface, #fff); font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .explain-body-v2 { padding: 0 18rpx 18rpx; border-top: 2rpx solid var(--text-main, #111); }
.v2-mode .explain-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed var(--text-main, #111); }
.v2-mode .explain-item-v2:last-child { border-bottom: none; }
.v2-mode .explain-item-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111); }
.v2-mode .explain-item-desc-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); margin-top: 2rpx; line-height: 1.4; }
.referral-notice { margin-bottom: 20rpx; padding: 22rpx 24rpx; background: var(--accent, #FFD93D); border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111); }
.referral-notice-text { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: var(--text-main, #111); text-align: center; }
</style>

