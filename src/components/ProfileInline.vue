<template>
  <view class="pi-card card-v2">
    <text class="pi-title">完善你的画像</text>
    <text class="pi-sub">信息仅用于分析，不会公开展示</text>

    <view class="pi-field">
      <text class="pi-label">性别</text>
      <view class="pi-segmented">
        <view v-for="g in genderOptions" :key="g"
          :class="['pi-seg', local.gender === g ? 'active' : '']"
          @click="local.gender = g">{{ g }}</view>
      </view>
    </view>

    <view class="pi-field">
      <text class="pi-label">年龄阶段</text>
      <picker :range="ageLabels" :value="ageIndex" @change="onAgeChange">
        <view class="pi-picker">{{ ageLabel }}</view>
      </picker>
    </view>

    <view class="pi-field">
      <text class="pi-label">身份</text>
      <input v-model="local.identity" class="pi-input" placeholder="学生、上班族等" maxlength="20" />
    </view>

    <view class="pi-field">
      <text class="pi-label">生肖</text>
      <picker :range="zodiacOptions" :value="zodiacIndex" @change="onZodiacChange">
        <view class="pi-picker">{{ local.zodiac || '请选择' }}</view>
      </picker>
    </view>

    <view class="pi-field">
      <text class="pi-label">星座</text>
      <picker :range="constellationOptions" :value="constellationIndex" @change="onConstellationChange">
        <view class="pi-picker">{{ local.constellation || '请选择' }}</view>
      </picker>
    </view>

    <button class="btn btn-primary btn-lg btn-full" :disabled="submitting" @click="onSubmit">
      {{ submitting ? '保存中...' : '确定' }}
    </button>
    <text v-if="allowSkip" class="pi-skip" @click="$emit('skip')">跳过，稍后再说</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: { gender?: string; ageRange?: string; identity?: string; zodiac?: string; constellation?: string }
  allowSkip?: boolean
  submitting?: boolean
}>(), {
  modelValue: () => ({}),
  allowSkip: false,
  submitting: false,
})

const emit = defineEmits<{
  'update:modelValue': [v: typeof props.modelValue]
  'submit': [v: typeof props.modelValue]
  'skip': []
}>()

const genderOptions = ['男', '女', '其他']
const zodiacOptions = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
const constellationOptions = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座']
const ageLabels = ['未满18岁', '18-22岁', '23-26岁', '27-30岁', '31-35岁', '36岁以上']
const ageValues = ['under18', '18_22', '23_26', '27_30', '31_35', '36_up']

const local = ref({
  gender: props.modelValue?.gender || '',
  ageRange: props.modelValue?.ageRange || '',
  identity: props.modelValue?.identity || '',
  zodiac: props.modelValue?.zodiac || '',
  constellation: props.modelValue?.constellation || '',
})

const ageIndex = computed(() => Math.max(0, ageValues.indexOf(local.value.ageRange || '')))
const ageLabel = computed(() => ageLabels[ageIndex.value] || '请选择')
const zodiacIndex = computed(() => Math.max(0, zodiacOptions.indexOf(local.value.zodiac || '')))
const constellationIndex = computed(() => Math.max(0, constellationOptions.indexOf(local.value.constellation || '')))

function onAgeChange(e: any) { local.value.ageRange = ageValues[e.detail.value] }
function onZodiacChange(e: any) { local.value.zodiac = zodiacOptions[e.detail.value] }
function onConstellationChange(e: any) { local.value.constellation = constellationOptions[e.detail.value] }

watch(local, v => emit('update:modelValue', { ...v }), { deep: true })
watch(() => props.modelValue, v => { if (v) local.value = { ...local.value, ...v } }, { deep: true })

function onSubmit() { emit('submit', { ...local.value }) }
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.pi-card { padding: 28rpx; }
.pi-title { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: #111; margin-bottom: 4rpx; }
.pi-sub { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #999; margin-bottom: 24rpx; }
.pi-field { margin-bottom: 20rpx; }
.pi-label { display: block; font-size: $fs-body; font-weight: $fw-label; color: #111; margin-bottom: 8rpx; }
.pi-input { width: 100%; height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; background: #fff; box-sizing: border-box; }
.pi-input::placeholder { color: #999; }
.pi-segmented { display: flex; gap: 12rpx; }
.pi-seg { flex: 1; height: 64rpx; line-height: 64rpx; text-align: center; border: 2rpx solid #111; background: #fff; font-size: $fs-body; font-weight: $fw-label; color: #666; &.active { background: #111; color: #FFD93D; font-weight: $fw-hero; } }
.pi-picker { height: 72rpx; line-height: 72rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; }
.pi-skip { display: block; text-align: center; margin-top: 20rpx; font-size: $fs-body; font-weight: $fw-body; color: #999; text-decoration: underline; }
</style>
