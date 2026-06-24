<template>
  <view class="assessment-form">
    <!-- 基础信息 -->
    <view v-if="!questionsOnly || profileOnly" class="card">
      <text class="h2">创建 Crush</text>
      <view class="field-label">关系类型</view>
      <view class="toggle-row">
        <view
          v-for="option in relationTypeOptions"
          :key="option.value"
          class="toggle-chip"
          :class="{ active: relationTypeRef === option.value }"
          @click="relationTypeRef = option.value"
        >
          {{ option.label }}
        </view>
      </view>
      <text class="muted">当前题库：{{ relationTypeLabel }}。切换类型后问答会同步调整。</text>

      <view class="field">
        <view class="field-label">Crush 名称 / 关系名称</view>
        <input
          v-model="caseName"
          class="text-input"
          placeholder="例如：A / 最近在接触的人"
        />
      </view>
    </view>

    <!-- Crush 画像 -->
    <view v-if="!questionsOnly || profileOnly" class="card">
      <text class="h2">Crush 画像</text>
      <text class="muted">画像信息仅辅助理解，不参与核心评分。</text>

      <view class="field">
        <ProfileAvatarPicker v-model="profile.avatar" />
      </view>

      <view class="grid">
        <view class="field">
          <view class="field-label">年龄</view>
          <input v-model="profile.age" class="text-input" type="number" placeholder="例如：26" />
        </view>

        <view class="field">
          <view class="field-label">性别</view>
          <picker class="field-picker" :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="picker-view">{{ profile.gender || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <view class="field-label">身份</view>
          <input v-model="profile.occupation" class="text-input" placeholder="例如：大学生、产品经理" />
        </view>

        <view class="field">
          <view class="field-label">属相</view>
          <picker :range="zodiacOptions" :value="zodiacIndex" @change="onZodiacChange">
            <view class="picker-view">{{ profile.zodiac || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <view class="field-label">星座</view>
          <picker :range="constellationOptions" :value="constellationIndex" @change="onConstellationChange">
            <view class="picker-view">{{ profile.constellation || '请选择' }}</view>
          </picker>
        </view>
      </view>
    </view>

    <!-- 结构化问答 -->
    <view v-if="!profileOnly" class="card">
      <text class="h2">结构化问答</text>
      <text class="muted">按"{{ relationTypeLabel }}"调整。</text>

      <view class="questions">
        <view
          v-for="q in structuredQuestions"
          :key="q.id"
          class="question"
        >
          <text class="q-title">{{ q.order }}. {{ q.title }}</text>
          <text v-if="q.prompt" class="muted">{{ q.prompt }}</text>
          <view class="options">
            <view
              v-for="option in q.options"
              :key="option.value"
              class="option"
              :class="{ selected: answers[q.id] === option.value }"
              @click="answers[q.id] = option.value"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 补充场景 -->
    <view v-if="!profileOnly" class="card">
      <text class="h2">关键场景补充</text>
      <view class="questions">
        <view v-for="q in textQuestions" :key="q.id" class="question">
          <text class="q-title">{{ q.order }}. {{ q.title }}</text>
          <text v-if="q.helpText" class="muted">{{ q.helpText }}</text>
          <textarea
            v-model="answers[q.id]"
            class="text-area"
            :placeholder="q.placeholder"
          />
        </view>
      </view>
    </view>

    <view class="card sticky-actions">
      <button class="btn-primary" @click="handleSubmit">{{ profileOnly ? '创建' : submitLabel }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { questionDefinitions, getQuestionsForRelationType } from './assessment-questions'
import ProfileAvatarPicker from '@/components/ProfileAvatarPicker.vue'

const props = defineProps<{
  relationType?: string
  submitLabel?: string
  initialProfile?: any
  initialName?: string
  questionsOnly?: boolean
  profileOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { name: string; answers: any[]; profile: any }): void
}>()

const relationTypeOptions = [
  { value: 'romantic', label: 'Crush' },
  { value: 'close_friend', label: 'Friend Crush' }
]
const genderOptions = ['男', '女', '非二元', '未说明']
const zodiacOptions = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationOptions = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'
]

const relationTypeRef = ref(props.relationType === 'close_friend' ? 'close_friend' : 'romantic')
const caseName = ref(props.initialName || '')
const profile = reactive({
  relationType: relationTypeRef.value,
  age: props.initialProfile?.age || '',
  gender: props.initialProfile?.gender || '',
  occupation: props.initialProfile?.occupation || '',
  zodiac: props.initialProfile?.zodiac || '',
  constellation: props.initialProfile?.constellation || '',
  avatar: props.initialProfile?.avatar || ''
})
const answers = reactive<Record<string, any>>({})

const submitLabel = computed(() => props.submitLabel || '生成分析结果')
const questionsOnly = computed(() => props.questionsOnly === true)
const profileOnly = computed(() => props.profileOnly === true)

const relationTypeLabel = computed(() =>
  relationTypeRef.value === 'close_friend' ? 'Friend Crush' : 'Crush'
)

const allQuestions = computed(() => getQuestionsForRelationType(relationTypeRef.value))
const structuredQuestions = computed(() => allQuestions.value.filter((q: any) => q.type === 'single_select'))
const textQuestions = computed(() => allQuestions.value.filter((q: any) => q.type === 'text_long'))

const genderIndex = computed(() => Math.max(0, genderOptions.indexOf(profile.gender)))
const zodiacIndex = computed(() => Math.max(0, zodiacOptions.indexOf(profile.zodiac)))
const constellationIndex = computed(() => Math.max(0, constellationOptions.indexOf(profile.constellation)))

function onGenderChange(e: any) { profile.gender = genderOptions[e.detail.value] }
function onZodiacChange(e: any) { profile.zodiac = zodiacOptions[e.detail.value] }
function onConstellationChange(e: any) { profile.constellation = constellationOptions[e.detail.value] }

function handleSubmit() {
  if (!questionsOnly.value && !caseName.value.trim()) {
    uni.showToast({ title: '请输入 Crush 名称', icon: 'none' })
    return
  }
  if (!profileOnly.value) {
    for (const q of structuredQuestions.value) {
      if (q.required && !answers[q.id]) {
        uni.showToast({ title: `请回答第 ${q.order} 题`, icon: 'none' })
        return
      }
    }
  }

  const answersArray = profileOnly.value ? [] : allQuestions.value.map((q: any) => ({
    questionId: q.id,
    value: answers[q.id] ?? ''
  }))

  profile.relationType = relationTypeRef.value
  emit('submit', {
    name: caseName.value.trim() || props.initialName || '',
    answers: answersArray,
    profile: { ...profile }
  })
}
</script>

<style scoped>
/* ===== AssessmentForm — Campus Pop ===== */
.assessment-form { padding: 0; }

.assessment-form .card {
  background: #fff; border: 3px solid #111; box-shadow: 6rpx 6rpx 0 #111;
  padding: 32rpx; margin-bottom: 24rpx; border-radius: 0;
}
.assessment-form .card .h2 { font-size: 38rpx; font-weight: 900; color: #111; text-transform: uppercase; margin-bottom: 16rpx; padding: 0; border: none; }

.assessment-form .field { margin-top: 18rpx; }
.assessment-form .field-label { display: block; font-size: 34rpx; font-weight: 800; color: #111; margin-bottom: 8rpx; }

.assessment-form .toggle-row { display: flex; gap: 12rpx; margin: 16rpx 0; }
.assessment-form .toggle-chip { padding: 14rpx 24rpx; border: 3rpx solid #111; background: #fff; font-size: 34rpx; font-weight: 700; color: #111; border-radius: 0; }
.assessment-form .toggle-chip.active { background: #111; color: #FFD93D; }

.assessment-form .text-input {
  width: 100%; height: 72rpx; padding: 0 20rpx;
  border: 3rpx solid #111; background: #fff; font-size: 36rpx; font-weight: 600; color: #111;
  box-sizing: border-box; border-radius: 0;
}
.assessment-form .text-input { width: 100%; height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: 36rpx; font-weight: 600; color: #111; box-sizing: border-box; border-radius: 0; }

.assessment-form .picker-view { height: 72rpx; line-height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: 36rpx; font-weight: 600; color: #111; border-radius: 0; }

.assessment-form .grid { display: flex; flex-direction: column; gap: 14rpx; }
.assessment-form .questions { display: flex; flex-direction: column; gap: 20rpx; margin-top: 14rpx; }
.assessment-form .question { background: #fff; border: 3rpx solid #111; padding: 24rpx; border-radius: 0; }

.assessment-form .q-title { display: block; font-size: 36rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }

.assessment-form .options { display: flex; flex-wrap: wrap; gap: 10rpx; }
.assessment-form .option { padding: 14rpx 22rpx; border: 2rpx solid #111; background: #fff; font-size: 34rpx; font-weight: 600; color: #111; border-radius: 0; }
.assessment-form .option.selected { background: #111; color: #FFD93D; }

.assessment-form .muted { display: block; font-size: 32rpx; font-weight: 600; color: #999; margin: 6rpx 0; line-height: 1.5; }
.assessment-form .text-area { width: 100%; min-height: 160rpx; padding: 18rpx; border: 3rpx solid #111; background: #fff; font-size: 36rpx; font-weight: 600; color: #111; box-sizing: border-box; font-family: inherit; }
.assessment-form .text-area::placeholder { font-size: 32rpx; color: #bbb; font-weight: 500; }

.assessment-form .btn-primary {
  width: 100%; height: 80rpx; line-height: 80rpx; text-align: center;
  background: #4ECDC4; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111;
  font-size: 36rpx; font-weight: 900; color: #111; margin-top: 14rpx;
}
.assessment-form .btn-primary:disabled { opacity: 0.6; }

.assessment-form .btn-secondary {
  width: 100%; height: 64rpx; line-height: 64rpx; text-align: center;
  background: #fff; border: 3rpx solid #111; font-size: 34rpx; font-weight: 800; color: #111; margin-top: 12rpx;
}

.assessment-form .error-message { margin-top: 14rpx; padding: 16rpx; border: 2rpx solid #FF5252; background: #FFEEEC; font-size: 34rpx; font-weight: 600; color: #FF5252; }

.assessment-form .section-head { margin-bottom: 12rpx; }
.assessment-form .actions { display: flex; gap: 10rpx; margin-top: 14rpx; }
.assessment-form .actions .btn-primary, .assessment-form .actions .btn-secondary { flex: 1; }
.assessment-form .profile-avatar { border: 3rpx solid #111; border-radius: 50%; }

.assessment-form .field .text-input { width: 100%; height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: 36rpx; font-weight: 600; color: #111; box-sizing: border-box; border-radius: 0; }
.assessment-form .field .field-picker { display: block; }
</style>
