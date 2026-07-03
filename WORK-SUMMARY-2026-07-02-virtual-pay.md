# 工作总结 · 微信小程序虚拟支付接入调试

**日期**：2026-07-02
**范围**：微信小程序「虚拟支付」充值/订阅链路调通 + 上线阻断项修复 + query_order 412 诊断
**环境**：CloudBase envId `cloud1-d0gvhqu2c8a2b61fd`，小程序 appid `wxb8bd1a6b518e931e`，虚拟支付 offer_id `1450578598`

---

## 一、本次解决的问题（按时间线）

### 1. `signData` 报 `Unexpected token a in JSON`（前端调起失败）
- **根因**：微信 `requestVirtualPayment` 要求 `signData` 是 **JSON 字符串**，代码却做成了 `key=value&` 拼接串（沿用了微信支付 V3 的习惯，迁移文档本身也写错了）。微信内部 `JSON.parse` 到第 0 位字符 `a`（attach）即报错。
- **修复**：
  - `signData` 字段 snake_case → **camelCase**（offerId/buyQuantity/currencyType/env/outTradeNo/attach，道具模式加 productId/goodsPrice）
  - 新增 `serializeSignData`：字段字典序排序后 `JSON.stringify`
  - `paySig = HMAC-SHA256(appKey, "requestVirtualPayment&" + signData)`；`signature = HMAC-SHA256(session_key, signData)`
  - 前后端使用**同一份 JSON 字符串**，逐字节一致
- **验证**：用微信官方自校验样例（`/xpay/query_user_balance`，appKey=12345）验证 HMAC 算法，paySig/signature 精确匹配 ✅

### 2. `signData should be String instead of Undefined`
- **根因**：微信开发者工具加载的是 `dist/build/mp-weixin`（生产产物），但只重建了 `dist/dev`，`build` 仍是旧前端（读已删除的 `signDataStr` 字段）。
- **修复**：改用 `npm run build:mp-weixin` 重建生产产物。**教训**：微信小程序改前端后必须 `build:mp-weixin`，不是 `dev:mp-weixin`。

### 3. `SIGNATURE_INVALID`（用户态签名失败）
- **根因**：`signature` 用的 `session_key` 取自 DB 存量，已过期。虚拟支付要求 session_key 新鲜。
- **修复**：
  - 后端 `virtual-pay.js` 新增 `getSessionKeyByCode`（jscode2session 现换最新 session_key）
  - `recharge/index.js` 支付时优先用前端传的 `loginCode` 现换 session_key 并刷新 DB，失败回退 DB
  - 前端 `api.ts` 的 `createVirtualPayOrder` 支付前 `wx.login` 拿 code 传给后端
- **结果**：**沙箱充值成功** ✅（用户确认）

---

## 二、链路审计 + 上线阻断项修复（代码已改、已部署，未 commit）

审计发现 3 个「正式环境阻断」项（沙箱靠降级掩盖）。用户选择方案：**前端轮询 + 补偿**（不做重量级消息推送回调）。

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| 1 | 查单验签 uri 缺前导 `/` | `xpay/query_order` → `/xpay/query_order`（对齐官方样例） | `_shared/virtual-pay.js` |
| 2 | 金额/一致性校验是 TODO | confirmVirtualPay 加防御式校验：字段存在但不符→拒发+标记异常；缺失→告警不阻断 | `recharge/index.js` |
| 3 | 发货前端单点、无兜底 | repairOrder 兼容 outTradeNo；前端 doVirtualRecharge/doVirtualSubscribe 加 30s/20 轮 confirmVirtualPay 轮询 + 「到账处理中」三态引导 | `recharge/index.js`、`token-recharge.vue`、`subscription.vue` |

均已 `node --check` + `build:mp-weixin` + 部署 recharge。

---

## 三、当前卡点：query_order 服务端接口 HTTP 412（未解决，根因在后台配置）

正式环境实测，`confirmVirtualPay` 查单返回 **HTTP 412 + 空响应体**。

