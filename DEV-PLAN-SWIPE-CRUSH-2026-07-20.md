# 研发计划：首页左右滑动切换 Crush

**日期**：2026-07-20（**v6**：外部模型交接包 — 可直接交给 Kimi / DeepSeek）
**基于**：`PRD-SWIPE-CRUSH-2026-07-18.md` v4（**仅作背景，以本文 v6 为准**）
**分支**：`feature/swipe-crush`（从 `master` 切出）

> **给实施者的第一句话**：严格按本文 Step 1→6 顺序执行；禁止清单见附录 A.2；改完对照附录 A.6 三个卡点 + 第 9 节验证清单。

---

## 相对 PRD v4 的 intentional 偏离

| 项 | PRD v4 | 本文 v6 | 原因 |
|----|--------|---------|------|
| 统计 | 云端 `thisMonthStats` | 前端 `getTimelineStats()` | 防漂移 |
| assessments | 批量 limit | per-crush limit 2 | 每 crush 保证 2 条 |
| 月初 | 云端 filter | 前端本地时区 filter | 对齐档案页 |
| 滑动 bump | 有 | **无** | 防误 reload |
| circular | `length > 1` | **`length > 2`** | 2 项易 bug |
| 减少动态模式 | 有 | 裁减 | API 不存在 |

---

## 1. 现状（简要）

- `index.vue` L17–45：单个 `CampusSignalHome` 绑 `latestCase`
- `getCases/index.js` L118–136：`mode='home'` 只加载 `detailCaseId` 的 dashboard
- Sheet（L140–190）在 Swiper 外，绑 `latestCase` — **不用动结构，只改雷达区**
- `CampusSignalHome` 四节点已是 SVG，勿改图标层

---

## 2. 改动文件清单

| 文件 | 操作 |
|------|------|
| `cloudfunctions/getCases/index.js` | 新增 `getHomeData`，改 `mode='home'` 分支 |
| `src/components/CampusSignalHome.vue` | L103 overlay 加 `@touchmove.stop.prevent` |
| `src/pages/index/index.vue` | 模板 L16–45 替换；script 插入 helpers；改 computed；加 swiper 状态 |

**不要改**：pet bar（L212+）、quick 面板（L58+）、Sheet 组件、TabBar

---

## Step 1：后端 `getHomeData()`

**文件**：`cloudfunctions/getCases/index.js`

**插入位置**：在 `getCaseListData` 函数之后（约 L104 后）、`exports.main` 之前，粘贴 `getHomeData` 全文（见附录 B.1）。

**替换位置**：删除 L117–136 的 `detailCaseIds` + `getCaseDashboardData` 分支，改为：

```javascript
    const caseIds = cases.map((item) => item._id).filter(Boolean)

    if (mode === 'home') {
      const homeData = await getHomeData(cases, detailCaseId)
      cases.forEach((item) => {
        const data = homeData[item._id] || {}
        item.assessments = data.assessments || []
        item.timeline = data.timeline || []
        item.latestResult = data.latestResult || null
        item.recentTimeline = data.recentTimeline || []
      })
    } else if (mode === 'full') {
      const detailCaseIds = caseIds
      // ... 保持原有 full 逻辑（对每个 case getCaseDashboardData）
```

> 实施注意：原文件 `mode === 'full'` 走 `detailCaseIds = caseIds`，请把 full/list/else 三分支完整保留，**只替换 home 分支**。

**DB 索引**（部署前）：`timeline_records`: caseId+occurrenceAt；`assessments`: caseId+createdAt

---

## Step 2：CampusSignalHome 防穿透

**文件**：`src/components/CampusSignalHome.vue` **L103**

```html
<view v-if="showPhotoPreview" class="cs-photo-overlay"
  @click="showPhotoPreview = false"
  @touchmove.stop.prevent="() => {}"
>
```

---

## Step 3：index.vue 模板

**替换区间**：`src/pages/index/index.vue` **L16–L45**（含注释 `Campus Signal 雷达首页` 的整块 `CampusSignalHome`）

**替换为**：附录 B.2 全文（含 0 / 1 / 2+ crush 三分支 + dots + hint）

