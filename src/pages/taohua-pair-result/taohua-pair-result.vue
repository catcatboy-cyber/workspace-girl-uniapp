<template>
  <view :class="['page v2-mode', ready ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view v-if="loading" class="loading-v2">LOADING...</view>

    <template v-else-if="payload">
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">PAIR MATCH</text>
        <text class="hero-title-v2">我和 <text class="hl-v2">{{ partnerLabel }}</text></text>
        <text class="hero-copy-v2">{{ payload.self.zodiac }} · {{ payload.self.sign }} × {{ payload.partner.zodiac }} · {{ payload.partner.sign }}</text>
      </view>

      <!-- 桃花匹配度 · 一张卡片 -->
      <view class="card-v2 pair-match-card anim-card" style="animation-delay:0.1s">
        <!-- 标题栏 -->
        <view class="pair-match-head">
          <text class="section-title-v2 no-margin">桃花匹配度</text>
          <!-- #ifdef MP-WEIXIN -->
          <button class="pair-share-btn" open-type="share">↗</button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <view class="pair-share-btn pair-share-btn-disabled">↗</view>
          <!-- #endif -->
        </view>

        <!-- 一句话结论 -->
        <text class="card-text-v2">{{ payload.match.combinedRelationDesc }}</text>

        <!-- 身份卡 · 三行对齐 -->
        <view class="pair-id-card">
          <!-- 行1: 头像 -->
          <view class="id-row">
            <view class="id-cell">
              <view class="identity-avatar">
                <image v-if="selfAvatarUrl" class="identity-avatar-img" :src="selfAvatarUrl" mode="aspectFill" />
                <text v-else class="identity-avatar-placeholder">我</text>
              </view>
            </view>
            <view class="id-cell id-match">
              <text class="match-badge-text">{{ payload.match.combinedRelation }}</text>
            </view>
            <view class="id-cell">
              <view class="identity-avatar">
                <image v-if="targetAvatarUrl" class="identity-avatar-img" :src="targetAvatarUrl" mode="aspectFill" />
                <text v-else class="identity-avatar-placeholder">TA</text>
              </view>
            </view>
          </view>
          <!-- 行2: 生肖 -->
          <view class="id-row">
            <view class="id-cell">
              <image v-if="getZodiacSvg(payload.self.zodiac)" class="id-symbol-icon" :src="getZodiacSvg(payload.self.zodiac)" mode="aspectFit" />
              <text class="identity-zodiac">{{ payload.self.zodiac }}</text>
            </view>
            <view class="id-cell id-match">
              <text :class="['match-badge-text', toneClass]">{{ payload.match.relation }}</text>
            </view>
            <view class="id-cell">
              <image v-if="getZodiacSvg(payload.partner.zodiac)" class="id-symbol-icon" :src="getZodiacSvg(payload.partner.zodiac)" mode="aspectFit" />
              <text class="identity-zodiac">{{ payload.partner.zodiac }}</text>
            </view>
          </view>
          <!-- 行3: 星座 -->
          <view class="id-row">
            <view class="id-cell">
              <text class="identity-sign">{{ payload.self.sign }}</text>
            </view>
            <view class="id-cell id-match">
              <text :class="['match-badge-text', signToneClass]">{{ payload.match.signRelation || '星座节奏平衡' }}</text>
            </view>
            <view class="id-cell">
              <text class="identity-sign">{{ payload.partner.sign }}</text>
            </view>
          </view>
        </view>

        <!-- 双栏 -->
        <view class="pair-dual-grid">
          <!-- 中国栏 -->
          <view class="pair-col">
            <text class="col-header">中国命理</text>

            <view class="col-block">
              <text class="col-label">地支关系</text>
              <text :class="['col-value', toneClass]">{{ payload.match.relation }}</text>
            </view>

            <view class="col-block">
              <text class="col-label">解读</text>
              <text class="col-text">{{ payload.match.relationDesc }}</text>
            </view>

            <view v-if="payload.insight.chineseActivities.length" class="col-block">
              <text class="col-label">命理推荐</text>
              <view class="tag-row">
                <text v-for="item in payload.insight.chineseActivities" :key="item" class="col-tag">{{ item }}</text>
              </view>
            </view>

            <view v-if="payload.insight.chineseWatchOut.length" class="col-block">
              <text class="col-label">命理注意</text>
              <view class="warn-list">
                <text v-for="item in payload.insight.chineseWatchOut" :key="item" class="warn-item">{{ item }}</text>
              </view>
            </view>

            <text class="source-note">出处：《三命通会》</text>
          </view>

          <!-- 西方栏 -->
          <view class="pair-col">
            <text class="col-header">西方星座</text>

            <view class="col-block">
              <text class="col-label">星座互动</text>
              <text :class="['col-value', signToneClass]">{{ payload.match.signRelation || '星座节奏平衡' }}</text>
            </view>

            <view class="col-block">
              <text class="col-label">解读</text>
              <text class="col-text">{{ payload.match.signRelationDesc || payload.match.combinedRelationDesc }}</text>
            </view>

            <view v-if="payload.selfWestern.element && payload.partnerWestern.element" class="col-block">
              <text class="col-label">元素适配</text>
              <text class="col-text">{{ elementComboText }}</text>
            </view>

            <view v-if="payload.insight.westernActivities.length" class="col-block">
              <text class="col-label">星座推荐</text>
              <view class="tag-row">
                <text v-for="item in payload.insight.westernActivities" :key="item" class="col-tag">{{ item }}</text>
              </view>
            </view>

            <view class="col-block">
              <text class="col-label">桃花风格</text>
              <text class="col-text">{{ payload.partnerStyle || '节奏自然，适合继续观察真实行动。' }}</text>
            </view>

            <view v-if="payload.insight.westernWatchOut.length" class="col-block">
              <text class="col-label">星座注意</text>
              <view class="warn-list">
                <text v-for="item in payload.insight.westernWatchOut" :key="item" class="warn-item">{{ item }}</text>
              </view>
            </view>

            <text class="source-note">出处：Ptolemy《Tetrabiblos》</text>
          </view>
        </view>
      </view>

      <view class="actions anim-card" style="animation-delay:0.3s">
        <button class="btn-v2 primary" @click="goHome">回到首页</button>
        <button class="btn-v2 ghost" @click="goTaohua">继续看今日桃花</button>
      </view>

      <text class="page-disclaimer">命理桃花 · 仅供文化娱乐参考</text>
    </template>

    <view v-else class="empty-card">
      <text class="empty-title">暂时看不了匹配度</text>
      <text class="empty-copy">{{ errorMessage || '双方生肖和星座还不完整。' }}</text>
      <button class="btn-v2 primary" @click="goHome">回到首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCachedSelfProfile, getCaseDetail, getCurrentUserId, getSelfProfile } from '@/utils/api'
