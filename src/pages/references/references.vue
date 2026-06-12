<template>
  <view :class="['page v2-mode anim-ready', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view class="nav-bar-v2">
      <text class="nav-back-v2" @click="goBack">← 返回</text>
      <text class="nav-title-v2">引用经典</text>
      <text class="nav-placeholder-v2"></text>
    </view>

    <view class="hero-block-v2">
      <text class="hero-tag-v2">BIBLIOGRAPHY</text>
      <text class="hero-title-v2">引用<text class="hl-v2">经典</text></text>
      <text class="hero-copy-v2">本小程序命理桃花功能所引用的古代经典文献，均源自公开可考的传统典籍。</text>
    </view>

    <!-- 中国传统经典 -->
    <view class="card-v2">
      <text class="section-title-v2">🇨🇳 中国传统经典</text>

      <view class="ref-item-v2">
        <text class="ref-name-v2">《三命通会》</text>
        <text class="ref-meta-v2">明 · 万民英 著 | 成书约 1578 年</text>
        <text class="ref-desc-v2">明代命理学集大成之作，共十二卷。本书引用了其中：</text>
        <view class="ref-uses-v2">
          <text class="ref-use-tag">咸池桃花算法</text>
          <text class="ref-use-tag">红鸾天喜查表</text>
          <text class="ref-use-tag">地支六合/六冲/三合</text>
          <text class="ref-use-tag">五行生克体系</text>
          <text class="ref-use-tag">墙内/墙外桃花</text>
        </view>
      </view>

      <view class="ref-divider-v2" />

      <view class="ref-item-v2">
        <text class="ref-name-v2">《协纪辨方书》</text>
        <text class="ref-meta-v2">清 · 允禄、梅瑴成 等奉敕编纂 | 成书 1741 年</text>
        <text class="ref-desc-v2">清代官方编纂的择吉术数全书，共三十六卷。本书引用了其中：</text>
        <view class="ref-uses-v2">
          <text class="ref-use-tag">建除十二神</text>
          <text class="ref-use-tag">逐日宜忌规则</text>
          <text class="ref-use-tag">喜神方位口诀</text>
          <text class="ref-use-tag">财神方位口诀</text>
          <text class="ref-use-tag">福神方位口诀</text>
          <text class="ref-use-tag">天乙贵人方位</text>
          <text class="ref-use-tag">嫁娶择吉规则</text>
        </view>
      </view>

      <view class="ref-divider-v2" />

      <view class="ref-item-v2">
        <text class="ref-name-v2">《汉书·律历志》</text>
        <text class="ref-meta-v2">东汉 · 班固 著 | 成书约 82 年</text>
        <text class="ref-desc-v2">《汉书》十志之一，记载了汉代天文历法体系。本书引用了其中：</text>
        <view class="ref-uses-v2">
          <text class="ref-use-tag">十二星次与地支对应</text>
          <text class="ref-use-tag">星次与二十四节气关系</text>
          <text class="ref-use-tag">星次宫位体系</text>
        </view>
      </view>

      <view class="ref-divider-v2" />

      <view class="ref-item-v2">
        <text class="ref-name-v2">《果老星宗》</text>
        <text class="ref-meta-v2">托名唐 · 张果 著 | 成书约明代</text>
        <text class="ref-desc-v2">中国传统星命学经典，以七政四余（日月+五星+四余气）为体系。本书引用了其中：</text>
        <view class="ref-uses-v2">
          <text class="ref-use-tag">七政四余十二宫框架</text>
          <text class="ref-use-tag">星次与星座映射体系</text>
        </view>
      </view>
    </view>

    <!-- 西方传统经典 -->
    <view class="card-v2">
      <text class="section-title-v2">🌍 西方传统经典</text>

      <view class="ref-item-v2">
        <text class="ref-name-v2">Tetrabiblos（《占星四书》）</text>
        <text class="ref-meta-v2">Claudius Ptolemy（克劳狄乌斯·托勒密）| 约公元 139–161 年</text>
        <text class="ref-desc-v2">西方占星学最古老、最完整的奠基文献，被誉为"占星学的圣经"。本书引用了其中：</text>
        <view class="ref-uses-v2">
          <text class="ref-use-tag">行星守护体系（Book I · Domicile Rulership）</text>
          <text class="ref-use-tag">星座三形态分类（Book III Ch.13 · Solstitial / Solid / Bicorporeal Signs）</text>
          <text class="ref-use-tag">行星气质分析（Book III Ch.14-15 · Planetary Soul Qualities）</text>
          <text class="ref-use-tag">三合性/元素体系（Book I Ch.21 · Triplicities）</text>
        </view>
      </view>
    </view>

    <view class="ai-disclaimer">
      <text class="ai-disclaimer-text">以上经典均为公开可考的传统文化典籍，本小程序对其内容进行了算法化翻译和现代应用适配。仅供文化娱乐参考。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const fontSizeMode = ref('')
