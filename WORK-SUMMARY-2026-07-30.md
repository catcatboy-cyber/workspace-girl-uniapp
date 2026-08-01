# 工作总结 · 2026-07-30

## 一、需求方案

### 1. 老娄布道 AI 风格

- 新增第 6 种 AI 分析风格，完全替换输出格式为 `【老娄诊断】→【你的人性课】→【你给我听着】→【老娄最后送你一句话】`
- 从 GitHub + 知乎 + Web 搜索收集老娄布道真实语料，覆盖 13 个高频场景
- 方案覆盖完整调用链（6 处独立白名单 + effectiveStyleKey 安全覆盖 + 前端硬编码标签动态化 + 历史兼容）
- 落盘 `LAO-LOU-AI-STYLE-DEV-PLAN.md`

### 2. 婚姻原型测试

- 从"8 种历史名人"方案演进为"3 个深度婚姻原型"（冉莹颖/佟晨洁/谢杏芳）
- 方案 A（每人专属问卷）vs 方案 B（通用问卷+向量匹配）对比后选择方案 A
- 6 题筛选器 + 每人 15 题 Likert 量表 + 三层心理画像报告
- 不输出二元判定，只输出倾向程度
- 落盘 `CELEBRITY-ARCHETYPE-DEV-PLAN.md`

### 3. 去掉 subjectRole 手动选择

- 核心决策：日常记录裸送 AI，聊天记录粘贴自动检测
- 经过 7 轮迭代 + 4 次代码审计，从 6 文件方案演进到 9 文件精确方案
- v7（不考虑旧数据）：9 文件，~120 行改动
- 核心架构：DB promptModules 是主体识别规则唯一所有者，代码只做 fallback + 结构性拼接
- 落盘 `REMOVE-SUBJECT-ROLE-V7-NO-LEGACY.md`

### 4. 快速提问后台可配置

- 首页和 quick-read 的提问选项从硬编码改为后台 Admin 面板可配
- 集成到 `LAO-LOU-AI-STYLE-DEV-PLAN.md` 中

### 5. 产品介绍视频文案

- 覆盖全部 8 个功能模块的推广文案
- 3 套视频结构（抖音 45s / B站 90s / 对比向 60s）
- 金句素材库 + 视觉建议 + 发布 checklist
- 落盘 `PRODUCT-INTRO-VIDEO.md`

---

## 二、Bug 修复

### 小咪聊天「帮我回复TA」来源标记

- 问题：用户输入 TA 原话后，聊天记录里显示「我」，无法区分是谁说的
- 修复 5 处：
  - 前端发送时保存 `mode: modeForRequest`
  - 前端展示时 `mode === 'reply'` 加「对方说：」前缀
  - 后端 `savePetChatHistory` 的 userMsg 持久化 mode
  - 后端旧历史根据紧邻 pet 消息恢复 mode
  - 后端 `toLLMMessages` 根据 mode 标记历史来源发给 AI
- 完整审计文档 `PET-SPEAK-TA-QUOTE-AUDIT.md`

---

## 三、UI 效果图

- 婚姻原型测试完整交互原型 `design/marriage-archetype-mockup.html`
- 包含入口页 → 筛选器 → 答题 → 报告完整流程
- 同时展示婚姻原型和 Crush 名人两条产品线

---

## 四、虚拟支付排查

- 分析微信审核"未接入虚拟支付"通知的根因
- 结论：代码本身正确（已使用 `wx.requestVirtualPayment`），问题在于代币模式 vs 道具模式的选择
- 建议改用 `short_series_goods` 道具模式，每个加油包档位作为一个独立道具

---

## 五、Git 提交

```
07cd698 docs: fix v7 — dedup DB rules injection, expand confidence deletion scope, add admin validation
42a2709 docs: add v7 subject-role plan without legacy data compatibility
32be85f docs: add dev plans for lao-lou AI style, celebrity archetypes, subject-role removal, pet-speak TA quote fix
```
