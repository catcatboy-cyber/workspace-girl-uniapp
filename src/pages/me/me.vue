<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>

    <block v-if="!showV2">
    <view class="card hero-card">
      <text class="hero-topline">Me / Settings</text>
      <text class="h1">我的</text>
      <text class="hero-subtext">这里管理账号、系统能力说明和个人设置。</text>
    </view>

    <view class="card">
      <text class="h2">账号信息</text>
      <text class="muted">当前登录账号：{{ userEmail || '未登录' }}</text>
      <text class="muted">关系对象数：{{ caseCount }}</text>
      <view class="actions">
        <button class="btn-secondary share-button" open-type="share">分享小程序</button>
        <button class="btn-danger" @click="onLogout">退出登录</button>
      </view>
    </view>

    <view class="card">
      <view class="section-head">
        <view>
          <text class="h2">我的 token 消费</text>
          <text class="muted">统计当前账号触发大模型调用后返回的 token 用量。</text>
        </view>
        <button class="btn-secondary mini-button" :disabled="tokenUsageLoading" @click="loadTokenUsage">
          {{ tokenUsageLoading ? '读取中' : '刷新' }}
        </button>
      </view>
      <view class="token-summary-grid">
        <view class="token-summary-item">
          <text class="token-number">{{ tokenUsageSummary.totalTokens }}</text>
          <text class="muted">总 token</text>
        </view>
        <view class="token-summary-item">
          <text class="token-number">{{ tokenUsageSummary.callCount }}</text>
          <text class="muted">调用次数</text>
        </view>
        <view class="token-summary-item">
          <text class="token-number">{{ tokenUsageSummary.promptTokens }}</text>
          <text class="muted">输入 token</text>
        </view>
        <view class="token-summary-item">
          <text class="token-number">{{ tokenUsageSummary.completionTokens }}</text>
          <text class="muted">输出 token</text>
        </view>
      </view>
      <text v-if="tokenUsageSummary.unavailableCount" class="muted">有 {{ tokenUsageSummary.unavailableCount }} 次调用的模型没有返回 usage，用量按 0 记录。</text>
      <view class="actions token-actions">
        <button class="btn-secondary" @click="goTokenUsage">查看消费明细</button>
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
          <text class="row-title">AI 陪伴风格</text>
          <text class="muted">你在这里选风格，后台提示词会真正跟着变，不是只改文案皮肤。</text>
          <view class="persona-grid">
            <view
              v-for="item in aiStyleOptions"
              :key="item.value"
              :class="['persona-card', aiStyle === item.value ? 'active' : '']"
              @click="aiStyle = item.value"
            >
              <text class="persona-name">{{ item.label }}</text>
              <text class="persona-desc">{{ item.description }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="row">
        <view class="row-item">
          <text class="row-title">建议力度</text>
          <text class="muted">决定 AI 更偏观察验证，还是更敢给你推进动作。</text>
          <view class="persona-inline-grid">
            <view
              v-for="item in aiBoldnessOptions"
              :key="item.value"
              :class="['persona-inline-card', aiBoldness === item.value ? 'active' : '']"
              @click="aiBoldness = item.value"
            >
              <text class="persona-name">{{ item.label }}</text>
              <text class="persona-desc">{{ item.description }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="row">
        <view class="row-item">
          <text class="row-title">AI 风格状态</text>
          <text class="muted">{{ aiStatusSummary }}</text>
          <text class="muted" v-if="!canSaveAIPersona">先完成本人画像，才能保存这组 AI 设置。</text>
          <button class="btn-secondary profile-button" :disabled="!canSaveAIPersona || aiSaving" @click="saveAIPersona">
            {{ aiSaving ? '保存中...' : '保存 AI 风格' }}
          </button>
        </view>
      </view>

      <view class="row">
        <view class="row-item">
          <text class="row-title">数据与对象</text>
          <text class="muted">查看所有关系对象、时间轴与评估。</text>
          <button class="btn-secondary" @click="goCases">打开对象列表</button>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="h2">判断说明</text>
      <text class="muted">这里汇总系统里实际会出现的判断标签，方便你统一查看，不用在各页来回对照。</text>

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
            <text class="muted">回避、拖延、失约、改口和反复的程度。</text>
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
        <view class="explain-head" @click="toggleSection('evidence')">
          <view>
            <text class="row-title">证据等级与判断把握</text>
            <text class="muted">系统对当前判断有多少连续事实支撑。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.evidence ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.evidence" class="explain-body">
          <view v-for="item in evidenceLevels" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }} · {{ item.confidence }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('status')">
          <view>
            <text class="row-title">对象状态标签</text>
            <text class="muted">首页、关系页、时间轴里的阶段 / 状态 / 天气标签。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.status ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.status" class="explain-body">
          <view class="path-block">
            <text class="h3">阶段</text>
            <view class="path-row">
              <text v-for="item in phaseItems" :key="item.label" class="path-chip">{{ item.label }}</text>
            </view>
            <view v-for="item in phaseItems" :key="`${item.label}-desc`" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">状态</text>
            <view class="path-row">
              <text v-for="item in stateItems" :key="item.label" class="path-chip">{{ item.label }}</text>
            </view>
            <view v-for="item in stateItems" :key="`${item.label}-desc`" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">天气</text>
            <view class="path-row">
              <text v-for="item in weatherItems" :key="item.label" class="path-chip weather">{{ item.label }}</text>
            </view>
            <view v-for="item in weatherItems" :key="`${item.label}-desc`" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('weeklyTrend')">
          <view>
            <text class="row-title">周复盘趋势标签</text>
            <text class="muted">本周复盘和复盘历史里会出现的趋势结论。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.weeklyTrend ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.weeklyTrend" class="explain-body">
          <view v-for="item in weeklyTrendItems" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('action')">
          <view>
            <text class="row-title">下一步动作标签</text>
            <text class="muted">系统建议你当前更适合怎么处理，而不是让你盲目推进。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.action ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.action" class="explain-body">
          <view v-for="item in nextActionItems" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('problem')">
          <view>
            <text class="row-title">问题类型</text>
            <text class="muted">时间轴评估历史里显示的结构性提醒。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.problem ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.problem" class="explain-body">
          <view v-for="item in problemItems" :key="item.label" class="level-item">
            <text class="level-title">{{ item.label }}</text>
            <text class="muted">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view class="explain-section">
        <view class="explain-head" @click="toggleSection('record')">
          <view>
            <text class="row-title">记录与系统标签</text>
            <text class="muted">快速记录、时间轴、系统研判里会出现的其他标签。</text>
          </view>
          <text class="expand-mark">{{ expandedSections.record ? '收起' : '展开' }}</text>
        </view>
        <view v-if="expandedSections.record" class="explain-body">
          <view class="path-block">
            <text class="h3">事件分类</text>
            <view v-for="item in eventTypeItems" :key="item.label" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">一句话记录主语</text>
            <view v-for="item in subjectRoleItems" :key="item.label" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">对象类型</text>
            <view v-for="item in relationTypeItems" :key="item.label" class="level-item compact">
              <text class="level-title">{{ item.label }}</text>
              <text class="muted">{{ item.description }}</text>
            </view>
          </view>

          <view class="path-block">
            <text class="h3">系统参与标记</text>
            <view class="level-item compact">
              <text class="level-title">AI 已参与研判</text>
              <text class="muted">说明这次即时反馈、侧写或周复盘有大模型参与生成，不是纯规则兜底。它代表生成方式，不代表一定更准确。</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    </block>
    <!-- /经典版 -->

    <!-- Campus Pop -->
    <block v-if="showV2">
      <view class="hero-block-v2"><text class="hero-tag-v2">SETTINGS</text><text class="hero-title-v2">我<text class="hl-v2">的</text></text><text class="hero-copy-v2">管理账号、系统能力说明和个人设置。</text></view>
      <!-- Account -->
      <view class="card-v2"><text class="section-title-v2">账号信息</text><text class="card-text-v2">当前登录：{{ userEmail || '未登录' }}</text><text class="card-text-v2">关系对象数：{{ caseCount }}</text><view class="btn-row-v2"><button class="btn-v2-me" open-type="share">分享小程序</button><button class="btn-v2-me danger" @click="onLogout">退出登录</button></view></view>
      <!-- Profile (moved here) -->
      <view class="card-v2"><text class="section-title-v2">本人画像</text><text class="card-text-v2">{{ selfProfileSummary }}</text><button class="btn-v2-me outline" @click="goSelfProfile">编辑本人画像</button></view>
      <!-- Token (fixed button) -->
      <view class="card-v2"><text class="section-title-v2">Token 消费</text><text class="card-text-v2">统计当前账号触发大模型调用后返回的 token 用量。</text><view class="stats-grid-v2"><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.totalTokens }}</text><text class="stat-lbl-v2">总 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.callCount }}</text><text class="stat-lbl-v2">调用次数</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.promptTokens }}</text><text class="stat-lbl-v2">输入 token</text></view><view class="stat-box-v2"><text class="stat-num-v2">{{ tokenUsageSummary.completionTokens }}</text><text class="stat-lbl-v2">输出 token</text></view></view><text v-if="tokenUsageSummary.unavailableCount" class="card-text-v2 muted">有 {{ tokenUsageSummary.unavailableCount }} 次调用未返回 usage。</text><view class="btn-row-v2" style="margin-top:14rpx;"><button class="btn-v2-me sm" :disabled="tokenUsageLoading" @click="loadTokenUsage">{{ tokenUsageLoading ? '读取中' : '刷新' }}</button><button class="btn-v2-me outline sm" @click="goTokenUsage">消费明细</button></view></view>
      <!-- Theme picker -->
      <view class="card-v2"><text class="section-title-v2">界面风格</text><text class="card-text-v2">选择更适合你的视觉氛围。</text><view class="theme-grid-v2"><view v-for="theme in themeOptions" :key="theme.id" :class="['theme-card-v2', currentThemeId === theme.id ? 'active' : '']" @click="chooseTheme(theme.id)"><view class="theme-dot-v2" :style="{ background: theme.vars['--hero-bg'] }"></view><text class="theme-name-v2">{{ theme.name }}</text><text class="theme-desc-v2">{{ theme.description }}</text></view></view></view>
      <!-- AI style -->
      <view class="card-v2"><text class="section-title-v2">AI 陪伴风格</text><text class="card-text-v2">你在这里选风格，后台提示词会真正跟着变，不是只改文案皮肤。</text><view class="chip-grid-v2"><view v-for="item in aiStyleOptions" :key="item.value" :class="['chip-v2', aiStyle === item.value ? 'active' : '']" @click="aiStyle = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view></view>
      <view class="card-v2"><text class="section-title-v2">建议力度</text><view class="chip-grid-v2 cols3"><view v-for="item in aiBoldnessOptions" :key="item.value" :class="['chip-v2', aiBoldness === item.value ? 'active' : '']" @click="aiBoldness = item.value"><text class="chip-label-v2">{{ item.label }}</text><text class="chip-desc-v2">{{ item.description }}</text></view></view></view>
      <view class="card-v2"><text class="section-title-v2">AI 风格状态</text><text class="card-text-v2">{{ aiStatusSummary }}</text><button class="btn-v2-me primary" :disabled="!canSaveAIPersona || aiSaving" @click="saveAIPersona">{{ aiSaving ? '保存中...' : '保存 AI 风格' }}</button></view>
      <!-- Judgment explanations -->
      <view class="card-v2"><text class="section-title-v2">判断说明</text><text class="card-text-v2">汇总系统里实际会出现的判断标签。</text>
        <view v-for="section in explainSections" :key="section.key" class="explain-v2"><view class="explain-head-v2" @click="toggleSection(section.key)"><text class="explain-title-v2">{{ section.label }}</text><text class="explain-arrow-v2">{{ expandedSections[section.key] ? '收起' : '展开' }}</text></view><view v-if="expandedSections[section.key]" class="explain-body-v2"><view v-for="item in section.items" :key="item.label" class="explain-item-v2"><text class="explain-item-title-v2">{{ item.label }}<text v-if="item.range"> · {{ item.range }}</text></text><text class="explain-item-desc-v2">{{ item.description }}</text></view></view></view>
      </view>
    </block>
    <!-- /Campus Pop -->

  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import {
  getCachedSelfProfile,
  getCases,
  getCurrentUserId,
  getSelfProfile,
  getTokenUsage,
  hasUsableSelfProfile,
  logout,
  updateSelfProfile,
  type AIBoldnessValue,
  type AIStyleValue,
  type SelfProfile
} from '@/utils/api'
import { applyThemeChrome, getCurrentThemeId, getThemeStyle, setCurrentTheme, themeOptions, type ThemeId } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const showV2 = ref(true)
const userEmail = ref('')
const caseCount = ref(0)
const selfProfileSummary = ref('还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。')
const aiStatusSummary = ref('当前：温柔陪伴 · 平衡。未满 18 岁时会自动切换为谨慎守护 + 保守建议。')
const currentThemeId = ref<ThemeId>(getCurrentThemeId())
const themeVars = ref(getThemeStyle())
const currentSelfProfile = ref<SelfProfile | null>(getCachedSelfProfile())
const aiStyle = ref<AIStyleValue>('gentle_bestie')
const aiBoldness = ref<AIBoldnessValue>('balanced')
const aiSaving = ref(false)
const tokenUsageLoading = ref(false)
const tokenUsageSummary = ref({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  callCount: 0,
  unavailableCount: 0
})
const canSaveAIPersona = computed(() => hasUsableSelfProfile(currentSelfProfile.value) && !aiSaving.value)
const explainSections = computed(() => [
  { key: 'intent' as const, label: '意向倾向', items: intentLevels },
  { key: 'risk' as const, label: '风险等级', items: riskLevels },
  { key: 'evidence' as const, label: '证据等级与判断把握', items: evidenceLevels },
  { key: 'status' as const, label: '对象状态标签', items: [...phaseItems, ...stateItems, ...weatherItems] },
  { key: 'weeklyTrend' as const, label: '周复盘趋势标签', items: weeklyTrendItems },
  { key: 'action' as const, label: '下一步动作标签', items: nextActionItems },
  { key: 'problem' as const, label: '问题类型', items: problemItems },
  { key: 'record' as const, label: '记录与系统标签', items: [...eventTypeItems, ...subjectRoleItems, ...relationTypeItems] }
])
const expandedSections = ref({
  intent: false,
  risk: false,
  evidence: false,
  status: false,
  weeklyTrend: false,
  action: false,
  problem: false,
  record: false
})

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())

