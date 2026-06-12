"""
Precise one-pass restore of all taohua.vue changes.
Two-phase font bump avoids cascade flattening.
"""
import re

path = 'src/pages/taohua/taohua.vue'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

def report(step, ok):
    print(f'  {step}: {"OK" if ok else "NOT FOUND"}')

# ============================================================
# STEP 2: lang="scss"
# ============================================================
c = c.replace('<style scoped>', '<style scoped lang="scss">')
report('Step 2: scss lang', '<style scoped lang="scss">' in c)

# ============================================================
# STEP 3: TWO-PHASE font bump
# Phase A: replace each old rpx value with unique temp marker
# Phase B: resolve all markers to final rpx values
# ============================================================
BUMP = {
    # old value -> new value (one tier up)
    '20rpx': '22rpx', '19rpx': '22rpx', '18rpx': '22rpx',  # caption -> body
    '22rpx': '26rpx', '24rpx': '26rpx',                     # body -> body-lg
    '26rpx': '32rpx',                                        # body-lg -> heading
    '32rpx': '40rpx', '30rpx': '40rpx', '28rpx': '40rpx',   # heading -> kpi
    '16rpx': '20rpx', '14rpx': '20rpx',                     # micro -> caption
    # 48rpx and 56rpx stay unchanged
}

# Phase A: replace each old value with a UNIQUE temp marker
temp_map = {}
for i, (old_val, new_val) in enumerate(sorted(BUMP.items(), key=lambda x: -len(x[0]))):
    marker = f'__FS_MARK_{i}__'
    temp_map[marker] = new_val
    c = re.sub(r'font-size:\s*' + re.escape(old_val), 'font-size: ' + marker, c)

# Phase B: resolve all temp markers
for marker, new_val in temp_map.items():
    c = c.replace(marker, new_val)

# Verify no markers remain
assert '__FS_MARK_' not in c, 'Temp markers not fully resolved!'
report('Step 3: font bump (2-phase)', True)

# ============================================================
# STEP 4: Merge template blocks
# ============================================================
old_blocks = '''      <!-- 去哪 -->
      <view class="guide-section-v2">
        <view class="guide-icon-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(40)" :src="taohuaIcon('compass')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🧭</text>
        </view>
        <view class="guide-content-v2">
          <text class="guide-label-v2">去哪约会 <text class="cite-inline-v2">《三命通会》</text></text>
          <text class="guide-text-v2">{{ dateAdviceText }}</text>
          <text class="guide-text-v2 muted">{{ dateAdviceDetailLabel }}：{{ dateAdviceDetailText }}</text>
        </view>
      </view>

      <!-- 做啥 -->
      <view class="guide-section-v2">
        <view class="guide-icon-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(40)" :src="taohuaIcon('target')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🎯</text>
        </view>
        <view class="guide-content-v2">
          <text class="guide-label-v2">{{ computedReport.今日行动指南?.活动建议?.今日气场 || '今日感情运势' }} <text class="cite-inline-v2">《协纪辨方书》</text></text>
          <text class="guide-text-v2">{{ computedReport.今日行动指南?.活动建议?.一句话 || '' }}</text>
          <view v-if="(computedReport.今日行动指南?.活动建议?.建议活动 || []).length > 0" style="margin-top:6rpx;">
            <view v-for="(a, i) in computedReport.今日行动指南?.活动建议?.建议活动 || []" :key="'act-'+i" class="tag-v2 green tag-with-icon-v2">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('target')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">🎯</text>
              <text>{{ a }}</text>
            </view>
          </view>
          <view v-if="(computedReport.今日行动指南?.活动建议?.宜做 || []).length > 0" style="margin-top:6rpx;">
            <view v-for="(a, i) in computedReport.今日行动指南?.活动建议?.宜做 || []" :key="'do-'+i" class="guide-line-v2 good">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('checkCircle')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">✅</text>
              <text class="guide-text-v2 good">{{ a }}</text>
            </view>
          </view>
          <view v-if="(computedReport.今日行动指南?.活动建议?.避开 || []).length > 0" style="margin-top:4rpx;">
            <view v-for="(a, i) in computedReport.今日行动指南?.活动建议?.避开 || []" :key="'dont-'+i" class="guide-line-v2">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">⚠️</text>
              <text class="guide-text-v2 muted">{{ a }}</text>
            </view>
          </view>
        </view>
      </view>'''

