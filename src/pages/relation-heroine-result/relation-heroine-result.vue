<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="card">正在读取结果...</view>
    <view v-else-if="errorMessage" class="card error">{{ errorMessage }}</view>
    <template v-else-if="report">
      <view v-if="report.accessLevel === 'preview'" class="preview-wrap">
        <HeartPersonaReportPaywall :result-id="resultId" :report="report" @unlocked="loadReport" />
      </view>
      <template v-else>
        <view class="result-hero">
          <text class="eyebrow">{{ displayTitle }}</text>
          <text class="headline">{{ report.mode === 'target' ? '当前 Crush' : '你' }}与「{{ report.primary?.name }}」</text>
          <view class="score-ring"><text>{{ report.exactSimilarity }}</text><text>%</text></view>
          <text class="level">{{ levelText }}</text>
          <text class="confidence">观察覆盖：{{ report.observation?.answeredCount }}/{{ report.observation?.total }} · {{ confidenceText }}</text>
        </view>
        <view class="card">
          <text class="card-title">三维相处画像</text>
          <view v-for="dimension in report.dimensions || []" :key="dimension.key" class="dimension">
            <view class="dimension-head"><text>{{ dimension.name }}</text><text>{{ dimension.score }}%</text></view>
            <view class="track"><view class="fill" :style="{ width: dimension.score + '%' }" /></view>
            <text class="dimension-copy">{{ dimension.copy }}</text>
          </view>
        </view>
        <view class="card attraction"><text class="card-title">让人心动的地方</text><text>{{ report.resultCopy?.attraction }}</text></view>
        <view class="card caution"><text class="card-title">需要留意的地方</text><text>{{ report.resultCopy?.caution }}</text></view>
        <view class="card"><text class="card-title">做判断时可以观察</text><text v-for="item in report.evidence || []" :key="item.questionId" class="evidence">· {{ item.text }}</text></view>
        <view class="card"><text class="card-title">情景验证</text><text>{{ report.scenarioVerification }}</text></view>
        <view v-if="report.decision" class="card decision-card"><text class="card-title">当前关系判断</text><text class="decision-label">{{ report.decision.label }}</text><text class="decision-copy">{{ report.decision.text }}</text></view>
        <view v-if="report.strengths?.length" class="card"><text class="card-title">值得保留的信号</text><text v-for="(item,index) in report.strengths" :key="'strength_' + index" class="evidence">· {{ item }}</text></view>
        <view v-if="report.watchSignals?.length" class="card caution"><text class="card-title">需要继续验证</text><text v-for="(item,index) in report.watchSignals" :key="'watch_' + index" class="evidence">· {{ item }}</text></view>
        <view v-if="report.communicationAdvice" class="card"><text class="card-title">下一步怎么聊</text><text>{{ report.communicationAdvice }}</text></view>
      </template>
      <button class="primary" @click="retest">重新测试</button>
      <button class="secondary" @click="testAnother">测另一位{{ report.subjectGender === 'male' ? '男主角' : '女主角' }}</button>
      <button v-if="referralShareReady" class="secondary" open-type="share">分享结果</button>
      <button v-else class="secondary" disabled>邀请码准备中</button>
      <button class="text-button" @click="goHistory">查看测试记录</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import HeartPersonaReportPaywall from '@/components/HeartPersonaReportPaywall.vue'
import { getArchetypeReport, prepareCurrentUserReferralShare } from '@/utils/api'
import { appendReferralParams, isReferralShareBlocked } from '@/utils/share'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const resultId = ref('')
const report = ref<any>(null)
const referralShareReady = ref(!isReferralShareBlocked())
const displayTitle = computed(() => report.value?.subjectGender === 'male' ? '关系男主角' : '关系女主角')
const levelText = computed(() => Number(report.value?.exactSimilarity) >= 80 ? '高度相似' : Number(report.value?.exactSimilarity) >= 60 ? '明显相似' : Number(report.value?.exactSimilarity) >= 40 ? '部分相似' : '相似度较低')
const confidenceText = computed(() => ({ high: '观察充分', medium: '观察中等', low: '观察较少' } as any)[report.value?.observation?.confidence] || '')

