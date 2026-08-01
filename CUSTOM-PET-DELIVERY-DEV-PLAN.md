# 定制宠物交付可见：开发方案（统一宠物目录版）

## 目标

Admin 完成定制宠物后，将资源上传到与小咪、Doggo 相同的宠物资源服务器。用户在「定制宠物」页看到“已制作完成”的状态，然后统一到「我的 → 更换宠物」中选择和使用。

定制宠物不再维护独立的“使用/停用”逻辑，而是作为当前用户可见的动态宠物条目，与内置 `xiaomi`、`doggo` 合并到同一个宠物目录，复用现有选择、下载、缓存和首页动画流程。

必须满足：

- 用户只能在宠物选择器中看到自己的定制宠物。
- 同一设备切换账号不能沿用上一个账号的定制宠物。
- 定制宠物资源协议与小咪、Doggo 一致。
- 资源缺失或 manifest 不合法时不能标记为已交付。
- H5 和微信小程序均可正常加载；失败时回退小咪。
- 交付完成只增加“可选择项”，不自动替用户切换宠物。
- Doggo 和定制宠物必须执行同一套“更换宠物”套餐权限检查。

---

## 0. 核心设计

```text
用户提交需求
    ↓
Admin 制作并上传标准宠物资源
    ↓
Admin 确认只读 Pet ID、填写资源版本，服务端验证资源后标记 delivered
    ↓
定制宠物页提示“已制作完成，请到更换宠物中选择”
    ↓
宠物选择器请求当前用户的 delivered pets
    ↓
内置 petOptions + 当前用户定制宠物
    ↓
复用 choosePet、下载缓存和首页精灵动画
```

关键原则：

- `petOptions` 继续保存内置宠物，但页面实际使用 `availablePets = petOptions + myDeliveredPets`。
- 定制宠物必须转换成与现有内置宠物相同的 `PetDefinition`。
- 只保留一个“当前选中宠物”概念，不新增 `activeCustomPet`。
- `selectedPetId` 必须按用户隔离；不能继续使用全局设备级 key。
- 不为每只定制宠物修改代码或重新发版。

---

## 1. 资源协议

### 1.1 存储路径

定制宠物与现有云宠物放在同一资源体系中：

```text
cloud://<env>/pets/custom/{petId}/{version}/spritesheet.webp
cloud://<env>/pets/custom/{petId}/{version}/manifest.json
cloud://<env>/pets/custom/{petId}/{version}/avatar.png
```

`petId` 由服务端根据请求 ID 生成，不允许 Admin 自由填写。固定算法为：

```text
custom_ + sha256(requestId).slice(0, 24)
```

Admin 获取请求列表时，服务端同时返回只读的 `expectedPetId`；制作人员按该 ID上传目录，Admin 只填写 `version`。服务端交付时再次计算并比对 `expectedPetId`，从源头避免两个请求误用同一个 Pet ID。

`version` 初始为 `v1`，替换资源时递增，避免客户端继续使用旧缓存。新交付只允许 `^v[1-9]\d{0,8}$`（如 `v1`、`v2`），服务端按数字部分校验新版本大于已交付版本；斜杠、反斜杠、空格和 `..` 必须在拼接路径前拒绝。`legacy-v1` 只允许迁移逻辑在服务端写入。

已成功交付的 `{petId}/{version}` 目录视为不可变资源，不允许原路径覆盖。需要修图或替换头像时上传新版本并重新交付；否则客户端和 CDN 缓存无法可靠失效。

### 1.2 manifest 契约

定制资源必须遵循现有精灵图协议：

```json
{
  "name": "custom_6f2a9c31a477d9f56b01c344",
  "renderer": "spritesheet",
  "cellWidth": 192,
  "cellHeight": 208,
  "columns": 8,
  "rows": 9,
  "rowMap": {
    "idle": 0,
    "running-right": 1,
    "running-left": 2,
    "waving": 3,
    "jumping": 4,
    "failed": 5,
    "waiting": 6,
    "running": 7,
    "review": 8
  },
  "states": {
    "idle": { "frames": 6, "fps": 6, "loop": true }
  }
}
```

服务端在交付时验证：

