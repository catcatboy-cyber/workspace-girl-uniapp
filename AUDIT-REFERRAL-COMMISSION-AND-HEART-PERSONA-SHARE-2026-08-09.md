# 邀请分佣与心动人设分享快速测试审计报告

> 审计日期：2026-08-09  
> 审计结论：**暂不通过，不建议继续放量或启用现金分佣**  
> 审计方式：开发方案逐条对照、静态代码审查、专项测试、完整回归、双端构建、沙箱云资源只读核对

## 1. 审计范围

本次审计依据：

- `REFERRAL-COMMISSION-DEV-PLAN.md`
- `REFERRAL-COMMISSION-PLAN-ERRATA.md`
- `HEART-PERSONA-SHARE-QUICK-TEST-DEV-PLAN-2026-08-06.md`
- 仓库根目录 `AGENTS.md` 中的 Campus Pop 设计与开发约束

重点检查范围：

- 心动人设结果分享、公开投影、快速测试、登录回跳、重新测试和结果页闭环；
- 充值、套餐、报告道具三类支付的分佣入队；
- 分佣 job、commission、account、ledger 状态机及幂等；
- 退款冲正、提现登记、暂停开关与异常补偿；
- 用户端、后台端查询及分享归因；
- 数据库集合、索引、定时触发器和沙箱部署状态；
- 专项测试、完整回归、H5 和微信小程序构建。

## 2. 总体结论

### 2.1 心动人设分享快速测试

核心链路整体完成度较高：

- 分享记录、公开 DTO 白名单、撤销分享失效和 owner 权限降级已实现；
- `entryMode=share_quick` 对三类测试、self/target、男女共 12 组组合进行了服务端校验；
- quick target 不依赖 `caseId`，普通 target 的 Crush 所有权规则未被放宽；
- 分享落地页、静默登录、H5 登录回跳、快速答题、结果分享和主页 CTA 已接入；
- 分享安全、快速保存、路由、UI 契约和索引管理专项测试通过；
- H5 与微信小程序构建通过。

该部分未发现新的核心权限泄漏或阻断性错误，但仍存在匿名状态可能生成无邀请码链接的归因边界问题，见 P2-2。

### 2.2 邀请现金分佣

主要模块、页面、索引和 worker 已实现并部署到沙箱，但账务可靠性仍不满足启用条件：

- 存在退款已完成但佣金永久未冲正的窗口；
- 补偿扫描在数据超过批次后可能永久漏单；
- 后台提现登记会被 CloudBase 拒绝；
- 配置快照读取失败时会使用未来配置结算历史订单；
- 运维暂停脚本修改了错误的配置字段；
- 完整回归测试当前失败。

因此，本次审计不批准现金分佣继续放量。应先完成全部 P0/P1 修复并重新执行验收。

## 3. 审计发现

### P0-1：退款成功后，佣金冲正失败会永久漏冲

涉及代码：

- `cloudfunctions/_shared/archetype-report-access.js:258-313`
- `cloudfunctions/adminManage/index.js:2086-2144`

当前报告退款流程先在事务中把订单改为 `refunded`，事务提交后才调用 `reverseCommissionForRefund()`。如果冲正阶段出现瞬时数据库错误：

1. 订单和报告权益已经完成退款处理；
2. 佣金仍保持 `pending` 或 `available`；
3. 同一微信退款通知再次到达时，会因 `wxRefundId` 已存在直接返回 duplicate；
4. 后续不会重新执行佣金冲正；
5. 系统也没有写入固定 ID 的冲正 job 或 review task。

充值/套餐后台退款也先把订单改为 `refunded`，再尝试冲正。冲正失败后再次点击退款会被“仅已支付订单可退款”拦截，同样缺少自动补偿入口。

影响：平台可能已经把款退给用户，但邀请人仍保留可提现佣金，形成直接资金损失。

整改要求：

