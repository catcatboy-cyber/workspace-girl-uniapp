# UniApp 原生 App 打包方案 · Android / iOS / HarmonyOS

**项目**：workspace-girl-uniapp（Vue 3 UniApp + CloudBase 后端）
**日期**：2026-07-04（v5，基于代码审计修正 v4 的 4 个问题）
**核心原则**：**零影响微信小程序**，平台独立互不干扰

---

## 〇、修正记录

### v5 修正记录（相对 v4）

| # | v4 问题 | v5 修正 |
|---|---------|---------|
| 1 | 误判 App/H5 路径会自动创建 `users` 文档 | 恢复 `registerAppUser` 云函数，Phase 1 D1 先打通匿名用户文档创建 |
| 2 | IAP 未写产品可用性预检 | 增加 `requestProduct` / Product ID 可购买性检查 |
| 3 | `restoreIapTransactions` 未说明无 `orderNo` 时如何补单 | 明确按 `transactionId` 幂等查找；无订单则创建补偿订单再发货 |
| 4 | Android 微信开放平台前置条件少包名/签名 | 补充 Android packageName、应用签名 SHA/MD5、manifest 包名一致性要求 |

### v4 修正记录（相对 v3）

| # | v3 问题 | v4 修正 |
|---|---------|---------|
| 1 | 声称需新建 `getTempFileURL` 云函数 | **删除**——`@cloudbase/js-sdk` 自带 `getTempFileURL` 方法，`avatar.ts` 已在用 |
| 2 | `pets.js` 只提 4 函数拆平台 | 扩大为 7 函数（加 `ensurePetCloudReady`、`ensureDir`、`persistTempFile`） |
| 3 | `App.vue` 只提 `silentWechatLogin` 加守卫 | 补充：隐私协议 `wx.onNeedPrivacyAuthorization` 整块也需 `#ifdef MP-WEIXIN` |
| 4 | 录音"三路拆分"描述模糊 | 明确策略：MP-WEIXIN→wx / APP-PLUS→uni / H5→null |
| 5 | 第二节规则禁止 `#ifndef` 新增逻辑，第六节却要求在 `#ifndef` 块补 polyfill | 删除矛盾任务（polyfill 本就不需要） |
| 6 | 未说明环境变量注入方式 | 明确通过 CloudBase 控制台设置，不写入代码仓库 |
| 7 | 缺少 CloudBase JS-SDK App 环境兼容性验证 | Phase 1 D1 新增 smoke test 任务 |
| 8 | 文件清单 12 个，含虚构的 getTempFileURL 云函数 | 修正为 10 个文件 |

---

## 一、现有项目架构

```
workspace-girl-uniapp/
├── src/
│   ├── pages/ / components/ / utils/ / styles/ / static/
│   ├── App.vue / main.js
│   ├── pages.json           ← 路由（不是 src/pages/pages.json！）
│   └── manifest.json         ← 打包配置（不是 src/pages/manifest.json！）
├── cloudfunctions/           ← 35+ 个云函数，所有平台共享
├── dist/
│   ├── build/mp-weixin/
│   ├── dev/mp-weixin/
│   ├── build/app/
│   └── build/h5/
├── package.json / vite.config.js / cloudbaserc.json
```

**隔离机制**：
| 层级 | 隔离方式 |
|------|---------|
| 源码层 | `#ifdef MP-WEIXIN` / `#ifdef APP-PLUS` / `#ifdef APP-HARMONY` / `#ifdef H5` |
| 构建产物层 | `dist/build/<platform>/` 独立子目录 |
| 后端 | 云函数共享，新功能通过 `action` 路由 |


---

## 二、条件编译指令

| 指令 | 命中 | 规则 |
|------|------|------|
| `#ifdef MP-WEIXIN` | 微信 | **禁止修改**现有代码 |
| `#ifdef APP-PLUS` | Android + iOS | **新增**：App 端逻辑 |
| `#ifdef APP-HARMONY` | 鸿蒙 | **新增**：鸿蒙专用 |
| `#ifdef H5` | 浏览器 | **禁止修改**现有代码 |
| `#ifndef MP-WEIXIN` | 非微信 | **仅保留已有块**（cloudbase.ts SDK 初始化、avatar.ts 路径解析）。新增业务逻辑禁止放入，必须用 `APP-PLUS` / `APP-HARMONY` 明确平台 |

