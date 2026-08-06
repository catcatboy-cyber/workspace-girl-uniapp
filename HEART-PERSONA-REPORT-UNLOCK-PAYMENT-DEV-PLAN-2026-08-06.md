# 心动人设局完整报告道具解锁支付开发方案

版本：v2.1（官方文档与代码现状复核版）
日期：2026-08-06
状态：可直接交给 DeepSeek 编码
目标环境：`cloud1-d0gvhqu2c8a2b61fd`

审计依据：

- 本地保存的微信官方总览：`C:\Users\Administrator\Downloads\用户需求\虚拟支付 _ 虚拟支付.html`；
- 微信官方客户端 API：`https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html`；
- 微信官方查单 API：`https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html`；
- 微信官方通知发货 API：`https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_notify_provide_goods.html`。

## 1. 已锁定的产品规则

1. 微信开发版道具 ID：`0001`。
2. 微信道具名称：`心动人设局`。
3. 单次售价：`199` 分，即 `¥1.99`。
4. 一个微信道具覆盖四种测试体验：
   - 关系女主角；
   - 关系男主角；
   - Crush 名人图鉴；
   - 次元角色图鉴。
5. 一次购买只永久解锁一个 `resultId`，绝不解锁该用户的其他报告。
6. 用户必须先登录，但可以先完成答题并查看免费预览，再选择：
   - `¥1.99 解锁本次完整报告`；
   - `升级 Pro`。
7. 试用期、Pro、Ultra 是否直接拥有完整报告，以后台 `features/excludedFeatures` 为准。
8. 免费套餐默认不拥有完整报告权益，但在“先答题后付费”通道开启时允许答题和查看预览。
9. 报告单次解锁不使用 Crush credits，不与代币余额互转。
10. 功能尚未上线，不做历史数据兼容和迁移。

## 2. 本次官方文档审计结论

原 v1.0 计划存在以下必须纠正的问题，本版已经全部修正：

| 原问题 | v2.1 结论 |
| --- | --- |
| 新建 `/payment/virtual-delivery` | 不新建。继续使用已配置的 `/security/media-callback`，扩展 `contentSecCallback` 为微信事件路由器。 |
| 不复用媒体安全回调 | 错误。`xpay_goods_deliver_notify` 是微信标准事件消息，应与 `wxa_media_check` 共用现有消息推送入口。 |
| 回调校验 `offerId` | 错误。官方道具发货推送没有 `offerId` 字段，不能校验不存在的字段。 |
| 仅支持 JSON 回调 | 不足。官方推送可能为 XML 或 JSON，请求和响应格式必须对应。 |
| 只靠客户端 success 发货 | 错误。success 回调可能因微信异常退出而丢失，必须同时实现推送和查单补偿。 |
| 沙箱查单失败也可发货 | 严重安全问题。报告支付必须在沙箱和现网都 fail closed，未确认支付绝不解锁。 |
| 题库与保存结果继续检查旧套餐键 | 会阻断免费用户先答题。必须使用本计划定义的统一访问公式。 |
| 前端遮罩完整结果 | 不安全。当前结果接口、保存接口和题库内容都会泄露评分数据，必须做服务端投影。 |
| 关系男主角独立结果页 | 文件不存在。男女关系原型共用 `relation-heroine-result.vue`。 |

## 3. 微信官方规则基线

### 3.1 客户端支付

调用：

```js
wx.requestVirtualPayment({
  mode: 'short_series_goods',
  paySig,
  signature,
  signData
})
```

Android、鸿蒙、Windows 端基础库要求：`2.19.2` 及以上；低版本还要使用 `wx.canIUse('requestVirtualPayment')` 判断。iOS 端要求微信客户端 `8.0.68` 及以上，并且必须先完成微信官方要求的 iOS 虚拟支付额外开通与适配；未满足时不得展示可点击的单次购买按钮。

`signData` 必须是后端生成并签名的同一份 JSON 字符串，前端不得解析后重新序列化：

```json
{
  "offerId": "后台基础配置中的 offerId",
  "buyQuantity": 1,
  "env": 1,
  "currencyType": "CNY",
  "productId": "0001",
  "goodsPrice": 199,
  "outTradeNo": "HPR...",
  "attach": "不可猜测的随机标识"
}
```

规则：

- `mode` 必须是 `short_series_goods`，不能复用代币的 `short_series_coin`。
- `productId` 和 `goodsPrice` 在道具直购模式必填。
- 本期不使用优惠，因此不传 `activitySellingPrice`。
- `outTradeNo` 长度为 8-32，只能包含数字、大小写字母和 `_-|*@`，且不能以下划线开头。
- 每个 `outTradeNo` 只能调用支付一次；用户取消后重新支付时必须创建新订单号。
- `appKey` 只在服务端参与 HMAC-SHA256，不返回前端。
- 支付前必须重新 `wx.login`，服务端用本次 `loginCode` 换取新鲜 `session_key` 生成用户态签名。

### 3.2 道具发货推送

事件：`xpay_goods_deliver_notify`。

官方顶层字段：

```text
ToUserName
FromUserName
CreateTime
MsgType = event
Event = xpay_goods_deliver_notify
OpenId
OutTradeNo
Env
WeChatPayInfo
GoodsInfo
TeamInfo
```

`WeChatPayInfo`：

```text
MchOrderNo
TransactionId
PaidTime
```

`GoodsInfo`：

```text
ProductId
Quantity
OrigPrice
ActualPrice
Attach
```

成功响应必须与请求格式一致：

```xml
<xml>
  <ErrCode>0</ErrCode>
  <ErrMsg><![CDATA[success]]></ErrMsg>
</xml>
```