- 三个文件均存在且可读。
- manifest 是合法 JSON，`name` 与 `petId` 一致。
- `renderer === 'spritesheet'`；`cellWidth/cellHeight/columns/rows` 为受上限约束的正整数。
- `rowMap` 必须包含 `idle/running-right/running-left/waving/jumping/failed/waiting/running/review`，且每个行号处于 `[0, rows)`。
- `states` 中每个状态的 `frames` 必须处于 `[1, columns]`、`fps` 处于 `[1, 60]`，`loop` 为布尔值；允许缺失状态按现有内置宠物默认值补齐，但最终写入快照的 manifest 必须完整。
- `petId + version` 未交付给其他用户。

验证失败时，请求保持 `in_progress`。

### 1.3 可见性边界

用户端不提供全局定制宠物目录。`listMyDeliveredPets` 必须使用服务端鉴权得到的 `userId` 查询，不能相信前端传入的 `userId`。

`pets/custom/**` 固定使用私有 Storage 权限，不允许匿名列目录或读取，也不允许用户端上传或覆盖。由于当前 Storage ACL 为 `PRIVATE`，微信小程序和 H5 都由云函数在确认资源归属后生成短期 `avatarURL/spritesheetURL`；小程序再使用 `wx.downloadFile()` 将授权 URL 下载到用户隔离的本地目录，不能直接依赖 `wx.cloud.downloadFile(fileID)`。短期 URL 在有效期内属于 bearer capability，获得 URL 的客户端可直接读取，因此不得写入日志、分享数据或长期缓存；V1 的安全目标是“非所有者不能枚举或通过业务 API 获取资源”，不是 DRM。内置宠物目录可以保持现有权限。

### 1.4 环境配置

- `CUSTOM_PET_STORAGE_ROOT`：每个环境必填的 `cloud://...` 根路径；缺失时 Admin 预检和交付直接失败，禁止回退到代码内硬编码的其他环境。
- `CUSTOM_PET_TEMP_URL_MAX_AGE_SECONDS`：默认 3600，限制在 300-86400 秒；`urlExpiresAt` 必须按实际签发时间计算。
- `system_settings/settings_custom_pet.catalogEnabled`：复用现有服务端系统设置，默认 `false`；索引、Storage 规则、迁移和双端验证完成后才切换为 `true`。
- 云函数启动时校验配置格式并输出不含凭据的环境标识；客户端不得自行传入或覆盖 Storage root。

---

## 2. 数据模型与 API

### 2.1 `custom_pet_requests`

在现有字段基础上补充交付快照：

```text
_id: string
userId: string
nickname: string
description: string
referenceImages: string[]
status: 'pending' | 'in_progress' | 'delivered' | 'rejected'
adminNote: string
createdAt: Date
updatedAt: Date
deliveredAt: Date | null

  deliveredPet: {
  id: string
  version: string
  displayName: string
  avatarFileID: string
  spritesheetFileID: string
  manifestFileID: string
  manifest: object
} | null
```

`deliveredPet` 是交付时经过服务端校验的资源快照。V1 不新增独立资源集合，以减少改动；未来需要资源复用、审计或多版本管理时再拆成 `custom_pet_resources`。

`displayName` 由请求昵称规范化为纯文本，trim 后限制 1-40 个字符，空值回退“定制宠物”；不得把用户输入作为 HTML 渲染。所有 fileID 只能由服务端路径构造函数生成，不能从请求体直接写入快照。

### 2.2 用户请求记录

新增 `customPet.listMyRequests`：

```javascript
callFunction({
  name: 'customPet',
  data: { action: 'listMyRequests', cursor, limit: 20 }
})
```

返回：

```javascript
{
  success: true,
  requests: [{
    requestId,
    nickname,
    description,
    status,
    createdAt,
    updatedAt,
    referenceImageURLs
  }],
  nextCursor
}
```

定制宠物页只需要状态，不承担激活和资源下载。

### 2.3 当前用户可选宠物

新增 `customPet.listMyDeliveredPets`：

```javascript
callFunction({
  name: 'customPet',
  data: { action: 'listMyDeliveredPets' }
})
```

返回可直接转换为 `PetDefinition` 的数据：

```javascript
{
  success: true,
  pets: [{
    id: 'custom_6f2a9c31a477d9f56b01c344',
    version: 'v1',
    requestId: 'request-id',
    displayName: '奶糖',
    description: '你的专属定制宠物',
    renderer: 'spritesheet',
    avatarURL: 'https://temporary-url',
    spritesheetURL: 'https://temporary-url',
    urlExpiresAt: 0, // Unix epoch milliseconds
    avatarFileID: 'cloud://...',
    spritesheetFileID: 'cloud://...',
    manifestFileID: 'cloud://...',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: {},
    states: {}
  }],
  warnings: []
}
```

