# 小米宠物研发计划 - 2026-05-22

## 1. 当前工程判断

已有讨论稿：

```text
XIAOMI-PET-INTEGRATION-IDEAS-2026-05-21.md
```

已有资源：

```text
xiaomi/xiaomi/frames/
xiaomi/xiaomi/final/spritesheet.webp
xiaomi/xiaomi/final/validation.json
```

资源校验结果：

- `spritesheet.webp` 尺寸为 `1536x1872`。
- `final/validation.json` 中 `ok: true`。
- `errors: []`。
- `warnings: []`。
- 单元格按 9 个状态行组织，适合后续二期切换 spritesheet。

首页当前可接入点：

- `src/pages/index/index.vue`
- 快速记录模块：`record-block`
- AI 分析中状态：`aiFeedbackLoading`
- 即时反馈结果：`showQuickFeedback`
- 余额不足处理：`handleInsufficientBalance`
- 即时侧写：`generateLatestSideRead`

## 2. 总体技术路线

第一版使用逐帧 PNG：

- 稳定优先。
- 兼容微信小程序。
- 不引入 canvas。
- 不改云函数返回结构。
- 不增加 AI token 消耗。

二期再切换 spritesheet：

- 优化请求数量。
- 统一动画 atlas。
- 需要额外处理裁切、高清屏和小程序适配。

## 3. 文件改动清单

### 新增

```text
src/components/XiaomiPet.vue
src/utils/pet-lines.ts
src/static/pets/xiaomi/manifest.json
src/static/pets/xiaomi/frames/...
```

### 修改

```text
src/pages/index/index.vue
src/utils/api.ts
```

### 可选新增测试

```text
tests/pet-lines.test.cjs
```

如果当前测试体系不适合直接测 TypeScript，可先用构建验证替代。

## 4. 实施阶段

### 阶段 0：资源整理

目标：

- 把已有宠物资源放入前端静态目录。
- 生成适配前端的 manifest。

步骤：

1. 创建目录：

```text
src/static/pets/xiaomi/
```

2. 拷贝资源：

```text
xiaomi/xiaomi/frames/* -> src/static/pets/xiaomi/frames/
```

3. 新增前端 manifest：

```json
{
  "name": "xiaomi",
  "displayName": "小米",
  "basePath": "/static/pets/xiaomi/frames",
  "states": {
    "idle": { "frames": 6, "fps": 6, "loop": true },
    "waiting": { "frames": 6, "fps": 6, "loop": true },
    "review": { "frames": 6, "fps": 6, "loop": true },
    "jumping": { "frames": 5, "fps": 8, "loop": false },
    "failed": { "frames": 8, "fps": 6, "loop": true },
    "waving": { "frames": 4, "fps": 6, "loop": true },
    "running": { "frames": 6, "fps": 8, "loop": true },
    "running-left": { "frames": 8, "fps": 8, "loop": true },
    "running-right": { "frames": 8, "fps": 8, "loop": true }
  }
}
```

注意：

- `frames-manifest.json` 里的路径是原始生成机器路径，不能直接用于前端。
- 前端 manifest 应使用相对静态资源路径。

验收：

- 所有帧图片能被 H5 和小程序构建引用。
- manifest 不包含本机绝对路径。

### 阶段 1：组件开发

目标：

- 实现通用 `XiaomiPet.vue`。

组件 props：

```ts
state?: XiaomiPetState
message?: string
visible?: boolean
size?: 'sm' | 'md' | 'lg'
loop?: boolean
compact?: boolean
```

核心逻辑：

- 根据 `state` 计算帧数组。
- `setInterval` 或等效定时器驱动当前帧。
- `state` 改变时重置帧索引。
- `visible=false`、组件卸载时清理定时器。
- 图片路径格式：

```text
/static/pets/xiaomi/frames/{state}/{frame}.png
```

帧名规则：

```text
00.png
01.png
...
```

样式要求：