const aiStyleOptions: Array<{
  value: AIStyleValue
  label: string
  description: string
}> = [
  { value: 'gentle_bestie', label: '温柔陪伴', description: '更像体贴闺蜜，先接住情绪，再给清楚动作。' },
  { value: 'calm_strategist', label: '冷静军师', description: '更看节奏、证据和推进效率，语气克制。' },
  { value: 'playful_flirty', label: '轻痞幽默', description: '更会撩一点，语气活，但不会乱越界。' },
  { value: 'direct_sharp', label: '闺蜜直给', description: '不绕弯，结论更硬，适合想听真话。' },
  { value: 'careful_guardian', label: '谨慎守护', description: '更重边界和风险，先稳住，再决定推不推进。' }
]

const aiBoldnessOptions: Array<{
  value: AIBoldnessValue
  label: string
  description: string
}> = [
  { value: 'conservative', label: '保守', description: '优先观察、验证和降误判。' },
  { value: 'balanced', label: '平衡', description: '该推进时推进，该收口时收口。' },
  { value: 'bold', label: '大胆', description: '更敢给动作建议，但高风险场景仍会自动收口。' }
]

const intentLevels = [
  { label: '低意向', range: '0-24', description: '主动和投入信号整体偏弱，不适合按高期待去推进。' },
  { label: '偏低意向', range: '25-44', description: '偶尔靠近，但持续性不够，更多还在边缘试探。' },
  { label: '中等意向', range: '45-59', description: '已经出现一定兴趣，但还需要继续看兑现和连续性。' },
  { label: '中高意向', range: '60-74', description: '推进信号较明显，后续重点看能不能稳定落地。' },
  { label: '高意向', range: '75-100', description: '主动性和投入度整体偏高，但仍要看长期一致性。' }
]

