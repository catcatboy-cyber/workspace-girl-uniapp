# 心动人设局分享结果与快速测试开发方案

版本：v1.5（最终本地审计修订版）
日期：2026-08-06
状态：编码、自动化、双端构建及沙箱部署完成，待微信开发者工具真实账号验收
关联方案：`HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md` v2.1
视觉原型：`design-mockups/heart-persona-share-landing.html`

## 1. 开发目标

把现有三个测试模块的结果分享，从“分享后直接重新开始测试”改成真正的结果分享闭环：

1. 好友打开分享卡片后，先看到分享者主动公开的结果落地页；
2. 好友点击“我也测测”；
3. 只选择“测自己 / 测 TA”和“男 / 女”；
4. 不要求创建 Crush，不要求补完整本人画像或 Crush 画像；
5. 直接进入与分享结果相同类型的测试；
6. 答题结束后继续使用现有免费预览、`¥1.99` 单次解锁和 Pro 升级链路；
7. 支付或升级成功后先查看完整结果，不强制跳走；
8. 结果页提供“进入主页”CTA；点击后复用现有小咪新用户 onboarding，再承接到小程序主程序。

本方案覆盖：

- 关系女主角；
- 关系男主角；
- Crush 名人图鉴；
- 次元角色图鉴。

关系男主角和关系女主角在代码中继续共用 `kind=relation_archetype`、权限键 `关系女主角` 和同一结果页，只通过 `subjectGender` 区分。

## 2. 锁定的产品规则

以下规则不得由开发人员自行修改：

1. 分享入口使用“测自己 / 测 TA”，不使用“测当前 Crush”。
2. 分享快速测试中的 TA 是临时测试对象，不绑定主程序中的当前 Crush。
3. 快速测试只收集：
   - `mode=self|target`；
   - `subjectGender=female|male`。
4. 快速测试不收集姓名、年龄、星座、职业、头像和完整关系画像。
5. 快速测试不创建 `cases`，不更新 `activeCaseId`，不写入 Crush 时间轴。
6. 主程序内部原有测试入口规则保持不变：
   - `target` 仍然表示当前 Crush；
   - 必须有本人或 Crush 画像性别；
   - 测试页面内不能更换 Crush。
7. 服务端读取题库和保存结果时用户必须已有有效身份；微信小程序分享链路统一使用静默登录，不能用显式登录页打断选择或答题。
8. 单次解锁继续使用：
   - `mode=short_series_goods`；
   - `productId=0001`；
   - `199` 分，即 `¥1.99`；
   - 一笔订单只解锁一个 `resultId`。
9. Pro、Ultra、试用期是否直接拥有完整报告，继续由后台 `features/excludedFeatures` 动态决定。
10. 免费用户是否允许先答题后付费，继续由现有 `resolveQuizAccess` 和付费漏斗配置决定；分享链接不得绕过后台功能权限。
11. 支付成功后停留在结果页并刷新完整报告，不能直接把用户跳到首页。
12. 结果页始终提供主页 CTA：
    - 预览状态：弱按钮“先去主页看看”；
    - 完整状态：主按钮“进入主页”。
13. 点击主页 CTA 时不得新增画像强制模式或另一套画像页面，必须复用现有 `/pages/self-profile/self-profile?mode=onboarding`。
14. 本人画像已完成，或用户已经在原 onboarding 中选择过“先跳过”时，直接进入首页。
15. 本人画像未完成且没有跳过记录时，先进入现有小咪聊天提问流程；保存或跳过后由该页面原逻辑进入首页。
16. 分享快速测试中选择的性别只用于本次测试，不自动写入本人画像；小咪 onboarding 继续按原流程询问用户本人信息。
17. 分享者的答案、完整维度、风险建议、完整排序和私密 Crush 信息不得出现在分享接口中。
18. 本功能尚未正式上线，不做历史数据迁移；旧结果缺少新字段时按普通入口结果处理。

## 3. 当前代码现状与缺口

### 3.1 当前结果分享不是分享结果

三个结果页当前 `onShareAppMessage` 指向答题页：

- `relation-heroine-result.vue` → `/pages/relation-heroine/relation-heroine?mode=self`；
- `crush-celebrity-result.vue` → `/pages/crush-celebrity/crush-celebrity?mode=self`；
- `dimension-character-result.vue` → `/pages/dimension-character/dimension-character?mode=self`。

缺口：没有分享结果记录、没有公开结果 DTO、没有分享落地页。

### 3.2 当前 target 强制依赖 caseId

`cloudfunctions/saveArchetypeResult/index.js` 当前规则：

```js
if (mode === 'target' && !caseId) return error('CASE_NOT_FOUND', '请先选择当前 Crush')
```

并且会读取 `cases.profile.gender` 校验被测对象性别。

缺口：分享快速测试无法提交临时 TA。

### 3.3 当前测试页会主动要求画像

- 关系主角测试会读取本人画像或当前 Crush 画像；
- 名人、次元测试会在性别未知时提示补全画像；
- `target` 缺少当前 Crush 时会跳转 Crushes。

缺口：分享拉新场景会被完整画像和 Crush 建档打断。

### 3.4 当前结果页缺少主页 CTA

现有结果页主要提供重新测试、分享和历史记录，没有统一“进入主页”。

### 3.5 当前 Pro 返回链路不会自动刷新报告

`HeartPersonaReportPaywall` 跳转订阅页后，结果页 `onShow` 没有统一重新调用 `getArchetypeReport`。升级成功返回时可能仍显示旧预览。

## 4. 用户流程

### 4.1 分享者生成分享

```text
结果页加载
  -> prepareArchetypeResultShare(resultId)
  -> 服务端确认结果属于当前用户
  -> 生成或复用 resultShareId
  -> shareReady=true
  -> 开放“分享结果”按钮
```

分享路径：

```text
/pages/heart-persona-share/heart-persona-share?resultShareId=随机不可猜值
```

然后继续通过 `appendReferralParams` 追加：

```text
inviteCode
channel=heart_persona_result
scene
shareId（现有 referral 归因 ID，不能覆盖 resultShareId，见 8.4）
```

注意：现有 `appendReferralParams` 已经占用 `shareId` 作为一次分享归因 ID。结果分享记录不得继续使用同名参数。本文固定：

- `resultShareId`：结果分享记录 ID；
- `shareId`：现有 referral 一次分享归因 ID。

最终路径示例：

```text
/pages/heart-persona-share/heart-persona-share
  ?resultShareId=hps_xxx
  &inviteCode=XXXXXX
  &channel=heart_persona_result
  &shareId=s_xxx
```

