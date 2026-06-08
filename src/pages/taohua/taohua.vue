<template>
  <view :class="['page v2-mode anim-ready', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <!-- 导航栏 -->
    <view class="nav-bar-v2">
      <text class="nav-back-v2" @click="goBack">← 返回</text>
      <text class="nav-title-v2">命理桃花</text>
      <text class="nav-placeholder-v2"></text>
    </view>

    <!-- ① Hero -->
    <view class="hero-block-v2 anim-hero">
      <text class="hero-tag-v2">桃花方位</text>
      <text class="hero-title-v2">今日<text class="hl-v2">桃花</text></text>
      <text class="hero-copy-v2">
        {{ computedReport.今日方位?.['公历日期']?.split(' ')?.[0] || '--' }}
        · {{ computedReport.今日方位?.['农历'] || '--' }}
      </text>
      <text class="hero-copy-v2" style="font-size:20rpx;margin-top:4rpx;">
        日柱 {{ computedReport.今日方位?.['日柱'] || '--' }}
        · 建除 {{ computedReport.今日宜忌?.['建除'] || '--' }}
        · 星宿 {{ (computedReport.今日方位?.['二十八宿'] || '').split('（')[0] }}
      </text>
    </view>

    <!-- ② 今日桃花罗盘 -->
    <view class="card-v2">
      <text class="section-title-v2">今日桃花方位</text>

      <TaohuaCompass
        :direction="dailyTaohuaDir"
        :directionZhi="dailyTaohuaZhi"
      />

      <text class="card-text-v2 strong">
        今日咸池桃花在{{ dailyTaohuaDir }}（{{ dailyTaohuaZhi }}位），属{{ dailyTaohuaWuxing }}
      </text>
      <text class="card-text-v2 muted">
        {{ computedReport.流日桃花?.['principle'] || '' }}
      </text>

      <!-- 4 列方位条 -->
      <view class="dir-strip-v2">
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">喜神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['喜神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">财神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['财神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">福神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['福神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">阳贵</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['阳贵']?.['方位'] || '--' }}</text>
        </view>
      </view>

      <!-- 出处 -->
      <view class="cite-block-v2">
        <text class="cite-title-v2">📖 出处</text>
        <text class="cite-desc-v2">咸池桃花：《三命通会》三合沐浴算法 · 神煞方位：《协纪辨方书》卷二十 · 日历：寿星天文历</text>
      </view>
    </view>

    <!-- ③ 今日行动指南 -->
    <view v-if="computedReport.今日行动指南" class="card-v2" style="background:#FFFBEB;">
      <text class="section-title-v2">🎯 今日行动指南</text>

      <!-- 桃花指数条 -->
      <view v-if="computedReport.桃花指数" class="score-bar-v2">
        <view class="score-head-v2">
          <text class="score-num-v2">{{ computedReport.桃花指数?.分数 || '--' }}</text>
          <text class="score-unit-v2">/100</text>
          <text class="score-level-v2">{{ computedReport.桃花指数?.评级 || '' }}</text>
        </view>
        <view class="score-track-v2">
          <view class="score-fill-v2" :style="{ width: (computedReport.桃花指数?.分数 || 50) + '%' }"></view>
        </view>
        <view style="display:flex;align-items:center;gap:8rpx;margin-top:4rpx;">
          <text class="guide-text-v2 muted">{{ computedReport.桃花指数?.一句话 || '' }}</text>
          <text v-if="(computedReport.桃花指数?.加分项 || []).some((r:string)=>r.includes('天喜'))" class="tag-v2" style="background:#FF5252;color:#fff;">🔥 天喜日</text>
        </view>
      </view>

      <!-- 去哪 -->
      <view class="guide-section-v2">
        <text class="guide-icon-v2">🧭</text>
        <view class="guide-content-v2">
          <text class="guide-label-v2">去哪约会 <text class="cite-inline-v2">《三命通会》</text></text>
          <text class="guide-text-v2">{{ dateAdviceText }}</text>
          <text class="guide-text-v2 muted">{{ dateAdviceDetailLabel }}：{{ dateAdviceDetailText }}</text>
        </view>
      </view>

      <!-- 做啥 -->
      <view class="guide-section-v2">
        <text class="guide-icon-v2">🎯</text>
        <view class="guide-content-v2">
          <text class="guide-label-v2">{{ computedReport.今日行动指南?.活动建议?.今日气场 || '今日感情运势' }} <text class="cite-inline-v2">《协纪辨方书》</text></text>
          <text class="guide-text-v2">{{ computedReport.今日行动指南?.活动建议?.一句话 || '' }}</text>
          <view v-if="(computedReport.今日行动指南?.活动建议?.建议活动 || []).length > 0" style="margin-top:6rpx;">
            <text v-for="(a, i) in computedReport.今日行动指南?.活动建议?.建议活动 || []" :key="'act-'+i" class="tag-v2 green">🎯 {{ a }}</text>
          </view>
          <view v-if="(computedReport.今日行动指南?.活动建议?.宜做 || []).length > 0" style="margin-top:6rpx;">
            <text v-for="(a, i) in computedReport.今日行动指南?.活动建议?.宜做 || []" :key="'do-'+i" class="guide-text-v2" style="color:#4ECDC4;">✅ {{ a }}</text>
          </view>
          <view v-if="(computedReport.今日行动指南?.活动建议?.避开 || []).length > 0" style="margin-top:4rpx;">
            <text v-for="(a, i) in computedReport.今日行动指南?.活动建议?.避开 || []" :key="'dont-'+i" class="guide-text-v2 muted">⚠️ {{ a }}</text>
          </view>
        </view>
      </view>

      <!-- 穿啥 -->
      <view class="guide-section-v2" v-if="computedReport.今日行动指南?.穿戴建议">
        <text class="guide-icon-v2">👗</text>
        <view class="guide-content-v2">
          <text class="guide-label-v2">穿什么戴什么 <text class="cite-inline-v2">《三命通会》</text></text>
          <text class="guide-text-v2 strong">{{ computedReport.今日行动指南?.穿戴建议?.一句话 || '' }}</text>
          <view class="tag-row-v2" style="margin-top:6rpx;">
            <text v-for="c in computedReport.今日行动指南?.穿戴建议?.桃花颜色 || []" :key="c" class="tag-v2">{{ c }}</text>
            <text class="tag-v2 black">{{ computedReport.今日行动指南?.穿戴建议?.桃花材质 || '' }}</text>
          </view>
          <text v-if="computedReport.今日行动指南?.穿戴建议?.五行关系" class="guide-text-v2 muted" style="margin-top:6rpx;">
            桃花{{ computedReport.今日行动指南?.穿戴建议?.桃花五行 || '' }} · 本命{{ computedReport.今日行动指南?.穿戴建议?.本命五行 || '' }} → {{ computedReport.今日行动指南?.穿戴建议?.五行关系 || '' }}
          </text>
        </view>
      </view>
    </view>

    <!-- ④ 今日宜忌 -->
    <view class="card-v2">
      <text class="section-title-v2">今日感情宜忌</text>
      <text class="card-text-v2 muted">
        建除：{{ computedReport.今日宜忌?.['建除'] || '--' }}
        · 星宿：{{ (computedReport.今日方位?.['二十八宿'] || '').split('（')[0] }}
      </text>

      <view class="split-row-v2">
        <view class="split-half-v2 yi">
          <text class="split-label-v2 yi">✅ 宜</text>
          <text v-for="y in loveYi" :key="y" class="split-item-v2">{{ y }}</text>
        </view>
        <view class="split-half-v2 ji">
          <text class="split-label-v2 ji">⚠️ 忌</text>
          <text v-for="j in loveJi" :key="j" class="split-item-v2">{{ j }}</text>
        </view>
      </view>

      <view class="tag-row-v2" style="margin-top:14rpx;">
        <text v-for="j in loveJi" :key="'ji-'+j" class="tag-v2 red">今日忌{{ j }}</text>
        <text v-for="y in loveYi" :key="'yi-'+y" class="tag-v2 green">宜{{ y }}</text>
      </view>
    </view>

    <!-- ④ 桃花人设（依赖画像） -->
    <view v-if="hasProfile" class="card-v2">
      <text class="section-title-v2">你的桃花人设 <text style="font-size:18rpx;color:#999;">可分享</text></text>

      <view class="persona-card-v2">
        <view class="persona-head-v2">
          <view class="persona-avatar-v2">{{ zodiacEmoji }}</view>
          <view>
            <text class="persona-name-v2">{{ userZodiac }} · {{ userSign }}</text>
            <text class="persona-sub-v2">{{ crossData.chinese.name }}（{{ crossData.chinese.zhi }}·{{ crossData.chinese.wuxing }}·{{ crossData.chinese.yinyang }}）</text>
          </view>
        </view>

        <!-- 中国维度 -->
        <view class="persona-dim-v2">
          <text class="persona-dim-label-v2">🌏 中国星次</text>
          <text class="persona-dim-text-v2">{{ crossData.chinese.character }}</text>
          <text class="persona-dim-src-v2">{{ crossData.chinese.source }}</text>
        </view>

        <!-- 西方维度 -->
        <view class="persona-dim-v2">
          <text class="persona-dim-label-v2">🌍 西方星座</text>
          <text class="persona-dim-text-v2">{{ crossData.western.planet }}守护 · {{ crossData.western.element }}象{{ crossData.western.mode.split('（')[0] }}</text>
          <text class="persona-dim-text-v2 strong">"{{ crossData.western.personality }}"</text>
          <text class="persona-dim-src-v2">{{ crossData.western.source }}</text>
        </view>

        <!-- 最佳配对 -->
        <view class="tag-row-v2" style="margin-top:14rpx;">
          <text v-for="m in crossData.western.bestMatch" :key="m" class="tag-v2 black">❤️ {{ m }}</text>
          <text class="card-text-v2 muted" style="display:inline;font-size:18rpx;margin-left:6rpx;">{{ crossData.western.bestMatchReason }}</text>
        </view>
      </view>

      <button class="btn-v2-me outline" style="margin-top:16rpx;width:100%;" @click="sharePersona">
        📤 分享我的桃花人格卡
      </button>
    </view>

    <!-- 画像引导卡（无画像时） -->
    <view v-else class="card-v2 guide-card-v2" @click="goSelfProfile">
      <text class="section-title-v2">🔒 你的桃花人设</text>
      <text class="card-text-v2" style="color:#111;font-weight:800;">完善画像后解锁专属桃花分析</text>
      <text class="card-text-v2 muted">填写你的生肖和星座，即可查看中国星次解读、西方星座桃花风格、最佳配对等专属内容。点击前往 →</text>
    </view>

    <!-- ⑤ 属相×星座匹配 -->
    <view v-if="hasProfile" class="card-v2">
      <text class="section-title-v2">属相 × 星座 匹配</text>
      <text class="card-text-v2 muted">
        生肖地支：{{ crossData.zodiacZhi }}（{{ crossData.zodiac }}）
        ↔ 星座地支：{{ crossData.chinese.zhi }}（{{ crossData.sign }}/{{ crossData.chinese.name }}）
      </text>

      <view class="match-badge-wrap">
        <text :class="['match-badge-v2', matchBadgeClass]">⚡ {{ crossData.relation }} ⚡</text>
      </view>
      <text class="card-text-v2 strong" style="text-align:center;display:block;">
        {{ crossData.relationDesc }}
      </text>

      <button class="btn-v2-me outline" style="margin-top:16rpx;width:100%;" @click="showMatchSheet = true">
        🔍 测测和TA的匹配度
      </button>
    </view>

    <!-- ⑥ 桃花方位全览 -->
    <view class="card-v2">
      <text class="section-title-v2">桃花方位全览</text>

      <view class="overview-table-v2">
        <view class="ov-row-v2">
          <text class="ov-label-v2">本命·终身</text>
          <text class="ov-dir-v2">{{ computedReport.本命桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.本命红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.本命红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2">
          <text class="ov-label-v2">流年</text>
          <text class="ov-dir-v2">{{ computedReport.流年桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流年红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流年红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2">
          <text class="ov-label-v2">流月</text>
          <text class="ov-dir-v2">{{ computedReport.流月桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流月红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流月红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2 current">
          <text class="ov-label-v2">流日·今日</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
      </view>

      <text class="card-text-v2 muted" style="margin-top:12rpx;display:block;">
        本命桃花终身不变 · 流年/流月/流日动态变动 · 今日行动以流日为准
      </text>
    </view>

    <!-- ⑦ 订阅推送 -->
    <view class="card-v2" style="text-align:center;">
      <text class="section-title-v2">🔔 每日桃花推送</text>
      <text class="card-text-v2 muted">每天早上 8:00 提醒你今日桃花方位、穿搭颜色、宜忌活动</text>
      <button class="btn-v2-me primary" style="margin-top:16rpx;width:100%;" @click="subscribeNotify">
        开启每日推送
      </button>
      <text class="card-text-v2 muted" style="margin-top:8rpx;">需要微信订阅消息授权，可随时关闭</text>
    </view>

    <!-- ⑧ 免责声明 -->
    <view class="card-v2 disclaimer-card-v2">
      <text class="card-text-v2 muted" style="text-align:center;display:block;">
        📖 源自传统命理经典，仅供文化娱乐参考<br>
        基于今日干支（{{ computedReport.今日方位?.['日柱'] || '--' }}）计算 · 每日自动刷新<br>
        中国传统算法参考《三命通会》《协纪辨方书》<br>
        西方星座参考 Ptolemy《Tetrabiblos》（《占星四书》）
      </text>
    </view>

    <!-- 分享卡预览弹窗 -->
    <view v-if="showSharePreview" class="sheet-mask" @click="showSharePreview = false">
      <view class="sheet-panel" style="text-align:center;" @click.stop>
        <view class="sheet-head-v2">
          <text class="sheet-title-v2">📤 我的桃花人格卡</text>
          <text class="sheet-close-v2" @click="showSharePreview = false">✕</text>
        </view>
        <image v-if="shareImagePath" :src="shareImagePath" mode="widthFix" style="width:100%;border:3rpx solid #111;" />
        <view style="display:flex;gap:12rpx;margin-top:20rpx;">
          <button class="btn-v2-me primary" style="flex:1;" @click="saveShareImage">保存到相册</button>
          <button class="btn-v2-me outline" style="flex:1;" open-type="share">转发给好友</button>
        </view>
      </view>
    </view>

    <!-- 隐藏 Canvas -->
    <canvas type="2d" id="taohuaShareCanvas" style="position:fixed;left:-9999px;top:-9999px;width:640px;height:960px;"></canvas>

    <view class="ai-disclaimer">
      <text class="ai-disclaimer-text">AI 辅助分析 · 仅供辅助参考，不构成专业意见</text>
    </view>

    <!-- 配对检查 Bottom Sheet -->
    <view v-if="showMatchSheet" class="sheet-mask" @click="showMatchSheet = false">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-head-v2">
          <text class="sheet-title-v2">🔍 配对检查</text>
          <text class="sheet-close-v2" @click="showMatchSheet = false">✕</text>
        </view>

        <view class="picker-row-v2">
          <view class="picker-box-v2">
            <text class="picker-label-v2">Ta的生肖</text>
            <picker :range="zodiacNames" :value="matchZodiacIdx" @change="onMatchZodiacChange">
              <view class="picker-display-v2">{{ zodiacNames[matchZodiacIdx] }}</view>
            </picker>
          </view>
          <view class="picker-box-v2">
            <text class="picker-label-v2">Ta的星座</text>
            <picker :range="signNames" :value="matchSignIdx" @change="onMatchSignChange">
              <view class="picker-display-v2">{{ signNames[matchSignIdx] }}</view>
            </picker>
          </view>
        </view>

        <button class="btn-v2-me primary" style="width:100%;" @click="doMatchCheck">查看配对</button>

        <!-- 配对结果 -->
        <view v-if="matchResult" class="match-result-v2">
          <view class="match-badge-wrap">
            <text :class="['match-badge-v2', matchResultBadge]">💚 {{ matchResult.relation }} 💚</text>
          </view>

          <!-- 双人深度解读 -->
          <view v-if="matchResult.insight" class="pair-insight-v2">
            <!-- 风格碰撞 -->
            <view class="pair-section-v2">
              <text class="pair-label-v2">💫 风格碰撞</text>
              <text class="pair-text-v2">{{ matchResult.insight.styleClash }}</text>
            </view>

            <!-- 适合一起 -->
            <view class="pair-section-v2">
              <text class="pair-label-v2">🎯 适合一起</text>
              <text v-for="(a, i) in matchResult.insight.activities" :key="'act-'+i" class="pair-text-v2" style="color:#4ECDC4;">✅ {{ a }}</text>
            </view>

            <!-- 当心 -->
            <view class="pair-section-v2">
              <text class="pair-label-v2">⚠️ 当心</text>
              <text v-for="(w, i) in matchResult.insight.watchOut" :key="'wo-'+i" class="pair-text-v2 muted">· {{ w }}</text>
            </view>

            <!-- 古籍 -->
            <text class="pair-classical-v2">📖 {{ matchResult.insight.classicalNote }}</text>
          </view>

          <!-- 对方信息 -->
          <view class="match-detail-v2" v-if="matchResult.partner" style="margin-top:16rpx;">
            <text class="card-text-v2 muted">Ta的桃花风格：</text>
            <text class="card-text-v2">{{ matchResult.partner.western.personality }}</text>
            <view class="tag-row-v2" style="margin-top:8rpx;">
              <text v-for="m in matchResult.partner.western.bestMatch" :key="m" class="tag-v2">最佳配对：{{ m }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'
import {
  zodiacSignMatch, zodiacToTaohua, hongluanTianxi, xianchiAlgorithm,
  getTodayStr, ZODIAC_NAMES, SIGN_NAMES, ZODIAC_TO_ZHI,
  generatePairInsight
} from '@/utils/taohua'
import type { CrossMatchResult, PairInsight } from '@/utils/taohua'
import TaohuaCompass from '@/components/TaohuaCompass.vue'
import { callFunction } from '@/utils/cloudbase'

// ============================================================
// Mock 降级数据（Phase 2：云函数不可用时降级）
// ============================================================
import MOCK_REPORT from './mock-data'

// ============================================================
// 用户画像
// ============================================================
const selfProfile = ref<any>(null)
const userZodiac = ref<string>('')
const userSign = ref<string>('')
const fontSizeMode = ref<string>('')
const pageStyle = ref<string>('')
const loading = ref(true)

try {
  const raw = uni.getStorageSync('selfProfile')
  if (raw) selfProfile.value = typeof raw === 'string' ? JSON.parse(raw) : raw
} catch (_) { /* ignore */ }

userZodiac.value = selfProfile.value?.zodiac || '兔'
userSign.value = selfProfile.value?.constellation || '双鱼座'

try {
  fontSizeMode.value = uni.getStorageSync('fontSizeMode') || ''
} catch (_) { /* ignore */ }

try {
  const themeId = uni.getStorageSync('theme') || 'campus-pop'
  if (themeId === 'campus-pop') {
    pageStyle.value = '--app-bg:#FFFDF5;--hero-bg:#FF6B6B;--hero-bg-2:#e85d5d;'
  }
} catch (_) { /* ignore */ }

// ============================================================
// 数据加载：混合云函数日历 + 本地个人计算
// ============================================================
const dailyData = ref<any>(null)     // 云函数返回的日历数据
const practicalData = ref<any>(null)  // 云函数返回的行动指南
const scoreData = ref<any>(null)      // 云函数返回的桃花指数
const reportData = ref<any>(null)     // 合并后的完整报告

async function loadData() {
  loading.value = true
  const today = getTodayStr()

  // 检查缓存
  try {
    const cacheKey = `taohuaReport:${today}:${userZodiac.value}:${userSign.value}`
    const cached = uni.getStorageSync(cacheKey)
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      if (parsed?.daily) {
        dailyData.value = parsed.daily
        reportData.value = parsed
        loading.value = false
        return
      }
    }
  } catch (_) { /* ignore */ }

  // 尝试云函数
  try {
    const res = await callFunction({
      name: 'queryTaohua',
      data: { zodiac: userZodiac.value, sign: userSign.value },
    })
    if (res?.result?.success) {
      dailyData.value = res.result.data.daily
      practicalData.value = res.result.data.practical || null
      scoreData.value = res.result.data.score || null
    }
  } catch (_) {
    // 云函数未部署 → 降级到 mock
  }

  // 降级：使用 mock 日历数据
  if (!dailyData.value) {
    dailyData.value = {
      solarDate: MOCK_REPORT.今日方位?.['公历日期'] || '',
      lunarDate: MOCK_REPORT.今日方位?.['农历'] || '',
      ganzhi: {
        dayGanZhi: MOCK_REPORT.今日方位?.['日柱'] || '--',
        dayGan: MOCK_REPORT.今日方位?.['日干'] || '--',
        dayZhi: MOCK_REPORT.今日方位?.['日支'] || '--',
        yearPillar: MOCK_REPORT.节气?.['年柱'] || '--',
        monthPillar: MOCK_REPORT.节气?.['月柱'] || '--',
      },
      fangwei: {
        xishen: MOCK_REPORT.今日方位?.['喜神'] || {},
        caishen: MOCK_REPORT.今日方位?.['财神'] || {},
        fushen: MOCK_REPORT.今日方位?.['福神'] || {},
        yanggui: MOCK_REPORT.今日方位?.['阳贵'] || {},
        yingui: MOCK_REPORT.今日方位?.['阴贵'] || {},
      },
      yiji: {
        jianchu: MOCK_REPORT.今日宜忌?.['建除'] || '--',
        yi: MOCK_REPORT.今日宜忌?.['宜'] || [],
        ji: MOCK_REPORT.今日宜忌?.['忌'] || [],
        jishen: MOCK_REPORT.今日宜忌?.['吉神'] || [],
        xiongsha: MOCK_REPORT.今日宜忌?.['凶煞'] || [],
      },
      ershibaxiu: MOCK_REPORT.今日方位?.['二十八宿'] || '--',
      pengzu: MOCK_REPORT.今日方位?.['彭祖百忌'] || '--',
      chongsha: MOCK_REPORT.今日方位?.['生肖日冲'] || '--',
      shafang: MOCK_REPORT.今日方位?.['煞方'] || '--',
      jieqi: {
        current: MOCK_REPORT.节气?.['当前节气'] || '',
        next: MOCK_REPORT.节气?.['下一节气'] || '--',
        lunarMonth: MOCK_REPORT.节气?.['农历月'] || '--',
      },
    }
  }

  // 本地计算个人数据
  const dayZhi = dailyData.value.ganzhi.dayZhi
  const yearZhi = dailyData.value.ganzhi.yearPillar?.split(' ')?.[0]?.slice(-1) || '午'
  const monthZhi = dailyData.value.ganzhi.monthPillar?.slice(-1) || '午'

  const localPersonal = hasProfile.value ? {
    benmingTaohua: zodiacToTaohua(userZodiac.value),
    benmingHongluan: hongluanTianxi(userZodiac.value),
    liunianTaohua: xianchiAlgorithm(yearZhi),
    liunianHongluan: hongluanTianxi(yearZhi),
    liuyueTaohua: xianchiAlgorithm(monthZhi),
    liuyueHongluan: hongluanTianxi(monthZhi),
    liuriTaohua: xianchiAlgorithm(dayZhi),
    liuriHongluan: hongluanTianxi(dayZhi),
    cross: zodiacSignMatch(userZodiac.value, userSign.value),
  } : {}

  reportData.value = { daily: dailyData.value, personal: localPersonal }

  // 缓存
  try {
    const cacheKey = `taohuaReport:${today}:${userZodiac.value}:${userSign.value}`
    uni.setStorageSync(cacheKey, JSON.stringify(reportData.value))
  } catch (_) { /* ignore */ }

  loading.value = false
}

onMounted(() => { loadData() })

// 统一报告：保持与旧 mock 相同结构，优先级：实时 > mock
const computedReport = computed(() => {
  const d = dailyData.value
  const p = (reportData.value as any)?.personal || {}
  if (!d) return MOCK_REPORT

  const mk = MOCK_REPORT
  const dayZhi = d.ganzhi?.dayZhi || '丑'
  const yearZhi = d.ganzhi?.yearPillar?.split(' ')?.[0]?.slice(-1) || '午'
  const monthZhi = d.ganzhi?.monthPillar?.slice(-1) || '午'

  return {
    元数据: { ...mk.元数据, 生肖: userZodiac.value, 星座: userSign.value },
    节气: { ...mk.节气, ...(d.jieqi || {}), 年柱: d.ganzhi?.yearPillar || mk.节气.年柱, 月柱: d.ganzhi?.monthPillar || mk.节气.月柱 },
    今日方位: {
      公历日期: d.solarDate || mk.今日方位?.公历日期,
      农历: d.lunarDate || mk.今日方位?.农历,
      日柱: d.ganzhi?.dayGanZhi || mk.今日方位?.日柱,
      日干: d.ganzhi?.dayGan || mk.今日方位?.日干,
      日支: d.ganzhi?.dayZhi || mk.今日方位?.日支,
      喜神: d.fangwei?.xishen ? { 方位: d.fangwei.xishen.fangwei || d.fangwei.xishen.方位 } : mk.今日方位?.喜神,
      财神: d.fangwei?.caishen ? { 方位: d.fangwei.caishen.fangwei || d.fangwei.caishen.方位 } : mk.今日方位?.财神,
      福神: d.fangwei?.fushen ? { 方位: d.fangwei.fushen.fangwei || d.fangwei.fushen.方位 } : mk.今日方位?.福神,
      阳贵: d.fangwei?.yanggui ? { 方位: d.fangwei.yanggui.fangwei || d.fangwei.yanggui.方位 } : mk.今日方位?.阳贵,
      阴贵: d.fangwei?.yingui ? { 方位: d.fangwei.yingui.fangwei || d.fangwei.yingui.方位 } : mk.今日方位?.阴贵,
      二十八宿: d.ershibaxiu || mk.今日方位?.二十八宿,
      彭祖百忌: d.pengzu || mk.今日方位?.彭祖百忌,
      生肖日冲: d.chongsha || mk.今日方位?.生肖日冲,
      煞方: d.shafang || mk.今日方位?.煞方,
    },
    今日宜忌: { ...mk.今日宜忌, ...(d.yiji || {}), 建除: d.yiji?.jianchu || mk.今日宜忌?.建除, 宜: d.yiji?.yi || mk.今日宜忌?.宜, 忌: d.yiji?.ji || mk.今日宜忌?.忌, 吉神: d.yiji?.jishen || mk.今日宜忌?.吉神, 凶煞: d.yiji?.xiongsha || mk.今日宜忌?.凶煞 },
    本命桃花: (p as any).benmingTaohua || mk.本命桃花,
    本命红鸾天喜: (p as any).benmingHongluan || mk.本命红鸾天喜,
    流年桃花: (p as any).liunianTaohua || mk.流年桃花,
    流月桃花: (p as any).liuyueTaohua || mk.流月桃花,
    流日桃花: (p as any).liuriTaohua || mk.流日桃花,
    流年红鸾天喜: (p as any).liunianHongluan || mk.流年红鸾天喜,
    流月红鸾天喜: (p as any).liuyueHongluan || mk.流月红鸾天喜,
    流日红鸾天喜: (p as any).liuriHongluan || mk.流日红鸾天喜,
    属相星座交叉: (p as any).cross ? {
      生肖: (p as any).cross.zodiac || mk.属相星座交叉?.生肖,
      中国星次: {
        名称: (p as any).cross.chinese?.name || mk.属相星座交叉?.中国星次?.名称,
        地支: (p as any).cross.chinese?.zhi || mk.属相星座交叉?.中国星次?.地支,
        宫位: (p as any).cross.chinese?.gong || mk.属相星座交叉?.中国星次?.宫位,
        五行: (p as any).cross.chinese?.wuxing || mk.属相星座交叉?.中国星次?.五行,
        阴阳: (p as any).cross.chinese?.yinyang || mk.属相星座交叉?.中国星次?.阴阳,
        性格: (p as any).cross.chinese?.character || mk.属相星座交叉?.中国星次?.性格,
        节气范围: (p as any).cross.chinese?.jieqiRange || mk.属相星座交叉?.中国星次?.节气范围,
        近似公历: (p as any).cross.chinese?.dateApprox || mk.属相星座交叉?.中国星次?.近似公历,
      },
      地支关系: (p as any).cross.relation || mk.属相星座交叉?.地支关系,
      关系解读: (p as any).cross.relationDesc || mk.属相星座交叉?.关系解读,
      西方星座: {
        主宰星: (p as any).cross.western?.planet || mk.属相星座交叉?.西方星座?.主宰星,
        元素: (p as any).cross.western?.element || mk.属相星座交叉?.西方星座?.元素,
        形态: (p as any).cross.western?.mode || mk.属相星座交叉?.西方星座?.形态,
        桃花风格: (p as any).cross.western?.personality || mk.属相星座交叉?.西方星座?.桃花风格,
        公历日期: (p as any).cross.western?.dateRange || mk.属相星座交叉?.西方星座?.公历日期,
        古典出处: (p as any).cross.western?.classicalNote || mk.属相星座交叉?.西方星座?.古典出处,
        出处: (p as any).cross.western?.source || mk.属相星座交叉?.西方星座?.出处,
        最佳配对: (p as any).cross.western?.bestMatch || mk.属相星座交叉?.西方星座?.最佳配对,
        配对原理: (p as any).cross.western?.bestMatchReason || mk.属相星座交叉?.西方星座?.配对原理,
      },
    } : mk.属相星座交叉,
    桃花指数: scoreData.value || mk.桃花指数 || null,
    今日行动指南: practicalData.value || mk.今日行动指南 || null,
    综合建议: mk.综合建议,
  }
})

// ============================================================
// 计算属性
// ============================================================

const hasProfile = computed(() => {
  return !!(selfProfile.value?.zodiac && selfProfile.value?.constellation)
})

const dailyTaohuaDir = computed(() => computedReport.value.流日桃花?.direction || '正南')
const dailyTaohuaZhi = computed(() => computedReport.value.流日桃花?.taohua_zhi || '午')
const dailyTaohuaWuxing = computed(() => computedReport.value.流日桃花?.wuxing || '火')
const taohuaScore = computed(() => Number(computedReport.value.桃花指数?.分数 ?? 50))
const isLowTaohuaScore = computed(() => taohuaScore.value < 40)
const dateAdviceText = computed(() => {
  if (isLowTaohuaScore.value) {
    return `今天桃花指数 ${taohuaScore.value}/100，不建议按方位安排线下约会；线上互动更稳妥，改天再约。`
  }
  return computedReport.value.今日行动指南?.约会方位?.一句话 || ''
})
const dateAdviceDetailLabel = computed(() => isLowTaohuaScore.value ? '低分建议' : '桃花方位')
const dateAdviceDetailText = computed(() => {
  if (isLowTaohuaScore.value) {
    return '线上聊聊、语音或一起打游戏即可；如果一定要见面，选熟悉、低压力的地方。'
  }
  return computedReport.value.今日行动指南?.约会方位?.桃花方位?.场所建议 || ''
})

const zodiacEmoji = computed(() => {
  const map: Record<string, string> = {
    '鼠':'🐭','牛':'🐮','虎':'🐯','兔':'🐇','龙':'🐲','蛇':'🐍',
    '马':'🐴','羊':'🐑','猴':'🐵','鸡':'🐔','狗':'🐶','猪':'🐷',
  }
  return map[userZodiac.value] || '🐇'
})

// 属相×星座交叉（本地计算）
const crossData = computed<CrossMatchResult>(() => {
  try {
    return zodiacSignMatch(userZodiac.value, userSign.value)
  } catch {
    return null as any
  }
})

// 匹配徽章样式
const matchBadgeClass = computed(() => {
  const r = crossData.value?.relation || ''
  if (r.includes('六合')) return 'great'
  if (r.includes('三合')) return 'good'
  if (r.includes('冲')) return 'caution'
  return 'neutral'
})

// 感情相关关键词筛选今日宜忌
const LOVE_KEYWORDS = ['嫁娶', '纳采', '订婚', '出行', '会友', '安床', '纳财', '入宅', '立约', '祭祀']

const loveYi = computed(() => {
  const yi = computedReport.value.今日宜忌?.宜 || []
  return yi.filter((y: string) => LOVE_KEYWORDS.includes(y))
})

const loveJi = computed(() => {
  const ji = computedReport.value.今日宜忌?.忌 || []
  return ji.filter((j: string) => LOVE_KEYWORDS.includes(j))
})

// ============================================================
// 配对检查
// ============================================================
const showMatchSheet = ref(false)
const zodiacNames = ref(ZODIAC_NAMES)
const signNames = ref(SIGN_NAMES)
const matchZodiacIdx = ref(0)
const matchSignIdx = ref(0)
const matchResult = ref<{ relation: string; relationDesc: string; partner?: CrossMatchResult; insight?: PairInsight } | null>(null)

const matchResultBadge = computed(() => {
  const r = matchResult.value?.relation || ''
  if (r.includes('六合')) return 'great'
  if (r.includes('三合')) return 'good'
  if (r.includes('冲')) return 'caution'
  return 'neutral'
})

function onMatchZodiacChange(e: any) { matchZodiacIdx.value = e.detail.value }
function onMatchSignChange(e: any) { matchSignIdx.value = e.detail.value }

function doMatchCheck() {
  const z = zodiacNames.value[matchZodiacIdx.value]
  const s = signNames.value[matchSignIdx.value]
  try {
    const partner = zodiacSignMatch(z, s)
    // 用当前用户数据和对方数据生成双人解读
    const selfMatch = zodiacSignMatch(userZodiac.value, userSign.value)
    const insight = generatePairInsight(selfMatch, partner)
    matchResult.value = {
      relation: partner.relation,
      relationDesc: partner.relationDesc,
      partner,
      insight,
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '配对失败', icon: 'none' })
  }
}

// ============================================================
// 导航
// ============================================================
function goBack() {
  uni.navigateBack()
}

function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

// ============================================================
// Canvas 分享卡
// ============================================================
const showSharePreview = ref(false)
const shareImagePath = ref('')
let shareCanvasNode: any = null
const SHARE_CARD_W = 640
const SHARE_CARD_H = 960

onShareAppMessage(() => ({
  title: `${userZodiac.value || '我'} · ${userSign.value || '星座'} 的桃花人格卡`,
  path: buildTaohuaSharePath(),
  imageUrl: shareImagePath.value || undefined,
}))

function sharePersona() {
  // 先尝试生成分享卡
  generateShareCard()
}

function buildTaohuaSharePath() {
  const params = [
    `zodiac=${encodeURIComponent(userZodiac.value || '')}`,
    `sign=${encodeURIComponent(userSign.value || '')}`,
    `from=persona`
  ]
  return `/pages/taohua-share/taohua-share?${params.join('&')}`
}

function generateShareCard() {
  const query = uni.createSelectorQuery()
  query.select('#taohuaShareCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res[0] || !res[0].node) {
        uni.showToast({ title: '分享卡生成失败', icon: 'none' })
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = SHARE_CARD_W * dpr
      canvas.height = SHARE_CARD_H * dpr
      ctx.scale(dpr, dpr)

      drawShareCard(ctx)
      shareCanvasNode = canvas
    })
}

function drawShareCard(ctx: any) {
  const W = SHARE_CARD_W, H = SHARE_CARD_H
  const signData = crossData.value
  const western = signData?.western || {}
  const chinese = signData?.chinese || {}
  const personality = western.personality || '自带吸引力，越真实越容易被看见'
  const personaTitle = String(personality).split('——')[0] || '桃花吸引型'
  const personaDesc = String(personality).split('——')[1] || personality
  const zodiac = userZodiac.value || '生肖'
  const sign = userSign.value || '星座'
  const starName = chinese.name || '--'
  const starMeta = chinese.zhi ? `${chinese.zhi} · ${chinese.wuxing || ''}${chinese.yinyang || ''}` : '中国星次'
  const planetLine = western.planet
    ? `${western.planet}守护 · ${western.element || ''}象${String(western.mode || '').split('（')[0]}`
    : '星座能量待解锁'
  const cnText = chinese.character || '你的关系气质，会在熟悉感和吸引力之间慢慢显形。'
  const bestMatch = Array.isArray(western.bestMatch) ? western.bestMatch.slice(0, 3) : []

  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FFF6E4')
  bg.addColorStop(0.45, '#FFE1D8')
  bg.addColorStop(1, '#FFFDF5')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Soft background motifs.
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath()
  ctx.arc(538, 120, 156, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFD93D'
  ctx.beginPath()
  ctx.arc(72, 780, 148, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  drawCompassMark(ctx, 500, 162, 94)

  // Main paper.
  drawRoundRect(ctx, 28, 32, W - 56, H - 64, 34, '#111')
  ctx.fillStyle = '#fff'
  drawRoundRect(ctx, 20, 24, W - 56, H - 64, 34)

  const header = ctx.createLinearGradient(20, 24, W - 36, 220)
  header.addColorStop(0, '#7F2B1D')
  header.addColorStop(0.62, '#C84A3D')
  header.addColorStop(1, '#FFD36E')
  ctx.fillStyle = header
  drawRoundRect(ctx, 20, 24, W - 56, 224, 34)
  ctx.fillStyle = '#fff'
  ctx.fillRect(20, 204, W - 56, 70)

  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.fillText('Dom-Crush · 命理桃花', 58, 80)
  drawPill(ctx, 386, 54, 144, 42, '桃花人格卡', '#FFF3BF', '#7A2C1B', 20)

  ctx.font = 'bold 42px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('我的桃花人设', 58, 142)
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.84)'
  ctx.fillText(`${zodiac} · ${sign} · ${starName}`, 58, 184)

  // Avatar seal.
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(116, 286, 70, 0, Math.PI * 2)
  ctx.fill()
  const seal = ctx.createLinearGradient(58, 216, 174, 354)
  seal.addColorStop(0, '#FFD93D')
  seal.addColorStop(1, '#FF8E7D')
  ctx.fillStyle = seal
  ctx.beginPath()
  ctx.arc(108, 278, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(108, 278, 54, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = 'bold 54px sans-serif'
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.fillText(zodiac.slice(0, 1), 108, 296)
  ctx.textAlign = 'left'

  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText('你的吸引力关键词', 202, 260)
  ctx.font = 'bold 46px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, personaTitle, 202, 320, 360, 52, 2)

  drawPill(ctx, 58, 386, 128, 42, zodiac, '#111', '#FFD93D', 21)
  drawPill(ctx, 200, 386, 150, 42, sign, '#FFF0E5', '#8A3A28', 21)
  drawPill(ctx, 366, 386, 154, 42, starMeta, '#F5F0E8', '#111', 19)

  drawSection(ctx, 58, 452, 524, 172, '桃花风格', '#FFE7E1')
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, personaDesc, 88, 534, 464, 34, 3)

  drawSection(ctx, 58, 656, 248, 150, '西方星座', '#FFF4C7')
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, planetLine, 84, 734, 196, 30, 2)

  drawSection(ctx, 334, 656, 248, 150, '中国星次', '#F2F0EA')
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText(starName, 360, 734)
  ctx.font = '19px sans-serif'
  ctx.fillStyle = '#5F5148'
  wrapTextLimited(ctx, cnText, 360, 766, 176, 26, 2)

  if (bestMatch.length > 0) {
    ctx.font = 'bold 20px sans-serif'
    ctx.fillStyle = '#8A3A28'
    ctx.fillText('高频适配', 58, 842)
    bestMatch.forEach((m: string, i: number) => {
      drawPill(ctx, 156 + i * 120, 818, 104, 42, m, '#FFF0E5', '#8A3A28', 19)
    })
  }

  ctx.strokeStyle = '#111'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(58, 878)
  ctx.lineTo(W - 72, 878)
  ctx.stroke()
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText('打开小程序，测你的桃花人格与今日桃花位', 58, 918)
  ctx.font = '18px sans-serif'
  ctx.fillStyle = '#8E8177'
  ctx.fillText('AI 辅助分析，仅供文化娱乐参考', 58, 946)

  // 导出
  setTimeout(() => {
    uni.canvasToTempFilePath({
      canvas: shareCanvasNode,
      success: (res: any) => {
        shareImagePath.value = res.tempFilePath
        showSharePreview.value = true
      },
      fail: () => {
        uni.showToast({ title: '图片生成失败', icon: 'none' })
      },
    })
  }, 300)
}

function drawRoundRect(ctx: any, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  if (fill) ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function drawPill(ctx: any, x: number, y: number, w: number, h: number, text: string, bg: string, fg: string, size: number) {
  drawRoundRect(ctx, x, y, w, h, h / 2, bg)
  ctx.font = `bold ${size}px sans-serif`
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawSection(ctx: any, x: number, y: number, w: number, h: number, title: string, bg: string) {
  drawRoundRect(ctx, x + 6, y + 8, w, h, 20, '#111')
  drawRoundRect(ctx, x, y, w, h, 20, bg)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText(title, x + 28, y + 42)
  ctx.strokeStyle = 'rgba(17,17,17,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 28, y + 58)
  ctx.lineTo(x + w - 28, y + 58)
  ctx.stroke()
}

function drawCompassMark(ctx: any, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.globalAlpha = 0.32
  ctx.strokeStyle = '#7F2B1D'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.64, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36)
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.stroke()
  }
  ctx.restore()
}

function wrapTextLimited(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = text.split('')
  let line = ''
  let cy = y
  let lines = 0
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines += 1
      if (lines >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 1))}…`, x, cy)
        return
      }
      ctx.fillText(line, x, cy)
      line = ch
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
}

function wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  wrapTextLimited(ctx, text, x, y, maxWidth, lineHeight, 20)
}

function saveShareImage() {
  if (!shareImagePath.value) return
  uni.saveImageToPhotosAlbum({
    filePath: shareImagePath.value,
    success: () => {
      uni.showToast({ title: '已保存到相册', icon: 'success' })
      showSharePreview.value = false
    },
    fail: () => {
      uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    },
  })
}

// ── 每日推送订阅 ──
const subscribedNotify = ref(false)

function subscribeNotify() {
  // #ifdef MP-WEIXIN
  const tmplId = 'REPLACE_WITH_YOUR_TMPL_ID' // 在微信后台申请后替换
  ;(wx as any).requestSubscribeMessage({
    tmplIds: [tmplId],
    success: async (res: any) => {
      if (res[tmplId] === 'accept') {
        try {
          await callFunction({
            name: 'sendTaohuaNotify',
            data: { action: 'subscribe', openid: uni.getStorageSync('openid') || '' },
          })
          // 本地记录订阅
          const sub = { tmplId, subscribedAt: Date.now() }
          uni.setStorageSync('taohuaSubscription', JSON.stringify(sub))
          subscribedNotify.value = true
          uni.showToast({ title: '已开启每日推送', icon: 'success' })
        } catch (e: any) {
          // 如果云函数未部署，至少本地记录
          uni.setStorageSync('taohuaSubscription', JSON.stringify({ tmplId, subscribedAt: Date.now() }))
          subscribedNotify.value = true
          uni.showToast({ title: '已开启（云函数部署后生效）', icon: 'none' })
        }
      }
    },
    fail: () => {
      uni.showToast({ title: '授权已取消', icon: 'none' })
    },
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '此功能仅支持微信小程序', icon: 'none' })
  // #endif
}

// 初始化时检查是否已订阅
try {
  const stored = uni.getStorageSync('taohuaSubscription')
  if (stored) subscribedNotify.value = true
} catch (_) { /* ignore */ }
</script>

<style scoped>
/* ============================================================
   页面级 v2 样式（复用全站 Campus Pop 设计系统）
   ============================================================ */

/* 导航栏 */
.nav-bar-v2 {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20rpx 28rpx; border-bottom: 3rpx solid #111;
  background: #FFFDF5; margin-bottom: 20rpx;
}
.nav-back-v2 { font-size: 24rpx; font-weight: 800; color: #111; }
.nav-title-v2 { font-size: 28rpx; font-weight: 900; color: #111; }
.nav-placeholder-v2 { width: 60rpx; }

/* Hero */
.hero-block-v2 {
  background: var(--hero-bg, #FF6B6B); padding: 32rpx 28rpx;
  border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111;
  transform: rotate(-0.5deg); margin: 0 20rpx 24rpx;
}
.hero-tag-v2 { display: inline-block; background: #111; color: #FFD93D; font-size: 18rpx; font-weight: 900; padding: 4rpx 14rpx; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.hero-title-v2 { font-size: 48rpx; font-weight: 900; color: #111; line-height: 1.1; letter-spacing: -2rpx; }
.hl-v2 { background: #FFD93D; padding: 0 6rpx; }
.hero-copy-v2 { display: block; font-size: 22rpx; font-weight: 600; color: rgba(0,0,0,0.7); margin-top: 8rpx; line-height: 1.4; }

/* Card */
.card-v2 {
  background: #fff; border: 3rpx solid #111; box-shadow: 6rpx 6rpx 0 #111;
  padding: 28rpx; margin: 0 20rpx 24rpx;
}
.section-title-v2 { display: block; font-size: 22rpx; font-weight: 900; color: #111; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 12rpx; }
.card-text-v2 { display: block; font-size: 24rpx; font-weight: 600; color: #666; line-height: 1.5; margin-bottom: 4rpx; }
.card-text-v2.muted { color: #999; font-size: 20rpx; }
.card-text-v2.strong { color: #111; font-weight: 800; }

/* 方位条 */
.dir-strip-v2 { display: flex; gap: 8rpx; margin-top: 16rpx; }
.dir-cell-v2 { flex: 1; text-align: center; border: 2rpx solid #111; background: #f9f9f9; padding: 10rpx 4rpx; }
.dir-lbl-v2 { font-size: 18rpx; font-weight: 700; color: #666; display: block; }
.dir-val-v2 { font-size: 22rpx; font-weight: 900; color: #111; display: block; margin-top: 2rpx; }

/* 宜忌分裂卡片 */
.split-row-v2 { display: flex; gap: 12rpx; margin-top: 12rpx; }
.split-half-v2 { flex: 1; padding: 16rpx; border: 2rpx solid #111; }
.split-half-v2.yi { background: #f0fdfa; }
.split-half-v2.ji { background: #fff5f5; }
.split-label-v2 { font-size: 22rpx; font-weight: 900; display: block; margin-bottom: 8rpx; }
.split-label-v2.yi { color: #4ECDC4; }
.split-label-v2.ji { color: #FF5252; }
.split-item-v2 { font-size: 20rpx; font-weight: 600; color: #111; padding: 3rpx 0; display: block; }

/* 标签 */
.tag-row-v2 { display: flex; flex-wrap: wrap; gap: 6rpx; }
.tag-v2 { display: inline-block; border: 2rpx solid #111; padding: 4rpx 14rpx; font-size: 20rpx; font-weight: 800; background: #FFD93D; color: #111; }
.tag-v2.black { background: #111; color: #FFD93D; }
.tag-v2.green { background: #4ECDC4; color: #111; }
.tag-v2.red { background: #FF5252; color: #fff; }

/* 人格卡 */
.persona-card-v2 { border: 3rpx solid #111; padding: 24rpx; background: #fff; box-shadow: 4rpx 4rpx 0 #111; margin-top: 12rpx; }
.persona-head-v2 { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.persona-avatar-v2 { width: 64rpx; height: 64rpx; border-radius: 50%; border: 3rpx solid #111; background: #FFD93D; display: flex; align-items: center; justify-content: center; font-size: 36rpx; flex-shrink: 0; }
.persona-name-v2 { font-size: 24rpx; font-weight: 900; color: #111; display: block; }
.persona-sub-v2 { font-size: 18rpx; color: #666; display: block; }
.persona-dim-v2 { margin-bottom: 14rpx; }
.persona-dim-label-v2 { display: inline-block; background: #111; color: #FFD93D; font-size: 16rpx; font-weight: 900; padding: 2rpx 10rpx; margin-bottom: 4rpx; }
.persona-dim-text-v2 { display: block; font-size: 20rpx; font-weight: 600; color: #666; line-height: 1.4; }
.persona-dim-text-v2.strong { color: #111; font-weight: 800; font-size: 22rpx; }
.persona-dim-src-v2 { font-size: 16rpx; color: #999; margin-top: 2rpx; display: block; }

/* 引导卡 */
.guide-card-v2 { border-style: dashed; border-color: #999; cursor: pointer; }

/* 匹配徽章 */
.match-badge-wrap { text-align: center; padding: 20rpx 0; }
.match-badge-v2 { display: inline-block; padding: 12rpx 28rpx; border: 3rpx solid #111; box-shadow: 3rpx 3rpx 0 #111; font-size: 28rpx; font-weight: 900; }
.match-badge-v2.great { background: #4ECDC4; color: #111; }
.match-badge-v2.good { background: #FFD93D; color: #111; }
.match-badge-v2.caution { background: #FF5252; color: #fff; }
.match-badge-v2.neutral { background: #fff; color: #111; }

/* 全览表格 */
.overview-table-v2 { margin-top: 12rpx; }
.ov-row-v2 { display: flex; align-items: center; padding: 10rpx 0; border-bottom: 1rpx dashed #ccc; }
.ov-row-v2:last-child { border-bottom: none; }
.ov-row-v2.current { background: #FFFBEB; margin: 0 -8rpx; padding: 12rpx 8rpx; border-radius: 4rpx; }
.ov-label-v2 { width: 130rpx; font-size: 20rpx; font-weight: 900; color: #111; flex-shrink: 0; }
.ov-dir-v2 { font-size: 18rpx; font-weight: 600; color: #666; padding: 4rpx 12rpx; border: 2rpx solid #111; background: #f9f9f9; margin: 0 4rpx; }
.ov-dir-v2.current { background: #FFD93D; color: #111; font-weight: 800; }

/* 按钮 */
.btn-v2-me { display: flex; align-items: center; justify-content: center; height: 64rpx; border: 3rpx solid #111; font-size: 26rpx; font-weight: 800; background: #fff; color: #111; border-radius: 0; }
.btn-v2-me.primary { background: #4ECDC4; box-shadow: 4rpx 4rpx 0 #111; }
.btn-v2-me.outline { background: #fff; }

/* Bottom Sheet */
.sheet-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
.sheet-panel { width: 100%; max-width: 500rpx; background: #FFFDF5; border: 3rpx solid #111; box-shadow: 8rpx 8rpx 0 #111; border-radius: 16rpx 16rpx 0 0; padding: 28rpx 24rpx 60rpx; max-height: 70vh; overflow-y: auto; }
.sheet-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.sheet-title-v2 { font-size: 24rpx; font-weight: 900; color: #111; }
.sheet-close-v2 { font-size: 24rpx; font-weight: 900; color: #999; }

/* Picker */
.picker-row-v2 { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.picker-box-v2 { flex: 1; }
.picker-label-v2 { font-size: 18rpx; font-weight: 700; color: #666; margin-bottom: 6rpx; display: block; }
.picker-display-v2 { width: 100%; height: 52rpx; border: 3rpx solid #111; display: flex; align-items: center; padding: 0 16rpx; font-size: 22rpx; font-weight: 700; background: #fff; }

/* 配对结果 */
.match-result-v2 { margin-top: 20rpx; padding: 16rpx; border: 3rpx solid #111; background: #fff; }
.match-detail-v2 { margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx dashed #ccc; }

/* 双人解读 */
.pair-insight-v2 { margin-top: 16rpx; }
.pair-section-v2 { margin-bottom: 12rpx; }
.pair-label-v2 { font-size: 22rpx; font-weight: 900; color: #111; display: block; margin-bottom: 4rpx; }
.pair-text-v2 { font-size: 22rpx; font-weight: 600; color: #666; display: block; line-height: 1.5; }
.pair-text-v2.muted { color: #999; font-size: 20rpx; }
.pair-classical-v2 { font-size: 18rpx; color: #999; display: block; margin-top: 8rpx; padding-top: 8rpx; border-top: 1rpx dashed #ddd; }

/* 桃花指数条 */
.score-bar-v2 { margin-bottom: 16rpx; }
.score-head-v2 { display: flex; align-items: baseline; gap: 8rpx; margin-bottom: 8rpx; }
.score-num-v2 { font-size: 56rpx; font-weight: 900; color: #111; line-height: 1; }
.score-unit-v2 { font-size: 22rpx; font-weight: 700; color: #999; }
.score-level-v2 { font-size: 28rpx; font-weight: 900; color: #111; margin-left: 8rpx; }
.score-track-v2 { height: 14rpx; background: #e8e8e8; border: 2rpx solid #111; }
.score-fill-v2 { height: 100%; background: #FFD93D; transition: width 0.6s ease; }

/* 行动指南 */
.guide-section-v2 { display: flex; gap: 14rpx; padding: 16rpx 0; border-bottom: 1rpx dashed #ddd; }
.guide-section-v2:last-child { border-bottom: none; }
.guide-icon-v2 { font-size: 40rpx; flex-shrink: 0; width: 52rpx; text-align: center; line-height: 52rpx; }
.guide-content-v2 { flex: 1; }
.guide-label-v2 { font-size: 22rpx; font-weight: 900; color: #111; display: block; margin-bottom: 4rpx; }
.guide-text-v2 { font-size: 22rpx; font-weight: 600; color: #666; display: block; line-height: 1.4; }
.guide-text-v2.strong { color: #111; font-weight: 800; }

/* 古籍出处 */
.cite-block-v2 { margin-top: 14rpx; padding: 10rpx 14rpx; background: #FFFBEB; border-left: 4rpx solid #FFD93D; }
.cite-title-v2 { font-size: 20rpx; font-weight: 900; color: #111; display: block; }
.cite-desc-v2 { font-size: 18rpx; color: #999; display: block; line-height: 1.5; margin-top: 2rpx; }
.cite-inline-v2 { font-size: 18rpx; font-weight: 700; color: #bbb; margin-left: 4rpx; }

/* 免责声明 */
.disclaimer-card-v2 { border-style: dashed; background: #FFFBEB; }
.ai-disclaimer { text-align: center; padding: 20rpx 20rpx 40rpx; }
.ai-disclaimer-text { font-size: 20rpx; color: #999; }
</style>