const riskLevels = [
  { label: '低风险', range: '0-24', description: '一致性整体较稳，明显回避和反复较少。' },
  { label: '偏低风险', range: '25-44', description: '有些小波动，但暂时还没有形成强风险结构。' },
  { label: '中等风险', range: '45-59', description: '已经出现回避、拖延、改口或兑现不足的迹象。' },
  { label: '中高风险', range: '60-74', description: '风险信号较集中，后续更要看事实，不适合继续脑补。' },
  { label: '高风险', range: '75-100', description: '风险已明显偏高，建议先暂停投入，优先核实关键事实。' }
]

const evidenceLevels = [
  { label: 'E1', confidence: '判断把握：低', description: '证据最薄，几乎还停留在感受和单点样本层，不适合下重结论。' },
  { label: 'E2', confidence: '判断把握：低', description: '已经有少量事实，但仍然偏薄，很多判断还不够稳。' },
  { label: 'E3', confidence: '判断把握：中', description: '开始能看出一些模式，但仍需要继续验证和补样本。' },
  { label: 'E4', confidence: '判断把握：高', description: '已有较连续的事实支撑，不再只是凭体感判断。' },
  { label: 'E5', confidence: '判断把握：高', description: '证据最强，代表当前判断背后有较多连续样本和落地事实。' }
]

