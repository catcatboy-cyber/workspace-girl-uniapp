<template>
  <view :class="['page', showV2 ? 'v2-mode' : '']" :style="themeVars">
    <view class="version-toggle">
      <view :class="['toggle-tab', !showV2 ? 'active' : '']" @click="showV2 = false">经典版</view>
      <view :class="['toggle-tab', showV2 ? 'active' : '']" @click="showV2 = true">新首页</view>
    </view>

    <!-- ========== 经典版 ========== -->
    <block v-if="!showV2">
    <view v-if="loading" class="muted center">加载中...</view>

    <view v-else-if="!caseFile" class="card">
      <text class="h1">时间轴不可用</text>
      <text class="muted">当前对象不存在或已被删除。</text>
    </view>

    <template v-else>
      <view class="hero-card card">
        <text class="hero-topline">关系记录 / {{ caseFile.name }}</text>
        <text class="h1">把真实发生过的互动按时间看清楚</text>
        <text class="hero-subtext">这里专门看事件流，不再放快速记录和额外引导，先把最近发生了什么看明白。</text>
        <view v-if="profileItems.length > 0" class="badges">
          <text v-for="item in profileItems" :key="item" class="badge">{{ item }}</text>
        </view>
      </view>

      <view v-if="classified" class="card status-card" :class="classifiedType === 'risk' ? 'warning' : 'success'">
        <text class="status-strong">{{ mapTimelineTypeLabel(classifiedType) }}</text>
        <text class="muted">{{ mapTimelineTypeMessage(classifiedType) }}</text>
      </view>

      <view v-if="recorded && triggerEvent && latestResult" class="card trend-summary-card">
        <view class="section-head">
          <view>
            <text class="h2">即时反馈</text>
            <text class="muted">这条新记录已经进入评估系统，下面是它带来的即时变化。</text>
          </view>
          <text class="muted">{{ triggerEvent.date }}</text>
        </view>
        <text class="latest-trend-title">{{ triggerEvent.title }}</text>
        <text class="latest-trend-desc">{{ latestResult.explanation?.headline }}</text>
        <view class="feedback-badges">
          <text v-if="triggerEvent.subjectRole" class="badge subject-badge">{{ mapSubjectRoleLabel(triggerEvent.subjectRole) }}</text>
          <text class="badge">{{ mapTimelineTypeLabel(classifiedType) }}</text>
          <text class="badge">{{ mapAction(latestResult.nextAction) }}</text>
          <text class="badge">证据 {{ latestResult.evidenceLevel }}</text>
          <text v-if="isLatestResultAIReviewed" class="ai-badge">AI 已参与研判</text>
        </view>
        <view v-if="triggerImageLinkItems.length > 0" class="instant-attachments">
          <text class="ai-panel-label">图片链接</text>
          <view
            v-for="(item, index) in triggerImageLinkItems"
            :key="item.fileID"
            class="instant-attachment-link"
            @click="previewTriggerImage(index)"
          >
            <text class="instant-link-title">{{ item.name }}</text>
            <text class="instant-link-url" selectable>{{ item.url || '授权链接生成中...' }}</text>
          </view>
        </view>
        <view class="grid two trend-grid">
          <view class="trend-box">
            <text class="case-kpi-label">意向变化</text>
            <text class="trend-number" :class="immediateTrend.intentDirection === 'up' ? 'up' : immediateTrend.intentDirection === 'down' ? 'down' : 'flat'">
              {{ immediateTrend.intentDelta > 0 ? '+' : '' }}{{ immediateTrend.intentDelta }}
            </text>
            <text class="muted">当前 {{ latestResult.intentScore }} / {{ latestResult.intentBucket }}</text>
            <text class="muted">{{ mapDirectionCopy(immediateTrend.intentDirection, '对方主动或投入感在上升', '这次没有继续把关系往前推') }}</text>
          </view>
          <view class="trend-box">
            <text class="case-kpi-label">风险变化</text>
            <text class="trend-number" :class="immediateTrend.riskDirection === 'up' ? 'up' : immediateTrend.riskDirection === 'down' ? 'down' : 'flat'">
              {{ immediateTrend.riskDelta > 0 ? '+' : '' }}{{ immediateTrend.riskDelta }}
            </text>
            <text class="muted">当前 {{ latestResult.consistencyRiskScore }} / {{ latestResult.riskBucket }}</text>
            <text class="muted">{{ mapDirectionCopy(immediateTrend.riskDirection, '一致性风险在抬头', '这次反而让风险稍微回落') }}</text>
          </view>
        </view>
        <text class="trend-summary-text">{{ immediateTrend.summaryText }}</text>
        <text v-if="immediateTrend.warningText" class="trend-warning">{{ immediateTrend.warningText }}</text>
        <view v-if="profileSideRead" class="instant-side-read">
          <text class="ai-panel-label">{{ profileSideRead.title }}</text>
          <text class="muted">{{ profileSideRead.summary }}</text>
          <view class="side-read-list">
            <view v-for="item in profileSideRead.sections.slice(0, 3)" :key="item.label" class="side-read-item">
              <text class="side-read-label">{{ item.label }}</text>
              <text class="side-read-text">{{ item.text }}</text>
            </view>
          </view>
        </view>
        <view v-if="latestActionPlanPanel.show" class="guidance-panel">
          <text class="ai-panel-label">你接下来怎么做</text>
          <text v-if="latestActionPlanPanel.missing" class="raw-ai-reply-text muted">{{ latestActionPlanPanel.text }}</text>
          <view v-else>
            <view v-for="item in latestActionPlanPanel.sections" :key="item.label" class="guidance-item">
              <text class="guidance-label">{{ item.label }}</text>
              <text class="guidance-text">{{ item.text }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="card timeline-switch-card">
        <view class="timeline-view-tabs">
          <view
            v-for="item in timelineViewOptions"
            :key="item.key"
            :class="['timeline-view-tab', activeTimelineView === item.key ? 'active' : '']"
            @click="setTimelineView(item.key)"
          >
            <text>{{ item.label }}</text>
            <text class="timeline-view-count">{{ item.count }}</text>
          </view>
        </view>
      </view>

      <view v-if="activeTimelineView === 'events'" class="card timeline-stats-card">
        <view class="section-head">
          <view>
            <text class="h2">事件账本</text>
            <text class="muted">只统计时间轴里真实发生或被记录过的互动场景。</text>
          </view>
        </view>
        <view class="timeline-stats-grid">
          <view v-for="item in timelineStatItems" :key="item.key" class="timeline-stat-box">
            <text class="case-kpi-label">{{ item.label }}</text>
            <text class="timeline-stat-value">{{ item.value }}</text>
          </view>
        </view>
        <scroll-view scroll-x class="timeline-filter-scroll">
          <view class="timeline-filter-row">
            <view
              v-for="item in timelineFilterOptions"
              :key="item.key"
              :class="['timeline-filter-chip', activeTimelineFilter === item.key ? 'active' : '']"
              @click="setTimelineFilter(item.key)"
            >
              <text>{{ item.label }}</text>
              <text class="timeline-filter-count">{{ item.count }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view v-if="activeTimelineView === 'events'" class="card">
        <view class="section-head">
          <view>
            <text class="h2">关键事件流</text>
            <text class="muted">{{ activeTimelineFilterLabel }}，默认先看最近 5 次真实互动记录。</text>
          </view>
          <button class="link-button secondary" @click="goCaseDetail">返回关系主页</button>
        </view>
        <view v-if="filteredManualTimeline.length === 0" class="muted">当前筛选下还没有记录。</view>
        <view v-else class="timeline-list large">
          <view v-for="item in visibleManualTimeline" :key="item._id || item.id" :id="`event-${item._id || item.id}`" class="timeline-item">
            <view class="timeline-time">
              <text class="timeline-axis-date">{{ formatAxisDate(item) }}</text>
              <text class="timeline-axis-time">{{ formatAxisTime(item) }}</text>
              <view class="timeline-marker" :class="toneClass(item.type)" />
            </view>
            <view class="timeline-content">
              <view class="timeline-meta">
                <text>发生时间：{{ item.date }}</text>
                <text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text>
              </view>
              <text class="timeline-title">{{ item.title }}</text>
              <text v-if="item.subjectRole" class="badge subject-badge">{{ mapSubjectRoleLabel(item.subjectRole) }}</text>
              <text v-if="didAIReview(item)" class="ai-badge">AI 已参与研判</text>
              <text class="timeline-desc">{{ item.description }}</text>
              <view v-if="getAttachmentBadges(item).length > 0" class="timeline-attachments">
                <text
                  v-for="badge in getAttachmentBadges(item)"
                  :key="badge"
                  :class="['attachment-badge', isImageAttachmentBadge(badge) ? 'clickable' : '']"
                  @click="isImageAttachmentBadge(badge) && previewTimelineImages(item)"
                >
                  {{ badge }}
                </text>
              </view>
            </view>
          </view>
        </view>
        <view v-if="filteredManualTimeline.length > 5" class="timeline-expand-row">
          <button class="link-button secondary" @click="toggleManualTimelineExpanded">
            {{ manualTimelineExpanded ? '收起更多' : `展开更多（还有 ${filteredManualTimeline.length - 5} 条）` }}
          </button>
        </view>
      </view>

      <view v-if="activeTimelineView === 'assessments'" class="card">
        <view class="section-head">
          <view>
            <text class="h2">评估历史流</text>
            <text class="muted">按评估时间倒序查看每一次即时反馈，结构和首页保持一致。</text>
          </view>
          <button class="link-button secondary" @click="goCaseDetail">返回关系主页</button>
        </view>
        <view v-if="assessmentTimeline.length === 0" class="muted">还没有评估历史。</view>
        <template v-else>
          <view class="assessment-stats-grid">
            <view v-for="item in assessmentStatItems" :key="item.key" class="timeline-stat-box">
              <text class="case-kpi-label">{{ item.label }}</text>
              <text class="timeline-stat-value">{{ item.value }}</text>
            </view>
          </view>
          <scroll-view scroll-x class="timeline-filter-scroll">
            <view class="timeline-filter-row">
              <view
                v-for="item in assessmentFilterOptions"
                :key="item.key"
                :class="['timeline-filter-chip', activeAssessmentFilter === item.key ? 'active' : '']"
                @click="setAssessmentFilter(item.key)"
              >
                <text>{{ item.label }}</text>
                <text class="timeline-filter-count">{{ item.count }}</text>
              </view>
            </view>
          </scroll-view>
        </template>
        <view v-if="activeTimelineView === 'assessments' && filteredAssessmentEntries.length === 0 && assessmentTimeline.length > 0" class="muted">当前筛选下还没有评估记录。</view>
        <view v-else-if="filteredAssessmentEntries.length > 0" class="assessment-flow">
          <view v-for="entry in visibleAssessmentEntries" :key="getAssessmentKey(entry.item)" class="assessment-flow-row">
            <view class="timeline-time">
              <text class="timeline-axis-date">{{ formatAssessmentAxisDate(entry.item) }}</text>
              <text class="timeline-axis-time">{{ formatAssessmentAxisTime(entry.item) }}</text>
              <view class="timeline-marker assessment" />
            </view>
            <view class="assessment-flow-item">
              <view class="history-instant-card">
                <view class="assessment-flow-head">
                  <view>
                    <text class="status-strong">已记录：{{ getAssessmentTitle(entry.item) }}</text>
                    <text class="assessment-flow-time">{{ formatAssessmentTime(entry.item.createdAt) }}</text>
                  </view>
                  <view class="assessment-flow-tags">
                    <text v-if="hasAIReview(entry.item)" class="ai-badge">AI 已参与研判</text>
                  </view>
                </view>

              <view class="quick-section">
                <view class="section-mini-head">
                  <text class="mini-title">本次记录</text>
                </view>
                <text class="feedback-headline strong" user-select>{{ getAssessmentOriginalRecordText(entry.item) }}</text>
              </view>

              <view class="score-panel instant-score-panel">
                <view class="section-mini-head">
                  <text class="mini-title">意向 / 风险</text>
                  <text class="mini-sub">这次即时反馈的当时分数</text>
                </view>
                <view class="score-row">
                  <view class="score-head">
                    <text class="score-label">意向</text>
                    <text class="score-value">{{ clampScore(entry.item.intentScore) }}</text>
                    <text class="score-bucket">{{ mapIntentLabel(entry.item.intentBucket) }}</text>
                  </view>
                  <view class="score-track">
                    <view class="score-fill intent-fill" :style="scoreFillStyle(entry.item.intentScore, 'intent')"></view>
                  </view>
                </view>
                <view class="score-row">
                  <view class="score-head">
                    <text class="score-label">风险</text>
                    <text class="score-value">{{ clampScore(entry.item.consistencyRiskScore) }}</text>
                    <text class="score-bucket">{{ mapRiskLabel(entry.item.riskBucket) }}</text>
                  </view>
                  <view class="score-track">
                    <view class="score-fill risk-fill" :style="scoreFillStyle(entry.item.consistencyRiskScore, 'risk')"></view>
                  </view>
                </view>
              </view>

              <view class="instant-delta-panel">
                <view class="instant-delta-item">
                  <text class="delta-label">意向变化</text>
                  <text class="delta-value" :class="deltaClass(entry.trend.intentDelta)">{{ formatDelta(entry.trend.intentDelta) }}</text>
                </view>
                <view class="instant-delta-item">
                  <text class="delta-label">风险变化</text>
                  <text class="delta-value" :class="deltaClass(entry.trend.riskDelta)">{{ formatDelta(entry.trend.riskDelta) }}</text>
                </view>
              </view>
              <text v-if="false && entry.trend.summaryText" class="trend-summary-text">{{ entry.trend.summaryText }}</text>
              <text v-if="false" class="trend-summary-text">这是第一条评估记录，后续新增事件或手动重评后会开始形成趋势对比。</text>
              <text v-if="entry.trend.warningText" class="trend-warning" user-select>{{ entry.trend.warningText }}</text>

              <view v-if="getAssessmentReasonBullets(entry.item).length > 0" class="quick-reason-panel">
                <view class="section-mini-head">
                  <text class="mini-title">判断依据</text>
                  <text class="mini-sub">为什么这次会这么判断</text>
                </view>
                <text v-for="reason in getAssessmentReasonBullets(entry.item)" :key="reason" class="quick-reason" user-select>• {{ reason }}</text>
              </view>

              <view v-if="assessmentStatusSnapshots[entry.index]" class="quick-status-panel">
                <view class="section-mini-head">
                  <view class="mini-title-row">
                    <text class="mini-title">当前状态</text>
                    <text class="info-icon" @click="openAssessmentStatusInfo(entry.item, assessmentStatusSnapshots[entry.index])">i</text>
                  </view>
                </view>
                <view class="status-tag-groups">
                  <view v-if="getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index]).length" class="status-tag-row">
                    <view class="feedback-badges status-tags">
                      <text
                        v-for="tag in getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index])"
                        :key="tag"
                        class="badge"
                      >
                        {{ tag }}
                      </text>
                    </view>
                  </view>
                  <view v-if="getAssessmentProblemTypeTags(entry.item).length" class="status-tag-row">
                    <text class="status-tag-title">问题类型</text>
                    <view class="feedback-badges status-tags">
                      <text
                        v-for="tag in getAssessmentProblemTypeTags(entry.item)"
                        :key="tag"
                        class="badge muted-badge"
                      >
                        {{ tag }}
                      </text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="getAssessmentActionPlanPanel(entry.item).show" class="guidance-panel history-guidance">
                <text class="ai-panel-label">你接下来怎么做</text>
                <text v-if="getAssessmentActionPlanPanel(entry.item).missing" class="raw-ai-reply-text muted" user-select>{{ getAssessmentActionPlanPanel(entry.item).text }}</text>
                <view v-else>
                  <view v-for="item in getAssessmentActionPlanPanel(entry.item).sections" :key="item.label" class="guidance-item">
                    <text class="guidance-label">{{ item.label }}</text>
                    <text class="guidance-text" user-select>{{ item.text }}</text>
                  </view>
                </view>
              </view>

              <view v-if="false" class="score-panel instant-score-panel">
                <view class="section-mini-head legacy-hidden">
                  <text class="mini-title">最近 4 次趋势</text>
                  <text class="mini-sub">用折线图看意向和风险的变化</text>
                </view>
                <view class="section-mini-head">
                  <text class="mini-title">意向 / 风险</text>
                  <text class="mini-sub">这次即时反馈的当时分数</text>
                </view>
                <view class="score-row">
                  <view class="score-head">
                    <text class="score-label">鎰忓悜</text>
                    <text class="score-value">{{ clampScore(entry.item.intentScore) }}</text>
                    <text class="score-bucket">{{ mapIntentLabel(entry.item.intentBucket) }}</text>
                  </view>
                  <view class="score-track">
                    <view class="score-fill intent-fill" :style="scoreFillStyle(entry.item.intentScore, 'intent')"></view>
                  </view>
                </view>
                <view class="score-row">
                  <view class="score-head">
                    <text class="score-label">椋庨櫓</text>
                    <text class="score-value">{{ clampScore(entry.item.consistencyRiskScore) }}</text>
                    <text class="score-bucket">{{ mapRiskLabel(entry.item.riskBucket) }}</text>
                  </view>
                  <view class="score-track">
                    <view class="score-fill risk-fill" :style="scoreFillStyle(entry.item.consistencyRiskScore, 'risk')"></view>
                  </view>
                </view>
                <!--
                <AssessmentTrendChart
                  :assessments="getRecentTrendAssessments(entry.item)"
                  subtitle="截至这次评估的最近 4 次记录，最新一条在最右侧。"
                />
                -->
              </view>

              <view v-if="getAssessmentImageLinkItems(entry.item).length > 0" class="instant-attachments">
                <text class="ai-panel-label">图片链接</text>
                <view
                  v-for="(link, linkIndex) in getAssessmentImageLinkItems(entry.item)"
                  :key="link.fileID"
                  class="instant-attachment-link"
                  @click="previewAssessmentImages(entry.item, linkIndex)"
                >
                  <text class="instant-link-title">{{ link.name }}</text>
                  <text class="instant-link-url" selectable>{{ link.url || '授权链接生成中...' }}</text>
                </view>
              </view>
            </view>

            <view v-if="false" class="score-panel">
              <view class="score-row">
                <view class="score-head">
                  <text class="score-label">意向</text>
                  <text class="score-value">{{ clampScore(entry.item.intentScore) }}</text>
                  <text class="score-bucket">{{ mapIntentLabel(entry.item.intentBucket) }}</text>
                </view>
                <view class="score-track">
                  <view class="score-fill intent-fill" :style="scoreFillStyle(entry.item.intentScore, 'intent')"></view>
                </view>
              </view>
              <view class="score-row">
                <view class="score-head">
                  <text class="score-label">风险</text>
                  <text class="score-value">{{ clampScore(entry.item.consistencyRiskScore) }}</text>
                  <text class="score-bucket">{{ mapRiskLabel(entry.item.riskBucket) }}</text>
                </view>
                <view class="score-track">
                  <view class="score-fill risk-fill" :style="scoreFillStyle(entry.item.consistencyRiskScore, 'risk')"></view>
                </view>
              </view>
            </view>

            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTimelineView === 'system'" class="card system-track-card">
        <view class="fold-head">
          <view>
            <text class="h2">系统轨迹</text>
            <text class="muted">系统自动生成的评估、重算、趋势日志，不混入真实事件流。</text>
          </view>
          <view class="fold-meta">
            <text class="track-count">{{ supportTimeline.length }} 条</text>
          </view>
        </view>
        <view v-if="supportTimeline.length === 0" class="muted">还没有系统轨迹。</view>
        <view v-else class="timeline-list large system-track-list">
          <view v-for="item in supportTimeline" :key="item._id || item.id" class="timeline-item system">
            <view class="timeline-time">
              <text class="timeline-axis-date">{{ formatAxisDate(item) }}</text>
              <text class="timeline-axis-time">{{ formatAxisTime(item) }}</text>
              <view class="timeline-marker" :class="toneClass(item.type)" />
            </view>
            <view class="timeline-content">
              <view class="timeline-meta">
                <text>{{ mapSystemTrackTypeLabel(item.type) }}</text>
                <text v-if="item.date">发生时间：{{ item.date }}</text>
                <text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text>
              </view>
              <text class="timeline-title">{{ item.title || mapSystemTrackTypeLabel(item.type) }}</text>
            <text v-if="item.description" class="timeline-desc" user-select>{{ item.description }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>

    <view v-if="selectedStatusInfo" class="info-modal-mask" @click="selectedStatusInfo = null">
      <view class="info-modal" @click.stop>
        <view class="info-modal-head">
          <view class="info-head-copy">
            <text class="info-modal-title">当前状态怎么看</text>
            <text class="info-modal-subtitle">这些标签走同一套规则口径，AI 只参与事件分析和变化量判断。</text>
          </view>
          <text class="info-modal-close" @click="selectedStatusInfo = null">×</text>
        </view>
        <scroll-view scroll-y class="info-modal-body">
          <view v-if="selectedStatusInfo.summary || selectedStatusInfo.caution" class="info-section relation">
            <text class="info-section-title">这次状态说明</text>
            <text v-if="selectedStatusInfo.summary" class="info-section-copy strong" user-select>{{ selectedStatusInfo.summary }}</text>
            <text v-if="selectedStatusInfo.caution" class="info-section-copy" user-select>{{ selectedStatusInfo.caution }}</text>
          </view>
          <view class="info-section">
            <text class="info-section-title">状态标签</text>
            <text class="info-section-copy">从事件性质、阶段、状态、天气和证据强度几个角度看当前切面。</text>
            <view class="info-meaning-list">
              <view v-for="item in selectedStatusStateItems" :key="`${item.group}-${item.tag}`" class="info-meaning-row">
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
              <view v-for="item in selectedProblemItems" :key="item.tag" class="info-meaning-row">
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
    <!-- /经典版 -->

    <!-- Campus Pop -->
    <block v-if="showV2">
      <view v-if="loading" class="loading-v2">LOADING...</view>
      <view v-else-if="!caseFile" class="empty-v2"><text class="empty-title-v2">时间轴不可用</text><text class="empty-sub-v2">当前对象不存在或已被删除。</text></view>
      <template v-else>
        <view class="hero-block-v2"><text class="hero-tag-v2">关系记录 / {{ caseFile.name }}</text><text class="hero-title-v2">互动<text class="hl-v2">时间轴</text></text><text class="hero-copy-v2">把真实发生过的互动按时间看清楚。</text><view v-if="profileItems.length > 0" class="tag-row-v2"><text v-for="item in profileItems" :key="item" class="tag-v2">{{ item }}</text></view></view>
        <view v-if="classified" :class="['notice-v2', classifiedType === 'risk' ? 'warn' : 'ok']"><text class="notice-title-v2">{{ mapTimelineTypeLabel(classifiedType) }}</text><text class="notice-sub-v2">{{ mapTimelineTypeMessage(classifiedType) }}</text></view>
        <view v-if="recorded && triggerEvent && latestResult" class="card-v2"><text class="section-title-v2">即时反馈</text><text class="feedback-title-v2">{{ triggerEvent.title }}</text><text class="feedback-desc-v2">{{ latestResult.explanation?.headline }}</text><view class="tag-row-v2"><text v-if="triggerEvent.subjectRole" class="tag-v2">{{ mapSubjectRoleLabel(triggerEvent.subjectRole) }}</text><text class="tag-v2 black">{{ mapTimelineTypeLabel(classifiedType) }}</text><text class="tag-v2">{{ mapAction(latestResult.nextAction) }}</text><text class="tag-v2">证据 {{ latestResult.evidenceLevel }}</text><text v-if="isLatestResultAIReviewed" class="tag-v2 black">AI 研判</text></view><view v-if="triggerImageLinkItems.length > 0" class="attach-v2"><text class="section-title-v2">图片链接</text><view v-for="(item, idx) in triggerImageLinkItems" :key="item.fileID" class="attach-link-v2" @click="previewTriggerImage(idx)"><text class="attach-name-v2">{{ item.name }}</text></view></view><view class="trend-grid-v2" style="margin-top:12rpx;"><view class="trend-item-v2"><text class="trend-num-v2">{{ immediateTrend.intentDelta > 0 ? '+' : '' }}{{ immediateTrend.intentDelta }}</text><text class="trend-unit-v2">意向变化 · 当前 {{ latestResult.intentScore }}</text></view><view class="trend-item-v2"><text class="trend-num-v2 risk">{{ immediateTrend.riskDelta > 0 ? '+' : '' }}{{ immediateTrend.riskDelta }}</text><text class="trend-unit-v2">风险变化 · 当前 {{ latestResult.consistencyRiskScore }}</text></view></view><text class="trend-summary-v2">{{ immediateTrend.summaryText }}</text><text v-if="immediateTrend.warningText" class="trend-warn-v2">{{ immediateTrend.warningText }}</text><view v-if="profileSideRead" class="side-inline-v2"><text class="focus-label-v2">{{ profileSideRead.title }}</text><text class="weekly-desc-v2">{{ profileSideRead.summary }}</text></view><view v-if="latestActionPlanPanel.show" class="action-box-v2"><text class="action-label-v2">你接下来怎么做</text><text v-if="latestActionPlanPanel.missing" class="trend-summary-v2">{{ latestActionPlanPanel.text }}</text><view v-else><view v-for="item in latestActionPlanPanel.sections" :key="item.label" class="action-item-v2"><text class="action-item-label-v2">{{ item.label }}</text><text class="action-item-text-v2">{{ item.text }}</text></view></view></view></view>
        <view class="tab-switch-v2"><view v-for="item in timelineViewOptions" :key="item.key" :class="['tab-btn-v2', activeTimelineView === item.key ? 'active' : '']" @click="setTimelineView(item.key)">{{ item.label }} {{ item.count }}</view></view>
        <view v-if="activeTimelineView === 'events'">
          <view class="card-v2" style="border-color:#4ECDC4;"><view class="stats-grid-v2"><view v-for="item in timelineStatItems" :key="item.key" class="stat-box-v2"><text class="stat-num-v2">{{ item.value }}</text><text class="stat-lbl-v2">{{ item.label }}</text></view></view><scroll-view scroll-x class="filter-scroll-v2"><view class="filter-row-v2"><view v-for="item in timelineFilterOptions" :key="item.key" :class="['filter-chip-v2', activeTimelineFilter === item.key ? 'active' : '']" @click="setTimelineFilter(item.key)">{{ item.label }} {{ item.count }}</view></view></scroll-view></view>
          <view class="card-v2"><text class="section-title-v2">关键事件流 · {{ activeTimelineFilterLabel }}</text><view v-if="filteredManualTimeline.length === 0" class="empty-sub-v2">当前筛选下还没有记录。</view><view v-else class="event-list-v2"><view v-for="item in visibleManualTimeline" :key="item._id || item.id" class="event-row-v2"><view class="event-time-v2"><text class="event-date-v2">{{ formatAxisDate(item) }}</text><text class="event-clock-v2">{{ formatAxisTime(item) }}</text><view :class="['event-dot-v2', toneClass(item.type)]"></view></view><view class="event-body-v2"><view class="event-meta-v2"><text>发生时间：{{ item.date }}</text><text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text></view><text class="event-title-v2">{{ item.title }}</text><text v-if="item.subjectRole" class="tag-v2 sm">{{ mapSubjectRoleLabel(item.subjectRole) }}</text><text v-if="didAIReview(item)" class="tag-v2 black sm">AI</text><text class="event-desc-v2">{{ item.description }}</text><view v-if="getAttachmentBadges(item).length > 0" class="tag-row-v2" style="margin-top:6rpx;"><text v-for="badge in getAttachmentBadges(item)" :key="badge" :class="['tag-v2 sm', isImageAttachmentBadge(badge) ? 'clickable' : '']" @click="isImageAttachmentBadge(badge) && previewTimelineImages(item)">{{ badge }}</text></view></view></view></view><view v-if="filteredManualTimeline.length > 5" class="expand-row-v2"><view class="tag-v2" @click="toggleManualTimelineExpanded">{{ manualTimelineExpanded ? '收起' : '展开更多（还有 ' + (filteredManualTimeline.length - 5) + ' 条）' }}</view></view></view>
        </view>
        <view v-if="activeTimelineView === 'assessments'">
          <view class="card-v2"><view class="stats-grid-v2"><view v-for="item in assessmentStatItems" :key="item.key" class="stat-box-v2"><text class="stat-num-v2">{{ item.value }}</text><text class="stat-lbl-v2">{{ item.label }}</text></view></view><scroll-view scroll-x class="filter-scroll-v2"><view class="filter-row-v2"><view v-for="item in assessmentFilterOptions" :key="item.key" :class="['filter-chip-v2', activeAssessmentFilter === item.key ? 'active' : '']" @click="setAssessmentFilter(item.key)">{{ item.label }} {{ item.count }}</view></view></scroll-view></view>
          <view v-if="filteredAssessmentEntries.length > 0" class="event-list-v2">
            <view v-for="entry in visibleAssessmentEntriesV2" :key="getAssessmentKey(entry.item)" class="event-row-v2">
              <view class="event-time-v2"><text class="event-date-v2">{{ formatAssessmentAxisDate(entry.item) }}</text><text class="event-clock-v2">{{ formatAssessmentAxisTime(entry.item) }}</text><view class="event-dot-v2 assessment"></view></view>
              <view class="event-body-v2 assessment-card-v2">
                <text class="event-title-v2">已记录：{{ getAssessmentTitle(entry.item) }}</text>
                <view class="tag-row-v2" style="margin:6rpx 0;"><text v-if="hasAIReview(entry.item)" class="tag-v2 black sm">AI 研判</text></view>
                <text class="event-desc-v2">{{ getAssessmentOriginalRecordText(entry.item) }}</text>
                <!-- Scores -->
                <view class="score-block-v2">
                  <view class="score-row-v2"><text class="score-lbl-v2">意向</text><text class="score-val-v2">{{ clampScore(entry.item.intentScore) }}</text><text class="score-tag-v2">{{ mapIntentLabel(entry.item.intentBucket) }}</text><view class="score-bar-v2"><view class="score-fill-v2" :style="'width:' + clampScore(entry.item.intentScore) + '%'"></view></view></view>
                  <view class="score-row-v2"><text class="score-lbl-v2">风险</text><text class="score-val-v2 risk">{{ clampScore(entry.item.consistencyRiskScore) }}</text><text class="score-tag-v2">{{ mapRiskLabel(entry.item.riskBucket) }}</text><view class="score-bar-v2"><view class="score-fill-v2 risk" :style="'width:' + clampScore(entry.item.consistencyRiskScore) + '%'"></view></view></view>
                </view>
                <!-- Deltas -->
                <view class="delta-row-v2"><view class="delta-item-v2"><text class="delta-lbl-v2">意向变化</text><text :class="['delta-val-v2', deltaClass(entry.trend.intentDelta)]">{{ formatDelta(entry.trend.intentDelta) }}</text></view><view class="delta-item-v2"><text class="delta-lbl-v2">风险变化</text><text :class="['delta-val-v2', deltaClass(entry.trend.riskDelta)]">{{ formatDelta(entry.trend.riskDelta) }}</text></view></view>
                <text v-if="entry.trend.warningText" class="trend-warn-v2">{{ entry.trend.warningText }}</text>
                <!-- Reason bullets -->
                <view v-if="getAssessmentReasonBullets(entry.item).length > 0" class="reason-box-v2"><text class="section-title-v2">判断依据</text><text v-for="reason in getAssessmentReasonBullets(entry.item)" :key="reason" class="reason-line-v2">• {{ reason }}</text></view>
                <!-- Status tags -->
                <view v-if="assessmentStatusSnapshots[entry.index]" class="status-box-v2">
                  <view class="status-head-v2"><text class="section-title-v2">当前状态</text><text class="info-icon-v2" @click="openAssessmentStatusInfo(entry.item, assessmentStatusSnapshots[entry.index])">i</text></view>
                  <view v-if="getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index]).length" class="tag-row-v2"><text v-for="tag in getAssessmentStatusStateTags(entry.item, assessmentStatusSnapshots[entry.index])" :key="tag" class="tag-v2 sm">{{ tag }}</text></view>
                  <view v-if="getAssessmentProblemTypeTags(entry.item).length" class="tag-row-v2"><text class="tag-v2 muted sm" v-for="tag in getAssessmentProblemTypeTags(entry.item)" :key="tag">{{ tag }}</text></view>
                </view>
                <!-- Action plan -->
                <view v-if="getAssessmentActionPlanPanel(entry.item).show" class="action-box-v2"><text class="action-label-v2">你接下来怎么做</text><text v-if="getAssessmentActionPlanPanel(entry.item).missing" class="trend-summary-v2">{{ getAssessmentActionPlanPanel(entry.item).text }}</text><view v-else><view v-for="item in getAssessmentActionPlanPanel(entry.item).sections" :key="item.label" class="action-item-v2"><text class="action-item-label-v2">{{ item.label }}</text><text class="action-item-text-v2">{{ item.text }}</text></view></view></view>
                <!-- Image links -->
                <view v-if="getAssessmentImageLinkItems(entry.item).length > 0" class="attach-v2"><text class="section-title-v2">图片链接</text><view v-for="(link, li) in getAssessmentImageLinkItems(entry.item)" :key="link.fileID" class="attach-link-v2" @click="previewAssessmentImages(entry.item, li)"><text class="attach-name-v2">{{ link.name }}</text></view></view>
              </view>
            </view>
          </view>
          <view v-if="filteredAssessmentEntries.length > assessmentVisibleMax" class="expand-row-v2"><view class="tag-v2" @click="assessmentVisibleMax = assessmentVisibleMax + 7">加载更多（还有 {{ filteredAssessmentEntries.length - assessmentVisibleMax }} 条）</view></view>
        </view>
        <view v-if="activeTimelineView === 'system'" class="card-v2" style="border-style:dashed;"><text class="section-title-v2">系统轨迹 · {{ supportTimeline.length }} 条</text><view v-if="supportTimeline.length === 0" class="empty-sub-v2">还没有系统轨迹。</view><view v-else class="event-list-v2"><view v-for="item in visibleSystemTracksV2" :key="item._id || item.id" class="event-row-v2 system"><view class="event-time-v2"><text class="event-date-v2">{{ formatAxisDate(item) }}</text><text class="event-clock-v2">{{ formatAxisTime(item) }}</text><view :class="['event-dot-v2', toneClass(item.type)]"></view></view><view class="event-body-v2"><view class="event-meta-v2"><text>{{ mapSystemTrackTypeLabel(item.type) }}</text><text v-if="item.date">发生时间：{{ item.date }}</text><text v-if="formatRecordedAt(item)">{{ formatRecordedAt(item) }}</text></view><text class="event-title-v2">{{ item.title || mapSystemTrackTypeLabel(item.type) }}</text><text v-if="item.description" class="event-desc-v2" user-select>{{ item.description }}</text></view></view></view><view v-if="supportTimeline.length > systemVisibleMax" class="expand-row-v2"><view class="tag-v2" @click="systemVisibleMax = systemVisibleMax + 7">加载更多（还有 {{ supportTimeline.length - systemVisibleMax }} 条）</view></view></view>
        <view v-if="selectedStatusInfo" class="info-mask-v2" @click="selectedStatusInfo = null"><view class="info-modal-v2" @click.stop><view class="info-head-v2"><text class="info-title-v2">当前状态怎么看</text><text class="info-close-v2" @click="selectedStatusInfo = null">X</text></view><scroll-view scroll-y class="info-body-v2"><view v-if="selectedStatusInfo.summary || selectedStatusInfo.caution" class="info-section-v2 ylw"><text class="info-sec-title-v2">这次状态说明</text><text v-if="selectedStatusInfo.summary" class="info-sec-copy-v2 strong">{{ selectedStatusInfo.summary }}</text><text v-if="selectedStatusInfo.caution" class="info-sec-copy-v2">{{ selectedStatusInfo.caution }}</text></view><view class="info-section-v2"><text class="info-sec-title-v2">状态标签</text><view v-for="item in selectedStatusStateItems" :key="`${item.group}-${item.tag}`" class="info-tag-row-v2"><text class="info-chip-v2">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">{{ item.group }}</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view><view class="info-section-v2"><text class="info-sec-title-v2">问题类型</text><view v-for="item in selectedProblemItems" :key="item.tag" class="info-tag-row-v2"><text class="info-chip-v2 muted">{{ item.tag }}</text><view class="info-chip-copy-v2"><text class="info-chip-title-v2">问题类型</text><text class="info-chip-desc-v2">{{ item.description }}</text></view></view></view></scroll-view></view></view>
        <view class="bottom-action-v2"><button class="btn-v2-bottom" @click="goCaseDetail">返回关系主页</button></view>
      </template>
    </block>
    <!-- /Campus Pop -->

  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { getCaseDetail, getCurrentUserId, getCases, getCachedSelfProfile, getSelfProfile, getTempFileURL } from '@/utils/api'
import { consumePendingTimelineContext, getActiveCaseId, setActiveCaseId, showError } from '@/utils/helpers'
import { buildProfileItems, explainProblemLabel, explainStatusTag } from '@/utils/insights'
import { buildTimelineFromLatestResult, compareAssessments, sortTimelineRecordsDesc, isSystemTimelineRecord, getTimelineRecordTimestamp } from '@/utils/insights'
import { buildTimelineStats, getTimelineRecordTags, buildObjectStatusCard } from '@/utils/insights'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
import { buildSafeShareMessage, buildSafeTimelineShare } from '@/utils/share'

const showV2 = ref(true)
const loading = ref(true)
const caseFile = ref<any>(null)
const assessmentVisibleMax = ref(7)
const systemVisibleMax = ref(7)
const userId = ref('')
const caseId = ref('')
const selfProfile = ref<any>(getCachedSelfProfile())
const classified = ref(false)
const classifiedType = ref('')
const recorded = ref(false)
const targetEventId = ref('')
const themeVars = ref(getThemeStyle())

onShareAppMessage(() => buildSafeShareMessage())

onShareTimeline(() => buildSafeTimelineShare())
const manualTimelineExpanded = ref(false)
const activeTimelineView = ref<'events' | 'assessments' | 'system'>('events')
const activeTimelineFilter = ref('all')
const activeAssessmentFilter = ref('all')
const initialized = ref(false)
const skipNextShowRefresh = ref(false)
const imageUrlMap = ref<Record<string, string>>({})
const selectedStatusInfo = ref<any>(null)

const profileItems = computed(() => buildProfileItems(caseFile.value?.profile))

const assessmentTimeline = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(b) - getAssessmentTimestamp(a))
})

