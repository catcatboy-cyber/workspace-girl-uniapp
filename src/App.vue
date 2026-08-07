<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { getCurrentUserId, trackAnonymousVisit } from '@/utils/api'
import { captureLandingContext } from '@/utils/landing'
import { ensureSilentWechatLogin } from '@/utils/silent-login'

onLaunch(() => {
  // 记录分享访问（有参数时）
  try {
    const lo = uni.getLaunchOptionsSync?.() || ({} as any)
    const q = lo?.query || {}
    if (q.shareId || q.inviteCode || q.scene || q.channel) {
      trackAnonymousVisit({ shareId: q.shareId, channel: q.channel, scene: q.scene, inviteCode: q.inviteCode, path: lo.path })
    }
  } catch (_) {}

  // 微信隐私协议授权：首次启动弹窗，用户必须主动点击"同意"
  // 不允许默认自动同意——审核明确要求用户自主选择
  try {
    const PRIVACY_KEY = 'privacyAgreed_v2'
    const alreadyAgreed = !!uni.getStorageSync(PRIVACY_KEY)

    // 注册微信原生隐私监听
    const wxApi = (globalThis as any)?.wx
    if (wxApi?.onNeedPrivacyAuthorization) {
      wxApi.onNeedPrivacyAuthorization((resolve: any) => {
        uni.showModal({
          title: '隐私政策提示',
          content: '在使用语音识别、图片上传等功能前，需要你阅读并同意《隐私政策》和《用户服务协议》。',
          confirmText: '同意并继续',
          cancelText: '暂不同意',
          success: (modalRes: any) => {
            if (modalRes.confirm) {
              uni.setStorageSync(PRIVACY_KEY, true)
              resolve({ event: 'agree' })
            } else {
              resolve({ event: 'disagree' })
            }
          }
        })
      })
    }

  } catch (_) { /* H5 等非微信环境忽略 */ }

  // 全量静默登录：wx.login 无弹窗，后端通过 openid 自动识别/创建用户
  ensureSilentWechatLogin(true).catch(() => {})
})

onShow((options: any) => {
  // 温启动也捕获来源参数（分享链接打开时）
  if (options && typeof options === 'object') {
    captureLandingContext(options)
  }
  if (!getCurrentUserId()) ensureSilentWechatLogin().catch(() => {})
})

onHide(() => {})
</script>

<style lang="scss">
@import "@/uni.scss";