const phaseItems = [
  { label: '试探期', description: '证据还薄，很多感觉仍需要更多事实支撑。' },
  { label: '观察期', description: '样本还不够稳，当前重点是继续看后续动作是否持续。' },
  { label: '升温期', description: '整体信号在往前走，但仍要看能不能持续兑现。' },
  { label: '验证期', description: '更适合核实承诺、身份、说法或安排是否真的落地。' },
  { label: '拉扯期', description: '既有热度也有不稳，不能只抓某一次好的感觉。' },
  { label: '降温期', description: '继续加码投入的收益偏低，先看对方会不会补动作。' }
]

const stateItems = [
  { label: '投入偏弱', description: '当前看到的主动和投入偏弱，不适合继续单方面加码。' },
  { label: '继续观察', description: '还没有形成足够强的单向结论，重点看下一轮互动。' },
  { label: '稳步推进', description: '意向和稳定性都相对不错，有继续推进的基础。' },
  { label: '有热度但不稳', description: '不是完全没兴趣，但稳定性不足，容易只热不落地。' },
  { label: '忽冷忽热', description: '局部热度存在，但前后反复明显，不能把局部当整体。' },
  { label: '高消耗信号', description: '你的心理负担和不确定性已经偏高，这段关系正在消耗你。' },
  { label: '连续受阻', description: '不是单次卡住，而是连续出现受阻、拒绝或婉拒信号。' },
  { label: '明显转弱', description: '和之前相比整体状态已经在走弱，不适合按旧印象判断。' }
]

