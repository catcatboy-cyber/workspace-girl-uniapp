<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {})
onShow(() => {})
onHide(() => {})
</script>

<style>
page {
  background: var(--app-bg, #f6f1e8);
  color: var(--text-main, #201914);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

button {
  box-sizing: border-box;
}

button::after {
  border: none;
}

/* ===== Shared card styles (applied by global .page class) ===== */
.page .card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0) 150rpx),
    linear-gradient(var(--card-gradient-angle, 135deg), var(--accent-soft, rgba(201, 164, 92, 0.08)), rgba(18, 60, 54, 0.025) 52%, rgba(255, 255, 255, 0) 100%),
    var(--card-bg, #fffcf7);
  border: 1rpx var(--card-border-style, solid) rgba(18, 60, 54, 0.1);
  border-radius: var(--radius-md, 18rpx);
  box-shadow:
    var(--shadow-lg, 0 18rpx 38rpx rgba(32, 25, 20, 0.07)),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.78);
}

.page .hero-card {
  background:
    linear-gradient(var(--hero-gradient-angle, 135deg), var(--hero-bg, #123c36), var(--hero-bg-2, #0f2f2b));
  border-radius: var(--radius-md, 18rpx);
  box-shadow: var(--shadow-hero, 0 22rpx 44rpx rgba(18, 60, 54, 0.18));
}

.page .card .h2,
.page .card .h3,
.page .card .row-title,
.page .card .a-title,
.page .card .metric-title,
.page .card .question-title,
.assessment-form .card .h2 {
  padding-left: 16rpx;
  border-left: 6rpx solid var(--accent, #c9a45c);
  line-height: var(--text-line-height-heading, 1.35);
}

.page .hero-card .h2,
.page .hero-card .h3 {
  padding-left: 0;
  border-left: 0;
}

.page .kpi-item,
.page .trend-box,
.page .question,
.page .model-card,
.page .timeline-item,
.page .case-mini,
.page .achievement-item,
.assessment-form .question {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 120rpx),
    var(--card-soft, #fffaf3);
  border: 1rpx solid rgba(18, 60, 54, 0.1);
  border-radius: var(--radius-sm, 12rpx);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.85),
    var(--shadow-sm, 0 8rpx 18rpx rgba(32, 25, 20, 0.035));
}

.page .badge,
.page .pill,
.assessment-form .toggle-chip {
  border-radius: var(--radius-sm, 12rpx);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.45);
}

/* Typography helpers */
.page .h1 {
  font-weight: var(--font-weight-hero, 700);
  line-height: var(--text-line-height-heading, 1.3);
}
.page .h2, .page .h3 {
  font-weight: var(--font-weight-strong, 600);
  line-height: var(--text-line-height-heading, 1.35);
}
.page .muted {
  line-height: var(--text-line-height, 1.55);
}

/* ===== Entrance Animations (shared across all tab pages) ===== */
@keyframes hero-drop {
  0%   { transform: translateY(-130%) rotate(-2deg); opacity: 0; }
  50%  { transform: translateY(12rpx) rotate(-0.3deg); opacity: 1; animation-timing-function: ease-out; }
  65%  { transform: translateY(-18rpx) rotate(-0.6deg); animation-timing-function: ease-in; }
  78%  { transform: translateY(6rpx) rotate(-0.4deg); animation-timing-function: ease-out; }
  100% { transform: translateY(0) rotate(-0.5deg); opacity: 1; }
}
@keyframes card-in {
  from { transform: translateY(40rpx); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes btn-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.03); }
}

.v2-mode.anim-ready .anim-hero {
  animation: hero-drop 0.7s ease-out both;
}
.v2-mode.anim-ready .anim-card {
  opacity: 0;
  animation: card-in 0.4s ease-out forwards;
}
.v2-mode.anim-ready .anim-pulse {
  animation: btn-pulse 2s ease-in-out infinite;
  animation-delay: 1.2s;
}

/* AI disclaimer footer */
.ai-disclaimer {
  margin-top: 24rpx;
  padding: 16rpx 20rpx;
  text-align: center;
}
.ai-disclaimer-text {
  font-size: 20rpx;
  color: #999;
  line-height: 1.5;
}