服务端只返回当前鉴权用户、`status === delivered` 且交付快照完整的宠物。微信小程序和 H5 都使用临时 `avatarURL/spritesheetURL`，并根据 `urlExpiresAt` 在过期前至少 60 秒刷新动态目录；小程序把精灵图下载到本地文件缓存，H5 直接交给浏览器加载。单个临时 URL 生成失败时在 `warnings` 返回对应 Pet ID；两端都必须过滤该条目，不得缓存半可用资源。`fileID` 仅作为服务端交付快照和审计信息，不作为私有 Storage 下的客户端直接下载凭证。

### 2.4 API 通用契约与索引

- 两个查询 action 都必须先完成服务端鉴权；即使请求体携带 `userId` 也必须忽略。未登录统一返回 `success: false, code: 'UNAUTHORIZED'`。
- `listMyRequests.limit` 默认 20、最小 1、最大 50；按 `createdAt desc, _id desc` 稳定排序。`nextCursor` 是服务端生成的不透明游标，至少包含最后一条记录的 `createdAt + _id`，前端不得自行拼接。
- 游标无效返回 `INVALID_CURSOR`，不能静默回到第一页；同一时间戳的多条记录不得漏项或重复。
- `listMyDeliveredPets` V1 最多返回 100 条；超过上限必须记录告警并返回可识别的 `CATALOG_LIMIT_EXCEEDED`，不能静默截断用户宠物。
- 建立并随发布记录验证以下复合索引：`(userId asc, createdAt desc)` 用于请求记录；`(userId asc, status asc, createdAt desc)` 用于已交付目录；Admin 状态筛选使用 `(status asc, createdAt desc)`。`_id` 继续作为稳定分页的第二排序键和游标 tie-breaker，依赖数据库内建 `_id` 索引，不重复加入复合索引定义。
- API 只返回白名单字段，不向用户端返回 `adminNote`、其他用户 ID、内部校验错误栈或 Storage 管理信息。

---

## 3. 前端统一宠物目录

### 3.1 `src/utils/pets.js`

保留现有 `petOptions` 作为内置宠物列表，新增：

- `getCachedDeliveredPets(userId)`：读取当前用户缓存的动态目录。
- `setCachedDeliveredPets(userId, pets)`：校验后缓存目录。
- `clearCachedDeliveredPets(userId)`：登出或账号切换时清理。
- `getAvailablePets(userId)`：返回 `petOptions + myDeliveredPets`。
- `getAvailablePetById(userId, petId)`：从合并目录解析宠物；找不到时返回小咪。
- `refreshDeliveredPetCatalog(userId)`：调用服务端刷新当前用户目录。
- `downloadPetAssets(petOrId, userId?)`：向后兼容现有 ID 参数，同时支持动态 `PetDefinition`，不再只根据硬编码 ID 查 `CLOUD_PET_CONFIG`。

必须调整：

- 不直接扩展现有 `normalizePetId()` 的含义，而是拆分“校验”和“回退”：`normalizeBuiltInPetId()` 只识别内置 ID 并返回 `null` 表示未知；`getAvailablePetById()` 才负责在最终解析失败时回退小咪。任何中间函数都不能把合法定制 ID 静默转换成 `xiaomi`。
- `getSelectedPetId()` 返回当前用户存储的原始 ID；`setSelectedPetId()` 必须先确认该 ID 存在于 `getAvailablePets(userId)`，无效时返回失败而不是写入小咪。
- `isCloudPet()` 根据解析后的 `PetDefinition` 是否带云资源判断，不能再用 `normalizePetId()` 或硬编码 ID 判断。
- `getLocalPetDir()` 对 Pet ID 和 version 做路径安全校验，`userId` 使用稳定哈希或安全编码作为目录段，并为定制宠物加入 `safeUserId/petId/version`；不能把原始 userId 直接拼路径，也不能先 normalize Pet ID 后生成目录。
- 当前选择存储为 `selectedPetId:{userId}`。`getSelectedPetId()`、`setSelectedPetId()` 未显式传入 userId 时从当前登录缓存读取，以兼容现有调用点。
- `getPetById()` 先查内置宠物，再查当前用户缓存的动态目录；保留原函数签名，使 timeline、self-profile、login 等页面无需逐一改造。
- 首次升级时可以把旧 `selectedPetId` 迁移到当前用户 key，然后删除旧 key。
- 定制宠物缓存目录包含 `userId/petId/version`，防止账号串缓存和版本污染。

