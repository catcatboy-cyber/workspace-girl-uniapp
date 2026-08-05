# 关系主角男女题库与人物改名开发计划

> 执行状态（2026-08-05）：**代码、规则测试、相关云函数和题库索引已实施；女性与男性 `1.0.0` 题库均已发布。** 本文优先于 2026-08-01 的“关系女主角”旧 V1 交接文档；后续题库改动必须递增对应性别版本并重新校准。

> 日期：2026-08-03
> 分支：`codex/archetype-tests-development`
> 本文是现有关系女主角 V1 的增量开发计划，目标是交给开发模型直接执行。
> 本阶段只改关系原型，不改 Crush 名人图鉴的计分模型和套餐配置。

## 1. 目标与固定决策

### 1.1 产品目标

将现有“关系女主角”扩展为“关系主角测试”产品：

- 关系女主角：测女性关系风格。
- 关系男主角：测男性关系风格。
- 两套题库均支持“测自己”和“测当前 Crush”。
- 用户看到的是与某个人物风格的相似度百分比，不是心理诊断。
- 后台可以修改人物显示名称、人物副标题、题目和结果文案。

产品对外展示可以使用“关系女主角 / 关系男主角”，内部总称使用“关系主角测试”。

### 1.2 权限决策

继续使用现有权限 feature key：`关系女主角`。它作为关系主角测试的统一 entitlement，男女题库共用，不新增第二套权限系统。

本阶段不得修改线上套餐的 `features/excludedFeatures`。管理员以后仍然在订阅面板自行配置；现有 Trial、Free、Pro、Ultra 行为保持不变。

### 1.3 被测对象性别决策

题库应按“被测对象性别”选择，不能在所有模式下只按登录用户性别硬切：

- `mode=self`：使用当前用户 `selfProfile.gender`。
- `mode=target`：使用进入测试时锁定的当前 Crush `case.profile.gender`。
- 当前用户为男，进入 Crush 模式时默认推荐关系女主角入口。
- 当前用户为女，进入 Crush 模式时默认推荐关系男主角入口。
- Crush 性别缺失、非二元或未说明时，显示一次性的“测男主角 / 测女主角”选择，不自动猜测。
- 性别选择只影响本次测试，不回写用户或 Crush 画像。

统一性别映射固定为：

```ts
male / 男 -> male
female / 女 -> female
private / 非二元 / 未说明 / 空值 -> unknown
```

用户画像使用英文枚举，Crush 画像表单使用中文显示值。客户端先做统一映射；服务端不能直接相信客户端提交的 `subjectGender`，self 模式要读取已认证用户画像，target 模式要读取该用户拥有的 Crush 画像进行复核。

这样既满足“男用户主要测女主角、女用户主要测男主角”的玩法，又避免女性用户测自己时被错误地测成男主角。

### 1.4 不变规则

- 必须登录。
- `mode=target` 必须使用当前已选 Crush；测试页不能切换 Crush。
- 更换 Crush 必须返回首页或 Crushes 页面。
- 每次测试仍为 `6 题筛选 + 15 题人物专测 + 3 道情景题`。
- 关系阶段仍为四个：未在一起、刚开始交往、稳定交往、长期共同生活或婚姻。
- Self 与 target 使用不同文案，target 允许 `U=无法判断/没观察到`。
- 计分必须由服务端根据题库重算，不能相信客户端上传的分数。

## 2. 当前实现差距

1. `ArchetypeQuestionBankPanel.vue` 的关系人物区目前只展示 `archetype.name`，没有名称输入框；改名只能通过完整 JSON。
2. `cloudfunctions/_shared/archetype-bank.js` 将女性三个 key 写死为 `ran_yingying`、`tong_chenjie`、`xie_xingfang`。
3. 题库文档没有 `subjectGender`，数据库唯一索引只有 `featureKey + contentVersion`，无法同时存在男、女两个同版本题库。
4. 前台关系测试只请求固定 feature key，未按 selfProfile 或 Crush profile 的性别解析题库。
5. 草稿 key、结果记录、结果标题没有记录性别题库版本。
6. 当前功能尚未对用户正式开放，结果集合没有历史业务数据；本阶段不设计旧结果迁移或旧版本兼容分支。
7. 桃花人设、Crush 详情、结果页和导航标题仍写死“关系女主角”，没有使用性别版本和 `displayTitle`。