async function loadReport() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await getArchetypeReport(resultId.value)
    if (!response?.success || !response.report) throw new Error(response?.message || '读取结果失败')
    report.value = response.report
    uni.setNavigationBarTitle({ title: `${displayTitle.value}结果` })
  } catch (error: any) { errorMessage.value = error?.message || '读取结果失败' }
  finally { loading.value = false }
}

function quizUrl(withPerson = true) {
  const query = [`mode=${report.value.mode}`]
  if (report.value.caseId) query.push(`caseId=${report.value.caseId}`)
  query.push(`subjectGender=${report.value.subjectGender}`)
  if (withPerson) query.push(`personKey=${report.value.primary?.key || ''}`)
  return `/pages/relation-heroine/relation-heroine?${query.join('&')}`
}
function retest() { uni.redirectTo({ url: quizUrl(true) }) }
function testAnother() { uni.redirectTo({ url: quizUrl(false) }) }
function goHistory() { uni.navigateTo({ url: '/pages/relation-heroine-history/relation-heroine-history' }) }

onLoad((options: any) => { resultId.value = String(options?.id || ''); loadReport() })
onShow(() => {
  referralShareReady.value = !isReferralShareBlocked()
  void prepareCurrentUserReferralShare().then((ready) => { referralShareReady.value = ready })
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
onShareAppMessage(() => isReferralShareBlocked() ? {} : ({ title: `${report.value?.mode === 'target' ? 'TA' : '我'}与${report.value?.primary?.name || displayTitle.value}的关系人设报告`, path: appendReferralParams('/pages/relation-heroine/relation-heroine?mode=self', 'relation_archetype') }))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg,#FFFDF5);color:var(--text-main,#111)}.result-hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);border-radius:var(--shape-radius-card,0);background:var(--surface,#fff);box-shadow:var(--shadow-hero,8rpx 8rpx 0 #111)}.result-hero{text-align:center;background:var(--hero-bg,#FF6B6B)}.eyebrow{display:block;font-size:$fs-micro;font-weight:$fw-label;letter-spacing:2rpx}.headline{display:block;margin:12rpx 0;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.score-ring{display:flex;align-items:flex-end;justify-content:center;width:210rpx;height:210rpx;margin:22rpx auto;border:6rpx solid var(--border,#111);border-radius:50%;background:var(--surface,#fff)}.score-ring text:first-child{font-size:$fs-display;font-weight:var(--font-weight-hero,$fw-hero);line-height:210rpx}.score-ring text:last-child{margin-bottom:45rpx;font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.level{display:block;font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.confidence{display:block;margin-top:8rpx;font-size:$fs-caption;color:var(--text-muted,#666)}.card-title{display:block;margin-bottom:16rpx;font-size:$fs-heading;font-weight:var(--font-weight-heading,$fw-heading)}.dimension{margin-top:22rpx}.dimension-head{display:flex;justify-content:space-between;font-weight:var(--font-weight-heading,$fw-heading)}.track{height:14rpx;margin:10rpx 0;border:var(--border-width,2rpx) solid var(--border,#111);overflow:hidden}.fill{height:100%;background:var(--accent,#FFD93D)}.dimension-copy,.evidence{font-size:$fs-caption;color:var(--text-muted,#666);line-height:1.5}.evidence{display:block;margin-top:10rpx}.attraction{background:var(--success-soft,#E0FFF0)}.caution{background:var(--brand-warm,#FFFBEB)}.primary,.secondary{margin-top:20rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);box-shadow:var(--shadow-hard,4rpx 4rpx 0 #111)}.primary{background:var(--accent-cool,#4ECDC4)}.secondary{background:var(--surface,#fff)}.text-button{background:transparent;font-size:$fs-caption;color:var(--text-muted,#666)}.text-button::after{border:0}.error{background:var(--risk-soft,#FFEEEC)}
.decision-card{background:var(--accent-soft,#FFF4BF)}.decision-label{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.decision-copy{display:block;margin-top:10rpx;color:var(--text-muted,#666);font-size:$fs-caption;line-height:1.5}
.decision-card{background:var(--accent-soft,#FFF4BF)}.decision-label{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.decision-copy{display:block;margin-top:10rpx;color:var(--text-muted,#666);font-size:$fs-caption;line-height:1.5}
</style>