/* ===== 大字体模式 — 按字号层级全覆盖 ===== */
/* 56rpx → 63rpx */
.font-large .score-num-v2 { font-size: 63rpx !important; }
/* 48rpx → 54rpx */
.font-large .hero-title-v2,
.font-large .hero-title,
.font-large .title-v2,
.font-large .title-v2.en-title,
.font-large .img-add-icon-v2 { font-size: 54rpx !important; }
/* 44rpx → 49rpx */
.font-large .balance-num-v2 { font-size: 49rpx !important; }
/* 40rpx → 45rpx */
.font-large .kpi-num-v2,
.font-large .trend-num-v2 { font-size: 45rpx !important; }
/* 36rpx → 40rpx */
.font-large .sheet-close,
.font-large .score-value,
.font-large .avatar-placeholder-v2 { font-size: 40rpx !important; }
/* 34rpx → 38rpx */
.font-large .profile-name-v2 { font-size: 38rpx !important; }
/* 32rpx → 36rpx */
.font-large .hero-identity-name,
.font-large .block-title,
.font-large .info-title-v2,
.font-large .info-title,
.font-large .btn-v2-l,
.font-large .pet-custom-icon-v2 { font-size: 36rpx !important; }
/* 30rpx → 34rpx */
.font-large .case-name-v2,
.font-large .sheet-title,
.font-large .a-title { font-size: 34rpx !important; }
/* 28rpx → 32rpx */
.font-large .loading-v2,
.font-large .loading,
.font-large .empty-title-v2,
.font-large .review-title-v2,
.font-large .subtitle-v2,
.font-large .stat-num-v2,
.font-large .usage-total-v2,
.font-large .score-val-v2,
.font-large .info-close-v2,
.font-large .info-close,
.font-large .stat-pair-num-v2,
.font-large .btn-v2-r,
.font-large .btn-v2-sp,
.font-large .model-label-v2,
.font-large .btn-v2-outline,
.font-large .pet-row-name-v2,
.font-large .pet-custom-arrow-v2,
.font-large .chat-head-title,
.font-large .feedback-title-v2 { font-size: 32rpx !important; }
/* 26rpx → 29rpx */
.font-large .hero-copy-v2,
.font-large .hero-copy,
.font-large .hero-copy-v2-sub,
.font-large .btn-v2,
.font-large .btn-v2-me,
.font-large .btn-v2-n,
.font-large .btn-v2-wr,
.font-large .btn-v2.primary,
.font-large .btn-v2-wr.full,
.font-large .btn-v2-hero,
.font-large .btn-v2-action,
.font-large .btn-v2-bottom,
.font-large .btn-v2-submit,
.font-large .submit-btn-v2,
.font-large .event-title-v2,
.font-large .event-title,
.font-large .evidence-main,
.font-large .notice-title-v2,
.font-large .input-v2,
.font-large .footer-v2,
.font-large .text-area-v2,
.font-large .textarea-v2,
.font-large .onboard-card-title-v2,
.font-large .switch-label-v2,
.font-large .insight-item-v2,
.font-large .info-sec-title-v2,
.font-large .info-sec-title,
.font-large .msg-bubble,
.font-large .msg-answer,
.font-large .side-title { font-size: 29rpx !important; }
/* 24rpx → 27rpx */
.font-large .card-text-v2,
.font-large .info-label-v2,
.font-large .info-value-v2,
.font-large .btn-v2.sm,
.font-large .btn-v2-me.sm,
.font-large .btn-v2-wr,
.font-large .btn-v2-n,
.font-large .review-summary-v2,
.font-large .remember-text-v2,
.font-large .tab-btn-v2,
.font-large .usage-feature-v2,
.font-large .feedback-desc-v2,
.font-large .trend-summary-v2,
.font-large .explain-title-v2,
.font-large .picker-v2,
.font-large .ai-text,
.font-large .action-text,
.font-large .side-text,
.font-large .remind-card-text-v2,
.font-large .field-label-v2,
.font-large .segment-v2,
.font-large .result-text-v2,
.font-large .pet-option-name-v2,
.font-large .pet-custom-text-v2,
.font-large .delete-btn-v2,
.font-large .test-result-v2,
.font-large .trace-value,
.font-large .status-summary,
.font-large .trend-summary,
.font-large .pet-bubble-text,
.font-large .weekly-desc-v2,
.font-large .btn-v2-wr,
.font-large .btn-v2-n { font-size: 27rpx !important; }
/* 22rpx → 25rpx */
.font-large .section-title-v2,
.font-large .empty-sub-v2,
.font-large .review-week-v2,
.font-large .bullet-v2,
.font-large .side-text-v2,
.font-large .privacy-v2,
.font-large .error-v2,
.font-large .check-v2,
.font-large .btn-v2-t,
.font-large .notice-sub-v2,
.font-large .trend-warn-v2,
.font-large .action-item-text-v2,
.font-large .event-desc-v2,
.font-large .info-sec-copy-v2,
.font-large .info-chip-title-v2,
.font-large .img-analysis-extracted,
.font-large .img-analysis-summary,
.font-large .action-label,
.font-large .action-item-label,
.font-large .role-label,
.font-large .role-chip,
.font-large .action-item-text,
.font-large .side-item-label,
.font-large .side-item-text,
.font-large .remind-card-title-v2,
.font-large .case-tab-v2,
.font-large .chat-step-text,
.font-large .profile-type-v2,
.font-large .remind-text-v2,
.font-large .turning-name-v2,
.font-large .voice-row-lbl-v2,
.font-large .voice-row-val-v2,
.font-large .balance-unit-v2,
.font-large .chip-label-v2,
.font-large .pet-option-check-v2,
.font-large .default-badge-v2,
.font-large .a-time,
.font-large .ai-panel-label,
.font-large .event-label,
.font-large .evidence-sub,
.font-large .trace-label,
.font-large .side-label { font-size: 25rpx !important; }
/* 20rpx → 22rpx */
.font-large .hero-tag-v2,
.font-large .hero-tag,
.font-large .tag-v2,
.font-large .card-text-v2.muted,
.font-large .side-label-v2,
.font-large .section-hint-v2,
.font-large .focus-label-v2,
.font-large .action-label-v2,
.font-large .action-item-label-v2,
.font-large .filter-chip-v2,
.font-large .event-date-v2,
.font-large .delta-val-v2,
.font-large .reason-line-v2,
.font-large .img-analysis-label,
.font-large .role-hint-v2,
.font-large .block-badge,
.font-large .ai-badge-text,
.font-large .onboard-card-desc-v2,
.font-large .minor-note-v2,
.font-large .char-count-v2,
.font-large .case-id-v2,
.font-large .case-updated-v2,
.font-large .line-legend-item-v2,
.font-large .line-legend-tip-v2,
.font-large .explain-subtitle-v2,
.font-large .explain-item-desc-v2,
.font-large .font-size-label-v2,
.font-large .pet-row-desc-v2,
.font-large .pet-sheet-divider-text-v2,
.font-large .sub-title-v2,
.font-large .img-add-label-v2,
.font-large .delta-pill,
.font-large .source-pill,
.font-large .label-chip,
.font-large .status-chip,
.font-large .week-range-start,
.font-large .week-range-end,
.font-large .theme-name-v2,
.font-large .info-chip-v2,
.font-large .info-chip-desc-v2 { font-size: 22rpx !important; }
.font-large .hero-tag-v2,
.font-large .hero-tag { padding: 8rpx 18rpx !important; }
/* 18rpx → 20rpx */
.font-large .tag-v2.sm,
.font-large .remember-note-v2,
.font-large .stat-lbl-v2,
.font-large .stat-pair-lbl-v2,
.font-large .kpi-lbl-v2,
.font-large .event-clock-v2,
.font-large .event-meta-v2 text,
.font-large .event-meta-recorded,
.font-large .score-lbl-v2,
.font-large .score-bucket-v2,
.font-large .score-label-v2,
.font-large .score-label,
.font-large .score-bucket,
.font-large .score-tag-v2,
.font-large .delta-lbl-v2,
.font-large .score-delta-v2,
.font-large .score-delta-label,
.font-large .score-delta-val,
.font-large .info-icon-v2,
.font-large .img-chat-badge,
.font-large .trend-chg-v2,
.font-large .trend-unit-v2,
.font-large .stat-hint-v2,
.font-large .line-grid-v2 text,
.font-large .line-point-v2 text,
.font-large .line-x-label-v2 text,
.font-large .delta-chip-v2,
.font-large .explain-arrow-v2,
.font-large .usage-meta-v2,
.font-large .theme-desc-v2,
.font-large .pet-option-desc-v2,
.font-large .pet-option-badge-v2,
.font-large .chip-desc-v2,
.font-large .week-range-connector { font-size: 20rpx !important; }
/* 特殊: padding-only 覆盖已在上方 20rpx→22rpx 合并了 */
</style>
