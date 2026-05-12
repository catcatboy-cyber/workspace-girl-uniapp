# APK 打包完整方案

## 问题说明
uni-app CLI 无法直接生成 APK，需要使用 HBuilderX 或云打包服务。

## ✅ 推荐方案：使用 HBuilderX 云打包

### 步骤 1：下载 HBuilderX
下载地址：https://www.dcloud.io/hbuilderx.html
- 选择"正式版"或"Alpha版"
- 下载"标准版"即可（约 200MB）

### 步骤 2：导入项目
1. 打开 HBuilderX
2. 文件 → 导入 → 从本地目录导入
3. 选择：`C:\Users\catca\.openclaw\workspace-girl-uniapp`

### 步骤 3：配置应用信息
1. 打开 `manifest.json`（可视化界面）
2. 基础配置：
   - 应用名称：关系评估助手
   - AppID：使用 DCloud 提供的测试 ID 或注册获取
   - 版本号：1.0.0
3. App 图标配置：
   - 上传应用图标（1024x1024）
   - 自动生成各尺寸图标

### 步骤 4：云打包
1. 点击菜单：发行 → 原生App-云打包
2. 选择平台：Android
3. 证书选择：
   - **测试用**：使用公共测试证书
   - **正式发布**：使用自有证书
4. 点击"打包"
5. 等待 5-10 分钟
6. 打包完成后点击"下载"

### 步骤 5：安装测试
- 将 APK 传输到 Android 手机
- 安装并测试

---

## 🚀 快速替代方案

### 方案 A：使用 H5 版本（已部署，立即可用）

**在线访问**：
https://cloud1-d8gqh3f5g49993a5a-1422348600.tcloudbaseapp.com

**手机使用**：
1. 用手机浏览器打开上述链接
2. 点击浏览器菜单 → "添加到主屏幕"
3. 图标会出现在桌面，点击即可使用
4. 体验接近原生 App

**优点**：
- ✅ 无需安装
- ✅ 跨平台（Android/iOS 都可用）
- ✅ 自动更新
- ✅ 已修复所有已知问题

### 方案 B：微信小程序版本

```bash
cd C:\Users\catca\.openclaw\workspace-girl-uniapp
npm run build:mp-weixin
```

构建产物在：`dist/build/mp-weixin`

使用微信开发者工具打开并上传审核。

---

## 📦 离线打包方案（高级）

如果需要完全自主打包，可以使用 Android Studio：

### 1. 下载 Android 离线 SDK
https://nativesupport.dcloud.net.cn/AppDocs/download/android

### 2. 构建资源包
```bash
# 注意：当前 CLI 构建 App 有问题，需要使用 HBuilderX
```

### 3. 使用 Android Studio 打包
- 导入离线 SDK 项目
- 配置应用信息
- 生成 APK

---

## 🎯 当前最佳实践

**立即可用**：
- 使用 H5 版本：https://cloud1-d8gqh3f5g49993a5a-1422348600.tcloudbaseapp.com
- 手机浏览器"添加到主屏幕"

**需要 APK**：
1. 下载 HBuilderX（5 分钟）
2. 导入项目（1 分钟）
3. 云打包（10 分钟）
4. 下载 APK（1 分钟）

**总耗时**：约 20 分钟

---

## 📱 APK 下载位置

打包完成后，APK 会保存在：
- HBuilderX 云打包：下载到本地指定目录
- 默认位置：`C:\Users\catca\Downloads\`

---

## ⚠️ 注意事项

1. **首次使用需要注册 DCud 账号**（免费）
2. **测试证书打包的 APK 无法上架应用商店**
3. **正式发布需要自己的签名证书**
4. **免费版每天有打包次数限制**

---

## 🔗 相关链接

- GitHub 仓库：https://github.com/catcatboy-cyber/workspace-girl-uniapp
- H5 在线版：https://cloud1-d8gqh3f5g49993a5a-1422348600.tcloudbaseapp.com
- HBuilderX 下载：https://www.dcloud.io/hbuilderx.html
- uni-app 文档：https://uniapp.dcloud.net.cn/

---

## 💡 建议

**如果只是自己使用或测试**：
→ 直接使用 H5 版本，添加到手机主屏幕

**如果需要分享给他人**：
→ 使用 HBuilderX 云打包生成 APK

**如果需要上架应用商店**：
→ 使用自有证书打包，并准备应用商店所需材料
