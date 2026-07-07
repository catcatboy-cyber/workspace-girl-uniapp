# 全局 CSS 全量换肤开发计划

**日期**：2026-07-06  
**目标**：把 UI 风格切换从“逐页面改样式”升级为“主要改全局 CSS / 主题 token 即可切换”，尤其支持 V3 中结构差异更大的三套风格：Velvet Diary、Mint Glass、Neon Signal。Fuzzy Bold 与当前硬边 Campus Pop 路线高度接近，作为现有基线风格吸收，不再单独接入为新主题。

---

## 0. 2026-07-07 复核结论

当前已经可以进入“新增低风险浅色主题”的阶段，但不建议直接进入暗色赛博主题。

已确认：
- `src/utils/theme.ts` 已完成 `mergeStyleSheet()` 扩展、`campusHard` 硬边基线、`velvet` style sheet、`getThemeClass()` 和 `Velvet Diary` 接入。
- `token-usage`、`token-recharge` 已补齐 `getThemeStyle()`、`applyThemeChrome()` 和根节点 `:style="themeVars"`。
- 关键语义 token 已具备：`--placeholder`、`--hero-divider`、`--on-active-muted`、`--timeline-positive-gradient`、`--timeline-risk-gradient`、`--status-ai-bg`、`--status-ai-dot`、`--status-fallback-bg`、`--status-fallback-dot`。
- `npm.cmd run build:h5` 通过。
- `npm.cmd run build:mp-weixin` 通过。

当前判断：
- 可以新增 `Glacier Blue` / `Mint Glass` 这类浅色、低对比风险主题。实现应以 `theme.ts` token 配置为主，必要时只补少量全局样式。
- `Glacier Blue` 是下一套主题的最低风险选择；它可作为 `Mint Glass` 的正式低风险落地版，优先采用 V4 `Glacier Blue` 的清冷浅色、弱边框、轻阴影和数据感，不强依赖 `backdrop-filter`。
- `Neon Signal` / `Stardust Telegram` 属于暗色赛博系，仍需要等 P0 页面硬编码和暗色对比风险进一步收敛后再做。
- `Velvet Diary` 已完成主题变量接入，但仍需要继续做 P0 页面视觉抽查；这不阻塞新增一套浅色低风险主题，但阻塞暗色主题。

执行口径更新：
- 下一步进入 `Phase 4B-light`：新增 `glacier-blue` 或以 `mint-glass` 名义落地的 Glacier 风格浅色主题。
- `Phase 5B-light`：只对新浅色主题做 P0 增量抽查，发现穿帮再补丁。
- `Neon Signal` 和 `Stardust Telegram` 继续后置到暗色专项阶段。

### 0.1 2026-07-07 Velvet Diary 轻量变体补充

在不推进暗色主题、不做页面结构改造的前提下，允许先给 `Velvet Diary` 增加同族轻量变体，模式对齐当前 `Campus Pop` 下的 `Sea Salt Lemon` / `Peach Oolong`：

- `Velvet Diary` 保持原基础风格，面向用户显示为 `暖绒手札`。
- 新增 `松烟暮紫`：偏雾紫灰蓝、冷紫墨感，作为 Velvet 的差异化冷调轻量变体。
- 新增 `海沫笔记`：偏海沫蓝绿、清爽中性，作为 Velvet 的中性轻量变体。
- 两个变体只通过 `src/utils/theme.ts` 的主题 token 接入，复用 `styleSheets.velvet`，不新增逐页面专用样式。
- 微信小程序 `custom-tab-bar` 只补对应 `theme-rose-letter` / `theme-seafoam-note` 颜色覆盖，避免 tabBar 停留在默认硬边色。
- 这轮已通过 `npm.cmd run build:h5` 和 `npm.cmd run build:mp-weixin`；构建只剩既有 Sass deprecation warning。

“我”页面主题选择 UI 改为两级分组：
- `青春硬边`：`原味校园`、`海盐柠檬`、`蜜桃乌龙`
- `丝绒日记`：`暖绒手札`、`松烟暮紫`、`海沫笔记`

后续如继续做 `Glacier Blue` / `Mint Glass`，仍按 `Phase 4B-light` 单独推进；`Neon Signal` / `Stardust Telegram` 仍不进入本轮。

## 1. 目标与边界

### 1.1 最终目标

新增或调整一套 UI 风格时，主要改动集中在：

- `src/utils/theme.ts`：主题 ID、主题名、CSS 变量值
- `src/App.vue` 或新增全局样式文件：主题修饰类、全局组件样式
- 少量特殊组件白名单：如命理罗盘、金币动画、图表视觉资产

普通页面不再为每个主题写独立样式，也不再大量保留硬编码 `#111`、`#fff`、`border: 3rpx solid #111`、`box-shadow: 6rpx 6rpx 0 #111`。

### 1.2 现实边界

“只靠换颜色变量”无法还原 V3 风格，因为这些风格差异包括：

- 圆角
- 边框粗细
- 阴影方式
- 卡片结构
- 字体气质
- 背景纹理
- 标签 / 按钮 / Hero 的表达方式

