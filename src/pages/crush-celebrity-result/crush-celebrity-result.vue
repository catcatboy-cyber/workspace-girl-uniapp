<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="card">正在读取结果...</view>
    <view v-else-if="errorMessage" class="card error">{{ errorMessage }}</view>
    <template v-else-if="report">
      <HeartPersonaReportPaywall v-if="report.accessLevel === 'preview'" :result-id="resultId" :report="report" @unlocked="loadReport" />
      <template v-else>
        <view class="hero">
          <text class="eyebrow">TOP MATCH</text>
          <image v-if="report.primary?.coverUrl" :src="report.primary.coverUrl" mode="aspectFill" class="avatar" />
          <view v-else class="avatar">{{ String(report.primary?.name || '人').slice(0,1) }}</view>
          <text class="title">{{ report.mode === 'target' ? 'TA' : '你' }}最像「{{ report.primary?.name }}」</text>
          <text class="score">{{ report.exactSimilarity }}%</text>
          <text class="summary">{{ report.primaryDetail?.summary || report.primary?.label }}</text>
        </view>
        <view v-if="report.secondary" class="card secondary-card"><text class="card-title">双原型组合</text><text>第二像「{{ report.secondary.name }}」</text></view>
        <view class="card"><text class="card-title">五维关系画像</text><view v-for="dimension in report.dimensions || []" :key="dimension.key" class="dimension"><view><text>{{ dimension.name }}</text><text>{{ dimension.score }}%</text></view><view class="track"><view class="fill" :style="{width: dimension.score + '%'}" /></view><text class="copy-line">{{ dimension.copy }}</text></view></view>
        <view class="card"><text class="card-title">前五名人</text><view v-for="(item,index) in report.topFive || []" :key="item.personKey" class="rank"><text>{{ index + 1 }} · {{ item.name }}</text><text>{{ item.similarity }}%</text></view></view>
        <view v-if="report.decision" class="card decision-card"><text class="card-title">当前关系判断</text><text class="decision-label">{{ report.decision.label }}</text><text class="decision-copy">{{ report.decision.text }}</text></view>
        <view v-if="report.strengths?.length" class="card"><text class="card-title">值得保留的信号</text><text v-for="(item,index) in report.strengths" :key="'strength_' + index" class="signal">· {{ item }}</text></view>
        <view v-if="report.watchSignals?.length" class="card watch-card"><text class="card-title">需要继续验证</text><text v-for="(item,index) in report.watchSignals" :key="'watch_' + index" class="signal">· {{ item }}</text></view>
        <view v-if="report.communicationAdvice" class="card"><text class="card-title">下一步怎么聊</text><text>{{ report.communicationAdvice }}</text></view>
        <text class="confidence">观察覆盖 {{ report.observation?.answeredCount }}/{{ report.observation?.total }} · {{ confidenceText }}</text>
      </template>
      <button class="primary" @click="retest">重新测试</button>
      <button v-if="referralShareReady" class="secondary" open-type="share">分享结果</button>
      <button v-else class="secondary" disabled>邀请码准备中</button>
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
const confidenceText = computed(() => ({ high: '观察充分', medium: '观察中等', low: '观察较少' } as any)[report.value?.observation?.confidence] || '')

async function loadReport() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await getArchetypeReport(resultId.value)
    if (!response?.success || !response.report) throw new Error(response?.message || '读取结果失败')
    report.value = response.report
  } catch (error: any) { errorMessage.value = error?.message || '读取结果失败' }
  finally { loading.value = false }
}
function openPerson(key: string) { uni.navigateTo({ url: `/pages/crush-celebrity-person/crush-celebrity-person?personKey=${key}` }) }
function retest() { uni.redirectTo({ url: `/pages/crush-celebrity/crush-celebrity?mode=${report.value.mode}${report.value.caseId ? `&caseId=${report.value.caseId}` : ''}` }) }
onLoad((options: any) => { resultId.value = String(options?.id || ''); loadReport() })
onShow(() => { referralShareReady.value = !isReferralShareBlocked(); void prepareCurrentUserReferralShare().then((ready) => { referralShareReady.value = ready }); themeVars.value = getThemeStyle(); applyThemeChrome() })
onShareAppMessage(() => isReferralShareBlocked() ? {} : ({ title: `${report.value?.mode === 'target' ? 'TA' : '我'}的人物风格报告`, path: appendReferralParams('/pages/crush-celebrity/crush-celebrity?mode=self', 'crush_celebrity') }))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg,#FFFDF5);color:var(--text-main,#111)}.hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);background:var(--surface,#fff);box-shadow:var(--shadow-hero,8rpx 8rpx 0 #111)}.hero{text-align:center;background:var(--hero-bg,#FF6B6B)}.eyebrow{font-weight:$fw-label;letter-spacing:3rpx;font-size:$fs-micro}.avatar{display:flex;align-items:center;justify-content:center;width:150rpx;height:150rpx;margin:20rpx auto;border:5rpx solid var(--border,#111);border-radius:50%;background:var(--surface,#fff);font-size:$fs-hero-title;font-weight:var(--font-weight-hero,$fw-hero)}.title{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.score{display:block;font-size:$fs-display;font-weight:var(--font-weight-hero,$fw-hero)}.summary,.copy-line{line-height:1.5;font-size:$fs-body}.card-title{display:block;margin-bottom:14rpx;font-size:$fs-heading;font-weight:var(--font-weight-heading,$fw-heading)}.secondary-card{background:var(--risk-soft,#FFEEEC)}.dimension>view:first-child,.rank{display:flex;justify-content:space-between;margin-top:14rpx;font-weight:var(--font-weight-heading,$fw-heading)}.track{height:14rpx;margin-top:8rpx;border:var(--border-width,2rpx) solid var(--border,#111);overflow:hidden}.fill{height:100%;background:var(--accent,#FFD93D)}.rank{padding:14rpx;border-bottom:2rpx dashed var(--divider,#aaa)}.confidence{display:block;text-align:center;color:var(--text-muted,#666);font-size:$fs-caption}.primary,.secondary{margin-top:20rpx;border:var(--border-width-strong,3rpx) solid var(--border,#111);box-shadow:var(--shadow-hard,4rpx 4rpx 0 #111)}.primary{background:var(--accent-cool,#4ECDC4)}.secondary{background:var(--surface,#fff)}.error{background:var(--risk-soft,#FFEEEC)}
.decision-card{background:var(--accent-soft,#FFF4BF)}.watch-card{background:var(--risk-soft,#FFEEEC)}.decision-label{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.decision-copy,.signal{display:block;margin-top:10rpx;line-height:1.5}
</style>
