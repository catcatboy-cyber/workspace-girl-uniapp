# 工作总结 · 行动指南完善 + 弹窗风格统一

**日期**：2026-07-15
**分支**：`feature/campus-signal-home` → `feature/unified-bottom-sheets` → `master`

---

## 1. 行动指南 Bug 修复（9 个问题）

| # | 问题 | 修复 |
|---|------|------|
| 1 | 弹窗从顶部弹出 | 改为 `display:flex; align-items:flex-end` 底部滑入 |
| 2 | 罗盘指针方向不对 | 新增 DIR_ANGLE 方位→角度映射，3 指针动态旋转 |
| 3 | 红鸾爱心颠倒 | 爱心改为独立元素在罗盘中心，不随指针旋转 |
| 4 | 爱心方向仍不对（v2） | 改用 `::after` + CSS 变量 `--luan-deg` 反向旋转抵消 |
| 5 | 颜色圆圈不匹配文字 | 改为从 oneLiner 提取颜色词 + 中文→CSS 映射表（30+ 颜色） |
| 6 | 弹窗被 tabBar 遮挡 | `z-index: 900→50` + `padding-bottom: calc(140rpx + env(...))` |
| 7 | 三卡重叠遮挡 | 间距均等化（120rpx）+ stage 扩到 1040rpx |
| 8 | 首页空白过多（min-height） | 恢复 `min-height: 100vh`，真正原因在 padding/spacer |
| 9 | 互动天平数据不一致 | index.vue 改用 `buildTimelineStats` + 本月过滤，与 case-detail 一致 |

## 2. 字号字重规范化审计

按 8 档全局 Token（50/42/40/38/34/32/24/22rpx）审计两个组件：
- **CampusSignalHome**：12 处修正（36→38、48→50、18→22 等）
- **ActionGuideSheet**：14 处修正（14→22、60→50、30→32 等）
- 新增 `$fs-body-sm: 28rpx` 第 9 档 Token
- 卡片层级最终：标题 28/700 → 正文 24/400 → 附文 24/400

## 3. 首页空状态统一

- 删除旧的 `v-if="cases.length === 0"` 空状态模板（hero-block + taohua-teaser + onboard-options）
- 统一走 CampusSignalHome，空状态传 `has-case="false"`
- CampusSignalHome 新增 `fontSizeMode` prop + `.font-large` 18 处放大

## 4. 弹窗风格统一（新建 2 组件）

| 组件 | 行数 | 说明 |
|------|------|------|
| `AnalysisSheet.vue` | 172 行 | 本次分析弹窗：4 状态（loading/pending/error/normal）+ 意向/风险并排渐变卡 |
| `BalanceSheet.vue` | 76 行 | 互动天平弹窗：4 条 mint/risk 渐变卡 + 条形图 |

**统一要素**：mask/sheet/topbar 三套完全一致，`z-index:50`，主题变量 `var(--shadow-hard)` / `var(--border-width-strong)` 全覆盖。

## 5. Git 操作

```
feature/campus-signal-home: 9 commits
feature/unified-bottom-sheets: 2 commits
→ 合并到 master（Fast-forward）
```

## 6. 构建

- ✅ `npm run build:mp-weixin` 通过
- ✅ `npm run build:h5` 通过

---

## 7. 其他微调

- 节点提示溢出保护：`overflow:hidden; text-overflow:ellipsis`
- 缩短长文本：`暂无足够互动数据` → `暂无数据`
- 标题改名：`今天的关系信号图` → `今日心动雷达`
- worktree 隔离多分支开发流程建立
