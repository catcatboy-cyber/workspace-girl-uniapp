# 2026-06-05 工作总结

## 一、登录页加载慢修复

- 根因：`pages.json` 首页 index 为第一页，新用户冷启动先挂载 1700+ 行组件树，然后发现未登录才跳转，全部工作白费
- 修复：login 移到 pages.json 第一位（入口页），login.vue 加已登录检查直跳首页
- index.vue 加 `v-if="_uid"` 门控，无用户时只渲染空 view，不构造重组件
- App.vue 的 onLaunch 重定向清理（`uni.reLaunch` 异步无法阻止首页挂载）

## 二、设计系统一致性（审计 + 修复三批）

### 第一批：语义颜色修正
- index `.role-chip.active` 白字→黄字 `#FFD93D`（17/20 处遵循设计规范）
- timeline `.filter-chip-v2.active` 白字→黄字
- login `.check-v2.checked` 保留白字（特殊元素）

### 第二批：首页组件对齐 v2 规范
- `.btn-v2.primary` shadow: 6rpx→4rpx（统一按钮级阴影）
- KPI 组件类名：`kpi-strip`→`kpi-strip-v2`、`kpi-cell`→`kpi-cell-v2`
- Tag 类名：`tag-row`→`tag-row-v2`、`tag`→`tag-v2`，尺寸统一 36rpx/4rpx 14rpx
- `.picker-v2`：加固定高度 56rpx，border 2rpx→3rpx

### 第三批：全局碎片整理（11 处）
- section-title 4 页的 32rpx→22rpx uppercase
- edit-profile tag-v2 样式对齐、picker-v2 border 2→3rpx
- me.vue hero-block 3px→3rpx
- custom-pet/feedback 按钮 shadow 6→4rpx
- case-detail/cases notice-v2 补充 `.warn` 态
- stats-grid gap 统一 8rpx，stat-box 统一 padding
- 青蓝色边框 (#4ECDC4) 语义规则全审计通过

## 三、"甩张图"缩略图展示

- 文件名文本列表 → 160rpx 方形缩略图网格
- 复用 custom-pet 的 `img-grid-v2` 模式
- "往事"（timeline）+ "分析记录"（assessments）同步改造
- 聊天截图缩略图左上角加"聊"角标（黄底黑字）
- 缩略图无边框，圆角 4rpx

## 四、AI 图片理解分析与展示

- 诊断：`analyzeAttachment` 云函数逐张调用 OpenAI 视觉 API（`image_url`），分析结果仅存库不展示
- 修复：createTimeline 保留 `suggestedTitle` 字段（之前被丢弃）
- 新增：聊天截图缩略图下方展示 AI 提取文字（虚线框等宽风格）+ 摘要 + 可信度标签
- 普通图片：展示 AI 摘要 + 可信度
- 可信度标签色：高=绿色、中=黄色、低=灰色
- 之后受用户要求暂停 AI 图片调用（效果不好），改为仅作附件上传

## 五、往事时间轴全面改版

### 分析记录（assessments tab）
- 嵌套边框从 4 层精简为 1 层 + 彩色左边框分区
- assessment-card-v2、score-block-v2 去全边框中
- reason-box 黄左边框、status-box 黑左边框、action-box 青蓝左边框
- side-inline-v2 虚线左边框、img-analysis-card 灰左边框
- delta 变化值从独立大黑框合并到分数条下方（轻量 inline）
- 事件列表包一层 card-v2 外框（和关键事件结构对齐）
- 统计卡片 border-color 对齐 #4ECDC4
- 加 `section-title-v2` "分析记录 · 当前查看全部记录" 说明文字

### 14天复盘
- timeline 记录去重：先删同 reviewId 旧记录再插新
- 时间轴左侧显示日历双周起止日期（`5/19 ↓ 6/2`），替代生成时间
- 标题改为"14天复盘 · 按日历双周归档" + "按自然双周划分，每周期仅保留最新生成记录"
- 分区从黑色顶线改为彩色左边框：黄=关键变化/黑=关键事件/青蓝=观察重点/红=避免误判
- 星象速写改为虚线左边框
- 保留底部"记录于"灰色小字

### 关键事件
- 事件行边框 solid→dashed

## 六、语义标签系统扩展

- 场景词汇从 8 种扩展到 20 种（gift, phone_call, online_chat, shopping, activity, study, work, travel, game, sport, music, pet, food...）
- AI prompt 加强制中文输出指令
- AI 加可选标签列表约束："必须从可选值中选择，不要自创标签"
- `offline_meet` 仅作为无具体活动时的兜底（关键词匹配改为 `scene.length === 0` 才触发）
- 前端 labelMap 补旧 key 别名（walk_shop, trip, group_social）

## 七、入场动画扩展到全部 tab 页

- 动画 CSS 从 index.vue scoped 提到 App.vue 全局
- case-detail、cases、timeline、me 各加 hero/card/button 动画 class
- 微信 tab 页保活，切回不重播；杀进程后重新播放

## 八、字体大小功能

- theme.ts 新增 `getFontSizeMode` / `setFontSizeMode`
- "我"页面新增"字体大小"设置卡片（默认 / 大字体）
- App.vue 全局 ~170 行 `.font-large` 覆盖规则，15 个字号层级全部 `!important`（突破 scoped style 特异性）
- 5 个 tab 页用响应式 `fontSizeMode` ref（非 `uni.getStorageSync`）

### 修复过程中的关键发现
- 微信小程序 scoped style 加 `[data-v-xxxx]` 属性，特异性高于全局规则 → 必须 `!important`
- 全项目 180+ 个设了 font-size 的类名，最初只覆盖了 30 个
- WXSS 不支持 CSS 转义点号（`\.en-title` → `.en-title`）

## 九、字体一致性全面审计与修复

- 全项目 21 页面按功能角色审计 font-size
- 修复 11 处偏离：hero-copy 24→26rpx、button 24→26rpx（7 个页面）、score-label 20→18rpx、picker 28→24rpx
- index.vue "小咪帮你看"和"星象速写"字体层级完全对齐（区块标题/子项标签/子项正文 三层一致）
- `delta-val` 合并显示到分数卡片内（score-delta-v2），移除独立 delta-row 大黑框

## 十、首页本次分析标签精简

- 去掉标题栏重复的 eventType badge
- eventType 保留在状态标签行（和其他状态标签并列，不重复）

## 十一、其他修复

- "我们" case-detail 近14天星象速写标题重复（删除 AI 返回的 title）
- timeline 分析记录统计卡片加 `activeAssessmentFilterLabel` computed
- `pages/new/new` 误删恢复
- login 第一位导致新增的 new.vue CRUSH 页路径保持

---

**改动统计**：约 30 个文件修改，云函数 3 个（createTimeline、weeklyReview、event-understanding/event-tagger 共享模块），前端构建 3 次。未提交。
