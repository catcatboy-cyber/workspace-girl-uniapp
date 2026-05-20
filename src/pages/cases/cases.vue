<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <!-- 版本切换 -->
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>

    <!-- ==================== 经典版 ==================== -->
    <block v-if="!showV2">
    <view class="hero-card card">
      <text class="hero-topline">Case 列表</text>
      <text class="h1">先切换，再进入当前对象</text>
      <text class="hero-subtext">所有核心页面都跟随当前对象。想看另一个对象时，先在这里切换，再回首页继续记录或查看。</text>
      <button class="btn-primary" @click="goNew">创建新的关系对象</button>
    </view>

    <view v-if="deleted" class="card status-card success">
      <text class="status-strong">对象已删除。</text>
      <text class="muted">相关主页、时间线和评估历史已经一起移除。</text>
    </view>

    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else>
      <view class="card">
        <view class="section-head">
          <text class="h2">关系对象列表</text>
          <text class="muted">按最近更新时间排序。共 {{ cases.length }} 个 case</text>
        </view>
      </view>

      <view v-if="cases.length === 0" class="card">
        <text class="h3">还没有关系对象</text>
        <text class="muted">先回到首页做一次初评，系统会自动创建第一个入口。</text>
      </view>

      <view v-else class="grid">
        <view v-for="item in cases" :key="item.caseId" class="case-card card">
          <view class="case-header">
            <view class="case-title">
              <view class="profile-avatar sm">
                <image v-if="item.profile?.avatar" :src="item.profile.avatarUrl || item.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(item.name) }}</text>
              </view>
              <view>
                <text class="case-name">{{ item.name }}</text>
                <text class="muted">caseId: {{ item.caseId }}</text>
              </view>
            </view>
            <text class="muted">更新于 {{ formatDateTime(item.updatedAt) }}</text>
          </view>

          <view v-if="item.cardTypeLabel || item.cardStatusTags.length" class="badges object-card-tags">
            <text v-if="item.cardTypeLabel" class="badge badge-primary">{{ item.cardTypeLabel }}</text>
            <text v-for="tag in item.cardStatusTags" :key="tag" class="badge badge-soft">{{ tag }}</text>
          </view>

          <view v-if="item.cardProfileItems.length > 0" class="badges profile-meta-badges">
            <text v-for="p in item.cardProfileItems" :key="p" class="badge">{{ p }}</text>
          </view>

          <view class="case-kpis">
            <view class="kpi-item">
              <text class="kpi-label">意向</text>
              <text class="kpi-value">{{ item.latestResult?.intentScore ?? '--' }}</text>
              <text class="muted">{{ mapIntentLabel(item.latestResult?.intentBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">风险</text>
              <text class="kpi-value">{{ item.latestResult?.consistencyRiskScore ?? '--' }}</text>
              <text class="muted">{{ mapRiskLabel(item.latestResult?.riskBucket) }}</text>
            </view>
            <view class="kpi-item">
              <text class="kpi-label">证据等级</text>
              <text class="kpi-value">{{ item.latestResult?.evidenceLevel ?? '--' }}</text>
              <text class="muted">手动 {{ item.timeline?.length ?? 0 }} 条</text>
            </view>
          </view>

          <view class="actions">
            <button
              :class="[isActiveCase(item.caseId) ? 'btn-secondary' : 'btn-primary', 'small']"
              :disabled="isActiveCase(item.caseId)"
              @click="switchActiveCase(item.caseId)"
            >
              {{ isActiveCase(item.caseId) ? '当前对象' : '切换到首页' }}
            </button>
          </view>
        </view>
      </view>
    </view>
    </block>
    <!-- ==================== /经典版 ==================== -->

    <!-- ==================== Campus Pop ==================== -->
    <block v-if="showV2">
      <!-- Hero -->
      <view class="hero-block-v2">
        <text class="hero-tag-v2">CASE BOARD</text>
        <text class="hero-title-v2">对<text class="hl-v2">象</text>列表</text>
        <text class="hero-copy-v2">先切换，再进入当前对象。共 <text class="strong">{{ cases.length }}</text> 个 case。</text>
        <button class="btn-v2-hero" @click="goNew">+ 创建新的关系对象</button>
      </view>

      <!-- Deleted notice -->
      <view v-if="deleted" class="notice-v2 ok">
        <text class="notice-title-v2">对象已删除</text>
        <text class="notice-sub-v2">相关主页、时间线和评估历史已经一起移除。</text>
      </view>

      <view v-if="loading" class="loading-v2">LOADING...</view>

      <view v-else>
        <view v-if="cases.length === 0" class="empty-v2">
          <text class="empty-title-v2">还没有关系对象</text>
          <text class="empty-sub-v2">先回到首页做一次初评，系统会自动创建第一个入口。</text>
        </view>

        <view v-else class="case-list-v2">
          <view v-for="item in cases" :key="item.caseId" class="case-block-v2">
            <!-- Case head -->
            <view class="case-head-v2">
              <view class="case-identity-v2">
                <view class="avatar-v2">
                  <image v-if="item.profile?.avatar" :src="item.profile.avatarUrl || item.profile.avatar" mode="aspectFill" />
                  <text v-else class="avatar-placeholder-v2">{{ avatarLabel(item.name) }}</text>
                </view>
                <view>
                  <text class="case-name-v2">{{ item.name }}</text>
                  <text class="case-id-v2">{{ item.caseId }}</text>
                </view>
              </view>
              <text class="case-updated-v2">更新于 {{ formatDateTime(item.updatedAt) }}</text>
            </view>

            <!-- Tags -->
            <view v-if="item.cardTypeLabel || item.cardStatusTags.length" class="tag-row-v2">
              <text v-if="item.cardTypeLabel" class="tag-v2 black">{{ item.cardTypeLabel }}</text>
              <text v-for="tag in item.cardStatusTags" :key="tag" class="tag-v2">{{ tag }}</text>
            </view>
            <view v-if="item.cardProfileItems.length > 0" class="tag-row-v2">
              <text v-for="p in item.cardProfileItems" :key="p" class="tag-v2">{{ p }}</text>
            </view>

            <!-- KPI strip -->
            <view class="kpi-strip-v2">
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2">{{ item.latestResult?.intentScore ?? '--' }}</text>
                <text class="kpi-lbl-v2">意向 · {{ mapIntentLabel(item.latestResult?.intentBucket) }}</text>
              </view>
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2 risk">{{ item.latestResult?.consistencyRiskScore ?? '--' }}</text>
                <text class="kpi-lbl-v2">风险 · {{ mapRiskLabel(item.latestResult?.riskBucket) }}</text>
              </view>
              <view class="kpi-cell-v2">
                <text class="kpi-num-v2">{{ item.latestResult?.evidenceLevel ?? '--' }}</text>
                <text class="kpi-lbl-v2">证据 · {{ item.timeline?.length ?? 0 }} 条</text>
              </view>
            </view>

            <!-- Action -->
            <button
              :class="['btn-v2-action', isActiveCase(item.caseId) ? 'disabled' : '']"
              :disabled="isActiveCase(item.caseId)"
              @click="switchActiveCase(item.caseId)"
            >
              {{ isActiveCase(item.caseId) ? '当前对象' : '切换到首页' }}
            </button>
          </view>
        </view>
      </view>
    </block>
    <!-- ==================== /Campus Pop ==================== -->
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCases, getCurrentUserId } from '@/utils/api'
import { formatDateTime, getActiveCaseId, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { buildObjectStatusCard } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const showV2 = ref(true)
const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const deleted = ref(false)
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const activeCaseId = ref('')

onLoad((options) => {
  deleted.value = options?.deleted === '1'
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  activeCaseId.value = getActiveCaseId()
  deleted.value = uni.getStorageSync('casesDeletedFlag') === '1'
  if (deleted.value) {
    uni.removeStorageSync('casesDeletedFlag')
  }
  loadData()
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const list = await getCases(uid)
    cases.value = (list || []).map((c: any) => ({
      ...c,
      caseId: c.caseId || c._id,
      cardTypeLabel: getRelationTypeLabel(c.profile),
      cardProfileItems: profileItems(c.profile),
      cardStatusTags: buildCaseStatusTags(c)
    }))
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function getRelationTypeLabel(p: any): string {
  const relationType = String(p?.relationType || '').trim()
  if (relationType === 'close_friend') return '朋友'
  if (relationType === 'colleague') return '同事'
  if (relationType === 'classmate') return '同学'
  if (relationType === 'teacher') return '老师'
  if (relationType === 'romantic') return '恋爱对象'
  return ''
}

function profileItems(p: any): string[] {
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
}

function buildCaseStatusTags(caseItem: any): string[] {
  try {
    if (!caseItem?.latestResult) return []
    const status = buildObjectStatusCard({
      ...caseItem,
      assessments: Array.isArray(caseItem.assessments) && caseItem.assessments.length
        ? caseItem.assessments
        : [caseItem.latestResult],
      timeline: Array.isArray(caseItem.timeline) ? caseItem.timeline : []
    })
    return [status?.phase, status?.vibe].filter(Boolean).slice(0, 3)
  } catch {
    return []
  }
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
    default: return '未评估'
  }
}
function mapRiskLabel(bucket?: string) {
  switch (bucket) {
    case 'low': return '低风险'
    case 'low_medium': return '偏低风险'
    case 'medium': return '中等风险'
    case 'medium_high': return '中高风险'
    case 'high': return '高风险'
    default: return '未评估'
  }
}

function goNew() {
  uni.navigateTo({ url: '/pages/new/new' })
}

function isActiveCase(caseId: string) {
  return Boolean(caseId && caseId === activeCaseId.value)
}

function switchActiveCase(caseId: string) {
  if (!caseId) return
  setActiveCaseId(caseId)
  activeCaseId.value = caseId
  showSuccess('已切换当前对象')
  setTimeout(() => {
    uni.switchTab({ url: '/pages/index/index' })
  }, 300)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 380rpx),
    var(--app-bg, #f6f1e8);
  padding: var(--spacing-page, 28rpx);
  box-sizing: border-box;
}
.card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(var(--card-gradient-angle, 135deg), var(--accent-soft, rgba(201, 164, 92, 0.1)), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-radius: var(--radius-md, 18rpx);
  padding: var(--spacing-card, 32rpx);
  margin-bottom: 24rpx;
  box-shadow:
    var(--shadow-lg, 0 18rpx 38rpx rgba(32, 25, 20, 0.075)),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
}
.hero-card {
  background: linear-gradient(var(--hero-gradient-angle, 135deg), var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: var(--shadow-hero, 0 22rpx 44rpx rgba(18, 60, 54, 0.18));
}
.hero-card::after {
  content: "";
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  top: 0;
  height: 3rpx;
  background: linear-gradient(90deg, rgba(201, 164, 92, 0), var(--accent, #c9a45c), rgba(201, 164, 92, 0));
}
.hero-topline { display: block; font-size: 22rpx; letter-spacing: 3rpx; color: rgba(255, 252, 247, 0.72); }
.h1, .h2, .h3, .case-name, .status-strong { color: var(--text-main, #201914); }
.h1 { display: block; font-size: 40rpx; font-weight: var(--font-weight-hero, 700); margin: 8rpx 0; line-height: var(--text-line-height-heading, 1.25); }
.h2 { display: block; font-size: 32rpx; font-weight: var(--font-weight-strong, 600); margin-bottom: 8rpx; padding-left: 16rpx; border-left: 6rpx solid var(--accent, #c9a45c); line-height: var(--text-line-height-heading, 1.35); }
.h3 { display: block; font-size: 28rpx; font-weight: var(--font-weight-strong, 600); }
.hero-card .h1 { color: #fffaf0; }
.hero-card .h2 { padding-left: 0; border-left: 0; }
.hero-subtext { display: block; font-size: 26rpx; color: rgba(255, 252, 247, 0.76); line-height: var(--text-line-height, 1.6); margin: 8rpx 0 16rpx; }
.muted, .kpi-label { display: block; font-size: 24rpx; color: var(--text-muted, #76695c); margin: 4rpx 0; line-height: var(--text-line-height, 1.55); }
.center { text-align: center; padding: 60rpx 0; }
.section-head { display: flex; justify-content: space-between; align-items: flex-start; }
.grid { display: flex; flex-direction: column; gap: 18rpx; }
.case-card { padding: 28rpx; border-left: 6rpx solid var(--accent, rgba(201, 164, 92, 0.72)); }
.case-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; padding-bottom: 18rpx; border-bottom: 1rpx solid rgba(18, 60, 54, 0.08); }
.case-title { display: flex; align-items: center; gap: 14rpx; }
.case-name { display: block; font-size: 32rpx; font-weight: 700; color: var(--primary, #123c36); }
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-soft, #efe7d8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2rpx solid rgba(201, 164, 92, 0.45);
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.1);
}
.profile-avatar.sm { width: 68rpx; height: 68rpx; }
.profile-avatar image { width: 100%; height: 100%; }
.avatar-placeholder { font-size: 24rpx; font-weight: 700; color: var(--text-muted, #786857); }
.badges { margin: 12rpx 0; }
.badge { display: inline-block; padding: 8rpx 16rpx; background: var(--accent-soft, rgba(201, 164, 92, 0.14)); border: 1rpx solid rgba(201, 164, 92, 0.24); border-radius: 999rpx; font-size: 22rpx; color: #6f5225; margin: 4rpx; }
.object-card-tags { margin-top: 14rpx; margin-bottom: 4rpx; }
.profile-meta-badges { margin-top: 8rpx; }
.badge-primary { background: rgba(18, 60, 54, 0.12); border: 1rpx solid rgba(18, 60, 54, 0.22); color: var(--primary, #123c36); font-weight: 700; }
.badge-soft { background: rgba(201, 164, 92, 0.12); }
.case-kpis { display: flex; gap: 12rpx; margin: 16rpx 0; flex-wrap: wrap; }
.kpi-item {
  flex: 1 1 28%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0) 100rpx), var(--card-soft, #fffaf3);
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  border-radius: var(--radius-sm, 16rpx);
  padding: 16rpx;
  min-width: 180rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}
.kpi-value { display: block; font-size: 38rpx; font-weight: 700; color: var(--primary, #123c36); }
.actions { display: flex; gap: 12rpx; margin-top: 16rpx; flex-wrap: wrap; }
.btn-primary {
  height: 76rpx; line-height: 76rpx;
  background: linear-gradient(135deg, var(--primary, #123c36), var(--hero-bg-2, #0f2f2b));
  color: #fff; border: none;
  border-radius: var(--radius-sm, 14rpx);
  font-size: 28rpx; padding: 0 28rpx;
  box-shadow: 0 10rpx 22rpx rgba(18, 60, 54, 0.18);
  font-weight: 650;
}
.btn-secondary {
  height: 76rpx; line-height: 76rpx;
  background: rgba(255, 252, 247, 0.92);
  color: var(--primary, #123c36);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  border-radius: var(--radius-sm, 14rpx);
  font-size: 28rpx; padding: 0 28rpx;
  font-weight: var(--font-weight-strong, 600);
}
.btn-primary.small, .btn-secondary.small { flex: 1; min-width: 160rpx; }
.btn-primary[disabled], .btn-secondary[disabled] { opacity: 0.72; background: rgba(18, 60, 54, 0.08); color: var(--primary, #123c36); box-shadow: none; }
.status-card { border-left: 6rpx solid var(--success, #0f6b45); box-shadow: 0 14rpx 28rpx rgba(32, 25, 20, 0.05); }
.status-card.success { background: #eef7ef; }
.status-strong { display: block; font-size: 28rpx; font-weight: 700; color: var(--text-main, #241b12); margin-bottom: 6rpx; }

/* ===== CAMPUS POP V2 ===== */
.version-toggle {
  display: flex; gap: 0; margin-bottom: 18rpx;
  border: 3rpx solid #111; overflow: hidden; background: #fff;
}
.toggle-tab {
  flex: 1; text-align: center; padding: 14rpx 0;
  font-size: 26rpx; font-weight: 700; color: #999;
}
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; }

.v2-mode .hero-block-v2 {
  background: var(--hero-bg, #FF6B6B); border: 3px solid #111;
  box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx;
  transform: rotate(-0.5deg);
}
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .hero-copy-v2 .strong { color: #111; font-weight: 900; }
.v2-mode .btn-v2-hero {
  margin-top: 20rpx; width: 100%; height: 72rpx; line-height: 72rpx;
  text-align: center; background: #fff; border: 3rpx solid #111;
  font-size: 26rpx; font-weight: 800; color: #111;
  box-shadow: 4rpx 4rpx 0 #111;
}

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; }

.v2-mode .loading-v2 { text-align: center; padding: 80rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }

.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; text-align: center; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .case-list-v2 { display: flex; flex-direction: column; gap: 18rpx; }

.v2-mode .case-block-v2 {
  background: #fff; border: 3rpx solid #111;
  box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx;
}
.v2-mode .case-head-v2 {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 16rpx; border-bottom: 3rpx solid #111; margin-bottom: 14rpx;
}
.v2-mode .case-identity-v2 { display: flex; align-items: center; gap: 14rpx; }
.v2-mode .avatar-v2 {
  width: 68rpx; height: 68rpx; border-radius: 50%; overflow: hidden;
  border: 3rpx solid #111; background: #FFD93D;
  display: flex; align-items: center; justify-content: center;
}
.v2-mode .avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .case-name-v2 { display: block; font-size: 30rpx; font-weight: 900; color: #111; }
.v2-mode .case-id-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-top: 2rpx; }
.v2-mode .case-updated-v2 { font-size: 20rpx; font-weight: 600; color: #999; white-space: nowrap; }

.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 12rpx; }
.v2-mode .tag-v2 {
  display: inline-flex; align-items: center; min-height: 36rpx;
  padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D;
  font-size: 20rpx; font-weight: 800; color: #111;
}
.v2-mode .tag-v2.black { background: #111; color: #fff; }

.v2-mode .kpi-strip-v2 { display: flex; margin-bottom: 16rpx; border: 3rpx solid #111; background: #f9f9f9; }
.v2-mode .kpi-cell-v2 { flex: 1; text-align: center; padding: 18rpx 8rpx; border-right: 3rpx solid #111; }
.v2-mode .kpi-cell-v2:last-child { border-right: none; }
.v2-mode .kpi-num-v2 { display: block; font-size: 40rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .kpi-num-v2.risk { color: #FF5252; }
.v2-mode .kpi-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 4rpx; }

.v2-mode .btn-v2-action {
  width: 100%; height: 68rpx; line-height: 68rpx; text-align: center;
  background: #4ECDC4; border: 3rpx solid #111; box-shadow: 4rpx 4rpx 0 #111;
  font-size: 26rpx; font-weight: 800; color: #111;
}
.v2-mode .btn-v2-action.disabled,
.v2-mode .btn-v2-action[disabled] { background: #e8e8e8; box-shadow: none; opacity: 0.7; }
</style>