import { SIGN_NAMES, ZODIAC_NAMES, ZODIAC_TO_ZHI, buildPairMatchPayload, getElementComboText, type PairMatchPayload } from '@/utils/taohua'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { getZodiacSvg } from '@/utils/zodiac-icons'
import { aiLabel } from '@/utils/labels'

const ready = ref(false)
const loading = ref(true)
const caseId = ref('')
const partnerLabel = ref('TA')
const selfAvatarUrl = ref('')
const targetAvatarUrl = ref('')
const payload = ref<PairMatchPayload | null>(null)
const errorMessage = ref('')
const fontSizeMode = ref(getFontSizeMode())
const pageStyle = ref(getThemeStyle())

const toneClass = computed(() => relationTone(payload.value?.match?.relation || ''))
const signToneClass = computed(() => relationTone(payload.value?.match?.signRelation || ''))
const elementComboText = computed(() => {
  const selfEl = payload.value?.selfWestern?.element
  const partnerEl = payload.value?.partnerWestern?.element
  if (!selfEl || !partnerEl) return ''
  return getElementComboText(selfEl, partnerEl)
})

onLoad(async (options: any) => {
  caseId.value = String(options?.caseId || '').trim()
  await loadResult()
})

onShow(() => {
  applyThemeChrome()
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
})

