<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <!-- ==================== Onboarding：对话式 ==================== -->
    <template v-if="isOnboarding">
      <view class="chat-head">
        <text class="chat-head-title">小咪认识你</text>
        <button class="btn btn-ghost btn-sm" :disabled="saving" @click="onSkip">先跳过</button>
      </view>

      <scroll-view class="chat-area" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="true">
        <view v-for="(msg, i) in messages" :key="i" :id="'msg-' + i" :class="['msg', msg.role === 'pet' ? 'msg-pet' : 'msg-user']">
          <view v-if="msg.role === 'pet'" class="msg-avatar"><image :src="petAvatar" mode="aspectFill" style="width:100%;height:100%;" /></view>
          <view v-if="msg.role === 'pet'" class="msg-bubble">
            <text v-for="(line, li) in msg.lines" :key="li" :class="['msg-line', line.style || '']">{{ line.text }}</text>
          </view>
          <view v-if="msg.role === 'user' && msg.type === 'answer'" class="msg-answer">
            <text>{{ msg.text }}</text>
          </view>
          <view v-if="msg.role === 'user' && msg.type === 'chips'" class="msg-chips">
            <view v-for="chip in msg.chips" :key="chip" :class="['msg-chip', msg.picked === chip ? 'picked' : '']" @click="pickChip(msg, chip)">{{ chip }}</view>
          </view>
        </view>
        <view v-if="typing" class="msg msg-pet">
          <view class="msg-avatar"><image :src="petAvatar" mode="aspectFill" style="width:100%;height:100%;" /></view>
          <view class="msg-typing"><view></view><view></view><view></view></view>
        </view>
        <view style="height:40rpx;"></view>
      </scroll-view>

      <view class="chat-foot">
        <view class="chat-progress">
          <view v-for="i in totalOnboardingSteps" :key="i" :class="['progress-dot', step >= i ? 'done' : '']"></view>
        </view>
        <text class="chat-step-text">{{ step >= totalOnboardingSteps ? '全部完成' : step >= 5 ? '最后一步' : step + ' / ' + totalOnboardingSteps }}</text>
      </view>
    </template>

    <!-- ==================== 编辑：原版表单 ==================== -->
    <template v-else>
      <view class="hero-block-v2">
        <text class="hero-tag-v2">SELF PROFILE</text>
        <text class="hero-title-v2">你的<text class="hl-v2">互动模式</text></text>
        <text class="hero-copy-v2">这些信息只用于调整用词和后续分析语气，不会公开展示。</text>
      </view>
      <view class="card-v2">
        <text class="section-title-v2">基础画像</text>
        <view class="field-v2">
          <text class="field-label-v2">我是</text>
          <view class="segmented-v2">
            <view v-for="item in genderOptions" :key="item.value" :class="['segment-v2', profile.gender === item.value ? 'active' : '']" @click="profile.gender = item.value">{{ item.label }}</view>
          </view>
        </view>
        <view class="field-v2">
          <text class="field-label-v2">年龄阶段</text>
          <picker :range="ageLabels" :value="ageIndex" @change="onAgeChange">
            <view class="picker-v2">{{ ageLabel }}</view>
          </picker>
          <text v-if="profile.ageRange === 'under18'" class="minor-note-v2">未满 18 岁时，系统会优先使用同学、朋友和边界感相关表达。</text>
        </view>
        <view class="field-v2">
          <text class="field-label-v2">目前身份</text>
          <picker :range="identityLabels" :value="identityIndex" @change="onIdentityChange">
            <view class="picker-v2">{{ identityLabel }}</view>
          </picker>
        </view>
      </view>
      <view class="card-v2">
        <text class="section-title-v2">趣味标签</text>
        <text class="card-text-v2">属相和星座只作为轻娱乐标签，不参与核心判断。</text>
        <view class="field-v2">
          <text class="field-label-v2">属相</text>
          <picker :range="zodiacLabels" :value="zodiacIndex" @change="onZodiacChange">
            <view class="picker-v2">{{ zodiacLabel }}</view>
          </picker>
        </view>
        <view class="field-v2">
          <text class="field-label-v2">星座</text>
          <picker :range="constellationLabels" :value="constellationIndex" @change="onConstellationChange">
            <view class="picker-v2">{{ constellationLabel }}</view>
          </picker>
        </view>
      </view>
      <view class="card-v2" style="display:flex;flex-direction:column;gap:14rpx;">
        <button class="btn btn-primary btn-lg btn-full" :disabled="saving" @click="onSave">{{ saving ? '保存中...' : '保存并进入' }}</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getCachedSelfProfile,
  getCurrentUserId,
  getSelfProfile,
  markSelfProfileSkipped,
  updateSelfProfile,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { showError, showSuccess } from '@/utils/helpers'
