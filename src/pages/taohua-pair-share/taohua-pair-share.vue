<template>
  <view :class="['page', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']">
    <view class="hero">
      <text class="brand">Crush Master · 桃花匹配</text>
      <text class="title">我和 TA 的桃花匹配度</text>
      <text class="subtitle">{{ payload.self.zodiac }} · {{ payload.self.sign }} × {{ payload.partner.zodiac }} · {{ payload.partner.sign }}</text>
    </view>

    <view class="poster">
      <view class="pair-grid">
        <view class="party">
          <text class="role">我</text>
          <text class="token zodiac">{{ payload.self.zodiac }}</text>
          <text class="token sign">{{ payload.self.sign }}</text>
        </view>

        <view class="relation">
          <text class="relation-kicker">匹配</text>
          <text :class="['relation-main', relationClass]">{{ payload.match.relation }}</text>
          <text :class="['relation-main', signClass]">{{ payload.match.signRelation || '星座节奏平衡' }}</text>
        </view>

        <view class="party">
          <text class="role">TA</text>
          <text class="token zodiac">{{ payload.partner.zodiac }}</text>
          <text class="token sign">{{ payload.partner.sign }}</text>
        </view>
      </view>

      <view class="summary">
        <text class="summary-title">关系快照</text>
        <text class="summary-copy">{{ payload.match.combinedRelationDesc }}</text>
      </view>

      <view class="section" v-if="payload.insight.activities.length">
        <text class="section-title">适合一起</text>
        <text v-for="item in payload.insight.activities.slice(0, 2)" :key="item" class="line good">{{ item }}</text>
      </view>

      <view class="section" v-if="payload.insight.watchOut.length">
        <text class="section-title">当心</text>
        <text v-for="item in payload.insight.watchOut.slice(0, 2)" :key="item" class="line">{{ item }}</text>
      </view>

      <view class="section compact">
        <text class="section-title">TA 的桃花风格</text>
        <text class="line">{{ payload.partnerStyle }}</text>
      </view>
    </view>

    <view v-if="!ready" class="cta-card">
      <text class="cta-title">正在准备...</text>
      <text class="cta-copy">稍等一下</text>
    </view>
    <view v-else class="cta-card">
      <text class="cta-title">测测你和 TA 的真实配对</text>
      <text class="cta-copy">补齐你和 TA 的基础画像，马上生成你们自己的桃花匹配度。</text>
      <button class="primary-btn" @click="startPair">测测我和 TA</button>
      <button class="ghost-btn" @click="goHome">先逛逛</button>
    </view>

    <text class="disclaimer">AI 辅助分析 · 仅供文化娱乐参考</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getCurrentUserId } from '@/utils/api'
import { TAOHUA_SHARE_IMAGE, appendReferralParams } from '@/utils/share'
import { captureLandingContext } from '@/utils/landing'
import { buildPairMatchPayload, SIGN_NAMES, ZODIAC_NAMES } from '@/utils/taohua'

const selfZodiac = ref('兔')
const selfSign = ref('双鱼座')
const taZodiac = ref('马')
const taSign = ref('天秤座')
const ready = ref(false)

const payload = computed(() => buildPairMatchPayload(selfZodiac.value, selfSign.value, taZodiac.value, taSign.value))
const relationClass = computed(() => relationTone(payload.value.match.relation))
const signClass = computed(() => relationTone(payload.value.match.signRelation || ''))

onLoad(async (options: any) => {
  captureLandingContext(options || {})
  const sz = decodeURIComponent(String(options?.selfZodiac || ''))
  const ss = decodeURIComponent(String(options?.selfSign || ''))
  const tz = decodeURIComponent(String(options?.taZodiac || ''))
  const ts = decodeURIComponent(String(options?.taSign || ''))
  if (ZODIAC_NAMES.includes(sz)) selfZodiac.value = sz
  if (SIGN_NAMES.includes(ss)) selfSign.value = ss
  if (ZODIAC_NAMES.includes(tz)) taZodiac.value = tz
  if (SIGN_NAMES.includes(ts)) taSign.value = ts
  await waitForSilentLogin()
  ready.value = true
})

onShareAppMessage(() => {
  let path = `/pages/taohua-pair-share/taohua-pair-share?selfZodiac=${encodeURIComponent(selfZodiac.value)}&selfSign=${encodeURIComponent(selfSign.value)}&taZodiac=${encodeURIComponent(taZodiac.value)}&taSign=${encodeURIComponent(taSign.value)}&from=reshare`
  path = appendReferralParams(path, 'taohua_pair')
  return { title: `${selfZodiac.value} × ${taZodiac.value} 的桃花匹配度`, path, imageUrl: TAOHUA_SHARE_IMAGE }
})

