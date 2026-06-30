<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">

    <view v-if="loading" class="loading">LOADING...</view>

    <block v-if="!loading">
      <!-- 邀请到账通知 -->
      <view v-if="showIndexReferralNotice" class="referral-notice" style="margin-bottom:8rpx;" @click="dismissIndexReferralNotice">
        <text class="referral-notice-text">🎉 邀请成功！已获得 +{{ indexReferralNoticeAmount }} Token →</text>
      </view>
      <!-- 受邀奖励通知 -->
      <view v-if="showIndexInviteeNotice" class="referral-notice" @click="dismissIndexInviteeNotice">
        <text class="referral-notice-text">🎉 受邀奖励！已获得 +{{ indexInviteeNoticeAmount }} Token →</text>
      </view>
      <block v-else>
      <template v-if="cases.length === 0">
        <view class="hero-block anim-hero">
          <text class="hero-tag">Crush Master BOARD</text>
          <text class="hero-title">先做一次<text class="hl">初次</text>分析</text>
          <text class="hero-copy">第一次进入时先完成一轮结构化问答。后续你更常做的动作会是补记录、看往事和重新分析。</text>
        </view>
        <!-- 命理 · 今日桃花 -->
        <view v-if="showTaohuaTeaser" class="taohua-teaser-v2 anim-card" style="animation-delay:0.1s;" @click="goTaohua">
          <view class="taohua-teaser-head">
            <text class="taohua-teaser-head-title">今日桃花</text>
            <text v-if="taohuaTeaserData" class="taohua-teaser-head-score">{{ taohuaTeaserData.score }}<text class="taohua-teaser-head-unit">/100</text></text>
          </view>
          <view v-if="taohuaTeaserData" class="taohua-teaser-body">
            <view class="taohua-teaser-dirs">
              <view class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🌸</text>
                <text class="taohua-teaser-dir-label">桃花</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.direction }}（{{ taohuaTeaserData.directionZhi }}位）</text>
              </view>
              <view v-if="taohuaTeaserData.hongluanDir" class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🔴</text>
                <text class="taohua-teaser-dir-label">本命红鸾</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.hongluanDir }}方</text>
              </view>
              <view v-if="taohuaTeaserData.tianxiDir" class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🕊️</text>
                <text class="taohua-teaser-dir-label">本命天喜</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.tianxiDir }}方</text>
              </view>
            </view>
            <text class="taohua-teaser-guide">💡</text><text class="taohua-teaser-guide-text">{{ taohuaTeaserData.guidance }}</text>
            <text class="taohua-teaser-meta">{{ taohuaTeaserData.jianchu }}日 · {{ taohuaTeaserData.summary }}</text>
          </view>
          <view v-else class="taohua-teaser-body">
            <text class="taohua-teaser-meta">加载中...</text>
          </view>
          <view class="taohua-teaser-cta">查看完整命理分析 →</view>
          <view class="taohua-teaser-cite">📖 咸池桃花：《三命通会》三合沐浴算法</view>
        </view>
        <view v-if="showProfileReminder" class="remind-card-v2 anim-card" style="animation-delay:0.15s" @click="goSelfProfile">
          <text class="remind-card-title-v2">你的画像未完善</text>
          <text class="remind-card-text-v2">完善画像能让分析更准，花 30 秒补一下。点击前往 →</text>
        </view>

        <!-- 两条路径选择 -->
        <view v-if="!showFullAssessment && !showQuickCreate" class="onboard-options-v2">
          <view class="onboard-card-v2 primary anim-card" style="animation-delay:0.2s" @click="showFullAssessment = true">
            <text class="onboard-card-title-v2">开始初评</text>
            <text class="onboard-card-desc-v2">填Crush画像 + 回答 14 题 → AI 分析结果</text>
          </view>
          <view class="onboard-card-v2 anim-card" style="animation-delay:0.3s" @click="showQuickCreate = true">
            <text class="onboard-card-title-v2">快速创建</text>
            <text class="onboard-card-desc-v2">只填Crush画像 → 30 秒建好，后续可补分析</text>
          </view>
        </view>

        <view v-if="showFullAssessment">
          <text class="back-link-v2" @click="showFullAssessment = false">← 返回选择</text>
          <AssessmentForm @submit="onCreateCase" />
        </view>
        <view v-if="showQuickCreate">
          <text class="back-link-v2" @click="showQuickCreate = false">← 返回选择</text>
          <AssessmentForm profileOnly @submit="onCreateCase" />
        </view>
      </template>

      <template v-else>
        <!-- Hero -->
        <view class="hero-block anim-hero">
          <text class="hero-tag">Crush Master BOARD</text>
          <text class="hero-title">今天他<text class="hl">有戏</text>吗？</text>
          <view class="hero-identity"><view class="profile-avatar-v2 sm"><image v-if="latestCase.profile?.avatar" :src="latestCase.profile.avatar" mode="aspectFill" /><text v-else class="avatar-placeholder-v2">{{ avatarLabel(latestCase.name) }}</text></view><text class="hero-identity-name">{{ latestCase.name || '--' }}</text></view>
          <view class="crush-type-panel">
            <text class="crush-type-label">{{ latestCrushType.label }}</text>
            <text class="crush-type-summary">{{ latestCrushType.summary }}</text>
            <text class="crush-type-action">{{ latestCrushNextAction }}</text>
          </view>
          <view v-if="latestProfileItems.length > 0" class="tag-row-v2">
            <text v-for="item in latestProfileItems" :key="item" class="tag-v2">{{ item }}</text>
          </view>
        </view>

        <!-- 命理 · 今日桃花 -->
        <view v-if="showTaohuaTeaser" class="taohua-teaser-v2 anim-card" style="animation-delay:0.05s;" @click="goTaohua">
          <view class="taohua-teaser-head">
            <text class="taohua-teaser-head-title">今日桃花</text>
            <text v-if="taohuaTeaserData" class="taohua-teaser-head-score">{{ taohuaTeaserData.score }}<text class="taohua-teaser-head-unit">/100</text></text>
          </view>
          <view v-if="taohuaTeaserData" class="taohua-teaser-body">
            <view class="taohua-teaser-dirs">
              <view class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🌸</text>
                <text class="taohua-teaser-dir-label">桃花</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.direction }}（{{ taohuaTeaserData.directionZhi }}位）</text>
              </view>
              <view v-if="taohuaTeaserData.hongluanDir" class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🔴</text>
                <text class="taohua-teaser-dir-label">本命红鸾</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.hongluanDir }}方</text>
              </view>
              <view v-if="taohuaTeaserData.tianxiDir" class="taohua-teaser-dir">
                <text class="taohua-teaser-dir-emoji">🕊️</text>
                <text class="taohua-teaser-dir-label">本命天喜</text>
                <text class="taohua-teaser-dir-val">{{ taohuaTeaserData.tianxiDir }}方</text>
              </view>
            </view>
            <text class="taohua-teaser-guide">💡</text><text class="taohua-teaser-guide-text">{{ taohuaTeaserData.guidance }}</text>
            <text class="taohua-teaser-meta">{{ taohuaTeaserData.jianchu }}日 · {{ taohuaTeaserData.summary }}</text>
          </view>
          <view v-else class="taohua-teaser-body">
            <text class="taohua-teaser-meta">加载中...</text>
          </view>
          <view class="taohua-teaser-cta">查看完整命理分析 →</view>
          <view class="taohua-teaser-cite">📖 咸池桃花：《三命通会》三合沐浴算法</view>
        </view>

        <view v-if="showProfileReminder" class="remind-card-v2 anim-card" style="animation-delay:0.1s" @click="goSelfProfile">
          <text class="remind-card-title-v2">你的画像未完善</text>
          <text class="remind-card-text-v2">完善画像能让分析更准，花 30 秒补一下。点击前往 →</text>
        </view>

        <!-- Quick record -->
        <view class="record-block anim-card" style="animation-delay:0.15s">
          <view class="block-head"><text class="block-title">快速记录</text><text class="block-badge">别脑补</text></view>
          <view class="role-row">
            <view class="role-main-v2">
              <text class="role-label">这条主要在说</text>
              <view class="role-options">
                <view v-for="item in subjectRoleOptions" :key="item.value" :class="['role-chip', quickSubjectRole === item.value ? 'active' : '']" @click="setQuickSubjectRole(item.value)">{{ item.label }}</view>
              </view>
            </view>
            <view class="quick-tool-row-v2">
              <button class="quick-tool-btn-v2" :disabled="quickUploading" aria-label="上传图片" @click="chooseQuickImages">
                <text class="quick-tool-icon-v2">{{ quickUploading ? '…' : '+' }}</text>
              </button>
              <button :class="['quick-tool-btn-v2', 'voice', recording ? 'recording' : '', voiceUploading ? 'loading' : '']" :disabled="voiceUploading" aria-label="语音输入" @click="toggleVoiceRecord">
                <view v-if="recording" class="quick-voice-active-v2">
                  <view class="quick-voice-wave-v2">
                    <view v-for="i in 3" :key="i" class="quick-wave-bar-v2"></view>
                  </view>
                  <text class="quick-voice-time-v2">{{ countdownText }}</text>
                </view>
                <text v-else-if="voiceUploading" class="quick-tool-icon-v2">…</text>
                <view v-else class="quick-mic-icon-v2"></view>
              </button>
            </view>
          </view>
          <text class="role-hint-v2">{{ quickSubjectRoleHint }}</text>
          <view v-if="quickSubjectRole === 'both'" class="quick-chat-names-v2">
            <input v-model="quickChatSelfName" class="quick-chat-name-input-v2" placeholder="你的微信昵称" />
            <text class="quick-chat-name-sep-v2">和</text>
            <input v-model="quickChatTargetName" class="quick-chat-name-input-v2" :placeholder="latestCase?.name || 'TA的微信昵称'" />
            <text class="quick-chat-name-hint-v2">贴对话后标注，帮小咪分清谁说了什么</text>
          </view>
          <textarea :value="quickDesc" @input="onQuickDescInput" class="text-area-v2" :class="{ 'chat-mode': quickSubjectRole === 'both' }" maxlength="6000" :placeholder="quickDescPlaceholder" />
          <text v-if="quickDescDebug" class="quick-desc-debug-v2">{{ quickDescDebug }}</text>
          <view class="datetime-row-v2">
            <picker mode="date" :value="quickDate" @change="onQuickDateChange"><view class="picker-v2">{{ quickDate }}</view></picker>
            <picker mode="time" :value="quickTime" @change="onQuickTimeChange"><view class="picker-v2">{{ quickTime }}</view></picker>
          </view>
          <view class="quick-question-block-v2">
            <text class="quick-question-title-v2">你最想知道什么？</text>
            <view class="quick-question-list-v2">
              <view
                v-for="item in quickQuestionOptions"
                :key="item.value"
                :class="['quick-question-option-v2', quickQuestionKey === item.value ? 'active' : '']"
                @click="quickQuestionKey = item.value"
              >
                <text class="quick-question-dot-v2"></text>
                <text class="quick-question-label-v2">{{ item.label }}</text>
                <text v-if="quickQuestionKey === item.value" class="quick-question-check-v2">✓</text>
              </view>
            </view>
            <text v-if="quickQuestionKey === 'reply'" class="quick-question-hint-v2">💡 也可以直接点下方 {{ selectedPet.displayName }}，让 ta 帮你想怎么回～</text>
            <input
              v-if="quickQuestionKey === 'custom'"
              v-model="quickCustomQuestion"
              class="quick-custom-question-input-v2"
              maxlength="40"
              placeholder="例如：他突然冷淡是为什么？"
            />
          </view>
          <text v-if="voiceStatus && !recording" class="voice-status-v2">{{ voiceStatus }}</text>
          <view v-if="quickAttachments.length > 0" class="img-grid-v2">
            <view v-for="(item, index) in quickAttachments" :key="item.fileID" class="img-box-v2" @click="previewQuickAttachment(index)">
              <image :src="item.url" class="img-preview-v2" mode="aspectFill" />
              <text class="img-del-v2" @click.stop="removeQuickAttachment(index)">x</text>
            </view>
          </view>
          <button class="btn btn-primary btn-md btn-full anim-pulse" style="margin-top:16rpx;" :disabled="quickSubmitting" @click="submitQuickRecord">{{ quickSubmitting ? '保存中...' : '记上！' }}</button>
        </view>

        <!-- Feedback -->
        <view v-if="showQuickFeedback && latestCase.latestResult && latestTrend" :class="['feedback-block', latestFeedbackEventType === 'risk' ? 'warn' : 'ok']">
          <button class="btn-share-sm analysis-share-btn" open-type="share">
            <image class="analysis-share-icon" src="/static/icons/taohua/share-2.svg" mode="aspectFit" />
          </button>
          <view class="block-head analysis-head"><text class="block-title">本次分析</text></view>
          <text v-if="latestCase.latestResult?.userQuestion?.label" class="question-context-v2">你问：{{ latestCase.latestResult.userQuestion.label }}</text>
          <text class="feedback-desc">{{ latestOriginalRecordText }}</text>
          <view v-if="aiFeedbackLoading" class="action-box">
            <text class="action-label">AI 分析中...</text>
            <view class="ai-row"><view class="ai-dot"></view><text class="action-text muted">后台分析中，已用时 {{ aiFeedbackSeconds }} 秒</text></view>
          </view>
          <view v-else-if="latestCase.latestResult.aiPending" class="action-box">
            <text class="action-label">等待中</text>
            <text class="action-text muted">AI 分析尚未开始，请稍候。</text>
          </view>
          <template v-else>
            <view class="score-grid">
              <view class="score-item">
                <text class="score-label-v2">意向</text><text class="score-num-v2">{{ clampScore(latestCase.latestResult.intentScore) }}</text>
                <text class="score-bucket-v2">{{ mapIntentLabel(latestCase.latestResult?.intentBucket) }}</text>
                <view class="bar-track-v2"><view class="bar-fill-v2" :style="{ width: clampScore(latestCase.latestResult.intentScore) + '%' }"></view></view>
                <text class="score-delta-v2"><text class="score-delta-label">变化</text><text :class="['score-delta-val', deltaClass(latestTrend.intentDelta)]">{{ formatDelta(latestTrend.intentDelta) }}</text></text>
              </view>
              <view class="score-item">
                <text class="score-label-v2">风险</text><text class="score-num-v2 risk">{{ clampScore(latestCase.latestResult.consistencyRiskScore) }}</text>
                <text class="score-bucket-v2">{{ mapRiskLabel(latestCase.latestResult?.riskBucket) }}</text>
                <view class="bar-track-v2"><view class="bar-fill-v2 risk" :style="{ width: clampScore(latestCase.latestResult.consistencyRiskScore) + '%' }"></view></view>
                <text class="score-delta-v2"><text class="score-delta-label">变化</text><text :class="['score-delta-val', deltaClass(latestTrend.riskDelta)]">{{ formatDelta(latestTrend.riskDelta) }}</text></text>
              </view>
            </view>
            <view v-if="quickFeedbackSignal" class="tag-row-v2" style="margin-top:12px;">
              <text class="tag-v2 black quick-feedback-signal-v2">{{ quickFeedbackSignal.emoji }} {{ quickFeedbackSignal.label }}</text>
            </view>
            <view v-if="quickReasonBullets.length > 0" class="reason-box">
              <text v-for="reason in quickReasonBullets" :key="reason" class="reason-line">• {{ reason }}</text>
            </view>
            <view v-if="latestActionPlanPanel.show" class="action-box">
              <text class="action-label">{{ selectedPet.displayName }} 帮你看看</text>
              <text v-if="latestActionPlanPanel.missing" class="action-text muted">{{ latestActionPlanPanel.text }}</text>
              <view v-else><view v-for="item in latestActionPlanPanel.sections" :key="item.label" class="action-item"><text class="action-item-label">{{ petLabel(item.label) }}</text><text class="action-item-text">{{ item.text }}</text></view></view>
              <view v-if="aiParticipationLabel" :class="['ai-badge', aiParticipationLabel.type]">
                <text class="ai-badge-dot"></text>
                <text class="ai-badge-text">{{ aiParticipationLabel.detail }}</text>
              </view>
            </view>
          </template>
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

      <!-- Pet bar -->
      <view v-if="showPetBar" class="pet-bar">
        <view class="pet-sprite-viewport" @click="showSpeakSheet = true">
          <image v-if="resolvedSpritesheetPath" :key="petSpritesheetKey" :src="resolvedSpritesheetPath" class="pet-sprite-sheet" mode="widthFix" :style="petSpritesheetStyle" />
          <image v-else :src="selectedPet.avatarPath" class="pet-bar-img" mode="aspectFit" />
        </view>
        <view v-if="petMsg" class="pet-bubble"><text class="pet-bubble-text">{{ petMsg }}</text></view>
      </view>

      <!-- Pet Speak Sheet -->
      <PetSpeakSheet :visible="showSpeakSheet" :pet-name="selectedPet.displayName" @close="showSpeakSheet = false" />
    </block>
    </block>

    <view class="ai-disclaimer"><text class="ai-disclaimer-text">AI 辅助分析 · 基于事件线索生成，仅供辅助参考，不构成专业意见或事实认定。</text></view>
  </view>
  <!-- 桃花算法说明弹窗 -->
  <view v-if="showTaohuaInfo" class="taohua-info-overlay" @click="showTaohuaInfo = false">
    <view class="taohua-info-sheet" @click.stop>
      <view class="taohua-info-head">
        <text class="taohua-info-title">方位怎么来的</text>
        <text class="taohua-info-close" @click="showTaohuaInfo = false">×</text>
      </view>
      <view class="taohua-info-body">
        <view class="taohua-info-item">
          <text class="taohua-info-q">🪷 桃花（每日变）</text>
          <text class="taohua-info-a">日支 → 三合局 → 沐浴位。仅落正东/南/西/北四正位，每天不同。管邂逅、暧昧、日常约会气场。</text>
        </view>
        <view class="taohua-info-item">
          <text class="taohua-info-q">🔴 红鸾（终身不变）</text>
          <text class="taohua-info-a">年支（生肖）起红鸾。管姻缘开端、确定关系、见家长。生肖不变，红鸾位终身不变。</text>
        </view>
        <view class="taohua-info-item">
          <text class="taohua-info-q">🕊️ 天喜（终身不变）</text>
          <text class="taohua-info-a">红鸾的对冲位即天喜。管婚庆落地、订婚结婚、备孕添丁。</text>
        </view>
        <view class="taohua-info-divider"></view>
        <text class="taohua-info-note">📖 出处：《三命通会》咸池桃花、红鸾天喜篇。算法基于寿星天文历（lunar-javascript / MIT）。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onHide, onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow, onUnload } from '@dcloudio/uni-app'
