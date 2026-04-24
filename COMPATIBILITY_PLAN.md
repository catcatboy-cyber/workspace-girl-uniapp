# uni-app 全平台兼容修复方案

> 目标：H5 / 微信小程序 / 支付宝小程序 / 百度小程序 / 抖音小程序 / Android APK / iOS  
> 当前状态：11 个页面、5 个组件、5 个工具模块，Vue 3 + Vite + CloudBase

---

## 一、必须修复（阻塞级）

### 1. CloudBase SDK 替换为 uniCloud 或多平台适配

**影响**：小程序和原生 App 无法正常调用云函数、数据库、存储。  
**涉及文件**：`src/utils/cloudbase.ts`、`src/utils/api.ts`

**方案 A（推荐）：迁移到 uniCloud**

uni-app 官方深度集成腾讯云开发，无需额外 SDK：

```
npm install @dcloudio/uni-cloud
```

- 删除 `@cloudbase/js-sdk` 依赖
- 用 `uniCloud.callFunction()` 替代 `app.callFunction()`
- 用 `uniCloud.database()` 替代 `app.database()`
- 认证改为 uniCloud 的 `uni-id` 体系，或直接用微信/手机号登录
- 移除 `localStorage` 直接访问（cloudbase.ts:35）

**方案 B：保留 CloudBase SDK + 平台适配器**

为每个平台注入对应的 CloudBase 适配器：

| 平台 | 适配器 |
|------|--------|
| H5 | 无需适配器（默认） |
| 微信小程序 | `@cloudbase/adapter-wx_mp` |
| 支付宝小程序 | 自定义适配器 |
| App | `@cloudbase/adapter-uni-app`（如有）或改用 HTTP API |

需要在 `cloudbase.ts` 初始化前，按平台条件注入：

```typescript
// #ifdef MP-WEIXIN
import adapter from '@cloudbase/adapter-wx_mp'
cloudbase.useAdapters(adapter)
// #endif
```

**工作量**：方案 A 约 2-3 天（需改云函数层的认证逻辑）；方案 B 约 1 天

---

### 2. Canvas 图表统一为 Canvas 2D API

**影响**：趋势图在所有平台渲染异常。  
**涉及文件**：`src/components/AssessmentTrendChart.vue`

**问题**：旧 API (`canvas-id` + `uni.createCanvasContext`) 在微信基础库 2.9.0+ 已废弃；模板混用新旧写法导致两个 API 都不生效。

**修复步骤**：

1. 模板中改用新版 Canvas：

```html
<!-- 旧 -->
<canvas canvas-id="trendCanvas" ... />

<!-- 新 -->
<canvas type="2d" id="trendCanvas" ... />
```

2. 移除旧 API 回退逻辑，只使用新版：

```typescript
onMounted(() => {
  const query = uni.createSelectorQuery()
  query.select('#trendCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = canvasWidth.value * dpr
      canvas.height = canvasHeight.value * dpr
      ctx.scale(dpr, dpr)
      canvasContext = ctx
      drawChart()
    })
})
```

3. `drawChart` 中把 `canvasContext.draw()` 删掉（新 API 不需要手动 draw）。

**工作量**：约 2 小时

---

### 3. ProfileAvatarPicker — 文件读取 H5 兼容

**影响**：H5 端选择头像功能崩溃。  
**涉及文件**：`src/components/ProfileAvatarPicker.vue:97`

**问题**：`uni.getFileSystemManager()` 在 H5 端不存在。

**修复方案**：使用条件编译分平台处理。

```typescript
function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]

      // #ifdef H5
      // H5 端：直接使用 tempFilePath（blob URL），或上传到云存储获取 fileID
      avatarValue.value = tempFilePath
      uploadError.value = ''

      // #else
      // 小程序/App 端：读取为 base64
      uni.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (readRes) => {
          avatarValue.value = `data:image/jpeg;base64,${readRes.data}`
          uploadError.value = ''
        },
        fail: () => { uploadError.value = '读取图片失败' }
      })
      // #endif
    }
  })
}
```

更好的方案是上传到云存储拿到 `fileID`，全平台统一用 `fileID` 作为头像值。

**工作量**：约 1 小时

---

## 二、应该修复（重要但不阻塞）

### 4. CSS Grid → Flex 布局

**影响**：支付宝小程序布局错乱。  
**涉及文件**：

| 文件 | 行号 | 代码 |
|------|------|------|
| `src/pages/index/index.vue` | 552 | `grid-template-columns: 1fr 220rpx` |
| `src/pages/timeline/timeline.vue` | 522 | `grid-template-columns: 1fr 220rpx` |

**修复**：

```css
/* 旧 */
.datetime-row {
  display: grid;
  grid-template-columns: 1fr 220rpx;
  gap: 12rpx;
}

/* 新 */
.datetime-row {
  display: flex;
  gap: 12rpx;
}
.datetime-row > picker:first-child { flex: 1; }
.datetime-row > picker:last-child { width: 220rpx; flex-shrink: 0; }
```

**工作量**：约 30 分钟

---

### 5. Android 权限瘦身

**影响**：应用市场上架被拒或用户不信任。  
**涉及文件**：`src/manifest.json:25-41`

