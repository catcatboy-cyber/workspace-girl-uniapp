# Token 额度与充值研发计划 - 2026-05-20

## 需求理解

当前系统已经有 `token_usage_records`，用于记录模型真实返回的 token 消耗，并在“我的”和 `pages/token-usage/token-usage.vue` 展示消费明细。

本次需求要新增的是“可用额度账户”：

- 新用户首次赠送额度，例如 `1000000` 额度 token。
- AI 调用前检查余额，不足则提示充值。
- AI 调用后按模型和实际消耗扣除余额。
- 用户可在小程序内购买充值包，例如 `9.9`、`19.9`。
- 后台新增“充值配置”模块，配置充值档位、1 元兑换多少额度、不同模型的扣费倍率或兑换规则。

相关现有文件：

- `src/pages/me/me.vue`
- `src/pages/token-usage/token-usage.vue`
- `cloudfunctions/getTokenUsage/index.js`
- `cloudfunctions/_shared/token-usage.js`
- `cloudfunctions/adminManage/index.js`

## 核心设计

不建议直接用“真实模型 token”当余额单位，建议定义一个业务单位：`额度 token`。原因是不同模型成本不同，后台才能配置“同样消耗 1000 模型 token，扣多少额度”。

扣费公式：

```text
扣除额度 = ceil(真实 totalTokens * 模型扣费倍率)
```

示例：

- `deepseek-chat` 倍率 `1`
- `gpt-4.1-mini` 倍率 `2`
- `gpt-4.1` 倍率 `5`

充值公式：

```text
到账额度 = 支付金额元 * 每元兑换额度 + 档位赠送额度
```

示例：

- `1 元 = 100000 额度 token`
- `9.9 元 = 990000`
- `19.9 元 = 1990000 + 赠送 100000`

## 数据表设计

### token_accounts

用户额度账户。

```js
{
  userId,
  balanceTokens,
  giftedTokens,
  purchasedTokens,
  consumedTokens,
  firstGiftGranted: true,
  createdAt,
  updatedAt
}
```

### token_ledger_records

额度流水账。所有赠送、充值、扣费、退款、人工调整都写这里。

```js
{
  userId,
  type: 'gift' | 'recharge' | 'consume' | 'refund' | 'adjust',
  amountTokens, // 正数入账，负数扣除
  balanceAfter,
  relatedUsageId,
  relatedOrderId,
  feature,
  provider,
  model,
  realTokens,
  chargeMultiplier,
  remark,
  createdAt
}
```

### recharge_orders

充值订单。

```js
{
  userId,
  orderNo,
  planId,
  amountFen,
  amountYuan,
  grantTokens,
  status: 'pending' | 'paid' | 'closed' | 'refunded',
  wxTransactionId,
  prepayId,
  paidAt,
  createdAt,
  updatedAt
}
```

### billing_settings

充值与扣费配置。可以独立集合，也可以并入现有全局配置文档。

```js
{
  firstGiftEnabled: true,
  firstGiftTokens: 1000000,
  yuanToTokens: 100000,
  rechargePlans: [
    { id: 'p9_9', title: '基础包', amountFen: 990, bonusTokens: 0, enabled: true },
    { id: 'p19_9', title: '进阶包', amountFen: 1990, bonusTokens: 100000, enabled: true }
  ],
  modelRates: [
    { model: 'deepseek-chat', multiplier: 1, enabled: true },
    { model: 'gpt-4.1-mini', multiplier: 2, enabled: true },
    { model: 'gpt-4.1', multiplier: 5, enabled: true }
  ],
  insufficientBalanceMode: 'block'
}
```

## 云函数改造

### 新增 getTokenAccount

读取当前用户余额、累计充值、累计消费、首次赠送状态、充值配置。

### 新增 grantFirstTokenGift

首次注册或首次进入“我的”时触发赠送。必须做幂等保护，防止重复领取。

### 新增 createRechargeOrder

创建充值订单，返回微信支付参数。

### 新增 payNotify

处理微信支付回调。支付成功后：

1. 将订单置为 `paid`。
2. 给 `token_accounts` 增加额度。
3. 写入 `token_ledger_records`。

支付回调必须幂等，重复回调不能重复到账。

### 改造 recordTokenUsage

当前 `cloudfunctions/_shared/token-usage.js` 只负责写入模型用量记录。

建议扩展为：