const chronologicalAssessments = computed(() => {
  const list = caseFile.value?.assessments || []
  return [...list].sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
})

const timelineById = computed(() => {
  const map = new Map<string, any>()
  for (const item of caseFile.value?.timeline || []) {
    const id = String(item.id || item._id || '').trim()
    if (id) map.set(id, item)
  }
  return map
})

const manualTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => !isSystemTimelineRecord(item)))
})

const timelineStats = computed(() => buildTimelineStats(manualTimeline.value))

const timelineStatItems = computed(() => [
  { key: 'offline', label: '线下见面', value: `${timelineStats.value.offlineMeetCount} 次` },
  { key: 'movie', label: '看电影', value: `${timelineStats.value.movieCount} 次` },
  { key: 'meal', label: '吃饭', value: `${timelineStats.value.mealCount} 次` },
  { key: 'coffee', label: '咖啡奶茶', value: `${timelineStats.value.coffeeTeaCount} 次` },
  { key: 'fulfilled', label: '已兑现', value: `${timelineStats.value.fulfilledCount} 次` },
  { key: 'rejected', label: '被拒绝', value: `${timelineStats.value.rejectedCount} 次` }
])

const timelineFilterOptions = computed(() => [
  { key: 'all', label: '全部', count: timelineStats.value.totalCount },
  { key: 'offline_meet', label: '见面', count: timelineStats.value.offlineMeetCount },
  { key: 'movie', label: '电影', count: timelineStats.value.movieCount },
  { key: 'meal', label: '吃饭', count: timelineStats.value.mealCount },
  { key: 'coffee_tea', label: '咖啡奶茶', count: timelineStats.value.coffeeTeaCount },
  { key: 'target_initiated', label: '对方主动', count: timelineStats.value.targetInitiatedCount },
  { key: 'fulfilled', label: '已兑现', count: timelineStats.value.fulfilledCount },
  { key: 'cancelled_delayed', label: '取消拖延', count: timelineStats.value.cancelledDelayedCount },
  { key: 'rejected', label: '被拒', count: timelineStats.value.rejectedCount },
  { key: 'ai_reviewed', label: 'AI研判', count: timelineStats.value.aiReviewedCount }
])

