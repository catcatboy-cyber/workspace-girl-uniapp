# 工作总结 · 2026-07-28

## 首页雷达改版 — 互动天平 → 今日的TA

### 今日的TA（新卡片，替代互动天平）

**数据层**：
- 日支 × 个人地支 → 三合/六冲/平 三种关系判定
- 纯客户端查表（LIUHE/LIUCHONG/SANHE_SETS），零云函数依赖，每天日支变化自动更新
- 建除 vibe 标签 + 9 组合综合建议

**组件**：
- `src/components/CampusSignalHome.vue` — 雷达节点替换，新增 `taAuraLabel`/`taDayZhi`/`taSelfZhi`/`taCrushZhi` 等 props
- `src/components/TaDailySheet.vue` — **新建**，底部弹出详情 Sheet，三板块：今日气场 + 日支关系 + 综合建议
- `src/pages/index/index.vue` — 数据传入（ZODIAC_TO_ZHI + taohuaTeaserData）

**样式迭代**（经多轮修正）：
- 统一用 ActionGuideSheet 同款 mask/sheet/topbar 结构
- SCSS 变量（`$fs-*`/`$fw-*`/`$sp-card-pad`）+ mixin（`@include border-soft`/`@include tag-v2-black`）
- `border-radius: var(--shape-radius-card, 0)` 支持主题切换圆角
- `animation: tds-slide-up .3s ease-out` 底部滑入
- `.font-large` 适配大字体模式

### 今日气场统一

- 节点标签 + 弹窗 + 行动指南三处统一使用建除 vibe（`actionGuideData.aura`）而非分数评级
- 弹窗保留 vibe 标签 + 一句话完整信息

### 其他改动

- 移除 `SWIPE_TAG` 全部调试日志（16 处）
- TA 弹窗打开时隐藏小咪气泡（反应+普通两处）
- 建立长期记忆：新建 UI 必须先打开参照组件精确复制样式模式

### 构建 & 测试

- `npm run build:mp-weixin` 通过
- `npm run test:regression` 32/32 通过
- 每次 commit 后 build 验证

## 宠物活力展示与动作映射

### 产品结论

- 活力分值不在首页常驻，采用“进入首页短暂显示、有效操作后即时反馈、点击宠物随时查看”的渐进披露方案。
- 统一分值与动作映射：`0–24` 需要陪伴、`25–49` 有点疲惫、`50–79` 状态不错、`80–100` 活力充沛。
- 保留现有加分规则和每日上限，不引入等级、商城或云端同步。

### 实施内容

- 新增 `PetEnergySheet.vue`，展示当前活力、进度、今日各操作次数与规则说明。
- 首页增加会话首次进入提示、操作加分提示、跨档提示和满格跑屏反馈。
- 宠物操作区增加“活力”入口，与“聊天”按钮保持一致。
- 修复临时分析动作和点击反应结束后固定回 `idle` 的问题，恢复为当前真实活力对应动作。
- 收敛满格检测与 `100 → 85` 跑屏结算，避免不同加分入口行为不一致。
- 增加旧版 `dailyCounts` 归一化，避免缺失值、负数或 `NaN` 破坏每日上限。
- 新增 `test:pet-energy` 专项测试。

## 微信小程序主包整改

### 问题与边界

- 微信开发者工具上传报错 `80051`：源代码体积 `2081KB`，超过主包 `2MB` 限制约 `33KB`。
- 明确保护 `monthly-review`、`quick-read`、`pair-onboarding`、`taohua-pair-result`、`taohua-pair-share`、`taohua-persona-result` 六个正常分享落地页，不删除、不迁移。
- 分包涉及分享路径和页面迁移，风险较高，本轮暂缓。

### 已完成整改

- 补齐阶段 0 基线：恢复并验证六个分享落地页，微信端共 28 个注册页面生成完整产物。
- 恢复 H5 后台直接引用的面板组件及公共样式。
- 修复正式构建后处理脚本权限与执行问题。
- 在 `manifest.json`、根 `project.config.json` 和正式后处理阶段统一生成包体忽略规则。
- 排除未引用的重复 Logo/App 图标、旧 TabBar 和桃花页静态 SVG 副本。
- 删除四个确认无源码引用且未进入构建产物的旧组件。
- 构建产物保持单主包，未引入 `subPackages`，页面 URL 未变化。
- 正式微信产物后处理后原始体积约 `1306.5KB`，扣除实际 ignore 目标后约 `1238.8KB`。
- 已提交 Git：`6c0cad9 fix(mp-weixin): reduce upload package size`。

## 头像内容安全整改

### 官方接口校正

