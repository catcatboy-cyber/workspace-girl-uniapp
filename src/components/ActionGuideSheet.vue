<template>
  <view v-if="visible" class="ags-mask" @click.stop="$emit('close')">
    <view class="ags-sheet" @click.stop>
      <!-- Topbar -->
      <view class="ags-topbar">
        <text class="ags-topbar-title">今日行动指南</text>
        <view class="ags-topbar-close" @click.stop="$emit('close')"><text>×</text></view>
      </view>

      <!-- Stage -->
      <view class="ags-stage">
        <!-- 3 compasses -->
        <view class="ags-compasses">
          <view class="ags-compass ags-compass-peach">
            <text class="ags-mc-n">N</text><text class="ags-mc-s">S</text><text class="ags-mc-e">E</text><text class="ags-mc-w">W</text>
            <view class="ags-mc-needle ags-mc-needle-peach" :style="peachNeedleStyle">
              <view class="ags-mc-needle-tip">
                <image class="ags-mc-needle-icon-img" src="/static/icons/taohua/flower.svg" mode="aspectFit" />
              </view>
            </view>
            <text class="ags-mc-label">桃花·{{ direction }}</text>
          </view>
          <view class="ags-compass ags-compass-luan">
            <text class="ags-mc-n">N</text><text class="ags-mc-s">S</text><text class="ags-mc-e">E</text><text class="ags-mc-w">W</text>
            <view class="ags-mc-needle ags-mc-needle-luan" :style="luanNeedleStyle">
              <view class="ags-mc-needle-tip" :style="luanEmojiStyle">
                <image class="ags-mc-needle-icon-img" src="/static/icons/taohua/heart-filled.svg" mode="aspectFit" />
              </view>
            </view>
            <text class="ags-mc-label">红鸾·{{ hongluanDir }}</text>
          </view>
          <view class="ags-compass ags-compass-xi">
            <text class="ags-mc-n">N</text><text class="ags-mc-s">S</text><text class="ags-mc-e">E</text><text class="ags-mc-w">W</text>
            <view class="ags-mc-needle ags-mc-needle-xi" :style="xiNeedleStyle">
              <view class="ags-mc-needle-tip">
                <image class="ags-mc-needle-icon-img" src="/static/icons/taohua/star-filled.svg" mode="aspectFit" />
              </view>
            </view>
            <text class="ags-mc-label">天喜·{{ tianxiDir }}</text>
          </view>
        </view>
        <view class="ags-cite-compass"><image class="ags-cite-icon" src="/static/icons/taohua/book.svg" mode="aspectFit" /><text>《三命通会》咸池桃花 · 红鸾天喜篇</text></view>

        <!-- Cards -->
        <view class="ags-cards">
          <view v-if="wearColors.length" class="ags-card ags-card-wear">
            <view class="ags-card-kicker"><image class="ags-card-kicker-icon" src="/static/icons/taohua/shirt.svg" mode="aspectFit" /><text>穿什么 · 戴什么</text></view>
            <text class="ags-card-main">{{ wearOneLiner || wearColors.join(' + ') }}</text>
            <view class="ags-color-dots">
              <view v-for="(c, i) in dotColors" :key="i" class="ags-color-dot" :style="{ background: c }" />
            </view>
            <view v-if="wearHighlight" class="ags-card-sub"><image class="ags-card-sub-icon" src="/static/icons/taohua/gem.svg" mode="aspectFit" /><text>{{ wearHighlight }} · {{ wearMaterial }}</text></view>
            <view class="ags-card-cite"><image class="ags-cite-icon" src="/static/icons/taohua/book.svg" mode="aspectFit" /><text>《三命通会·论五行》</text></view>
          </view>

          <view v-if="venue" class="ags-card ags-card-venue">
            <view class="ags-card-kicker"><image class="ags-card-kicker-icon" src="/static/icons/taohua/pin.svg" mode="aspectFit" /><text>去哪儿 · 做什么</text></view>
            <text class="ags-card-main">{{ venue }}</text>
            <view v-if="venueActivities.length" class="ags-card-sub"><image class="ags-card-sub-icon" src="/static/icons/taohua/leaf.svg" mode="aspectFit" /><text>{{ venueActivities.slice(0, 3).join(' · ') }}</text></view>
            <view class="ags-card-cite"><image class="ags-cite-icon" src="/static/icons/taohua/book.svg" mode="aspectFit" /><text>《协纪辨方书》</text></view>
          </view>

          <view v-if="doList.length" class="ags-card ags-card-do">
            <view class="ags-card-kicker"><image class="ags-card-kicker-icon" src="/static/icons/taohua/check.svg" mode="aspectFit" /><text>今日宜</text></view>
            <text class="ags-card-main">{{ doList.slice(0, 4).join(' · ') }}</text>
            <text v-if="guideSummary" class="ags-card-sub">{{ guideSummary }}</text>
            <view class="ags-card-cite"><image class="ags-cite-icon" src="/static/icons/taohua/book.svg" mode="aspectFit" /><text>《协纪辨方书》</text></view>
          </view>
        </view>

        <!-- Score -->
        <view class="ags-score">
          <text class="ags-score-num">{{ score }}</text>
          <text class="ags-score-div">/</text>
          <text class="ags-score-unit">100</text>
          <view class="ags-score-label"><text>今日气场</text><block v-if="aura"><text> · </text><block v-for="(seg, si) in auraSegs" :key="si"><image v-if="seg.type === 'icon'" class="ags-emoji-icon" :src="seg.src" mode="aspectFit" /><text v-else>{{ seg.value }}</text></block></block></view>
        </view>

        <!-- Dont chips -->
        <view v-if="dontList.length" class="ags-donts">
          <view v-for="(d, i) in dontList.slice(0, 3)" :key="i" class="ags-dont-chip"><image class="ags-dont-chip-icon" src="/static/icons/taohua/cross.svg" mode="aspectFit" /><text>{{ d }}</text></view>
        </view>

        <!-- Xiaomi -->
        <view class="ags-pet">
          <image class="ags-pet-img" src="/static/pets/xiaomi/avatar.png" mode="aspectFit" />
        </view>

      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseEmojiText } from '@/utils/zodiac-icons'