因此计划采用“全局 CSS 为主”的分层方案：

1. 语义 CSS 变量负责颜色、间距、圆角、阴影、字体、边框、动效。
2. 全局组件类负责 `.card-v2`、`.hero-block-v2`、`.btn`、`.tag-v2`、`.section-title-v2` 等公共视觉。
3. 主题修饰类负责不同风格的结构差异，例如 `.theme-velvet-diary .hero-block-v2`。
4. 页面只保留业务布局和极少数场景样式，不直接表达品牌风格。

---

## 2. 当前问题

### 2.1 主题系统已有基础

当前已有全局 token 基础，不需要从零另建一套。已有内容包括：

- `src/utils/theme.ts`
  - `themeOptions`
  - `getThemeStyle()`
  - `setCurrentTheme()`
  - 基础 CSS 变量，如 `--app-bg`、`--hero-bg`、`--card-bg`、`--primary`
- 多数页面根节点已接入 `:style="themeVars"` 或 `:style="pageStyle"`
- 大量页面使用 `.v2-mode`、`.card-v2`、`.hero-block-v2`、`.tag-v2`

这说明项目适合继续走“现有 CSS 变量 + 全局类”的方向。后续工作不是“另起炉灶新建全局 token”，而是把现有 token 扩展成完整主题契约，并把仍散落在页面和 SCSS 里的硬编码值迁回这套契约。

### 2.2 核心阻碍

当前仍存在这些问题：

- `src/uni.scss` 定义了大量编译期 SCSS 色值，如 `$c-ink: #111111`
- `src/styles/campus-pop.scss` 的 mixin 仍使用 `$c-ink`、`$c-card` 等编译期变量
- 页面 scoped 样式里仍有大量硬编码颜色、边框、阴影、圆角
- `references.vue` 使用了独立的旧 storage key 和手写主题值
- `token-usage`、`token-recharge`、`quick-read`、分享页等页面主题接入不完整
- `admin` 是 H5 独立后台面板，是否纳入用户端主题需要单独决策
- 微信小程序端 `applyThemeChrome()` 明确跳过动态导航栏 / tabBar 主题切换
- `token-usage.vue` 和 `token-recharge.vue` 当前没有 `:style="themeVars"` / `getThemeStyle()` 接入，必须先补代码接入，否则全局 CSS 变量不会注入页面根节点
- 大量 `rgba(0,0,0,x)` 被用作次级文字、分隔线、遮罩和阴影，在 Neon Signal 暗色主题下会失效，不能简单保留
- 当前 `theme.ts` 中 `--primary` 在 Campus Pop 下是黑色，`--primary-2` 才是薄荷色；不能把 `#4ECDC4` 机械替换为 `--primary`
- `timeline.vue`、`case-detail.vue`、`subscription.vue` 是 P0 中样式硬编码最重的页面，工作量不能只按 mixin 改造估算

---

## 3. 目标架构

### 3.1 文件结构建议

在现有 `src/uni.scss`、`src/styles/campus-pop.scss`、`src/utils/theme.ts` 基础上调整为：

```text
src/styles/
  theme-tokens.scss        # 承接现有全局 token fallback，不写具体页面样式
  theme-components.scss    # 全局组件类：card / hero / btn / tag / form / list
  theme-variants.scss      # V3 新风格的主题修饰类
  campus-pop.scss          # 逐步瘦身，仅保留兼容 mixin，最终可废弃
```

`src/App.vue` 只负责引入这些全局样式，避免继续堆积所有 UI 规则。

如果不想新增 `theme-tokens.scss`，也可以先把 token fallback 继续放在 `uni.scss`。推荐拆出来的原因只是职责更清楚：`uni.scss` 保留 uni-app / SCSS 编译期变量，`theme-tokens.scss` 管运行时 CSS 变量。

### 3.2 主题 ID

把 `ThemeId` 扩展为：

```ts
export type ThemeId =
  | 'campus-pop'
  | 'sea-salt-lemon'
  | 'peach-oolong'
  | 'velvet-diary'
  | 'mint-glass'
  | 'neon-signal'
```

### 3.3 页面根节点契约

所有用户端页面根节点统一为：

```vue
<view :class="pageClass" :style="pageStyle">
```

其中 `pageClass` 至少包含：

```ts
[
  'page',
  'v2-mode',
  `theme-${currentThemeId}`,
  fontSizeMode === 'large' ? 'font-large' : ''
]
```

`pageStyle` 由 `getThemeStyle()` 输出 CSS 变量。

### 3.4 全局 CSS 变量分层

需要把当前十几个运行时变量扩展为 60-80 个语义 token。已有变量继续保留，例如 `--app-bg`、`--hero-bg`、`--hero-bg-2`、`--card-bg`、`--card-soft`、`--text-main`、`--text-muted`、`--primary`、`--primary-2`、`--accent` 等；新增变量只补齐现有体系表达不了的形状、阴影、字体、边框和动效。

命名原则：