const activeTimelineFilterLabel = computed(() => {
  const item = timelineFilterOptions.value.find((option) => option.key === activeTimelineFilter.value)
  return item && item.key !== 'all' ? `当前只看：${item.label}` : '当前查看全部事件'
})

const filteredManualTimeline = computed(() => {
  if (activeTimelineFilter.value === 'all') return manualTimeline.value
  return manualTimeline.value.filter((item: any) => getTimelineRecordTags(item).all.includes(activeTimelineFilter.value))
})

const visibleManualTimeline = computed(() => {
  if (manualTimelineExpanded.value || targetEventId.value) return filteredManualTimeline.value
  return filteredManualTimeline.value.slice(0, 5)
})

const systemTimeline = computed(() => {
  const timeline = caseFile.value?.timeline || []
  return sortTimelineRecordsDesc(timeline.filter((item: any) => isSystemTimelineRecord(item)))
})

const supportTimeline = computed(() => {
  if (systemTimeline.value.length > 0) return systemTimeline.value
  return sortTimelineRecordsDesc(buildTimelineFromLatestResult(caseFile.value?.latestResult))
})

const timelineViewOptions = computed(() => [
  { key: 'events', label: '关键事件', count: manualTimeline.value.length },
  { key: 'assessments', label: '评估历史', count: assessmentTimeline.value.length },
  { key: 'system', label: '系统轨迹', count: supportTimeline.value.length }
])

