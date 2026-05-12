# UI 风格统一工作总结

日期：2026-04-27

## 今天完成的内容

### 1. 按上周记录继续统一的页面

本轮把上周记录中“还可以继续统一”的页面接入了同一套主题变量和高级视觉样式：

- `src/pages/cases/cases.vue`
- `src/pages/new/new.vue`
- `src/pages/timeline/timeline.vue`
- `src/pages/reassess/reassess.vue`
- `src/pages/edit-profile/edit-profile.vue`
- `src/pages/assessments/assessments.vue`
- `src/pages/ai-settings/ai-settings.vue`

这些页面都已接入：

- `:style="themeVars"`
- `getThemeStyle()`
- `applyThemeChrome()`

其中 `cases` 和 `new` 会在 `onShow` 同步主题，非 tab 页面会在进入页面时同步导航栏颜色。

### 2. 统一的视觉方向

本轮继续沿用上周确定的 `pine-mist` 默认方向：

- 页面背景使用低对比浅底和顶部轻微氛围渐层。
- 顶部 hero 卡片统一为深松雾绿渐层。
- 卡片统一使用低对比描边、浅阴影和 18rpx 圆角。
- 主按钮统一为主题深色渐层。
- 次按钮统一为浅底细描边。
- 标签、状态提示、KPI、输入框统一使用 CSS 变量。

目标是减少旧页面里偏散、偏基础的白卡和硬边框，让整体更安静、可信、低压。

### 3. 共用组件同步

为避免页面和表单风格割裂，本轮也同步调整了：

- `src/components/AssessmentForm.vue`
- `src/components/ProfileAvatarPicker.vue`

表单卡片、单选项、输入框、头像选择器、上传按钮现在会继承页面主题变量。

### 4. 构建验证

已完成两次构建验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过

微信小程序构建产物路径：

- `dist/build/mp-weixin`

## 注意事项

当前 git 工作区原本已经有大量未提交改动，本轮只围绕 UI 风格继续改动目标页面和共用表单/头像组件，没有回退或清理其他已有改动。

如果明天继续，建议下一步用微信开发者工具打开 `dist/build/mp-weixin`，重点人工检查：

1. `cases` 列表页卡片密度和按钮换行。
2. `timeline` 长时间线在真机宽度下是否拥挤。
3. `new` / `reassess` 表单题目选中态是否清晰。
4. `ai-settings` 模型卡片和按钮在深色主题下的可读性。

## 追加：第二轮普通卡片美化

用户反馈“每页只有第一个卡片好看，其他卡片单调”后，追加做了第二轮视觉处理。

本轮重点不是继续强化 hero，而是增强普通内容卡片：

- `src/App.vue`：增加全局普通卡片、内层小卡、标题强调线的基础视觉规则。
- `src/pages/index/index.vue`：增强 KPI、小记录框、最近更新卡片、成就卡片。
- `src/pages/case-detail/case-detail.vue`：增强指标卡、建议卡、焦点卡、趋势卡。
- `src/pages/cases/cases.vue`：增强对象列表卡、KPI 小卡、对象卡标题分隔。
- `src/pages/timeline/timeline.vue`：增强时间线事件卡、即时反馈卡、记录表单卡。
- `src/pages/edit-profile/edit-profile.vue`：增强画像表单分组和输入框层次。
- `src/pages/assessments/assessments.vue`：增强评估历史卡、KPI、趋势摘要。
- `src/pages/ai-settings/ai-settings.vue`：增强模型设置卡、开关行、输入框。
- `src/pages/me/me.vue`：增强设置项、主题卡、等级说明卡。
- `src/pages/login/login.vue` / `src/pages/register/register.vue`：增强登录/注册表单卡。
- `src/components/AssessmentForm.vue`：增强结构化问答题卡、选项、文本输入框。

第二轮后再次验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过

## 追加：关系主页字体层级统一

用户反馈关系主页里的“对象状态卡、当前需要注意什么、最近 7 天回顾、趋势对比”字体风格和其他地方不一致。

本轮集中修改：

- `src/pages/case-detail/case-detail.vue`

处理内容：

- 给“当前需要注意什么”外层补充 `focus-section-card`。
- 给“最近 7 天回顾”外层补充 `weekly-review-card`。
- 统一 `status-summary`、`focus-meaning`、`case-kpi-label`、`case-kpi-value`、`trend-number`、`trend-warning` 的字号、字重、行高和显示方式。
- 统一焦点事件卡里的时间、事件标题、补录时间、轨迹点的视觉层级。
- 控制趋势数字不再显得像独立风格的大号字体，而是和 KPI 数字属于同一套层级。

再次验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过

## 追加：微信小程序手机号登录

用户同意按上周方案实施微信登录后，完成了微信小程序手机号登录 MVP。

新增：

- `cloudfunctions/wechatLogin/index.js`
- `cloudfunctions/wechatLogin/package.json`
- `cloudfunctions/wechatLogin/cloudbaserc.json`

调整：

- `cloudbaserc.json`：加入 `wechatLogin` 云函数配置。
- `src/utils/api.ts`：新增 `wechatLogin(code)`，成功后写入 `userId`、`userEmail`、`userPhone`。
- `src/utils/cloudbase.ts`：清理登录态时同步清理 `userPhone`。
- `src/pages/login/login.vue`：微信小程序环境显示“微信手机号一键登录”为主入口，邮箱登录保留为备用入口；H5/App 仍默认显示邮箱登录。

