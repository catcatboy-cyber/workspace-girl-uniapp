# 审计报告：HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md（v2.0）

日期：2026-08-06
被审计文档：`HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md`
审计人：Claude（人工复核后交付 DeepSeek）

## 审计方法

1. **官方文档核对**：与本地微信官方文档 HTML 逐字段核对——`Downloads\用户需求\虚拟支付 _ 虚拟支付.html`（总览，258KB）+ `虚拟支付 _ 通知已发货完成.html`（378KB）；客户端错误码章节本地未保存，用 WebSearch 补充（仅能确认 -15008=SIGN_ERR 等少量信息）。
2. **代码库现状核对**：3 个探索 agent + 亲自精读 `cloudfunctions/contentSecCallback/index.js`、`cloudfunctions/saveArchetypeResult/index.js`、`cloudbaserc.json`、三个答题页（relation-heroine / crush-celebrity / dimension-character）。
3. **项目历史经验对照**：记忆库 `project-virtual-pay-412-blocker`（2026-07-03 实测：412 根因=缺 Content-Length、query_order 缺 wx_order_id 报 268490002）。
4. **方案内部一致性检查**。

## 总体结论

方案质量高：官方字段表、状态枚举、响应格式、文件级清单、防泄漏判断**基本全部属实**，可直接作为开发依据。但存在 **2 个高危问题**（其中一个会直接导致联调踩坑重蹈 268490002 覆辙）和 3 个中危问题，交付 DeepSeek 前必须修正。

---

## 🔴 P1-1：查单请求体三方矛盾 —— 方案 3.3 与现有代码、项目实测记忆直接冲突

`query_order` 请求体存在三套说法：

| 来源 | 请求体 |
| --- | --- |
| **方案 3.3** | `{openid, env, order_id}`，明确"不添加 offer_id" |
| **现有代码** `recharge/_shared/virtual-pay.js` | `{env, offer_id: OFFER_ID, openid, order_id: outTradeNo}`（含 offer_id；注释明示"微信虚拟支付接口只认 order_id 或 wx_order_id"；wx_order_id 永不发送） |
| **项目实测记忆**（2026-07-03） | 缺 `wx_order_id` 报 **errcode 268490002**；可用 body 含 `offer_id` + `wx_order_id` |

**风险**：DeepSeek 若按方案 3.3 原样实现（去掉 offer_id），很可能重演 7 月的 268490002 联调事故。

**配套缺口（更严重）**：方案 11.3/8.2/8.3 的整个闭环**没有任何 wx_order_id 上报通道**——现有充值链路是 `支付成功回调取 payResult.orderId → confirmVirtualPay(outTradeNo, wxOrderId) → 存 DB`（前端回调里就有 `orderId`），方案却只凭 `outTradeNo` 查单，一旦 order_id 查不到（实测记忆表明可能查不到）就没有退路。

**修正建议**（任选其一，推荐 A）：
- **A**：按现有代码结构实现 `{env, offer_id, openid, order_id}`，沙箱实测；同时给订单表加 `wxOrderId` 字段 + 前端 success 回调上报通道（复用现有 `confirmVirtualPay` 先例），作为查单失败时的二级凭据。
- **B**：若坚持方案 3.3 的 body，必须先在沙箱用真实订单验证 order_id 可查，把验证结果写进方案。

---

## 🔴 P1-2：featureKey 四键 vs 代码三键 —— 方案 5.1 与现状不符，且存在权益漏洞隐患

- 现状：`ARCHETYPE_FEATURES` 只有 **3 个键**（`关系女主角`/`Crush名人图鉴`/`次元角色图鉴`），`关系男主角` 不是键——男性题库**共用 `关系女主角` 键**（它是 subjectGender='male' 的 displayTitle）。
- `checkFeatureAccess` 逻辑是"命中 excludedFeatures 即拒绝，**否则放行**"。
- 方案 5.1 要引入第 4 个独立键 `关系男主角`，但：
  1. **存量配置迁移缺失**：已有 `settings_subscription` 文档只有 3 键；新键若未写入 free 的 excludedFeatures，free 用户对男性关系题库将**完全放行**（答题+看完整报告），直接打穿付费墙。方案 10 的"不做历史数据迁移"与"新增键"自相矛盾——新键本身就是配置迁移。
  2. **修改清单遗漏**：`src/utils/feature-keys.ts`、admin 面板（ArchetypeQuestionBankPanel）、`getArchetypeQuestionBank` 的 featureKey 白名单校验都未列入 13.2。

**修正建议**：二选一并写死进方案——① 维持三键（male 归 `关系女主角`，5.1 表格与 8.1 映射相应调整，最简单）；② 坚持四键，则必须增加"存量订阅配置幂等补键"步骤（不覆盖其他字段），并补列 feature-keys.ts 等文件。

---

## 🟠 P2-1：关系原型人物没有 coverUrl —— 方案 6.1/6.4 字段假设错误

方案 6.1 让关系原型返回人物 `coverUrl`，6.4 预览固定含"封面"。实际数据模型：关系 archetypes 只有 `key/name/label/enabled`（无 coverUrl、无 scores）；coverUrl 仅名人/次元的 `people` 有。预览 DTO 需按 kind 条件化（关系题无封面或生成占位）。

## 🟠 P2-2：退款凭据与"退款待办"无落库位置

方案 10.4 校验 `WxRefundId/MchRefundId/WxOrderId/RefundFee`，但订单表 7.2 只有 `refundedAt`，没有退款单号字段；9.6"生成管理员退款待办"也未定义存储（集合/字段）。审计追踪不完整，重复退款幂等判定缺凭据。

