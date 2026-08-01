# 邀请奖励结算统一修复计划

> 状态：**计划（未实施）** — 经用户确认，本次只写方案、不改代码。
> 关联案例：邀请人 `user_1785335759151_a42a7d8f`（邀请码 N26HRD）分享后，被邀请人 `user_1785393550039_496d6e27` 注册，但后台「邀请奖励」面板无任何记录。

---

## 1. 问题背景与根因（已查库验证）

### 1.1 线上案例证据链

| # | 环节 | 证据（数据库查询结果） |
|---|---|---|
| 1 | 分享路径缺邀请码 | `share_visits` 匿名记录：`shareId=s_ms7579a0_7mwqaz, channel=analysis_share, scene=low, inviteCode=""`（被邀请人打开瞬间 16:39:08 上报） |
| 2 | 被邀请人落地无码 | users：`landingInviteCode=""`、`invitedBy=null`、`referralCount=0` |
| 3 | 结算条件未命中 | `wechatLogin/index.js:392` 仅当 `isNewUser && inviteCodeParam` 时调 `settleReward` → 分支从未执行 |
| 4 | 无任何结算痕迹 | `referral_claims` 无该被邀请人记录；双方 `call_usage_records` 无 `referral_inviter/referral_invitee` 发放；邀请人 `referralCount=0` |

**结论**：分享 URL 里没有 `inviteCode` 参数 → 后端从未收到邀请码 → `settleReward` 从未被调用 → 后台面板（读 `referral_claims`）自然看不到。

**分享路径为什么缺码**：`src/utils/share.js appendReferralParams()` 中 inviteCode 是**条件分支**——`getMyInviteCode()` 读 `uni.getStorageSync('currentUser')?.inviteCode`，为空就不拼参数。channel / scene / shareId 是无条件拼的（被邀请人记录证明路径确实经过该函数），唯独 inviteCode 缺失。最可能原因：邀请人设备上 `currentUser` 缓存不含 inviteCode（客户端版本早于 2026-06-20 的 拉新体系 v1.1（57fb35e），或缓存未刷新）。

### 1.2 代码层问题清单

**P0 — 三套结算实现并存，写库不一致**

| 实现 | 调用方 | 写 referral_claims | 更新 referralCount | 更新 invitedBy | 周上限 | 试用延长 |
|---|---|---|---|---|---|---|
| `_shared/referral-settlement.js settleReward` | wechatLogin:398 / register | ✅ | ❌ | ❌ | ❌ | ❌ |
| `_shared/subscription.js redeemInviteCode`(:627) | **死代码**（仅 import 无调用） | ❌ | ✅ | ✅ | ✅ | ✅ |
| `_shared/subscription.js finalizePendingReferral`(:705) | createTimeline | ❌ | ✅ | ✅ | ✅ | ✅ |

后果：即使邀请码流程正常走通，**后台面板（referral_claims）有记录，但 me 页「已邀请 N 人」（referralCount）不涨、被邀请人 `invitedBy` 不标记、`finalizePendingReferral` 永不触发**——两个展示层数据源互相脱节。

**P1 — 分享路径无法保证携带邀请码**

- `appendReferralParams()` 依赖 storage 里的 `currentUser.inviteCode`，缓存缺失时静默漏拼参数，无任何兜底。
- me.vue:333（邀请卡片分享）走 `appendReferralParams`，同样受影响；me.vue:336（onShareTimeline）却已用后端拉取的 `subInviteCode` —— **同页两个分享入口行为不一致**。

**P2 — 死配置与死代码**

- `requireFirstEvent: true`（subscription.js:118 默认值，线上 settings_subscription 已配置）**没有任何代码读取**——配置了但不生效。当前实际行为是"注册即发"，与配置语义（首条事件后发）不符。
- `_shared/subscription.js:627 redeemInviteCode()` 从未被调用，是死代码（standalone 云函数 `redeemInviteCode` 实际用的是 referral-settlement）。

---

## 2. 修复目标

1. **单一结算实现**：新增统一结算函数，任何入口（wechatLogin / register / redeemInviteCode 云函数 / finalizePendingReferral）都走它，一次调用同时完成：幂等检查 → 周上限 → 写 `referral_claims` → 发双方 Token → `referralCount`/`referralWeekCount` 自增 → `invitedBy`/`invitedByCode` 标记 → 试用期延长。
2. **分享路径保证带邀请码**：邀请码缺失时前端不静默漏拼；分享前尽量从后端已拉取的数据兜底。
3. **明确 `requireFirstEvent` 语义并落实**（见决策点 D1）。
4. **不迁移历史、不批量改库**：本次线上案例手工处理另行决策（当前已确认暂不补）。

## 3. 本期不做