跨端资源策略固定为：

- 微信小程序：使用服务端签发的短期 `spritesheetURL` 调用 `wx.downloadFile()`，再通过 `wx.getFileSystemManager()` 缓存到 `USER_DATA_PATH/pets/{safeUserId}/{petId}/{version}`；内置云宠物继续沿用现有 fileID 下载逻辑。
- H5：不调用任何 `wx` 文件系统 API，直接使用服务端鉴权后返回的临时 `spritesheetURL/avatarURL`；持久化目录只缓存资源描述和 `urlExpiresAt`，浏览器负责 HTTP 缓存。
- H5 页面显示或 URL即将过期时调用 `refreshDeliveredPetCatalog()` 换取新 URL；刷新失败时保留当前标准宠物，不使用已过期地址。
- `isPetCachedLocally()` 在微信小程序检查文件系统；H5 改为检查动态目录中是否存在未过期的可用 URL，不能共用微信实现。

`normalizePetId` 改造属于全链路高风险项。实施前后必须逐一审查以下函数及其调用方：

```text
normalizePetId / getSelectedPetId / setSelectedPetId / getPetById
isCloudPet / getLocalPetDir / isPetCachedLocally
getCachedSpritesheetPath / getResolvedSpritesheetPath / downloadPetAssets
```

使用全仓搜索覆盖 `src/` 和 `tests/`，重点检查 index、me、timeline、self-profile、login 等现有页面；不允许用“未知 ID自动变小咪”掩盖漏改调用点。

示例：

```javascript
export function getSelectedPetId(userId = getStoredUserId()) {
  if (!userId) return 'xiaomi'
  return uni.getStorageSync(`selectedPetId:${userId}`) || 'xiaomi'
}

export function getAvailablePets(userId) {
  return [...petOptions, ...getCachedDeliveredPets(userId)]
}

export function getAvailablePetById(userId, petId) {
  return getAvailablePets(userId).find((pet) => pet.id === petId) || petOptions[0]
}

export function getPetById(petId, userId = getStoredUserId()) {
  return getAvailablePetById(userId, petId)
}
```

### 3.2 `src/pages/me/me.vue`

- 页面显示或打开宠物选择器时调用 `refreshDeliveredPetCatalog(userId)`。
- 模板不直接把三类入口混在一个 `v-for` 中，而是固定为三段：
  1. “内置宠物”：小咪、Doggo 保持现有两列网格。
  2. “我的定制宠物”：仅在有已交付宠物时显示，每只占满一行；多只纵向排列并随面板滚动。
  3. “定制新宠物”：保留底部入口，文案由“定制专属宠物”改为“还想定制新的宠物？”。
- 三段展示使用 `builtInPets` 和 `myDeliveredPets` 两个计算结果，但选择逻辑仍统一使用 `availablePets`。
- 定制宠物点击后继续走现有 `choosePet()`：先执行与 Doggo 相同的 `checkFeatureAccess('更换宠物')`/`canSwitchPet()` 套餐权限检查；若本地目录过期则刷新服务端目录，并确认该 ID 仍存在于当前用户 delivered catalog；然后下载资源、写入选中 ID 并显示 Toast。定制宠物不能绕过现有更换宠物权限，也不能仅凭前端传入的 Pet ID 完成选择。
- 下载失败时不写入选中 ID，并保留原宠物。
- `PetId` 类型不能再限制为 `'xiaomi' | 'doggo'`。
- 选择器保持单个底部面板，内容区设置最大高度并纵向滚动；标题、关闭操作和底部“定制新宠物”入口不随异步列表高度跳动。
- 每个宠物选项的有效点击区域不小于 44×44 px；长名称最多两行或省略，不得挤压头像、状态徽标和选中标记；375 px 宽度下不得出现横向滚动。
- 动态目录加载中显示稳定占位，失败时保留内置宠物并显示可重试错误；无定制宠物时不显示空白分组，只保留“定制新宠物”入口。

### 3.3 `src/pages/index/index.vue`