**原则**：不新增 `#ifndef` 块，不修改已有 `#ifdef MP-WEIXIN` / `#ifdef H5` 块内代码。

---

## 三、支付方案（三个平台，三个独立方案）

### 3.1 Android：微信 App 支付

**与小程序支付的差异**：

| 项目 | 微信小程序（现有，不动） | Android App（新增） |
|------|------------------------|---------------------|
| 接口 | `/v3/pay/transactions/jsapi` | `/v3/pay/transactions/app` |
| appid | 小程序 appid（wxb8bd…） | **开放平台 App appid**（需在 open.weixin.qq.com 申请） |
| 调起方式 | `wx.requestPayment({ paySign, ... })` | `uni.requestPayment({ provider: 'wxpay', orderInfo: Object })` |
| `orderInfo` | — | `{ appid, partnerid, prepayid, package, noncestr, timestamp, sign }` |
| manifest | 无需 | 需配置 modules.Payment + sdkConfigs.payment.weixin |

**注意**：DCloud 文档明确 Android/iOS 的 `orderInfo` 是 **Object**，仅 HarmonyOS Next 需 `JSON.stringify(orderInfo)`。

**后端新增 action**（`cloudfunctions/recharge/index.js`）：

```javascript
// action: 'unifiedOrderForAppAndroid'
// 调 /v3/pay/transactions/app（不是 jsapi！）
// env vars: WXPAY_APP_APPID_ANDROID（开放平台 appid，与 WXPAY_APPID 不同）
// 返回 { orderNo, orderInfo: { appid, partnerid, prepayid, package, noncestr, timestamp, sign } }
```

**前端**（subscription.vue / token-recharge.vue `#ifdef APP-PLUS` 块）：

```typescript
// #ifdef APP-PLUS
const sysInfo = uni.getSystemInfoSync()
if (sysInfo.platform === 'android') {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'unifiedOrderForAppAndroid', productType, planKey, ... }
  })
  if (!res.result?.success) return showError(res.result?.message)
  await new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: 'wxpay',
      orderInfo: res.result.orderInfo,  // Object，不是 JSON.stringify！
      success: resolve,
      fail: reject
    })
  })
  // 复用现有 confirmPayment 轮询确认发货
}
// #endif
```

**manifest.json 配置**：

```json
{
  "app-plus": {
    "modules": { "Payment": {} },
    "distribute": {
      "sdkConfigs": {
        "payment": {
          "weixin": {
            "appid": "wx开放平台AppAppid",
            "UniversalLinks": ""
          }
        }
      }
    }
  }
}
```

**前端防误调**：现有 `unifiedOrder` action 要求 openid，App 用户无 openid 会返回错误。`#ifdef APP-PLUS` 条件编译保证 App 端只会调 `unifiedOrderForAppAndroid`（Android）或 IAP（iOS），不会误调 `unifiedOrder`。

**微信开放平台前置条件**：
- Android 包名必须与 `manifest.json` / HBuilderX 云打包包名一致
- Android 应用签名（SHA/MD5，以微信开放平台要求为准）必须来自最终上架签名证书，不能用测试证书
- 开放平台移动应用 AppID、包名、签名、商户号关联全部审核通过后，App 端微信支付才可真机调起
- HBuilderX 云打包时必须使用同一套正式签名证书，否则微信 SDK 会因签名不匹配调起失败


---

### 3.2 iOS：Apple In-App Purchase（IAP）

**必须走 IAP**。Credits/月卡属于数字内容，App Store Review Guideline 3.1.1 强制要求。

**`orderInfo` 差异对比**：

| 平台 | `uni.requestPayment` 的 `orderInfo` 类型 | 值 |
|------|----------------------------------------|---|
| Android（微信 App 支付） | **Object** | `{ appid, partnerid, prepayid, ... }` |
| iOS（Apple IAP） | **String** | Product ID，如 `'pro_monthly_599'` |
| HarmonyOS（微信） | **String**（JSON.stringify 后的 Object） | `JSON.stringify({ appid, ... })` |