```json
{"ErrCode":0,"ErrMsg":"success"}
```

响应格式错误或返回失败时，微信最多重试 15 次。重复推送必须返回成功且不能重复发货。

### 3.3 现金订单查询

接口：`POST /xpay/query_order?access_token=...&pay_sig=...`。

请求体必须严格使用官方字段，不添加 `offer_id`：

```json
{
  "openid": "订单创建时保存的 openidSnapshot",
  "env": 1,
  "order_id": "HPR..."
}
```

也可以使用 `wx_order_id`，与 `order_id` 二选一。本功能必须先使用自己的 `order_id`。如果客户端运行时额外返回了未写入官方 success 契约的 `orderId`，可以把它作为候选值上报；只有服务端使用该 `wx_order_id` 查单后返回的 `order.order_id` 与本地 `outTradeNo` 完全一致，才把它标记为已验证并用于兜底。不得依赖客户端一定返回 `orderId`。

当前旧充值 helper 额外发送了 `offer_id`，但当前官方 `query_order` 请求字段未包含它。新报告支付 helper 按官方字段实现，不复制该额外字段。若沙箱网关行为与官方页面不一致，保留原始响应并通过微信 API 诊断确认，禁止直接放宽校验或复制未验证的历史参数组合。

官方订单状态：

| status | 含义 | 本地处理 |
| --- | --- | --- |
| 0 | 初始化，未创建成功 | 不发货 |
| 1 | 创建成功，未支付 | 保持 pending |
| 2 | 已支付，待发货 | 校验后发货 |
| 3 | 发货中 | 校验后完成本地发货 |
| 4 | 已发货 | 同步本地为 fulfilled |
| 5 | 已退款 | 进入退款处理 |
| 6 | 已关闭 | 标记 closed，重试支付必须新建订单 |
| 7 | 退款失败 | 记录异常，不撤销权益 |
| 8 | 用户退款完成 | 进入退款处理 |

查单判定不能只看 `paid_time > 0`。允许发货的条件必须同时满足：

- `errcode === 0`；
- `order.order_type === 0`；
- `order.status` 是 `2`、`3` 或 `4`；
- `order.order_id === outTradeNo`；
- `order.env_type === 1` 对应本地 `env=0`，或 `order.env_type === 2` 对应本地 `env=1`；
- `order.order_fee === 199`；
- `order.paid_fee` 在 `0..199` 范围内；
- `order.paid_time > 0`。

### 3.4 轮询分支完成发货

如果通过查单分支完成本地发货，必须调用：

```text
POST /xpay/notify_provide_goods?access_token=ACCESS_TOKEN
```

请求体：

```json
{
  "order_id": "HPR...",
  "env": 1
}
```

官方文档把 `order_id` 与 `wx_order_id` 设计为二选一，本功能只传 `order_id`。正常收到发货推送并成功响应时，不调用该接口。接口官方返回体为空：实现以 HTTP 2xx 为成功；如果网关实际返回 JSON，则同时要求不存在非零 `errcode`。

### 3.5 退款推送

事件：`xpay_refund_notify`。必须读取并保存：

```text
OpenId
WxRefundId
MchRefundId
WxOrderId
MchOrderId
RefundFee
RetCode
RetMsg
RefundStartTimestamp
RefundSuccTimestamp
WxpayRefundTransactionId
RetryTimes
```

只有 `RetCode === 0` 才按退款成功处理。

## 4. 总体架构

```text
答题页
  -> getArchetypeQuestionBank（只返回答题所需字段）
  -> saveArchetypeResult（服务端评分，只返回 resultId）
  -> getArchetypeReport（返回 preview 或 full DTO）
       -> 套餐有该模块权限：full
       -> 当前 resultId 已单次购买：full
       -> 其他情况：preview + 支付入口

支付按钮
  -> wx.login
  -> archetypeReportPayment.prepareOrder
  -> wx.requestVirtualPayment(short_series_goods)
  -> archetypeReportPayment.getOrderStatus / reconcileOrder

微信消息推送
  -> /security/media-callback
  -> contentSecCallback 事件路由
       -> wxa_media_check：原媒体安全逻辑
       -> xpay_goods_deliver_notify：幂等发货
       -> xpay_refund_notify：退款处理
```

## 5. 权限模型

### 5.1 套餐功能键

后台 `features/excludedFeatures` 继续使用现有三个键，不新增 `关系男主角` 权限键：

| 测试类型 | featureKey |
| --- | --- |
| `relation_archetype + female` | `关系女主角` |
| `relation_archetype + male` | `关系女主角` |
| `crush_celebrity` | `Crush名人图鉴` |
| `dimension_character` | `次元角色图鉴` |

默认配置：

| 套餐 | 三个 featureKey |
| --- | --- |
| free | 全部放入 `excludedFeatures` |
| trial | 全部放入 `features` |
| pro | 全部放入 `features` |
| ultra | 全部放入 `features` |

`关系女主角` 在权限层表示“关系主角测试（含男主角/女主角）”；`subjectGender` 只决定题库和展示，不决定套餐权限。这样与现有 `feature-keys.ts`、订阅后台和题库管理一致，也不需要对已有订阅配置补第四个键。

不要再增加 `heartPersonaQuiz` 与三个模块键形成双重套餐开关。原计划中的 `heartPersonaQuiz` 删除，避免后台出现“一个开、一个关”时无法判断。

### 5.2 先答题后付费的访问公式

免费套餐虽然不拥有模块权益，但在单次付费漏斗开启时允许答题：