**约束**：
- 1 crush 与 N crush 使用**相同 props 表达式**（见 B.2 内 `crushSlideProps` 注释）
- `:circular="cases.length > 2"`
- hint 放在 radar 区上方、`block v-else` 内

---

## Step 4：index.vue Script

### 4.1 插入 helpers（在 `const latestCase = computed` **之前**，约 L453 前）

粘贴附录 B.3 全文。

### 4.2 删除并替换已有 computed

**删除** L462–491：
- `latestProfileItems` 内联实现
- `latestHeroTypeLabel` 内联实现
- `getTimelineRecordTs` + `thisMonthTimeline` + 旧 `latestTimelineStats`

**替换为**附录 B.4。

**保留但改写** L527–533 `latestTrend` → 改用 `getLatestTrend(latestCase.value)`（附录 B.3 已提供 `getLatestTrend`）。

### 4.3 新增 swiper 状态 + 事件（放在 `balanceCalloutForHome` 附近或 helpers 后）

粘贴附录 B.5。

### 4.4 缓存键

- L1308：`HOME_CASES_CACHE_KEY = 'homeCasesCache:v2'`
- `onLoad`（L1360）追加：`uni.removeStorageSync('homeCasesCache:v1')`

### 4.5 loadData 补充

在 `loadData` 的 `finally`（约 L1531）追加：

```typescript
    nextTick(() => measureSwiperHeight())
    if (cases.value.length > 1 && !uni.getStorageSync('swipeHintShown')) {
      showSwipeHint.value = true
      uni.setStorageSync('swipeHintShown', true)
      setTimeout(() => { showSwipeHint.value = false }, 3000)
    }
```

### 4.6 草稿提示（可选 P1，建议做）

在 `quickSheetVisible` 面板 topbar 下加一行（L61 后）：

```html
<text v-if="hasQuickDraft" class="qr-draft-hint">有未保存草稿，请先提交或清空后再切换 Crush</text>
```

---

## Step 5：index.vue CSS

在 `<style scoped lang="scss">` 末尾追加附录 B.6。

---

## Step 6：部署与构建

1. dev 环境部署 `getCases`（**禁止直接生产**）
2. 确认 DB 索引
3. `npm run build:mp-weixin`
4. 检查 `dist/build/mp-weixin/static/icons/taohua/flower.svg` 等存在

---

## 9. 验证清单（24 项）

| # | 场景 | 预期 |
|---|------|------|
| 1 | 0 crush | 空态，无 swiper，无 dots |
| 2 | 1 crush | 正常，无 dots；helper 与 2+ 相同 |
| 3 | 2 crush | 可滑，**不 circular** |
| 4 | 3 crush | circular + dots |
| 5 | 6 crush | dots ±2 + … |
| 6 | 连滑 5 次 | 不白屏 |
| 7 | 慢网 | 滑动无网络 |
| 8 | 断网 | 缓存可滑 |
| 9 | 切 crush | 雷达/分/信号正确 |
| 10 | 天平对账 | 首页 = 档案页 `thisMoStats` |
| 11 | 开 Sheet | 当前 active crush |
| 12 | 摸宠物 | 不触发滑 |
| 13 | quick 面板开 | 禁用滑 |
| 14 | 有草稿 | 禁用 + 提示 |
| 15 | 弹窗开 | 禁用 |
| 16 | 头像全屏 | 不穿透 |
| 17 | 删 crush | fallback |
| 18 | 双主题 | dots 跟 token |
| 19 | 大字体 | 高度适配 |
| 20 | 草稿点 dot | toast |
| 21 | 滑→切 tab→回 | **不 loadData** |
| 22 | H5 | 一致 |
| 23 | 真机 5 crush | 不裁切 |
| 24 | 首次 2+ crush | hint 3s |

---

## 10. 工作量

| 步骤 | 预估 |
|------|------|
| Step 1–6 | ~3h |
| 24 项验证 | ~2h |
| buffer | ~1h |
| **合计** | **6–7h** |

---

# 附录 A：外部模型交接包

## A.1 复制即用的 Prompt

