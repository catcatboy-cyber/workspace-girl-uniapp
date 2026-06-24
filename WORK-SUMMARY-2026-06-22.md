# 2026-06-22 工作总结

## 一、cases.vue 分享标题
- `Crush Master｜Crushes` → `TA已经把你设置为Crush了。`

## 二、AI 提示词精简

### 安全护栏：5组16条 → 公共3条
- `cloudfunctions/_shared/ai-prompt-config.js` — 替换为单一 `SAFETY_GUARDRAILS` 数组
- `cloudfunctions/adminManage/index.js` — `PROMPT_FIXED_GUARDRAILS` 改为 `COMMON_LOCKED_RULES`
- 每次 AI 调用 system 消息削减 ~75%
- 已同步到全部 41 个云函数

### 事件评估快照瘦身
- `cloudfunctions/_shared/ai-event.js` — `Current assessment` 从 5 字段（intentScore/riskScore/evidenceLevel/labels/nextAction）减为 2 个分数：`基线分: intent=70 risk=35`

### 删除 currentStatus 冗余提示
- 移除 `currentStatus only needs tags,summary,caution` — outputSchema 已定义结构，代码 normalizeCurrentStatus() 兜底

### 已提交 git
- commit `ec950f6`：225 files, +16882/-3629

## 三、AI 提示词全量文档
- `design-previews/ai-prompts-inventory.html` — 11 个 AI 调用点，按顺序列出完整 system/user 消息
- 标注硬编码/后台可配/只读

## 四、待清理：星象速写（sideRead）完整调用链已死

经排查确认以下调用链全部无效：

| 组件 | 状态 |
|------|------|
| `generateSideRead` 云函数 | 死 — 无前端调用 |
| `weeklyReview` 里 `generateMonthlySideRead()` | 死 — 仅 `action='generateSideRead'` 可达，无前端触发 |
| `weeklyReview` 里 `buildAIWeeklySideRead()` | 死 — 同上 |
| `api.ts` 的 `generateMonthlySideRead()` | 死 — 零引用 |
| `ai-prompt-config.js` 的 `sideRead` 模块 | 可删 — 无调用者 |
| admin 面板 sideRead 配置 | 可删 |
| 前端 `timeline.vue` 展示 `sideReadAdvice` | **保留** — 数据来自事件评估，与 weeklyReview 无关 |

## 五、下一步讨论待办
- 提示词上下文继续瘦身（eventInsight 枚举、petMood 枚举、rationale 长度等）
- 清除 sideRead 死链

## 六、搁置计划

### 桃花匹配度独立分享（待启动）
- 设计专属双人匹配分享图（双方生肖+星座+匹配关系+分数）
- 新建 `taohua-pair-share` 落地页（参考 taohua-share.vue 模式，展示匹配详情 + CTA）
- 改 taohua.vue 配对分享按钮指向新落地页
- 详细计划见 `design-previews/plans/taohua-pair-share-plan.md`