## 3. 题库与数据模型

### 3.1 题库文档

保留集合 `archetype_question_banks`，增加字段：

```ts
type SubjectGender = 'female' | 'male'

type RelationBankDocument = {
  _id: string
  featureKey: '关系女主角' // 权限 key，男女共用
  subjectGender: SubjectGender
  displayTitle: '关系女主角' | '关系男主角'
  contentVersion: string
  status: 'draft' | 'published' | 'archived'
  revision: number
  content: RelationArchetypeContent
  checksum: string
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
}
```

新发布的男女题库文档都必须写入 `subjectGender`；不增加读取旧文档的隐式兼容逻辑。

### 3.2 文档 ID 与版本

- 女性首发版本：`archetype_bank_relation_female_1_0_0`。
- 男性首发版本：`archetype_bank_relation_male_1_0_0`。
- 当前云端旧女性种子仅作为内容来源；新男女文档发布后，将旧的无性别文档归档，不再由客户端读取。
- `buildBankId(featureKey, subjectGender, version)` 必须生成包含性别的 ID；同一 feature 下 female/male 可以使用相同 contentVersion。
- 新版本必须使用合法 semver，不复用已存在版本。
- 发布后文档不可编辑；改名、改题、改权重都必须创建新草稿。

### 3.3 人物字段

```ts
type RelationArchetype = {
  key: string // 稳定内部 ID，只读
  name: string // 可编辑显示名
  label: string // 可编辑风格副标题
  enabled: boolean
  coverUrl?: string
  dimensions: Array<{
    key: string
    name: string
    weight: number
    highText: string
    lowText: string
  }>
  universalQuestions: RelationQuestion[] // 10
  stageQuestions: Record<StageKey, RelationQuestion[]> // 每阶段 5
  scenarios: Record<StageKey, RelationScenario[]> // 每阶段 3
  resultCopy: { attraction: string; caution: string }
}
```

`key` 永远不能由管理员改名；`name`、`label`、题目和结果文案均可在草稿中编辑。

### 3.4 上线前数据库初始化

当前唯一索引 `featureKey + contentVersion` 不允许男女题库同时使用 `1.0.0`，上线前执行一次初始化调整：

1. 审计 `archetype_results`，结果数必须为 0；若不为 0，停止发布并由产品决定是否清理或另建环境，本计划不迁移历史结果。
2. 删除旧的唯一索引 `archetype_bank_feature_version_unique`。
3. 创建新的唯一索引：`featureKey + subjectGender + contentVersion`。
4. 创建查询索引 `featureKey + subjectGender + status`；所有关系题库 published 查询必须带 `subjectGender`。
5. 创建带 `subjectGender` 的女性和男性 `1.0.0` 草稿。
6. 两套新文档发布成功后，将旧的无性别女性文档标记为 `archived`。

初始化脚本必须可重复执行、默认只读审计，归档和建索引等写入动作需要显式子命令。

发布事务只允许归档相同 `featureKey + subjectGender` 下的其他 published 文档。发布男主角不得归档女主角，发布女主角也不得归档男主角。

## 4. 男主角首发题库

男主角先提供三个可编辑的初始人物名称：

| 稳定 key | 初始名称 | 初始定位 | 建议维度 |
| --- | --- | --- | --- |
| `steady_leader` | 霍启刚型 | 稳健共建派 | 主动承担、共同规划、家庭责任 |
| `equal_partner` | 袁弘型 | 平等边界派 | 尊重伴侣、沟通协商、边界清晰 |
| `long_term_guardian` | 杜江型 | 长期守护派 | 情绪支持、持续投入、稳定维护 |

人物名称只是内容配置，管理员可以改成其他名称；稳定 key 和题目关联不能改变。

男题库必须独立编写，不得把女题库复制后只替换“她/他”。每个性别版本至少包含：

- 6 道筛选题。
- 3 人物 × 10 道通用题。
- 3 人物 × 4 阶段 × 5 道阶段题。
- 3 人物 × 4 阶段 × 3 道情景题。
- 3 个人物的三维权重、结果吸引点和注意点。

