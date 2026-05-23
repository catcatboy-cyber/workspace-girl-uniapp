<template>
  <view v-if="visible" class="sheet-mask" @click="onMaskClick">
    <view class="sheet-panel" @click.stop>
      <!-- Header -->
      <view class="sheet-head">
        <text class="sheet-title">小咪帮你说</text>
        <text class="sheet-close" @click="close">X</text>
      </view>

      <!-- Tabs -->
      <view class="tab-row">
        <view :class="['tab', scene === 'active' ? 'active' : '']" @click="scene = 'active'">主动问对方</view>
        <view :class="['tab', scene === 'reply' ? 'active' : '']" @click="scene = 'reply'">对方说了什么</view>
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
        <!-- Humor version -->
        <view class="card">
          <text class="card-label">★ 幽默版</text>
          <text class="card-text">{{ results.reply }}</text>
          <view class="card-actions">
            <button class="btn-sm" @click="copyText(results.reply)">复制</button>
          </view>
        </view>

        <!-- Literary version -->
        <view v-if="results.alternative" class="card alt">
          <text class="card-label">☆ 文艺版</text>
          <text class="card-text">{{ results.alternative }}</text>
          <view class="card-actions">
            <button class="btn-sm" @click="copyText(results.alternative)">复制</button>
          </view>
        </view>

        <!-- QA version (active only) -->
        <view v-if="scene === 'active' && qaLine && qaParts.length >= 2" class="card qa-card">
          <text class="card-label">◆ 撩一下</text>

          <view class="qa-step">
            <text class="qa-step-num">① 你先发</text>
            <text class="qa-step-text">{{ qaParts[0] }}</text>
            <view class="card-actions">
              <button class="btn-sm" @click="copyText(qaParts[0])">复制</button>
            </view>
          </view>

          <view class="qa-divider"></view>

          <view class="qa-step">
            <text class="qa-step-num">② 等TA回复后，你再回</text>
            <text class="qa-step-text">{{ qaParts.slice(1).join(' | ') }}</text>
            <view class="card-actions">
              <button class="btn-sm" @click="copyText(qaParts.slice(1).join(' | '))">复制</button>
            </view>
          </view>

          <button class="btn-retry" :disabled="loadingQA" @click="refreshQA">
            {{ loadingQA ? '...' : '换一个撩法' }}
          </button>
        </view>

        <!-- Regenerate (AI versions) -->
        <button class="btn-retry" :disabled="generating" @click="generate">
          {{ generating ? '生成中...' : '换一种说法' }}
        </button>
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
import { generatePetReplyPair, pickQALines, handleInsufficientBalance } from '@/utils/api'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['close'])

const scene = ref<'active' | 'reply'>('reply')
const content = ref('')
const generating = ref(false)
const errorMsg = ref('')
const results = ref<{ reply: string; alternative: string } | null>(null)
const qaLine = ref<string | null>(null)
const loadingQA = ref(false)

const qaParts = computed(() => {
  if (!qaLine.value) return []
  return qaLine.value.split('|').map(p => p.trim()).filter(Boolean)
})

async function fetchQA() {
  if (scene.value !== 'active') return
  const text = content.value.trim()
  if (!text) return
  loadingQA.value = true
  try {
    const res = await pickQALines(text)
    if (res?.success && res.lines?.length > 0) {
      qaLine.value = res.lines[0].text
    }
  } catch {} finally {
    loadingQA.value = false
  }
}

async function refreshQA() {
  const text = content.value.trim()
  if (!text) return
  loadingQA.value = true
  try {
    const res = await pickQALines(text)
    if (res?.success && res.lines?.length > 0) {
      qaLine.value = res.lines[0].text
    }
  } catch {} finally {
    loadingQA.value = false
  }
}

async function generate() {
  const text = content.value.trim()
  if (!text || generating.value) return

  generating.value = true
  errorMsg.value = ''
  results.value = null
  qaLine.value = null

  // 主动问对方时并行取 QA
  const qaPromise = scene.value === 'active' ? fetchQA() : Promise.resolve()

  try {
    const res = await generatePetReplyPair(scene.value, text)
    if (handleInsufficientBalance(res)) {
      errorMsg.value = '额度不足，请充值后再试'
      return
    }
    if (!res?.success) {
      errorMsg.value = res?.message || '生成失败，请重试'
      return
    }
    results.value = { reply: res.reply, alternative: res.alternative }
  } catch (e: any) {
    errorMsg.value = e?.message || '网络异常，请重试'
  } finally {
    generating.value = false
  }

  // 确保 QA 取到了
  await qaPromise
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
  qaLine.value = null
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
.card {
  padding: 18rpx; border: 2rpx solid #111; background: #f0fff0;
  margin-bottom: 14rpx;
}
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

.qa-card { background: #f3f0ff; }
.qa-step { margin-bottom: 12rpx; }
.qa-step-num { display: block; font-size: 20rpx; font-weight: 900; color: #6644cc; margin-bottom: 6rpx; }
.qa-step-text { display: block; font-size: 26rpx; color: #111; line-height: 1.5; margin-bottom: 10rpx; }
.qa-divider { border-top: 2rpx dashed #ddd; margin: 16rpx 0; }

.error-msg {
  margin-top: 16rpx; padding: 14rpx;
  background: #fff0f0; border: 2rpx solid #ff4444;
  font-size: 22rpx; color: #cc0000; font-weight: 700;
}
</style>