云函数逻辑：

- 接收微信手机号授权 `code`。
- 使用 `wx-server-sdk` 的 `cloud.openapi.phonenumber.getPhoneNumber` 换取手机号。
- 读取微信 `openid`。
- 优先按 `openid` 查用户。
- 找不到时按 `phone` 查用户并绑定 `openid`。
- 都找不到则创建新用户。
- 返回与现有登录兼容的 `userId` 和展示信息。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npx.cmd cloudbase functions:deploy wechatLogin -e cloud1-d8gqh3f5g49993a5a`：部署成功
- `npx.cmd cloudbase functions:list -e cloud1-d8gqh3f5g49993a5a`：已看到 `wechatLogin`，状态为 `Deployment completed`

## 追加：微信手机号登录失败体验修正

用户反馈点击“微信手机号一键登录”时没有出现手机号授权确认页，而是直接进入邮箱登录。已检查编译产物：

- `dist/build/mp-weixin/pages/login/login.wxml` 已正确生成 `open-type="getPhoneNumber"` 和 `bindgetphonenumber`。
- `src/pages/login/login.vue` 已调整为：拿不到手机号授权 `code` 时只在微信按钮下方显示错误提示，不再自动展开邮箱登录。
- 微信登录云函数失败或接口异常时，也只显示微信登录错误，不再自动切到邮箱表单；邮箱登录仍保留为用户手动备用入口。
- 如果微信事件返回 `no permission` / `has no permission` / `errno === 102`，页面会明确提示当前小程序还没有微信手机号授权能力，需要在微信小程序后台完成认证并开通。

本轮验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过

## 追加：后台管理一期

用户确认 AI 设置应迁移到后台管理，普通端不再暴露系统级配置。本轮完成后台一期：

- 新增 `src/pages/admin/admin.vue`：H5 后台管理页，包含用户列表、用户详情概览、全局 AI 设置。
- 新增 `cloudfunctions/adminManage`：后台管理云函数，支持 `getOverview`、`getUserDetail`、`updateAISettings`。
- `cloudbaserc.json`：加入 `adminManage` 云函数配置。
- `src/utils/api.ts`：新增 `adminGetOverview`、`adminGetUserDetail`、`adminUpdateAISettings`。
- `src/pages/me/me.vue`：移除普通用户端的 AI 设置入口，改为提示 AI 由系统后台统一配置。
- `cloudfunctions/getAISettings/index.js`：优先读取全局 AI 设置，兼容旧的按用户设置。
- `cloudfunctions/createTimeline/index.js`、`cloudfunctions/deleteTimeline/index.js`：AI 重算逻辑改为优先使用全局 AI 设置，兼容旧用户设置。
- `cloudfunctions/updateAISettings/index.js`、`cloudfunctions/testAIConnection/index.js`：改为仅管理员可操作。

管理员权限规则：

- 用户记录 `role === "admin"` 或 `isAdmin === true`。
- 或云函数环境变量 `ADMIN_EMAILS` 中包含该管理员邮箱。
- 后台管理云函数不接受匿名调用；本轮冒烟调用已确认未登录返回 `请先登录管理员账号`。

部署与验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：首页即时反馈与关系主页重构

这轮围绕“首页先帮用户恢复最近记忆，关系主页改成阶段侧写与客观统计”继续收口，重点不再堆卡片，而是把信息分层拉清楚。

- `src/pages/index/index.vue`：首页不再把下方“小的当前对象框”作为独立重点，用户每次进入后，核心看到的是最近一次即时反馈；一句话录入完成后，当前页面直接刷新为最新即时反馈。
- `src/pages/case-detail/case-detail.vue`：关系主页从“重复展示即时反馈”改为“阶段判断 + 阶段观察点 + 评估历史预览”的结构。
- `src/pages/case-detail/case-detail.vue`：关系主页保留对象基础信息与画像标签，但把客观统计放到“名字 + 画像标签”下面、“画像侧写”上面。
- `src/pages/case-detail/case-detail.vue`：原先会和首页重复的即时反馈区不再作为关系主页主内容，关系主页更偏“阶段复盘”和“证据归纳”。
- `src/pages/case-detail/case-detail.vue`：新增“主要观察点 / 次观察点”，并直接挂接证据事件，不再走旧的分散卡片表达。
- `src/pages/case-detail/case-detail.vue`：评估历史预览保留，趋势图收窄为最近 4 次。
- `src/pages/timeline/timeline.vue`：关键事件流默认展示最近 5 次，并通过展开按钮继续查看更多；一句话快速记录与“接下来建议记录什么”入口已删除。
- 关系页与案例页切换时的当前对象同步问题已一并修正，避免从案例页切到首页后对象未跟随变化。

## 追加：关系统计口径收紧

用户明确要求统计必须是客观数据，不再混入概念重复或模糊标签。本轮把统计区收敛到 6 个指标，并补足口径说明。

- `src/utils/insights.js`：关系主页统计当前包含 `最近互动`、`本周记录`、`对方主动`、`近14天见面`、`连续受阻`、`承诺兑现`。
- `src/utils/insights.js`：新增 `近14天见面`，只统计已经实际发生的线下见面，不把计划中的邀约、约好下次见面、口头安排算进去。
- `src/utils/insights.js`：`承诺兑现` 从原先较宽泛的顺序匹配，升级为“先识别具体承诺事项，再与后续同事项的落地或失约配对”。
- `src/utils/insights.js`：当前会尽量区分电影、吃饭、咖啡、散步、旅行、掼蛋、买包、送花、一般礼物、接送、联系等主题，避免“约看电影”和“收到包”被串成一次兑现。
- `src/utils/insights.js`：除明确提到事项名外，也补了同类场景识别，例如不重复提“电影”但明确是在赴约、见面、送到、联系到的情况，也会尽量归到同类承诺里。
- `src/pages/case-detail/case-detail.vue`：统计卡片旧位置保留为隐藏，当前只显示新的统计区，避免视觉上重复。

## 验证

- `npm.cmd run build:mp-weixin`：通过

## 追加：一句话快速记录区分“对方记录 / 我的记录”

用户反馈：一句话快速录入里写“我穿裙子、化妆”时，AI 会误当成“对方提到化妆、穿裙子”，导致角色混乱。已按“记录主体”方案修正：

- `src/pages/index/index.vue`：首页一句话快速记录新增二选一分段控件：
  - `对方的行为/态度`：默认选项，分析对方释放的关系信号。
  - `我的行为/准备/感受`：用于记录自己的穿着、准备、情绪、表达，AI 不再把“我”的行为当成对方行为。
- `src/pages/timeline/timeline.vue`：时间线新增同样的记录主体选择；时间线列表、即时反馈卡显示 `对方记录 / 我的记录` 标签。
- `src/utils/api.ts`：`createTimeline` 新增 `subjectRole` 参数。
- `cloudfunctions/createTimeline/index.js`：保存时间线记录时写入 `subjectRole`，并传入重算上下文。
- `cloudfunctions/createTimeline/_shared/ai-event.js`、`cloudfunctions/createTimeline/_shared/event-understanding.js`：
  - AI 提示词明确角色边界：`self` 时“我”是用户本人，不是关系对象。
  - `self` 记录不因“我穿裙子 / 我化妆 / 我准备见面 / 我紧张”直接提高对方意向分。
  - 分析重点改为：我的状态如何影响互动、接下来该怎么做、需要观察对方什么反应。
  - 规则回退时，`self` 记录默认作为 `note`，不直接加减意向/风险。
- 同步更新 `cloudfunctions/_shared/ai-event.js`、`cloudfunctions/_shared/event-understanding.js`，方便后续云函数共享逻辑时保持一致。

验证与部署：
- `node --check cloudfunctions/createTimeline/index.js`：通过
- `node --check cloudfunctions/createTimeline/_shared/ai-event.js`：通过
- `node --check cloudfunctions/createTimeline/_shared/event-understanding.js`：通过
- `node --check cloudfunctions/_shared/ai-event.js`：通过
- `node --check cloudfunctions/_shared/event-understanding.js`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过
- `echo y | npx.cmd cloudbase functions:deploy createTimeline -e cloud1-d8gqh3f5g49993a5a`：部署成功

## 追加：修复微信运行时找不到 activeCase 模块

用户在微信开发者工具看到运行时报错：`module 'utils/activeCase.js' is not defined`。构建产物中虽然已经生成 `dist/build/mp-weixin/utils/activeCase.js`，但为了降低新增 TypeScript 工具模块在小程序运行时热更新/缓存中的风险，本轮调整：

- 将 `src/utils/activeCase.ts` 改为 `src/utils/activeCase.js`，和项目已有 `insights.js` 保持一致。
- 保持导入路径 `@/utils/activeCase` 不变，重新构建后微信包内确认存在 `dist/build/mp-weixin/utils/activeCase.js`。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：修复首页即时反馈跳关系主页不刷新

用户反馈：首页即时反馈里点击“查看当前主页”后，关系主页仍显示旧事件。原因是关系主页已成为底部 tab 页，`switchTab` 会复用页面实例；之前只有当前对象变化或画像更新时才重新加载数据，同一对象新增事件后不会刷新。

本轮调整：

- `src/pages/case-detail/case-detail.vue`：关系主页 `onShow` 后会静默刷新当前对象数据。
- 首次 `onLoad` 后跳过紧接着的第一次 `onShow` 刷新，避免重复请求。
- 静默刷新时不强制显示全屏 loading，减少页面闪烁。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：本次 AI 行动建议文案链路调整

用户确认“得出这个判断的主要证据事件”需要保留，同时希望“当前建议”和“当前观察点”概念更清楚：行动建议要给具体做法，观察重点要承接行动建议，并且和本次事件相关。

本轮调整：

- `src/pages/case-detail/case-detail.vue`：`当前行动分析` 改为 `本次 AI 行动建议`。
- `当前建议` 改为 `本次行动建议`，结构调整为：先别急着做、这次具体做法、可以这样问、情绪和节奏、本次观察重点。
- `建议动作` 不再作为观察卡里的独立字段展示，而是并入“这次具体做法”。
- `本次观察重点` 会根据事件场景变化：见面/聊天/承诺兑现/澄清/风险事件会给不同观察点，并承接前面建议的话术或动作。
- `下一条记录重点 / 下一次重点记录` 统一改为 `本次重点记录`。
- 观察重点原有内容和 `得出这个判断的主要证据事件` 保留，证据事件继续显示在本次重点记录下方。
- `src/utils/insights.js`：系统轨迹中 `high / low / E5` 这类裸内部值改为中文：如 `高意向，低风险，证据很充分（E5）`。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：统一当前对象切换规则

用户指出在案例页直接查看非当前对象主页后，再回首页会看到当前对象仍是另一个对象，容易混乱。确认规则改为：所有核心页面都服务“当前对象”，非当前对象必须先切换。

本轮调整：

- `src/pages/cases/cases.vue`：案例列表中每个对象只保留“切换到首页/当前对象”按钮，不再直接显示“查看主页、继续记录、画像、评估历史”等跨对象入口。
- 在案例页点击“切换到首页”后，保存当前对象并返回首页，让用户先看到新的当前对象状态。
- `src/pages/index/index.vue`：最近更新列表只保留“切换对象/当前对象”，移除关系主页、继续记录、画像等直接入口。
- 首页切换对象后清空即时反馈并滚动到顶部，减少用户误以为还在旧对象上下文里的风险。
- 当前对象卡片仍保留关系主页、时间线、本周复盘、重新评估入口；这些入口只针对当前对象。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：时间线新增系统轨迹二级折叠入口

用户确认“系统轨迹”适合做二级折叠/入口，用来查看系统自动生成的评估、重算、趋势日志。本轮调整：

- `src/pages/timeline/timeline.vue`：移除旧的常驻/隐藏“系统判断轨迹”位置。
- 新增“系统轨迹”折叠卡，默认收起，显示轨迹数量；展开后展示系统评估、趋势重算、推进/风险/验证研判等系统日志。
- 时间线主视图仍只展示真实手动事件流，不把系统日志混入关键事件流，避免用户阅读时混乱。
- 原 `supportTimeline` 逻辑继续保留：优先使用后端时间线里的系统记录；没有系统记录时，用最新评估结果生成兜底系统轨迹。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：修复微信头像云存储临时 URL 403

用户在微信开发者工具看到头像图片加载失败：云存储临时签名 URL 返回 `403`。原因是头像解析逻辑会把 `cloud://` fileID 转成带 `sign` 和 `t` 的临时 URL，并做内存缓存；临时 URL 过期或权限变化后继续使用就会 403。

