<template>
  <view v-if="visible" class="sheet-mask" @click="onMaskClick">
    <view class="sheet-panel" @click.stop>
      <!-- Header -->
      <view class="sheet-head">
        <text class="sheet-title">{{ sheetTitle }}</text>
        <text class="sheet-close" @click="close">X</text>
      </view>

      <!-- Tabs -->
      <view class="tab-row">
        <view :class="['tab', scene === 'active' ? 'active' : '']" @click="switchScene('active')">主动问对方</view>
        <view :class="['tab', scene === 'reply' ? 'active' : '']" @click="switchScene('reply')">对方说了什么</view>
      </view>

      <!-- Safety notices -->
      <view v-if="isMinor" class="safety-notice">
        <text>系统已自动调整为适合你的表达方式，更侧重友谊和轻松交流。</text>
      </view>
      <view v-if="boundaryWarning" class="boundary-notice">
        <text>{{ boundaryWarning }}</text>
      </view>

      <!-- Input -->
      <view class="input-area">
        <text class="input-label">{{ scene === 'active' ? '我想表达：' : '对方说：' }}</text>
        <textarea
          v-model="content"
          class="text-area"
          :placeholder="scene === 'active' ? '比如：想约他周末一起出去玩' : '比如：周末加班没空见面'"
          :maxlength="200"
        />
        <button class="btn-generate" :disabled="generating || !content.trim()" @click="generate">
          {{ generating ? '生成中...' : '可以这样说' }}
        </button>
      </view>

      <!-- Loading -->
      <AiLoading v-if="generating" label="小咪在想…" :seconds="generatingSeconds" />

      <!-- Results：5 项合一 -->
      <view v-if="!generating && options.length > 0" class="results-area">
        <view class="options-section">
          <text class="section-label">选一种方式</text>
          <view class="option-tabs">
            <view
              v-for="opt in options"
              :key="opt.key"
              :class="['option-tab', selectedKey === opt.key ? 'active' : '']"
              @click="selectedKey = opt.key"
            >
              {{ opt.label }}
            </view>
          </view>
        </view>

        <view v-if="currentOption" class="answer-card">
          <!-- 单轮回复（语气） -->
          <template v-if="currentOption.kind === 'tone'">
            <view class="turn-block">
              <view class="turn-bubble">
                <text class="turn-text">{{ currentOption.text }}</text>
                <button class="btn-sm" @click="copyText(currentOption.text)">复制</button>
              </view>
              <view class="turn-actions">
                <button class="btn-sm" :disabled="retryingTone || generating" @click="refreshCurrentTone">
                  {{ retryingTone ? '生成中...' : '换一句' }}
                </button>
              </view>
            </view>
          </template>
          <!-- 多轮策略 -->
          <template v-else>
            <view v-for="turn in currentOption.turns" :key="turn.step" class="turn-block">
              <view class="turn-header">
                <text class="turn-step">Step {{ turn.step }}</text>
                <text class="turn-note">{{ turn.note }}</text>
              </view>
              <view class="turn-bubble">
                <text class="turn-text">{{ turn.say }}</text>
                <button class="btn-sm" @click="copyText(turn.say)">复制</button>
              </view>
              <view v-if="turn.expectReactions?.length" class="turn-reactions">
                <text class="reactions-label">对方可能会说：</text>
                <text v-for="(r, ri) in turn.expectReactions" :key="ri" class="reaction-tag">{{ r }}</text>
              </view>
            </view>
          </template>
        </view>
      </view>

      <!-- Error -->
      <view v-if="errorMsg" class="error-msg">
        <text>{{ errorMsg }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { generatePetReplyBundle, generatePetReplyPair, handleInsufficientBalance, getCachedSelfProfile } from '@/utils/api'
import AiLoading from '@/components/AiLoading'

const props = defineProps<{ visible: boolean; petName?: string }>()
const emit = defineEmits(['close'])

function setCustomTabBarHidden(hidden: boolean) {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    const tabBar = current?.getTabBar?.()
    tabBar?.setHidden?.(hidden)
  } catch {}
}

watch(() => props.visible, (visible) => {
  setCustomTabBarHidden(visible)
}, { immediate: true })

onUnmounted(() => {
  setCustomTabBarHidden(false)
  stopGeneratingTimer()
})

type ToneKey = 'humor' | 'sincere' | 'literary'
type ReplyVariants = Partial<Record<ToneKey, string>>

const selfProfile = getCachedSelfProfile()
const isMinor = computed(() => selfProfile?.ageRange === 'under18')

const toneOptions: Array<{ key: ToneKey; label: string }> = [
  { key: 'humor', label: '幽默轻松' },
  { key: 'sincere', label: '真诚直接' },
  { key: 'literary', label: '委婉文艺' }
]

