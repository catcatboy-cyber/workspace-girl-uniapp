# 工作总结 · 套餐→月卡品牌改版 + 配置覆盖bug修复

**日期**：2026-07-04
**范围**：套餐品牌改版（消除订阅制感）、配置版本升级覆盖管理员值 bug 修复、功能列表去重

---

## 1. 套餐→月卡品牌改版

### 1.1 背景
用户反馈：Pro/Ultra 按月付费，但不想让用户感到"订阅制每月自动扣费"的压力。实际模型是"一次购买、30 天有效、不自动续费"，类似游戏月卡。

### 1.2 subscription.vue（月卡页）

| 元素 | Before | After |
|------|--------|-------|
| Hero tag | UPGRADE | 月卡 |
| Hero title | 升级套餐 | 权益月卡 |
| Hero desc | 更多 Credits… | 一次购买，畅享 30 天。到期自动结束，不续费不扣款。 |
| 套餐名 | Pro / Ultra | Pro 月卡 / Ultra 月卡 |
| 价格 chip | 月付 ¥5.90/月 | 30天 ¥5.90 |
| 价格 chip | 年付 ¥48/年 | 365天 ¥48 |
| Credits 配额 | 300K Credits/月 | 300K Credits/30天 |
| 按钮 | 升级 Pro | ¥5.90 立即开通 |
| 当前按钮 | 当前套餐 | 当前月卡 |
| 安心标签 | 无 | 🛡️ 一次购买 · 不自动续费 · 到期自动结束 |

### 1.3 me.vue（"我"页面）

| 元素 | Before | After |
|------|--------|-------|
| 身份 badge | PRO 会员 / ULTRA 会员 | Pro 月卡 · 到期 8月3日 |
| 统计标签 | 本月套餐 | 月卡配额 |
| 付费用户按钮 | 升级套餐 | 购买套餐 |
| 免费用户按钮 | 升级套餐 | 买月卡 |
| 到期日期 | 无 | 从 planExpiresAt 读取，显示"到期 X月X日" |

### 1.4 全局文案替换
- `token-usage.vue`：升级套餐 → 开通月卡
- `api.ts`：请升级套餐 → 请购买月卡
- `me.vue` / `custom-pet.vue` / `taohua.vue`：当前套餐不支持…请升级套餐 → 当前月卡不支持…请购买月卡

### 1.5 云函数配置
- `DEFAULT_SUBSCRIPTION_CONFIG`: Pro → Pro 月卡, Ultra → Ultra 月卡

---

## 2. 配置版本升级覆盖管理员值 Bug

### 2.1 问题
管理员将 Ultra 月度 Credits 设为 600000，但每次云函数读取配置时，`ensureSubscriptionConfig` 检测到 configVersion 变化（4→5），强制将 `monthlyTokens`、`maxCrushes`、`features`、`excludedFeatures` 覆盖为代码默认值。Ultra 默认值是 `-1`（无限），导致管理员设置被反复刷回。

### 2.2 修复
`_shared/subscription.js` 中移除版本升级时的强制覆盖逻辑。只更新 `configVersion` 字段，不覆盖管理员已配置的任何值。默认值仅用于首次初始化（DB 无配置文档时），管理员配置永远是权威。

### 2.3 影响范围
全部 39 个云函数同步 + 全量部署。

---

## 3. 功能列表去重

### 3.1 问题
Pro 和 Ultra 卡片列出全部功能（含与下级重复的），用户需要滚动很久才能看到差异。

### 3.2 修复
- **Pro 卡片**：显示"含免费版全部功能"，下方只列 Pro 独有的功能（如命理桃花），不列与免费版重复的 8 个功能，也不列 Pro 没有的 Ultra 功能
- **Ultra 卡片**：显示"含 Pro 全部功能"，下方只列 Ultra 真正独有的功能。去重逻辑**动态对比 Pro 实际配置**而非写死列表，管理员给 Pro 加了新功能后 Ultra 自动跳过
- 新增标记 `+` 表示"在基础之上的额外功能"

### 3.3 Admin 面板
- `SubscriptionPanel.vue`：修复加载时过滤掉 `免费版全部` / `Pro全部` 标记的问题，保留标记以便后续保存