本轮调整：

- `src/utils/avatar.ts`：微信小程序端不再把云存储 fileID 转成临时 URL，直接返回 `cloud://...` 给 `<image>` 使用。
- 移除头像临时 URL 的长期内存缓存，避免 H5/App 端复用过期链接。
- H5/App 端仍在需要时调用 `getTempFileURL` 获取临时链接。
- 重新构建后确认 `dist/build/mp-weixin/utils/avatar.js` 中 `resolveAvatarSrc` 直接返回原始头像值，不再调用 `getTempFileURL`。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：规避微信基础库 errMsg 空对象异常

用户继续看到微信开发者工具报错：`TypeError: Cannot read property 'errMsg' of undefined`，栈只指向 `WAServiceMainContext`，没有落到业务页面。排查后未发现业务代码直接读取空 `errMsg`；更可疑的是微信端启动期动态调用 `setTabBarStyle`。

本轮调整：

- `src/utils/theme.ts`：微信小程序端跳过动态 `uni.setTabBarStyle`，改用 `pages.json` 里的静态 tabBar 配置。
- 同时去掉 `setNavigationBarColor` 和 `setTabBarStyle` 参数里的空 `fail` 回调，减少微信基础库对空回调结果的兼容风险。
- 重新构建后确认 `dist/build/mp-weixin` 产物中不再存在 `setTabBarStyle` 调用，也不再存在 `utils/activeCase` 引用。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