- `--primary` 保持“主品牌 / 主文字或主按钮色”的现有语义，不再假定它一定是薄荷色
- `--primary-2` 作为兼容别名保留，但新代码优先使用更明确的 `--accent-cool`、`--dot-positive`、`--success`
- 机械替换只处理确定语义；不确定的 `#111`、`#4ECDC4`、`rgba(0,0,0,x)` 必须人工判断

颜色：

- `--app-bg`
- `--page-wash`
- `--surface`
- `--surface-rgb`
- `--surface-soft`
- `--surface-dim`
- `--surface-bright`
- `--surface-raised`
- `--text-main`
- `--text-muted`
- `--text-soft`
- `--placeholder`
- `--on-active-muted`
- `--ink`
- `--primary`
- `--primary-contrast`
- `--accent-cool`
- `--accent`
- `--accent-soft`
- `--brand-warm`
- `--brand-cool`
- `--success`
- `--success-soft`
- `--risk`
- `--risk-soft`
- `--dot-positive`
- `--dot-risk`
- `--warning`
- `--warning-soft`
- `--hero-text-color`
- `--hero-divider`
- `--hero-tag-bg`
- `--hero-tag-color`
- `--timeline-positive-gradient`
- `--timeline-risk-gradient`
- `--status-ai-bg`
- `--status-ai-dot`
- `--status-fallback-bg`
- `--status-fallback-dot`
- `--border`
- `--divider`
- `--divider-strong`
- `--scrim`
- `--overlay`

形状和边框：

- `--radius-xs`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-pill`
- `--border-width`
- `--border-width-strong`
- `--border-style`

阴影和质感：

- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-hard`
- `--shadow-glow`
- `--shadow-hero`
- `--surface-blur`
- `--surface-opacity`

排版：

- `--font-ui`
- `--font-display`
- `--font-mono`
- `--font-weight-body`
- `--font-weight-strong`
- `--font-weight-hero`
- `--letter-spacing-label`
- `--text-line-height`
- `--text-line-height-heading`

布局：

- `--page-padding`
- `--section-gap`
- `--card-padding`
- `--card-gap`
- `--control-height-sm`
- `--control-height-md`
- `--control-height-lg`

动效：

- `--motion-fast`
- `--motion-normal`
- `--motion-ease`
- `--press-scale`
- `--hero-rotate`
- `--hero-transform`

---

## 4. V3 风格映射

参考口径：
- `design/ui-options-v3-preview.html` 是 V3 命名和方向探索稿，保留三套 Phase 4 主题边界：`Velvet Diary`、`Mint Glass`、`Neon Signal`
- `design-previews/theme-options-2026-07.html` 是更成熟的 V4 页面结构参考，Phase 4 只吸收其中与三套 V3 主题对应的结构和质感，不把 6 套 V4 全部接入
- 正式实现时避免把预览稿中的 emoji 当作结构图标；如需图标，使用稳定文本标签或小程序可控 icon 方案
- V4 中 `Caramel Pudding`、`Acid Graffiti`、`Ink Zen` 暂不进入 Phase 4，可作为后续主题储备

### 4.1 Velvet Diary · 丝绒日记

定位：女生向、小红书用户、温暖精致日记本。

预览参考：
- 主参考：V3 `Velvet Diary` 的精致、暖调、柔和纸张感
- 辅助参考：V4 `Scrapbook Garden` 的页面结构、手账纹理和卡片层级
- 可少量借鉴：V4 `Caramel Pudding` 的温暖焦糖感，但不进入 Phase 4 独立主题
- 需要收敛：V4 `Scrapbook Garden` 中偏贴纸、偏可爱的表达要降噪，避免正式 App 过度幼态

全局变量特点：

- 暖米色背景
- 玫瑰、焦糖、墨棕作为主色
- 中大圆角
- 柔和纸张阴影
- 标题可用更优雅的 display 字体 fallback

主题修饰类重点：

```scss
.theme-velvet-diary {
  .hero-block-v2 { transform: rotate(var(--hero-rotate)); }
  .card-v2 { border-style: solid; }
  .section-title-v2 { font-family: var(--font-display); }
}
```

### 4.2 Glacier Blue / Mint Glass · 冰川蓝调 / 薄荷玻璃

定位：中性通用、Apple Health x Notion、数据驱动。

预览参考：
- 第一落地参考：V4 `Glacier Blue` 的真实 App 页面结构、数据卡片、浅色清冷层级
- 辅助增强参考：V3 `Mint Glass` 的半透明 surface、大圆角、弱边框方向
- 实现取舍：正式小程序端更接近 V4 `Glacier Blue`，不追求强毛玻璃；H5 可做 blur 增强
- 命名取舍：如果希望主题列表更直观，可使用 `glacier-blue` 作为正式 `ThemeId`；如果希望沿用 V3 三主题路线，可使用 `mint-glass`，但视觉实现按 Glacier Blue 降级版落地

全局变量特点：

- 清冷浅灰背景
- 冰川蓝 / 蓝绿色强调
- 大圆角
- 半透明 surface
- 弱边框、弱阴影、留白更大