```js
subscriptionAllowed = checkFeatureAccess(db, userId, featureKey).allowed

payPerReportFunnelAllowed =
  paymentConfig.enabled === true &&
  paymentConfig.answerBeforePayEnabled === true &&
  paymentConfig.allowedFeatures.includes(featureKey)

canTakeQuiz = subscriptionAllowed || payPerReportFunnelAllowed
canViewFullReport = subscriptionAllowed || permanentResultUnlock
```

落地要求：

- `getArchetypeQuestionBank` 和 `saveArchetypeResult` 都使用同一个 `canTakeQuiz` helper。
- `getArchetypeReport` 使用同一个 `featureKey` 映射计算 `canViewFullReport`。
- 如果后台关闭单次付费漏斗，free 用户恢复为不能答题。
- 如果后台从 `allowedFeatures` 移除某模块，free 用户不能通过付费漏斗进入该模块。
- 试用、Pro、Ultra 直接显示完整报告，不创建道具订单。
- 套餐权限是动态权限，不写入永久购买字段；套餐到期后重新按当前配置判断。

## 6. 报告数据防泄漏

当前代码存在三条泄漏路径，必须一起改：

1. `saveArchetypeResult` 返回完整计算结果；
2. `getArchetypeResults` 返回数据库原始结果；
3. `getArchetypeQuestionBank` 返回评分权重、人物向量、选项分值，客户端可以自己重算。

### 6.1 题库客户端投影

在 `cloudfunctions/_shared/archetype-bank.js` 新增 `projectQuestionBankForClient(bank)`。

关系原型可返回：

- 阶段 `key/label`；
- 人物 `key/name/label/enabled`；关系原型当前没有 `coverUrl`，不得假设该字段存在；
- 题目 `id/textSelf/textTarget/options.key/options.textSelf/options.textTarget`；
- 情景题展示文本与选项文本。

关系原型不得返回：

- `dimensionKey`；
- `reverse`；
- 维度权重；
- `typicalOptionKey`；
- 评分阈值和完整结果文案规则。

名人/次元图鉴可返回：

- 题目 `id/textSelf/textTarget/options.key/options.textSelf/options.textTarget`；
- 页面展示必须使用的普通说明。

名人/次元图鉴不得返回：

- `options.scores`；
- 人物 `profile` 向量；
- `calibration`；
- 全人物相似度计算参数；
- Top 5 生成规则。

### 6.2 保存结果响应

`saveArchetypeResult` 完成服务端评分和保存后只返回：

```json
{
  "success": true,
  "resultId": "archetype_results._id",
  "kind": "crush_celebrity"
}
```

不得返回 `similarity`、`dimensionScores`、`similarities`、`topFive`、`answers` 或完整题库内容。

### 6.3 结果列表响应

`getArchetypeResults` 仅用于历史列表，返回：

```json
{
  "success": true,
  "results": [
    {
      "resultId": "...",
      "kind": "...",
      "mode": "self|target",
      "subjectGender": "female|male",
      "caseSnapshot": { "name": "...", "avatar": "..." },
      "primary": { "key": "...", "name": "...", "coverUrl": "可选，仅名人/次元通常存在" },
      "similarityBand": { "min": 75, "max": 79, "label": "约 75%-79%" },
      "accessLevel": "preview|full",
      "createdAt": "..."
    }
  ]
}
```

### 6.4 单份报告响应

新增 `getArchetypeReport`，由服务端直接组装展示 DTO。结果页不再读取完整题库后自行拼报告。

预览固定只包含：

- 第一匹配人物/原型名称、风格副标题；名人/次元有封面时返回封面，关系原型使用文字头像或统一默认图；
- 相似度区间；
- 一句不含行动结论的摘要；
- 观察覆盖度；
- `resultId/kind/mode/subjectGender`；
- `accessLevel = preview`；
- `unlockOptions`。

相似度区间算法固定：

```js
min = Math.floor(exactSimilarity / 5) * 5
max = Math.min(100, min + 4)
```

完整报告才包含：

- 精确相似度；
- 三维或五维分数与文案；
- 第二原型、Top 5；
- 情景验证；
- 答题证据；
- 红黄灯、风险、优势和沟通建议；
- 继续投入、观察或暂停投入等结论。

## 7. 数据模型

### 7.1 `archetype_results`

新增永久权益字段：

```js
reportAccess: {
  purchaseState: 'locked' | 'unlocked' | 'revoked',
  purchaseOrderId: null,
  purchasedAt: null,
  revokedAt: null,
  revokeReason: ''
}
```

新结果默认 `purchaseState = locked`。

不要写 `subscription` 或 `trial` 到此字段，因为套餐权限会到期并且必须动态判断。

### 7.2 `archetype_report_orders`

每次点击“重新支付”创建一条新订单；同一 `resultId` 可以有多条未支付尝试，但只能产生一个永久权益。

```js
{
  _id,
  outTradeNo: 'HPR...',
  clientRequestId: '前端每次点击生成的 UUID',
  requestKey: 'sha256(userId|resultId|clientRequestId)',

  userId,
  openidSnapshot,
  resultId,
  kind,
  subjectGender,
  featureKey,

  offerIdSnapshot,
  productId: '0001',
  quantity: 1,
  currencyType: 'CNY',
  env: 1,
  origPriceFen: 199,
  actualPriceFen: null,
  attach: 'crypto.randomBytes(16).toString(hex)',

  status: 'pending' | 'paid' | 'fulfilling' | 'fulfilled' | 'closed' | 'refunded' | 'exception',
  fulfillmentSource: null | 'push' | 'poll' | 'admin',
  duplicatePaid: false,

  mchOrderNo: '',
  clientWxOrderIdCandidate: '',
  wxOrderIdVerified: '',
  transactionId: '',
  paidAt: null,
  fulfilledAt: null,
  refundedAt: null,

  wxRefundId: '',
  mchRefundId: '',
  refundFeeFen: null,
  refundRetCode: null,
  refundRetMessage: '',
  refundStartAt: null,
  refundSucceededAt: null,
  wxpayRefundTransactionId: '',
  refundRetryTimes: 0,

  queryAttempts: 0,
  lastQueryStatus: null,
  lastErrorCode: '',
  lastErrorMessage: '',
  callbackDigest: '',

  createdAt,
  updatedAt
}
```