**完整 IAP 流程**（对齐 DCloud 官方文档）：

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. uni.getProvider({ service: 'payment' })                      │
│    → 检测是否支持 appleiap                                        │
│    → requestProduct(productIds) 预检商品是否可购买                │
│                                                                  │
│ 2. createIapOrder → 服务端创建 pending 订单，返回 orderNo         │
│                                                                  │
│ 3. uni.requestPayment({                                         │
│      provider: 'appleiap',                                       │
│      orderInfo: 'pro_monthly_599',  ← String: productId         │
│      manualFinishTransaction: true, ← 手动关单，防止丢单         │
│      success(res) { /* 4 */ },                                   │
│      fail(err) {}                                                │
│    })                                                            │
│                                                                  │
│ 4. 成功回调 → 拿到 transactionReceipt（Apple 返回的收据）         │
│    → 调云函数 verifyIapReceipt({ receipt, orderNo })             │
│    → 服务端验证成功后 → finishTransaction                         │
│                                                                  │
│ 5. 恢复未关闭订单（应用启动时注册）：                              │
│    restoreCompletedTransactions → 逐一 verify + finish           │
└─────────────────────────────────────────────────────────────────┘
```

**后端新增 action**（`cloudfunctions/recharge/index.js`）：

```javascript
// action: 'createIapOrder'
// 创建 DB 订单（status: 'pending', productType, productId, orderNo）
// 返回 { success, order: { orderNo } }

// action: 'verifyIapReceipt'
// 输入: { orderNo, transactionReceipt, transactionId, productId }
// 1. 调 Apple verifyReceipt API（沙箱用 sandbox.itunes.apple.com）
// 2. 验证 bundle_id 匹配 + status === 0
// 3. transaction_id 幂等检查（防重复发货）
// 4. 调 fulfillPayment 发货 + 标记 paid
// 返回 { success }

// action: 'restoreIapTransactions'
// 输入: { transactions: [{ transactionId, productId, receipt }] }
// 1. 按 transactionId 幂等查找已处理记录，已处理则直接返回可 finish
// 2. 未处理且找不到 pending orderNo 时，按 productId 创建一条补偿订单
// 3. 验证 receipt，成功后发货并记录 transactionId
// 4. 返回每笔交易的 verify/finish 状态，前端只对成功项 finishTransaction
```

**环境变量**（通过 CloudBase 控制台设置，不写入代码仓库）：
- `APPLE_SHARED_SECRET`：App Store Connect 共享密钥
- `APPLE_BUNDLE_ID`：com.xxx.crushmaster
- `IAP_USE_SANDBOX`：`true`（开发）/ `false`（正式）

**App Store Connect 配置**（6 个 Product ID）：

| Product ID | 类型 | 价格 | 对应 |
|-----------|------|------|------|
| `pro_monthly_599` | Non-Renewing Subscription | ¥5.90 | Pro 月卡 |
| `ultra_monthly_990` | Non-Renewing Subscription | ¥9.90 | Ultra 月卡 |
| `pro_annual_4800` | Non-Renewing Subscription | ¥48.00 | Pro 年卡 |
| `ultra_annual_7800` | Non-Renewing Subscription | ¥78.00 | Ultra 年卡 |
| `credits_190` | Consumable | ¥1.90 | 小加油包 |
| `credits_490` | Consumable | ¥4.90 | 大加油包 |

**前置条件**：
- Apple Developer Program ($99/年)
- App Store Connect 创建 App + 6 个内购产品
- Mac 电脑用于 Xcode 签名
- IAP 真机/沙箱测试前先执行 `requestProduct`，确认 6 个 Product ID 均能返回商品信息

---

### 3.3 HarmonyOS：支付（Phase 3 确定）

调研后确定方案优先级：微信鸿蒙 SDK > 华为 IAP > H5 网页支付兜底。

---

## 四、App 端登录与用户体系（基于实际代码验证）

### 4.1 实际代码架构

`src/utils/cloudbase.ts` 的双路径架构：

```
#ifdef MP-WEIXIN
  → wx.cloud.init() + wx.cloud.callFunction()
  → getTempFileURL / uploadFile 直接用 wx.cloud 方法
  → 不需要 ensureCloudAuthReady（微信 SDK 自己管鉴权）