单个性别版本共需 132 个题目/情景条目（6 + 3 × 10 + 3 × 4 × 5 + 3 × 4 × 3），运行时仍只抽取 15 + 3 道。

种子文件固定为：

- `cloudfunctions/_shared/relation-female-v1.json`
- `cloudfunctions/_shared/relation-male-v1.json`

原 `relation-heroine-v1.json` 只作为女性内容迁移来源，最终运行时不再读取。

题目质量要求：

- 使用通俗中文和具体场景，避免心理学术语。
- 题目只测一个主要行为倾向，避免双重问题。
- self 询问自己的选择、感受或行为。
- target 询问 Crush 可观察的表达、长期行动和实际选择。
- 每道 self/target 文案必须语义平行但不能完全相同。
- target 允许 U，不观察到的内容不得按中间值计分。
- 四阶段改变场景，不改变维度含义和权重。

## 5. 后端开发任务

### 5.1 题库共享模块

修改：

- `cloudfunctions/_shared/archetype-bank.js`
- `cloudfunctions/adminManage/_shared/archetype-bank.js`
- 其他函数目录中的副本不手动编辑，由 `scripts/sync-shared.js` 从 canonical `cloudfunctions/_shared/` 同步。

任务：

- 增加 `SubjectGender` 规范化，并拒绝缺少性别版本的新发布内容。
- `findBank` 支持 `subjectGender`。
- `buildBankId(featureKey, subjectGender, version)` 支持 female/male 前缀。
- 校验器不再写死人物 key，只校验题库内恰好三个唯一 key。
- 筛选题 `voteFor` 必须引用当前内容中的人物 key。
- 关系计分函数改为接收通用 archetype 内容，算法版本升级为 `relation-archetype-v2`。
- 统一使用 `relation-archetype-v2` 计分路径；不保留旧算法分支。
- 发布事务按 `featureKey + subjectGender` 查询和归档 published 文档。

### 5.2 云函数接口

`getArchetypeQuestionBank`：

```ts
{ featureKey: '关系女主角', subjectGender: 'female' | 'male', contentVersion?: string }
```

返回必须包含：`featureKey`、`subjectGender`、`displayTitle`、`contentVersion`、`checksum`、`content`。

`saveArchetypeResult` 增加：

```ts
{
  kind: 'relation_archetype',
  subjectGender: 'female' | 'male'
}
```

`kind` 固定为 `relation_archetype`。页面目录可以继续保留 `relation-heroine`，但 API、类型、草稿 key 和结果查询统一使用新 kind。

服务端保存：

- `kind: 'relation_archetype'`
- `subjectGender`
- `contentVersion`
- `algorithmVersion`
- `personSnapshot: { key, name, label }`
- target 模式的 `caseSnapshot`

`getArchetypeResults`：

- `kind` 固定为 `relation_archetype`。
- 新结果按 `subjectGender`、`personKey`、`caseId` 查询。
- 列表查询时 `subjectGender` 必填；按 `resultId` 查询时不要求客户端预先提供，服务端先读取结果，再使用结果中的 `subjectGender`。
- 结果详情读取题库时必须同时传入 `subjectGender + contentVersion`，不能只按版本号读取。
- 结果详情的推荐顺序是：先按 `resultId` 读取结果，再用结果中的性别和版本读取题库，最后渲染结果。

`saveArchetypeResult` 的服务端性别决策：已知 self 或 target 性别时，以服务端画像为准并校验客户端值；画像为 unknown 时，允许客户端提交本次选择的 female/male，但仍需校验枚举和题库存在。

### 5.3 管理员 action

现有 action 增加 `subjectGender` 参数：

- `getArchetypeQuestionBank`
- `seedArchetypeQuestionBanks`
- `createArchetypeQuestionDraft`

初始化 action 固定契约：

```ts
seedArchetypeQuestionBanks({
  featureKey: '关系女主角',
  subjectGender: 'female' | 'male'
})
```

`getSeed(featureKey, subjectGender)` 必须分别读取女性、男性种子文件；`ALREADY_SEEDED` 判断必须限定同一 `featureKey + subjectGender`。`createArchetypeQuestionDraft` 同样必须接收性别，并从相同性别的 published 版本复制。

