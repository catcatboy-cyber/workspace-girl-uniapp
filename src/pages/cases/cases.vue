<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="themeVars">
      <!-- Hero -->
      <view class="hero-block-v2 anim-hero">
        <text class="hero-tag-v2">CRUSHES</text>
        <text class="hero-title-v2"><text class="hl-v2">{{ cases.length }}</text> 个 Crush</text>
        <text class="hero-copy-v2">先切换，再进入当前档案。随时可以新增。</text>
        <hr class="hero-divider">
        <view class="hero-bottom">
          <view class="hero-avatar-lg"><image v-if="activeHeroCase?.profile?.avatar" :src="activeHeroCase.profile.avatarUrl || activeHeroCase.profile.avatar" mode="aspectFill" class="hero-avatar-img" /><text v-else>{{ avatarLabel(activeHeroCase?.name) }}</text></view>
          <view class="hero-info-col">
            <view class="hero-main-row">
              <view class="hero-main-left">
                <text class="hero-name-v2">{{ activeHeroCase?.name || '还没有 Crush' }}</text>
                <text class="hero-chip primary">{{ activeHeroTypeLabel }}</text>
              </view>
              <view class="hero-action-pill" @click="goNew">+ 新建</view>
            </view>
            <view class="hero-meta-row">
              <text v-if="activeHeroProfileTags.length === 0" class="hero-chip muted">暂无画像</text>
              <text v-for="item in activeHeroProfileTags" :key="item" class="hero-chip">{{ item }}</text>
            </view>
          </view>
        </view>
      </view>
      <!-- Deleted notice -->
      <view v-if="deleted" class="notice-v2 ok">
        <text class="notice-title-v2">Crush 已删除</text>
        <text class="notice-sub-v2">相关主页、往事和分析记录已经一起移除。</text>
      </view>

      <view v-if="loading" class="loading-v2">LOADING...</view>

      <view v-else>
        <view v-if="cases.length === 0" class="empty-v2">
          <text class="empty-title-v2">还没有 Crush</text>
          <text class="empty-sub-v2">先回到首页做一次初评，系统会自动创建第一个入口。</text>
        </view>

        <view v-else class="case-list-v2">
          <view
            v-for="(item, idx) in cases"
            :key="item.caseId"
            :class="['case-block-v2', isActiveCase(item.caseId) ? 'is-active' : '', idx === 0 ? 'anim-card' : '']"
            :style="idx === 0 ? 'animation-delay:0.15s' : ''"
          >
            <!-- Card header: avatar + info -->
            <view class="case-card-head">
              <view class="case-card-avatar">
                <image v-if="item.profile?.avatarUrl || item.profile?.avatar" :src="item.profile.avatarUrl || item.profile.avatar" mode="aspectFill" />
                <text v-else class="case-card-avatar-text">{{ avatarLabel(item.name) }}</text>
              </view>
              <view class="case-card-info">
                <view class="case-card-name-row">
                  <text class="case-card-name">{{ item.name }}</text>
                  <text v-if="item.cardTypeLabel" class="tag-v2 black">{{ item.cardTypeLabel }}</text>
                </view>
                <view v-if="item.crushType" class="case-card-type">
                  <text class="case-card-type-label">{{ item.crushType.label }}</text>
                </view>
                <view v-if="item.cardProfileItems.length" class="case-card-tags">
                  <text v-for="p in item.cardProfileItems" :key="p" class="tag-v2">{{ p }}</text>
                </view>
              </view>
              <text class="case-card-updated">{{ formatDateTime(item.updatedAt) }}</text>
            </view>

            <!-- KPI strip -->
            <view class="case-card-kpis">
              <view class="case-card-kpi">
                <text class="case-card-kpi-num">{{ item.latestResult?.intentScore ?? '--' }}</text>
                <text class="case-card-kpi-lbl">意向 · {{ mapIntentLabel(item.latestResult?.intentBucket) }}</text>
                <view class="case-card-bar"><view class="case-card-fill intent" :style="{ width: (item.latestResult?.intentScore || 0) + '%' }" /></view>
              </view>
              <view class="case-card-kpi">
                <text class="case-card-kpi-num risk">{{ item.latestResult?.consistencyRiskScore ?? '--' }}</text>
                <text class="case-card-kpi-lbl">风险 · {{ mapRiskLabel(item.latestResult?.riskBucket) }}</text>
                <view class="case-card-bar"><view class="case-card-fill risk" :style="{ width: (item.latestResult?.consistencyRiskScore || 0) + '%' }" /></view>
              </view>
              <view class="case-card-kpi">
                <text class="case-card-kpi-num">{{ item.timelineCount ?? item.timeline?.length ?? 0 }}</text>
                <text class="case-card-kpi-lbl">记录条数</text>
                <view class="case-card-bar"><view class="case-card-fill records" :style="{ width: Math.min((item.timelineCount || 0) * 3, 100) + '%' }" /></view>
              </view>
            </view>

            <!-- Summary -->
            <text v-if="item.crushType?.summary" class="case-card-summary">{{ item.crushType.summary }}</text>

            <!-- Actions -->
            <view class="case-card-actions">
              <button class="btn btn-secondary btn-sm btn-auto" @click="goEditCase(item.caseId)">编辑</button>
              <button
                :class="['btn btn-danger btn-sm btn-auto', deletingCaseId === item.caseId ? 'disabled' : '']"
                :disabled="!!deletingCaseId"
                @click="confirmDeleteCase(item)"
              >{{ deletingCaseId === item.caseId ? '删除中' : '删除' }}</button>
              <button
                :class="['btn btn-primary btn-sm btn-auto', isActiveCase(item.caseId) ? 'disabled' : '']"
                :disabled="isActiveCase(item.caseId) || !!deletingCaseId"
                @click="switchActiveCase(item.caseId)"
              >{{ isActiveCase(item.caseId) ? '当前 Crush ✓' : '切换到首页' }}</button>
            </view>
          </view>
        </view>
      </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCases, getCurrentUserId, prepareCurrentUserReferralShare } from '@/utils/api'
