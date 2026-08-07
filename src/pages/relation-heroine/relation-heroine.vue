<template>
  <view class="page" :style="themeVars">
    <view class="hero-card">
      <text class="eyebrow">RELATION ARCHETYPE</text>
      <text class="title">{{ displayTitle }}</text>
      <text class="subtitle">测测{{ mode === 'target' ? (isShareQuick ? 'TA' : '当前 Crush') : '你' }}更像哪种相处风格</text>
      <text v-if="mode === 'target' && caseName" class="target-chip">正在测试：{{ caseName }}</text>
      <text v-if="selectedArchetype" class="person-chip">指定匹配：{{ mode === 'target' ? (caseName || 'TA') : '我' }} × {{ selectedArchetype.name }}</text>
    </view>

    <view v-if="loading" class="state-card">正在加载题库...</view>
    <view v-else-if="errorMessage" class="state-card error-card">
      <text>{{ errorMessage }}</text>
      <button v-if="accessDenied" class="primary" @click="goSubscription">查看订阅套餐</button>
      <button v-else class="primary" @click="initialize">重试</button>
      <button v-if="missingCase" class="secondary" @click="goCrushes">去 Crushes 选择</button>
    </view>

    <view v-else-if="phase === 'mode-select'" class="card">
      <text class="card-title">这次想测谁？</text>
      <button class="choice-card" @click="chooseMode('self')">测自己<text>看看我的关系人设</text></button>
      <button class="choice-card" @click="chooseMode('target')">测当前 Crush<text>测试当前选中的 TA</text></button>
    </view>

    <view v-else-if="phase === 'gender-select'" class="card">
      <text class="card-title">这次想测哪套关系主角？</text>
      <text class="card-desc">{{ mode === 'target' ? '当前 Crush' : '你的' }}性别资料未说明。这个选择只用于本次测试，不会修改个人资料。</text>
      <button class="choice-card" @click="chooseSubjectGender('female')">测关系女主角<text>匹配女性关系风格原型</text></button>
      <button class="choice-card" @click="chooseSubjectGender('male')">测关系男主角<text>匹配男性关系风格原型</text></button>
    </view>

    <view v-else-if="phase === 'person-select'" class="card">
      <text class="card-title">先选这次要匹配的主角</text>
      <text class="card-desc">这是指定人物风格测试。选定后，再判断{{ mode === 'target' ? (caseName || 'TA') : '你' }}像不像这一型。</text>
      <button v-for="person in availableArchetypes" :key="person.key" :class="['person-card', selectedPersonKey === person.key ? 'selected' : '']" @click="choosePerson(person.key)">
        <view><text class="person-name">{{ person.name }}</text><text class="person-label">{{ person.label }}</text></view>
        <text>{{ person.label || '进入这一型的专属测试' }}</text>
      </button>
    </view>

    <view v-else-if="phase === 'stage-select'" class="card">
      <text class="card-title">你们现在到哪一步？</text>
      <text class="card-desc">阶段不计分，只用于切换更贴近现实的题目。</text>
      <button v-for="stage in content.stages" :key="stage.key" class="choice-card" @click="chooseStage(stage.key)">{{ stage.label }}</button>
      <button v-if="!directPersonKey" class="text-button" @click="returnToPersonSelect">更换测试主角</button>
    </view>

    <view v-else-if="phase === 'screener'" class="card">
      <ArchetypeQuizProgress :current="screenerIndex + 1" :total="content.screener.length" :label="`${selectedArchetype?.name || '主角'} · 关系观察`" />
      <text class="question">{{ modeText(currentScreener) }}</text>
      <ArchetypeOptionList :options="screenerOptions" :model-value="screenerAnswers[currentScreener.id]" @update:model-value="answerScreener" />
      <button class="text-button" @click="previousScreener">{{ screenerIndex > 0 ? '上一题' : '返回关系阶段' }}</button>
    </view>

    <view v-else-if="phase === 'quiz'" class="card">
      <ArchetypeQuizProgress :current="quizIndex + 1" :total="quizQuestions.length" :label="selectedArchetype?.name + '专测'" />
      <text v-if="restoredDraft" class="draft-note">已恢复上次答题进度</text>
      <text class="stage-chip">{{ stageLabel }}</text>
      <text class="question">{{ modeText(currentQuizQuestion) }}</text>
      <ArchetypeOptionList :options="likertOptions" :model-value="quizAnswers[currentQuizQuestion.id]" @update:model-value="answerQuiz" />
      <view class="nav-row"><button class="text-button" @click="previousQuiz">上一题</button><button class="text-button danger" @click="confirmExit">退出并保留草稿</button></view>
    </view>

    <view v-else-if="phase === 'scenario'" class="card">
      <ArchetypeQuizProgress :current="scenarioIndex + 1" :total="scenarioQuestions.length" :label="`${selectedArchetype?.name || '主角'} · 情景验证`" />
      <text class="question">{{ modeText(currentScenario) }}</text>
      <ArchetypeOptionList :options="scenarioOptions" :model-value="scenarioAnswers[currentScenario.id]" @update:model-value="answerScenario" />
      <button class="text-button" @click="previousScenario">上一题</button>
    </view>

    <view v-else-if="phase === 'submitting'" class="state-card">正在生成相似度结果...</view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import ArchetypeOptionList from '@/components/archetype/ArchetypeOptionList.vue'
