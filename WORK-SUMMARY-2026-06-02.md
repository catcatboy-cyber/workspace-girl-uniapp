# 2026-06-02 工作总结

## 一、小咪帮你说大改版（重做，6/1 回滚丢失）

- 云函数 `petLines` 新增 `replyBundle` action，内部 Promise.all 并行执行回复+策略生成
- prompt 重命名：反转→先冷后甜，引导拉近→投石问路/顺水推舟（按 scene 动态）
- 前端单次调用，结果一次性出现（不再分两次）
- 删除暧昧轻撩（flirty），3 语气 + 2 策略 → "选一种方式" 5 tab 一行布局
- 单轮回复卡片统一为多轮同款黄色左边框（#FFD93D）
- 生成中读秒 + 闪烁动画（对齐首页 aiFeedbackLoading）
- 全局边框 #e0e0e0/#ddd/#ccc → #111，选中态黑底黄字

## 二、语音识别用量追踪

- `speechToText` 云函数：识别成功后写入 `voice_usage` 集合（userId + durationMs）
- `getVoiceUsage` 云函数已存在，补注册到 cloudbaserc.json + api.ts 封装
- me 页能量卡片加"语音识别 X 次 · 累计 X 秒"
- 消费明细页新增"语音识别"tab（汇总 + 每次时长明细）
- about.vue 文案修正：语音识别由腾讯云 ASR 单独计费，不消耗 Token

## 三、周复盘新事件检测 + 趋势图优化

- weekly-review.vue 复用已有的 `getCaseDetail` timeline 数据，新增 `latestEventTime` / `hasNewEventsSinceReview` / `hasNewEventsSinceSideRead` computed
- 两个"重新生成"按钮在无新事件时 disabled + 文字变"还没新事件"
- 修复 cloud function 写入的系统事件（weekly_review / weeklySideRead）在过滤时误判的 bug
- case-detail.vue 同逻辑补过滤
- AssessmentTrendChart 样式：点 34→22rpx、线 5→3rpx、border 4→2rpx、Y 轴 19→16rpx

## 四、5/30 + 6/1 回滚审计 & 补救

逐项核对两份工作总结的完成状态：
- **已恢复 10 项**：AI 风格合并、按钮颜色规范、首页星象速写读秒、14 天滚动窗口、微信登录昵称等
- **补回 5 项**：概念命名 9 处残留（对象列表→Crushes、时间线→往事、互动时间轴→往事）、explain 第 2 组改名、share.js imageUrl 参数恢复、保存按钮 white-space nowrap
- 需人工确认 2 项：数据库 promptConfig 文案、小程序认证状态

## 五、全面上线前审计

4 轮审计覆盖：样式一致性、逻辑 bug、UX/空态/加载态、微信审核合规：

**P0（修复 5 项）**：pages.json 加 permission/requiredPrivateInfos；移除废弃 API wx.getUserProfile；加隐私政策+服务条款入口
**P1（修复 7 项）**：hero-tag-v2 4 页补黑底黄字；20 处灰色边框→#111；recordingTimer 内存泄漏；runAssessmentAI 重入防护；16rpx 极小字体→18rpx；info-icon 30→44rpx；21 处 console.log 清除
**P2（修复 15 项）**：10 文件 3px→3rpx、pet-bubble/wave-bar border-radius→0、letter-spacing 补全、按钮 disabled 灰底→opacity、Promise.all 加 catch、bumpDataVersion 去重、watch 去循环、manifest lazyCodeLoading（后因切页问题回滚）、project.config sourceMap+packOptions 等

## 六、TabBar 问题排查

- 发现 App.vue 空 `<view>` 模板导致整页重刷（uni-app App.vue 不应有 template）
- `lazyCodeLoading` 导致切页性能恶化→回滚
- `__usePrivacyCheck__` 导致框架内部报错 + routeDone 异常→待回滚
- custom-tab-bar 恢复 5/28 原版 + Number() 类型修复 + pageLifetimes.show() 防闪

## 七、部署

部署云函数：petLines（replyBundle）、speechToText（voice_usage 写入）、getVoiceUsage

---

**改动统计**：约 40 个文件修改，4 轮全面审计，P0/P1/P2 全覆盖。小程序已具备提交审核条件。