- `syncSelectedPet()` 改为按当前 `userId` 调用 `getAvailablePetById()`。
- 冷启动时先读取该用户缓存目录，随后后台刷新 delivered pets。
- 服务端目录刷新后如果选中宠物已撤销或不存在，清除选择并回退小咪。
- `syncSelectedPet()` 对 Doggo 和定制宠物执行相同的“更换宠物”套餐权限复核；权限失效时清除选择并回退小咪。
- 首页继续使用统一 `selectedPet` 的名称、头像、spritesheet、rowMap 和 states，现有动画代码不另起分支。
- 定制资源缺失、下载失败或 manifest 不合法时回退小咪并提示。

### 3.4 `src/pages/custom-pet/custom-pet.vue`

- 增加“我的定制记录”列表、状态标签、时间、缩略图、加载态、空态和分页。
- `delivered` 显示：`已制作完成，请前往「我的 → 更换宠物」选择使用。`
- 页面只显示完成提示，不提供直接 use/stop，也不自动打开宠物选择器；用户按现有路径进入「我的 → 更换宠物」。
- 提交成功后刷新列表，而不是只延时返回。

### 3.5 `src/utils/api.ts` 与登出

- 增加 `getMyCustomPetRequests()`、`listMyDeliveredPets()` API 封装，避免与本地目录缓存函数重名。
- 调用使用项目现有 `{ name, data }` 签名。
- `logout()` 在清理用户身份前取得旧 `userId`，清除该用户的动态目录、选中 ID和定制资源内存态。
- 登录态失效或检测到账号 ID 变化时执行同等清理；任何未登录页面都不得继续解析上一账号的定制 Pet ID。

---

## 4. Admin 交付

### 4.1 最小改动方式

V1 不在 Admin 页面实现大文件上传。制作人员通过现有云存储控制台或脚本，将三个文件上传到约定目录。Admin 面板显示：

- 服务端生成、不可编辑的 `expectedPetId`
- `version`，默认 `v1`

### 4.2 服务端预检

`adminManage.updateCustomPetRequest` 在标记 delivered 前：

1. 根据 `requestId` 重新生成 `expectedPetId`，结合服务端存储配置和 `version` 构造三个 fileID；不接受客户端自定义 Pet ID。
   - 先校验 `requestId` 非空，`version` 符合白名单格式，再拼接路径；禁止把未校验输入直接带入 fileID。
2. 只下载体积较小的 `manifest.json`，解析并校验契约。
3. 调用当前 `@cloudbase/node-sdk` 已提供的 `app.getFileInfo({ fileList })` 检查 `spritesheet.webp` 和 `avatar.png` 的存在性、`size`、`contentType/mime`；manifest 上限为 256 KB、spritesheet 上限为 5 MB、avatar 上限为 1 MB，三者都必须大于 0；MIME 存在时分别校验 JSON、WebP 和 PNG，不下载完整图片。
4. 验证 manifest、三个文件路径和元数据相互一致。
5. 组装规范化的 `deliveredPet` 快照。
6. 使用事务或带 `status === in_progress`、原 `updatedAt` 前置条件的乐观锁，确认预检期间请求未被其他管理员修改。
7. 使用对同一请求文档的一次 `.update()`，原子写入 `deliveredPet`、`status: delivered`、`deliveredAt`、`updatedAt`；禁止先写快照再单独改状态。

任一步失败都返回明确错误，保持 `in_progress`。不能只检查 Pet ID 非空。

交付状态机固定为：`pending -> in_progress -> delivered|rejected`。只有 `in_progress` 可执行首次交付；若请求已经是 `delivered` 且 Pet ID、version 与快照完全相同，则返回幂等成功且不重复写库。已交付记录改用新资源必须显式执行“重新交付”并提供不同的更高版本，不能由普通状态更新覆盖。

Admin 面板显示交付后的 Pet ID、版本和校验结果；后续替换资源必须递增 version。交付请求进行中禁用重复操作，错误信息显示到具体文件或 manifest 字段，但不暴露云函数堆栈。

### 4.3 旧交付数据迁移

现有数据可能只有字符串 `deliveredPetId`，没有新的 `deliveredPet` 快照。上线前运行一次受控回填脚本或仅限 Admin 的迁移动作：

