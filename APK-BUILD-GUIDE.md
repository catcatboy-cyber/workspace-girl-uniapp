# Android APK 打包指南

## 当前状态
- ✅ 代码已推送到 GitHub: https://github.com/catcatboy-cyber/workspace-girl-uniapp
- ⏳ APK 打包需要使用 HBuilderX

## 打包步骤

### 方法 1：使用 HBuilderX（最简单）

1. **下载 HBuilderX**
   - 访问：https://www.dcloud.io/hbuilderx.html
   - 下载标准版即可

2. **导入项目**
   - 打开 HBuilderX
   - 文件 → 导入 → 从本地目录导入
   - 选择：`C:\Users\catca\.openclaw\workspace-girl-uniapp`

3. **配置 manifest.json**
   - 打开 `src/manifest.json`
   - 填写应用名称、appid（可以使用 DCloud 提供的测试 appid）
   - 配置应用图标和启动图

4. **云打包**
   - 点击菜单：发行 → 原生App-云打包
   - 选择 Android
   - 使用公共证书（测试用）或自有证书
   - 点击打包
   - 等待 5-10 分钟
   - 下载生成的 APK

### 方法 2：使用 uni-app 离线打包（需要 Android Studio）

1. **下载 Android 离线 SDK**
   - https://nativesupport.dcloud.net.cn/AppDocs/download/android

2. **配置项目**
   ```bash
   cd C:\Users\catca\.openclaw\workspace-girl-uniapp
   npm run build:app-plus
   ```

3. **使用 Android Studio 打包**
   - 导入离线 SDK 项目
   - 将构建产物复制到 SDK 的 assets 目录
   - 使用 Android Studio 生成 APK

### 方法 3：使用 GitHub Actions 自动打包（需要配置）

需要配置 DCloud 账号和 CI/CD 流程。

## 快速测试方案

如果只是想快速测试，可以：

1. **使用 H5 版本**（已部署）
   - 在手机浏览器访问：https://catboy-d0gg4yc4ief533dea-1422348600.tcloudbaseapp.com
   - 添加到主屏幕，体验类似 App

2. **使用微信小程序**
   ```bash
   cd C:\Users\catca\.openclaw\workspace-girl-uniapp
   npm run build:mp-weixin
   ```
   - 使用微信开发者工具打开 `dist/build/mp-weixin`
   - 上传审核发布

## 推荐方案

**最快速**：使用 HBuilderX 云打包（方法 1）
- 优点：简单、快速、无需配置环境
- 缺点：需要下载 HBuilderX（约 200MB）

**最灵活**：使用 H5 版本
- 优点：已部署，立即可用，跨平台
- 缺点：需要网络连接

## 下载链接

- **GitHub 仓库**: https://github.com/catcatboy-cyber/workspace-girl-uniapp
- **H5 在线版**: https://catboy-d0gg4yc4ief533dea-1422348600.tcloudbaseapp.com
- **HBuilderX 下载**: https://www.dcloud.io/hbuilderx.html

## 注意事项

1. **首次打包需要配置**：
   - DCloud 账号（免费注册）
   - 应用 appid（可使用测试 appid）
   - 应用图标和启动图

2. **云打包限制**：
   - 免费版每天有打包次数限制
   - 首次打包可能需要排队

3. **APK 签名**：
   - 测试可使用公共证书
   - 正式发布需要自己的签名证书

---

需要我帮你配置 HBuilderX 打包所需的 manifest.json 吗？
