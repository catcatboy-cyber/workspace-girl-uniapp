<template>
  <view class="assessment-form">
    <!-- 基础信息 -->
    <view v-if="!questionsOnly" class="card">
      <text class="h2">创建关系对象</text>
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
        <view class="field-label">对象名称 / 关系名称</view>
        <input
          v-model="caseName"
          class="text-input"
          placeholder="例如：A / 最近在接触的人"
        />
      </view>
    </view>

    <!-- 对象画像 -->
    <view v-if="!questionsOnly" class="card">
      <text class="h2">对象画像</text>
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
          <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="picker-view">{{ profile.gender || '请选择' }}</view>
          </picker>
        </view>

        <view class="field">
          <view class="field-label">工作</view>
          <input v-model="profile.occupation" class="text-input" placeholder="例如：产品经理" />
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
    <view class="card">
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
    <view class="card">
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
      <button class="btn-primary" @click="handleSubmit">{{ submitLabel }}</button>
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
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { name: string; answers: any[]; profile: any }): void
}>()

const relationTypeOptions = [
  { value: 'romantic', label: '恋爱对象' },
  { value: 'close_friend', label: '亲密朋友' }
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

const submitLabel = computed(() => props.submitLabel || '生成评估结果')
const questionsOnly = computed(() => props.questionsOnly === true)

const relationTypeLabel = computed(() =>
  relationTypeRef.value === 'close_friend' ? '亲密朋友' : '恋爱对象'
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
    uni.showToast({ title: '请输入对象名称', icon: 'none' })
    return
  }
  // 验证必填单选
  for (const q of structuredQuestions.value) {
    if (q.required && !answers[q.id]) {
      uni.showToast({ title: `请回答第 ${q.order} 题`, icon: 'none' })
      return
    }
  }

  const answersArray = allQuestions.value.map((q: any) => ({
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
.assessment-form { padding: 0; }
.card {
  background: #fbf6ee;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.h2 {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: #241b12;
  margin-bottom: 12rpx;
}
.muted {
  display: block;
  font-size: 24rpx;
  color: #786857;
  margin: 8rpx 0;
}
.field { margin-top: 20rpx; }
.field-label {
  font-size: 26rpx;
  color: #241b12;
  margin-bottom: 10rpx;
}
.text-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #241b12;
  box-sizing: border-box;
}
.text-area {
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx 24rpx;
  background: #fff;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #241b12;
  box-sizing: border-box;
}
.picker-view {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #241b12;
}
.toggle-row {
  display: flex;
  gap: 16rpx;
  margin: 16rpx 0;
  flex-wrap: wrap;
}
.toggle-chip {
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 2rpx solid #e5ddd0;
  font-size: 26rpx;
  color: #241b12;
}
.toggle-chip.active {
  background: #143f3a;
  color: #fff;
  border-color: #143f3a;
}
.grid { display: flex; flex-direction: column; gap: 16rpx; }
.questions { display: flex; flex-direction: column; gap: 24rpx; margin-top: 16rpx; }
.question {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  border: 2rpx solid #efe7d8;
}
.q-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #241b12;
  margin-bottom: 10rpx;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 12rpx;
}
.option {
  padding: 18rpx 22rpx;
  background: #fbf6ee;
  border: 2rpx solid #e5ddd0;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #241b12;
}
.option.selected {
  background: #143f3a;
  color: #fff;
  border-color: #143f3a;
}
.sticky-actions { text-align: center; }
.btn-primary {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #143f3a;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
