# 项目长期记忆

## 技术栈
- uni-app + Vue 3 + Vite + CloudBase（腾讯云开发）
- 目标平台：微信小程序、Android、iOS
- 微信小程序 AppID: wxb8bd1a6b518e931e

## 关键约定
- 前端代码在 `src/` 目录，改后必须 `npm run build:mp-weixin` 才能在微信开发者工具生效
- `privacy.json` 源文件在 `src/privacy.json`，通过 `vite.config.js` 的 `patchMpWeixin()` 插件自动复制到构建输出
- uni-app 编译器会剥离 `permission` 和 `__usePrivacyCheck__` 字段，`vite.config.js` 的 `patchMpWeixin()` 插件在 `closeBundle` 钩子中补丁 `app.json`
- `scripts/postbuild-mp-weixin.cjs` 仅在 `build:mp-weixin` 时运行，dev 模式靠 Vite 插件
- 微信隐私保护已启用（`__usePrivacyCheck__: true`），所有隐私 API（chooseImage/saveImageToPhotosAlbum/record 等）调用前必须：
  1. 在 `privacy.json` 的 `privacy_interface` 中声明
  2. 在调用前执行 `wx.requirePrivacyAuthorize()` 获取用户授权
- **`app.json` 的 `permission` 字段是白名单制**，只接受：`scope.userLocation` / `scope.userLocationBackground` / `scope.address` / `scope.invoiceTitle` / `scope.invoice` / `scope.werun` 等少数几个；`scope.record` / `scope.writePhotosAlbum` **不允许写在 `app.json.permission` 里**（会被开发者工具拒绝），它们属于隐私接口，只能声明在 `privacy.json` 的 `privacy_interface` 数组中
- CloudBase 集成中心微信支付回调不可靠（网关层拦截），已决定自研微信支付 V3 接口

## 已声明隐私接口
- `chooseImage` — 选择图片（附件/头像/自定义形象）
- `chooseMedia` — 选择图片或视频作为附件
- `saveImageToPhotosAlbum` — 保存图片到相册
- `record` — 语音录音输入