### 4.2 被分享者打开落地页

```text
打开落地页
  -> captureLandingContext(options)
  -> 启动或等待静默登录
  -> getArchetypeSharedPreview(resultShareId)
  -> 展示分享者公开结果
```

身份仍在建立时可以显示加载骨架；微信小程序继续在后台复用同一个静默登录任务，不跳显式登录页。进入快速测试页后继续等待身份与题库，提交前再次兜底；若网络失败，必须保留草稿，不得要求用户重新答题。H5 非微信环境仍可保留现有显式登录能力。

### 4.3 点击“我也测测”

弹出两步底部面板：

第一步：

```text
测自己
测 TA
```

第二步：

```text
女生
男生
```

不提供“未知”“暂不说”“其他”。选择性别后立即进入对应测试题，不再增加“确认本次测试”或第二次“开始测试”。

### 4.4 开始快速测试

落地页根据分享结果的 `kind` 跳转同类测试：

| kind | 路由 |
| --- | --- |
| `relation_archetype` | `/pages/relation-heroine/relation-heroine` |
| `crush_celebrity` | `/pages/crush-celebrity/crush-celebrity` |
| `dimension_character` | `/pages/dimension-character/dimension-character` |

统一查询参数：

```text
entryMode=share_quick
resultShareId=...
mode=self|target
subjectGender=female|male
```

关系主角示例：

```text
/pages/relation-heroine/relation-heroine
  ?entryMode=share_quick
  &resultShareId=hps_xxx
  &mode=target
  &subjectGender=female
```

关系主角的关系阶段选择、6 道筛选、15 道专属题和 3 道情景题仍按现有流程执行。阶段选择属于测试内容，不属于画像 onboarding。

### 4.5 答题结束与付费

```text
提交答案
  -> saveArchetypeResult(entryMode=share_quick)
  -> 服务端验证 resultShareId
  -> 服务端评分并创建新的 resultId
  -> 结果页读取 preview/full
```

免费预览继续显示现有 `HeartPersonaReportPaywall`：

- `¥1.99 解锁本次完整报告`；
- `升级 Pro · 所有已开放测试直接看完整报告`；
- 弱按钮 `先去主页看看`。

单次购买成功：

```text
HeartPersonaReportPaywall emits unlocked
  -> 结果页 loadReport()
  -> 展示完整报告
  -> 展示主按钮“进入主页”
```

Pro 购买成功：

```text
订阅页确认权益成功
  -> navigateBack 返回结果页
  -> 结果页 onShow 调用 loadReport()
  -> 展示完整报告
  -> 展示主按钮“进入主页”
```

支付结果仍在确认时不得假定已解锁，不得 fail open。

### 4.6 从结果页进入主页

用户点击“进入主页”或“先去主页看看”后：

```text
读取当前本人画像
  -> shouldCompleteSelfProfile(profile) = false
       -> 已完成或此前已选择跳过
       -> switchTab 进入首页
  -> shouldCompleteSelfProfile(profile) = true
       -> navigateTo 现有 self-profile?mode=onboarding
       -> 用户保存或点击“先跳过”
       -> 由现有 self-profile.goNext() switchTab 进入首页
```

不得在结果页复制画像表单，不得新增 `required_home`、`force_profile` 等新模式，也不得隐藏或改变现有 onboarding 的“先跳过”行为。

## 5. 入口模式定义

新增统一类型：

```ts
type ArchetypeEntryMode = 'standard' | 'share_quick'
```

定义：

| entryMode | self 性别来源 | target 对象 | target 是否要求 caseId |
| --- | --- | --- | --- |
| `standard` | `users.selfProfile.gender` | 当前 Crush | 是 |
| `share_quick` | 本次显式选择 | 临时 TA | 否，且禁止传入 |

前端 URL 缺少 `entryMode` 时一律按 `standard`。

后端事件缺少 `entryMode` 时一律按 `standard`，不得根据是否有 `caseId` 自动猜测。

## 6. 数据模型

### 6.1 新增集合 `archetype_result_shares`

```js
{
  _id: 'sha256(heart-persona-share|ownerUserId|resultId)',
  resultShareId: 'hps_ + 32字节随机值的base64url或hex',
  ownerUserId,
  resultId,
  kind,
  status: 'active' | 'revoked',
  createdAt,
  updatedAt,
  revokedAt: null,
  revokeReason: ''
}
```

规则：

1. 不在分享表复制完整报告和答案；读取分享页时由服务端从原结果和对应题库生成公开 DTO。
2. 同一个 `userId + resultId` 只保留一个有效分享记录。
3. `resultShareId` 必须使用密码学安全随机数，不能使用递增 ID、时间戳或可猜测 resultId。
4. 分享记录不赋予完整报告访问权。
5. `_id` 使用确定性哈希，只在服务端计算且永不返回客户端，用于保证同一结果只有一条分享记录。
6. `prepareShare` 必须在数据库事务中按 `_id` 读取和写入：
   - 记录不存在：创建并生成新的 `resultShareId`；
   - 记录为 active：幂等返回现有 `resultShareId`；
   - 记录为 revoked：生成新的 `resultShareId`、改回 active 并清空撤销字段；
   - 并发请求必须最终返回同一个事务提交后的 `resultShareId`。
7. revoked 后重新分享会生成新链接；旧 `resultShareId` 因不再存在于任何记录中而永久失效。

索引：

- `resultShareId` 唯一；
- `ownerUserId + createdAt`；
- `status + updatedAt`。

`_id` 使用数据库内置唯一约束，不再额外创建 `shareKey` 字段和索引。

### 6.2 扩展 `archetype_results`

快速测试结果增加：

```js
{
  entryMode: 'share_quick',
  sourceResultShareId: 'hps_xxx',
  sourceResultId: '原分享结果ID，仅服务端归因使用',
  subjectType: 'self' | 'temporary_target',
  subjectLabel: '你' | 'TA',
  subjectGender: 'female' | 'male',
  caseId: undefined,
  caseSnapshot: undefined
}
```

普通结果增加或默认：

```js
entryMode: 'standard'
```

不执行历史回填。读取旧结果时：

```js
entryMode = result.entryMode === 'share_quick' ? 'share_quick' : 'standard'
```

### 6.3 不改支付订单数据结构

`archetype_report_orders` 继续按 `resultId` 解锁。快速测试结果没有 `caseId` 不影响支付校验，因为订单归属依据是：

- 当前登录用户；
- `archetype_results.userId`；
- `resultId`；
- `kind/subjectGender/featureKey`。

