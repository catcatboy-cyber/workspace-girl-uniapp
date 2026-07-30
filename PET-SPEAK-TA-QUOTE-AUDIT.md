# 「帮我回复 TA」消息来源标记修复审计

## 1. 审计结论

原修改方案识别了前端即时消息和后端持久化缺少 `mode` 的问题，但只修改 3 处仍不足以完成整条链路。

最终交互语义确定为：

- 消息由用户提交给小咪，因此 `role` 保持为 `user`。
- 用户头像继续显示「我」。
- 消息内容属于用户转述的 TA 原话，因此气泡正文增加「对方说：」前缀。
- 不把头像改成「TA」或「对方」，避免用户误以为这是一条从真实聊天中同步的对方消息。
- 后端必须保存消息模式，并在后续发送历史上下文给 AI 时显式标记内容来源。

最终展示示例：

```text
我
对方说：周末再看吧，最近有点忙
```

完整修复应包含 5 个逻辑改动，涉及以下两个规范源文件：

- `src/components/PetSpeakSheet.vue`
- `cloudfunctions/petLines/index.js`

---

## 2. 当前链路审计

### 2.1 前端即时消息

`PetSpeakSheet.vue` 的 `sendMessage()` 在创建 `userMessage` 时没有保存当前模式：

```javascript
const userMessage: ChatMessage = {
  id: `user_${Date.now()}`,
  role: 'user',
  caseId: props.caseId || 'global',
  text
}
```

这会导致消息插入当前会话后、接口返回前，页面无法判断这条消息是不是用户转述的 TA 原话。

审计结论：需要修改。

### 2.2 即时回复 AI Prompt

reply bundle 会进入 `generateReplyPair()`，当前 prompt 已明确说明：

```text
对方说了一句话，用户不知道怎么回。
对方说的话：...
```

同时执行的多轮策略生成也明确使用：

```text
对方说的话：...
```

因此本次即时生成回复和多轮策略时，AI 已经能够正确理解输入是 TA 的原话。

审计结论：即时生成 prompt 正确，无需修改。

### 2.3 后端历史持久化

`savePetChatHistory()` 当前保存的数据存在不对称：

- `petMsg` 已保存 `mode`。
- `userMsg` 没有保存 `mode`。

因此重新加载历史时，用户消息失去了输入来源信息。

审计结论：需要给 `userMsg` 保存规范化后的 `mode`。

### 2.4 前端历史恢复

前端 `normalizeMessage()` 已支持读取：

```javascript
mode: normalizeChatMode(raw?.mode || raw?.intent)
```

`ChatMessage` 类型也已经包含可选的 `mode` 字段。

审计结论：新数据正确保存 `mode` 后，现有前端规范化函数可以直接使用，无需修改。

### 2.5 历史再次发送给 AI

这是原方案遗漏的主要问题。

`toLLMMessages()` 当前把所有历史 `role: user` 消息转换为：

```javascript
{
  role: 'user',
  content: item.text
}
```

该转换完全忽略 `item.mode`。即使数据库已经保存 `mode: 'reply'`，用户之后切回普通聊天继续追问时，AI 仍可能把 TA 原话理解为用户本人说过的话。

审计结论：必须根据 `mode` 给历史上下文增加语义标记。

---

## 3. 完整改动方案

### 3.1 前端即时消息保存 mode

文件：`src/components/PetSpeakSheet.vue`

修改 `sendMessage()` 中创建 `userMessage` 的代码：

```javascript
const userMessage: ChatMessage = {
  id: `user_${Date.now()}`,
  role: 'user',
  caseId: props.caseId || 'global',
  text,
  mode: modeForRequest
}
```

作用：

- 消息发送后无需刷新即可正确展示来源前缀。
- 即使接口仍在请求中，当前消息也不会被误认为用户本人说的话。

### 3.2 reply 消息气泡增加来源前缀

文件：`src/components/PetSpeakSheet.vue`

头像逻辑保持不变：

```vue
<view class="avatar">{{ message.role === 'user' ? '我' : petInitial }}</view>
```

修改普通消息气泡：

```vue
<view v-else class="message-bubble">
  <text
    v-if="message.role === 'user' && message.mode === 'reply'"
    class="message-source-prefix"
  >
    对方说：
  </text>
  <text class="message-text">{{ resolveMessageText(message) }}</text>
</view>
```

建议样式：

```scss
.message-source-prefix {
  font-size: $fs-caption;
  font-weight: $fw-heading;
  color: var(--text-muted, #666);
  margin-right: 6rpx;
}
```

要求：

- 必须有明确文字前缀，不能只靠颜色、左右位置或头像区分。
- 普通聊天和 `initiate` 模式不显示该前缀。
- 不修改消息的 `role`，仍保持为 `user`。

### 3.3 后端 userMsg 持久化 mode

文件：`cloudfunctions/petLines/index.js`

修改 `savePetChatHistory()` 中的 `userMsg`：

```javascript
const userMsg = {
  id: `u_${now.getTime()}`,
  role: 'user',
  caseId,
  text: cleanChatText(userText, 800),
  mode: normalizePetChatMode(petPayload.mode || petPayload.intent),
  time: now
}
```

不建议直接保存未经限制的任意字符串，应复用 `normalizePetChatMode()`。

现有相关调用方已经传入正确的 mode，因此不需要修改 `savePetChatHistory()` 的函数参数。

### 3.4 保守恢复旧历史的 mode

文件：`cloudfunctions/petLines/index.js`

旧数据的 `userMsg` 没有 mode，但其紧邻的 `petMsg` 通常已经保存：