```text
你是 uni-app 微信小程序开发者。仓库：workspace-girl-uniapp。

任务：按 DEV-PLAN-SWIPE-CRUSH-2026-07-20.md v6 实现首页 Swiper 切换 Crush。

规则：
1. 以 v6 为准，忽略 PRD v4 中的 bumpDataVersion、thisMonthStats、云端统计。
2. 按 Step 1→6 顺序；每步完成对照附录 A.6 卡点。
3. index.vue 只替换 L16–45 雷达区；勿动 pet bar、quick 面板、Sheet。
4. 所有「同 v6 附录 B.x」的代码必须从文档复制，禁止省略。
5. 改完运行 npm run build:mp-weixin，确保无 TS 报错。

交付：列出改动的文件 + 通过/未通过的验证项编号。
```

## A.2 禁止清单（违反即回滚）

1. ❌ `onSwiperChange` / `onDotClick` 里调用 `bumpDataVersion()`
2. ❌ 云端 `buildTimelineStats` / `thisMonthStats`
3. ❌ `circular` 在 `cases.length === 2` 时为 true
4. ❌ 1 crush 与 2+ crush 使用不同 props 数据源（禁止 1 crush 仍绑旧 computed 而 swiper 绑 helper）
5. ❌ 保留 `thisMonthTimeline` computed（必须删，统一 `getTimelineStats`）
6. ❌ 把 pet bar / quick 面板包进 swiper
7. ❌ 改用 `thisMonthTimeline` 字段名（后端字段是 `recentTimeline`）

## A.3 文件锚点表

| 文件 | 行号（约） | 操作 |
|------|-----------|------|
| `cloudfunctions/getCases/index.js` | L104 后 | 插入 `getHomeData` |
| `cloudfunctions/getCases/index.js` | L117–136 | 替换为 `mode==='home'` 新分支 |
| `src/components/CampusSignalHome.vue` | L103 | overlay 加 touchmove |
| `src/pages/index/index.vue` | **L16–45** | 整段替换为附录 B.2 |
| `src/pages/index/index.vue` | **L453 前** | 插入附录 B.3 |
| `src/pages/index/index.vue` | **L462–491** | 删旧 computed，换附录 B.4 |
| `src/pages/index/index.vue` | L527–533 | `latestTrend` 改用 `getLatestTrend` |
| `src/pages/index/index.vue` | helpers 后 | 插入附录 B.5 |
| `src/pages/index/index.vue` | L1308 | 缓存键 v2 |
| `src/pages/index/index.vue` | L1360 onLoad | 删 v1 缓存 |
| `src/pages/index/index.vue` | L1531 finally | measure + hint |
| `src/pages/index/index.vue` | style 末尾 | 附录 B.6 |

## A.4 CampusSignalHome Props 对照（模板用 kebab-case）

| Prop | 类型 | 来源 |
|------|------|------|
| `page-style` | Object | `themeVars` |
| `loading` | Boolean | 空态用 `loading`；有 case 用 `false` |
| `has-case` | Boolean | `cases.length > 0` |
| `case-name` | String | `c.name \|\| '--'` |
| `case-avatar` | String | `c.profile?.avatarUrl \|\| c.profile?.avatar \|\| ''` |
| `case-type-label` | String | `getHeroTypeLabel(c)` |
| `profile-items` | Array | `getProfileItems(c)` |
| `has-latest-result` | Boolean | `!!c.latestResult` |
| `intent-score` | Number/String | `c.latestResult?.intentScore ?? '暂无'` |
| `risk-score` | Number/String | `c.latestResult?.consistencyRiskScore ?? '暂无'` |
| `taohua-score` | Number/String | `taohuaTeaserData?.score ?? '--'` |
| `latest-signal` | Object | `getQuickSignal(c)` |
| `interaction-balance` | Object | `getTimelineStats(c)` |
| `taohua-teaser-data` | Object | `taohuaTeaserData`（全局，非 per-crush） |
| `guidance-text` | String | `taohuaTeaserData?.guidance \|\| ''` |
| `balance-callout` | String | `getBalanceCallout(c)` |
| `pet-name` | String | `selectedPet.displayName` |
| `has-self-profile` | Boolean | `hasUsableSelfProfile(selfProfile)` |
| `font-size-mode` | String | `fontSizeMode` |

## A.5 Events 对照（每个 CampusSignalHome 都要绑）

