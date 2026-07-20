# PRD v4：首页左右滑动切换 Crush（研发就绪版）

> **修订**：2026-07-18
> **v4**：修复 Swiper 高度、后端统计契约、草稿变量名、函数占位符、后端查询量、头像预览冲突、Dots 触摸区、缓存键等全部问题。

---

## 一、滑动范围定义

```
┌──────────────────────────────┐
│  TODAY SIGNAL · Crush Master │
│  小明 · Friend Crush         │
│                              │
│        ( ⚓ )                │
│      雷达 + 4 信号节点       │  ← 560rpx
│     🌸信号  ⚖️平衡          │
│     🌺桃花  💞配对          │
│                              │
│   意向 78      风险 22       │
│   桃花运 72                  │  ← 指标行（意向分/风险分/桃花运）
│                              │
│  ┌────────────────────────┐  │
│  │ 把今天的心动，留下线索  │  │  ← 快速记录 dock
│  │ [记一条] [截图] [语音] │  │
│  └────────────────────────┘  │
│                              │
│     ●  ○  ○  2/3 · 小明      │  ← Dots（Swiper 外部、紧贴下方）
├──────────────────────────────┤
│  🐱 小咪蹲在这里说话...      │  ← Pet bar (fixed)
├──────────────────────────────┤
│  [首页]  [档案]  [往事]      │  ← 系统 TabBar
└──────────────────────────────┘

←── 虚线框 = Swiper，仅包裹 CampusSignalHome ──→
```

---

## 二、Swiper 高度方案（P0 修正）

**问题**：`height: auto` 不可用。uni-app Swiper 必须有显式高度。`min-height: 700rpx` 会裁掉底部 ~300rpx（总高约 1000rpx）。

**方案**：`uni.createSelectorQuery()` 测量后写入。

```typescript
// index.vue script
const swiperHeight = ref('1000rpx')  // 默认值，普通字体≈1000rpx

function measureSwiperHeight() {
  const query = uni.createSelectorQuery()
  query.select('.campus-signal').boundingClientRect((rect: any) => {
    if (rect?.height) {
      swiperHeight.value = Math.ceil(rect.height) + 'px'
      // 大字体模式会更高（约 1200rpx），测量值自动覆盖
    }
  }).exec()
}
```

测量时机：
1. `loadData()` 完成后（`dataReady.value = true` 之后）调用
2. `fontSizeMode` 变化时重新测量

默认值兜底说明：
- 真机未测量到前用 1000rpx 保证基本可用
- 测量到后自动修正为精确值
- 大字体模式组件偏高，测量值自动适配

```html
<swiper :style="{ height: swiperHeight }" ...>
```

### CampusSignalHome 内部 `overflow: hidden` 冲突

组件 `.campus-signal { overflow: hidden }`（第 252 行）会裁掉超出高度的内容。此 `overflow` 是组件自身的样式防御，防止花瓣动画溢出。

**不改组件**。Swiper 高度由测量值精确匹配组件高度，不存在裁切问题。

---

## 三、后端：预计算统计契约（P0 修正）

**问题**：
- `getCaseListData()` 只取最近 8 条 timeline，不按月份筛选
- 本月 20 条记录 → 只统计 8 条，天平失真
- 最近 8 条跨月 → 上月记录混入本月统计
- 每个非 detail case 调一次 `getCaseListData()` = 4 次 DB 查询/case，6+ crush 查询量失控

**方案**：新增模式内部函数 `getHomeData()`，一次批量查询 + 预计算统计。