不得为分享快速测试新增第二套道具或第二套订单集合。

## 7. 服务端接口设计

为了减少新云函数数量，扩展现有 `getArchetypeReport`，通过 `action` 区分。原调用不传 `action` 时保持现有行为。

### 7.1 `getArchetypeReport` 默认行为

原请求保持：

```json
{
  "resultId": "..."
}
```

等同于：

```json
{
  "action": "getOwnedReport",
  "resultId": "..."
}
```

仍然要求结果属于当前登录用户。

### 7.2 `prepareShare`

请求：

```json
{
  "action": "prepareShare",
  "resultId": "..."
}
```

校验顺序：

1. `requireAuthenticatedUserId`；
2. 结果存在；
3. `result.userId === currentUserId`；
4. `kind` 为三种支持类型；
5. 计算服务端专用 `_id=sha256(heart-persona-share|userId|resultId)`；
6. 在数据库事务中读取该 `_id`；
7. active 记录幂等返回；不存在则创建；revoked 则生成新 `resultShareId` 后重新激活；
8. 事务返回最终已提交的 `resultShareId`，不得先返回尚未提交的随机值。

响应：

```json
{
  "success": true,
  "data": {
    "resultShareId": "hps_xxx",
    "kind": "crush_celebrity"
  }
}
```

不得返回完整报告、答案、caseId、ownerUserId 或内部确定性文档 `_id`。

### 7.3 `getSharedPreview`

请求：

```json
{
  "action": "getSharedPreview",
  "resultShareId": "hps_xxx"
}
```

要求当前用户已通过静默或显式登录，但不要求是结果所有者。

处理顺序：

1. 校验 `resultShareId` 格式和长度；
2. 查 active 分享记录；
3. 查原始结果；
4. 查结果对应版本题库；
5. 动态计算结果所有者当前是否拥有 full 权限；
6. 组装严格公开 DTO。

公开 DTO：

```json
{
  "success": true,
  "share": {
    "resultShareId": "hps_xxx",
    "kind": "relation_archetype",
    "mode": "target",
    "subjectGender": "female",
    "displayTitle": "关系女主角",
    "sharer": {
      "displayName": "小雨或一位朋友",
      "avatarUrl": "可选公开头像"
    },
    "primary": {
      "key": "...",
      "name": "冉XX型",
      "label": "关系主导型",
      "coverUrl": "可选"
    },
    "scoreDisplay": {
      "type": "exact或band",
      "exact": 87,
      "band": { "min": 85, "max": 89, "label": "约85%-89%" }
    },
    "summary": "公开的一句话摘要",
    "tags": ["护短行动派", "关系主导型", "高投入高要求"],
    "createdAt": "..."
  }
}
```

精确百分比规则：

- 原结果所有者当前拥有 full 权限时，`type=exact`；
- 原结果所有者当前只有 preview 权限时，`type=band`，不返回 `exact`；
- 退款、套餐到期或权限撤销后再次读取分享页，必须动态降级为 `band`。

分享页永远不得返回：

- `answers/scenarioAnswers`；
- `dimensions/dimensionScores`；
- `similarities/topFive/secondary`；
- `decision/evidence/watchSignals/communicationAdvice`；
- `caseId/caseSnapshot`；
- 精确付费订单和权限字段。

`sharer` 只允许从用户公开展示字段中读取：

- `selfProfile.nickname` 或用户公开昵称；
- `selfProfile.avatarUrl` 或用户公开头像；
- 缺少公开昵称时固定显示“一位朋友”。

不得返回邮箱、手机号、登录账号、openid、邀请码或任何后台身份字段。

`tags` 使用现有公开题库字段确定性生成，去重后最多 3 个：

- 关系主角：人物 `label`、关系阶段公开 `label`、关系男/女主角展示标题；
- 名人/次元：人物 `category`、`era`、`source`；
- 字段为空时允许少于 3 个，不得为了凑数调用 AI 或使用硬编码人物标签。

### 7.4 分享公开投影 helper

在 `_shared/archetype-report-projection.js` 新增：

```js
buildSharedReportPreview(result, bankContent, ownerAccess, ownerPublicProfile)
```

禁止直接复用 `buildFullReport` 后在末尾删除字段；必须从允许字段白名单开始构建，避免以后新增完整报告字段时意外泄漏。

### 7.5 `saveArchetypeResult` 快速模式契约

快速模式请求示例：

```json
{
  "kind": "crush_celebrity",
  "entryMode": "share_quick",
  "resultShareId": "hps_xxx",
  "mode": "target",
  "subjectGender": "female",
  "contentVersion": "v1",
  "answers": []
}
```

快速模式校验：

1. 当前用户必须登录；
2. `resultShareId` 必须存在且 active；
3. 分享记录原结果的 `kind` 必须等于本次提交的 `kind`；
4. `mode` 必须为 `self|target`；
5. `subjectGender` 必须为 `female|male`；
6. 快速模式禁止传 `caseId`；
7. 不读取本人画像或 Crush 画像校验性别；
8. 继续执行 `resolveQuizAccess`；
9. 继续校验已发布题库版本和 checksum；
10. 继续使用现有服务端评分函数；
11. 结果写入 `entryMode/subjectType/sourceResultShareId/sourceResultId`；
12. 返回值仍然只有 `success/resultId/kind`。

普通模式校验保持原样：

- self 读取 `users.selfProfile.gender`；
- target 强制 `caseId` 并校验 case 所有权；
- 客户端声明性别必须与画像一致。

建议把模式分支明确写成：

```js
if (entryMode === 'share_quick') {
  // valid share + no case + explicit gender
} else {
  // existing profile/case validation, unchanged
}
```

不得通过删除现有 `target && !caseId` 校验让所有 target 都变成无 case 模式。

### 7.6 错误码

新增：

| code | 文案 | 前端处理 |
| --- | --- | --- |
| `SHARE_NOT_FOUND` | 分享结果不存在或已失效 | 落地页显示失效态和“去主页看看” |
| `SHARE_KIND_MISMATCH` | 分享来源与测试类型不一致 | 停止提交，不自动换 kind |
| `QUICK_CASE_FORBIDDEN` | 快速测试不能绑定 Crush | 停止提交并记录错误 |
| `GENDER_REQUIRED` | 请选择被测对象性别 | 返回落地页选择层 |
| `AUTH_REQUIRED` | 请先登录 | 显式登录并带 redirect |

现有错误码继续使用：

