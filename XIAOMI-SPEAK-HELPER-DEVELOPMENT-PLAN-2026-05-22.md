# 小米帮你说研发计划 - 2026-05-22

## 1. 功能定位

“小米帮你说”不是自由聊天，也不是完整关系分析。

它只解决一个问题：

**用户下一句话不知道怎么说时，小米给一两句可直接发送的话术。**

和现有功能的区隔：

- 快速记录：记录发生了什么，并生成即时反馈。
- 即时反馈：分析这件事说明什么。
- 小米帮你说：帮用户把下一句话说得更稳。

## 2. 第一版范围

第一版只做两个场景。

### 场景 A：我想主动问对方

用户没有对方原话，只是想主动开启话题。

输入：

- 我想做什么：
  - 主动找他
  - 约他
  - 试探他有没有兴趣
  - 确认他什么意思
  - 结束暧昧
- 语气：
  - 轻松
  - 温和
  - 有边界
- 可选补充：
  - 最近背景 / 想问的事

输出：

- 推荐一句
- 备选一句
- 不建议这样说

### 场景 B：对方说了一句话，我该怎么回

用户输入对方原话，小米给回复建议。

输入：

- 对方说了什么
- 我想达到什么目的：
  - 继续聊
  - 约出来
  - 确认态度
  - 拉开一点距离
  - 不想回太多
- 语气：
  - 轻松
  - 温和
  - 有边界

输出：

- 推荐一句
- 备选一句
- 不建议这样说

## 3. 首版交互

入口：

- 首页小米宠物区域增加按钮：`小米帮你说`
- 快速记录区域旁边可增加轻入口：`不知道怎么回？`
- 后续可在即时反馈结果卡片中增加：`让小米帮我回`

第一版推荐只放一个主入口：

```text
点击小米 -> 底部弹窗 -> 小米帮你说
```

底部弹窗结构：

```text
小米帮你说

[Tab] 主动问对方 / 对方说了什么

输入区
语气选择：轻松 / 温和 / 有边界
目的选择

[生成一句]

结果：
推荐：...
备选：...
不建议：...

[复制推荐句] [换一种说法] [用这句话生成记录]
```

## 4. 是否调用 AI

### 第一版建议：调用 AI，但只做短输出

原因：

- 话术生成需要贴合用户输入。
- 纯前端模板容易生硬。
- 输出很短，token 成本可控。

控制方式：

- 单独云函数。
- 严格限制输出 JSON。
- 每次只返回短句，不返回长分析。
- 失败时用前端模板兜底。

## 5. 新增云函数

建议新增：

```text
cloudfunctions/generatePetReply/
```

职责：

- 校验登录态。
- 校验 token 余额。
- 根据场景生成短话术。
- 记录 token 消耗。
- 返回结构化结果。

请求参数：

```ts
interface GeneratePetReplyRequest {
  scene: 'start_conversation' | 'reply_to_message'
  targetText?: string
  intent: string
  tone: 'light' | 'warm' | 'bounded'
  context?: string
  caseId?: string
}
```

返回结构：

```json
{
  "success": true,
  "scene": "reply_to_message",
  "tone": "bounded",
  "recommended": "可以，不过时间不确定的话，我就先安排自己的事啦。",
  "alternative": "好呀，那你先忙，等你确定时间再说。",
  "avoid": "不建议连续追问他到底什么时候有空。",
  "petLine": "小米：这句可以稳一点，把主动权留给对方。"
}
```

余额不足返回：

```json
{
  "success": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "额度不足",
  "balance": 0,
  "required": 100
}
```

## 6. Prompt 约束

核心要求：

- 只生成可发送的中文短句。
- 不做长篇关系分析。
- 不鼓励操控、试探过度、冷暴力、PUA。
- 不替用户表达极端情绪。
- 不承诺对方心理。
- 不使用油腻、压迫、讨好式话术。
- 每句不超过 40 个中文字符。

建议系统规则：

```text
你是“小米”，一个关系沟通话术助手。
你只帮助用户组织下一句话，不做完整关系分析。
输出必须温和、清楚、有边界。
不要教用户操控、诱导、测试、PUA 或情绪勒索。
不要替对方下心理结论。
只返回 JSON。
```

## 7. 前端改动