1. 继续写 `token_usage_records`。
2. 根据 `provider + model` 读取扣费倍率。
3. 计算 `chargeTokens`。
4. 扣减 `token_accounts.balanceTokens`。
5. 写入 `token_ledger_records`。

这样 `createTimeline`、`generateAssessmentAI`、`weeklyReview`、`generateSideRead`、`analyzeAttachment` 都能复用同一套扣费逻辑。

### 调用前余额检查

在调用模型前做预检查，避免明显余额不足时还继续调用模型。

第一版建议按功能配置一个预估额度，或按 `max_tokens` 估算：

```text
预估额度 = ceil(maxTokens * 模型扣费倍率)
```

调用后再按真实 `usage.total_tokens` 精扣。

如果模型没有返回 usage，需要产品确认策略。建议后台可配置：

- `zero`：记 0，不扣费。
- `fallback`：按 `maxTokens * fallbackRatio` 扣费。
- `fixed`：按功能固定额度扣费。

第一版可先用 `zero`，保持和现有用量逻辑一致，风险最低。

## 小程序页面

### 我的页

“Token 消费”板块升级为“Token 额度”板块。

展示：

- 剩余额度
- 累计消费
- 累计充值
- 首次赠送额度状态

按钮：

- 充值
- 消费明细
- 刷新

### Token 明细页

`pages/token-usage/token-usage.vue` 升级为余额 + 明细页。

建议分两个 Tab：

- 额度流水：来自 `token_ledger_records`
- 模型用量：来自现有 `token_usage_records`

### 新增充值页

新增 `pages/token-recharge/token-recharge.vue`。

功能：

- 展示后台启用的充值档位。
- 点击档位创建订单。
- 调起微信支付。
- 支付成功后刷新余额。

## 后台管理

在 `pages/admin/admin.vue` 增加“充值 / Token 额度”模块。

配置项：

- 首次赠送开关。
- 首次赠送额度。
- 1 元兑换多少额度 token。
- 充值档位列表：金额、赠送额度、是否启用、排序。
- 模型扣费倍率：按 provider/model 配置。
- usage 缺失时的扣费策略。
- 是否允许欠费调用，默认不允许。

云函数改造：

- 扩展 `adminManage` 支持读取和保存 billing settings。
- 配置保存时做数值范围校验。
- 金额、倍率、赠送额度、兑换比例都要限制合法范围。

## 上线步骤

### 第一期：账本和赠送，不接支付

- 新增账户表、流水表。
- 新增首次赠送逻辑。
- “我的”页显示余额。
- AI 调用后按真实 usage 扣额度。
- 余额不足时阻断 AI 调用。

### 第二期：后台配置

- 后台新增充值和扣费配置模块。
- 支持配置首次赠送额度。
- 支持配置模型倍率。
- 支持配置充值档位。

### 第三期：微信支付

- 新增充值页。
- 新增订单表和创建订单云函数。
- 接入微信支付。
- 支付回调到账。
- 明细页展示充值流水。

### 第四期：体验补齐

- 余额不足弹窗。
- 从余额不足弹窗跳转充值页。
- 支付失败、取消、处理中状态处理。
- 后台订单查询和异常订单处理。

## 关键风险

### 微信支付资质

小程序支付需要确认：

- 小程序主体。
- 微信支付商户号。
- 商户号与小程序绑定。
- 支付回调配置。
- CloudBase 环境支付能力是否已开通。

### 幂等

以下场景必须幂等：

- 首次赠送不能重复领取。
- AI 云函数重试不能重复扣费。
- 微信支付重复回调不能重复到账。

建议用 `requestId`、`orderNo`、`relatedUsageId` 做唯一约束或业务去重。

### 余额不能前端计算

当前 `getTokenUsage` 只统计最近 N 条记录，不能作为余额依据。

余额必须以后端 `token_accounts.balanceTokens` 为准，流水只是审计和展示。

### 扣费时机

调用前只能预检查，真实扣费必须在模型返回 usage 后执行。

如果调用失败，不应扣费。

如果模型调用成功但业务保存失败，需要明确是否扣费。建议第一版：只要模型成功返回且用户可见结果生成，就扣费。

## 第一版默认建议

- 新用户首次赠送：`1000000` 额度 token。
- 兑换比例：`1 元 = 100000` 额度 token。
- 充值档位：`9.9`、`19.9`。
- 模型倍率第一版全部设为 `1`。
- usage 缺失时第一版不扣费。
- 余额不足时阻断 AI 调用，并引导充值。