#ifndef MP-WEIXIN
  → @cloudbase/js-sdk init()
  → auth.signInAnonymously() → CloudBase 分配匿名 UID
  → callFunction 自动注入 authUserId（如有 storedUserId）
  → getTempFileURL 是 SDK 内置方法（不需要云函数中转）
```

**关键确认**：`@cloudbase/js-sdk` 的 `app.getTempFileURL({ fileList: [...] })` 已在 `avatar.ts` 非微信路径正常使用。SDK 内置此能力，无需新建云函数。

### 4.2 App 用户体系（新增 registerAppUser，不能只依赖 H5 路径）

App 端仍复用 `#ifndef MP-WEIXIN` 的 CloudBase JS-SDK 登录态，但**不能假设后端会自动创建 `users` 文档**。当前代码中：
- `requireAuthenticatedUserId()` 只解析 CloudBase UID / `authUserId`
- `ensureUserSubscriptionFields()` 只给已存在用户补 subscription 字段
- `createCase` / `recharge` / 支付发货都会读取或更新 `users.doc(userId)`

因此 App 首启必须先确保业务用户文档存在。

```
冷启动 → ensureCloudAuthReady() → signInAnonymouslyCompat() → CloudBase UID
    → registerAppUser 云函数创建/确认 users 文档
    → 本地缓存 userId
    → 后续 callFunction 自动注入 authUserId
    → users._id = CloudBase UID, loginType: 'app_anonymous'
```

**新增云函数：`cloudfunctions/registerAppUser/index.js`**

```javascript
// 输入：CloudBase auth uid（从 app.auth().getUserInfo() 获取，不信任前端伪造 userId）
// 处理：
// 1. 读取 users.doc(uid)
// 2. 已存在 → 返回 userId，并按需补齐 subscription 默认字段
// 3. 不存在 → 创建 users 文档：
//    {
//      _id: uid,
//      loginType: 'app_anonymous',
//      plan: 'free',
//      extraTokens: 0,
//      monthlyTokensUsed: 0,
//      monthlyTokensReset: getMonthStart(now),
//      inviteCode: generateInviteCode(uid),
//      createdAt: now,
//      updatedAt: now
//    }
// 4. 返回 { success: true, userId: uid }
```

**前端入口**：
- 在 `src/utils/cloudbase.ts` 的非微信 `callFunction` 包装层中，调用业务云函数前确认本地 `userId`
- 若没有 `userId`，先调用 `registerAppUser`，成功后缓存 `userId`
- 跳过 `trackShareVisit` anonymous 等不需要业务用户的调用，避免启动埋点触发用户创建

**App.vue 改动**：将 `silentWechatLogin()` + 隐私协议注册整块包裹 `#ifdef MP-WEIXIN`。App 端不执行任何微信特有代码。

### 4.3 邮箱绑定（可选）

用户如需跨设备同步，可走 `login`/`register` 云函数绑定邮箱。App 端将 login.vue 作为 landing 页即可复用。


---

## 五、宠物系统跨平台

### 5.1 现状问题

`src/utils/pets.js` 当前**完全没有条件编译**，所有函数硬编码 `wx.*` 全局对象：
- `wx.getFileSystemManager()` — 文件系统
- `wx.env.USER_DATA_PATH` — 私有目录
- `wx.cloud.init()` / `wx.cloud.downloadFile()` — 云存储下载

在 App 端运行会直接报 `wx is not defined`。

### 5.2 需要拆分的函数（7 个，非 v3 声称的 4 个）