1. 分页查询全部 `status === delivered` 且缺少 `deliveredPet` 的记录，不得只处理固定前 100 条；保存恢复游标，支持中断续跑。
2. 旧记录固定标记为 `version: legacy-v1`，并按旧版无 version 路径 `pets/custom/{deliveredPetId}/` 构造三个 fileID，不移动原文件。
3. 执行与新交付相同的 manifest 下载和 `getFileInfo()` 校验。
4. 校验成功后只补写 `deliveredPet`；校验失败的记录输出报告，不静默伪造资源。
5. 回填完成并人工确认后，用户端才启用 `listMyDeliveredPets`。

迁移脚本必须支持 dry-run、幂等执行和失败清单，不修改 pending/in_progress/rejected 记录。

---

## 5. 文件与工作量

| 文件 | 改动 |
|---|---|
| `src/utils/pets.js` | 动态目录、按用户选择、统一解析和下载缓存 |
| `src/utils/api.ts` | 请求记录和已交付宠物 API |
| `src/pages/custom-pet/custom-pet.vue` | 状态列表和完成提示 |
| `src/pages/me/me.vue` | 合并目录、定制分组和统一选择 |
| `src/pages/index/index.vue` | 按用户解析活动宠物和失效回退 |
| `cloudfunctions/customPet/index.js` | 用户请求列表、已交付宠物目录和权限过滤 |
| `cloudfunctions/adminManage/index.js` | 资源预检和交付快照 |
| `src/pages/admin/components/panels/CustomPetPanel.vue` | version 输入、校验结果展示 |
| 数据库索引/Storage 规则 | 请求记录、已交付目录复合索引，以及 `pets/custom/**` 私有权限 |
| `scripts/` 或 Admin 迁移动作 | 旧 `deliveredPetId` 预检与 `deliveredPet` 幂等回填 |
| `tests/` | 动态目录、鉴权、资源校验和跨账号回归 |

预计 8-10 个代码文件，外加索引/Storage 配置与测试，约 350-550 行。相比独立 `activeCustomPet` 方案，状态和首页分支仍明显更少。

---

## 6. 实施顺序与发布门禁

1. 先落地服务端 Pet ID、路径、manifest 校验帮助函数及单元测试，不开放用户目录。
2. 增加交付快照、Admin 预检、并发保护和 dry-run 迁移；在测试环境上传一套有效资源和各一套缺文件、坏 manifest 资源验证。
3. 创建并验证数据库复合索引和 `pets/custom/**` 私有 Storage 规则；确认 H5 临时 URL 直读、微信授权 URL 下载与本地缓存都可用。
4. 执行旧数据 dry-run，处理失败清单，再正式回填；回填前保持用户端目录功能关闭。
5. 上线 `customPet` 查询 API，再实现前端动态目录、按用户选中状态和跨账号清理。
6. 最后接入“定制宠物”状态页、选择器第三分区和首页统一解析，完成双端回归后再开启功能开关。

回滚时先关闭用户端动态目录功能开关，使所有用户回退内置宠物；保留 `deliveredPet` 快照和新资源，不反向删除数据。旧 `selectedPetId` 迁移至少保留一个发布周期的兼容读取能力。

功能开关复用现有服务端系统设置；索引名称、创建结果、Storage 规则和开关默认值必须记录在仓库发布清单中，不能只保存在控制台操作记录里。

---

## 7. 验证与验收

