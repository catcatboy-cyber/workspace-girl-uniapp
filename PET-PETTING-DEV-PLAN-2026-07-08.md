# 宠物抚摸交互方案 — 开发计划

## 设计目标

一个触摸目标，承载两种意图：

| 意图 | 触发 | 反馈 |
|------|------|------|
| 🐾 抚摸/逗宠 | 单击（< 300ms） | 宠物反应动画 + 飘心 |
| 💬 打开功能 | 点浮出按钮 | 弹出半屏面板 |

---

## 一、交互规格

### 完整交互流程

```
用户看到宠物（idle 动画）
        │
        ├─ 单击宠物 ──→ 宠物做 reaction 动画 + ❤️ 飘出
        │               + 头顶浮出 💬 📊 两个小按钮
        │                     │
        │                     ├─ 点 💬 → 打开 PetSpeakSheet（聊天模式）
        │                     ├─ 点 📊 → 打开宠物状态面板（未来）
        │                     ├─ 点别处 → 按钮 3s 后自动消失
        │                     └─ 再点宠物 → 又一个 reaction，按钮刷新计时
        │
        ├─ 快速连戳 3 次 ──→ 宠物跳起 + ❤️❤️❤️ 爱心雨（彩蛋）
        │
        └─ 长按（≥ 500ms）──→ 直接打开 PetSpeakSheet（老用户的快速通道）
```

### 计时规则

| 事件 | 说明 |
|------|------|
| 单击判定 | touchstart → touchend < 300ms |
| 连戳计数 | 每次单击间隔 < 400ms 累计，≥ 400ms 重置 |
| 连戳 3 次 | 触发爱心雨彩蛋，计数器归零 |
| 按钮浮现 | 每次单击后出现，3s 无操作自动消失 |
| 长按判定 | ≥ 500ms，直接弹面板（跳过按钮） |

---

## 二、宠物反应库

基于现有 9 行动画状态，无需新美术资源：

| 触发 | 动画 | 气泡文案（示例） | 粒子 |
|------|------|-----------------|------|
| 第 1 次单击 | `waving` | "喵~ 来啦" | ❤️ ×1 |
| 第 2 次单击 | `jumping` | "嘻嘻" | ❤️ ×1 |
| 第 3 次单击（彩蛋） | `jumping` + `review` 交替 2s | "别戳啦！好痒！" | ❤️❤️❤️ ×8 |
| 第 4+ 次单击 | `running` | "你戳上瘾了是吧" | ❤️ ×1 |
| 长按 | `waiting` | — | 无 |

### 反应文案轮换

每种触发配 3-4 条候选文案，随机抽取，避免重复：

```js
const PET_REACTIONS = {
  tap1: [
    '喵~ 来啦',
    '嗯？叫我吗',
    '嗨～又见面了',
    '今天怎么样了？'
  ],
  tap2: [
    '嘻嘻',
    '哈哈好痒',
    '你喜欢戳我啊',
    '再来一次？'
  ],
  tap3: [
    '别戳啦！好痒！',
    '啊啊啊你戳到我的笑穴了',
    '我要告诉其他小咪！'
  ],
  tap4plus: [
    '你戳上瘾了是吧',
    '喵生艰难…',
    '戳一次十块钱',
    '我已经麻了'
  ],
  longPress: [
    '说吧，我听着',
    '想聊什么？'
  ]
}
```

---

## 三、❤️ 飘心粒子

纯 CSS 动画，不需要额外资源文件：

```
规则：
  - 单击 → 1 颗心，从宠物中心向上飘 80-120rpx，1.5s 内 opacity 1→0
  - 彩蛋 → 8 颗心，随机大小（16-24rpx），随机偏移 ±60rpx，错开飘动
  - 每颗心独立 translateY + opacity transition
  - 动画结束后从 DOM 移除
```

实现：在 `pet-sprite-viewport` 内叠加一个 `<view class="hearts-layer">`，点击时动态插入 `<text class="heart-particle">❤️</text>`，CSS transition 驱动动画。

---

## 四、浮出按钮

### 视觉规格

```
       ┌─────────┐
       │  宠物    │
       │  区域    │
       └────┬────┘
        💬  │  📊
    聊天    │  状态
```

- 按钮：40rpx 圆形，白底 + 3rpx 黑边 + 硬阴影
- emoji 图标：💬（聊天）、📊（状态），字号 20rpx
- 按钮下方 4rpx 文字标签：字号 `$fs-caption` (24rpx)
- 位置：宠物 viewport 上方外侧，水平居中排列
- 间距：按钮之间 16rpx
- 动画：`opacity 0→1 + translateY(-8rpx → 0)`，200ms ease-out

### 行为

- 单击宠物后出现
- 3s 内无操作自动消失（opacity 0，200ms）
- 点宠物刷新计时
- 点按钮 → 执行功能 + 按钮消失
- 点页面其他地方 → 按钮消失

---

## 五、实现文件与改动清单

### 改动文件

| 文件 | 改动内容 | 改动量 |
|------|---------|--------|
| `src/pages/index/index.vue` | 宠物 bar 交互重写：tap/longpress/连戳检测、反应系统、按钮浮层、飘心粒子 | ~100 行 |
| `src/components/PetSpeakSheet.vue` | 无结构改动（后续聊天改造时重写，本次仅确保调用方式不变） | 0 |
| 新增 SCSS | 飘心动画、按钮浮层样式 | ~60 行 |

### 不需要动

- `src/utils/pets.js` — 动画状态已全覆盖
- PetSpeakSheet — 本次不改
- 云函数 — 纯前端交互，不涉及后端

---

## 六、核心代码结构

