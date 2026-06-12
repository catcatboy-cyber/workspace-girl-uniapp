<template>
  <view :class="['page v2-mode', uni.getStorageSync('fontSizeMode') === 'large' ? 'font-large' : '']" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">SYSTEM TRACKS</text>
      <text class="hero-title-v2">系统<text class="hl-v2">轨迹</text></text>
      <text class="hero-copy-v2">系统自动生成的分析、趋势和复盘记录。</text>
    </view>

    <view v-if="loading" class="loading-v2">LOADING...</view>

    <view v-else>
      <view v-if="cases.length === 0" class="empty-v2">
        <text class="empty-title-v2">还没有 Crush</text>
        <text class="empty-sub-v2">先完成初评，系统会自动生成轨迹。</text>
      </view>

      <template v-else>
        <view class="case-tabs-v2">
          <view v-for="c in cases" :key="c.caseId" :class="['case-tab-v2', activeCaseId === c.caseId ? 'active' : '']" @click="switchCase(c.caseId)">
            <text>{{ c.name }}</text>
          </view>
        </view>

        <view v-if="!tracks.length" class="empty-v2">
          <text class="empty-title-v2">暂无系统轨迹</text>
          <text class="empty-sub-v2">完成分析后系统会自动生成轨迹记录。</text>
        </view>

        <view v-else class="event-list-v2">
          <view v-for="item in visibleTracks" :key="item._id || item.id" class="event-row-v2 system">
            <view class="event-time-v2">
              <text class="event-date-v2">{{ formatAxisDate(item) }}</text>
              <text class="event-clock-v2">{{ formatAxisTime(item) }}</text>
              <view :class="['event-dot-v2', toneClass(item.type)]"></view>
            </view>
            <view class="event-body-v2">
              <view class="event-meta-v2">
                <text>{{ mapSystemTrackTypeLabel(item.type) }}</text>
                <text v-if="item.date">发生时间：{{ item.date }}</text>
                <text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text>
              </view>
              <text class="event-title-v2">{{ item.title || mapSystemTrackTypeLabel(item.type) }}</text>
              <text v-if="item.description" class="event-desc-v2">{{ item.description }}</text>
            </view>
          </view>
          <view v-if="tracks.length > visibleMax" class="expand-row-v2">
            <view class="tag-v2" @click="visibleMax = visibleMax + 7">加载更多（还有 {{ tracks.length - visibleMax }} 条）</view>
          </view>
        </view>
      </template>
    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCaseDetail, getCases, getCurrentUserId } from '@/utils/api'
import { getActiveCaseId, setActiveCaseId, showError } from '@/utils/helpers'
import { buildTimelineFromLatestResult, isSystemTimelineRecord, sortTimelineRecordsDesc, getTimelineRecordTimestamp } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const loading = ref(true)
const cases = ref<any[]>([])
const caseFile = ref<any>(null)
const activeCaseId = ref('')
const visibleMax = ref(7)
const themeVars = ref(getThemeStyle())
const lastDataVersion = ref(0)

const tracks = computed(() => {
  const timeline = caseFile.value?.timeline || []
  const systemRecords = sortTimelineRecordsDesc(timeline.filter((item: any) => isSystemTimelineRecord(item)))
  if (systemRecords.length > 0) return systemRecords
  return sortTimelineRecordsDesc(buildTimelineFromLatestResult(caseFile.value?.latestResult))
})

const visibleTracks = computed(() => tracks.value.slice(0, visibleMax.value))

onLoad(() => {
  activeCaseId.value = getActiveCaseId()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  const active = getActiveCaseId()
  if (dv > lastDataVersion.value || active !== activeCaseId.value || !caseFile.value) {
    activeCaseId.value = active
    loadData()
  }
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) { uni.reLaunch({ url: '/pages/login/login' }); return }
  loading.value = true
  try {
    const list = await getCases(uid)
    cases.value = (list || []).map((c: any) => ({ ...c, caseId: c.caseId || c._id }))
    const active = getActiveCaseId()
    const targetId = activeCaseId.value || active || cases.value[0]?.caseId || ''
    if (targetId) {
      activeCaseId.value = targetId
      setActiveCaseId(targetId)
      caseFile.value = await getCaseDetail(uid, targetId)
    }
  } catch (e: any) { showError(e?.message || '加载失败') } finally {
    loading.value = false
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  }
}