| 函数 | 微信（`#ifdef MP-WEIXIN`，不改） | App（`#ifdef APP-PLUS`） |
|------|-------------------------------|------------------------|
| `ensurePetCloudReady` | `wx.cloud.init()` | 不需要（JS-SDK 已 init） |
| `getLocalPetDir` | `wx.env.USER_DATA_PATH` | `uni.env.USER_DATA_PATH` |
| `isPetCachedLocally` | `wx.getFileSystemManager()` | `uni.getFileSystemManager()` |
| `ensureDir` | `wx.getFileSystemManager()` 的 `accessSync/mkdirSync` | `uni.getFileSystemManager()` |
| `persistTempFile` | `wx.getFileSystemManager()` 的 `saveFileSync/copyFileSync` | `uni.getFileSystemManager()` |
| `downloadPetAssets` | `wx.cloud.downloadFile` | `app.getTempFileURL()` → `uni.downloadFile` → `fs.saveFileSync` |
| `getCachedSpritesheetPath` | 调用上述函数 | 随上述函数自动适配 |

### 5.3 App 端下载策略

```typescript
// #ifdef APP-PLUS
import { app } from '@/utils/cloudbase'

// 1. 用 @cloudbase/js-sdk 内置方法获取 HTTPS 临时 URL
const { fileList } = await app.getTempFileURL({ fileList: [cloudFileID] })
const url = fileList[0]?.tempFileURL

// 2. uni.downloadFile 下载到临时路径
const { tempFilePath } = await uni.downloadFile({ url })

// 3. uni.getFileSystemManager().saveFileSync 持久化
const fs = uni.getFileSystemManager()
fs.saveFileSync(tempFilePath, `${uni.env.USER_DATA_PATH}/pets/${petId}/spritesheet.webp`)
// #endif
```

### 5.4 Phase 1 真机验证任务（Spike）

- 下载一个 cloud 文件到 App 私有目录
- `fs.statSync` 确认存在且大小正确
- 重启 App 后读取并渲染
- **确认 `uni.getFileSystemManager().saveFileSync/statSync/readFileSync` 在 Android 真机可用**

---

## 六、录音系统跨平台

### 6.1 现状

`src/pages/index/index.vue` 的 `getRecorderManager()`：
- `#ifdef MP-WEIXIN`：使用 `uni.getRecorderManager()` / `wx.getRecorderManager()`
- `#ifndef MP-WEIXIN`：return null（H5 不支持原生录音）

### 6.2 App 端策略

`uni.getRecorderManager()` 在 APP-PLUS 平台可用（Android/iOS 均支持）。修改为三路：

```typescript
// #ifdef MP-WEIXIN
  return uni.getRecorderManager() || wx.getRecorderManager()
// #endif
// #ifdef APP-PLUS
  return uni.getRecorderManager()  // App 原生录音能力
// #endif
// #ifdef H5
  return null  // 浏览器不支持 uni 原生录音
// #endif
```

权限申请也需适配：微信用 `uni.authorize({ scope: 'scope.record' })`，App 端用 `uni.getRecorderManager()` 时系统会自动弹权限框（Android manifest 已声明 `RECORD_AUDIO`）。


---

## 七、改动文件完整清单

### 前端源码（8 个文件）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `src/App.vue` | `#ifdef MP-WEIXIN` 守卫 `silentWechatLogin` **+ 隐私协议 `onNeedPrivacyAuthorization` 整块** |
| 2 | `src/manifest.json` | 新增 Payment 模块 + 微信 SDK 配置 + iOS Bundle ID |
| 3 | `src/utils/avatar.ts` | **无需改动**（已有 `#ifndef MP-WEIXIN` 路径正常调 SDK getTempFileURL） |
| 4 | `src/utils/pets.js` | **7 个函数**拆平台路径（见第五节详述） |
| 5 | `src/pages/index/index.vue` | `getRecorderManager` 改为 MP-WEIXIN / APP-PLUS / H5 三路 |
| 6 | `src/pages/subscription/subscription.vue` | `onUpgrade` 新增 `#ifdef APP-PLUS` 支付（区分 Android/iOS） |
| 7 | `src/pages/token-recharge/token-recharge.vue` | `createOrder` 新增 `#ifdef APP-PLUS` 支付（区分 Android/iOS） |
| 8 | `src/pages/login/login.vue` | App 端作为 landing 页（复用 H5 逻辑，不改代码） |

### 后端云函数（2 个文件）

| # | 文件 | 改动 |
|---|------|------|
| 9 | `cloudfunctions/recharge/index.js` | 新增 4 个 action：`unifiedOrderForAppAndroid`、`createIapOrder`、`verifyIapReceipt`、`restoreIapTransactions` |
| 10 | `cloudfunctions/registerAppUser/index.js` | **新建**：App 匿名用户业务文档创建/确认 |

