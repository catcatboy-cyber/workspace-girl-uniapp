<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="card">正在读取结果...</view>
    <view v-else-if="errorMessage" class="card error">{{ errorMessage }}</view>
    <template v-else-if="result && archetype">
      <view class="result-hero">
        <text class="eyebrow">YOUR RELATION ARCHETYPE</text>
        <text class="result-type">{{ displayTitle }}</text>
        <text class="headline">{{ result.mode === 'target' ? '当前 Crush' : '你' }}与「{{ archetype.name }}」</text>
        <view class="score-ring"><text>{{ result.similarity }}</text><text>%</text></view>
        <text class="level">{{ levelText }}</text>
        <text v-if="result.mode === 'target'" class="confidence">观察覆盖：{{ result.answeredCount }}/15 · {{ confidenceText }}</text>
      </view>

      <view class="card">
        <text class="card-title">三维相处画像</text>
        <view v-for="dimension in archetype.dimensions" :key="dimension.key" class="dimension">
          <view class="dimension-head"><text>{{ dimension.name }}</text><text>{{ result.dimensionScores[dimension.key] }}%</text></view>
          <view class="track"><view class="fill" :style="{ width: result.dimensionScores[dimension.key] + '%' }" /></view>
          <text class="dimension-copy">{{ result.dimensionScores[dimension.key] >= 60 ? dimension.highText : dimension.lowText }}</text>
        </view>
      </view>

      <view class="card attraction"><text class="card-title">让人心动的地方</text><text>{{ archetype.resultCopy.attraction }}</text></view>
      <view class="card caution"><text class="card-title">需要留意的地方</text><text>{{ archetype.resultCopy.caution }}</text></view>
      <view class="card"><text class="card-title">做判断时可以观察</text><text v-for="item in evidence" :key="item.id" class="evidence">· {{ item.text }}</text></view>
      <view class="card"><text class="card-title">情景验证</text><text>{{ result.scenarioVerification }}</text></view>

      <button class="primary" @click="retest">重新测试</button>
      <button class="secondary" @click="testAnother">测另一位{{ result.subjectGender === 'male' ? '男主角' : '女主角' }}</button>
      <button class="secondary" open-type="share">分享结果</button>
      <button class="text-button" @click="goHistory">查看测试记录</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { getArchetypeQuestionBank, getArchetypeResults } from '@/utils/api'
import { FEATURE_RELATION_HEROINE } from '@/utils/feature-keys'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const resultId = ref('')
const result = ref<any>(null)
const content = ref<any>(null)
const archetype = computed(() => content.value?.archetypes?.find((item: any) => item.key === result.value?.personKey))
const displayTitle = computed(() => result.value?.subjectGender === 'male' ? '关系男主角' : '关系女主角')
const levelText = computed(() => result.value.similarity >= 80 ? '高度相似' : result.value.similarity >= 60 ? '明显相似' : result.value.similarity >= 40 ? '部分相似' : '相似度较低')
const confidenceText = computed(() => ({ high: '观察充分', medium: '观察中等', low: '观察较少' } as any)[result.value?.observationConfidence] || '')
const evidence = computed(() => {
  if (!archetype.value || !result.value) return []
  const questions = [...archetype.value.universalQuestions, ...(archetype.value.stageQuestions?.[result.value.stageKey] || [])]
  const byId = new Map(questions.map((item: any) => [item.id, item]))
  const valid = (result.value.answers || []).filter((item: any) => item.value !== null).sort((a: any, b: any) => b.value - a.value)
  return [...valid.slice(0, 2), ...valid.slice(-2)].map((answer: any) => {
    const question: any = byId.get(answer.questionId)
    return { id: answer.questionId, text: result.value.mode === 'target' ? question?.textTarget : question?.textSelf }
  }).filter((item: any) => item.text)
})

