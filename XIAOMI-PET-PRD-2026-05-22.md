# 小米宠物 PRD - 2026-05-22

## 1. 背景

当前产品已经具备 AI 即时反馈、周复盘、侧写、额度校验等能力，但 AI 过程和结果仍偏“工具报告”体验。用户在等待 AI 分析、看到风险提醒、遇到额度不足时，容易感到生硬或焦虑。

已有 `xiaomi/xiaomi` 宠物资源包，可直接用于小程序和 H5 第一版集成。资源包含逐帧 PNG、spritesheet、manifest 和 QA 校验材料，`final/validation.json` 显示 spritesheet 校验通过，无 errors/warnings。

第一版不做完整电子宠物养成系统，而是把“小米”定义为：

**AI 陪伴助手 / 结果播报宠物**

## 2. 产品目标

### 核心目标

- 降低 AI 分析等待过程的焦虑感。
- 让即时反馈、风险提醒、额度不足等状态更柔和。
- 用一句短话帮助用户先抓住 AI 结果重点。
- 建立产品记忆点，但不干扰主流程。

### 非目标

- 不做喂食、等级、经验、金币等养成系统。
- 不做宠物商店、换装、皮肤。
- 不让宠物替代正式 AI 结果。
- 不把 AI 长文本放进宠物气泡。
- 不全站强制展示。
- 第一版不接入 AI 生成宠物台词，先用前端规则。

## 3. 用户价值

### 快速记录用户

用户提交一条记录后，宠物以等待/分析状态出现，告诉用户“正在帮你看”，替代单纯 loading。

### 查看即时反馈用户

AI 返回后，宠物用一句短摘要引导用户先看重点，正式分析仍在原卡片中展示。

### 额度不足用户

遇到 `INSUFFICIENT_BALANCE` 时，宠物以失败/委屈状态出现，配合充值弹窗降低拦截感。

## 4. 第一版范围

### 场景 1：首页快速记录 AI 分析中

触发条件：

- 用户点击“记一笔”。
- `createTimeline` 返回 `aiPending`，前端开始调用 `generateAssessmentAI`。
- 当前 `aiFeedbackLoading = true`。

宠物状态：

- `waiting` 或 `review`。

推荐文案：

```text
小米：我正在帮你看这条记录。
```

展示位置：

- 首页快速记录模块下方，替代或增强现有“后台分析中，已用时 X 秒”的提示。

验收：

- AI 分析中宠物动画循环播放。
- 秒数仍保留或不影响用户理解等待状态。
- 不遮挡输入框、按钮和反馈卡片。

### 场景 2：首页即时反馈结果播报

触发条件：

- `generateAssessmentAI` 成功返回。
- 首页出现 `showQuickFeedback`。

宠物状态映射：

- 风险类结果：`failed`
- 明显升温/正向结果：`jumping`
- 普通结果：`review`

第一版规则建议：

- `latestFeedbackEventType === 'risk'` -> `failed`
- `latestTrend.direction === 'up'` 或意向分上升 -> `jumping`
- 其他 -> `review`

推荐文案：

```text
小米：分析好啦，我先说重点。
```

可选补充文案：

```text
小米：这里要慢一点，别只看甜的部分。
小米：这次确实比之前更有动作。
小米：先看事实，再看后续会不会兑现。
```

验收：

- 成功返回后出现宠物播报。
- 风险结果不使用开心状态。
- 宠物气泡不超过两行，长文本截断或换行正常。

### 场景 3：额度不足

触发条件：

- 任一 AI 调用返回 `code === 'INSUFFICIENT_BALANCE'`。
- 第一版至少覆盖首页即时反馈和首页即时侧写。

宠物状态：

- `failed`

推荐文案：

```text
小米：这次我算不动啦，先补一点额度再继续分析。
```

展示方式：

- 先在当前页面设置宠物状态和文案，再调用现有 `handleInsufficientBalance` 弹窗。
- 保留原充值弹窗和“去充值”按钮。

验收：

- 额度不足时仍能正常弹出充值引导。
- 宠物文案不替代余额、消耗 token 等关键信息。

## 5. 组件需求

组件名：

```text
src/components/XiaomiPet.vue
```

输入属性：