const weatherItems = [
  { label: '晴', description: '当前体感最稳，风险较低，氛围整体偏顺。' },
  { label: '转晴', description: '最近走势在变好，意向上升且风险回落。' },
  { label: '多云', description: '状态一般，没有特别强的顺风或逆风。' },
  { label: '起风', description: '不稳定苗头开始出现，后面要更留意细节变化。' },
  { label: '阵风', description: '波动感较明显，容易出现前后落差。' },
  { label: '雷阵雨', description: '风险明显偏高，当前不适合只凭感觉推进。' }
]

const weeklyTrendItems = [
  { label: '升温', description: '本周意向整体比之前更强，而且风险没有同步抬头。' },
  { label: '降温', description: '本周意向明显回落，关系热度在走弱。' },
  { label: '有波动', description: '本周分数变化较明显，但暂时还不适合下单向结论。' },
  { label: '风险抬头', description: '本周更突出的不是热度，而是回避、拖延、反复或兑现不足。' },
  { label: '基本持平', description: '本周整体没有出现足够强的新变化，先继续记录。' }
]

const nextActionItems = [
  { label: '继续观察', description: '先别急着定性，继续看对方后续有没有动作和兑现。' },
  { label: '先做验证', description: '重点不是推进，而是看承诺、说法、身份或安排能不能对上事实。' },
  { label: '适合澄清', description: '当前更适合问清楚、确认边界或把模糊点说具体。' },
  { label: '先暂停推进', description: '风险太高，继续加码投入的收益偏低，先收回来观察。' },
  { label: '样本还不够', description: '当前事实太少，不适合因为一次感觉就改分或下重结论。' }
]

const problemItems = [
  { label: '单向投入', description: '大部分推进成本还在你这边，对方没有给出相称的主动和投入。' },
  { label: '口头热情，行动不足', description: '嘴上不差，但落到见面、安排、兑现这些动作上还不够。' },
  { label: '关键问题难验证', description: '有些关键说法、承诺、身份或时间线当前还对不上，或很难核实。' },
  { label: '节奏明显不稳定', description: '热度、态度或推进节奏前后反复，单次高点不代表整体趋势。' },
  { label: '证据不足', description: '现阶段样本太少，很多判断仍停留在感觉层。' },
  { label: '暂无突出问题', description: '当前没有特别突出的结构性问题标签，不代表关系就一定稳定。' }
]

const eventTypeItems = [
  { label: '推进事件', description: '这次记录整体更偏正向推进，重点看对方是否会继续主动、兑现和延续相处。' },
  { label: '风险事件', description: '这次记录整体更偏风险信号，重点看有没有回避、拖延、失约或边界压力。' },
  { label: '验证事件', description: '这次更像核实机会，重点不是体感，而是说法能不能对上事实。' },
  { label: '普通记录', description: '这次先作为普通上下文保留，暂时还不是强推进或强风险证据。' },
  { label: '关系记录', description: '这是关系中的一条普通切片，用来补上下文，不直接代表结论。' }
]

const subjectRoleItems = [
  { label: '对方', description: '这条一句话主要描述关系对象，对方动作会直接参与本次判断。' },
  { label: '自己', description: '这条主要是你的状态记录，不会因为“我准备了什么”就直接提高对方意向。' },
  { label: '互动', description: '这条描述双方互动，系统会拆分“你做了什么”和“对方回应了什么”。' },
  { label: '未知', description: '主体不清时权重会更低，除非文字里明确写出对方动作。' }
]