import AssessmentForm from '@/components/AssessmentForm.vue'
import PetSpeakSheet from '@/components/PetSpeakSheet.vue'
import { getCases, createCase, createTimeline, generateAssessmentAI, handleInsufficientBalance, getCachedSelfProfile, getCurrentUserId, getSelfProfile, getSubscriptionStatus, getTempFileURL, speechToText, uploadFile, hasUsableSelfProfile, queryTaohua } from '@/utils/api'
import { bumpDataVersion, combineDateAndTimeToISOString, getActiveCaseId, getDateInputValue, getPetMood, getTimeInputValue, setActiveCaseId, setPendingTimelineContext, showError, showSuccess } from '@/utils/helpers'
import { buildProfileItems, compareAssessments, buildObjectStatusCard, explainProblemLabel, explainStatusTag, mapEventSignal } from '@/utils/insights'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { buildSafeTimelineShare, appendReferralParams, SAFE_SHARE_IMAGE } from '@/utils/share'
import { deriveCrushType, mapNextActionText } from '@/utils/crush-type.js'
import { xianchiAlgorithm, hongluanTianxi } from '@/utils/taohua'
import { getPetById, getResolvedSpritesheetPath, getSelectedPetId, isCloudPet, isPetCachedLocally, downloadPetAssets } from '@/utils/pets.js'

type PetScene =
  | 'ai_loading'
  | 'ai_success'
  | 'risk'
  | 'positive'
  | 'insufficient_balance'
  | 'ai_error'

const petLines: Record<PetScene, { state: string; message: string }> = {
  ai_loading:          { state: 'waiting',  message: '我正在帮你看这条记录。' },
  ai_success:          { state: 'review',   message: '分析好啦，我先说重点。' },
  risk:                { state: 'failed',   message: '这里要慢一点，别只看甜的部分。' },
  positive:            { state: 'jumping',  message: '这次确实比之前更有动作。' },
  insufficient_balance:{ state: 'failed',   message: '这次我算不动啦，先补一点额度再继续分析。' },
}

function getPetPresentation(scene: PetScene) {
  const item = petLines[scene]
  return { ...item, message: formatPetMessage(item.message) }
}

function mapResultToScene(params: { latestFeedbackEventType: string; intentDelta: number }): PetScene {
  const { latestFeedbackEventType, intentDelta } = params
  if (latestFeedbackEventType === 'risk') return 'risk'
  if (intentDelta > 0) return 'positive'
  return 'ai_success'
}

const themeVars = ref(getThemeStyle())
const pageStyle = computed(() => {
  const base = { ...themeVars.value, paddingBottom: 'calc(140rpx + env(safe-area-inset-bottom))' }
  if (showPetBar.value) base.paddingBottom = 'calc(300rpx + env(safe-area-inset-bottom))'
  return base
})
const loading = ref(true)
const fontSizeMode = ref(getFontSizeMode())
// 邀请到账通知
const showIndexReferralNotice = ref(false)
const indexReferralNoticeAmount = ref(0)
function dismissIndexReferralNotice() {
  showIndexReferralNotice.value = false
  uni.removeStorageSync('showReferralNotice')
  uni.navigateTo({ url: '/pages/token-usage/token-usage' })
}
// 受邀奖励通知
const showIndexInviteeNotice = ref(false)
const indexInviteeNoticeAmount = ref(0)
function dismissIndexInviteeNotice() {
  showIndexInviteeNotice.value = false
  uni.removeStorageSync('showInviteeNotice')
  uni.navigateTo({ url: '/pages/token-usage/token-usage' })
}

const currentUserId = ref(getCurrentUserId() || '')
const cases = ref<any[]>([])
const userId = ref('')
const activeCaseId = ref('')
const selfProfile = ref<any>(getCachedSelfProfile())
const quickDesc = ref('')
const quickDate = ref(getDateInputValue())
const quickTime = ref(getTimeInputValue())
const quickQuestionKey = ref('like')
const quickCustomQuestion = ref('')
const quickChatSelfName = ref('')
const quickChatTargetName = ref('')
const quickDescDebug = ref('')
const quickSubmitting = ref(false)
const quickUploading = ref(false)
const voiceUploading = ref(false)
const recording = ref(false)
const voiceStatus = ref('')
const showFullAssessment = ref(false)
const showQuickCreate = ref(false)
const aiFeedbackLoading = ref(false)
const aiFeedbackSeconds = ref(0)
const pendingAIInFlightKey = ref('')
const pendingAIRetryCounts = new Map<string, number>()
let aiFeedbackTimer: any = null
const petScene = ref<PetScene | null>(null)
let petSceneTimer: ReturnType<typeof setTimeout> | null = null
const quickSubjectRole = ref<'target' | 'self' | 'both'>('target')
const quickSubjectRoleConfidence = ref<'auto' | 'user_selected'>('auto')
const quickAttachments = ref<any[]>([])
const quickFeedback = ref<{
  caseId: string
  eventType: string
  recordId?: string
  assessmentId?: string
  description?: string
} | null>(null)
let recorderManager: any = null
let recordStartedAt = 0

