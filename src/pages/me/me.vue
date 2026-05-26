<template>
  <view class="page v2-mode" :style="themeVars">
      <view class="hero-block-v2"><text class="hero-tag-v2">SETTINGS</text><text class="hero-title-v2">我<text class="hl-v2">的</text></text><text class="hero-copy-v2">管理账号、系统能力说明和个人设置。</text></view>
      <!-- Account -->
      <view class="card-v2"><text class="section-title-v2">账号信息</text><text class="card-text-v2">当前登录：{{ userEmail || '未登录' }}</text><text class="card-text-v2">关系对象数：{{ caseCount }}</text><view class="switch-row-v2"><text class="card-text-v2" style="flex:1">显示陪伴助手</text><switch :checked="showPetBar" color="#111" @change="onPetBarChange" /></view><view class="btn-row-v2"><button class="btn-v2-me" open-type="share">分享小程序</button><button class="btn-v2-me danger" @click="onLogout">退出登录</button></view></view>
      <!-- Pet picker -->
      <view class="card-v2"><text class="section-title-v2">陪伴形象</text><text class="card-text-v2">当前：{{ currentPet.displayName }}</text><view class="pet-grid-v2"><view v-for="pet in petOptions" :key="pet.id" :class="['pet-card-v2', currentPetId === pet.id ? 'active' : '']" @click="choosePet(pet.id)"><image :src="`${pet.basePath}/idle/00.png`" class="pet-preview-v2" mode="aspectFit" /><text class="pet-name-v2">{{ pet.displayName }}</text><text class="pet-desc-v2">{{ pet.description }}</text></view></view></view>
      <!-- Profile (moved here) -->
      <view class="card-v2"><text class="section-title-v2">本人画像</text><text class="card-text-v2">{{ selfProfileSummary }}</text><button class="btn-v2-me outline" @click="goSelfProfile">编辑本人画像</button></view>
      <!-- Token (fixed button) -->
      <view class="card-v2"><text class="section-title-v2">Token 额度</text><view class="balance-hero-v2"><text class="balance-num-v2">{{ tokenBalance.toLocaleString() }}</text><text class="balance-unit-v2">可用额度</text></view><view class="balance-sub-row-v2"><text class="card-text-v2">累计赠送 {{ tokenGiftedTotal.toLocaleString() }} · 累计消费 {{ tokenConsumedTotal.toLocaleString() }}</text></view><view class="stats-grid-v2" style="margin-top:16rpx;"><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.totalTokens }}</text><text class="stat-lbl-v2">模型 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.callCount }}</text><text class="stat-lbl-v2">调用次数</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.promptTokens }}</text><text class="stat-lbl-v2">输入</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.completionTokens }}</text><text class="stat-lbl-v2">输出</text></view></view><text v-if="tokenUsageSummary.unavailableCount" class="card-text-v2 muted">有 {{ tokenUsageSummary.unavailableCount }} 次调用未返回 usage。</text><view class="btn-row-v2" style="margin-top:14rpx;"><button class="btn-v2-me sm" @click="goRecharge">充值</button><button class="btn-v2-me sm" :disabled="tokenUsageLoading" @click="refreshTokenData">{{ tokenUsageLoading ? '读取中' : '刷新' }}</button><button class="btn-v2-me outline sm" @click="goTokenUsage">消费明细</button></view></view>
      <!-- Theme picker -->
      <view class="card-v2"><text class="section-title-v2">界面风格</text><text class="card-text-v2">选择更适合你的视觉氛围。</text><view class="theme-grid-v2"><view v-for="theme in themeOptions" :key="theme.id" :class="['theme-card-v2', currentThemeId === theme.id ? 'active' : '']" @click="chooseTheme(theme.id)"><view class="theme-dot-v2" :style="{ background: theme.vars['--hero-bg'] }"></view><text class="theme-name-v2">{{ theme.name }}</text><text class="theme-desc-v2">{{ theme.description }}</text></view></view></view>
      <!-- AI style -->
      <view class="card-v2"><text class="section-title-v2">AI 陪伴风格</text><text class="card-text-v2">你在这里选风格，后台提示词会真正跟着变，不是只改文案皮肤。</text><view class="chip-grid-v2"><view v-for="item in aiStyleOptions" :key="item.value" :class="['chip-v2', aiStyle === item.value ? 'active' : '']" @click="aiStyle = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view></view>
      <view class="card-v2"><text class="section-title-v2">建议力度</text><view class="chip-grid-v2 cols3"><view v-for="item in aiBoldnessOptions" :key="item.value" :class="['chip-v2', aiBoldness === item.value ? 'active' : '']" @click="aiBoldness = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view></view>
      <view class="card-v2"><text class="section-title-v2">AI 风格状态</text><text class="card-text-v2">{{ aiStatusSummary }}</text><button class="btn-v2-me primary" :disabled="!canSaveAIPersona || aiSaving" @click="saveAIPersona">{{ aiSaving ? '保存中...' : '保存 AI 风格' }}</button></view>
      <view class="card-v2" @click="goSystemTracks"><text class="section-title-v2">系统轨迹</text><text class="card-text-v2">查看系统自动生成的判定和趋势记录 →</text></view>
      <view class="card-v2" @click="goExplain"><text class="section-title-v2">判断说明</text><text class="card-text-v2">查看系统判断标签的含义说明 →</text></view>
      <view class="card-v2" @click="goFeedback"><text class="section-title-v2">系统反馈</text><text class="card-text-v2">告诉我们你的使用体验或建议 →</text></view>
      <view class="card-v2" @click="goAbout"><text class="section-title-v2">关于</text><text class="card-text-v2">v1.0.0 · 查看版本信息 →</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import {
  getCachedSelfProfile,
  getCases,
  getCurrentUserId,
  getSelfProfile,
  getTokenAccount,
  getTokenUsage,
  hasUsableSelfProfile,
  logout,
  updateSelfProfile,
  type AIBoldnessValue,
  type AIStyleValue,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getCurrentThemeId, getThemeStyle, setCurrentTheme, themeOptions, type ThemeId } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'