async function waitForSilentLogin() {
  const existingUserId = getCurrentUserId()
  console.log('[pair-share] waitForSilentLogin start', {
    hasUserId: Boolean(existingUserId),
    silentLoginDone: Boolean(uni.getStorageSync('silentLoginDone')),
    silentLoginTried: Boolean(uni.getStorageSync('silentLoginTried'))
  })
  if (existingUserId) return
  const maxWait = 3000
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    const uid = getCurrentUserId()
    if (uid) {
      console.log('[pair-share] waitForSilentLogin user ready', { elapsedMs: Date.now() - start, userIdTail: uid.slice(-8) })
      return
    }
    if (uni.getStorageSync('silentLoginDone')) {
      await new Promise(resolve => setTimeout(resolve, 300))
      console.log('[pair-share] waitForSilentLogin done flag', {
        elapsedMs: Date.now() - start,
        hasUserId: Boolean(getCurrentUserId())
      })
      return
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  console.warn('[pair-share] waitForSilentLogin timeout', { hasUserId: Boolean(getCurrentUserId()) })
}

function relationTone(relation = '') {
  if (relation.includes('六合') || relation.includes('同频') || relation.includes('助燃') || relation.includes('滋养')) return 'good'
  if (relation.includes('三合') || relation.includes('同宫') || relation.includes('平衡')) return 'mid'
  if (relation.includes('冲') || relation.includes('差') || relation.includes('磨合') || relation.includes('校准')) return 'bad'
  return 'neutral'
}

function startPair() {
  const target = `/pages/pair-onboarding/pair-onboarding?selfZodiac=${encodeURIComponent(selfZodiac.value)}&selfSign=${encodeURIComponent(selfSign.value)}&taZodiac=${encodeURIComponent(taZodiac.value)}&taSign=${encodeURIComponent(taSign.value)}&from=pair_share`
  if (!getCurrentUserId()) {
    uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent(target)}` })
    return
  }
  uni.navigateTo({ url: target })
}

function goHome() {
  const uid = getCurrentUserId()
  console.log('[pair-share] goHome', {
    hasUserId: Boolean(uid),
    userIdTail: uid ? uid.slice(-8) : '',
    silentLoginDone: Boolean(uni.getStorageSync('silentLoginDone'))
  })
  if (uid) {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  uni.navigateTo({ url: '/pages/login/login' })
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(160deg, #fff6e4 0%, #eaf7ff 52%, #fffdf5 100%);
  box-sizing: border-box;
}

.hero { padding: 26rpx 10rpx 20rpx; }
.brand {
  display: inline-block;
  padding: 8rpx 18rpx;
  background: #111;
  color: #ffd93d;
  font-size: $fs-caption;
  font-weight: $fw-hero;
  box-shadow: 4rpx 4rpx 0 #4ecdc4;
}
.title {
  display: block;
  margin-top: 28rpx;
  color: #111;
  font-size: $fs-display;
  line-height: $lh-hero;
  font-weight: $fw-hero;
}
.subtitle {
  display: block;
  margin-top: 12rpx;
  color: #0a6f69;
  font-size: $fs-body-lg;
  font-weight: $fw-hero;
}

.poster {
  padding: 30rpx;
  background: #fffdf5;
  border: 4rpx solid #111;
  box-shadow: 10rpx 10rpx 0 #111;
}
.pair-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160rpx minmax(0, 1fr);
  gap: 12rpx;
  align-items: stretch;
}
.party {
  min-width: 0;
  padding: 16rpx;
  border: 3rpx dashed #111;
  background: #fff;
}
.role {
  display: block;
  text-align: center;
  color: #666;
  font-size: $fs-caption;
  font-weight: $fw-hero;
}
.token {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  margin-top: 12rpx;
  border: 3rpx solid #111;
  color: #111;
  font-size: $fs-body-lg;
  font-weight: $fw-hero;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.token.zodiac { background: #ffd93d; }
.token.sign { background: #eaf7ff; }
.relation {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8rpx;
  text-align: center;
}
.relation-kicker {
  color: #111;
  font-size: $fs-caption;
  font-weight: $fw-hero;
}
.relation-main {
  display: block;
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: $fw-hero;
}
.relation-main.good { color: #0a8f86; }
.relation-main.mid { color: #a87600; }
.relation-main.bad { color: #d33f49; }
.relation-main.neutral { color: #111; }

.summary,
.section {
  margin-top: 24rpx;
  padding: 24rpx;
  border: 3rpx solid #111;
  background: #fff;
}
.summary { background: #fff4c7; }
.summary-title,
.section-title {
  display: block;
  color: #8a3a28;
  font-size: $fs-body;
  font-weight: $fw-hero;
}
.summary-copy,
.line {
  display: block;
  margin-top: 12rpx;
  color: #111;
  font-size: $fs-body-lg;
  line-height: 1.55;
  font-weight: $fw-label;
}
.line.good { color: #0a8f86; }
.compact { background: #f2f0ea; }

.cta-card {
  margin-top: 34rpx;
  padding: 30rpx;
  background: #111;
  color: #fff;
  border: 4rpx solid #111;
  box-shadow: 8rpx 8rpx 0 #4ecdc4;
}
.cta-title {
  display: block;
  color: #ffd93d;
  font-size: $fs-heading;
  font-weight: $fw-hero;
}
.cta-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255,255,255,0.78);
  font-size: $fs-body-lg;
  line-height: 1.45;
  font-weight: $fw-label;
}
.primary-btn,
.ghost-btn {
  margin-top: 22rpx;
  width: 100%;
  height: 82rpx;
  line-height: 82rpx;
  border: 3rpx solid #111;
  border-radius: 0;
  font-size: $fs-heading;
  font-weight: $fw-hero;
}
.primary-btn { background: #4ecdc4; color: #111; }
.ghost-btn { background: #fff; color: #111; }
.disclaimer {
  display: block;
  padding: 30rpx 0 10rpx;
  text-align: center;
  color: #8e8177;
  font-size: $fs-caption;
  font-weight: $fw-label;
}

.font-large .brand,
.font-large .role,
.font-large .relation-kicker,
.font-large .disclaimer {
  font-size: $fs-body;
}

.font-large .title {
  font-size: 56rpx;
}

.font-large .subtitle,
.font-large .token,
.font-large .summary-copy,
.font-large .line,
.font-large .cta-copy {
  font-size: 38rpx;
}

.font-large .relation-main {
  font-size: 38rpx;
}

.font-large .summary-title,
.font-large .section-title {
  font-size: 36rpx;
}

.font-large .cta-title,
.font-large .primary-btn,
.font-large .ghost-btn {
  font-size: 43rpx;
}
</style>