const boundarySensitiveKeywords = ['酒店', '开房', '过夜', '私密', '身体', '上床', '发生关系']
const boundaryWarning = computed(() => {
  if (isMinor.value) return ''
  if (boundarySensitiveKeywords.some(k => content.value.includes(k))) {
    return '系统检测到敏感话题，将以更克制、注重边界的方式生成回复。'
  }
  return ''
})

function getDefaultTone(): ToneKey {
  return 'sincere'
}

const scene = ref<'active' | 'reply'>('reply')
const content = ref('')
const generating = ref(false)
const generatingSeconds = ref(0)
let generatingTimer: any = null
const retryingTone = ref(false)
const errorMsg = ref('')
const variants = ref<ReplyVariants>({})
const strategies = ref<any[]>([])
const selectedKey = ref<string>('humor')

const sheetTitle = computed(() => `${props.petName || '小咪'}帮你说`)

const options = computed(() => {
  const list: Array<
    | { kind: 'tone'; key: string; label: string; text: string }
    | { kind: 'strategy'; key: string; label: string; turns: any[] }
  > = []
  toneOptions.forEach(t => {
    const text = variants.value[t.key]
    if (text) list.push({ kind: 'tone', key: `tone:${t.key}`, label: t.label, text })
  })
  strategies.value.forEach((s, idx) => {
    if (s && Array.isArray(s.turns) && s.turns.length > 0) {
      list.push({ kind: 'strategy', key: `strategy:${s.type || idx}`, label: s.label || formatStrategyLabel(s, scene.value), turns: s.turns })
    }
  })
  return list
})

const currentOption = computed(() => options.value.find(o => o.key === selectedKey.value) || options.value[0] || null)

function formatStrategyLabel(strategy: any, currentScene: string) {
  if (strategy?.type === 'contrast') return '先冷后甜'
  if (strategy?.type === 'progressive') return currentScene === 'active' ? '投石问路' : '顺水推舟'
  return strategy?.label || ''
}

function startGeneratingTimer() {
  stopGeneratingTimer()
  generatingSeconds.value = 0
  generatingTimer = setInterval(() => {
    generatingSeconds.value += 1
  }, 1000)
}

function stopGeneratingTimer() {
  if (generatingTimer) {
    clearInterval(generatingTimer)
    generatingTimer = null
  }
}

function normalizeVariantsFromRes(res: any): ReplyVariants {
  const raw = res?.variants && typeof res.variants === 'object' ? res.variants : {}
  const next: ReplyVariants = {}
  toneOptions.forEach(t => {
    const v = String(raw[t.key] || '').trim()
    if (v) next[t.key] = v
  })
  if (!next.humor && res?.reply) next.humor = String(res.reply).trim()
  if (!next.literary && res?.alternative) next.literary = String(res.alternative).trim()
  return next
}

function pickInitialSelectedKey() {
  const first = options.value[0]
  selectedKey.value = first ? first.key : 'humor'
}

function switchScene(nextScene: 'active' | 'reply') {
  if (scene.value === nextScene) return
  scene.value = nextScene
  variants.value = {}
  strategies.value = []
  selectedKey.value = 'humor'
  errorMsg.value = ''
}