| 编号 | 测试 | 验收标准 |
|---|---|---|
| T1 | Admin 上传标准资源并交付 | 三个文件和 manifest 校验通过后才变为 delivered |
| T2 | 资源缺失或 manifest 损坏 | manifest 下载校验或图片元数据检查失败；请求保持 in_progress |
| T3 | 定制需求页 | 用户看到自己的请求状态；delivered 显示“前往更换宠物”提示 |
| T4 | 宠物选择器 | 内置宠物和当前用户的定制宠物出现在统一列表中 |
| T5 | 选择定制宠物 | 先通过“更换宠物”套餐权限和资源归属检查，再复用下载流程并写入 `selectedPetId:{userId}` |
| T6 | 首页显示 | 名称、头像、动画状态和 spritesheet 均来自统一 PetDefinition |
| T7 | 下载失败 | 不切换宠物，保留原选择并提示重试 |
| T8 | 首页刷新/应用重启 | 当前用户仍显示已选择的定制宠物 |
| T9 | 同设备切换账号 | 用户 B 看不到也不会激活用户 A 的宠物或缓存 |
| T10 | 切回小咪/Doggo | 继续走原有更换逻辑，不存在双重激活状态 |
| T11 | 资源升级 | version 变化后重新下载，不使用旧缓存 |
| T12 | 交付撤销/数据异常 | 刷新目录后自动回退小咪 |
| T13 | 越权请求 | 伪造 userId 无法读取其他用户 delivered pets |
| T14 | 跨端构建 | H5 与微信小程序构建、宠物 smoke 和回归测试通过 |
| T15 | ID 全链路回归 | 所有相关函数和调用方均保留定制 ID，不在中间步骤静默变成 xiaomi；只有最终解析失败才回退 |
| T16 | 套餐权限 | 无“更换宠物”权限时 Doggo 和定制宠物行为一致，均不能选择或继续激活 |
| T17 | 交付预检开销 | 云函数只下载 manifest；精灵图和头像仅做元数据/轻量存在性检查，不下载完整图片 |
| T18 | 跨端资源加载 | 微信小程序用未过期授权 URL 下载并使用用户隔离的本地文件缓存；H5 只使用未过期临时 URL，代码路径不访问 `wx` 文件系统 |
| T19 | 原子交付 | 任意预检步骤失败时 status 和 deliveredPet 均不变；成功时通过一次文档更新同时写入 |
| T20 | 旧数据迁移 | dry-run、幂等回填和失败报告通过，旧 delivered 记录不会在升级后消失 |
| T21 | 选择器布局 | 内置宠物两列、定制宠物一行一只、底部“定制新宠物”入口均正确显示并可滚动 |
| T22 | 版本与路径安全 | 非法 version、路径分隔符和 `..` 均在拼接 fileID 前被拒绝 |
| T23 | 分页稳定性 | 相同 createdAt、多页加载和无效 cursor 均不丢项、不重复、不静默重置 |
| T24 | 并发与幂等 | 两个 Admin 同时交付时只有一个状态转换成功；同版本重试幂等，不覆盖已交付资源 |
| T25 | Storage 权限 | 匿名用户不能枚举或直接读取 custom 资源；非所有者无法通过业务 API 获得 fileID/临时 URL；H5 临时 URL 过期后不可继续使用 |
| T26 | 小屏与异常态 | 375 px 下无横向滚动/文字遮挡；加载、空态、失败重试和长名称均不引发布局跳动 |
| T27 | 环境隔离 | dev/prod 分别使用各自 Storage root；配置缺失时交付失败，不会访问或写入其他环境 |

完成标准：T1-T27 全部通过；H5/微信小程序构建、现有宠物 smoke、套餐权限回归和新增定制宠物测试全部通过；交付一只新定制宠物不需要修改前端代码或重新发布应用。

---

## 8. 开发环境发布验证记录（2026-08-01）

- 环境：`cloud1-d0gvhqu2c8a2b61fd`。
- Storage root：`cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291`；ACL 为 `PRIVATE`，仅创建者和管理员可读写。
- 已验证索引：
  - `custom_pet_user_created_desc`：`userId asc, createdAt desc`
  - `custom_pet_user_status_created_desc`：`userId asc, status asc, createdAt desc`
  - `custom_pet_status_created_desc`：`status asc, createdAt desc`
  - 稳定分页的第二排序键使用内建 `_id_` 索引。
- `adminManage` 与 `customPet` 的函数级 `@cloudbase/node-sdk` 已升级并锁定到 `3.18.3`，实测提供 `getFileInfo/downloadFile/getTempFileURL`。
- 旧版 `status === delivered` 且缺少 `deliveredPet` 的迁移候选只读计数为 `0`，dry-run 空集，无失败记录、无数据库写入。
- 未认证调用 `adminManage.backfillCustomPetDeliveries` 返回 `UNAUTHENTICATED`；伪造 `authUserId` 调用 `customPet.listMyDeliveredPets` 返回 `UNAUTHORIZED`。
- 功能开关先以 `catalogEnabled: false` 完成索引、迁移、双端构建、视觉与回归门禁；全部通过后于 2026-08-01 启用并回读确认 `catalogEnabled: true`。
- UI 实测：375px 与桌面均无横向溢出；内置宠物两列、定制宠物单列全宽、底部定制入口固定可见；关闭按钮 44×44px；长名称两行截断且徽标不与选中标记重叠。
