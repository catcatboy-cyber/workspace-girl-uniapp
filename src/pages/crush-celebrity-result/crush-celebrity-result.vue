<template>
  <view class="storybook-result-page" :style="themeVars">
    <view v-if="loading" class="storybook-state">魔镜正在整理结果...</view>
    <view v-else-if="errorMessage" class="storybook-state error">{{ errorMessage }}</view>
    <template v-else-if="report">
      <HeartPersonaReportPaywall v-if="report.accessLevel === 'preview'" :result-id="resultId" :report="report" @unlocked="loadReport" />
      <HeartPersonaStorybookReport
        v-else
        :report="report"
        display-title="Crush 名人图鉴"
        :subject-label="report.subjectLabel || (report.mode === 'target' ? 'TA' : '你')"
        variant="portrait"
        ranking-title="前五名人"
      />

      <view class="storybook-actions">
        <button class="storybook-action primary" :loading="homeRouting" :disabled="homeRouting" @click="goHome">{{ report.accessLevel === 'full' ? '进入主页' : '先去主页看看' }}</button>
        <button class="storybook-action" :loading="retestRouting" :disabled="retestRouting" @click="retest">重新测试</button>
        <button v-if="shareReady" class="storybook-action share" open-type="share">分享结果</button>
        <button v-else class="storybook-action share" disabled>分享链接准备中</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import HeartPersonaReportPaywall from '@/components/HeartPersonaReportPaywall.vue'
import HeartPersonaStorybookReport from '@/components/HeartPersonaStorybookReport.vue'
import { getArchetypeReport, prepareArchetypeResultShare, prepareCurrentUserReferralShare } from '@/utils/api'
import { enterHomeFromHeartPersonaResult } from '@/utils/heart-persona-result'
import { appendReferralParams, isReferralShareBlocked } from '@/utils/share'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const resultId = ref('')
const report = ref<any>(null)
const referralShareReady = ref(!isReferralShareBlocked())
const resultShareId = ref('')
const homeRouting = ref(false)
const retestRouting = ref(false)
let loadSequence = 0
let resultSharePromise: Promise<boolean> | null = null
const shareReady = computed(() => referralShareReady.value && Boolean(resultShareId.value))
const confidenceText = computed(() => ({ high: '观察充分', medium: '观察中等', low: '观察较少' } as any)[report.value?.observation?.confidence] || '')

async function loadReport() {
  const sequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await getArchetypeReport(resultId.value)
    if (!response?.success || !response.report) throw new Error(response?.message || '读取结果失败')
    if (sequence !== loadSequence) return
    report.value = response.report
  } catch (error: any) { if (sequence === loadSequence) errorMessage.value = error?.message || '读取结果失败' }
  finally { if (sequence === loadSequence) loading.value = false }
}
function prepareResultShare() {
  if (resultShareId.value) return Promise.resolve(true)
  if (!resultId.value) return Promise.resolve(false)
  if (resultSharePromise) return resultSharePromise
  resultSharePromise = prepareArchetypeResultShare(resultId.value)
    .then((response) => {
      resultShareId.value = response?.success ? String(response?.data?.resultShareId || '') : ''
      return Boolean(resultShareId.value)
    })
    .catch(() => false)
    .finally(() => { resultSharePromise = null })
  return resultSharePromise
}
async function retest() {
  if (retestRouting.value) return
  retestRouting.value = true
  try {
    if (report.value?.entryMode === 'share_quick' && !resultShareId.value && !await prepareResultShare()) { uni.showToast({ title: '重测链接准备失败，请稍后重试', icon: 'none' }); return }
    const query = [`mode=${report.value.mode}`, `subjectGender=${report.value.subjectGender}`]
    if (report.value.entryMode === 'share_quick') query.push('entryMode=share_quick', `resultShareId=${encodeURIComponent(resultShareId.value)}`)
    else if (report.value.caseId) query.push(`caseId=${report.value.caseId}`)
    uni.redirectTo({ url: `/pages/crush-celebrity/crush-celebrity?${query.join('&')}` })
  } finally {
    retestRouting.value = false
  }
}
async function goHome() {
  if (homeRouting.value) return
  homeRouting.value = true
  try { await enterHomeFromHeartPersonaResult() }
  finally { homeRouting.value = false }
}
onLoad((options: any) => { resultId.value = String(options?.id || ''); loadReport() })
onShow(() => { if (resultId.value) loadReport(); referralShareReady.value = !isReferralShareBlocked(); void prepareCurrentUserReferralShare().then((ready) => { referralShareReady.value = ready }); void prepareResultShare(); themeVars.value = getThemeStyle(); applyThemeChrome() })
onShareAppMessage(() => !shareReady.value ? {} : ({ title: `${report.value?.mode === 'target' ? 'TA' : '我'}的人物风格报告`, path: appendReferralParams(`/pages/heart-persona-share/heart-persona-share?resultShareId=${encodeURIComponent(resultShareId.value)}`, 'heart_persona_result') }))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
@import '@/styles/heart-persona-storybook.scss';
</style>