const props = defineProps<{
  visible: boolean
  score: number
  direction: string
  hongluanDir: string
  tianxiDir: string
  jianchu: string
  rating: string
  oneliner: string
  venue: string
  venueActivities: string[]
  doList: string[]
  dontList: string[]
  aura: string
  guideSummary: string
  isLow: boolean
  liuheDir: string
  wearColors: string[]
  wearMaterial: string
  wearHighlight: string
  wearOneLiner: string
  taohuaWuxing: string
  benmingWuxing: string
  fiveElementRelation: string
}>()

defineEmits<{ close: [] }>()

// 气场文本含后端 emoji（真机渲染不稳），走 SVG 混排
const auraSegs = computed(() => parseEmojiText(props.aura))

// ── 方位 → 角度 ──
const DIR_ANGLE: Record<string, number> = {
  '正北': 0, '正南': 180, '正东': 90, '正西': 270,
  '东北偏北': 22, '东北偏东': 68,
  '东南偏东': 113, '东南偏南': 158,
  '西南偏南': 203, '西南偏西': 248,
  '西北偏西': 293, '西北偏北': 338,
}
function dirAngle(dir: string): number {
  return DIR_ANGLE[dir] !== undefined ? DIR_ANGLE[dir] : 0
}

const peachNeedleStyle = computed(() => ({
  transform: `translate(-50%,-100%) rotate(${dirAngle(props.direction)}deg)`
}))
const luanNeedleStyle = computed(() => ({
  transform: `translate(-50%,-100%) rotate(${dirAngle(props.hongluanDir)}deg)`
}))
/** 红鸾针反向旋转，让爱心始终正向 */
const luanEmojiStyle = computed(() => ({
  transform: `translateX(-50%) rotate(${-dirAngle(props.hongluanDir)}deg)`
}))
const xiNeedleStyle = computed(() => ({
  transform: `translate(-50%,-100%) rotate(${dirAngle(props.tianxiDir)}deg)`
}))