async function loadResult() {
  try {
    if (!resultId.value) throw new Error('缺少测试结果 ID')
    const history = await getArchetypeResults({ kind: 'relation_archetype', resultId: resultId.value, limit: 1 })
    result.value = (history?.results || []).find((item: any) => item?._id === resultId.value)
    if (!result.value) throw new Error('测试结果不存在')
    const bankResult = await getArchetypeQuestionBank(FEATURE_RELATION_HEROINE, result.value.contentVersion, result.value.subjectGender)
    if (!bankResult?.success) throw new Error(bankResult?.message || '题库读取失败')
    content.value = bankResult.bank.content
    uni.setNavigationBarTitle({ title: `${displayTitle.value}结果` })
  } catch (error: any) { errorMessage.value = error?.message || '读取结果失败' }
  finally { loading.value = false }
}

function quizUrl(withPerson = true) {
  const query = [`mode=${result.value.mode}`]
  if (result.value.caseId) query.push(`caseId=${result.value.caseId}`)
  query.push(`subjectGender=${result.value.subjectGender}`)
  if (withPerson) query.push(`personKey=${result.value.personKey}`)
  return `/pages/relation-heroine/relation-heroine?${query.join('&')}`
}
function retest() { uni.redirectTo({ url: quizUrl(true) }) }
function testAnother() { uni.redirectTo({ url: quizUrl(false) }) }
function goHistory() { uni.navigateTo({ url: '/pages/relation-heroine-history/relation-heroine-history' }) }

onLoad((options: any) => { resultId.value = String(options?.id || ''); loadResult() })
onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
onShareAppMessage(() => ({ title: `${result.value?.mode === 'target' ? 'TA' : '我'}与${archetype.value?.name || displayTitle.value}相似度 ${result.value?.similarity || 0}%`, path: '/pages/relation-heroine/relation-heroine?mode=self' }))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5);color:var(--text-main, #111)}.result-hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-hero, 8rpx 8rpx 0 #111)}.result-hero{text-align:center;background:var(--hero-bg, #FF6B6B)}.eyebrow{display:block;font-size:$fs-micro;font-weight:$fw-label;letter-spacing:2rpx}.headline{display:block;margin:12rpx 0;font-size:$fs-heading;font-weight:var(--font-weight-hero, $fw-hero)}.score-ring{display:flex;align-items:flex-end;justify-content:center;width:210rpx;height:210rpx;margin:22rpx auto;border:6rpx solid var(--border, #111);border-radius:50%;background:var(--surface, #fff)}.score-ring text:first-child{font-size:$fs-display;font-weight:var(--font-weight-hero, $fw-hero);line-height:210rpx}.score-ring text:last-child{margin-bottom:45rpx;font-size:$fs-body;font-weight:var(--font-weight-hero, $fw-hero)}.level{display:block;font-size:$fs-body;font-weight:var(--font-weight-hero, $fw-hero)}.confidence{display:block;margin-top:8rpx;font-size:$fs-caption;color:var(--text-muted, #666)}.card-title{display:block;margin-bottom:16rpx;font-size:$fs-heading;font-weight:var(--font-weight-heading, $fw-heading)}.dimension{margin-top:22rpx}.dimension-head{display:flex;justify-content:space-between;font-weight:var(--font-weight-heading, $fw-heading)}.track{height:14rpx;margin:10rpx 0;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-xs, 0);overflow:hidden}.fill{height:100%;background:var(--accent, #FFD93D)}.dimension-copy{font-size:$fs-caption;color:var(--text-muted, #666);line-height:1.5}.attraction{background:var(--success-soft, #E0FFF0)}.caution{background:var(--brand-warm, #FFFBEB)}.evidence{display:block;margin-top:10rpx;line-height:1.5}.primary,.secondary{margin-top:20rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0);box-shadow:var(--shadow-hard, 4rpx 4rpx 0 #111)}.primary{background:var(--accent-cool, #4ECDC4)}.secondary{background:var(--surface, #fff)}.text-button{background:transparent;font-size:$fs-caption;color:var(--text-muted, #666)}.text-button::after{border:0}.error{background:var(--risk-soft, #FFEEEC)}
</style>