```javascript
// cloudfunctions/getCases/index.js

async function getHomeData(cases, detailCaseId) {
  const caseIds = cases.map(c => c._id).filter(Boolean)
  const detailId = caseIds.includes(detailCaseId) ? detailCaseId : caseIds[0]
  const nonDetailIds = caseIds.filter(id => id !== detailId)

  // 1. detail case → 完整 dashboard（不变）
  const detailDashboard = await getCaseDashboardData(detailId,
    cases.find(c => c._id === detailId)?.latestResultId)

  // 2. 所有 case 的本月 timeline 统计（一次批量查询）
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartTime = monthStart.getTime()

  const monthTimelineRes = await db.collection('timeline_records')
    .where({
      caseId: db.command.in(caseIds),
      occurrenceAt: db.command.gte(monthStart)
    })
    .orderBy('occurrenceAt', 'desc')
    .limit(1000)  // 所有 case 本月合计上限
    .get()

  // 3. 所有 case 的最近 2 次评估（一次批量查询）
  const assessmentsRes = await db.collection('assessments')
    .where({ caseId: db.command.in(caseIds) })
    .orderBy('createdAt', 'desc')
    .limit(caseIds.length * 3)  // 每个 case 至少拿到 2 条
    .get()

  // 4. 按 caseId 分组计算
  const timelineByCase = {}
  const assessmentsByCase = {}
  for (const r of (monthTimelineRes.data || [])) {
    (timelineByCase[r.caseId] = timelineByCase[r.caseId] || []).push(r)
  }
  for (const a of (assessmentsRes.data || [])) {
    (assessmentsByCase[a.caseId] = assessmentsByCase[a.caseId] || []).push(a)
  }

  // 5. 组装结果
  const result = {}
  for (const c of cases) {
    const id = c._id
    if (id === detailId) {
      result[id] = detailDashboard  // 完整详情
    } else {
      const monthRecords = timelineByCase[id] || []
      const assessments = (assessmentsByCase[id] || []).slice(0, 2)
      const latestAssessment = c.latestResultId
        ? (assessmentsByCase[id] || []).find(a => a._id === c.latestResultId) || assessments[0] || null
        : assessments[0] || null
      result[id] = {
        assessments,
        timeline: monthRecords,
        timelineCount: monthRecords.length,
        latestResult: latestAssessment,
        // 预计算当月统计，前端直接使用
        thisMonthStats: buildTimelineStats(monthRecords),
      }
    }
  }
  return result
}
```

**前端配套修改**（index.vue）：

```typescript
// 后端返回 thisMonthStats，不再在前端筛选计算
function getTimelineStats(c: any): any {
  return c?.thisMonthStats || buildTimelineStats([])
  // 优先用后端预计算值，fallback 空统计
}
```

**查询量对比**：

| | 旧方案 | 新方案 |
|---|---|---|
| detail case | 3 次 | 3 次 |
| 每个非 detail case | 4 次 | 0 次（含在批量查询中） |
| 合计（5 crush） | 3 + 4×4 = 19 次 | 3 + 2 = **5 次** |

**缓存键升级**：后端数据结构变化 → `homeCasesCache:v2`

```typescript
// index.vue，替换所有 homeCasesCache:v1 → homeCasesCache:v2
function readHomeCasesCache(uid: string) { /* key → homeCasesCache:v2 */ }
function writeHomeCasesCache(uid: string, list: any[]) { /* key → homeCasesCache:v2 */ }
```

---

## 四、完整函数实现（P1 修正：不再有占位符）

### 4.1 Helper 函数（6 个）

