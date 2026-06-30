# 今日工作总结

日期：2026-06-27

项目：workspace-girl-uniapp / 微信小程序 Crush Master

## 1. 微信支付自研迁移

### 1.1 背景

集成中心微信支付模板（`crushradar2-lruw5vn1-demo-scfweb`）的回调通道在 CloudBase 网关层被静默丢弃，`handlerUnifiedTrigger` 从未触发，导致所有支付成功的订单永远停留在 `pending` 状态，无法自动发货。网关层是黑盒，日志不对外开放，无法从应用侧修复。

### 1.2 解决方案

完全绕过集成中心模板，在 `recharge` 云函数内用 Node.js 内置 `crypto` + `https` 直接调用微信支付 API v3，实现自签名、自验签、自解密。

### 1.3 新增文件

- `cloudfunctions/recharge/_shared/wxpay-v3.js` — 微信支付 V3 工具库（~280 行），零外部依赖
  - `createJsapiOrder()` — JSAPI 统一下单（POST `/v3/pay/transactions/jsapi`）
  - `createPayParams()` — 生成前端 `wx.requestPayment` 参数
  - `queryOrderByOutTradeNo()` — 商户订单号查单
  - `verifyCallbackSignature()` — 回调 RSA-SHA256 验签
  - `decryptResource()` — 回调 AES-256-GCM 解密
  - PEM 密钥采用 Base64 编码存储，运行时解码

### 1.4 云函数改造

`cloudfunctions/recharge/index.js`：
- 新增 `unifiedOrder` action：一站式完成「DB 订单创建 + 微信 V3 下单 + 支付参数生成」，替代旧的两段式（`createPaymentOrder` + `callHTTPFunction`）
- 新增 `queryOrder` action：直接调微信 V3 查单 API，替代旧的 `scfInvokeTemplate()` → 集成中心模板
- 重写 `paymentCallback`：支持 HTTP 触发器直达（自验签+解密），同时兼容旧集成中心转发
- `exports.main` 新增 HTTP 触发器检测，POST 请求自动路由到回调处理
- 废弃（保留不调用）：`httpPostJSON`、`scfInvokeTemplate`、`activeWeChatQuery`、`debugWxQuery`

### 1.5 前端改造

- `src/utils/api.ts`：新增 `unifiedOrder()`、`queryOrder()` 封装
- `src/pages/token-recharge/token-recharge.vue`：`callHTTPFunction` → `unifiedOrder`，轮询 `queryPaymentOrder` → `queryOrder`
- `src/pages/subscription/subscription.vue`：同上

### 1.6 配置变更

- `cloudbaserc.json`：`recharge` 函数新增 7 个 `WXPAY_*` 环境变量
- CloudBase 控制台：为 `recharge` 函数创建 HTTP 访问服务路由 `/pay/notify`（免鉴权），作为微信支付回调入口

### 1.7 端到端验证

已完成充值 0.01 元完整链路验证：

```
unifiedOrder ✅ → WeChat V3 签名 ✅ → 微信支付 ✅
→ HTTP 回调验签 ✅ → AES-GCM 解密 ✅ → 发货 ✅
→ confirmPayment 幂等 ✅
```

回调日志全链路可见：`[WXPAY][sign]` → `[WXPAY][createJsapiOrder]` → `[WXPAY][verify]` → `[WXPAY][decrypt]` → `[PAYDBG][fulfill]`

### 1.8 调试过程

签名调试经历 3 轮迭代：
1. `crypto.createSign('RSA-SHA256')` → SIGN_ERROR（可能是 Auth header 格式问题）
2. `crypto.sign('sha256', ...)` with explicit PKCS1 padding → SIGN_ERROR
3. 回退 `crypto.createSign('RSA-SHA256')` + 对齐微信官方示例的 Authorization 格式 + PEM CRLF 清洗 → **通过**

## 2. 文件改动清单

| 文件 | 操作 |
|------|------|
| `cloudfunctions/recharge/_shared/wxpay-v3.js` | 新增 |
| `cloudfunctions/recharge/index.js` | 修改（+unifiedOrder, +queryOrder, 改paymentCallback, 改exports.main） |
| `src/pages/token-recharge/token-recharge.vue` | 修改（callHTTPFunction → unifiedOrder） |
| `src/pages/subscription/subscription.vue` | 修改（同上） |
| `src/utils/api.ts` | 修改（+unifiedOrder, +queryOrder） |
| `cloudbaserc.json` | 修改（+7 个 WXPAY_* 环境变量） |

不动的文件：`payment-fulfillment.js`、`billing.js`、`subscription.js`、`auth.js`

## 3. 待完成

- [ ] 订阅升级端到端测试（Pro 套餐）
- [ ] 管理员配置 `ADMIN_EMAILS` 环境变量
- [ ] 微信支付商户平台配置回调通知地址
- [ ] 稳定运行一个发布周期后，删除废弃代码（`httpPostJSON`、`scfInvokeTemplate`、`activeWeChatQuery`、`debugWxQuery`）
- [ ] 前端旧 `callHTTPFunction` 代码清理（template 函数名前缀 `crushradar2-lruw5vn1-demo-scfweb`）