### 配置（1 个文件）

| # | 文件 | 改动 |
|---|------|------|
| 11 | `cloudbaserc.json` | 新增 `registerAppUser` 云函数声明；环境变量通过控制台设置 |

**合计**：11 个文件（实际需改动 10 个，login.vue 基本无代码变更）

### 环境变量（通过 CloudBase 控制台设置，禁止写入代码仓库）

| 变量名 | 用途 | Phase |
|--------|------|-------|
| `WXPAY_APP_APPID_ANDROID` | 微信开放平台 App appid | Phase 1 |
| `WXPAY_APP_PACKAGE_ANDROID` | Android 包名，用于人工核对开放平台配置 | Phase 1 |
| `APPLE_SHARED_SECRET` | App Store Connect 共享密钥 | Phase 2 |
| `APPLE_BUNDLE_ID` | iOS App Bundle ID | Phase 2 |
| `IAP_USE_SANDBOX` | IAP 沙箱开关 | Phase 2 |

---

## 八、分阶段研发计划

### Phase 1：Android APK（~2 周）

**前置**：微信开放平台注册 → 创建移动应用 → 配置 Android 包名/应用签名 → 关联支付商户号

| 天 | # | 任务 | 文件 |
|----|---|------|------|
| D1 | 1 | **CloudBase JS-SDK App 环境 Smoke Test**：在 App 壳里执行 `ensureCloudAuthReady()` + 一个 `callFunction` 调用 + `app.getTempFileURL()`，确认三者均正常 | — |
| D1 | 2 | 新建 `registerAppUser` 云函数，创建/确认 App 匿名用户文档 | `cloudfunctions/registerAppUser/` |
| D1 | 3 | `cloudbase.ts` 非微信 `callFunction` 前置用户确认：无 `userId` 时调 `registerAppUser` | `src/utils/cloudbase.ts` |
| D1 | 4 | `App.vue`：`silentWechatLogin` + 隐私协议代码加 `#ifdef MP-WEIXIN` 守卫 | `src/App.vue` |
| D1 | 5 | **回归测试** | — |
| D2 | 6 | `pets.js` 7 个函数拆平台路径 | `src/utils/pets.js` |
| D2 | 7 | **回归测试** | — |
| D3 | 8 | `index.vue` 录音三路拆分 + App 端权限适配 | `src/pages/index/index.vue` |
| D3 | 9 | **宠物真机 Spike**：下载→保存→重启→读取，验证文件系统 API | Android 真机 |
| D4 | 10 | **回归测试** | — |
| D5-6 | 11 | `recharge/index.js` 新增 `unifiedOrderForAppAndroid` action | `cloudfunctions/recharge/` |
| D5-6 | 12 | 部署 recharge/registerAppUser + CloudBase 控制台设置 `WXPAY_APP_APPID_ANDROID` | — |
| D7 | 13 | `subscription.vue` + `token-recharge.vue` 加 `#ifdef APP-PLUS` 支付 | 两个支付页 |
| D7 | 14 | `manifest.json` 配置 Payment 模块 + 微信 SDK + Android 包名/签名证书 | `src/manifest.json` |
| D7 | 15 | **回归测试** | — |
| D8 | 16 | `npm run build:app` → HBuilderX 云打包 APK | — |
| D9-12 | 17 | 真机测试 + 修 bug | — |

**完成标志**：
- [ ] 回归测试 28 PASS 0 FAIL（每天跑）
- [ ] `npm run build:mp-weixin` diff 与改动前无意外变化
- [ ] CloudBase JS-SDK Smoke Test 三项全通过
- [ ] `registerAppUser` 创建/复用用户文档正常，重启后 `userId` 不变
- [ ] 宠物文件系统 Spike 通过
- [ ] Android APK：登录 → Crush → 记录 → 语音 → 宠物 → 支付 0.01 元


---

### Phase 2：iOS IPA（~3 周）

**前置**：Apple Developer + App Store Connect 创建 App + 6 个内购产品

