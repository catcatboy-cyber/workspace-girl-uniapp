# 邀请奖励异步结算统一修复计划

> 状态：**代码与后端已实施；当前处于单环境每分钟触发测试期**
> 审计日期：2026-08-01
> 实施日期：2026-08-02
> 最近核验：2026-08-05。`npm run test:referral`：19 passed；H5 与微信小程序生产构建通过。CloudBase 业务云函数、worker、索引和一分钟定时触发器已部署；小程序上传、审核和发布状态尚未确认。

---

## 0. 最终结论与不可变更的产品决策

### 0.1 已确认 CloudBase 支持事务，但事务不得位于用户主链路

CloudBase 官方文档已确认：

- 文档型数据库支持 ACID 事务，可跨多个文档、多个集合操作。
- 事务目前只支持服务端运行，只有 Node SDK 支持。
- 支持 `startTransaction/commit/rollback/runTransaction`。
- 单事务最多 100 个操作，执行时间不得超过 30 秒。
- 事务内只支持 `doc` 单文档操作，不支持 `where`。
- 修改文档会持有锁；无法获得锁时事务会因写冲突终止。
- 官方明确建议避免长事务、外部 API 调用和复杂计算。

官方依据：

- [CloudBase 数据库事务](https://docs.cloudbase.net/database/transaction)
- [CloudBase 云函数定时触发器](https://docs.cloudbase.net/cloud-function/timer-trigger)

仓库安装的 `@cloudbase/node-sdk` 类型也包含 `startTransaction()` 和 `runTransaction(callback, times?)`，现有 `cloudfunctions/createTimeline/index.js` 已使用 `db.startTransaction()`。

2026-08-01 已通过只读命令 `npx tcb env detail --env-id cloud1-d0gvhqu2c8a2b61fd --json` 核实当前目标环境：环境、数据库和云函数地域均为 `ap-shanghai`，环境状态为 `NORMAL`。这与官方事务页标注的支持地域“上海”一致。因此不是仅凭 SDK 类型推断，当前目标环境具备使用该服务端事务方案的地域前提。

因此最终技术决策是：

1. **注册、登录、兑换邀请码、创建首条事件不得在线结算奖励。**
2. **主链路不等待邀请奖励事务，不向用户返回事务成功或失败。**
3. 主链路只保存本来就应保存的业务事实；定时云函数异步扫描这些事实并结算。
4. 奖励事务只允许在后台 worker 或管理员补偿动作中执行。
5. 后台每次只处理一个 claim 的固定文档，事务内禁止 `where`、外部调用、循环查询和 AI 调用。
6. 事务失败不影响注册、登录或事件创建；后台稍后重试，最终仍失败则等待申诉后人工补偿。
7. 用户端不得显示“邀请奖励事务失败”“结算失败”“系统异常”等提示。

### 0.2 业务优先级

邀请奖励是旁路权益，不是注册、登录、创建记录的成功条件。允许以下最终一致性：

```text
注册/兑换邀请码/首次事件成功
  -> 数据库留下可恢复的邀请事实
  -> 用户立即获得主业务成功响应
  -> 定时 worker 稍后处理
  -> 成功：奖励到账
  -> 失败：后台重试或进入人工处理；用户主业务不受影响
```

可以接受奖励延迟，也可以接受极少数奖励需要人工补发；不能接受奖励系统拖慢或打断主系统。

### 0.3 其他固定决策

1. 一个被邀请人最多绑定一个邀请人，claim 主键固定为被邀请人 ID。
2. 不做模糊归因：原始链接没有邀请码时，不根据 `shareId`、设备、时间、昵称猜邀请人。
3. 双方奖励流水使用固定 ID，防止定时器重复、并发或人工重试造成双发。
4. `requireFirstEvent` 仍有效，但无论 true/false 都由后台 worker 发奖。
5. `enabled` 控制是否接受新邀请；`payoutPaused` 只暂停后台发奖，不影响主业务。
6. 周上限按北京时间周一 00:00 计算。
7. 分享邀请码缓存必须按 `userId` 隔离，禁止跨账号串码。
8. 历史不完整数据不自动补钱；单边流水或证据冲突进入人工复核。

---

## 1. 已核验的线上事实与代码根因

### 1.1 线上案例

CloudBase 环境：`cloud1-d0gvhqu2c8a2b61fd`

- 邀请人：`user_1785335759151_a42a7d8f`，邀请码 `N26HRD`
- 被邀请人：`user_1785393550039_496d6e27`
- 分享 ID：`s_ms7579a0_7mwqaz`
- 首次匿名访问：北京时间 `2026-07-30 14:39:08.988`
- 匿名记录：`channel=analysis_share`、`scene=low`、`inviteCode=""`
- 被邀请人约 1.05 秒后创建，但 `landingInviteCode=""`、`invitedBy=null`
- 无对应 claim，无双方邀请奖励流水

线上配置：

```json
{
  "enabled": true,
  "inviterRewardTokens": 50,
  "inviteeRewardTokens": 100,
  "inviterTrialExtendDays": 3,
  "requireFirstEvent": true,
  "weeklyInviteCap": 100
}
```

该历史案例的原始分享链接没有邀请码，无法可靠自动归因。是否人工补发需单独决定，不属于本次自动修复。

### 1.2 当前代码根因

1. `src/utils/share.js` 仅从 `currentUser.inviteCode` 读邀请码；为空时静默产生无码链接。
2. 邮箱注册/登录返回值未稳定返回邀请码，H5 用户容易长期缺码。
3. `wechatLogin/register/redeemInviteCode` 在线调用 `settleReward()`，把低优先级奖励放入用户响应时间。
4. `createTimeline` 在事件事务提交后仍 `await finalizePendingReferral()`，虽然吞错，但继续占用用户等待时间。
5. `_shared/subscription.js` 和 `_shared/referral-settlement.js` 存在多套结算逻辑。
6. `requireFirstEvent` 已配置但旧结算路径没有统一执行。
7. `addExtraTokens()` 会吞错并可能形成余额与流水不一致，不能用于邀请奖励。
8. `getSubscriptionStatus` 懒迁移可能返回一个并未保存的邀请码。

---

## 2. 目标架构：数据库事实即异步 outbox

不要从主链路异步调用另一个云函数，也不要启动 Promise 后立即 return。云函数返回后，未等待的任务不保证继续执行。

本方案使用“数据库事实即 outbox”：

```text
register / wechatLogin
  -> 在创建 users 文档的同一次现有写入中保存 landingInviteCode
  -> referralAttemptStatus = unprocessed
  -> 立即返回注册/登录成功

redeemInviteCode
  -> 只更新 users 上的邀请意图
  -> 返回“已提交，奖励稍后处理”

createTimeline
  -> 在本来就要写的 timeline_records 文档中增加 userId
  -> 提交原事件事务
  -> 立即返回事件创建成功

processReferralJobs（定时触发）
  -> 扫描 users.unprocessed，创建/恢复 referral_claims
  -> 判断是否满足首事件条件
  -> 后台短事务结算
  -> 成功 rewarded；失败 retry/failed
```

这样没有额外“投递成功才能返回”的依赖：

- 用户创建成功时，邀请意图与用户文档一起存在。
- 首事件创建成功时，`timeline_records.userId` 与事件文档一起存在。
- 即使 worker 停机数小时，恢复后仍可从数据库扫描处理。
- 主链路不调用 `referral-settlement.js`，也不等待奖励数据库操作。

---

## 3. 数据结构

### 3.1 `users` 上的邀请意图

有邀请码的新用户在原用户创建文档中同时写入：

```javascript
{
  landingInviteCode: normalizedInviteCode,
  landingChannel: channel || '',
  landingScene: scene || '',
  landingShareId: shareId || '',

  referralAttemptStatus: normalizedInviteCode ? 'unprocessed' : 'none',
  referralAttemptCode: normalizedInviteCode,
  referralIntentVersion: normalizedInviteCode ? 1 : 0,
  referralIntentAt: normalizedInviteCode ? now : null,
  referralNextRunAt: normalizedInviteCode ? now : null,
  referralAttemptMessage: ''
}
```

允许状态：

| 状态 | 含义 |
|---|---|
| `none` | 没有邀请意图 |
| `unprocessed` | worker 尚未成功创建/接管 claim |
| `claimed` | 已有 claim，后续以 claim 为准 |
| `rejected` | 无效码、自邀请、重复码冲突或活动关闭 |
| `rewarded` | 已完成奖励 |
| `failed` | 自动处理耗尽，等待管理员/申诉 |

规则：

- 注册主链路不得为了设置这些字段增加新数据库请求；字段并入原 `users.add/set`。
- 无邀请码时必须明确写 `none`，避免 worker 扫描全部用户。
- claim 已存在后不得通过再次登录覆盖邀请人或邀请码。
- standalone 兑换只允许没有 `invitedBy`、没有 rewarded/manual_resolved claim 的用户提交；否则返回业务拒绝，不修改现有关系。
- 用户首次输入空码、无效码或自邀请码时，允许随后提交一个新码；每次显式兑换使用原子 `inc(1)` 增加 `referralIntentVersion`。
- `WEEKLY_CAP_REACHED/REFERRAL_DISABLED/INVITER_CONFLICT/PARTIAL_GRANT_FOUND` 不允许靠换码绕过。

### 3.2 `timeline_records.userId`

`createTimeline` 写事件时增加：

```javascript
{
  _id: recordId,
  userId,
  caseId,
  // 其他原字段保持不变
}
```

这是原事件文档的一个新字段，不增加事务操作数。worker 用它判断首事件是否真实存在，不相信客户端布尔值。

历史记录没有 `userId` 时，worker 可通过 `cases.userId -> timeline_records.caseId` 做兼容查询；新数据一律走 `timeline_records.userId` 索引。

### 3.3 `referral_claims` schemaVersion 3

`referral_claims` 同时承担邀请关系、异步任务和结算审计：

```javascript
{
  _id: inviteeUserId,
  schemaVersion: 3,

  inviteeUserId,
  inviterUserId: '',              // worker 解析后填写
  inviteCode,
  intentVersion: 1,
  shareId: '',
  channel: '',
  scene: '',

  status: 'pending_relation' |
          'waiting_first_event' |
          'retry' |
          'rewarded' |
          'rejected' |
          'failed' |
          'needs_review' |
          'manual_resolved',
  statusReason: '',

  requireFirstEvent: true,
  inviterTokens: 50,
  inviteeTokens: 100,
  inviterTrialExtendDays: 3,
  weeklyInviteCap: 100,
  configCapturedAt: Date,

  inviterGrantId: `referral_inviter_${inviteeUserId}`,
  inviteeGrantId: `referral_invitee_${inviteeUserId}`,

  attempts: 0,
  nextRunAt: Date,
  lastAttemptAt: null,
  lastErrorCode: '',
  leaseOwner: '',
  leaseUntil: null,

  firstEventAt: null,
  rewardWeekStart: null,
  rewardedAt: null,
  createdAt: Date,
  updatedAt: Date,

  manualAction: null
}
```

约束：

- `_id=inviteeUserId`，禁止一个 invitee 产生多条 claim。
- 首次成功创建的 `inviteCode/inviterUserId` 不得被普通重试覆盖。
- 金额与 `requireFirstEvent` 在 worker 首次解析关系时冻结。
- `payoutPaused` 不冻结；每次发奖前读取最新值。
- status 不使用持久化 `processing`，防止 worker 崩溃后永久卡死；只使用有过期时间的 lease。

### 3.4 固定奖励流水

邀请人流水：

```javascript
{
  _id: `referral_inviter_${inviteeUserId}`,
  userId: inviterUserId,
  type: 'grant',
  source: 'referral_inviter',
  sourceId: inviteeUserId,
  amount: inviterTokens,
  amountTokens: inviterTokens,
  balanceAfter,
  remark: `referral_inviter:${inviteeUserId}`,
  createdAt: now
}
```

被邀请人使用 `_id=referral_invitee_${inviteeUserId}`、`source=referral_invitee`。

金额为 0 时不写 0 元流水；该侧视为完成。邀请奖励禁止调用会吞错的 `addExtraTokens()`。

---

## 4. 后端模块边界

### 4.1 统一模块

重写 canonical 文件：`cloudfunctions/_shared/referral-settlement.js`。

只导出后台需要的能力：

```javascript
module.exports = {
  normalizeInviteCode,
  recoverReferralIntents,
  processDueReferralClaims,
  processOneReferralClaim,
  bindReferralRelationInTransaction,
  settleClaimInTransaction,
  reconcileLegacyClaim,
  retryClaimManually,
  compensateClaimManually
}
```

删除 `settleReward()` 兼容壳。修改完所有调用点后，通过全仓搜索确认没有旧引用；不要保留可被误用的在线结算入口。

### 4.2 新云函数 `processReferralJobs`

新增：

```text
cloudfunctions/processReferralJobs/index.js
cloudfunctions/processReferralJobs/package.json
cloudfunctions/processReferralJobs/_shared/*（由 sync:shared 生成）
```

dev 测试环境先配置为每分钟触发，便于立即验证：

```json
{
  "name": "processReferralJobsEveryMinute",
  "type": "timer",
  "config": "0 * * * * * *"
}
```

dev 验收完成后，production 改为每小时整点触发：

```json
{
  "name": "processReferralJobsEveryHour",
  "type": "timer",
  "config": "0 0 * * * * *"
}
```

触发频率属于环境配置，不在业务代码中写死。云函数超时配置为 60 秒，函数入口计算 `deadline=startedAt+55_000`。每次最多：

- 恢复 50 条 `users.referralAttemptStatus='unprocessed'`；
- 处理 20 条到期 claim；
- 到达 deadline 时停止取新 claim，已完成结果保留，下次继续；禁止依赖不存在的“自动剩余时间”API。

返回值只供日志/运维：

```javascript
{
  success: true,
  recovered: 0,
  rewarded: 0,
  waiting: 0,
  retried: 0,
  failed: 0,
  rejected: 0
}
```

### 4.3 `recoverReferralIntents()` 精确流程

1. 使用 cursor 分页查询 `users`：`referralAttemptStatus='unprocessed'` 且 `referralNextRunAt<=now`。
2. 规范化 `referralAttemptCode || landingInviteCode`：`trim().toUpperCase()`。
3. 无有效字符串：将 user 标记 `rejected/EMPTY_INVITE_CODE`，不创建 claim。
4. 用 `referral_claims.add({_id:userId,...})` 创建 `pending_relation` claim；固定 `_id` 冲突视为已有任务，不报错。
5. claim 已存在时按状态处理：
   - `pending_relation/waiting_first_event/retry/rewarded/manual_resolved/needs_review`：不覆盖邀请码、邀请人、金额或状态；
   - `rejected` 且原因为 `EMPTY_INVITE_CODE/INVALID_INVITE_CODE/SELF_REFERRAL`：仅当 user 的 `referralIntentVersion` 更大、当前无 `invitedBy`、两条固定流水都不存在时，允许把同一 claim 重置为 `pending_relation` 并采用新码；
   - `WEEKLY_CAP_REACHED/REFERRAL_DISABLED` 等其他拒绝原因是终态，不允许换码绕过。
6. “重置可替换 rejected claim”必须在后台短事务内重新检查 claim、user 和固定流水，禁止先读后直接覆盖造成竞态。
7. claim 已存在或创建成功后，把 user 标记为 `claimed`。
8. 任一步数据库错误只记录结构化日志；把 `referralNextRunAt` 延后，不能抛出导致整批停止。

允许出现“claim 已创建、user 仍是 unprocessed”的中间态。下一轮通过固定 `_id` 幂等恢复，这是预期的最终一致性，不需要事务。

### 4.4 `processOneReferralClaim()` 精确流程

#### A. 调度与 lease

1. 只处理 `pending_relation/waiting_first_event/retry` 且 `nextRunAt<=now` 的 claim。
2. `leaseUntil>now` 时跳过；否则 best-effort 更新 `leaseOwner/leaseUntil=now+2min`。
3. lease 只减少重复工作，不承担防双发正确性；真正防双发依靠固定流水 ID 和结算事务。

#### B. 解析邀请关系（事务外）

1. 读取最新 `settings_subscription.referral`。
2. `enabled!==true` 且 claim 尚未冻结配置：`rejected/REFERRAL_DISABLED`。
3. 使用规范化邀请码查询 `users`，`limit(2)`：
   - 0 条：`rejected/INVALID_INVITE_CODE`；
   - 2 条：`needs_review/DUPLICATE_INVITE_CODE`，禁止 `.limit(1)` 随机归因；
   - 邀请人等于 invitee：`rejected/SELF_REFERRAL`。
4. 首次解析成功后准备 inviter、金额、试用天数、首事件开关和周上限快照。
5. 调用 `bindReferralRelationInTransaction()`：事务内只读取固定 ID 的 claim 与 invitee user，重新确认 claim 仍为 `pending_relation`、intentVersion 未变化且 `invitedBy` 为空或相同；随后在同一短事务内冻结配置、写 claim inviter，并补齐 `invitedBy/invitedByCode`。
6. invitee 已指向其他人时 rollback，事务外转 `needs_review/INVITER_CONFLICT`，不得覆盖。
7. 关系绑定事务失败只进入 retry，下轮继续，不影响用户系统。此事务通常仅 2 次读取和 2 次写入，且完全在后台执行。

#### C. 首事件判断（事务外）

1. `requireFirstEvent=false`：立即具备后台结算资格，但仍不是注册请求内结算。
2. `requireFirstEvent=true`：查询 `timeline_records.where({userId:inviteeUserId}).limit(1)`。
3. 新索引查不到时，对历史用户兼容查询 `cases.where({userId}).limit(...)`，再按 caseId 查询是否有 timeline record。
4. 未找到事件：`status='waiting_first_event'`，`nextRunAt=now+1min`。dev 下一分钟可验证；production 即使已到期，也要等下一次整点触发。
5. 找到事件：记录真实 `firstEventAt`，进入后台结算。

#### D. 发奖前判断

1. 最新配置 `payoutPaused===true`：保持 retry，`nextRunAt=now+1min`，不执行事务，也不增加 attempts；运维暂停不是结算故障。production 的实际检查粒度仍由每小时触发器决定。
2. `rewarded/manual_resolved`：幂等结束。
3. `rejected/failed/needs_review`：普通 worker 不自动发钱。
4. 满足条件后调用一次 `settleClaimInTransaction()`。

### 4.5 `settleClaimInTransaction()`：短事务

该函数只能在 worker 或管理员动作调用。每次处理一个 claim，禁止批量 claim 共用一个事务。

事务前完成邀请码查询、配置读取、首事件查询和所有复杂计算。事务内只按固定 `_id` 读取/写入：

```text
referral_claims/{inviteeUserId}
users/{inviterUserId}
users/{inviteeUserId}
call_usage_records/referral_inviter_{inviteeUserId}
call_usage_records/referral_invitee_{inviteeUserId}
```

流程：

1. `const transaction = await db.startTransaction()`，单次尝试，不在一次 worker 调用内长时间循环重试。
2. 重新读取 claim 和双方用户。
3. claim 已 rewarded/manual_resolved：rollback 或无写结束，返回幂等成功。
4. 重新确认 `invitedBy` 为空或等于 claim inviter；冲突则 rollback，并在事务外标记 needs_review。
5. 读取两条固定 ID 流水：
   - 两条应有流水都存在：只将 claim 对账为 rewarded，不重复加余额；
   - 只存在一边：rollback，转 `needs_review/PARTIAL_GRANT_FOUND`；
   - 都不存在：继续。
6. 使用事务内读取的 inviter 周计数计算北京时间周上限；到达上限则只把 claim 标记 `rejected/WEEKLY_CAP_REACHED` 后 commit，不发钱。
7. 在同一事务内：
   - 增加邀请人 `extraTokens`；
   - 增加被邀请人 `extraTokens`；
   - 写固定 ID 的双方流水；
   - 增加邀请人 `referralCount/referralWeekCount`；
   - 按配置延长邀请人试用期；
   - 保持/补齐 invitee 邀请关系；
   - claim 写为 `rewarded`，记录 `rewardedAt/rewardWeekStart`。
8. commit 成功才算完成。任一步异常都 rollback；禁止 catch 后继续 commit。
9. 事务内预计远低于 100 个操作，禁止外部 API、`where`、AI、日志查询或不受控循环。

北京时间周起点使用纯 UTC 运算，不依赖云函数系统时区：

```javascript
function getShanghaiWeekStart(now) {
  const offset = 8 * 60 * 60 * 1000
  const shifted = new Date(new Date(now).getTime() + offset)
  const mondayOffset = (shifted.getUTCDay() + 6) % 7
  shifted.setUTCDate(shifted.getUTCDate() - mondayOffset)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - offset)
}
```

### 4.6 失败与重试

结算事务失败后，在事务外 best-effort 更新 claim：

```javascript
{
  status: attempts + 1 >= 5 ? 'failed' : 'retry',
  attempts: _.inc(1),
  lastAttemptAt: now,
  lastErrorCode: sanitizeErrorCode(error),
  nextRunAt: calculateBackoff(attempts + 1),
  leaseOwner: '',
  leaseUntil: null
}
```

退避建议：1 分钟、5 分钟、30 分钟、2 小时、12 小时。`nextRunAt` 只是最早可执行时间；dev 每分钟检查，production 每小时检查，因此 production 不会按分钟频繁运行。5 次仍失败进入 `failed`，不再自动影响系统；等待后台人工重试或用户申诉。

claim 进入 rewarded/rejected/failed/manual_resolved 后，worker best-effort 把相同 intentVersion 的 user 状态镜像为对应终态。镜像失败不回滚奖励，也不改变 claim 的权威状态；下一轮对账或管理员查询可补齐。

日志不得保存手机号、邮箱、sessionKey、密码或完整错误堆栈中的敏感参数。用户响应中完全不出现这些失败。

---

## 5. 主链路调用点修改

### 5.1 `cloudfunctions/wechatLogin/index.js`

1. 邀请码统一 `trim().toUpperCase()`。
2. 新用户创建文档时并入第 3.1 节邀请意图字段。
3. 删除在线 inviter 查询和 `await settleReward()`。
4. 老用户登录不得自动覆盖原邀请意图或关系。
5. 登录成功响应保留用户自己的 `inviteCode`，但不返回奖励事务错误。
6. 不为邀请奖励增加任何额外数据库等待。

### 5.2 `cloudfunctions/register/index.js`

1. 创建用户时并入 `landingInviteCode/landingChannel/referralAttempt*`。
2. 删除注册后的 inviter 查询与 `settleReward()`。
3. 注册成功不依赖 claim 是否已生成。
4. 注册响应返回用户自己的 `inviteCode`，供分享缓存使用。
5. 删除或忽略旧 `referral.success/message` UI 契约；不得把后台状态包装成注册错误。

### 5.3 `cloudfunctions/login/index.js`

1. `buildUserLoginPayload()` 返回 `inviteCode:user.inviteCode || ''`。
2. 登录函数不调用结算、恢复或补发函数。
3. 旧用户的 `unprocessed` 意图由定时 worker 扫描，不需要登录触发。

### 5.4 `cloudfunctions/redeemInviteCode/index.js`

这是唯一需要单独写邀请意图的接口，因为“提交邀请码”本身就是该接口的主业务。

1. 完成身份验证与基本格式校验。
2. 若已有 `invitedBy`、rewarded/manual_resolved claim 或不可覆盖关系，返回明确业务拒绝。
3. 若旧 claim 是 `EMPTY_INVITE_CODE/INVALID_INVITE_CODE/SELF_REFERRAL` 且没有任何奖励流水，允许用户重新提交；其他 rejected/needs_review/failed 不因换码自动清除。
4. 允许提交时只更新用户：`referralAttemptStatus='unprocessed'`、规范化码、`referralIntentVersion=_.inc(1)`、`referralIntentAt=now`、`referralNextRunAt=now`。
5. 不查询邀请人、不查首事件、不发 Token、不执行奖励事务。
6. 成功响应固定为：

```javascript
{
  success: true,
  code: 'REFERRAL_ACCEPTED',
  message: '邀请码已提交，奖励将在后台处理'
}
```

无效码由 worker 最终拒绝；用户端不得出现事务或数据库失败文案。

### 5.5 `cloudfunctions/createTimeline/index.js`

1. 从 import 中删除 `finalizePendingReferral`。
2. `timeline_records.add()` 增加 `userId` 字段。
3. 删除事务提交后的 `await finalizePendingReferral(db,userId)` 及对应 catch。
4. 响应不增加 referral 结果，不显示奖励失败。
5. 原事件事务范围和成功语义保持不变。

### 5.6 `cloudfunctions/getSubscriptionStatus/index.js`

修复懒迁移值不一致：

```javascript
const effectiveInviteCode = user.inviteCode || invCode
user.inviteCode = effectiveInviteCode
```

数据库保存值与响应值必须相同，不能返回未保存的新码。

### 5.7 `cloudfunctions/_shared/subscription.js`

1. 删除旧 `redeemInviteCode()` 和 `finalizePendingReferral()` 及 exports。
2. 通用订阅函数不得反向 import referral-settlement，避免循环依赖。
3. 配置默认补缺 `payoutPaused:false`，不得覆盖线上已有配置。
4. 邀请码生成统一使用 `generateUniqueInviteCode(db,userId)`：规范化、查重、最多尝试 10 次。

### 5.8 邀请码唯一性

1. worker 查询邀请码必须 `limit(2)`，发现重复立即 needs_review。
2. 先用只读脚本审计现存重复/空邀请码。
3. 在 dev 验证 CloudBase 唯一索引对缺失/空字段的行为。
4. 只有确认全部非空且无重复后，才能分别在 dev、production 建立 `users.inviteCode` 唯一索引。
5. 索引创建是显式部署步骤，业务代码不得静默创建或修改数据库索引。

---

## 6. 前端分享与用户提示

### 6.1 `src/utils/share.js`

邀请码缓存按用户隔离：`myInviteCode:${userId}`，禁止全局 `myInviteCode`。

读取顺序：

```text
显式 extra.inviteCode
  -> 当前 currentUser 且 ID 匹配时的 inviteCode
  -> myInviteCode:${userId}
  -> ''
```

`ensureInviteCodeCached()` 的 in-flight Promise 也必须按 userId 保存；请求返回前账号切换时，丢弃旧账号结果。

登录用户邀请码未 ready 前隐藏或禁用分享入口；ready 后 AppMessage 和 Timeline 都携带：

- `inviteCode`
- `channel`
- `scene`
- 新生成的 `shareId`

涉及文件：

```text
src/App.vue
src/utils/share.js
src/pages/me/me.vue
src/pages/index/index.vue
src/pages/case-detail/case-detail.vue
全仓其他 onShareAppMessage/onShareTimeline 调用点
```

### 6.2 `src/utils/api.ts`

1. `cacheLoginUser()` 同步缓存后端返回的用户本人邀请码。
2. logout 和过期登录态清理当前 userId 对应的 scoped key。
3. 删除对 register/login/createTimeline 响应中 referral 结算失败的处理。
4. 不弹出奖励结算失败 toast/modal。

### 6.3 用户可见规则

- 注册、登录、事件创建只显示各自主业务结果。
- `redeemInviteCode` 成功只提示“已提交，奖励稍后处理”。
- 后台奖励成功后，用户下次刷新余额自然看到变化；可以显示“奖励已到账”，但必须以已存在固定流水或 rewarded claim 为依据。
- pending/retry/failed/needs_review 等内部状态不直接展示给普通用户。
- 用户申诉由管理员查询 claim 并补偿，不要求在本次修复中开发申诉页面。

---

## 7. 后台管理与人工补偿

### 7.1 `cloudfunctions/adminManage/index.js`

`listReferralClaims()` 必须 cursor 分页，默认 100、最大 200，并返回全量聚合统计：

```javascript
statusCounts: {
  pending_relation: 0,
  waiting_first_event: 0,
  retry: 0,
  rewarded: 0,
  rejected: 0,
  failed: 0,
  needs_review: 0,
  manual_resolved: 0
}
```

只把 `rewarded/manual_resolved` 中实际存在的流水金额计入已发放总额。当前页 reduce 不能冒充全量统计。

新增管理员动作：

1. `retryReferralClaim`
   - 仅允许 `retry/failed`；
   - 清空 lease，设置 `status='retry'、nextRunAt=now`；
   - 不直接改余额。
2. `recheckReferralClaim`
   - 检查双方用户、关系和固定流水；
   - 只对账，不自动加钱。
3. `grantReferralCompensation`
   - 仅允许 `failed/needs_review`；
   - 管理员必须显式确认 inviter/invitee、金额和 claim ID；
   - 使用与 worker 相同的固定流水 ID 和短事务；
   - 已存在流水的一侧不得重复发放；
   - 完成后写 `manual_resolved` 和管理员审计信息。

所有动作记录管理员 ID、确认文本、操作前后余额、时间和原因。禁止删除 claim 后“重新试一次”。

### 7.2 后台页面

修改：

```text
src/pages/admin/components/panels/ReferralClaimsPanel.vue
src/pages/admin/components/panels/SubscriptionPanel.vue
```

要求：

- 完整显示所有状态、attempts、nextRunAt、lastErrorCode、rewardedAt。
- `failed/needs_review` 提供“重新排队、重新对账、人工补偿”。
- 补偿必须二次确认。
- pending/retry/rejected 不计入已发放总额。
- 暴露 `requireFirstEvent` 与 `payoutPaused` 开关并原样 round-trip。
- `payoutPaused` 文案明确：“暂停后台邀请奖励，不影响注册、登录和记录创建”。

---

## 8. 历史数据与审计脚本

新增 `scripts/audit-referral-consistency.cjs`，默认只读：

```text
node scripts/audit-referral-consistency.cjs --env <envId> --dry-run
node scripts/audit-referral-consistency.cjs --env <envId> --apply-metadata
```

`--dry-run` 输出：

- 重复/空邀请码；
- 旧 schema claim；
- rewarded claim 缺一侧流水；
- 流水存在但 claim 缺失；
- invitedBy 与 claim 冲突；
- `referralCount` 与已确认 rewarded claim 数差异。

`--apply-metadata` 只允许修复关系、状态和统计元数据，禁止增加/扣减 Token，禁止自动延长历史试用期。

旧数据规则：

- 双方流水都存在：对账为 rewarded，不重复发钱。
- 只有一边流水：needs_review，人工决定是否补另一边。
- 旧 claim 写 rewarded 但双方流水都不存在：无法证明旧余额是否已加，needs_review，不自动重发。
- 无邀请码的历史访问：不猜归因。
- production 执行任何 apply 或人工补偿都需要单独确认。

---

## 9. 索引、查询和权限

dev 先建立并验证：

```text
users(referralAttemptStatus, referralNextRunAt)
referral_claims(status, nextRunAt)
referral_claims(inviterUserId, rewardedAt)
timeline_records(userId, createdAt)
```

`users.inviteCode` 唯一索引必须在重复码审计完成后再建。

安全要求：

- `processReferralJobs` 只由定时触发器/管理员内部调用，不暴露普通客户端发奖权限。
- 普通用户不能直接写 `referral_claims/call_usage_records/users.extraTokens`。
- 管理员补偿继续使用现有管理员身份校验。
- 日志统一前缀 `[referral-worker]`，只记录 userId/claimId、状态、错误码和耗时。

---

## 10. 测试计划

### 10.1 本地自动化

主文件：`tests/run-referral-smoke.cjs`。

`tests/support/fake-cloudbase.cjs` 需要：

- 支持 `startTransaction/commit/rollback`；
- 为 doc read/write/commit 增加故障注入；
- 支持定时 worker 的分页、固定 ID 冲突和时间注入；
- 能验证事务失败后奖励相关文档全部不变。

`package.json` 新增：

```json
"test:referral": "node tests/run-referral-smoke.cjs"
```

### 10.2 必测场景

| # | 场景 | 预期 |
|---|---|---|
| T1 | 带码注册 | 用户创建成功，只写 unprocessed 意图，不在线查 inviter/发奖 |
| T2 | 奖励数据库/worker 完全不可用时注册 | 注册仍成功，用户文档保留邀请意图 |
| T3 | 登录 | 不触发结算，不因 claim 状态增加等待或失败 |
| T4 | requireFirstEvent=true，尚无事件 | worker 建 waiting claim，不发钱 |
| T5 | createTimeline | 原事务成功即返回；不调用结算；事件含 userId |
| T6 | 首事件后 worker | 后台事务发双方奖励、流水、计数、试用期，claim rewarded |
| T7 | requireFirstEvent=false | 仍由 worker 发奖，不在注册请求发奖 |
| T8 | worker 重复/定时器重叠 | 固定 claim/流水 ID 保证只发一次 |
| T9 | 双方任一余额或流水写失败 | 奖励事务回滚，无新部分状态；claim 进入 retry |
| T10 | commit 超时/冲突 | 主业务无感；按退避重试 |
| T11 | 连续 5 次失败 | claim failed，停止自动处理，可管理员重新排队 |
| T12 | 人工补偿重复点击 | 固定流水 ID 阻止双发，审计信息完整 |
| T13 | 周上限差 1，并发两个 invitee | 最多一个 rewarded，另一个 WEEKLY_CAP_REACHED |
| T14 | 北京时间周一边界 | 周计数按 Asia/Shanghai 正确重置 |
| T15 | 无效码/自邀请/重复邀请码 | rejected 或 needs_review，不影响用户主业务 |
| T16 | claim 创建成功但 user 状态更新失败 | 下一轮固定 ID 幂等恢复 |
| T17 | user 意图存在但 claim 不存在 | recovery 扫描成功补建 claim |
| T18 | 首事件提示更新缺失 | worker 从 timeline_records.userId 事实恢复 |
| T19 | 历史 timeline 无 userId | cases.userId 兼容路径可发现首事件 |
| T20 | 旧单边流水 | needs_review，不自动补钱 |
| T21 | 登录用户邀请码尚未 ready | 分享入口不可用；ready 后链接有码 |
| T22 | A 切换 B，A 请求晚返回 | B 不得缓存或分享 A 的邀请码 |
| T23 | AppMessage/Timeline | 均携带当前 userId 的 inviteCode/channel/scene/shareId |
| T24 | UI 收到内部失败状态 | 不显示事务失败 toast/modal |
| T25 | claims 超过 500 条 | cursor 可继续加载，全量统计正确 |

### 10.3 dev 真实环境验证

本地 fake 不能证明 CloudBase 的真实事务冲突和定时触发行为，dev 必测：

1. 部署 `processReferralJobs` 并确认 dev 定时触发器每分钟执行一次。
2. 验证事务能跨 `users/referral_claims/call_usage_records` 提交。
3. 注入一次事务失败，确认注册/事件主链路完全不受影响。
4. 两个 invitee 并发结算同一 inviter，确认不双发、不突破周上限。
5. 暂停 worker 10 分钟再恢复，确认数据库意图可补处理。
6. 打开 `payoutPaused`，确认只积压 claim；关闭后后台恢复。
7. 验证用户端看不到任何奖励事务失败提示。

验证命令：

```text
npm run sync:shared
npm run sync:shared:dry
npm run test:referral
npm run test:regression
npm run build:h5
npm run build:mp-weixin
```

---

## 11. 文件改动清单

后端：

```text
cloudfunctions/_shared/referral-settlement.js
cloudfunctions/_shared/subscription.js
cloudfunctions/processReferralJobs/index.js
cloudfunctions/processReferralJobs/package.json
cloudfunctions/wechatLogin/index.js
cloudfunctions/register/index.js
cloudfunctions/login/index.js
cloudfunctions/redeemInviteCode/index.js
cloudfunctions/createTimeline/index.js
cloudfunctions/getSubscriptionStatus/index.js
cloudfunctions/getSubscriptionConfig/index.js
cloudfunctions/adminManage/index.js
所有由 sync:shared 管理的 _shared 副本
```

前端：

```text
src/App.vue
src/utils/share.js
src/utils/api.ts
src/pages/me/me.vue
src/pages/index/index.vue
src/pages/case-detail/case-detail.vue
src/pages/admin/components/panels/ReferralClaimsPanel.vue
src/pages/admin/components/panels/SubscriptionPanel.vue
其他分享页面
```

测试/脚本：

```text
tests/run-referral-smoke.cjs
tests/support/fake-cloudbase.cjs
scripts/audit-referral-consistency.cjs
package.json
云函数定时触发器配置
```

---

## 12. DeepSeek 实施顺序

必须按以下顺序修改，每步通过相应测试再继续：

1. 全仓搜索并列出旧 `settleReward/finalizePendingReferral/redeemInviteCode` 调用点。
2. 先写只读审计脚本，在 dev 输出重复邀请码和旧 claim 规模。
3. 补 fake CloudBase 的事务、分页、故障注入和时间控制。
4. 重写 canonical `referral-settlement.js`，完成 recovery、worker、短事务和重试测试。
5. 新增 `processReferralJobs` 云函数与定时触发器配置。
6. 修改 register/wechatLogin/login/redeemInviteCode/createTimeline，彻底移除在线结算。
7. 删除 subscription 中的旧实现，修复邀请码生成与懒迁移。
8. 修改分享缓存、分享入口门控及所有分享页面。
9. 修改后台分页、全量统计、失败重试和人工补偿。
10. 执行 `npm run sync:shared`，再用 `sync:shared:dry` 确认无漂移。
11. 运行全部测试和 H5/微信构建。
12. 有独立 dev 环境时先在 dev 建立索引并完成第 10.3 节真实验证；本仓库实际只有一个 CloudBase 环境，必须改用第 13.2 节的暂停发奖、分步部署和手工验证顺序。
13. 单环境测试期按用户确认暂用每分钟触发；验收完成后再切换为每小时整点触发。

禁止事项：

- 禁止在 register/login/wechatLogin/createTimeline 内调用奖励事务。
- 禁止使用未等待 Promise 的 fire-and-forget 作为唯一投递机制。
- 禁止把奖励失败转换成注册、登录或事件创建失败。
- 禁止向普通用户显示内部 claim/事务错误。
- 禁止事务内使用 `where`、外部 API、AI 调用或长循环。
- 禁止调用 `addExtraTokens()` 发邀请奖励。
- 禁止依靠随机 `_id` 的流水做幂等。
- 禁止删除 claim 后重新发奖。
- 禁止对无码历史访问进行猜测归因。
- 禁止自动给历史单边/无流水记录补钱。
- 禁止用部署脚本覆盖 production 邀请配置。

---

## 13. 部署、回滚与运维

### 13.0 实际执行记录（2026-08-02，2026-08-05 复核）

本仓库只有 `cloud1-d0gvhqu2c8a2b61fd` 一个 CloudBase 环境，前端 `src/utils/cloudbase.ts` 也硬编码同一 envId，因此不存在独立 dev 环境。经确认后按 13.2 的 production 安全顺序执行，历史 claim 一律不改（不执行 `--apply-metadata`）。

已完成：

1. 只读审计：71 users / 35 claims / 19 邀请流水；空邀请码 0、重复邀请码 0、流水无 claim 0、invitedBy 冲突 0；35 条 claim 全为 `schemaVersion 0`，其中 25 条 rewarded 查不到任一侧流水、6 条只有邀请人一侧，referralCount 漂移 2 例。这批历史数据按决策保持原样，不做 metadata 修复。
2. `referral.payoutPaused = true`（脚本 `scripts/manage-referral-payout.cjs`，只改这一个字段）。
3. 建立复合索引（`scripts/manage-referral-indexes.cjs`）：`users.{referralAttemptStatus,referralNextRunAt}`、`referral_claims.{status,nextRunAt}`、`referral_claims.{inviterUserId,rewardedAt}`、`timeline_records.{userId,createdAt}`。邀请码唯一索引条件已满足但尚未创建。
4. 部署 `processReferralJobs`，未配置定时触发器（触发器改由 `scripts/manage-referral-trigger.cjs` 按需开关，已从 `cloudbaserc.json` 移除）；手工调用两次均为 `{recovered:0, rewarded:0, ..., elapsedMs≈245}`，未触碰历史 claim。
5. 部署业务云函数：`getSubscriptionStatus`、`adminManage`、`createTimeline`、`redeemInviteCode`、`register`、`wechatLogin`、`login`。
6. 本地 `npm run build:mp-weixin` 构建通过。
7. 恢复发奖：`referral.payoutPaused = false`。
8. 按用户确认开启测试期定时触发器 `processReferralJobsEveryMinute`（cron `0 * * * * * *`，`Enable=1`、`BindStatus=on`）。2026-08-05 通过 `npm run cloud:referral:trigger:list` 再次核验，线上只有这一条已启用触发器。recovery 与 claim 扫描均为正向精确匹配（`referralAttemptStatus: 'unprocessed'`、`status in ACTIVE_CLAIM_STATUSES`），历史 71 个用户与 35 条 `schemaVersion 0` claim 不会被 worker 选中。
9. 本地回归已扩展至 19 个邀请奖励用例，并通过 `test:regression`、H5 生产构建和微信小程序生产构建；微信构建产物中不存在 H5 管理员登录页文件或引用。

待办：

- 确认小程序前端是否已完成上传、审核和发布；当前只能确认生产构建通过。
- 在 CloudBase 控制台或新版开发者工具观察定时执行日志。仓库当前 CloudBase CLI 3.2.2 调用 `tcb fn log processReferralJobs` 会返回“当前版本不支持更多日志检索”，因此尚未用 CLI 完成持续运行日志核验。
- 测试期验收完成后，删除 `processReferralJobsEveryMinute`，创建并核验 `processReferralJobsEveryHour`（cron `0 0 * * * * *`）；切换期间不得同时保留两条已启用触发器。

运维入口：

```bash
npm run cloud:referral:payout:status     # 查看发奖开关
npm run cloud:referral:payout:pause      # 紧急止血
npm run cloud:referral:worker:invoke     # 手工跑一批
npm run cloud:referral:trigger:list      # 查看触发器
node scripts/manage-referral-trigger.cjs delete processReferralJobsEveryMinute
node scripts/manage-referral-trigger.cjs create-hourly
```

### 13.1 dev 部署顺序

1. `audit-referral-consistency --dry-run`。
2. 建立普通复合索引；验证邀请码唯一索引条件。
3. 部署 `processReferralJobs`，暂不开定时触发器，先手工调用验证。
4. 部署修改后的业务云函数。
5. dev 开启每分钟定时触发器，方便连续测试。
6. 发布 dev 前端。
7. 完成真实并发、失败、暂停/恢复验证。

### 13.2 production 部署顺序

1. 再次只读审计 production；不得自动 apply。
2. 先部署 worker，但保持 `payoutPaused=true`。
3. 部署业务云函数，确认主链路已经不再在线结算。
4. 将 production 定时触发器配置为 `0 0 * * * * *`（每小时整点），开启后再关闭 `payoutPaused`。
5. 最后发布前端。
6. 观察 24 小时：worker 时长、retry/failed 数、pending 年龄、重复流水冲突、主接口 P95。

### 13.3 回滚

- worker 出现问题时只需 `payoutPaused=true` 或停用定时触发器；注册、登录和事件系统继续工作。
- 不删除 pending/retry/failed claim，修复后继续扫描。
- 不回滚已经成功发放的 Token，不删除固定流水。
- 代码回滚前确认旧版本不会重新在线调用旧 `settleReward()`；必要时先保持 payoutPaused。

---

## 14. 自我审计：本方案仍可能出错的地方

1. **定时器延迟或停机**：奖励会延迟，但 users/timeline 数据可恢复；这是本产品取舍允许的结果。
2. **user 意图与 claim 分步写入**：允许短暂不一致，固定 claim ID 和 recovery 扫描可修复。
3. **lease 竞争**：lease 不是严格锁；真正正确性由事务重新读取和固定流水 ID 保证。
4. **CloudBase 事务限制**：方案事务远低于 100 次操作，不含 where/外部调用；若仍冲突则留待下轮，不阻塞用户。
5. **worker 批次超时**：限制每批 20 个并保留 5 秒退出预算；不能一次扫完全库。
6. **首次事件识别**：新事件写 userId；历史事件有 cases 兼容路径，避免只靠一次非关键通知。
7. **活动配置变化**：金额和 requireFirstEvent 在 claim 首次解析时冻结；payoutPaused 每次读取最新值，行为确定。
8. **人工补偿双发**：必须复用固定流水 ID 并在事务内复核，不能直接手改余额。
9. **旧代码残留**：实施后必须 `rg` 确认在线函数没有旧结算调用，并以测试防回归。
10. **索引未建立**：worker 上线前必须在 dev 验证索引；无索引时不得直接扩大批次上线 production。
11. **奖励最终缺失**：自动重试耗尽后可能没有奖励，这是已接受的业务风险；后台保留 claim 和错误码供申诉补偿。
12. **当前线上案例**：原链接无码，技术修复无法追溯邀请人，必须保持“不自动归因”。

本次自审后，没有再把邀请奖励设计成主链路的成功条件，也没有依赖云函数返回后的后台 Promise。剩余风险被限制在“奖励延迟或漏发”，不会扩大为注册、登录、创建记录不可用。

---

## 15. 最终验收标准

只有同时满足以下条件才算修复完成：

- register/wechatLogin/login/createTimeline 不调用奖励结算函数。
- worker/事务故障时，注册、登录和事件创建仍按原主业务成功。
- 用户端不显示邀请奖励事务失败。
- 数据库中的用户邀请意图和首事件事实可被定时 worker 恢复。
- `requireFirstEvent` true/false 都是异步发奖。
- 每个 invitee 最多一条 claim、双方各最多一条固定奖励流水。
- 新流程任一奖励事务失败不留下部分余额或部分流水。
- 并发不双发、不突破周上限，周边界为北京时间周一 00:00。
- 5 次失败进入后台 failed，可重新排队或人工补偿。
- 人工补偿可审计且不可重复发放。
- 登录用户分享开放后只携带当前 userId 的邀请码。
- 历史单边/无码数据不自动补发或猜归因。
- 后台全量统计不受单页 500 条限制。
- `test:referral`、`test:regression`、H5 构建、微信小程序构建全部通过。