- 不修改 `settings_subscription` / `settings_billing` 等云端配置（用户记忆规则：禁止覆盖云端配置）。
- 不批量补录历史 `referral_claims`。
- 不改动「邀请到账通知」（me.vue:70-76 展示逻辑，依赖 referralCount 对比，统一后自动恢复正确）。
- 不在本期实现"分享访问归因到邀请人"的模糊归因（无邀请码时无法可靠判断邀请人，宁缺毋滥）。

---

## 4. 后端设计

### 4.1 新增统一结算函数

文件：`cloudfunctions/_shared/referral-settlement.js`（在现有 settleReward 基础上扩展，保持导出兼容）

```javascript
async function settleReferralReward(db, {
  inviteeUserId,     // 被邀请人
  inviterUserId,     // 邀请人（查询 inviteCode 后得出）
  inviteCode,        // 邀请码原文
  shareId = '',      // 分享 ID（可为空）
  channel = '',      // 渠道：invite_code / analysis_share / we_card ...
  now = new Date()
}) {
  // 1. 自邀请拦截（inviteeUserId === inviterUserId）
  // 2. 幂等：referral_claims 按 inviteeUserId 查重（_id = inviteeUserId 天然幂等）
  // 3. 读取 settings_subscription.referral 配置（enabled / 金额 / 周上限 / requireFirstEvent / trialExtendDays）
  // 4. 周上限：inviter.referralWeekStart + referralWeekCount 滚动窗口检查（复用现有 getWeekStart 逻辑）
  // 5. 写 referral_claims：_id=inviteeUserId, 双方 user 字段, inviteCode/shareId/channel, status（见 D1）, inviterTokens/inviteeTokens, rewardedAt/createdAt/updatedAt
  // 6. 发 Token：addExtraTokens(inviterUserId, inviterReward, `referral_inviter:${inviteeUserId}`)
  //             addExtraTokens(inviteeUserId, inviteeReward, `referral_invitee:${inviteeUserId}`)
  // 7. 更新邀请人：referralCount +1、referralWeekStart、referralWeekCount +1、试用期延长（free 用户）
  // 8. 更新被邀请人：invitedBy=inviterUserId、invitedByCode=inviteCode
  // 返回 { success, inviterReward, inviteeReward, status }
}
```

要点：

- **保持 `settleReward` 作为兼容壳**（转发到新函数），避免一次大改 all 调用点；后续再逐步让调用方直接使用新函数。
- **写库顺序**：claim 先写（幂等锚点），Token 发放失败不阻塞 claim 落库，错误可重放（claim 已存在则跳过）。
- **`referral_inviter:`/`referral_invitee:` 的 remark 带 inviteeUserId 后缀**（与现有 settleReward 一致），用于对账。
- 幂等依据 `referral_claims` 而非 `call_usage_records`（现状 finalizePendingReferral 用 usage 记录查重，两套标准统一为 claim 查重）。

### 4.2 修改调用方

| 文件 | 改动 |
|---|---|
| `cloudfunctions/wechatLogin/index.js` | 新用户 + 有效 inviteCode 时调 `settleReferralReward`（替换直接调 settleReward）；保持 try/catch 非致命 |
| `cloudfunctions/register/index.js` | 同上（H5 邮箱注册带邀请码时） |
| `cloudfunctions/redeemInviteCode/index.js`（standalone） | 改调统一函数（行为对齐：补 referralCount / invitedBy） |
| `cloudfunctions/_shared/subscription.js` | **删除死代码 `redeemInviteCode()`（:627-703）**；`finalizePendingReferral()` 改为：从 `referral_claims` 查被邀请人的 claim，若 claim 存在且 status 为延迟发放态（见 D1）则补发 Token 并置 rewarded；若 claim 不存在则调用统一函数结算（兜底旧数据 invitedBy 场景） |
| `cloudfunctions/createTimeline/index.js` | 保持调用 `finalizePendingReferral`（位置不变，内部逻辑替换） |

### 4.3 决策点 D1：requireFirstEvent 语义

现状：配置 `requireFirstEvent: true`（线上已配置），但实际"注册即发"，配置未生效。

- **方案 A（推荐，行为变化最小）**：统一后按当前实际行为——注册即发，`requireFirstEvent` 继续只作配置占位；在计划中标注"配置与实现不符"，后续单独产品决策。
- **方案 B（按配置语义实现）**：claim 先写 `status='pending'`，首条事件后（finalizePendingReferral 经 createTimeline 触发）再发 Token 并置 `status='rewarded'`。改动面大，且依赖用户先产生事件才拿到奖励，产品体验风险高。

> 需要用户拍板。推荐 A。B 需单独排期。

---

## 5. 前端设计

### 5.1 分享路径保证带邀请码

文件：`src/utils/share.js`

