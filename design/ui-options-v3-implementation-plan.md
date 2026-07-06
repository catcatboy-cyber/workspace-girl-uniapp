# UI V3 四套风格 · 实施方案（审计修正版）

**声明**：初版方案说"只改 2 个文件 150 行"是错误的。经过全项目审计，实际需要批量替换 ~500 处硬编码值。但 90% 是机械替换，可脚本自动化。以下是诚实评估。

---

## 一、审计结论

### 当前代码的硬编码问题

`src/` 目录下 30 个页面 + 11 个组件，存在大量编译时写死的值：

| 硬编码值 | 出现次数 | 替换为 |
|----------|---------|--------|
| `#111`（边框、文字、阴影） | ~300 | `var(--ink)` |
| `#fff`（卡片背景） | ~80 | `var(--card-bg)` |
| `#f9f9f9` / `#FFFBEB` / `#FFEEEC` / `#E0FFF0` | ~30 | `var(--accent-soft)` 等 |
| `border: 3rpx solid #111` | ~100 | `var(--bw) solid var(--ink)` |
| `box-shadow: Xrpx Xrpx 0 #111` | ~50 | `var(--shadow-card)` |
| `border-radius: 0` / `4rpx` / `8rpx` | ~30 | `var(--radius-sm)` |
| `border-left: 12rpx solid #FFD93D` 等语义色条 | ~15 | `var(--accent)` |
| `transform: rotate(-0.5deg)` | ~5 | `var(--hero-rotate)` |
| `font-family` 声明 | ~3 | `var(--font-ui)` |

### 90% 可脚本批量替换，10% 需人工判断

需要人工处理的场景：
- `src/components/AssessmentForm.vue`：整文件硬编码，需要逐行检查
- `src/components/TaohuaCompass.vue`：装饰性罗盘，不应跟随主题
- `src/components/TokenCoinOverlay.vue`：金币动画，不应跟随主题
- `src/pages/admin/`：完整独立色板，H5 专属，是否主题化待定
- 内联 `style="..."` 中的颜色值（~30 处）
- `linear-gradient` 硬编码颜色（~10 处）

---

## 二、实施策略

### Phase 1：批量脚本替换（1h）

写一个 Node.js 脚本 `scripts/migrate-to-css-vars.cjs`：

```javascript
const replacements = [
  // 颜色
  [/#111\b(?!\s*\/)/g, 'var(--ink)'],
  [/#fff\b/g, 'var(--card-bg)'],
  [/#f9f9f9\b/g, 'var(--card-soft)'],
  [/#FFFBEB\b/g, 'var(--accent-soft)'],
  [/#FFEEEC\b/g, 'var(--risk-soft)'],
  [/#E0FFF0\b/g, 'var(--mint-soft)'],
  [/#FFFDF5\b/g, 'var(--app-bg)'],
  [/#666\b/g, 'var(--text-muted)'],
  [/#999\b/g, 'var(--text-soft)'],

  // 语义色
  [/#FFD93D\b/g, 'var(--accent)'],
  [/#4ECDC4\b/g, 'var(--mint)'],
  [/#FF6B6B\b/g, 'var(--hero)'],
  [/#FF5252\b/g, 'var(--risk)'],

  // 边框
  [/border:\s*3rpx solid var\(--ink\)/g, 'border: var(--bw) solid var(--ink)'],
  [/border-radius:\s*0\b/g, 'border-radius: var(--radius-sm)'],
  [/border-radius:\s*3rpx\b/g, 'border-radius: var(--radius-sm)'],
  [/border-radius:\s*4rpx\b/g, 'border-radius: var(--radius-sm)'],
  [/border-radius:\s*6rpx\b/g, 'border-radius: var(--radius-md)'],
  [/border-radius:\s*8rpx\b/g, 'border-radius: var(--radius-md)'],
  [/border-radius:\s*12rpx\b/g, 'border-radius: var(--radius-md)'],
  [/border-radius:\s*16rpx\b/g, 'border-radius: var(--radius-lg)'],
  [/border-radius:\s*20rpx\b/g, 'border-radius: var(--radius-lg)'],

  // 阴影
  [/box-shadow:\s*6rpx 6rpx 0 var\(--ink\)/g, 'box-shadow: var(--shadow-card)'],
  [/box-shadow:\s*8rpx 8rpx 0 var\(--ink\)/g, 'box-shadow: var(--shadow-hero)'],

  // 旋转
  [/transform:\s*rotate\(-0\.5deg\)/g, 'transform: rotate(var(--hero-rotate))'],
]
// 遍历 src/pages/*.vue, src/components/*.vue
// 跳过 src/pages/admin/, TaohuaCompass, TokenCoinOverlay
```