async function loadResult() {
  loading.value = true
  errorMessage.value = ''
  try {
    const uid = getCurrentUserId()
    if (!uid) {
      errorMessage.value = '请先完成登录。'
      return
    }
    if (!caseId.value) {
      errorMessage.value = '没有找到 TA 档案。'
      return
    }

    const detail = await getCaseDetail(uid, caseId.value)
    const profile = detail?.profile || {}
    partnerLabel.value = String(detail?.name || 'TA').trim() || 'TA'

    let self = getCachedSelfProfile()
    if (!self?.zodiac || !self?.constellation) {
      const profileRes = await getSelfProfile().catch(() => null)
      self = profileRes?.selfProfile || getCachedSelfProfile()
    }
    selfAvatarUrl.value = String(self?.avatarUrl || self?.avatar || '').trim()

    const selfZodiac = normalizeOption(self?.zodiac, ZODIAC_NAMES)
    const selfSign = normalizeOption(self?.constellation, SIGN_NAMES)
    const taZodiac = normalizeOption(profile?.zodiac, ZODIAC_NAMES)
    const taSign = normalizeOption(profile?.constellation, SIGN_NAMES)
    // Crush 档案主字段是 profile.avatar；avatarUrl 多为解析后的展示字段
    targetAvatarUrl.value = String(profile?.avatarUrl || profile?.avatar || '').trim()
    if (!selfZodiac || !selfSign || !taZodiac || !taSign) {
      errorMessage.value = '双方生肖和星座还不完整。'
      return
    }
    payload.value = buildPairMatchPayload(selfZodiac, selfSign, taZodiac, taSign)
  } catch (error: any) {
    errorMessage.value = error?.message || '匹配结果生成失败。'
  } finally {
    loading.value = false
    ready.value = true
  }
}

function normalizeOption(value: any, options: string[]) {
  const source = String(value || '').trim()
  return options.includes(source) ? source : ''
}

function relationTone(relation = '') {
  if (relation.includes('六合') || relation.includes('同频') || relation.includes('助燃') || relation.includes('滋养')) return 'good'
  if (relation.includes('三合') || relation.includes('同宫') || relation.includes('平衡')) return 'mid'
  if (relation.includes('冲') || relation.includes('差') || relation.includes('磨合') || relation.includes('校准')) return 'bad'
  return 'neutral'
}

// migrated to getZodiacSvg

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goTaohua() {
  const url = caseId.value
    ? `/pages/taohua/taohua?caseId=${encodeURIComponent(caseId.value)}&from=pair_result`
    : '/pages/taohua/taohua'
  uni.navigateTo({ url })
}
</script>