async function switchCase(caseId: string) {
  if (!caseId || caseId === activeCaseId.value) return
  activeCaseId.value = caseId
  setActiveCaseId(caseId)
  visibleMax.value = 7
  try {
    caseFile.value = await getCaseDetail(getCurrentUserId(), caseId)
  } catch (e: any) { showError(e?.message || '加载失败') }
}

function toneClass(type: string) {
  switch (type) {
    case 'positive': return 'positive'
    case 'risk': return 'risk'
    case 'verification': return 'verification'
    case 'assessment': return 'assessment'
    case 'trend': return 'trend'
    default: return 'note'
  }
}

function mapSystemTrackTypeLabel(type?: string) {
  switch (type) {
    case 'assessment': return '系统分析'
    case 'trend': return '趋势重算'
    case 'positive': return '推进分析'
    case 'risk': return '风险分析'
    case 'verification': return '验证分析'
    case 'note': return '普通记录'
    default: return '系统日志'
  }
}

function formatAxisDate(record: any) {
  const ts = getTimelineRecordTimestamp(record)
  if (!ts) return '--/--'
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatAxisTime(record: any) {
  const ts = getTimelineRecordTimestamp(record)
  if (!ts) return '--:--'
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatRecordedAt(record: any) {
  if (!record.createdAt) return ''
  const ts = new Date(record.createdAt).getTime()
  if (!ts) return ''
  const d = new Date(ts)
  return `记录于 ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }
.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-hero; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: $fs-body-lg; font-weight: $fw-body; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; text-align: center; }
.v2-mode .empty-title-v2 { display: block; font-size: $fs-heading; font-weight: $fw-hero; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: #666; line-height: 1.5; }
.v2-mode .case-tabs-v2 { display: flex; gap: 8rpx; margin-bottom: 18rpx; flex-wrap: wrap; }
.v2-mode .case-tab-v2 { padding: 12rpx 20rpx; border: 2rpx solid #111; background: #fff; font-size: $fs-body; font-weight: $fw-label; color: #666; }
.v2-mode .case-tab-v2.active { background: #111; color: #FFD93D; }
.v2-mode .event-list-v2 { display: flex; flex-direction: column; gap: 14rpx; }
.v2-mode .event-row-v2 { display: flex; gap: 14rpx; padding: 18rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .event-row-v2.system { background: #fff; border-style: dashed; }
.v2-mode .event-time-v2 { display: flex; flex-direction: column; align-items: center; width: 80rpx; flex-shrink: 0; }
.v2-mode .event-date-v2 { font-size: $fs-caption; font-weight: $fw-hero; color: #111; }
.v2-mode .event-clock-v2 { font-size: $fs-caption; font-weight: $fw-body; color: #999; }
.v2-mode .event-dot-v2 { width: 14rpx; height: 14rpx; border-radius: 50%; margin-top: 6rpx; border: 2rpx solid #111; }
.v2-mode .event-dot-v2.positive { background: #4ECDC4; }
.v2-mode .event-dot-v2.risk { background: #FF5252; }
.v2-mode .event-dot-v2.verification { background: #FFD93D; }
.v2-mode .event-dot-v2.assessment { background: #111; }
.v2-mode .event-dot-v2.trend { background: #666; }
.v2-mode .event-dot-v2.note { background: #111; }
.v2-mode .event-body-v2 { flex: 1; min-width: 0; }
.v2-mode .event-meta-v2 { display: flex; flex-direction: column; gap: 2rpx; margin-bottom: 6rpx; }
.v2-mode .event-meta-v2 text { font-size: $fs-caption; font-weight: $fw-body; color: #999; }
.v2-mode .event-title-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-hero; color: #111; line-height: 1.4; }
.v2-mode .event-desc-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: #555; line-height: 1.5; margin-top: 4rpx; }
.v2-mode .expand-row-v2 { text-align: center; margin-top: 12rpx; }
.v2-mode .tag-v2 { display: inline-flex; align-items: center; min-height: 36rpx; padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: $fs-caption; font-weight: $fw-hero; color: #111; }
</style>