```typescript
// ── 以下函数接受单个 case 对象，用于 swiper-item 模板绑定 ──

import { buildTimelineStats, mapEventSignal, compareAssessments } from '@/utils/insights'

function getProfileItems(c: any): string[] {
  const p = c?.profile
  if (!p) return []
  const items: string[] = []
  if (p.age) items.push(`${p.age} 岁`)
  if (p.gender) items.push(p.gender)
  if (p.zodiac) items.push(`属${p.zodiac}`)
  if (p.constellation) items.push(p.constellation)
  if (p.occupation) items.push(p.occupation)
  return items
}

function getHeroTypeLabel(c: any): string {
  const rt = String(c?.profile?.relationType || '').trim()
  if (rt === 'close_friend') return 'Friend Crush'
  if (rt === 'romantic') return 'Crush'
  return 'Crush 档案'
}

function getTimelineStats(c: any): any {
  // 使用后端预计算的 thisMonthStats
  return c?.thisMonthStats || buildTimelineStats([])
}

function getQuickSignal(c: any): any {
  if (!c?.latestResult) return null
  const insight = c.latestResult.eventInsight
  const assessments = c.assessments || []
  const trend = assessments.length > 1
    ? compareAssessments(assessments[assessments.length - 2], c.latestResult)
    : null
  if (!insight && !trend) return null
  return mapEventSignal(insight, trend)
}

function getBalanceCallout(c: any): string {
  const s = getTimelineStats(c)
  const t = s?.targetInitiatedCount || 0
  const self = s?.selfInitiatedCount || 0
  if (t + self === 0) return '暂无数据'
  if (t > self) return 'TA更主动'
  if (self > t) return '你更主动'
  return '双方平衡'
}
```

### 4.2 currentCrushIndex + 校正

```typescript
const currentCrushIndex = computed(() => {
  if (!activeCaseId.value || cases.value.length === 0) return 0
  const idx = cases.value.findIndex(
    (c: any) => (c.caseId || c._id) === activeCaseId.value
  )
  // 索引校正：列表变更后 activeCaseId 可能不在数组中
  // applyCasesList() 已将 activeCaseId fallback 到第一个，此处兜底
  return idx >= 0 ? idx : 0
})
```

### 4.3 onSwiperChange

```typescript
function onSwiperChange(e: any) {
  const newIndex = e.detail.current
  const target = cases.value[newIndex]
  if (!target?.caseId || target.caseId === activeCaseId.value) return

  setActiveCaseId(target.caseId)
  activeCaseId.value = target.caseId
  bumpDataVersion()
  closeAllSheets()
}
```

### 4.4 弹窗关闭 + 草稿保护

```typescript
// ── 草稿检测：使用 index.vue 真实变量名 ──

// 快速记录草稿检测
const hasQuickDraft = computed(() =>
  !!quickDesc.value ||
  !!quickChatSelfName.value ||
  !!quickChatTargetName.value ||
  quickAttachments.value.length > 0 ||
  recording.value
)

// 需要禁用 Swiper 的场景
const swipeDisabled = computed(() =>
  quickSheetVisible.value ||
  analysisSheetVisible.value ||
  balanceSheetVisible.value ||
  guidanceSheetVisible.value ||
  showFullAssessment.value ||
  showQuickCreate.value ||
  showSpeakSheet.value ||
  hasQuickDraft.value  // 面板关了但草稿还在
)

function closeAllSheets() {
  quickSheetVisible.value = false
  analysisSheetVisible.value = false
  balanceSheetVisible.value = false
  guidanceSheetVisible.value = false
  showSpeakSheet.value = false
  // 注意：不关闭 showFullAssessment / showQuickCreate（用户可能在填表单）
  // 这两个会通过 swipeDisabled 阻止滑动
}
```

### 4.5 Dots 点击

```typescript
function onDotClick(index: number) {
  if (index === currentCrushIndex.value || swipeDisabled.value) return
  const target = cases.value[index]
  if (!target?.caseId) return
  setActiveCaseId(target.caseId)
  activeCaseId.value = target.caseId
  bumpDataVersion()
  closeAllSheets()
}
```

---

## 五、CampusSignalHome 头像预览冲突（P1 修正）

**问题**：`showPhotoPreview` 是 CampusSignalHome 内部状态（第 197 行）。头像放大全屏时，用户横滑可能穿透到 Swiper，触发 crush 切换。

**方案**：给 `.cs-photo-overlay` 加 `@touchmove.stop.prevent`。**1 行改动，属于 bug 修复**——全屏遮罩层不应让触摸事件穿透。

```html
<!-- CampusSignalHome.vue 第 103 行 -->
<view v-if="showPhotoPreview"
  class="cs-photo-overlay"
  @click="showPhotoPreview = false"
  @touchmove.stop.prevent="() => {}"
>
```

