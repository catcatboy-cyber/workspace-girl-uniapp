# 工作总结 - 2026-05-21

## 概览

今天主要围绕 AI 调用链、余额阻断验证、侧写生成、后台提示词配置和新 UI 清理计划推进。核心结果是：即时反馈新增结构化 `eventInsight`，后台提示词配置改为中文-only，并把固定输入上下文、固定返回结构、固定返回要求从可编辑输出要求中拆出，放到只读区展示。

---

## 1. 余额阻断与侧写生成修复

### 已验证/处理

- 验证“重新生成本周侧写”在余额不足时返回 `INSUFFICIENT_BALANCE`。
- 修复生成属相星座侧写时云函数报错：
  - 错误：`SyntaxError: Identifier 'recordTokenUsage' has already been declared`
  - 修复点：`generateSideRead` 内重复声明 `recordTokenUsage`。
- 修复新建对象后首页尚无即时反馈记录时，属相星座侧写按钮不应可点击的问题：
  - 新增即时反馈记录存在性判断。
  - 无记录时按钮置灰，并提示先记录事件并生成即时反馈。

### 相关云函数

- `generateSideRead`
- `weeklyReview`
- `getTokenUsage`

---

## 2. 新 UI 清理计划

### 结论

重新核对后确认：部分经典版页面已经没有新版入口，不再需要继续改造这些已不可达旧页面。

### 已落盘文档

- `NEW-UI-CLEANUP-PLAN-2026-05-21.md`

### 当前原则

- 新版没有入口的经典版页面，不再投入 UI 改造。
- 后续只清理仍可达、仍影响用户路径的页面。
- 避免为了“全量替换”改动不可达历史页面，减少风险。

---

## 3. Hatch Pet / 小米宠物资源集成方案

### 已完成

- 安装并启用 `hatch-pet` 技能。
- 审阅 `xiaomi/xiaomi` 下的宠物资源目录。
- 形成电子宠物集成创意方案，重点讨论：
  - 是否能集成到小程序。
  - 资源放置位置和加载方式。
  - 是否让 AI 结果由宠物“说出来”。

### 已落盘文档

- `XIAOMI-PET-INTEGRATION-IDEAS-2026-05-21.md`

### 建议方向

- 不直接把宠物作为核心流程入口，先作为首页/反馈结果的轻量陪伴层。
- AI 即时反馈、周复盘、侧写结果可抽取一句短话，由宠物气泡表达。
- 宠物说话适合做“情绪缓冲”和“结果摘要”，完整分析仍保留在结构化卡片里。

---

## 4. AI 调用点审计

### 当前系统内 AI 调用点

- `analyzeAttachment`
  - 图片/聊天截图识别。
  - prompt module：`attachmentAnalysis`
- `speechToText`
  - 腾讯 ASR，非 LLM。
- `createTimeline`
  - 当前不做 AI 事件理解，强制 `aiEnabled: false`。
- `generateAssessmentAI`
  - 首页即时反馈核心 AI 调用。
  - prompt module：`eventAssessment`
- `generateSideRead`
  - 即时属相星座侧写。
  - prompt module：`sideRead`
- `weeklyReview`
  - 本周复盘。
  - prompt module：`weeklyReview`
- `weeklyReview`
  - 本周侧写。
  - prompt module：`sideRead`
- `testAIConnection`
  - 只发送 `ping` 测试模型连通性。

---

## 5. 即时反馈新增 eventInsight

### 背景

原业务规则要求“必须区分谁主动、谁回应、谁拒绝、谁兑现；必须区分事实和感受”，但 AI 返回结构里没有对应字段，导致后续展示和判断依据无法显式承接这些规则。

### 已实现结构

新增 `eventInsight`：

```json
{
  "actor": "target|self|both|unknown",
  "interaction": "initiated|responded|rejected|delayed|fulfilled|promised|observed|unclear",
  "commitmentStatus": "none|promised|fulfilled|broken|unclear",
  "evidenceType": "fact|feeling|mixed|unclear"
}
```

### 前端展示

首页即时反馈“判断依据”区域新增标签：

- 行为主体：对方动作 / 我的动作 / 双方互动 / 主体不清
- 互动性质：主动 / 回应 / 拒绝 / 拖延 / 兑现 / 承诺 / 观察记录 / 互动不明
- 承诺状态：有承诺 / 已兑现 / 未兑现 / 兑现不明
- 依据类型：事实依据 / 感受为主 / 事实+感受 / 依据不清