const latestResult = computed(() => caseFile.value?.latestResult)

const triggerEvent = computed(() => {
  if (!latestResult.value?.triggerEventId) return null
  return caseFile.value?.timeline?.find((item: any) => (item.id || item._id) === latestResult.value.triggerEventId) || null
})

const previousAssessment = computed(() => {
  const assessments = caseFile.value?.assessments || []
  return assessments.length > 1 ? assessments[assessments.length - 2] : null
})

const immediateTrend = computed(() => {
  if (!latestResult.value) {
    return { intentDelta: 0, riskDelta: 0, intentDirection: 'flat', riskDirection: 'flat', summaryText: '' }
  }
  return compareAssessments(previousAssessment.value, latestResult.value)
})

const profileSideRead = computed(() => {
  const sideRead = latestResult.value?.sideReadAdvice
  return sideRead?.summary || sideRead?.sections?.length ? sideRead : null
})

const latestRawReply = computed(() => {
  return String(latestResult.value?.rawReply || '').trim()
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
  if (latestRawReply.value) {
    return { show: true, text: latestRawReply.value, missing: false, sections: parseRawReplySections(latestRawReply.value) }
  }
  if (latestResult.value?.source === 'event_recalculation') {
    return {
      show: true,
      text: latestResult.value.aiUsed === false
        ? '这次 AI 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 AI 原文回复没有返回，下面先显示结构化建议。',
      missing: true,
      sections: []
    }
  }
  return { show: false, text: '', missing: false, sections: [] }
})

const isLatestResultAIReviewed = computed(() => {
  return Boolean(
    triggerEvent.value?.aiUsed ||
    String(latestResult.value?.explanation?.headline || '').startsWith('AI 研判后：')
  )
})

const triggerImageAttachments = computed(() => getImageAttachments(triggerEvent.value))

const triggerImageLinkItems = computed(() => {
  return triggerImageAttachments.value.map((attachment: any, index: number) => ({
    fileID: attachment.fileID,
    name: attachment.name || `图片${index + 1}`,
    url: imageUrlMap.value[attachment.fileID] || ''
  }))
})

const assessmentTrendSummaries = computed(() => {
  return assessmentTimeline.value.map((item: any, index: number) => {
    const previous = assessmentTimeline.value[index + 1] || null
    const trend = compareAssessments(previous, item)
    return trend.hasPrevious ? trend : null
  })
})

const assessmentEntries = computed(() => {
  return assessmentTimeline.value.map((item: any, index: number) => ({
    item,
    index,
    trend: getAssessmentTrend(index)
  }))
})