主题修饰类重点：

```scss
.theme-mint-glass {
  .card-v2 { background: rgba(var(--surface-rgb), var(--surface-opacity)); }
  .hero-block-v2 { box-shadow: var(--shadow-hero); }
  .tag-v2 { border-radius: var(--radius-pill); }
}
```

小程序限制：`backdrop-filter` / `-webkit-backdrop-filter` 不能作为 Glacier Blue / Mint Glass 的必要能力。H5 可以增强使用 blur，小程序端必须降级为“浅色半透明 + 大圆角 + 弱边框 + 柔和阴影”的无 blur 版本。验收时以降级版本可接受为前提。

### 4.3 Neon Signal · 赛博信号

定位：男生向、游戏玩家、暗色霓虹仪表盘。

预览参考：
- 主参考：V4 `Stardust Telegram` 的页面结构、暗色层级、卡片密度
- 辅助参考：V3 `Neon Signal` 的 cyan / purple 信号感、mono 字体、霓虹强调
- 不采用：V4 `Acid Graffiti` 的高饱和涂鸦风不进入本主题，避免和 Fuzzy Bold / 当前硬边风重叠

全局变量特点：

- 深色背景
- 青色 / 紫色 / 荧光绿强调
- 低圆角或直角
- 细边框、发光阴影
- 等宽字体用于标签、数字、按钮

主题修饰类重点：

```scss
.theme-neon-signal {
  .hero-block-v2 { text-transform: uppercase; }
  .card-v2 { box-shadow: var(--shadow-glow, var(--shadow-lg)); }
  .tag-v2, .btn { font-family: var(--font-mono); }
}
```

重点风险：Neon Signal 是暗色主题，必须先完成 `#111`、`rgba(0,0,0,x)`、`#fff`、`#f9f9f9` 的语义迁移。否则会出现文字不可见、分隔线消失、浅色内嵌面刺眼等问题。V4 `Stardust Telegram` 的次级文字偏暗，正式实现时需要提高 `--text-muted` / `--text-soft` 对比度。

### 4.4 Fuzzy Bold · 粗粝宣言的处理方式

Fuzzy Bold 不作为新增主题接入。它与当前 Campus Pop / 硬边海报风已经属于同一视觉路线：粗黑边框、撞色、硬阴影、轻微旋转、年轻化表达。后续只把 Fuzzy Bold 中更成熟的部分吸收到默认硬边风里，例如：

- 更统一的硬阴影 token
- 更稳定的 Hero 旋转 token
- 更一致的标签 / 按钮边框规则
- 更克制的撞色比例

这样可以避免“当前风格”和“Fuzzy Bold”在主题列表里重复，用户切换时感知差异不明显。

---

## 5. 分阶段实施

执行策略更新：
先做 `Velvet Diary` 一套主题的端到端闭环，不同时接入三套 V3 主题。原因是 `Velvet Diary` 风险最低，适合验证全局 token、主题 class、页面硬编码收敛、微信小程序显示和默认主题回归。等 `Velvet Diary` 和当前默认 Campus Pop 都通过微信开发者工具验收后，再继续接入 `Mint Glass`，最后接入 `Neon Signal`。

第一轮闭环范围：
- Phase 3.5：先清除 V3 阻碍，保持当前默认硬边风格稳定
- Phase 4A：只接入 `Velvet Diary`
- Phase 5A：用 `Velvet Diary` 跑 P0 页面专项收敛
- Phase 6A：小程序限制收尾
- Phase 7A：H5 + mp-weixin 构建和微信开发者工具视觉验收

第二轮扩展范围：
- `Velvet Diary` 验收通过后，再接入 `Mint Glass`
- `Mint Glass` 验收通过后，最后接入 `Neon Signal`
- 每新增一套主题都至少跑 P0 页面抽查和 H5 / mp-weixin 构建

## Phase 0：建立基线与验收截图

时间：0.5 天

任务：

- 确认当前默认主题视觉作为回归基线
- 固定测试路径：
  - 登录 / 注册
  - 首页
  - 我们
  - Crushes
  - 往事
  - 我
  - 订阅 / 充值 / 用量
  - 新建 Crush
  - 桃花 / 桃花结果 / 分享页
  - 快速解读
- H5 构建截图一组
- 小程序构建截图一组
- 记录 P0 页面硬编码现状，至少标出 `timeline`、`case-detail`、`subscription`、`token-usage`、`token-recharge`

验收：

- 有一份页面清单
- 有默认主题基线截图或人工验收记录
- 明确 admin 是否本期纳入

---

## Phase 1：建立全局主题基础设施

时间：1 天

任务：

- 扩展现有全局 token。实现方式二选一：
  - 推荐：新增 `theme-tokens.scss` 承接运行时 CSS 变量 fallback
  - 保守：继续放在 `uni.scss`，但要把运行时 token 和 SCSS 编译期变量分区