```html
@open-case-detail="goCaseDetail(c.caseId || c._id)"
@open-latest-signal="openAnalysisSheet"
@open-interaction-balance="openBalanceSheet"
@open-taohua="goTaohua"
@open-guidance="openGuidanceSheet"
@open-quick-record="onQuickRecordAction"
@start-assessment="showFullAssessment = true"
@quick-create="showQuickCreate = true"
```

## A.6 三个人工卡点（必过再合并）

| 卡点 | 怎么测 | 通过标准 |
|------|--------|----------|
| **C1 后端** | dev 部署后，2 crush 账号调 `getCases(mode:'home')` | 两个 case 都有 `recentTimeline` 数组 + `latestResult` |
| **C2 前端一致** | 1 crush 与 3 crush 账号各看首页 | 意向/风险/天平数据来源都是 helper，非双轨 |
| **C3 不 reload** | 滑 crush → 切档案 tab → 回首页 | 网络面板无新 `getCases` 请求；验证 #21 |

---

# 附录 B：完整代码（禁止省略）

## B.1 `getHomeData` 全文

```javascript
async function getHomeData(cases, detailCaseId) {
  if (!cases || cases.length === 0) return {}

  const caseIds = cases.map(c => c._id).filter(Boolean)
  const detailId = caseIds.includes(detailCaseId) ? detailCaseId : caseIds[0]
  const nonDetailCases = cases.filter(c => c._id !== detailId)

  const detailDashboard = await getCaseDashboardData(detailId,
    cases.find(c => c._id === detailId)?.latestResultId)

  const lookbackStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)

  const monthTimelineRes = await db.collection('timeline_records')
    .where({
      caseId: db.command.in(caseIds),
      occurrenceAt: db.command.gte(lookbackStart)
    })
    .orderBy('occurrenceAt', 'desc')
    .limit(1000)
    .get()

  const assessmentsByCase = {}
  if (nonDetailCases.length > 0) {
    const entries = await Promise.all(
      nonDetailCases.map(async c => {
        const res = await db.collection('assessments')
          .where({ caseId: c._id })
          .orderBy('createdAt', 'desc')
          .limit(2)
          .get()
        return [c._id, res.data || []]
      })
    )
    for (const [id, list] of entries) {
      assessmentsByCase[id] = list
    }
  }

  const timelineByCase = {}
  for (const r of (monthTimelineRes.data || [])) {
    (timelineByCase[r.caseId] = timelineByCase[r.caseId] || []).push(r)
  }

  function sortAsc(list) {
    return (list || []).sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
  }

  const result = {}
  for (const c of cases) {
    const id = c._id
    const recentTimeline = timelineByCase[id] || []
    if (id === detailId) {
      result[id] = { ...detailDashboard, recentTimeline }
    } else {
      const assessments = sortAsc(assessmentsByCase[id] || [])
      const latestAssessment = c.latestResultId
        ? assessments.find(a => a._id === c.latestResultId) || assessments[assessments.length - 1] || null
        : assessments[assessments.length - 1] || null
      result[id] = { assessments, latestResult: latestAssessment, recentTimeline }
    }
  }
  return result
}
```

## B.2 模板替换全文（替换 index.vue L16–45）