async function generate() {
  const text = content.value.trim()
  if (!text || generating.value) return

  generating.value = true
  startGeneratingTimer()
  errorMsg.value = ''
  variants.value = {}
  strategies.value = []
  selectedKey.value = 'humor'

  try {
    const res = await generatePetReplyBundle(scene.value, text)
    if (handleInsufficientBalance(res)) {
      errorMsg.value = '能量不足，充点Token能量再来'
    } else if (!res?.success) {
      errorMsg.value = res?.message || '生成失败，请重试'
    } else {
      variants.value = normalizeVariantsFromRes(res)
      strategies.value = Array.isArray(res.strategies) ? res.strategies : []
      pickInitialSelectedKey()
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '网络异常，请重试'
  } finally {
    generating.value = false
    stopGeneratingTimer()
  }
}

async function refreshCurrentTone() {
  const text = content.value.trim()
  if (!text || retryingTone.value || generating.value) return
  const cur = currentOption.value
  if (!cur || cur.kind !== 'tone') return
  const toneKey = cur.key.replace(/^tone:/, '') as ToneKey

  retryingTone.value = true
  errorMsg.value = ''
  try {
    const res = await generatePetReplyPair(scene.value, text, toneKey)
    if (handleInsufficientBalance(res)) {
      errorMsg.value = '能量不足，充点Token能量再来'
      return
    }
    if (!res?.success) {
      errorMsg.value = res?.message || '生成失败，请重试'
      return
    }
    const next = normalizeVariantsFromRes(res)
    const nextText = next[toneKey]
    if (nextText) {
      variants.value = { ...variants.value, [toneKey]: nextText }
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '网络异常，请重试'
  } finally {
    retryingTone.value = false
  }
}

function copyText(text: string) {
  if (!text) return
  uni.setClipboardData({
    data: text,
    success() {
      uni.showToast({ title: '已复制，到微信粘贴发送', icon: 'success', duration: 2000 })
    }
  })
}

function onMaskClick() {
  close()
}

function close() {
  content.value = ''
  variants.value = {}
  strategies.value = []
  selectedKey.value = 'humor'
  errorMsg.value = ''
  stopGeneratingTimer()
  emit('close')
}
</script>

<style scoped lang="scss">
// PetSpeakSheet — 对齐 Campus Pop v2 设计系统 token
.sheet-mask {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}
.sheet-panel {
  width: 100%; max-width: 500px; max-height: 85vh;
  background: #FFFDF5; border: 3px solid #111;
  box-shadow: 8rpx 8rpx 0 #111;
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  overflow-y: auto;
  box-sizing: border-box;
}

.sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-title { font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 2rpx; }
.sheet-close { font-size: $fs-body-lg; font-weight: $fw-hero; color: #111; padding: 8rpx; }

.tab-row { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.tab { flex: 1; text-align: center; padding: 14rpx; font-size: $fs-body-lg; font-weight: $fw-heading; color: #111; border: 2rpx solid #111; background: #fff; }
.tab.active { color: #FFD93D; border-color: #111; background: #111; }

.input-label { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: #111; margin-bottom: 8rpx; }
.text-area { width: 100%; height: 140rpx; padding: 16rpx; font-size: $fs-body-lg; font-weight: $fw-body; border: 3rpx solid #111; background: #fff; box-sizing: border-box; }

.btn-generate {
  width: 100%; margin-top: 16rpx; padding: 16rpx;
  font-size: $fs-body-lg; font-weight: $fw-hero; color: #111;
  background: #4ECDC4; border: 3rpx solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
}
.btn-generate:disabled { opacity: 0.4; }

/* Loading：对齐首页 aiFeedbackLoading 风格 */
.results-area { margin-top: 24rpx; }
.options-section { margin-bottom: 16rpx; }
.section-label { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: #111; margin-bottom: 10rpx; }
.option-tabs { display: flex; gap: 6rpx; }
.option-tab {
  flex: 1; min-width: 0; text-align: center;
  padding: 12rpx 4rpx;
  font-size: $fs-heading; font-weight: $fw-heading;
  color: #111; background: #fff;
  border: 2rpx solid #111;
  box-sizing: border-box;
}
.option-tab.active { color: #FFD93D; background: #111; border-color: #111; }

.answer-card { margin-top: 8rpx; }
.btn-sm { padding: 8rpx 20rpx; font-size: $fs-caption; font-weight: $fw-heading; color: #111; background: #fff; border: 2rpx solid #111; box-shadow: 3rpx 3rpx 0 #111; }
.btn-sm:disabled { opacity: 0.4; }

.turn-block {
  margin-bottom: 20rpx; padding: 16rpx;
  background: #fff;
  border: 2rpx solid #111;
  border-left: 8rpx solid #FFD93D;
}
.turn-header { display: flex; align-items: center; gap: 10rpx; margin-bottom: 10rpx; }
.turn-step { font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.turn-note { font-size: $fs-body-lg; font-weight: $fw-label; color: #111; }
.turn-bubble {
  display: flex; justify-content: space-between; align-items: center; gap: 10rpx;
  padding: 14rpx;
  background: #FFFEF5;
  border: 2rpx solid #111;
  margin-bottom: 8rpx;
}
.turn-text { font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.5; flex: 1; }
.turn-actions { display: flex; gap: 10rpx; justify-content: flex-end; }
.turn-reactions { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; }
.reactions-label { font-size: $fs-body-lg; font-weight: $fw-label; color: #111; }
.reaction-tag { padding: 4rpx 12rpx; font-size: $fs-caption; font-weight: $fw-label; color: #111; background: #fff; border: 2rpx solid #111; }

.error-msg { margin-top: 16rpx; padding: 14rpx; background: #FFEEEC; border: 3rpx solid #FF5252; font-size: $fs-body-lg; color: #FF5252; font-weight: $fw-label; }
.safety-notice { margin-bottom: 16rpx; padding: 12rpx 16rpx; background: #E0FFF0; border: 2rpx solid #111; font-size: $fs-body-lg; color: #111; font-weight: $fw-label; }
.boundary-notice { margin-bottom: 16rpx; padding: 12rpx 16rpx; background: #FFFBEB; border: 2rpx solid #111; font-size: $fs-body-lg; color: #111; font-weight: $fw-label; }
</style>