- `FEATURE_NOT_AVAILABLE`；
- `CONTENT_VERSION_MISMATCH`；
- `INSUFFICIENT_OBSERVATION`；
- `REPORT_ALREADY_UNLOCKED`；
- `REPORT_ALREADY_AVAILABLE`。

## 8. 前端页面开发

### 8.1 新增分享落地页

新增：

```text
src/pages/heart-persona-share/heart-persona-share.vue
```

注册到 `src/pages.json`，不是 tabBar 页面。

页面状态：

```ts
type ShareLandingState =
  | 'loading_auth'
  | 'loading_share'
  | 'ready'
  | 'select_subject'
  | 'select_gender'
  | 'starting'
  | 'share_invalid'
  | 'auth_required'
  | 'error'
```

页面内容按 `design-mockups/heart-persona-share-landing.html` 实现：

- 品牌头部；
- 分享者公开身份；
- 第一人物/原型；
- 精确百分比或相似度区间；
- 一句话摘要；
- 公开标签；
- 私密完整报告遮罩；
- 人物池预告；
- 固定底部“我也测测”。

视觉原型中的固定示例数据必须全部替换为 `getSharedPreview` DTO，不得在生产页面硬编码“冉XX型”“87%”和人数。

当前系统没有可信的累计参与人数接口，因此 v1 不显示“128,630 人已经测过”等数字。后续如果需要，必须新增服务端聚合统计，不能使用前端常量。

### 8.2 选择层

第一步按钮：

```text
测我自己
测 TA
```

第二步按钮：

```text
女生
男生
```

选择完成后显示确认摘要：

```text
正在测试：TA · 女生
```

主按钮：

```text
开始测试
```

切换选择只影响本次快速测试，不写入 `selfProfile`，不创建 Crush。

### 8.3 登录与返回

落地页 `onLoad`：

1. 保存 `resultShareId`；
2. `captureLandingContext(options)`；
3. 启动或复用全局单例静默登录任务；
4. 身份完成后读取分享 DTO；
5. 选择性别后直接跳转测试页；测试页在极少数身份仍写入时继续无感等待，提交前保存草稿并兜底鉴权。

H5 显式登录 redirect 必须保留：

- `resultShareId`；
- 已选 `mode`；
- 已选 `subjectGender`。

可以把选择暂存在页面 query 或专用本地键：

```text
heartPersonaShareSelection:<resultShareId>
```

登录成功并返回后恢复。成功进入答题页后删除该选择缓存。

### 8.4 Referral 参数冲突修复

现有 `landing.ts` 和 `appendReferralParams` 使用 `shareId` 表示归因 ID。本功能必须：

- 使用 `resultShareId` 表示结果分享记录；
- 保留 `shareId` 表示 referral 点击链路；
- `captureLandingContext` 继续只捕获 referral `shareId`；
- 新落地页单独读取 `options.resultShareId`。

不得把结果分享 ID 写入 `landingContext.shareId`，否则会污染邀请归因。

## 9. 三个答题页改造

需要修改：

- `src/pages/relation-heroine/relation-heroine.vue`；
- `src/pages/crush-celebrity/crush-celebrity.vue`；
- `src/pages/dimension-character/dimension-character.vue`。

### 9.1 onLoad 参数

统一解析：

```ts
entryMode = options.entryMode === 'share_quick' ? 'share_quick' : 'standard'
resultShareId = String(options.resultShareId || '')
mode = options.mode === 'target' ? 'target' : options.mode === 'self' ? 'self' : ''
subjectGender = normalizeRelationGender(options.subjectGender)
```

### 9.2 初始化规则

快速模式：

1. `mode` 必须已选；
2. `subjectGender` 必须已选；
3. 不调用 `getActiveCaseId()`；
4. 不调用 `getCaseDetail()`；
5. 不调用 `getSelfProfile()`；
6. 不显示“补全画像”或“去 Crushes”；
7. 直接加载对应题库；
8. 页面标题使用“你”或“TA”，不显示当前 Crush 名称。

普通模式保持当前实现。

### 9.2.1 名人与次元人物池性别过滤

`crush-celebrity.vue` 和 `dimension-character.vue` 必须维护已确定的 `subjectGender`，并同时用于：

- 服务端评分提交；
- “看看人物池”列表；
- 人物数量统计；
- 人物详情入口可见范围。

`enabledPeople` 固定改为：

```ts
const enabledPeople = computed(() =>
  (content.value.people || []).filter((person: any) =>
    person.enabled !== false &&
    normalizeRelationGender(person.gender) === subjectGender.value
  )
)
```

快速模式直接使用 URL 中已校验的 `subjectGender`；普通模式从本人画像或当前 Crush 画像解析后写入同一个 `subjectGender` ref。不得只在服务端评分时过滤，否则人物池会向用户展示不可能成为结果的另一性别人物。

### 9.3 草稿隔离

扩展 `getArchetypeDraftKey` 参数：

```ts
entryMode?: 'standard' | 'share_quick'
```

快速模式草稿 key 至少包含：

```text
userId
kind
entryMode
mode
subjectGender
personKey（关系主角）
contentVersion
```

快速模式不使用 `caseId`。普通模式 key 不能变化，避免破坏现有草稿。

### 9.4 提交参数

快速模式提交增加：

```js
{
  entryMode: 'share_quick',
  resultShareId,
  subjectGender
}
```

并且不传 `caseId`。

普通模式提交保持原样。

### 9.5 退出和恢复

快速测试退出时继续使用现有“保留草稿”逻辑。重新从同一个分享页选择相同 `mode + subjectGender` 时应恢复草稿；改变 mode 或性别时不得串用旧草稿。

## 10. 结果页改造

需要修改：

- `relation-heroine-result.vue`；
- `crush-celebrity-result.vue`；
- `dimension-character-result.vue`。

### 10.1 报告 DTO 增加安全字段

`buildHistoryPreview`、`buildPreviewReport` 和 `buildFullReport` 增加：

```js
entryMode: 'standard' | 'share_quick'
subjectLabel: '你' | 'TA'
```

不得向前端返回 `sourceResultId` 或原分享者用户 ID。

历史记录遇到 `entryMode=share_quick && mode=target` 时显示“TA（快速测试）”，不得伪装成某个当前 Crush，也不得要求 `caseSnapshot` 存在。

### 10.2 文案

快速 `target`：

```text
TA 最像「人物名」
```

普通 `target` 可以继续显示“当前 Crush”或 caseSnapshot 名称。

### 10.3 重新测试

快速结果重新测试：

```text
entryMode=share_quick
resultShareId=当前结果 prepareShare 得到的 ID
mode=原 mode
subjectGender=原 subjectGender
```

