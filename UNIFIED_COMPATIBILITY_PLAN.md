# uni-app 多端兼容统一修复方案

> **目标平台**：H5 / 微信小程序 / 支付宝小程序 / Android APK / iOS  
> **项目现状**：Vue 3 + Vite + uni-app + CloudBase，11 个页面，5 个组件  
> **修复周期**：预计 3-4 天

---

## 📊 三份方案对比分析

| 维度 | Claude 分析 | COMPATIBILITY_PLAN | gpt-uniapp-multiend-fix-plan |
|------|-------------|-------------------|------------------------------|
| **问题识别深度** | ⭐⭐⭐⭐ 发现 Canvas API 严重问题 | ⭐⭐⭐⭐⭐ 最全面，包含构建环境问题 | ⭐⭐⭐⭐⭐ 最细致，包含 CSS Grid、权限等 |
| **修复方案具体性** | ⭐⭐⭐ 提供条件编译示例 | ⭐⭐⭐ 偏战略，缺少代码示例 | ⭐⭐⭐⭐⭐ 提供完整代码示例 |
| **优先级划分** | ⭐⭐⭐ P0/P1/P2 | ⭐⭐⭐⭐⭐ P0/P1/P2 + 阶段划分 | ⭐⭐⭐⭐ 必须/应该/建议 |
| **工作量评估** | ❌ 无 | ❌ 无 | ⭐⭐⭐⭐⭐ 每项都有时间估算 |
| **验收标准** | ⭐⭐⭐ 简单列举 | ⭐⭐⭐⭐⭐ 详细验收清单 | ⭐⭐⭐ 编译命令 |

### 核心共识

三份方案都识别出以下**阻塞级问题**：

1. **CloudBase SDK 跨平台适配不足**
2. **Canvas 图表新旧 API 混用**
3. **头像上传依赖 FileSystemManager（H5 不支持）**
4. **微信小程序 appid 缺失**
5. **Android 权限过度申请**

### 独特发现

- **Claude**：发现 `localStorage` 直接访问问题
- **COMPATIBILITY_PLAN**：强调构建环境验证（`spawn EPERM`）
- **gpt-uniapp-multiend-fix-plan**：发现 CSS Grid 兼容性、tabBar 图标缺失、SVG 文件缺失

---

## 🎯 统一修复优先级

### P0：阻塞级（必须修复才能多端运行）

| 问题 | 影响范围 | 工作量 | 负责模块 |
|------|---------|--------|---------|
| 1. CloudBase SDK 多端适配 | 所有平台云函数调用失败 | 1-3 天 | `src/utils/cloudbase.ts` + `src/utils/api.ts` |
| 2. Canvas 图表统一为 Canvas 2D | 趋势图在所有平台渲染异常 | 2 小时 | `src/components/AssessmentTrendChart.vue` |
| 3. 头像上传 H5 兼容 | H5 端选择头像崩溃 | 1 小时 | `src/components/ProfileAvatarPicker.vue` |
| 4. 微信小程序 appid 配置 | 无法真机调试和发布 | 5 分钟 | `src/manifest.json` |

### P1：重要级（影响体验和审核）

| 问题 | 影响范围 | 工作量 | 负责模块 |
|------|---------|--------|---------|
| 5. CSS Grid → Flex 布局 | 支付宝小程序布局错乱 | 30 分钟 | `index.vue` + `timeline.vue` |
| 6. Android 权限瘦身 | 应用市场审核被拒 | 10 分钟 | `src/manifest.json` |
| 7. localStorage 清理 | 小程序存储失效 | 10 分钟 | `src/utils/cloudbase.ts` |
| 8. tabBar 图标补充 | 部分平台审核不通过 | 30 分钟 | `src/pages.json` + 图标资源 |

### P2：优化级（提升代码质量）

| 问题 | 影响范围 | 工作量 |
|------|---------|--------|
| 9. 头像 SVG 文件补充 | 预设头像显示异常 | 20 分钟 |
| 10. App.vue 统一为 Composition API | 代码风格不一致 | 10 分钟 |
| 11. 页面生命周期规范化 | 小程序切后台数据不刷新 | 15 分钟 |
| 12. `uni.pageScrollTo` 降级 | 部分小程序滚动失效 | 15 分钟 |
| 13. 清理无用依赖 | 包体积过大 | 10 分钟 |

