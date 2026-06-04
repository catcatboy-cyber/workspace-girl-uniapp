<template>
  <view class="page v2-mode" :style="themeVars">
    <view class="hero-block-v2">
      <text class="hero-tag-v2">LABEL GUIDE</text>
      <text class="hero-title-v2">判断<text class="hl-v2">说明</text></text>
      <text class="hero-copy-v2">按展示位置解释系统里会出现的标签，避免把不同口径混在一起看。</text>
    </view>
    <view v-for="section in explainSections" :key="section.key" class="explain-v2">
      <view class="explain-head-v2" @click="toggleSection(section.key)">
        <text class="explain-title-v2">{{ section.label }}</text>
        <text class="explain-arrow-v2">{{ expandedSections[section.key] ? '收起' : '展开' }}</text>
      </view>
      <view v-if="expandedSections[section.key]" class="explain-body-v2">
        <view v-for="group in section.groups" :key="group.label" class="explain-subgroup-v2">
          <text class="explain-subtitle-v2">{{ group.label }}</text>
          <view v-for="item in group.items" :key="item.label" class="explain-item-v2">
            <text class="explain-item-title-v2">
              {{ item.label }}<text v-if="item.range"> · {{ item.range }}</text><text v-if="item.confidence"> · {{ item.confidence }}</text>
            </text>
            <text class="explain-item-desc-v2">{{ item.description }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'

const themeVars = ref(getThemeStyle())

onLoad(() => {
  themeVars.value = getThemeStyle()
  applyThemeChrome()
})

const explainSections = computed(() => [
  {
    key: 'analysisScore' as const,
    label: '分析分数',
    groups: [
      { label: '意向', items: intentLevels },
      { label: '风险', items: riskLevels },
      { label: '证据', items: evidenceLevels },
      { label: '其他标记', items: snapshotOtherItems }
    ]
  },
  {
    key: 'profile' as const,
    label: '人物标签',
    groups: [
      { label: '关系类型', items: profileRelationItems },
      { label: '基础信息', items: profileBasicItems },
      { label: '趣味标签', items: profileFunItems }
    ]
  },
  {
    key: 'trend' as const,
    label: '趋势变化',
    groups: [
      { label: '14天意向', items: trend14IntentItems },
      { label: '14天风险', items: trend14RiskItems },
      { label: '波动', items: trend14VolatilityItems },
      { label: '样本', items: trend14SampleItems },
      { label: '近14天复盘', items: weeklyTrendItems }
    ]
  },
  {
    key: 'judgment' as const,
    label: '综合判断',
    groups: [
      { label: '阶段', items: phaseItems },
      { label: '氛围', items: vibeItems },
      { label: '风险信号', items: problemItems },
      { label: '行动建议', items: nextActionItems }
    ]
  },
  {
    key: 'event' as const,
    label: '事件标签',
    groups: [
      { label: '事件性质', items: eventTypeItems },
      { label: '事件主体', items: subjectRoleItems }
    ]
  }
])

type ExplainSectionKey = 'analysisScore' | 'profile' | 'trend' | 'judgment' | 'event'

const expandedSections = ref<Record<ExplainSectionKey, boolean>>({
  analysisScore: true,
  profile: false,
  trend: false,
  judgment: false,
  event: false
})

function toggleSection(key: ExplainSectionKey) {
  expandedSections.value[key] = !expandedSections.value[key]
}

const snapshotOtherItems = [
  { label: 'AI 分析', description: '表示最新分析由 AI 参与生成或分析，属于单次分析口径。' }
]

const profileRelationItems = [
  { label: 'Crush / Friend Crush', description: 'Crush 关系类型，只说明分析语境，不直接代表好坏。' },
]

const profileBasicItems = [
  { label: '年龄 / 性别 / 职业', description: 'Crush 画像信息，用来帮助理解生活阶段和互动场景。' },
]

const profileFunItems = [
  { label: '属相 / 星座', description: '轻娱乐星象速写入口，不参与核心意向分、风险分和证据等级。' }
]

const trend14IntentItems = [
  { label: '14天意向上行', description: '近 14 天内，最新意向分相比区间起点明显上升。它是数据变化，不等于关系阶段。' },
  { label: '14天意向回落', description: '近 14 天内，最新意向分相比区间起点明显下降。' },
  { label: '14天意向平稳', description: '近 14 天内，意向分没有出现明显净变化。' },
]

const trend14RiskItems = [
  { label: '14天风险回落', description: '近 14 天内，风险分相比区间起点下降。' },
  { label: '14天风险抬头', description: '近 14 天内，风险分相比区间起点上升，需要优先回看风险事件。' },
  { label: '14天风险平稳', description: '近 14 天内，风险分没有明显净变化。' },
]

const trend14VolatilityItems = [
  { label: '波动偏低 / 波动中等 / 波动偏高', description: '描述最近几次分析分数的起伏程度，不直接判断关系好坏。' },
]

const trend14SampleItems = [
  { label: '样本充足 / 样本偏少', description: '描述近期分析数量是否足够支撑趋势观察。样本偏少时不适合下重结论。' }
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
  { label: '试探期', description: '证据还薄，对方或你们还在互相试探阶段，很多感受都需要更多事实来支撑。不适合下重结论。' },
  { label: '升温期', description: '整体信号在往前走，但真正有效的升温还是要看连续兑现，而不是单次高点。' },
  { label: '验证期', description: '更适合核实承诺、身份、说法或安排是否真的落地，而不是凭感觉推进。' },
  { label: '走弱期', description: '既有热度也有不稳，或节奏明显放缓。继续加码投入的收益偏低，先看对方会不会补动作。' }
]

const vibeItems = [
  { label: '☀️ 顺畅', description: '当前体感最稳，风险较低、热度较好，意向和稳定性都相对不错，有继续推进的基础。' },
  { label: '🌤 向好', description: '最近走势在变好，意向上升且风险回落，值得继续观察延续性。' },
  { label: '☁️ 平淡', description: '状态一般，没有特别强的顺风或逆风，投入信号偏弱，先看后续动作。' },
  { label: '🌬 波动', description: '热度存在但前后反复明显，不稳定苗头开始出现，容易出现前后落差。不能把局部当成整体。' },
  { label: '⛈ 高压', description: '风险明显偏高，心理负担和不确定性已经偏高，不是单次卡住而是连续出现受阻或消耗信号。' },
  { label: '📉 走弱', description: '和之前相比整体状态已经在走弱，不适合按旧印象判断，更适合先收回来观察。' }
]

const weeklyTrendItems = [
  { label: '近14天回暖', description: '近14天整体更偏正向，意向净变化较好，且风险没有同步明显抬头。' },
  { label: '近14天转弱', description: '近14天意向明显回落，关系热度或推进感在下降。' },
  { label: '近14天承压', description: '近14天更突出的不是热度，而是回避、拖延、反复或兑现不足。' },
  { label: '近14天波动', description: '近14天分数变化较明显，但暂时还不适合下单向结论。' },
  { label: '近14天平稳', description: '近14天整体没有出现足够强的新变化，先继续记录。' },
  { label: 'AI 复盘', description: '表示这块内容是按近14天窗口汇总生成，不等同于单次 AI 分析。' }
]

const nextActionItems = [
  { label: '先做验证', description: '重点不是推进，而是看承诺、说法、身份或安排能不能对上事实。' },
  { label: '适合澄清', description: '当前更适合问清楚、确认边界或把模糊点说具体。' },
  { label: '先暂停推进', description: '风险太高，继续加码投入的收益偏低，先收回来观察。' }
]

const problemItems = [
  { label: '单向投入', description: '大部分推进成本还在你这边，对方没有给出相称的主动和投入。' },
  { label: '口头热情，行动不足', description: '嘴上不差，但落到见面、安排、兑现这些动作上还不够。' },
  { label: '关键问题难验证', description: '有些关键说法、承诺、身份或往事当前还对不上，或很难核实。' },
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
  { label: '对方', description: '这条一句话主要描述 Crush，对方动作会直接参与本次判断。' },
  { label: '自己', description: '这条主要是你的状态记录，不会因为"我准备了什么"就直接提高对方意向。' },
  { label: '互动', description: '这条描述双方互动，系统会拆分"你做了什么"和"对方回应了什么"。' },
  { label: '未知', description: '主体不清时权重会更低，除非文字里明确写出对方动作。' }
]

</script>

<style scoped>
.page { min-height: 100vh; background: var(--app-bg, #f4ede2); padding: var(--spacing-page, 24rpx); box-sizing: border-box; }
.v2-mode { background: var(--app-bg, #FFFDF5) !important; padding: 18rpx; min-height: 100vh; }
.v2-mode .hero-block-v2 { background: var(--hero-bg, #FF6B6B); border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; padding: 32rpx; margin-bottom: 24rpx; transform: rotate(-0.5deg); }
.v2-mode .hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; padding: 6rpx 16rpx; font-size: 20rpx; font-weight: 900; letter-spacing: 4rpx; margin-bottom: 16rpx; }
.v2-mode .hero-title-v2 { display: block; font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.15; letter-spacing: -2rpx; text-transform: uppercase; }
.v2-mode .hl-v2 { display: inline-block; background: #FFD93D; padding: 0 8rpx; }
.v2-mode .hero-copy-v2 { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 600; color: rgba(0,0,0,0.7); line-height: 1.5; }
.v2-mode .explain-v2 { margin-top: 14rpx; border: 2rpx solid #111; background: #fff; }
.v2-mode .explain-head-v2 { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 18rpx; }
.v2-mode .explain-title-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.v2-mode .explain-arrow-v2 { padding: 4rpx 14rpx; border: 2rpx solid #111; background: #fff; font-size: 18rpx; font-weight: 800; color: #111; }
.v2-mode .explain-body-v2 { padding: 0 18rpx 18rpx; border-top: 2rpx solid #111; }
.v2-mode .explain-subgroup-v2 { padding-top: 14rpx; }
.v2-mode .explain-subgroup-v2 + .explain-subgroup-v2 { margin-top: 8rpx; }
.v2-mode .explain-subtitle-v2 { display: block; padding: 8rpx 12rpx; border: 2rpx solid #111; background: #f9f9f9; color: #666; font-size: 20rpx; font-weight: 800; }
.v2-mode .explain-item-v2 { padding: 12rpx 0; border-bottom: 2rpx dashed #111; }
.v2-mode .explain-item-v2:last-child { border-bottom: none; }
.v2-mode .explain-item-title-v2 { display: block; font-size: 22rpx; font-weight: 800; color: #111; }
.v2-mode .explain-item-desc-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #999; margin-top: 2rpx; line-height: 1.4; }
</style>