const assessmentStats = computed(() => {
  const entries = assessmentEntries.value
  const comparableEntries = entries.filter((entry) => entry.trend.hasPrevious)
  const countBy = (predicate: (entry: any) => boolean) => entries.filter(predicate).length
  const countComparableBy = (predicate: (entry: any) => boolean) => comparableEntries.filter(predicate).length
  return {
    total: entries.length,
    intentUp: countComparableBy((entry) => entry.trend.intentDirection === 'up'),
    intentDown: countComparableBy((entry) => entry.trend.intentDirection === 'down'),
    intentFlat: countComparableBy((entry) => entry.trend.intentDirection === 'flat'),
    riskUp: countComparableBy((entry) => entry.trend.riskDirection === 'up'),
    riskDown: countComparableBy((entry) => entry.trend.riskDirection === 'down'),
    riskFlat: countComparableBy((entry) => entry.trend.riskDirection === 'flat'),
    aiReviewed: countBy((entry) => hasAIReview(entry.item)),
    eventRecalculation: countBy((entry) => entry.item?.source === 'event_recalculation')
  }
})

const assessmentStatItems = computed(() => [
  { key: 'total', label: '评估次数', value: `${assessmentStats.value.total} 次` },
  { key: 'intentUp', label: '意向上升', value: `${assessmentStats.value.intentUp} 次` },
  { key: 'intentFlat', label: '意向持平', value: `${assessmentStats.value.intentFlat} 次` },
  { key: 'riskUp', label: '风险上升', value: `${assessmentStats.value.riskUp} 次` },
  { key: 'riskFlat', label: '风险持平', value: `${assessmentStats.value.riskFlat} 次` },
  { key: 'aiReviewed', label: 'AI参与', value: `${assessmentStats.value.aiReviewed} 次` }
])

const assessmentFilterOptions = computed(() => [
  { key: 'all', label: '全部', count: assessmentStats.value.total },
  { key: 'intent_up', label: '意向上升', count: assessmentStats.value.intentUp },
  { key: 'intent_down', label: '意向下降', count: assessmentStats.value.intentDown },
  { key: 'intent_flat', label: '意向持平', count: assessmentStats.value.intentFlat },
  { key: 'risk_up', label: '风险上升', count: assessmentStats.value.riskUp },
  { key: 'risk_down', label: '风险下降', count: assessmentStats.value.riskDown },
  { key: 'risk_flat', label: '风险持平', count: assessmentStats.value.riskFlat },
  { key: 'ai_reviewed', label: 'AI研判', count: assessmentStats.value.aiReviewed },
  { key: 'event_recalculation', label: '事件重算', count: assessmentStats.value.eventRecalculation }
])

const filteredAssessmentEntries = computed(() => {
  if (activeAssessmentFilter.value === 'all') return assessmentEntries.value
  return assessmentEntries.value.filter((entry) => {
    switch (activeAssessmentFilter.value) {
      case 'intent_up': return entry.trend.hasPrevious && entry.trend.intentDirection === 'up'
      case 'intent_down': return entry.trend.hasPrevious && entry.trend.intentDirection === 'down'
      case 'intent_flat': return entry.trend.hasPrevious && entry.trend.intentDirection === 'flat'
      case 'risk_up': return entry.trend.hasPrevious && entry.trend.riskDirection === 'up'
      case 'risk_down': return entry.trend.hasPrevious && entry.trend.riskDirection === 'down'
      case 'risk_flat': return entry.trend.hasPrevious && entry.trend.riskDirection === 'flat'
      case 'ai_reviewed': return hasAIReview(entry.item)
      case 'event_recalculation': return entry.item?.source === 'event_recalculation'
      default: return true
    }
  })
})

const visibleAssessmentEntries = computed(() => filteredAssessmentEntries.value)
const visibleAssessmentEntriesV2 = computed(() => filteredAssessmentEntries.value.slice(0, assessmentVisibleMax.value))
const visibleSystemTracksV2 = computed(() => supportTimeline.value.slice(0, systemVisibleMax.value))

const assessmentStatusSnapshots = computed(() => {
  return assessmentTimeline.value.map((item: any) => {
    const chronologicalIndex = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
    const history = chronologicalIndex >= 0
      ? chronologicalAssessments.value.slice(0, chronologicalIndex + 1)
      : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
    return buildObjectStatusCard({
      ...caseFile.value,
      latestResult: item,
      assessments: history.length > 0 ? history : [item],
      timeline: caseFile.value?.timeline || []
    })
  })
})

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

function mapTimelineTypeLabel(type?: string) {
  switch (type) {
    case 'positive': return '推进事件'
    case 'risk': return '风险事件'
    case 'verification': return '验证事件'
    case 'note': return '普通记录'
    default: return '关系记录'
  }
}