这是 CampusSignalHome 的唯一改动。不影响其他使用方。

---

## 六、Dots 触摸区（P2 修正）

**问题**：16rpx + 8rpx padding = 32rpx ≈ 16px，远小于 44px 最小触摸目标。

**方案**：点击容器 88rpx，内部 16rpx 圆点。

```html
<view v-if="cases.length > 1" class="swipe-indicator">
  <!-- 6 个以上 crush：仅显示当前 ±2 + 省略号 -->
  <template v-if="cases.length <= 5">
    <view v-for="(c, i) in cases" :key="c.caseId || c._id"
      :class="['swipe-dot-hit', i === currentCrushIndex ? 'active' : '']"
      @click.stop="onDotClick(i)"
    >
      <view class="swipe-dot" />
    </view>
  </template>
  <template v-else>
    <!-- 前两个 -->
    <view v-if="currentCrushIndex > 2"
      class="swipe-dot-hit" @click.stop="onDotClick(0)">
      <view class="swipe-dot" />
    </view>
    <text v-if="currentCrushIndex > 2" class="swipe-dots-more">…</text>
    <!-- 当前 ±2 -->
    <view v-for="i in 5" :key="'dot-' + i"
      v-show="(currentCrushIndex + i - 3) >= 0 && (currentCrushIndex + i - 3) < cases.length"
      :class="['swipe-dot-hit', (currentCrushIndex + i - 3) === currentCrushIndex ? 'active' : '']"
      @click.stop="onDotClick(currentCrushIndex + i - 3)"
    >
      <view class="swipe-dot" />
    </view>
    <!-- 后两个 -->
    <text v-if="currentCrushIndex < cases.length - 3" class="swipe-dots-more">…</text>
    <view v-if="currentCrushIndex < cases.length - 3"
      class="swipe-dot-hit" @click.stop="onDotClick(cases.length - 1)">
      <view class="swipe-dot" />
    </view>
  </template>
  <text class="swipe-label">{{ currentCrushIndex + 1 }}/{{ cases.length }} · {{ cases[currentCrushIndex]?.name || '--' }}</text>
</view>
```

```scss
.swipe-indicator {
  display: flex; align-items: center; justify-content: center; gap: 6rpx;
  padding: 12rpx 0;
}
.swipe-dot-hit {
  width: 88rpx; height: 88rpx;  // 44px 触摸目标
  display: flex; align-items: center; justify-content: center;
}
.swipe-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%;
  border: 2rpx solid var(--border, #111);
  background: var(--surface, #fff);
  transition: all 0.2s ease;
}
.swipe-dot-hit.active .swipe-dot {
  background: var(--hero, #FF6B6B); border-color: var(--hero, #FF6B6B);
  transform: scale(1.3);
}
.swipe-dots-more {
  width: 48rpx; text-align: center;
  font-size: $fs-caption; color: var(--text-muted, #666);
}
.swipe-label {
  font-size: $fs-caption; color: var(--text-muted, #666);
  margin-left: 12rpx;
}
```

---

## 七、减少动态模式（P2）

```html
<swiper
  :duration="prefersReducedMotion ? 0 : 300"
  ...
>
```

```typescript
import { getPrefersReducedMotion } from '@/utils/theme'

const prefersReducedMotion = ref(false)
// onShow 中读取
prefersReducedMotion.value = getPrefersReducedMotion()
```

---

## 八、改动范围（终版）

