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

      <!-- Results -->
      <view v-if="results" class="results-area">
        <view class="tone-section">
          <text class="section-label">选一种语气</text>
          <view class="tone-tabs">
            <view
              v-for="tone in toneOptions"
              :key="tone.key"
              :class="['tone-tab', activeTone === tone.key ? 'active' : '']"
              @click="activeTone = tone.key"
            >
              {{ tone.label }}
            </view>
          </view>
        </view>

        <view class="card result-card">
          <view class="result-head">
            <text class="card-label">{{ activeToneLabel }}</text>
            <button class="btn-sm" @click="copyText(activeReplyText)">复制</button>
          </view>
          <text class="card-text">{{ activeReplyText }}</text>
          <button class="btn-retry" :disabled="retryingTone || generating" @click="refreshCurrentTone">
            {{ retryingTone ? '生成中...' : '换一句' }}
          </button>
        </view>

        <view v-if="strategies.length > 0" class="strategy-area">
          <view class="strategy-card">
            <text class="card-label">{{ scene === 'active' ? '🎯 撩一下策略' : '🎯 对话策略' }}</text>
            <!-- Strategy tabs -->
            <view class="strategy-tabs">
              <view v-for="(s, si) in strategies" :key="s.type"
                :class="['strategy-tab', activeStrategyIndex === si ? 'active' : '']"
                @click="activeStrategyIndex = si">
                {{ formatStrategyLabel(s) }}
              </view>
            </view>
            <!-- Active strategy turns -->
            <view class="strategy-turns">
              <view v-for="turn in strategies[activeStrategyIndex]?.turns" :key="turn.step" class="turn-block">
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
            </view>
          </view>
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
import { ref, computed } from 'vue'
import { generatePetReplyPair, generateReplyStrategy, handleInsufficientBalance } from '@/utils/api'

const props = defineProps<{ visible: boolean; petName?: string }>()
const emit = defineEmits(['close'])

type ToneKey = 'humor' | 'flirty' | 'sincere' | 'literary'
type ReplyVariants = Partial<Record<ToneKey, string>>

const toneOptions: Array<{ key: ToneKey; label: string }> = [
  { key: 'humor', label: '幽默轻松' },
  { key: 'flirty', label: '暧昧轻撩' },
  { key: 'sincere', label: '真诚直接' },
  { key: 'literary', label: '委婉文艺' }
]

const scene = ref<'active' | 'reply'>('reply')
const content = ref('')
const generating = ref(false)
const retryingTone = ref(false)
const errorMsg = ref('')
const activeTone = ref<ToneKey>('sincere')
const results = ref<{ variants: ReplyVariants; reply?: string; alternative?: string } | null>(null)
const strategies = ref<any[]>([])
const activeStrategyIndex = ref(0)

const sheetTitle = computed(() => `${props.petName || '小咪'}帮你说`)
const activeToneLabel = computed(() => toneOptions.find(t => t.key === activeTone.value)?.label || '真诚直接')
const activeReplyText = computed(() => results.value?.variants?.[activeTone.value] || '')

function getDefaultTone(nextScene: 'active' | 'reply'): ToneKey {
  return nextScene === 'active' ? 'flirty' : 'sincere'
}

function normalizeReplyVariants(res: any): ReplyVariants {
  const variants = res?.variants && typeof res.variants === 'object' ? { ...res.variants } : {}
  if (!variants.humor && res?.reply) variants.humor = res.reply
  if (!variants.literary && res?.alternative) variants.literary = res.alternative
  return variants
}

function ensureActiveToneHasText(variants: ReplyVariants) {
  if (variants[activeTone.value]) return
  const availableTone = toneOptions.find(t => variants[t.key])?.key
  activeTone.value = availableTone || getDefaultTone(scene.value)
}

function switchScene(nextScene: 'active' | 'reply') {
  if (scene.value === nextScene) return
  scene.value = nextScene
  activeTone.value = getDefaultTone(nextScene)
  results.value = null
  strategies.value = []
  activeStrategyIndex.value = 0
  errorMsg.value = ''
}

function formatStrategyLabel(strategy: any) {
  if (strategy?.type === 'contrast') return '反转'
  return strategy?.label || ''
}

