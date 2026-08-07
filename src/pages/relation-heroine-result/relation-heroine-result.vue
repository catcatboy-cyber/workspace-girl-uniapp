<template>
  <view class="storybook-result-page" :style="themeVars">
    <view v-if="loading" class="storybook-state">魔镜正在整理结果...</view>
    <view v-else-if="errorMessage" class="storybook-state error">{{ errorMessage }}</view>
    <template v-else-if="report">
      <HeartPersonaReportPaywall v-if="report.accessLevel === 'preview'" :result-id="resultId" :report="report" @unlocked="loadReport" />
      <HeartPersonaStorybookReport
        v-else
        :report="report"
        :display-title="displayTitle"
        :subject-label="subjectLabel"
        variant="relation"
        ranking-title="关系主角图鉴"
      />

      <view class="storybook-actions">
        <button class="storybook-action primary" :loading="homeRouting" :disabled="homeRouting" @click="goHome">{{ report.accessLevel === 'full' ? '进入主页' : '先去主页看看' }}</button>
        <button class="storybook-action" :loading="quizRoutingAction === 'retest'" :disabled="Boolean(quizRoutingAction)" @click="retest">重新测试</button>
        <button class="storybook-action" :loading="quizRoutingAction === 'another'" :disabled="Boolean(quizRoutingAction)" @click="testAnother">测另一位{{ report.subjectGender === 'male' ? '男主角' : '女主角' }}</button>
        <button v-if="shareReady" class="storybook-action share" open-type="share">分享结果</button>
        <button v-else class="storybook-action share" disabled>分享链接准备中</button>
        <button class="storybook-action text" @click="goHistory">查看测试记录</button>
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
const quizRoutingAction = ref<'retest' | 'another' | ''>('')
let loadSequence = 0
let resultSharePromise: Promise<boolean> | null = null
const shareReady = computed(() => referralShareReady.value && Boolean(resultShareId.value))
const displayTitle = computed(() => report.value?.subjectGender === 'male' ? '关系男主角' : '关系女主角')
const subjectLabel = computed(() => report.value?.subjectLabel || (report.value?.mode !== 'target' ? '你' : report.value?.entryMode === 'share_quick' ? 'TA（快速测试）' : '当前 Crush'))
const levelText = computed(() => Number(report.value?.exactSimilarity) >= 80 ? '高度相似' : Number(report.value?.exactSimilarity) >= 60 ? '明显相似' : Number(report.value?.exactSimilarity) >= 40 ? '部分相似' : '相似度较低')
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
    uni.setNavigationBarTitle({ title: `${displayTitle.value}结果` })
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

function quizUrl(withPerson = true) {
  const query = [`mode=${report.value.mode}`]
  if (report.value.entryMode === 'share_quick') {
    query.push('entryMode=share_quick', `resultShareId=${encodeURIComponent(resultShareId.value)}`)
  } else if (report.value.caseId) query.push(`caseId=${report.value.caseId}`)
  query.push(`subjectGender=${report.value.subjectGender}`)
  if (withPerson) query.push(`personKey=${report.value.primary?.key || ''}`)
  return `/pages/relation-heroine/relation-heroine?${query.join('&')}`
}
async function ensureQuickRetestReady() {
  if (report.value?.entryMode !== 'share_quick') return true
  if (resultShareId.value || await prepareResultShare()) return true
  uni.showToast({ title: '重测链接准备失败，请稍后重试', icon: 'none' })
  return false
}
async function routeToQuiz(action: 'retest' | 'another', withPerson: boolean) {
  if (quizRoutingAction.value) return
  quizRoutingAction.value = action
  try {
    if (await ensureQuickRetestReady()) uni.redirectTo({ url: quizUrl(withPerson) })
  } finally {
    quizRoutingAction.value = ''
  }
}
function retest() { return routeToQuiz('retest', true) }
function testAnother() { return routeToQuiz('another', false) }
async function goHome() {
  if (homeRouting.value) return
  homeRouting.value = true
  try { await enterHomeFromHeartPersonaResult() }
  finally { homeRouting.value = false }
}
function goHistory() { uni.navigateTo({ url: '/pages/relation-heroine-history/relation-heroine-history' }) }

onLoad((options: any) => { resultId.value = String(options?.id || ''); loadReport() })
onShow(() => {
  if (resultId.value) loadReport()
  referralShareReady.value = !isReferralShareBlocked()
  void prepareCurrentUserReferralShare().then((ready) => { referralShareReady.value = ready })
  void prepareResultShare()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})
onShareAppMessage(() => !shareReady.value ? {} : ({ title: `${report.value?.mode === 'target' ? 'TA' : '我'}与${report.value?.primary?.name || displayTitle.value}的关系人设报告`, path: appendReferralParams(`/pages/heart-persona-share/heart-persona-share?resultShareId=${encodeURIComponent(resultShareId.value)}`, 'heart_persona_result') }))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
@import '@/styles/heart-persona-storybook.scss';
</style>
