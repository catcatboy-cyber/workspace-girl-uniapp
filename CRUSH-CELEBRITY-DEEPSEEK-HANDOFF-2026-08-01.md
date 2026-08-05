# Crush 名人图鉴 V1｜DeepSeek 开发交接规格

> 状态：**V1 工程基线已实施**。本文定义首发题目、48 人名单、人物向量和评分矩阵；性别筛选、画像性别校验、`1.1.0` 版本和分性别校准以[名人与次元角色图鉴开发计划](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/DIMENSION-CHARACTER-AND-CELEBRITY-GENDER-DEV-PLAN-2026-08-04.md)为准。
> 前提：题库尚未上线，不存在旧题库、旧草稿或旧结果迁移。首发只初始化并发布 `crush_celebrity@1.0.0`。

> 线上复核（2026-08-05）：`getArchetypeQuestionBank`、`saveArchetypeResult`、`getArchetypeResults` 已部署；旧 `1.0.0` 已归档，性别版 `1.1.0` 已发布并通过男女各 20 万组校准。本文的“尚未上线/首发 1.0.0”只描述原始交接时点，不得作为当前部署状态。

## 1. V1 交付目标

- 登录后测试自己或当前 Crush，更像哪位古今人物。
- 固定首发 48 人：历史、近代、当代各 16 人。
- 固定 12 道行为题、五维画像、主匹配/次匹配、前五排名和相似度百分比。
- target 锁定 `options.caseId || getActiveCaseId()`；测试页不可选择、切换或解绑 Crush。
- target 每题增加 U“无法判断/没观察到”，U 不计分；self 不显示 U。
- 功能权限只接现有 `features/excludedFeatures`：Trial/Pro/Ultra 默认开放，Free 默认关闭。
- 不做首页 Banner，不新增 tabBar，不使用 AI 临时出题或生成结果。

## 2. 内容基准

以下现有计划内容是 V1 种子数据，DeepSeek只负责结构化，不得自行重写：

- 第 5 节：五维 key 与定义。
- 第 6 节：Q1-Q12 的 self/target 题干及 A-D 行为选项。
- 第 7.1 节：48 人名单与时代分类。
- 第 7.2 节：人物配置结构和每人的五维向量。
- 第 7.3 节：确定性结果文案。
- 第 8.1 节：每个选项的五维得分矩阵。
- 第 8.2 节：距离、相似度、排序和双原型规则。
- 第 8.3 节：20 万组模拟与 golden answers 校准门槛。

任何矩阵或人物向量调整必须产生新的校准报告；不得为了让 UI 看起来“均匀”而随机轮换人物或修改排序。

人物表从上到下固定赋予 `sortOrder=1..48`，首发全部 `enabled=true`。`coverUrl=''` 时 UI 使用人物姓名首字卡，不请求远程图片；`typeLabel/summary/shareCopy` 按内容计划第 7.3 节纯函数生成。开发模型不得自行补人物传记。

## 3. 入口与路由

### 3.1 target 入口

在 [Crush 详情页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/case-detail/case-detail.vue) 的“桃花匹配度”之后、“关系雷达”之前增加：

```text
测测 TA 像哪位古今名人
```

跳转：

```text
/pages/crush-celebrity/crush-celebrity?mode=target&caseId={caseId}
```

### 3.2 self 入口

在 [命理桃花页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua/taohua.vue)“你的桃花人设”区和 [桃花人设结果页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua-persona-result/taohua-persona-result.vue)增加：

```text
我像哪位古今名人？
```

跳转 `/pages/crush-celebrity/crush-celebrity?mode=self`。此功能权限与“命理桃花”独立，必须单独检查 `Crush名人图鉴`。

### 3.3 页面

```text
pages/crush-celebrity/crush-celebrity.vue
pages/crush-celebrity-result/crush-celebrity-result.vue
pages/crush-celebrity-person/crush-celebrity-person.vue
```

状态机：`access-checking -> mode-select -> target-check -> quiz -> submitting -> result`，补充 `locked/missing-current-crush/insufficient-observation/error`。答题页人物 chip 只打开介绍，不可改变计算候选池。