---

## 🔧 详细修复方案

### P0-1：CloudBase SDK 多端适配

#### 问题分析

当前 `src/utils/cloudbase.ts` 直接使用 `@cloudbase/js-sdk`，这是 Web 风格的接入方式，在小程序和 App 端存在以下问题：

- 匿名登录在小程序端行为不一致
- 自定义票据登录在不同平台 API 不同
- `localStorage` 直接访问在小程序中无效

#### 修复方案（二选一）

**方案 A：迁移到 uniCloud（推荐）**

优势：uni-app 官方深度集成，无需额外适配器

```bash
npm install @dcloudio/uni-cloud
npm uninstall @cloudbase/js-sdk
```

修改 `src/utils/cloudbase.ts`：

```typescript
import uniCloud from '@dcloudio/uni-cloud'

// 初始化
const app = uniCloud.init({
  provider: 'tencent',
  spaceId: 'cloud1-d8gqh3f5g49993a5a'
})

export const auth = app.auth()
export const db = app.database()
export const storage = app.uploadFile.bind(app)

// 云函数调用
export const callFunction = app.callFunction.bind(app)

// 移除 localStorage 访问
export async function resetCloudAuthState() {
  await auth.signOut().catch(() => {})
  uni.removeStorageSync('userId')
  uni.removeStorageSync('userEmail')
}
```

**方案 B：保留 CloudBase + 平台适配器**

```typescript
import cloudbase from '@cloudbase/js-sdk'

// #ifdef MP-WEIXIN
import adapter from '@cloudbase/adapter-wx_mp'
cloudbase.useAdapters(adapter)
// #endif

// #ifdef H5
// 默认适配器
// #endif

// #ifdef APP-PLUS
// 使用 HTTP API 或自定义适配器
// #endif

const app = cloudbase.init({ env: ENV_ID })
```

#### 验收标准

- [ ] 登录成功（H5 / 微信小程序 / App）
- [ ] 云函数调用成功
- [ ] 文件上传成功
- [ ] 登录态恢复正常
- [ ] 退出登录正常

---

### P0-2：Canvas 图表统一为 Canvas 2D API

#### 问题分析

`src/components/AssessmentTrendChart.vue:322-342` 混用了新旧两套 Canvas API：

- 新版：`fields({ node: true })` + `canvas.getContext('2d')`
- 旧版：`uni.createCanvasContext('trendCanvas')` + `ctx.draw()`

导致部分平台渲染失败。

#### 修复方案

**步骤 1：模板改用新版 Canvas**

```vue
<!-- 旧 -->
<canvas canvas-id="trendCanvas" ... />

<!-- 新 -->
<canvas type="2d" id="trendCanvas" ... />
```

**步骤 2：统一使用新版 API**

```typescript
onMounted(() => {
  const query = uni.createSelectorQuery()
  query.select('#trendCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res || !res[0]) {
        console.error('Canvas 节点获取失败')
        return
      }
      
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio || 1
      
      canvas.width = canvasWidth.value * dpr
      canvas.height = canvasHeight.value * dpr
      ctx.scale(dpr, dpr)
      
      canvasContext = ctx
      drawChart()
    })
})
```

**步骤 3：移除旧 API 调用**

在 `drawChart()` 函数末尾删除：

```typescript
// 删除这行
// canvasContext.draw()
```

新版 Canvas 2D API 不需要手动调用 `draw()`。

#### 验收标准

- [ ] 微信小程序趋势图正常显示
- [ ] H5 趋势图正常显示
- [ ] App 趋势图正常显示
- [ ] 数据变化时图表能重绘

---

### P0-3：头像上传 H5 兼容

#### 问题分析

`src/components/ProfileAvatarPicker.vue:97` 使用 `uni.getFileSystemManager().readFile()` 读取 base64，但该 API 在 H5 端不存在。

#### 修复方案

**方案 A：条件编译分平台处理（快速修复）**

