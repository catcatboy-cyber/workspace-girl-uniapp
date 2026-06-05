<template>
  <view class="page v2-mode" :style="themeVars">
    <view v-if="loading" class="loading-v2">加载中...</view>

    <view v-else-if="!caseFile" class="card-v2">
      <text class="section-title-v2">无法编辑画像</text>
      <text class="card-text-v2">当前 Crush 不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">EDIT PROFILE / {{ caseFile.name }}</text>
        <view class="hero-head-v2">
          <view class="profile-avatar-v2 lg">
            <image v-if="profile.avatar" :src="profile.avatarPreviewUrl || profile.avatar" mode="aspectFill" />
            <text v-else class="avatar-placeholder-v2">{{ avatarLabel(caseName || caseFile.name) }}</text>
          </view>
          <view class="hero-copy-v2">
            <text class="hero-title-v2">修改 Crush 名称和画像信息</text>
            <text class="hero-copy-v2-sub">更新的是 Crush 资料层信息，不会改动历史分析。</text>
          </view>
        </view>
        <view class="hero-actions-v2">
          <button class="btn-v2 sm" @click="goCaseDetail">返回我们</button>
          <button class="btn-v2 sm" @click="goTimeline">查看往事</button>
        </view>
      </view>

      <view v-if="profileItems.length > 0" class="card-v2">
        <text class="section-title-v2">当前画像预览</text>
        <view class="tag-row-v2">
          <text v-for="item in profileItems" :key="item" class="tag-v2">{{ item }}</text>
        </view>
      </view>

      <view v-if="profileInsight" class="card-v2">
        <text class="section-title-v2">{{ profileInsight.title }}</text>
        <text class="card-text-v2 insight-summary">{{ profileInsight.summary }}</text>
        <view class="insight-list-v2">
          <text v-for="item in profileInsight.bullets" :key="item" class="insight-item-v2">{{ item }}</text>
        </view>
        <text class="card-text-v2">{{ profileInsight.disclaimer }}</text>
      </view>

      <view class="card-v2">
        <text class="section-title-v2">Crush 基础信息</text>
        <view class="field-v2">
          <text class="field-label-v2">Crush 名称 / 关系名称</text>
          <input v-model="caseName" class="input-v2" />
        </view>
      </view>

      <view class="card-v2">
        <text class="section-title-v2">Crush 画像</text>
        <text class="card-text-v2">这些信息只用于辅助理解，不参与核心评分。</text>

        <view class="field-v2">
          <text class="field-label-v2">关系类型</text>
          <picker :range="relationTypeLabels" :value="relationTypeIndex" @change="onRelationTypeChange">
            <view class="picker-v2">{{ relationTypeLabel }}</view>
          </picker>
        </view>

        <view class="field-v2">
          <text class="field-label-v2">年龄</text>
          <input v-model="profile.age" type="number" class="input-v2" placeholder="例如：26" />
        </view>

        <view class="field-v2">
          <text class="field-label-v2">性别</text>
          <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="picker-v2">{{ profile.gender || '请选择' }}</view>
          </picker>
        </view>

        <view class="field-v2">
          <text class="field-label-v2">工作</text>
          <input v-model="profile.occupation" class="input-v2" />
        </view>

        <view class="field-v2">
          <text class="field-label-v2">属相</text>
          <picker :range="zodiacOptions" :value="zodiacIndex" @change="onZodiacChange">
            <view class="picker-v2">{{ profile.zodiac || '请选择' }}</view>
          </picker>
        </view>

        <view class="field-v2">
          <text class="field-label-v2">星座</text>
          <picker :range="constellationOptions" :value="constellationIndex" @change="onConstellationChange">
            <view class="picker-v2">{{ profile.constellation || '请选择' }}</view>
          </picker>
        </view>

        <view class="field-v2">
          <text class="field-label-v2">头像</text>
          <ProfileAvatarPicker v-model="profile.avatar" @preview-change="onAvatarPreviewChange" />
        </view>
      </view>

      <view class="card-v2">
        <button class="btn-v2-l" :disabled="saving" @click="onSave">
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

