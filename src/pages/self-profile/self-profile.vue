<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <view class="version-toggle"><view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view><view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view></view>
    <block v-if="!showV2">
    <view class="card hero-card"><text class="hero-topline">Self Profile</text><text class="h1">先定一下你的互动模式</text><text class="hero-subtext">这些信息只用于调整用词、入口推荐和后续分析语气，不会公开展示。</text></view>
    <view class="card"><text class="h2">基础画像</text><view class="field"><text class="field-label">我是</text><view class="segmented"><view v-for="item in genderOptions" :key="item.value" :class="['segment', profile.gender === item.value ? 'active' : '']" @click="profile.gender = item.value"><text>{{ item.label }}</text></view></view></view><view class="field"><text class="field-label">年龄阶段</text><picker :range="ageLabels" :value="ageIndex" @change="onAgeChange"><view class="picker-view">{{ ageLabel }}</view></picker><text v-if="profile.ageRange === 'under18'" class="minor-note">未满 18 岁时，系统会优先使用同学、朋友和边界感相关表达。</text></view><view class="field"><text class="field-label">目前身份</text><picker :range="identityLabels" :value="identityIndex" @change="onIdentityChange"><view class="picker-view">{{ identityLabel }}</view></picker></view></view>
    <view class="card"><text class="h2">趣味标签</text><text class="muted">属相和星座只作为轻娱乐标签，不参与核心判断。</text><view class="field"><text class="field-label">属相</text><picker :range="zodiacLabels" :value="zodiacIndex" @change="onZodiacChange"><view class="picker-view">{{ zodiacLabel }}</view></picker></view><view class="field"><text class="field-label">星座</text><picker :range="constellationLabels" :value="constellationIndex" @change="onConstellationChange"><view class="picker-view">{{ constellationLabel }}</view></picker></view></view>
    <view class="card action-card"><button class="btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中...' : '保存并进入' }}</button><button v-if="isOnboarding" class="btn-secondary" :disabled="saving" @click="onSkip">先跳过</button></view>
    </block>
    <!-- Campus Pop -->
    <block v-if="showV2">
      <view class="hero-block-v2"><text class="hero-tag-v2">SELF PROFILE</text><text class="hero-title-v2">你的<text class="hl-v2">互动模式</text></text><text class="hero-copy-v2">这些信息只用于调整用词和后续分析语气，不会公开展示。</text></view>
      <view class="card-v2"><text class="section-title-v2">基础画像</text>
        <view class="field-v2"><text class="field-label-v2">我是</text><view class="segmented-v2"><view v-for="item in genderOptions" :key="item.value" :class="['segment-v2', profile.gender === item.value ? 'active' : '']" @click="profile.gender = item.value">{{ item.label }}</view></view></view>
        <view class="field-v2"><text class="field-label-v2">年龄阶段</text><picker :range="ageLabels" :value="ageIndex" @change="onAgeChange"><view class="picker-v2">{{ ageLabel }}</view></picker><text v-if="profile.ageRange === 'under18'" class="minor-note-v2">未满 18 岁时，系统会优先使用同学、朋友和边界感相关表达。</text></view>
        <view class="field-v2"><text class="field-label-v2">目前身份</text><picker :range="identityLabels" :value="identityIndex" @change="onIdentityChange"><view class="picker-v2">{{ identityLabel }}</view></picker></view>
      </view>
      <view class="card-v2"><text class="section-title-v2">趣味标签</text><text class="card-text-v2">属相和星座只作为轻娱乐标签，不参与核心判断。</text>
        <view class="field-v2"><text class="field-label-v2">属相</text><picker :range="zodiacLabels" :value="zodiacIndex" @change="onZodiacChange"><view class="picker-v2">{{ zodiacLabel }}</view></picker></view>
        <view class="field-v2"><text class="field-label-v2">星座</text><picker :range="constellationLabels" :value="constellationIndex" @change="onConstellationChange"><view class="picker-v2">{{ constellationLabel }}</view></picker></view>
      </view>
      <view class="card-v2" style="display:flex;flex-direction:column;gap:14rpx;"><button class="btn-v2-sp primary" :disabled="saving" @click="onSave">{{ saving ? '保存中...' : '保存并进入' }}</button><button v-if="isOnboarding" class="btn-v2-sp" :disabled="saving" @click="onSkip">先跳过</button></view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getCachedSelfProfile,
  getCurrentUserId,
  getSelfProfile,
  markSelfProfileSkipped,
  updateSelfProfile,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { showError, showSuccess } from '@/utils/helpers'