const relationTypeItems = [
  { label: '恋爱对象', description: '按恋爱关系的互动逻辑来分析推进、风险和兑现。' },
  { label: '亲密朋友', description: '按高亲密友谊逻辑来分析靠近、边界和稳定性。' }
]

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

function toggleSection(
  key: 'intent' | 'risk' | 'evidence' | 'status' | 'weeklyTrend' | 'action' | 'problem' | 'record'
) {
  expandedSections.value[key] = !expandedSections.value[key]
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  userEmail.value = uni.getStorageSync('userEmail') || ''
  syncProfileState(getCachedSelfProfile())

  try {
    const list = await getCases(uid)
    caseCount.value = (list || []).length
  } catch {
    // ignore
  }

  try {
    const result = await getSelfProfile()
    if (result?.success) syncProfileState(result.selfProfile)
  } catch {
    // ignore
  }

  loadTokenUsage()
}

async function loadTokenUsage() {
  if (tokenUsageLoading.value) return
  tokenUsageLoading.value = true
  try {
    const result = await getTokenUsage(50)
    if (!result?.success) return
    tokenUsageSummary.value = {
      promptTokens: Number(result.summary?.promptTokens || 0),
      completionTokens: Number(result.summary?.completionTokens || 0),
      totalTokens: Number(result.summary?.totalTokens || 0),
      callCount: Number(result.summary?.callCount || 0),
      unavailableCount: Number(result.summary?.unavailableCount || 0)
    }
  } finally {
    tokenUsageLoading.value = false
  }
}

function syncProfileState(profile: SelfProfile | null | undefined) {
  currentSelfProfile.value = profile && typeof profile === 'object' ? { ...profile } : null
  syncSelfProfileSummary(currentSelfProfile.value)
  syncAIPersonaState(currentSelfProfile.value)
}