结果页加载时已经执行 `prepareArchetypeResultShare(resultId)`。快速结果点击“重新测试”时：

1. 使用当前结果新准备的 `resultShareId`，不复用最初进入本次测试时的来源分享 ID；
2. 如果 prepareShare 尚未完成，按钮进入 loading 并等待该请求；
3. prepareShare 失败则显示“暂时无法重新测试，请重试”，不得跳入一个缺少凭证的 quick 页面；
4. 路由必须带上 `entryMode/resultShareId/mode/subjectGender`；
5. 不得因为没有 caseId 跳转 Crushes。

普通结果继续使用现有 `caseId`。

### 10.4 分享结果

结果页加载后并行准备：

```text
prepareCurrentUserReferralShare()
prepareArchetypeResultShare(resultId)
```

只有两者都成功才显示可点击“分享结果”。

`onShareAppMessage` 路径改为新落地页，不再指向答题页。

### 10.5 主页 CTA

三个结果页都新增异步 `goHome()`，复用 `getSelfProfile()` 和 `shouldCompleteSelfProfile()`：

```ts
async function goHome() {
  if (homeRouting.value) return
  homeRouting.value = true
  try {
    const result = await getSelfProfile()
    if (!result?.success) throw new Error(result?.message || '读取画像失败')
    if (shouldCompleteSelfProfile(result)) {
      uni.navigateTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
      return
    }
    uni.switchTab({ url: '/pages/index/index' })
  } catch (error: any) {
    showError(error?.message || '暂时无法进入主页，请重试')
  } finally {
    homeRouting.value = false
  }
}
```

实现要求：

1. 使用现有 `shouldCompleteSelfProfile`，不能只判断 `hasUsableSelfProfile`，否则会无视用户此前的“先跳过”选择；
2. 必须先判断 `result?.success`；`getSelfProfile` 抛错或返回失败时显示可重试提示，不得调用 `shouldCompleteSelfProfile`；
3. 点击期间按钮进入 loading 并防止重复跳转；
4. 不向 onboarding 传入快速测试选择的性别；
5. 不传 `redirect=/pages/index/index`，避免 `redirectTo` 处理 tabBar 页面；让现有 `self-profile.goNext()` 在没有 pendingRedirect 时直接 `switchTab` 进入首页；
6. 画像已完成或已跳过时直接 `switchTab` 首页。

展示规则：

| 报告状态 | CTA 层级 | 文案 |
| --- | --- | --- |
| preview | 弱按钮 | 先去主页看看 |
| full | 主按钮 | 进入主页 |

主页 CTA 不创建 Crush，不自动把临时 TA 转为 Crush。进入现有本人画像 onboarding 后，也只处理用户本人画像，不询问或创建 TA。

## 11. 支付与 Pro 返回

### 11.1 单次道具支付

不修改 `HeartPersonaReportPaywall` 的支付协议、订单轮询、fail closed 和 `unlocked` 事件。

快速结果与普通结果使用完全相同的 `resultId` 解锁逻辑。

### 11.2 Pro 跳转参数

`HeartPersonaReportPaywall.goPro()` 改为：

```text
/pages/subscription/subscription
  ?from=heart_persona_result
  &resultId=当前resultId
```

订阅页新增 `onLoad` 读取 `from/resultId`。

确认 Pro/Ultra 权益成功后：

- `from=heart_persona_result` 时调用 `uni.navigateBack()`；
- 其他来源保持现有行为；
- 权益仍在确认时不自动返回，不声称报告已解锁。

### 11.3 结果页刷新

三个结果页 `onShow`：

```ts
if (resultId && !loading) loadReport()
```

需要增加请求锁或序号，避免 `onLoad` 和首次 `onShow` 并发造成旧响应覆盖新响应。

## 12. API 封装

在 `src/utils/api.ts` 增加：

```ts
export async function prepareArchetypeResultShare(resultId: string)
export async function getArchetypeSharedPreview(resultShareId: string)
```

调用现有 `getArchetypeReport` 云函数：

```js
callFunction({
  name: 'getArchetypeReport',
  data: { action: 'prepareShare', resultId, ...getBusinessAuthPayload() }
})
```

```js
callFunction({
  name: 'getArchetypeReport',
  data: { action: 'getSharedPreview', resultShareId, ...getBusinessAuthPayload() }
})
```

`saveArchetypeResult` API 函数本身可继续接收 `Record<string, any>`，但建议新增 TypeScript 类型，避免前端误把 quick target 同时传入 `caseId`。

## 13. 后台与运营配置

本期不新增后台开关和套餐权限键。

继续使用：

- `关系女主角`；
- `Crush名人图鉴`；
- `次元角色图鉴`；
- 现有单次付费漏斗配置；
- 现有订阅 `features/excludedFeatures`。

分享快速模式不能成为绕过 `FEATURE_NOT_AVAILABLE` 的特殊白名单。

可选的后续版本再增加：

- 分享记录管理；
- 分享撤销；
- 分享转化漏斗统计；
- “把临时 TA 保存为 Crush”。

这些不属于本期。

## 14. 安全要求

1. `prepareShare` 只能由结果所有者调用。
2. `getSharedPreview` 只接受随机 `resultShareId`，不接受客户端传原始 `resultId` 查看他人结果。
3. `saveArchetypeResult` 必须验证分享记录存在、active 且 kind 一致。
4. 快速模式仍必须执行功能权限和题库版本校验。
5. 公开 DTO 采用字段白名单，不得先生成 full DTO 再删除字段。
6. 分享落地页不得接收 URL 中的姓名、分数、人物名作为可信展示数据。
7. 分享页不得显示原 Crush 的姓名、头像、caseId 或任何画像字段。
8. 单次购买继续只允许解锁当前登录用户自己的 `resultId`。
9. 任何支付失败、查单失败、回调异常均保持锁定。
10. `resultShareId`、referral `shareId` 和订单 `outTradeNo` 三种 ID 不得混用。

## 15. 预计改动文件

### 新增

```text
src/pages/heart-persona-share/heart-persona-share.vue
src/utils/heart-persona-result.ts
tests/run-archetype-share-security.cjs
tests/run-archetype-share-quick-save.cjs
tests/run-archetype-share-routing.cjs
tests/run-archetype-share-ui-contract.cjs
tests/run-heart-persona-index-manager.cjs
HEART-PERSONA-SHARE-QUICK-TEST-DEV-PLAN-2026-08-06.md
```

### 修改

