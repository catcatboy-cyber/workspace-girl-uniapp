# AI 分析空跑审计报告

**日期**：2026-07-11
**症状**：切换 crush 后回到首页，宠物异常显示"正在分析记录"，抚摸无响应。过一会恢复——疑似 AI 分析被错误触发。

---

## 根因

**`maybeResumePendingAssessmentAI` 无条件恢复任何 `aiPending: true` 的历史评估，无论它是否已过期或已失败多次。**

---

## 漏洞链追踪

当切换 crush 后回到首页，触发路径如下：

```
onShow (activeChanged=true)
  → loadData()
    → getCases()  返回 crush B 的数据
    → applyCasesList()
    → maybeResumePendingAssessmentAI('loadData')   ← 漏洞入口
      → getPendingAssessmentPayload()  检查 latestCase.latestResult.aiPending
      → 若 aiPending===true → runAssessmentAI()
        → applyPetScene('ai_loading')   ← 宠物显示"正在分析"
        → generateAssessmentAI()        ← 实际触发云端 AI 调用
```

---

## 四个具体漏洞

### 漏洞 1（严重）：`createTimeline` 永远返回 `aiPending: true`

**位置**：`cloudfunctions/createTimeline/index.js:316-340`

```javascript
const aiUsed = false  // 硬编码为 false
const pendingAssessment = {
    aiUsed: false,
    aiPending: true,  // 始终为 true
    // ...
}
```

**每次**创建记录都会写入一个 `aiPending: true` 的评估文档。即使事件理解阶段未使用 AI（`usedAI: false`），仍需额外调用 `generateAssessmentAI` 来完成意向/风险评分。

**影响**：每一条记录 = 两次云函数调用（`createTimeline` + `generateAssessmentAI`）。如果 `generateAssessmentAI` 被中断，`aiPending` 永远卡住。

---

### 漏洞 2（严重）：`generateAssessmentAI` 失败时 `aiPending` 永久卡住

**位置**：`cloudfunctions/generateAssessmentAI/index.js:510-516`

```javascript
} catch (error) {
    // ❌ 直接返回失败，不更新 assessment
    return { success: false, message: mapError(error) }
}
```

对比成功路径（line 175-184）：

```javascript
function buildAssessmentUpdate(recalculated) {
  const update = {}
  // ...
  update.aiPending = false    // ✅ 成功时正确清除
  update.aiFailed = Boolean(recalculated.aiFailed)
  return update
}
```

**函数抛异常时不更新数据库**，`aiPending` 永久停留 `true`。后续每次加载这个 crush 的数据，前端都会重试 `generateAssessmentAI`。

---

### 漏洞 3（中等）：重试计数器只存在内存中

**位置**：`src/pages/index/index.vue:486-487,2028-2032`

```javascript
const pendingAIRetryCounts = new Map<string, number>()  // 内存 Map

const retryCount = pendingAIRetryCounts.get(key) || 0
if (retryCount >= 2) return  // 每个 session 只重试 2 次
```

页面卸载后 Map 丢失。下次进入时计数器归零，又是 2 次重试。**如果 `aiPending` 卡住（漏洞 2），理论上每个 session 重试 2 次，无限循环。**

---

### 漏洞 4（次要）：`justRecorded` 可能跨 session 残留

**位置**：`src/utils/api.ts:669` + `src/pages/index/index.vue:1430-1440`

- `createTimeline` 成功时写入 `uni.setStorageSync('justRecorded', true)`
- 只在 `onShow` 中消费并移除

若在同一次页面会话中创建了记录（`onShow` 没再次触发），flag 会残留到下次进入首页。导致宠物**先**闪"记上了"动画，**再**被 `ai_loading` 覆盖——用户看到的就是"正在分析记录"。

---

## 用户遭遇的完整时序

```
1. 用户之前给 crush B 创建过记录
2. createTimeline → assessment{aiPending:true}
3. generateAssessmentAI 被调用但失败（网络/超时/异常）
4. aiPending 永久卡在 true               ← 根因（漏洞 2）
5. 用户切到 crush A，继续使用
6. 切回 crush B → onShow → loadData()
7. getCases 返回 crush B 数据，latestResult.aiPending = true
8. maybeResumePendingAssessmentAI → runAssessmentAI
9. applyPetScene('ai_loading') → 宠物显示"正在分析"，抚摸无响应
10. generateAssessmentAI 重新运行（可能这次成功）
11. 完成后 loadData() → aiPending=false → 宠物恢复
```

---

## 修复建议

| 优先级 | 修复 | 位置 |
|--------|------|------|
| **P0** | `generateAssessmentAI` 错误路径也要更新 DB，设 `aiPending: false, aiFailed: true` | 云函数 catch 块 |
| **P1** | `maybeResumePendingAssessmentAI` 加时间门禁：若 `createdAt` 超过 10 分钟，跳过并清理 | 前端 `index.vue` |
| **P1** | 重试计数器持久化到 storage，跨 session 累计 max 3 次 | 前端 `index.vue` |
| **P2** | `justRecorded` 加 TTL（5 分钟内有效），过期自动清除 | `api.ts` + `index.vue` |

---

## 相关文件

| 文件 | 角色 |
|------|------|
| `src/pages/index/index.vue` | `maybeResumePendingAssessmentAI`、`runAssessmentAI`、`onShow` |
| `src/utils/api.ts` | `createTimeline` 设置 `justRecorded` |
| `cloudfunctions/createTimeline/index.js` | 始终写入 `aiPending: true` |
| `cloudfunctions/generateAssessmentAI/index.js` | 错误路径不更新 `aiPending` |
