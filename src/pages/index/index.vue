<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <!-- 版本切换 -->
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>

    <view v-if="loading" class="loading">LOADING...</view>

    <block v-else>
    <!-- ==================== 经典版 ==================== -->
    <block v-if="!showV2">
      <view class="debug-classic">经典版已激活</view>

    <!-- 空状态：显示 AssessmentForm -->
    <template v-if="cases.length === 0">
      <view class="card hero-card">
        <text class="hero-topline">Relationship Signal Lab</text>
        <text class="h1">先做一次初次评估</text>
        <text class="hero-subtext">第一次进入时先完成一轮结构化问答。后续你更常做的动作会是补记录、看时间线和重新评估，而不是每次都重答整套题。</text>
      </view>

      <AssessmentForm @submit="onCreateCase" />
    </template>

    <!-- 有案例：显示最近案例 KPI + 快速记录 -->
    <template v-else>
      <view class="card hero-card">
        <view class="section-head">
          <text class="hero-topline">Home / Active Cases</text>
          <text class="h1">优先追录新事件</text>
          <text class="hero-subtext">你已经有 {{ cases.length }} 个关系对象。先确认当前在追谁，再继续记录。</text>
        </view>

        <view class="case-kpis">
          <view class="kpi-item">
            <text class="kpi-label">对象</text>
            <view class="case-identity">
              <view class="profile-avatar sm">
                <image v-if="latestCase.profile?.avatar" :src="latestCase.profile.avatar" mode="aspectFill" />
                <text v-else class="avatar-placeholder">{{ avatarLabel(latestCase.name) }}</text>
              </view>
              <text class="kpi-value">{{ latestCase.name }}</text>
            </view>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">意向</text>
            <text class="kpi-value">{{ latestCase.latestResult?.intentScore ?? '--' }}</text>
            <text class="muted">{{ mapIntentLabel(latestCase.latestResult?.intentBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">风险</text>
            <text class="kpi-value">{{ latestCase.latestResult?.consistencyRiskScore ?? '--' }}</text>
            <text class="muted">{{ mapRiskLabel(latestCase.latestResult?.riskBucket) }}</text>
          </view>
          <view class="kpi-item">
            <text class="kpi-label">记录数量</text>
            <text class="kpi-value">{{ latestCase.timeline?.length ?? 0 }}</text>
            <text class="muted">时间线事件</text>
          </view>
        </view>

        <view v-if="latestProfileItems.length > 0" class="badges">
          <text v-for="item in latestProfileItems" :key="item" class="badge">{{ item }}</text>
        </view>

        <!-- 快速记录 -->
        <view class="quick-record-box">
          <text class="h3">一句话快速记录</text>
          <text class="muted">直接记到最近对象。</text>
          <textarea
            v-model="quickDesc"
            class="text-area"
            placeholder="例如：他今天主动约我吃饭，提前把时间地点都定好了。"
          />
          <view class="field">
            <text class="field-label">这句话主要在说谁</text>
            <view class="role-segments">
              <view
                v-for="item in subjectRoleOptions"
                :key="item.value"
                :class="['role-segment', quickSubjectRole === item.value ? 'active' : '']"
                @click="setQuickSubjectRole(item.value)"
              >
                {{ item.label }}
              </view>
            </view>
            <text class="muted">{{ quickSubjectRoleHint }}</text>
          </view>
          <view class="field">
            <text class="field-label">具体发生时间</text>
            <view class="datetime-row">
              <picker mode="date" :value="quickDate" @change="onQuickDateChange">
                <view class="picker-view">{{ quickDate }}</view>
              </picker>
              <picker mode="time" :value="quickTime" @change="onQuickTimeChange">
                <view class="picker-view">{{ quickTime }}</view>
              </picker>
            </view>
          </view>
          <view class="field">
            <text class="field-label">附件</text>
            <view class="actions attachment-actions">
              <button class="btn-secondary" :disabled="quickUploading" @click="chooseQuickImages">
                {{ quickUploading ? '上传中...' : '上传图片' }}
              </button>
              <button
                :class="['btn-secondary', recording ? 'recording' : '']"
                :disabled="voiceUploading"
                @click="toggleVoiceRecord"
              >
                {{ voiceButtonText }}
              </button>
            </view>
            <text v-if="voiceStatus" class="voice-status">{{ voiceStatus }}</text>
            <view v-if="quickAttachments.length > 0" class="attachment-list">
              <view
                v-for="(item, index) in quickAttachments"
                :key="item.fileID"
                class="attachment-item"
                @click="previewQuickAttachment(index)"
              >
                <text class="attachment-name">{{ item.name }}</text>
                <text class="attachment-link" selectable>{{ item.url || '授权链接生成中...' }}</text>
                <button class="link-button danger" @click.stop="removeQuickAttachment(index)">删除</button>
              </view>
            </view>
          </view>
          <view class="actions">
            <button class="btn-primary" :disabled="quickSubmitting" @click="submitQuickRecord">
              {{ quickSubmitting ? '保存中...' : '保存到最近对象' }}
            </button>
          </view>
          <view v-if="aiFeedbackLoading" class="ai-processing-bar">
            <view class="ai-processing-dot"></view>
            <text class="ai-processing-text">后台正在紧密分析中，已用时 {{ aiFeedbackSeconds }} 秒</text>
          </view>
        </view>

        <view
          v-if="showQuickFeedback && latestCase.latestResult && latestTrend"
          :class="['card', 'status-card', latestFeedbackEventType === 'risk' ? 'warning' : 'success']"
        >
          <text class="status-strong">已记录：{{ latestFeedbackTitle }}</text>
          <view class="quick-section">
            <view class="section-mini-head">
              <text class="mini-title">本次记录</text>
            </view>
            <text class="feedback-headline strong" user-select>{{ latestOriginalRecordText }}</text>
          </view>
          <view class="score-panel instant-score-panel">
            <view class="section-mini-head">
              <text class="mini-title">意向 / 风险</text>
              <text class="mini-sub">这次即时反馈的当前分数</text>
            </view>
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">意向</text>
                <text class="score-value">{{ clampScore(latestCase.latestResult.intentScore) }}</text>
                <text class="score-bucket">{{ mapIntentLabel(latestCase.latestResult.intentBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill intent-fill" :style="scoreFillStyle(latestCase.latestResult.intentScore, 'intent')"></view>
              </view>
            </view>
            <view class="score-row">
              <view class="score-head">
                <text class="score-label">风险</text>
                <text class="score-value">{{ clampScore(latestCase.latestResult.consistencyRiskScore) }}</text>
                <text class="score-bucket">{{ mapRiskLabel(latestCase.latestResult.riskBucket) }}</text>
              </view>
              <view class="score-track">
                <view class="score-fill risk-fill" :style="scoreFillStyle(latestCase.latestResult.consistencyRiskScore, 'risk')"></view>
              </view>
            </view>
          </view>
          <view class="instant-delta-panel">
            <view class="instant-delta-item">
              <text class="delta-label">意向变化</text>
              <text class="delta-value" :class="deltaClass(latestTrend.intentDelta)">{{ formatDelta(latestTrend.intentDelta) }}</text>
            </view>
            <view class="instant-delta-item">
              <text class="delta-label">风险变化</text>
              <text class="delta-value" :class="deltaClass(latestTrend.riskDelta)">{{ formatDelta(latestTrend.riskDelta) }}</text>
            </view>
          </view>
          <view v-if="quickReasonBullets.length > 0" class="quick-reason-panel">
            <view class="section-mini-head">
              <text class="mini-title">判断依据</text>
              <text class="mini-sub">为什么这次会这么判断</text>
            </view>
            <text v-for="reason in quickReasonBullets" :key="reason" class="quick-reason" user-select>• {{ reason }}</text>
          </view>
          <view v-if="latestStatusCard" class="quick-status-panel">
            <view class="section-mini-head">
              <view class="mini-title-row">
                <text class="mini-title">当前状态</text>
                <text class="info-icon" @click="statusInfoVisible = true">i</text>
              </view>
            </view>
            <view class="status-tag-groups">
              <view v-if="statusStateTags.length" class="status-tag-row">
                <view class="feedback-badges status-tags">
                  <text v-for="tag in statusStateTags" :key="tag" class="badge">{{ tag }}</text>
                </view>
              </view>
              <view v-if="problemTypeTags.length" class="status-tag-row">
                <text class="status-tag-title">问题类型</text>
                <view class="feedback-badges status-tags">
                  <text v-for="tag in problemTypeTags" :key="tag" class="badge muted-badge">{{ tag }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-if="latestActionPlanPanel.show" class="quick-guidance-panel">
            <text class="ai-panel-label">你接下来怎么做</text>
            <text v-if="latestActionPlanPanel.missing" class="raw-ai-reply-text muted" user-select>{{ latestActionPlanPanel.text }}</text>
            <view v-else>
              <view v-for="item in latestActionPlanPanel.sections" :key="item.label" class="guidance-item">
                <text class="guidance-label">{{ item.label }}</text>
                <text class="guidance-text" user-select>{{ item.text }}</text>
              </view>
            </view>
          </view>
          <view class="actions">
            <button class="btn-secondary" @click="goCaseDetail(latestCase.caseId)">查看当前主页</button>
          </view>
        </view>

        <view v-if="showSideReadEntry" class="card profile-side-card">
          <view class="section-mini-head">
            <text class="mini-title">{{ profileSideRead?.title || '侧写' }}</text>
            <text class="mini-sub">点击后单独生成</text>
          </view>
          <text v-if="profileSideRead" class="muted" user-select>{{ profileSideRead.summary }}</text>
          <text v-else class="muted">属相和星座侧写不再跟随记录自动生成，避免拖慢即时反馈。</text>
          <button v-if="!profileSideRead" class="btn-secondary side-read-generate-btn" :disabled="sideReadLoading" @click="generateLatestSideRead">
            {{ sideReadLoading ? '生成中...' : '生成属相星座侧写' }}
          </button>
          <view v-if="profileSideRead" class="side-read-grid">
            <view v-for="item in profileSideRead.sections" :key="item.label" class="side-read-item">
              <text class="side-read-label">{{ item.label }}</text>
              <text class="side-read-text" user-select>{{ item.text }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>

    <view v-if="statusInfoVisible" class="info-modal-mask" @click="statusInfoVisible = false">
      <view class="info-modal" @click.stop>
        <view class="info-modal-head">
          <view class="info-head-copy">
            <text class="info-modal-title">当前状态怎么看</text>
            <text class="info-modal-subtitle">这些标签走同一套规则口径，AI 只参与事件分析和变化量判断。</text>
          </view>
          <text class="info-modal-close" @click="statusInfoVisible = false">×</text>
        </view>
        <scroll-view scroll-y class="info-modal-body">
          <view v-if="latestStatusCard?.summary || latestStatusCard?.caution" class="info-section relation">
            <text class="info-section-title">这次状态说明</text>
            <text v-if="latestStatusCard?.summary" class="info-section-copy strong" user-select>{{ latestStatusCard.summary }}</text>
            <text v-if="latestStatusCard?.caution" class="info-section-copy" user-select>{{ latestStatusCard.caution }}</text>
          </view>
          <view class="info-section">
            <text class="info-section-title">状态标签</text>
            <text class="info-section-copy">从事件性质、阶段、状态、天气和证据强度几个角度看当前切面。</text>
            <view class="info-meaning-list">
              <view v-for="item in statusInfoStateItems" :key="`${item.group}-${item.tag}`" class="info-meaning-row">
                <text class="info-chip">{{ item.tag }}</text>
                <view class="info-meaning-copy-box">
                  <text class="info-meaning-title">{{ item.group }}</text>
                  <text class="info-meaning-copy">{{ item.description }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="info-section">
            <text class="info-section-title">问题类型</text>
            <text class="info-section-copy">这组标签只在命中结构性问题时出现，用来提醒你别被单次体感带偏。</text>
            <view class="info-meaning-list">
              <view v-for="item in statusInfoProblemItems" :key="item.tag" class="info-meaning-row">
                <text class="info-chip muted">{{ item.tag }}</text>
                <view class="info-meaning-copy-box">
                  <text class="info-meaning-title">问题类型</text>
                  <text class="info-meaning-copy">{{ item.description }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    </block>
    <!-- ==================== /经典版 ==================== -->

    <!-- ==================== 新首页 Campus Pop ==================== -->
    <block v-if="showV2">
      <view class="debug-banner">⚠️ CAMPUS POP V2 已激活 — 如果你看到这行字，说明新首页正在渲染</view>
      <template v-if="cases.length === 0">
        <view class="hero-block">
          <text class="hero-tag">SIGNAL BOARD</text>
          <text class="hero-title">先做一次<text class="hl">初次</text>评估</text>
          <text class="hero-copy">第一次进入时先完成一轮结构化问答。后续你更常做的动作会是补记录、看时间线和重新评估。</text>
        </view>
        <AssessmentForm @submit="onCreateCase" />
      </template>

      <template v-else>
        <!-- Hero -->
        <view class="hero-block">
          <text class="hero-tag">SIGNAL BOARD</text>
          <text class="hero-title">今天他<text class="hl">有戏</text>吗？</text>
          <view class="hero-identity"><view class="profile-avatar-v2 sm"><image v-if="latestCase.profile?.avatar" :src="latestCase.profile.avatar" mode="aspectFill" /><text v-else class="avatar-placeholder-v2">{{ avatarLabel(latestCase.name) }}</text></view><text class="hero-identity-name">{{ latestCase.name || '--' }}</text></view>
          <text class="hero-copy">别靠脑补，先把真实互动记下来。共 {{ cases.length }} 个对象。</text>
          <view class="kpi-strip">
            <view class="kpi-cell"><text class="kpi-num">{{ latestCase.latestResult?.intentScore ?? '--' }}</text><text class="kpi-lbl">意向分</text></view>
            <view class="kpi-cell"><text class="kpi-num">{{ latestCase.latestResult?.consistencyRiskScore ?? '--' }}</text><text class="kpi-lbl">风险分</text></view>
            <view class="kpi-cell"><text class="kpi-num">{{ latestCase.timeline?.length ?? 0 }}</text><text class="kpi-lbl">事件</text></view>
          </view>
          <view v-if="latestProfileItems.length > 0" class="tag-row">
            <text v-for="item in latestProfileItems" :key="item" class="tag">{{ item }}</text>
          </view>
        </view>

        <!-- Quick record -->
        <view class="record-block">
          <view class="block-head"><text class="block-title">快速记录</text><text class="block-badge">别脑补</text></view>
          <textarea v-model="quickDesc" class="text-area-v2" placeholder="他说下次一起去图书馆..." />
          <view class="role-row">
            <text class="role-label">这条主要在说</text>
            <view class="role-options">
              <view v-for="item in subjectRoleOptions" :key="item.value" :class="['role-chip', quickSubjectRole === item.value ? 'active' : '']" @click="setQuickSubjectRole(item.value)">{{ item.label }}</view>
            </view>
          </view>
          <text class="role-hint-v2">{{ quickSubjectRoleHint }}</text>
          <view class="datetime-row-v2">
            <picker mode="date" :value="quickDate" @change="onQuickDateChange"><view class="picker-v2">{{ quickDate }}</view></picker>
            <picker mode="time" :value="quickTime" @change="onQuickTimeChange"><view class="picker-v2">{{ quickTime }}</view></picker>
          </view>
          <view class="attach-row">
            <button class="btn-v2" :disabled="quickUploading" @click="chooseQuickImages">{{ quickUploading ? '上传中...' : '📎 图片' }}</button>
            <button :class="['btn-v2', recording ? 'recording' : '']" :disabled="voiceUploading" @click="toggleVoiceRecord">{{ voiceButtonText }}</button>
          </view>
          <text v-if="voiceStatus" class="voice-note">{{ voiceStatus }}</text>
          <view v-if="quickAttachments.length > 0" class="attach-list">
            <view v-for="(item, index) in quickAttachments" :key="item.fileID" class="attach-item" @click="previewQuickAttachment(index)">
              <text class="attach-name">{{ item.name }}</text>
              <button class="btn-del" @click.stop="removeQuickAttachment(index)">删除</button>
            </view>
          </view>
          <button class="btn-v2 primary" :disabled="quickSubmitting" @click="submitQuickRecord">{{ quickSubmitting ? '保存中...' : '记一笔' }}</button>
          <view v-if="aiFeedbackLoading" class="ai-bar"><view class="ai-dot"></view><text class="ai-text">后台分析中，已用时 {{ aiFeedbackSeconds }} 秒</text></view>
        </view>

        <!-- Feedback -->
        <view v-if="showQuickFeedback && latestCase.latestResult && latestTrend" :class="['feedback-block', latestFeedbackEventType === 'risk' ? 'warn' : 'ok']">
          <view class="block-head"><text class="block-title">本次判定</text><text class="block-badge black">{{ mapTimelineTypeLabel(latestFeedbackEventType) }}</text></view>
          <text class="feedback-desc">{{ latestOriginalRecordText }}</text>
          <view class="score-grid">
            <view class="score-item">
              <text class="score-label-v2">意向</text><text class="score-num-v2">{{ clampScore(latestCase.latestResult.intentScore) }}</text>
              <text class="score-bucket-v2">{{ mapIntentLabel(latestCase.latestResult?.intentBucket) }}</text>
              <view class="bar-track-v2"><view class="bar-fill-v2" :style="{ width: clampScore(latestCase.latestResult.intentScore) + '%' }"></view></view>
            </view>
            <view class="score-item">
              <text class="score-label-v2">风险</text><text class="score-num-v2 risk">{{ clampScore(latestCase.latestResult.consistencyRiskScore) }}</text>
              <text class="score-bucket-v2">{{ mapRiskLabel(latestCase.latestResult?.riskBucket) }}</text>
              <view class="bar-track-v2"><view class="bar-fill-v2 risk" :style="{ width: clampScore(latestCase.latestResult.consistencyRiskScore) + '%' }"></view></view>
            </view>
          </view>
          <view class="delta-row">
            <view class="delta-item"><text class="delta-label-v2">意向变化</text><text :class="['delta-val', deltaClass(latestTrend.intentDelta)]">{{ formatDelta(latestTrend.intentDelta) }}</text></view>
            <view class="delta-item"><text class="delta-label-v2">风险变化</text><text :class="['delta-val', deltaClass(latestTrend.riskDelta)]">{{ formatDelta(latestTrend.riskDelta) }}</text></view>
          </view>
          <view v-if="statusStateTags.length || problemTypeTags.length" class="tag-row" style="margin-top:12px;">
            <text v-for="tag in statusStateTags" :key="tag" class="tag black">{{ tag }}</text>
            <text v-for="tag in problemTypeTags" :key="tag" class="tag">{{ tag }}</text>
          </view>
          <view v-if="quickReasonBullets.length > 0" class="reason-box"><text v-for="reason in quickReasonBullets" :key="reason" class="reason-line">• {{ reason }}</text></view>
          <view v-if="latestActionPlanPanel.show" class="action-box">
            <text class="action-label">你接下来怎么做</text>
            <text v-if="latestActionPlanPanel.missing" class="action-text muted">{{ latestActionPlanPanel.text }}</text>
            <view v-else><view v-for="item in latestActionPlanPanel.sections" :key="item.label" class="action-item"><text class="action-item-label">{{ item.label }}</text><text class="action-item-text">{{ item.text }}</text></view></view>
          </view>
          <button class="btn-v2 outline" @click="goCaseDetail(latestCase.caseId)">查看完整主页</button>
          <view v-if="showSideReadEntry" class="side-box">
            <text class="side-title">{{ profileSideRead?.title || '侧写' }}</text>
            <text v-if="profileSideRead" class="side-text">{{ profileSideRead.summary }}</text>
            <view v-if="profileSideRead?.sections?.length" class="side-grid">
              <view v-for="item in profileSideRead.sections" :key="item.label" class="side-item">
                <text class="side-item-label">{{ item.label }}</text>
                <text class="side-item-text">{{ item.text }}</text>
              </view>
            </view>
            <button v-if="!profileSideRead" class="btn-v2 sm" :disabled="sideReadLoading" @click="generateLatestSideRead">{{ sideReadLoading ? '生成中...' : '生成属相星座侧写' }}</button>
          </view>
        </view>
      </template>

      <!-- Status info modal -->
      <view v-if="statusInfoVisible" class="info-mask" @click="statusInfoVisible = false">
        <view class="info-modal-v2" @click.stop>
          <view class="info-head-v2"><text class="info-title-v2">当前状态怎么看</text><text class="info-close" @click="statusInfoVisible = false">X</text></view>
          <scroll-view scroll-y class="info-body-v2">
            <view v-if="latestStatusCard?.summary || latestStatusCard?.caution" class="info-section-v2 ylw">
              <text class="info-sec-title">这次状态说明</text>
              <text v-if="latestStatusCard?.summary" class="info-sec-copy strong">{{ latestStatusCard.summary }}</text>
              <text v-if="latestStatusCard?.caution" class="info-sec-copy">{{ latestStatusCard.caution }}</text>
            </view>
            <view class="info-section-v2"><text class="info-sec-title">状态标签</text>
              <view v-for="item in statusInfoStateItems" :key="`${item.group}-${item.tag}`" class="info-tag-row"><text class="info-chip">{{ item.tag }}</text><view class="info-chip-copy"><text class="info-chip-title">{{ item.group }}</text><text class="info-chip-desc">{{ item.description }}</text></view></view>
            </view>
            <view class="info-section-v2"><text class="info-sec-title">问题类型</text>
              <view v-for="item in statusInfoProblemItems" :key="item.tag" class="info-tag-row"><text class="info-chip muted">{{ item.tag }}</text><view class="info-chip-copy"><text class="info-chip-title">问题类型</text><text class="info-chip-desc">{{ item.description }}</text></view></view>
            </view>
          </scroll-view>
        </view>
      </view>
    </block>
    <!-- ==================== /新首页 ==================== -->
    </block>
    <!-- ==================== /v-else ==================== -->

  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onHide, onShareAppMessage, onShareTimeline, onShow, onUnload } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import { getCases, createCase, createTimeline, analyzeAttachment, generateAssessmentAI, generateSideRead, getCachedSelfProfile, getCurrentUserId, getSelfProfile, getTempFileURL, speechToText, uploadFile } from '@/utils/api'
import { combineDateAndTimeToISOString, getActiveCaseId, getDateInputValue, getTimeInputValue, setActiveCaseId, showError, showSuccess } from '@/utils/helpers'
import { buildProfileItems, compareAssessments, buildObjectStatusCard, explainProblemLabel, explainStatusTag } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const showV2 = ref(true)
const themeVars = ref(getThemeStyle())
const loading = ref(true)
const cases = ref<any[]>([])
const userId = ref('')
const activeCaseId = ref('')
const selfProfile = ref<any>(getCachedSelfProfile())
const quickDesc = ref('')
const quickDate = ref(getDateInputValue())
const quickTime = ref(getTimeInputValue())
const quickSubmitting = ref(false)
const quickUploading = ref(false)
const voiceUploading = ref(false)
const recording = ref(false)
const voiceStatus = ref('')
const sideReadLoading = ref(false)
const aiFeedbackLoading = ref(false)
const aiFeedbackSeconds = ref(0)
const statusInfoVisible = ref(false)
let aiFeedbackTimer: any = null
const generatedSideRead = ref<any>(null)
const quickSubjectRole = ref<'target' | 'self' | 'both'>('target')
const quickSubjectRoleConfidence = ref<'auto' | 'user_selected'>('auto')
const quickAttachments = ref<any[]>([])
const quickFeedback = ref<{ caseId: string; eventType: string } | null>(null)
let recorderManager: any = null
let recordStartedAt = 0

const subjectRoleOptions = [
  { value: 'target', label: '对方' },
  { value: 'self', label: '自己' },
  { value: 'both', label: '互动' }
] as const

const latestCase = computed(() => {
  const active = activeCaseId.value
  if (active) {
    const matched = cases.value.find((item: any) => item.caseId === active || item._id === active)
    if (matched) return matched
  }
  return cases.value[0] || {} as any
})

const latestProfileItems = computed(() => {
  const p = latestCase.value?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.occupation) items.push(p.occupation)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  return items
})

const latestTriggerEvent = computed(() => {
  const triggerEventId = latestCase.value?.latestResult?.triggerEventId
  if (!triggerEventId) return null
  return latestCase.value?.timeline?.find((item: any) => (item.id || item._id) === triggerEventId) || null
})

const latestFeedbackEventType = computed(() => {
  return latestTriggerEvent.value?.type || latestCase.value?.latestResult?.triggerEventType || 'note'
})

const latestFeedbackTitle = computed(() => {
  return latestTriggerEvent.value?.title || latestCase.value?.latestResult?.triggerEventTitle || '最新记录'
})

const latestOriginalRecordText = computed(() => {
  const description = String(latestTriggerEvent.value?.description || '').trim()
  if (description) return description
  return latestFeedbackTitle.value
})

const latestResultKey = computed(() => {
  return latestCase.value?.latestResult?._id
    || latestCase.value?.latestResult?.assessmentId
    || latestCase.value?.latestResultId
    || ''
})

const latestTrend = computed(() => {
  if (!latestCase.value?.latestResult || !latestCase.value?.assessments?.length) return null
  const previous = latestCase.value.assessments.length > 1
    ? latestCase.value.assessments[latestCase.value.assessments.length - 2]
    : null
  return compareAssessments(previous, latestCase.value.latestResult)
})

const latestStatusCard = computed(() => {
  if (!latestCase.value?.latestResult) return null
  return buildObjectStatusCard({
    ...latestCase.value,
    timeline: latestCase.value.timeline || [],
    assessments: latestCase.value.assessments || [latestCase.value.latestResult]
  })
})

const latestRawReply = computed(() => {
  return String(latestCase.value?.latestResult?.rawReply || '').trim()
})

function parseRawReplySections(text: string) {
  const source = String(text || '').trim()
  if (!source) return []
  const labels = ['对方可能的心理', '你下一步怎么做', '重点观察什么']
  const normalized = source
    .replace(/\r/g, '')
    .replace(/(对方可能的心理|你下一步怎么做|重点观察什么)\s*[：:]/g, '\n$1：')
    .trim()
  const sections = labels.map((label, index) => {
    const start = normalized.indexOf(`${label}：`)
    if (start < 0) return null
    const contentStart = start + label.length + 1
    const nextStarts = labels
      .slice(index + 1)
      .map((nextLabel) => normalized.indexOf(`${nextLabel}：`, contentStart))
      .filter((pos) => pos >= 0)
    const end = nextStarts.length ? Math.min(...nextStarts) : normalized.length
    const text = normalized.slice(contentStart, end).replace(/^\s+|\s+$/g, '')
    return text ? { label, text } : null
  }).filter(Boolean) as Array<{ label: string; text: string }>
  return sections.length ? sections : [{ label: '回复建议', text: source }]
}

const latestActionPlanPanel = computed(() => {
  if (latestCase.value?.latestResult?.aiPending) {
    return { show: true, text: 'AI 正在生成即时反馈。', missing: true, sections: [] }
  }
  if (latestRawReply.value) {
    return { show: true, text: latestRawReply.value, missing: false, sections: parseRawReplySections(latestRawReply.value) }
  }
  if (showQuickFeedback.value && latestCase.value?.latestResult?.source === 'event_recalculation') {
    return {
      show: true,
      text: latestCase.value.latestResult.aiFailed
        ? '这次 AI 返回超时或格式不完整，系统先用了规则兜底。'
        : latestCase.value.latestResult.aiUsed === false
          ? '这次 AI 原文回复没有生成，系统先用了规则兜底。'
        : '这次 AI 原文回复没有返回，下面先显示结构化建议。',
      missing: true,
      sections: []
    }
  }
  return { show: false, text: '', missing: false, sections: [] }
})

function startAIFeedbackTimer() {
  stopAIFeedbackTimer()
  aiFeedbackSeconds.value = 0
  aiFeedbackTimer = setInterval(() => {
    aiFeedbackSeconds.value += 1
  }, 1000)
}

function stopAIFeedbackTimer() {
  if (aiFeedbackTimer) {
    clearInterval(aiFeedbackTimer)
    aiFeedbackTimer = null
  }
}

const quickReasonBullets = computed(() => {
  const bullets = latestCase.value?.latestResult?.explanation?.bullets
  return Array.isArray(bullets) ? bullets.slice(0, 3) : []
})

const statusStateTags = computed(() => {
  if (!latestCase.value?.latestResult) return []
  const tags = [
    mapTimelineTypeLabel(latestFeedbackEventType.value),
    ...(Array.isArray(latestStatusCard.value?.tags) ? latestStatusCard.value.tags : [])
  ]
  return [...new Set(tags.filter(Boolean))].slice(0, 5)
})

const problemTypeTags = computed(() => {
  const labels = latestCase.value?.latestResult?.primaryLabels
  const list = Array.isArray(labels) ? labels.filter(Boolean).slice(0, 4) : []
  return list.length ? list : ['暂无突出问题']
})

const statusInfoStateItems = computed(() => {
  return statusStateTags.value.map((tag) => explainStatusTag(tag))
})

const statusInfoProblemItems = computed(() => {
  return problemTypeTags.value.map((tag) => explainProblemLabel(tag))
})

const profileSideRead = computed(() => {
  if (generatedSideRead.value) return generatedSideRead.value
  const aiSideRead = latestCase.value?.latestResult?.sideReadAdvice
  if (aiSideRead?.summary || aiSideRead?.sections?.length) return aiSideRead
  return null
})

const showSideReadEntry = computed(() => {
  if (!latestCase.value?.latestResult) return false
  if (profileSideRead.value) return true
  return Boolean(
    latestCase.value?.profile?.zodiac
    || latestCase.value?.profile?.constellation
    || selfProfile.value?.zodiac
    || selfProfile.value?.constellation
  )
})

const quickSubjectRoleHint = computed(() => {
  const label = mapSubjectRoleLabel(quickSubjectRole.value)
  if (quickSubjectRoleConfidence.value === 'user_selected') return `已手动设为：${label}。`
  if (quickSubjectRole.value === 'self') return 'AI 判断这更像你的心理感受或自我状态，已归为“自己”。'
  if (quickSubjectRole.value === 'both') return 'AI 判断这更像双方互动，建议重点区分谁主动、谁回应、谁拒绝。'
  return '默认按“对方”记录；如果写的是你的心理感受，请改为“自己”。'
})

const voiceButtonText = computed(() => {
  if (voiceUploading.value) return '识别中...'
  if (recording.value) return '结束录音'
  return '语音录入'
})

const showQuickFeedback = computed(() => {
  return Boolean(
    latestCase.value?.latestResult
    && latestTrend.value
  )
})

watch(quickDesc, (value) => {
  if (quickSubjectRoleConfidence.value === 'user_selected') return
  quickSubjectRole.value = inferSubjectRole(value)
})

watch(latestResultKey, () => {
  generatedSideRead.value = null
})

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

function mapTimelineTypeLabel(type?: string) {
  switch (type) {
    case 'positive': return '推进事件'
    case 'risk': return '风险事件'
    case 'verification': return '验证事件'
    case 'note': return '普通记录'
    default: return '关系记录'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'verify':
    case 'insufficient_data': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    default: return '先做验证'
  }
}

function mapSubjectRoleLabel(role?: string) {
  switch (role) {
    case 'self': return '自己'
    case 'both': return '互动'
    case 'target': return '对方'
    default: return '对方'
  }
}

function inferSubjectRole(value?: string): 'target' | 'self' | 'both' {
  const text = String(value || '').trim()
  if (!text) return 'target'
  const hasSelf = /(我|我们|本人|自己|这边)/.test(text)
  const hasTarget = /(他|她|对方|对象|男生|女生|ta|TA)/i.test(text)
  const hasInteraction = /(一起|互相|聊天|见面|约|吃饭|看电影|通话|视频|见了|碰面|散步|出游|互动)/.test(text)
  const selfFeeling = /(我.*(感觉|觉得|感到|心理|心里|焦虑|难受|失落|开心|期待|害怕|纠结|想他|想她|想对方|放不下|不安|委屈|生气|吃醋)|自己.*(状态|感受|情绪|心理|心里))/.test(text)
  if ((hasSelf && hasTarget) || hasInteraction) return 'both'
  if (selfFeeling) return 'self'
  if (hasSelf) return 'self'
  return 'target'
}

function setQuickSubjectRole(role: 'target' | 'self' | 'both') {
  quickSubjectRole.value = role
  quickSubjectRoleConfidence.value = 'user_selected'
}

function mapConfidenceLabel(level?: string) {
  switch (level) {
    case 'low': return '低'
    case 'medium': return '中'
    case 'high': return '高'
    default: return level || '--'
  }
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function scoreFillStyle(score: any, kind: 'intent' | 'risk') {
  const value = clampScore(score)
  const alpha = 0.18 + (value / 100) * 0.72
  const background = kind === 'risk'
    ? `linear-gradient(90deg, rgba(184, 74, 58, ${alpha}), rgba(126, 43, 35, ${alpha}))`
    : `linear-gradient(90deg, rgba(53, 111, 96, ${alpha}), rgba(18, 60, 54, ${alpha}))`
  return { width: `${value}%`, background }
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '持平'
}

function deltaClass(delta: number) {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function formatFocusPrompt(value?: string) {
  return String(value || '')
    .replace(/^本次重点记录[:：]?\s*/, '')
    .replace(/^下一次重点记录[:：]?\s*/, '')
    .replace(/^下一次最值得记录的是[:：]?\s*/, '')
    .trim()
}

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  activeCaseId.value = getActiveCaseId()
  loadData()
})

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())

onHide(() => {
  if (recording.value && recorderManager?.stop) recorderManager.stop()
  stopAIFeedbackTimer()
  statusInfoVisible.value = false
})

onUnload(() => {
  if (recording.value && recorderManager?.stop) recorderManager.stop()
  stopAIFeedbackTimer()
  statusInfoVisible.value = false
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
    const [list, profileRes] = await Promise.all([
      getCases(uid),
      getSelfProfile().catch(() => null)
    ])
    if (profileRes?.success) selfProfile.value = profileRes.selfProfile
    const normalizedCases = (list || []).map((c: any) => ({ ...c, caseId: c.caseId || c._id }))
    cases.value = normalizedCases
    const storedActiveCaseId = getActiveCaseId()
    const activeExists = Boolean(storedActiveCaseId && normalizedCases.some((item: any) => item.caseId === storedActiveCaseId || item._id === storedActiveCaseId))
    if (activeExists) {
      activeCaseId.value = storedActiveCaseId
    } else {
      const firstCaseId = normalizedCases[0]?.caseId || ''
      activeCaseId.value = firstCaseId
      if (firstCaseId) setActiveCaseId(firstCaseId)
    }
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onCreateCase(payload: { name: string; answers: any[]; profile: any }) {
  uni.showLoading({ title: '创建中...' })
  try {
    const res = await createCase({
      userId: userId.value,
      name: payload.name,
      answers: payload.answers,
      profile: payload.profile
    })
    uni.hideLoading()
    if (res.success) {
      showSuccess('已创建')
      const caseId = res.caseId || res.case?.caseId
      if (caseId) {
        setActiveCaseId(caseId)
        activeCaseId.value = caseId
        uni.switchTab({ url: '/pages/case-detail/case-detail' })
      } else {
        await loadData()
      }
    } else {
      showError(res.message || '创建失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    showError(e?.message || '创建失败')
  }
}

function onQuickDateChange(e: any) {
  quickDate.value = e.detail.value
}

function onQuickTimeChange(e: any) {
  quickTime.value = e.detail.value
}

function getFileName(filePath: string, fallback: string) {
  const clean = String(filePath || '').split('?')[0]
  return clean.split('/').pop() || fallback
}

function buildQuickCloudPath(filePath: string, index: number) {
  const ext = getFileName(filePath, '').split('.').pop() || 'jpg'
  return `timeline/${userId.value || 'user'}/${Date.now()}-${index}.${ext}`
}

function buildVoiceCloudPath(filePath: string) {
  const ext = getFileName(filePath, '').split('.').pop() || 'mp3'
  return `speech/${userId.value || 'user'}/${Date.now()}.${ext}`
}

function appendRecognizedText(text: string) {
  const normalized = String(text || '').trim()
  if (!normalized) return
  quickDesc.value = quickDesc.value.trim()
    ? `${quickDesc.value.trim()}\n${normalized}`
    : normalized
}

function getRecorderManager() {
  // #ifdef MP-WEIXIN
  const wxApi = typeof wx !== 'undefined' ? wx : null
  const managerFactory = typeof uni.getRecorderManager === 'function'
    ? () => uni.getRecorderManager()
    : wxApi?.getRecorderManager
      ? () => wxApi.getRecorderManager()
      : null
  if (!managerFactory) return null
  if (!recorderManager) {
    recorderManager = managerFactory()
    recorderManager.onStart(() => {
      recording.value = true
      recordStartedAt = Date.now()
      voiceStatus.value = '正在录音，再点一次结束'
    })
    recorderManager.onStop((res: any = {}) => {
      recording.value = false
      handleVoiceRecordStop(res)
    })
    recorderManager.onError((error: any = {}) => {
      recording.value = false
      voiceUploading.value = false
      voiceStatus.value = ''
      showError(formatRecorderError(error?.errMsg || error?.message))
    })
  }
  return recorderManager
  // #endif
  // #ifndef MP-WEIXIN
  return null
  // #endif
}

function formatRecorderError(message?: string) {
  const text = String(message || '').toLowerCase()
  if (text.includes('notfounderror') || text.includes('not found')) {
    return '没有检测到可用麦克风。微信开发者工具常见此问题，请用真机预览测试，或检查电脑/微信开发者工具麦克风权限。'
  }
  if (text.includes('permission') || text.includes('auth')) {
    return '录音权限未开启，请在小程序设置里允许麦克风权限。'
  }
  if (text.includes('not supported')) {
    return '当前设备或微信版本不支持录音，请换真机微信环境测试。'
  }
  return message || '录音失败'
}

function requestRecordPermission() {
  return new Promise<void>((resolve, reject) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => resolve(),
      fail: () => {
        uni.showModal({
          title: '需要麦克风权限',
          content: '语音录入需要使用麦克风，请在设置中允许录音权限。',
          confirmText: '去设置',
          success: (modalRes: any = {}) => {
            if (!modalRes?.confirm) {
              reject(new Error('未授权录音权限'))
              return
            }
            uni.openSetting({
              success: (settingRes: any = {}) => {
                if (settingRes?.authSetting?.['scope.record']) resolve()
                else reject(new Error('未授权录音权限'))
              },
              fail: () => reject(new Error('无法打开权限设置'))
            })
          }
        })
      }
    })
  })
}

async function toggleVoiceRecord() {
  if (voiceUploading.value) return
  const manager = getRecorderManager()
  if (!manager) {
    showError('当前环境不支持微信原生录音')
    return
  }
  if (recording.value) {
    manager.stop()
    return
  }
  try {
    await requestRecordPermission()
    voiceStatus.value = '准备录音...'
    manager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    })
  } catch (error: any) {
    voiceStatus.value = ''
    showError(error?.message || '录音权限获取失败')
  }
}

async function handleVoiceRecordStop(res: any) {
  const tempFilePath = res?.tempFilePath
  const durationMs = Number(res?.duration || (recordStartedAt ? Date.now() - recordStartedAt : 0))
  recordStartedAt = 0
  if (!tempFilePath) {
    voiceStatus.value = ''
    showError('没有拿到录音文件')
    return
  }
  if (durationMs < 800) {
    voiceStatus.value = ''
    showError('录音太短')
    return
  }

  voiceUploading.value = true
  voiceStatus.value = '正在上传并识别...'
  try {
    const fileID = await uploadFile(tempFilePath, buildVoiceCloudPath(tempFilePath))
    const result = await speechToText({
      fileID,
      fileName: getFileName(tempFilePath, 'voice.mp3'),
      durationMs
    })
    if (!result?.success) {
      showError(result?.message || '语音识别失败')
      return
    }
    appendRecognizedText(result.text)
    voiceStatus.value = '已识别并填入输入框'
  } catch (error: any) {
    voiceStatus.value = ''
    showError(error?.message || '语音识别失败')
  } finally {
    voiceUploading.value = false
  }
}

async function chooseQuickImages() {
  if (quickUploading.value) return
  const remain = Math.max(0, 6 - quickAttachments.value.length)
  if (remain === 0) {
    showError('最多上传 6 张图片')
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res: any = {}) => {
      const files = res?.tempFiles || []
      if (!files.length) return
      quickUploading.value = true
      uni.showLoading({ title: '上传图片...' })
      try {
        const uploaded = []
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i]
          const filePath = file.path || file.tempFilePath
          if (!filePath) continue
          const fileID = await uploadFile(filePath, buildQuickCloudPath(filePath, i))
          const analysisRes = await analyzeAttachment({ fileID, mediaType: 'image' }).catch(() => null)
          const url = await getTempFileURL(fileID).catch(() => '')
          uploaded.push({
            type: 'image',
            fileID,
            name: getFileName(filePath, `图片${quickAttachments.value.length + uploaded.length + 1}`),
            size: file.size || 0,
            url,
            analysis: analysisRes?.success ? analysisRes.analysis : undefined
          })
        }
        quickAttachments.value = [...quickAttachments.value, ...uploaded]
      } catch (error: any) {
        showError(error?.message || '图片上传失败')
      } finally {
        uni.hideLoading()
        quickUploading.value = false
      }
    }
  })
}

function removeQuickAttachment(index: number) {
  quickAttachments.value = quickAttachments.value.filter((_, i) => i !== index)
}

async function previewQuickAttachment(index = 0) {
  const urls = quickAttachments.value.map((item: any) => item.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

async function submitQuickRecord() {
  if (quickSubmitting.value) return
  if (!quickDesc.value.trim()) {
    showError('请填写描述')
    return
  }
  if (!latestCase.value?.caseId) return
  quickSubmitting.value = true
  try {
    const desc = quickDesc.value.trim()
    const currentCaseId = latestCase.value.caseId
    const res = await createTimeline({
      userId: userId.value,
      caseId: currentCaseId,
      description: desc,
      subjectRole: quickSubjectRole.value,
      subjectRoleConfidence: quickSubjectRoleConfidence.value === 'user_selected' ? 'user_selected' : 'confirmed',
      attachments: quickAttachments.value.map(({ url: _url, ...item }: any) => item),
      occurrenceAt: combineDateAndTimeToISOString(quickDate.value, quickTime.value)
    })
    if (res.success) {
      showSuccess('已记录，AI分析中')
      quickDesc.value = ''
      quickSubjectRole.value = 'target'
      quickSubjectRoleConfidence.value = 'auto'
      quickAttachments.value = []
      generatedSideRead.value = null
      quickDate.value = getDateInputValue()
      quickTime.value = getTimeInputValue()
      quickFeedback.value = {
        caseId: currentCaseId,
        eventType: res.eventType || latestCase.value?.latestResult?.triggerEventType || 'note'
      }
      if (res.aiPending && res.assessmentId) {
        runAssessmentAI({
          caseId: currentCaseId,
          assessmentId: res.assessmentId,
          recordId: res.recordId
        })
      } else {
        await loadData()
      }
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    showError(e?.message || '保存失败')
  } finally {
    quickSubmitting.value = false
  }
}

async function runAssessmentAI(payload: { caseId: string; assessmentId: string; recordId?: string }) {
  aiFeedbackLoading.value = true
  startAIFeedbackTimer()
  try {
    const aiRes = await generateAssessmentAI(payload)
    if (!aiRes?.success) {
      showError(aiRes?.message || 'AI即时反馈生成失败')
      return
    }
    await loadData()
    showSuccess('AI即时反馈已更新')
  } catch (error: any) {
    showError(error?.message || 'AI即时反馈生成失败')
  } finally {
    aiFeedbackLoading.value = false
    stopAIFeedbackTimer()
  }
}

async function generateLatestSideRead() {
  if (sideReadLoading.value) return
  const caseId = latestCase.value?.caseId
  if (!caseId) return
  sideReadLoading.value = true
  try {
    const res = await generateSideRead({ caseId })
    if (!res?.success) {
      showError(res?.message || '侧写生成失败')
      return
    }
    generatedSideRead.value = res.sideReadAdvice
    if (latestCase.value?.latestResult) {
      latestCase.value.latestResult.sideReadAdvice = res.sideReadAdvice
    }
    showSuccess('侧写已生成')
  } catch (error: any) {
    showError(error?.message || '侧写生成失败')
  } finally {
    sideReadLoading.value = false
  }
}

function goCaseDetail(caseId: string) {
  setActiveCaseId(caseId)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}
</script>

<style scoped>
/* ===== Version Toggle ===== */
.debug-classic { background: #e8f5e9; border: 2rpx solid #2e7d32; padding: 6rpx 12rpx; font-size: 20rpx; color: #2e7d32; margin-bottom: 10rpx; }

.version-toggle {
  display: flex; gap: 0; margin-bottom: 18rpx;
  border: 3rpx solid #111; overflow: hidden; background: #fff;
}
.toggle-tab {
  flex: 1; text-align: center; padding: 14rpx 0;
  font-size: 26rpx; font-weight: 700; color: #999;
}
.toggle-tab.active {
  background: #111; color: #FFD93D; font-weight: 900;
}

/* ===== CAMPUS POP V2 Styles ===== */
.v2-mode { background: var(--app-bg, #FFFDF5) !important; }
.v2-mode .loading { text-align: center; padding: 120rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .debug-banner { background: #FFD93D; border: 4rpx solid #111; padding: 12rpx; text-align: center; font-size: 24rpx; font-weight: 900; color: #111; margin-bottom: 16rpx; }

.v2-mode .hero-block {
  background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111;
  padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg);
}
.v2-mode .hero-tag { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hero-title .hl { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-identity { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; }
.v2-mode .profile-avatar-v2 { border-radius: 50%; overflow: hidden; border: 3rpx solid #111; background: #FFD93D; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.v2-mode .profile-avatar-v2.sm { width: 68rpx; height: 68rpx; }
.v2-mode .profile-avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .hero-identity-name { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .role-hint-v2 { display: block; margin-top: 8rpx; font-size: 20rpx; font-weight: 600; color: #999; }

.v2-mode .hero-copy { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .hero-copy .strong { color: #111; font-weight: 900; }

.v2-mode .kpi-strip { display: flex; margin-top: 24rpx; border: 3rpx solid #111; background: #fff; }
.v2-mode .kpi-cell { flex: 1; text-align: center; padding: 20rpx 8rpx; border-right: 3rpx solid #111; }
.v2-mode .kpi-cell:last-child { border-right: none; }
.v2-mode .kpi-num { display: block; font-size: 44rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .kpi-lbl { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 6rpx; text-transform: uppercase; letter-spacing: 2rpx; }

.v2-mode .tag-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.v2-mode .tag { display: inline-flex; align-items: center; min-height: 40rpx; padding: 6rpx 16rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .tag.black { background: #111; color: #fff; }

.v2-mode .record-block { background: #E6E6FA; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }
.v2-mode .block-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.v2-mode .block-title { font-size: 32rpx; font-weight: 900; color: #111; text-transform: uppercase; }
.v2-mode .block-badge { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 900; color: #111; letter-spacing: 2rpx; }
.v2-mode .block-badge.black { background: #111; color: #fff; }

.v2-mode .text-area-v2 { width: 100%; min-height: 140rpx; padding: 18rpx; background: #fff; border: 3rpx solid #111; font-size: 26rpx; font-weight: 600; color: #111; box-sizing: border-box; font-family: inherit; }

.v2-mode .role-row { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; }
.v2-mode .role-label { font-size: 22rpx; font-weight: 700; color: #666; }
.v2-mode .role-options { display: flex; gap: 8rpx; }
.v2-mode .role-chip { padding: 8rpx 18rpx; border: 2rpx solid #111; background: #fff; font-size: 22rpx; font-weight: 700; color: #666; }
.v2-mode .role-chip.active { background: #111; color: #fff; }

.v2-mode .datetime-row-v2 { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .picker-v2 { padding: 12rpx 20rpx; border: 2rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 700; color: #111; }

.v2-mode .attach-row { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .voice-note { display: block; margin-top: 12rpx; font-size: 22rpx; font-weight: 700; color: #666; }
.v2-mode .attach-list { display: flex; flex-direction: column; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .attach-item { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 18rpx; border: 2rpx solid #111; background: #fff; font-size: 22rpx; font-weight: 700; }
.v2-mode .attach-name { color: #111; }
.v2-mode .btn-del { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #fff; font-size: 20rpx; font-weight: 700; color: #FF5252; }

.v2-mode .btn-v2 { flex: 1; height: 72rpx; line-height: 72rpx; text-align: center; background: #fff; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; box-sizing: border-box; padding: 0 24rpx; }
.v2-mode .btn-v2.primary { background: #4ECDC4; box-shadow: 6rpx 6rpx 0 #111; margin-top: 16rpx; width: 100%; }
.v2-mode .btn-v2.outline { margin-top: 20rpx; width: 100%; }
.v2-mode .btn-v2.sm { width: 100%; margin-top: 14rpx; height: 60rpx; line-height: 60rpx; font-size: 24rpx; }
.v2-mode .btn-v2.recording { background: #FF6B6B; color: #fff; }
.v2-mode .btn-v2[disabled] { opacity: 0.6; }

.v2-mode .ai-bar { display: flex; align-items: center; gap: 14rpx; margin-top: 16rpx; padding: 16rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .ai-dot { width: 20rpx; height: 20rpx; border: 2rpx solid #111; background: #FFD93D; }

.v2-mode .feedback-block { background: #fff; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }
.v2-mode .feedback-block.ok { border-left: 12rpx solid #4ECDC4; }
.v2-mode .feedback-block.warn { border-left: 12rpx solid #FF6B6B; }
.v2-mode .feedback-desc { display: block; font-size: 26rpx; font-weight: 700; color: #111; line-height: 1.5; margin-bottom: 16rpx; }

.v2-mode .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 14rpx; }
.v2-mode .score-item { padding: 20rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .score-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .score-num-v2 { display: block; font-size: 56rpx; font-weight: 900; color: #111; line-height: 1; margin-top: 6rpx; }
.v2-mode .score-num-v2.risk { color: #FF5252; }
.v2-mode .score-bucket-v2 { display: block; font-size: 20rpx; font-weight: 700; color: #999; margin-top: 4rpx; }
.v2-mode .bar-track-v2 { height: 12rpx; background: #e8e8e8; margin-top: 12rpx; border: 2rpx solid #ccc; }
.v2-mode .bar-fill-v2 { height: 12rpx; background: #111; }
.v2-mode .bar-fill-v2.risk { background: #FF5252; }

.v2-mode .delta-row { display: flex; gap: 10rpx; margin-top: 14rpx; }
.v2-mode .delta-item { flex: 1; padding: 18rpx; border: 2rpx solid #111; text-align: center; background: #fff; }
.v2-mode .delta-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .delta-val { display: block; font-size: 40rpx; font-weight: 900; color: #111; margin-top: 6rpx; }
.v2-mode .delta-val.up { color: #4ECDC4; }
.v2-mode .delta-val.down { color: #FF5252; }
.v2-mode .delta-val.flat { color: #999; }

.v2-mode .reason-box { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .reason-line { display: block; font-size: 24rpx; font-weight: 600; color: #111; line-height: 1.6; }

.v2-mode .action-box { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #f5f5ff; }
.v2-mode .action-label { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 12rpx; }
.v2-mode .action-text { font-size: 24rpx; color: #666; line-height: 1.5; }
.v2-mode .action-text.muted { color: #999; }
.v2-mode .action-item { padding: 14rpx; border: 2rpx solid #111; background: #fff; margin-top: 10rpx; }
.v2-mode .action-item-label { display: block; font-size: 22rpx; font-weight: 900; color: #111; }
.v2-mode .action-item-text { display: block; font-size: 24rpx; color: #555; margin-top: 6rpx; line-height: 1.5; }

.v2-mode .side-box { margin-top: 20rpx; padding: 18rpx; border: 2rpx dashed #111; background: #FFFBEB; }
.v2-mode .side-title { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }
.v2-mode .side-text { display: block; font-size: 24rpx; color: #555; line-height: 1.5; }
.v2-mode .side-grid { display: flex; flex-direction: column; gap: 10rpx; margin-top: 12rpx; }
.v2-mode .side-item { padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .side-item-label { display: block; font-size: 20rpx; font-weight: 900; color: #111; margin-bottom: 4rpx; }
.v2-mode .side-item-text { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; }

.v2-mode .info-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; }
.v2-mode .info-modal-v2 { width: 100%; max-height: 80vh; overflow: hidden; background: #fff; border: 3rpx solid #111; box-shadow: 10rpx 10rpx 0 #111; }
.v2-mode .info-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 3rpx solid #111; }
.v2-mode .info-title-v2 { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .info-close { width: 48rpx; height: 48rpx; line-height: 46rpx; text-align: center; border: 2rpx solid #111; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .info-body-v2 { max-height: 60vh; padding: 20rpx 24rpx 24rpx; box-sizing: border-box; }
.v2-mode .info-section-v2 { padding: 20rpx; border: 2rpx solid #111; margin-top: 16rpx; }
.v2-mode .info-section-v2.ylw { background: #FFFBEB; }
.v2-mode .info-sec-title { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }
.v2-mode .info-sec-copy { display: block; font-size: 22rpx; color: #555; line-height: 1.6; margin-top: 6rpx; }
.v2-mode .info-sec-copy.strong { font-weight: 700; color: #111; }
.v2-mode .info-tag-row { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; border-top: 2rpx solid #e8e8e8; }
.v2-mode .info-chip { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip.muted { background: #e8e8e8; }
.v2-mode .info-chip-copy { flex: 1; }
.v2-mode .info-chip-title { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip-desc { display: block; font-size: 20rpx; color: #666; line-height: 1.5; margin-top: 4rpx; }

.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}
.loading {
  text-align: center;
  padding: 80rpx 0;
  color: var(--text-muted, #786857);
}
.card {
  background: var(--card-bg, #fbf6ee);
  border-radius: var(--radius-md, 20rpx);
  padding: var(--spacing-card, 32rpx);
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-md, 0 2rpx 8rpx rgba(0,0,0,0.04));
}
.hero-card {
  background: linear-gradient(var(--hero-gradient-angle, 135deg), var(--hero-bg, #fbf6ee) 0%, var(--hero-bg-2, #f4ede2) 100%);
  box-shadow: var(--shadow-hero, none);
}
.hero-topline {
  display: block;
  font-size: 22rpx;
  color: var(--primary-2, #786857);
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin-bottom: 8rpx;
}
.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: var(--font-weight-hero, 700);
  color: var(--primary, #143f3a);
  margin: 8rpx 0;
  line-height: var(--text-line-height-heading, 1.3);
}
.h2 {
  display: block;
  font-size: 32rpx;
  font-weight: var(--font-weight-strong, 600);
  color: var(--text-main, #241b12);
  margin-bottom: 12rpx;
  line-height: var(--text-line-height-heading, 1.35);
}
.h3 {
  display: block;
  font-size: 28rpx;
  font-weight: var(--font-weight-strong, 600);
  color: var(--text-main, #241b12);
  line-height: var(--text-line-height-heading, 1.35);
}
.hero-subtext {
  display: block;
  font-size: 26rpx;
  color: var(--primary-2, #786857);
  line-height: var(--text-line-height, 1.6);
  margin-top: 8rpx;
}
.muted {
  display: block;
  font-size: 24rpx;
  color: var(--text-muted, #786857);
  margin: 6rpx 0;
  line-height: var(--text-line-height, 1.55);
}
.section-head { margin-bottom: 18rpx; }
.case-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}
.kpi-item {
  flex: 1 1 40%;
  background: var(--card-soft, #fff);
  border-radius: var(--radius-sm, 14rpx);
  padding: 20rpx;
  min-width: 200rpx;
  box-shadow: var(--shadow-sm, none);
}
.kpi-label {
  display: block;
  font-size: 22rpx;
  color: var(--text-muted, #786857);
}
.kpi-value {
  display: block;
  font-size: 36rpx;
  font-weight: var(--font-weight-hero, 700);
  color: var(--primary, #143f3a);
  margin-top: 4rpx;
}
.case-identity {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 8rpx;
}
.badges,
.feedback-badges {
  margin-top: 18rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.status-tags {
  margin-top: 0;
  margin-bottom: 12rpx;
}
.status-tag-groups {
  margin-top: 14rpx;
}
.status-tag-row {
  margin-top: 12rpx;
}
.status-tag-title {
  display: block;
  margin-bottom: 8rpx;
  color: var(--text-muted, #786857);
  font-size: 22rpx;
  font-weight: 650;
}
.badge {
  display: inline-block;
  padding: 8rpx 16rpx;
  background: var(--accent-soft, #efe7d8);
  border-radius: 999rpx;
  font-size: 22rpx;
  color: var(--text-main, #241b12);
  margin: 0;
}
.muted-badge {
  background: var(--card-soft, #f5efe5);
  color: var(--text-muted, #786857);
}
.action-badge {
  background: #dff5e8;
  color: var(--primary, #143f3a);
  font-weight: 700;
}
.quick-record-box {
  margin-top: 28rpx;
  padding: 24rpx;
  background: var(--card-soft, #fff);
  border-radius: var(--radius-sm, 14rpx);
}
.text-area {
  width: 100%;
  min-height: 160rpx;
  padding: 18rpx;
  margin-top: 12rpx;
  background: var(--card-bg, #fbf6ee);
  border: 2rpx solid rgba(18, 60, 54, 0.1);
  border-radius: var(--radius-sm, 12rpx);
  font-size: 26rpx;
  color: var(--text-main, #241b12);
  box-sizing: border-box;
}
.field { margin-top: 16rpx; }
.field-label {
  display: block;
  font-size: 24rpx;
  color: var(--text-main, #241b12);
  margin-bottom: 8rpx;
}
.picker-view {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 22rpx;
  background: var(--card-bg, #fbf6ee);
  border: 2rpx solid rgba(18, 60, 54, 0.1);
  border-radius: var(--radius-sm, 12rpx);
  font-size: 26rpx;
  color: var(--text-main, #241b12);
}
.datetime-row {
  display: grid;
  grid-template-columns: 1fr 220rpx;
  gap: 12rpx;
}
.role-segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}
.role-segment {
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  border-radius: var(--radius-sm, 12rpx);
  background: var(--card-bg, #fbf6ee);
  border: 2rpx solid rgba(18, 60, 54, 0.1);
  color: var(--text-muted, #786857);
  font-size: 24rpx;
}
.role-segment.active {
  background: rgba(20, 63, 58, 0.1);
  border-color: var(--primary, #143f3a);
  color: var(--primary, #143f3a);
  font-weight: var(--font-weight-hero, 700);
}
.attachment-actions {
  margin-top: 0;
}
.btn-secondary.recording {
  background: var(--risk, #b85c38);
  border-color: var(--risk, #b85c38);
  color: #fff;
}
.voice-status {
  display: block;
  margin-top: 10rpx;
  color: var(--text-muted, #786857);
  font-size: 22rpx;
}
.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}
.attachment-item {
  padding: 16rpx;
  border-radius: var(--radius-sm, 12rpx);
  background: var(--card-soft, #fbf6ee);
  border: 2rpx solid rgba(18, 60, 54, 0.1);
}
.attachment-name {
  display: block;
  color: var(--text-main, #241b12);
  font-size: 24rpx;
  font-weight: 700;
}
.attachment-link {
  display: block;
  margin-top: 6rpx;
  color: var(--success, #14633a);
  font-size: 22rpx;
  line-height: 1.4;
  word-break: break-all;
}
.link-button {
  margin-top: 10rpx;
  padding: 0;
  height: 48rpx;
  line-height: 48rpx;
  background: transparent;
  border: none;
  color: var(--primary, #143f3a);
  font-size: 24rpx;
  text-align: left;
}
.link-button.danger {
  color: var(--risk, #b85c38);
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.btn-primary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--primary, #143f3a);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm, 12rpx);
  font-size: 28rpx;
}
.btn-secondary {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--card-bg, #fff);
  color: var(--primary, #143f3a);
  border: 2rpx solid var(--primary, #143f3a);
  border-radius: var(--radius-sm, 12rpx);
  font-size: 28rpx;
}
.ai-processing-bar {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius-sm, 14rpx);
  background: rgba(20, 99, 58, 0.08);
  border: 1rpx solid rgba(20, 99, 58, 0.16);
}
.ai-processing-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: var(--success, #14633a);
  animation: pulse-dot 1s ease-in-out infinite;
}
.ai-processing-text {
  color: var(--primary, #143f3a);
  font-size: 24rpx;
  line-height: 1.45;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.35; transform: scale(0.82); }
  50% { opacity: 1; transform: scale(1.12); }
}
.profile-avatar {
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-soft, #efe7d8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar.sm {
  width: 68rpx;
  height: 68rpx;
}
.profile-avatar image {
  width: 100%;
  height: 100%;
}
.avatar-placeholder {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-muted, #786857);
}
.status-card {
  margin-top: 20rpx;
  border-left: 8rpx solid var(--primary, #143f3a);
  border-radius: var(--radius-sm, 12rpx);
}
.status-card.success {
  border-left-color: var(--success, #14633a);
  background: rgba(15, 107, 69, 0.08);
}
.status-card.warning {
  border-left-color: var(--risk, #b85c38);
  background: var(--risk-soft, #f9d8d2);
}
.status-strong {
  display: block;
  font-size: 28rpx;
  font-weight: var(--font-weight-hero, 700);
  color: var(--text-main, #241b12);
}
.feedback-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.feedback-headline {
  margin-top: 10rpx;
}
.quick-section,
.quick-reason-panel,
.quick-status-panel,
.raw-ai-reply-panel,
.quick-guidance-panel,
.score-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: var(--radius-sm, 16rpx);
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.section-mini-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.mini-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.mini-title {
  color: var(--text-main, #241b12);
  font-size: 26rpx;
  font-weight: var(--font-weight-hero, 700);
}
.info-icon {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(20, 63, 58, 0.2);
  background: rgba(255, 252, 247, 0.84);
  color: var(--primary, #143f3a);
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}
.info-modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34rpx;
  background: rgba(24, 18, 12, 0.42);
  box-sizing: border-box;
}
.info-modal {
  width: 100%;
  max-height: 82vh;
  overflow: hidden;
  border-radius: var(--radius-md, 22rpx);
  border: 1rpx solid var(--accent, rgba(201, 164, 92, 0.28));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 180rpx),
    var(--card-bg, #fffcf7);
  box-shadow: 0 30rpx 70rpx rgba(18, 60, 54, 0.24);
}
.info-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 30rpx 30rpx 20rpx;
  border-bottom: 1rpx solid rgba(18, 60, 54, 0.08);
}
.info-head-copy {
  flex: 1;
  min-width: 0;
}
.info-modal-title {
  display: block;
  color: var(--text-main, #201914);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.35;
}
.info-modal-subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: 1.5;
}
.info-modal-close {
  flex-shrink: 0;
  width: 46rpx;
  height: 46rpx;
  line-height: 42rpx;
  border-radius: 50%;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 36rpx;
  text-align: center;
}
.info-modal-body {
  max-height: 62vh;
  padding: 24rpx 30rpx 30rpx;
  box-sizing: border-box;
}
.info-section {
  padding: 20rpx;
  border-radius: var(--radius-sm, 16rpx);
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: var(--card-soft, #fffaf3);
}
.info-section + .info-section {
  margin-top: 18rpx;
}
.info-section.relation {
  background: rgba(201, 164, 92, 0.12);
}
.info-section-title {
  display: block;
  color: var(--primary, #123c36);
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.35;
}
.info-section-copy {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: 1.55;
}
.info-section-copy.strong {
  color: var(--text-main, #201914);
  font-weight: 700;
}
.info-meaning-list {
  margin-top: 16rpx;
}
.info-meaning-row + .info-meaning-row {
  margin-top: 14rpx;
}
.info-meaning-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(18, 60, 54, 0.06);
}
.info-meaning-row:first-child {
  padding-top: 0;
  border-top: none;
}
.info-chip {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.24);
  background: rgba(201, 164, 92, 0.14);
  color: #6f5225;
  font-size: 22rpx;
  line-height: 1.2;
}
.info-chip.muted {
  border-color: rgba(18, 60, 54, 0.12);
  background: rgba(18, 60, 54, 0.06);
  color: var(--text-muted, #76695c);
}
.info-meaning-copy-box {
  flex: 1;
  min-width: 0;
}
.info-meaning-title {
  display: block;
  color: var(--primary, #123c36);
  font-size: 23rpx;
  font-weight: 750;
  line-height: 1.4;
}
.info-meaning-copy {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: var(--text-line-height, 1.55);
}
.mini-sub,
.score-label,
.score-bucket,
.delta-label,
.status-meta {
  color: var(--text-muted, #786857);
  font-size: 22rpx;
}
.feedback-headline.strong,
.status-summary {
  display: block;
  color: var(--text-main, #241b12);
  font-size: 26rpx;
  font-weight: 650;
  line-height: var(--text-line-height, 1.55);
}
.score-row + .score-row {
  margin-top: 18rpx;
}
.score-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.score-value {
  color: var(--primary, #143f3a);
  font-size: 36rpx;
  line-height: 1;
  font-weight: 800;
}
.score-track {
  width: 100%;
  height: 18rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
}
.score-fill {
  height: 18rpx;
  min-width: 4rpx;
  border-radius: 999rpx;
}
.instant-delta-panel {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
.instant-delta-item {
  flex: 1;
  padding: 18rpx;
  border-radius: var(--radius-sm, 16rpx);
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.delta-value {
  display: block;
  margin-top: 6rpx;
  color: var(--text-muted, #786857);
  font-size: 38rpx;
  font-weight: 800;
}
.delta-value.up { color: var(--success, #14633a); }
.delta-value.down { color: var(--risk, #b85c38); }
.quick-reason {
  display: block;
  margin-top: 10rpx;
  color: var(--text-main, #241b12);
  font-size: 24rpx;
  line-height: var(--text-line-height, 1.55);
}
.raw-ai-reply-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #241b12);
  font-size: 25rpx;
  line-height: var(--text-line-height, 1.6);
}
.ai-panel-label,
.guidance-label {
  display: block;
  color: var(--primary, #143f3a);
  font-size: 22rpx;
  font-weight: 750;
}
.guidance-item {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: var(--radius-sm, 14rpx);
  background: rgba(255, 252, 247, 0.72);
  border: 1rpx solid rgba(18, 60, 54, 0.06);
}
.guidance-text {
  display: block;
  margin-top: 6rpx;
  color: var(--text-main, #241b12);
  font-size: 24rpx;
  line-height: var(--text-line-height, 1.55);
}
.profile-side-card {
  border-left: 8rpx solid var(--accent, rgba(20, 63, 58, 0.28));
}
.side-read-generate-btn {
  width: 100%;
  margin-top: 18rpx;
}
.side-read-grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 16rpx;
}
.side-read-item {
  padding: 18rpx;
  border-radius: var(--radius-sm, 14rpx);
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}
.side-read-label {
  display: block;
  color: var(--primary, #143f3a);
  font-size: 22rpx;
  font-weight: 750;
}
.side-read-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #241b12);
  font-size: 24rpx;
  line-height: var(--text-line-height, 1.58);
}
</style>