```html
        <!-- 首次多 crush 滑动提示 -->
        <view v-if="showSwipeHint" class="swipe-hint">
          <text class="swipe-hint-text">← 左右滑动切换 →</text>
        </view>

        <!-- Campus Signal 雷达首页 -->
        <CampusSignalHome
          v-if="cases.length === 0"
          :page-style="themeVars"
          :loading="loading"
          :has-case="false"
          case-name="--"
          case-avatar=""
          case-type-label="Crush"
          :profile-items="[]"
          :has-latest-result="false"
          intent-score="暂无"
          risk-score="暂无"
          taohua-score="--"
          :latest-signal="null"
          :interaction-balance="null"
          :taohua-teaser-data="taohuaTeaserData"
          guidance-text=""
          balance-callout=""
          :pet-name="selectedPet.displayName"
          :has-self-profile="hasUsableSelfProfile(selfProfile)"
          :font-size-mode="fontSizeMode"
          @start-assessment="showFullAssessment = true"
          @quick-create="showQuickCreate = true"
        />

        <view v-else-if="cases.length === 1" id="crush-slide-0" class="crush-slide-measure">
          <CampusSignalHome
            :page-style="themeVars"
            :loading="false"
            :has-case="true"
            :case-name="cases[0].name || '--'"
            :case-avatar="cases[0].profile?.avatarUrl || cases[0].profile?.avatar || ''"
            :case-type-label="getHeroTypeLabel(cases[0])"
            :profile-items="getProfileItems(cases[0])"
            :has-latest-result="!!cases[0].latestResult"
            :intent-score="cases[0].latestResult?.intentScore ?? '暂无'"
            :risk-score="cases[0].latestResult?.consistencyRiskScore ?? '暂无'"
            :taohua-score="taohuaTeaserData?.score ?? '--'"
            :latest-signal="getQuickSignal(cases[0])"
            :interaction-balance="getTimelineStats(cases[0])"
            :taohua-teaser-data="taohuaTeaserData"
            :guidance-text="taohuaTeaserData?.guidance || ''"
            :balance-callout="getBalanceCallout(cases[0])"
            :pet-name="selectedPet.displayName"
            :has-self-profile="hasUsableSelfProfile(selfProfile)"
            :font-size-mode="fontSizeMode"
            @open-case-detail="goCaseDetail(cases[0].caseId || cases[0]._id)"
            @open-latest-signal="openAnalysisSheet"
            @open-interaction-balance="openBalanceSheet"
            @open-taohua="goTaohua"
            @open-guidance="openGuidanceSheet"
            @open-quick-record="onQuickRecordAction"
            @start-assessment="showFullAssessment = true"
            @quick-create="showQuickCreate = true"
          />
        </view>

        <template v-else>
          <swiper
            :style="{ height: swiperHeight }"
            :current="currentCrushIndex"
            :circular="cases.length > 2"
            :duration="300"
            :disable-touch="swipeDisabled"
            @change="onSwiperChange"
          >
            <swiper-item v-for="(c, i) in cases" :key="c.caseId || c._id">
              <view :id="'crush-slide-' + i" class="crush-slide-measure">
                <CampusSignalHome
                  :class="{ 'crush-slide-paused': i !== currentCrushIndex }"
                  :page-style="themeVars"
                  :loading="false"
                  :has-case="true"
                  :case-name="c.name || '--'"
                  :case-avatar="c.profile?.avatarUrl || c.profile?.avatar || ''"
                  :case-type-label="getHeroTypeLabel(c)"
                  :profile-items="getProfileItems(c)"
                  :has-latest-result="!!c.latestResult"
                  :intent-score="c.latestResult?.intentScore ?? '暂无'"
                  :risk-score="c.latestResult?.consistencyRiskScore ?? '暂无'"
                  :taohua-score="taohuaTeaserData?.score ?? '--'"
                  :latest-signal="getQuickSignal(c)"
                  :interaction-balance="getTimelineStats(c)"
                  :taohua-teaser-data="taohuaTeaserData"
                  :guidance-text="taohuaTeaserData?.guidance || ''"
                  :balance-callout="getBalanceCallout(c)"
                  :pet-name="selectedPet.displayName"
                  :has-self-profile="hasUsableSelfProfile(selfProfile)"
                  :font-size-mode="fontSizeMode"
                  @open-case-detail="goCaseDetail(c.caseId || c._id)"
                  @open-latest-signal="openAnalysisSheet"
                  @open-interaction-balance="openBalanceSheet"
                  @open-taohua="goTaohua"
                  @open-guidance="openGuidanceSheet"
                  @open-quick-record="onQuickRecordAction"
                  @start-assessment="showFullAssessment = true"
                  @quick-create="showQuickCreate = true"
                />
              </view>
            </swiper-item>
          </swiper>

          <view class="swipe-indicator" aria-label="Crush 滑动指示器">
            <view class="swipe-dots-row">
              <template v-if="cases.length <= 5">
                <view
                  v-for="(c, i) in cases"
                  :key="c.caseId || c._id"
                  :class="['swipe-dot-hit', i === currentCrushIndex ? 'active' : '']"
                  :aria-label="'切换到 ' + (c.name || 'Crush')"
                  @click.stop="onDotClick(i)"
                >
                  <view class="swipe-dot" />
                </view>
              </template>
              <template v-else>
                <view v-if="currentCrushIndex > 2" class="swipe-dot-hit" @click.stop="onDotClick(0)">
                  <view class="swipe-dot" />
                </view>
                <text v-if="currentCrushIndex > 2" class="swipe-dots-more">…</text>
                <view
                  v-for="i in 5"
                  :key="'dot-' + i"
                  v-show="(currentCrushIndex + i - 3) >= 0 && (currentCrushIndex + i - 3) < cases.length"
                  :class="['swipe-dot-hit', (currentCrushIndex + i - 3) === currentCrushIndex ? 'active' : '']"
                  @click.stop="onDotClick(currentCrushIndex + i - 3)"
                >
                  <view class="swipe-dot" />
                </view>
                <text v-if="currentCrushIndex < cases.length - 3" class="swipe-dots-more">…</text>
                <view
                  v-if="currentCrushIndex < cases.length - 3"
                  class="swipe-dot-hit"
                  @click.stop="onDotClick(cases.length - 1)"
                >
                  <view class="swipe-dot" />
                </view>
              </template>
            </view>
            <text class="swipe-label">{{ cases[currentCrushIndex]?.name || '--' }} · {{ currentCrushIndex + 1 }}/{{ cases.length }}</text>
          </view>
        </template>
```