```text
src/pages.json
package.json
src/utils/api.ts
src/utils/archetype-storage.ts
src/pages/login/login.vue
src/components/HeartPersonaReportPaywall.vue
src/pages/subscription/subscription.vue
src/pages/relation-heroine/relation-heroine.vue
src/pages/relation-heroine-result/relation-heroine-result.vue
src/pages/relation-heroine-history/relation-heroine-history.vue
src/pages/crush-celebrity/crush-celebrity.vue
src/pages/crush-celebrity-result/crush-celebrity-result.vue
src/pages/dimension-character/dimension-character.vue
src/pages/dimension-character-result/dimension-character-result.vue
src/pages/dimension-character-history/dimension-character-history.vue
cloudfunctions/saveArchetypeResult/index.js
cloudfunctions/getArchetypeReport/index.js
cloudfunctions/_shared/archetype-report-projection.js
cloudfunctions/getArchetypeReport/_shared/archetype-report-projection.js
cloudfunctions/getArchetypeResults/_shared/archetype-report-projection.js
scripts/manage-heart-persona-report-indexes.cjs
tests/run-archetype-report-projection.cjs
```

现有 `src/pages/self-profile/self-profile.vue` 原则上不需要修改；只有发现当前正常新用户 onboarding 本身存在独立缺陷时，才允许另行报告并经用户确认后处理，不能借本任务重写该流程。

集合与索引固定复用 `scripts/manage-heart-persona-report-indexes.cjs` 管理，不修改 `initDb`，不新增第二个分享索引脚本。该脚本的 collection definitions 增加：

```js
{
  collection: 'archetype_result_shares',
  indexes: [
    { key: { resultShareId: 1 }, name: 'archetype_result_shares_result_share_id_unique', unique: true },
    { key: { ownerUserId: 1, createdAt: -1 }, name: 'archetype_result_shares_owner_created' },
    { key: { status: 1, updatedAt: -1 }, name: 'archetype_result_shares_status_updated' }
  ]
}
```

现有报告支付集合和索引定义不得改名、删除或重建。

同步共享代码时只同步本次实际依赖文件。不得运行会向全部云函数复制数百个无关 `_shared` 文件的无范围同步并把生成物全部提交。

## 16. 开发顺序

### 阶段 1：服务端分享防泄漏

1. 扩展 `manage-heart-persona-report-indexes.cjs`，加入 `archetype_result_shares` 集合和固定索引；
2. 实现 `buildSharedReportPreview` 白名单投影；
3. 实现 `prepareShare/getSharedPreview`；
4. 完成越权、字段泄漏和精确分数降级测试。

### 阶段 2：快速结果保存

1. `saveArchetypeResult` 增加显式 `entryMode` 分支；
2. 快速模式验证分享 ID 和 kind；
3. 允许 target 无 caseId；
4. 普通模式逻辑保持不变；
5. 完成三种 kind、两种 mode、两种性别组合测试。

### 阶段 3：分享落地页

1. 将 HTML 原型转成 uni-app 页面；
2. 接入静默登录和分享 DTO；
3. 完成“测自己 / 测 TA + 性别”选择层；
4. 按 kind 跳转测试页。

### 阶段 4：三个测试页面 quick 模式

1. 解析统一参数；
2. 跳过画像与 case 检查；
3. 隔离草稿；
4. 提交 quick 字段；
5. 保证普通入口回归通过。

### 阶段 5：结果分享、Pro 返回和主页 CTA

1. 三个结果页准备 `resultShareId`；
2. 分享路径指向落地页；
3. 增加主页 CTA，并接入现有 `shouldCompleteSelfProfile + self-profile?mode=onboarding`；
4. Pro 成功返回结果页并重新读取报告；
5. 单次支付保持现有流程。

### 阶段 6：构建与沙箱验证

完成所有单元、集成、回归和小程序构建后，先输出代码审查材料；未经用户确认不得部署生产环境。

## 17. 测试清单

### 17.1 服务端分享安全测试

- [ ] 结果所有者可以 prepareShare；
- [ ] 非结果所有者不能 prepareShare；
- [ ] 同一结果重复 prepareShare 返回同一个 resultShareId；
- [ ] 同一结果 20 个并发 prepareShare 最终只产生一条记录且全部返回同一个 resultShareId；
- [ ] revoked 分享重新 prepareShare 后生成新 resultShareId；
- [ ] revoked 前的旧 resultShareId 永久返回 `SHARE_NOT_FOUND`；
- [ ] 随机无效 resultShareId 返回 `SHARE_NOT_FOUND`；
- [ ] revoked 分享不能读取；
- [ ] shared DTO 不含 answers；
- [ ] shared DTO 不含 dimensions；
- [ ] shared DTO 不含 topFive；
- [ ] shared DTO 不含 caseId/caseSnapshot；
- [ ] owner preview 时只返回 similarityBand；
- [ ] owner full 时允许返回 exact；
- [ ] owner 权限失效后 exact 自动降级为 band。

### 17.2 快速保存测试

组合矩阵：

```text
3 kind × 2 mode × 2 subjectGender = 12 组
```

- [ ] 12 组均能按正确题库评分；
- [ ] quick target 无 caseId 可以保存；
- [ ] quick target 传 caseId 返回 `QUICK_CASE_FORBIDDEN`；
- [ ] quick 缺 resultShareId 失败；
- [ ] quick 使用失效分享 ID 失败；
- [ ] quick kind 与分享来源不一致失败；
- [ ] quick 缺性别失败；
- [ ] quick 仍受 `resolveQuizAccess` 控制；
- [ ] quick 保存响应不泄露完整结果；
- [ ] standard target 无 caseId 仍失败；
- [ ] standard target 非本人 caseId 仍失败；
- [ ] standard self/profile 性别规则不变。

### 17.3 前端流程测试

- [ ] 新用户打开分享页完成静默登录；
- [ ] 微信小程序静默登录进行中不显示显式登录页；
- [ ] 选择性别后直接进入答题，不出现二次确认或再次点击“我也测测”；
- [ ] H5 显式登录返回后 mode 和 gender 选择不丢失；
- [ ] 未选择完整时不能开始；
- [ ] “测 TA”不会要求创建 Crush；
- [ ] “测 TA”不会读取当前 activeCaseId；
- [ ] “测自己”不会要求完整本人画像；
- [ ] 关系男/女加载对应题库；
- [ ] 名人和次元输出只包含对应性别人物；
- [ ] 名人和次元“看看人物池”不显示另一性别人物；
- [ ] 名人和次元人物数量统计按当前 subjectGender 计算；
- [ ] target 模式继续提供“无法判断 / 没观察到”；
- [ ] 草稿不会与普通入口串用；
- [ ] 分享失效页有主页 CTA。

