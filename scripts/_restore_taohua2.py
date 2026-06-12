"""Restore remaining taohua.vue changes: font bump, info icon, tianxi/hongluan, yinji flow."""
import re

path = 'src/pages/taohua/taohua.vue'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# === 1. Font bump: caption->body, body->body-lg, body-lg->heading, heading->kpi ===
FS_MAP = {
    '20rpx': '22rpx', '19rpx': '22rpx', '18rpx': '22rpx',
    '22rpx': '26rpx', '21rpx': '26rpx',
    '26rpx': '32rpx', '24rpx': '32rpx',
    '32rpx': '40rpx', '30rpx': '40rpx', '28rpx': '40rpx',
    '16rpx': '20rpx', '14rpx': '20rpx',
}
for old_val, new_val in sorted(FS_MAP.items(), key=lambda x: -len(x[0])):
    content = re.sub(r'font-size:\s*' + re.escape(old_val), 'font-size: ' + new_val, content)
print('1. Font bump done')

# === 2. Add ⓘ info icon + decision tree popup ===
old_title = '''      <view class="section-title-row-v2">
        <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(30)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
        <text v-else class="taohua-icon-emoji">🎯</text>
        <text class="section-title-v2 no-margin">今日行动指南</text>
      </view>'''

new_title = '''      <view class="section-title-row-v2">
        <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(30)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
        <text v-else class="taohua-icon-emoji">🎯</text>
        <text class="section-title-v2 no-margin">今日行动指南</text>
        <text class="info-dot-v2" @click="showGuideInfo = true">ⓘ</text>
      </view>
      <view v-if="showGuideInfo" class="info-overlay" @click="showGuideInfo = false">
        <view class="info-sheet" @click.stop>
          <view class="info-sheet-head">
            <text class="info-sheet-title">方位决策指南</text>
            <text class="info-sheet-close" @click="showGuideInfo = false">×</text>
          </view>
          <view class="info-sheet-body">
            <view class="info-tree-item"><text class="info-tree-q">只是想约TA、制造暧昧、日常碰面？</text><text class="info-tree-a">→ 看 🪷 桃花位（当日气场，管邂逅）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">准备告白 / 确定关系 / 见家长？</text><text class="info-tree-a">→ 看 🔴 红鸾位（本命位，管姻缘开端）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">求婚 / 订婚 / 结婚 / 备孕？</text><text class="info-tree-a">→ 看 🕊️ 天喜位（本命位，管婚庆落地）</text></view>
            <view class="info-tree-divider"></view>
            <view class="info-tree-item"><text class="info-tree-q">三个方向重叠（天喜日 🔥）？</text><text class="info-tree-a">→ 能量加乘，做什么都对，重要节点首选</text></view>
            <view class="info-tree-divider"></view>
            <text class="info-tree-note">💡 核心：按你要的结果选对应的煞。日常暧昧不需要天喜，求婚不需要桃花。各管各的，不互相替代。</text>
          </view>
        </view>
      </view>'''

content = content.replace(old_title, new_title)
print('2. Info icon + decision tree added')

# === 3. Add 天喜/红鸾 direction display in guide label ===
old_guide_label = '<text class="guide-label-v2">{{ guideVibeLabel }} <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text></text>'
new_guide_label = '<text class="guide-label-v2">🪷 桃花<text class="guide-dir-hl">{{ guideDirection }}</text> · 🔴 红鸾<text class="guide-dir-hl hongluan">{{ natalHongluanDir || \'--\' }}</text> · 🕊️ 天喜<text class="guide-dir-hl tianxi">{{ natalTianxiDir || \'--\' }}</text><text v-if="guideTianxiDir"> 🔥</text> · {{ guideVibeLabel }} <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text></text>'
content = content.replace(old_guide_label, new_guide_label)
print('3. Direction display added')

# === 4. 宜忌 inline flow ===
old_split_items = '''          <text v-for="y in loveYi" :key="y" class="split-item-v2">{{ y }}</text>
        </view>
        <view class="split-half-v2 ji">
          <view class="split-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">⚠️</text>
            <text class="split-label-v2 ji">忌</text>
          </view>
          <text v-for="j in loveJi" :key="j" class="split-item-v2">{{ j }}</text>'''

new_split_items = '''          <text class="split-item-flow-v2"><text v-for="(y, i) in loveYi" :key="y">{{ i > 0 ? \' · \' : \'\' }}{{ y }}</text></text>
        </view>
        <view class="split-half-v2 ji">
          <view class="split-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">⚠️</text>
            <text class="split-label-v2 ji">忌</text>
          </view>
          <text class="split-item-flow-v2"><text v-for="(j, i) in loveJi" :key="j">{{ i > 0 ? \' · \' : \'\' }}{{ j }}</text></text>'''