如果微信开发者工具仍报同样错误，需要在工具里执行“清缓存并重新编译”，或关闭当前项目后重新导入 `dist/build/mp-weixin`，因为旧运行包可能没有加载新增模块。

## 追加：彻底移除 activeCase 独立模块引用

用户清缓存后仍在 `pages/index/index` 看到 `module 'utils/activeCase.js' is not defined`。本轮不再保留独立 `activeCase` 模块，避免微信运行时模块注册异常：

- 删除 `src/utils/activeCase.js`。
- 将 `getActiveCaseId`、`setActiveCaseId`、`markActiveCaseProfileUpdated`、`consumeActiveCaseProfileUpdated` 合并进已有稳定工具模块 `src/utils/helpers.ts`。
- 所有页面导入路径从 `@/utils/activeCase` 改为 `@/utils/helpers`。
- 重新构建后，`dist/build/mp-weixin/utils` 中不再存在 `activeCase.js`，页面产物也不再 require `utils/activeCase.js`；当前对象逻辑已进入 `dist/build/mp-weixin/utils/helpers.js`。

验证：

- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:app`：通过

## 追加：底部菜单栏改为当前关系优先

用户指出底部菜单栏还没有改。本轮补齐底部 tabBar 调整，并处理小程序 tab 页不能带参数跳转的问题。

- `src/pages.json`：底部菜单由“首页 / 新建 / 案例 / 我的”改为“首页 / 关系 / 复盘 / 案例 / 我的”。
- 移除底部“新建”，新建关系对象保留在首页/案例页等具体场景入口，不再占用底部高频位置。
- `src/utils/activeCase.ts`：新增当前对象共享状态，保存 `homeActiveCaseId`，供关系主页和周复盘作为 tab 页打开时自动读取当前对象。
- `src/pages/case-detail/case-detail.vue`：作为底部“关系”页时，如果没有 URL 参数，会自动读取当前对象；如果还没有当前对象，则取最近对象。
- `src/pages/weekly-review/weekly-review.vue`：作为底部“复盘”页时，同样自动读取当前对象。
- 原来跳转到关系主页/周复盘的地方，统一改为先设置当前对象，再 `switchTab`，避免微信小程序里 tabBar 页面使用 `navigateTo` 和 query 参数导致跳转失败。
- 涉及页面：`index`、`cases`、`new`、`timeline`、`assessments`、`reassess`、`edit-profile`、`case-detail`、`weekly-review`。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：首页下一步建议去重与当前对象入口收敛

用户认为首页“下一步建议”里的“给当前对象追加事件”与一句话快速记录重复，“创建新的关系对象”与底部新建重复；确认后，本轮将首页主流程改为更聚焦当前对象与快速记录。

- `src/pages/index/index.vue`：移除旧“下一步建议”卡片，不再展示“给当前对象追加事件”“创建新的关系对象”这类重复入口。
- 当前对象卡片内新增紧凑入口：`关系主页`、`时间线`、`本周复盘`、`重新评估`。
- 保留“一句话快速记录”作为首页最主要的录入动作，快速记录前继续展示“下一条记录重点”，提醒用户下一次最好记录什么。
- 最近更新列表继续保留“切换对象”，用户可从首页直接切换当前对象。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：首页记录入口与时间线职责调整

用户确认“下一条记录重点”更适合放在首页一句话快速记录前，提醒用户这次最好记录什么；时间线则回归单纯展示关键事件流。本轮调整：

- `src/pages/index/index.vue`：首页当前对象总览下新增“下一条记录重点”，显示最重要的关注点、判断含义、建议动作和下一条记录提示。
- `src/pages/index/index.vue`：一句话快速记录改为写入“当前对象”，不再固定默认最近对象。
- `src/pages/index/index.vue`：新增 `homeActiveCaseId` 本地记录，用于保存首页当前选中对象。
- `src/pages/index/index.vue`：最近更新列表中每个对象新增“切换对象”按钮；点击后首页当前对象、记录重点、快速记录目标同步切换。
- `src/pages/timeline/timeline.vue`：移除“当前观察重点”卡片和对应计算，时间线只承担事件分类、即时反馈、关键事件流和记录表单。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：即时反馈信息归档补全

用户关注即时反馈里的信息是否能在后续页面找回，避免出现“弹出后消失”的感觉。本轮补齐：

- `src/pages/index/index.vue`：首页快速记录后的即时反馈新增“主要标签”。
- `src/pages/assessments/assessments.vue`：每条评估历史新增“主要标签”展示。
- `src/pages/assessments/assessments.vue`：每条评估历史新增“对象状态”快照，展示阶段、状态、天气、状态摘要和注意提醒。
- `src/pages/assessments/assessments.vue`：AI 研判内容里补充展示“使用提醒”，让即时反馈里的限制说明能在评估历史找回。

产品决策：

- 对象状态放在评估历史，而不是时间线主列表。因为对象状态是评估结果的一部分，和分数、证据等级、趋势变化、AI研判放在同一张评估卡里更完整；时间线继续保持事件流属性。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页摘要总览与更多入口

用户确认关系主页应做成“摘要总览 + 更多入口”，避免把趋势、时间线、评估历史全部详情堆在一个页面。本轮调整：

- `src/pages/case-detail/case-detail.vue`：趋势图改为“趋势图预览”，默认展示最近 5 次评估。
- `src/pages/case-detail/case-detail.vue`：趋势图预览下新增“查看完整趋势”按钮，当前进入评估历史查看完整变化。
- `src/pages/case-detail/case-detail.vue`：新增“时间线预览”，默认展示最近 5 条手动互动记录，按钮进入完整时间线。
- `src/pages/case-detail/case-detail.vue`：新增“评估历史预览”，默认展示最近 5 次评估快照，按钮进入完整评估历史。
- 关系主页最终顺序：对象画像/画像侧写 -> 即时反馈折叠 -> 当前建议 -> 当前需要注意什么 -> 趋势图预览 -> 时间线预览 -> 评估历史预览 -> 下一步操作。

说明：

- 当前没有新增独立趋势页，“查看完整趋势”暂时复用评估历史页，因为评估历史已经承载完整趋势变化、分数和研判内容；后续如果需要更强图表交互，再单独拆趋势页。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页分析面板细化

用户希望关系主页更像图形分析页：趋势图改为双折线图，评估历史与时间线换位置，并整合“当前建议”和“当前需要注意什么”。本轮调整：

- `src/components/AssessmentTrendChart.vue`：重做为双折线图，意向和风险两根线在同一张图里展示。
- 趋势图默认滚到最新 5 次所在区域，可横向滑动查看更早评估，不再显示“查看完整趋势”按钮。
- `src/pages/case-detail/case-detail.vue`：把“当前建议”和“当前需要注意什么”整合为“当前行动分析”卡片，同时展示建议、意向/风险分、关注点、证据和使用提醒。
- `src/pages/case-detail/case-detail.vue`：评估历史预览移动到时间线预览前。
- `src/pages/case-detail/case-detail.vue`：评估历史预览中最近一次使用详细卡片展示，后 4 条使用简化卡片展示。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页本周复盘卡片

用户希望关系主页评估历史卡片前增加“本周复盘”卡片，展示本周复盘详情，并提供查看全部复盘入口。本轮调整：

- `src/pages/case-detail/case-detail.vue`：加载关系主页时并行调用 `getWeeklyReviews`，获取周复盘列表和当前周。
- `src/pages/case-detail/case-detail.vue`：在趋势分析与评估历史预览之间新增“本周复盘”卡片。
- 卡片优先展示当前周复盘；如果当前周没有，则展示最近一条复盘；如果没有任何复盘，则展示空态。
- 卡片展示周范围、标题、趋势标签、AI 标记、摘要、事件/评估数量、意向/风险变化和下周观察重点。
- 卡片按钮为“查看全部复盘”，进入周复盘页面。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页预览模块最新一条全详情

用户确认关系主页不需要每条记录旁边加“详情”按钮，而是采用“最新一条全详情，后 4 条简化”的规则。本轮调整：

- `src/pages/case-detail/case-detail.vue`：本周复盘卡片展开更多详情，包括本周关键变化、关键事件、下周观察重点和避免误判。
- `src/pages/case-detail/case-detail.vue`：评估历史预览的最新一条补充对象状态、判断原因和使用提醒。
- `src/pages/case-detail/case-detail.vue`：时间线预览的最新一条使用详细卡片展示完整描述和记录时间，后 4 条简化展示。
- 保留各模块底部“查看全部/完整”入口，作为进入完整页面的路径。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：即时反馈趋势排序与时间线预览去重

用户反馈即时反馈里的最近 5 次变化应最新在顶部，且关系主页时间线预览最新一条记录内容有重复。本轮调整：

- `src/pages/case-detail/case-detail.vue`：关系主页即时反馈中的最近 5 次趋势改为按最新在上排序，第一条高亮。
- `src/pages/index/index.vue`：首页即时反馈中的最近 5 次趋势同步改为按最新在上排序，第一条高亮。
- `src/pages/case-detail/case-detail.vue`：时间线预览最新一条详细卡中，如果描述与标题相同或仅空白差异，则不再重复显示描述。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页证据等级与可信度说明

用户确认在“当前行动分析”里增加证据等级和可信度说明入口。本轮调整：

- `src/pages/case-detail/case-detail.vue`：当前行动分析文案改为“本次建议依据强度：证据等级 xx，可信度：xx”。
- `src/pages/case-detail/case-detail.vue`：旁边新增 `i` 信息图标。
- 点击 `i` 后弹出说明，解释 E1-E5 证据等级、低/中/高可信度，以及两者关系。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：当前建议文案具体化与说明弹层美化

用户反馈“可以做一次低情绪、具体化确认”这类文案过于系统标签化，普通用户不容易理解；同时 `i` 图标里的说明排版太像系统弹窗。本轮调整：

- `src/pages/case-detail/case-detail.vue`：关系主页“当前行动分析”的主建议改为更通俗的具体行动标题。
- `src/pages/case-detail/case-detail.vue`：新增四段式行动建议：先别急着做什么、现在更适合做什么、可以怎么问、接下来观察什么。
- `src/pages/case-detail/case-detail.vue`：针对 `clarify / verify / pause / observe / insufficient_data` 生成不同的用户可执行建议，并结合最近触发事件和当前关注点。
- `src/pages/case-detail/case-detail.vue`：`i` 图标说明从 `uni.showModal` 改为自定义说明弹层，分区展示证据等级、可信度和两者关系，提升可读性。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页画像侧写

用户希望关系主页“对象画像”不仅展示年龄、性别、职务、属相、星座、对象类别，还能随着事件、意向和风险变化产生侧写。本轮调整：

- `src/utils/insights.js`：新增 `buildProfileSideRead`，结合画像字段、最新触发事件、最新评估结果、趋势变化生成侧写。
- `src/pages/case-detail/case-detail.vue`：对象画像卡内新增“画像侧写”。
- 侧写包含：
  - 综合侧写：年龄、性别、职务、对象类别、属相、星座 + 当前意向/风险 + 趋势变化。
  - 事件与现实节奏：结合最新触发事件和职业节奏解读。
  - 属相角度：从属相角度辅助观察。
  - 星座角度：从星座角度辅助观察。
- 侧写明确作为辅助理解，不参与核心评分。

验证：

- `node --check src/utils/insights.js`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：登录页记住账号密码

用户希望登录页面支持记住用户名和密码。本轮调整：

- `src/pages/login/login.vue`：邮箱登录表单新增“记住用户名和密码”选项。
- 勾选后登录成功会把邮箱和密码保存到当前设备本地存储。
- 下次进入登录页会自动填充邮箱和密码，并保持勾选状态。
- 取消勾选会移除本地保存的账号密码。
- 微信手机号登录不受影响。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：我的页判断说明折叠化

用户希望“我的”页里的意向、风险、对象状态说明都做成二级展示，点击后再展开详细说明。本轮调整：

- `src/pages/me/me.vue`：判断说明改为三个折叠入口：意向倾向、风险等级、对象状态路径。
- 默认只展示简短说明和“展开”按钮，点击后显示详细等级/路径。
- 对象状态路径仍包含阶段路径、状态路径、气候路径，但不再默认占用页面高度。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过
- `echo y | npx.cmd cloudbase functions:deploy --all -e cloud1-d8gqh3f5g49993a5a`：部署成功
- `npx.cmd cloudbase functions:list -e cloud1-d8gqh3f5g49993a5a`：已看到 `adminManage`，状态为 `Deployment completed`
- `npx.cmd cloudbase functions:invoke adminManage -e cloud1-d8gqh3f5g49993a5a --data '@.codex-admin-smoke.json' --json`：未登录返回 `UNAUTHENTICATED`，符合预期

## 追加：后台 AI 设置支持多模型

用户反馈后台 AI 设置只有单模型配置，不满足多模型管理需求。本轮调整：

- `src/pages/admin/admin.vue`：AI 设置面板改为多模型列表。
- 支持添加模型、删除模型、设为默认模型。
- 每个模型支持独立配置名称、供应商、Base URL、模型名、API Key。
- 已保存 API Key 会显示“已保存密钥”，留空保存时继续沿用旧密钥。
- 每个模型支持单独测试连接；新输入的 API Key 会直接用于本次测试，已保存密钥则按模型 ID 测试。
- 保存时提交完整 `models` 数组和 `defaultModelId`，对接已有 `adminManage.updateAISettings` 后台接口。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：新版 AI 周复盘

用户确认周复盘应保留并升级为“按周维度的 AI 复盘”，旧规则型周复盘可以删除。本轮调整：

- 新增 `cloudfunctions/weeklyReview` 云函数。
- 新增数据库集合写入目标：`weekly_reviews`。
- 周复盘按自然周生成，当前按北京时间周一到周日计算。
- 云函数读取当前对象本周真实事件、本周评估、本周前最近一次评估，生成分数变化、趋势标签、关键变化、关键事件、下周观察重点、避免误判。
- 若后台 AI 已启用且配置可用，优先用 AI 生成；AI 失败或未启用时使用规则兜底。
- 新增 `src/pages/weekly-review/weekly-review.vue` 页面，展示本周复盘和历史周复盘。
- 新增前端 API：`getWeeklyReviews`、`generateWeeklyReview`。
- `src/pages/index/index.vue`：旧规则周复盘删除，新增“查看本周复盘”入口。
- `src/pages/case-detail/case-detail.vue`：旧“最近 7 天回顾”删除，下一步操作区新增“查看周复盘”入口。
- `src/pages.json`：新增 `pages/weekly-review/weekly-review` 路由。
- `cloudbaserc.json`：加入 `weeklyReview` 云函数配置，超时 30 秒。
- `cloudfunctions/initDb/index.js`：新增 `weekly_reviews` 集合初始化。

验证与部署：

- `node --check cloudfunctions/weeklyReview/index.js`：通过
- `node --check cloudfunctions/weeklyReview/_shared/ai-http.js`：通过
- `node --check cloudfunctions/weeklyReview/_shared/auth.js`：通过
- `node --check cloudfunctions/initDb/index.js`：通过
- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过
- `echo y | npx.cmd cloudbase functions:deploy weeklyReview -e cloud1-d8gqh3f5g49993a5a`：部署成功
- `echo y | npx.cmd cloudbase functions:deploy initDb -e cloud1-d8gqh3f5g49993a5a`：部署成功
- `npx.cmd cloudbase functions:invoke initDb -e cloud1-d8gqh3f5g49993a5a --data '{}' --json`：执行成功，`weekly_reviews` 集合已创建

## 追加：首页即时研判与状态路径说明

用户反馈首页一句话快速记录后，心理上更需要即时看到这件事的研判反馈，而不是只看到“已记录”。本轮调整：

- `src/pages/index/index.vue`：快速记录后的动态卡改为“即时研判”。
- 即时研判展示事件类型、AI 是否参与、下一步动作、headline。
- 增加本次意向/风险变化的突出显示。
- 增加最近 5 次评估趋势，使用小型意向/风险横条，最新一次高亮。
- 增加对象状态卡摘要，展示阶段、状态、气候、状态总结和提醒。
- `src/pages/me/me.vue`：新增“对象状态路径”说明，把阶段路径、状态路径、气候路径放到“我的”页，避免每次反馈重复展示。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：页面信息架构收敛试运行

用户希望先稳一点，不删除旧板块，只先隐藏或集中入口，观察信息是否更清晰。本轮调整：

- `src/pages/index/index.vue`：通过 `showHomeLegacySections = false` 临时隐藏首页“周复盘”“观察成就”。
- `src/pages/case-detail/case-detail.vue`：通过 `showRelationshipLegacySections = false` 临时隐藏关系主页旧趋势图、趋势对比、主要标签、使用提醒、关系时间线入口卡、分散的下一步建议、娱乐洞察。
- `src/pages/case-detail/case-detail.vue`：新增“下一步操作”集中入口，包含继续记录、查看评估历史、重新评估、编辑画像。
- `src/pages/timeline/timeline.vue`：通过 `showTimelineLegacySections = false` 临时隐藏时间线娱乐洞察、系统判断轨迹、存储说明；关键事件流说明改为聚焦真实互动记录。

说明：

- 旧代码没有删除，后续只要把对应开关改回 `true` 就能恢复。
- 当前是信息架构试运行版本，方便先看页面清晰度，再决定是否永久删除、折叠或迁移。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：DeepSeek 测试连接 404 定位与兼容修正

用户反馈后台配置 DeepSeek 后测试不通过。本轮读取 `testAIConnection` 云函数日志，看到失败主要为：

- `AI 接口返回 404`
- 个别请求出现 `AI_REQUEST_TIMEOUT`

判断主要原因是 Base URL 可能填写成完整接口地址，旧逻辑会继续追加 `/v1/chat/completions` 或 `/chat/completions`，导致最终请求路径错误。已修正：

- `cloudfunctions/testAIConnection/_shared/ai-http.js`
- `cloudfunctions/createTimeline/_shared/ai-http.js`
- `cloudfunctions/deleteTimeline/_shared/ai-http.js`
- `cloudfunctions/_shared/ai-http.js`

修正后如果 Base URL 已经是完整 endpoint，例如 `/chat/completions` 或 `/messages`，不会再重复追加路径。

部署与验证：

- `node --check cloudfunctions/testAIConnection/_shared/ai-http.js`：通过
- `node --check cloudfunctions/createTimeline/_shared/ai-http.js`：通过
- `node --check cloudfunctions/deleteTimeline/_shared/ai-http.js`：通过
- `echo y | npx.cmd cloudbase functions:deploy --all -e cloud1-d8gqh3f5g49993a5a`：部署成功

## 追加：前端显示 AI 是否生效

用户希望前端能直接看出 AI 是否参与研判。本轮完成：

- `cloudfunctions/createTimeline/index.js`：新增时间线记录时写入 `aiUsed` 字段。
- `src/pages/timeline/timeline.vue`：即时反馈卡和关键事件列表显示 `AI 已参与研判` 标记。
- `src/pages/case-detail/case-detail.vue`：关系主页顶部结果和相关时间线证据显示 `AI 已参与研判` 标记。
- `src/utils/insights.js`：焦点证据数据保留 `aiUsed`，供关系主页展示。

说明：

- 新增记录后如果 AI 真正参与了重算，标记会持久保存并在刷新后仍显示。
- 已有旧记录没有 `aiUsed` 字段，不会自动补标；但关系主页最新结果如果 headline 以 `AI 研判后：` 开头，顶部仍会显示 AI 标记。

验证与部署：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过
- `echo y | npx.cmd cloudbase functions:deploy createTimeline -e cloud1-d8gqh3f5g49993a5a`：部署成功

## 追加：趋势图来源标签去重

用户反馈趋势图右侧黄色小框重复显示趋势标题。本轮确认该小框原意是显示评估来源类型，而不是重复标题。已修改：

- `src/components/AssessmentTrendChart.vue`：标题仍显示触发事件标题；右侧黄色小框改为来源类型，如“首次评估 / 手动复测 / 事件重算 / 评估记录”。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

待真机验证：

- 用户同意手机号授权后是否能登录并进入首页。
- 用户拒绝手机号授权后是否能展开邮箱登录。
- 已存在手机号用户是否能绑定 `openid`。
- 新手机号用户是否能自动创建账号。

## 追加：评估历史页面合并趋势与评估记录

用户反馈评估历史页顶部“评估趋势”和底部评估卡片重复，且顶部缺少 AI 研判内容和证据等级。本轮调整：

- `src/pages/assessments/assessments.vue`：移除独立 `AssessmentTrendChart` 展示，合并为单一评估历史列表。
- 最新评估按 `createdAt` 倒序排序，避免依赖后端返回顺序。
- 每条评估卡片统一展示评估时间、来源类型、触发事件、证据等级、可信度、趋势变化、AI 研判内容。
- 意向/风险改为横向分数条，分数越高颜色越深，低分保持浅色，便于快速判断。
- AI 参与标记沿用 `AI 研判后：` headline 和 `aiUsed` 字段判断。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过

## 追加：关系主页信息顺序与旧娱乐洞察删除

用户确认关系主页要作为总信息汇总页，但即时反馈在首页已经看过，关系主页中应默认折叠；旧“娱乐洞察”需要删除。本轮调整：

- `src/pages/case-detail/case-detail.vue`：关系主页调整为“对象画像/画像侧写 -> 折叠即时反馈 -> 趋势图全貌 -> 主要标签 -> 当前建议 -> 当前需要注意什么 -> 下一步操作”。
- 关系主页常规流中移除会与即时反馈重复的原因说明、双指标卡、对象状态卡；这些内容保留在折叠即时反馈里，默认不展开。
- 关系主页趋势图恢复为常规展示，采用纵向全貌形式，最新记录在上，展示全部评估记录的意向、风险、变化值和来源。
- 主要标签恢复为单独轻量板块，便于快速扫描当前系统关键词。
- 下一步操作中的时间线入口改为“打开完整时间线”，避免时间线隐藏后入口不清楚。
- `src/pages/index/index.vue`：首页快速记录后的即时反馈卡隐藏，不再占用首页空间。
- `src/pages/timeline/timeline.vue`、`src/utils/insights.js`：删除旧娱乐洞察模板、计算和导出函数，画像侧写作为新的统一侧写入口。

修正：

- 用户澄清“隐藏折叠”指关系主页，不是首页。已恢复 `src/pages/index/index.vue` 中快速记录成功后的动态即时反馈弹出。
- 当前最终规则：首页快速记录后即时反馈仍动态展示；关系主页中的即时反馈默认折叠，供后续回看。
- 用户进一步确认：关系主页的“主要标签”并入即时反馈折叠内容；“当前建议”和“当前需要注意什么”提前到即时反馈下面；趋势图放到这两个板块之后。

验证：

- `npm.cmd run build:h5`：通过
- `npm.cmd run build:mp-weixin`：通过
- `npm.cmd run build:app`：通过