### 涉及文件

- `cloudfunctions/generateAssessmentAI/_shared/ai-event.js`
- `src/pages/index/index.vue`
- `cloudfunctions/adminManage/index.js`
- `cloudfunctions/getAISettings/index.js`
- `cloudfunctions/updateAISettings/index.js`

---

## 6. 后台提示词配置中文-only

### 已调整

- 后台提示词配置页不再显示：
  - `English name`
  - `Role (English)`
  - `Task (English)`
  - `English label`
  - `English prompt`
- 业务规则输入改为每行一条中文。
- 陪伴风格模板只保留中文标签、中文文案。
- 保存新配置时会清空英文配置字段。
- 实际拼给模型的提示词只取中文，不再拼接 `EN:`、英文角色、英文任务、英文 persona 文案。

### 兼容策略

- 数据结构中仍保留 `en` 字段，避免破坏旧数据。
- 新保存的数据会把英文内容置空。

---

## 7. 固定上下文/固定返回结构从输出要求中拆出

### 用户指出的问题

后台“输出要求”里混入了这类固定内容：

- 固定输入上下文
- 固定返回结构
- 固定返回要求

这些内容不是业务判断标准，不应放在可编辑输出要求里。

### 已调整

后台配置页现在拆成：

- `输出要求`
  - 只写可调的业务判断标准。
- `固定输入上下文（只读）`
  - 当前评估快照
  - 本人画像
  - 对象画像
  - 最近事件
  - 本次事件
- `固定输出结构（只读）`
  - 包含 `eventInsight`
- `最终拼接预览（只读）`
  - 展示实际组装后的提示词。

### 自动清理

读取和保存 outputNotes 时，会自动剔除以下块：

- `固定输入上下文`
- `固定返回结构`
- `固定返回要求`

---

## 8. 部署与验证

### 构建/语法检查

- `node --check cloudfunctions/adminManage/index.js`
- `node --check cloudfunctions/getAISettings/index.js`
- `node --check cloudfunctions/updateAISettings/index.js`
- `node --check cloudfunctions/generateAssessmentAI/_shared/ai-event.js`
- `node --check cloudfunctions/generateAssessmentAI/_shared/ai-prompt-config.js`
- `npm.cmd run build:mp-weixin`

以上均通过。

### 已部署云函数

- `adminManage`
- `getAISettings`
- `updateAISettings`
- `generateAssessmentAI`
- `generateSideRead`
- `weeklyReview`
- `analyzeAttachment`
- `createTimeline`
- `deleteTimeline`

部署环境：

```text
cloud1-d8gqh3f5g49993a5a
```

### 本地后台服务

H5 后台服务当前运行在：

```text
http://localhost:5174/#/pages/admin/admin
```

原因：`5173` 已被占用，服务自动切到 `5174`。

---

## 9. Git 状态

### 已提交

```text
52aa9a4 fix side read balance handling
```

### 当前仍有未提交改动

主要包括：

- AI prompt 中文-only 调整。
- `eventInsight` 结构化返回和前端标签展示。
- 后台提示词配置页拆分固定只读区。
- 多个共享 prompt/persona 配置副本同步。
- 新 UI 相关页面改动仍在工作区。
- 两个新文档：
  - `NEW-UI-CLEANUP-PLAN-2026-05-21.md`
  - `XIAOMI-PET-INTEGRATION-IDEAS-2026-05-21.md`

未纳入提交的资源/目录：

- `.claude/`
- `design-previews/`
- `xiaomi.zip`
- `xiaomi/`

---

## 10. 明日建议

1. 在后台刷新 AI 设置页，确认：
   - 输出要求框只剩业务判断标准。
   - 固定输入上下文和固定输出结构显示在只读区。
   - `eventInsight` 能在固定输出结构中看到。
2. 在首页实际录入一条事件，验证即时反馈：
   - AI 返回包含 `eventInsight`。
   - 首页判断依据区显示主体、互动、承诺、依据类型标签。
3. 用余额不足账号再测：
   - 本周侧写。
   - 即时侧写。
   - 即时反馈。
4. 决定是否把今天改动拆分提交：
   - AI 结构化返回一组。
   - 后台提示词配置一组。
   - 文档一组。