const pageStyle = ref('')

try { fontSizeMode.value = uni.getStorageSync('fontSizeMode') || '' } catch (_) { /* ignore */ }
try {
  const themeId = uni.getStorageSync('theme') || 'campus-pop'
  if (themeId === 'campus-pop') {
    pageStyle.value = '--app-bg:#FFFDF5;--hero-bg:#FF6B6B;--hero-bg-2:#e85d5d;'
  }
} catch (_) { /* ignore */ }

function goBack() { uni.navigateBack() }
</script>

<style scoped lang="scss">
.nav-bar-v2 { display:flex; align-items:center; justify-content:space-between; padding:20rpx 28rpx; border-bottom:3rpx solid #111; background:#FFFDF5; margin-bottom:20rpx; }
.nav-back-v2 { font-size: $fs-body-lg; font-weight: $fw-hero; color:#111; }
.nav-title-v2 { font-size: $fs-heading; font-weight: $fw-hero; color:#111; }
.nav-placeholder-v2 { width:60rpx; }

.hero-block-v2 { background:var(--hero-bg,#FF6B6B); padding:32rpx 28rpx; border:3rpx solid #111; box-shadow:8rpx 8rpx 0 #111; transform:rotate(-0.5deg); margin:0 20rpx 24rpx; }
.hero-tag-v2 { display:inline-block; background:#111; color:#FFD93D; font-size: $fs-caption; font-weight: $fw-hero; padding:4rpx 14rpx; letter-spacing:2rpx; margin-bottom:10rpx; }
.hero-title-v2 { font-size: $fs-hero-title; font-weight: $fw-hero; color:#111; line-height:1.1; letter-spacing:-2rpx; }
.hl-v2 { background:#FFD93D; padding:0 6rpx; }
.hero-copy-v2 { display:block; font-size: $fs-body; font-weight: $fw-body; color:rgba(0,0,0,0.7); margin-top:8rpx; line-height:1.4; }

.card-v2 { background:#fff; border:3rpx solid #111; box-shadow:6rpx 6rpx 0 #111; padding:28rpx; margin:0 20rpx 24rpx; }
.section-title-v2 { display:block; font-size: $fs-body; font-weight: $fw-hero; color:#111; text-transform:uppercase; letter-spacing:2rpx; margin-bottom:16rpx; }

.ref-item-v2 { margin-bottom:8rpx; }
.ref-name-v2 { font-size: $fs-body-lg; font-weight: $fw-hero; color:#111; display:block; }
.ref-meta-v2 { font-size: $fs-caption; font-weight: $fw-body; color:#999; display:block; margin-top:4rpx; }
.ref-desc-v2 { font-size: $fs-caption; font-weight: $fw-body; color:#666; display:block; margin-top:8rpx; line-height:1.5; }
.ref-uses-v2 { display:flex; flex-wrap:wrap; gap:6rpx; margin-top:8rpx; }
.ref-use-tag { display:inline-block; font-size: $fs-caption; font-weight: $fw-label; color:#111; background:#FFFBEB; border:1.5rpx solid #FFD93D; padding:3rpx 10rpx; }
.ref-divider-v2 { height:1rpx; background:#eee; margin:20rpx 0; }

.ai-disclaimer { text-align:center; padding:20rpx 20rpx 40rpx; }
.ai-disclaimer-text { font-size: $fs-caption; color:#999; }
</style>