- 新增 `theme-components.scss`
- 新增 `theme-variants.scss`
- `App.vue` 引入全局样式
- `theme.ts` 扩展 token schema
- `theme.ts` 新增 `getThemeClass(id)` 或 `getCurrentThemeClass()`
- 统一 `--primary` / `--primary-2` / `--accent-cool` 语义，避免把薄荷色误替换为 `--primary`
- 给 `token-usage.vue`、`token-recharge.vue` 补齐 `getThemeStyle()`、`applyThemeChrome()` 和根节点 `:style="themeVars"` 接入
- 所有用户端页面统一根节点 class：
  - `page`
  - `v2-mode`
  - `theme-${id}`
  - `font-large`

验收：

- 默认主题不明显变形
- 切换主题时根节点 class 和 CSS 变量同步变化
- `references.vue` 改用统一 `uiThemeId`

---

## Phase 2：把公共组件视觉迁移到全局 CSS

时间：3 天

优先迁移这些类：

- `.page`
- `.hero-block-v2`
- `.hero-tag-v2`
- `.hero-title-v2`
- `.hero-copy-v2`
- `.hl-v2`
- `.card-v2`
- `.card-light-v2`
- `.section-title-v2`
- `.section-sub-v2`
- `.card-text-v2`
- `.tag-v2`
- `.tag-row-v2`
- `.btn`
- `.btn-primary`
- `.btn-secondary`
- `.btn-ghost`
- `.tab-btn-v2`
- `.stat-box-v2`
- `.empty-v2`
- `.notice-v2`
- `.input-v2`
- `.textarea-v2`

原则：

- 页面内重复定义的公共类删掉或降级为布局补丁
- `campus-pop.scss` 的 mixin 改成调用 CSS 变量
- 新代码禁止继续用 `$c-ink`、`$c-card` 表达主题色
- Phase 2 不只改 mixin，还要处理被 mixin 覆盖不到的页面 scoped 硬编码；否则暗色主题和 Mint Glass 会大量穿帮

验收：

- 5 个 tab 主页面不再依赖页面内硬编码 `.card-v2` / `.hero-block-v2`
- 默认主题视觉基本保持
- 现有主题和三套新增主题都能明显改变卡片、按钮、Hero、标签风格

---

## Phase 3：批量替换硬编码样式

时间：3-4 天

任务：

- 写 `scripts/migrate-to-theme-vars.cjs`
- 批量处理用户端页面和组件：
  - `#111` -> 按语义替换为 `var(--ink)` / `var(--text-main)` / `var(--border)` / `var(--hero-tag-bg)`
  - `#fff` -> `var(--surface)`
  - `#f9f9f9` -> `var(--surface-dim)` 或 `var(--surface-soft)`
  - `#666` -> `var(--text-muted)`
  - `#999` -> `var(--text-soft)`
  - `#FFD93D` -> `var(--accent)`
  - `#4ECDC4` -> 按语义替换为 `var(--accent-cool)` / `var(--dot-positive)` / `var(--success)`
  - `#FF5252` -> `var(--risk)`
  - `rgba(0,0,0,x)` -> 按语义替换为 `var(--divider)` / `var(--overlay)` / `var(--text-muted)` / `var(--shadow-*)`
  - `border: 3rpx solid ...` -> `border: var(--border-width-strong) solid var(--border)`
  - `box-shadow: 6rpx 6rpx 0 ...` -> `box-shadow: var(--shadow-hard)`
- 人工审查 inline style、gradient、图表色、状态色
- 页面级 `linear-gradient(...)` 不能机械保留 Campus Pop 的深绿氛围色，需要迁移为 `--page-wash` / `--hero-bg-*` / `--surface-*` 等变量

跳过或谨慎处理：

- `src/pages/admin/**`
- `src/components/TaohuaCompass.vue`
- `src/components/TokenCoinOverlay.vue`
- 宠物 sprite / avatar / logo 等图片资产
- 图表数据颜色，需转成语义色而不是机械替换

验收：

- `rg "#111|#fff|#FFD93D|#4ECDC4|#FF5252" src/pages src/components` 只剩白名单
- `rg "border:\\s*3rpx solid #|box-shadow:.*#111" src/pages src/components` 只剩白名单
- 构建通过

---

## Phase 3.5：V3 主题阻碍清除与硬边兼容解耦

时间：0.5-1 天

目的：
Phase 3 完成后先不要直接接入 V3 三套主题。先清除会阻碍 V3 落地的结构性问题，确保后续新增主题时不会破坏当前 Campus Pop / 硬边风格，也不会让 Velvet Diary、Mint Glass、Neon Signal 被当前硬边兼容逻辑锁死。

任务：
- 重构 `mergeStyleSheet()` 的兼容覆盖方式：
  - 当前 Campus Pop / 现有 3 套主题必须继续保持硬边基线：硬阴影、800 字重、1.2 标题行高
  - 不再用无条件全局覆盖阻断 V3 风格自己的 `--shadow-hero`、`--font-weight-hero`、`--text-line-height-heading`
  - 两种实现路径二选一即可，不阻塞 Phase 4：
    - 推荐长期方案：新增或明确 `campusHard` style sheet，让当前主题使用它；V3 主题使用各自的 `neon` / `velvet` / `glass` style sheet
    - 过渡方案：保留当前 `--shadow-hero-hard` 等 override key 模式，但必须把 key 命名和优先级写清楚，新增 V3 主题不能被迫使用语义错误的 hard key 表达柔和阴影或 neon glow