import { callFunction } from '@/utils/cloudbase'
import { bumpDataVersion, clearActiveCaseId, formatDateTime, getActiveCaseId, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeTimelineShare, appendReferralParams, SAFE_SHARE_IMAGE, isReferralShareBlocked } from '@/utils/share'
import { deriveCrushType } from '@/utils/crush-type.js'
import { aiLabel } from '@/utils/labels'

const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const deleted = ref(false)
const themeVars = ref(getThemeStyle())
const fontSizeMode = ref(getFontSizeMode())
const deletingCaseId = ref('')
const activeHeroCase = computed(() => {
  const active = activeCaseId.value
  return cases.value.find((item: any) => item.caseId === active || item._id === active) || cases.value[0] || null
})
const activeHeroTypeLabel = computed(() => {
  const item: any = activeHeroCase.value
  return item?.cardTypeLabel || (item ? 'Crush 档案' : '待创建')
})
const activeHeroProfileTags = computed(() => {
  const item: any = activeHeroCase.value
  if (!item) return []
  return [
    ...(item.cardProfileItems || []),
    item.profile?.mbtiCode || ''
  ].filter(Boolean)
})

onShareAppMessage(() => isReferralShareBlocked()
  ? {}
  : { title: 'TA已经把你设置为Crush了。', path: appendReferralParams('/pages/index/index', 'cases'), imageUrl: SAFE_SHARE_IMAGE })

onShareTimeline(() => isReferralShareBlocked() ? {} : buildSafeTimelineShare())

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

const activeCaseId = ref('')
const CASES_CACHE_KEY = 'casesListCache:v1'

onLoad((options) => {
  deleted.value = options?.deleted === '1'
})

const lastDataVersion = ref(0)