const showV2 = ref(true)
const themeVars = ref(getThemeStyle())
const saving = ref(false)
const isOnboarding = ref(false)

const genderOptions = [
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' },
  { value: 'private', label: '暂不说' }
]

const ageOptions = [
  { value: '', label: '请选择' },
  { value: 'under18', label: '18 岁以下' },
  { value: '18_22', label: '18-22 岁' },
  { value: '23_26', label: '23-26 岁' },
  { value: '27_plus', label: '27 岁以上' }
]

const identityOptions = [
  { value: '', label: '请选择' },
  { value: 'high_school', label: '高中 / 中专' },
  { value: 'college', label: '大学生' },
  { value: 'graduate', label: '研究生' },
  { value: 'worker', label: '已工作' },
  { value: 'other', label: '其他' }
]

const zodiacOptions = ['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationOptions = ['', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']

const profile = reactive<SelfProfile>({
  gender: '',
  ageRange: '',
  identity: '',
  zodiac: '',
  constellation: ''
})

const ageLabels = ageOptions.map((item) => item.label)
const identityLabels = identityOptions.map((item) => item.label)
const zodiacLabels = zodiacOptions.map((item) => item || '不选择')
const constellationLabels = constellationOptions.map((item) => item || '不选择')

const ageIndex = computed(() => Math.max(0, ageOptions.findIndex((item) => item.value === profile.ageRange)))
const identityIndex = computed(() => Math.max(0, identityOptions.findIndex((item) => item.value === profile.identity)))
const zodiacIndex = computed(() => Math.max(0, zodiacOptions.indexOf(profile.zodiac || '')))
const constellationIndex = computed(() => Math.max(0, constellationOptions.indexOf(profile.constellation || '')))
const ageLabel = computed(() => ageOptions[ageIndex.value]?.label || '请选择')
const identityLabel = computed(() => identityOptions[identityIndex.value]?.label || '请选择')
const zodiacLabel = computed(() => profile.zodiac || '不选择')
const constellationLabel = computed(() => profile.constellation || '不选择')

onLoad((options) => {
  isOnboarding.value = options?.mode === 'onboarding'
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  loadProfile()
})

function applyProfile(value?: SelfProfile | null) {
  if (!value) return
  profile.gender = value.gender || ''
  profile.ageRange = value.ageRange || ''
  profile.identity = value.identity || ''
  profile.zodiac = value.zodiac || ''
  profile.constellation = value.constellation || ''
}

async function loadProfile() {
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  applyProfile(getCachedSelfProfile())
  try {
    const result = await getSelfProfile()
    if (result?.success) {
      applyProfile(result.selfProfile)
    }
  } catch (error) {
    console.warn('[self-profile] load failed:', error)
  }
}

function onAgeChange(event: any) {
  profile.ageRange = ageOptions[event.detail.value]?.value || ''
}

function onIdentityChange(event: any) {
  profile.identity = identityOptions[event.detail.value]?.value || ''
}

function onZodiacChange(event: any) {
  profile.zodiac = zodiacOptions[event.detail.value] || ''
}

function onConstellationChange(event: any) {
  profile.constellation = constellationOptions[event.detail.value] || ''
}

function goNext() {
  uni.switchTab({ url: '/pages/index/index' })
}