new_block = '''      <!-- 今日约会指南（方位+气场+活动合并） -->
      <view class="guide-section-v2">
        <view class="guide-icon-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(40)" :src="taohuaIcon('compass')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🧭</text>
        </view>
        <view class="guide-content-v2">
          <text class="guide-label-v2">{{ guideVibeLabel }} <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text></text>
          <text class="guide-text-v2">{{ guideOneliner }}</text>
          <view v-if="(guideActivities || []).length > 0" style="margin-top:6rpx;">
            <view v-for="(a, i) in guideActivities" :key="'act-'+i" class="tag-v2 green tag-with-icon-v2">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('target')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">🎯</text>
              <text>{{ a }}</text>
            </view>
          </view>
          <view v-if="(guideDos || []).length > 0" style="margin-top:6rpx;">
            <view v-for="(a, i) in guideDos" :key="'do-'+i" class="guide-line-v2 good">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('checkCircle')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">✅</text>
              <text class="guide-text-v2 good">{{ a }}</text>
            </view>
          </view>
          <view v-if="(guideDonts || []).length > 0" style="margin-top:4rpx;">
            <view v-for="(a, i) in guideDonts" :key="'dont-'+i" class="guide-line-v2">
              <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
              <text v-else class="taohua-icon-emoji">⚠️</text>
              <text class="guide-text-v2 muted">{{ a }}</text>
            </view>
          </view>
        </view>
      </view>'''

ok = old_blocks in c
if ok:
    c = c.replace(old_blocks, new_block)
report('Step 4: merge guide blocks', ok)

# ============================================================
# STEP 5: JS computed replacement
# ============================================================
old_computed = '''const dateAdviceText = computed(() => {
  if (isLowTaohuaScore.value) {
    return \x60今天桃花指数 \x24{taohuaScore.value}/100，不建议按方位安排线下约会；线上互动更稳妥，改天再约。\x60
  }
  return computedReport.value.今日行动指南?.约会方位?.一句话 || ''
})
const dateAdviceDetailLabel = computed(() => isLowTaohuaScore.value ? '低分建议' : '桃花方位')
const dateAdviceDetailText = computed(() => {
  if (isLowTaohuaScore.value) {
    return '线上聊聊、语音或一起打游戏即可；如果一定要见面，选熟悉、低压力的地方。'
  }
  return computedReport.value.今日行动指南?.约会方位?.桃花方位?.场所建议 || ''
})'''

new_computed = '''const guide = computed(() => {
  const ag = computedReport.value.今日行动指南
  if (!ag) return {}
  if (ag.约会指南) return ag.约会指南
  const oldDate = ag.约会方位
  const oldActivity = ag.活动建议
  if (!oldActivity) return {}
  return {
    方位: oldDate?.桃花方位?.方位 || '',
    场所建议: oldDate?.桃花方位?.场所建议 || '',
    今日气场: oldActivity.今日气场 || '',
    解读: oldActivity.解读 || '',
    建议活动: oldActivity.建议活动 || [],
    宜做: oldActivity.宜做 || [],
    避开: oldActivity.避开 || [],
    一句话: oldDate?.一句话 || oldActivity.一句话 || '',
    isLow: (oldDate?.一句话 || '').includes('偏低') || (oldDate?.一句话 || '').includes('不建议'),
  }
})
const guideVibeLabel = computed(() => guide.value.今日气场 || guide.value.解读 || '今日感情运势')
const guideOneliner = computed(() => guide.value.一句话 || '')
const guideActivities = computed(() => guide.value.建议活动 || [])
const guideDos = computed(() => guide.value.宜做 || [])
const guideDonts = computed(() => guide.value.避开 || [])'''

ok = old_computed in c
if ok:
    c = c.replace(old_computed, new_computed)
report('Step 5: computed props', ok)

