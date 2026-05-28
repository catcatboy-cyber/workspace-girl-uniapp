<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">无法编辑画像</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">编辑画像 / {{ caseFile.name }}</text>
        <view class="hero-head">
          <view class="profile-avatar lg">
            <image v-if="profile.avatar" :src="profile.avatarPreviewUrl || profile.avatar" mode="aspectFill" />
            <text v-else class="avatar-placeholder">{{ avatarLabel(caseName || caseFile.name) }}</text>
          </view>
          <view class="hero-copy">
            <text class="h1">修改对象名称和画像信息</text>
            <text class="hero-subtext">更新的是对象资料层信息，不会改动历史分析。</text>
          </view>
        </view>
        <view class="hero-actions">
          <button class="btn-secondary" @click="goCaseDetail">返回关系主页</button>
          <button class="btn-secondary" @click="goTimeline">查看时间线</button>
        </view>
      </view>

      <view v-if="profileItems.length > 0" class="card">
        <text class="h2">当前画像预览</text>
        <view class="badges">
          <text v-for="item in profileItems" :key="item" class="badge">{{ item }}</text>
        </view>
      </view>

      <view v-if="profileInsight" class="card">
        <text class="h2">{{ profileInsight.title }}</text>
        <text class="muted insight-summary">{{ profileInsight.summary }}</text>
        <view class="insight-list">
          <text v-for="item in profileInsight.bullets" :key="item" class="insight-item">• {{ item }}</text>
        </view>
        <text class="muted">{{ profileInsight.disclaimer }}</text>
      </view>

      <view class="card">
        <text class="h2">对象基础信息</text>
        <view class="field">
          <text class="field-label">对象名称 / 关系名称</text>
          <input v-model="caseName" class="text-input" />
        </view>
      </view>

      <view class="card">
        <text class="h2">对象画像</text>
        <text class="muted">这些信息只用于辅助理解，不参与核心评分。</text>

        <view class="field">
          <text class="field-label">关系类型</text>
          <picker :range="relationTypeLabels" :value="relationTypeIndex" @change="onRelationTypeChange">
            <view class="picker-view">{{ relationTypeLabel }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">年龄</text>
          <input v-model="profile.age" type="number" class="text-input" placeholder="例如：26" />
        </view>

        <view class="field">
          <text class="field-label">性别</text>
          <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="picker-view">{{ profile.gender || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">工作</text>
          <input v-model="profile.occupation" class="text-input" />
        </view>

        <view class="field">
          <text class="field-label">属相</text>
          <picker :range="zodiacOptions" :value="zodiacIndex" @change="onZodiacChange">
            <view class="picker-view">{{ profile.zodiac || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">星座</text>
          <picker :range="constellationOptions" :value="constellationIndex" @change="onConstellationChange">
            <view class="picker-view">{{ profile.constellation || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">头像</text>
          <ProfileAvatarPicker v-model="profile.avatar" @preview-change="onAvatarPreviewChange" />
        </view>
      </view>

      <view class="card">
        <button class="btn-primary" :disabled="saving" @click="onSave">
          {{ saving ? '保存中...' : '保存画像信息' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCaseDetail, updateCaseProfile, getCurrentUserId } from '@/utils/api'
import { markActiveCaseProfileUpdated, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import ProfileAvatarPicker from '@/components/ProfileAvatarPicker.vue'
import { buildProfileInsight, buildProfileItems } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const saving = ref(false)
const caseFile = ref<any>(null)
const userId = ref('')
const caseId = ref('')
const caseName = ref('')
const themeVars = ref(getThemeStyle())

const relationTypeOptions = ['romantic', 'close_friend', 'colleague', 'classmate', 'teacher']
const relationTypeLabels = ['恋爱对象', '朋友', '同事', '同学', '老师']
const genderOptions = ['男', '女', '非二元', '未说明']
const zodiacOptions = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationOptions = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'
]

const profile = reactive({
  relationType: 'romantic',
  age: '',
  gender: '',
  occupation: '',
  zodiac: '',
  constellation: '',
  avatar: '',
  avatarPreviewUrl: ''
})

const relationTypeIndex = computed(() => Math.max(0, relationTypeOptions.indexOf(profile.relationType)))
const relationTypeLabel = computed(() => relationTypeLabels[relationTypeIndex.value] || '恋爱对象')
const genderIndex = computed(() => Math.max(0, genderOptions.indexOf(profile.gender)))
const zodiacIndex = computed(() => Math.max(0, zodiacOptions.indexOf(profile.zodiac)))
const constellationIndex = computed(() => Math.max(0, constellationOptions.indexOf(profile.constellation)))
const previewProfile = computed(() => ({
  relationType: profile.relationType,
  age: profile.age,
  gender: profile.gender,
  occupation: profile.occupation,
  zodiac: profile.zodiac,
  constellation: profile.constellation,
  avatar: profile.avatar
}))
const profileItems = computed(() => buildProfileItems(previewProfile.value))
const profileInsight = computed(() => buildProfileInsight(previewProfile.value))

function onRelationTypeChange(e: any) { profile.relationType = relationTypeOptions[e.detail.value] }
function onGenderChange(e: any) { profile.gender = genderOptions[e.detail.value] }
function onZodiacChange(e: any) { profile.zodiac = zodiacOptions[e.detail.value] }
function onConstellationChange(e: any) { profile.constellation = constellationOptions[e.detail.value] }
function onAvatarPreviewChange(value: string) { profile.avatarPreviewUrl = value }

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  caseId.value = options?.caseId || ''
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    showError('缺少 caseId')
    return
  }
  userId.value = uid
  loading.value = true
  try {
    caseFile.value = await getCaseDetail(uid, caseId.value)
    if (caseFile.value) {
      caseName.value = caseFile.value.name || ''
      const p = caseFile.value.profile || {}
      profile.relationType = p.relationType || 'romantic'
      profile.age = p.age || ''
      profile.gender = p.gender || ''
      profile.occupation = p.occupation || ''
      profile.zodiac = p.zodiac || ''
      profile.constellation = p.constellation || ''
      profile.avatar = p.avatar || ''
      profile.avatarPreviewUrl = p.avatarUrl || p.avatar || ''
    }
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!caseName.value.trim()) {
    showError('请填写对象名称')
    return
  }
  saving.value = true
  try {
    const { avatarPreviewUrl: _avatarPreviewUrl, ...profilePayload } = { ...profile }
    const res = await updateCaseProfile({
      userId: userId.value,
      caseId: caseId.value,
      name: caseName.value.trim(),
      profile: profilePayload
    })
    if (res.success) {
      showSuccess('已保存')
      setTimeout(() => {
        setActiveCaseId(caseId.value)
        markActiveCaseProfileUpdated(caseId.value)
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      }, 600)
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimeline() {
  setActiveCaseId(caseId.value)
  setPendingTimelineContext({ caseId: caseId.value })
  uni.switchTab({ url: '/pages/timeline/timeline' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-head { display: flex; gap: 20rpx; align-items: center; }
.hero-copy { flex: 1; }
.hero-actions { display: flex; gap: 12rpx; margin-top: 20rpx; flex-wrap: wrap; }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 36rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: #efe7d8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar.lg { width: 120rpx; height: 120rpx; }
.profile-avatar image { width: 100%; height: 100%; }
.avatar-placeholder { font-size: 36rpx; font-weight: 700; color: #786857; }
.badges { margin-top: 8rpx; }
.badge { display: inline-block; padding: 8rpx 16rpx; background: #efe7d8; border-radius: 999rpx; font-size: 22rpx; color: #241b12; margin: 4rpx; }
.insight-summary { margin-bottom: 12rpx; }
.insight-list { display: flex; flex-direction: column; gap: 8rpx; margin: 12rpx 0; }
.insight-item { font-size: 26rpx; color: #241b12; line-height: 1.6; }
.field { margin-top: 16rpx; }
.field-label { display: block; font-size: 24rpx; color: #241b12; margin-bottom: 8rpx; }
.text-input { width: 100%; height: 80rpx; padding: 0 24rpx; background: #fff; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 28rpx; box-sizing: border-box; }
.picker-view { height: 80rpx; line-height: 80rpx; padding: 0 24rpx; background: #fff; border: 2rpx solid #e5ddd0; border-radius: 12rpx; font-size: 28rpx; }
.btn-primary { width: 100%; height: 88rpx; line-height: 88rpx; background: #143f3a; color: #fff; border: none; border-radius: 12rpx; font-size: 32rpx; font-weight: 600; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 24rpx; }

/* Premium visual pass */
.page {
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 360rpx),
    var(--app-bg, #f6f1e8);
  padding: 28rpx;
}

.card {
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: 18rpx;
  box-shadow: 0 16rpx 36rpx rgba(32, 25, 20, 0.06);
}

.hero-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
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
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.hero-card .h1 {
  color: #fffaf0;
  font-size: 42rpx;
  line-height: 1.25;
}

.hero-subtext {
  color: rgba(255, 252, 247, 0.76);
}

.h1,
.h2,
.field-label,
.insight-item {
  color: var(--text-main, #201914);
}

.muted {
  color: var(--text-muted, #76695c);
}

.badge {
  background: var(--accent-soft, rgba(201, 164, 92, 0.14));
  border: 1rpx solid rgba(201, 164, 92, 0.24);
  color: #6f5225;
}

.profile-avatar {
  border: 2rpx solid rgba(201, 164, 92, 0.45);
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.1);
}

.text-input,
.picker-view {
  background: var(--card-soft, #fffaf3);
  border: 1rpx solid rgba(18, 60, 54, 0.12);
  color: var(--text-main, #201914);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  border-radius: 14rpx;
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.18);
}

.btn-secondary {
  background: rgba(255, 252, 247, 0.92);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  color: var(--primary, #123c36);
  border-radius: 14rpx;
  font-weight: 600;
}

/* Second visual pass */
.card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
}

.card .h2 {
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  line-height: 1.35;
}

.hero-card .h2 {
  padding-left: 0;
  border-left: 0;
}

.field {
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.07);
}

.field:last-child {
  border-bottom: 0;
}

.text-input,
.picker-view {
  box-shadow: inset 0 2rpx 8rpx rgba(32, 25, 20, 0.03);
}
</style>