- 清理 P0 页面中 fallback 之外仍然存在的硬编码样式：
  - `index.vue`：`#FFFBEA`、`#777`、`#ccc`、`#fafafa`、AI badge 的浅色背景和状态点
  - `timeline.vue`：模板内联 `background:#111;color:#666`、页面级固定渐变、weekly dot、active 状态白色半透明文案
  - `case-detail.vue`：评分颜色函数返回的固定色、`rgba(0,0,0,0.12)` 分隔线、浅色 warn surface
  - `me.vue`：`switch color="#111"`、内联 `style="color:#e67e22"`、少量固定半透明文字
  - `cases.vue`：`confirmColor: '#FF5252'`、页面级固定渐变
- 补齐 V3 必需但当前仍不够明确的语义 token：
  - `--placeholder`
  - `--hero-divider`
  - `--on-active-muted`
  - `--timeline-positive-gradient`
  - `--timeline-risk-gradient`
  - `--status-ai-bg`
  - `--status-ai-dot`
  - `--status-fallback-bg`
  - `--status-fallback-dot`
- 明确暗色主题 token 映射规则：
  - 分隔线走 `--divider` / `--hero-divider`
  - 遮罩走 `--overlay`
  - 次级文字走 `--text-muted` / `--text-soft`
  - 激活态反白说明文字走 `--on-active-muted`
- 明确 Mint Glass 小程序降级前提：
  - H5 可以增强 `backdrop-filter`
  - 微信小程序不依赖 blur，只验收浅色半透明 surface、大圆角、细边框、轻阴影

验收：
- 当前默认硬边风格视觉不回退，尤其是 Hero、今日卡片、反馈卡片、弹窗阴影
- `mergeStyleSheet()` 已选定 styleSheet 或 override key 路径，且 V3 主题可以控制自己的核心形态 token
- 8 个 P0 页面中 fallback 外硬编码只剩业务语义白名单
- H5 和 mp-weixin 构建通过
- 用户在微信开发者工具确认 Phase 3/3.5 后，才进入 Phase 4

---

## Phase 4：新增主题变量和修饰类

时间：Velvet 先行闭环 0.5-1 天；三套完整接入累计 1.5-2.5 天

前置条件：
- Phase 3.5 已完成
- H5 和 mp-weixin 构建通过
- 用户已在微信开发者工具确认当前默认风格没有明显回退；如尚未完成视觉确认，只允许推进浅色低风险主题，不推进暗色主题
- `mergeStyleSheet()` 已完成硬边兼容解耦，V3 主题可以独立控制阴影、字重、行高、圆角和边框
- `Velvet Diary` 已完成主题变量接入；P0 页面视觉抽查继续作为 Phase 5A 工作
- 下一轮允许先实现 `Glacier Blue` / `Mint Glass` 这类浅色低风险主题
- `Neon Signal` 和 `Stardust Telegram` 等暗色赛博主题必须等默认主题、Velvet、浅色主题都通过 P0 抽查后再接入
- Mint Glass 的小程序无 blur 降级方案必须在接入 Mint Glass 的同一轮内同步实现和验收，不后置到 Phase 6

任务：

- Phase 4A：在 `theme.ts` 新增 `velvet-diary`（已完成）
- Phase 4A：在 `theme-variants.scss` 或现有全局样式中补充 `Velvet Diary` 需要的主题修饰类（按穿帮情况增量补）
- Phase 4A：在“我”页面主题选择 UI 中展示现有 3 套 + `Velvet Diary`（已完成）
- Phase 4B-light：新增 `glacier-blue` 或 `mint-glass`；优先采用 Glacier Blue 的浅色清冷实现，不强依赖 blur
- Phase 4B-light：新增主题展示顺序建议为 `Campus Pop`、`Sea Salt Lemon`、`Peach Oolong`、`Velvet Diary`、`Glacier Blue / Mint Glass`
- Phase 4C-dark：浅色主题验收通过后，再新增 `neon-signal`；如采用 `Stardust Telegram`，应作为 `neon-signal` 的暗色参考，不与 Neon 同时并列
- V4 预览中的 `Caramel Pudding`、`Acid Graffiti`、`Ink Zen` 不进入本阶段
- 样式参考以“V3 命名和方向 + V4 成熟页面结构”为准，不直接照搬任一预览 HTML
- 每套主题至少覆盖：
  - 页面背景
  - Hero
  - 卡片
  - 按钮
  - 标签
  - 输入框
  - 状态色
  - 空状态
  - loading
  - tab / segmented control
- 接入 Mint Glass 时必须同时定义 H5 增强版本和小程序降级版本；小程序端不等待 Phase 6，接入当轮验收时就必须可看

验收：

