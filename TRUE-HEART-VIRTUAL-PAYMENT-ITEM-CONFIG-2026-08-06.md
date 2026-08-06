# 心动人设局虚拟支付道具配置

日期：2026-08-06
版本：v2.1，与 `HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md` 一致
适用支付模式：微信小程序虚拟支付，道具直购

## 1. 微信商户后台道具资料

| 配置项 | 建议值 |
| --- | --- |
| 道具名称 | 心动人设局完整报告 |
| 道具简介 | 解锁本次测评的完整人物匹配、关系信号与相处建议 |
| 对外售价 | ¥1.99 / 次 |
| 道具类型 | 虚拟道具，结果绑定型权益 |
| 使用方式 | 支付成功后即时发货并直接查看当前完整报告 |
| 有效期 | 永久回看本次已解锁报告 |
| 转赠 / 转移 | 不支持 |
| 道具封面 | `static/payment-items/true-heart-full-report-item.png`（200 × 200，少于 200KB） |
| 后台发布 | 先上传至开发版本完成沙箱验证，再发布至现网版本 |

不要在微信后台填写“代币兑换比例”，也不要将该道具与 Crush credits 建立兑换关系。

## 2. 图片使用说明

封面设计不出现任何真人、名人或具体影视角色，仅表达“鉴定报告已经展开”的概念。这样不会因人物原型更新而要求替换支付道具图。

源稿：`design-mockups/true-heart-full-report-payment-item.html`
上传文件：`static/payment-items/true-heart-full-report-item.png`

图片上的文字为“心动人设局”“TA 到底是哪一挂”“完整报告”“已解锁”；不应在此封面中放置 ¥1.99，价格以微信后台配置和支付页实时显示为准。

## 3. 道具与业务对象的关联

微信侧只需要维护一个已发布道具；本系统用每笔订单把同一道具绑定到不同的测试结果。

```text
微信已发布道具 productId
  -> heartPersonaReportPayment.sandboxProductId / productionProductId
  -> archetype_report_orders.outTradeNo
  -> resultId
  -> archetype_results.reportAccess.purchaseState = unlocked
```

推荐配置结构：

```json
{
  "heartPersonaReportPayment": {
    "enabled": true,
    "answerBeforePayEnabled": true,
    "priceFen": 199,
    "sandboxProductId": "0001",
    "productionProductId": "现网发布后填写",
    "allowedFeatures": [
      "关系女主角",
      "Crush名人图鉴",
      "次元角色图鉴"
    ],
    "refundRevokesPurchase": true
  }
}
```

权限配置中的 `关系女主角` 表示“关系主角测试（含关系男主角和关系女主角）”。题库仍通过 `subjectGender` 区分男女，不新增第四个套餐权限键。

订单必须保存：

```json
{
  "outTradeNo": "平台商户订单号，必须全局唯一",
  "userId": "当前登录用户",
  "productId": "当前环境已发布道具 ID",
  "resultId": "archetype_results._id",
  "kind": "relation_archetype | crush_celebrity | dimension_character",
  "status": "pending | paid | fulfilling | fulfilled | closed | refunded | exception"
}
```

同一用户对同一 `resultId` 只允许一份永久权益。道具可以被不同用户或同一用户针对不同结果重复购买，但一次购买不能解锁其他结果。重复付款订单必须标记 `duplicatePaid` 并创建 `archetype_report_refund_tasks` 待办。

## 4. 发货关联规则

1. 用户点击“¥1.99 解锁本次完整报告”时，服务端先校验结果归属、结果已完成、当前用户不具备订阅免费查看权且尚未解锁。
2. 服务端创建唯一 `outTradeNo`，把 `resultId` 保存在 `archetype_report_orders`，透传 `attach` 只使用不可猜测随机值。
3. 前端调用 `wx.requestVirtualPayment`，使用 `mode=short_series_goods` 购买当前环境 `productId`。
4. 接到 `xpay_goods_deliver_notify` 后，服务端按 `OutTradeNo` 找订单，校验 OpenId、Env、ProductId、Quantity、OrigPrice、Attach 后幂等写入 `reportAccess.purchaseState=unlocked`。
5. 若推送没有到达，服务端使用 `/xpay/query_order` 查询现金订单，确认付款后发货，并以 `/xpay/notify_provide_goods` 回执完成。
6. 用户重新进入结果页时，只读取该结果的解锁状态；不读取客户端保存的道具数量。

## 5. 与套餐的关系

| 用户状态 | 是否调用虚拟支付 | 最终结果状态 |
| --- | --- | --- |
| 免费用户且未购买 | 是 | 支付成功后解锁本次报告 |
| 试用期且具备对应模块 feature | 否 | 动态套餐权限直接查看，不写永久购买字段 |
| Pro / Ultra 且具备对应模块 feature | 否 | 动态套餐权限直接查看，不写永久购买字段 |
| 已购买同一结果 | 否 | `reportAccess.purchaseState=unlocked`，永久回看 |
| 已购买其他结果 | 是 | 本次结果仍需单独购买或使用套餐权益 |

## 6. 上线前需要人工填写的值

- 微信虚拟支付商户后台发布后的现网道具 `productId`；开发版已知为 `0001`；
- 虚拟支付基础配置中的 `offerId` 和当前环境 `appKey`；
- 发货推送继续使用 `https://cloud1-d0gvhqu2c8a2b61fd.service.tcloudbase.com/security/media-callback`，不新建支付专用 URL；
- 沙箱和现网的环境开关；
- 道具在开发版本与现网版本的发布状态。