## 🟠 P2-3：客户端错误码语义未核实（-15002/-15012/-15005/-15007/-15010/-15013/-15014）

本地官方总览 HTML 未保存客户端错误码表，WebSearch 只能确认 **-15008=SIGN_ERR**（签名错误）、-15001、-15003 等社区信息。方案对这些码的分类（建新单/重新 login/配置异常）**无法核实**。风险可控（所有 fail 路径绝不解锁），但建议：开发时对照官方最新页面校正映射；显式补一条通用兜底——未列出的错误码（如 -15008）走"提示重试 + 查单确认"，不展示解锁也不死循环。

---

## 🟡 P3 低危项

1. **Content-Length/412 未进测试矩阵**：412 是历史根因（chunked→412），canonical `virtual-pay.js` 从现有代码迁移时自带修复，但 15.3 测试矩阵无此项回归，建议补"不带 Content-Length 的请求必须 412"反向用例。
2. **access_token 内存缓存冷启动失效**（5s 现取）：推送与 reconcile 路径都依赖，推送失败返回非 0 ErrCode 靠微信重试兜底即可，知悉即可。
3. **pending 订单无过期清理**：取消支付的订单永久留存，建议加 30 分钟自动 closed（配合 8.4 的 ORDER_CLOSED）。
4. **未知事件返回 400 会被微信重试 15 次**（如 `xpay_complaint_notify`/`xpay_wxpay_callback_notify` 推送过来时）：无害但噪音，可选返回 200+ErrCode 0。
5. **media-callback 路由无仓库配置**：`cloudbaserc.json` 中 contentSecCallback 无 HTTP 触发器/路径，`/security/media-callback` 是控制台级配置，部署时需人工确认路由仍指向该函数。
6. **文档命名不一致**：`TRUE-HEART-VIRTUAL-PAYMENT-ITEM-CONFIG-2026-08-06.md` 仍用 v1 命名（`trueHeartFullReport`/`assessment_results`/`virtual_payment_orders`/`wechatItemId`），与 v2.0（`archetype_report_orders`/`productId 0001`）不统一。交付 DeepSeek 时容易混淆"微信道具 ID = productId"，建议道具配置文档同步更新或加注。

---

## ✅ 已核实通过项（与官方文档/代码一致）

- **发货推送无 OfferId** ✓（官方字段表逐项核对：ToUserName/OpenId/OutTradeNo/Env/WeChatPayInfo/GoodsInfo/TeamInfo，Env 0=现网/1=沙箱，与方案 3.2/10.3 完全一致）
- **退款推送 15 字段全对** ✓（含 RetCode 0=成功、重试"2 4 8 16...最多 15 次"）
- **推送响应三方式** ✓（ErrCode XML/JSON 推荐 + 空/success 等价），方案"按请求格式返回"正确
- **notify_provide_goods** ✓：order_id/wx_order_id 二选一、"只能通知现金单"、env 0/1，全部与官方一致；方案"推送正常时不调用"符合官方说明
- **query_order env_type 映射** ✓：返回 env_type 1=现网/2=沙箱（请求 env 0=正式/1=沙箱），方案 3.3 的对应关系正确；status 0-8 枚举（含 8=用户退款完成）✓
- **签名规则** ✓：`paySig=HMAC(appKey,'requestVirtualPayment&'+signData)`、`signature=HMAC(session_key,signData)`，与现有实现逐条吻合；8.1 步骤 8"同 signData/paySig + 新 session_key 重签 signature"逻辑成立；支付前 wx.login 现换 session_key 符合官方要求且是现有做法
- **防泄漏声明全部属实**：题库含 scores/profile/calibration/reverse/dimensionKey/typicalOptionKey（客户端可重算）、saveArchetypeResult 返回完整计算结果+answers、getArchetypeResults 返回原始文档、结果页客户端拼报告——四条泄漏路径真实存在
- **沙箱 fail-open 确实存在**于 `recharge/index.js`（L708-715），方案"删除沙箱 fail-open、fail closed"是真修复点
- **contentSecCallback 现状**与 10.2 一致：echostr/SHA1/WECHAT_MESSAGE_TOKEN 验证已有；JSON-only（XML 需新增 fast-xml-parser，13.2 已列）；媒体回调现回 text success 属官方三方式之一
- **文件级清单全部准确**：新增/修改/不存在断言逐一核实无误（含 `_shared/virtual-pay.js` 列为新增、sync-shared.js 机制与 13.3 吻合、`relation-hero-result.vue` 确实不存在）
- **题库投影不破坏答题页**：三个答题页只消费投影白名单内结构（stages/screener/archetypes/universalQuestions/stageQuestions/scenarios/questions/people/options）；checksum 校验是服务端内部逻辑（`saveArchetypeResult` L82 用服务端全文重算），不依赖客户端回传——投影可行
- **免费用户当前确实被 `FEATURE_NOT_AVAILABLE` 拦截**，"旧套餐键阻断先答题"属实
- 道具 ¥1.99/199 分/心动人设局 与 `TRUE-HEART-VIRTUAL-PAYMENT-ITEM-CONFIG-2026-08-06.md` 一致

---

## 下一步建议

修正 P1-1（查单 body + wx_order_id 通道）和 P1-2（键模型决策 + 存量配置补键）后再交付 DeepSeek；P2 项可随实现一并处理。

## 参考资料

- 微信官方虚拟支付总览（本地）：`Downloads\用户需求\虚拟支付 _ 虚拟支付.html`
- 微信官方通知已发货完成（本地）：`Downloads\用户需求\虚拟支付 _ 通知已发货完成.html`
- 官方 query_order：https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html
- 官方 notify_provide_goods：https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_notify_provide_goods.html
- 官方 requestVirtualPayment：https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html
