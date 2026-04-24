# uni-app 多端兼容修复计划

## 1. 目标

当前项目的主体仍然是 `uni-app`，但要稳定支持以下目标端，还需要做一轮兼容性修复：

- Android APK
- iOS App
- 微信小程序

本计划只聚焦“能正常构建、能正常运行、核心功能不踩平台坑”。

---

## 2. 当前结论摘要

### 2.1 可以确认的事实

- 项目基础框架是标准 `uni-app + Vue3 + Vite`
- 没有发现业务层混入 React / Next / Element Plus / Ant Design 这类明显不属于 uni-app 的框架
- 页面注册、清单文件、构建脚本整体仍是 uni-app 体系

### 2.2 当前主要风险点

1. `CloudBase` 接入方式偏 Web，不是标准 uni-app 多端接法
2. 头像上传逻辑依赖 `base64 + FileSystemManager`，对多端尤其是小程序不稳
3. 趋势图 Canvas 混用了两套 API，跨端渲染风险高
4. 微信小程序 `appid` 为空，无法做真实小程序交付
5. Android 权限声明过多，存在打包审核风险

### 2.3 当前验证限制

本地执行 `build:mp-weixin` 时出现 `spawn EPERM`，说明当前环境还没完成一次有效构建验证。  
这意味着后续修复应分成“代码兼容修复”和“构建环境验证”两部分处理。

---

## 3. 修复优先级

### P0：必须先修

这些问题会直接影响多端可用性：

- `src/utils/cloudbase.ts`
- `src/components/ProfileAvatarPicker.vue`
- `src/components/AssessmentTrendChart.vue`
- `src/manifest.json` 中的小程序配置

### P1：建议紧接着修

- Android 权限最小化
- 上传、登录、云函数调用的真机回归测试

### P2：后续优化

- 替换高风险自绘组件
- 建立多端兼容检查清单
- 补自动化回归测试

---

## 4. 分阶段修复方案

## 阶段一：重构 CloudBase 接入层

### 目标

让云开发能力在 `H5 / App / 微信小程序` 上采用统一、可控、可分平台的接入方式。

### 当前问题

`src/utils/cloudbase.ts` 直接使用了：

- `@cloudbase/js-sdk`
- `app.auth({ persistence: 'local' })`
- `anonymousAuthProvider().signIn()`
- `app.callFunction`
- `app.uploadFile`

这套写法更像 Web 方案，不适合作为 uni-app 多端统一底座。

### 修复策略

1. 先确认 CloudBase 官方在 uni-app 下的推荐接法  
   优先采用官方 uni-app adapter。
2. 把 `cloudbase.ts` 改造成“平台适配层”，不要把平台差异散落到页面和组件里。
3. 把以下能力统一封装：
   - 初始化
   - 登录态恢复
   - 云函数调用
   - 文件上传
   - 错误归一化
4. 明确区分：
   - H5
   - App
   - 微信小程序

### 交付结果

- 一个新的稳定云能力入口
- 页面层不再直接依赖 Web 风格的 CloudBase 行为
- 后续 AI 设置、登录、上传逻辑都基于统一接口

### 验证项

- 登录成功
- 匿名登录或用户登录行为符合预期
- 云函数调用成功
- 上传文件成功
- 退出登录和登录态恢复正常

---

## 阶段二：重做头像选择与上传链路

### 目标

把头像逻辑从“本地 base64 持久化”改成“选择文件 -> 上传云存储 -> 保存 URL”。

### 当前问题

`src/components/ProfileAvatarPicker.vue` 里：

- 使用 `uni.chooseImage`
- 使用 `uni.getFileInfo`
- 使用 `uni.getFileSystemManager().readFile`
- 最终保存为 `data:image/...;base64,...`

而 `src/pages/edit-profile/edit-profile.vue` 会把 `profile.avatar` 一并提交保存。

### 风险

- 小程序端对大体积 base64 不友好
- App 端文件读取能力与 H5、小程序并不完全一致
- 数据库存储头像 base64 会让数据记录膨胀
- 页面列表中直接渲染 base64 会增加内存和渲染负担

### 修复策略

1. 保留预设头像方案不动
2. 自定义头像改成：
   - 选图
   - 校验大小
   - 直接上传云存储
   - 保存云文件 URL 或 fileID
3. 页面中统一只保存：
   - 预设头像路径
   - 云端头像地址
4. 删除对 `uni.getFileSystemManager().readFile` 的依赖

### 交付结果

- `profile.avatar` 不再存 base64
- 头像能力适配 App / 小程序 / H5
- 数据体积明显下降

### 验证项

- 选择相册图片成功
- 上传成功后能立即预览
- 保存资料后列表、详情、首页都能显示头像
- 微信小程序真机可用
- App 真机可用

---

## 阶段三：重构趋势图组件

### 目标

