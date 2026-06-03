# 2026-06-03 工作总结

## 一、TabBar 闪烁彻底修复

- 通过 Console 插桩日志精准定位：`switchTab` 在离开页的 tabBar 实例上执行 `setData({selected})`，污染了不在视野内的实例
- 修复：`switchTab`/`onCrushTap` 删掉 `setData`，只保留 `wx.switchTab` 跳转；高亮完全由目标页的 `updateSelected` + 守卫单向同步
- 连带修复：`SwitchTab` 的 `dataset.idx` 字符串与 `selected` 数字比较 bug（`"2" !== 2`）
- 诊断日志已清，最终版无冗余 setData

## 二、`__usePrivacyCheck__` 调查

- 回滚前冤枉它是闪烁主因 → 日志证明是 TabBar setData 污染实例
- 回滚 `lazyCodeLoading`（导致切页变慢）
- 恢复 App.vue 为 `<script setup>` + 空生命周期钩子（`onLaunch/onShow/onHide` 空体），移除错误的空 `<view>` 模板
- `__usePrivacyCheck__` 加回 pages.json（审核必需），确认不引发 TabBar 闪烁

## 三、新用户引导改版

### 对话式画像（self-profile.vue 重写）
- onboarding 模式：3 轮小咪气泡对话（年龄→性别→身份），全 chips 点选，逐轮推进
- 属相/星座后置为可选（编辑模式保留原版表单）
- 跳过按钮始终可见
- `v-html` → lines 数组（微信小程序不支持 v-html）

### 首页两条路径入口
- `cases.length === 0` 时显示选择卡："开始初评"（完整 AssessmentForm）+ "快速创建"（profileOnly）
- `AssessmentForm` 加 `profileOnly` prop：隐藏问答区、跳过验证、按钮"创建"、answers 为空
- 字段名"工作"→"身份"（placeholder 更新）

### 首页画像不完善提醒
- `showProfileReminder` computed：只要 `!hasUsableSelfProfile` 就显示（不判断 skipped）
- 样式：从黄底大卡片改为一行灰色小字"画像未完善，分析可能不准。去补 →"
- v-if/v-else 链打断 bug 修复：提醒放在两个分支内部而非中间

### 补初评入口（case-detail.vue）
- `v-if="!result"` 时显示绿色卡片"还没有分析结果 →"
- 点击跳 `/pages/reassess/reassess?caseId=xxx`

### register.vue 修复
- 硬编码跳转 self-profile → inline goAfterLogin 三分支（画像不完整→画像 / 完整→首页）

---

**改动统计**：7 个文件修改（self-profile.vue 重写、index.vue、case-detail.vue、AssessmentForm.vue、register.vue、custom-tab-bar、App.vue）。无云函数变更。

## 四、补初评卡片调试 & 风格统一

- case-detail 补评卡片：`!result` → `!result?.intentBucket` → 最终用 `!isCurrentResultAIReviewed`（quick 创建的空 assessment 有默认 intentBucket 但无 AI 分析）
- createCase 云函数分析：即使 answers 为空也调 evaluateAssessment 产生假结果，root cause 定位
- 两张提醒卡片风格统一为标准 V2：白底 + 3rpx #111 黑边框 + section-title-v2（22rpx/900/uppercase）+ 副文（24rpx→22rpx/600/#666）+ "点击前往 →"引导
- index 画像提醒从行内轻提醒 → 标准卡片，去除 isSelfProfileSkipped 条件
- v-if/v-else 链打断 bug 修复（template 中间插入 view 打破条件链）
- routeDone 偶发 → 定位为 dataset.idx 字符串/数字比较 bug，暂不修待观察

## 五、Git 提交

全部改动入库，commit 涵盖 6/2-6/3 所有工作。