- Phase 4A 验收时只要求 `Velvet Diary` 与默认硬边风格都稳定
- Phase 4B-light 验收时只要求新增浅色主题在 P0 主流程无明显穿帮，允许 H5 有 blur 增强、小程序为无 blur 降级
- 每新增一套主题都必须做到差异明显，不只是换色
- 所有主流程页面切换后视觉语言一致
- 不出现文字低对比、按钮看不出可点击、卡片边界消失
- 接入 Mint Glass 后，微信小程序端必须显示为可接受的无 blur 降级版本
- 暗色主题验收必须额外检查 `#111`、`#fff`、`rgba(0,0,0,x)` 语义迁移和正文/次级文字对比度

---

## Phase 5：页面专项收敛

时间：Velvet 先行闭环 2-3 天；三套完整收敛累计 4-5 天

执行方式：
- Phase 5A：只用当前默认主题 + `Velvet Diary` 做 P0 页面专项收敛
- Phase 5B-light：`Glacier Blue` / `Mint Glass` 接入时，在同一 P0 顺序上做增量抽查和补丁
- Phase 5C-dark：`Neon Signal` / `Stardust Telegram` 接入前，先完成暗色风险扫描，再在同一 P0 顺序上做专项抽查
- 不要在浅色主题还没通过验收前同时修暗色主题的页面穿帮问题

优先级 P0：

- `index`
- `me`
- `timeline`
- `cases`
- `case-detail`
- `subscription`
- `token-recharge`
- `token-usage`
- `new`
- `login`
- `register`

P0 跨页面组件和小程序原生边界：

- `src/components/AssessmentForm.vue`：被 `index`、`new`、`reassess` 引用，是新用户评估主流程的一部分，必须随 P0 收敛
- `src/components/ProgressMilestone.vue`：`case-detail` 页面内的进度组件，不能保留 Campus Pop 绿色进度条
- `src/components/PetSpeakSheet.vue`：用户端宠物弹层，跟随主题；宠物图片资产本身不主题化
- `src/components/ProfileAvatarPicker.vue`、`ProfileInline.vue`、`CaseProfileFields.vue`、`ProfileAvatar.vue`：画像编辑/展示组件跟随页面主题
- `src/components/AiLoading.vue`、`AssessmentTrendChart.vue`：通用反馈和图表外壳跟随主题；图表数据含义色按语义 token 处理
- `custom-tab-bar/`：微信小程序原生 custom tabBar 不继承页面 CSS 变量，需单独同步 `uiThemeId` 并提供 Velvet 覆盖样式

P0 验收和收敛排序：

1. `index`：最高频入口，今日卡片、快速记录、反馈卡片和弹窗必须优先稳定
2. `me`：主题选择入口和用户设置页，主题化程度最高，也适合作为页面改造参考
3. `timeline`：高频 Tab 页，同时硬编码和 scoped 样式最多，是 V3 穿帮风险最高页面
4. `cases`：高频 Tab 页，列表卡片和页面级渐变需要跟随主题
5. `case-detail`：结构复杂，图表和语义色较多
6. `subscription`：SCSS 编译期变量密集，涉及付费转化
7. `token-usage` / `token-recharge`：账务相关页面，先保证主题接入和可读性
8. `new`：创建入口重要但停留时间短，放在 P0 后段专项收敛
9. `login` / `register`：入口页需要可用和品牌一致，但不阻塞主流程 V3 验收
10. P0 跨页面组件：按引用面补齐组件，不把组件漏项推迟到 P1/P2

优先级 P1：

- `taohua`
- `quick-read`
- `monthly-review`
- `assessments`
- `self-profile`
- `edit-profile`
- `pair-onboarding`
- `taohua-pair-result`
- `taohua-persona-result`

优先级 P2：

- `taohua-share`
- `taohua-pair-share`
- `references`
- `custom-pet`
- `feedback`
- `about`
- `explain`

处理方式：

- 删除页面内重复公共样式
- 页面内只保留布局、尺寸、业务状态样式
- 视觉样式迁移到全局组件类或新增语义类
- 对特殊模块增加稳定语义类，如：
  - `.metric-card`
  - `.timeline-event`
  - `.signal-panel`
  - `.profile-chip`
  - `.billing-plan`

验收：

- Phase 5A：每个 P0 用户端页面切换当前默认主题和 `Velvet Diary` 后无明显穿帮
- Phase 5B-light：新增浅色主题必须在 P0 页面上完成增量抽查和补丁
- Phase 5C-dark：新增暗色主题必须完成额外暗色对比度和硬编码穿帮检查
- 页面 scoped 样式不再承担品牌风格
- 后续新增主题不需要逐页面新增主题 CSS

---

## Phase 6：小程序全局限制收尾

时间：0.5 天

问题：

微信小程序端当前 `applyThemeChrome()` 直接 return，动态设置导航栏 / tabBar 不执行。第一轮 Velvet 闭环只验证主题内容区换肤和默认风格回归；Mint Glass 的小程序无 blur 降级在接入 Mint Glass 的同一轮同步落地，不等到 Phase 6 再补。

方案：