---

## 4. 微信开发者工具构建目录问题

### 4.1 问题
多次构建后前端无变化，最终发现微信开发者工具实际加载 `dist/dev/mp-weixin/`，而非 `dist/build/mp-weixin/`。且工具运行时锁定了 dist 目录，导致 `build:mp-weixin` 无法写入。

### 4.2 解决
先删旧文件再构建，然后手动 cp 到 dev 目录。后续需确认 `project.config.json` 的 `miniprogramRoot` 与实际加载目录一致。

---

## 5. 改动文件

| 文件 | 改动 |
|------|------|
| `src/pages/subscription/subscription.vue` | Hero/套餐名/价格/按钮/安心标签 + 功能列表去重 |
| `src/pages/me/me.vue` | badge/按钮/统计标签 + 到期日期显示 |
| `src/pages/admin/components/panels/SubscriptionPanel.vue` | 保留标记 |
| `src/pages/token-usage/token-usage.vue` | 文案 |
| `src/pages/custom-pet/custom-pet.vue` | 文案 |
| `src/pages/taohua/taohua.vue` | 文案 |
| `src/utils/api.ts` | 文案 |
| `cloudfunctions/_shared/subscription.js` | 版本升级不覆盖 + plan name |
| 39 个云函数 `_shared/subscription.js` | sync |
| 全部 39 个云函数 | 部署 |

---

## 6. UniApp 原生 App 打包方案调研与规划

### 6.1 背景
用户需求：在现有微信小程序基础上打包 Android APK、iOS IPA、鸿蒙 HAP 三个原生 App。

### 6.2 调研结论
- **Android/iOS**：走 `uni build -p app` → HBuilderX 云打包，无需额外框架
- **鸿蒙**：传统 uni-app 可走 HBuilderX + DevEco Studio 本地打包，但需新增 `@dcloudio/uni-app-harmony` 依赖和 `#ifdef APP-HARMONY` 条件编译。uni-app x 路线（ArkTS 原生渲染）不适合存量项目
- **支付**：Android 走微信 App 支付（开放平台 AppID，`/v3/pay/transactions/app` 接口），iOS 必须走 Apple IAP（Non-Renewing Subscription + Consumable），鸿蒙待定
- **登录**：App 端复用现有 H5 匿名登录路径（`@cloudbase/js-sdk` → `signInAnonymously`），不新增云函数
- **关键风险**：`@cloudbase/js-sdk` 在 App WebView 兼容性（Ph1 D1 优先验证）、宠物文件系统 App 适配（7 个函数需拆平台）、iOS IAP 开发周期

### 6.3 产出
- `docs/APP-PACKAGING-PLAN.md`（v4）：三平台详细方案，经 2 轮 GPT 审计修正，10 个改动文件，环境变量通过 CloudBase 控制台设置不入仓库，零影响微信小程序

---
## 7. UI V3 四套新风格设计与实施评估

### 7.1 背景
用户对现有 "UI 方案 V2" 中 4 套设计（Crush Arcade / Campus Sticker / Bubble Chat Lab / Signal Game）不满意，要求面向不同用户群设计新风格。

### 7.2 产出
- **`design/ui-options-v3-preview.html`**：4 套全新风格手机框 mockup（可直接浏览器打开查看）
  - A. 赛博信号（Neon Signal）：男生向，暗色霓虹仪表盘，monospace 终端美学
  - B. 丝绒日记（Velvet Diary）：女生向，暖调精装日记本，衬线字体
  - C. 薄荷玻璃（Mint Glass）：中性通用，Apple Health × Notion 毛玻璃数据风
  - D. 粗粝宣言（Fuzzy Bold）：Z 世代甜酷，粗黑边框撞色独立杂志风
- 每套给出精确到 CSS 变量的配色、圆角、阴影、字体参数