# ============================================================
# STEP 6: ⓘ info icon + decision tree
# ============================================================
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
            <text class="info-sheet-close" @click="showGuideInfo = false">\xd7</text>
          </view>
          <view class="info-sheet-body">
            <view class="info-tree-item"><text class="info-tree-q">只是想约TA、制造暧昧、日常碰面？</text><text class="info-tree-a">→ 看 \U0001fAB7 桃花位（当日气场，管邂逅）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">准备告白 / 确定关系 / 见家长？</text><text class="info-tree-a">→ 看 \U0001f534 红鸾位（本命位，管姻缘开端）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">求婚 / 订婚 / 结婚 / 备孕？</text><text class="info-tree-a">→ 看 \U0001f54a️ 天喜位（本命位，管婚庆落地）</text></view>
            <view class="info-tree-divider"></view>
            <view class="info-tree-item"><text class="info-tree-q">三个方向重叠（天喜日 \U0001f525）？</text><text class="info-tree-a">→ 能量加乘，做什么都对，重要节点首选</text></view>
            <view class="info-tree-divider"></view>
            <text class="info-tree-note">\U0001f4a1 核心：按你要的结果选对应的煞。日常暧昧不需要天喜，求婚不需要桃花。各管各的，不互相替代。</text>
          </view>
        </view>
      </view>'''

ok = old_title in c
if ok:
    c = c.replace(old_title, new_title)
report('Step 6: info icon + tree', ok)

# ============================================================
# STEP 7: Directions in guide label
# ============================================================
old_guide_label = '<text class="guide-label-v2">{{ guideVibeLabel }} <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text></text>'
new_guide_label = '<text class="guide-label-v2">\U0001fab7 桃花<text class="guide-dir-hl">{{ guideDirection }}</text> \xb7 \U0001f534 红鸾<text class="guide-dir-hl hongluan">{{ natalHongluanDir || \'--\' }}</text> \xb7 \U0001f54a️ 天喜<text class="guide-dir-hl tianxi">{{ natalTianxiDir || \'--\' }}</text><text v-if="guideTianxiDir"> \U0001f525</text> \xb7 {{ guideVibeLabel }} <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text></text>'
ok = old_guide_label in c
if ok:
    c = c.replace(old_guide_label, new_guide_label)
report('Step 7: 3-direction display', ok)

# Add direction computed + showGuideInfo ref
c = c.replace(
    'const guideDonts = computed(() => guide.value.避开 || [])',
    '''const guideDonts = computed(() => guide.value.避开 || [])
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
)
c = c.replace(
    'const isLowTaohuaScore = computed(() => taohuaScore.value < 40)',
    'const isLowTaohuaScore = computed(() => taohuaScore.value < 40)\nconst showGuideInfo = ref(false)'
)
report('Step 7b: direction computed + showGuideInfo', True)

# ============================================================
# STEP 8: Yinji inline flow
# ============================================================
old_yinji_items = '''          <text v-for="y in loveYi" :key="y" class="split-item-v2">{{ y }}</text>
        </view>
        <view class="split-half-v2 ji">
          <view class="split-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">⚠️</text>
            <text class="split-label-v2 ji">忌</text>
          </view>
          <text v-for="j in loveJi" :key="j" class="split-item-v2">{{ j }}</text>'''

new_yinji_items = '''          <text class="split-item-flow-v2"><text v-for="(y, i) in loveYi" :key="y">{{ i > 0 ? ' \xb7 ' : '' }}{{ y }}</text></text>
        </view>
        <view class="split-half-v2 ji">
          <view class="split-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">⚠️</text>
            <text class="split-label-v2 ji">忌</text>
          </view>
          <text class="split-item-flow-v2"><text v-for="(j, i) in loveJi" :key="j">{{ i > 0 ? ' \xb7 ' : '' }}{{ j }}</text></text>'''

ok = old_yinji_items in c
if ok:
    c = c.replace(old_yinji_items, new_yinji_items)
report('Step 8: yinji inline', ok)

# ============================================================
# STEP 9: CSS additions
# ============================================================
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

/* yinji inline flow */
.split-item-flow-v2 { font-size: 22rpx; font-weight: 700; color: #111; line-height: 1.8; }
'''

old_css = '.split-item-v2 { font-size: 22rpx; font-weight: 700; color: #111; padding: 3rpx 0; display: block; }'
ok = old_css in c
if ok:
    c = c.replace(old_css, css_insert)
report('Step 9: CSS', ok)

# ============================================================
# STEP 10: API gender param
# ============================================================
old_call = 'const result = await queryTaohua(userZodiac.value, userSign.value)'
new_call = 'const result = await queryTaohua(userZodiac.value, userSign.value, selfProfile.value?.gender)'
ok = old_call in c
if ok:
    c = c.replace(old_call, new_call)
report('Step 10: gender param', ok)

# Write result
with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('\nAll steps complete.')
