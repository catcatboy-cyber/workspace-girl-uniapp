# 2026-05-30 工作总结

## 一、概念命名全面统一

审计全系统 46 处概念不一致，按用户决策统一：
- Tab bar 概念延伸至页面标题、按钮文案、hero tag
- 核心概念：对象/案例/关系对象 → Crush/Crushes（按单复数）
- 时间线/互动时间轴 → 往事
- 关系主页 → 我们
- Hero tag 全部英文化（Crush Master BOARD、CRUSHES、ASSESSMENTS、MEMORIES 等）
- 侧写 → 星象速写（前后端 + 云函数全链路，含 AI 输出 sanitize 兜底）

## 二、小咪帮你说大改版

1. **API 并行调用**：回复生成 + 策略生成从串行改为 Promise.all，同时出现不再分两次
2. **读秒闪烁**：生成中显示 `◼ 后台分析中，已用时 X 秒`，与首页本次分析风格统一
3. **语气 + 策略合并**：选一种语气（4项）+ 小咪支招（2项）→ 统一为"选一种方式"（5项）
   - 去掉暧昧轻撩（与先冷后甜重叠）
   - 单轮回复样式统一为多轮策略同款黄色左边框卡片
4. **策略重命名**：反转 → 先冷后甜，引导拉近 → 投石问路（主动）/ 顺水推舟（被动）
5. **风格统一**：PetSpeakSheet 灰色调边框全部拉齐为主站 #111 黑边框硬边风格，选中态改为黑底黄字

## 三、按钮颜色系统审计 & 统一

审计全系统 67 个按钮/选择器：
- **设计规范确立**：绿色 #4ECDC4 = 主操作，白色 #fff = 次要，黄色 #FFD93D = 装饰
- 4 个页面 base .btn-v2 绿→白，拆出 .primary 绿色变体
- 5 处黄按钮→绿/白（PetSpeakSheet 生成按钮、assessments mini-link、explain-arrow-v2 ×2）

## 四、首页星象速写增强

- 一眼看穿触发后添加读秒 + 闪烁效果（与本次分析一致）
- AI 返回内容中的"侧写"→ 后端 sanitize 兜底
- 周复盘星象速写同样加 sanitize（之前漏了 weeklyReview 路径）

## 五、周复盘 & 趋势图修复

- 周复盘页"重新生成本周复盘"和"重新生成本周星象速写"加新事件检测（无新事件 disabled + 显示"还没新事件"）
- 趋势图样式优化：圆点 34→22rpx、线条 5→3rpx、去光晕、Y轴字号缩小

## 六、语音识别计费 & 追踪

- 新增 `getVoiceUsage` 云函数 + API + cloudbaserc.json 注册
- speechToText 成功后写入 voice_usage 集合（userId + durationMs + 时间戳）
- me 页面能量卡片加"语音识别 X 次"统计
- 消费明细页新增加"语音识别"记录区（显示每次时长）
- about.vue 修正：语音识别由腾讯云 ASR 单独计费，不消耗 Token

## 七、AI 风格 & 其他小修复

- 闺蜜直给 → 不绕弯子（无性别区分，me + admin 同步）
- AI 陪伴风格 / 建议力度 / AI 风格状态 三个卡片合并为一个"AI 分析风格"板块
- 本人画像移到 Hero 下方
- 往事分析记录附件文件名溢出修复
- 保存 AI 风格按钮换行修复

## 八、商业模式文档

完成 Crush Master 定价方案 v1.0，输出 BUSINESS-MODEL.md + BUSINESS-MODEL.html：
- 基于真实 Token 消耗数据的订阅方案（免费/Pro ¥19/无限 ¥49）
- 增值 Token 包策略（¥9/¥18/¥38）
- 功能开放矩阵、收入预测、增长飞轮、竞争壁垒
- Campus Pop 风格 HTML 版本，可直接浏览器查看

## 九、部署

部署 5 个云函数：getVoiceUsage、speechToText、generateSideRead、weeklyReview、petLines

---

**改动统计**：约 25 个文件修改，35+ 处 UI 概念统一，12 处按钮颜色修正，3 个新云函数/文件