```ts
type XiaomiPetState =
  | 'idle'
  | 'waiting'
  | 'review'
  | 'jumping'
  | 'failed'
  | 'waving'
  | 'running'
  | 'running-left'
  | 'running-right'

interface XiaomiPetProps {
  state?: XiaomiPetState
  message?: string
  visible?: boolean
  size?: 'sm' | 'md' | 'lg'
  loop?: boolean
  compact?: boolean
}
```

第一版默认值：

- `state`: `idle`
- `visible`: `true`
- `size`: `md`
- `loop`: `true`
- `compact`: `false`

组件行为：

- 根据 `state` 读取对应帧列表。
- 使用定时器循环切换当前帧。
- `jumping` 可播放一次后回到 `idle` 或由父组件继续控制。
- 组件销毁时清理定时器。
- `visible=false` 时不渲染动画，不保留定时器。

## 6. 资源需求

第一版使用逐帧 PNG，资源放置：

```text
src/static/pets/xiaomi/
  manifest.json
  frames/
    idle/
    waiting/
    review/
    jumping/
    failed/
    waving/
    running/
    running-left/
    running-right/
```

资源来源：

```text
xiaomi/xiaomi/frames/
xiaomi/xiaomi/frames/frames-manifest.json
```

第一版暂不使用：

```text
xiaomi/xiaomi/final/spritesheet.webp
xiaomi/xiaomi/final/spritesheet.png
```

原因：

- 逐帧 PNG 在微信小程序端更稳。
- 不需要 canvas 裁切。
- 更容易定位资源路径和动画问题。

## 7. 文案规则

第一版文案由前端规则生成，不增加 token 消耗。

建议新增：

```text
src/utils/pet-lines.ts
```

核心方法：

```ts
getPetPresentation(context): {
  state: XiaomiPetState
  message: string
}
```

上下文类型：

- `ai_loading`
- `ai_success`
- `risk`
- `positive`
- `insufficient_balance`
- `side_read_loading`
- `side_read_success`
- `ai_error`

文案原则：

- 一句短话，最多 24 个中文字符左右。
- 语气陪伴但不替用户下结论。
- 风险场景不卖萌化问题严重性。
- 额度不足不弱化充值信息。

## 8. 体验约束

- 宠物不能遮挡主按钮、输入框、充值入口。
- 宠物不使用浮层强打断，第一版嵌入在 AI 相关模块内。
- 气泡文案最多两行。
- 动画尺寸在移动端不超过主要内容宽度的 35%。
- 首页已有强视觉风格，宠物容器应保持克制，不再增加厚重卡片嵌套。

## 9. 数据与埋点

第一版不新增后端数据结构。

建议埋点事件：

- `pet_shown`
- `pet_state_changed`
- `pet_balance_block_shown`
- `pet_feedback_shown`

事件字段：

- `scene`
- `state`
- `caseId`
- `resultType`
- `hasMessage`

如果当前项目暂无统一埋点机制，第一版可先不实现埋点，但保留代码扩展点。

## 10. 成功指标

定量指标：

- AI 分析中页面停留无异常下降。
- 额度不足弹窗取消率不因宠物接入上升。
- 首页即时反馈生成链路错误率不增加。

定性指标：

- 用户能理解宠物是在辅助播报，而不是正式结论。
- 宠物出现时不影响快速记录效率。
- 风险提醒仍然清晰严肃。

## 11. 验收标准

- H5 构建通过。
- 微信小程序构建通过。
- 首页快速记录 AI 分析中显示宠物等待状态。
- 首页即时反馈成功后显示宠物结果播报。
- 额度不足时显示失败状态，并保留充值弹窗。
- 宠物动画能稳定循环，无明显闪烁。
- 页面滚动、输入、按钮点击不受影响。
- 组件卸载后无定时器泄漏。

## 12. 二期方向

- 切换到 spritesheet/webp，减少资源请求数量。
- 云函数返回 `petLine` 和 `petMood`，让宠物台词更贴合具体事件。
- 周复盘、侧写、登录成功、新建对象成功等更多场景接入。
- 增加用户开关：是否显示小米陪伴助手。
- 增加“我的页面”待机状态，但仍不做养成系统。
