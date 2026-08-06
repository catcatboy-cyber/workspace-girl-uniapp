# 真心鉴定局单次报告解锁与支付方案

版本：v1.0
日期：2026-08-05
状态：待开发确认

## 1. 目标

分享进入的新用户不应在答题前被付款墙拦截。用户应先完成测试、看到真实但有限的结果预览，再选择单次解锁完整报告或升级订阅套餐。

该方案的目标是同时兼顾：

- 让分享流量能够完整体验测试，建立结果期待；
- 让用户清楚知道 `¥1.99` 买到的是哪一份报告；
- 将 AI 消耗用的 Crush credits 与测试报告付费彻底分开；
- 让报告解锁、订阅权益、后台开关均可独立配置与审计。

## 2. 用户路径

1. 用户从分享卡片进入真心鉴定局落地页。
2. 用户查看说明后开始测试；开始答题前必须登录。
3. 用户完成阶段化题目并提交。
4. 系统即时计算并展示免费结果预览。
5. 用户可选择单次购买本次完整报告，或升级 Pro / Ultra。
6. 支付成功后，服务端发放当前结果的解锁权益，前端刷新并展示完整报告。
7. 用户日后从测试记录进入同一结果时，仍可永久查看已解锁报告。

## 3. 免费预览与付费内容边界

### 3.1 免费预览（必须真实可用）

- 第一匹配人物的轮廓名称，例如“冉XX型”；
- 相似度区间，例如“约 75% - 82%”；
- 一条吸引继续阅读的中性摘要，例如“热情信号明确，但投入节奏仍需要验证”；
- 完成时间和该次测试的阶段标签。

### 3.2 完整报告（单次付费或套餐权益解锁）

- 准确人物相似度百分比与 Top N 排名；
- 人物风格拆解和对应答题证据；
- 红黄灯风险与优势信号；
- “继续投入 / 先观察 / 暂停投入”的适配结论；
- 针对当前阶段的验证动作与沟通建议；
- 用户偏好与对方画像之间的适配解释；
- 该次结果的永久回看。

不得只显示无意义的遮罩或完全不展示结果。免费预览必须让用户确认测试确实产生了与自己有关的结果，但不得提前给出最终行动结论。

## 4. 微信虚拟支付模式与权益模型

微信虚拟支付后台仅提供“代币”和“道具”两种模式。本功能选择 **道具模式**，不使用代币模式。

平台中的道具是支付与发放权益的技术分类；用户侧不展示“背包”“持有道具”或兑换步骤，而是直接展示“解锁本次完整报告”。支付完成后，道具权益立即绑定当前测试结果，不允许转赠、囤积或挪用于其他结果。

不使用 Crush credits 或其他通用代币购买报告。Crush credits 继续只用于 AI 对话、分析等按量服务；报告是固定价格、一次解锁、可永久回看的权益。

| 字段 | 建议值 / 规则 |
| --- | --- |
| `productId` | `true_heart_report_unlock_v1` |
| 微信虚拟支付模式 | 道具 |
| 道具类型 | 结果绑定型虚拟权益 |
| 系统权益类型 | `report_unlock` |
| 显示名称 | 真心鉴定完整报告解锁卡 |
| 默认价格 | `1.99` 元 |
| 发放权益 | 解锁一份指定 `assessmentResultId` 的完整报告 |
| 有效期 | 永久，可回看该份结果 |
| 可否转赠 | 否（首版不支持） |
| 可否兑换 credits | 否 |

### 4.1 为什么不选择代币

- 用户只想立即查看一份确定价格的报告，不需要先充值、再换算、再扣除；
- 现有 Crush credits 已用于 AI 按量服务，混用会使计价、余额和用户认知混乱；
- 代币模式需要处理充值余额、剩余余额、兑换比例与更多售后边界；
- 道具模式可将一次支付精确绑定到一个 `assessmentResultId`，最符合“支付 `¥1.99` 后立即看本次结果”的路径。

### 4.2 道具发放方式

下单时服务端必须将当前 `assessmentResultId` 写入订单和支付附加信息。支付成功后，服务端确认该道具已购买，并将其即时兑换为此结果的 `fullReportUnlocked: true` 权益。前端不保存或判断道具数量，只向服务端查询结果是否已解锁。

购买页同时提供：

- `¥1.99 解锁本次完整报告`
- `升级 Pro，解锁完整报告并获得后续权益`

单次购买与订阅权益的优先级：只要当前结果已单次解锁，或当前用户套餐具备该测试完整报告权限，即允许查看完整报告。

## 5. 数据模型

### 5.1 测试结果 `assessment_results`

新增或确认以下字段：

```json
{
  "_id": "result_xxx",
  "userId": "user_xxx",
  "assessmentType": "true_heart_bureau",
  "status": "completed",
  "preview": {},
  "fullReport": {},
  "fullReportUnlocked": false,
  "unlockedAt": null,
  "unlockSource": null
}
```

`unlockSource` 取值：`single_purchase`、`subscription`、`trial`、`admin_grant`。

### 5.2 商品 `payment_products`

```json
{
  "productId": "true_heart_report_unlock_v1",
  "type": "report_unlock",
  "enabled": true,
  "priceFen": 199,
  "applicableAssessmentTypes": ["true_heart_bureau"],
  "title": "真心鉴定完整报告解锁卡",
  "description": "永久查看本次完整报告"
}
```

### 5.3 订单 `payment_orders`