### 新增组件

```text
src/components/XiaomiSpeakHelper.vue
```

职责：

- 底部弹窗。
- 场景 Tab。
- 输入框。
- 目的选择。
- 语气选择。
- 生成按钮。
- 结果展示。
- 复制按钮。

### 新增 API 方法

```text
src/utils/api.ts
```

新增：

```ts
export async function generatePetReply(data: GeneratePetReplyRequest) {
  const res = await callFunction({
    name: 'generatePetReply',
    data
  })
  return res.result
}
```

### 首页接入

修改：

```text
src/pages/index/index.vue
```

新增状态：

```ts
const speakHelperVisible = ref(false)
```

小米区域点击：

```vue
<XiaomiPet @click="speakHelperVisible = true" />
<XiaomiSpeakHelper v-model:visible="speakHelperVisible" :case-id="latestCase?.caseId" />
```

如果第一版还没完成 `XiaomiPet.vue`，也可以先在快速记录模块加按钮：

```text
小米帮你说
```

## 8. 复制与记录

### 复制

结果区提供：

```text
复制推荐句
```

实现：

```ts
uni.setClipboardData({ data: recommended })
```

### 用这句话生成记录

第一版可选。

逻辑：

- 点击后把推荐句填入首页 `quickDesc`。
- 不自动提交。
- 让用户自己确认后点击“记一笔”。

按钮文案：

```text
放到快速记录
```

第一版建议：

- 先做复制。
- “放到快速记录”作为 P1。

## 9. 余额与计费

建议单次消耗低于即时反馈。

示例：

- 即时反馈：按现有规则。
- 小米帮你说：固定预估 100 token 或更低。

余额不足：

- 复用 `handleInsufficientBalance`。
- 弹窗前让小米显示失败态：

```text
小米：这次我算不动啦，先补一点额度再继续。
```

## 10. 兜底方案

AI 调用失败时，用前端模板返回。

示例：

### 主动约他

轻松：

```text
你这两天忙完了吗，要不要找个时间见一下？
```

温和：

```text
我想问下，你这周还有时间一起吃个饭吗？
```

有边界：

```text
如果你这周不太方便也没关系，我就先安排自己的事啦。
```

### 对方说“最近有点忙”

轻松：

```text
行，那你忙完记得补上这个约。
```

温和：

```text
好呀，那你先忙，等你空一点再说。
```

有边界：

```text
可以，时间不确定的话，我就先安排自己的事啦。
```

## 11. 开发步骤

### P0：最小可用版

1. 新增云函数 `generatePetReply`。
2. 新增前端 API `generatePetReply`。
3. 新增 `XiaomiSpeakHelper.vue`。
4. 首页增加入口按钮 `小米帮你说`。
5. 支持两个场景：
   - 主动问对方
   - 对方说了一句话
6. 支持三种语气：
   - 轻松
   - 温和
   - 有边界
7. 展示推荐、备选、不建议。
8. 支持复制推荐句。
9. 接入余额不足弹窗。

### P1：和宠物联动

1. 点击小米本体打开弹窗。
2. 生成中小米显示 `review`。
3. 生成成功小米显示 `jumping`。
4. 失败或额度不足显示 `failed`。
5. 支持“放到快速记录”。

### P2：结合即时反馈

1. 从最近一条事件带入上下文。
2. 从即时反馈带入 `eventInsight`。
3. 在即时反馈结果卡片增加 `让小米帮我回`。
4. 根据风险状态调整话术边界。

## 12. 验收标准

- 用户能在首页打开“小米帮你说”。
- 用户能选择“主动问对方”并生成话术。
- 用户能输入“对方说了什么”并生成回复。
- 输出包含推荐、备选、不建议。
- 点击复制能复制推荐句。
- AI 失败时有模板兜底。
- 余额不足时复用充值弹窗。
- 不影响快速记录和即时反馈原流程。
- H5 构建通过。
- 微信小程序构建通过。

## 13. 建议提交拆分

### Commit 1：云函数

```text
add pet reply generation function
```

### Commit 2：前端弹窗

```text
add xiaomi speak helper modal
```

### Commit 3：首页接入

```text
integrate xiaomi speak helper on home page
```

### Commit 4：文档

```text
document xiaomi speak helper plan
```