- 重新核对微信官方文档，确认 `security.msgSecCheck` 只用于文本，头像图片必须使用 `security.mediaCheckAsync`。
- 推翻旧实现中“把图片 Buffer 传给 `msgSecCheck`、接口异常时放行”的错误方案，改为官方 2.0 异步媒体审核并坚持失败关闭。
- `wx-server-sdk` 当前为 `^3.0.1`，满足云调用最低版本要求。

### 新审核链路

1. 小程序选择并上传头像到云存储。
2. `contentSecCheck` 获取临时媒体 URL，调用 `security.mediaCheckAsync`。
3. 将 `checkId`、`trace_id` 和 pending 状态写入 `content_security_checks`。
4. 小程序短轮询审核状态，未获得明确 `pass` 前不保存头像。
5. 微信通过 `wxa_media_check` 推送最终结果到 `contentSecCallback`。
6. 回调验签、匹配 `trace_id` 并更新审核结果。
7. 仅在 `pass` 时签发头像安全凭证；`userProfile`、`createCase`、`updateCaseProfile` 保存头像时强制验证凭证。

### 部署与排障

- 部署并验证 `contentSecCallback` HTTP 路由，消息推送 URL 与 Token 已在微信公众平台配置。
- 修复审核记录写入时包含 `_id` 导致的数据库参数错误。
- 修复 `chooseAvatar:fail another chooseAvatar is in progress`，防止重复打开头像选择器。
- 替换即将废弃的 `wx.getFileInfo` 调用，并校正 `showLoading` / `hideLoading` 配对。
- 定位 `-604101 function has no permission to call this API`：CloudBase CLI 只上传代码，没有登记微信云调用权限。
- 在 `contentSecCheck/config.json` 声明 `security.mediaCheckAsync`，并通过微信开发者工具从项目根目录上传云函数，使权限生效。
- 真实链路验证通过：审核任务成功取得 `trace_id`，由 pending 转为 `pass: true / code: OK`，头像保存成功。
- 违规结果统一提示“所发布内容含违规信息”，不向用户暴露策略、标签或命中细节。

## 内容安全旧代码清理

- 全仓发现 42 份 `content-security.js`，其中大量为同步脚本复制出的旧实现。
- 逐个核对云函数入口，实际运行的只有 `contentSecCheck` 和 `contentSecCallback` 两份专用实现。
- 删除 40 份未被入口引用的旧文件，约减少 3600 行过时代码。
- 删除根 `_shared/content-security.js` 复制源，避免后续同步再次把旧实现扩散到所有云函数。
- 测试改为直接引用真实运行文件，清理后剩余文件与入口引用一一对应。
- 删除内容均为 Git 跟踪文件，需要时可从历史版本恢复。

## 微信登录与虚拟支付验证

- 云端曾持续出现 `40125 invalid appsecret`，但登录函数通过云上下文回退仍返回成功，属于“表面正常、内部异常”。
- 核对虚拟支付后确认：支付签名依赖最新 `session_key`，因此 AppSecret 错误会直接影响 `requestVirtualPayment` 用户态签名，不能简单删除 `jscode2session`。
- 最新两次真实登录日志均返回 `success: true`，未再出现 `invalid appsecret`、`-604101` 或 `jscode2session failed`。
- 用户完成一次真实虚拟支付测试并确认 OK，登录、`session_key` 和支付签名链路恢复正常。
- 当前不获取手机号，`phonenumber.getPhoneNumber` 权限声明暂不处理。

## 今日验证结果

- `npm.cmd run test:content-security`：通过。
- `npm.cmd run test:regression`：通过。
- `npm.cmd run test:pet-energy`：通过。
- `npm.cmd run build:h5`：通过。
- `npm.cmd run build:mp-weixin`：通过。
- `npm.cmd run build:app`：通过。
- `git diff --check`：通过。
- 内容安全回调 GET 握手与签名 POST 冒烟测试：通过。
- 头像审核真实异步链路：通过。
- 微信登录真实测试：通过。
- 虚拟支付真实测试：通过。

## 后续事项

- 文本安全尚未实施。建议在现有 `contentSecCheck` 增加同步 `security.msgSecCheck`，优先覆盖个人昵称、快速记录文字和用户反馈。
- 音频安全尚未实施。当前流程为“上传 MP3 → 语音转文字”，建议改为“上传 → `mediaCheckAsync(mediaType: 1)` → 通过后转文字”。
- 文本和音频接入后，需要在同一权限文件中补充 `security.msgSecCheck`，重新构建小程序，并再次通过微信开发者工具上传 `contentSecCheck`。
- `npm.cmd run sync:shared:dry` 当前受项目既有 Windows ACL 影响，对 `scripts/sync-shared.js` 返回 `EPERM`；本轮已通过直接文件清单、入口引用扫描和专项测试完成等价验证。
- 当前内容安全、宠物活力和旧代码清理改动已完成提交前审计，将与本总结一并提交 Git。