```json
{
  "orderNo": "THB20260805...",
  "userId": "user_xxx",
  "productId": "true_heart_report_unlock_v1",
  "assessmentResultId": "result_xxx",
  "amountFen": 199,
  "status": "pending",
  "channel": "wechat_mini_program",
  "providerTransactionId": null,
  "paidAt": null,
  "fulfilledAt": null,
  "createdAt": "..."
}
```

同一 `userId + assessmentResultId + productId` 只允许存在一笔有效待支付订单；若已有已支付订单，直接返回已解锁，不重复下单。

## 6. 支付与权益发放

### 6.1 道具直购发起

1. 前端调用服务端 `prepareReportUnlock`，仅提交 `assessmentResultId`。
2. 服务端校验结果归属、测试完成状态、道具已发布状态、当前套餐是否本可免费查看；生成本系统的唯一商户订单号，并记录 `assessmentResultId` 与道具 ID 的绑定关系。
3. 小程序端以服务端返回的可信订单标识、已配置的道具 ID 及微信虚拟支付配置，调用 `wx.requestVirtualPayment`。该客户端接口内部会完成微信侧下单与拉起支付。
4. 客户端 `success` 仅用于刷新“支付处理中 / 查询结果”的界面，不得据此直接展示完整报告。

客户端不得提交价格、道具权益或支付成功状态作为可信数据；道具 ID、价格、订单归属均由服务端从已发布配置读取并校验。

### 6.2 支付确认、发货与解锁

微信官方明确指出 `wx.requestVirtualPayment` 的 `success` 回调可能因微信异常退出等原因丢失。因此必须实现以下至少一种确认链路，首版采用“两者都做”：

1. **发货推送主链路**：配置并接收 `xpay_goods_deliver_notify` 消息，验证签名、订单号、道具 ID、金额及用户身份；确认支付后幂等发放报告权益，并按协议返回发货结果。
2. **订单查询兜底链路**：当用户回到结果页、订单超时未完成或推送未到达时，服务端调用 `/xpay/query_order` 查询现金订单状态；确认已支付后执行相同的幂等发货逻辑，并通过 `/xpay/notify_provide_goods` 回执发货完成。
3. 使用事务或幂等锁将订单从 `pending` 更新为 `paid`，再将对应 `assessment_results.fullReportUnlocked` 更新为 `true`，写入 `unlockedAt` 和 `unlockSource: single_purchase`。
4. 订单标记 `fulfilledAt`；前端轮询本系统结果解锁状态或主动刷新结果页。

即使推送、轮询或前端刷新重复到达，也只能完成一次权益发放。前端支付回调仅用于刷新界面，不能作为解锁凭据。

### 6.3 失败与补偿

- 用户取消支付：订单保持 `pending`，允许在有效期内继续支付或重新发起；
- 超时未支付：服务端定时关闭本系统待处理订单；
- 已扣款但未发权益：根据订单号调用 `/xpay/query_order` 确认后，触发幂等补发；
- 已解锁结果再次点击购买：直接跳转完整报告，不创建新订单。

## 7. 套餐与权限规则

保持现有 `features/excludedFeatures` 的套餐权限体系。

建议定义独立 feature：

```json
{
  "featureKey": "trueHeartBureauFullReport",
  "description": "真心鉴定局完整报告"
}
```

规则：

- 免费用户：可测试和查看预览，默认无完整报告权限；
- 试用期：按当前订阅配置决定，默认开放；
- Pro / Ultra：默认开放，但以后台 `features/excludedFeatures` 为准；
- 单次购买：仅解锁购买时绑定的那一份结果，不扩展为全站权限；
- 管理员：可按用户或结果人工授予，必须记录 `unlockSource: admin_grant` 与操作日志。

## 8. 后台配置

在后台新增“真心鉴定局支付与解锁”配置面板：

- 单次报告解锁总开关；
- 商品显示名称、描述、价格（分）；
- 支持的测试类型；
- 免费预览文案模板；
- 试用期、Pro、Ultra 对完整报告的 feature 配置入口；
- 下架行为：禁止新下单，不影响已购买用户回看；
- 订单查询、按订单补发权益、人工授予与操作审计。

价格、文案、开关均从服务端读取。前端不得内置 `¥1.99` 为唯一价格来源。

## 9. 埋点指标

至少记录以下事件与字段：

- `true_heart_share_landing_view`：分享来源、渠道；
- `true_heart_test_start`；
- `true_heart_test_complete`：阶段、测试对象；
- `true_heart_preview_view`：主匹配人物、相似度区间；
- `true_heart_unlock_click`：单次购买或订阅入口；
- `true_heart_order_created`；
- `true_heart_order_paid`；
- `true_heart_full_report_view`；
- `true_heart_subscription_upgrade`。

核心漏斗：分享进入 -> 开始答题 -> 完成答题 -> 查看预览 -> 下单 -> 支付成功 -> 完整报告查看 -> 订阅升级。

## 10. 验收标准

1. 新用户能够在登录后免费完整答题并看到有效预览。
2. 免费预览不含最终“继续 / 观察 / 暂停投入”结论及完整红黄灯解释。
3. 支付金额仅从服务端商品配置读取，前端篡改金额不生效。
4. 支付渠道回调重复时，订单和权益只处理一次。
5. 单次购买只解锁其绑定结果，其他结果仍遵循原权限规则。
6. 套餐用户无需重复购买即可查看其套餐允许的完整报告。
7. 已支付报告可以在测试记录页永久回看。
8. 后台可配置商品开关、价格、套餐 feature，并可审计与补发订单权益。