| 天 | # | 任务 |
|----|---|------|
| D1-2 | 1 | `recharge/index.js` 新增 `createIapOrder` + `verifyIapReceipt` + `restoreIapTransactions` action |
| D2-3 | 2 | 部署 + CloudBase 控制台设置环境变量（APPLE_SHARED_SECRET、APPLE_BUNDLE_ID、IAP_USE_SANDBOX） |
| D3-4 | 3 | `subscription.vue` + `token-recharge.vue`：iOS 路径走 IAP（先 `requestProduct`，再 `uni.requestPayment({ provider: 'appleiap', orderInfo: productId, manualFinishTransaction: true })`） |
| D4 | 4 | `manifest.json` iOS Bundle ID + 隐私描述 |
| D5 | 5 | HBuilderX 云打包 IPA |
| D5-10 | 6 | TestFlight + IAP 沙箱测试 + 修 bug |
| D10 | 7 | App Store 提交 |

**完成标志**：
- [ ] 回归测试 28 PASS
- [ ] IPA 安装到 iPhone
- [ ] `requestProduct` 能返回 6 个内购商品
- [ ] IAP 沙箱支付完整流程：requestPayment → receipt → 服务端验证 → finishTransaction
- [ ] restoreCompletedTransactions 恢复未关闭订单正常；无 `orderNo` 时能按 `transactionId` 创建补偿订单

---

### Phase 3：HarmonyOS HAP（~2 周，Phase 1+2 完成后）

| 天 | # | 任务 |
|----|---|------|
| D1 | 1 | DevEco Studio + HBuilderX 鸿蒙配置 |
| D2 | 2 | 添加 `@dcloudio/uni-app-harmony` 依赖 |
| D2-3 | 3 | 代码审查：补 `#ifdef APP-HARMONY` 到相关块 |
| D3-4 | 4 | 验证 CloudBase SDK 兼容性 + 构建 HAP |
| D4-6 | 5 | 测试 + 修 bug |
| D6 | 6 | 支付方案确定 |
| D7 | 7 | AGC 上架 |

---

## 九、隔离验证

### 每 Phase 完成
```
[ ] npm run build:mp-weixin 零错误
[ ] diff dist/build/mp-weixin/ 与改动前无意外变更
[ ] tests/run-regression.cjs → 28 PASS 0 FAIL
[ ] 微信开发者工具全部 5 tab 正常
```

### 平台互不污染
```
[ ] Android/iOS/鸿蒙产物各自独立子目录
[ ] iOS env vars（APPLE_*）不碰微信 env vars（WXPAY_*）
[ ] App 端不执行任何微信隐私协议 / wx.login 代码
```

---

## 十、风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| `@cloudbase/js-sdk` 在 App WebView 中不兼容 | 中 | **高** | **Phase 1 D1 Smoke Test 第一优先级验证** |
| App 端匿名登录 UID 重启后变化（localStorage 持久化问题） | 中 | 高 | Smoke Test 含重启验证；备选 email 注册 |
| iOS IAP 开发周期超预期 | 中 | 高 | Phase 2 独立，不阻塞 Android |
| App 微信支付签名格式与小程序不同 | 中 | 中 | D5 Postman 先验证签名算法 |
| `uni.getFileSystemManager` App 行为差异 | 中 | 中 | Spike 任务先验证 |
| 鸿蒙 CloudBase SDK 不兼容 | 低 | 高 | CloudBase REST API 直调兜底 |
| 回归测试 28 条未覆盖非微信路径 | 中 | 中 | Phase 1 前补充 App 路径测试用例 |
| 真机发现问题 | 高 | 中 | 每 Phase 留 2-4 天修复 |

---

## 十一、不做的事

- ❌ 不迁移 uni-app x
- ❌ App 与小程序账户互通（独立账户）
- ❌ admin 后台 App 化
- ❌ 新增手机号登录
- ❌ 修改任何 `#ifdef MP-WEIXIN` 块内代码
- ❌ 修改任何 `#ifdef H5` 块内代码
- ❌ 新建 `getTempFileURL` 云函数（SDK 内置，无需）
- ❌ 在 `#ifndef MP-WEIXIN` 块新增业务逻辑