### 17.4 结果与支付测试

- [ ] 免费用户答完看到 preview；
- [ ] `¥1.99` 仍只解锁当前 resultId；
- [ ] 支付成功停留并刷新完整报告；
- [ ] 支付取消仍为 preview；
- [ ] Pro 成功后返回结果页并显示 full；
- [ ] 权益处理中不假定 full；
- [ ] preview 状态显示“先去主页看看”；
- [ ] full 状态显示“进入主页”；
- [ ] 画像完整时主页 CTA 直接使用 switchTab；
- [ ] 画像未完成且未跳过时进入现有小咪 onboarding；
- [ ] onboarding 保存后进入首页；
- [ ] onboarding 点击“先跳过”后按现有逻辑进入首页；
- [ ] 已存在 `selfProfileSkipped` 时不重复进入 onboarding；
- [ ] getSelfProfile 网络失败时不误跳 onboarding；
- [ ] 快速测试选择的性别不自动写入或预填本人画像；
- [ ] 快速结果重新测试会携带当前结果 prepareShare 得到的 resultShareId；
- [ ] prepareShare 失败时重新测试不发生跳转；
- [ ] 快速结果再次分享形成新的合法分享闭环。

### 17.5 回归与构建

- [ ] 现有关系主角普通 self 流程；
- [ ] 现有关系主角普通 current Crush 流程；
- [ ] 现有名人图鉴普通流程；
- [ ] 现有次元图鉴普通流程；
- [ ] 现有历史记录；
- [ ] 现有单次支付测试；
- [ ] 现有 Pro/Ultra 权限测试；
- [ ] H5 构建；
- [ ] 微信小程序构建；
- [ ] 微信开发者工具真机/沙箱支付调试。

## 18. 建议新增自动化测试文件

```text
tests/run-archetype-share-security.cjs
tests/run-archetype-share-quick-save.cjs
tests/run-archetype-share-routing.cjs
tests/run-archetype-share-ui-contract.cjs
tests/run-heart-persona-index-manager.cjs
```

现有报告支付测试必须继续全部通过，不得用更新快照的方式掩盖字段泄漏或权限回归。

## 19. 部署范围与命令

开发完成并经代码审查批准后，沙箱部署范围仅包括实际修改的云函数：

```powershell
npx.cmd cloudbase functions:deploy getArchetypeReport -e cloud1-d0gvhqu2c8a2b61fd
npx.cmd cloudbase functions:deploy saveArchetypeResult -e cloud1-d0gvhqu2c8a2b61fd
npx.cmd cloudbase functions:deploy getArchetypeResults -e cloud1-d0gvhqu2c8a2b61fd
```

`getArchetypeReport` 和 `getArchetypeResults` 都使用函数目录内的共享投影副本。部署前必须确认两个函数目录中的 `_shared/archetype-report-projection.js` 均与根共享版本一致，否则结果页与历史记录会出现字段不一致。

集合与索引固定执行以下步骤，不使用 `initDb`：

```powershell
# 1. 只读审计三个报告相关集合是否存在
node scripts/manage-heart-persona-report-indexes.cjs audit-collections cloud1-d0gvhqu2c8a2b61fd

# 2. 仅当 archetype_result_shares 缺失时执行；脚本必须把“集合已存在”作为幂等可接受结果
npm.cmd run cloud:archetype-report:collections:create -- cloud1-d0gvhqu2c8a2b61fd

# 3. 审计索引
npm.cmd run cloud:archetype-report:indexes:audit -- cloud1-d0gvhqu2c8a2b61fd

# 4. 仅补缺失索引，不删除、不改名、不重建现有支付索引
npm.cmd run cloud:archetype-report:indexes:create -- cloud1-d0gvhqu2c8a2b61fd

# 5. 再次只读审计并保存输出
npm.cmd run cloud:archetype-report:indexes:audit -- cloud1-d0gvhqu2c8a2b61fd
```

开发时必须先检查现有脚本对“集合已存在”和“索引已存在”的返回处理；如当前脚本会因其中一个集合已存在而中止全部创建，需要先把脚本改成逐集合执行并对 already exists 幂等成功，不能通过删除现有集合解决。

前端构建：

```powershell
npm.cmd run build:h5
npm.cmd run build:mp-weixin
```

本方案不授权生产部署，不授权修改 `HEART_PERSONA_VPAY_ENV`，不授权修改现网 appKey、offerId、productId 和价格。

## 20. 验收标准

满足以下条件才算完成：

1. 分享卡片打开后首先看到真实结果落地页，而不是直接答题；
2. 新用户只选择“自己/TA”和性别即可开始；
3. 新用户不需要创建 Crush 或补完整画像；
4. quick target 可以无 caseId 保存，但普通 target 仍必须有当前 Crush；
5. 分享页不泄漏付费完整报告或 Crush 私密信息；
6. 免费预览、`¥1.99`、Pro 三条路径均正常；
7. 单次购买仍严格一单一 resultId；
8. 支付或升级后先展示完整结果；
9. 结果页可进入主页，画像未完成时复用现有小咪新用户 onboarding，已完成或已跳过时直接进入；
10. 三种测试、两种对象、两种性别均通过；
11. 现有普通入口、题库、历史记录和支付链路无回归；
12. 全部测试和 H5/微信小程序构建通过；
13. 先提交改动文件、测试结果、部署命令和未完成事项供用户审查，未经允许不部署生产。
14. 快速测试的临时 TA 在结果页和历史记录中显示为“TA（快速测试）”，不得显示为“当前 Crush”。

## 21. 明确不做

本期不做：

- 把临时 TA 自动保存为 Crush；
- 在快速测试里填写 TA 姓名；
- 分享页查看分享者完整报告；
- 被分享者购买分享者的完整报告；
- 一个道具解锁多个结果；
- 新的支付道具或支付回调地址；
- 新的套餐权限键；
- 首页 Banner；
- 历史数据迁移；
- 生产环境部署。

## 22. 2026-08-06 本地开发与验证记录

已完成：

