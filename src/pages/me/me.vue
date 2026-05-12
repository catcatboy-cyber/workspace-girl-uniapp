<template>
  <view class="page" :style="themeVars">
    <view class="card hero-card">
      <text class="hero-topline">Me / Settings</text>
      <text class="h1">我的</text>
      <text class="hero-subtext">这里管理账号、系统能力和个人设置。</text>
    </view>

    <view class="card">
      <text class="h2">账号信息</text>
      <text class="muted">当前登录账号：{{ userEmail || '未登录' }}</text>
      <text class="muted">关系对象数：{{ caseCount }}</text>
      <view class="actions">
        <button class="btn-danger" @click="onLogout">退出登录</button>
      </view>
    </view>

    <view class="card">
      <text class="h2">功能设置</text>
      <view class="row">
        <view class="row-item">
          <text class="row-title">本人画像</text>
          <text class="muted">{{ selfProfileSummary }}</text>
          <button class="btn-secondary profile-button" @click="goSelfProfile">编辑本人画像</button>
        </view>
      </view>
      <view class="row theme-row">
        <view class="row-item">
          <text class="row-title">界面风格</text>
          <text class="muted">选择更适合你的视觉氛围，设置会保存在本机。</text>
          <view class="theme-grid">
            <view
              v-for="theme in themeOptions"
              :key="theme.id"
              :class="['theme-card', currentThemeId === theme.id ? 'active' : '']"
              @click="chooseTheme(theme.id)"
            >
              <view class="theme-preview" :style="theme.vars">
                <view class="preview-hero" />
                <view class="preview-card">
                  <view class="preview-line wide" />
                  <view class="preview-line" />
                </view>
                <view class="preview-button" />
              </view>
              <text class="theme-name">{{ theme.name }}</text>
              <text class="theme-desc">{{ theme.description }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="row">
        <view class="row-item">
          <text class="row-title">AI 事件研判</text>
          <text class="muted">{{ aiStatusSummary }}</text>
        </view>
      </view>
      <view class="row">
        <view class="row-item">
          <text class="row-title">数据与对象</text>
          <text class="muted">查看所有关系对象、时间线与评估。</text>
          <button class="btn-secondary" @click="goCases">打开对象列表</button>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="h2">判断说明</text>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('intent')">
          <view>
            <text class="row-title">意向倾向</text>
            <text class="muted">对方主动、投入和推进关系的程度。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.intent ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.intent" class="explain-body">
          <view v-for="item in intentLevels" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }} · {{ item.range }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('risk')">
          <view>
            <text class="row-title">风险等级</text>
            <text class="muted">回避、拖延、改口、兑现不足和节奏反复的程度。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.risk ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.risk" class="explain-body">
          <view v-for="item in riskLevels" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }} · {{ item.range }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('status')">
          <view>
            <text class="row-title">对象状态路径</text>
            <text class="muted">阶段、状态、气候三个词分别代表不同层级。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.status ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.status" class="explain-body">
          <text class="muted">关系主页和即时研判里的三个状态词，分别对应阶段、状态和气候。它们不是一句结论，而是帮助你知道当前判断处在哪个位置。</text>

          <view class="path-block">
            <text class="h3">阶段路径</text>
            <text class="muted">看关系判断进入了哪一种处理阶段。</text>
            <view class="path-row">
              <text v-for="item in phasePath" :key="item" class="path-chip">{{ item }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">状态路径</text>
            <text class="muted">看当前阶段里的具体表现。</text>
            <view class="path-row">
              <text v-for="item in statePath" :key="item" class="path-chip">{{ item }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">气候路径</text>
            <text class="muted">看最近趋势的风险体感，越往后越需要谨慎。</text>
            <view class="path-row">
              <text v-for="item in weatherPath" :key="item" class="path-chip weather">{{ item }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { logout, getCurrentUserId, getCases, getCachedSelfProfile, getSelfProfile } from '@/utils/api'
import { applyThemeChrome, getCurrentThemeId, getThemeStyle, setCurrentTheme, themeOptions, type ThemeId } from '@/utils/theme'

const userEmail = ref('')
const caseCount = ref(0)
const selfProfileSummary = ref('还没有填写。系统会用它调整用词、入口推荐和未成年人保护表达。')
const aiStatusSummary = ref('AI 事件研判由系统后台统一配置。')
const currentThemeId = ref<ThemeId>(getCurrentThemeId())
const themeVars = ref(getThemeStyle())
const expandedSections = ref({
  intent: false,
  risk: false,
  status: false
})

const intentLevels = [
  { label: '低意向', range: '0-24', description: '主动与投入信号都比较弱。' },
  { label: '偏低意向', range: '25-44', description: '偶尔靠近但不稳定。' },
  { label: '中等意向', range: '45-59', description: '已经出现一定兴趣。' },
  { label: '中高意向', range: '60-74', description: '推进信号比较明显。' },
  { label: '高意向', range: '75-100', description: '主动性和投入度整体偏强。' }
]
const riskLevels = [
  { label: '低风险', range: '0-24', description: '一致性整体稳。' },
  { label: '偏低风险', range: '25-44', description: '偶尔会有小波动。' },
  { label: '中等风险', range: '45-59', description: '已有一些回避或反复线索。' },
  { label: '中高风险', range: '60-74', description: '风险信号比较集中。' },
  { label: '高风险', range: '75-100', description: '建议暂停投入，先核实关键事实。' }
]
const phasePath = ['试探期', '观察期', '升温期', '验证期', '拉扯期', '降温期']
const statePath = ['投入偏弱', '继续观察', '稳步推进', '有热度但不稳', '忽冷忽热', '高消耗信号']
const weatherPath = ['晴', '转晴', '多云', '起风', '阵风', '雷阵雨']

onShow(() => {
  syncTheme()
  loadData()
})

function syncTheme() {
  currentThemeId.value = getCurrentThemeId()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
}

function chooseTheme(themeId: ThemeId) {
  const theme = setCurrentTheme(themeId)
  currentThemeId.value = theme.id
  themeVars.value = getThemeStyle(theme)
}

function toggleSection(key: 'intent' | 'risk' | 'status') {
  expandedSections.value[key] = !expandedSections.value[key]
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userEmail.value = uni.getStorageSync('userEmail') || ''
  syncSelfProfileSummary(getCachedSelfProfile())
  try {
    const list = await getCases(uid)
    caseCount.value = (list || []).length
  } catch (e) {
    // 静默
  }
  try {
    const result = await getSelfProfile()
    if (result?.success) {
      syncSelfProfileSummary(result.selfProfile)
    }
  } catch (e) {
    // ignore
  }
}

function syncSelfProfileSummary(profile: any) {
  if (!profile || typeof profile !== 'object' || !profile.gender || !profile.ageRange || !profile.identity) {
    selfProfileSummary.value = '还没有填写。系统会用它调整用词、入口推荐和未成年人保护表达。'
    return
  }
  const genderMap: Record<string, string> = { male: '男生', female: '女生', private: '暂不说' }
  const ageMap: Record<string, string> = { under18: '18 岁以下', '18_22': '18-22 岁', '23_26': '23-26 岁', '27_plus': '27 岁以上' }
  const identityMap: Record<string, string> = {
    high_school: '高中 / 中专',
    college: '大学生',
    graduate: '研究生',
    worker: '已工作',
    other: '其他'
  }
  const parts = [
    genderMap[profile.gender] || profile.gender,
    ageMap[profile.ageRange] || profile.ageRange,
    identityMap[profile.identity] || profile.identity,
    profile.zodiac ? `属${profile.zodiac}` : '',
    profile.constellation || ''
  ].filter(Boolean)
  selfProfileSummary.value = parts.join(' · ')
}

function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

async function onLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f4ede2; padding: 24rpx; box-sizing: border-box; }
.card { background: #fbf6ee; border-radius: 20rpx; padding: 32rpx; margin-bottom: 24rpx; }
.hero-card { background: linear-gradient(135deg, #fbf6ee 0%, #f4ede2 100%); }
.hero-topline { display: block; font-size: 22rpx; color: #786857; }
.h1 { display: block; font-size: 40rpx; font-weight: 700; color: #143f3a; margin: 8rpx 0; }
.h2 { display: block; font-size: 32rpx; font-weight: 600; color: #241b12; margin-bottom: 10rpx; }
.h3 { display: block; font-size: 28rpx; font-weight: 600; color: #241b12; margin-top: 12rpx; }
.hero-subtext { display: block; font-size: 26rpx; color: #786857; line-height: 1.6; }
.muted { display: block; font-size: 24rpx; color: #786857; margin: 6rpx 0; }
.row { padding: 16rpx 0; border-top: 2rpx solid #efe7d8; }
.row:first-of-type { border-top: 0; }
.row-item { display: flex; flex-direction: column; gap: 8rpx; }
.row-title { font-size: 28rpx; font-weight: 600; color: #241b12; }
.actions { margin-top: 18rpx; }
.btn-secondary { height: 76rpx; line-height: 76rpx; background: #fff; color: #143f3a; border: 2rpx solid #143f3a; border-radius: 12rpx; font-size: 28rpx; padding: 0 24rpx; align-self: flex-start; }
.btn-danger { width: 100%; height: 80rpx; line-height: 80rpx; background: #b85c38; color: #fff; border: none; border-radius: 12rpx; font-size: 28rpx; }
.level-item { padding: 12rpx 0; }
.level-title { display: block; font-size: 26rpx; color: #241b12; font-weight: 600; }
.explain-section {
  margin-top: 16rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 90rpx),
    var(--card-soft, #fffaf3);
  overflow: hidden;
}
.explain-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 20rpx;
}
.expand-mark {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #143f3a);
  font-size: 22rpx;
  font-weight: 650;
}
.explain-body {
  padding: 0 20rpx 20rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.07);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 14rpx;
}

.theme-card {
  padding: 14rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.8);
  border: 1rpx solid rgba(18, 60, 54, 0.1);
}

.theme-card.active {
  border-color: var(--accent, #c9a45c);
  box-shadow: 0 10rpx 24rpx rgba(32, 25, 20, 0.08);
}

.theme-preview {
  height: 124rpx;
  padding: 12rpx;
  border-radius: 14rpx;
  background: var(--app-bg);
  overflow: hidden;
}

.preview-hero {
  height: 30rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, var(--hero-bg), var(--hero-bg-2));
}

.preview-card {
  margin-top: 10rpx;
  padding: 10rpx;
  border-radius: 8rpx;
  background: var(--card-bg);
}

.preview-line {
  width: 56%;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--text-muted);
  opacity: 0.45;
}

.preview-line.wide {
  width: 82%;
  margin-bottom: 8rpx;
  background: var(--text-main);
}

.preview-button {
  width: 50rpx;
  height: 14rpx;
  margin-top: 8rpx;
  border-radius: 999rpx;
  background: var(--primary);
}

.theme-name {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: var(--text-main, #241b12);
}

.theme-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: var(--text-muted, #786857);
  line-height: 1.4;
}

.page { background: var(--app-bg, #f4ede2); }
.card {
  background: var(--card-bg, #fbf6ee);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  box-shadow: 0 14rpx 30rpx rgba(32, 25, 20, 0.06);
}
.hero-card { background: linear-gradient(135deg, var(--hero-bg, #143f3a), var(--hero-bg-2, #0f2f2b)); }
.hero-topline, .hero-subtext { color: rgba(255, 252, 247, 0.76); }
.h1 { color: #fffaf0; }
.h2, .h3, .row-title, .level-title { color: var(--text-main, #241b12); }
.muted { color: var(--text-muted, #786857); }
.row { border-top-color: var(--accent-soft, #efe7d8); }
.btn-secondary {
  background: var(--card-bg, #fff);
  color: var(--primary, #143f3a);
  border-color: var(--primary, #143f3a);
}
.btn-danger { background: var(--risk, #b85c38); }

/* Second visual pass */
.card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(135deg, rgba(201, 164, 92, 0.1), rgba(18, 60, 54, 0.03) 58%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  box-shadow:
    0 18rpx 38rpx rgba(32, 25, 20, 0.075),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.hero-card {
  background:
    linear-gradient(135deg, var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
}

.card .h2,
.card .h3 {
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  line-height: 1.35;
}

.row {
  margin-top: 12rpx;
  padding: 22rpx 0;
}

.theme-card,
.level-item {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 90rpx),
    var(--card-soft, #fffaf3);
  border-radius: 16rpx;
}

.level-item {
  padding: 18rpx;
  margin-top: 10rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.explain-section .level-item {
  margin-top: 14rpx;
}
.path-block {
  margin-top: 22rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 90rpx),
    var(--card-soft, #fffaf3);
}
.path-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}
.path-chip {
  display: inline-block;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 650;
}
.path-chip.weather {
  background: rgba(201, 164, 92, 0.16);
  color: #6f5225;
}
</style>