function shortId(value: any) {
  const text = String(value || '')
  return text ? text.slice(-10) : ''
}

function indexAILog(stage: string, payload: Record<string, any> = {}) {
  void stage
  void payload
}

const subjectRoleOptions = [
  { value: 'target', label: '对方' },
  { value: 'self', label: '自己' },
  { value: 'both', label: '互动' }
] as const

const quickQuestionOptions = [
  { value: 'like', label: '他喜欢我吗' },
  { value: 'initiative', label: '我该不该主动' },
  { value: 'fishing', label: '他是不是在养鱼' },
  { value: 'reply', label: '这句话怎么回' },
  { value: 'advance', label: '现在怎么推进' },
  { value: 'overthinking', label: '我是不是想多了' },
  { value: 'custom', label: '其他问题' }
] as const

function getQuickQuestionPayload() {
  if (quickQuestionKey.value === 'custom') {
    const label = quickCustomQuestion.value.replace(/\s+/g, ' ').trim().slice(0, 40)
    return label ? { key: 'custom', label } : null
  }
  const item = quickQuestionOptions.find((option) => option.value === quickQuestionKey.value) || quickQuestionOptions[0]
  return { key: item.value, label: item.label }
}

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

const latestTimelineStats = computed(() => {
  const timeline = Array.isArray(latestCase.value?.timeline) ? latestCase.value.timeline : []
  const hasTag = (item: any, tag: string) => JSON.stringify(item?.semanticTags || {}).includes(tag)
  const textOf = (item: any) => `${item?.title || ''} ${item?.description || ''}`
  const count = (predicate: (item: any) => boolean) => timeline.filter(predicate).length
  return {
    totalCount: timeline.length,
    fulfilledCount: count((item) => hasTag(item, 'fulfilled') || textOf(item).includes('兑现')),
    targetCommittedCount: count((item) => hasTag(item, 'target_committed') || textOf(item).includes('约我')),
    cancelledDelayedCount: count((item) => hasTag(item, 'cancelled_delayed') || hasTag(item, 'vague_delay')),
    targetInitiatedCount: count((item) => hasTag(item, 'target_initiated')),
    selfInitiatedCount: count((item) => hasTag(item, 'self_initiated'))
  }
})

const latestCrushType = computed(() => deriveCrushType({
  ...(latestCase.value?.latestResult || {}),
  timelineStats: latestTimelineStats.value
}))

const latestCrushNextAction = computed(() => mapNextActionText(latestCase.value?.latestResult?.nextAction, latestCrushType.value))

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

const latestRawReply = computed(() => normalizeRawReplyText(latestCase.value?.latestResult?.rawReply))