- 服务端 `prepareShare/getSharedPreview`、公开 DTO 白名单、分享撤销后旧链接失效和权限降级；
- `entryMode=share_quick` 保存校验，覆盖 3 种测试、2 种对象和 2 种性别共 12 组；
- 分享落地页、显式登录回跳、本次 self/TA 与性别选择，以及不创建 Crush 的快速答题链路；
- 三个结果页重新分享、快速重测、Pro 返回刷新和“进入主页”CTA；
- 分享选择不增加确认层，选择性别后直接进入答题；`mode/subjectGender` 写入 H5 登录回跳 query 和专用本地缓存，进入答题页成功后删除缓存，重新分享时不携带接收者的临时选择；
- 三个结果页对快速重测增加 loading、防重复点击和在途 `prepareShare` Promise 复用；
- 报告 DTO 统一返回 `subjectLabel`，快速 TA 显示为“TA（快速测试）”，并停止向前端返回内部 `sourceResultShareId/sourceResultId`；
- 临时 TA 在结果页和历史记录中显示为“TA（快速测试）”；
- 集合/索引脚本按集合逐个审计；集合存在性使用 `listCollections`，不再使用会把缺失集合误判为 0 条记录的 `count`；创建后必须再次验证，只创建缺失资源，不重建现有支付索引；
- 索引管理测试使用假 CloudBase CLI 完整验证：首次仅创建缺失分享集合和三个分享索引，第二次执行完全幂等，订单及退款集合和索引保持不变；
- 三份报告公开投影副本 SHA256 一致：`B115CD4AAF7CFB955FE8D0A04E3AED9899F0EE1D08958483B98C5F6E63FC5D78`。

已通过：

```powershell
npm.cmd run test:archetype-share
npm.cmd run test:archetypes
npm.cmd run test:archetype-report-payment
npm.cmd run test:regression
npm.cmd run build:h5
npm.cmd run build:mp-weixin
```

浏览器本地验收：

- 匿名打开无效/未部署分享 ID 时显示“登录后继续”和“进入首页”；
- 点击登录后，回跳地址完整保留 `resultShareId`；
- 已选择 `mode=target&subjectGender=female` 时，点击登录后回跳地址完整保留两项选择；
- 错误 percent-encoding 的 redirect 不会导致登录页崩溃；
- 分享页与登录页控制台未发现本功能运行时错误；构建仅有项目原有 Sass `@import` 弃用警告。

待真实账号和微信开发者工具验证：

- 使用真实有效分享记录验证落地页成功态和结果分享卡片；
- 在微信开发者工具验证静默登录、完整答题、免费预览、199 分道具支付、Pro 返回和真机分享；
- 本次没有生产部署授权。

2026-08-06 只读沙箱审计结果：

- `archetype_result_shares`：不存在；修复后的集合审计明确返回 missing；
- `archetype_report_orders`：存在，原有订单索引完整；
- `archetype_report_refund_tasks`：存在，原有退款任务索引完整；
- 因用户尚未再次授权本轮部署，没有创建集合、索引或部署云函数。

## 23. 交给 DeepSeek 的执行指令

可直接复制以下内容：

```text
建立新的 codex/ 或 feature/ Git 分支后，严格按照
HEART-PERSONA-SHARE-QUICK-TEST-DEV-PLAN-2026-08-06.md v1.5 开发。

继续遵守 HEART-PERSONA-REPORT-UNLOCK-PAYMENT-DEV-PLAN-2026-08-06.md v2.1
中已经锁定的 short_series_goods、productId=0001、199分、一单解锁一个resultId、
三权限键、现有 /security/media-callback 和 fail closed 规则。

分享快速测试只允许选择 self/target 和 female/male；不得创建 Crush，不得要求完整画像。
只在 entryMode=share_quick 且 resultShareId 有效、kind 一致时允许 target 无 caseId；
普通入口 current Crush 规则不得放宽。

结果页主页 CTA 必须复用现有 getSelfProfile、shouldCompleteSelfProfile 和
/pages/self-profile/self-profile?mode=onboarding。不得新增 required_home/force_profile 模式，
不得重写小咪画像流程，也不得改变现有“先跳过”规则。快速测试选择的性别不得写入本人画像。

先完成服务端公开投影、防泄漏、分享记录和 quick 保存校验，再开发分享落地页和三个答题页，
最后修改结果分享、Pro 返回和主页 CTA。

开发完成后运行文档中的全部测试和 H5/微信小程序构建，输出改动文件、测试结果、
沙箱部署命令及未完成事项。不要直接部署生产，先让我审查代码。
```

## 24. 2026-08-07 沙箱部署与部署后验证记录

部署目标仅为沙箱环境：`cloud1-d0gvhqu2c8a2b61fd`。未部署生产环境，未修改虚拟支付环境变量、`offerId`、`productId=0001`、199 分价格、支付回调或套餐权限键。

已完成云资源：

- 创建集合 `archetype_result_shares`；
- 创建唯一索引 `archetype_result_shares_result_share_id_unique`；
- 创建索引 `archetype_result_shares_owner_created`；
- 创建索引 `archetype_result_shares_status_updated`；
- 复审确认 `archetype_report_orders` 与 `archetype_report_refund_tasks` 的原有索引名称和结构全部保留，没有删除、改名或重建；
- 部署 `getArchetypeReport`，修改时间为 `2026-08-07 10:19:18`，状态 `Deployment completed`；
- 部署 `saveArchetypeResult`，修改时间为 `2026-08-07 10:20:00`，状态 `Deployment completed`；
- 部署 `getArchetypeResults`，修改时间为 `2026-08-07 10:21:04`，状态 `Deployment completed`。

部署后云端探针：

- 匿名调用 `getArchetypeReport` 返回 `AUTH_REQUIRED`；
- 匿名调用 `saveArchetypeResult` 返回 `AUTH_REQUIRED`；
- 匿名调用 `getArchetypeResults` 返回 `AUTH_REQUIRED`；
- 部署后再次执行集合与索引审计，三个相关集合及全部要求索引均通过。

部署后重新通过：

```powershell
npm.cmd run test:archetype-share
npm.cmd run test:archetypes
npm.cmd run test:archetype-report-payment
npm.cmd run test:regression
npm.cmd run build:h5
npm.cmd run build:mp-weixin
```

构建无错误，仅保留项目原有 Sass `@import` 和 legacy JS API 弃用警告。三个投影副本 SHA256 仍一致：`B115CD4AAF7CFB955FE8D0A04E3AED9899F0EE1D08958483B98C5F6E63FC5D78`。

本地匿名 H5 补充验收：无效分享显示“这份分享暂时打不开”“登录后继续”“进入首页”；点击登录后，回跳地址保留 `resultShareId`。有效分享成功态、真实静默登录、完整答题、199 分道具支付、Pro 返回及微信分享卡片仍须使用真实已登录结果和微信开发者工具完成外部验收。