import { getPetById, getSelectedPetId, petOptions, setSelectedPetId } from '@/utils/pets.js'

type PetId = 'xiaomi' | 'doggo'

const userEmail = ref('')
const caseCount = ref(0)
const selfProfileSummary = ref('还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。')
const aiStatusSummary = ref('当前：温柔陪伴 · 平衡。未满 18 岁时会自动切换为谨慎守护 + 保守建议。')
const currentThemeId = ref<ThemeId>(getCurrentThemeId())
const themeVars = ref(getThemeStyle())
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
const tokenBalance = ref(0)
const tokenGiftedTotal = ref(0)
const tokenConsumedTotal = ref(0)
const tokenBalanceLoading = ref(false)
const canSaveAIPersona = computed(() => hasUsableSelfProfile(currentSelfProfile.value) && !aiSaving.value)

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
  { value: 'direct_sharp', label: '闺蜜直给', description: '不绕弯，结论更硬，适合想听真话。' },
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
const currentPetId = ref<PetId>(getSelectedPetId())
const currentPet = computed(() => getPetById(currentPetId.value))

function onPetBarChange(e: any) {
  const v = Boolean(e.detail.value)
  showPetBar.value = v
  uni.setStorageSync('showPetBar', v)
}

function choosePet(id: PetId) {
  currentPetId.value = id
  setSelectedPetId(id)
  uni.showToast({ title: `已切换为 ${getPetById(id).displayName}`, icon: 'none' })
}

const lastDataVersion = ref(0)

onShow(() => {
  syncTheme()
  showPetBar.value = uni.getStorageSync('showPetBar') !== false
  currentPetId.value = getSelectedPetId()
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (!userEmail.value || dv > lastDataVersion.value) loadData()
  loadTokenUsage()
  loadTokenBalance()
})