const relationTypeOptions = ['romantic', 'close_friend']
const relationTypeLabels = ['Crush', 'Friend Crush']
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
const relationTypeLabel = computed(() => relationTypeLabels[relationTypeIndex.value] || 'Crush')
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
    showError('请填写 Crush 名称')
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
.page { min-height: 100vh; background: #f4ede2; padding: 18rpx; box-sizing: border-box; }

/* V2 Mode */
.v2-mode { background: var(--app-bg, #FFFDF5); }
.v2-mode .loading-v2 { text-align: center; padding: 60rpx 0; font-size: 26rpx; font-weight: 600; color: #666; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B);
  border: 3rpx solid #111;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 8rpx 8rpx 0 #111;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 {
  display: inline-block;
  background: #111;
  color: #FFD93D;
  padding: 6rpx 16rpx;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.v2-mode .hero-title-v2 {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  color: #111;
  line-height: 1.15;
  letter-spacing: -2rpx;
  text-transform: uppercase;
}
.v2-mode .hero-head-v2 { display: flex; gap: 20rpx; align-items: center; margin-top: 14rpx; }
.v2-mode .hero-copy-v2 { flex: 1; }
.v2-mode .hero-copy-v2-sub {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(0,0,0,0.7);
  line-height: 1.6;
  margin-top: 6rpx;
}
.v2-mode .hero-actions-v2 { display: flex; gap: 12rpx; margin-top: 20rpx; flex-wrap: wrap; }

.v2-mode .profile-avatar-v2 {
  border-radius: 50%;
  overflow: hidden;
  background: #f9f9f9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 3rpx solid #111;
}
.v2-mode .profile-avatar-v2.lg { width: 120rpx; height: 120rpx; }
.v2-mode .profile-avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 36rpx; font-weight: 900; color: #111; }

.v2-mode .card-v2 {
  background: #fff;
  border: 3rpx solid #111;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 6rpx 6rpx 0 #111;
}
.v2-mode .section-title-v2 {
  display: block;
  font-size: 22rpx;
  font-weight: 900;
  color: #111;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 10rpx;
}
.v2-mode .card-text-v2 {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #666;
  line-height: 1.6;
  margin: 6rpx 0;
}

/* Tags */
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .tag-v2 {
  display: inline-flex;
  align-items: center;
  min-height: 36rpx;
  padding: 4rpx 14rpx;
  background: #FFD93D;
  border: 2rpx solid #111;
  font-size: 20rpx;
  font-weight: 800;
  color: #111;
}

/* Insight */
.v2-mode .insight-summary { margin-bottom: 12rpx; }
.v2-mode .insight-list-v2 { display: flex; flex-direction: column; gap: 8rpx; margin: 12rpx 0; }
.v2-mode .insight-item-v2 { font-size: 26rpx; font-weight: 700; color: #111; line-height: 1.6; }

/* Fields */
.v2-mode .field-v2 { margin-top: 16rpx; padding: 18rpx 0; border-bottom: 2rpx solid #111; }
.v2-mode .field-v2:last-child { border-bottom: 0; }
.v2-mode .field-label-v2 {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #111;
  margin-bottom: 8rpx;
}
.v2-mode .input-v2 {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 2rpx solid #111;
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
  box-sizing: border-box;
}
.v2-mode .picker-v2 {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 3rpx solid #111;
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
}

/* Buttons */
.v2-mode .btn-v2-l {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #4ECDC4;
  color: #111;
  border: 3rpx solid #111;
  font-size: 32rpx;
  font-weight: 800;
  box-shadow: 4rpx 4rpx 0 #111;
}
.v2-mode .btn-v2-l[disabled] { opacity: 0.5; }
.v2-mode .btn-v2 {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  background: #fff;
  color: #111;
  border: 3rpx solid #111;
  font-size: 24rpx;
  font-weight: 800;
}
.v2-mode .btn-v2.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2.sm {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  font-size: 24rpx;
}
</style>
