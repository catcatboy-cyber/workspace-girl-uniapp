# 研发计划：统一底部弹窗风格（终版 v4）

**日期**：2026-07-15
**分支**：待建 `feature/unified-bottom-sheets`

---

## v3 → v4 审计修正

| 发现 | 修正 |
|------|------|
| 3个组件各复制一份CSS是技术债 | 标注「后续可抽公共 mixin」，本次先复制 |
| AnalysisSheet 少兜底文案态 | 加 `actionMissing` prop + 状态D-2 |
| AnalysisSheet 错误态颜色不统一 | 改为灰色 neutral 卡，和 AGS 三卡中性对齐 |
| BalanceSheet「回应」=「兑现」数据相同 | 保持原样显示4条，不改数据层逻辑 |
| 新组件的 slide-up 动画名需要不同 | 各自命名前缀 `as-` / `bs-` 避免冲突 |
| 确认旧依赖不回退 | `buildDivergingBars` 在 case-detail 仍使用，不受影响 |

---

## 目标

将「本次分析」「互动天平」改为与「行动指南」一致的底部滑入 + 渐变卡片风格。
三个弹窗共用同一套 mask / sheet / topbar 框架。

## 共享框架（3个组件一模一样）

```css
/* mask — 半透明黑底，底部对齐 */
z-index: 50
background: rgba(0,0,0,0.45)
display: flex; align-items: flex-end

/* sheet — 白底圆角，硬阴影顶部黑边 */
max-height: 88vh
border-radius: 24rpx 24rpx 0 0
border-top: 3rpx solid var(--border, #111)
box-shadow: var(--shadow-hero, 0 -8rpx 0 #111)
padding-bottom: calc(140rpx + env(safe-area-inset-bottom))
animation: slide-up 0.3s ease-out

/* topbar — 左标题 右关闭 */
font-size: 38rpx  font-weight: 900
关闭按钮: 56×56rpx 圆形 2rpx 边线
```

> ⚠️ 后续可抽取公共 SCSS mixin，避免三处重复。本次先复制。

## 确认：不改的部分

| 组件/页面 | 操作 |
|-----------|------|
| 快捷记录面板 | 不动（共用 qr-sheet 样式） |
| qr-sheet CSS | 不动 |
| case-detail.vue 的 divergingBars | 不动 |
| ActionGuideSheet | 参考标准，不动 |

---

## Step 1：新建 AnalysisSheet.vue

### Props（合并后，4 个对象 + 4 个数组）

```ts
visible: boolean
aiState: { loading, pending, seconds, error, errorMsg }
scores: { intentScore, riskScore, intentBucket, riskBucket, intentDelta, riskDelta }
signal: { emoji, label }
meta: { questionLabel, rawDescription }
reasonBullets: string[]
actionSections: { label, text }[]
actionMissing: boolean     // ← v4 新增：AI 兜底文案模式
actionMissingText: string  // ← v4 新增：兜底文字
```

### 4 种状态

```
A) loading  → 居中大图标 + "AI 分析中，已用时 Xs"
B) pending  → 居中灰色提示 "AI 尚未开始"
C) error    → 灰色中性卡 + 错误说明文字
D) normal   → 完整卡片布局（见下）
D-2) normal 但 actionMissing  → 分数+原因正常显示，建议区显示兜底文案而非列表
```

### D 状态的卡片配色方案

| 卡片 | 渐变方向 | 基调色 |
|------|---------|--------|
| 意向分 | 160deg | mint 系 `#E0FFF0 → #C8F0E0` |
| 风险分 | 160deg | risk-soft 系 `#FFEEEC → #FFD8D4` |
| 原因 | 160deg | warm 系 `#FFFBEA → #FFF3D0`（偏黄白） |
| 小咪建议 | 160deg | accent-soft 系 `#FFF8E0 → #FFE8B0`（暖黄） |

### Emits

`close`

---

## Step 2：新建 BalanceSheet.vue

### Props

```ts
visible: boolean
bars: { label, you, ta, taClass }[]   // buildDivergingBars 输出
callout: string                       // buildBalanceCallout 输出
```

### 视觉

4 张独立渐变卡（`160deg mint系`），每条左右 flex 条形 + 中缝分隔。
当 `taClass === 'risk'` 时该卡改用 risk 系渐变。

底部结论文案 + `查看完整分析 →` 可点击链接。

### Emits

`close` / `openCaseDetail`

---

## Step 3：index.vue 清理

| 区域 | 操作 |
|------|------|
| 本次分析模板（~70行） | 替换为 `<AnalysisSheet ...>` |
| 互动天平模板（~20行） | 替换为 `<BalanceSheet ...>` |
| 快捷记录模板 | 不动 |
| qr-sheet CSS | 不动 |
| 新增 computed | `analysisAiState` `analysisScores` `analysisSignal` 三个 |

---

## 构建验证

```bash
npm run build:mp-weixin
cp -r static dist/build/mp-weixin/static
cp -r custom-tab-bar dist/build/mp-weixin/custom-tab-bar
npm run build:h5
```

---

## 影响范围

| 操作 | 文件 | 风险 |
|------|------|------|
| 新建 | `src/components/AnalysisSheet.vue` | 低 |
| 新建 | `src/components/BalanceSheet.vue` | 低 |
| 修改 | `src/pages/index/index.vue` | 中 |

---

## 工作量

| 步骤 | 预估 |
|------|------|
| Step 1 AnalysisSheet（4状态+4配色） | 55min |
| Step 2 BalanceSheet | 20min |
| Step 3 index.vue 清理 | 20min |
| 构建验证 | 10min |
| **合计** | **~1h45min** |
