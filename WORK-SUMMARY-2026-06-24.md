# 2026-06-24 工作总结

## 一、UI 边框清理（跨多个页面）

### 编辑画像
- 删除"趣味画像解读"卡片（模板 + 计算属性 + 导入 + 样式），`edit-profile.vue`

### 桃花人设卡片
- 去掉 `persona-card-v2` 内层 3rpx 黑边 + 阴影，消除 card-v2 → persona-card-v2 双层框套框

### 首页 · 本次分析
- `action-item` 段间改为 `2rpx solid rgba(0,0,0,0.08)` 分隔线，与往事页统一
- AI 参与标签：成功时不显示 badge，仅 AI 失败/未启用时显示橙色"规则兜底"
- 进度条意向色从黑色改为青色 `#4ECDC4`，与设计系统一致

### 往事页 · 事件流（大量改动）
- **去掉标题**：删除 `event-title-v2`，正文 `event-desc-v2` 直接展示（朋友圈风格）
- **去掉 AI 标签**：移除 `[AI]` 标签及 `didAIReview` 函数
- **新增场景标签**：正文下方显示筛选标签（碰面/电影/吃饭…），与顶部筛选联动
- **角色标签移到正文下方**：与场景标签同行
- **去边框**：去掉 `event-row-v2` 2rpx dashed 边框 + `analysis-summary-v2` 2rpx solid 边框 + `expanded-analysis-v2` 2rpx dashed 外框
- **进度条升级**：摘要条加迷你进度条（56×8rpx，意向青色/风险红色）+ "展开"/"收起"文字 + 风险变化值
- **展开去重**：删除 `score-block-v2`（大字分数+柱状条），摘要条已展示过
- **action-item 分隔**：段间 `2rpx solid rgba(0,0,0,0.08)` 分隔线

### 桃花匹配度
- `.pair-summary-desc-v2` `text-align: center` → `left`，匹配描述左对齐可换行

## 二、上架审计 & 修复（4 轮）

### 首轮审计 → 8 项致命/高优
1. dist/app.json 缺隐私字段 → **postbuild 脚本强制注入**
2. 缺 privacy.json → **新增，5 类数据声明**
3. 命理桃花 MOCK 兜底 → **`allowMockTaohuaFallback` 守卫**
4. 14 云函数 Nodejs16.13 → **全部迁移 Nodejs18.15**
5. console.log 泄露 PII → **清理 App.vue 日志**
6. 硬编码默认生肖/星座 → **改为空字符串**
7. 重复 _tmpUpdateUser → **删除**
8. README 旧 envId → **清理**

### 次轮审计 → petLines token 机制
- 自造轮子 `ensureTokenAccount`/`recordReplyTokenUsage` → **改用共享 `recordTokenUsage()`**
- 新旧双系统同时扣 → **统一走共享模块**
- 估算不一致、硬编码成本 → **常量化 `REPLY_PAIR_EST_TOKENS=700`/`QA_GEN_EST_TOKENS=300`**
- quickRead 无 token 控制 → **补全 `checkFeatureAccess` + `checkTokenBalance` + `recordTokenUsage`**

### 三轮审计 → 收尾
- wechatLogin PII 日志 → **新增 `safeWechatError()` 脱敏函数**
- tmpUpdateUser 后门 → **彻底删除**
- dist 生产配置 → **postbuild 强制修正 urlCheck/postcss/minified**
- cloudbase.ts 会话过期 → **AUTH_SESSION_REQUIRED 强制重登**
- theme.ts fallback → **'pine-mist' → 'campus-pop'**

### 四轮终审
- 16/16 项全部通过 ✅
- 构建产物确认：无 mock-data.js、project.config.json 生产配置、app.json 合规

## 三、Token 使用量全系统审计

### 发现的问题（未修）

| 严重度 | 问题 | 位置 |
|--------|------|------|
| 🔴 | generatePairRead 双重扣费 | `generatePairRead/index.js:196-197` |
| 🔴 | tagQAStrategies 完全无 token 管控 | `petLines/index.js:999-1077` |
| 🔴 | createTimeline 空扣门神(检查700但从不调AI) | `createTimeline/index.js:293` |
| 🟡 | generateReplyStrategy 缺 model 追踪 | `petLines/index.js:1169` |
| 🟡 | 5 处估算值与 AI max_tokens 不匹配 | petLines、generatePairRead |
| 🟡 | tagLinesLoop 不记实耗(永远700) | `petLines/index.js:644` |

## 四、讨论与设计方向

### 分享落地页重构
- 保留落地页A（静态展示），砍掉落地页B（独立功能页）
- "我也测测" → 小咪对话式引导 → 画像完成 → 进首页
- 全部分享入口统一流程

### 评估重评逻辑
- 14 道题独立计算 vs AI 事件累积计算，两套逻辑保持独立
- 建议始终显示重评入口，重评后给用户选择用哪个分数

### 全局去边框
- `campus-pop.scss` mixin 覆盖 ~60% 边框（card/hero/btn/tag）
- ~40% 边框散落在组件 scoped 样式中，需逐个处理

## 五、Git 提交

```
72144c7 UI优化：去边框、去标题、加场景标签、改进度条、左对齐
a974ff2 chore: 云函数共享模块同步、LF规范化、组件样式更新
```