## B.3 Helpers 全文（插入 L453 前）

```typescript
// ── Crush 滑动：单 case 数据源 helpers（swiper + Sheet 共用）──

function getTimelineRecordTs(r: any): number {
  return new Date(r?.occurrenceAt || r?.createdAt || r?.date || 0).getTime()
}

function filterUserTimelineRecords(records: any[]): any[] {
  return (records || []).filter((r) => {
    const type = String(r?.type || '')
    return type !== 'assessment' && type !== 'trend' && type !== 'system'
      && type !== 'weekly_review' && type !== 'monthly_review'
  })
}

function getThisMonthRecords(c: any): any[] {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const source = c?.recentTimeline?.length
    ? c.recentTimeline
    : (Array.isArray(c?.timeline) ? c.timeline : [])
  return filterUserTimelineRecords(source).filter((r) => getTimelineRecordTs(r) >= monthStart)
}

function getTimelineStats(c: any) {
  return buildTimelineStats(getThisMonthRecords(c))
}

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
  const relationType = String(c?.profile?.relationType || '').trim()
  if (relationType === 'close_friend') return 'Friend Crush'
  if (relationType === 'romantic') return 'Crush'
  return 'Crush 档案'
}

function getLatestTrend(c: any) {
  if (!c?.latestResult) return null
  const sorted = [...(c.assessments || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  if (!sorted.length) return null
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null
  return compareAssessments(previous, c.latestResult)
}

function getQuickSignal(c: any) {
  if (!c?.latestResult) return null
  const insight = c.latestResult.eventInsight
  const trend = getLatestTrend(c)
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

## B.4 替换后的 computed（替换 L462–491；并改 L527 latestTrend）

```typescript
const latestProfileItems = computed(() => getProfileItems(latestCase.value))
const latestHeroTypeLabel = computed(() => getHeroTypeLabel(latestCase.value))
const latestTimelineStats = computed(() => getTimelineStats(latestCase.value))
const balanceCalloutForHome = computed(() => getBalanceCallout(latestCase.value))
const quickFeedbackSignal = computed(() => getQuickSignal(latestCase.value))

// latestTrend — 替换原 L527–533
const latestTrend = computed(() => getLatestTrend(latestCase.value))
```

## B.5 Swiper 状态 + 事件全文

```typescript
const swiperHeight = ref('1200rpx')
const currentCrushIndex = ref(0)
const showSwipeHint = ref(false)

function measureSwiperHeight() {
  if (cases.value.length === 0) return
  const id = `#crush-slide-${currentCrushIndex.value}`
  uni.createSelectorQuery()
    .select(id)
    .boundingClientRect((rect: any) => {
      if (rect?.height) {
        swiperHeight.value = Math.ceil(rect.height + uni.upx2px(24)) + 'px'
      }
    }).exec()
}

watch(activeCaseId, (id) => {
  if (!id || cases.value.length === 0) {
    currentCrushIndex.value = 0
    return
  }
  const idx = cases.value.findIndex(c => (c.caseId || c._id) === id)
  if (idx >= 0) currentCrushIndex.value = idx
  nextTick(() => measureSwiperHeight())
})