**当前申请了 14 个权限**，实际只用到 `CAMERA`（拍照选头像）。建议只保留：

```json
"permissions": [
  "<uses-permission android:name=\"android.permission.CAMERA\"/>",
  "<uses-permission android:name=\"android.permission.INTERNET\"/>",
  "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\"/>",
  "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\"/>"
]
```

- 删除 `READ_LOGS`（Android 4.1+ 已无效）
- 删除 `READ_PHONE_STATE`（隐私敏感，无关业务）
- 删除 `MOUNT_UNMOUNT_FILESYSTEMS`（无关业务）
- 删除 `GET_ACCOUNTS`（无关业务）
- 删除 `WRITE_SETTINGS`（无关业务，且非常敏感）
- 删除 `VIBRATE`、`FLASHLIGHT`、`CHANGE_WIFI_STATE`、`CHANGE_NETWORK_STATE`、`WAKE_LOCK`（无关业务）
- 删除 `camera.autofocus` feature 声明（多余）

**工作量**：约 10 分钟

---

### 6. 微信小程序 appid 配置

**影响**：微信小程序无法真机调试和使用微信相关能力。  
**涉及文件**：`src/manifest.json:53`

去微信公众平台注册小程序，拿到 AppID 后填入：

```json
"mp-weixin": {
  "appid": "wx你的真实appid",
  ...
}
```

---

### 7. tabBar 添加图标

**影响**：部分小程序平台审核不通过，用户体验差。  
**涉及文件**：`src/pages.json:84-107`

为 4 个 tab 添加 `iconPath` 和 `selectedIconPath`：

```json
"list": [
  {
    "pagePath": "pages/index/index",
    "text": "首页",
    "iconPath": "static/tabbar/home.png",
    "selectedIconPath": "static/tabbar/home-active.png"
  },
  ...
]
```

需要准备 8 张图片（4 个 tab × 2 种状态），尺寸建议 81×81 px，放入 `src/static/tabbar/`。

**工作量**：约 30 分钟（准备图标 + 配置）

---

## 三、建议修复（优化项）

### 8. 清理无用依赖

- `package.json` 中 `vue-i18n` 全项目未使用 → 删除
- `package.json` 中多余的小程序平台包（`@dcloudio/uni-mp-jd`、`@dcloudio/uni-mp-kuaishou` 等），如果不需要打包这些平台 → 删除以减小 `node_modules`

### 9. App.vue 统一为 Composition API

`src/App.vue` 使用 Options API 写法（`export default { onLaunch() {} }`），其他页面全是 `<script setup>`。改为统一写法：

```vue
<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => { console.log('App Launch') })
onShow(() => { console.log('App Show') })
onHide(() => { console.log('App Hide') })
</script>
```

### 10. 页面级生命周期规范化

`login.vue:60` 和 `ai-settings.vue:169` 使用 Vue 的 `onMounted`，应改为 uni-app 的 `onShow`：

- `onMounted` 在页面首次渲染时触发一次，小程序切后台再回来不会触发
- `onShow` 每次页面显示都触发，符合登录页和数据加载页的预期行为

### 11. 头像 preset SVG 文件缺失

`src/utils/avatar-options.ts` 引用了 4 个 SVG：
- `/static/avatars/anime-mint.svg`
- `/static/avatars/anime-sky.svg`
- `/static/avatars/anime-coral.svg`
- `/static/avatars/anime-amber.svg`

但 `src/static/` 下没有 `avatars/` 目录，只有 `logo.png`。需要提供这些 SVG 文件，或改为内联 SVG / emoji 占位。

### 12. `uni.pageScrollTo({ selector })` 跨平台降级

`src/pages/timeline/timeline.vue:361` 使用了 `selector` 参数，部分小程序不支持。

```typescript
// 降级方案
function scrollToEvent(eventId: string) {
  // #ifdef MP-ALIPAY || MP-BAIDU
  // 这些平台不支持 selector，改为获取元素位置后 scrollTop
  uni.createSelectorQuery().select(`#event-${eventId}`)
    .boundingClientRect((rect) => {
      if (rect) uni.pageScrollTo({ scrollTop: rect.top, duration: 300 })
    }).exec()
  // #else
  uni.pageScrollTo({ selector: `#event-${eventId}`, duration: 300 })
  // #endif
}
```

---

## 四、修复顺序建议

```
第 1 天上午：1. CloudBase SDK 方案确定 + 开始实施
第 1 天下午：2. Canvas 修复 + 3. 文件读取 H5 兼容
第 2 天上午：4. CSS Grid → Flex + 5. Android 权限
第 2 天下午：6-12. 轻量优化项批量处理
第 3 天上午：全平台编译验证（H5 + 微信 + 支付宝 + App）
第 3 天下午：真机测试 + 修复遗留问题
```

---

## 五、每平台编译验证命令

```bash
# H5
npm run dev:h5

# 微信小程序（需要微信开发者工具）
npm run dev:mp-weixin

# 支付宝小程序
npm run dev:mp-alipay

# Android App（需要 HBuilderX）
npm run dev:app

# 各平台生产构建
npm run build:h5
npm run build:mp-weixin
npm run build:mp-alipay
npm run build:app
```