// ── 中文颜色名 → CSS 颜色 ──
const CN_COLOR: Record<string, string> = {
  '红': '#E74C3C', '红色': '#E74C3C', '粉红': '#FF6B81', '粉色': '#FF6B81', '桃红': '#FF85A2',
  '橙': '#F39C12', '橙色': '#F39C12', '橘色': '#F39C12',
  '黄': '#F1C40F', '黄色': '#F1C40F', '金色': '#FFD700', '金': '#FFD700',
  '绿': '#27AE60', '绿色': '#27AE60', '青色': '#1ABC9C', '薄荷绿': '#1ABC9C',
  '蓝': '#3498DB', '蓝色': '#3498DB', '浅蓝': '#85C1E9', '天蓝': '#5DADE2', '深蓝': '#2C3E80', '藏青': '#1B2A4A',
  '紫': '#8E44AD', '紫色': '#8E44AD', '浅紫': '#BB8FCE',
  '白': '#FDFEFE', '白色': '#FDFEFE', '米白': '#FDEBD0', '乳白': '#FEF9E7',
  '黑': '#2C3E50', '黑色': '#2C3E50', '灰': '#95A5A6', '灰色': '#95A5A6', '棕': '#A0522D', '棕色': '#A0522D', '卡其色': '#C4A882',
  '银': '#C0C0C0', '银色': '#C0C0C0',
}