async function generate() {
  const text = content.value.trim()
  if (!text || generating.value) return

  generating.value = true
  errorMsg.value = ''
  results.value = null
  strategies.value = []
  activeStrategyIndex.value = 0
  let generated = false

  try {
    const res = await generatePetReplyPair(scene.value, text)
    if (handleInsufficientBalance(res)) {
      errorMsg.value = '额度不足，请充值后再试'
    } else if (!res?.success) {
      errorMsg.value = res?.message || '生成失败，请重试'
    } else {
      const variants = normalizeReplyVariants(res)
      ensureActiveToneHasText(variants)
      results.value = { variants, reply: res.reply, alternative: res.alternative }
      generated = true
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '网络异常，请重试'
  }

  if (generated) {
    try {
      const stratRes = await generateReplyStrategy(text, scene.value)
      if (stratRes?.success && stratRes.strategies?.length > 0) {
        strategies.value = stratRes.strategies
      }
    } catch {}
  }

  generating.value = false
}

async function refreshCurrentTone() {
  const text = content.value.trim()
  if (!text || retryingTone.value || generating.value) return

  retryingTone.value = true
  errorMsg.value = ''
  try {
    const res = await generatePetReplyPair(scene.value, text, activeTone.value)
    if (handleInsufficientBalance(res)) {
      errorMsg.value = '额度不足，请充值后再试'
      return
    }
    if (!res?.success) {
      errorMsg.value = res?.message || '生成失败，请重试'
      return
    }

    const variants = normalizeReplyVariants(res)
    const nextText = variants[activeTone.value]
    if (nextText) {
      results.value = {
        ...(results.value || { variants: {} }),
        variants: {
          ...(results.value?.variants || {}),
          [activeTone.value]: nextText
        }
      }
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
  results.value = null
  activeTone.value = getDefaultTone(scene.value)
  strategies.value = []
  activeStrategyIndex.value = 0
  errorMsg.value = ''
  emit('close')
}
</script>

<style scoped>
.sheet-mask {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet-panel {
  width: 100%; max-width: 500px; max-height: 85vh;
  background: #FFFDF5; border: 3px solid #111;
  box-shadow: 8rpx 8rpx 0 #111;
  padding: 24rpx; overflow-y: auto;
}

.sheet-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx;
}
.sheet-title { font-size: 32rpx; font-weight: 900; color: #111; letter-spacing: 2rpx; }
.sheet-close { font-size: 28rpx; font-weight: 900; color: #999; padding: 8rpx; }

.tab-row { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.tab {
  flex: 1; text-align: center; padding: 14rpx;
  font-size: 24rpx; font-weight: 700; color: #999;
  border: 2rpx solid #ddd; background: #fff;
}
.tab.active { color: #111; border-color: #111; background: #FFD93D; }

.input-label { display: block; font-size: 22rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.text-area {
  width: 100%; height: 120rpx; padding: 16rpx; font-size: 24rpx;
  border: 2rpx solid #111; background: #fff;
  box-sizing: border-box;
}

.btn-generate {
  width: 100%; margin-top: 16rpx; padding: 16rpx;
  font-size: 26rpx; font-weight: 900; color: #111;
  background: #FFD93D; border: 2rpx solid #111;
  box-shadow: 4rpx 4rpx 0 #111;
}
.btn-generate[disabled] { opacity: 0.4; }

.results-area { margin-top: 24rpx; }
.tone-section { margin-bottom: 16rpx; }
.section-label { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }
.tone-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; }
.tone-tab {
  min-width: 0; text-align: center; padding: 10rpx 6rpx;
  font-size: 20rpx; font-weight: 800; color: #666;
  background: #fff; border: 2rpx solid #ddd; box-sizing: border-box;
}
.tone-tab.active { color: #111; border-color: #111; background: #FFD93D; }
.card {
  padding: 18rpx; border: 2rpx solid #111; background: #f0fff0;
  margin-bottom: 14rpx;
}
.result-card { background: #f0fff0; }
.result-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 8rpx; }
.result-head .card-label { margin-bottom: 0; }
.card.alt { background: #fff8e1; }
.card-label { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.card-text { display: block; font-size: 26rpx; color: #111; line-height: 1.5; margin-bottom: 12rpx; }
.card-actions { display: flex; justify-content: flex-end; }
.btn-sm {
  padding: 8rpx 20rpx; font-size: 20rpx; font-weight: 700; color: #111;
  background: #fff; border: 2rpx solid #111;
}

.btn-retry {
  width: 100%; margin-top: 8rpx; padding: 14rpx;
  font-size: 22rpx; font-weight: 700; color: #666;
  background: #fff; border: 2rpx dashed #999;
}
.btn-retry[disabled] { opacity: 0.4; }

.strategy-area { margin-top: 8rpx; }
.strategy-card { background: #fdf8f3; border: 2rpx solid #f0a060; padding: 20rpx; }
.strategy-tabs { display: flex; gap: 10rpx; margin: 12rpx 0; }
.strategy-tab {
  padding: 8rpx 24rpx; font-size: 22rpx; font-weight: 700; color: #f0a060;
  background: #fff; border: 2rpx solid #f0a060; border-radius: 20rpx;
}
.strategy-tab.active { background: #f0a060; color: #fff; }
.strategy-turns { margin-top: 16rpx; }
.turn-block { margin-bottom: 20rpx; padding: 16rpx; background: #fff; border-left: 4rpx solid #f0a060; }
.turn-header { display: flex; align-items: center; gap: 10rpx; margin-bottom: 10rpx; }
.turn-step { font-size: 20rpx; font-weight: 900; color: #f0a060; }
.turn-note { font-size: 18rpx; color: #999; }
.turn-bubble {
  display: flex; justify-content: space-between; align-items: center; gap: 10rpx;
  padding: 14rpx; background: #fff7ed; border-radius: 8rpx; margin-bottom: 8rpx;
}
.turn-text { font-size: 26rpx; color: #111; line-height: 1.5; flex: 1; }
.turn-reactions { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; }
.reactions-label { font-size: 18rpx; color: #aaa; }
.reaction-tag {
  padding: 4rpx 12rpx; font-size: 18rpx; color: #999;
  background: #f0f0f0; border-radius: 10rpx;
}

.error-msg {
  margin-top: 16rpx; padding: 14rpx;
  background: #fff0f0; border: 2rpx solid #ff4444;
  font-size: 22rpx; color: #cc0000; font-weight: 700;
}
</style>