import { getPetById, getSelectedPetId } from '@/utils/pets.js'
import { aiLabel } from '@/utils/labels'

const petAvatar = getPetById(getSelectedPetId()).avatarPath

// ====== Options ======
const genderOptions = [
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' },
  { value: 'private', label: '暂不说' }
]

const ageOptions = [
  { value: '', label: '请选择' },
  { value: 'under18', label: '18 岁以下' },
  { value: '18_22', label: '18-22 岁' },
  { value: '23_26', label: '23-26 岁' },
  { value: '27_plus', label: '27 岁以上' }
]

const identityOptions = [
  { value: '', label: '请选择' },
  { value: 'high_school', label: '高中 / 中专' },
  { value: 'college', label: '大学生' },
  { value: 'graduate', label: '研究生' },
  { value: 'worker', label: '已工作' },
  { value: 'other', label: '其他' }
]

const zodiacOptions = ['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationOptions = ['', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']

// onboarding 专用
const ageChips = ['18 岁以下', '18–22 岁', '23–26 岁', '27 岁以上']
const ageMap: Record<string, string> = {
  '18 岁以下': 'under18',
  '18–22 岁': '18_22',
  '23–26 岁': '23_26',
  '27 岁以上': '27_plus'
}

const genderChips = genderOptions.map(o => o.label)
const genderMap: Record<string, string> = { '男生': 'male', '女生': 'female', '暂不说': 'private' }

const identityChips = ['高中/中专', '大学生', '研究生', '已工作', '其他']
const identityMap: Record<string, string> = {
  '高中/中专': 'high_school',
  '大学生': 'college',
  '研究生': 'graduate',
  '已工作': 'worker',
  '其他': 'other'
}

const zodiacChips = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const constellationChips = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']

// ====== State ======
const themeVars = ref(getThemeStyle())
const saving = ref(false)
const isOnboarding = ref(false)
const pendingRedirect = ref('')
const step = ref(0)
const typing = ref(false)
const scrollTarget = ref('')
const messages = ref<Msg[]>([])

const profile = reactive<SelfProfile>({
  gender: '',
  ageRange: '',
  identity: '',
  zodiac: '',
  constellation: ''
})

type Msg =
  | { role: 'pet'; type: 'text'; lines: { text: string; style?: string }[] }
  | { role: 'user'; type: 'chips'; chips: string[]; key: string; picked: string }
  | { role: 'user'; type: 'answer'; text: string }

// ====== 编辑模式 picker labels ======
const ageLabels = ageOptions.map((item) => item.label)
const identityLabels = identityOptions.map((item) => item.label)
const zodiacLabels = zodiacOptions.map((item) => item || '不选择')
const constellationLabels = constellationOptions.map((item) => item || '不选择')

const ageIndex = computed(() => Math.max(0, ageOptions.findIndex((item) => item.value === profile.ageRange)))
const identityIndex = computed(() => Math.max(0, identityOptions.findIndex((item) => item.value === profile.identity)))
const zodiacIndex = computed(() => Math.max(0, zodiacOptions.indexOf(profile.zodiac || '')))
const constellationIndex = computed(() => Math.max(0, constellationOptions.indexOf(profile.constellation || '')))
const ageLabel = computed(() => ageOptions[ageIndex.value]?.label || '请选择')
const identityLabel = computed(() => identityOptions[identityIndex.value]?.label || '请选择')
const zodiacLabel = computed(() => profile.zodiac || '不选择')
const constellationLabel = computed(() => profile.constellation || '不选择')