1. `appendReferralParams(path, channel, scene, extra = {})` 增加可选参数 `extra.inviteCode`（显式传入优先）。
2. `getMyInviteCode()` 增加兜底读取链：`storage currentUser.inviteCode` → `storage subInviteCode`（me.vue 已缓存）→ `storage cachedProfile 相关字段`；仍为空时返回 ''（分享仍继续，不阻塞用户，但后端侧保持"宁缺毋滥"）。
3. 新增 `ensureInviteCodeCached()`（异步）：调 `getSubscriptionStatus()` 拿到 `inviteCode` 写入 storage，供分享前预热。

### 5.2 调用点改造

| 文件 | 改动 |
|---|---|
| `src/pages/me/me.vue` | onShareAppMessage(:333) 改用 `subInviteCode` 显式传入（与 onShareTimeline(:336) 行为对齐）；邀请卡片分享前调 `ensureInviteCodeCached()` |
| `src/pages/index/index.vue` | onShareAppMessage(:2038 quick-read 分享) 分享前预热 inviteCode 缓存 |
| `src/pages/case-detail/case-detail.vue` | onShareAppMessage(:323) 同上 |
| 其他调用 `appendReferralParams` 的页面 | 只升级函数签名，调用方默认不传即可（向后兼容） |

---

## 6. 测试计划

| # | 场景 | 预期 |
|---|---|---|
| T1 | 新用户带邀请码注册（wechatLogin） | referral_claims 一条（status rewarded 或 pending 按 D1）；双方 Token 到账；邀请人 referralCount+1、referralWeekCount+1；被邀请人 invitedBy 标记 |
| T2 | 同一被邀请人重复结算（并发/重复调用） | 幂等：只发一次，claim 唯一 |
| T3 | 自邀请 | 拦截，不写任何记录 |
| T4 | 周上限达到（weeklyInviteCap=100） | 拒绝并返回明确 message |
| T5 | 邀请码无效 | 不结算，登录流程不受影响 |
| T6 | H5 邮箱注册带邀请码（register） | 同 T1 |
| T7 | 被邀请人首条事件后（finalizePendingReferral） | 按 D1：A 方案下不重复发；B 方案下补发一次 |
| T8 | 旧数据兼容（已有 invitedBy 但无 claim 的老用户） | finalizePendingReferral 走统一函数补齐 claim，不重复发 Token |
| T9 | admin 邀请奖励面板 | 新结算出现在列表，双方金额与配置一致 |
| T10 | me 页「已邀请 N 人」与后台面板 | 两处数字一致（修复后 referralCount 由统一函数维护） |

回归：`npm run test:regression`；无云函数结构变化，`npm run sync:shared` 后确认各函数 `_shared` 副本同步。

---

## 7. 文件改动汇总

后端：

```text
cloudfunctions/_shared/referral-settlement.js  修改：新增 settleReferralReward
cloudfunctions/_shared/subscription.js         修改：删除死代码 redeemInviteCode；重写 finalizePendingReferral
cloudfunctions/wechatLogin/index.js            修改：调用统一函数
cloudfunctions/register/index.js               修改：调用统一函数
cloudfunctions/redeemInviteCode/index.js       修改：调用统一函数
cloudfunctions/createTimeline/index.js         不改（链路不变）
（同步副本由 npm run sync:shared 生成）
```

前端：

```text
src/utils/share.js         修改：appendReferralParams 增强 + getMyInviteCode 兜底 + ensureInviteCodeCached
src/pages/me/me.vue        修改：邀请分享显式传 inviteCode
src/pages/index/index.vue  修改：分享前预热 inviteCode
src/pages/case-detail/case-detail.vue  修改：分享前预热 inviteCode
```

---

## 8. 部署顺序（遵循现有流程：本地验证 → dev → 用户确认 → 生产）

1. 本地：`npm run sync:shared` + `npm run test:regression` + 手动链路测试（T1-T10）。
2. dev 环境部署：`redeemInviteCode`、`wechatLogin`、`register`、`createTimeline`（含同步副本）→ 用户验证。
3. 用户确认后部署生产。
4. 前端 H5/小程序构建发布在云函数稳定后。

---

## 9. 回滚

- 代码回滚即可：新函数未被调用时线上行为回到现状（claim + 发 Token，referralCount 不更新——即现状）。
- 数据库无迁移、无结构变更，无需回滚脚本。
- 已产生的 `referral_claims` / Token 记录保留，不回退。

---

## 10. 遗留问题（需用户另行决策）

1. **线上案例补结算**：`user_1785335759151_a42a7d8f`（+50）与 `user_1785393550039_496d6e27`（+100）是否手工补录（当前已确认暂不补）。
2. **D1（requireFirstEvent 语义）**：按当前行为（注册即发）还是按配置语义（首事件后发）。
3. **分享归因增强**：是否接受"分享链接必须携带邀请码"的产品约束（即：老客户端分享的链接天然无法归因，只能靠用户手动填邀请码）。
4. **me.vue「邀请好友」入口**：是否需要改为"复制带邀请码的链接"按钮（H5 场景下 onShareAppMessage 无效，现在 H5 用户无法通过该入口邀请）。