### 已完成的分层诊断（本地用真实凭证+真实已支付订单 `RCmr3fcph2bc12bab1`，无需再付款）
- ✅ 签名算法正确（官方样例精确匹配）
- ✅ access_token 有效（同 token 调 `/cgi-bin/get_api_domain_ip` 返回 200）
- ✅ 现网/沙箱 AppKey **逐字符核对一致**（32 位、纯字母数字、无首尾空格）
- ❌ 所有变体一律 412：uri 带/不带 `/`、body 增减字段、加 `ts`（body/querystring 两种放法）、沙箱 key(env=1)/现网 key(env=0)、交叉组合
- ❌ 乱 pay_sig / 缺 pay_sig → 网关直接 socket hang up（RST）；合法 64-hex pay_sig 才进到 412
- ❌ 412 响应头仅 `connection` + `content-length:0`，**无 date/server/rid** → 请求在**接入层被拒**，未进业务逻辑

### 结论
**根因不在代码，在微信后台接入配置**。最可能：**虚拟支付 2.0 协议未签约生效**（2026-04-01 后强制 2.0；协议签约需约 2 个工作日）。现象吻合：前端 requestVirtualPayment 能调起支付，但所有 `/xpay/*` 服务端接口 412。

### 硬约束
虚拟支付**代币充值**的支付确认**只能靠 query_order 查单**（回调只返回 openid、拿不到订单，无法用于发货）。**server API 不通 → 正式环境无法安全发货**（不查单发货=刷单漏洞），无代码绕过。当前正式环境是**安全**的：查不到就不发货，前端提示「到账处理中」，不会误发/错扣。

---

## 四、待办（需用户在微信后台操作，Claude 无法代登）

1. **【最高优先】查协议状态**：`mp.weixin.qq.com` → 功能 → 虚拟支付 → 看右上角是否「已签署虚拟支付 2.0 协议 / 已签约」。若显示「当前已签署的协议不适用于 2.0」→ 点开通签署，等约 2 个工作日生效。
2. 确认 offer_id `1450578598` ↔ appid 绑定、分区(zone_id)、服务端接口权限/IP 白名单。
3. 若协议已签约仍 412：用微信「错误排查(errorDiag)」工具或开放社区(pay 专区)提工单，附 appid/offer_id/接口/请求时间/412 空响应现象。
4. **安全**：现网/沙箱 AppKey 已在对话中暴露，排查通后建议在后台**重置 AppKey**，更新 `cloudbaserc.json` 并重新部署 recharge。
5. 协议生效后：用 `test-query-order.js` 本地重测，412 变 `200+errcode` 即通，再据真实响应字段校准 confirmVirtualPay 成功判断 + #2 校验字段。

---

## 五、遗留/未处理
- 🟡 `buyQuantity` 传的是 `amountFen`（金额分），依赖后台配置「1元=100代币」才自洽 —— 待确认。
- 🟡 并发重复发货竞态：建议给 `call_usage_records (userId,source,sourceId)` 加唯一索引。
- 🟢 退款接口 `/xpay/refund_order` 未实现。
- 🟢 `PAY_DEBUG=true` 会打印 signData 等，正式上线建议关闭。
- 🟢 `USE_VIRTUAL_PAY=false`，正式启用需改云端环境变量。
- 🔧 诊断脚本 `test-query-order.js` 保留在项目根，协议问题解决后可删。

---

## 六、本次改动文件（虚拟支付线）
**后端**：`cloudfunctions/recharge/_shared/virtual-pay.js`（新增）、`cloudfunctions/recharge/index.js`、`cloudfunctions/wechatLogin/index.js`
**前端**：`src/utils/api.ts`、`src/pages/token-recharge/token-recharge.vue`、`src/pages/subscription/subscription.vue`
**部署**：recharge 云函数已多次部署到 `cloud1-d0gvhqu2c8a2b61fd`；前端 build 产物已重建
**注**：工作树另有大量非本次改动（token→credits 改名、taohua、admin 面板等），不在本总结范围。