## 4. 登录、权限与 Crush 锁定

顺序固定：检查登录 → 登录 redirect → `checkFeatureAccess('Crush名人图鉴')` → target 解析并校验 case → 加载题库。

```ts
const lockedCaseId = mode === 'target'
  ? String(options.caseId || getActiveCaseId() || '').trim()
  : ''
```

self 不读取、不提交、不保存 caseId。target 顶部只读显示 Crush 名称和头像快照；不得调用 `setActiveCaseId()`，也不得监听全局活动 Crush 的后续变化。

## 5. 观察覆盖与结果

- target 至少 8/12 道有效答案；每个维度至少 2 道有效贡献，否则 `INSUFFICIENT_OBSERVATION`。
- 覆盖度按有效题数判定：11-12 为 `high`，9-10 为 `medium`，8 为 `low`。
- 服务端按内容计划第 8 节重新计算五维和全部 enabled 人物，不相信客户端上传的任何分值、人物或相似度。
- 排序固定：相似度降序 → 原始距离升序 → `sortOrder` 升序 → `personKey` 字典序。
- 结果显示主人物、次人物、前五、五维、观察覆盖度和确定性文案；不调用 AI。
- `enabled=false` 的人物同时从图鉴和计算候选池移除，但 V1 发布时必须仍有历史/近代/当代各 16 人。

## 6. 后台题库与首发初始化

### 6.1 数据库

`cloudfunctions/initDb/index.js` 的 `COLLECTIONS` 新增：

```text
archetype_question_banks
archetype_results
```

V1 不做迁移和回填。管理员 action `seedArchetypeQuestionBanks` 在库中完全没有 `featureKey=Crush名人图鉴` 文档时写入一条 `status=draft`、`contentVersion=1.0.0` 的完整种子。重复调用返回 `ALREADY_SEEDED`，不得覆盖已编辑内容。

```ts
type CelebrityQuestionBankDocument = {
  _id: string
  featureKey: 'Crush名人图鉴'
  contentVersion: string // 首发为 1.0.0
  status: 'draft' | 'published' | 'archived'
  revision: number
  content: {
    dimensions: CelebrityDimension[]
    questions: CelebrityQuestion[]
    people: CelebrityPerson[]
    resultCopy: Record<string, CelebrityResultCopy>
    goldenAnswers: Record<string, Record<string, 'A'|'B'|'C'|'D'>>
    calibrationSummary: CalibrationSummary
  }
  checksum: string
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
}
```

首发文档 `_id` 固定为 `archetype_bank_crush_celebrity_1_0_0`，`revision=1`。以后使用 `archetype_bank_crush_celebrity_{semver下划线形式}`。`checksum` 固定为对 `content` 做递归 key 排序后的 JSON 字符串计算 SHA-256 hex；时间、revision、操作者和 status 不进入 checksum。客户端不自行生成 checksum。

索引：普通复合索引 `featureKey + status`；唯一复合索引 `featureKey + contentVersion`。首发没有旧版本兼容任务；仍存 `contentVersion`，以后后台改题时复制 published 内容为新 draft。

### 6.2 管理面板

[后台页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/admin/admin.vue)“运营工具”增加 `题库管理` tab，复用 `ArchetypeQuestionBankPanel.vue`。切换到“Crush 名人图鉴”后提供：题号筛选、self/target 并排题干、A-D 选项与五维贡献、人物时代筛选、人物向量、启用状态、结果文案、手机预览、保存草稿、运行校准、校验、首次发布。

管理员 action（复用 `adminManage` 和现有 `requireAdminUser()`）：

```text
getArchetypeQuestionBank
seedArchetypeQuestionBanks
createArchetypeQuestionDraft
saveArchetypeQuestionDraft
validateArchetypeQuestionDraft
runCelebrityCalibration
publishArchetypeQuestionBank
```

