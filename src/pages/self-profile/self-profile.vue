<template>
  <view class="page" :style="themeVars">
    <view class="card hero-card">
      <text class="hero-topline">Self Profile</text>
      <text class="h1">先定一下你的互动模式</text>
      <text class="hero-subtext">这些信息只用于调整用词、入口推荐和后续分析语气，不会公开展示。</text>
    </view>

    <view class="card">
      <text class="h2">基础画像</text>

      <view class="field">
        <text class="field-label">我是</text>
        <view class="segmented">
          <view
            v-for="item in genderOptions"
            :key="item.value"
            :class="['segment', profile.gender === item.value ? 'active' : '']"
            @click="profile.gender = item.value"
          >
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="field">
        <text class="field-label">年龄阶段</text>
        <picker :range="ageLabels" :value="ageIndex" @change="onAgeChange">
          <view class="picker-view">{{ ageLabel }}</view>
        </picker>
        <text v-if="profile.ageRange === 'under18'" class="minor-note">未满 18 岁时，系统会优先使用同学、朋友和边界感相关表达。</text>
      </view>

      <view class="field">
        <text class="field-label">目前身份</text>
        <picker :range="identityLabels" :value="identityIndex" @change="onIdentityChange">
          <view class="picker-view">{{ identityLabel }}</view>
        </picker>
      </view>
    </view>

    <view class="card">
      <text class="h2">趣味标签</text>
      <text class="muted">属相和星座只作为轻娱乐标签，不参与核心判断。</text>

      <view class="field">
        <text class="field-label">属相</text>
        <picker :range="zodiacLabels" :value="zodiacIndex" @change="onZodiacChange">
          <view class="picker-view">{{ zodiacLabel }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="field-label">星座</text>
        <picker :range="constellationLabels" :value="constellationIndex" @change="onConstellationChange">
          <view class="picker-view">{{ constellationLabel }}</view>
        </picker>
      </view>
    </view>

    <view class="card action-card">
      <button class="btn-primary" :disabled="saving" @click="onSave">
        {{ saving ? '保存中...' : '保存并进入' }}
      </button>
      <button v-if="isOnboarding" class="btn-secondary" :disabled="saving" @click="onSkip">
        先跳过
      </button>
    </view>
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

.btn-primary::after,
.btn-secondary::after {
  border: 0;
}
</style>
