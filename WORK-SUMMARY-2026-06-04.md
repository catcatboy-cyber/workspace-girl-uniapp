# 2026-06-04 工作总结

## 一、关系类型精简（5 → 2）

- 保留 Crush 和 Friend Crush，删除同事/同学/老师
- 前端 8 个文件 + 云函数 7 个文件的 label map 全部更新
- 新增 QC 专属题：Crush 版"暧昧暗示"、Friend Crush 版"单向利用检测"

## 二、题目精简（24 → 14 选择 + 2 主观）

- 砍掉 12 道冗余/重叠的选择题
- 保留：Q1/Q2/Q3/Q5/Q7/Q9/Q10/Q12/Q13/Q14/Q15/Q17/Q20/QC/T1/T2
- 证据评分简化为 Q20 only（29 个 engine.js 批量更新）
- Friend Crush 差异化覆盖：Q3/Q9/Q10/QC/T1 共 5 处
- 首页文案："回答 8 题"→"回答 14 题"
- createCase timeout：15s → 30s

## 三、T1/T2 主观文本 AI 分析

- 新建 `cloudfunctions/createCase/_shared/ai-text-analyzer.js`
- 用户填写 T1 或 T2 时，AI 从文本中提取信号注入规则评分
- AI 禁用/余额不足/调用失败 → 回退纯规则，不阻塞创建
- createCase 空 answers 跳过评估 — 修复快速创建显示假 50 分

## 四、共享模块同步修复

- 逆向同步：从 createCase/generateAssessmentAI 推回 12 个权威文件到 `_shared/`
- 增强 `scripts/sync-shared.js`：`--dry-run`、文件变更日志
- 向前同步全部 30 个云函数，全量部署
- 加 npm scripts：`sync:shared` / `sync:shared:dry`

## 五、AI rawReply 内容过短诊断

- 加诊断日志发现：AI 只用 336/1400 token（24%），每段只写一句
- 根因：prompt 只说了"用三个标题"，没要求每段长度
- 修复：prompt 加 "MUST contain 2-4 specific, concrete, actionable sentences"

## 六、首页入场动画

- Hero 掉落弹跳（0.7s）：从上方坠落 + 弹两下 + 稳定
- 卡片依次入场（0.4s × 错开 0.1-0.3s）：上滑 + 淡入
- "记上！"按钮脉冲（2s 循环，延迟 1.2s 启动）

## 七、首页 UI 修复

- "画像未完善"→"你的画像未完善"
- "填画像"→"填Crush画像"
- "返回选择"从底部居中 → 顶部左对齐返回箭头
- 主观题提示字大小：22rpx → 20rpx
- 小咪气泡间距：`gap: 16rpx → 28rpx`
- 小咪头像：emoji → 宠物图片

## 八、画像未完善提醒不消失修复

- `showProfileReminder` computed 无 Vue 响应式依赖（直接读 localStorage）
- 改用 `selfProfile` ref + `onShow` 刷新缓存

## 九、tabbar 切换刷新感分析

- 加 [PERF] 打点日志确认 onShow 耗时正常（80-140ms）
- 根因：微信 tab 页懒加载 + 入场动画重播造成视觉刷新感
- 非 tabbar 本身刷新

## 十、其他

- `project.config.json` 加 `"ignoreDevUnusedFiles": false`
- 审计结论：SignalBreakdown 独立组件方案被微信依赖分析器拒绝，需要内联方案（已回滚，待后续处理）
- 审计结论：index.vue 1703 行待拆 composables，纯可维护性问题

---

**改动统计**：已提交 3 个 commit（49f2a32 / ce86fcd / 85de2d4），未提交 4 个文件（动画 + 日志 + 间距 + 画像提醒修复）。云函数全量部署 2 次。
