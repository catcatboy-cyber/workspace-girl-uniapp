<template>
  <view class="storybook-report">
    <view class="decor-sprig decor-sprig-top"><view /><view /><view /><view /></view>
    <view class="decor-sprig decor-sprig-middle"><view /><view /><view /><view /></view>
    <view class="decor-flower decor-flower-left"><view /></view>

    <view class="hero">
      <view class="hero-copy">
        <text class="eyebrow">{{ displayTitle }} · 魔镜报告</text>
        <text class="subject">{{ subjectLabel }}最像</text>
        <text class="person-name">{{ primaryName }}型</text>
        <text class="hero-summary">{{ heroSummary }}</text>
      </view>

      <view class="mirror-shell">
        <view class="mirror-crown"><view /><view /><view /></view>
        <view class="mirror-inner">
          <image v-if="report?.primary?.coverUrl" :src="report.primary.coverUrl" mode="aspectFill" class="portrait" />
          <view v-else class="portrait-fallback">{{ primaryInitial }}</view>
        </view>
      </view>

      <view class="score-ribbon">
        <view><text>人物相似度</text><text class="score-note">{{ confidenceText }}</text></view>
        <view class="score-value"><text>{{ exactSimilarity }}</text><text>%</text></view>
      </view>
    </view>

    <view v-if="tags.length" class="tag-row">
      <text v-for="tag in tags" :key="tag" class="tag">#{{ tag }}</text>
    </view>

    <view class="chapter oracle-card">
      <view class="chapter-head"><text>第一章 · 魔镜判词</text><text>先看结论</text></view>
      <view class="chapter-body">
        <text class="oracle-title">{{ report?.decision?.label || levelText }}</text>
        <text class="oracle-copy">{{ report?.decision?.text || heroSummary }}</text>
        <view class="verdict-strip">
          <view class="verdict-label"><text>{{ levelText }}</text><text>{{ exactSimilarity }}% 命中</text></view>
          <text>相似度描述的是人物风格，不直接等于适合度。请继续核对下面的现实信号。</text>
        </view>
      </view>
    </view>

    <view v-if="dimensions.length" class="chapter">
      <view class="chapter-head"><text>第二章 · 关系雷达</text><text>{{ dimensions.length }}维风格画像</text></view>
      <view class="chapter-body">
        <text class="section-title">{{ dimensionTitle }}</text>
        <view class="radar-chart" :aria-label="radarAriaLabel">
          <view
            v-for="scale in radarScales"
            :key="scale"
            class="radar-grid-level"
            :style="{ clipPath: radarFramePolygon, transform: `scale(${scale})` }"
          />
          <view
            v-for="axis in radarAxes"
            :key="axis.key"
            class="radar-axis"
            :style="{ transform: `translateX(-50%) rotate(${axis.angle}deg)` }"
          />
          <view class="radar-data" :style="{ clipPath: radarDataPolygon }" />
          <view
            v-for="axis in radarAxes"
            :key="'label_' + axis.key"
            class="radar-label"
            :style="{ left: axis.labelX + '%', top: axis.labelY + '%' }"
          >
            <text>{{ axis.name }}</text><text>{{ axis.score }}</text>
          </view>
        </view>
        <view class="dimension-list">
          <view v-for="dimension in dimensions" :key="dimension.key" class="dimension">
            <view class="dimension-head"><text>{{ dimension.name }}</text><text>{{ dimension.score }}%</text></view>
            <view class="track"><view class="fill" :style="{ width: dimension.score + '%' }" /></view>
            <text v-if="dimension.copy" class="dimension-copy">{{ dimension.copy }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="evidence.length" class="chapter">
      <view class="chapter-head"><text>第三章 · 为什么像{{ primaryName }}</text><text>按答题证据判断</text></view>
      <view class="chapter-body evidence-list">
        <view v-for="(item, index) in evidence" :key="item.questionId || index" class="evidence-item">
          <text class="evidence-index">{{ String(index + 1).padStart(2, '0') }}</text>
          <view><text class="evidence-question">{{ item.text }}</text><text v-if="item.answer" class="evidence-answer">你的选择：{{ item.answer }}</text></view>
        </view>
      </view>
    </view>

    <view v-if="positiveSignals.length || watchSignals.length" class="chapter">
      <view class="chapter-head"><text>第四章 · 喜欢还是想逃</text><text>看你真正要什么</text></view>
      <view class="chapter-body signal-grid">
        <view v-if="positiveSignals.length" class="signal-card positive">
          <view class="signal-icon"><view class="heart-shape" /></view>
          <text class="signal-title">可能让你心动</text>
          <text v-for="(item, index) in positiveSignals" :key="'positive_' + index" class="signal-copy">{{ item }}</text>
        </view>
        <view v-if="watchSignals.length" class="signal-card caution">
          <view class="signal-icon"><text>!</text></view>
          <text class="signal-title">可能让你想逃</text>
          <text v-for="(item, index) in watchSignals" :key="'watch_' + index" class="signal-copy">{{ item }}</text>
        </view>
      </view>
    </view>

    <view v-if="stageGuidance.length" class="chapter">
      <view class="chapter-head"><text>第五章 · 不同阶段怎么相处</text><text>问题会随阶段变化</text></view>
      <view class="chapter-body">
        <view class="stage-tabs">
          <button
            v-for="stage in stageGuidance"
            :key="stage.key"
            :class="['stage-tab', activeStageKey === stage.key ? 'active' : '']"
            @click="activeStageKey = stage.key"
          >{{ stage.shortLabel || stage.label }}</button>
        </view>
        <view v-if="activeStage" class="stage-panel">
          <text class="stage-title">{{ activeStage.title }}</text>
          <text class="stage-summary">{{ activeStage.summary }}</text>
          <view class="stage-question"><text>?</text><text>可以直接问：{{ activeStage.question }}</text></view>
          <view v-if="report?.scenarioVerification && activeStageKey === report?.stageKey" class="scenario-inline">
            <text>本阶段情景验证</text><text>{{ report.scenarioVerification }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="report?.secondary || ranking.length" class="chapter">
      <view class="chapter-head"><text>第五章 · {{ rankingTitle }}</text><text>不只看第一名</text></view>
      <view class="chapter-body">
        <view v-if="report?.secondary" class="secondary-match">
          <view class="mini-avatar">{{ String(report.secondary.name || '人').slice(0, 1) }}</view>
          <view><text>第二原型</text><text>{{ report.secondary.name }}</text></view>
        </view>
        <view v-if="ranking.length" class="ranking-list">
          <view v-for="(item, index) in ranking" :key="item.personKey || index" class="ranking-item">
            <text class="rank-number">{{ index + 1 }}</text>
            <view class="rank-avatar">
              <image v-if="item.coverUrl" :src="item.coverUrl" mode="aspectFill" />
              <text v-else>{{ String(item.name || '人').slice(0, 1) }}</text>
            </view>
            <text class="rank-name">{{ item.name }}</text>
            <text class="rank-score">{{ item.similarity }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="trafficSignals.length" class="chapter">
      <view class="chapter-head"><text>第六章 · 红绿灯信号</text><text>把感觉落到行为</text></view>
      <view class="chapter-body traffic-list">
        <view v-for="signal in trafficSignals" :key="signal.level" :class="['traffic-item', signal.level]">
          <view class="traffic-dot" />
          <view class="traffic-copy"><text>{{ signal.title }}</text><text>{{ signal.text }}</text></view>
          <text class="traffic-badge">{{ signal.badge }}</text>
        </view>
      </view>
    </view>

    <view v-if="actionSteps.length" class="chapter action-card">
      <view class="chapter-head"><text>第七章 · 现在就能做</text><text>三步验证，不靠猜</text></view>
      <view class="chapter-body action-list">
        <view v-for="(action, index) in actionSteps" :key="index" class="action-item">
          <view class="action-number">{{ index + 1 }}</view>
          <view class="action-copy"><text>{{ action.title }}</text><text>{{ action.text }}</text></view>
        </view>
      </view>
    </view>

    <view v-if="atlasItems.length" class="atlas-card">
      <view class="atlas-copy">
        <text>你的人设图鉴已点亮 {{ atlasItems.length }} 个原型</text>
        <text>{{ atlasLoading ? '正在同步你的测试记录…' : '这些来自真实测试记录；继续测试，还会点亮更多人物风格。' }}</text>
      </view>
      <view class="atlas-portraits">
        <view v-for="item in atlasItems.slice(0, 5)" :key="item.key" class="atlas-person">
          <image v-if="item.coverUrl" :src="item.coverUrl" mode="aspectFill" />
          <text v-else>{{ String(item.name || '人').slice(0, 1) }}</text>
        </view>
      </view>
    </view>

    <view class="report-footnote">
      <text>观察覆盖 {{ report?.observation?.answeredCount || 0 }}/{{ report?.observation?.total || 0 }} · {{ confidenceText }}</text>
      <text>测试用于关系风格探索，请结合持续、可验证的现实行为判断。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getArchetypeResults } from '@/utils/api'

const props = withDefaults(defineProps<{
  report: any
  displayTitle: string
  subjectLabel: string
  variant?: 'relation' | 'portrait'
  rankingTitle?: string
}>(), {
  variant: 'portrait',
  rankingTitle: '人物图鉴'
})

const primaryName = computed(() => String(props.report?.primary?.name || '人物原型'))
const primaryInitial = computed(() => primaryName.value.slice(0, 1) || '人')
const exactSimilarity = computed(() => Math.max(0, Math.min(100, Math.round(Number(props.report?.exactSimilarity) || 0))))
const levelText = computed(() => exactSimilarity.value >= 80 ? '高度相似' : exactSimilarity.value >= 60 ? '明显相似' : exactSimilarity.value >= 40 ? '部分相似' : '相似度较低')
const confidenceText = computed(() => ({ high: '观察充分', medium: '观察中等', low: '观察较少' } as Record<string, string>)[props.report?.observation?.confidence] || '观察信息有限')
const heroSummary = computed(() => String(
  props.variant === 'relation'
    ? props.report?.resultCopy?.attraction || props.report?.primary?.label || props.report?.decision?.text || ''
    : props.report?.primaryDetail?.summary || props.report?.primary?.label || props.report?.decision?.text || ''
))
const tags = computed(() => {
  const values = props.variant === 'relation'
    ? [props.displayTitle, props.report?.primary?.label, levelText.value]
    : [props.report?.primaryDetail?.category, props.report?.primaryDetail?.era || props.report?.primaryDetail?.source, levelText.value]
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 4)
})
const dimensions = computed(() => (Array.isArray(props.report?.dimensions) ? props.report.dimensions : []).map((item: any) => ({
  ...item,
  score: Math.max(0, Math.min(100, Math.round(Number(item?.score) || 0)))
})))
const radarScales = [1, 0.68, 0.36]
const radarAxes = computed(() => dimensions.value.map((item: any, index: number) => {
  const angle = (360 / dimensions.value.length) * index
  const radians = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.value.length
  return {
    ...item,
    angle,
    labelX: Number((50 + Math.cos(radians) * 44).toFixed(2)),
    labelY: Number((50 + Math.sin(radians) * 44).toFixed(2))
  }
}))
const radarFramePolygon = computed(() => polygonForScores(dimensions.value.map(() => 100)))
const radarDataPolygon = computed(() => polygonForScores(dimensions.value.map((item: any) => item.score)))
const radarAriaLabel = computed(() => `关系风格雷达图：${dimensions.value.map((item: any) => `${item.name}${item.score}分`).join('，')}`)
const evidence = computed(() => Array.isArray(props.report?.evidence) ? props.report.evidence.slice(0, 3) : [])
const ranking = computed(() => Array.isArray(props.report?.topFive) ? props.report.topFive.slice(0, 5) : [])
const positiveSignals = computed(() => uniqueText([
  props.report?.primaryDetail?.attraction,
  props.report?.resultCopy?.attraction,
  ...(Array.isArray(props.report?.strengths) ? props.report.strengths : [])
]))
const watchSignals = computed(() => uniqueText([
  props.report?.primaryDetail?.caution,
  props.report?.resultCopy?.caution,
  ...(Array.isArray(props.report?.watchSignals) ? props.report.watchSignals : [])
]))
const stageGuidance = computed(() => {
  if (Array.isArray(props.report?.stageGuidance) && props.report.stageGuidance.length) return props.report.stageGuidance
  return props.variant === 'relation' ? fallbackStages : []
})
const activeStageKey = ref('')
const activeStage = computed(() => stageGuidance.value.find((item: any) => item.key === activeStageKey.value) || stageGuidance.value[0] || null)
const trafficSignals = computed(() => {
  if (Array.isArray(props.report?.trafficSignals) && props.report.trafficSignals.length) return props.report.trafficSignals.slice(0, 3)
  return [
    { level: 'green', badge: '可继续', title: '绿灯：尊重你的节奏，也愿意用行动回应', text: positiveSignals.value[0] || 'TA 能表达投入，同时保留你的决定权。' },
    { level: 'yellow', badge: '要观察', title: '黄灯：说得明确，但兑现还不稳定', text: props.report?.communicationAdvice || '可以沟通，但要继续观察 TA 是否接受你的边界和节奏。' },
    { level: 'red', badge: '要回避', title: '红灯：用付出、冷落或施压要求你服从', text: watchSignals.value[0] || '如果同类行为反复发生，不要只听解释，要优先保护自己的边界。' }
  ]
})
const actionSteps = computed(() => {
  if (Array.isArray(props.report?.actionSteps) && props.report.actionSteps.length) return props.report.actionSteps.slice(0, 3)
  return [
    { title: '提出一个小边界', text: '例如今晚想独处，观察 TA 是尊重、追问，还是立刻情绪化。' },
    { title: '讨论一次真实分歧', text: props.report?.communicationAdvice || '不要只看甜的时候，看看意见不同时 TA 是否还能听完你的话。' },
    { title: '对照行为，不对照承诺', text: watchSignals.value[0] || '连续观察一段时间：TA 说的尊重、投入和共同承担，有没有稳定发生。' }
  ]
})
const dimensionTitle = computed(() => props.variant === 'relation' ? 'TA在关系里的力气用在哪里' : '这次答题呈现出的核心风格')
const atlasItems = ref<any[]>([])
const atlasLoading = ref(false)
let atlasLoadSequence = 0

const fallbackStages = [
  { key: 'pre_relationship', shortLabel: '刚接触', label: '还没在一起', title: '刚接触：先看 TA 是否尊重你的节奏', summary: '这个阶段不急着谈工资和父母态度，先看 TA 会不会因为回复慢、暂时不确定关系，就开始施压或情绪惩罚。', question: '如果我需要慢一点确认关系，你会怎么想？' },
  { key: 'early_dating', shortLabel: '刚交往', label: '刚开始交往', title: '刚交往：看热情能不能稳定又平衡', summary: '重点看 TA 是否稳定安排见面，也看高频联系会不会慢慢变成查岗和全天候要求。', question: '我们都忙的时候，你觉得多久联系一次最舒服？' },
  { key: 'steady_relationship', shortLabel: '稳定期', label: '稳定交往', title: '稳定期：看分歧之后还能不能合作', summary: '观察意见不同时，TA 是愿意听完、一起重分工，还是冷处理、翻旧账或替两个人拍板。', question: '我们意见不一样时，你希望怎样一起做决定？' },
  { key: 'long_term', shortLabel: '长期/婚姻', label: '长期共同生活或婚姻', title: '长期或婚姻：把“为你好”变成可讨论的方案', summary: '此时再具体谈家庭边界、金钱、居住安排和家务分工。能落地很重要，但不能由一个人包办全部决定。', question: '涉及家庭、金钱和居住安排时，最终怎样共同决定？' }
]

watch(stageGuidance, (stages: any[]) => {
  const preferred = String(props.report?.stageKey || '')
  activeStageKey.value = stages.some((item) => item.key === preferred) ? preferred : String(stages[0]?.key || '')
}, { immediate: true })

watch(() => [props.report?.resultId, props.report?.kind, props.report?.subjectGender, props.report?.primary?.key].join('|'), loadAtlas, { immediate: true })

function polygonForScores(scores: number[]) {
  if (scores.length < 3) return 'polygon(50% 50%, 50% 50%, 50% 50%)'
  const radius = 34
  const points = scores.map((score, index) => {
    const radians = -Math.PI / 2 + (Math.PI * 2 * index) / scores.length
    const scaled = radius * Math.max(0, Math.min(100, Number(score) || 0)) / 100
    return `${(50 + Math.cos(radians) * scaled).toFixed(2)}% ${(50 + Math.sin(radians) * scaled).toFixed(2)}%`
  })
  return `polygon(${points.join(',')})`
}

async function loadAtlas() {
  const sequence = ++atlasLoadSequence
  const current = props.report?.primary
    ? { key: String(props.report.primary.key || props.report.primary.name || 'current'), name: String(props.report.primary.name || '人物原型'), coverUrl: String(props.report.primary.coverUrl || '') }
    : null
  atlasItems.value = current ? [current] : []
  const kind = props.report?.kind
  if (!['relation_archetype', 'crush_celebrity', 'dimension_character'].includes(kind)) return
  atlasLoading.value = true
  try {
    const response = await getArchetypeResults({
      kind,
      ...(kind === 'relation_archetype' ? { subjectGender: props.report?.subjectGender } : {}),
      limit: 50
    })
    if (sequence !== atlasLoadSequence || !response?.success) return
    const candidates = [current, ...(response.results || []).map((item: any) => item?.primary)].filter(Boolean)
    const seen = new Set<string>()
    atlasItems.value = candidates.filter((item: any) => {
      const key = String(item?.key || item?.name || '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).map((item: any) => ({ key: String(item.key || item.name), name: String(item.name || '人物原型'), coverUrl: String(item.coverUrl || '') }))
  } catch {
    // 当前原型仍可作为真实点亮记录展示；历史同步失败不影响报告阅读。
  } finally {
    if (sequence === atlasLoadSequence) atlasLoading.value = false
  }
}

function uniqueText(values: unknown[]) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 3)
}
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';

.storybook-report{
  --persona-paper:var(--surface,#fff);
  --persona-soft:var(--surface-soft,var(--card-soft,#f6f6f6));
  --persona-ink:var(--text-main,#111);
  --persona-muted:var(--text-muted,#666);
  --persona-deep:var(--primary,var(--hero-bg,#4b6674));
  --persona-gold:var(--accent,#f0c65a);
  --persona-leaf:var(--accent-cool,#6f9787);
  --persona-coral:var(--risk,#c9645c);
  position:relative;
  overflow:hidden;
  color:var(--persona-ink);
}
.decor-sprig,.decor-flower{position:absolute;z-index:0;pointer-events:none;opacity:.26}.decor-sprig{width:190rpx;height:80rpx}.decor-sprig::before{content:"";position:absolute;left:10rpx;top:39rpx;width:166rpx;height:3rpx;background:var(--persona-leaf);transform:rotate(-12deg)}.decor-sprig view{position:absolute;width:42rpx;height:20rpx;border-radius:100% 0 100% 0;background:var(--persona-leaf);transform:rotate(-25deg)}.decor-sprig view:nth-child(1){left:20rpx;top:18rpx}.decor-sprig view:nth-child(2){left:59rpx;top:40rpx;transform:rotate(145deg)}.decor-sprig view:nth-child(3){left:98rpx;top:9rpx}.decor-sprig view:nth-child(4){left:137rpx;top:29rpx;transform:rotate(145deg)}.decor-sprig-top{right:-68rpx;top:48rpx;transform:rotate(24deg)}.decor-sprig-middle{left:-78rpx;top:980rpx;transform:rotate(205deg)}.decor-flower{left:-18rpx;top:570rpx;width:64rpx;height:64rpx}.decor-flower::before,.decor-flower::after{content:"";position:absolute;inset:22rpx 4rpx;border-radius:50%;background:var(--persona-coral);box-shadow:0 -18rpx 0 var(--persona-coral),0 18rpx 0 var(--persona-coral)}.decor-flower::after{transform:rotate(90deg)}.decor-flower view{position:absolute;z-index:2;left:25rpx;top:25rpx;width:14rpx;height:14rpx;border-radius:50%;background:var(--persona-gold)}
.hero{position:relative;z-index:1;min-height:560rpx;padding:44rpx 26rpx 26rpx;border:var(--border-width,2rpx) solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--shape-radius-hero,var(--radius-lg,36rpx));overflow:hidden;background:var(--surface-soft,var(--persona-paper));box-shadow:var(--shadow-hero,0 22rpx 48rpx rgba(0,0,0,.1))}.hero-copy{position:relative;z-index:2;display:flex;flex-direction:column;width:58%;padding-top:30rpx}.eyebrow{font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading);letter-spacing:3rpx;color:var(--persona-muted)}.subject{margin-top:26rpx;font-size:$fs-caption;font-weight:var(--font-weight-heading,$fw-heading)}.person-name{margin-top:4rpx;font-family:var(--font-display,var(--font-ui));font-size:64rpx;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.06;letter-spacing:-3rpx}.hero-summary{margin-top:24rpx;font-size:$fs-caption;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.72}.mirror-shell{position:absolute;z-index:1;right:-14rpx;top:54rpx;width:316rpx;height:396rpx;padding:14rpx;border:8rpx solid var(--persona-gold);border-radius:50% 50% 44% 44% / 39% 39% 55% 55%;background:var(--persona-paper);box-shadow:var(--shadow-md,0 12rpx 28rpx rgba(0,0,0,.12));transform:rotate(2deg)}.mirror-inner{width:100%;height:100%;overflow:hidden;border:3rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:inherit;background:var(--persona-soft)}.portrait{width:100%;height:100%}.portrait-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:var(--font-display,var(--font-ui));font-size:112rpx;font-weight:var(--font-weight-hero,$fw-hero);color:var(--persona-deep);background:linear-gradient(155deg,var(--persona-soft),var(--brand-cool,var(--persona-paper)))}.mirror-crown{position:absolute;z-index:3;left:50%;top:-42rpx;display:flex;align-items:flex-end;justify-content:center;width:120rpx;height:58rpx;transform:translateX(-50%)}.mirror-crown view{width:34rpx;height:50rpx;border:3rpx solid var(--persona-ink);background:var(--persona-gold);clip-path:polygon(50% 0,100% 100%,0 100%)}.mirror-crown view:nth-child(2){height:62rpx;margin:0 -5rpx}.score-ribbon{position:absolute;z-index:4;right:18rpx;bottom:24rpx;display:grid;grid-template-columns:1fr 126rpx;width:350rpx;min-height:104rpx;overflow:hidden;border:3rpx solid var(--persona-ink);border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));color:var(--primary-contrast,#fff);background:var(--persona-deep);box-shadow:6rpx 7rpx 0 var(--persona-gold);transform:rotate(-2deg)}.score-ribbon>view:first-child{display:flex;flex-direction:column;justify-content:center;padding:18rpx 20rpx}.score-ribbon text{font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero)}.score-note{margin-top:5rpx!important;color:var(--on-active-muted,rgba(255,255,255,.7))!important;font-size:$fs-micro!important}.score-value{display:flex;align-items:flex-end;justify-content:center;padding-bottom:21rpx;color:var(--persona-ink);background:var(--persona-paper)}.score-value text:first-child{font-size:48rpx}.score-value text:last-child{margin-bottom:6rpx;font-size:$fs-caption}
.tag-row{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:12rpx;padding:22rpx 8rpx 24rpx}.tag{padding:12rpx 18rpx;border:2rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--radius-pill,999rpx);background:var(--persona-paper);font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading)}
.chapter{position:relative;z-index:1;margin-bottom:24rpx;overflow:hidden;border:var(--border-width,2rpx) solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--shape-radius-card,var(--radius-lg,36rpx));background:var(--persona-paper);box-shadow:var(--shadow-md,0 12rpx 32rpx rgba(0,0,0,.06))}.chapter-head{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:18rpx 24rpx;color:var(--primary-contrast,#fff);background:var(--persona-deep)}.chapter-head text:first-child{font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero);letter-spacing:1rpx}.chapter-head text:last-child{font-size:$fs-micro;color:var(--on-active-muted,rgba(255,255,255,.7))}.chapter-body{padding:28rpx}.oracle-title{display:block;font-family:var(--font-display,var(--font-ui));font-size:36rpx;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.45}.oracle-copy{display:block;margin-top:16rpx;color:var(--persona-muted);font-size:$fs-body;line-height:1.72}.verdict-strip{display:grid;grid-template-columns:146rpx 1fr;gap:20rpx;align-items:center;margin-top:26rpx;padding:22rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--accent-soft,var(--brand-warm,var(--persona-paper)))}.verdict-label{padding-right:18rpx;border-right:2rpx solid var(--divider,rgba(0,0,0,.1));text-align:center}.verdict-label text{display:block;font-weight:var(--font-weight-hero,$fw-hero)}.verdict-label text:last-child{margin-top:5rpx;color:var(--persona-muted);font-size:$fs-micro}.verdict-strip>text{font-size:$fs-caption;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.6}.section-title{display:block;margin-bottom:16rpx;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}
.radar-chart{position:relative;width:460rpx;height:460rpx;margin:4rpx auto 18rpx;overflow:visible}.radar-grid-level,.radar-data{position:absolute;inset:0;transform-origin:50% 50%}.radar-grid-level{z-index:0;background:var(--divider,rgba(0,0,0,.12));opacity:.22}.radar-axis{position:absolute;z-index:1;left:50%;top:16%;width:2rpx;height:34%;background:var(--divider-strong,var(--border,var(--persona-ink)));opacity:.28;transform-origin:50% 100%}.radar-data{z-index:2;background:var(--persona-deep);opacity:.42}.radar-label{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:92rpx;min-height:64rpx;padding:4rpx 8rpx;border:2rpx solid var(--divider,rgba(0,0,0,.12));border-radius:var(--radius-pill,999rpx);background:var(--persona-paper);box-shadow:0 4rpx 12rpx rgba(0,0,0,.06);transform:translate(-50%,-50%);text-align:center}.radar-label text:first-child{max-width:110rpx;font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading);line-height:1.25}.radar-label text:last-child{margin-top:2rpx;color:var(--persona-deep);font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero)}.dimension-list{margin-top:6rpx}
.dimension{padding:20rpx 0;border-bottom:2rpx dashed var(--divider,rgba(0,0,0,.1))}.dimension:last-child{border-bottom:0}.dimension-head{display:flex;justify-content:space-between;gap:20rpx;font-size:$fs-body;font-weight:var(--font-weight-heading,$fw-heading)}.track{height:14rpx;margin:12rpx 0 10rpx;overflow:hidden;border-radius:var(--radius-pill,999rpx);background:var(--divider,rgba(0,0,0,.1))}.fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--persona-leaf),var(--persona-gold))}.dimension-copy{display:block;color:var(--persona-muted);font-size:$fs-caption;line-height:1.65}
.evidence-list{display:flex;flex-direction:column;gap:16rpx}.evidence-item{display:grid;grid-template-columns:58rpx 1fr;gap:18rpx;padding:20rpx;border:2rpx solid var(--divider,rgba(0,0,0,.08));border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--persona-soft)}.evidence-index{display:flex;align-items:center;justify-content:center;width:58rpx;height:58rpx;border-radius:50%;color:var(--primary-contrast,#fff);background:var(--persona-deep);font-size:$fs-micro;font-weight:var(--font-weight-hero,$fw-hero)}.evidence-question{display:block;font-size:$fs-body;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.55}.evidence-answer{display:block;margin-top:8rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.55}
.signal-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}.signal-card{padding:22rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx))}.signal-card.positive{background:var(--success-soft,#e7f2ea)}.signal-card.caution{background:var(--risk-soft,#f9e7e4)}.signal-icon{display:flex;align-items:center;justify-content:center;width:48rpx;height:48rpx;border:2rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:50%;font-weight:var(--font-weight-hero,$fw-hero)}.heart-shape{width:22rpx;height:22rpx;background:var(--success,var(--persona-leaf));transform:rotate(45deg);border-radius:4rpx 12rpx 4rpx 12rpx}.signal-title{display:block;margin-top:14rpx;font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.signal-copy{display:block;margin-top:10rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.6}.scenario-card{position:relative;padding-left:70rpx!important;font-family:var(--font-display,var(--font-ui));font-size:$fs-heading;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.7}.scenario-mark{position:absolute;left:24rpx;top:4rpx;color:var(--persona-gold);font-size:82rpx;line-height:1}
.stage-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:10rpx}.stage-tab{display:flex;align-items:center;justify-content:center;min-width:0;min-height:88rpx;margin:0;padding:10rpx 6rpx;border:2rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--radius-pill,999rpx);color:var(--persona-ink);background:var(--persona-paper);font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading);line-height:1.25}.stage-tab::after{display:none}.stage-tab.active{color:var(--primary-contrast,#fff);background:var(--persona-deep);box-shadow:4rpx 5rpx 0 var(--persona-gold)}.stage-panel{margin-top:20rpx;padding:24rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--persona-soft)}.stage-title{display:block;font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.55}.stage-summary{display:block;margin-top:10rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.7}.stage-question{display:grid;grid-template-columns:52rpx 1fr;gap:14rpx;align-items:center;margin-top:18rpx;padding:16rpx;border:2rpx solid var(--divider,rgba(0,0,0,.1));border-radius:var(--radius-md,24rpx);background:var(--persona-paper)}.stage-question text:first-child{display:flex;align-items:center;justify-content:center;width:52rpx;height:52rpx;border-radius:50%;color:var(--primary-contrast,#fff);background:var(--persona-deep);font-weight:var(--font-weight-hero,$fw-hero)}.stage-question text:last-child{font-size:$fs-caption;font-weight:var(--font-weight-strong,$fw-heading);line-height:1.55}.scenario-inline{margin-top:18rpx;padding-top:18rpx;border-top:2rpx dashed var(--divider,rgba(0,0,0,.12))}.scenario-inline text{display:block}.scenario-inline text:first-child{color:var(--persona-deep);font-size:$fs-micro;font-weight:var(--font-weight-hero,$fw-hero)}.scenario-inline text:last-child{margin-top:6rpx;font-size:$fs-caption;line-height:1.65}
.secondary-match{display:flex;align-items:center;gap:18rpx;padding:20rpx;border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--accent-soft,var(--brand-warm,var(--persona-paper)))}.mini-avatar,.rank-avatar{display:flex;align-items:center;justify-content:center;overflow:hidden;border:2rpx solid var(--persona-ink);border-radius:50%;background:var(--persona-paper);font-weight:var(--font-weight-hero,$fw-hero)}.mini-avatar{width:70rpx;height:70rpx}.secondary-match>view:last-child{display:flex;flex-direction:column}.secondary-match>view:last-child text:first-child{color:var(--persona-muted);font-size:$fs-micro}.secondary-match>view:last-child text:last-child{margin-top:4rpx;font-size:$fs-heading;font-weight:var(--font-weight-hero,$fw-hero)}.ranking-list{margin-top:18rpx}.ranking-item{display:grid;grid-template-columns:42rpx 58rpx 1fr auto;gap:14rpx;align-items:center;padding:16rpx 0;border-bottom:2rpx dashed var(--divider,rgba(0,0,0,.1))}.ranking-item:last-child{border-bottom:0}.rank-number{font-family:var(--font-mono);font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero);text-align:center}.rank-avatar{width:58rpx;height:58rpx;font-size:$fs-caption}.rank-avatar image{width:100%;height:100%}.rank-name{font-size:$fs-body;font-weight:var(--font-weight-strong,$fw-heading)}.rank-score{font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}
.traffic-list{display:flex;flex-direction:column;gap:14rpx}.traffic-item{display:grid;grid-template-columns:28rpx minmax(0,1fr) auto;gap:16rpx;align-items:center;padding:20rpx;border:2rpx solid var(--divider,rgba(0,0,0,.1));border-radius:var(--shape-radius-inner,var(--radius-md,28rpx));background:var(--persona-soft)}.traffic-dot{width:28rpx;height:28rpx;border:3rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:50%;background:var(--persona-gold)}.traffic-item.green .traffic-dot{background:var(--success,var(--persona-leaf))}.traffic-item.red .traffic-dot{background:var(--risk,var(--persona-coral))}.traffic-copy{display:flex;flex-direction:column}.traffic-copy text:first-child{font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero);line-height:1.45}.traffic-copy text:last-child{margin-top:6rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.6}.traffic-badge{padding:8rpx 12rpx;border:2rpx solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--radius-pill,999rpx);background:var(--persona-paper);font-size:$fs-micro;font-weight:var(--font-weight-heading,$fw-heading);white-space:nowrap}.action-list{display:flex;flex-direction:column;gap:18rpx}.action-item{display:grid;grid-template-columns:64rpx 1fr;gap:18rpx;align-items:start}.action-number{display:flex;align-items:center;justify-content:center;width:64rpx;height:64rpx;border:3rpx solid var(--persona-ink);border-radius:50%;background:var(--persona-gold);font-weight:var(--font-weight-hero,$fw-hero)}.action-copy{display:flex;flex-direction:column}.action-copy text:first-child{font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.action-copy text:last-child{margin-top:8rpx;color:var(--persona-muted);font-size:$fs-caption;line-height:1.65}.atlas-card{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:20rpx;align-items:center;margin-bottom:24rpx;padding:26rpx;border:var(--border-width,2rpx) solid var(--divider-strong,var(--border,var(--persona-ink)));border-radius:var(--shape-radius-card,var(--radius-lg,36rpx));background:var(--accent-soft,var(--brand-warm,var(--persona-paper)));box-shadow:var(--shadow-md,0 12rpx 32rpx rgba(0,0,0,.06))}.atlas-copy{display:flex;flex-direction:column}.atlas-copy text:first-child{font-size:$fs-body;font-weight:var(--font-weight-hero,$fw-hero)}.atlas-copy text:last-child{margin-top:7rpx;color:var(--persona-muted);font-size:$fs-micro;line-height:1.55}.atlas-portraits{display:flex;padding-left:18rpx}.atlas-person{display:flex;align-items:center;justify-content:center;width:64rpx;height:64rpx;margin-left:-18rpx;overflow:hidden;border:3rpx solid var(--persona-paper);border-radius:50%;color:var(--primary-contrast,#fff);background:var(--persona-deep);font-size:$fs-caption;font-weight:var(--font-weight-hero,$fw-hero);box-shadow:0 0 0 2rpx var(--divider-strong,var(--border,var(--persona-ink)))}.atlas-person image{width:100%;height:100%}.report-footnote{position:relative;z-index:1;display:flex;flex-direction:column;gap:8rpx;padding:8rpx 18rpx 20rpx;color:var(--persona-muted);font-size:$fs-micro;line-height:1.55;text-align:center}
@media (max-width:370px){.hero{min-height:530rpx}.mirror-shell{right:-38rpx;width:286rpx;height:370rpx}.person-name{font-size:56rpx}.signal-grid{grid-template-columns:1fr}.score-ribbon{width:326rpx}.verdict-strip{grid-template-columns:130rpx 1fr}.radar-chart{width:410rpx;height:410rpx}.stage-tabs{grid-template-columns:repeat(2,1fr)}.traffic-item{grid-template-columns:26rpx minmax(0,1fr)}.traffic-badge{grid-column:2;justify-self:start}.atlas-card{grid-template-columns:1fr}.atlas-portraits{padding-left:18rpx}}
</style>