```typescript
function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]

      // #ifdef H5
      // H5 端：直接使用 tempFilePath（blob URL）
      avatarValue.value = tempFilePath
      uploadError.value = ''
      // #endif

      // #ifndef H5
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

**方案 B：上传到云存储（推荐，彻底解决）**

```typescript
async function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]
      
      uni.showLoading({ title: '上传中...' })
      try {
        // 上传到云存储
        const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
        const fileID = await uploadFile(tempFilePath, cloudPath)
        
        // 保存云文件 ID
        avatarValue.value = fileID
        uploadError.value = ''
        uni.hideLoading()
      } catch (e) {
        uploadError.value = '上传失败'
        uni.hideLoading()
      }
    }
  })
}
```

#### 验收标准

- [ ] H5 端选择头像成功
- [ ] 微信小程序选择头像成功
- [ ] App 端选择头像成功
- [ ] 头像能正常显示

---

### P0-4：微信小程序 appid 配置

#### 修复方案

在微信公众平台注册小程序后，修改 `src/manifest.json:53`：

```json
"mp-weixin": {
  "appid": "wx你的真实appid",
  "setting": {
    "urlCheck": false
  },
  "usingComponents": true
}
```

---

### P1-5：CSS Grid → Flex 布局

#### 问题分析

支付宝小程序不完全支持 CSS Grid，导致布局错乱。

#### 涉及文件

- `src/pages/index/index.vue:552`
- `src/pages/timeline/timeline.vue:522`

#### 修复方案

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
.datetime-row > picker:first-child { 
  flex: 1; 
}
.datetime-row > picker:last-child { 
  width: 220rpx; 
  flex-shrink: 0; 
}
```

---

### P1-6：Android 权限瘦身

#### 问题分析

当前申请了 14 个权限，实际只需要 4 个。

#### 修复方案

修改 `src/manifest.json:25-41`：

```json
"permissions": [
  "<uses-permission android:name=\"android.permission.CAMERA\"/>",
  "<uses-permission android:name=\"android.permission.INTERNET\"/>",
  "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\"/>",
  "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\"/>"
]
```

删除以下高风险权限：
- ❌ `READ_LOGS`（Android 4.1+ 已无效）
- ❌ `READ_PHONE_STATE`（隐私敏感）
- ❌ `GET_ACCOUNTS`（无关业务）
- ❌ `WRITE_SETTINGS`（非常敏感）
- ❌ `MOUNT_UNMOUNT_FILESYSTEMS`（无关业务）
- ❌ `VIBRATE`、`FLASHLIGHT`、`CHANGE_WIFI_STATE` 等（无关业务）

---

### P1-7：localStorage 清理

#### 修复方案

修改 `src/utils/cloudbase.ts:34-37`：

```typescript
// 删除这段代码
// try {
//   if (typeof localStorage !== 'undefined') {
//     localStorage.removeItem(key)
//   }
// } catch {}

// 只保留 uni API
function removeLocalStorageKey(key: string) {
  tr
    uni.removeStorageSync(key)
  } catch {}
}
```

---

### P1-8：tabBar 图标补充

#### 修复方案

**步骤 1：准备图标资源**

在 `src/static/tabbar/` 目录下放置 8 张图片（81×81 px）：

- `home.png` / `home-active.png`
- `new.png` / `new-active.png`
- `cases.png` / `cases-active.png`
- `me.png` / `me-active.png`

**步骤 2：修改 `src/pages.json:84-107`**

```json
"tabBar": {
  "color": "#7A7E83",
  "selectedColor": "#143f3a",
  "borderStyle": "black",
  "backgroundColor": "#ffffff",
  "list": [
    {
      "pagePath": "pages/index/index",
      "text": "首页",
      "iconPath": "static/tabbar/home.png",
      "selectedIconPath": "static/tabbar/home-active.png"
    },
    {
      "pagePath": "pages/new/new",
      "text": "新建",
      "iconPath": "static/tabbar/new.png",
      "selectedIconPath": "static/tabbar/new-active.png"
    },
    {
      "pagePath": "pages/cases/cases",
      "text": "案例",
      "iconPath": "static/tabbar/cases.png",
      "selectedIconPath": "static/tabbar/cases-active.png"
    },
    {
      "pagePath": "pages/me/me",
      "text": "我的",
      "iconPath": "static/tabbar/me.png",
      "selectedIconPath": "static/tabbar/me-active.png"
    }
  ]
}
```

---

## 📅 实施时间表

### 第 1 天（6-8 小时）