### 7.3 实施评估
- **`design/ui-options-v3-implementation-plan.md`**：全项目审计后的诚实方案
  - 初版错误判断"只改 2 文件 150 行"，经审计发现 ~500 处硬编码值需替换
  - 90% 可用脚本批量替换（`#111`→`var(--ink)` 等 10 条规则），10% 需人工审查
  - 真实工作量 ~7h（1 天）：1h 脚本 + 2h diff 审查 + 1h SCSS 改造 + 1h 主题定义 + 2h 全量回归
  - 装饰性组件（TaohuaCompass、TokenCoinOverlay）和 admin 面板不参与主题化

### 7.4 设计文件
- `design/ui-options-v3-preview.html`（4 套风格可视化 mockup）
- `design/ui-options-v3-implementation-plan.md`（审计修正后的实施方案）

---
## 8. UI V3 风格切换二次审计

### 8.1 背景
用户进一步确认：如果基于 `design/ui-options-v3-preview.html` 在现项目实现样式风格切换，担心“全局样式风格”无法在所有页面生效，因此对现有主题体系和页面样式覆盖面做二次审计。

### 8.2 审计结论
- 结论：担心成立。现项目不能只靠全局 CSS 变量完整切换到 4 套 V3 风格。
- V3 四套风格不是单纯换色，而是换完整视觉语言：圆角、边框、阴影、字体、背景纹理、卡片结构、按钮样式都有差异。
- 当前 `src/utils/theme.ts` 已有主题变量体系，但仅覆盖颜色和少量形状 token，且现有主题 ID 仍是 `campus-pop` / `sea-salt-lemon` / `peach-oolong`。
- `src/uni.scss` 和 `src/styles/campus-pop.scss` 大量使用 SCSS 编译期变量（如 `$c-ink`、`$c-card`、`$c-mint`），运行时主题切换无法影响这些值。
- 小程序端导航栏/TabBar 不会动态换肤：`applyThemeChrome()` 在 `MP-WEIXIN` 下直接 `return`，这是当前代码的显式限制。

### 8.3 覆盖面数据
- `pages.json` 共 30 个路由。
- 显式接入 `themeVars` / `pageStyle` 的页面文件约 24 个。
- 未接入或接入不完整的关键页面：`token-usage`、`token-recharge`、`admin`、`taohua-share`、`taohua-pair-share`、`quick-read`。
- 项目内硬编码颜色 / `rgba()` 命中约 1876 处，分布在约 50 个文件。
- 高硬编码页面包括：`taohua`、`index`、`case-detail`、`timeline`、`admin`、`me`、`quick-read`、`token-usage`、分享页等。

### 8.4 代码量估算
- **最小版**：只新增 4 个主题选项和基础变量，约 `150-300 LOC`，1 天内可做，但只能局部生效。
- **可上线版**：覆盖主流程页面，统一卡片 / 按钮 / Hero / token，约 `800-1500 LOC`，3-5 天。
- **高保真全量版**：覆盖所有页面、分享页、admin、组件，并保持 4 套风格一致，约 `2500-5000 LOC`，1.5-3 周。

### 8.5 推荐路线
- 不建议直接做“全局样式覆盖”，会出现部分页面生效、部分页面被 scoped 样式和硬编码覆盖的问题。
- 推荐先做“可上线版”：扩展 `theme.ts` 语义 token，再把 `campus-pop.scss` 核心 mixin 改成 `var(...)`，补齐缺失页面根节点主题绑定。
- 对 Neon Signal / Velvet Diary / Fuzzy Bold 这类结构差异大的风格，额外增加 `theme-neon-signal`、`theme-velvet-diary`、`theme-fuzzy-bold` 主题修饰类，不强行只靠变量表达。
- 第一阶段优先覆盖 5 个 Tab 主页面 + 登录 / 注册 + 订阅 / 充值 / 用量页；分享页和 admin 可放第二阶段。

---
## 9. 今日数据

| 指标 | 数值 |
|------|------|
| 提交 | 2 次（`migrate-company-miniprogram`） |
| 文件变更 | 47 files（commit 1）+ 3 files（commit 2） |
| 回归测试 | 28 PASS, 0 FAIL |
| 云函数部署 | 39 个（全量） |
| 新增文档 | `WORK-SUMMARY-2026-07-04.md`, `docs/APP-PACKAGING-PLAN.md`, `design/ui-options-v3-preview.html`, `design/ui-options-v3-implementation-plan.md` |
