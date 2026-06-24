<template>
  <view :class="['page v2-mode', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">PAIR MATCH</text>
      <text class="hero-title-v2">测测<text class="hl-v2">我和 TA</text></text>
      <text class="hero-copy-v2">小咪先确认两个人的基础画像，填完马上看桃花匹配度。</text>
    </view>

    <view class="guide-card">
      <text class="guide-name">小咪</text>
      <text class="guide-copy">为了不把匹配看偏，我需要知道你的基础状态，以及 TA 的性别、生肖和星座。后面生成解读时会用这些上下文。</text>
    </view>

    <view class="chat-card">
      <view class="chat-row">
        <view class="chat-avatar">小咪</view>
        <view class="chat-bubble">
          <text>先补齐你的桃花画像。</text>
          <text class="muted">性别、年龄段和身份会影响表达方式；生肖和星座用来计算配对。</text>
        </view>
      </view>
      <view class="field-grid">
        <view class="field">
          <text class="label required">我的性别</text>
          <view class="chip-row">
            <view v-for="item in selfGenderOptions" :key="item.value || 'empty-gender'" :class="['chip', selfForm.gender === item.value ? 'active' : '']" @click="selfForm.gender = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">年龄段</text>
          <view class="chip-row">
            <view v-for="item in selfAgeOptions" :key="item.value || 'empty-age'" :class="['chip', selfForm.ageRange === item.value ? 'active' : '']" @click="selfForm.ageRange = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="field wide">
          <text class="label required">当前身份</text>
          <view class="chip-row">
            <view v-for="item in identityOptions" :key="item.value || 'empty-identity'" :class="['chip', selfForm.identity === item.value ? 'active' : '']" @click="selfForm.identity = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">我的生肖</text>
          <view class="chip-row compact">
            <view v-for="item in zodiacOptions" :key="'self-zodiac-' + item" :class="['chip', selfForm.zodiac === item ? 'active' : '']" @click="selfForm.zodiac = item">{{ item }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">我的星座</text>
          <view class="chip-row compact">
            <view v-for="item in signOptions" :key="'self-sign-' + item" :class="['chip', selfForm.constellation === item ? 'active' : '']" @click="selfForm.constellation = item">{{ item }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="chat-card">
      <view class="chat-row">
        <view class="chat-avatar">小咪</view>
        <view class="chat-bubble">
          <text>再确认一下 TA 的画像。</text>
          <text class="muted">TA 的性别、生肖和星座会一起进入匹配上下文；称呼和关系会保存到 TA 档案。</text>
        </view>
      </view>
      <view class="field-grid">
        <view class="field wide">
          <text class="label">TA 怎么称呼</text>
          <input v-model="taForm.name" class="text-input" placeholder="TA 或昵称" maxlength="20" />
        </view>
        <view class="field">
          <text class="label">关系</text>
          <view class="chip-row">
            <view v-for="item in relationOptions" :key="item.value" :class="['chip', taForm.relationType === item.value ? 'active' : '']" @click="taForm.relationType = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">TA 的性别</text>
          <view class="chip-row">
            <view v-for="item in taGenderOptions" :key="'ta-gender-' + item" :class="['chip', taForm.gender === item ? 'active' : '']" @click="taForm.gender = item">{{ item }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">TA 的生肖</text>
          <view class="chip-row compact">
            <view v-for="item in zodiacOptions" :key="'ta-zodiac-' + item" :class="['chip', taForm.zodiac === item ? 'active' : '']" @click="taForm.zodiac = item">{{ item }}</view>
          </view>
        </view>
        <view class="field">
          <text class="label required">TA 的星座</text>
          <view class="chip-row compact">
            <view v-for="item in signOptions" :key="'ta-sign-' + item" :class="['chip', taForm.constellation === item ? 'active' : '']" @click="taForm.constellation = item">{{ item }}</view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="canPreview" class="preview-card">
      <text class="preview-title">即将生成</text>
      <text class="preview-copy">{{ preview.match.relation }} · {{ preview.match.signRelation || '星座节奏平衡' }}</text>
      <text class="preview-desc">{{ preview.match.combinedRelationDesc }}</text>
    </view>

    <button class="submit-btn" :disabled="submitting" @click="submitPair">{{ submitting ? '生成中...' : '生成桃花匹配度' }}</button>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { createCase, getCachedSelfProfile, getCurrentUserId, updateSelfProfile } from '@/utils/api'
import { bumpDataVersion, setActiveCaseId } from '@/utils/helpers'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildPairMatchPayload, SIGN_NAMES, ZODIAC_NAMES } from '@/utils/taohua'

const fontSizeMode = ref(getFontSizeMode())
const pageStyle = ref(getThemeStyle())
const submitting = ref(false)
const from = ref('')

const selfGenderOptions = [
  { value: '', label: '请选择' },
  { value: 'female', label: '女生' },
  { value: 'male', label: '男生' },
  { value: 'private', label: '暂不说' },
]
const selfAgeOptions = [
  { value: '', label: '请选择' },
  { value: 'under18', label: '18 岁以下' },
  { value: '18_22', label: '18-22 岁' },
  { value: '23_26', label: '23-26 岁' },
  { value: '27_plus', label: '27 岁以上' },
]
const identityOptions = [
  { value: '', label: '请选择' },
  { value: 'high_school', label: '高中 / 中专' },
  { value: 'college', label: '大学生' },
  { value: 'graduate', label: '研究生' },
  { value: 'worker', label: '已工作' },
  { value: 'other', label: '其他' },
]
const taGenderOptions = ['女', '男', '其他']
const zodiacOptions = ZODIAC_NAMES
const signOptions = SIGN_NAMES
const relationOptions = [
  { label: '暧昧 / Crush', value: 'romantic' },
  { label: '朋友心动', value: 'close_friend' },
  { label: '前任 / 旧关系', value: 'ex' },
  { label: '刚认识', value: 'new_contact' },
]

const selfForm = reactive({
  gender: '',
  ageRange: '',
  identity: '',
  zodiac: '',
  constellation: '',
})

const taForm = reactive({
  name: 'TA',
  relationType: 'romantic',
  gender: '',
  zodiac: '',
  constellation: '',
})

const canPreview = computed(() => Boolean(selfForm.zodiac && selfForm.constellation && taForm.zodiac && taForm.constellation))
const preview = computed(() => buildPairMatchPayload(selfForm.zodiac, selfForm.constellation, taForm.zodiac, taForm.constellation))

onLoad((options: any) => {
  from.value = String(options?.from || '')
  const cached = getCachedSelfProfile()
  selfForm.gender = normalizeSelfValue(options?.selfGender || cached?.gender, selfGenderOptions)
  selfForm.ageRange = normalizeSelfValue(options?.selfAgeRange || cached?.ageRange, selfAgeOptions)
  selfForm.identity = normalizeSelfValue(options?.selfIdentity || cached?.identity, identityOptions)
  selfForm.zodiac = normalizeOption(options?.selfZodiac, zodiacOptions, cached?.zodiac || zodiacOptions[0])
  selfForm.constellation = normalizeOption(options?.selfSign, signOptions, cached?.constellation || signOptions[0])
  taForm.name = decodeURIComponent(String(options?.taName || 'TA')).trim() || 'TA'
  taForm.gender = normalizeTextOption(options?.taGender, taGenderOptions, '')
  taForm.relationType = normalizeRelationType(options?.relationType)
  taForm.zodiac = normalizeOption(options?.taZodiac, zodiacOptions, zodiacOptions[0])
  taForm.constellation = normalizeOption(options?.taSign, signOptions, signOptions[0])
})

onShow(() => {
  applyThemeChrome()
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
})

function normalizeOption(value: any, options: string[], fallback: string) {
  const decoded = decodeURIComponent(String(value || ''))
  return options.includes(decoded) ? decoded : fallback
}

function normalizeSelfValue(value: any, options: Array<{ value: string; label: string }>) {
  const source = String(value || '').trim()
  const matched = options.find(item => item.value === source || item.label === source)
  return matched?.value || ''
}

function normalizeTextOption(value: any, options: string[], fallback: string) {
  const decoded = decodeURIComponent(String(value || '')).trim()
  return options.includes(decoded) ? decoded : fallback
}

function normalizeRelationType(value: any) {
  const decoded = decodeURIComponent(String(value || '')).trim()
  return relationOptions.some(item => item.value === decoded) ? decoded : 'romantic'
}

function validate() {
  if (!selfForm.gender || !selfForm.ageRange || !selfForm.identity || !selfForm.zodiac || !selfForm.constellation) return '先补齐你的完整画像'
  if (!taForm.gender) return '先选择 TA 的性别'
  if (!taForm.zodiac || !taForm.constellation) return '先补齐 TA 的生肖和星座'
  return ''
}

async function submitPair() {
  const uid = getCurrentUserId()
  const target = buildRedirectTarget()
  if (!uid) {
    uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(target)}` })
    return
  }
  const message = validate()
  if (message) {
    uni.showToast({ title: message, icon: 'none' })
    return
  }

  submitting.value = true
  uni.showLoading({ title: '生成中...' })
  try {
    const cached = getCachedSelfProfile() || {}
    const profileResult = await updateSelfProfile({
      ...cached,
      gender: selfForm.gender,
      ageRange: selfForm.ageRange,
      identity: selfForm.identity,
      zodiac: selfForm.zodiac,
      constellation: selfForm.constellation,
    } as any)
    if (!profileResult?.success) {
      uni.hideLoading()
      uni.showToast({ title: profileResult?.message || '保存你的画像失败', icon: 'none' })
      return
    }

    const res = await createCase({
      userId: uid,
      name: String(taForm.name || 'TA').trim() || 'TA',
      answers: [],
      profile: {
        relationType: taForm.relationType,
        gender: taForm.gender || '',
        age: null,
        zodiac: taForm.zodiac,
        constellation: taForm.constellation,
        occupation: '',
        avatar: '',
      }
    })

    uni.hideLoading()
    if (res?.success) {
      const caseId = res.caseId || res.case?.caseId || res.case?._id
      if (caseId) {
        setActiveCaseId(caseId)
        bumpDataVersion()
        uni.redirectTo({ url: `/pages/taohua-pair-result/taohua-pair-result?caseId=${encodeURIComponent(caseId)}&from=${encodeURIComponent(from.value || 'pair_onboarding')}` })
        return
      }
    }
    uni.showToast({ title: res?.message || '生成失败', icon: 'none' })
  } catch (error: any) {
    uni.hideLoading()
    uni.showToast({ title: error?.message || '生成失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function buildRedirectTarget() {
  const params = [
    `selfZodiac=${encodeURIComponent(selfForm.zodiac)}`,
    `selfSign=${encodeURIComponent(selfForm.constellation)}`,
    `taZodiac=${encodeURIComponent(taForm.zodiac)}`,
    `taSign=${encodeURIComponent(taForm.constellation)}`,
    `from=${encodeURIComponent(from.value || 'pair_onboarding')}`
  ]
  if (selfForm.gender) params.push(`selfGender=${encodeURIComponent(selfForm.gender)}`)
  if (selfForm.ageRange) params.push(`selfAgeRange=${encodeURIComponent(selfForm.ageRange)}`)
  if (selfForm.identity) params.push(`selfIdentity=${encodeURIComponent(selfForm.identity)}`)
  if (taForm.gender) params.push(`taGender=${encodeURIComponent(taForm.gender)}`)
  if (taForm.name) params.push(`taName=${encodeURIComponent(taForm.name)}`)
  if (taForm.relationType) params.push(`relationType=${encodeURIComponent(taForm.relationType)}`)
  return `/pages/pair-onboarding/pair-onboarding?${params.join('&')}`
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page {
  min-height: 100vh;
  padding: 18rpx;
  background: var(--app-bg, #FFFDF5);
  box-sizing: border-box;
}
.hero-block-v2 { @include hero-block-v2; margin-bottom: 20rpx; }
.hero-tag-v2 {
  display: inline-block;
  background: #111;
  color: #FFD93D;
  padding: 6rpx 16rpx;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.hero-title-v2 {
  display: block;
  font-size: $fs-hero-title;
  font-weight: $fw-hero;
  color: #111;
  line-height: 1.15;
  letter-spacing: -2rpx;
}
.hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.hero-copy-v2 {
  display: block;
  margin-top: 14rpx;
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  color: rgba(0,0,0,0.7);
  line-height: 1.5;
}
.guide-card,
.chat-card,
.preview-card {
  @include card-v2;
  margin-bottom: 20rpx;
}
.guide-card {
  background: #111;
  color: #fff;
  box-shadow: 6rpx 6rpx 0 #4ECDC4;
}
.guide-name {
  display: inline-block;
  padding: 4rpx 12rpx;
  background: #FFD93D;
  color: #111;
  font-size: $fs-caption;
  font-weight: $fw-hero;
}
.guide-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255,255,255,0.82);
  font-size: $fs-body-lg;
  line-height: 1.5;
  font-weight: $fw-label;
}
.section-title-row-v2 {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 18rpx;
}
.section-title-v2 { @include section-title-v2; }
.section-title-v2.no-margin { margin-bottom: 0; }
.chat-card {
  background: #fff;
}
.chat-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: 20rpx;
}
.chat-avatar {
  width: 76rpx;
  height: 76rpx;
  border: 3rpx solid #111;
  border-radius: 50%;
  background: #FFD93D;
  color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: $fs-caption;
  font-weight: $fw-hero;
}
.chat-bubble {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border: 3rpx solid #111;
  background: #F7FFF7;
  box-shadow: 5rpx 5rpx 0 #4ECDC4;
}
.chat-bubble text {
  display: block;
  color: #111;
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  line-height: 1.55;
}
.chat-bubble .muted {
  margin-top: 6rpx;
  color: #666;
  font-size: $fs-body;
  font-weight: $fw-body;
}
.step-dot {
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #111;
  background: #FFD93D;
  color: #111;
  font-size: $fs-body;
  font-weight: $fw-hero;
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
}
.field {
  min-width: 0;
}
.field.wide {
  grid-column: 1 / -1;
}
.label {
  display: block;
  margin-bottom: 8rpx;
  color: #666;
  font-size: $fs-caption;
  font-weight: $fw-hero;
}
.label.required::after {
  content: " *";
  color: #FF5252;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}
.chip-row.compact {
  gap: 8rpx;
}
.chip {
  padding: 12rpx 16rpx;
  border: 2rpx solid #111;
  background: #fff;
  color: #111;
  font-size: $fs-body;
  font-weight: $fw-label;
  line-height: 1.2;
}
.chip-row.compact .chip {
  padding: 10rpx 13rpx;
  font-size: $fs-caption;
}
.chip.active {
  background: #111;
  color: #FFD93D;
  box-shadow: 4rpx 4rpx 0 #4ECDC4;
}
.picker-view,
.text-input {
  width: 100%;
  height: 78rpx;
  line-height: 78rpx;
  padding: 0 18rpx;
  border: 3rpx solid #111;
  background: #fff;
  color: #111;
  font-size: $fs-body-lg;
  font-weight: $fw-hero;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text-input {
  line-height: normal;
}
.preview-card {
  background: #FFF4C7;
}
.preview-title {
  display: block;
  color: #8A3A28;
  font-size: $fs-body;
  font-weight: $fw-hero;
}
.preview-copy {
  display: block;
  margin-top: 10rpx;
  color: #111;
  font-size: $fs-heading;
  line-height: 1.25;
  font-weight: $fw-hero;
}
.preview-desc {
  display: block;
  margin-top: 10rpx;
  color: #555;
  font-size: $fs-body;
  line-height: 1.45;
  font-weight: $fw-label;
}
.submit-btn {
  width: 100%;
  height: 86rpx;
  line-height: 86rpx;
  border: 3rpx solid #111;
  border-radius: 0;
  background: #4ECDC4;
  color: #111;
  box-shadow: 6rpx 6rpx 0 #111;
  font-size: $fs-heading;
  font-weight: $fw-hero;
}
.submit-btn[disabled] {
  opacity: 0.65;
}
</style>