- 容器使用横向布局：宠物 + 气泡。
- 移动端气泡最多两行。
- 不使用大面积卡片嵌套。
- 图片尺寸：
  - `sm`: 96rpx
  - `md`: 128rpx
  - `lg`: 168rpx

验收：

- 切换 `state` 时动画正确重启。
- 页面离开后无定时器继续运行。
- 空 `message` 时只显示宠物，不显示空气泡。

### 阶段 2：前端台词规则

目标：

- 新增 `src/utils/pet-lines.ts`，集中管理状态与文案。

建议类型：

```ts
export type PetScene =
  | 'ai_loading'
  | 'ai_success'
  | 'risk'
  | 'positive'
  | 'insufficient_balance'
  | 'side_read_loading'
  | 'side_read_success'
  | 'ai_error'

export type XiaomiPetState =
  | 'idle'
  | 'waiting'
  | 'review'
  | 'jumping'
  | 'failed'
  | 'waving'
  | 'running'
  | 'running-left'
  | 'running-right'

export interface PetPresentation {
  state: XiaomiPetState
  message: string
}
```

建议映射：

```text
ai_loading -> waiting -> 小米：我正在帮你看这条记录。
ai_success -> review -> 小米：分析好啦，我先说重点。
risk -> failed -> 小米：这里要慢一点，别只看甜的部分。
positive -> jumping -> 小米：这次确实比之前更有动作。
insufficient_balance -> failed -> 小米：这次我算不动啦，先补一点额度再继续分析。
side_read_loading -> review -> 小米：我再帮你补一段观察角度。
side_read_success -> jumping -> 小米：侧写好啦，记得只当观察参考。
ai_error -> failed -> 小米：刚刚没看成功，可以稍后再试一次。
```

验收：

- 所有文案长度可控。
- 风险和失败场景语气不轻佻。
- 后续接入云函数 `petLine` 时，只需要替换这个工具层。

### 阶段 3：首页接入

目标：

- 在首页快速记录和即时反馈中使用 `XiaomiPet`。

修改文件：

```text
src/pages/index/index.vue
```

接入点 1：AI 分析中

当前代码：

```vue
<view v-if="aiFeedbackLoading" class="ai-bar">
  <view class="ai-dot"></view>
  <text class="ai-text">后台分析中，已用时 {{ aiFeedbackSeconds }} 秒</text>
</view>
```

建议改为：

- 保留秒数。
- 在 `ai-bar` 内或下方加入 `XiaomiPet`。
- 使用 `getPetPresentation('ai_loading')`。

接入点 2：即时反馈结果

当前反馈模块：

```vue
<view v-if="showQuickFeedback && latestCase.latestResult && latestTrend" ...>
```

建议：

- 在反馈标题下方或判断依据上方加入宠物播报。
- 根据结果类型选择 `risk`、`positive`、`ai_success`。

接入点 3：即时侧写

当前函数：

```ts
async function generateLatestSideRead()
```

建议：

- `sideReadLoading = true` 时显示 `side_read_loading`。
- 成功后短暂显示 `side_read_success`，或在侧写区域显示。
- 余额不足时走统一失败态。

验收：

- 首页快速记录、反馈、侧写三个区域不出现布局重叠。
- 宠物不影响原有按钮 disabled 逻辑。
- `showQuickFeedback` 的现有判断不被改坏。

### 阶段 4：余额不足联动

目标：

- AI 返回额度不足时，页面先显示宠物失败态，再保留原 modal。

当前通用逻辑：

```ts
handleInsufficientBalance(result)
```

方案 A：页面内处理，侵入最小

在 `runAssessmentAI` 和 `generateLatestSideRead` 中：

```ts
if (aiRes?.code === 'INSUFFICIENT_BALANCE') {
  setPetPresentation('insufficient_balance')
  handleInsufficientBalance(aiRes)
  return
}
```

优点：

- 不改 `handleInsufficientBalance` API。
- 不影响其他页面。

方案 B：扩展通用函数

```ts
handleInsufficientBalance(result, {
  onBeforeModal: () => setPetPresentation('insufficient_balance')
})
```

