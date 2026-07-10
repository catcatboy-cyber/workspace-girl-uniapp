<template>
  <view v-if="visible" class="sheet-mask" @click="onMaskClick">
    <view class="sheet-panel" @click.stop>
      <view class="sheet-head">
        <view class="title-block">
          <text class="sheet-title">和{{ petDisplayName }}聊聊</text>
          <text class="case-label">{{ currentCaseLabel }}</text>
        </view>
        <text class="sheet-close" @click="close">X</text>
      </view>

      <view class="chip-row">
        <button
          v-for="chip in quickChips"
          :key="chip.key"
          :class="['quick-chip', activeChatMode === chip.mode ? 'active' : '']"
          @click="applyQuickChip(chip)"
        >
          {{ chip.label }}
        </button>
      </view>

      <scroll-view class="chat-scroll" scroll-y :scroll-into-view="scrollAnchor">
        <view v-if="loadingHistory" class="history-loading">
          <AiLoading label="小咪在翻聊天记录…" :seconds="loadingSeconds" />
        </view>

        <view
          v-for="message in messages"
          :key="message.id"
          :class="['message-row', message.role]"
        >
          <view class="avatar">{{ message.role === 'user' ? '我' : petInitial }}</view>
          <view class="message-stack">
            <view v-if="getModeNotice(message)" class="mode-notice">
              <text class="mode-notice-text">{{ getModeNotice(message) }}</text>
              <button
                v-if="getModeNoticeAction(message)"
                class="mode-notice-action"
                @click="applyModeNoticeAction(message)"
              >
                {{ getModeNoticeAction(message) }}
              </button>
            </view>

            <view v-if="message.role === 'pet' && hasVariants(message)" class="variant-box">
              <view class="tone-tabs">
                <button
                  v-for="tone in toneOptions"
                  :key="tone.key"
                  :class="['tone-tab', getSelectedTone(message) === tone.key ? 'active' : '']"
                  @click="selectTone(message.id, tone.key)"
                >
                  {{ tone.label }}
                </button>
              </view>
              <view class="message-bubble variant-message">
                <text class="message-text">{{ resolveMessageText(message) }}</text>
              </view>
              <view class="variant-actions">
                <button class="btn-sm" @click="copyText(resolveMessageText(message))">复制</button>
                <button v-if="canRefreshTone(message)" class="btn-sm" :disabled="retryingMessageId === message.id" @click="refreshTone(message)">
                  {{ retryingMessageId === message.id ? '生成中' : '换一句' }}
                </button>
              </view>
            </view>

            <view v-else class="message-bubble">
              <text class="message-text">{{ resolveMessageText(message) }}</text>
            </view>

            <view v-if="message.role === 'pet' && message.strategies?.length" class="strategy-list">
              <view v-for="strategy in message.strategies" :key="strategy.label" class="strategy-item">
                <view class="strategy-label-row">
                  <text class="strategy-label">{{ strategy.label }}</text>
                  <text
                    v-if="showStrategySourceMark(message)"
                    :class="['strategy-source-mark', message.strategySource === 'fallback' ? 'fallback' : 'ai']"
                  >
                    {{ getStrategySourceMark(message) }}
                  </text>
                </view>
                <view v-for="turn in strategy.turns" :key="turn.step" class="strategy-turn">
                  <text class="turn-step">第 {{ turn.step }} 步</text>
                  <text class="turn-say">{{ turn.say }}</text>
                  <text v-if="turn.note" class="turn-note">{{ turn.note }}</text>
                  <button class="btn-sm turn-copy" @click="copyText(turn.say)">复制</button>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="sending" class="message-row pet">
          <view class="avatar">{{ petInitial }}</view>
          <view class="message-stack loading-stack">
            <AiLoading label="小咪在想…" :seconds="sendingSeconds" />
          </view>
        </view>

        <view id="chat-bottom" class="chat-bottom"></view>
      </scroll-view>

      <view v-if="errorMsg" class="error-msg">
        <text>{{ errorMsg }}</text>
      </view>

      <view class="composer">
        <view :class="['composer-input', activeChatMode === 'reply' ? 'with-prefix' : '']">
          <text v-if="activeChatMode === 'reply'" class="input-prefix">对方说：</text>
          <textarea
            v-model="draft"
            class="chat-input"
            :maxlength="500"
            :placeholder="inputPlaceholder"
            :disabled="sending || loadingHistory"
            auto-height
          />
        </view>
        <button class="send-btn" :disabled="sending || loadingHistory || !draft.trim()" @click="sendMessage">发送</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { generatePetReplyBundle, generatePetReplyPair, handleInsufficientBalance, loadPetChatHistory, petChatMessage } from '@/utils/api'