索引：

- `outTradeNo` 唯一；
- `requestKey` 唯一，用于 API 网络重试幂等；
- `userId + resultId + createdAt`；
- `status + updatedAt`；
- `transactionId` 普通索引；
- `wxOrderIdVerified` 普通索引；
- `wxRefundId` 普通索引。

### 7.3 `archetype_report_refund_tasks`

用于处理同一 `resultId` 被两笔订单重复付款等需要人工退款复核的情况：

```js
{
  _id,
  orderId,
  outTradeNo,
  userId,
  resultId,
  reason: 'duplicate_paid' | 'admin_requested' | 'other',
  status: 'pending' | 'processing' | 'refunded' | 'dismissed',
  amountFen,
  createdAt,
  updatedAt,
  handledBy: '',
  handledAt: null,
  handleNote: ''
}
```

索引：`orderId` 唯一；`status + createdAt`；`userId + resultId`。退款任务只是后台待办，不自动调用退款 API，避免并发回调下误退；管理员处理后等待 `xpay_refund_notify` 作为最终退款凭据。

### 7.4 pending 订单清理规则

取消支付后本地可能留下 `pending` 订单，但不能仅凭“创建超过 30 分钟”自动标记 `closed`。清理任务只能：

1. 找出长时间未更新的 pending 订单；
2. 调用官方 `query_order`；
3. 只有官方 `status=6` 时改为 `closed`；
4. 官方仍为 0/1 或查询失败时保留 pending，并记录最后查询时间；
5. 超过运营保留期的未支付订单可以归档展示，但不得把归档等同于微信关单。

## 8. 支付云函数接口契约

新增云函数：`archetypeReportPayment`。

所有用户接口都必须使用 `requireAuthenticatedUserId`，不得信任客户端传入的 `userId/openid/env/productId/price`。

### 8.1 `prepareOrder`

请求：

```json
{
  "action": "prepareOrder",
  "resultId": "...",
  "clientRequestId": "uuid",
  "loginCode": "wx.login 返回的新 code"
}
```

处理顺序：

1. 校验登录和 `loginCode`。
2. 查 `archetype_results`，校验结果存在且 `result.userId === currentUserId`。
3. 由 `kind + subjectGender` 映射 `featureKey`，不接受客户端 featureKey。
4. 若套餐当前已有该功能权限，返回 `REPORT_ALREADY_AVAILABLE`，不创建订单。
5. 若结果已有永久购买权益，返回 `REPORT_ALREADY_UNLOCKED`，不创建订单。
6. 校验后台支付开关、允许的 feature、价格、当前环境 productId。
7. 从用户数据取得并保存 `openidSnapshot`；为空则报错。
8. 使用 `clientRequestId` 计算 `requestKey`。同一个请求重试时复用原订单和完全相同的 `signData/paySig`，但必须使用本次 `loginCode` 换得的 session_key 重新生成 `signature`，不重复建单。
9. 新建 `pending` 订单、随机 `attach` 和新的 `outTradeNo`。
10. 使用本次 `loginCode` 换取 session_key。
11. 生成唯一的 `signData` 字符串、`paySig` 和 `signature`。

成功响应：

```json
{
  "success": true,
  "data": {
    "mode": "short_series_goods",
    "paySig": "...",
    "signature": "...",
    "signData": "{...原始字符串...}",
    "outTradeNo": "HPR...",
    "orderStatus": "pending",
    "reused": false
  }
}
```

注意：同一个 `outTradeNo` 对 `wx.requestVirtualPayment` 只能使用一次。前端 API 调用失败可以用同一个 `clientRequestId` 重取响应；一旦已经调用过微信支付，再次尝试必须生成新的 `clientRequestId` 和订单。

### 8.2 `getOrderStatus`

请求：

```json
{
  "action": "getOrderStatus",
  "outTradeNo": "HPR..."
}
```

只允许订单所属用户查询。响应不返回 openid、attach、签名、密钥或回调原文：

```json
{
  "success": true,
  "data": {
    "outTradeNo": "HPR...",
    "status": "pending|processing|fulfilled|closed|refunded|exception",
    "reportAvailable": false,
    "resultId": "..."
  }
}
```

本地 `paid/fulfilling` 统一映射为客户端 `processing`。

### 8.3 `reconcileOrder`

请求：

```json
{
  "action": "reconcileOrder",
  "outTradeNo": "HPR...",
  "clientWxOrderIdCandidate": "可选；仅当运行时 success 返回 orderId 时上报"
}
```

要求：