function syncTheme() {
  currentThemeId.value = getCurrentThemeId()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
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

async function loadTokenBalance() {
  if (tokenBalanceLoading.value) return
  tokenBalanceLoading.value = true
  try {
    const result = await getTokenAccount('claimGift')
    if (!result?.success || !result?.account) return
    tokenBalance.value = Number(result.account.balanceTokens || 0)
    tokenGiftedTotal.value = Number(result.account.giftedTokens || 0)
    tokenConsumedTotal.value = Number(result.account.consumedTokens || 0)
  } catch {
    // ignore
  } finally {
    tokenBalanceLoading.value = false
  }
}

async function refreshTokenData() {
  await Promise.all([loadTokenUsage(), loadTokenBalance()])
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

function goAbout() {
  uni.navigateTo({ url: '/pages/about/about' })
}

async function onLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }
.v2-mode .balance-hero-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 4rpx 4rpx 0 #111; padding: 20rpx 24rpx; margin-bottom: 12rpx; display: flex; align-items: baseline; gap: 10rpx; }
.v2-mode .balance-num-v2 { font-size: 44rpx; font-weight: 900; color: #111; letter-spacing: -2rpx; }
.v2-mode .balance-unit-v2 { font-size: 22rpx; font-weight: 800; color: rgba(0,0,0,0.6); }
.v2-mode .balance-sub-row-v2 { margin-bottom: 4rpx; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .switch-row-v2 { display: flex; align-items: center; gap: 24rpx; padding: 12rpx 0; }
.v2-mode .btn-v2-me { flex: 1; height: 64rpx; line-height: 64rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-me.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-me.danger { background: #fff; color: #FF5252; border-color: #FF5252; }
.v2-mode .btn-v2-me.outline { background: #fff; }
.v2-mode .btn-v2-me.sm { width: auto; flex: none; min-width: 100rpx; padding: 0 24rpx; height: 52rpx; line-height: 52rpx; font-size: 22rpx; }
.v2-mode .btn-v2-me[disabled] { opacity: 0.6; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx 8rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 4rpx; }

.v2-mode .theme-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .theme-card-v2 { padding: 14rpx 10rpx; border: 2rpx solid #111; background: #fff; text-align: center; }
.v2-mode .theme-card-v2.active { background: #111; }
.v2-mode .theme-dot-v2 { width: 32rpx; height: 32rpx; border-radius: 50%; border: 2rpx solid #111; margin: 0 auto 6rpx; }
.v2-mode .theme-card-v2.active .theme-dot-v2 { border-color: #FFD93D; }
.v2-mode .theme-name-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .theme-card-v2.active .theme-name-v2 { color: #FFD93D; }
.v2-mode .theme-desc-v2 { display: block; font-size: 16rpx; font-weight: 600; color: #999; margin-top: 4rpx; line-height: 1.3; }
.v2-mode .theme-card-v2.active .theme-desc-v2 { color: rgba(255,255,255,0.5); }

.v2-mode .pet-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; margin-top: 14rpx; }
.v2-mode .pet-card-v2 { padding: 16rpx; border: 2rpx solid #111; background: #fff; text-align: center; }
.v2-mode .pet-card-v2.active { background: #111; }
.v2-mode .pet-preview-v2 { width: 112rpx; height: 112rpx; display: block; margin: 0 auto 10rpx; }
.v2-mode .pet-name-v2 { display: block; font-size: 24rpx; font-weight: 900; color: #111; }
.v2-mode .pet-card-v2.active .pet-name-v2 { color: #FFD93D; }
.v2-mode .pet-desc-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #888; line-height: 1.4; margin-top: 6rpx; }
.v2-mode .pet-card-v2.active .pet-desc-v2 { color: rgba(255,255,255,0.62); }

.v2-mode .chip-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .chip-grid-v2.cols3 { grid-template-columns: repeat(3, 1fr); }
.v2-mode .chip-v2 { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .chip-v2.active { background: #111; }
.v2-mode .chip-label-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .chip-v2.active .chip-label-v2 { color: #FFD93D; }
.v2-mode .chip-desc-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; line-height: 1.4; }
.v2-mode .chip-v2.active .chip-desc-v2 { color: rgba(255,255,255,0.6); }

.v2-mode .explain-v2 { margin-top: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .explain-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 18rpx; }
.v2-mode .explain-title-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .explain-arrow-v2 { padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 18rpx; font-weight: 800; color: #111; }
.v2-mode .explain-body-v2 { padding: 0 18rpx 18rpx; border-top: 2rpx solid #111; }
.v2-mode .explain-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed #e0e0e0; }
.v2-mode .explain-item-v2:last-child { border-bottom: none; }
.v2-mode .explain-item-title-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .explain-item-desc-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-top: 2rpx; line-height: 1.4; }
</style>