- 优先把订单退款状态变更与佣金冲正纳入同一数据库事务；或
- 在退款事务内写入固定 ID 的 `commission_reversal_jobs`/review task，由 worker 幂等重试；
- 重复退款通知必须检查冲正是否已完成，而不是只检查订单退款状态；
- 新增“退款提交成功、首次冲正失败、重复通知后最终冲正成功”的集成测试；
- 充值后台退款也必须具备同等持久化补偿能力。

### P0-2：缺失 job 的恢复扫描会永久饿死后续订单

涉及代码：`cloudfunctions/_shared/referral-commission.js:337-370`

`recoverCommissionJobs()` 当前行为：

- 充值订单固定读取前 `limit` 条；
- 报告订单固定读取前 `limit` 条；
- 合并后再次执行 `candidates.slice(0, limit)`；
- 不排序、不使用游标，也不持久化扫描进度。

当充值已完成订单达到 50 条后，worker 可能每分钟都扫描相同的前 50 条。即使这些订单已经全部存在 job，第 51 条之后的漏建 job 也永远不会被发现。由于合并后再次截断，充值候选满 50 条时，报告订单恢复扫描还会被完全饿死。

影响：支付和权益已成功，但邀请人永久没有佣金记录；恢复 worker 无法实现方案要求的兜底能力。

整改要求：

- 两类订单分别使用稳定的复合游标，例如 `fulfilledAt/paidAt + _id`；
- 分别维护和推进扫描进度，不能合并后截断；
- 对找不到 job 的订单直接按固定 ID 补建；
- 增加超过 50 条、跨多批次、前批次全部已有 job、两类订单同时存在的测试。

### P1-1：后台提现登记向 `doc(id).set()` 写入 `_id`

涉及代码：`cloudfunctions/adminManage/index.js:2765-2795`

当前提现流水写入：

```js
transaction.collection('commission_ledger')
  .doc(`ledger_${businessId}`)
  .set({ _id: `ledger_${businessId}`, ... })
```

CloudBase 不允许在 `doc(id).set()` 的 payload 中再次写入 `_id`，会返回“不能更新 `_id` 的值”。事务因此回滚，后台提现登记实际不可用。

整改要求：

- 从 `set()` payload 中移除 `_id`；
- 新增管理员鉴权、正常提现、余额不足、冻结账户和重复 `businessId` 的集成测试；
- 测试必须同时验证 account 和 ledger 在同一事务内成功或回滚。

### P1-2：佣金配置快照读取失败后会改用未来配置

涉及代码：

- `cloudfunctions/_shared/referral-commission.js:135-155`
- `cloudfunctions/_shared/referral-commission.js:221-225`

`enqueueCommissionJob()` 捕获配置读取异常后仍会创建 `commissionConfigSnapshot=null` 的 job。worker 处理该 job 时，会重新读取当时的当前配置。

这会导致支付完成后的比例、产品开关、结算天数和规则版本可能被未来配置覆盖，违反“配置变更只影响新订单”和快照审计要求。

整改要求：

- 支付时无法取得配置快照，不得创建普通 pending job；
- 可创建 `needs_review` job，明确记录 `CONFIG_SNAPSHOT_UNAVAILABLE`；
- 或在支付订单上同步持久化配置快照，恢复扫描只读取该历史快照；
- 禁止 worker 为历史订单猜测当前配置；
- 补配置读取失败、配置变更后重试和恢复扫描测试。

### P1-3：运维暂停脚本修改了错误的配置路径

涉及代码：`scripts/manage-referral-payout.cjs:88-114`

当前脚本修改的是：

```text
referral.payoutPaused
```

现金分佣释放和提现实际读取的是：

```text
referral.commission.payoutPaused
```

因此执行以下命令不会暂停现金分佣：

```powershell
npm.cmd run cloud:referral:payout:pause
```

该命令只影响原有一次性邀请奖励。当前 `status` 输出也没有展示 `referral.commission` 的真实启用和暂停状态。

整改要求：