- 只允许订单所属用户调用；
- 单订单最短 2 秒间隔，最多连续调用 15 次；
- 候选 `clientWxOrderIdCandidate` 只允许写入当前用户的当前订单，长度和字符集校验后保存，但在微信查单验证前不得作为可信支付凭据；
- 首先使用订单保存的 `openidSnapshot/env/outTradeNo` 调官方 `/xpay/query_order`；
- 仅当 `order_id` 查询明确未找到订单且存在候选值时，才使用 `wx_order_id` 再查一次；响应中的 `order.order_id` 必须等于本地 `outTradeNo`，成功后写入 `wxOrderIdVerified`；
- 严格按第 3.3 节判定；
- 状态 2/3 时调用统一发货函数，然后调用 `/xpay/notify_provide_goods`；
- 状态 4 时同步本地权益，不再重复通知发货；
- 状态 0/1 返回 pending；
- 状态 6 标记 closed；
- 状态 5/8 进入退款处理；
- 微信接口超时、非零 errcode、报文缺字段都不得发货。

### 8.4 错误码

| code | 前端处理 |
| --- | --- |
| `AUTH_REQUIRED` | 跳转登录 |
| `LOGIN_CODE_REQUIRED` | 重新调用 `wx.login` |
| `SESSION_KEY_EXCHANGE_FAILED` | 提示重试，不调支付 |
| `RESULT_NOT_FOUND` | 返回结果列表 |
| `REPORT_ALREADY_AVAILABLE` | 直接刷新完整报告 |
| `REPORT_ALREADY_UNLOCKED` | 直接刷新完整报告 |
| `PAYMENT_DISABLED` | 只保留升级 Pro |
| `PRODUCT_NOT_CONFIGURED` | 显示“暂不可购买”，记录服务端告警 |
| `PAYMENT_NOT_SUPPORTED` | 提示微信版本过低 |
| `ORDER_NOT_FOUND` | 停止轮询 |
| `ORDER_NOT_OWNED` | 不暴露订单信息 |
| `ORDER_PENDING` | 继续有限轮询 |
| `ORDER_CLOSED` | 显示“重新支付”并创建新订单 |
| `ORDER_VALIDATION_FAILED` | 停止发货并进入 exception |
| `WECHAT_QUERY_FAILED` | 提示稍后刷新，绝不解锁 |
| `REFUNDED` | 显示退款状态 |

微信客户端错误码处理：

| errCode | 处理 |
| --- | --- |
| `-2` | 用户取消；不解锁，再次点击创建新订单 |
| `-15002` | outTradeNo 重复；创建新订单 |
| `-15005` | 用户态签名错误；重新 `wx.login` 并创建新订单 |
| `-15007` | session_key 过期；重新 `wx.login` 并创建新订单 |
| `-15008` | 二级商户进件未完成；停止重试并提示支付暂不可用 |
| `-15010` | 道具未发布；停止重试并告警 |
| `-15012` | 微信调用失败并关单；创建新订单后允许用户重试 |
| `-15013` | goodsPrice 与后台价格不一致；停止重试并告警 |
| `-15014` | 道具发布尚未生效；停止自动重试，提示稍后再试 |
| 其他/未知 | 不解锁；调用一次 `reconcileOrder` 确认订单，仍不确定则显示“支付结果确认中”并停止循环 |

## 9. 统一幂等发货

在 `cloudfunctions/_shared/archetype-report-access.js` 实现：

```js
fulfillReportOrder(db, {
  outTradeNo,
  source,
  paymentEvidence
})
```

推送、查单、管理员补发只能调用这一个函数，不能各写一套权益逻辑。

事务步骤：

1. 按 `outTradeNo` 读取订单并加事务内状态判断。
2. 已 `fulfilled`：直接返回 `alreadyFulfilled: true`。
3. 已 `refunded/closed/exception`：拒绝发货。
4. 校验订单所属结果存在且 `result.userId === order.userId`。
5. 把订单从 `pending/paid` 改为 `fulfilling`。
6. 如果结果已经由另一笔订单永久解锁：
   - 当前订单仍记录为 `fulfilled`；
   - `duplicatePaid = true`；
   - 不覆盖原 `purchaseOrderId`；
   - 生成管理员退款待办。
7. 否则写入结果：

```js
reportAccess.purchaseState = 'unlocked'
reportAccess.purchaseOrderId = order._id
reportAccess.purchasedAt = now
```

8. 把订单改为 `fulfilled`，写入来源和支付凭据。
9. 提交事务。

状态机：

```text
pending -> paid -> fulfilling -> fulfilled
pending -> closed
fulfilled -> refunded
任意校验不一致 -> exception
```

## 10. 微信回调改造

### 10.1 保留现有 URL

继续使用：

```text
https://cloud1-d0gvhqu2c8a2b61fd.service.tcloudbase.com/security/media-callback
```

不创建、不配置 `/payment/virtual-delivery`。

### 10.2 `contentSecCallback` 事件路由

修改 `cloudfunctions/contentSecCallback/index.js`：

1. 保留 GET `echostr` 校验。
2. 保留 `WECHAT_MESSAGE_TOKEN` 的 `signature/timestamp/nonce` SHA1 验证。
3. POST 支持 JSON 和 XML；XML 使用 `fast-xml-parser`，禁止正则手拆 XML。
4. 根据 `Event/event` 路由：
   - `wxa_media_check` -> 原 `applyMediaCheckResult`；
   - `xpay_goods_deliver_notify` -> `handleGoodsDelivery`；
   - `xpay_refund_notify` -> `handleRefundNotify`；
   - 其他已通过签名验证的事件记录名称和摘要后返回成功确认，避免微信对本功能不处理的投诉、风控等事件重复推送 15 次；不得把未知事件当作支付成功。
5. 虚拟支付事件按请求格式返回官方 ErrCode 响应。

本期明确采用微信消息“明文模式”。部署前必须在微信后台确认消息加密方式为明文。若 query 中出现 `encrypt_type=aes` 或 `msg_signature`，代码记录 `ENCRYPTED_CALLBACK_UNSUPPORTED` 并拒绝处理；不得把密文当普通 XML/JSON。