import ArchetypeQuizProgress from '@/components/archetype/ArchetypeQuizProgress.vue'
import { getArchetypeQuestionBank, getCaseDetail, getCurrentUserId, getSelfProfile, saveArchetypeResult, waitForCurrentUserId } from '@/utils/api'
import { getActiveCaseId } from '@/utils/helpers'
import { FEATURE_RELATION_HEROINE } from '@/utils/feature-keys'
import { clearArchetypeDraft, getArchetypeDraftKey, loadArchetypeDraft, saveArchetypeDraft } from '@/utils/archetype-storage'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { relationDisplayTitle, resolveRelationSubjectGender, type RelationSubjectGender } from '@/utils/relation-gender'
import { ensureSilentWechatLogin } from '@/utils/silent-login'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const missingCase = ref(false)
const accessDenied = ref(false)
const restoredDraft = ref(false)
const allowBack = ref(false)
const submitting = ref(false)
const phase = ref('stage-select')
const mode = ref<'self' | 'target' | ''>('')
const caseId = ref('')
const caseName = ref('')
const bank = ref<any>(null)
const content = computed(() => bank.value?.content || { stages: [], screener: [], archetypes: [] })
const stageKey = ref('')
const screenerIndex = ref(0)
const screenerAnswers = reactive<Record<string, string>>({})
const selectedPersonKey = ref('')
const quizIndex = ref(0)
const quizAnswers = reactive<Record<string, string>>({})
const scenarioIndex = ref(0)
const scenarioAnswers = reactive<Record<string, string>>({})
const directPersonKey = ref('')
const entryMode = ref<'standard' | 'share_quick'>('standard')
const resultShareId = ref('')
const subjectGender = ref<RelationSubjectGender | ''>('')
const requestedSubjectGender = ref<RelationSubjectGender | ''>('')
const displayTitle = computed(() => bank.value?.displayTitle || (subjectGender.value ? relationDisplayTitle(subjectGender.value) : '关系主角测试'))
const isShareQuick = computed(() => entryMode.value === 'share_quick')

const selectedArchetype = computed(() => content.value.archetypes?.find((item: any) => item.key === selectedPersonKey.value))
const currentScreener = computed(() => content.value.screener?.[screenerIndex.value])
const quizQuestions = computed(() => selectedArchetype.value ? [...selectedArchetype.value.universalQuestions, ...(selectedArchetype.value.stageQuestions?.[stageKey.value] || [])] : [])
const currentQuizQuestion = computed(() => quizQuestions.value[quizIndex.value])
const scenarioQuestions = computed(() => selectedArchetype.value?.scenarios?.[stageKey.value] || [])
const currentScenario = computed(() => scenarioQuestions.value[scenarioIndex.value])
const stageLabel = computed(() => content.value.stages?.find((item: any) => item.key === stageKey.value)?.label || '')
const availableArchetypes = computed(() => (content.value.archetypes || []).filter((item: any) => item.enabled !== false))