保存、校验、发布仍使用 `bankId + expectedRevision`，继续防止并发覆盖。

关系题库发布不需要名人 20 万组校准，但必须通过完整性和固定计分回归测试。

## 6. 后台前端开发任务

主要文件：

- `src/pages/admin/components/panels/ArchetypeQuestionBankPanel.vue`
- `src/utils/api.ts`
- `src/utils/archetype-types.ts`

界面改造：

1. 顶部增加“关系女主角 / 关系男主角 / Crush 名人图鉴”分段控件。
2. 关系题库加载时同时传入 `subjectGender`。
3. 人物编辑卡增加名称、标签、启用状态和结果文案输入框。
4. 稳定 key 显示为只读代码，不提供编辑按钮。
5. 已发布版本显示只读状态和“复制为新草稿”入口。
6. 修改名称后显示未保存提示。
7. 发布前显示名称变化、题目变化和版本号差异摘要。
8. 预览区同步显示人物名称、题目标题和结果标题。
9. 所有输入框有明确 label，交互目标至少 44px，错误信息显示在对应字段附近。
10. 使用现有后台视觉，不新建独立设计系统；采用高对比、清晰边界和 150-300ms 的轻量状态过渡。

后台校验提示至少包括：

- 人物名称不能为空。
- 三个人物名称不能重复。
- 稳定 key 不可修改。
- 题目数量和 ID 不完整。
- self/target 文案缺失或完全相同。
- 维度权重不等于 1。
- 阶段题或情景题缺失。
- 当前 revision 已变化。

## 7. 前台开发任务

主要文件：

- `src/pages/relation-heroine/relation-heroine.vue`
- `src/pages/relation-heroine-result/relation-heroine-result.vue`
- `src/pages/relation-heroine-history/relation-heroine-history.vue`
- `src/pages/taohua/taohua.vue`
- `src/pages/taohua-persona-result/taohua-persona-result.vue`
- `src/pages/case-detail/case-detail.vue`
- `src/pages.json`
- `src/utils/archetype-storage.ts`
- `src/utils/archetype-types.ts`
- `src/utils/api.ts`

### 7.1 性别解析流程

新增统一函数 `resolveRelationSubjectGender`：

```ts
resolveRelationSubjectGender({ mode, selfProfile, crushProfile, fallback }):
  'female' | 'male' | 'unknown'
```

规则：

- self 通过 `getSelfProfile()` 读取用户性别，不能只依赖可能过期的本地缓存。
- target 通过 `getCaseDetail()` 读取锁定 Crush 的 `profile.gender`。
- 客户端先执行中英文性别映射；服务端再根据已认证用户和自有 case 复核。
- unknown 时进入一次性选择页。
- 选择结果仅保存在当前测试状态和草稿 key 中。

如果当前用户与 Crush 性别相同，不强制改成异性题库，仍然按被测 Crush 的实际性别选择。

### 7.2 页面文案

- `displayTitle` 驱动 hero 标题、进度条、人物选择和结果页标题。
- 桃花人设入口、桃花结果入口和 Crush 详情入口根据上下文展示“关系女主角 / 关系男主角”；不能继续写死女主角。
- `pages.json` 的静态标题改为中性的“关系主角测试”，页面加载题库后使用 `uni.setNavigationBarTitle` 设置动态标题。
- target 页面继续显示只读“正在测试：{Crush}”。
- 测试中不提供切换 Crush 控件。
- 结果页显示“关系女主角 / 关系男主角”和相似度百分比。

### 7.3 草稿

草稿 key 改为：

```text
archetype_draft:relation_archetype:{userId}:{mode}:{caseId|self}:{subjectGender}:{personKey}:{contentVersion}
```

所有新草稿都必须带 `subjectGender`。结果仍保存 `personSnapshot.name`，保证同一次测试生成后展示名称稳定；本阶段不迁移历史结果。

## 8. 测试计划

### 8.1 单元测试