onShow(() => {
  void prepareCurrentUserReferralShare()
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
    fontSizeMode.value = getFontSizeMode()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  activeCaseId.value = getActiveCaseId()
  deleted.value = uni.getStorageSync('casesDeletedFlag') === '1'
  if (deleted.value) {
    uni.removeStorageSync('casesDeletedFlag')
  }
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  const activeMissing = Boolean(
    activeCaseId.value
    && cases.value.length > 0
    && !cases.value.some((item: any) => item.caseId === activeCaseId.value || item._id === activeCaseId.value)
  )
  if (!cases.value.length || dv > lastDataVersion.value || activeMissing) loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    userId.value = ''
    loading.value = false
    return
  }
  userId.value = uid
  if (!cases.value.length) {
    const cached = readCasesCache(uid)
    if (cached.length > 0) {
      applyCasesList(cached)
      loading.value = false
    }
  }
  if (!cases.value.length) loading.value = true
  try {
    const list = await getCases(uid, { mode: 'list' })
    applyCasesList(list || [])
    writeCasesCache(uid, cases.value)
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function readCasesCache(uid: string) {
  try {
    const cached = uni.getStorageSync(CASES_CACHE_KEY)
    if (!cached || cached.userId !== uid || !Array.isArray(cached.cases)) return []
    return cached.cases
  } catch {
    return []
  }
}

function writeCasesCache(uid: string, list: any[]) {
  try {
    uni.setStorageSync(CASES_CACHE_KEY, {
      userId: uid,
      cachedAt: Date.now(),
      cases: list
    })
  } catch {}
}

function askDeleteCase(item: any): Promise<boolean> {
  const name = String(item?.name || '这个 Crush').trim()
  const isCurrent = isActiveCase(item?.caseId)
  return new Promise((resolve) => {
    uni.showModal({
      title: '删除 Crush？',
      content: `将删除「${name}」的档案、时间轴和分析记录，删除后无法恢复。${isCurrent ? '这是当前 Crush，删除后会自动切换到其他 Crush。' : ''}`,
      confirmText: '删除',
      confirmColor: String(themeVars.value['--risk'] || themeVars.value['--dot-risk'] || themeVars.value['--text-main'] || ''),
      cancelText: '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
}

function applyCasesList(list: any[]) {
  cases.value = (list || []).map((c: any) => ({
      ...c,
      caseId: c.caseId || c._id,
      crushType: deriveCrushType(c.latestResult || {}),
      cardTypeLabel: getRelationTypeLabel(c.profile),
      cardProfileItems: profileItems(c.profile),
    }))
}

function getRelationTypeLabel(p: any): string {
  const relationType = String(p?.relationType || '').trim()
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
  return ''
}

function profileItems(p: any): string[] {
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  if (p.occupation) items.push(p.occupation)
  return items
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

function mapIntentLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低意向'
    case 'low_medium': return '偏低意向'
    case 'medium': return '中等意向'
    case 'medium_high': return '中高意向'
    case 'high': return '高意向'
    default: return '未分析'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未分析'
  }
}

function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}

function goEditCase(caseId: string) {
  if (!caseId) return
  uni.navigateTo({ url: `/pages/edit-profile/edit-profile?caseId=${caseId}` })
}

function isActiveCase(caseId: string) {
  return Boolean(caseId && caseId === activeCaseId.value)
}

function switchActiveCase(caseId: string) {
  if (!caseId) return
  setActiveCaseId(caseId)
  activeCaseId.value = caseId
  bumpDataVersion()
  showSuccess('已切换当前 Crush')
  setTimeout(() => {
    uni.switchTab({ url: '/pages/index/index' })
  }, 300)
}

async function confirmDeleteCase(item: any) {
  const caseId = String(item?.caseId || item?._id || '').trim()
  if (!caseId || deletingCaseId.value) return
  const confirmed = await askDeleteCase({ ...item, caseId })
  if (!confirmed) return

  deletingCaseId.value = caseId
  try {
    const response = await callFunction({
      name: 'deleteCase',
      data: { caseId }
    })
    const result = response.result
    if (!result?.success) {
      showError(result?.message || '删除失败')
      return
    }

    const wasActive = isActiveCase(caseId)
    cases.value = cases.value.filter((c: any) => c.caseId !== caseId && c._id !== caseId)
    writeCasesCache(userId.value, cases.value)

    if (wasActive) {
      const nextCaseId = cases.value[0]?.caseId || cases.value[0]?._id || ''
      if (nextCaseId) {
        setActiveCaseId(nextCaseId)
        activeCaseId.value = nextCaseId
      } else {
        clearActiveCaseId()
        activeCaseId.value = ''
      }
    }

    deleted.value = true
    uni.setStorageSync('casesDeletedFlag', '1')
    bumpDataVersion()
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
    showSuccess('Crush 已删除')
  } catch (error: any) {
    showError(error?.message || '删除失败')
  } finally {
    deletingCaseId.value = ''
  }
}
</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, var(--page-wash, rgba(18, 60, 54, 0.07)), transparent 380rpx),
    var(--app-bg, #f6f1e8);
  padding: var(--spacing-page, 28rpx);
  box-sizing: border-box;
}

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx 18rpx calc(140rpx + env(safe-area-inset-bottom)) 18rpx; }

.v2-mode .hero-block-v2 { @include hero-block-v2; }
.v2-mode .hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: var(--text-main, #111); line-height: $lh-hero; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: var(--accent, #FFD93D); padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); line-height: 1.5; }
.v2-mode .hero-copy-v2 .strong { color: var(--text-main, #111); font-weight: $fw-hero; }

.v2-mode .notice-v2 { padding: 20rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: var(--success-soft, #E0FFF0); border-left: 12rpx solid var(--accent-cool, #4ECDC4); }
.v2-mode .notice-v2.warn { background: var(--risk-soft, #FFEEEC); border-left: 12rpx solid var(--hero-bg, #FF6B6B); }
.v2-mode .notice-title-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); }

.v2-mode .loading-v2 { text-align: center; padding: 80rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); letter-spacing: 4rpx; }

.v2-mode .empty-v2 { padding: 40rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); background: var(--surface, #fff); text-align: center; }
.v2-mode .empty-title-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; }

.v2-mode .case-list-v2 { display: flex; flex-direction: column; gap: 18rpx; }

.v2-mode .case-block-v2 {
  background: var(--surface, #fff); border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-card, 0);
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 #111); padding: 28rpx;
}
.v2-mode .tag-v2 { @include tag-v2; }
.v2-mode .tag-v2.black { background: var(--text-main, #111); color: var(--surface, #fff); }

.v2-mode .case-block-v2.is-active {
  box-shadow: var(--shadow-hard, 6rpx 6rpx 0 var(--border, #111));
}

.v2-mode .case-card-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  min-width: 0;
  margin-bottom: 24rpx;
  padding-right: 116rpx;
}

.v2-mode .case-card-avatar {
  display: flex;
  flex: 0 0 128rpx;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  overflow: hidden;
  border: var(--border-width-strong, 3rpx) solid var(--border, #111);
  border-radius: 50%;
  background: var(--hero-bg, #FF6B6B);
}

.v2-mode .case-card-avatar image { width: 100%; height: 100%; }
.v2-mode .case-card-avatar-text { font-size: $fs-display; font-weight: $fw-hero; color: var(--surface, #fff); }

.v2-mode .case-card-info {
  flex: 1;
  min-width: 0;
  padding-top: 2rpx;
}

.v2-mode .case-card-name-row,
.v2-mode .case-card-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
}

.v2-mode .case-card-name { font-size: $fs-heading; font-weight: $fw-hero; color: var(--text-main, #111); line-height: $lh-heading; }
.v2-mode .case-card-type { margin: 10rpx 0 8rpx; }
.v2-mode .case-card-type-label {
  display: inline-block;
  padding: 6rpx 16rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  background: var(--accent, #FFD93D);
  color: var(--text-main, #111);
  font-size: $fs-body;
  font-weight: $fw-heading;
  line-height: $lh-label;
}

.v2-mode .case-card-updated {
  position: absolute;
  top: 4rpx;
  right: 0;
  max-width: 108rpx;
  color: var(--text-soft, #999);
  font-size: $fs-micro;
  font-weight: $fw-body;
  line-height: $lh-label;
  text-align: right;
}

.v2-mode .case-card-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 24rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-inner, 0);
  background: var(--surface-dim, #FFFDF5);
}

.v2-mode .case-card-kpi { min-width: 0; }
.v2-mode .case-card-kpi-num { display: block; color: var(--text-main, #111); font-size: $fs-kpi; font-weight: $fw-hero; line-height: $lh-tight; }
.v2-mode .case-card-kpi-num.risk { color: var(--risk, #FF5252); }
.v2-mode .case-card-kpi-lbl {
  display: block;
  min-height: 62rpx;
  margin-top: 8rpx;
  overflow-wrap: anywhere;
  color: var(--text-muted, #666);
  font-size: $fs-caption;
  font-weight: $fw-label;
  line-height: $lh-label;
}

.v2-mode .case-card-bar {
  width: 100%;
  height: 10rpx;
  margin-top: 8rpx;
  overflow: hidden;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: 0;
  background: var(--surface, #fff);
  box-sizing: border-box;
}

.v2-mode .case-card-fill { height: 100%; background: var(--text-main, #111); }
.v2-mode .case-card-fill.intent { background: var(--accent-cool, #4ECDC4); }
.v2-mode .case-card-fill.risk { background: var(--risk, #FF5252); }
.v2-mode .case-card-fill.records { background: var(--accent, #FFD93D); }

.v2-mode .case-card-summary {
  display: block;
  margin-bottom: 18rpx;
  padding: 18rpx 0 0;
  border-top: var(--border-width, 2rpx) dashed var(--border-soft, rgba(17, 17, 17, 0.22));
  color: var(--text-muted, #666);
  font-size: $fs-body;
  font-weight: $fw-body;
  line-height: $lh-body;
}

.v2-mode .case-card-actions {
  display: flex;
  align-items: stretch;
  gap: 12rpx;
}

.v2-mode .case-card-actions .btn { min-width: 112rpx; margin: 0; }
.v2-mode .case-card-actions .btn:last-child { flex: 1; }

@media (max-width: 360px) {
  .v2-mode .case-card-head { gap: 16rpx; padding-right: 0; }
  .v2-mode .case-card-avatar { flex-basis: 108rpx; width: 108rpx; height: 108rpx; }
  .v2-mode .case-card-updated { position: static; align-self: flex-start; max-width: 92rpx; }
  .v2-mode .case-card-kpis { gap: 12rpx; padding: 20rpx 16rpx; }
  .v2-mode .case-card-actions { flex-wrap: wrap; }
  .v2-mode .case-card-actions .btn:last-child { flex-basis: 100%; }
}
</style>
