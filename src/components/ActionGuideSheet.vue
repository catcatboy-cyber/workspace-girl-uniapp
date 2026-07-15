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
            <view class="ags-mc-needle ags-mc-needle-peach" :style="peachNeedleStyle" />
            <text class="ags-mc-label">桃花·{{ direction }}</text>
          </view>
          <view class="ags-compass ags-compass-luan">
            <text class="ags-mc-n">N</text><text class="ags-mc-s">S</text><text class="ags-mc-e">E</text><text class="ags-mc-w">W</text>
            <view class="ags-mc-needle ags-mc-needle-luan" :style="luanNeedleStyle" />
            <text class="ags-mc-label">红鸾·{{ hongluanDir }}</text>
          </view>
          <view class="ags-compass ags-compass-xi">
            <text class="ags-mc-n">N</text><text class="ags-mc-s">S</text><text class="ags-mc-e">E</text><text class="ags-mc-w">W</text>
            <view class="ags-mc-needle ags-mc-needle-xi" :style="xiNeedleStyle" />
            <text class="ags-mc-label">天喜·{{ tianxiDir }}</text>
          </view>
        </view>

        <!-- Card 1: Wear -->
        <view v-if="wearColors.length" class="ags-card ags-card-wear">
          <text class="ags-card-kicker">👗 穿什么 · 戴什么</text>
          <text class="ags-card-main">{{ wearOneLiner || wearColors.join(' + ') }}</text>
          <view class="ags-color-dots">
            <view v-for="(c, i) in dotColors" :key="i" class="ags-color-dot" :style="{ background: c }" />
          </view>
          <text v-if="wearHighlight" class="ags-card-sub">💎 {{ wearHighlight }} · {{ wearMaterial }}</text>
        </view>

        <!-- Card 2: Venue -->
        <view v-if="venue" class="ags-card ags-card-venue">
          <text class="ags-card-kicker">📍 去哪儿 · 做什么</text>
          <text class="ags-card-main">{{ venue }}</text>
          <text v-if="venueActivities.length" class="ags-card-sub">🌿 {{ venueActivities.slice(0, 3).join(' · ') }}</text>
        </view>

        <!-- Card 3: Do -->
        <view v-if="doList.length" class="ags-card ags-card-do">
          <text class="ags-card-kicker">✅ 今日宜</text>
          <text class="ags-card-main">{{ doList.slice(0, 4).join(' · ') }}</text>
          <text v-if="guideSummary" class="ags-card-sub">{{ guideSummary }}</text>
        </view>

        <!-- Score -->
        <view class="ags-score">
          <text class="ags-score-num">{{ score }}</text>
          <text class="ags-score-div">/</text>
          <text class="ags-score-unit">100</text>
          <text class="ags-score-label">今日气场</text>
        </view>

        <!-- Dont chips -->
        <view v-if="dontList.length" class="ags-donts">
          <text v-for="(d, i) in dontList.slice(0, 3)" :key="i" class="ags-dont-chip">❌ {{ d }}</text>
        </view>

        <!-- Xiaomi -->
        <view class="ags-pet">
          <image class="ags-pet-img" src="/static/pets/xiaomi/avatar.png" mode="aspectFit" />
        </view>

        <!-- Petals -->
        <view class="ags-petals">
          <view v-for="i in 4" :key="i" class="ags-petal" :style="petalStyle(i)" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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

// ── 方位 → 角度 ──
const DIR_ANGLE: Record<string, number> = {
  '正北': 0, '正南': 180, '正东': 90, '正西': 270,
  '东北偏北': 22, '东北偏东': 68,
  '东南偏东': 113, '东南偏南': 158,
  '西南偏南': 203, '西南偏西': 248,
  '西北偏西': 293, '西北偏北': 338,
}
function dirAngle(dir: string): number {
  return DIR_ANGLE[dir] ?? 0
}