import AiLoading from '@/components/AiLoading'

type ToneKey = 'humor' | 'flirty' | 'sincere' | 'literary'
type ChatRole = 'user' | 'pet'
type PetChatMode = 'chat' | 'reply' | 'initiate' | 'strategy'
type StrategySource = 'ai' | 'fallback'

type StrategyTurn = {
  step: number
  say: string
  note?: string
  expectReactions?: string[]
}

type ChatStrategy = {
  label: string
  turns: StrategyTurn[]
}

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  caseId?: string
  intent?: string
  variants?: Partial<Record<ToneKey, string>>
  selectedTone?: ToneKey
  strategies?: ChatStrategy[]
  sourceText?: string
  strategySource?: StrategySource
  mode?: PetChatMode
  requestedMode?: PetChatMode
  suggestedMode?: PetChatMode
}

type ActiveCaseMeta = {
  caseId?: string
  name?: string
  zodiac?: string
  constellation?: string
}

const props = defineProps<{ visible: boolean; petName?: string; caseId?: string }>()
const emit = defineEmits(['close'])

const toneOptions: Array<{ key: ToneKey; label: string }> = [
  { key: 'humor', label: '幽默' },
  { key: 'flirty', label: '轻撩' },
  { key: 'sincere', label: '真诚' },
  { key: 'literary', label: '文艺' }
]

const quickChips = [
  { key: 'chat', mode: 'chat' as const, label: '和小咪聊' },
  { key: 'reply', mode: 'reply' as const, label: '帮我回复TA' },
  { key: 'initiate', mode: 'initiate' as const, label: '主动开口' }
]

const petDisplayName = computed(() => props.petName || '小咪')
const petInitial = computed(() => petDisplayName.value.slice(0, 1) || '咪')
const inputPlaceholder = computed(() => {
  if (activeChatMode.value === 'reply') return '粘贴对方说的原话'
  if (activeChatMode.value === 'initiate') return '比如：我想约TA周末见面，但不知道怎么开口'
  return '想说什么都可以，和小咪聊聊'
})
const currentCaseLabel = computed(() => {
  const item = activeCase.value
  if (!item?.name) return '自由聊天'
  const meta = [item.constellation, item.zodiac ? `属${item.zodiac}` : ''].filter(Boolean).join(' · ')
  return meta ? `当前聊：${item.name} · ${meta}` : `当前聊：${item.name}`
})
const messages = ref<ChatMessage[]>([])
const activeCase = ref<ActiveCaseMeta | null>(null)
const activeChatMode = ref<PetChatMode>('chat')
const draft = ref('')
const sessionId = ref('')
const loadingHistory = ref(false)
const sending = ref(false)
const retryingMessageId = ref('')
const errorMsg = ref('')
const scrollAnchor = ref('')
const loadingSeconds = ref(0)
const sendingSeconds = ref(0)
let loadingTimer: any = null
let sendingTimer: any = null

function setCustomTabBarHidden(hidden: boolean) {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    const tabBar = current?.getTabBar?.()
    tabBar?.setHidden?.(hidden)
  } catch {}
}

