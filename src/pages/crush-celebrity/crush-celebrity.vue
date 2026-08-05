<template>
  <view class="page" :style="themeVars">
    <view class="hero">
      <text class="eyebrow">CELEBRITY ATLAS</text>
      <text class="title">Crush 名人图鉴</text>
      <text class="subtitle">12 道行为题，看看{{ mode === 'target' ? ' TA' : '你' }}像哪位古今人物</text>
      <view v-if="mode === 'target' && caseName" class="target-snapshot">
        <image v-if="caseAvatar" :src="caseAvatar" mode="aspectFill" class="target-avatar" />
        <text v-else class="target-avatar target-avatar-fallback">{{ caseName.slice(0, 1) }}</text>
        <text class="chip">正在测试：{{ caseName }}</text>
      </view>
    </view>

    <view v-if="loading" class="card">正在加载 48 人图鉴...</view>
    <view v-else-if="errorMessage" class="card error">
      <text>{{ errorMessage }}</text>
      <button v-if="accessDenied" class="primary" @click="goSubscription">查看订阅套餐</button>
      <button v-if="missingProfile" class="primary" @click="goProfile">去补全画像性别</button>
      <button v-else class="primary" @click="initialize">重试</button>
      <button v-if="missingCase" class="secondary" @click="goCrushes">去 Crushes 选择</button>
    </view>

    <view v-else-if="phase === 'mode-select'" class="card">
      <text class="card-title">这次想测谁？</text>
      <button class="choice" @click="chooseMode('self')">测自己<text>我像哪位古今名人</text></button>
      <button class="choice" @click="chooseMode('target')">测当前 Crush<text>看看 TA 的人物风格</text></button>
    </view>

    <view v-else-if="phase === 'quiz' && currentQuestion" class="card">
      <ArchetypeQuizProgress :current="questionIndex + 1" :total="questions.length" label="名人匹配" />
      <text v-if="restoredDraft" class="draft-note">已恢复上次答题进度</text>
      <view class="era-chips"><text v-for="era in eraSummary" :key="era">{{ era }}</text></view>
      <text class="question">{{ questionText(currentQuestion) }}</text>
      <ArchetypeOptionList :options="currentOptions" :model-value="answers[currentQuestion.id]" @update:model-value="answerQuestion" />
      <view class="nav">
        <button class="text-button" @click="previous">上一题</button>
        <button class="text-button" @click="showAtlas = !showAtlas">{{ showAtlas ? '收起图鉴' : '看看人物池' }}</button>
      </view>
      <button class="text-button danger" @click="confirmExit">退出并保留草稿</button>
      <scroll-view v-if="showAtlas" scroll-x class="atlas-strip">
        <view class="atlas-row">
          <CelebrityPersonCard v-for="person in enabledPeople" :key="person.key" :person="person" @select="openPerson" />
        </view>
      </scroll-view>
    </view>

    <view v-else class="card">正在计算五维画像和 48 人相似度...</view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import ArchetypeOptionList from '@/components/archetype/ArchetypeOptionList.vue'
import ArchetypeQuizProgress from '@/components/archetype/ArchetypeQuizProgress.vue'
import CelebrityPersonCard from '@/components/archetype/CelebrityPersonCard.vue'
import { checkFeatureAccess, getArchetypeQuestionBank, getCaseDetail, getCurrentUserId, getSelfProfile, saveArchetypeResult } from '@/utils/api'
import { getActiveCaseId } from '@/utils/helpers'
import { FEATURE_CRUSH_CELEBRITY } from '@/utils/feature-keys'
import { clearArchetypeDraft, getArchetypeDraftKey, loadArchetypeDraft, saveArchetypeDraft } from '@/utils/archetype-storage'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())
const loading = ref(true)
const errorMessage = ref('')
const missingCase = ref(false)
const accessDenied = ref(false)
const missingProfile = ref(false)
const phase = ref('quiz')
const caseId = ref('')
const caseName = ref('')
const caseAvatar = ref('')
const questionIndex = ref(0)
const showAtlas = ref(false)
const restoredDraft = ref(false)
const allowBack = ref(false)
const submitting = ref(false)
const mode = ref<'self' | 'target' | ''>('')
const bank = ref<any>(null)
const answers = reactive<Record<string, string>>({})