const peachNeedleStyle = computed(() => ({
  transform: `translate(-50%,-100%) rotate(${dirAngle(props.direction)}deg)`
}))
const luanNeedleStyle = computed(() => ({
  transform: `translate(-50%,-100%) rotate(${dirAngle(props.hongluanDir)}deg)`,
  '--luan-deg': String(-dirAngle(props.hongluanDir))
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

const petalPresets = [
  { top: '4%', left: '50%', dur: '4s', delay: '0s', drift: '18px', spin: '360deg' },
  { top: '8%', left: '55%', dur: '3.5s', delay: '0.6s', drift: '-10px', spin: '-320deg' },
  { top: '2%', left: '60%', dur: '4.2s', delay: '1.2s', drift: '25px', spin: '400deg' },
  { top: '6%', left: '48%', dur: '3.8s', delay: '1.8s', drift: '-14px', spin: '-350deg' },
]
function petalStyle(i: number) {
  const p = petalPresets[i - 1] || petalPresets[0]
  return {
    top: p.top, left: p.left,
    '--d': p.dur, '--delay': p.delay,
    '--drift': p.drift, '--spin': p.spin,
  }
}
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
.ags-stage{position:relative;min-height:920rpx;margin:0 24rpx 24rpx;padding-bottom:20rpx;background:var(--surface-soft,#f5ead6);border:2rpx solid var(--border,#111);border-radius:var(--shape-radius-card,0);overflow:hidden}

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

/* 桃花 needle */
.ags-mc-needle-peach{background:var(--hero,#FF6B6B);box-shadow:0 0 12rpx rgba(239,118,105,.4)}
.ags-mc-needle-peach:after{position:absolute;top:-22rpx;left:50%;transform:translateX(-50%);font-size:22rpx;line-height:1;animation:needle-pulse 2s ease-in-out infinite;content:"🌸"}

/* 红鸾 needle — ::after 爱心反向旋转保持正向 */
.ags-mc-needle-luan{background:var(--risk,#FF5252);box-shadow:0 0 10rpx rgba(212,121,110,.35)}
.ags-mc-needle-luan:after{position:absolute;top:-22rpx;left:50%;font-size:22rpx;line-height:1;animation:needle-pulse 2s ease-in-out infinite;content:"❤️";transform:translateX(-50%)rotate(var(--luan-deg,0deg))}

/* 天喜 needle */
.ags-mc-needle-xi{background:var(--accent,#FFD93D);box-shadow:0 0 10rpx rgba(196,155,74,.35)}
.ags-mc-needle-xi:after{position:absolute;top:-22rpx;left:50%;transform:translateX(-50%);font-size:22rpx;line-height:1;animation:needle-pulse 2s ease-in-out infinite;content:"⭐"}

.ags-mc-label{position:absolute;bottom:-60rpx;left:50%;transform:translateX(-50%);font-size:22rpx;font-weight:900;white-space:nowrap}
.ags-compass-peach .ags-mc-label{color:var(--hero,#FF6B6B)}
.ags-compass-luan .ags-mc-label{color:var(--risk,#FF5252)}
.ags-compass-xi .ags-mc-label{color:var(--accent,#FFD93D)}

/* ═══ BALLOON CARDS ═══ */
.ags-card{position:absolute;z-index:4;border-radius:var(--shape-radius-card,0);padding:28rpx 32rpx;border:2rpx solid var(--card-border,#111);box-shadow:inset 0 -12rpx 28rpx rgba(0,0,0,.06),inset 0 6rpx 20rpx rgba(255,255,255,.5),0 12rpx 40rpx rgba(0,0,0,.1);display:flex;flex-direction:column;gap:8rpx;animation:card-float var(--fd,5s) ease-in-out infinite;animation-delay:var(--fdl,0s)}
@keyframes card-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8rpx)}}
.ags-card-kicker{font-size:32rpx;font-weight:700;color:var(--card-accent,#ef7669);letter-spacing:.05em}
.ags-card-main{font-size:34rpx;font-weight:400;color:var(--text-main,#111);line-height:1.35}
.ags-card-sub{font-size:24rpx;color:var(--text-muted,#666);line-height:1.4;font-weight:400}
.ags-color-dots{display:flex;gap:12rpx;margin-top:4rpx}
.ags-color-dot{width:32rpx;height:32rpx;border-radius:50%;border:3rpx solid rgba(24,21,20,.2)}

.ags-card-wear{background:linear-gradient(160deg,#FFF8F0 0%,#FFE8D0 50%,#FFD8BC 100%);--card-accent:var(--hero,#ef7669);--card-border:#e0b090;top:28rpx;right:20rpx;width:390rpx;min-height:180rpx;--fd:4.8s;--fdl:0s}
.ags-card-venue{background:linear-gradient(160deg,#F5FFFA 0%,#D8F0E4 50%,#C0E8D4 100%);--card-accent:#2d6a4f;--card-border:#a0d0b8;top:330rpx;right:20rpx;width:390rpx;min-height:160rpx;--fd:5.2s;--fdl:.4s}
.ags-card-do{background:linear-gradient(160deg,#F5FFFD 0%,#D8F8F0 50%,#C0ECE4 100%);--card-accent:#1a6b5a;--card-border:#90d0c4;top:580rpx;right:20rpx;width:390rpx;min-height:160rpx;--fd:4.5s;--fdl:.8s}

/* ═══ SCORE ═══ */
.ags-score{position:absolute;right:32rpx;bottom:108rpx;z-index:4;display:flex;align-items:baseline;gap:4rpx;animation:card-float 5s ease-in-out infinite}
.ags-score-num{font-size:50rpx;font-weight:900;color:var(--hero,#FF6B6B);line-height:1}
.ags-score-div{font-size:32rpx;color:#ddd;font-weight:700}
.ags-score-unit{font-size:32rpx;color:#aaa;font-weight:700}
.ags-score-label{font-size:22rpx;color:#bbb;font-weight:700;margin-left:16rpx}

/* ═══ DONT CHIPS ═══ */
.ags-donts{position:absolute;right:20rpx;bottom:28rpx;z-index:4;display:flex;gap:8rpx}
.ags-dont-chip{padding:8rpx 20rpx;border-radius:28rpx;font-size:22rpx;font-weight:700;background:rgba(239,118,105,.06);border:3rpx solid rgba(239,118,105,.2);color:#b87068;animation:chip-float 4s ease-in-out infinite;animation-delay:var(--cd,0s)}
.ags-dont-chip:nth-child(1){--cd:0s}.ags-dont-chip:nth-child(2){--cd:.3s}.ags-dont-chip:nth-child(3){--cd:.6s}
@keyframes chip-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6rpx)}}

/* ═══ XIAOMI ═══ */
.ags-pet{position:absolute;z-index:5;left:16rpx;bottom:16rpx;width:140rpx;height:170rpx;animation:pet-bob 3s ease-in-out infinite}
@keyframes pet-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8rpx)}}
.ags-pet-img{width:130rpx;height:auto;filter:drop-shadow(6rpx 10rpx 0 rgba(24,21,20,.12))}

/* ═══ PETALS ═══ */
.ags-petals{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.ags-petal{position:absolute;width:12rpx;height:14rpx;background:var(--hero,#FF6B6B);border-radius:50% 0 50% 50%;opacity:0;animation:petal-fall var(--d,4s) var(--delay,0s) ease-in infinite}
.ags-petal:nth-child(odd){background:#f08c80;border-radius:0 50% 50% 50%}
@keyframes petal-fall{0%{opacity:0;transform:translate(0,-16rpx)rotate(0deg)scale(.5)}8%{opacity:.7}60%{opacity:.35}100%{opacity:0;transform:translate(var(--drift,36rpx),440rpx)rotate(var(--spin,360deg))scale(.2)}}

/* ═══ EMPTY STATE ═══ */
.ags-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted,#666);font-size:32rpx;font-weight:700}
</style>