const likertOptions = computed(() => {
  const label = mode.value === 'target' ? 'TA' : '我'
  const options = [
    { key: 'A', text: `非常像${label}` }, { key: 'B', text: `比较像${label}` },
    { key: 'C', text: '一般 / 看情况' }, { key: 'D', text: `不太像${label}` }, { key: 'E', text: `完全不像${label}` }
  ]
  if (mode.value === 'target') options.push({ key: 'U', text: '无法判断 / 没观察到' })
  return options
})
const screenerOptions = computed(() => {
  const options = (currentScreener.value?.options || []).map((item: any) => ({ key: item.key, text: mode.value === 'target' ? item.textTarget : item.textSelf }))
  if (mode.value === 'target') options.push({ key: 'U', text: '无法判断 / 没观察到' })
  return options
})
const scenarioOptions = computed(() => {
  const options = (currentScenario.value?.options || []).map((item: any) => ({ key: item.key, text: item.text }))
  if (mode.value === 'target') options.push({ key: 'U', text: '无法判断 / 没观察到' })
  return options
})

function modeText(item: any) { return mode.value === 'target' ? item?.textTarget || '' : item?.textSelf || '' }
function currentPath() { return `/pages/relation-heroine/relation-heroine?mode=${mode.value || 'self'}${caseId.value ? `&caseId=${caseId.value}` : ''}${requestedSubjectGender.value ? `&subjectGender=${requestedSubjectGender.value}` : ''}${directPersonKey.value ? `&personKey=${directPersonKey.value}` : ''}${isShareQuick.value ? `&entryMode=share_quick&resultShareId=${encodeURIComponent(resultShareId.value)}` : ''}` }
function goLogin() { uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(currentPath())}` }) }
function goCrushes() { uni.switchTab({ url: '/pages/cases/cases' }) }
function goSubscription() { uni.navigateTo({ url: '/pages/subscription/subscription' }) }

async function initialize() {
  loading.value = true
  errorMessage.value = ''
  missingCase.value = false
  accessDenied.value = false
  restoredDraft.value = false
  let userId = getCurrentUserId()
  if (!userId && isShareQuick.value) userId = await ensureSilentWechatLogin() || await waitForCurrentUserId()
  if (!userId) {
    loading.value = false
    if (isShareQuick.value) { errorMessage.value = '网络有点慢，正在等待登录完成，请重试。'; return }
    goLogin()
    return
  }
  try {
    if (!mode.value) { phase.value = 'mode-select'; return }
    let crushProfile: any = null
    let selfProfile: any = null
    if (isShareQuick.value) {
      caseId.value = ''
      caseName.value = mode.value === 'target' ? 'TA' : ''
      if (!resultShareId.value || !requestedSubjectGender.value) throw new Error('分享测试参数不完整，请返回分享页重新进入。')
    } else if (mode.value === 'target') {
      caseId.value = caseId.value || getActiveCaseId() || ''
      if (!caseId.value) {
        missingCase.value = true
        errorMessage.value = '请先在首页滑动或 Crushes 页面选择当前 Crush。'
        loading.value = false
        return
      }
      const detail: any = await getCaseDetail(userId, caseId.value)
      caseName.value = detail?.profile?.nickname || detail?.profile?.name || detail?.name || '当前 Crush'
      crushProfile = detail?.profile || null
    } else {
      const profileResult: any = await getSelfProfile()
      selfProfile = profileResult?.selfProfile || null
    }
    const resolvedGender = isShareQuick.value
      ? requestedSubjectGender.value
      : resolveRelationSubjectGender({ mode: mode.value, selfProfile, crushProfile, fallback: requestedSubjectGender.value })
    if (resolvedGender === 'unknown') { phase.value = 'gender-select'; return }
    subjectGender.value = resolvedGender
    const result = await getArchetypeQuestionBank(FEATURE_RELATION_HEROINE, '', resolvedGender)
    if (!result?.success || !result?.bank) throw new Error(result?.message || '题库尚未发布')
    bank.value = result.bank
    uni.setNavigationBarTitle({ title: displayTitle.value })
    if (directPersonKey.value && content.value.archetypes.some((item: any) => item.key === directPersonKey.value)) selectedPersonKey.value = directPersonKey.value
    if (!mode.value) phase.value = 'mode-select'
    else phase.value = selectedPersonKey.value ? 'stage-select' : 'person-select'
  } catch (error: any) { errorMessage.value = error?.message || '加载测试失败' }
  finally { loading.value = false }
}

function chooseSubjectGender(value: RelationSubjectGender) {
  requestedSubjectGender.value = value
  subjectGender.value = value
  initialize()
}

function chooseMode(value: 'self' | 'target') {
  mode.value = value
  if (value === 'target') {
    caseId.value = getActiveCaseId() || ''
    if (!caseId.value) { missingCase.value = true; errorMessage.value = '请先选择当前 Crush。'; return }
  }
  initialize()
}

function clearAnswerState() {
  Object.keys(screenerAnswers).forEach((key) => delete screenerAnswers[key])
  Object.keys(quizAnswers).forEach((key) => delete quizAnswers[key])
  Object.keys(scenarioAnswers).forEach((key) => delete scenarioAnswers[key])
  screenerIndex.value = 0
  quizIndex.value = 0
  scenarioIndex.value = 0
}

function choosePerson(personKey: string) {
  if (!availableArchetypes.value.some((item: any) => item.key === personKey)) return
  if (selectedPersonKey.value !== personKey) clearAnswerState()
  selectedPersonKey.value = personKey
  stageKey.value = ''
  phase.value = 'stage-select'
}

function returnToPersonSelect() {
  stageKey.value = ''
  clearAnswerState()
  phase.value = 'person-select'
}

function chooseStage(value: string) {
  if (!selectedPersonKey.value) { phase.value = 'person-select'; return }
  stageKey.value = value
  const universalIds = new Set((selectedArchetype.value?.universalQuestions || []).map((question: any) => question.id))
  Object.keys(quizAnswers).forEach((key) => { if (!universalIds.has(key)) delete quizAnswers[key] })
  Object.keys(scenarioAnswers).forEach((key) => delete scenarioAnswers[key])
  Object.keys(screenerAnswers).forEach((key) => delete screenerAnswers[key])
  screenerIndex.value = 0
  phase.value = 'screener'
}

function answerScreener(value: string) {
  screenerAnswers[currentScreener.value.id] = value
  if (screenerIndex.value < content.value.screener.length - 1) { screenerIndex.value += 1; return }
  startPerson(selectedPersonKey.value)
}

function previousScreener() {
  if (screenerIndex.value > 0) { screenerIndex.value -= 1; return }
  phase.value = 'stage-select'
}

function draftKey() {
  return getArchetypeDraftKey({ kind: 'relation_archetype', subjectGender: subjectGender.value as RelationSubjectGender, userId: getCurrentUserId() || '', mode: mode.value as any, caseId: caseId.value, personKey: selectedPersonKey.value, entryMode: entryMode.value, resultShareId: resultShareId.value, contentVersion: bank.value.contentVersion })
}
function persistDraft() {
  if (!selectedPersonKey.value || !bank.value || !mode.value) return
  saveArchetypeDraft(draftKey(), { kind: 'relation_archetype', subjectGender: subjectGender.value as RelationSubjectGender, mode: mode.value as any, caseId: !isShareQuick.value && mode.value === 'target' ? caseId.value : undefined, stageKey: stageKey.value as any, personKey: selectedPersonKey.value, answers: Object.entries(quizAnswers).map(([questionId, optionKey]) => ({ questionId, optionKey: optionKey as any })), scenarioAnswers: Object.entries(scenarioAnswers).map(([questionId, optionKey]) => ({ questionId, optionKey: optionKey as any })), contentVersion: bank.value.contentVersion, updatedAt: Date.now() })
}

function startPerson(personKey: string) {
  const changingPerson = selectedPersonKey.value && selectedPersonKey.value !== personKey
  if (changingPerson) {
    Object.keys(quizAnswers).forEach((key) => delete quizAnswers[key])
    Object.keys(scenarioAnswers).forEach((key) => delete scenarioAnswers[key])
  }
  selectedPersonKey.value = personKey
  quizIndex.value = 0
  scenarioIndex.value = 0
  const draft: any = loadArchetypeDraft(draftKey())
  if (draft?.stageKey === stageKey.value) {
    for (const answer of draft.answers || []) quizAnswers[answer.questionId] = answer.optionKey
    for (const answer of draft.scenarioAnswers || []) scenarioAnswers[answer.questionId] = answer.optionKey
  }
  restoredDraft.value = Object.keys(quizAnswers).length > 0 || Object.keys(scenarioAnswers).length > 0
  const firstQuizUnanswered = quizQuestions.value.findIndex((question: any) => !quizAnswers[question.id])
  if (firstQuizUnanswered >= 0) {
    quizIndex.value = firstQuizUnanswered
    phase.value = 'quiz'
    return
  }
  const firstScenarioUnanswered = scenarioQuestions.value.findIndex((question: any) => !scenarioAnswers[question.id])
  scenarioIndex.value = firstScenarioUnanswered >= 0 ? firstScenarioUnanswered : Math.max(0, scenarioQuestions.value.length - 1)
  phase.value = 'scenario'
}

function answerQuiz(value: string) {
  quizAnswers[currentQuizQuestion.value.id] = value
  persistDraft()
  if (quizIndex.value < quizQuestions.value.length - 1) quizIndex.value += 1
  else { scenarioIndex.value = 0; phase.value = 'scenario' }
}
function previousQuiz() {
  if (quizIndex.value > 0) { quizIndex.value -= 1; return }
  screenerIndex.value = Math.max(0, content.value.screener.length - 1)
  phase.value = 'screener'
}
function answerScenario(value: string) {
  scenarioAnswers[currentScenario.value.id] = value
  persistDraft()
  if (scenarioIndex.value < scenarioQuestions.value.length - 1) scenarioIndex.value += 1
  else submit()
}
function previousScenario() { if (scenarioIndex.value > 0) scenarioIndex.value -= 1; else { phase.value = 'quiz'; quizIndex.value = quizQuestions.value.length - 1 } }

async function submit() {
  if (submitting.value) return
  submitting.value = true
  phase.value = 'submitting'
  try {
    persistDraft()
    if (isShareQuick.value && !getCurrentUserId() && !(await ensureSilentWechatLogin()) && !(await waitForCurrentUserId())) {
      throw new Error('登录尚未完成，答案已保存，请稍后重试。')
    }
    const result = await saveArchetypeResult({
      kind: 'relation_archetype', subjectGender: subjectGender.value, mode: mode.value, entryMode: entryMode.value,
      ...(isShareQuick.value ? { resultShareId: resultShareId.value } : mode.value === 'target' ? { caseId: caseId.value } : {}),
      stageKey: stageKey.value, personKey: selectedPersonKey.value,
      answers: quizQuestions.value.map((question: any) => ({ questionId: question.id, optionKey: quizAnswers[question.id] })),
      scenarioAnswers: scenarioQuestions.value.map((question: any) => ({ questionId: question.id, optionKey: scenarioAnswers[question.id] })),
      contentVersion: bank.value.contentVersion
    })
    if (!result?.success) throw new Error(result?.message || '保存失败')
    clearArchetypeDraft(draftKey())
    uni.redirectTo({ url: `/pages/relation-heroine-result/relation-heroine-result?id=${encodeURIComponent(result.resultId)}` })
  } catch (error: any) { errorMessage.value = error?.message || '生成结果失败'; phase.value = 'scenario' }
  finally { submitting.value = false }
}

function confirmExit() {
  persistDraft()
  uni.showModal({
    title: '退出测试？',
    content: '当前答案已保存为草稿，下次进入可以继续。',
    confirmText: '退出并保留',
    cancelText: '继续答题',
    success: (result) => {
      if (!result.confirm) return
      allowBack.value = true
      uni.navigateBack({ fail: () => { allowBack.value = false } })
    }
  })
}

onLoad((options: any) => {
  entryMode.value = options?.entryMode === 'share_quick' ? 'share_quick' : 'standard'
  resultShareId.value = String(options?.resultShareId || '').trim()
  mode.value = options?.mode === 'target' ? 'target' : options?.mode === 'self' ? 'self' : ''
  caseId.value = String(options?.caseId || '').trim()
  directPersonKey.value = String(options?.personKey || '').trim()
  requestedSubjectGender.value = options?.subjectGender === 'male' ? 'male' : options?.subjectGender === 'female' ? 'female' : ''
  initialize()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

onBackPress(() => {
  if (allowBack.value) return false
  if (phase.value === 'submitting') return true
  if (['quiz', 'scenario'].includes(phase.value) && selectedPersonKey.value) {
    confirmExit()
    return true
  }
  return false
})
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5);color:var(--text-main, #111)}.hero-card,.card,.state-card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-hero, 8rpx 8rpx 0 #111)}.hero-card{background:var(--hero-bg, #FF6B6B)}.eyebrow{display:block;font-size:$fs-micro;font-weight:$fw-label;letter-spacing:3rpx}.title{display:block;font-size:$fs-hero-title;font-weight:var(--font-weight-hero, $fw-hero)}.subtitle{display:block;margin-top:8rpx;font-size:$fs-body}.target-chip,.person-chip,.stage-chip{display:inline-block;margin-top:16rpx;padding:8rpx 16rpx;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0);font-size:$fs-micro;font-weight:var(--font-weight-heading, $fw-heading)}.target-chip,.stage-chip{background:var(--accent, #FFD93D)}.person-chip{display:block;width:fit-content;background:var(--accent-cool, #4ECDC4)}.card-title{display:block;font-size:$fs-heading;font-weight:var(--font-weight-heading, $fw-heading)}.card-desc{display:block;margin:10rpx 0 20rpx;color:var(--text-muted, #666);line-height:1.5}.choice-card,.person-card{display:flex;flex-direction:column;align-items:flex-start;width:100%;min-height:88rpx;margin-top:18rpx;padding:22rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-inner, 0);background:var(--surface, #fff);text-align:left;box-shadow:var(--shadow-card, 6rpx 6rpx 0 #111)}.choice-card text,.person-card>text{margin-top:6rpx;font-size:$fs-caption;color:var(--text-muted, #666)}.person-card.selected{background:var(--brand-warm, #FFFBEB)}.person-name{font-size:$fs-body;font-weight:var(--font-weight-hero, $fw-hero)}.person-label{margin-left:12rpx;font-size:$fs-micro}.question{display:block;margin:24rpx 0;font-size:$fs-heading;line-height:1.45;font-weight:var(--font-weight-hero, $fw-hero)}.nav-row{display:flex;justify-content:space-between}.text-button{min-height:88rpx;margin:22rpx 0 0;padding:8rpx 0;background:transparent;color:var(--text-muted, #666);font-size:$fs-caption}.text-button::after{border:0}.danger{color:var(--risk, #FF5252)}.primary,.secondary{margin-top:20rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0)}.primary{background:var(--accent-cool, #4ECDC4);box-shadow:var(--shadow-hard, 4rpx 4rpx 0 #111)}.secondary{background:var(--surface, #fff)}.error-card{background:var(--risk-soft, #FFEEEC)}.state-card{text-align:center}
.draft-note{display:block;margin-top:14rpx;color:var(--text-muted, #666);font-size:$fs-micro}
</style>