- 本期不依赖原生 navigationBar / tabBar 动态换肤
- 页面内容区通过全局 CSS 完成换肤
- 自定义 tabBar 已单独读取 `uiThemeId`，通过 `theme-xxx` 类同步当前主题
- 原生 navigationBar 不能动态换肤，`pages.json` 使用默认主题同系暖白作为静态降级，避免和 `Campus Pop` / `Velvet Diary` 冲突过大
- 第一轮只复查 `Velvet Diary` 在小程序内容区是否完整生效
- 接入 Mint Glass 后，复查同轮已落地的小程序降级版本，不在 Phase 6 重新补实现
- 所有 `backdrop-filter` 只能放在 H5 条件样式或可降级增强规则里，不能作为小程序基础视觉

验收：

- 小程序端主题切换后内容区完整生效
- custom tabBar 在 `Campus Pop` / `Velvet Diary` 间跟随主题切换
- 原生 navigationBar 使用静态暖白降级，不调用动态 API
- 不调用已知会 crash 的动态 API

---

## Phase 7：质量门禁

时间：0.5-1 天

命令检查：

```powershell
npm.cmd run build:h5
npm.cmd run build:mp-weixin
rg "#111|#fff|#FFD93D|#4ECDC4|#FF5252" src/pages src/components
rg "border:\s*[0-9]+rpx solid #|box-shadow:.*#111" src/pages src/components
```

视觉验收：

- 小屏手机宽度
- 大屏手机宽度
- H5
- 微信小程序
- 默认字体
- 大字体模式
- 第一轮只对 `Velvet Diary` 做 P0 逐页抽查
- 后续每新增一套主题，再做对应主题的 P0 增量抽查

可访问性验收：

- 正文对比度不低于 4.5:1
- 次级文字对比度不低于 3:1
- 按钮点击区域不小于 44pt
- disabled / loading / selected 状态在每套主题里清晰可辨

---

## 6. 工作量估算

| 阶段 | 内容 | 估算 |
|---|---|---:|
| Phase 0 | 基线和页面清单 | 0.5 天 |
| Phase 1 | 全局主题基础设施 | 1 天 |
| Phase 2 | 公共组件视觉迁移 | 3 天 |
| Phase 3 | 硬编码批量替换和人工审查 | 3-4 天 |
| Phase 3.5 | V3 阻碍清除和硬边兼容解耦 | 0.5-1 天 |
| Phase 4A | Velvet Diary 先行主题变量和修饰类 | 0.5-1 天 |
| Phase 5A | Velvet Diary P0 页面专项收敛 | 2-3 天 |
| Phase 6 | 小程序全局限制收尾 | 0.5 天 |
| Phase 7 | 构建、截图、回归 | 0.5-1 天 |
| Velvet 先行闭环 | 可验收的单主题版本 | 10.5-14 天 |
| Phase 4B/5B | Mint Glass、Neon Signal 后续增量接入和收敛 | 3-5 天 |
| 合计 | 三套 V3 可上线版本 | 14-19 天 |

如果只覆盖 P0 主流程页面，Velvet 先行闭环约 7-10 天。`timeline` 若暂缓到下一轮，Velvet 先行闭环可压到约 6-8 天。

---

## 7. 推荐执行顺序

先不要直接做 V3 主题全量替换。推荐顺序：

1. 扩展现有全局 token，并建立全局组件类。
2. 先修 `token-usage`、`token-recharge` 的主题变量接入缺口。
3. 把默认主题迁移到全局 CSS，并保证视觉不回退。
4. 完成 Phase 3.5：清除 V3 阻碍，解耦硬边兼容覆盖，并让用户在微信开发者工具确认当前风格没有明显回退。
5. 先用当前 Campus Pop / 硬边风作为默认基线，并吸收 Fuzzy Bold 中更成熟的硬边规则。
6. 只接入 `Velvet Diary`，因为它风险最低，主要验证暖色、圆角、柔和阴影。
7. 用 `Velvet Diary` 继续跑 Phase 5A / 6A / 7A 的 P0 抽查；这项不阻塞新增浅色低风险主题。
8. 下一步进入 `Phase 4B-light`：优先接入 `Glacier Blue` / `Mint Glass`，同时落地小程序无 blur 降级。
9. `Glacier Blue` / `Mint Glass` 验收通过后，再考虑 `Neon Signal` 或 `Stardust Telegram`。暗色主题要求最严格，必须等硬编码和 rgba 迁移充分后再做。
10. 最后处理分享页、桃花特殊组件和 admin 是否跟随主题。

---

## 8. 完成标准

这个计划完成后，新增第五套、第六套风格时，理想改动量应控制在：

- `theme.ts` 新增一条主题配置
- `theme-variants.scss` 新增一个 `.theme-xxx` 小节
- 0-2 个特殊组件补丁
- 不需要逐页面修改 30 个页面

实际用户体验标准：

- 主题切换后不是局部变色，而是整体视觉语言变化
- 三套 V3 新增风格在主流程页面上都成立
- 默认主题不发生明显回归
- H5 和微信小程序都可用
