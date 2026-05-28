# 小米电子宠物集成方案讨论稿 - 2026-05-21

## 资源判断

`xiaomi/xiaomi` 资源包可以集成进微信小程序。

当前资源结构完整，包含：

- `final/spritesheet.png`
- `final/spritesheet.webp`
- `frames/` 逐帧 PNG
- `frames/frames-manifest.json`
- `pet_request.json`
- `qa/` 预览和校验材料

宠物状态包括：

- `idle`：默认待机
- `waiting`：等待 AI 分析
- `review`：阅读、检查、分析
- `jumping`：成功、开心、好消息
- `failed`：失败、额度不足、风险提醒
- `waving`：欢迎、打招呼
- `running`：处理中
- `running-left`
- `running-right`

## 产品定位

不建议一开始做复杂电子宠物系统。

第一版更适合作为：

**AI 陪伴助手 / 结果播报宠物**

它不替代正式 AI 结果，而是用一句短话把结果变得更有情绪、更像有人陪你看。

正式结果仍然保留：

- 分数
- 风险
- 证据
- 趋势
- 详细建议
- 额度弹窗
- 充值入口

宠物只负责：

- 降低等待焦虑
- 给出一句人话摘要
- 让失败、额度不足、风险升高这些状态更柔和
- 增强产品记忆点

## 推荐资源放置位置

建议放到：

```text
src/static/pets/xiaomi/
```

建议结构：

```text
src/static/pets/xiaomi/
  spritesheet.png
  spritesheet.webp
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

## 技术实现建议

### 第一阶段：逐帧 PNG

第一版建议使用 `frames/` 里的逐帧 PNG。

优点：

- 微信小程序端最稳
- 不依赖 canvas
- 不需要处理 spritesheet 裁切
- 调试简单
- 容易按状态切换

实现方式：

- 建一个组件：`src/components/XiaomiPet.vue`
- 组件接收：
  - `state`
  - `message`
  - `size`
  - `position`
  - `visible`
- 内部用定时器切换当前帧：
  - `idle` 循环
  - `waiting` 循环
  - `review` 循环
  - `jumping` 播放一次后回到 `idle`
  - `failed` 播放一次或短循环

### 第二阶段：spritesheet

等第一版体验稳定后，再考虑切到 `spritesheet.webp/png`。

优点：

- 请求更少
- 性能更好
- 资源管理更干净

缺点：

- 小程序端裁切和适配更麻烦
- 需要处理高清屏、透明背景、帧定位
- 调试成本更高

## 推荐组件设计

组件名：

```text
src/components/XiaomiPet.vue
```

输入示例：

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
```

使用示例：

```vue
<XiaomiPet
  state="review"
  message="他这次有动作，但还要看后续兑现。"
/>
```

## AI 结果是否由宠物说出来

可以，而且效果会更好。

但建议宠物只说一句短摘要，不替代完整 AI 结果。

### 示例文案

即时反馈：

```text
小米：他这次是有动作的，但别急着定义关系，先看下一次会不会继续推进。
```

额度不足：

```text
小米：这次我算不动啦，先补一点额度再继续分析。
```

风险升高：

```text
小米：这里我会先拉你一下，别只看甜的部分，兑现度更重要。
```

周复盘：

```text
小米：这一周不是没进展，是进展还不够稳定。
```

侧写：

```text
小米：这个侧写只能当观察角度，真正要看他接下来怎么做。
```

## 宠物台词来源

### 方案 A：前端规则生成

第一版推荐。

优点：

- 不增加 token 消耗
- 不改云函数返回结构
- 稳定可控
- 快速落地

例子：

- `INSUFFICIENT_BALANCE` → `failed` + “这次我算不动啦，先补一点额度再继续分析。”
- AI 分析中 → `waiting` + “我正在帮你看这条记录。”
- 生成成功 → `jumping` + “分析好啦，我先说重点。”
- 风险升高 → `failed` + “这里要慢一点，别只看甜的部分。”
- 意向升温 → `jumping` + “这次确实比之前更有动作。”

### 方案 B：AI 返回 `petLine`

第二阶段再做。

云函数可以返回：

```json
{
  "petMood": "review",
  "petLine": "他这次有动作，但还要看后续兑现。"
}
```

优点：

- 更自然
- 更贴合具体事件
- 可以体现 AI 人格风格

缺点：

- 增加提示词复杂度
- 可能消耗更多 token
- 需要控制文案长度和风险边界

## 首批建议落地点

第一版只做 3 个场景，不全站铺开。

### 1. 首页快速记录 AI 分析中

触发：

- 用户提交快速记录
- 后台开始生成即时反馈

宠物状态：

- `waiting` 或 `review`

文案：

```text
小米：我正在帮你看这条记录。
```

价值：

- 降低等待焦虑
- 比单纯 loading 更有陪伴感

### 2. 首页即时反馈结果

触发：

- `generateAssessmentAI` 成功返回

宠物状态：

- 意向升温：`jumping`
- 风险升高：`failed`
- 普通结果：`review`

文案：

```text
小米：分析好啦，我先说重点。
```

价值：

- 把 AI 结果从“冷冰冰报告”变成“有人陪你看”

### 3. 额度不足弹窗

触发：

- `INSUFFICIENT_BALANCE`

宠物状态：

- `failed`

文案：

```text
小米：这次我算不动啦，先补一点额度再继续分析。
```

价值：

- 减少充值拦截的生硬感
- 和“去充值”动作自然衔接

## 后续可扩展场景

- 登录成功：`waving`
- 新建对象成功：`jumping`
- 本周复盘生成中：`review`
- 本周侧写生成中：`review`
- AI 接口失败：`failed`
- 没有记录时：首页用 `idle` 提醒“先记一笔”
- 我的页面：显示宠物待机状态，增强账号页亲和力

## 不建议第一版做的事

- 不做完整养成系统。
- 不做喂食、经验、等级、金币。
- 不让宠物挡住主操作按钮。
- 不让宠物替代正式 AI 结果。
- 不把 AI 长文本都塞进气泡。
- 不一开始上 spritesheet/canvas。
- 不全站强制展示，先在 AI 相关场景出现。

## 推荐第一版范围

第一版目标：

**把小米做成 AI 分析状态和结果的一句陪伴式播报。**

最小改动范围：

- 拷贝资源到 `src/static/pets/xiaomi/`
- 新增 `src/components/XiaomiPet.vue`
- 首页快速记录分析中接入
- 首页即时反馈结果接入
- 额度不足处理接入

第一版验收标准：

- 宠物帧动画能稳定播放。
- 不遮挡核心按钮。
- AI 分析中有等待状态。
- AI 成功有一句宠物摘要。
- 额度不足时宠物表现为失败/委屈状态。
- H5 和微信小程序构建通过。