`createArchetypeQuestionDraft({ featureKey, nextVersion })` 在首次发布后复制当前 published 内容为新 draft；版本必须是未使用的合法 semver。保存提交 `expectedRevision`，冲突返回 `REVISION_CONFLICT`。published 不可直接编辑。发布必须在数据库事务中再次校验 revision、checksum 和 calibration 状态，再把原 published 标记为 archived、把当前 draft 标记为 published，保证同一 feature 同时最多一个 published。V1 不要求旧结果迁移或回滚 UI。

管理员 action 契约：

| action | 必填输入 | 成功返回 |
| --- | --- | --- |
| `getArchetypeQuestionBank` | `featureKey`, `status?`, `contentVersion?` | `{ success:true, bank }` |
| `seedArchetypeQuestionBanks` | `featureKey` | `{ success:true, seeded:true, bank }` 或 `ALREADY_SEEDED` |
| `createArchetypeQuestionDraft` | `featureKey`, `nextVersion` | `{ success:true, bank }` |
| `saveArchetypeQuestionDraft` | `bankId`, `expectedRevision`, `content` | `{ success:true, revision, checksum, updatedAt }` |
| `validateArchetypeQuestionDraft` | `bankId`, `expectedRevision` | `{ success:true, valid, errors[], checksum }` |
| `runCelebrityCalibration` | `bankId`, `expectedRevision`, `seed`, `iterations=200000` | `{ success:true, passed, summary, reportChecksum }` |
| `publishArchetypeQuestionBank` | `bankId`, `expectedRevision`, `checksum`, `reportChecksum` | `{ success:true, contentVersion, publishedAt }` |

字段错误统一为 `{ path, code, message }`。错误码固定包含 `UNAUTHENTICATED`、`ADMIN_REQUIRED`、`BANK_NOT_FOUND`、`ALREADY_SEEDED`、`VERSION_EXISTS`、`REVISION_CONFLICT`、`VALIDATION_FAILED`、`CHECKSUM_MISMATCH`、`CALIBRATION_REQUIRED`、`PUBLISH_CONFLICT`。

发布校验必须覆盖：12 个唯一 CQ ID；self/target 和 A-D 完整；U 只由 target UI追加且 scores 为空；五维均有贡献；48 人 key 唯一；三个时代各 16；向量在 0..100；结果文案完整；48 人均有 golden answers；20 万模拟通过第 8.3 节门槛；checksum 可重算。任何失败都禁止发布并返回字段级错误。

## 7. 云函数与 API

普通用户接口：

```text
getArchetypeQuestionBank({ featureKey: 'Crush名人图鉴' })
saveArchetypeResult(payload)
getArchetypeResults({ kind: 'crush_celebrity', caseId?, limit? })
```

只读题库只返回 published；首次发布前返回 `CONTENT_NOT_PUBLISHED`。客户端不直接读数据库。

```ts
type SaveCrushCelebrityPayload = {
  kind: 'crush_celebrity'
  mode: 'self' | 'target'
  caseId?: string
  answers: Array<{ questionId: string; optionKey: 'A'|'B'|'C'|'D'|'U' }>
  contentVersion: string // 从当前 published 题库读取，首发为 1.0.0
  authUserId: string
}
```

服务端顺序：鉴权 → 套餐 → target case 所有权 → 按 `contentVersion` 取题库 → 校验答案与覆盖度 → 服务端重算 → 保存。固定错误码：`AUTH_REQUIRED`、`FEATURE_NOT_AVAILABLE`、`CONTENT_NOT_PUBLISHED`、`INVALID_ARGUMENT`、`INSUFFICIENT_OBSERVATION`、`CONTENT_VERSION_MISMATCH`、`CASE_NOT_FOUND`、`SAVE_FAILED`。

结果保存：`kind/mode/caseId/primaryPersonKey/secondaryPersonKey/similarities/dimensions/answers/answeredCount/unknownCount/observationConfidence/contentVersion/algorithmVersion/createdAt`。`algorithmVersion` 固定为 `crush-celebrity-v1`。self 不保存 caseId；不得修改 `latestResult`、`crushType` 或 AI 分析。

本地草稿：

```text
archetype_draft:crush_celebrity:{userId}:{mode}:{caseId|self}:{contentVersion}
```

