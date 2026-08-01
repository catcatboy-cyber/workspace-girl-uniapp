# 定制宠物访问与公共发布开发计划

## 1. 目标

让一只已交付定制宠物支持三种访问来源：原始所有者、后台额外绑定账号、所有登录用户可见的公共宠物。三类宠物统一复用现有更换宠物、套餐权限、资源下载、缓存和首页动画逻辑。

公共宠物只增加可见性，不等于免费使用。用户选择公共宠物时仍必须通过现有“更换宠物”套餐权限检查。当前不开发社区目录、用户投稿、授权申请、审核页签、收藏、排行或宠物商城。

## 2. 数据模型

在 `custom_pet_requests` 增加：

```text
userId: string                    // 原始定制者，不修改
authorizedUserIds: string[]       // 后台额外绑定账号，最多 20 个
authorizedUsersUpdatedAt: Date
authorizedUsersUpdatedBy: string
isPublic: boolean                 // true 时所有登录用户可见，默认 false/未设置
publicStateUpdatedAt: Date
publicStateUpdatedBy: string
```

规则：

- 原始 `userId` 永远拥有访问权，不重复写入 `authorizedUserIds`。
- 绑定账号必须存在于 `users` 集合。
- 只有 `status === delivered` 且交付快照完整的宠物可以绑定账号或设为公共。
- 添加、删除和重复保存均由管理员接口处理并记录操作人。
- 公共状态由管理员显式开关；历史记录未设置 `isPublic` 时按私有处理。

## 3. 服务端

新增管理员操作：

```text
adminManage.setCustomPetAuthorizedUsers({
  requestId,
  authorizedUserIds,
  addCurrentAdmin
})

adminManage.setCustomPetPublic({
  requestId,
  isPublic
})
```

服务端从登录态识别管理员，不信任前端传入的管理员 ID。保存前校验请求状态、账号存在性、数量上限和 ID 格式。

`customPet.listMyDeliveredPets` 合并三类记录：

```text
request.userId === currentUserId
authorizedUserIds 包含 currentUserId
request.isPublic === true
```

合并后按 `createdAt/_id` 稳定排序并按请求 ID 去重，访问类型优先级为 `owner > authorized > public`。目录响应返回 `accessType`；公共宠物不返回真实 `requestId`，避免暴露定制需求记录标识。

`listMyRequests` 仍只返回原始所有者的需求记录，因此额外绑定账号和公共访问用户都看不到需求原文、参考图和后台备注。

## 4. 后台界面

在每条已交付宠物下增加“额外绑定账号”：

- 显示当前绑定账号。
- 一键绑定当前管理员。
- 输入一个或多个用户 ID 添加账号。
- 单独解除某个账号。
- 保存期间禁用重复操作，错误显示到现有后台错误区域。

同时增加“公共宠物”开关：

- 开启后，所有登录用户的可用宠物目录都能看到该宠物。
- 关闭后，仅原始所有者和额外绑定账号可见。
- 开关旁明确提示“所有登录用户可见，选择使用仍走套餐权限”。
- 后台接口使用真实登录管理员 ID 记录操作，不信任前端伪造字段。

## 5. 客户端

客户端不增加新页面或独立社区目录。所有者和绑定账号的宠物显示在“我的定制宠物”，公共访问的宠物显示在“公共宠物”；两组都使用相同的 `PetDefinition` 和选择流程：

```text
刷新可用宠物
  -> choosePet 套餐权限检查
  -> 下载/缓存资源
  -> 写入 selectedPetId:{userId}
  -> 首页统一动画渲染
```

`choosePet` 对除小咪外的所有宠物先调用 `checkFeatureAccess('更换宠物')`，因此 Doggo、个人定制宠物和公共宠物使用同一套套餐权限。账号切换、资源版本和本地缓存继续按用户隔离。

## 6. 测试与验收

| 场景 | 验收标准 |
|---|---|
| 原所有者登录 | 仍能看到宠物 |
| 已绑定账号登录 | 在“我的定制宠物”看到并可选择宠物 |
| 未绑定账号登录，宠物私有 | 看不到宠物 |
| 未绑定账号登录，宠物公共 | 在“公共宠物”看到宠物 |
| 公共响应隐私 | 不返回真实定制请求 ID、需求原文、参考图或后台备注 |
| 绑定当前管理员 | 管理员 ID 原子加入数组，重复操作幂等 |
| 绑定多个账号 | 去重并保留有效账号 |
| 绑定不存在账号 | 服务端拒绝，不修改原数据 |
| 绑定未交付请求 | 服务端拒绝 |
| 发布未交付请求 | 服务端拒绝 |
| 解除绑定 | 下次目录刷新后不再返回该宠物 |
| 取消公共 | 未绑定账号下次目录刷新后不再返回该宠物 |
| 套餐权限 | 与 Doggo 和原所有者定制宠物行为一致 |
| 跨端构建 | H5、微信小程序构建和定制宠物回归通过 |

## 7. 当前实施记录

- 请求 ID：`5edc49486a6ad7bf0079487b5c530a68`
- Pet ID：`custom_b4ab7b36a1952d16b38ea5b0`
- 已绑定管理员：`user_1781275271141_bb65a720`（常琦）
- 测试管理员 `admin_test_1` 未绑定。
- 公共发布能力：代码已实现，`adminManage` 与 `customPet` 已部署到开发环境。
- 自动验证：定制宠物专项测试、完整回归、H5 构建和微信小程序构建均通过。
- 剩余验收：在微信开发者工具或真机中检查后台开关及“公共宠物”分组的实际交互。
- 乌鸦当前公共状态：保持私有，除非管理员在后台显式开启。
