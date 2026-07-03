# 工作总结 · 上架前审计修复 + UI 统一 + 支付优化

**日期**：2026-07-03
**范围**：上架前审计修复、5 个 tab 页 Hero 样式统一、今日桃花卡片重设计、"我"页面重构、订阅/加油包定价、虚拟支付代币方案

---

## 1. 上架前审计修复

### 1.1 `__usePrivacyCheck__` 注入（后回滚）
- 审计报告要求注入 `__usePrivacyCheck__: true` → postbuild 脚本加入
- 测试发现 `chooseImage` 报 `api scope is not declared`
- 回滚：**2025 年后微信已内置隐私检查，不需要此 flag**（6 月 29 日已修过一次）
- PrivacyPopup 组件及相关改动一并回滚

### 1.2 PAY_DEBUG 关闭
- `cloudbaserc.json` recharge 函数 `PAY_DEBUG: "true"` → `"false"`，已部署

### 1.3 云函数 timeout 修复
- `getSubscriptionConfig`、`getSubscriptionStatus`、`getCallUsageHistory`、`trackShareVisit` timeout 10s → 30s，已部署

### 1.4 静态资源压缩
- `static/logo.png` 和 `static/app-icon.png` 各 915KB → postbuild 构建时自动删除
- dist/static 从 1.8MB 降到 154KB，满足微信 2MB 主包限制

### 1.5 密钥泄露（未修）
- `cloudbaserc.json` 包含 WXPAY_PRIVATE_KEY、WXPAY_API_V3_KEY、WECHAT_APP_SECRET 等
- `WXPAY_API_V3_KEY` 为弱密钥 "Wq168168wq168168wq168168wq168168"
- 用户选择后续处理

---

## 2. 订阅/加油包定价重设

- `tokensPerYuan`：100000 → **30000**
- 加油包：¥1.90 (送5000) + ¥4.90 (送20000)
- 套餐：Pro ¥5.90/月、Ultra ¥9.90/月
- 年费：Pro ¥48、Ultra ¥78
- 首次赠送：100万 → 3万
- 加油包改为引导用户走向包月套餐

---

## 3. planExpiresAt 过期修复

- **Bug**：`planExpiresAt` 存入但从未被 `checkTokenBalance`/`checkFeatureAccess`/`consumeTokens` 检查
- 付费一次终身白嫖
- **修复**：`_shared/subscription.js` 新增 `getEffectivePlan()` + `ensurePlanDowngraded()`，三个门控函数全部调用
- 39 个云函数同步 + 全量部署

---

## 4. 星象速写功能移除

- 后端：从 `DEFAULT_SUBSCRIPTION_CONFIG` 的 trial/free/pro/ultra 全部移除
- Admin：`SubscriptionPanel.vue` ALL_FEATURES 列表移除
- 前端：timeline 徽章、assessments 快照区块、token-usage 标签、about/explain 文案全部删除
- `admin.vue` 删除 sideRead 相关 AI 参数配置
- 订阅面板加载时自动过滤 `ALL_FEATURES` 不存在的功能（防旧数据残留）

---

## 5. UI 统一

### 5.1 五页 Hero 样式统一
- index.vue：`hero-block`/`hero-tag` 旧命名 → `hero-block-v2`/`hero-tag-v2`，使用 `@include hero-block-v2`
- case-detail.vue：硬编码字体 → SCSS 变量
- timeline.vue：`hl-v2` 硬编码 `#FFD93D` → `var(--accent)`
- 五页 Hero 描述文字统一规范：字号 `$fs-body-lg`、字重 `$fw-body`、颜色 `rgba(0,0,0,0.7)`

### 5.2 今日桃花卡片重设计
- 参照 `design-mockups/taohua-card-v2.html` 方案三 · 花瓣散落
- 粉→暖白渐变、竖排方位列表、气场进度条、引用块引导语、白底 CTA

### 5.3 "今日" Hero crush type 极简化
- 黄底卡片 → 单行黑底黄字 badge，去掉解释文字

### 5.4 "我"页面重构
- 本人画像搬入 Hero，没填时引导完善
- 账号信息 + Credits 合并为一张卡片
- "显示陪伴助手"开关挪到陪伴形象卡片
- 删去邮箱显示（已无邮箱注册）

### 5.5 Token → Credits 统一
- 消费明细 hero：TOKEN USAGE → CREDITS USAGE
- 消费明细列表：删除模型名称、删除入/出 Token 数
- 语音识别：删除"腾讯云 ASR 单独计费"文案
- 金币动画：TOKEN → Credits
- 新建 Crush 页面：加 AI 生成提示语

---

## 6. 订阅虚拟支付切换

- 升级套餐从 `short_series_goods` 切换为 `short_series_coin`
- 去掉 `productId`，`buyQuantity` 改为 `amountFen`（与加油包一致）
- 解决 `PRODUCT_ID_NOT_PUBLISH` 错误

---

## 7. 其他

- Admin 用户管理列表新增 OpenID 列（完整显示）
- 快速记录粘贴提示删除品牌名（华为/鸿蒙/vivo → "部分手机"）
- AI 分析徽章简化："AI DeepSeek · deepseek-chat 生成分析" → "AI 生成分析，内容仅供参考。"
- postbuild 注释说明 `__usePrivacyCheck__` 不注入的原因

---

## 8. crush代币方案（讨论中）

- 用户考虑前端统一用微信虚拟支付原生代币（1元=100代币）
- 方案 A：前端直接算（零后端改动），`1代币 = tokensPerYuan ÷ 100 Credits`
- 消费粒度问题：小数代币显示不友好，待定

---

## 回归测试

28 PASS, 0 FAIL（始终通过）