| 文件 | 改动 | 估行 |
|------|------|------|
| `cloudfunctions/getCases/index.js` | 新增 `getHomeData()`，mode='home' 走新逻辑 | ~+70 |
| `src/components/CampusSignalHome.vue` | `.cs-photo-overlay` 加 `@touchmove.stop.prevent` | **+1 行** |
| `src/pages/index/index.vue` (script) | +helper 函数 ×6，+currentCrushIndex，+swipeDisabled，+swiperHeight，+measureSwiperHeight，+onSwiperChange，+onDotClick，+closeAllSheets | ~+120 |
| `src/pages/index/index.vue` (template) | CampusSignalHome 外层包 swiper；dots 指示器；v-else fallback 保持原结构 | ~+30 |
| `src/pages/index/index.vue` (style) | swiper min-height，dots 双主题 CSS | ~+35 |
| `src/pages/index/index.vue` | 缓存键 v1→v2（3 处替换） | ~3 |
| `cloudfunctions/getCases` | 部署 | 1 次 |

---

## 九、验证清单（22 项）

| # | 场景 | 预期 |
|---|------|------|
| 1 | 0 crush | 空态，无 swiper，无 dots |
| 2 | 1 crush | 正常首页，无 dots，无滑动 |
| 3 | 2 crush | 左右可循环滑，dots 正确高亮 |
| 4 | 3 crush | 循环滑，dots 可点击跳转 |
| 5 | 6 crush | dots 显示相邻 ±2 + "…"，点击首尾 dot 可跳转 |
| 6 | 快速连滑 5 次 | 不白屏、不闪烁、不卡在错误 crush |
| 7 | 慢网（3G） | 首页缓存渲染，滑动不发网络请求 |
| 8 | 断网 | 已缓存 crush 可滑动查看 |
| 9 | 切后验证数据 | 雷达/信号/意向/风险/桃花运/天平均为目标 crush 数据 |
| 10 | 切后开分析面板 | 显示目标 crush 分析 |
| 11 | 宠物摸头 | 正常，不触发滑动 |
| 12 | 快速记录面板打开 | swiper 禁用触摸 |
| 13 | 快速记录面板关闭但有草稿 | swiper 仍禁用（hasQuickDraft 检测） |
| 14 | 弹窗（分析/天平/指南）打开 | swiper 禁用触摸 |
| 15 | 头像放大全屏 | 横滑不穿透到 Swiper |
| 16 | 删除当前 crush | fallback 到第一个，dots 正确 |
| 17 | 丝绒日记 / 青春硬边 | dots 颜色跟随 token |
| 18 | 大字体模式 | CampusSignalHome 高度增加 → swiperHeight 自动适配 |
| 19 | 减少动态模式 | Swiper duration = 0（瞬间切换） |
| 20 | H5 | swiper 行为一致 |
| 21 | 微信真机 | 滑动 60fps，高度不裁切 |
| 22 | 首次多 crush | 「← 左右滑动切换 →」提示 3 秒渐隐 |

---

## 十、决策记录

| 决策 | 选择 | 依据 |
|------|------|------|
| 技术方案 | Swiper | 原生手势，更少代码 |
| 滑动范围 | 仅 CampusSignalHome（不改组件内部） | 改动面最小 |
| 快速记录 dock | 留在 Swiper 内 | 抽出需改组件 API，收益 < 代价 |
| Swiper 高度 | `createSelectorQuery()` 测量 | 唯一可靠的动态方案 |
| 非当前 crush 数据 | 后端批量查询 + 预计算 thisMonthStats | 一次 5 次 DB 查询，前端零计算 |
| 后端函数 | 新 `getHomeData()` 替代 inline 逻辑 | 批量查询，可维护 |
| 滑动时网络请求 | 不发 | 数据已全量预加载 |
| 缓存键 | v1 → v2 | 数据结构变化，防旧缓存污染 |
| 宠物 bar | 全局 fixed，Swper 外 | 不改现有结构 |
| 头像预览冲突 | `@touchmove.stop.prevent`，1 行 | 全屏遮罩不应穿透触摸 |
| Dots 触摸区 | 88rpx 容器 + 16rpx 圆点（44px 最小目标） | 无障碍合规 |
| 6+ crush dots | 当前 ±2 + 省略号 | 一行放得下，可定位 |
| 草稿保护 | `hasQuickDraft` computed（面板关了也检测） | 防旧草稿误提交到新 crush |