function mapSourceLabel(source?: string) {
  switch (source) {
    case 'initial_questionnaire': return '初评'
    case 'manual_reassessment': return '手动重评'
    case 'event_recalculation': return '事件重算'
    default: return source || '评估'
  }
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

function clampScore(score: any) {
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function scoreFillStyle(score: any, kind: 'intent' | 'risk') {
  const value = clampScore(score)
  const alpha = 0.18 + (value / 100) * 0.72
  const color = kind === 'risk'
    ? `linear-gradient(90deg, rgba(184, 74, 58, ${alpha}), rgba(126, 43, 35, ${alpha}))`
    : `linear-gradient(90deg, rgba(53, 111, 96, ${alpha}), rgba(18, 60, 54, ${alpha}))`
  return {
    width: `${value}%`,
    background: color
  }
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

function getAssessmentTrend(index: number) {
  return assessmentTrendSummaries.value[index] || {
    intentDelta: 0,
    riskDelta: 0,
    intentDirection: 'flat',
    riskDirection: 'flat',
    summaryText: '',
    warningText: ''
  }
}

function getAssessmentType(item: any) {
  return item?.triggerEventType || getAssessmentEvent(item)?.type || 'note'
}

function getAssessmentTimestamp(item: any) {
  const raw = item?.createdAt
  if (!raw) return 0
  if (typeof raw === 'number') return raw
  if (raw instanceof Date) return raw.getTime()
  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function getAssessmentKey(item: any) {
  return String(item?._id || item?.assessmentId || `${item?.createdAt || ''}-${item?.triggerEventId || ''}`)
}

function formatAssessmentTime(value: any) {
  const timestamp = getAssessmentTimestamp({ createdAt: value })
  if (!timestamp) return '时间未记录'
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatAssessmentAxisDate(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '--/--'
  const date = new Date(timestamp)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function formatAssessmentAxisTime(item: any) {
  const timestamp = getAssessmentTimestamp(item)
  if (!timestamp) return '--:--'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function hasAIReview(item: any) {
  return Boolean(
    item?.aiUsed ||
    String(item?.explanation?.headline || '').startsWith('AI 研判后：')
  )
}

function getAssessmentEvent(item: any) {
  const eventId = String(item?.triggerEventId || '').trim()
  return eventId ? timelineById.value.get(eventId) || null : null
}

function getAssessmentTitle(item: any) {
  return getAssessmentEvent(item)?.title || item?.triggerEventTitle || mapSourceLabel(item?.source)
}

function getAssessmentOriginalRecordText(item: any) {
  const event = getAssessmentEvent(item)
  const description = String(event?.description || '').trim()
  if (description) return description
  return getAssessmentTitle(item)
}

function getAssessmentImageLinkItems(item: any) {
  return getImageAttachments(getAssessmentEvent(item)).map((attachment: any, index: number) => ({
    fileID: attachment.fileID,
    name: attachment.name || `图片${index + 1}`,
    url: imageUrlMap.value[attachment.fileID] || ''
  }))
}

function getAssessmentHistory(item: any) {
  const chronologicalIndex = chronologicalAssessments.value.findIndex((candidate: any) => getAssessmentKey(candidate) === getAssessmentKey(item))
  return chronologicalIndex >= 0
    ? chronologicalAssessments.value.slice(0, chronologicalIndex + 1)
    : chronologicalAssessments.value.filter((candidate: any) => getAssessmentTimestamp(candidate) <= getAssessmentTimestamp(item))
}

function getAssessmentReasonBullets(item: any) {
  const bullets = item?.explanation?.bullets
  return Array.isArray(bullets) ? bullets.slice(0, 3) : []
}

function getAssessmentStatusStateTags(item: any, status: any) {
  const tags = [
    mapTimelineTypeLabel(getAssessmentType(item)),
    ...(Array.isArray(status?.tags) ? status.tags : [])
  ]
  return [...new Set(tags.filter(Boolean))].slice(0, 5)
}

function getAssessmentProblemTypeTags(item: any) {
  const labels = Array.isArray(item?.primaryLabels) ? item.primaryLabels : []
  const list = labels.filter(Boolean).slice(0, 4)
  return list.length ? list : ['暂无突出问题']
}

function openAssessmentStatusInfo(item: any, status: any) {
  selectedStatusInfo.value = {
    stateTags: getAssessmentStatusStateTags(item, status),
    problemTags: getAssessmentProblemTypeTags(item),
    summary: String(status?.summary || '').trim(),
    caution: String(status?.caution || '').trim()
  }
}

const selectedStatusStateItems = computed(() => {
  return (selectedStatusInfo.value?.stateTags || []).map((tag: string) => explainStatusTag(tag))
})

const selectedProblemItems = computed(() => {
  return (selectedStatusInfo.value?.problemTags || []).map((tag: string) => explainProblemLabel(tag))
})

function getRecentTrendAssessments(item: any) {
  const history = getAssessmentHistory(item)
  return history
    .filter((assessment: any) => getAssessmentTimestamp(assessment) > 0)
    .sort((a: any, b: any) => getAssessmentTimestamp(a) - getAssessmentTimestamp(b))
    .slice(-4)
}

function getAssessmentRawReply(item: any) {
  return String(item?.rawReply || '').trim()
}

function getAssessmentActionPlanPanel(item: any) {
  const rawReply = getAssessmentRawReply(item)
  if (rawReply) {
    return { show: true, text: rawReply, missing: false, sections: parseRawReplySections(rawReply) }
  }
  if (item?.source === 'event_recalculation') {
    return {
      show: true,
      text: item.aiUsed === false
        ? '这次 AI 原文回复没有生成：模型响应超时，系统先用了规则兜底。'
        : '这次 AI 原文回复没有返回。',
      missing: true,
      sections: []
    }
  }
  return { show: false, text: '', missing: false, sections: [] }
}

function getAttachmentBadges(item: any) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : []
  if (attachments.length === 0) return []
  const imageCount = attachments.filter((attachment: any) => attachment?.type === 'image').length
  const audioCount = attachments.filter((attachment: any) => attachment?.type === 'audio').length
  const chatCount = attachments.filter((attachment: any) => attachment?.analysis?.isChatRecord).length
  const badges: string[] = []
  if (imageCount) badges.push(`图片 ${imageCount}`)
  if (audioCount) badges.push(`语音 ${audioCount}`)
  if (chatCount) badges.push(`聊天截图 ${chatCount}`)
  return badges
}

function isImageAttachmentBadge(badge: string) {
  return badge.startsWith('图片') || badge.startsWith('聊天截图')
}

function getImageAttachments(item: any) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : []
  return attachments.filter((attachment: any) => attachment?.type === 'image' && attachment?.fileID)
}

async function previewTimelineImages(item: any) {
  const imageAttachments = getImageAttachments(item)
  if (imageAttachments.length === 0) return
  try {
    uni.showLoading({ title: '加载图片...' })
    const urls = (await Promise.all(
      imageAttachments.map((attachment: any) => getTempFileURL(attachment.fileID).catch(() => ''))
    )).filter(Boolean)
    uni.hideLoading()
    if (urls.length === 0) {
      showError('图片暂时无法预览')
      return
    }
    uni.previewImage({
      current: urls[0],
      urls
    })
  } catch (error: any) {
    uni.hideLoading()
    showError(error?.message || '图片预览失败')
  }
}

async function loadTriggerImageLinks() {
  const attachments = triggerImageAttachments.value
  if (attachments.length === 0) return
  const nextMap = { ...imageUrlMap.value }
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function loadAssessmentImageLinks() {
  const nextMap = { ...imageUrlMap.value }
  const attachments = assessmentTimeline.value.flatMap((item: any) => getImageAttachments(getAssessmentEvent(item)))
  await Promise.all(attachments.map(async (attachment: any) => {
    if (!attachment.fileID || nextMap[attachment.fileID]) return
    nextMap[attachment.fileID] = await getTempFileURL(attachment.fileID).catch(() => '')
  }))
  imageUrlMap.value = nextMap
}

async function previewTriggerImage(index = 0) {
  await loadTriggerImageLinks()
  const urls = triggerImageLinkItems.value.map((item) => item.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

async function previewAssessmentImages(item: any, index = 0) {
  await loadAssessmentImageLinks()
  const urls = getAssessmentImageLinkItems(item).map((link: any) => link.url).filter(Boolean)
  if (urls.length === 0) {
    showError('图片暂时无法预览')
    return
  }
  uni.previewImage({
    current: urls[Math.min(index, urls.length - 1)] || urls[0],
    urls
  })
}

function mapSystemTrackTypeLabel(type?: string) {
  switch (type) {
    case 'assessment': return '系统评估'
    case 'trend': return '趋势重算'
    case 'positive': return '推进研判'
    case 'risk': return '风险研判'
    case 'verification': return '验证研判'
    case 'note': return '普通记录'
    default: return '系统日志'
  }
}

function mapTimelineTypeMessage(type?: string) {
  switch (type) {
    case 'positive': return '系统判定：这更像一次推进事件，会更关注主动、投入和关系推进信号。'
    case 'risk': return '系统判定：这更像一次风险事件，会更关注回避、拖延、失约和一致性问题。'
    case 'verification': return '系统判定：这更像一次验证事件，会更关注事实核实和承诺兑现。'
    case 'note': return '系统判定：这更像一条普通记录，先保留，等待后续更多线索。'
    default: return '系统已经完成本次事件分类。'
  }
}

function mapAction(action?: string) {
  switch (action) {
    case 'observe': return '继续观察'
    case 'verify': return '先做验证'
    case 'clarify': return '适合澄清'
    case 'pause': return '先暂停推进'
    case 'insufficient_data': return '样本还不够'
    default: return action || '继续观察'
  }
}

function mapSubjectRoleLabel(role?: string) {
  return role === 'self' ? '我的记录' : '对方记录'
}

function mapDirectionCopy(direction: 'up' | 'down' | 'flat', positiveWhenUp: string, positiveWhenDown: string) {
  if (direction === 'up') return positiveWhenUp
  if (direction === 'down') return positiveWhenDown
  return '基本持平'
}

function didAIReview(record: any) {
  return Boolean(record?.aiUsed)
}

function toggleManualTimelineExpanded() {
  manualTimelineExpanded.value = !manualTimelineExpanded.value
}

function setTimelineView(key: 'events' | 'assessments' | 'system') {
  activeTimelineView.value = key
}

function setTimelineFilter(key: string) {
  activeTimelineFilter.value = key
  manualTimelineExpanded.value = false
}

function setAssessmentFilter(key: string) {
  activeAssessmentFilter.value = key
}

function formatAxisDate(record: any) {
  const timestamp = getTimelineRecordTimestamp(record)
  if (!timestamp) return '--/--'
  const date = new Date(timestamp)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function formatAxisTime(record: any) {
  const timestamp = getTimelineRecordTimestamp(record)
  if (!timestamp) return '--:--'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatRecordedAt(record: any) {
  if (!record.createdAt) return ''
  const timestamp = new Date(record.createdAt).getTime()
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `记录于 ${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function scrollToEvent(eventId: string) {
  // #ifdef MP-ALIPAY || MP-BAIDU
  uni.createSelectorQuery().select(`#event-${eventId}`)
    .boundingClientRect((rect: any) => {
      if (rect) uni.pageScrollTo({ scrollTop: rect.top, duration: 300 })
    }).exec()
  // #else
  uni.pageScrollTo({
    selector: `#event-${eventId}`,
    duration: 300
  })
  // #endif
}

function goCaseDetail() {
  setActiveCaseId(caseId.value)
  uni.switchTab({ url: '/pages/case-detail/case-detail' })
}

function goTimelineEvent(eventId: string) {
  activeTimelineView.value = 'events'
  targetEventId.value = String(eventId || '').trim()
  manualTimelineExpanded.value = Boolean(targetEventId.value)
  nextTick(() => {
    if (targetEventId.value) {
      setTimeout(() => scrollToEvent(targetEventId.value), 80)
    }
  })
}

function applyEntryContext(options?: Record<string, any>) {
  const pending = consumePendingTimelineContext()
  caseId.value = String(options?.caseId || pending?.caseId || getActiveCaseId() || '').trim()
  classified.value = pending ? Boolean(pending.classified) : options?.classified === '1'
  classifiedType.value = String(pending?.eventType || options?.eventType || '').trim()
  recorded.value = pending ? Boolean(pending.recorded) : options?.recorded === '1'
  targetEventId.value = String(
    pending?.targetEventId
      || (options?.targetEventId ? decodeURIComponent(options.targetEventId) : '')
      || ''
  ).trim()
  if (caseId.value) setActiveCaseId(caseId.value)
}

onLoad((options) => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  applyEntryContext(options)
  initialized.value = true
  skipNextShowRefresh.value = true
  loadData()
})

onShow(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
  if (!initialized.value) return
  if (skipNextShowRefresh.value) {
    skipNextShowRefresh.value = false
    return
  }
  applyEntryContext()
  loadData()
})

onHide(() => {
  selectedStatusInfo.value = null
})

onUnload(() => {
  selectedStatusInfo.value = null
})

async function ensureCaseId(uid: string) {
  if (caseId.value) return true
  const active = getActiveCaseId()
  if (active) {
    caseId.value = active
    return true
  }
  const list = await getCases(uid)
  const firstCaseId = list?.[0]?.caseId || list?.[0]?._id || ''
  if (!firstCaseId) return false
  caseId.value = firstCaseId
  setActiveCaseId(firstCaseId)
  return true
}

async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  userId.value = uid
  loading.value = true
  try {
    const hasCase = await ensureCaseId(uid)
    if (!hasCase) {
      caseFile.value = null
      return
    }
    manualTimelineExpanded.value = Boolean(targetEventId.value)
    const [detail, selfProfileRes] = await Promise.all([
      getCaseDetail(uid, caseId.value),
      getSelfProfile().catch((error: any) => {
        console.warn('[page:timeline] load self profile failed:', error)
        return null
      })
    ])
    caseFile.value = detail
    if (selfProfileRes?.success) selfProfile.value = selfProfileRes.selfProfile
    await loadTriggerImageLinks()
    await loadAssessmentImageLinks()
    if (activeTimelineFilter.value !== 'all') {
      const stillAvailable = timelineFilterOptions.value.some((item) => item.key === activeTimelineFilter.value && item.count > 0)
      if (!stillAvailable) activeTimelineFilter.value = 'all'
    }
    if (targetEventId.value) {
      await nextTick()
      setTimeout(() => {
        scrollToEvent(targetEventId.value)
      }, 80)
    }
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: var(--spacing-page, 28rpx);
  background:
    linear-gradient(180deg, rgba(18, 60, 54, 0.07), rgba(18, 60, 54, 0) 390rpx),
    var(--app-bg, #f6f1e8);
}

.center { text-align: center; padding: 80rpx 0; }

.card {
  margin-bottom: 24rpx;
  padding: var(--spacing-card, 32rpx);
  border-radius: var(--radius-md, 18rpx);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background: var(--card-bg, rgba(255, 252, 247, 0.96));
  box-shadow: var(--shadow-md, 0 16rpx 36rpx rgba(32, 25, 20, 0.06));
}

.hero-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(var(--hero-gradient-angle, 135deg), var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-color: rgba(201, 164, 92, 0.25);
  box-shadow: var(--shadow-hero, 0 22rpx 44rpx rgba(18, 60, 54, 0.18));
}

.hero-topline { display: block; color: rgba(255, 252, 247, 0.72); font-size: 22rpx; letter-spacing: 3rpx; }

.h1 {
  display: block; margin: 8rpx 0;
  color: var(--text-main, #201914);
  font-size: 42rpx; font-weight: var(--font-weight-hero, 700);
  line-height: var(--text-line-height-heading, 1.25);
}

.hero-card .h1 { color: #fffaf0; }

.h2 {
  display: block; margin-bottom: 10rpx;
  color: var(--text-main, #201914);
  font-size: 32rpx; font-weight: var(--font-weight-strong, 600);
  line-height: var(--text-line-height-heading, 1.35);
}

.hero-subtext { display: block; color: rgba(255, 252, 247, 0.76); font-size: 26rpx; line-height: var(--text-line-height, 1.6); }

.muted { display: block; margin: 6rpx 0; color: var(--text-muted, #76695c); font-size: 24rpx; line-height: var(--text-line-height, 1.55); }

.badges,
.feedback-badges {
  margin-top: 14rpx;
}

.badge {
  display: inline-block;
  margin: 4rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.24);
  background: var(--accent-soft, rgba(201, 164, 92, 0.14));
  color: #6f5225;
  font-size: 22rpx;
}

.muted-badge {
  background: rgba(18, 60, 54, 0.06);
  color: var(--text-muted, #76695c);
}

.subject-badge {
  color: #143f3a;
  background: rgba(20, 63, 58, 0.1);
  border-color: rgba(20, 63, 58, 0.2);
}

.ai-badge {
  display: inline-block;
  width: fit-content;
  margin: 6rpx 0;
  padding: 7rpx 14rpx;
  border: 1rpx solid rgba(15, 107, 69, 0.22);
  border-radius: 999rpx;
  background: #e7f3ef;
  color: #0f6b45;
  font-size: 21rpx;
  font-weight: 650;
  line-height: 1.35;
}

.status-card {
  border-left: 8rpx solid #143f3a;
}

.status-card.success {
  border-left-color: #14633a;
  background: #dff5e8;
}

.status-card.warning {
  border-left-color: #b85c38;
  background: #f9d8d2;
}

.status-strong {
  display: block;
  margin-bottom: 6rpx;
  color: #241b12;
  font-size: 28rpx;
  font-weight: 700;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.link-button {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 20rpx;
  border: none;
  border-radius: var(--radius-sm, 10rpx);
  background: var(--primary, #143f3a);
  color: #fff;
  font-size: 24rpx;
}

.link-button.secondary {
  border: 1rpx solid rgba(18, 60, 54, 0.25);
  background: var(--card-bg, rgba(255, 252, 247, 0.92));
  color: var(--primary, #143f3a);
}

.grid {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.grid.two {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.trend-grid {
  margin-top: 14rpx;
}

.trend-box {
  flex: 1;
  min-width: 280rpx;
  padding: 20rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  border-radius: var(--radius-sm, 12rpx);
  background: var(--card-soft, #fffaf3);
}

.case-kpi-label {
  display: block;
  margin-bottom: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
}

.timeline-stats-card {
  border-left: 6rpx solid rgba(201, 164, 92, 0.62);
}

.timeline-switch-card {
  padding: 18rpx;
}

.timeline-view-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.timeline-view-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 64rpx;
  padding: 0 10rpx;
  border-radius: var(--radius-sm, 14rpx);
  border: 1rpx solid rgba(18, 60, 54, 0.12);
  background: rgba(255, 252, 247, 0.78);
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  font-weight: 750;
}

.timeline-view-tab.active {
  border-color: rgba(18, 60, 54, 0.36);
  background: var(--primary, #123c36);
  color: #fffaf0;
}

.timeline-view-tab.active .timeline-view-count { background: rgba(255, 252, 247, 0.22); }

.timeline-filter-chip.active { border-color: rgba(18, 60, 54, 0.36); background: var(--primary, #123c36); color: #fffaf0; }

.timeline-filter-chip.active .timeline-filter-count { background: rgba(255, 252, 247, 0.2); }

.timeline-view-count {
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
  text-align: center;
  font-size: 20rpx;
}

.timeline-view-tab.active .timeline-view-count {
  background: rgba(255, 252, 247, 0.22);
}

.timeline-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 12rpx;
}

.assessment-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.timeline-stat-box {
  min-width: 0;
  padding: 16rpx;
  border-radius: var(--radius-sm, 14rpx);
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 90rpx),
    var(--card-soft, #fffaf3);
}

.timeline-stat-value {
  display: block;
  margin-top: 6rpx;
  color: var(--primary, #123c36);
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.12;
}

.timeline-filter-scroll {
  width: 100%;
  margin-top: 18rpx;
  white-space: nowrap;
}

.timeline-filter-row {
  display: inline-flex;
  gap: 10rpx;
  padding-bottom: 4rpx;
}

.timeline-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 56rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.14);
  background: rgba(255, 252, 247, 0.78);
  color: var(--text-main, #201914);
  font-size: 23rpx;
  font-weight: 650;
}

.trend-number {
  display: block;
  margin: 8rpx 0;
  font-size: 48rpx;
  font-weight: 700;
}

.trend-number.up {
  color: #14633a;
}

.trend-number.down {
  color: #b85c38;
}

.trend-number.flat {
  color: #786857;
}

.trend-summary-text {
  display: block;
  margin: 14rpx 0;
  color: var(--text-main, #201914);
  font-size: 28rpx;
  font-weight: 600;
}

.trend-warning {
  display: block;
  margin: 12rpx 0;
  color: #b85c38;
  font-size: 26rpx;
  font-weight: 600;
}

.feedback-headline {
  margin-top: 10rpx;
}

.feedback-headline.strong {
  display: block;
  color: var(--text-main, #201914);
  font-size: 27rpx;
  line-height: 1.55;
  font-weight: 700;
}

.instant-delta-panel {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.instant-delta-item {
  flex: 1;
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.78);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}

.delta-label {
  display: block;
  font-size: 22rpx;
  color: var(--text-muted, #76695c);
}

.delta-value {
  display: block;
  margin-top: 6rpx;
  color: var(--text-muted, #76695c);
  font-size: 38rpx;
  font-weight: 800;
}

.delta-value.up { color: var(--success, #0f6b45); }
.delta-value.down { color: var(--risk, #b84a3a); }
.delta-value.flat { color: var(--text-muted, #76695c); }

.quick-section,
.quick-status-panel,
.quick-reason-panel,
.raw-ai-reply-panel,
.quick-guidance-panel,
.quick-trend-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
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

.legacy-hidden {
  display: none;
}

.mini-title {
  color: var(--text-main, #201914);
  font-size: 26rpx;
  font-weight: 700;
}

.info-icon {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(18, 60, 54, 0.24);
  background: rgba(255, 252, 247, 0.84);
  color: var(--primary, #123c36);
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
  border-radius: 22rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.28);
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
  border-radius: 16rpx;
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
  line-height: 1.55;
}

.mini-sub {
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
}

.keyword-line {
  margin-top: 8rpx;
}

.status-tag-groups {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.status-tag-row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.status-tag-title {
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
  font-weight: 650;
}

.quick-reason {
  display: block;
  margin-top: 10rpx;
  color: var(--text-main, #201914);
  font-size: 24rpx;
  line-height: 1.55;
}

.raw-ai-reply-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #201914);
  font-size: 25rpx;
  line-height: 1.6;
}

.history-raw-reply {
  background: rgba(255, 250, 243, 0.74);
}

.status-meta {
  display: block;
  color: var(--text-muted, #76695c);
  font-size: 23rpx;
  line-height: 1.5;
}

.status-summary {
  display: block;
  margin: 12rpx 0 8rpx;
  color: var(--text-main, #201914);
  font-size: 26rpx;
  font-weight: 650;
  line-height: 1.55;
}

.quick-trend-panel :deep(.trend-title) {
  display: none;
}

.instant-attachments {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 250, 243, 0.92);
  border: 1rpx solid rgba(18, 60, 54, 0.08);
}

.instant-attachment-link {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(201, 164, 92, 0.12);
  border: 1rpx solid rgba(201, 164, 92, 0.2);
}

.instant-link-title,
.instant-link-url {
  display: block;
}

.instant-link-title {
  color: var(--primary, #123c36);
  font-size: 24rpx;
  font-weight: 750;
}

.instant-link-url {
  margin-top: 6rpx;
  color: var(--text-muted, #76695c);
  font-size: 21rpx;
  line-height: 1.35;
  word-break: break-all;
}

.instant-side-read {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background: rgba(255, 252, 247, 0.78);
}

.guidance-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(201, 164, 92, 0.18);
  background: rgba(201, 164, 92, 0.1);
}

.history-guidance {
  background: rgba(255, 250, 243, 0.74);
}

.guidance-item {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(255, 252, 247, 0.72);
  border: 1rpx solid rgba(18, 60, 54, 0.06);
}

.guidance-label,
.guidance-text {
  display: block;
}

.guidance-label {
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 750;
}

.guidance-text {
  margin-top: 6rpx;
  color: var(--text-main, #201914);
  font-size: 24rpx;
  line-height: 1.55;
}

.ai-panel-label {
  display: block;
  margin-bottom: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
  font-weight: 750;
}

.side-read-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.side-read-item {
  padding: 16rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: var(--card-soft, #fffaf3);
}

.side-read-label {
  display: block;
  color: var(--primary, #123c36);
  font-size: 23rpx;
  font-weight: 750;
}

.side-read-text {
  display: block;
  margin-top: 8rpx;
  color: var(--text-main, #201914);
  font-size: 24rpx;
  line-height: 1.58;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}

.timeline-list.large {
  gap: 20rpx;
}

.timeline-item {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  border-radius: var(--radius-sm, 14rpx);
  background: var(--card-soft, #fffaf3);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.timeline-item.system {
  background: rgba(255, 250, 243, 0.72);
}

.timeline-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100rpx;
}

.timeline-axis-date,
.timeline-axis-time {
  color: var(--text-muted, #76695c);
}

.timeline-axis-date {
  font-size: 22rpx;
}

.timeline-axis-time {
  margin-top: 2rpx;
  font-size: 20rpx;
}

.timeline-marker {
  width: 16rpx;
  height: 16rpx;
  margin-top: 8rpx;
  border-radius: 50%;
  box-shadow: 0 0 0 6rpx rgba(18, 60, 54, 0.08);
}

.timeline-marker.positive { background: var(--success, #0f6b45); }
.timeline-marker.risk { background: var(--risk, #b84a3a); }
.timeline-marker.verification { background: var(--accent, #c9a45c); }
.timeline-marker.assessment { background: var(--primary-2, #2f6a5c); }
.timeline-marker.trend { background: var(--primary, #123c36); }
.timeline-marker.note { background: var(--text-muted, #76695c); }

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-bottom: 8rpx;
}

.timeline-meta text {
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
}

.timeline-title {
  display: block;
  margin: 4rpx 0;
  color: var(--text-main, #201914);
  font-size: 28rpx;
  font-weight: 600;
}

.timeline-desc {
  display: block;
  color: var(--text-main, #201914);
  font-size: 26rpx;
  line-height: 1.5;
}

.timeline-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.attachment-badge {
  display: inline-flex;
  align-items: center;
  height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: rgba(18, 60, 54, 0.08);
  color: var(--primary, #123c36);
  font-size: 22rpx;
  font-weight: 650;
}

.attachment-badge.clickable {
  background: rgba(201, 164, 92, 0.16);
  font-weight: 750;
}

.timeline-expand-row {
  margin-top: 20rpx;
}

.assessment-flow {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.assessment-flow-row {
  display: flex;
  gap: 18rpx;
  align-items: flex-start;
  padding: 22rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0) 110rpx),
    var(--card-soft, #fffaf3);
}

.assessment-flow-item {
  flex: 1;
  min-width: 0;
}

.history-instant-card {
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.08);
  border-left: 6rpx solid rgba(201, 164, 92, 0.72);
  background: rgba(255, 252, 247, 0.82);
}

.assessment-flow-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.assessment-flow-title,
.assessment-flow-time {
  display: block;
}

.assessment-flow-title {
  color: var(--text-main, #201914);
  font-size: 28rpx;
  line-height: 1.4;
  font-weight: 750;
}

.assessment-flow-time {
  margin-top: 4rpx;
  color: var(--text-muted, #76695c);
  font-size: 22rpx;
}

.assessment-flow-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 320rpx;
}

.assessment-trace-box {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(18, 60, 54, 0.07);
  background: rgba(255, 252, 247, 0.72);
}

.assessment-trace-box.side-snapshot {
  margin-top: 22rpx;
  border-left: 5rpx solid rgba(18, 60, 54, 0.2);
  background: rgba(18, 60, 54, 0.04);
}

.assessment-trace-box.status-snapshot {
  border-left: 5rpx solid rgba(201, 164, 92, 0.62);
}

.assessment-trace-box.first-assessment {
  background: rgba(255, 252, 247, 0.62);
}

.score-panel {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 252, 247, 0.72);
  border: 1rpx solid rgba(18, 60, 54, 0.07);
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

.score-label {
  font-size: 23rpx;
  color: var(--text-muted, #76695c);
}

.score-value {
  font-size: 36rpx;
  line-height: 1;
  font-weight: 800;
  color: var(--primary, #123c36);
}

.score-bucket {
  font-size: 23rpx;
  color: var(--text-main, #201914);
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

.status-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

.status-tags {
  justify-content: flex-end;
  max-width: 430rpx;
  margin-top: 0;
}

.bullets {
  margin-top: 12rpx;
}

.caution-list {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(18, 60, 54, 0.08);
}

.bullet {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted, #76695c);
  font-size: 24rpx;
  line-height: 1.55;
}

.compact-link {
  display: inline-flex;
  width: auto;
  min-width: 0;
  height: 52rpx;
  line-height: 52rpx;
  margin-top: 12rpx;
  padding: 0 18rpx;
  font-size: 22rpx;
}

.timeline-desc.strong {
  color: var(--text-main, #201914);
  font-weight: 700;
}

.system-track-card {
  border-style: dashed;
  border-color: rgba(18, 60, 54, 0.16);
}

.fold-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.fold-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.track-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 70rpx;
  height: 44rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  background: var(--accent-soft, rgba(201, 164, 92, 0.14));
  color: #6f5225;
  font-size: 22rpx;
  font-weight: 650;
}

.fold-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72rpx;
  height: 48rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #143f3a;
  color: #fff;
  font-size: 22rpx;
  font-weight: 650;
}

.system-track-list { margin-top: 22rpx; }

/* ===== CAMPUS POP V2 ===== */
.version-toggle { display: flex; gap: 0; margin-bottom: 18rpx; border: 3rpx solid #111; overflow: hidden; background: #fff; }
.toggle-tab { flex: 1; text-align: center; padding: 14rpx 0; font-size: 26rpx; font-weight: 700; color: #999; }
.toggle-tab.active { background: #111; color: #FFD93D; font-weight: 900; }

.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }

.v2-mode .loading-v2 { text-align: center; padding: 120rpx 0; font-size: 28rpx; font-weight: 800; color: #111; letter-spacing: 4rpx; }
.v2-mode .empty-v2 { padding: 40rpx; border: 3rpx solid #111; background: #fff; margin-bottom: 18rpx; }
.v2-mode .empty-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; margin-bottom: 8rpx; }
.v2-mode .empty-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #666; line-height: 1.5; }

.v2-mode .notice-v2 { padding: 20rpx; border: 3rpx solid #111; margin-bottom: 18rpx; }
.v2-mode .notice-v2.ok { background: #E0FFF0; }
.v2-mode .notice-v2.warn { background: #FFEEEC; }
.v2-mode .notice-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 6rpx; }
.v2-mode .notice-sub-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; }

.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .tag-v2 { display: inline-flex; align-items: center; min-height: 36rpx; padding: 4rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .tag-v2.black { background: #111; color: #fff; }
.v2-mode .tag-v2.sm { min-height: 28rpx; padding: 2rpx 10rpx; font-size: 18rpx; }

.v2-mode .card-v2 { background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111; padding: 28rpx; margin-bottom: 24rpx; }
.v2-mode .section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 10rpx; }

.v2-mode .feedback-title-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; line-height: 1.3; }
.v2-mode .feedback-desc-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 6rpx; }

.v2-mode .trend-grid-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; }
.v2-mode .trend-item-v2 { padding: 18rpx; border: 2rpx solid #111; text-align: center; background: #f9f9f9; }
.v2-mode .trend-num-v2 { display: block; font-size: 40rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .trend-num-v2.risk { color: #FF5252; }
.v2-mode .trend-unit-v2 { display: block; font-size: 18rpx; font-weight: 600; color: #999; margin-top: 4rpx; }
.v2-mode .trend-summary-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 10rpx; }
.v2-mode .trend-warn-v2 { display: block; font-size: 22rpx; font-weight: 700; color: #FF5252; margin-top: 6rpx; }

.v2-mode .side-inline-v2 { margin-top: 12rpx; padding: 14rpx; border: 2rpx dashed #111; background: #FFFBEB; }
.v2-mode .focus-label-v2 { display: block; font-size: 20rpx; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1rpx; }
.v2-mode .weekly-desc-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .action-box-v2 { margin-top: 12rpx; padding: 14rpx; border: 2rpx solid #111; background: #f5f5ff; }
.v2-mode .action-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.v2-mode .action-item-v2 { padding: 10rpx; border: 2rpx solid #111; background: #fff; margin-top: 8rpx; }
.v2-mode .action-item-label-v2 { display: block; font-size: 20rpx; font-weight: 900; color: #111; }
.v2-mode .action-item-text-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; margin-top: 4rpx; }

.v2-mode .tab-switch-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin-bottom: 24rpx; }
.v2-mode .tab-btn-v2 { text-align: center; padding: 16rpx 8rpx; border: 3rpx solid #111; background: #fff; font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .tab-btn-v2.active { background: #111; color: #FFD93D; }

.v2-mode .stats-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-bottom: 14rpx; }
.v2-mode .stat-box-v2 { padding: 16rpx; border: 2rpx solid #111; background: #f9f9f9; text-align: center; }
.v2-mode .stat-num-v2 { display: block; font-size: 30rpx; font-weight: 900; color: #111; line-height: 1; }
.v2-mode .stat-lbl-v2 { display: block; font-size: 18rpx; font-weight: 700; color: #666; margin-top: 2rpx; }

.v2-mode .filter-scroll-v2 { width: 100%; margin-top: 8rpx; white-space: nowrap; }
.v2-mode .filter-row-v2 { display: inline-flex; gap: 8rpx; }
.v2-mode .filter-chip-v2 { display: inline-flex; align-items: center; min-height: 48rpx; padding: 0 16rpx; border: 2rpx solid #111; background: #fff; font-size: 20rpx; font-weight: 700; color: #111; }
.v2-mode .filter-chip-v2.active { background: #111; color: #fff; }

.v2-mode .event-list-v2 { display: flex; flex-direction: column; gap: 14rpx; margin-top: 14rpx; }
.v2-mode .event-row-v2 { display: flex; gap: 14rpx; padding: 18rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .event-row-v2.system { background: #fff; border-style: dashed; }
.v2-mode .event-time-v2 { display: flex; flex-direction: column; align-items: center; width: 80rpx; flex-shrink: 0; }
.v2-mode .event-date-v2 { font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .event-clock-v2 { font-size: 16rpx; font-weight: 600; color: #999; }
.v2-mode .event-dot-v2 { width: 14rpx; height: 14rpx; border-radius: 50%; margin-top: 6rpx; border: 2rpx solid #111; }
.v2-mode .event-dot-v2.positive { background: #4ECDC4; }
.v2-mode .event-dot-v2.risk { background: #FF5252; }
.v2-mode .event-dot-v2.verification { background: #FFD93D; }
.v2-mode .event-dot-v2.assessment { background: #111; }
.v2-mode .event-dot-v2.trend { background: #666; }
.v2-mode .event-dot-v2.note { background: #ccc; }
.v2-mode .event-body-v2 { flex: 1; min-width: 0; }
.v2-mode .event-meta-v2 { display: flex; flex-direction: column; gap: 2rpx; margin-bottom: 6rpx; }
.v2-mode .event-meta-v2 text { font-size: 18rpx; font-weight: 600; color: #999; }
.v2-mode .event-title-v2 { display: block; font-size: 26rpx; font-weight: 800; color: #111; line-height: 1.4; }
.v2-mode .event-desc-v2 { display: block; font-size: 22rpx; font-weight: 600; color: #555; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .assessment-card-v2 { background: #fff; padding: 16rpx; border: 2rpx solid #111; }
.v2-mode .score-block-v2 { margin-top: 10rpx; padding: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .score-row-v2 { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; }
.v2-mode .score-row-v2:first-child { margin-top: 0; }
.v2-mode .score-lbl-v2 { width: 40rpx; font-size: 18rpx; font-weight: 700; color: #666; }
.v2-mode .score-val-v2 { width: 44rpx; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .score-val-v2.risk { color: #FF5252; }
.v2-mode .score-tag-v2 { font-size: 18rpx; font-weight: 600; color: #999; margin-right: 6rpx; }
.v2-mode .score-bar-v2 { flex: 1; height: 10rpx; border: 2rpx solid #ccc; background: #fff; }
.v2-mode .score-fill-v2 { height: 10rpx; background: #111; }
.v2-mode .score-fill-v2.risk { background: #FF5252; }

.v2-mode .delta-val-v2 { display: block; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .delta-val-v2.up { color: #4ECDC4; }
.v2-mode .delta-val-v2.down { color: #FF5252; }
.v2-mode .delta-val-v2.flat { color: #999; }

.v2-mode .reason-box-v2 { margin-top: 10rpx; padding: 14rpx; border: 2rpx solid #111; background: #FFFBEB; }
.v2-mode .reason-line-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #555; line-height: 1.6; margin-top: 2rpx; }

.v2-mode .status-box-v2 { margin-top: 10rpx; padding: 14rpx; border: 2rpx solid #111; background: #f9f9f9; }
.v2-mode .status-head-v2 { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.v2-mode .info-icon-v2 { width: 30rpx; height: 30rpx; line-height: 28rpx; text-align: center; border: 2rpx solid #111; font-size: 18rpx; font-weight: 900; color: #111; }
.v2-mode .tag-v2.muted { background: #e8e8e8; color: #666; }

.v2-mode .delta-row-v2 { display: flex; gap: 8rpx; }
.v2-mode .delta-item-v2 { flex: 1; padding: 10rpx; border: 2rpx solid #111; text-align: center; background: #fff; }
.v2-mode .delta-lbl-v2 { font-size: 20rpx; font-weight: 800; color: #111; }

.v2-mode .expand-row-v2 { margin-top: 12rpx; text-align: center; }

.v2-mode .attach-v2 { margin-top: 12rpx; padding: 14rpx; border: 2rpx dashed #111; background: #FFFBEB; }
.v2-mode .attach-link-v2 { padding: 8rpx 0; }
.v2-mode .attach-name-v2 { font-size: 22rpx; font-weight: 700; color: #111; }

.v2-mode .info-mask-v2 { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 40rpx; box-sizing: border-box; }
.v2-mode .info-modal-v2 { width: 100%; max-height: 80vh; overflow: hidden; background: #fff; border: 3rpx solid #111; box-shadow: 10rpx 10rpx 0 #111; }
.v2-mode .info-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 3rpx solid #111; }
.v2-mode .info-title-v2 { font-size: 32rpx; font-weight: 900; color: #111; }
.v2-mode .info-close-v2 { width: 48rpx; height: 48rpx; line-height: 46rpx; text-align: center; border: 2rpx solid #111; font-size: 28rpx; font-weight: 900; color: #111; }
.v2-mode .info-body-v2 { max-height: 60vh; padding: 20rpx 24rpx 24rpx; box-sizing: border-box; }
.v2-mode .info-section-v2 { padding: 20rpx; border: 2rpx solid #111; margin-top: 16rpx; }
.v2-mode .info-section-v2.ylw { background: #FFFBEB; }
.v2-mode .info-sec-title-v2 { display: block; font-size: 26rpx; font-weight: 900; color: #111; margin-bottom: 10rpx; }
.v2-mode .info-sec-copy-v2 { display: block; font-size: 22rpx; color: #555; line-height: 1.6; margin-top: 6rpx; }
.v2-mode .info-sec-copy-v2.strong { font-weight: 700; color: #111; }
.v2-mode .info-tag-row-v2 { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; border-top: 2rpx solid #e8e8e8; }
.v2-mode .info-chip-v2 { padding: 6rpx 14rpx; border: 2rpx solid #111; background: #FFD93D; font-size: 20rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip-v2.muted { background: #e8e8e8; }
.v2-mode .info-chip-copy-v2 { flex: 1; }
.v2-mode .info-chip-title-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .info-chip-desc-v2 { display: block; font-size: 20rpx; color: #666; line-height: 1.5; margin-top: 4rpx; }

.v2-mode .bottom-action-v2 { text-align: center; margin: 10rpx 0 24rpx; }
.v2-mode .btn-v2-bottom { display: inline-block; padding: 14rpx 40rpx; background: #fff; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; color: #111; box-shadow: 4rpx 4rpx 0 #111; }
</style>