<script lang="ts">
export default {
  onShareAppMessage() {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    const payload = page?.$vm?.payload
    if (payload) {
      return {
        title: `我和 TA 的桃花匹配度`,
        path: `/pages/taohua-pair-share/taohua-pair-share?selfZodiac=${encodeURIComponent(payload.self.zodiac)}&selfSign=${encodeURIComponent(payload.self.sign)}&taZodiac=${encodeURIComponent(payload.partner.zodiac)}&taSign=${encodeURIComponent(payload.partner.sign)}`,
      }
    }
    return {
      title: '桃花匹配度',
      path: '/pages/taohua/taohua',
    }
  },
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";

.page {
  min-height: 100vh;
  padding: 22rpx;
  background: var(--app-bg, #FFFDF5);
  box-sizing: border-box;
}
.hero-block-v2 { @include hero-block-v2; margin-bottom: 20rpx; }
.hero-tag-v2 {
  display: inline-block;
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  padding: 6rpx 16rpx;
  font-size: $fs-caption;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}
.hero-title-v2 {
  display: block;
  color: var(--hero-text-color, #111);
  font-size: $fs-hero-title;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 1.12;
}
.hl-v2 { display: inline-block; padding: 0 8rpx; background: var(--accent, #FFD93D); }
.hero-copy-v2 {
  display: block;
  margin-top: 14rpx;
  color: var(--text-muted, rgba(0,0,0,0.68));
  font-size: $fs-body-lg;
  font-weight: $fw-label;
  line-height: 1.5;
}
.card-v2,
.empty-card {
  @include card-v2;
  margin-bottom: 20rpx;
}
.section-title-v2 { @include section-title-v2; }
.section-title-v2.no-margin { margin-bottom: 0; }

// ── 桃花匹配度卡片 ──
.pair-match-card {
  box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111);
}
.pair-match-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.pair-share-btn {
  width: 56rpx; height: 56rpx;
  padding: 0; margin: 0;
  border: 2rpx solid var(--ink, #111);
  background: var(--card, #fff);
  display: flex; align-items: center; justify-content: center;
  font-size: $fs-heading; font-weight: $fw-heading;
  line-height: 56rpx;
  border-radius: 0;
  box-sizing: border-box;
  &::after { border: none; }
}
.pair-share-btn-disabled {
  opacity: 0.35;
}
.card-text-v2 {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-body-lg;
  font-weight: $fw-body;
  line-height: 1.65;
  margin-bottom: 24rpx;
}

// ── 身份卡 ──
.pair-id-card {
  border: 2rpx solid var(--ink, #111);
  background: var(--app-bg, #FFFDF5);
  padding: 24rpx;
  margin-bottom: 28rpx;
}
.id-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12rpx;
  align-items: center;
  padding: 10rpx 0;
  & + & { border-top: 1rpx solid var(--divider-strong, #111); }
}
.id-cell {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  flex-wrap: wrap;
}
.id-match {
  min-width: 120rpx;
  padding: 6rpx 12rpx;
  background: var(--ink, #111);
}
.match-badge-text {
  color: var(--accent, #FFD93D);
  font-size: $fs-caption;
  font-weight: $fw-heading;
  text-align: center;
  line-height: 1.25;
}
.match-badge-text.good { color: var(--mint, #4ECDC4); }
.match-badge-text.mid  { color: var(--accent, #FFD93D); }
.match-badge-text.bad  { color: var(--risk, #FF5252); }
.identity-avatar {
  width: 64rpx; height: 64rpx;
  flex-shrink: 0;
  border: 3rpx solid var(--ink, #111);
  border-radius: 50%;
  overflow: hidden;
  background: var(--ink, #111);
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.identity-avatar-img {
  width: 64rpx; height: 64rpx;
  border-radius: 50%;
  display: block; flex-shrink: 0;
}
.identity-avatar-placeholder {
  font-size: $fs-body;
  font-weight: $fw-hero;
  color: var(--accent, #FFD93D);
}
.identity-zodiac {
  font-size: $fs-body-lg;
  font-weight: $fw-hero;
  color: var(--text-main, #111);
}
.identity-sign {
  font-size: $fs-body;
  font-weight: $fw-label;
  color: var(--mint, #4ECDC4);
}
.id-symbol-icon {
  width: 32rpx; height: 32rpx;
  flex-shrink: 0; display: block;
}

// ── 双栏 ──
.pair-dual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}
.pair-col {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}
.col-header {
  display: block;
  font-size: $fs-body-lg;
  font-weight: $fw-heading;
  color: var(--text-main, #111);
  margin-bottom: 16rpx;
  padding-bottom: 10rpx;
  border-bottom: 2rpx solid var(--ink, #111);
}
.col-block {
  margin-top: 16rpx;
  & + & { margin-top: 12rpx; }
}
.col-label {
  display: block;
  font-size: $fs-caption;
  font-weight: $fw-label;
  color: var(--text-muted, #666);
  margin-bottom: 4rpx;
}
.col-value {
  display: block;
  font-size: $fs-body;
  font-weight: $fw-heading;
  color: var(--text-main, #111);
  line-height: 1.35;
}
.col-value.good { color: var(--mint, #4ECDC4); }
.col-value.mid  { color: var(--accent, #FFD93D); }
.col-value.bad  { color: var(--risk, #FF5252); }
.col-text {
  display: block;
  font-size: $fs-body;
  font-weight: $fw-body;
  color: var(--text-main, #111);
  line-height: 1.6;
}
.col-tag {
  display: inline-block;
  padding: 8rpx 12rpx;
  border: 2rpx solid var(--ink, #111);
  background: var(--card, #fff);
  color: var(--text-main, #111);
  font-size: $fs-caption;
  font-weight: $fw-label;
  line-height: 1.3;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.warn-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.warn-item {
  display: block;
  padding: 10rpx 12rpx;
  border-left: 4rpx solid var(--risk, #FF5252);
  background: var(--risk-soft, #FFEEEC);
  color: var(--text-main, #111);
  font-size: $fs-body;
  font-weight: $fw-body;
  line-height: 1.5;
}
.source-note {
  display: block;
  margin-top: 16rpx;
  font-size: $fs-caption;
  font-weight: $fw-body;
  color: var(--text-soft, #999);
}

// ── 窄屏 + 大字体折叠 ──
@media (max-width: 340px) {
  .font-large .pair-dual-grid {
    grid-template-columns: 1fr;
  }
}

// ── 大字体覆盖 ──
.font-large {
  .pair-share-btn { font-size: $fs-heading * 1.2; }
  .pair-match-head .section-title-v2 { font-size: $fs-heading * 1.2; }
  .identity-avatar { width: 80rpx; height: 80rpx; }
  .identity-avatar-img { width: 80rpx; height: 80rpx; }
  .identity-zodiac { font-size: $fs-body-lg * 1.2; }
  .identity-sign { font-size: $fs-body * 1.2; }
  .match-badge-text { font-size: $fs-caption * 1.2; }
  .col-header { font-size: $fs-body-lg * 1.2; }
  .col-label { font-size: $fs-caption * 1.2; }
  .col-value { font-size: $fs-body * 1.2; }
  .col-text { font-size: $fs-body * 1.2; }
  .col-tag { font-size: $fs-caption * 1.2; }
  .source-note { font-size: $fs-micro * 1.2; }
  .warn-item { font-size: $fs-body * 1.2; }
}
.actions {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}
.btn-v2 {
  flex: 1;
  height: 88rpx;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: 0;
  font-size: $fs-body-lg;
  font-weight: var(--font-weight-hero, $fw-hero);
  line-height: 82rpx;
}
.btn-v2.primary {
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  box-shadow: 6rpx 6rpx 0 var(--hero-bg, #FF6B6B);
}
.btn-v2.ghost {
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  box-shadow: 6rpx 6rpx 0 var(--accent-cool, #4ECDC4);
}
.empty-title {
  display: block;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
}
.empty-copy {
  display: block;
  margin: 12rpx 0 24rpx;
  color: var(--text-muted, #666);
  font-size: $fs-body-lg;
  line-height: 1.5;
}
.loading-v2 {
  padding: 140rpx 0;
  text-align: center;
  color: var(--text-main, #111);
  font-size: $fs-heading;
  font-weight: var(--font-weight-hero, $fw-hero);
  letter-spacing: 4rpx;
}
.page-disclaimer {
  display: block;
  padding: 30rpx 0 12rpx;
  color: var(--text-soft, #aaa);
  text-align: center;
  font-size: $fs-caption;
  font-weight: $fw-label;
}
</style>