page {
  background: var(--app-bg, #f6f1e8);
  color: var(--text-main, #201914);
  font-family: var(--font-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif);
}

button {
  box-sizing: border-box;
}

button::after {
  border: none;
}

/* ===== Unified Button System ===== */
.btn {
  box-sizing: border-box;
  text-align: center;
  font-weight: var(--font-weight-hero, #{$fw-heading});
  color: var(--text-main, #{$c-ink});
  border: var(--border-width-strong, 3rpx) var(--border-style, solid) var(--border, #{$c-ink});
  border-radius: var(--shape-radius-control, 0);
  background: var(--surface, #{$c-card});
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sizes */
.btn-md  { height: 64rpx; line-height: 64rpx; font-size: $fs-body-lg; padding: 0 24rpx; }
.btn-sm  { height: 48rpx; line-height: 48rpx; font-size: $fs-caption; padding: 0 16rpx; }
.btn-lg  { height: 80rpx; line-height: 80rpx; font-size: $fs-heading; padding: 0 32rpx; }

/* Levels */
.btn-primary   { background: var(--accent-cool, #{$c-mint}); box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #{$c-ink}); }
.btn-secondary { background: var(--surface, #{$c-card}); }
.btn-ghost     { background: transparent; }

/* Layout */
.btn-full { width: 100%; flex: none; }
.btn-auto { flex: none; }

/* Danger */
.btn-danger { color: var(--risk, #{$c-risk}); border-color: var(--risk, #{$c-risk}); }
.btn-danger.btn-primary { background: var(--risk, #{$c-risk}); color: var(--surface, #{$c-card}); }

/* Disabled */
.btn[disabled] { opacity: 0.5; box-shadow: none; }

/* ===== Hero layout v2 — 上下分区 + 分割线 + 大头像左置 ===== */
.hero-divider { border: none; border-top: 1px solid var(--hero-divider, rgba(0,0,0,0.12)); margin: 16px 0 14px; }
.hero-bottom { display: flex; gap: 14px; align-items: stretch; }
.hero-avatar-lg {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: var(--border-width-strong, 3rpx) solid var(--text-main, #111);
  background: var(--accent, #FFD93D);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  font-size: 40rpx;
  line-height: 1;
  font-weight: 900;
  color: var(--text-main, #111);
  box-shadow: var(--shadow-hard, 4rpx 4rpx 0 #111);
}
.hero-avatar-img { width: 100%; height: 100%; display: block; border-radius: 50%; }
.hero-info-col { flex: 1; min-width: 0; min-height: 88rpx; display: flex; flex-direction: column; justify-content: space-between; gap: 8rpx; }
.hero-main-row { min-height: 40rpx; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; overflow: hidden; }
.hero-main-left { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8rpx; flex-wrap: nowrap; overflow: hidden; }
.hero-name-v2 { min-width: 0; max-width: 100%; font-size: $fs-body-lg; line-height: 1.25; font-weight: $fw-hero; color: var(--text-main, #111); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hero-meta-row {
  height: 34rpx;
  display: flex;
  flex-wrap: nowrap;
  gap: 8rpx;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.hero-meta-row::-webkit-scrollbar { display: none; }
.hero-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32rpx;
  max-width: none;
  padding: 3rpx 12rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
  background: var(--surface, #fff);
  color: var(--text-main, #111);
  font-size: $fs-caption;
  line-height: 1.2;
  font-weight: $fw-heading;
  white-space: nowrap;
  box-sizing: border-box;
  flex-shrink: 0;
}
.hero-chip.primary { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.hero-chip.muted { background: var(--surface-dim, #f9f9f9); color: var(--text-muted, #666); border-color: var(--divider-strong, var(--border, #111)); }
.hero-action-pill {
  flex-shrink: 0;
  min-height: 42rpx;
  padding: 0 16rpx;
  border: var(--border-width, 2rpx) solid var(--border, #111);
  border-radius: var(--shape-radius-control, 0);
  background: var(--hero-tag-bg, #111);
  color: var(--hero-tag-color, #FFD93D);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: $fs-caption;
  line-height: 1;
  font-weight: $fw-hero;
  box-shadow: var(--shadow-hard, 3rpx 3rpx 0 #111);
  white-space: nowrap;
}

/* ===== Fortune / Mystical button system（命理卡片专用）===== */
.fortune-card {
  background: #FFFDF5 !important;
  border: 2rpx solid #C4A86C !important;
  box-shadow: 0 4rpx 16rpx rgba(196, 168, 108, 0.15) !important;
}

.btn-fortune {
  box-sizing: border-box;
  text-align: center;
  font-weight: $fw-heading;
  border-radius: 4rpx;
  border: 2rpx solid #C4A86C;
  background: #FFFDF5;
  color: #5C1F1F;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-fortune-primary {
  background: #C41E3A;
  color: #FFD700;
  border-color: #C4A86C;
  box-shadow: 0 2rpx 8rpx rgba(196, 30, 58, 0.25);
}

.btn-fortune-secondary {
  background: #FFFDF5;
  color: #8B4513;
  border: 2rpx solid #C4A86C;
}

.btn-fortune-ghost {
  background: transparent;
  border-style: dashed;
  border-color: #C4A86C;
  color: #8B6914;
}

.btn-fortune-sm  { height: 48rpx; line-height: 48rpx; font-size: $fs-caption; padding: 0 20rpx; }
.btn-fortune-md  { height: 64rpx; line-height: 64rpx; font-size: $fs-body-lg; padding: 0 24rpx; }
.btn-fortune-full { width: 100%; flex: none; }

.btn-fortune[disabled] { opacity: 0.5; box-shadow: none; }

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
  font-weight: $fw-hero;
  line-height: $lh-heading;
}
.page .h2, .page .h3 {
  font-weight: $fw-heading;
  line-height: $lh-heading;
}
.page .muted {
  line-height: $lh-body;
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
  font-size: $fs-body;
  color: var(--text-soft, #{$c-soft});
  line-height: $lh-body;
}

/* ===== 大字体模式 — 所有字号 × 1.2 ===== */
.font-large .v2-mode { --font-scale: 1.2; }
/* 50rpx → 60rpx */
.font-large .score-num-v2 { font-size: $fs-display * 1.2 !important; }
/* 44rpx → 53rpx */
.font-large .hero-title-v2,
.font-large .hero-title,
.font-large .title-v2,
.font-large .title-v2.en-title,
.font-large .img-add-icon-v2,
.font-large .balance-num-v2 { font-size: $fs-hero-title * 1.2 !important; }
/* 38rpx → 46rpx */
.font-large .kpi-num-v2,
.font-large .trend-num-v2,
.font-large .sheet-close,
.font-large .score-value,
.font-large .avatar-placeholder-v2 { font-size: $fs-kpi * 1.2 !important; }

.font-large .profile-name-v2,
.font-large .hero-identity-name,
.font-large .block-title,
.font-large .info-title-v2,
.font-large .info-title,
.font-large .pet-custom-icon-v2,
.font-large .case-name-v2,
.font-large .sheet-title,
.font-large .a-title,
.font-large .btn-lg,
.font-large .section-title-v2 { font-size: $fs-heading * 1.2 !important; }
/* 36rpx → 43rpx */
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
.font-large .model-label-v2,
.font-large .pet-row-name-v2,
.font-large .pet-custom-arrow-v2,
.font-large .chat-head-title,
.font-large .feedback-title-v2,
.font-large .hero-copy-v2,
.font-large .hero-copy,
.font-large .hero-copy-v2-sub,
.font-large .btn-fortune-md,
.font-large .btn-md,
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
.font-large .side-title { font-size: $fs-body-lg * 1.2 !important; }
/* 34rpx → 41rpx */
.font-large .card-text-v2,
.font-large .info-label-v2,
.font-large .info-value-v2,
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
.font-large .test-result-v2,
.font-large .trace-value,
.font-large .status-summary,
.font-large .trend-summary,
.font-large .pet-bubble-text,
.font-large .weekly-desc-v2 { font-size: $fs-body-lg * 1.2 !important; }
/* 32rpx → 38rpx */
.font-large .empty-sub-v2,
.font-large .review-week-v2,
.font-large .bullet-v2,
.font-large .side-text-v2,
.font-large .privacy-v2,
.font-large .error-v2,
.font-large .check-v2,
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
.font-large .side-label,
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
.font-large .info-chip-desc-v2 { font-size: $fs-body * 1.2 !important; }
.font-large .hero-tag-v2,
.font-large .hero-tag { padding: 8rpx 18rpx !important; }
/* 24rpx → 29rpx */
.font-large .btn-sm,
.font-large .btn-fortune-sm,
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
.font-large .week-range-connector { font-size: $fs-caption * 1.2 !important; }
</style>