入站消息验证使用 `WECHAT_MESSAGE_TOKEN`，不是虚拟支付 `appKey`。`appKey` 只用于 `requestVirtualPayment` 和 `/xpay/*` 服务端 API 的支付签名。

### 10.3 发货推送校验

按 `OutTradeNo` 找订单，必须全部通过：

- `MsgType === event`；
- `Event === xpay_goods_deliver_notify`；
- `OpenId === order.openidSnapshot`；
- `Number(Env) === order.env`；
- `GoodsInfo.ProductId === order.productId`；
- `Number(GoodsInfo.Quantity) === 1`；
- `Number(GoodsInfo.OrigPrice) === order.origPriceFen`；
- `ActualPrice` 是 `0..OrigPrice` 的整数；
- `GoodsInfo.Attach === order.attach`；
- `WeChatPayInfo.PaidTime > 0`；
- 已保存的 `TransactionId/MchOrderNo` 如非空，必须与本次一致。

官方推送没有 `offerId`，此处不校验 `offerId`。

成功、重复成功都返回 ErrCode 0。订单不存在或任何字段不一致时：

- 不解锁；
- 订单存在则标记 `exception`；
- 返回非零 ErrCode 让微信重试；
- 日志只记录字段摘要和 hash，不记录完整 attach、签名或个人资料。

### 10.4 退款处理

按 `MchOrderId` 查本地 `outTradeNo`，并校验 `OpenId`、退款金额和微信订单号。

`RetCode === 0` 时：

1. 以 `WxRefundId` 作为退款回调幂等键；重复回调返回成功。
2. 保存全部退款凭据、退款金额、重试次数和起止时间。
3. 订单标记 `refunded`，相关退款待办标记 `refunded`。
4. 仅当结果当前 `purchaseOrderId` 就是该订单时，设置 `purchaseState = revoked`。
5. 如果用户当前套餐仍拥有该模块权限，仍可动态查看完整报告。
6. 管理员人工保留权益必须另写审计记录，不能悄悄修改退款单。

## 11. 前端改造

### 11.1 实际结果页面

只改三个页面：

- `src/pages/relation-heroine-result/relation-heroine-result.vue`，同时处理关系男主角和女主角；
- `src/pages/crush-celebrity-result/crush-celebrity-result.vue`；
- `src/pages/dimension-character-result/dimension-character-result.vue`。

不存在 `src/pages/relation-hero-result/relation-hero-result.vue`，不得创建一个重复页面。

### 11.2 共享组件

新增：

```text
src/components/HeartPersonaReportPaywall.vue
```

职责：

- 展示预览和锁定区；
- `¥1.99 解锁本次完整报告`；
- `升级 Pro`；
- 创建订单、调起支付、轮询、补单；
- 处理取消、失败、关单、退款、处理中；
- 成功后重新请求 `getArchetypeReport`。

页面状态：

```text
loading
preview_locked
creating_order
payment_sheet
payment_pending
reconciling
full_report
payment_cancelled
payment_failed
payment_unsupported
refunded
```

### 11.3 客户端支付步骤

```js
// 1. 检查 API
if (!wx.canIUse('requestVirtualPayment')) {
  showUnsupported()
  return
}

// 2. 每次真正点击支付生成新的 clientRequestId
const loginCode = await wxLogin()
const order = await prepareOrder({ resultId, clientRequestId, loginCode })

// 3. signData 原样透传
wx.requestVirtualPayment({
  mode: 'short_series_goods',
  paySig: order.paySig,
  signature: order.signature,
  signData: order.signData,
  success: (res) => startPolling({
    clientWxOrderIdCandidate: typeof res?.orderId === 'string' ? res.orderId : ''
  }),
  fail: handleVirtualPayError
})
```

前端行为：

- `success` 只表示支付面板成功返回，不直接解锁。官方 success 契约只保证 `errMsg`；`orderId` 如果存在只能作为可选候选值上报。
- success 后立即查状态，再每 1.5 秒查询一次，最多 20 次。
- 第 3、8、15 次可以调用 `reconcileOrder`，其余调用轻量 `getOrderStatus`。
- 超时后显示“支付结果确认中，可稍后刷新”，不能显示“已解锁”。
- `errCode = -2` 显示取消，重新点击时新建订单。
- `-15002`、`-15012` 必须新建 `outTradeNo` 后重试。
- `-15005`、`-15007` 重新 `wx.login` 后新建订单。
- `-15010`、`-15013`、`-15014` 显示配置异常并上报，不循环重试。
- `-15008` 表示二级商户进件未完成，显示支付暂不可用，不循环重试。
- 未知错误码只做一次查单确认；无法确认时停止循环并显示“支付结果确认中”，绝不提前解锁。
- 非 MP-WEIXIN 构建隐藏单次微信道具按钮，仅保留可用的套餐入口。

### 11.4 API 封装

在 `src/utils/api.ts` 新增：

```ts
prepareHeartPersonaReportOrder(resultId, clientRequestId)
getHeartPersonaReportOrderStatus(outTradeNo)
reconcileHeartPersonaReportOrder(outTradeNo, clientWxOrderIdCandidate?)
getArchetypeReport(resultId)
```

`prepareHeartPersonaReportOrder` 内部负责 `wx.login`，不要让三个结果页各写一遍。

## 12. 后台配置与管理

在现有订阅配置中新增非密钥配置：

