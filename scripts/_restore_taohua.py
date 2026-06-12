"""Restore all taohua.vue changes lost in git checkout."""

path = 'src/pages/taohua/taohua.vue'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# === 1. Template: Merge 去哪 + 做啥 into 今日约会指南 ===
old_two_blocks = '''      <!-- 去哪 -->
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

new_one_block = '''      <!-- 今日约会指南（方位+气场+活动合并） -->
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

if old_two_blocks in content:
    content = content.replace(old_two_blocks, new_one_block)
    print('1. Template: merged guide block')
else:
    print('1. Template: NOT FOUND')

# === 2. JS: Replace old computed with new guide computed ===
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

if old_computed in content:
    content = content.replace(old_computed, new_computed)
    print('2. JS: computed replaced')
else:
    print('2. JS: NOT FOUND - trying alternative match')
    # Try matching parts
    if 'dateAdviceText' in content:
        print('  dateAdviceText still in file')
    if 'guide = computed' in content:
        print('  guide already in file')

# === 3. Pass gender to queryTaohua call ===
old_call = 'const result = await queryTaohua(userZodiac.value, userSign.value)'
new_call = 'const result = await queryTaohua(userZodiac.value, userSign.value, selfProfile.value?.gender)'
if old_call in content:
    content = content.replace(old_call, new_call)
    print('3. API: gender passed')
else:
    print('3. API call: NOT FOUND or already done')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