- `mode`
- `requestedMode`
- `intent`

建议在 `normalizePetHistory()` 完成现有映射后执行一次保守回填：

```javascript
for (let i = 0; i < normalized.length - 1; i++) {
  const current = normalized[i]
  const next = normalized[i + 1]

  if (
    current.role === 'user' &&
    !current.mode &&
    next.role === 'pet' &&
    current.caseId === next.caseId
  ) {
    const inferredMode = normalizePetChatMode(
      next.requestedMode || next.mode || next.intent
    )

    if (inferredMode === 'reply' || inferredMode === 'initiate') {
      current.mode = inferredMode
    }
  }
}
```

约束：

- 只关联紧邻的 user/pet 消息。
- 必须属于同一个 `caseId`。
- 只回填 `reply` 或 `initiate`，不把缺少模式的普通旧消息强制写成 `chat`。
- 该操作只发生在读取和规范化过程中，不要求批量修改数据库旧数据。

这样可以同时修复：

- 旧历史的前端展示。
- 旧历史再次作为 AI 上下文时的说话人语义。

### 3.5 发给 AI 的历史上下文标注来源

文件：`cloudfunctions/petLines/index.js`

新增辅助函数：

```javascript
function buildHistoryPromptContent(item) {
  if (item.role !== 'user') return item.text

  if (item.mode === 'reply') {
    return `【用户转述的 TA 原话】${item.text}`
  }

  if (item.mode === 'initiate') {
    return `【用户想对 TA 表达的意思】${item.text}`
  }

  return item.text
}
```

修改 `toLLMMessages()` 中持久化历史的转换：

```javascript
const persisted = filterPetHistoryByCase(history, caseId)
  .slice(-20)
  .map((item) => ({
    role: item.role === 'user' ? 'user' : 'assistant',
    content: buildHistoryPromptContent(item)
  }))
```

处理后的语义：

| 消息模式 | 发给 AI 的历史内容 |
|---|---|
| `chat` 或无 mode | 原始用户文本 |
| `reply` | `【用户转述的 TA 原话】原始文本` |
| `initiate` | `【用户想对 TA 表达的意思】原始文本` |
| 宠物回复 | 原始宠物文本，角色为 `assistant` |

---

## 4. 不需要修改的部分

以下逻辑已经正确，应保持不变：

- reply 输入框已有「对方说：」提示。
- reply 输入框占位文案已经说明「粘贴对方说的原话」。
- `ChatMessage` 类型已经包含可选 `mode`。
- `normalizeMessage()` 已读取 `mode`。
- 即时 reply prompt 已明确标记 TA 原话。
- 多轮策略 prompt 已明确标记 TA 原话。
- 用户消息头像继续显示「我」。
- 用户消息仍使用 `role: 'user'`。
- `initiate` 模式表示用户想表达的意思，不显示「对方说：」。

---

## 5. 修正后的改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/components/PetSpeakSheet.vue` | 创建即时 `userMessage` 时保存 `mode: modeForRequest` |
| 2 | `src/components/PetSpeakSheet.vue` | `role === 'user' && mode === 'reply'` 时在气泡内显示「对方说：」 |
| 3 | `cloudfunctions/petLines/index.js` | `savePetChatHistory()` 的 `userMsg` 保存规范化后的 mode |
| 4 | `cloudfunctions/petLines/index.js` | `normalizePetHistory()` 根据紧邻 pet 消息保守恢复旧 user 消息的 mode |
| 5 | `cloudfunctions/petLines/index.js` | `toLLMMessages()` 根据 mode 标记历史内容来源 |

---

## 6. 验收矩阵

| # | 测试场景 | 预期结果 |
|---|---|---|
| T1 | 在「帮我回复TA」输入 TA 原话并发送 | 当前会话立即显示「对方说：原话」 |
| T2 | 消息已插入但接口仍在请求 | 用户消息已经带有「对方说：」前缀 |
| T3 | 关闭并重新打开聊天面板 | 新 reply 历史仍显示「对方说：」 |
| T4 | 加载旧 reply 历史 | 根据下一条 pet 消息保守恢复 mode，并显示前缀 |
| T5 | 普通「和小咪聊」模式发送消息 | 显示原始用户文本，不出现前缀 |
| T6 | 「主动开口」模式发送内容 | 头像仍为「我」，不出现「对方说：」 |
| T7 | reply 后切回普通聊天继续追问 | AI 历史中出现 `【用户转述的 TA 原话】` |
| T8 | initiate 后切回普通聊天继续追问 | AI 历史中出现 `【用户想对 TA 表达的意思】` |
| T9 | 即时生成 reply | AI prompt 继续包含「对方说的话」 |
| T10 | 同时生成多轮策略 | 策略 prompt 继续包含「对方说的话」 |
| T11 | 普通旧历史没有可推断的模式 | 保持原样，不错误增加前缀 |
| T12 | 不同 case 的相邻历史消息 | 不跨 case 推断 mode |

---

## 7. 最终结论

保留头像「我」是正确的，因为这条消息是用户提交给小咪的内容，而不是系统直接收到的 TA 消息。

气泡中的「对方说：」前缀负责表达内容来源，两者组合后的语义最清楚：

- 「我」表示提交者是当前用户。
- 「对方说：」表示正文是用户转述的 TA 原话。

但完整修复不能只停留在前端展示和数据库保存。还必须修复旧历史的模式恢复，以及历史再次发送给 AI 时的来源标记。否则当前页面看起来正确，后续 AI 仍可能错误理解对话参与者。