const content = computed(() => bank.value?.content || { questions: [], people: [] })
const questions = computed(() => content.value.questions || [])
const currentQuestion = computed(() => questions.value[questionIndex.value])
const enabledPeople = computed(() => (content.value.people || []).filter((person: any) => person.enabled !== false))
const eraSummary = computed(() => [
  `历史 ${enabledPeople.value.filter((person: any) => person.era === 'history').length}`,
  `近代 ${enabledPeople.value.filter((person: any) => person.era === 'modern').length}`,
  `当代 ${enabledPeople.value.filter((person: any) => person.era === 'contemporary').length}`
])
const currentOptions = computed(() => {
  const list = (currentQuestion.value?.options || []).map((item: any) => ({
    key: item.key,
    text: mode.value === 'target' ? item.textTarget : item.textSelf
  }))
  if (mode.value === 'target') list.push({ key: 'U', text: '无法判断 / 没观察到' })
  return list
})

function questionText(item: any) { return mode.value === 'target' ? item?.textTarget || '' : item?.textSelf || '' }
function currentPath() { return `/pages/crush-celebrity/crush-celebrity?mode=${mode.value || 'self'}${caseId.value ? `&caseId=${caseId.value}` : ''}` }
function goLogin() { uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(currentPath())}` }) }
function goCrushes() { uni.switchTab({ url: '/pages/cases/cases' }) }
function goSubscription() { uni.navigateTo({ url: '/pages/subscription/subscription' }) }
function goProfile() { uni.navigateTo({ url: mode.value === 'target' ? `/pages/case-detail/case-detail?caseId=${encodeURIComponent(caseId.value)}` : '/pages/edit-profile/edit-profile' }) }
function draftKey() { return getArchetypeDraftKey({ kind: 'crush_celebrity', userId: getCurrentUserId() || '', mode: mode.value as any, caseId: caseId.value, contentVersion: bank.value.contentVersion }) }

function persist() {
  if (!bank.value || !mode.value) return
  saveArchetypeDraft(draftKey(), {
    kind: 'crush_celebrity',
    mode: mode.value as any,
    caseId: mode.value === 'target' ? caseId.value : undefined,
    answers: Object.entries(answers).map(([questionId, optionKey]) => ({ questionId, optionKey: optionKey as any })),
    contentVersion: bank.value.contentVersion,
    updatedAt: Date.now()
  })
}

async function initialize() {
  loading.value = true
  errorMessage.value = ''
  missingCase.value = false
  accessDenied.value = false
  missingProfile.value = false
  restoredDraft.value = false
  const userId = getCurrentUserId()
  if (!userId) { loading.value = false; goLogin(); return }
  try {
    const access = await checkFeatureAccess(FEATURE_CRUSH_CELEBRITY)
    if (!access?.success || !access?.allowed) {
      accessDenied.value = true
      errorMessage.value = '当前套餐未开放 Crush 名人图鉴。'
      return
    }
    if (mode.value === 'target') {
      caseId.value = caseId.value || getActiveCaseId() || ''
      if (!caseId.value) {
        missingCase.value = true
        errorMessage.value = '请先选择当前 Crush。'
        return
      }
      const detail: any = await getCaseDetail(userId, caseId.value)
      caseName.value = detail?.profile?.nickname || detail?.profile?.name || detail?.name || '当前 Crush'
      caseAvatar.value = detail?.profile?.avatarUrl || detail?.profile?.avatar || ''
      if (!['male', 'female'].includes(String(detail?.profile?.gender || '').trim())) {
        missingProfile.value = true
        errorMessage.value = '请先补全当前 Crush 画像中的性别信息。'
        return
      }
    } else {
      const profile: any = await getSelfProfile()
      if (!['male', 'female'].includes(String(profile?.selfProfile?.gender || '').trim())) {
        missingProfile.value = true
        errorMessage.value = '请先补全自己的画像性别信息。'
        return
      }
    }
    const result = await getArchetypeQuestionBank(FEATURE_CRUSH_CELEBRITY)
    if (!result?.success || !result?.bank) throw new Error(result?.message || '题库尚未发布')
    bank.value = result.bank
    if (!mode.value) { phase.value = 'mode-select'; return }

    Object.keys(answers).forEach((key) => delete answers[key])
    const draft: any = loadArchetypeDraft(draftKey())
    const questionIds = new Set(questions.value.map((question: any) => question.id))
    for (const item of draft?.answers || []) {
      if (questionIds.has(item.questionId)) answers[item.questionId] = item.optionKey
    }
    restoredDraft.value = Object.keys(answers).length > 0
    const firstUnanswered = questions.value.findIndex((question: any) => !answers[question.id])
    questionIndex.value = firstUnanswered >= 0 ? firstUnanswered : Math.max(0, questions.value.length - 1)
    phase.value = 'quiz'
  } catch (error: any) {
    errorMessage.value = error?.message || '加载测试失败'
  } finally {
    loading.value = false
  }
}

function chooseMode(value: 'self' | 'target') {
  mode.value = value
  caseId.value = value === 'target' ? getActiveCaseId() || '' : ''
  if (value === 'target' && !caseId.value) {
    missingCase.value = true
    errorMessage.value = '请先选择当前 Crush。'
    return
  }
  initialize()
}

function answerQuestion(value: string) {
  if (!currentQuestion.value) return
  answers[currentQuestion.value.id] = value
  persist()
  if (questionIndex.value < questions.value.length - 1) questionIndex.value += 1
  else submit()
}

function previous() { if (questionIndex.value > 0) questionIndex.value -= 1; else confirmExit() }
function openPerson(key: string) { uni.navigateTo({ url: `/pages/crush-celebrity-person/crush-celebrity-person?personKey=${key}` }) }

async function submit() {
  if (submitting.value) return
  submitting.value = true
  phase.value = 'submitting'
  try {
    const response = await saveArchetypeResult({
      kind: 'crush_celebrity',
      mode: mode.value,
      ...(mode.value === 'target' ? { caseId: caseId.value } : {}),
      answers: questions.value.map((question: any) => ({ questionId: question.id, optionKey: answers[question.id] })),
      contentVersion: bank.value.contentVersion
    })
    if (!response?.success) throw new Error(response?.message || '保存失败')
    clearArchetypeDraft(draftKey())
    uni.redirectTo({ url: `/pages/crush-celebrity-result/crush-celebrity-result?id=${encodeURIComponent(response.result._id)}` })
  } catch (error: any) {
    errorMessage.value = error?.message || '生成结果失败'
    phase.value = 'quiz'
  } finally {
    submitting.value = false
  }
}

function confirmExit() {
  persist()
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
  mode.value = options?.mode === 'target' ? 'target' : options?.mode === 'self' ? 'self' : ''
  caseId.value = String(options?.caseId || '').trim()
  initialize()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

onBackPress(() => {
  if (allowBack.value) return false
  if (phase.value === 'submitting') return true
  if (phase.value === 'quiz' && Object.keys(answers).length > 0) {
    confirmExit()
    return true
  }
  return false
})
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5);color:var(--text-main, #111)}.hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-hero, 8rpx 8rpx 0 #111)}.hero{background:var(--hero-bg, #FF6B6B)}.eyebrow{display:block;font-size:$fs-micro;font-weight:$fw-label;letter-spacing:3rpx}.title{display:block;font-size:$fs-hero-title;font-weight:var(--font-weight-hero, $fw-hero)}.subtitle{display:block;margin-top:8rpx;font-size:$fs-body}.target-snapshot{display:flex;align-items:center;gap:12rpx;margin-top:14rpx}.target-avatar{width:58rpx;height:58rpx;flex:0 0 58rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:50%;background:var(--surface, #fff)}.target-avatar-fallback{display:flex;align-items:center;justify-content:center;font-weight:var(--font-weight-hero, $fw-hero)}.chip{display:inline-block;padding:8rpx 14rpx;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0);background:var(--accent, #FFD93D);font-size:$fs-micro;font-weight:var(--font-weight-heading, $fw-heading)}.card-title{font-size:$fs-heading;font-weight:var(--font-weight-heading, $fw-heading)}.choice{display:flex;flex-direction:column;align-items:flex-start;width:100%;margin-top:18rpx;padding:22rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-inner, 0);background:var(--surface, #fff);box-shadow:var(--shadow-card, 6rpx 6rpx 0 #111)}.choice text{font-size:$fs-caption;color:var(--text-muted, #666)}.question{display:block;margin:24rpx 0;font-size:$fs-heading;line-height:1.45;font-weight:var(--font-weight-hero, $fw-hero)}.draft-note{display:block;margin-top:14rpx;color:var(--text-muted, #666);font-size:$fs-micro}.era-chips{display:flex;gap:10rpx}.era-chips text{padding:6rpx 12rpx;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0);font-size:$fs-micro;color:var(--text-muted, #666)}.nav{display:flex;justify-content:space-between}.text-button{background:transparent;color:var(--text-muted, #666);font-size:$fs-caption}.text-button::after{border:0}.danger{color:var(--risk, #FF5252)}.atlas-strip{margin-top:18rpx;white-space:nowrap}.atlas-row{display:flex;gap:12rpx}.primary,.secondary{margin-top:18rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0)}.primary{background:var(--accent-cool, #4ECDC4);box-shadow:var(--shadow-hard, 4rpx 4rpx 0 #111)}.secondary{background:var(--surface, #fff)}.error{background:var(--risk-soft, #FFEEEC)}
</style>