```js
heartPersonaReportPayment: {
  enabled: true,
  answerBeforePayEnabled: true,
  priceFen: 199,
  sandboxProductId: '0001',
  productionProductId: '',
  allowedFeatures: [
    '关系女主角',
    'Crush名人图鉴',
    '次元角色图鉴'
  ],
  refundRevokesPurchase: true
}
```

要求：

- 价格必须是正整数分；
- 当前环境 productId 为空时禁止创建订单；
- 现网不可使用沙箱 productId；
- 后台不显示 appKey、session_key、paySig、signature、attach；
- 配置仍由 `features/excludedFeatures` 决定套餐权益；
- 权限配置中的 `关系女主角` 后台显示名使用“关系主角（含男主角 / 女主角）”，避免运营误解；
- 订单管理支持按用户、resultId、outTradeNo、状态查询；
- 支持“查微信订单”“受审计补发”“查看异常摘要”；
- 人工操作必须记录管理员 ID、原因、前后状态和时间。

云函数环境变量继续复用：

```text
VIRTUAL_PAY_OFFER_ID
VIRTUAL_PAY_APP_KEY
VIRTUAL_PAY_SANDBOX_KEY
USE_VIRTUAL_PAY
WECHAT_MESSAGE_TOKEN
WXPAY_APPID 或 WECHAT_APPID
WECHAT_APP_SECRET
```

新增：

```text
HEART_PERSONA_VPAY_ENV=1   # 沙箱；现网为 0
```

客户端传入的 `sandbox/env` 一律忽略，环境只由云函数环境变量决定。

## 13. 文件级开发清单

### 13.1 新增

- `cloudfunctions/archetypeReportPayment/index.js`
- `cloudfunctions/archetypeReportPayment/package.json`
- `cloudfunctions/getArchetypeReport/index.js`
- `cloudfunctions/getArchetypeReport/package.json`
- `cloudfunctions/_shared/archetype-report-access.js`
- `cloudfunctions/_shared/archetype-report-projection.js`
- `cloudfunctions/_shared/heart-persona-virtual-pay.js`
- `src/components/HeartPersonaReportPaywall.vue`
- `tests/run-archetype-report-payment.cjs`
- `tests/run-archetype-report-projection.cjs`
- `tests/run-content-sec-callback-router.cjs`
- `tests/run-archetype-report-refund.cjs`

### 13.2 修改

- `cloudfunctions/getArchetypeQuestionBank/index.js`
- `cloudfunctions/saveArchetypeResult/index.js`
- `cloudfunctions/getArchetypeResults/index.js`
- `cloudfunctions/contentSecCallback/index.js`
- `cloudfunctions/contentSecCallback/package.json`，增加 `fast-xml-parser`
- `cloudfunctions/adminManage/index.js`
- `cloudfunctions/_shared/archetype-bank.js`
- `cloudfunctions/_shared/subscription.js`
- `src/utils/api.ts`
- `src/pages/relation-heroine-result/relation-heroine-result.vue`
- `src/pages/crush-celebrity-result/crush-celebrity-result.vue`
- `src/pages/dimension-character-result/dimension-character-result.vue`
- 后台订阅配置页面及订单管理页面对应文件

### 13.3 同步要求

本仓库通用 `_shared` 以 `cloudfunctions/_shared` 为唯一源。新 helper 使用独立名称 `heart-persona-virtual-pay.js`，避免覆盖现有 `recharge/_shared/virtual-pay.js`。修改后执行现有共享同步脚本，再检查目标云函数中的副本一致。

现有 Crush credits 和订阅支付链路本期不重构、不改签名字段与订单模型；只增加回归测试，确保新增报告支付没有影响原功能。

## 14. 开发顺序

1. 复用现有三个 featureKey，新增支付配置默认值和 `kind + subjectGender -> featureKey` 映射测试。
2. 实现客户端题库投影，先封住评分元数据泄漏。
3. 修改保存结果响应与历史列表投影。
4. 新增 `getArchetypeReport`，完成 preview/full 服务端 DTO。
5. 新增订单集合、索引、订单云函数和统一发货函数。
6. 实现独立 `heart-persona-virtual-pay.js`：道具签名、官方查单、`notify_provide_goods`；新报告支付从第一天起 fail closed，不复制现有充值链路的沙箱 fail-open。
7. 扩展 `contentSecCallback` 为 JSON/XML 事件路由，保留媒体安全功能。
8. 完成退款和管理员订单工具。
9. 实现前端共享付费墙并接入三个结果页。
10. 完成单元测试、H5 构建、小程序构建和沙箱联调。
11. 部署云函数与回调后，再发布小程序开发版。
12. 沙箱通过后发布现网道具，填写 productionProductId，切换环境为 0，再发生产版。

## 15. 测试矩阵

### 15.1 权限

- free + 支付漏斗开启：能答题、只看预览、能购买。
- free + 支付漏斗关闭：不能进入被排除模块。
- trial/pro/ultra + feature included：答题后直接看完整报告，不创建订单。
- 套餐 feature excluded：没有套餐直通权益；仅在支付漏斗允许时可预览和购买。
- 套餐到期：未购买的历史报告重新锁定；已购买报告仍完整可见。

### 15.2 防泄漏

- 题库接口不存在 `scores/profile/calibration/reverse/dimensionKey/typicalOptionKey`。
- 保存结果接口只返回 resultId。
- 历史列表无精确分数、Top 5、维度、答案、建议。
- preview 报告无精确相似度和可推导精确分数的数据。
- 修改前端代码或直接调云函数也拿不到锁定字段。

### 15.3 支付与发货