// ====== Onboarding questions ======
const questions = [
  {
    pet: [
      { text: '这条我可以帮你看，但要先知道一点你的状态。' },
      { text: '同一句话，在不同年龄和关系阶段里，含义会不一样。', style: 'muted' },
      { text: '你多大了？' }
    ],
    chips: ageChips,
    key: 'ageRange' as const,
    map: ageMap
  },
  {
    pet: [
      { text: '收到！那你是男生还是女生？' },
      { text: '（选哪个都行，只是我会根据它调整说话方式）', style: 'muted' }
    ],
    chips: genderChips,
    key: 'gender' as const,
    map: genderMap
  },
  {
    pet: [
      { text: '嗯，最后问问——你现在在上学还是工作了？' }
    ],
    chips: identityChips,
    key: 'identity' as const,
    map: identityMap
  },
  {
    pet: [
      { text: '再来两个轻松的问题～你的属相是什么？' },
      { text: '（属相只作为轻娱乐标签，不参与核心判断）', style: 'muted' }
    ],
    chips: zodiacChips,
    key: 'zodiac' as const
  },
  {
    pet: [
      { text: '最后一个！你的星座是什么？' },
      { text: '（星座和属相一样，只是轻娱乐标签）', style: 'muted' }
    ],
    chips: constellationChips,
    key: 'constellation' as const
  },
  // Step 5: 欢迎介绍
  {
    pet: [
      { text: '好的，画像全啦！' },
      { text: '现在让我正式介绍一下 Crush Master~' },
      { text: '我会帮你记录你和 TA 的互动，用 ' + aiLabel() + ' 分析暧昧信号——', style: 'muted' },
      { text: '他对你有没有意思？关系在升温还是降温？下一步该怎么推进？', style: 'muted' },
      { text: '这些我都能帮你理清楚。' }
    ],
    chips: ['了解！继续'],
    key: '_welcome' as const,
    map: undefined as any
  },
  // Step 6: 功能导览 + 行动 CTA
  {
    pet: [
      { text: '底部有 5 个标签——' },
      { text: '「今日」每天来记录互动、看运势；', style: 'muted' },
      { text: '「我们」看两个人的关系分析；', style: 'muted' },
      { text: '「Crushes」管理不同对象；', style: 'muted' },
      { text: '「往事」按时间回顾；', style: 'muted' },
      { text: '「我」是设定和账户。' },
      { text: '你每天来「今日」就好！' },
      { text: '现在，最关键的一步——创建一个 Crush，AI 立刻给你第一份分析。' }
    ],
    chips: ['开始初评', '快速创建', '先逛逛'],
    key: '_cta' as const,
    map: undefined as any
  }
]

const totalOnboardingSteps = computed(() => questions.length)

// ====== Lifecycle ======
onLoad((options) => {
  isOnboarding.value = options?.mode === 'onboarding'
  pendingRedirect.value = normalizeRedirect(options?.redirect || '')
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (isOnboarding.value) {
    startChat()
  } else {
    loadExistingProfile()
  }
})

function applyProfile(value?: SelfProfile | null) {
  if (!value) return
  profile.gender = value.gender || ''
  profile.ageRange = value.ageRange || ''
  profile.identity = value.identity || ''
  profile.zodiac = value.zodiac || ''
  profile.constellation = value.constellation || ''
}