优点：

- 后续其他页面可复用。

第一版建议：

- 先用方案 A，避免扩大影响面。

验收：

- 余额不足 modal 仍正常跳转 `/pages/token-recharge/token-recharge`。
- 宠物失败态不会因 `finally` 立刻消失，至少可见 1.5 秒或保留到用户操作。

### 阶段 5：构建与人工验证

命令：

```text
npm.cmd run build:h5
npm.cmd run build:mp-weixin
```

人工验证清单：

- 首页首次加载正常。
- 无 case 时不显示无意义宠物。
- 快速记录为空仍提示“请填写描述”，不触发宠物分析态。
- 快速记录成功且 AI 分析中，宠物显示 waiting/review。
- 即时反馈成功，宠物显示 review/jumping/failed。
- 风险结果显示 failed。
- 额度不足显示 failed 并弹充值 modal。
- 点击“去充值”跳转正确。
- 离开首页再回来，动画不叠加加速。

## 5. 推荐排期

### P0：第一版可上线范围，0.5-1 天

- 资源整理到 `src/static/pets/xiaomi/`。
- 新增 `XiaomiPet.vue`。
- 新增 `pet-lines.ts`。
- 首页 AI 分析中接入。
- 首页即时反馈结果接入。
- 首页额度不足接入。
- H5 和微信小程序构建验证。

### P1：体验补强，0.5 天

- 即时侧写 loading/success 接入。
- 气泡文案按结果类型细化。
- 加入用户关闭宠物的本地开关。
- 增加基础测试或最小工具函数测试。

### P2：性能优化，1 天

- 从逐帧 PNG 切换到 `spritesheet.webp`。
- 实现基于 atlas row/column 的裁切显示。
- 对微信小程序端做真实设备验证。

### P3：AI 个性化播报，1-2 天

- 云函数返回 `petMood` 和 `petLine`。
- 后台提示词配置中加入宠物播报约束。
- 加长度、风险边界、敏感话术兜底。

## 6. 风险与处理

### 风险 1：资源体积增加

处理：

- 第一版只拷贝需要状态的 frames。
- 如包体明显增加，优先只接入 `idle`、`waiting`、`review`、`jumping`、`failed`。
- 二期改用 spritesheet。

### 风险 2：小程序静态资源路径异常

处理：

- 避免动态 require。
- 使用稳定字符串路径。
- 构建后检查 `dist/build/mp-weixin/static/pets/xiaomi/`。

### 风险 3：动画定时器泄漏

处理：

- 组件 `onUnmounted` 清理。
- `visible=false` 停止计时器。
- `state` 变化先清理再重启。

### 风险 4：宠物弱化严肃风险提醒

处理：

- 风险文案保持明确提醒。
- 风险结果使用 `failed` 或 `review`，不使用 `jumping`。
- 正式风险卡片仍保持原展示层级。

### 风险 5：首页视觉过载

处理：

- 只在 AI 相关状态展示。
- 不常驻悬浮。
- 不放在主按钮上方遮挡操作。

## 7. 建议提交拆分

### Commit 1：资源与组件

```text
add xiaomi pet assets and component
```

包含：

- `src/static/pets/xiaomi/`
- `src/components/XiaomiPet.vue`

### Commit 2：首页接入

```text
integrate xiaomi pet with ai feedback states
```

包含：

- `src/pages/index/index.vue`
- `src/utils/pet-lines.ts`

### Commit 3：文档

```text
document xiaomi pet prd and development plan
```

包含：

- `XIAOMI-PET-PRD-2026-05-22.md`
- `XIAOMI-PET-DEVELOPMENT-PLAN-2026-05-22.md`

## 8. 第一版 Definition of Done

- PRD 范围内 3 个核心场景完成。
- H5 构建通过。
- 微信小程序构建通过。
- 首页人工验证通过。
- 资源路径不依赖本机绝对路径。
- 宠物组件无明显定时器泄漏。
- 额度不足原充值链路不回退。