function createSessionId() {
  const caseKey = String(props.caseId || 'global').replace(/[^\w-]/g, '').slice(0, 32) || 'global'
  return `pet_${caseKey}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function normalizeMessage(raw: any): ChatMessage | null {
  const role: ChatRole = raw?.role === 'user' ? 'user' : 'pet'
  const text = String(raw?.text || raw?.content || '').trim()
  if (!text) return null
  const variants = raw?.variants && typeof raw.variants === 'object' ? raw.variants : undefined
  return {
    id: String(raw?.id || `${role}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`),
    role,
    text,
    caseId: String(raw?.caseId || '').trim() || undefined,
    intent: raw?.intent || '',
    variants,
    selectedTone: pickDefaultTone(variants),
    strategies: Array.isArray(raw?.strategies) ? raw.strategies : [],
    sourceText: String(raw?.sourceText || '').trim() || undefined,
    strategySource: normalizeStrategySource(raw?.strategySource),
    mode: normalizeChatMode(raw?.mode || raw?.intent),
    requestedMode: normalizeChatMode(raw?.requestedMode),
    suggestedMode: normalizeChatMode(raw?.suggestedMode)
  }
}

function normalizeChatMode(value: any): PetChatMode | undefined {
  const mode = String(value || '').trim()
  if (mode === 'chat' || mode === 'reply' || mode === 'initiate' || mode === 'strategy') return mode
  return undefined
}

function normalizeStrategySource(value: any): StrategySource | undefined {
  const source = String(value || '').trim()
  if (source === 'ai' || source === 'fallback') return source
  return undefined
}

function pickDefaultTone(variants?: Partial<Record<ToneKey, string>>): ToneKey {
  if (variants?.sincere) return 'sincere'
  if (variants?.humor) return 'humor'
  if (variants?.flirty) return 'flirty'
  return 'literary'
}

function getSelectedTone(message: ChatMessage): ToneKey {
  return message.selectedTone || pickDefaultTone(message.variants)
}

function hasVariants(message: ChatMessage) {
  return Boolean(message.variants && toneOptions.some((tone) => message.variants?.[tone.key]))
}

function resolveMessageText(message: ChatMessage) {
  if (message.role !== 'pet' || !hasVariants(message)) return message.text
  return message.variants?.[getSelectedTone(message)] || message.text
}

function canRefreshTone(message: ChatMessage) {
  return message.role === 'pet' && hasVariants(message) && Boolean(message.sourceText)
}

function showStrategySourceMark(message: ChatMessage) {
  return Boolean(message.strategySource)
}

function getStrategySourceMark(message: ChatMessage) {
  return message.strategySource === 'fallback' ? '·' : '•'
}

function getModeNotice(message: ChatMessage) {
  if (message.role !== 'pet') return ''
  const mode = message.mode
  if ((!mode || mode === 'chat') && message.suggestedMode) {
    if (message.suggestedMode === 'reply') return '我猜你是在想怎么回复 TA。这里先陪你梳理；想要可直接发送的话，可以切到「帮我回复TA」。'
    if (message.suggestedMode === 'initiate') return '我猜你是想主动开口。这里先陪你聊清楚；想要开场白，可以切到「主动开口」。'
    if (message.suggestedMode === 'strategy') return '我猜你是在想下一步怎么推进。这里先陪你梳理；想要可直接发送的话和后续步骤，可以切到「帮我回复TA」。'
  }
  if (!mode || mode === 'chat') return ''
  const autoPrefix = message.requestedMode === 'chat' ? '小咪判断：' : ''
  if (mode === 'reply') return `${autoPrefix}你是在问怎么回复 TA，下面是可以发给 TA 的话术和后续步骤`
  if (mode === 'initiate') return `${autoPrefix}你想主动开口，下面是适合作为开场的话和后续步骤`
  if (mode === 'strategy') return `${autoPrefix}你想知道下一步怎么推进，下面是多步策略`
  return ''
}

function getModeNoticeAction(message: ChatMessage) {
  if (!message.suggestedMode || message.mode !== 'chat') return ''
  if (message.suggestedMode === 'reply') return '切到帮我回复TA'
  if (message.suggestedMode === 'initiate') return '切到主动开口'
  if (message.suggestedMode === 'strategy') return '切到帮我回复TA'
  return ''
}

function startTimer(kind: 'loading' | 'sending') {
  stopTimer(kind)
  const target = kind === 'loading' ? loadingSeconds : sendingSeconds
  target.value = 0
  const timer = setInterval(() => {
    target.value += 1
  }, 1000)
  if (kind === 'loading') loadingTimer = timer
  else sendingTimer = timer
}

function stopTimer(kind: 'loading' | 'sending') {
  const timer = kind === 'loading' ? loadingTimer : sendingTimer
  if (timer) clearInterval(timer)
  if (kind === 'loading') loadingTimer = null
  else sendingTimer = null
}

function pushWelcomeIfEmpty() {
  if (messages.value.length > 0) return
  messages.value = [{
    id: 'welcome',
    role: 'pet',
    text: activeCase.value?.name
      ? `我在。今天我们就围绕 ${activeCase.value.name} 聊，先说你最卡的那件事。`
      : '我在。你可以先把最近发生的事说给我听。'
  }]
}

async function scrollToBottom() {
  scrollAnchor.value = ''
  await nextTick()
  scrollAnchor.value = 'chat-bottom'
}

async function openSession() {
  sessionId.value = createSessionId()
  errorMsg.value = ''
  messages.value = []
  loadingHistory.value = true
  startTimer('loading')
  try {
    const res = await loadPetChatHistory(props.caseId || '')
    if (!res?.success) {
      errorMsg.value = res?.message || '聊天记录加载失败'
    } else {
      activeCase.value = res.activeCase || null
      messages.value = (Array.isArray(res.history) ? res.history : [])
        .map(normalizeMessage)
        .filter(Boolean) as ChatMessage[]
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '聊天记录加载失败'
  } finally {
    loadingHistory.value = false
    stopTimer('loading')
    pushWelcomeIfEmpty()
    scrollToBottom()
  }
}

function resetSession() {
  draft.value = ''
  errorMsg.value = ''
  sending.value = false
  retryingMessageId.value = ''
  activeChatMode.value = 'chat'
  stopTimer('loading')
  stopTimer('sending')
}

function applyQuickChip(chip: { mode: PetChatMode }) {
  activeChatMode.value = chip.mode
}

function continueAsChat() {
  activeChatMode.value = 'chat'
}

function applyModeNoticeAction(message: ChatMessage) {
  if (message.suggestedMode === 'strategy') {
    activeChatMode.value = 'reply'
    return
  }
  if (message.suggestedMode) activeChatMode.value = message.suggestedMode
}

function selectTone(messageId: string, tone: ToneKey) {
  const target = messages.value.find((item) => item.id === messageId)
  if (target) target.selectedTone = tone
}

function getPetChatErrorMessage(error: any, fallback: string) {
  const raw = String(error?.errMsg || error?.message || error || '')
  if (raw.includes('-504003') || /timed out|timeout|FUNCTIONS_TIME_LIMIT/i.test(raw)) {
    return '小咪这次想太久了，请稍后再试一次'
  }
  return raw || fallback
}

async function sendMessage() {
  const text = draft.value.trim()
  if (!text || sending.value || loadingHistory.value) return
  const modeForRequest = activeChatMode.value

  const userMessage: ChatMessage = {
    id: `user_${Date.now()}`,
    role: 'user',
    caseId: props.caseId || 'global',
    text
  }
  messages.value.push(userMessage)
  draft.value = ''
  errorMsg.value = ''
  sending.value = true
  startTimer('sending')
  await scrollToBottom()

  try {
    const res = modeForRequest === 'reply' || modeForRequest === 'initiate'
      ? await generatePetReplyBundle(modeForRequest === 'initiate' ? 'active' : 'reply', text, props.caseId || '')
      : await petChatMessage({
          sessionId: sessionId.value,
          text,
          messages: [{ role: 'user', text }],
          caseId: props.caseId || '',
          mode: modeForRequest
        })
    if (handleInsufficientBalance(res)) {
      errorMsg.value = 'Token 不足，补一点能量再来'
      return
    }
    if (!res?.success) {
      errorMsg.value = res?.message || '小咪刚刚没想出来，请再试一次'
      return
    }
    if (res.activeCase) activeCase.value = res.activeCase
    messages.value.push({
      id: `pet_${Date.now()}`,
      role: 'pet',
      caseId: props.caseId || 'global',
      text: String(res.reply || '').trim() || '我在，先别急，我们换个角度看。',
      intent: res.intent || '',
      variants: res.variants || {},
      selectedTone: pickDefaultTone(res.variants),
      strategies: Array.isArray(res.strategies) ? res.strategies : [],
      sourceText: text,
      strategySource: normalizeStrategySource(res.strategySource),
      mode: res.mode || (modeForRequest === 'reply' || modeForRequest === 'initiate' ? modeForRequest : 'chat'),
      requestedMode: res.requestedMode || modeForRequest,
      suggestedMode: res.suggestedMode
    })
    activeChatMode.value = 'chat'
  } catch (e: any) {
    errorMsg.value = getPetChatErrorMessage(e, '网络异常，请稍后重试')
  } finally {
    sending.value = false
    stopTimer('sending')
    scrollToBottom()
  }
}

async function refreshTone(message: ChatMessage) {
  if (retryingMessageId.value || sending.value) return
  const tone = getSelectedTone(message)
  const sourceText = message.sourceText || ''
  if (!sourceText) return

  retryingMessageId.value = message.id
  errorMsg.value = ''
  try {
    const scene = message.mode === 'initiate' ? 'active' : 'reply'
    const res = await generatePetReplyPair(scene, sourceText, tone, props.caseId || '')
    if (handleInsufficientBalance(res)) {
      errorMsg.value = 'Token 不足，补一点能量再来'
      return
    }
    if (!res?.success) {
      errorMsg.value = res?.message || '换一句失败，请稍后重试'
      return
    }
    const nextText = String(res?.variants?.[tone] || res?.reply || '').trim()
    if (nextText) {
      message.variants = { ...(message.variants || {}), [tone]: nextText }
      message.selectedTone = tone
    }
  } catch (e: any) {
    errorMsg.value = getPetChatErrorMessage(e, '换一句失败，请稍后重试')
  } finally {
    retryingMessageId.value = ''
  }
}

function copyText(text: string) {
  if (!text) return
  uni.setClipboardData({
    data: text,
    success() {
      uni.showToast({ title: '已复制', icon: 'success', duration: 1600 })
    }
  })
}

function onMaskClick() {
  close()
}

function close() {
  resetSession()
  emit('close')
}

watch(() => props.visible, (visible) => {
  setCustomTabBarHidden(visible)
  if (visible) openSession()
  else resetSession()
}, { immediate: true })

watch(() => props.caseId, () => {
  if (props.visible) openSession()
})

onUnmounted(() => {
  setCustomTabBarHidden(false)
  resetSession()
})
</script>

<style scoped lang="scss">
.sheet-mask {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--overlay, rgba(0,0,0,0.5));
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.sheet-panel {
  width: 100%; max-width: 500px; height: 86vh;
  background: var(--app-bg, #FFFDF5);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-hero, 0) var(--shape-radius-hero, 0) 0 0;
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
  padding: 22rpx;
  padding-bottom: calc(22rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; flex-shrink: 0; }
.title-block { min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.sheet-title { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); line-height: 1.2; }
.case-label { font-size: $fs-caption; color: var(--text-muted, #666); line-height: 1.3; }
.sheet-close { flex-shrink: 0; font-size: $fs-body-lg; font-weight: $fw-heading; color: var(--text-main, #111); padding: 6rpx 10rpx; }

.chip-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8rpx; flex-shrink: 0; }
.quick-chip {
  height: 64rpx; padding: 0 6rpx;
  font-size: $fs-caption; font-weight: $fw-heading;
  color: var(--text-main, #111); background: var(--surface, #fff);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
  box-shadow: var(--shadow-hard, 3rpx 3rpx 0 #111);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.quick-chip.active { color: var(--hero-tag-color, #FFD93D); background: var(--hero-tag-bg, #111); }

.chat-scroll {
  flex: 1;
  min-height: 0;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  background: var(--surface, #fff);
  border-radius: var(--shape-radius-inner, 0);
  box-sizing: border-box;
  padding: 18rpx;
}

.history-loading { padding: 30rpx 10rpx; }
.message-row { display: flex; gap: 12rpx; margin-bottom: 18rpx; align-items: flex-start; }
.message-row.user { flex-direction: row-reverse; }
.avatar {
  width: 52rpx; height: 52rpx; flex: 0 0 52rpx;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent, #FFD93D);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
  font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-main, #111);
}
.message-row.user .avatar { background: var(--accent-cool, #4ECDC4); }
.message-stack { max-width: 78%; display: flex; flex-direction: column; gap: 10rpx; }
.message-row.user .message-stack { align-items: flex-end; }
.message-bubble {
  padding: 16rpx 18rpx;
  background: var(--brand-warm, #FFFEF5);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  box-shadow: var(--shadow-hard, 3rpx 3rpx 0 #111);
}
.message-row.user .message-bubble { background: var(--accent-cool-soft, #E4FFFC); }
.message-text { font-size: $fs-body-lg; line-height: 1.55; color: var(--text-main, #111); word-break: break-word; }

.mode-notice {
  width: 100%;
  padding: 10rpx 12rpx;
  background: var(--surface, #fff);
  border: var(--border-width, 2rpx) dashed var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}
.mode-notice-text {
  flex: 1;
  min-width: 0;
  font-size: $fs-caption;
  font-weight: $fw-label;
  color: var(--text-muted, #666);
  line-height: 1.35;
}
.mode-notice-action {
  flex-shrink: 0;
  height: 44rpx;
  padding: 0 12rpx;
  font-size: $fs-caption;
  font-weight: $fw-label;
  color: var(--text-main, #111);
  background: var(--brand-warm, #FFFEF5);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
}

.variant-box,
.strategy-list {
  width: 100%;
  padding: 12rpx;
  background: var(--app-bg, #FFFDF5);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  box-sizing: border-box;
}
.tone-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(88rpx, 1fr)); gap: 6rpx; margin-bottom: 10rpx; }
.tone-tab {
  height: 52rpx; padding: 0 4rpx;
  font-size: $fs-caption; font-weight: $fw-label;
  color: var(--text-main, #111); background: var(--surface, #fff);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
}
.tone-tab.active { color: var(--hero-tag-color, #FFD93D); background: var(--hero-tag-bg, #111); }
.variant-actions { display: flex; justify-content: flex-end; gap: 10rpx; }
.btn-sm {
  min-width: 112rpx; height: 52rpx; padding: 0 16rpx;
  font-size: $fs-caption; font-weight: $fw-label;
  color: var(--text-main, #111); background: var(--surface, #fff);
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
}
.btn-sm:disabled { opacity: 0.45; }

.strategy-item { padding: 10rpx 0; border-bottom: 1rpx dashed var(--divider, #ccc); }
.strategy-item:last-child { border-bottom: 0; }
.strategy-label-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.strategy-label { display: block; font-size: $fs-body; font-weight: $fw-heading; color: var(--text-main, #111); }
.strategy-source-mark { font-size: 18rpx; line-height: 1; color: var(--text-muted, #666); opacity: 0.65; }
.strategy-source-mark.fallback { opacity: 0.38; }
.strategy-turn { position: relative; padding: 12rpx 120rpx 12rpx 12rpx; background: var(--surface, #fff); border: var(--border-width, 2rpx) solid var(--border, #111); margin-top: 8rpx; }
.turn-step { display: block; font-size: $fs-caption; font-weight: $fw-hero; color: var(--text-muted, #666); margin-bottom: 4rpx; }
.turn-say { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.45; }
.turn-note { display: block; margin-top: 6rpx; font-size: $fs-caption; color: var(--text-muted, #666); line-height: 1.35; }
.turn-copy { position: absolute; right: 10rpx; top: 10rpx; min-width: 88rpx; }

.loading-stack { min-width: 280rpx; }
.chat-bottom { height: 2rpx; }
.error-msg {
  flex-shrink: 0;
  padding: 12rpx 14rpx;
  background: var(--risk-soft, #FFEEEC);
  border: var(--border-width, 2rpx) solid var(--risk, #FF5252);
  border-radius: var(--shape-radius-inner, 0);
  font-size: $fs-body; color: var(--risk, #FF5252); font-weight: $fw-label;
}

.composer { flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) 112rpx; gap: 10rpx; align-items: end; }
.composer-input {
  width: 100%; min-height: 76rpx; max-height: 180rpx;
  display: flex; align-items: flex-start; gap: 8rpx;
  padding: 16rpx;
  color: var(--text-main, #111); background: var(--surface, #fff);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  box-sizing: border-box;
}
.input-prefix {
  flex-shrink: 0;
  padding-top: 2rpx;
  font-size: $fs-body-lg;
  line-height: 1.4;
  font-weight: $fw-heading;
  color: var(--text-main, #111);
}
.chat-input {
  width: 100%; min-height: 76rpx; max-height: 180rpx;
  padding: 0;
  font-size: $fs-body-lg; line-height: 1.4;
  color: var(--text-main, #111); background: transparent;
  border: 0;
  box-sizing: border-box;
}
.send-btn {
  height: 76rpx;
  font-size: $fs-body; font-weight: $fw-hero; color: var(--text-main, #111);
  background: var(--accent-cool, #4ECDC4);
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.send-btn:disabled { opacity: 0.45; }
</style>
