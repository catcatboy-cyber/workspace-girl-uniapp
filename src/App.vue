<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => { console.log('[app] Launch') })
onShow(() => { console.log('[app] Show') })
onHide(() => { console.log('[app] Hide') })
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
</style>