### index.vue 新增状态

```ts
// 抚摸交互
const petTapCount = ref(0)
const petTapTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const showPetActions = ref(false)
const petActionsTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const petReactionMsg = ref('')
const hearts = ref<{ id: number; x: number; y: number; size: number; delay: number }[]>([])
let heartIdCounter = 0

// 触摸计时
let touchStartTime = 0
let longPressTimer: ReturnType<typeof setTimeout> | null = null
```

### 触摸处理

```ts
function onPetTouchStart() {
  touchStartTime = Date.now()
  longPressTimer = setTimeout(() => {
    // 长按 → 直接打开面板
    openSpeakSheet()
    resetPetInteraction()
  }, 500)
}

function onPetTouchEnd() {
  const duration = Date.now() - touchStartTime
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  if (duration >= 500) return  // 长按已处理

  // 单击逻辑
  if (petTapTimer.value) { clearTimeout(petTapTimer.value) }
  petTapCount.value++
  
  if (petTapCount.value >= 3) {
    spawnHeartRain()          // 彩蛋
    showPetReaction('tap3')
    petTapCount.value = 0
    petTapTimer.value = null
  } else {
    showPetReaction(`tap${petTapCount.value}`)
    spawnHeart()
    petTapTimer.value = setTimeout(() => { petTapCount.value = 0 }, 400)
  }

  // 浮现按钮
  showPetActions.value = true
  if (petActionsTimer.value) clearTimeout(petActionsTimer.value)
  petActionsTimer.value = setTimeout(() => { showPetActions.value = false }, 3000)
}

function resetPetInteraction() {
  petTapCount.value = 0
  showPetActions.value = false
  if (petTapTimer.value) clearTimeout(petTapTimer.value)
  if (petActionsTimer.value) clearTimeout(petActionsTimer.value)
}
```

### 模板改动

```html
<!-- Pet bar 重写 -->
<view v-if="showPetBar" class="pet-bar">
  <!-- 浮出按钮 -->
  <view v-if="showPetActions" class="pet-action-buttons">
    <view class="pet-action-btn" @click.stop="openSpeakSheet">
      <text class="pet-action-icon">💬</text>
      <text class="pet-action-label">聊天</text>
    </view>
    <!-- 成长状态按钮（宠物成长功能上线后启用） -->
    <!-- <view class="pet-action-btn" @click.stop="openPetStatus">
      <text class="pet-action-icon">📊</text>
      <text class="pet-action-label">状态</text>
    </view> -->
  </view>
  
  <!-- 宠物本体 -->
  <view class="pet-sprite-viewport"
    @touchstart="onPetTouchStart"
    @touchend="onPetTouchEnd"
  >
    <!-- 飘心粒子层 -->
    <view class="hearts-layer">
      <text v-for="h in hearts" :key="h.id"
        class="heart-particle"
        :style="{ left: h.x + 'px', top: h.y + 'px', fontSize: h.size + 'rpx', animationDelay: h.delay + 'ms' }"
      >❤️</text>
    </view>
    <image v-if="resolvedSpritesheetPath" ... />
    <image v-else ... />
  </view>
  
  <!-- 反应气泡 -->
  <view v-if="petReactionMsg" class="pet-bubble reaction">
    <text class="pet-bubble-text">{{ petReactionMsg }}</text>
  </view>
  <!-- 普通消息气泡（与反应气泡互斥） -->
  <view v-else-if="petMsg" class="pet-bubble">
    <text class="pet-bubble-text">{{ petMsg }}</text>
  </view>
</view>
```

---

## 七、与现有系统的兼容

| 现有功能 | 兼容方式 |
|---------|---------|
| `applyPetScene()` 临时场景 | 抚摸动画只在 idle 状态时触发。如果 `petScene` 非 null（AI 加载中/余额不足等），单击不触发 reaction，保留 scene 动画 |
| `petMsg` 普通消息气泡 | 反应气泡有更高优先级，反应消失后恢复 petMsg |
| PetSpeakSheet 弹窗 | 浮出按钮的 💬 和长按都调用 `showSpeakSheet = true`，内部逻辑不变 |
| 多端（H5 / 小程序） | `@touchstart` / `@touchend` 在两端均支持；小程序端 `@longpress` 是原生事件也可以兜底 |

---

## 八、实施顺序

1. **index.vue script**：新增抚摸状态 + 触摸处理函数 + 反应文案库 + 飘心生成逻辑
2. **index.vue template**：宠物 bar 区域改写（浮出按钮 + 飘心层 + 事件绑定）
3. **index.vue style**：新增 `.pet-action-buttons`、`.heart-particle`、`.reaction` 样式
4. **本地测试**：单击 / 连戳 / 长按 / 点击按钮 / 按钮超时消失 / 与现有 AI 场景动画不冲突
5. **构建验证**：`npm run build:h5` + `npm run build:mp-weixin`

---

## 九、验证清单

- [ ] 单击宠物 → waving 动画 + 1 颗 ❤️ 飘出 + 💬 按钮浮现
- [ ] 再点一次（400ms 内）→ jumping 动画 + 1 颗 ❤️ + 按钮保持可见
- [ ] 连戳 3 次 → jumping/review 交替 + 8 颗 ❤️ 爱心雨 + 彩蛋文案
- [ ] 长按 500ms → 直接打开 PetSpeakSheet，跳过按钮
- [ ] 点 💬 按钮 → 打开 PetSpeakSheet
- [ ] 按钮浮现后 3s 不操作 → 自动消失
- [ ] AI 加载中（`petScene === 'ai_loading'`）→ 单击不打断
- [ ] H5 + 微信小程序均正常