watch([() => cases.value.length, fontSizeMode], () => {
  nextTick(() => measureSwiperHeight())
})

const hasQuickDraft = computed(() =>
  !!quickDesc.value
  || !!quickChatSelfName.value
  || !!quickChatTargetName.value
  || quickAttachments.value.length > 0
  || recording.value
)

const swipeDisabled = computed(() =>
  quickSheetVisible.value
  || analysisSheetVisible.value
  || balanceSheetVisible.value
  || guidanceSheetVisible.value
  || showFullAssessment.value
  || showQuickCreate.value
  || showSpeakSheet.value
  || hasQuickDraft.value
)

function onSwiperChange(e: any) {
  const newIndex = e.detail.current
  currentCrushIndex.value = newIndex
  const target = cases.value[newIndex]
  const nextId = target?.caseId || target?._id
  if (!nextId || nextId === activeCaseId.value) return
  setActiveCaseId(nextId)
  activeCaseId.value = nextId
  closeAllSheets()
}

function onDotClick(index: number) {
  if (swipeDisabled.value) {
    if (hasQuickDraft.value) onSwipeAttemptWithDraft()
    return
  }
  if (index === currentCrushIndex.value) return
  const target = cases.value[index]
  const nextId = target?.caseId || target?._id
  if (!nextId) return
  currentCrushIndex.value = index
  setActiveCaseId(nextId)
  activeCaseId.value = nextId
  closeAllSheets()
}

function onSwipeAttemptWithDraft() {
  uni.showToast({ title: '请先完成或清空草稿', icon: 'none', duration: 2000 })
}

function closeAllSheets() {
  quickSheetVisible.value = false
  analysisSheetVisible.value = false
  balanceSheetVisible.value = false
  guidanceSheetVisible.value = false
  showSpeakSheet.value = false
}
```

## B.6 CSS 全文（追加到 style 末尾）

```scss
.v2-mode swiper { width: 100%; }

.crush-slide-paused :deep(.cs-beam),
.crush-slide-paused :deep(.cs-halo),
.crush-slide-paused :deep(.cs-petal),
.crush-slide-paused :deep(.cs-node) {
  animation-play-state: paused;
}

.swipe-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 0;
}
.swipe-dots-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}
.swipe-dot-hit {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.swipe-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  border: 2rpx solid var(--border, #111);
  background: var(--surface, #fff);
  transition: all 0.2s ease;
}
.swipe-dot-hit.active .swipe-dot {
  background: var(--hero, #FF6B6B);
  border-color: var(--hero, #FF6B6B);
  transform: scale(1.3);
}
.swipe-dots-more {
  width: 48rpx;
  text-align: center;
  font-size: $fs-caption;
  color: var(--text-muted, #666);
}
.swipe-label {
  font-size: $fs-caption;
  color: var(--text-muted, #666);
}

.swipe-hint {
  position: fixed;
  top: 200rpx;
  left: 50%;
  z-index: 200;
  background: var(--accent, #FFD93D);
  color: var(--ink, #111);
  border: 3rpx solid var(--ink, #111);
  box-shadow: 6rpx 6rpx 0 var(--ink, #111);
  padding: 16rpx 32rpx;
  transform: translateX(-50%) rotate(-0.5deg);
  animation: swipe-hint-fade 3s ease-out forwards;
}
.swipe-hint-text {
  font-size: $fs-body;
  font-weight: $fw-heading;
}
@keyframes swipe-hint-fade {
  0% { opacity: 0; transform: translateX(-50%) rotate(-0.5deg) translateY(10rpx); }
  15% { opacity: 1; transform: translateX(-50%) rotate(-0.5deg) translateY(0); }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

.qr-draft-hint {
  display: block;
  padding: 8rpx 24rpx;
  font-size: $fs-caption;
  color: var(--text-muted, #666);
}
```

---

## 风险点（精简）

1. Swiper 高度：`1200rpx` 兜底 + `#crush-slide-{i}` + watch
2. 统计：`getTimelineStats` 单源；验证 #10 对账
3. 滑动不 bump；写记录等处保留原 `bumpDataVersion`
4. 2 crush 不开 circular
5. 多实例：off-screen `animation-play-state: paused`