- 男女题库 schema 校验。
- 人物 key 动态校验，不允许未知 voteFor。
- 名称可改但 key 不可改。
- 三人物名称重复时校验失败。
- self/target 文案完整性和差异校验。
- target U 不计分，self 不允许 U。
- 四阶段每阶段 5 + 3 题完整。
- 男女版本使用独立维度和题目，不串题。
- 不存在旧结果兼容分支；新女性和男性题库必须分别通过同一套规则测试。
- 性别映射覆盖 `male/female/private` 和 `男/女/非二元/未说明`。

### 8.2 路由与权限测试

- 男用户测 Crush，Crush 性别为女，加载 female 题库。
- 女用户测 Crush，Crush 性别为男，加载 male 题库。
- 用户与 Crush 同性别时，按 Crush 性别加载对应题库。
- self 模式按用户自己的性别加载。
- Crush 未填写性别时出现选择，不猜测、不回写。
- 未登录、无权限、无当前 Crush、Crush 非本人所有时均拒绝。
- 测试页面不能切换 Crush。

### 8.3 结果测试

- 结果保存 `subjectGender`、`contentVersion`、`personSnapshot`。
- 修改人物名称后，新生成的结果显示当前发布版本名称，结果文档保存对应人物快照。
- 男女同名版本可以共存。
- 版本 checksum 不一致时拒绝提交。
- 结果集合只写入成功测试，不产生半成品记录。
- 发布 female 版本不会归档 male，发布 male 版本不会归档 female。
- 按 `resultId` 读取结果时，不要求客户端事先知道 `subjectGender`。

### 8.4 后台人工验收

1. 登录后台，切换女主角题库，复制草稿。
2. 将“冉莹颖型”改为临时名称并保存。
3. 校验并发布新版本。
4. 确认前台新测试显示新名称。
5. 切换男主角题库，编辑一个男性人物名称并发布。
6. 分别用男性和女性测试账号完成 self/target 流程。
7. 确认后台订阅配置没有被自动修改。

## 9. 部署顺序

1. 提交代码前运行类型检查、关系题库规则测试、集成测试和构建。
2. 运行 `node scripts/sync-shared.js`，确认所有云函数副本与 canonical shared 文件一致。
3. 部署共享模块及以下云函数：
   - `adminManage`
   - `getArchetypeQuestionBank`
   - `saveArchetypeResult`
   - `getArchetypeResults`
4. 在 `cloud1-d0gvhqu2c8a2b61fd` 审计结果集合必须为 0，执行索引初始化。
5. 创建并发布女性 `1.0.0` 和男性 `1.0.0` 两套新题库。
6. 将旧的无性别女性文档归档，不迁移或回填历史结果。
7. 验证两套题库各只有一个 published 版本，且发布一套不会归档另一套。
8. 验证未登录接口返回 `AUTH_REQUIRED`。
9. 构建 H5 和微信小程序包，进行入口、测试和结果页人工验收。

## 10. 完成标准

以下条件全部满足才算完成：

- 后台可以在不编辑 JSON 的情况下修改冉莹颖及另外两个人物的名称。
- 改名不会改变人物 key 或题目计分，结果文档保存当前发布版本的人物快照。
- 男、女题库可以同版本共存并独立发布。
- 男用户测女性 Crush 使用女主角题库，女用户测男性 Crush 使用男主角题库。
- self 模式按被测用户自身性别选择题库。
- 性别未知时由用户选择，不自动推断。
- 两套题库均满足 6 + 15 + 3 结构。
- 题目确实按男女版本分别编写，self/target 文案均完整。
- 当前 Crush 在测试过程中不可切换。
- 结果显示相似度百分比、题库版本、人物快照和观察置信度。
- Trial/Free/Pro/Ultra 权限仍由现有 `features/excludedFeatures` 控制，代码不写死套餐。
- 上线前结果集合保持为 0，不引入历史结果迁移逻辑。
- 云端发布、索引、接口鉴权和构建验收全部通过。

## 11. 不在本阶段范围内

- 不改 Crush 名人图鉴的 48 人名单和五维计分。
- 不增加首页 Banner。
- 不新增 AI 诊断或 AI 生成结果。
- 不自动修改套餐权限。
- 不在测试页增加 Crush 切换入口。
- 不把人物名称作为稳定 ID。