async function loadExistingProfile() {
  if (!getCurrentUserId()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  applyProfile(getCachedSelfProfile())
  try {
    const result = await getSelfProfile()
    if (result?.success) applyProfile(result.selfProfile)
  } catch { /* ignore */ }
}

// ====== Onboarding chat engine ======
function startChat() {
  messages.value = []
  step.value = 0
  showQuestion(0)
}

function showQuestion(idx: number) {
  typing.value = true
  setTimeout(() => {
    typing.value = false
    addPetLines(questions[idx].pet)
    nextTick(() => {
      addChipsMsg(questions[idx].key, questions[idx].chips)
    })
  }, 600)
}

function addPetMsg(text: string) {
  addPetLines([{ text }])
}

function addPetLines(lines: { text: string; style?: string }[]) {
  messages.value.push({ role: 'pet', type: 'text', lines })
  nextTick(() => { scrollTarget.value = 'msg-' + (messages.value.length - 1) })
}

function addChipsMsg(key: string, chips: string[]) {
  messages.value.push({ role: 'user', type: 'chips', chips, key, picked: '' })
  nextTick(() => { scrollTarget.value = 'msg-' + (messages.value.length - 1) })
}

function pickChip(msg: Msg & { type: 'chips' }, chip: string) {
  if (msg.picked) return
  msg.picked = chip

  messages.value.push({ role: 'user', type: 'answer', text: chip })
  nextTick(() => { scrollTarget.value = 'msg-' + (messages.value.length - 1) })

  if (isOnboarding.value) {
    const q = questions[step.value]
    const value = q?.map?.[chip] || chip
    // 步骤 0-4: 画像数据
    if (step.value < 5) {
      ;(profile as any)[q.key] = value
    }
    step.value++

    if (step.value < 7) {
      showQuestion(step.value)
    } else {
      // Step 6 完成 → 存 action → 保存并进入
      setTimeout(() => {
        const actionKey = chip === '开始初评' ? 'startAssessment'
          : chip === '快速创建' ? 'quickCreate'
          : 'dismiss'
        uni.setStorageSync('onboardingAction', actionKey)
        addPetMsg('好嘞！那我们开始吧～')
        setTimeout(() => onSave(), 800)
      }, 800)
    }
  }
}

// ====== 编辑模式 picker handlers ======
function onAgeChange(event: any) {
  profile.ageRange = ageOptions[event.detail.value]?.value || ''
}

function onIdentityChange(event: any) {
  profile.identity = identityOptions[event.detail.value]?.value || ''
}

function onZodiacChange(event: any) {
  profile.zodiac = zodiacOptions[event.detail.value] || ''
}

function onConstellationChange(event: any) {
  profile.constellation = constellationOptions[event.detail.value] || ''
}

// ====== Actions ======
function goNext() {
  if (pendingRedirect.value) {
    uni.redirectTo({ url: pendingRedirect.value })
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}

function normalizeRedirect(value: string) {
  const decoded = decodeURIComponent(String(value || '')).trim()
  if (!decoded.startsWith('/pages/')) return ''
  if (decoded.includes('://') || decoded.includes('\\')) return ''
  return decoded
}

async function onSave() {
  if (!profile.gender || profile.gender === 'private') { /* 暂不说允许通过 */ }
  if (!profile.ageRange) { showError('请选择年龄阶段'); return }
  if (!profile.identity) { showError('请选择目前身份'); return }

  saving.value = true
  try {
    const result = await updateSelfProfile({ ...profile })
    if (!result?.success) {
      showError(result?.message || '保存失败')
      return
    }
    showSuccess('已保存')
    setTimeout(goNext, 500)
  } catch (error: any) {
    showError(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function onSkip() {
  markSelfProfileSkipped()
  goNext()
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page { min-height: 100vh; background: var(--app-bg, #FFFDF5); display: flex; flex-direction: column; }

/* ====== Hero / Form（编辑模式） ====== */
.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }
.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--hero-text-color, #111); line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }
.v2-mode .card-v2 { @include card-v2; }
.v2-mode .section-title-v2 { @include section-title-v2; }
.v2-mode .card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; margin-bottom: 10rpx; }
.v2-mode .field-v2 { padding: 20rpx 0; border-bottom: var(--border-width-strong, 3rpx) solid var(--border, #111); }
.v2-mode .field-v2:last-child { border-bottom: 0; }
.v2-mode .field-label-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 10rpx; }
.v2-mode .segmented-v2 { display: flex; gap: 10rpx; }
.v2-mode .segment-v2 { flex: 1; height: 68rpx; line-height: 68rpx; text-align: center; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); }
.v2-mode .segment-v2.active { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.v2-mode .picker-v2 { height: 72rpx; line-height: 72rpx; padding: 0 20rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--surface, #fff); font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); }
.v2-mode .minor-note-v2 { display: block; margin-top: 10rpx; padding: 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--brand-warm, #FFFBEB); font-size: $fs-caption; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.5; }
.chat-head-title { font-size: $fs-heading; font-weight: $fw-hero; color: var(--accent, #FFD93D); }

.msg { display: flex; gap: 10rpx; align-items: flex-end; max-width: 92%; margin-bottom: 24rpx; }
.msg-pet { align-self: flex-start; }
.msg-user { align-self: flex-end; justify-content: flex-end; }

.msg-avatar { width: 44rpx; height: 44rpx; background: var(--accent, #FFD93D); border: var(--border-width, 2rpx) solid var(--border, #111); display: flex; align-items: center; justify-content: center; font-size: $fs-body; flex-shrink: 0; }

.msg-bubble { max-width: 100%; padding: 16rpx 20rpx; background: var(--surface, #fff); border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-body-lg; font-weight: $fw-label; color: var(--text-main, #111); line-height: $lh-loose; }
.msg-line { display: block; }
.msg-line.muted { font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); margin-top: 4rpx; }

.msg-answer { padding: 12rpx 22rpx; background: var(--hero-tag-bg, #111); border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-body-lg; font-weight: $fw-label; color: var(--hero-tag-color, #FFD93D); }

.msg-chips { display: flex; flex-wrap: wrap; gap: 10rpx; justify-content: flex-end; }
.msg-chip { padding: 12rpx 22rpx; background: var(--surface, #fff); border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); }
.msg-chip.picked { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }

.msg-typing { display: flex; gap: 6rpx; padding: 14rpx 20rpx; background: var(--surface, #fff); border: var(--border-width, 2rpx) solid var(--border, #111); }
.msg-typing view { width: 10rpx; height: 10rpx; background: var(--text-soft, #999); animation: type-bounce 1.2s infinite; }
.msg-typing view:nth-child(2) { animation-delay: .2s; }
.msg-typing view:nth-child(3) { animation-delay: .4s; }
@keyframes type-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-8rpx); } }

.chat-foot { display: flex; align-items: center; justify-content: center; gap: 16rpx; padding: 16rpx 24rpx; border-top: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); flex-shrink: 0; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); }
.chat-progress { display: flex; gap: 12rpx; }
.progress-dot { width: 16rpx; height: 16rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--surface, #fff); }
.progress-dot.done { background: var(--accent, #FFD93D); }
.chat-step-text { font-size: $fs-body; font-weight: $fw-label; color: var(--text-muted, #666); }
</style>