- `mode` 为 `short_series_goods`。
- `productId=0001`、`buyQuantity=1`、`goodsPrice=199`。
- 取消支付不解锁；再次支付使用新 outTradeNo。
- 客户端 success 不直接解锁。
- JSON 发货推送成功。
- XML 发货推送成功且返回 XML。
- 重复推送 15 次也只产生一次权益。
- 推送丢失时，query_order + notify_provide_goods 可补发。
- 查单超时、errcode 非 0、status 0/1/6 均不发货。
- 沙箱查单失败绝不降级发货。
- OpenId、Env、ProductId、Quantity、OrigPrice、Attach 任一不符都不发货。
- query_order 和 notify_provide_goods 的 POST 请求都必须带精确 `Content-Length = Buffer.byteLength(body)`；query_order 请求体默认仅含官方 `openid/env/order_id`。
- 主 `order_id` 查单失败且存在客户端候选值时，允许用 `wx_order_id` 二次查单；必须反向验证返回的 `order_id`。
- 不发送 `offer_id`；如果沙箱实际行为与官方不一致，测试必须保存原始 errcode/errmsg 并停止发货。
- 同一 resultId 两笔订单都支付时只保留一份权益，第二笔标记 duplicatePaid 并生成唯一退款待办。

### 15.4 退款

- `RetCode !== 0` 不撤销权益。
- 成功退款撤销该订单对应的单次购买权益。
- 用户仍有 Pro/Ultra 权限时，退款后仍能通过套餐看完整报告。
- 重复退款推送幂等。
- 退款凭据完整落库，`WxRefundId` 重复不得重复撤销权益。

### 15.5 回归

- 原 `wxa_media_check` JSON 回调正常。
- GET `echostr` 正常。
- 未订阅或暂不处理的已验签事件返回成功确认，但不产生业务状态变化。
- 现有 Crush credits 充值不受影响。
- 现有订阅购买不受影响。
- 三个结果页在 self/target、男/女、三种 kind 下均正常。
- `npm run build:h5` 通过。
- `npm run build:mp-weixin` 通过。

## 16. 部署与微信后台配置

1. 创建 `archetype_report_orders`、`archetype_report_refund_tasks` 集合及索引。
2. 配置 `HEART_PERSONA_VPAY_ENV=1`，确认现有 offerId、沙箱 appKey、微信 AppID/Secret 和消息 Token 可用。
3. 部署：
   - `getArchetypeQuestionBank`；
   - `saveArchetypeResult`；
   - `getArchetypeResults`；
   - `getArchetypeReport`；
   - `archetypeReportPayment`；
   - `adminManage`；
   - 扩展后的 `contentSecCallback`。
4. 保留微信消息推送 URL：

```text
https://cloud1-d0gvhqu2c8a2b61fd.service.tcloudbase.com/security/media-callback
```

该路径是 CloudBase 控制台级 HTTP 路由，不在当前 `cloudbaserc.json` 中声明。每次部署 `contentSecCallback` 后都要在控制台人工确认路由仍指向该函数，并执行一次 GET `echostr` 或等价探测。

5. 微信后台确认：
   - 消息推送为明文模式；
   - `xpay_goods_deliver_notify` 发货订阅已开启；
   - `xpay_refund_notify` 已能推送到同一 URL；
   - 开发版道具 `0001` 价格为 199 分且状态可测试。
6. 发布微信小程序开发版并进行沙箱真机测试。
7. 检查 CloudBase 日志中媒体安全和虚拟支付两类事件都能路由。
8. 沙箱全部验收后，在微信后台发布现网道具，写入 `productionProductId`。
9. 设置 `HEART_PERSONA_VPAY_ENV=0`，确认使用现网 appKey，重新部署支付相关云函数。
10. 发布生产小程序版本。

## 17. 完成定义

只有同时满足以下条件才算开发完成：

1. DeepSeek 按本文件中的接口、字段和状态完成编码，没有自创支付协议。
2. 完整报告无法从题库、保存响应、历史接口或前端缓存绕过获取。
3. 推送和轮询两条发货链都通过沙箱测试。
4. 任何未被微信确认的订单都不会解锁，包括沙箱。
5. 重复推送、重复查单、并发发货、重复退款均幂等。
6. 现有 `/security/media-callback` 的媒体安全功能无回归。
7. free、trial、pro、ultra 与三个 `features/excludedFeatures` 组合通过测试，其中关系键覆盖男主角和女主角。
8. 三个结果页完成预览、单次解锁、升级 Pro、永久回看和退款状态闭环。
9. H5 和微信小程序构建通过，沙箱真机支付通过。

## 18. 交给 DeepSeek 的执行指令

可以直接这样下达任务：

```text
请严格按照 HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md v2.1 实现“心动人设局”完整报告道具解锁支付。

要求：
1. 先阅读现有 getArchetypeQuestionBank、saveArchetypeResult、getArchetypeResults、contentSecCallback、recharge/_shared/virtual-pay.js、三个结果页和 subscription 权限实现；
2. 严格使用 short_series_goods，道具 ID 0001，价格 199 分；
3. 保留并扩展 /security/media-callback，不新建支付回调 URL；
4. 先完成服务端数据防泄漏，再接前端付费墙；
5. 沙箱和现网都禁止查单失败降级发货；
6. 所有推送、轮询、补发和退款必须幂等；
7. 不做历史数据迁移，不改无关业务；
8. 完成计划中列出的测试，并输出改动文件、测试结果、部署命令和未完成事项。
```

这里的“不做历史数据迁移”仅指没有已上线测试结果需要迁移；仍须对现有订阅配置文档幂等补充 `heartPersonaReportPayment` 默认结构，但不得覆盖管理员已经配置的其他套餐字段。
