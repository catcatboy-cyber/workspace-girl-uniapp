<template>
  <view class="profile-fields">
    <view class="field">
      <text class="field-label">头像</text>
      <ProfileAvatarPicker v-model="localProfile.avatar" />
    </view>

    <view class="field">
      <text class="field-label">关系类型</text>
      <picker :range="relationTypeLabels" :value="relationTypeIndex" @change="onRelationTypeChange">
        <view class="picker-view">{{ relationTypeLabel }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="field-label">年龄</text>
      <input v-model="localProfile.age" type="number" class="text-input" placeholder="例如：26" />
    </view>

    <view class="field">
      <text class="field-label">性别</text>
      <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
        <view class="picker-view">{{ localProfile.gender || '请选择' }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="field-label">工作</text>
      <input v-model="localProfile.occupation" class="text-input" placeholder="例如：产品经理 / 自由职业" />
    </view>

    <view class="field">
      <text class="field-label">属相</text>
      <picker :range="zodiacOptions" :value="zodiacIndex" @change="onZodiacChange">
        <view class="picker-view">{{ localProfile.zodiac || '请选择' }}</view>
      </picker>
    </view>

    <view class="field">
      <text class="field-label">星座</text>
      <picker :range="constellationOptions" :value="constellationIndex" @change="onConstellationChange">
        <view class="picker-view">{{ localProfile.constellation || '请选择' }}</view>
      </picker>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ProfileAvatarPicker from './ProfileAvatarPicker.vue'

const props = withDefaults(defineProps<{
  modelValue?: {
    relationType?: string
    avatar?: string
    age?: string
    gender?: string
    occupation?: string
    zodiac?: string
    constellation?: string
  }
}>(), {
  modelValue: () => ({})
})

const emit = defineEmits<{
  'update:modelValue': [value: typeof props.modelValue]
}>()

const relationTypeOptions = [
  { value: 'romantic', label: 'Crush' },
  { value: 'close_friend', label: 'Friend Crush' }
]

const genderOptions = ['男', '女', '其他']
const zodiacOptions = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationOptions = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'
]

const localProfile = ref({ ...props.modelValue })

const relationTypeLabels = relationTypeOptions.map(opt => opt.label)
const relationTypeIndex = computed(() => {
  const idx = relationTypeOptions.findIndex(opt => opt.value === localProfile.value.relationType)
  return idx >= 0 ? idx : 0
})
const relationTypeLabel = computed(() => {
  return relationTypeOptions[relationTypeIndex.value]?.label || '请选择'
})

const genderIndex = computed(() => {
  const idx = genderOptions.indexOf(localProfile.value.gender || '')
  return idx >= 0 ? idx : 0
})

const zodiacIndex = computed(() => {
  const idx = zodiacOptions.indexOf(localProfile.value.zodiac || '')
  return idx >= 0 ? idx : 0
})

const constellationIndex = computed(() => {
  const idx = constellationOptions.indexOf(localProfile.value.constellation || '')
  return idx >= 0 ? idx : 0
})

function onRelationTypeChange(e: any) {
  const index = e.detail.value
  localProfile.value.relationType = relationTypeOptions[index]?.value
}

function onGenderChange(e: any) {
  const index = e.detail.value
  localProfile.value.gender = genderOptions[index]
}

function onZodiacChange(e: any) {
  const index = e.detail.value
  localProfile.value.zodiac = zodiacOptions[index]
}

function onConstellationChange(e: any) {
  const index = e.detail.value
  localProfile.value.constellation = constellationOptions[index]
}

watch(localProfile, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

watch(() => props.modelValue, (newVal) => {
  if (!newVal || JSON.stringify(newVal) === JSON.stringify(localProfile.value)) return
  localProfile.value = { ...newVal }
}, { deep: true })
</script>

<style scoped>
.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.field-label {
  font-size: 26rpx;
  font-weight: 800;
  color: #111;
}

.text-input {
  height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 3rpx solid #111;
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
  box-sizing: border-box;
}

.picker-view {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border: 3rpx solid #111;
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
}
</style>