function normalizeRawReplyText(value: any): string {
  if (typeof value === 'string') {
    const source = value.trim()
    if (!source) return ''
    if ((source.startsWith('{') && source.endsWith('}')) || (source.startsWith('```') && source.includes('{'))) {
      try {
        const cleaned = source.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        return normalizeRawReplyText(JSON.parse(cleaned))
      } catch (_) {}
    }
    return source
  }
  if (!value || typeof value !== 'object') return ''
  if (value.rawReply || value.reply || value.text || value.content) {
    return normalizeRawReplyText(value.rawReply || value.reply || value.text || value.content)
  }
  const labels = ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼']
  return labels
    .map((label) => {
      const text = normalizeRawReplyText(value[label])
      return text ? `${label}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function parseRawReplySections(text: string) {
  const source = String(text || '').trim()
  if (!source) return []
  const labels = ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼']
  const labelPattern = '(小咪先回答你的问题|对方可能在想|下一步可以这样推进|留个心眼)'
  // Step 1: normalize colon format
  let normalized = source
    .replace(/\r/g, '')
    .replace(new RegExp(`${labelPattern}\\s*[：:]`, 'g'), '\n$1：')
  // Step 2: fallback — if no colon headings found, try slash-separated format
  if (!labels.some((l) => normalized.includes(`${l}：`))) {
    normalized = source
      .replace(/\r/g, '')
      .replace(new RegExp(`${labelPattern}\\s*\\/\\s*`, 'g'), '\n$1：')
  }
  normalized = normalized.trim()
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

function petLabel(label: string) {
  return label.replace(/小咪/g, selectedPet.value.displayName)
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

const aiParticipationLabel = computed(() => {
  const result = latestCase.value?.latestResult
  if (!result || result.aiPending) return null
  if (result.aiFailed) return { text: '规则兜底', type: 'fallback', detail: 'AI 超时或格式异常，本次为规则计算结果' }
  if (result.aiUsed === false) return { text: '规则兜底', type: 'fallback', detail: '未启用 AI，本次为规则计算结果' }
  return null
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

const eventInsightTags = computed(() => {
  const insight = latestCase.value?.latestResult?.eventInsight
  if (!insight || typeof insight !== 'object') return []
  const tags = [
    mapEventInsightActor(insight.actor),
    mapEventInsightInteraction(insight.interaction),
    mapEventInsightCommitment(insight.commitmentStatus),
    mapEventInsightEvidence(insight.evidenceType)
  ].filter(Boolean)
  return [...new Set(tags)].slice(0, 4)
})

const quickFeedbackSignal = computed(() => {
  if (!latestCase.value?.latestResult) return null
  const insight = latestCase.value.latestResult.eventInsight
  const trend = latestTrend.value
  if (!insight && !trend) return null
  return mapEventSignal(insight, trend)
})

const shareTitle = computed(() => {
  const r = latestCase.value?.latestResult
  if (!r) return '他到底什么意思？让小咪帮你看看'
  return latestCrushType.value.shareTitle
})

const sceneKey = computed(() => {
  const r = latestCase.value?.latestResult
  if (!r) return ''
  const ib = r.intentBucket || ''
  const rb = r.riskBucket || ''
  if (ib.startsWith('high')) {
    if (rb.startsWith('low')) return 'high_low'
    return 'high_risk'
  }
  if (ib.startsWith('medium')) {
    if (rb.startsWith('low')) return 'medium_low'
    if (rb.startsWith('high')) return 'medium_high'
    return 'medium'
  }
  if (ib.startsWith('low')) return 'low'
  return 'general'
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



const showProfileReminder = computed(() =>
  !hasUsableSelfProfile(selfProfile.value)
)

const quickSubjectRoleHint = computed(() => {
  const label = mapSubjectRoleLabel(quickSubjectRole.value)
  if (quickSubjectRoleConfidence.value === 'user_selected') return `已手动设为：${label}。`
  if (quickSubjectRole.value === 'self') return 'AI 判断这更像你的心理感受或自我状态，已归为“自己”。'
  if (quickSubjectRole.value === 'both') return 'AI 判断这更像双方互动，建议重点区分谁主动、谁回应、谁拒绝。'
  return '默认按”对方”记录；如果写的是你的心理感受，请改为”自己”。'
})

const quickDescPlaceholder = computed(() => {
  if (quickSubjectRole.value === 'both') return '可直接粘贴微信对话记录，AI 会自动解析双方说了什么'
  if (quickSubjectRole.value === 'self') return '你做了什么？说了什么？你的感受是怎样的？例如：我主动问他周末有没有空…'
  return 'TA 做了什么？原话是什么？例如：他说下次一起去图书馆…'
})

const recordingSeconds = ref(60)
let recordingTimer: ReturnType<typeof setInterval> | null = null

const countdownText = computed(() => {
  const m = Math.floor(recordingSeconds.value / 60)
  const s = recordingSeconds.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
})

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

function mapEventInsightActor(value?: string) {
  switch (value) {
    case 'target': return '对方动作'
    case 'self': return '我的动作'
    case 'both': return '双方互动'
    case 'unknown': return '主体不清'
    default: return ''
  }
}

function mapEventInsightInteraction(value?: string) {
  switch (value) {
    case 'initiated': return '主动'
    case 'responded': return '回应'
    case 'rejected': return '拒绝'
    case 'delayed': return '拖延'
    case 'fulfilled': return '兑现'
    case 'promised': return '承诺'
    case 'observed': return '观察记录'
    case 'unclear': return '互动不明'
    default: return ''
  }
}

function mapEventInsightCommitment(value?: string) {
  switch (value) {
    case 'promised': return '有承诺'
    case 'fulfilled': return '已兑现'
    case 'broken': return '未兑现'
    case 'unclear': return '兑现不明'
    default: return ''
  }
}

function mapEventInsightEvidence(value?: string) {
  switch (value) {
    case 'fact': return '事实依据'
    case 'feeling': return '感受为主'
    case 'mixed': return '事实+感受'
    case 'unclear': return '依据不清'
    default: return ''
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
  // 仅对话转录格式（多行 + 时间戳）自动判 both，普通描述只在 对方/自己 之间选
  if (text.includes('\n') && /\d{4}[-/]\d{2}[-/]\d{2}\s*\d{1,2}:\d{2}/.test(text)) return 'both'
  const selfIndicators = /(我|我们|本人|自己|这边)/.test(text)
  const selfFeeling = /(我.*(感觉|觉得|感到|心理|心里|焦虑|难受|失落|开心|期待|害怕|纠结|想他|想她|想对方|放不下|不安|委屈|生气|吃醋)|自己.*(状态|感受|情绪|心理|心里))/.test(text)
  if (selfFeeling) return 'self'
  if (selfIndicators) return 'self'
  return 'target'
}

function setQuickSubjectRole(role: 'target' | 'self' | 'both') {
  quickSubjectRole.value = role
  quickSubjectRoleConfidence.value = 'user_selected'
}

// 用 :value + @input 替代 v-model，绕过微信 textarea 粘贴截断 bug
function onQuickDescInput(e: any) {
  const val = e?.detail?.value ?? e?.target?.value ?? ''
  quickDesc.value = val.slice(0, 6000)
  quickDescDebug.value = debugQuickDesc(val)
  // 检测对话格式 → 自动切到互动
  if (val.includes('\n') && /\d{4}[-/]\d{2}[-/]\d{2}\s*\d{1,2}:\d{2}/.test(val)) {
    quickSubjectRole.value = 'both'
    quickSubjectRoleConfidence.value = 'user_selected'
  }
}

function debugQuickDesc(value: string) {
  const text = String(value || '')
  if (!text) return ''
  const first = text.split('\n').slice(0, 2).join(' / ').slice(0, 60)
  const last = text.split('\n').slice(-2).join(' / ').slice(0, 60)
  return `len=${text.length} | head=${first} | tail=${last}`
}

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
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

function avatarLabel(name?: string) {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1) : '像'
}

// ---- pet animation ----
const petFrame = ref(0)
const showSpeakSheet = ref(false)
const petMsg = ref('')
const petState = ref('idle')
const selectedPet = ref(getPetById(getSelectedPetId()))
const PET_SPRITE_SCALE = 0.5
let petTimer: ReturnType<typeof setInterval> | null = null

const resolvedSpritesheetPath = computed(() => {
  void petAssetsVersion.value
  return getResolvedSpritesheetPath(selectedPet.value.id)
})

const petSpritesheetKey = computed(() => `${selectedPet.value.id}:${petAssetsVersion.value}:${resolvedSpritesheetPath.value}`)

const petSpritesheetStyle = computed(() => {
  const pet = selectedPet.value
  const cellWidth = pet.cellWidth || 192
  const cellHeight = pet.cellHeight || 208
  const columns = pet.columns || 8
  const rows = pet.rows || 9
  const row = pet.rowMap?.[petState.value] ?? 0
  const col = petFrame.value
  const scale = PET_SPRITE_SCALE
  return {
    width: `${cellWidth * columns * scale}rpx`,
    height: `${cellHeight * rows * scale}rpx`,
    transform: `translate(${-col * cellWidth * scale}rpx, ${-row * cellHeight * scale}rpx)`
  }
})

function formatPetMessage(message: string) {
  const name = selectedPet.value.displayName
  const text = String(message || '').trim().replace(/^小咪[：:]\s*/, '')
  if (!text) return ''
  if (text.startsWith(`${name}：`) || text.startsWith(`${name}:`)) return text
  return `${name}：${text}`
}

function stopPetAnim() {
  if (petTimer) { clearInterval(petTimer); petTimer = null }
}

function startPetAnim(state: string) {
  stopPetAnim()
  const cfg = selectedPet.value.states[state] || selectedPet.value.states['idle']
  petState.value = state
  petFrame.value = 0
  if (cfg.frames <= 1) return
  const ms = 1000 / cfg.fps
  petTimer = setInterval(() => {
    const next = petFrame.value + 1
    petFrame.value = next >= cfg.frames ? (cfg.loop ? 0 : cfg.frames - 1) : next
  }, ms)
}

function applyPetScene(scene: PetScene | null, durationMs?: number, customMessage?: string) {
  if (petSceneTimer) { clearTimeout(petSceneTimer); petSceneTimer = null }
  if (!scene) { petMsg.value = ''; petScene.value = null; startPetAnim('idle'); return }
  const p = getPetPresentation(scene)
  petMsg.value = customMessage ? formatPetMessage(customMessage) : p.message
  petScene.value = scene
  startPetAnim(p.state)
  if (durationMs && durationMs > 0) {
    petSceneTimer = setTimeout(() => { petMsg.value = ''; petScene.value = null; startPetAnim('idle') }, durationMs)
  }
}

const showPetBar = ref(true)
const petAssetsVersion = ref(0)

// 分享提醒：试用期或 Token 不足时，每天最多 1 次、50% 概率提醒
let shareNudgeTimer: ReturnType<typeof setTimeout> | null = null
const SHARE_NUDGE_KEY = 'lastShareNudgeDate'
async function checkShareNudge() {
  // 已显示过宠物消息的场景（justRecorded）不覆盖
  if (!petMsg.value) return
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (uni.getStorageSync(SHARE_NUDGE_KEY) === today) return
    if (Math.random() > 0.5) return
    const sub = await getSubscriptionStatus().catch(() => null)
    if (!sub?.success) return
    const tokens = Number(sub.subscription?.extraTokens || 0) + Number(sub.subscription?.monthlyRemaining || 0)
    const isTrial = Boolean(sub.subscription?.isTrial)
    if (!isTrial && tokens >= 20000) return
    // 延迟 4 秒展示，不抢 mood 消息的首屏注意力
    shareNudgeTimer = setTimeout(() => {
      uni.setStorageSync(SHARE_NUDGE_KEY, today)
      const msg = isTrial
        ? '🎁 试用福利：邀请好友一起用，双方都能得 Token～'
        : '📢 Token 余额不多了，邀请好友注册立得 Token →'
      petMsg.value = msg
      petState.value = 'waving'
      startPetAnim('waving')
      // 6 秒后恢复
      setTimeout(() => {
        const mood = getPetMood()
        petMsg.value = mood.message
        startPetAnim(mood.sprite)
      }, 6000)
    }, 4000)
  } catch { /* ignore */ }
}
function stopShareNudgeTimer() {
  if (shareNudgeTimer) { clearTimeout(shareNudgeTimer); shareNudgeTimer = null }
}

function syncPetBarPref() {
  try { showPetBar.value = uni.getStorageSync('showPetBar') !== false } catch { showPetBar.value = true }
}
async function syncSelectedPet() {
  const nextPetId = getSelectedPetId()
  selectedPet.value = getPetById(nextPetId)
  if (isCloudPet(selectedPet.value.id) && !isPetCachedLocally(selectedPet.value.id)) {
    try {
      await downloadPetAssets(selectedPet.value.id)
    } catch (err: any) {
      void err
    }
  }
  petAssetsVersion.value++
}
syncPetBarPref()
syncSelectedPet()

// start idle animation on load
startPetAnim('idle')

const feedbackPetScene = computed<PetScene | null>(() => {
  if (!showQuickFeedback.value) return null
  if (!latestCase.value?.latestResult) return null
  if (latestCase.value.latestResult.aiPending) return null
  return mapResultToScene({
    latestFeedbackEventType: latestFeedbackEventType.value,
    intentDelta: latestTrend.value?.intentDelta ?? 0
  })
})

const dataReady = ref(false)
const lastDataVersion = ref(0)
const HOME_CASES_CACHE_KEY = 'homeCasesCache:v1'

function hasCaseInList(caseId: string) {
  return Boolean(caseId && cases.value.some((item: any) => item.caseId === caseId || item._id === caseId))
}

function readHomeCasesCache(uid: string) {
  try {
    const cached = uni.getStorageSync(HOME_CASES_CACHE_KEY)
    if (!cached || cached.userId !== uid || !Array.isArray(cached.cases)) return []
    return cached.cases
  } catch {
    return []
  }
}

function writeHomeCasesCache(uid: string, list: any[]) {
  try {
    uni.setStorageSync(HOME_CASES_CACHE_KEY, {
      userId: uid,
      cachedAt: Date.now(),
      cases: list
    })
  } catch {}
}

function applyCasesList(list: any[], options?: { fromCache?: boolean }) {
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
  if (!options?.fromCache) {
    bumpDataVersion()
    lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  }
  dataReady.value = true
}

async function refreshSelfProfileInBackground() {
  try {
    const profileRes = await getSelfProfile()
    if (profileRes?.success) selfProfile.value = profileRes.selfProfile
  } catch {}
}

onLoad((options: any) => {
  if (options?.inviteCode) {
    uni.setStorageSync('pendingInviteCode', options.inviteCode)
  }
})

onShow(() => {
  // 检查邀请到账通知
  if (uni.getStorageSync('showReferralNotice')) {
    showIndexReferralNotice.value = true
    indexReferralNoticeAmount.value = Number(uni.getStorageSync('referralNoticeAmount') || 0)
  }
  // 检查受邀奖励通知
  if (uni.getStorageSync('showInviteeNotice')) {
    showIndexInviteeNotice.value = true
    indexInviteeNoticeAmount.value = Number(uni.getStorageSync('inviteeNoticeAmount') || 0)
  }

  currentUserId.value = getCurrentUserId() || ''
  fontSizeMode.value = getFontSizeMode()
  // Sync cached profile so showProfileReminder recomputes
  selfProfile.value = getCachedSelfProfile()
  const tabBar = getCurrentPages().pop()?.getTabBar?.()
  if (tabBar) tabBar.updateSelected()
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  syncPetBarPref()
  syncSelectedPet()
  // 小咪情绪联动：根据 lastRecordDate 显示初始文案
  const justRecorded = !!uni.getStorageSync('justRecorded')
  if (!petMsg.value) {
    if (justRecorded) {
      petMsg.value = '记上了！小咪在帮你分析…'
      petState.value = 'running'
      startPetAnim('running')
      uni.removeStorageSync('justRecorded')
      // 2 秒后切回正常情绪
      setTimeout(() => {
        const mood = getPetMood()
        petMsg.value = mood.message
        startPetAnim(mood.sprite)
      }, 2000)
    } else {
      const mood = getPetMood()
      let msg = mood.message
      // 新用户（无记录）：提示宠物可点击
      if (cases.value.length === 0) {
        msg = mood.message + ' 点我试试~'
      }
      petMsg.value = msg
      petState.value = mood.sprite
      startPetAnim(mood.sprite)
      // 异步检查是否需要分享提醒（不阻塞主流程）
      checkShareNudge()
    }
  } else {
    startPetAnim(petState.value || 'idle')
  }
  const previousActiveCaseId = activeCaseId.value
  const nextActiveCaseId = getActiveCaseId()
  activeCaseId.value = nextActiveCaseId
  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  const activeCase = cases.value.find((item: any) => item.caseId === nextActiveCaseId || item._id === nextActiveCaseId)
  const activeMissing = Boolean(nextActiveCaseId && dataReady.value && !activeCase)
  const activeChanged = Boolean(nextActiveCaseId && previousActiveCaseId && nextActiveCaseId !== previousActiveCaseId)
  const activeNeedsDetail = Boolean(nextActiveCaseId && dataReady.value && activeCase && !activeCase.latestResult)
  indexAILog('onShow_state', {
    nextActiveCaseIdTail: shortId(nextActiveCaseId),
    previousActiveCaseIdTail: shortId(previousActiveCaseId),
    dataVersion: dv,
    lastDataVersion: lastDataVersion.value,
    activeMissing,
    activeChanged,
    activeNeedsDetail,
    latestAiPending: Boolean(latestCase.value?.latestResult?.aiPending)
  })
  loadTaohuaTeaser()
  if (!dataReady.value || dv > lastDataVersion.value || activeMissing || activeChanged || activeNeedsDetail) {
    loadData()
  } else {
    maybeResumePendingAssessmentAI('onShow')
  }
})

onShareAppMessage(() => {
  const r = latestCase.value?.latestResult
  const params = [
    `intent=${r?.intentScore ?? 50}`,
    `risk=${r?.consistencyRiskScore ?? 35}`
  ]
  if (r) {
    params.push(`crushTypeKey=${encodeURIComponent(latestCrushType.value.key)}`)
    params.push(`crushTypeLabel=${encodeURIComponent(latestCrushType.value.label)}`)
    params.push(`crushTypeSummary=${encodeURIComponent(latestCrushType.value.summary)}`)
  }
  if (quickFeedbackSignal.value?.label) {
    params.push(`signal=${encodeURIComponent(quickFeedbackSignal.value.emoji + ' ' + quickFeedbackSignal.value.label)}`)
  }
  const rawBullets = quickReasonBullets.value.slice(0, 2)
  if (rawBullets.length > 0) {
    params.push(`bullets=${encodeURIComponent(rawBullets.join('|'))}`)
  }
  if (latestActionPlanPanel.value?.show && latestActionPlanPanel.value?.text) {
    params.push(`action=${encodeURIComponent(latestActionPlanPanel.value.text.slice(0, 150))}`)
  }
  let path = `/pages/quick-read/quick-read?${params.join('&')}`
  path = appendReferralParams(path, 'analysis_share', sceneKey.value)
  return { title: shareTitle.value, path, imageUrl: SAFE_SHARE_IMAGE }
})

onShareTimeline(() => buildSafeTimelineShare())

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

onHide(() => {
  if (recording.value && recorderManager?.stop) recorderManager.stop()
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  stopAIFeedbackTimer()
  stopPetAnim()
  stopShareNudgeTimer()
  statusInfoVisible.value = false
  applyPetScene(null)
})

onUnload(() => {
  if (recording.value && recorderManager?.stop) recorderManager.stop()
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  stopAIFeedbackTimer()
  stopPetAnim()
  statusInfoVisible.value = false
  applyPetScene(null)
})

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    loading.value = false
    return
  }
  currentUserId.value = uid
  userId.value = uid
  if (!dataReady.value) {
    const cachedCases = readHomeCasesCache(uid)
    if (cachedCases.length > 0) {
      applyCasesList(cachedCases, { fromCache: true })
      loading.value = false
    }
  }
  if (!dataReady.value) loading.value = true
  try {
    const list = await getCases(uid, {
      mode: 'home',
      detailCaseId: getActiveCaseId() || activeCaseId.value
    })
    applyCasesList(list)
    writeHomeCasesCache(uid, cases.value)
    indexAILog('loadData_applied', {
      caseCount: Array.isArray(list) ? list.length : 0,
      latestCaseIdTail: shortId(latestCase.value?.caseId || latestCase.value?._id),
      latestAssessmentTail: shortId(latestCase.value?.latestResult?.assessmentId || latestCase.value?.latestResult?._id),
      latestRecordTail: shortId(latestCase.value?.latestResult?.triggerEventId),
      latestAiPending: Boolean(latestCase.value?.latestResult?.aiPending),
      latestAiFailed: Boolean(latestCase.value?.latestResult?.aiFailed),
      latestAiUsed: latestCase.value?.latestResult?.aiUsed
    })
    refreshSelfProfileInBackground()
    maybeResumePendingAssessmentAI('loadData')
  } catch (e: any) {
    indexAILog('loadData_error', { message: e?.message || String(e || '') })
    showError(e?.message || '加载失败')
  } finally {
    indexAILog('loadData_finally')
    loading.value = false
    applyPendingOnboardingAction()
  }
}

function applyPendingOnboardingAction() {
  if (!dataReady.value || cases.value.length > 0) return
  const pendingAction = uni.getStorageSync('onboardingAction')
  if (!pendingAction) return
  uni.removeStorageSync('onboardingAction')
  if (pendingAction === 'startAssessment') {
    showFullAssessment.value = true
    showQuickCreate.value = false
  } else if (pendingAction === 'quickCreate') {
    showQuickCreate.value = true
    showFullAssessment.value = false
  }
  // 'dismiss' 不打开任何表单，用户看首页空状态
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
        bumpDataVersion()
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
  const name = clean.split('/').pop()
  if (name && !name.startsWith('tmp_') && !name.startsWith('wxfile://')) return name
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `IMG_${ts}.jpg`
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
      recordingSeconds.value = 60
	      voiceStatus.value = '正在录音 1:00 · 再点一次结束'
	      recordingTimer = setInterval(() => {
	        const elapsed = Math.floor((Date.now() - recordStartedAt) / 1000)
	        const remain = Math.max(0, 60 - elapsed)
	        recordingSeconds.value = remain
	        const m = Math.floor(remain / 60)
	        const s = remain % 60
	        voiceStatus.value = `正在录音 ${m}:${String(s).padStart(2, '0')} · 再点一次结束`
	        if (remain <= 0) {
	          manager.stop()
	        }
	      }, 200)
    })
    recorderManager.onStop((res: any = {}) => {
      recording.value = false
	      if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
      handleVoiceRecordStop(res)
    })
    recorderManager.onError((error: any = {}) => {
      recording.value = false
      voiceUploading.value = false
	      voiceStatus.value = ''
	      if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
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
    // 先确保隐私协议已同意（微信 2023.09 起要求）
    const doAuthorize = () => {
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
    }

    const wxApi = (globalThis as any)?.wx
    if (wxApi?.requirePrivacyAuthorize) {
      wxApi.requirePrivacyAuthorize({
        success: () => doAuthorize(),
        fail: () => reject(new Error('需要同意隐私政策后才能使用录音功能'))
      })
    } else {
      doAuthorize()
    }
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
    fail: (err: any = {}) => {
      const msg = String(err?.errMsg || err?.message || '')
      if (!msg.includes('cancel')) showError(msg || '无法打开相册，请检查相册权限')
    },
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
          const url = await getTempFileURL(fileID).catch(() => '')
          uploaded.push({
            type: 'image',
            fileID,
            name: getFileName(filePath, `图片${quickAttachments.value.length + uploaded.length + 1}`),
            size: file.size || 0,
            url
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

function formatTimelineDateForDisplay(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hour = String(parsed.getHours()).padStart(2, '0')
  const minute = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function applyPendingQuickFeedback(params: {
  caseId: string
  recordId: string
  assessmentId: string
  eventType: string
  eventTitle: string
  description: string
  subjectRole: 'target' | 'self' | 'both'
  subjectRoleConfidence: string
  userQuestion?: { key: string; label: string }
  attachments: any[]
  occurrenceAt: string
}) {
  const caseIndex = cases.value.findIndex((item: any) => item.caseId === params.caseId || item._id === params.caseId)
  if (caseIndex < 0) {
    indexAILog('applyPendingQuickFeedback_case_missing', {
      caseIdTail: shortId(params.caseId),
      recordIdTail: shortId(params.recordId),
      assessmentIdTail: shortId(params.assessmentId),
      currentCaseCount: cases.value.length
    })
    return
  }

  const current = cases.value[caseIndex]
  const previousResult = current.latestResult || {}
  const nowIso = new Date().toISOString()
  const pendingResult = {
    ...previousResult,
    _id: params.assessmentId,
    assessmentId: params.assessmentId,
    createdAt: nowIso,
    source: 'ai_pending',
    triggerEventId: params.recordId,
    triggerEventTitle: params.eventTitle,
    triggerEventType: params.eventType,
    rawReply: '',
    userQuestion: params.userQuestion || null,
    actionAdvice: null,
    eventInsight: null,
    currentStatus: null,
    aiUsed: false,
    aiPending: true,
    aiFailed: false,
    previousAssessmentId: previousResult._id || previousResult.assessmentId || current.latestResultId,
    explanation: {
      headline: 'AI 正在分析这次记录。',
      bullets: [],
      cautions: ['后台正在生成即时反馈，完成后会自动更新。']
    }
  }
  const pendingRecord = {
    _id: params.recordId,
    id: params.recordId,
    title: params.eventTitle,
    type: params.eventType,
    subjectRole: params.subjectRole,
    subjectRoleConfidence: params.subjectRoleConfidence,
    userQuestion: params.userQuestion || null,
    description: params.description,
    attachments: params.attachments,
    occurrenceAt: params.occurrenceAt,
    createdAt: nowIso,
    date: formatTimelineDateForDisplay(params.occurrenceAt),
    dateLabel: formatTimelineDateForDisplay(params.occurrenceAt),
    aiUsed: false
  }
  const assessments = [
    ...(Array.isArray(current.assessments) ? current.assessments.filter((item: any) => (item._id || item.assessmentId) !== params.assessmentId) : []),
    pendingResult
  ]
  const timeline = [
    pendingRecord,
    ...(Array.isArray(current.timeline) ? current.timeline.filter((item: any) => (item._id || item.id) !== params.recordId) : [])
  ]

  const nextCases = [...cases.value]
  nextCases[caseIndex] = {
    ...current,
    latestResultId: params.assessmentId,
    latestResult: pendingResult,
    assessments,
    timeline,
    updatedAt: nowIso
  }
  cases.value = nextCases
  activeCaseId.value = params.caseId
  setActiveCaseId(params.caseId)
  bumpDataVersion()
  indexAILog('applyPendingQuickFeedback_done', {
    caseIdTail: shortId(params.caseId),
    recordIdTail: shortId(params.recordId),
    assessmentIdTail: shortId(params.assessmentId)
  })
}

function getPendingAssessmentPayload() {
  const current = latestCase.value || {}
  const result = current.latestResult || {}
  if (!result.aiPending) return null

  const caseId = String(current.caseId || current._id || '').trim()
  const assessmentId = String(result.assessmentId || result._id || current.latestResultId || '').trim()
  const recordId = String(result.triggerEventId || result.recordId || '').trim()
  if (!caseId || !assessmentId) return null

  return { caseId, assessmentId, recordId: recordId || undefined }
}

function maybeResumePendingAssessmentAI(reason = '') {
  if (aiFeedbackLoading.value) {
    indexAILog('resume_skip_loading', { reason })
    return
  }
  const payload = getPendingAssessmentPayload()
  if (!payload) {
    indexAILog('resume_skip_no_pending', {
      reason,
      latestAiPending: Boolean(latestCase.value?.latestResult?.aiPending),
      latestCaseIdTail: shortId(latestCase.value?.caseId || latestCase.value?._id),
      latestAssessmentTail: shortId(latestCase.value?.latestResult?.assessmentId || latestCase.value?.latestResult?._id)
    })
    return
  }

  const key = `${payload.caseId}:${payload.assessmentId}:${payload.recordId || ''}`
  if (pendingAIInFlightKey.value === key) {
    indexAILog('resume_skip_in_flight', { reason, keyTail: shortId(key) })
    return
  }

  const retryCount = pendingAIRetryCounts.get(key) || 0
  if (retryCount >= 2) {
    indexAILog('resume_skip_retry_limit', { reason, keyTail: shortId(key), retryCount })
    return
  }

  pendingAIRetryCounts.set(key, retryCount + 1)
  pendingAIInFlightKey.value = key
  indexAILog('resume_start', {
    reason,
    caseIdTail: shortId(payload.caseId),
    assessmentIdTail: shortId(payload.assessmentId),
    recordIdTail: shortId(payload.recordId),
    retryCount: retryCount + 1
  })
  runAssessmentAI(payload).finally(() => {
    if (pendingAIInFlightKey.value === key) pendingAIInFlightKey.value = ''
    indexAILog('resume_finished', { reason, keyTail: shortId(key) })
  })
}

async function submitQuickRecord() {
  if (quickSubmitting.value) {
    indexAILog('submit_skip_submitting')
    return
  }
  if (!quickDesc.value.trim()) {
    showError('请填写描述')
    return
  }
  if (!latestCase.value?.caseId) {
    indexAILog('submit_skip_no_case', { caseCount: cases.value.length })
    return
  }
  quickSubmitting.value = true
  try {
    const desc = quickDesc.value.trim()
    const currentCaseId = latestCase.value.caseId
    const currentSubjectRole = quickSubjectRole.value
    const currentSubjectRoleConfidence = quickSubjectRoleConfidence.value === 'user_selected' ? 'user_selected' : 'confirmed'
    const currentUserQuestion = getQuickQuestionPayload()
    if (!currentUserQuestion) {
      showError('请填写你想问的问题')
      return
    }
    const currentAttachments = quickAttachments.value.map(({ url: _url, ...item }: any) => item)
    const currentOccurrenceAt = combineDateAndTimeToISOString(quickDate.value, quickTime.value)
    indexAILog('submit_start', {
      caseIdTail: shortId(currentCaseId),
      descLength: desc.length,
      subjectRole: currentSubjectRole,
      attachmentCount: currentAttachments.length,
      hasQuestion: Boolean(currentUserQuestion)
    })
    const res = await createTimeline({
      userId: userId.value,
      caseId: currentCaseId,
      description: desc,
      subjectRole: currentSubjectRole,
      subjectRoleConfidence: currentSubjectRoleConfidence,
      userQuestion: currentUserQuestion,
      chatSelfName: quickChatSelfName.value.trim() || undefined,
      chatTargetName: quickChatTargetName.value.trim() || undefined,
      attachments: currentAttachments,
      occurrenceAt: currentOccurrenceAt
    })
    indexAILog('createTimeline_result', {
      success: Boolean(res?.success),
      code: res?.code || '',
      message: res?.message || '',
      aiPending: Boolean(res?.aiPending),
      aiUsed: res?.aiUsed,
      caseIdTail: shortId(currentCaseId),
      recordIdTail: shortId(res?.recordId),
      assessmentIdTail: shortId(res?.assessmentId)
    })
    if (res.success) {
      showSuccess('已记录，AI分析中')
      quickDesc.value = ''
      quickQuestionKey.value = 'like'
      quickCustomQuestion.value = ''
      quickChatSelfName.value = ''
      quickChatTargetName.value = ''
      quickSubjectRole.value = 'target'
      quickSubjectRoleConfidence.value = 'auto'
      quickAttachments.value = []
      quickDate.value = getDateInputValue()
      quickTime.value = getTimeInputValue()
      quickFeedback.value = {
        caseId: currentCaseId,
        eventType: res.eventType || latestCase.value?.latestResult?.triggerEventType || 'note',
        recordId: res.recordId,
        assessmentId: res.assessmentId,
        description: desc
      }
      if (res.recordId) {
        setPendingTimelineContext({
          caseId: currentCaseId,
          classified: true,
          eventType: res.eventType || 'note',
          recorded: true,
          targetEventId: res.recordId
        })
      }
      if (res.aiPending && res.assessmentId) {
        applyPendingQuickFeedback({
          caseId: currentCaseId,
          recordId: res.recordId,
          assessmentId: res.assessmentId,
          eventType: res.eventType || 'note',
          eventTitle: res.eventTitle || '最新记录',
          description: desc,
          subjectRole: currentSubjectRole,
          subjectRoleConfidence: currentSubjectRoleConfidence,
          userQuestion: currentUserQuestion,
          attachments: currentAttachments,
          occurrenceAt: currentOccurrenceAt
        })
        indexAILog('submit_run_ai', {
          caseIdTail: shortId(currentCaseId),
          recordIdTail: shortId(res.recordId),
          assessmentIdTail: shortId(res.assessmentId)
        })
        runAssessmentAI({
          caseId: currentCaseId,
          assessmentId: res.assessmentId,
          recordId: res.recordId
        })
      } else {
        indexAILog('submit_no_ai_pending', {
          aiPending: Boolean(res.aiPending),
          hasAssessmentId: Boolean(res.assessmentId)
        })
        await loadData()
      }
    } else {
      showError(res.message || '保存失败')
    }
  } catch (e: any) {
    indexAILog('submit_error', { message: e?.message || String(e || '') })
    showError(e?.message || '保存失败')
  } finally {
    indexAILog('submit_finally')
    quickSubmitting.value = false
  }
}

async function runAssessmentAI(payload: { caseId: string; assessmentId: string; recordId?: string }) {
  if (aiFeedbackLoading.value) {
    indexAILog('run_ai_skip_loading', {
      caseIdTail: shortId(payload.caseId),
      assessmentIdTail: shortId(payload.assessmentId),
      recordIdTail: shortId(payload.recordId)
    })
    return
  }
  // 幂等保护：已处理过的 assessment 不再重复触发 AI
  if (latestCase.value?.latestResult?.aiUsed) {
    indexAILog('run_ai_skip_already_done', {
      caseIdTail: shortId(payload.caseId),
      assessmentIdTail: shortId(payload.assessmentId)
    })
    return
  }
  aiFeedbackLoading.value = true
  applyPetScene('ai_loading')
  startAIFeedbackTimer()
  try {
    indexAILog('run_ai_start', {
      caseIdTail: shortId(payload.caseId),
      assessmentIdTail: shortId(payload.assessmentId),
      recordIdTail: shortId(payload.recordId)
    })
    const aiRes = await generateAssessmentAI(payload)
    indexAILog('run_ai_result', {
      success: Boolean(aiRes?.success),
      code: aiRes?.code || '',
      message: aiRes?.message || '',
      aiUsed: aiRes?.aiUsed,
      hasLatestResult: Boolean(aiRes?.latestResult),
      latestAiPending: Boolean(aiRes?.latestResult?.aiPending),
      latestAiFailed: Boolean(aiRes?.latestResult?.aiFailed),
      assessmentIdTail: shortId(aiRes?.assessmentId || payload.assessmentId),
      recordIdTail: shortId(aiRes?.recordId || payload.recordId)
    })
    if (aiRes?.code === 'INSUFFICIENT_BALANCE') {
      applyPetScene('insufficient_balance')
      handleInsufficientBalance(aiRes)
      await loadData()
      return
    }
    if (!aiRes?.success) {
      applyPetScene('ai_error', 3000)
      showError(aiRes?.message || 'AI即时反馈生成失败')
      await loadData()
      return
    }
    await loadData()
    const scene = feedbackPetScene.value
    if (scene) {
      const expl = latestCase.value?.latestResult?.explanation
      const msg = expl?.petLine || expl?.bullets?.[0]
      applyPetScene(scene, 5000, msg || undefined)
    }
    showSuccess('AI即时反馈已更新')
  } catch (error: any) {
    indexAILog('run_ai_error', { message: error?.message || String(error || '') })
    applyPetScene('ai_error', 3000)
    showError(error?.message || 'AI即时反馈生成失败')
    await loadData()
  } finally {
    aiFeedbackLoading.value = false
    stopAIFeedbackTimer()
    indexAILog('run_ai_finally', {
      caseIdTail: shortId(payload.caseId),
      assessmentIdTail: shortId(payload.assessmentId),
      recordIdTail: shortId(payload.recordId)
    })
  }
}


function goCaseDetail(caseId: string) {
  setActiveCaseId(caseId)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

// Taohua teaser
const showTaohuaTeaser = ref(true)
const statusInfoVisible = ref(false)
const showTaohuaInfo = ref(false)
const taohuaTeaserData = ref<{ score: number; direction: string; directionZhi: string; hongluanDir: string; tianxiDir: string; jianchu: string; summary: string; guidance: string } | null>(null)

async function loadTaohuaTeaser() {
  const profile = selfProfile.value || {}


  try {
    const result = await queryTaohua(profile.zodiac || '', profile.constellation || '', profile.gender || '')
    if (!result?.success || !result?.data?.daily?.ganzhi?.dayZhi) {
      taohuaTeaserData.value = null
      return
    }

    const daily = result.data.daily
    const dayZhi = daily.ganzhi.dayZhi
    const taohua = xianchiAlgorithm(dayZhi)
    const hongluan = profile.zodiac ? hongluanTianxi(profile.zodiac) : null
    const scoreData = result.data.score || {}
    const guide = result.data.practical?.约会指南 || {}
    const score = Number(scoreData.分数 ?? 50)
    const jianchu = daily.yiji?.jianchu || guide.建除 || '--'
    const summary = scoreData.评级 || (score >= 70 ? '气场佳，适合行动' : score >= 50 ? '平常心，顺其自然' : '宜观望，改天再约')
    const guidance = guide.一句话 || `今日往${taohua.direction}方向约会有利。`

    taohuaTeaserData.value = {
      score,
      direction: taohua.direction,
      directionZhi: taohua.taohua_zhi,
      hongluanDir: hongluan?.hongluan?.direction || '',
      tianxiDir: hongluan?.tianxi?.direction || '',
      jianchu,
      summary,
      guidance,
    }
    showTaohuaTeaser.value = true
  } catch (_) {
    taohuaTeaserData.value = null
  }
}

function goTaohua() {
  if (!hasUsableSelfProfile(selfProfile.value)) {
    uni.showModal({
      title: '画像未完善',
      content: '完善本人画像后，命理分析会更准确好看。是否前往完善？',
      confirmText: '去完善',
      cancelText: '取消',
      success: (res: any) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/self-profile/self-profile' })
        }
      }
    })
    return
  }
  uni.navigateTo({ url: '/pages/taohua/taohua' })
}
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
/* ===== CAMPUS POP V2 Styles ===== */
.v2-mode { background: var(--app-bg, #FFFDF5) !important; }
.v2-mode .loading { text-align: center; padding: 120rpx 0; font-size: $fs-heading; font-weight: $fw-hero; color: #111; letter-spacing: 4rpx; }

.v2-mode .hero-block {
  background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111;
  padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg);
}
.v2-mode .hero-tag { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: $fs-caption; font-weight: $fw-heading; letter-spacing: 2rpx; margin-bottom: 14rpx; }
.v2-mode .hero-title { display: block; font-size: $fs-hero-title; font-weight: $fw-hero; color: #111; line-height: $lh-hero; letter-spacing: 0; text-transform: uppercase; }
.v2-mode .hero-title .hl { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-identity { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; }
.v2-mode .profile-avatar-v2 { border-radius: 50%; overflow: hidden; border: 3rpx solid #111; background: #FFD93D; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.v2-mode .profile-avatar-v2.sm { width: 68rpx; height: 68rpx; }
.v2-mode .profile-avatar-v2 image { width: 100%; height: 100%; }
.v2-mode .avatar-placeholder-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.v2-mode .hero-identity-name { font-size: $fs-heading; font-weight: $fw-heading; color: #111; }
.v2-mode .role-hint-v2 { display: block; margin-top: 8rpx; font-size: $fs-caption; font-weight: $fw-body; color: #999; }

.v2-mode .hero-copy { display: block; margin-top: 14rpx; font-size: $fs-body; font-weight: $fw-body; color: #555; line-height: 1.5; }
.v2-mode .hero-copy .strong { color: #111; font-weight: $fw-hero; }
.v2-mode .crush-type-panel { margin: 16rpx 0; padding: 20rpx; border: 3rpx solid #111; background: #FFFBEB; box-shadow: 4rpx 4rpx 0 #111; }
.v2-mode .crush-type-kicker { display: block; font-size: $fs-body; font-weight: $fw-heading; color: #666; text-transform: uppercase; letter-spacing: 2rpx; }
.v2-mode .crush-type-label { display: block; margin-top: 4rpx; font-size: $fs-heading; font-weight: $fw-hero; color: #111; line-height: 1.1; }
.v2-mode .crush-type-summary { display: block; margin-top: 8rpx; font-size: $fs-body; font-weight: $fw-body; color: #111; line-height: 1.45; }
.v2-mode .crush-type-action { display: block; margin-top: 10rpx; padding-top: 10rpx; border-top: 2rpx solid #111; font-size: $fs-body; font-weight: $fw-body; color: #666; line-height: 1.5; }

.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .tag-row-v2.compact { margin-top: 0; margin-bottom: 12rpx; }
.v2-mode .tag-v2 { @include tag-v2; min-height: 34rpx; padding: 4rpx 12rpx; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }
.v2-mode .quick-feedback-signal-v2 { font-size: $fs-body; }

.v2-mode .record-block { background: #f9f9f9; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }
.v2-mode .block-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.v2-mode .block-title { font-size: $fs-heading; font-weight: $fw-heading; color: #111; text-transform: uppercase; }
.v2-mode .block-badge { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: $fs-caption; font-weight: $fw-heading; color: #111; letter-spacing: 1rpx; }
.v2-mode .block-badge.black { background: #111; color: #fff; }
.v2-mode .btn-share-sm { flex: none; width: 48rpx; height: 48rpx; border: 2rpx solid #111; background: #fff; display: flex; align-items: center; justify-content: center; padding: 0; }
.v2-mode .btn-share-sm::after { border: none; }
.v2-mode .analysis-head { padding-right: 64rpx; box-sizing: border-box; }
.v2-mode .analysis-share-btn { position: absolute; top: 24rpx; right: 24rpx; z-index: 2; background: #FFFBEA; }
.v2-mode .analysis-share-icon { width: 28rpx; height: 28rpx; display: block; }

.v2-mode .text-area-v2 { width: 100%; min-height: 140rpx; padding: 18rpx; background: #fff; border: 3rpx solid #111; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.45; box-sizing: border-box; font-family: inherit; }
.v2-mode .text-area-v2.chat-mode { min-height: 360rpx; max-height: 640rpx; font-size: $fs-body; }
.v2-mode .text-area-v2::placeholder { font-size: $fs-body-lg; font-weight: $fw-body; color: #777; }
.v2-mode .quick-desc-debug-v2 { display: block; margin-top: 8rpx; font-size: $fs-caption; font-weight: $fw-body; color: #999; line-height: 1.4; word-break: break-all; }

.v2-mode .role-row { display: flex; align-items: center; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .role-main-v2 { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10rpx; }
.v2-mode .role-label { flex-shrink: 0; font-size: $fs-body; font-weight: $fw-body; color: #555; }
.v2-mode .role-options { min-width: 0; display: flex; gap: 6rpx; }
.v2-mode .role-chip { padding: 8rpx 12rpx; border: 2rpx solid #111; background: #fff; font-size: $fs-body; font-weight: $fw-body; color: #555; white-space: nowrap; }
.v2-mode .role-chip.active { background: #111; color: #FFD93D; font-weight: $fw-heading; }
.v2-mode .quick-tool-row-v2 { flex-shrink: 0; display: flex; align-items: center; gap: 8rpx; }
.v2-mode .quick-tool-btn-v2 {
  width: 56rpx;
  height: 56rpx;
  min-width: 56rpx;
  padding: 0;
  border: 2rpx solid #111;
  background: #fff;
  box-shadow: 2rpx 2rpx 0 #111;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.v2-mode .quick-tool-btn-v2::after { border: none; }
.v2-mode .quick-tool-btn-v2[disabled] { opacity: .52; box-shadow: none; }
.v2-mode .quick-tool-btn-v2.recording { width: 112rpx; background: #FF6B6B; color: #fff; }
.v2-mode .quick-tool-icon-v2 { font-size: $fs-heading; font-weight: $fw-heading; color: #111; line-height: 1; }
.v2-mode .quick-mic-icon-v2 {
  position: relative;
  width: 18rpx;
  height: 26rpx;
  border: 3rpx solid #111;
  border-radius: 12rpx;
  box-sizing: border-box;
}
.v2-mode .quick-mic-icon-v2::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -12rpx;
  width: 3rpx;
  height: 10rpx;
  background: #111;
  transform: translateX(-50%);
}
.v2-mode .quick-mic-icon-v2::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -16rpx;
  width: 22rpx;
  height: 10rpx;
  border-bottom: 3rpx solid #111;
  border-left: 3rpx solid #111;
  border-right: 3rpx solid #111;
  border-radius: 0 0 14rpx 14rpx;
  transform: translateX(-50%);
  box-sizing: border-box;
}
.v2-mode .quick-voice-active-v2 { display: flex; align-items: center; justify-content: center; gap: 6rpx; width: 100%; }
.v2-mode .quick-voice-wave-v2 { display: flex; align-items: center; gap: 3rpx; height: 28rpx; }
.v2-mode .quick-wave-bar-v2 {
  width: 5rpx;
  height: 10rpx;
  background: #fff;
  animation: wave-bounce-sm 0.5s ease-in-out infinite alternate;
}
.v2-mode .quick-wave-bar-v2:nth-child(2) { animation-delay: 0.12s; }
.v2-mode .quick-wave-bar-v2:nth-child(3) { animation-delay: 0.24s; }
.v2-mode .quick-voice-time-v2 { font-size: $fs-micro; font-weight: $fw-heading; color: #fff; font-variant-numeric: tabular-nums; line-height: 1; }
.v2-mode .voice-status-v2 { display: block; margin-top: 10rpx; font-size: $fs-caption; font-weight: $fw-body; color: #666; }

@media (max-width: 360px) {
  .v2-mode .role-row { gap: 6rpx; }
  .v2-mode .role-main-v2 { gap: 6rpx; }
  .v2-mode .role-label { max-width: 128rpx; overflow: hidden; white-space: nowrap; }
  .v2-mode .role-chip { padding: 7rpx 9rpx; }
  .v2-mode .quick-tool-row-v2 { gap: 6rpx; }
  .v2-mode .quick-tool-btn-v2 { width: 52rpx; height: 52rpx; min-width: 52rpx; }
  .v2-mode .quick-tool-btn-v2.recording { width: 104rpx; }
}
.v2-mode .quick-question-block-v2 { margin-top: 16rpx; padding: 16rpx; border: 2rpx dashed #111; background: #fff; }
.v2-mode .quick-question-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-heading; color: #111; margin-bottom: 10rpx; }
.v2-mode .quick-question-list-v2 { display: flex; flex-direction: column; gap: 8rpx; }
.v2-mode .quick-question-option-v2 {
  min-height: 54rpx;
  padding: 0 14rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  border: 2rpx solid transparent;
  background: #f9f9f9;
  box-sizing: border-box;
}
.v2-mode .quick-question-option-v2.active {
  border-color: #111;
  background: #FFFBEB;
}
.v2-mode .quick-question-dot-v2 {
  width: 18rpx;
  height: 18rpx;
  border: 2rpx solid #111;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
  flex-shrink: 0;
}
.v2-mode .quick-question-option-v2.active .quick-question-dot-v2 {
  background: #111;
  box-shadow: inset 0 0 0 4rpx #FFD93D;
}
.v2-mode .quick-question-label-v2 { flex: 1; min-width: 0; font-size: $fs-body; font-weight: $fw-body; color: #555; line-height: 1.35; }
.v2-mode .quick-question-option-v2.active .quick-question-label-v2 { color: #111; font-weight: $fw-heading; }
.v2-mode .quick-question-check-v2 { flex-shrink: 0; font-size: $fs-body; font-weight: $fw-heading; color: #111; }
.v2-mode .quick-question-hint-v2 { display: block; margin-top: 10rpx; font-size: $fs-caption; font-weight: $fw-body; color: #999; line-height: 1.4; }
.v2-mode .quick-chat-names-v2 { display: flex; flex-wrap: wrap; align-items: center; gap: 10rpx; margin-top: 10rpx; padding: 12rpx; border: 2rpx dashed #ccc; background: #fafafa; }
.v2-mode .quick-chat-name-input-v2 { flex: 1; min-width: 0; height: 56rpx; padding: 0 14rpx; border: 2rpx solid #111; font-size: $fs-body; font-weight: $fw-body; color: #111; background: #fff; box-sizing: border-box; }
.v2-mode .quick-chat-name-sep-v2 { font-size: $fs-body; font-weight: $fw-body; color: #999; flex-shrink: 0; }
.v2-mode .quick-chat-name-hint-v2 { width: 100%; font-size: $fs-caption; font-weight: $fw-body; color: #999; line-height: 1.3; }
.v2-mode .quick-custom-question-input-v2 {
  width: 100%;
  height: 64rpx;
  margin-top: 10rpx;
  padding: 0 16rpx;
  border: 2rpx solid #111;
  background: #fff;
  box-sizing: border-box;
  font-size: $fs-body;
  font-weight: $fw-body;
  color: #111;
}

.v2-mode .datetime-row-v2 { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .picker-v2 { height: 56rpx; line-height: 56rpx; padding: 0 20rpx; border: 3rpx solid #111; background: #fff; font-size: $fs-body; font-weight: $fw-body; color: #111; }

/* Image thumbnail grid */
.v2-mode .attach-row { display: flex; gap: 10rpx; margin-top: 16rpx; }
.v2-mode .img-grid-v2 { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 14rpx; }
.v2-mode .img-box-v2 { width: 160rpx; height: 160rpx; position: relative; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; border-radius: 4rpx; }
.v2-mode .img-preview-v2 { width: 100%; height: 100%; }
.v2-mode .img-del-v2 { position: absolute; top: -12rpx; right: -12rpx; width: 44rpx; height: 44rpx; border-radius: 50%; background: #FF5252; color: #fff; font-size: $fs-body; font-weight: $fw-hero; text-align: center; line-height: 44rpx; border: 2rpx solid #111; }


.v2-mode .ai-bar { display: flex; flex-direction: column; align-items: flex-start; gap: 14rpx; margin-top: 16rpx; padding: 16rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .ai-row { display: flex; align-items: center; gap: 14rpx; }
.v2-mode .ai-dot { width: 20rpx; height: 20rpx; border: 2rpx solid #111; background: #FFD93D; display: inline-block; animation: blink-dot 1s ease-in-out infinite; }
.v2-mode .ai-text { font-size: $fs-body; font-weight: $fw-body; color: #111; }
@keyframes blink-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.75); }
}

.v2-mode .feedback-block { position: relative; background: #fff; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; }
.v2-mode .feedback-block.ok { border-left: 12rpx solid #4ECDC4; }
.v2-mode .feedback-block.warn { border-left: 12rpx solid #FF6B6B; }
.v2-mode .question-context-v2 { display: inline-flex; max-width: 100%; min-height: 42rpx; align-items: center; padding: 0 14rpx; margin-bottom: 12rpx; border: 2rpx solid #111; background: #FFD93D; box-sizing: border-box; font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .feedback-desc { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: #111; line-height: 1.5; margin-bottom: 16rpx; }

.v2-mode .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 14rpx; }
.v2-mode .score-item { padding: 20rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .score-label-v2 { display: block; font-size: $fs-caption; font-weight: $fw-heading; color: #555; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .score-num-v2 { display: block; font-size: $fs-display; font-weight: $fw-hero; color: #111; line-height: 1; margin-top: 6rpx; }
.v2-mode .score-num-v2.risk { color: #FF5252; }
.v2-mode .score-bucket-v2 { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #666; margin-top: 4rpx; }
.v2-mode .bar-track-v2 { height: 12rpx; background: #fff; margin-top: 12rpx; border: 2rpx solid #111; overflow: hidden; box-sizing: border-box; }
.v2-mode .bar-fill-v2 { height: 100%; background: #4ECDC4; }
.v2-mode .bar-fill-v2.risk { background: #FF5252; }

.v2-mode .score-delta-v2 { display: block; margin-top: 8rpx; font-size: $fs-body; }
.v2-mode .score-delta-label { font-weight: $fw-body; color: #999; margin-right: 4rpx; }
.v2-mode .score-delta-val { font-weight: $fw-hero; color: #111; }
.v2-mode .score-delta-val.up { color: #4ECDC4; }
.v2-mode .score-delta-val.down { color: #FF5252; }
.v2-mode .score-delta-val.flat { color: #999; }

.v2-mode .reason-box { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .reason-line { display: block; font-size: $fs-body; font-weight: $fw-body; color: #111; line-height: $lh-loose; }

.v2-mode .action-box { margin-top: 16rpx; padding: 18rpx; border: 2rpx solid #111; background: #f5f5ff; }
.v2-mode .action-label { display: block; font-size: $fs-body; font-weight: $fw-heading; color: #111; text-transform: uppercase; letter-spacing: 1rpx; margin-bottom: 12rpx; }
.v2-mode .action-text { font-size: $fs-body; color: #555; line-height: 1.5; }
.v2-mode .action-text.muted { color: #666; }
.v2-mode .action-item { padding: 14rpx 0; border-bottom: 2rpx solid rgba(0,0,0,0.08); background: transparent; margin-top: 0; }
.v2-mode .action-item:last-child { border-bottom: none; padding-bottom: 0; }
.v2-mode .action-item-label { display: block; font-size: $fs-body; font-weight: $fw-heading; color: #111; }
.v2-mode .action-item-text { display: block; font-size: $fs-body; color: #666; margin-top: 6rpx; line-height: 1.5; }

.v2-mode .ai-badge { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; padding: 10rpx 14rpx; border: 2rpx solid #111; }
.v2-mode .ai-badge.ai { background: #e8f5e9; }
.v2-mode .ai-badge.fallback { background: #fff3e0; }
.v2-mode .ai-badge-dot { width: 12rpx; height: 12rpx; border-radius: 50%; border: 2rpx solid #111; flex-shrink: 0; }
.v2-mode .ai-badge.ai .ai-badge-dot { background: #4caf50; }
.v2-mode .ai-badge.fallback .ai-badge-dot { background: #ff9800; }
.v2-mode .ai-badge-text { font-size: $fs-body; font-weight: $fw-body; color: #111; }

.v2-mode .side-box { margin-top: 20rpx; padding: 18rpx; border: 2rpx dashed #111; background: #FFFBEB; }
.v2-mode .side-title { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; margin-bottom: 10rpx; text-transform: uppercase; letter-spacing: 2rpx; }

.v2-mode .info-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; }
.v2-mode .info-modal-v2 { width: 100%; max-height: 80vh; overflow: hidden; background: #fff; border: 3rpx solid #111; box-shadow: 10rpx 10rpx 0 #111; }
.v2-mode .info-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 3rpx solid #111; }
.v2-mode .info-title-v2 { font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.v2-mode .info-close { width: 48rpx; height: 48rpx; line-height: 46rpx; text-align: center; border: 2rpx solid #111; font-size: $fs-heading; font-weight: $fw-hero; color: #111; }
.v2-mode .info-body-v2 { max-height: 60vh; padding: 20rpx 24rpx 24rpx; box-sizing: border-box; }
.v2-mode .info-section-v2 { padding: 20rpx; border: 2rpx solid #111; margin-top: 16rpx; }
.v2-mode .info-section-v2.ylw { background: #FFFBEB; }
.v2-mode .info-sec-title { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; margin-bottom: 10rpx; }
.v2-mode .info-sec-copy { display: block; font-size: $fs-body; color: #999; line-height: $lh-loose; margin-top: 6rpx; }
.v2-mode .info-sec-copy.strong { font-weight: $fw-body; color: #111; }
.v2-mode .info-tag-row { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; border-top: 2rpx solid #111; }
.v2-mode .info-chip { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .info-chip.muted { background: #111; }
.v2-mode .info-chip-copy { flex: 1; }
.v2-mode .info-chip-title { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.v2-mode .info-chip-desc { display: block; font-size: $fs-body; color: #666; line-height: 1.5; margin-top: 4rpx; }

.page {
  min-height: 100vh;
  background: var(--app-bg, #f4ede2);
  padding: var(--spacing-page, 24rpx);
  box-sizing: border-box;
}

/* pet floating bar */
.v2-mode .pet-bar {
  position: fixed;
  bottom: calc(124rpx + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  z-index: 100;
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx 24rpx;
  pointer-events: none;
}
.v2-mode .pet-bar-img { width: 96rpx; height: 96rpx; flex-shrink: 0; pointer-events: auto; }
.v2-mode .pet-sprite-viewport {
  width: 96rpx;
  height: 104rpx;
  overflow: hidden;
  flex-shrink: 0;
  pointer-events: auto;
}
.v2-mode .pet-sprite-sheet {
  display: block;
  max-width: none;
  transform-origin: left top;
  pointer-events: none;
  will-change: transform;
}
.v2-mode .pet-bar .pet-bubble { pointer-events: auto; }
.v2-mode .pet-bubble {
  position: relative;
  background: #fff; border: 2rpx solid #111;
  padding: 14rpx 20rpx; max-width: 420rpx;
}
.v2-mode .pet-bubble::before {
  content: ''; position: absolute;
  left: -16rpx; bottom: 28rpx;
  border: 10rpx solid transparent;
  border-right-color: #111; border-left: 0;
}
.v2-mode .pet-bubble::after {
  content: ''; position: absolute;
  left: -14rpx; bottom: 28rpx;
  border: 9rpx solid transparent;
  border-right-color: #fff; border-left: 0;
}
.v2-mode .pet-bubble-text { font-size: $fs-body; font-weight: $fw-body; color: #111; line-height: 1.5; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

.v2-mode .voice-recording-btn {
  background: #FF6B6B !important; color: #fff !important;
  display: flex; align-items: center; justify-content: center;
  height: auto; min-height: 72rpx; padding: 12rpx 16rpx; flex: 1;
}
.v2-mode .voice-btn-content { display: flex; align-items: center; gap: 10rpx; }
.v2-mode .voice-btn-icon { font-size: $fs-heading; font-weight: $fw-hero; }
.v2-mode .voice-wave-inline { display: flex; align-items: center; gap: 4rpx; height: 32rpx; }
.v2-mode .wave-bar-item-sm {
  width: 6rpx; height: 14rpx; background: #fff;
  animation: wave-bounce-sm 0.5s ease-in-out infinite alternate;
}
.v2-mode .wave-bar-item-sm:nth-child(1) { animation-delay: 0s; }
.v2-mode .wave-bar-item-sm:nth-child(2) { animation-delay: 0.1s; }
.v2-mode .wave-bar-item-sm:nth-child(3) { animation-delay: 0.2s; }
.v2-mode .wave-bar-item-sm:nth-child(4) { animation-delay: 0.3s; }
.v2-mode .wave-bar-item-sm:nth-child(5) { animation-delay: 0.4s; }
.v2-mode .voice-countdown { font-size: $fs-body; font-weight: $fw-hero; font-variant-numeric: tabular-nums; }

@keyframes wave-bounce-sm {
  0% { height: 8rpx; }
  100% { height: 28rpx; }
}

.v2-mode .remind-card-v2 { background: #fff; border: 3rpx solid #111; padding: 20rpx 24rpx; margin-bottom: 16rpx; }
.v2-mode .remind-card-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 6rpx; }
.v2-mode .remind-card-text-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: #666; line-height: 1.5; }

.v2-mode .onboard-options-v2 { display: flex; gap: 14rpx; margin: 12rpx 0; }
.v2-mode .onboard-card-v2 { flex: 1; padding: 20rpx 16rpx; background: #fff; border: 2rpx solid #111; cursor: pointer; }
.v2-mode .onboard-card-v2.primary { border-color: #4ECDC4; background: #f6fffd; }
.v2-mode .onboard-card-title-v2 { display: block; font-size: $fs-body; font-weight: $fw-hero; color: #111; margin-bottom: 6rpx; }
.v2-mode .onboard-card-desc-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: #666; line-height: 1.4; }
.v2-mode .back-link-v2 { display: inline-block; text-align: left; padding: 12rpx 0; margin-bottom: 16rpx; font-size: $fs-heading; font-weight: $fw-body; color: #111; }


/* taohua teaser card */
.v2-mode .taohua-teaser-v2 { background: linear-gradient(135deg, #FFF8E7 0%, #FFFBEB 50%, #FFF5F0 100%); border: 3rpx solid #111; border-left: 12rpx solid #4ECDC4; box-shadow: 8rpx 8rpx 0 #111; padding: 24rpx; margin-bottom: 24rpx; box-sizing: border-box; cursor: pointer; }
.v2-mode .taohua-teaser-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; padding-bottom: 16rpx; border-bottom: 3rpx solid #111; }
.v2-mode .taohua-teaser-head-title { font-size: $fs-heading; font-weight: $fw-heading; color: #111; }
.v2-mode .taohua-teaser-head-score { font-size: $fs-kpi; font-weight: $fw-hero; color: #111; line-height: 1; }
.v2-mode .taohua-teaser-head-unit { font-size: $fs-caption; font-weight: $fw-body; color: #666; margin-left: 4rpx; }
.v2-mode .taohua-teaser-body { padding: 18rpx 0 0; }
.v2-mode .taohua-teaser-dirs { display: flex; gap: 10rpx; margin-bottom: 10rpx; }
.v2-mode .taohua-teaser-dir { flex: 1; min-width: 0; padding: 12rpx 10rpx; border: 2rpx solid #111; background: #FFFBEA; display: flex; align-items: center; gap: 6rpx; box-sizing: border-box; }
.v2-mode .taohua-teaser-dir-emoji { font-size: $fs-body; flex-shrink: 0; }
.v2-mode .taohua-teaser-dir-label { font-size: $fs-micro; font-weight: $fw-heading; color: #111; max-width: 2em; word-break: break-all; line-height: 1.2; }
.v2-mode .taohua-teaser-dir-val { min-width: 0; font-size: $fs-micro; font-weight: $fw-body; color: #111; margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v2-mode .taohua-teaser-guide { display: block; font-size: $fs-body; font-weight: $fw-body; color: #555; margin-bottom: 2rpx; }
.v2-mode .taohua-teaser-guide-text { display: block; font-size: $fs-body; font-weight: $fw-body; color: #555; line-height: 1.5; margin-bottom: 4rpx; }
.v2-mode .taohua-teaser-meta { display: block; font-size: $fs-caption; font-weight: $fw-body; color: #666; }
.v2-mode .taohua-teaser-cta { margin-top: 16rpx; padding: 12rpx 18rpx; border: 2rpx solid #111; background: #FFD93D; box-shadow: 3rpx 3rpx 0 #111; font-size: $fs-body; font-weight: $fw-heading; color: #111; text-align: center; box-sizing: border-box; }
.v2-mode .taohua-teaser-cite { margin-top: 14rpx; padding-top: 10rpx; border-top: 2rpx dashed #111; font-size: $fs-caption; font-weight: $fw-body; color: #777; text-align: center; }
.taohua-info-dot { display: inline-flex; align-items: center; justify-content: center; width: 34rpx; height: 34rpx; border: 2rpx solid #111; font-size: $fs-micro; font-weight: $fw-hero; color: #111; margin-left: 6rpx; cursor: pointer; vertical-align: middle; }
.taohua-info-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); }
.taohua-info-sheet { width: 100%; max-width: 500px; max-height: 65vh; background: #FFFDF5; border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; display: flex; flex-direction: column; overflow: hidden; }
.taohua-info-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; border-bottom: 2rpx solid #111; flex-shrink: 0; }
.taohua-info-title { font-size: $fs-body; font-weight: $fw-hero; color: #111; }
.taohua-info-close { font-size: $fs-heading; font-weight: $fw-hero; color: #111; padding: 0 8rpx; line-height: 1; }
.taohua-info-body { padding: 24rpx 28rpx; overflow-y: auto; flex: 1; }
.taohua-info-item { padding: 14rpx 0; border-bottom: 1rpx dashed #ccc; }
.taohua-info-item:last-child { border-bottom: none; }
.taohua-info-q { display: block; font-size: $fs-body; font-weight: $fw-body; color: #111; margin-bottom: 4rpx; }
.taohua-info-a { display: block; font-size: $fs-body; font-weight: $fw-body; color: #666; line-height: 1.5; }
.taohua-info-divider { height: 12rpx; }
.taohua-info-note { display: block; font-size: $fs-body; color: #999; line-height: 1.5; }


/* Merged card: side read section */
.referral-notice { margin: 0 20rpx 20rpx; padding: 22rpx 24rpx; background: #FFD93D; border: 3rpx solid #111; box-shadow: 4rpx 4rpx 0 #111; }
.referral-notice-text { display: block; font-size: $fs-body-lg; font-weight: $fw-heading; color: #111; text-align: center; }
</style>