- 将旧邀请奖励和现金分佣拆成明确的两组命令；或
- 新增 `cloud:referral:commission:status/pause/resume`；
- 状态命令必须输出 `enabled`、`payoutPaused`、`effectiveFrom`、`ruleVersion`；
- pause 后只读复核云端配置，并验证 worker 不再解冻、后台不再允许提现。

### P1-4：完整回归测试当前失败

涉及代码：`tests/run-regression.cjs:1478-1489`

数据库模拟器已经正确模拟 CloudBase 的 `_id` 限制，但完整回归中的两个 `system_settings` 测试夹具仍在 `doc(id).set()` 中传入 `_id`，导致测试中止：

```text
FAIL token gate does not let monthly overuse offset available extra tokens
Error: 不能更新_id的值
```

这也暴露出后台提现同类问题未被专项测试覆盖。

整改要求：

- 移除测试夹具 payload 中的 `_id`；
- 重新执行 `npm.cmd run test:regression`；
- 在完整回归通过前不得视为开发验收完成。

### P2-1：用户与后台统计超过 1000 条后会失真

涉及代码：

- `cloudfunctions/_shared/referral-commission.js:431-451`
- `cloudfunctions/adminManage/index.js:2724-2745`

用户付费好友数和后台金额概览都只读取前 1000 条 commission/account 数据。超过该规模后：

- 用户 `paidInviteCount` 会少算；
- 后台 `paidAmountFen`、`paidInviteCount` 和账户金额汇总会少算；
- 用户、账本、后台三方数据不再一致。

整改要求：

- 使用数据库聚合能力或维护经过账本约束的汇总字段；
- 不得用固定 1000 条上限作为财务统计；
- 增加超过 1000 条的统计一致性测试。

### P2-2：匿名状态仍可能生成无邀请码分享链接

涉及代码：`src/utils/share.js:111-112`

当前 `isReferralShareBlocked()` 只有在“已存在 userId 且邀请码未就绪”时才返回 true。匿名、静默登录尚未完成或本地身份暂时缺失时会返回 false，`appendReferralParams()` 随后可以生成没有 `inviteCode` 的分享链接。

影响：分享落地页在登录完成前被转发时，可能形成无法归因的二次分享，与“邀请码未准备好时所有分享入口保持门控”的方案要求不一致。

整改要求：

- 没有当前用户身份时也应视为 blocked；
- 分享回调应在 `inviteCode` 缺失时返回空配置，不生成无归因 path；
- 增加匿名、静默登录中、登录完成但邀请码未加载、邀请码准备完成四种状态测试。

### P2-3：分佣页面文案没有跟随实际配置和退款范围

涉及代码：`src/pages/referral/referral.vue:44-49`

页面固定显示：

```text
套餐、加油包、道具均参与；退款订单会自动撤销奖励。
```

但后台允许分别关闭三类产品；充值/套餐自动微信退款回调也不属于当前 MVP，只有后台手工退款路径。固定文案可能向用户承诺当前配置未提供的权益和自动化能力。

整改要求：

- 服务端返回实际参与产品和退款说明；
- 页面按 `includeSubscription/includeRecharge/includeProp` 动态生成规则文案；
- 在没有自动退款回调时，不使用“自动撤销”这一绝对表述。

## 4. 测试与构建结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| `npm.cmd run test:archetype-share` | 通过 | 分享安全、quick 保存、路由、UI 契约、索引管理全部通过 |
| `npm.cmd run test:referral-commission` | 通过 | 当前分佣专项测试通过，但未覆盖本报告列出的失败补偿与后台提现问题 |
| `npm.cmd run test:referral` | 通过 | 20 passed，0 failed |
| `npm.cmd run test:archetype-report-payment` | 通过 | 投影、支付、回调路由、退款 happy path 通过 |
| `npm.cmd run test:regression` | **失败** | `tests/run-regression.cjs:1478` 的 `_id` 测试夹具失败 |
| `npm.cmd run build:h5` | 通过 | 仅有现存 Sass legacy API 与 `@import` 弃用警告 |
| `npm.cmd run build:mp-weixin` | 通过 | postbuild 正常完成，仅有现存 Sass 弃用警告 |
| `node --check` 关键云函数 | 通过 | 分佣、支付、报告退款、后台和 worker 无语法错误 |
| `git diff --check` | 通过 | 无空白错误；存在 Git 的 CRLF 提示 |