## 8. 权限

功能键固定为 `Crush名人图鉴`，加入 `SubscriptionPanel.vue`、`cloudfunctions/_shared/subscription.js` 及所有同步副本。Trial/Pro/Ultra 的 `features` 包含且 `excludedFeatures` 不包含；Free 的 `excludedFeatures` 包含。禁止增加 `featureSwitches`、次数限制和另一张权限表。

当前仓库订阅 `configVersion=5`。两个测试同批开发时，只提升一次到 `6`，并在同一默认配置变更中同时加入 `关系女主角` 和 `Crush名人图鉴`。现有线上 `settings_subscription` 不会自动合并新数组项，部署后管理员必须在订阅面板逐套餐保存一次预期值并逐套餐验证 `checkFeature`。

## 9. 文件清单

```text
src/pages/crush-celebrity/crush-celebrity.vue
src/pages/crush-celebrity-result/crush-celebrity-result.vue
src/pages/crush-celebrity-person/crush-celebrity-person.vue
src/pages/admin/components/panels/ArchetypeQuestionBankPanel.vue
src/components/archetype/ArchetypeOptionList.vue
src/components/archetype/ArchetypeQuizProgress.vue
src/components/archetype/CelebrityPersonCard.vue
src/utils/archetype-types.ts
src/utils/archetype-storage.ts
src/utils/feature-keys.ts
cloudfunctions/_shared/crush-celebrity-score.js
cloudfunctions/_shared/crush-celebrity-v1.json
cloudfunctions/getArchetypeQuestionBank/index.js
cloudfunctions/saveArchetypeResult/index.js
cloudfunctions/getArchetypeResults/index.js
tests/run-crush-celebrity-rules.cjs
tests/run-crush-celebrity-calibration.cjs
```

`pages.json` 注册三个页面。`api.ts` 增加三个用户 API 和七个管理员 wrapper。V1 内容只维护在 `cloudfunctions/_shared/crush-celebrity-v1.json`，通过现有 `npm run sync:shared` 同步；客户端从云端读取，不复制第二份人物向量。

## 10. DeepSeek 实施顺序

1. 将内容计划第 5-8 节逐字结构化为唯一 V1 JSON，完成纯评分与规则测试。
2. 运行 20 万模拟和 48 人 golden answers，输出校准报告；未达标先修向量再开发 UI。
3. 新增集合、后台 seed/edit/calibrate/validate/publish 流程。
4. 新增只读题库、服务端保存重算和历史查询。
5. 接入套餐功能键与默认权限。
6. 实现 self/target 答题、草稿、图鉴、人物详情和结果。
7. 接入三个轻量入口，不改首页 Banner。
8. 运行同步、规则测试、回归构建和真机验收。

## 11. 必过验收

- 首发 seed 幂等，不覆盖后台编辑；未发布不可开测。
- 12 题、48 人、三时代数量、向量、结果文案和 golden answers 完整。
- 20 万模拟满足内容计划第 8.3 节；48 人均可成为稳定第一名。
- self/target 行为含义一致；target U 不计分；覆盖不足被拒绝。
- target case 锁定和所有权校验；测试页无 Crush 切换入口。
- 服务端重算；伪造人物、维度或相似度无效；排序稳定可复现。
- 非管理员无法读草稿或改题；revision 冲突无法覆盖；校准未通过不能发布。
- Trial/Pro/Ultra 开放，Free 关闭；后台套餐调整即时生效。
- `npm run sync:shared:dry`、`node tests/run-crush-celebrity-rules.cjs`、`node tests/run-crush-celebrity-calibration.cjs`、`npm run test:regression`、`npm run build:h5`、`npm run build:mp-weixin` 通过。
- 微信真机跑通 self、target、无当前 Crush、观察不足、结果保存、图鉴详情和登录回跳。

DeepSeek交付必须附：变更文件清单、题库校验输出、20 万模拟摘要、48 人 golden answers 摘要、测试与双端构建输出、未完成项。任一必过项未通过，不得标记完成。