// 从 oneLiner 提取颜色词，兜底用 wearColors
const KNOWN_COLORS = Object.keys(CN_COLOR).sort((a, b) => b.length - a.length)
function extractColors(text: string): string[] {
  const found: string[] = []
  let remaining = text
  for (const name of KNOWN_COLORS) {
    if (remaining.includes(name)) {
      found.push(name)
      remaining = remaining.replaceAll(name, '')
    }
  }
  return [...new Set(found)]
}
const dotColors = computed(() => {
  // 优先从 oneLiner 提取
  const fromText = extractColors(props.wearOneLiner)
  if (fromText.length > 0) return fromText.map((name: string) => CN_COLOR[name] || '#ddd')
  // 兜底用 wearColors
  return props.wearColors.map((name: string) => {
    if (/^(#|rgb|hsl)/.test(name)) return name
    return CN_COLOR[name.trim()] || '#ddd'
  })
})
</script>

<style scoped>
/* ═══ MASK + SHEET ═══ */
.ags-mask{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end}
.ags-sheet{width:100%;max-height:88vh;overflow-y:auto;padding:0 0 calc(140rpx + env(safe-area-inset-bottom));background:var(--app-bg,#FFFDF5);border-radius:24rpx 24rpx 0 0;border-top:3rpx solid var(--border,#111);box-shadow:var(--shadow-hero,0 -8rpx 0 #111);animation:ags-slide-up .3s ease-out;box-sizing:border-box}
@keyframes ags-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}

/* ═══ TOPBAR ═══ */
.ags-topbar{display:flex;justify-content:space-between;align-items:center;padding:20rpx 28rpx 12rpx}
.ags-topbar-title{font-size:38rpx;font-weight:900;color:var(--text-main,#111)}
.ags-topbar-close{width:56rpx;height:56rpx;border-radius:50%;border:2rpx solid var(--border,#111);display:flex;align-items:center;justify-content:center;font-size:38rpx;color:var(--text-muted,#666)}

/* ═══ STAGE ═══ */
.ags-stage{position:relative;min-height:1040rpx;margin:0 24rpx 24rpx;padding-bottom:20rpx;background:var(--surface-soft,#f5ead6);border:2rpx solid var(--border,#111);border-radius:var(--shape-radius-card,0);overflow:hidden}

/* ═══ COMPASSES ═══ */
.ags-compasses{position:absolute;top:40rpx;left:40rpx;z-index:3;display:flex;flex-direction:column;gap:112rpx}
.ags-compass{position:relative;width:100rpx;height:100rpx;border:5rpx solid var(--border,#111);border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,250,240,.9),rgba(245,235,220,.6),rgba(235,220,200,.4));box-shadow:0 0 0 4rpx rgba(24,21,20,.04),0 4rpx 20rpx rgba(0,0,0,.06)}
.ags-compass:before{content:"";position:absolute;inset:10rpx;border-radius:50%;border:2rpx dashed rgba(24,21,20,.1);animation:compass-ring 8s linear infinite}
@keyframes compass-ring{to{transform:rotate(360deg)}}
.ags-compass:after{content:"";position:absolute;left:50%;top:12rpx;width:1px;height:calc(100% - 24rpx);background:rgba(24,21,20,.08);transform:translateX(-50%)}

/* N/S/E/W */
.ags-mc-n{position:absolute;top:-28rpx;left:50%;transform:translateX(-50%);font-size:22rpx;font-weight:900;color:rgba(24,21,20,.3);z-index:4}
.ags-mc-s{position:absolute;bottom:-28rpx;left:50%;transform:translateX(-50%);font-size:22rpx;font-weight:900;color:rgba(24,21,20,.3);z-index:4}
.ags-mc-e{position:absolute;right:-28rpx;top:50%;transform:translateY(-50%);font-size:22rpx;font-weight:900;color:rgba(24,21,20,.3);z-index:4}
.ags-mc-w{position:absolute;left:-28rpx;top:50%;transform:translateY(-50%);font-size:22rpx;font-weight:900;color:rgba(24,21,20,.3);z-index:4}

/* Needles — base */
.ags-mc-needle{position:absolute;left:50%;top:50%;width:4rpx;height:36rpx;transform-origin:bottom center;border-radius:2rpx;z-index:2}
.ags-mc-needle:before{content:"";position:absolute;left:50%;bottom:0;width:12rpx;height:12rpx;background:inherit;border-radius:50%;transform:translate(-50%,50%);box-shadow:0 0 8rpx currentColor}
@keyframes needle-pulse{0%,100%{transform:translateX(-50%)scale(1)}50%{transform:translateX(-50%)scale(1.15)}}

/* 桃花 / 红鸾 / 天喜 needle — emoji 用真实节点，避免真机伪元素 content 丢失 */
.ags-mc-needle-peach{background:var(--hero,#FF6B6B);box-shadow:0 0 12rpx rgba(239,118,105,.4)}
.ags-mc-needle-luan{background:var(--risk,#FF5252);box-shadow:0 0 10rpx rgba(212,121,110,.35)}
.ags-mc-needle-xi{background:var(--accent,#FFD93D);box-shadow:0 0 10rpx rgba(196,155,74,.35)}
.ags-mc-needle-tip{position:absolute;top:-22rpx;left:50%;transform:translateX(-50%);line-height:1;animation:needle-pulse 2s ease-in-out infinite}
.ags-mc-needle-emoji{font-size:22rpx;line-height:1}
.ags-mc-needle-icon-img{width:28rpx;height:28rpx;display:block}

.ags-mc-label{position:absolute;bottom:-60rpx;left:50%;transform:translateX(-50%);font-size:22rpx;font-weight:900;white-space:nowrap}
.ags-compass-peach .ags-mc-label{color:var(--hero,#FF6B6B)}
.ags-compass-luan .ags-mc-label{color:var(--risk,#FF5252)}
.ags-compass-xi .ags-mc-label{color:var(--accent,#FFD93D)}

/* ═══ CARDS FLEX CONTAINER ═══ */
.ags-cards { display: flex; flex-direction: column; align-items: flex-end; gap: 32rpx; padding: 28rpx 20rpx 240rpx 160rpx; }

/* ═══ BALLOON CARDS ═══ */
.ags-card{z-index:4;border-radius:var(--shape-radius-card,0);padding:28rpx 32rpx;border:2rpx solid var(--card-border,#111);box-shadow:inset 0 -12rpx 28rpx rgba(0,0,0,.06),inset 0 6rpx 20rpx rgba(255,255,255,.5),0 12rpx 40rpx rgba(0,0,0,.1);display:flex;flex-direction:column;gap:8rpx;width:390rpx;box-sizing:border-box}
.ags-card-kicker-icon{width:28rpx;height:28rpx;flex-shrink:0}.ags-card-sub-icon{width:24rpx;height:24rpx;flex-shrink:0}.ags-dont-chip-icon{width:22rpx;height:22rpx;flex-shrink:0}.ags-card-kicker{display:flex;align-items:center;gap:6rpx;font-size:28rpx;font-weight:700;color:var(--card-accent,#ef7669);letter-spacing:.05em}
.ags-card-main{font-size:24rpx;font-weight:400;color:var(--text-main,#111);line-height:1.35}
.ags-card-sub{display:flex;align-items:center;gap:6rpx;font-size:24rpx;color:var(--text-muted,#666);line-height:1.4;font-weight:400}
.ags-card-cite{display:flex;align-items:center;gap:3rpx;margin-top:6rpx;font-size:20rpx;color:var(--text-soft,#999);font-weight:400}
.ags-cite-icon{width:18rpx;height:18rpx;flex-shrink:0}.ags-cite-compass{position:absolute;top:660rpx;left:40rpx;z-index:3;display:flex;align-items:flex-start;gap:3rpx;font-size:18rpx;color:var(--text-soft,#999);font-weight:400;width:140rpx;line-height:1.3}
.ags-color-dots{display:flex;gap:12rpx;margin-top:4rpx}
.ags-color-dot{width:32rpx;height:32rpx;border-radius:50%;border:3rpx solid rgba(24,21,20,.2)}

.ags-card-wear{background:linear-gradient(160deg,#FFF8F0 0%,#FFE8D0 50%,#FFD8BC 100%);--card-accent:var(--hero,#ef7669);--card-border:#e0b090}
.ags-card-venue{background:linear-gradient(160deg,#F5FFFA 0%,#D8F0E4 50%,#C0E8D4 100%);--card-accent:#2d6a4f;--card-border:#a0d0b8}
.ags-card-do{background:linear-gradient(160deg,#F5FFFD 0%,#D8F8F0 50%,#C0ECE4 100%);--card-accent:#1a6b5a;--card-border:#90d0c4}

/* ═══ SCORE ═══ */
.ags-score{position:absolute;right:32rpx;bottom:140rpx;z-index:4;display:flex;align-items:baseline;gap:4rpx}
.ags-score-num{font-size:50rpx;font-weight:900;color:var(--hero,#FF6B6B);line-height:1}
.ags-score-div{font-size:32rpx;color:#ddd;font-weight:700}
.ags-score-unit{font-size:32rpx;color:#aaa;font-weight:700}
.ags-score-label{display:flex;align-items:center;gap:2rpx;font-size:22rpx;color:#bbb;font-weight:700;margin-left:16rpx}
.ags-emoji-icon{width:26rpx;height:26rpx;flex-shrink:0}

/* ═══ DONT CHIPS ═══ */
.ags-donts{position:absolute;right:20rpx;bottom:60rpx;z-index:4;display:flex;gap:8rpx}
.ags-dont-chip{display:flex;align-items:center;gap:4rpx;padding:8rpx 20rpx;border-radius:28rpx;font-size:22rpx;font-weight:700;background:rgba(239,118,105,.06);border:3rpx solid rgba(239,118,105,.2);color:#b87068}

/* ═══ XIAOMI ═══ */
.ags-pet{position:absolute;z-index:5;left:16rpx;bottom:16rpx;width:140rpx;height:170rpx;animation:pet-bob 3s ease-in-out infinite}
@keyframes pet-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8rpx)}}
.ags-pet-img{width:130rpx;height:auto;filter:drop-shadow(6rpx 10rpx 0 rgba(24,21,20,.12))}

/* ═══ EMPTY STATE ═══ */
.ags-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted,#666);font-size:32rpx;font-weight:700}
</style>