function syncSelfProfileSummary(profile: any) {
  if (!profile || typeof profile !== 'object' || !profile.gender || !profile.ageRange || !profile.identity) {
    selfProfileSummary.value = '还没填写。系统会用它调整措辞、入口推荐和未成年人保护表达。'
    return
  }

  const genderMap: Record<string, string> = {
    male: '男生',
    female: '女生',
    private: '暂不说明'
  }
  const ageMap: Record<string, string> = {
    under18: '18 岁以下',
    '18_22': '18-22 岁',
    '23_26': '23-26 岁',
    '27_plus': '27 岁以上'
  }
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

function syncAIPersonaState(profile: SelfProfile | null | undefined) {
  const style = aiStyleOptions.find((item) => item.value === profile?.aiStyle)?.value || 'gentle_bestie'
  const boldness = aiBoldnessOptions.find((item) => item.value === profile?.aiBoldness)?.value || 'balanced'
  aiStyle.value = style
  aiBoldness.value = boldness

  const styleLabel = aiStyleOptions.find((item) => item.value === style)?.label || '温柔陪伴'
  const boldnessLabel = aiBoldnessOptions.find((item) => item.value === boldness)?.label || '平衡'
  const safetyNote = profile?.ageRange === 'under18'
    ? '未满 18 岁时会自动切换为谨慎守护 + 保守建议。'
    : '遇到明显越界、私密或高风险事件时，系统会自动收口，不会按大胆风格硬推。'
  aiStatusSummary.value = `当前：${styleLabel} · ${boldnessLabel}。${safetyNote}`
}

async function saveAIPersona() {
  if (!canSaveAIPersona.value || !currentSelfProfile.value) return

  aiSaving.value = true
  try {
    const result = await updateSelfProfile({
      ...currentSelfProfile.value,
      aiStyle: aiStyle.value,
      aiBoldness: aiBoldness.value
    })
    if (!result?.success) {
      uni.showToast({ title: result?.message || '保存失败', icon: 'none' })
      return
    }
    syncProfileState(result.selfProfile)
    uni.showToast({ title: 'AI 风格已保存', icon: 'none' })
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败', icon: 'none' })
  } finally {
    aiSaving.value = false
  }
}

function goCases() {
  uni.switchTab({ url: '/pages/cases/cases' })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

function goTokenUsage() {
  uni.navigateTo({ url: '/pages/token-usage/token-usage' })
}

async function onLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}

.card {
  background: var(--card-bg, #fbf6ee);
  border-radius: var(--radius-md, 20rpx);
  padding: var(--spacing-card, 32rpx);
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  box-shadow: var(--shadow-md, 0 16rpx 36rpx rgba(32, 25, 20, 0.06));
}

.hero-card {
  background: linear-gradient(var(--hero-gradient-angle, 135deg), var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: var(--shadow-hero, 0 22rpx 44rpx rgba(18, 60, 54, 0.18));
}

.hero-topline {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 252, 247, 0.72);
  letter-spacing: 3rpx;
}

.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: var(--font-weight-hero, 700);
  color: var(--primary, #143f3a);
  margin: 8rpx 0;
  line-height: var(--text-line-height-heading, 1.25);
}

.hero-card .h1 { color: #fffaf0; }

.h2 {
  display: block;
  font-size: 32rpx;
  font-weight: var(--font-weight-strong, 600);
  color: var(--text-main, #241b12);
  margin-bottom: 10rpx;
}

.h3 {
  display: block;
  font-size: 28rpx;
  font-weight: var(--font-weight-strong, 600);
  color: var(--text-main, #241b12);
  margin-top: 12rpx;
}

.hero-subtext {
  display: block;
  font-size: 26rpx;
  line-height: var(--text-line-height, 1.6);
}

.hero-card .hero-subtext { color: rgba(255, 252, 247, 0.76); }

.muted {
  display: block;
  font-size: 24rpx;
  color: var(--text-muted, #786857);
  margin: 6rpx 0;
  line-height: var(--text-line-height, 1.6);
}

.row {
  padding: 16rpx 0;
  border-top: 2rpx solid var(--accent-soft, #efe7d8);
}

.row:first-of-type { border-top: 0; }

.row-item { display: flex; flex-direction: column; gap: 8rpx; }

.row-title {
  font-size: 28rpx;
  font-weight: var(--font-weight-strong, 600);
  color: var(--text-main, #241b12);
}

.actions { display: flex; gap: 14rpx; margin-top: 18rpx; }

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.btn-secondary {
  height: 76rpx;
  line-height: 76rpx;
  background: var(--card-bg, rgba(255, 252, 247, 0.92));
  color: var(--primary, #143f3a);
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  border-radius: var(--radius-sm, 14rpx);
  font-size: 28rpx;
  padding: 0 24rpx;
  align-self: flex-start;
  font-weight: var(--font-weight-strong, 600);
}

.mini-button {
  height: 60rpx;
  line-height: 60rpx;
  font-size: 24rpx;
  padding: 0 18rpx;
  flex-shrink: 0;
}

.token-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.token-summary-item {
  padding: 18rpx;
  border-radius: var(--radius-sm, 14rpx);
  background: var(--card-soft, #fff);
  border: 1rpx solid rgba(20, 63, 58, 0.08);
}

.token-number {
  display: block;
  font-size: 34rpx;
  font-weight: 750;
  color: var(--primary, #143f3a);
}

.token-list { display: flex; flex-direction: column; gap: 12rpx; margin-top: 18rpx; }

.token-actions { display: flex; }

.token-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding: 18rpx;
  border-radius: var(--radius-sm, 14rpx);
  background: var(--card-soft, #fff);
  border: 1rpx solid rgba(20, 63, 58, 0.08);
}

.token-counts { min-width: 150rpx; text-align: right; }

.token-total {
  display: block;
  color: var(--primary, #143f3a);
  font-size: 30rpx;
  font-weight: 750;
}

.btn-danger {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--risk, #b85c38);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm, 12rpx);
  font-size: 28rpx;
}

.share-button {
  flex: 1;
  align-self: stretch;
  height: 80rpx;
  line-height: 80rpx;
}

.explain-section {
  margin-top: 16rpx;
  border-radius: var(--radius-sm, 16rpx);
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

.level-item { padding: 14rpx 0; }
.level-item.compact { padding: 10rpx 0; }

.level-title {
  display: block;
  font-size: 26rpx;
  color: var(--text-main, #241b12);
  font-weight: 600;
}

.path-block { margin-top: 14rpx; }

.path-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin: 12rpx 0 8rpx; }

.path-chip {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: var(--primary, #143f3a);
  background: rgba(18, 60, 54, 0.08);
}

.path-chip.weather {
  color: #6b561c;
  background: rgba(201, 164, 92, 0.16);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 14rpx;
}

.theme-card {
  padding: 14rpx;
  border-radius: var(--radius-sm, 16rpx);
  background: var(--card-soft, rgba(255, 252, 247, 0.8));
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}

.theme-card.active {
  border-color: rgba(18, 60, 54, 0.28);
  box-shadow: 0 0 0 2rpx rgba(18, 60, 54, 0.08);
}

.theme-preview {
  height: 156rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: var(--app-bg, #f6f1e8);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  box-sizing: border-box;
}

.preview-hero {
  height: 36rpx;
  border-radius: 10rpx;
  background: var(--hero-bg, #123c36);
}

.preview-card {
  flex: 1;
  border-radius: 10rpx;
  padding: 10rpx;
  background: var(--card-bg, #fffaf4);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.preview-line {
  height: 10rpx;
  width: 60%;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.16);
}

.preview-line.wide { width: 82%; }

.preview-button {
  width: 56rpx;
  height: 18rpx;
  border-radius: 999rpx;
  background: var(--accent, #c9a45c);
}

.theme-name {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-main, #241b12);
}

.theme-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--text-muted, #786857);
}

.persona-grid,
.persona-inline-grid {
  display: grid;
  gap: 14rpx;
  margin-top: 12rpx;
}

.persona-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.persona-inline-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.persona-card,
.persona-inline-card {
  padding: 16rpx;
  border-radius: var(--radius-sm, 16rpx);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background: var(--card-soft, rgba(255, 252, 247, 0.82));
}

.persona-card.active,
.persona-inline-card.active {
  border-color: rgba(18, 60, 54, 0.3);
  box-shadow: 0 0 0 2rpx rgba(18, 60, 54, 0.08);
  background: rgba(233, 244, 240, 0.92);
}

.persona-name {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-main, #241b12);
}

.persona-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--text-muted, #786857);
}

.profile-button { margin-top: 10rpx; }

/* ===== CAMPUS POP V2 ===== */
.version-toggle { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #111; overflow: hidden; background: #fff; }
.toggle-tab { flex: 1; text-align: center; padding: 14rpx 0; font-size: 26rpx; font-weight: 700; color: #999; }
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: var(--accent, #FFD93D); padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .card-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.v2-mode .card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 6rpx; }
.v2-mode .card-text-v2.muted { color: #999; font-size: 20rpx; }

.v2-mode .btn-row-v2 { display: flex; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .btn-v2-me { flex: 1; height: 64rpx; line-height: 64rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .btn-v2-me.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .btn-v2-me.danger { background: #fff; color: #FF5252; border-color: #FF5252; }
.v2-mode .btn-v2-me.outline { background: #fff; }
.v2-mode .btn-v2-me.sm { width: auto; flex: 0; padding: 0 20rpx; height: 52rpx; line-height: 52rpx; font-size: 22rpx; }
.v2-mode .btn-v2-me[disabled] { opacity: 0.6; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; margin-top: 12rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx 8rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 4rpx; }

.v2-mode .theme-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .theme-card-v2 { padding: 14rpx 10rpx; border: 2rpx solid #111; background: #fff; text-align: center; }
.v2-mode .theme-card-v2.active { background: #111; }
.v2-mode .theme-dot-v2 { width: 32rpx; height: 32rpx; border-radius: 50%; border: 2rpx solid #111; margin: 0 auto 6rpx; }
.v2-mode .theme-card-v2.active .theme-dot-v2 { border-color: #FFD93D; }
.v2-mode .theme-name-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .theme-card-v2.active .theme-name-v2 { color: #FFD93D; }
.v2-mode .theme-desc-v2 { display: block; font-size: 16rpx; font-weight: 600; color: #999; margin-top: 4rpx; line-height: 1.3; }
.v2-mode .theme-card-v2.active .theme-desc-v2 { color: rgba(255,255,255,0.5); }

.v2-mode .chip-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10rpx; margin-top: 12rpx; }
.v2-mode .chip-grid-v2.cols3 { grid-template-columns: repeat(3, 1fr); }
.v2-mode .chip-v2 { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .chip-v2.active { background: #111; }
.v2-mode .chip-label-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .chip-v2.active .chip-label-v2 { color: #FFD93D; }
.v2-mode .chip-desc-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; line-height: 1.4; }
.v2-mode .chip-v2.active .chip-desc-v2 { color: rgba(255,255,255,0.6); }

.v2-mode .explain-v2 { margin-top: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .explain-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 18rpx; }
.v2-mode .explain-title-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .explain-arrow-v2 { padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 18rpx; font-weight: 800; color: #111; }
.v2-mode .explain-body-v2 { padding: 0 18rpx 18rpx; border-top: 2rpx solid #111; }
.v2-mode .explain-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed #e0e0e0; }
.v2-mode .explain-item-v2:last-child { border-bottom: none; }
.v2-mode .explain-item-title-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .explain-item-desc-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-top: 2rpx; line-height: 1.4; }
</style>