async function onSave() {
  if (!profile.gender) {
    showError('请选择性别')
    return
  }
  if (!profile.ageRange) {
    showError('请选择年龄阶段')
    return
  }
  if (!profile.identity) {
    showError('请选择目前身份')
    return
  }

  saving.value = true
  try {
    const result = await updateSelfProfile({ ...profile })
    if (!result?.success) {
      showError(result?.message || '保存失败')
      return
    }
    showSuccess('已保存')
    setTimeout(goNext, 500)
  } catch (error: any) {
    showError(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function onSkip() {
  markSelfProfileSkipped()
  goNext()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx;
  box-sizing: border-box;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
}

.card {
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
  padding: 32rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background: linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
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
  display: block;
  color: rgba(255, 252, 247, 0.72);
  font-size: 21rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
}

.h1 {
  display: block;
  margin-top: 10rpx;
  color: #fffaf0;
  font-size: 44rpx;
  line-height: 1.22;
  font-weight: 800;
}

.hero-subtext {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 252, 247, 0.76);
  font-size: 25rpx;
  line-height: 1.6;
}

.h2 {
  display: block;
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  color: var(--text-main, #201914);
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 750;
}

.muted,
.field-label {
  color: var(--text-muted, #76695c);
}

.muted {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
}

.field {
  padding: 22rpx 0;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.07);
}

.field:last-child {
  border-bottom: 0;
}

.field-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  font-weight: 650;
}

.segmented {
  display: flex;
  gap: 12rpx;
}

.segment {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.12);
  background: var(--card-soft, #fffaf3);
  color: var(--text-main, #201914);
  font-size: 26rpx;
  font-weight: 650;
}

.segment.active {
  border-color: rgba(18, 60, 54, 0.65);
  background: rgba(231, 243, 239, 0.92);
  color: var(--primary, #123c36);
}

.picker-view {
  height: 78rpx;
  line-height: 78rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.12);
  background: var(--card-soft, #fffaf3);
  color: var(--text-main, #201914);
  font-size: 27rpx;
  box-shadow: inset 0 2rpx 8rpx rgba(32, 25, 20, 0.03);
}

.minor-note {
  display: block;
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(201, 164, 92, 0.12);
  color: #6f5225;
  font-size: 23rpx;
  line-height: 1.5;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.btn-primary,
.btn-secondary {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  margin: 0;
  border-radius: 14rpx;
  font-size: 29rpx;
  font-weight: 700;
}

.btn-primary {
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.18);
}

.btn-secondary {
  color: var(--primary, #123c36);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  background: rgba(255, 252, 247, 0.92);
}

.btn-primary::after, .btn-secondary::after { border: 0; }

/* ===== CAMPUS POP V2 ===== */
.version-toggle { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #111; overflow: hidden; background: #fff; }
.toggle-tab { flex: 1; text-align: center; padding: 14rpx 0; font-size: 26rpx; font-weight: 700; color: #999; }
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 14rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 10rpx; }

.v2-mode .field-v2 { padding: 20rpx 0; border-bottom: 3rpx solid #e0e0e0; }
.v2-mode .field-v2:last-child { border-bottom: 0; }
.v2-mode .field-label-v2 { display: block; font-size: 24rpx; font-weight: 800; color: #111; margin-bottom: 10rpx; }

.v2-mode .segmented-v2 { display: flex; gap: 10rpx; }
.v2-mode .segment-v2 { flex: 1; height: 68rpx; line-height: 68rpx; text-align: center; border: 3rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 700; color: #111; }
.v2-mode .segment-v2.active { background: #111; color: #FFD93D; }

.v2-mode .picker-v2 { height: 72rpx; line-height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 700; color: #111; }

.v2-mode .minor-note-v2 { display: block; margin-top: 10rpx; padding: 14rpx; border: 2rpx solid #111; background: #FFFBEB; font-size: 20rpx; font-weight: 600; color: #111; line-height: 1.5; }

.v2-mode .btn-v2-sp { width: 100%; height: 80rpx; line-height: 80rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 28rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-sp.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-sp[disabled] { opacity: 0.6; }
</style>