### Phase 2：人工 diff 审查 + 修 edge case（2h）

逐文件 git diff 检查脚本替换结果：
- 修正误替换（如注释里的 #111 被换成 var）
- 修正语义错误（如背景色换成了边框色变量）
- 修正 admin 面板（保持独立色板或统一切换）
- 修正内联 `style="..."` 中的颜色
- 修正 gradient 中的颜色
- 修正装饰性组件（TaohuaCompass、TokenCoinOverlay）不参与主题

### Phase 3：campus-pop.scss 改造（1h）

把 SCSS 编译时变量改为 CSS 自定义属性 fallback：

```scss
// Before:
$c-ink: #111;
border: 3rpx solid $c-ink;

// After:
border: var(--bw, 3rpx) solid var(--ink, #111);
```

同时用 uni.scss 的 $fs-* 变量补全 SCSS 变量引用（AssessmentForm.vue 等文件没用 $fs-*）。

### Phase 4：theme.ts 加 4 套定义（1h）

在现有 `themeOptions` 数组后面追加 4 条记录，每条包含 25 个 CSS 变量。现有 3 套保持不动。

### Phase 5：全量回归（2h）

- `npm run build:mp-weixin` 零错误
- 微信开发者工具 5 个 tab 全量走查
- 默认主题（brutalist）与改动前视觉完全一致
- 切换到 4 套新主题后无布局崩溃

---

## 三、改动范围

| # | 文件 | 改动 | 方式 |
|---|------|------|------|
| 1 | `src/pages/*.vue`（28 个） | 硬编码值 → CSS 变量 | 脚本批量 |
| 2 | `src/components/*.vue`（11 个） | 硬编码值 → CSS 变量（跳过 3 个装饰组件） | 脚本 + 人工 |
| 3 | `src/styles/campus-pop.scss` | mixin 改用 var() | 人工 |
| 4 | `src/styles/uni.scss` | 补充 fallback 变量定义 | 人工 |
| 5 | `src/utils/theme.ts` | 新增 4 套主题定义 + theme class | 人工 |
| 6 | `src/App.vue` | 注入 `class="theme-xxx"` | 人工 |
| 7 | `scripts/migrate-to-css-vars.cjs` | **新建**：批量替换脚本 | 人工 |

**不参与主题化的文件**（跳过）：
- `src/pages/admin/**`（H5 专属，独立色板）
- `src/components/TaohuaCompass.vue`（装饰性罗盘）
- `src/components/TokenCoinOverlay.vue`（金币动画）

---

## 四、工作量评估（修正版）

| 阶段 | 内容 | 时间 |
|------|------|------|
| 1 | 写批量替换脚本 + 执行 | 1h |
| 2 | 人工 diff 审查 + 修 edge case | 2h |
| 3 | `campus-pop.scss` + `uni.scss` 改造 | 1h |
| 4 | `theme.ts` 加 4 套变量 + `App.vue` 注入 class | 1h |
| 5 | 构建 + 微信开发者工具全量回归（5 个 tab） | 2h |
| **合计** | | **~7h，1 天** |

改动 ~500 处（90% 脚本），人工改 ~5 个文件，不改业务逻辑。