让趋势图在多端都能稳定渲染，不依赖混杂的 Canvas 能力。

### 当前问题

`src/components/AssessmentTrendChart.vue` 同时用了：

- `uni.createSelectorQuery().fields({ node: true, size: true })`
- `canvas.getContext('2d')`
- `uni.createCanvasContext('trendCanvas')`

这属于新旧两套 Canvas 方案混用。

### 风险

- 某些端能拿到节点但绘制行为异常
- 某些端会回退到旧 API，但绘图代码本身又按新 API 思路写
- 事件、像素比、清屏、文本绘制可能出现平台差异

### 修复策略

二选一，不建议继续混用：

#### 方案 A：统一为成熟跨端图表库

适合需求稳定、希望少踩坑：

- 优先找支持 uni-app / 微信小程序 / App 的图表库
- 用配置式方案替代手写 Canvas

#### 方案 B：保留自绘，但统一成单一 Canvas 技术路线

如果坚持自己画：

1. 只保留一种 Canvas 接口
2. 按目标端分别验证
3. 重新处理 DPR、文本、曲线、触摸事件

### 建议

如果图表不是核心壁垒，优先采用成熟库，维护成本更低。

### 验证项

- 首页或详情页图表正常显示
- 微信小程序不空白
- App 端无错位和模糊
- 数据变化时可重绘

---

## 阶段四：完善 manifest 与平台配置

### 目标

补齐构建所需配置，减少发布期问题。

### 必改项

#### 1. 微信小程序 AppID

`src/manifest.json` 中 `mp-weixin.appid` 当前为空。  
必须填入真实小程序 `appid`，否则无法进行真实预览、上传和发布。

#### 2. Android 权限最小化

建议重新审查以下权限是否真的需要：

- `READ_LOGS`
- `GET_ACCOUNTS`
- `READ_PHONE_STATE`
- `WRITE_SETTINGS`
- `MOUNT_UNMOUNT_FILESYSTEMS`

### 原则

- 只保留实际业务需要的权限
- 相机能力若只用于头像，可仅保留必要权限
- 不要为了“可能以后会用”提前声明高风险权限

### 验证项

- manifest 生成正常
- Android 打包无权限冲突
- 应用商店审核风险降低

---

## 阶段五：梳理 H5/Web 思路残留

### 目标

把项目里偏 Web 的实现统一收口，避免后续继续引入平台坑。

### 当前已发现的问题

- `src/utils/cloudbase.ts` 中有 `localStorage` 访问
- 某些实现习惯是先按浏览器思路写，再做兼容判断

### 修复策略

1. 存储统一改为 `uni.setStorageSync / uni.getStorageSync / uni.removeStorageSync`
2. 所有平台差异封装到 `utils` 或 `services`，不要散落在页面组件里
3. 对以下能力建立统一规范：
   - 存储
   - 上传
   - 登录态
   - 路由跳转
   - 平台判断

---

## 5. 建议实施顺序

建议严格按下面顺序推进：

1. 修 `CloudBase` 适配层
2. 修头像上传链路
3. 修趋势图组件
4. 补 `manifest.json` 平台配置
5. 做真机构建与回归��试

原因很简单：

- `CloudBase` 是底座，先修它，后面的上传和云函数才能稳定
- 头像和图表是最明显的跨端脆弱点
- manifest 配置属于交付前必要项，但不能替代代码兼容修复

---

## 6. 验收清单

修完后至少要完成以下验证：

### 构建验证

- `H5` 可运行
- `微信小程序` 可构建
- `App` 可构建

### 功能验证

- 登录正常
- 案例列表正常
- AI 设置正常
- 云函数调用正常
- 头像上传和显示正常
- 趋势图正常显示

### 真机验证

- Android 真机验证
- 微信开发者工具 + 真机预览验证
- iOS 至少做一次模拟器或真机验证

---

## 7. 风险说明

### 风险一：CloudBase 官方适配方式与当前实现差异较大

这意味着修复可能不是“改两三行”，而是要重做接入层。

### 风险二：图表组件可能需要替换

如果当前自绘逻辑严重依赖特定 Canvas 行为，继续修补的成本可能高于替换。

### 风险三：构建环境本身仍有问题

`spawn EPERM` 说明当前机器的 Node / npm / 权限 / 杀软 / 进程策略 也要排查。  
否则代码修完后仍可能无法在本机完成打包验证。

---

## 8. 最终建议

从工程角度看，这个项目不是“伪 uni-app 项目”，而是“uni-app 项目里混入了一些偏 Web 的实现习惯”。  
所以修复方向不是推翻重做，而是：

- 保留现有 uni-app 架构
- 把底层能力改成真正适合 uni-app 多端的写法
- 把高风险组件替换或重构

如果按本计划执行，项目可以收敛到适合 `APK / iOS / 微信小程序` 交付的状态。

