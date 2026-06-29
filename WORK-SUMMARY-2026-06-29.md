# 今日工作总结

日期：2026-06-29

项目：workspace-girl-uniapp / 微信小程序 Crush Master

## 1. 支付安全审计与修复

### 1.1 审计发现

- `confirmPayment` 未验证微信支付真实发生，可被绕过获取免费 Token
- `queryPaymentOrder` 信任前端传入的 `wxTradeState=SUCCESS`，可伪造
- `refundOrder` 退款时不撤销套餐升级（退钱不退套餐）
- `queryOrder` 不把微信终态（CLOSED/PAYERROR）同步到 DB

### 1.2 修复

- `confirmPayment`：新增 `queryOrderByOutTradeNo` 微信 V3 查单验证后才发货
- `queryPaymentOrder`：删除前端可信路径，委托到 `queryOrder`
- `queryOrder`：终态同步到 DB（pending→expired）
- `refundOrder`：订阅订单退款时降级回 `fromPlan`
- `grantRechargeTokens` / `fulfillSubscription`：幂等保护

### 1.3 废弃代码清理

- 删除 `createPaymentOrder`、`queryPaymentOrder`、`httpPostJSON`、`scfInvokeTemplate`、`activeWeChatQuery`、`debugWxQuery`（约 260 行）
- 新增 `repairOrder` action 替代（安全的修复路径）

## 2. 隐私系统排查

### 2.1 根因

审计时在 `pages.json`、`vite.config.js`、`postbuild-mp-weixin.cjs` 三处写入 `__usePrivacyCheck__: true`，激活了微信新隐私系统。新系统要求管理后台为每个 API scope 单独声明——但管理后台未配置，导致 `chooseImage` 和录音全部报 `api scope is not declared`。

### 2.2 解决

三处 `__usePrivacyCheck__` 全部删除。2025 年后微信强制内置隐私检查，不再需要这个 flag。删除后相册选图和录音恢复正常。

## 3. 审核整改

### 3.1 问题一：隐私政策不合规

`register.vue` 文案"登录即表示同意《隐私政策》和《服务条款》"被认定为默认自动同意。

→ 改为："请阅读并了解《隐私政策》和《服务条款》（点击查看）"

### 3.2 问题二：强制登录

→ 实施**全量静默登录**方案：`wx.login()` 无弹窗，后端通过 openid 自动识别/创建用户，完全消除登录页。

改动：
- `App.vue`：`silentWechatLogin()` 从仅分享入口触发改为所有冷启动都跑
- 删除 `src/utils/guest.ts` 及所有 `requireLogin()` 调用
- 删除所有游客 UI（guest-login-nudge、taohuaIsGuest 条件等）
- `me.vue`：恢复真实数据展示（不再显示 `---` 占位）
- 删除退出登录按钮（微信 openid 永久绑定，退出无意义）
- `login.vue`：`onShow` 检测到已有 userId 自动回首页
- `pages.json`：首页 index 已置为第一位

### 3.3 分享落地页

分享参数（inviteCode/shareId）进入时静默登录触发归因，拉新奖励不受影响。

## 4. UI 修复

### 4.1 加油包页面
- 充值计划卡片重排版：Token 数量用 `$fs-display`(50rpx) 大字，按钮移至底部全宽青色

### 4.2 套餐页面
- 套餐卡片重排版：Token 数量黑底黄字标签，功能列表 ✓青色—灰色，价格选择 chip 独立一行，按钮全宽

### 4.3 "我"页面
- Token 卡片统计数字字号字重降级：`$fs-body-lg`→`$fs-body`、`$fw-heading`→`$fw-label`
- 删除 share 按钮、btn-ghost 虚线边框修复
- 按钮溢出修复（flex-wrap + 缩 padding）
- 删除"系统轨迹"菜单项

### 4.4"我们"页面
- 场景气泡图文字降级到设计 token（`$fs-caption`/`$fs-micro`）
- 气泡坐标内移，不再超出边框
- 趋势数据从 14 天滚动窗口改为日历月
- 信号解释卡文案"近期"→"本月"
- 记录计数排除系统自动生成的评估/趋势记录

## 5. 其他修复

- 相册 `uni.chooseImage` 加 `fail` 回调（之前静默失败）
- 录音改用 `uni.authorize` 直接弹授权窗
- 录音权限被拒时弹 Modal 引导去设置
- `cloudbase.ts` 全局 `reLaunch` 到登录页的拦截移除
- `privacy.json` 内容与格式统一

## 6. Git 状态

待提交。