## 5. 沙箱环境核对

核对环境：`cloud1-d0gvhqu2c8a2b61fd`

已确认：

- `processReferralJobs` 状态为 Active/Available；
- 存在启用的 `processReferralJobsEveryMinute` 定时触发器；
- `users_invite_code_unique` 唯一索引存在；
- `referral_commission_jobs`、`referral_commissions`、`commission_accounts`、`commission_ledger`、`commission_review_tasks` 及要求索引存在；
- 最近一次只读一致性审计记录显示：
  - 空邀请码：0；
  - 重复邀请码：0；
  - `invitedBy` 冲突：0；
- `referralCommission`、`processReferralJobs`、`recharge`、`adminManage`、`archetypeReportPayment`、`contentSecCallback` 等相关函数均可在沙箱查询到已部署代码。

注意：现有 `cloud:referral:payout:status` 读取的是旧邀请奖励配置，不代表 `referral.commission.enabled/payoutPaused` 的真实状态。修复 P1-3 前不能使用该命令作为现金分佣启停证据。

## 6. 共享文件一致性

执行：

```powershell
npm.cmd run sync:shared:dry
```

结果显示 49 个函数目录仍存在共享副本差异。关键分佣模块 `referral-commission.js` 在以下目录 SHA256 一致：

- 根 `_shared`；
- `recharge`；
- `archetypeReportPayment`；
- `adminManage`；
- `processReferralJobs`；
- `referralCommission`；
- `contentSecCallback`。

报告支付/退款关键入口的 `archetype-report-access.js` 在根目录、`archetypeReportPayment`、`adminManage` 和 `contentSecCallback` 中一致。其他不直接参与当前支付/退款入口的函数仍存在副本漂移，交付前需要判断是否安全执行全量同步，避免覆盖函数专有扩展。

## 7. 复审验收门槛

只有满足以下全部条件，现金分佣才可重新提交启用审查：

1. P0-1 退款冲正具备事务一致性或持久化补偿 job；
2. P0-2 恢复扫描可遍历超过单批上限的全部订单；
3. 后台提现成功、失败和幂等测试通过；
4. 支付时配置快照失败不会使用未来配置；
5. 运维命令能真实暂停和恢复 `referral.commission`；
6. 用户端和后台财务统计不受 1000 条限制；
7. 匿名和邀请码未就绪状态不会生成无归因链接；
8. 所有新增失败场景测试通过；
9. `npm.cmd run test:regression` 全量通过；
10. `npm.cmd run build:h5` 与 `npm.cmd run build:mp-weixin` 再次通过；
11. 沙箱执行小额充值、套餐、报告道具、冻结期退款、解冻后退款和提现完整闭环；
12. 重新保存触发器、索引、配置状态和账本一致性审计证据。

## 8. 建议修复顺序

1. 先关闭或确认未开启 `referral.commission.enabled`，停止现金分佣继续扩散；
2. 修复退款冲正持久化补偿；
3. 修复 worker 恢复扫描游标；
4. 修复提现 `_id` 与运维暂停配置路径；
5. 修复配置快照 fail-open；
6. 补充对应失败场景和后台 action 测试；
7. 修复统计、分页、分享门控与规则文案；
8. 跑全量测试和双端构建；
9. 在沙箱做真实支付/退款/提现闭环；
10. 完成复审后再决定是否灰度启用。

---

本报告仅执行审计和只读云端核对，没有修改业务代码、云端配置或生产环境。