**上午（3-4 小时）**
- [ ] P0-1：CloudBase SDK 方案确定 + 开始实施
- [ ] P0-4：填写微信小程序 appid

**下午（3-4 小时）**
- [ ] P0-2：Canvas 图表修复
- [ ] P0-3：头像上传 H5 兼容

### 第 2 天（4-6 小时）

**上午（2-3 小时）**
- [ ] P1-5：CSS Grid → Flex
- [ ] P1-6：Android 权限瘦身
- [ ] P1-7：localStorage 清理

**下午（2-3 小时）**
- [ ] P1-8：tabBar 图标准备和配置
- [ ] P2-9 至 P2-13：轻量优化项批量处理

### 第 3 天（6-8 小时）

**上午（3-4 小时）**
- [ ] 全平台编译验证
  - `npm run dev:h5`
  - `npm run dev:mp-weixin`
  - `npm run dev:mp-alipay`
  - `npm run dev:app`

**下午（3-4 小时）**
- [ ] 真机测试
  - Android 真机
  - 微信开发者工具 + 真机预览
  - iOS 模拟器或真机

### 第 4 天（预留，按需）

- [ ] 修复遗留问题
- [ ] 补充文档
- [ ] 构建环境问题排查（如遇到 `spawn EPERM`）

---

## ✅ 验收清单

### 构建验证

- [ ] H5 可运行（`npm run dev:h5`）
- [ ] 微信小程序可构建（`npm run dev:mp-weixin`）
- [ ] 支付宝小程序可构建（`npm run dev:mp-alipay`）
- [ ] App 可构建（`npm run dev:app`）

### 功能验证（每个平台）

- [ ] 登录/注册正常
- [ ] 案例列表正常
- [ ] 新建案例正常
- [ ] 案例详情正常
- [ ] 时间线正常
- [ ] 评估历史正常
- [ ] 趋势图正常显示
- [ ] 头像上传和显示正常
- [ ] AI 设置正常
- [ ] 云函数调用正常

### 真机验证

- [ ] Android 真机验证（登录、上传、图表）
- [ ] 微信小程序真机预览验证
- [ ] iOS 模拟器或真机验证

---

## ⚠️ 风险提示

### 风险 1：CloudBase 迁移成本

如果选择方案 A（迁移到 uniCloud），需要同步修改云函数层的认证逻辑，工作量可能达到 2-3 天。

**缓解措施**：优先选择方案 B（保留 CloudBase + 适配器），工作量约 1 天。

### 风险 2：构建环境问题

当前存在 `spawn EPERM` 错误，说明构建环境本身有问题（Node 版本、权限、杀毒软件等）。

**缓解措施**：
- 检查 Node.js 版本（建议 16.x 或 18.x）
- 以管理员权限运行命令
- 临时关闭杀毒软件
- 清理 `node_modules` 重新安装

### 风险 3：Canvas 图表替换

如果新版 Canvas 2D API 在某些平台仍有问题，可能需要替换为成熟的图表库（如 uCharts）。

**缓解措施**：预留 4-6 小时用于图表库集成。

---

## 📝 附录：编译命令速查

```bash
# 开发模式
npm run dev:h5                    # H5
npm run dev:mp-weixin             # 微信小程序
npm run dev:mp-alipay             # 支付宝小程序
npm run dev:app                   # App

# 生产构建
npm run build:h5                  # H5
npm run build:mp-weixin           # 微信小程序
npm run build:mp-alipay           # 支付宝小程序
npm run build:app                 # App
```

---

## 🎯 总结

本方案整合了三份分析的优势：

1. **问题识别**：采用 gpt-uniapp-multiend-fix-plan 的细致度
2. **修复方案**：采用 COMPATIBILITY_PLAN 的代码示例
3. **优先级划分**：采用三份方案的共识
4. **工作量评估**：采用 gpt-uniapp-multiend-fix-plan 的时间估算
5. **验收标准**：采用 COMPATIBILITY_PLAN 的详细清单

**核心原则**：
- 保留现有 uni-app 架构，不推翻重做
- 把底层能力改成真正适合多端的写法
- 把高风险组件替换或重构
- 严格按优先级推进，确保每个阶段都有可交付成果

按本方案执行，项目可在 3-4 天内收敛到适合 APK / iOS / 微信小程序交付的状态。
