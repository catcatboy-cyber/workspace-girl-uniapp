# 小米帮你说 — V1 开发计划

## 定位

不是聊天、不是关系分析。只做一件事：用户不知道怎么说时，给一两句**可直接发送的话术**。

## 用户流程

```
首页 XiaomiPet → 点击 → 底部弹窗 "小米帮你说"
  ├─ Tab A: 主动问对方  （用户想主动发起话题/邀约/关心）
  │   输入：我想表达的意思（如 "想约他周末出去玩"）
  │   AI + 话术库 → 推荐 1 句 + 备选 1 句
  │
  └─ Tab B: 对方说了什么（用户看到对方消息，不知道怎么回）
      输入：对方说的话（如 "周末加班没空"）
      AI + 话术库 → 推荐 1 句 + 备选 1 句
```

**两个场景都复用已做好的 AI + 话术数据库关联生成**（现有 petLines reply action 已验证通过）。

## 弹窗交互

```
┌──────────────────────────┐
│  小米帮你说              │ ×
├──────────────────────────┤
│  [主动问对方] [对方说了什么] │  ← Tab 切换
├──────────────────────────┤
│  对方说：                │  ← label 随 tab 变化
│  ┌────────────────────┐  │
│  │ (输入框)            │  │
│  └────────────────────┘  │
│  [生成话术]              │  ← 按钮，生成中显示 loading
├──────────────────────────┤
│  ★ 推荐                  │
│  ┌────────────────────┐  │
│  │ 生成的话术文本       │  │
│  └────────────────────┘  │
│  [复制]                  │  ← 复制到剪贴板，toast 提示
│                          │
│  ☆ 备选                  │
│  ┌────────────────────┐  │
│  │ 备选话术文本         │  │
│  └────────────────────┘  │
│  [复制]                  │
│                          │
│  [换一种说法]            │  ← 重新生成（每次消耗 token）
└──────────────────────────┘
```

### 额度不足流程

```
点击 [生成话术] 或 [换一种说法]
  → 云函数返回 { code: 'INSUFFICIENT_BALANCE', balance, required }
  → 弹窗 "额度不足，当前可用 X token，本次预估消耗 Y token"
  → [去充值] 跳转 /pages/token-recharge/token-recharge
  → [取消] 关闭弹窗
```

## 技术方案

### 1. 后端：扩展 `petLines` 云函数

新增 `replyPair` action：

```
输入：
  scene: 'active' | 'reply'     // A=主动发起, B=回复对方
  content: string                // 用户输入的内容
  caseId?: string                // 可选，用于取对象画像做个性化

内部流程：
  1. 余额检查 (checkBalance, ~400 tokens)
  2. 从话术库随机取 4 条（幽默+文艺混合）作为风格参考
  3. 根据 scene 选择 prompt 模板
  4. 调 AI（temperature 0.8, max_tokens 200），一次生成 2 句
  5. 记录 token 消费到 token_ledger_records (feature: petReply)
  6. 返回 { reply, alternative, inspirations }

输出：
  {
    success: true,
    reply: "推荐话术",
    alternative: "备选话术",
    inspirations: [{ category, text }],
    tokensUsed: 350
  }
```

**Scene A prompt（主动发起）：**
```
你是恋爱对话教练。用户想主动对心仪对象说一句话。
用户想表达的意思：{content}

参考风格（吸收后改写，不要直接复制）：
{inspirations}

请生成两句可以直接发送的话，用 JSON 返回：
- reply: 推荐版，自然真诚不做作，15-40字
- alternative: 备选版，更俏皮幽默，15-40字
```

**Scene B prompt（回复对方）：**
```
你是恋爱对话教练。对方说了一句话，用户不知道该怎么回。
对方说的话：{content}

参考风格（吸收后改写，不要直接复制）：
{inspirations}

请生成两句回复，用 JSON 返回：
- reply: 推荐版，自然得体，贴合语境，15-40字
- alternative: 备选版，更幽默俏皮，15-40字
```

**余额检查**（每次调用前）：
```javascript
const estCost = 400
const balCheck = await checkBalance(db, userId, estCost)
if (!balCheck.ok) {
  return { success: false, code: 'INSUFFICIENT_BALANCE', balance: balCheck.balance, required: balCheck.required }
}
```

### 2. 前端新增文件

| 文件 | 作用 |
|---|---|
| `src/components/PetSpeakSheet.vue` | 底部弹窗组件（模板+样式+逻辑） |

### 3. 前端修改文件

| 文件 | 改动 |
|---|---|
| `src/components/XiaomiPet.vue` | `<view @click="$emit('speak')">` 包裹根元素，emit speak 事件 |
| `src/pages/index/index.vue` | 引入 PetSpeakSheet，监听 `@speak` 打开弹窗 |
| `src/utils/api.ts` | 新增 `generatePetReplyPair(scene, content)` |

### 4. token 消耗与额度控制

| 操作 | 预估消耗 |
|---|---|
| 首次生成 2 句 | ~300-500 tokens |
| 换一种说法 | ~300-500 tokens |
| 费用 | 按后台计费倍率折算 |

- 每次调用前云函数侧 `checkBalance`
- 余额不足返回 `INSUFFICIENT_BALANCE`
- 前端用已有的 `handleInsufficientBalance()` 弹窗引导充值
- 消费记录 feature = `petReply`

## 实施步骤

| 步骤 | 内容 | 估时 |
|---|---|---|
| 1 | `petLines` 加 `replyPair` action：双场景 prompt + 余额检查 + token 记录 | 30min |
| 2 | 创建 `PetSpeakSheet.vue`：双 Tab + 输入框 + 生成按钮 + 双结果卡片 + 复制 + 换一种 + loading/错误/余额不足状态 | 1h |
| 3 | `XiaomiPet.vue` 加点击事件 + `api.ts` 封装 + `index.vue` 集成 | 20min |
| 4 | 构建 H5 + 部署云函数 + 冒烟测试 | 15min |
| **合计** | | **~2h** |

## 明确不做

- 不做多轮对话
- 不做历史记录
- 不做话术评分/收藏
- 不做用户偏好记忆
- 不接微信直接发送
- Scene A 不接对象画像（V1 先简单做，后续可加个性化）