content = content.replace(old_split_items, new_split_items)
print('4. Yinji inline flow')

# === 5. Add guideDirection/guideTianxiDir/natalHongluan/natalTianxi computed ===
# Find the guide computed section and add new ones after guideDonts
old_guide_donts = 'const guideDonts = computed(() => guide.value.避开 || [])'
new_guide_extras = '''const guideDonts = computed(() => guide.value.避开 || [])
const guideDirection = computed(() => guide.value.方位 || '--')
const guideTianxiDir = computed(() => guide.value.天喜方位 || '')
const ZODIAC_LIST = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
const YEAR_BRANCH = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const HONGLUAN_FROM_YEAR: Record<string,string> = {'子':'卯','丑':'寅','寅':'丑','卯':'子','辰':'亥','巳':'戌','午':'酉','未':'申','申':'未','酉':'午','戌':'巳','亥':'辰'}
const LIUCHONG: Record<string,string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'}
const DIR_FROM_ZHI: Record<string,string> = {'子':'正北','丑':'东北','寅':'东北','卯':'正东','辰':'东南','巳':'东南','午':'正南','未':'西南','申':'西南','酉':'正西','戌':'西北','亥':'西北'}
const natalHongluanDir = computed(() => {
  const z = userZodiac.value
  if (!z) return ''
  const idx = ZODIAC_LIST.indexOf(z)
  if (idx < 0) return ''
  const yz = YEAR_BRANCH[idx]
  const hl = HONGLUAN_FROM_YEAR[yz]
  return DIR_FROM_ZHI[hl] || ''
})
const natalTianxiDir = computed(() => {
  const z = userZodiac.value
  if (!z) return ''
  const idx = ZODIAC_LIST.indexOf(z)
  if (idx < 0) return ''
  const yz = YEAR_BRANCH[idx]
  const hl = HONGLUAN_FROM_YEAR[yz]
  const tx = LIUCHONG[hl]
  return DIR_FROM_ZHI[tx] || ''
})'''
content = content.replace(old_guide_donts, new_guide_extras)
print('5. Direction computed added')

# === 6. Add showGuideInfo ref ===
content = content.replace('const isLowTaohuaScore = computed(() => taohuaScore.value < 40)', 'const isLowTaohuaScore = computed(() => taohuaScore.value < 40)\nconst showGuideInfo = ref(false)')
print('6. showGuideInfo ref added')

# === 7. Add CSS for info popup, direction highlights, yi-ji flow ===
# Find CSS section and add new rules
css_insert = '''
/* info popup */
.info-dot-v2 { display: inline-flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border: 2rpx solid #111; font-size: 22rpx; font-weight: 900; color: #111; margin-left: auto; cursor: pointer; }
.info-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); }
.info-sheet { width: 100%; max-width: 500px; max-height: 70vh; background: #FFFDF5; border: 3px solid #111; box-shadow: 8rpx 8rpx 0 #111; display: flex; flex-direction: column; overflow: hidden; }
.info-sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; border-bottom: 2rpx solid #111; flex-shrink: 0; }
.info-sheet-title { font-size: 26rpx; font-weight: 900; color: #111; }
.info-sheet-close { font-size: 36rpx; font-weight: 900; color: #111; padding: 0 8rpx; line-height: 1; }
.info-sheet-body { padding: 24rpx 28rpx; overflow-y: auto; flex: 1; }
.info-tree-item { padding: 14rpx 0; border-bottom: 1rpx dashed #ccc; }
.info-tree-item:last-child { border-bottom: none; }
.info-tree-q { display: block; font-size: 26rpx; font-weight: 700; color: #111; margin-bottom: 4rpx; }
.info-tree-a { display: block; font-size: 22rpx; font-weight: 600; color: #666; }
.info-tree-divider { height: 12rpx; }
.info-tree-note { display: block; font-size: 20rpx; color: #999; line-height: 1.5; padding-top: 8rpx; }

/* direction highlights */
.guide-dir-hl { display: inline-block; background: #FFD93D; padding: 2rpx 10rpx; font-weight: 900; }
.guide-dir-hl.hongluan { background: #FF6B6B; color: #fff; }
.guide-dir-hl.tianxi { background: #4ECDC4; color: #fff; }

/* yi-ji inline flow */
.split-item-flow-v2 { font-size: 22rpx; font-weight: 700; color: #111; line-height: 1.8; }
'''

# Insert before .split-item-v2 CSS rule
css_marker = '.split-item-v2 { font-size: 22rpx; font-weight: 700; color: #111; padding: 3rpx 0; display: block; }'
content = content.replace(css_marker, css_insert)
print('7. CSS added')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('All done')
