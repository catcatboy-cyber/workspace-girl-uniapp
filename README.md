# workspace-girl-uniapp

workspace-girl 项目的 uni-app 版本 - 基于 Vue 3 + 腾讯云 CloudBase

## 项目状态

✅ **已完成**：
- [x] 创建 uni-app 项目骨架
- [x] 安装 CloudBase SDK
- [x] 配置项目结构（pages, components, utils, stores）
- [x] 创建 CloudBase 初始化文件
- [x] 创建 API 封装层
- [x] 创建辅助工具函数
- [x] 配置页面路由（pages.json）
- [x] 创建登录页面
- [x] 创建注册页面

⏳ **待完成**：
- [ ] 开通腾讯云 CloudBase 环境
- [ ] 配置环境 ID 到 `src/utils/cloudbase.ts`
- [ ] 创建云函数（login, register, getCases 等）
- [ ] 创建其他页面（首页、案例列表、时间线等）
- [ ] 数据库迁移
- [ ] 部署测试

---

## 下一步操作

### 1. 开通 CloudBase 环境

```bash
# 登录腾讯云
cloudbase login

# 创建环境（选择免费版）
cloudbase env:create workspace-girl-uniapp --alias "关系评估应用"

# 查看环境 ID
cloudbase env:list
```

记录下环境 ID（例如：`workspace-girl-xxxxx`）

### 2. 配置环境 ID

编辑 `src/utils/cloudbase.ts`，将 `ENV_ID` 替换为实际的环境 ID：

```typescript
const ENV_ID = 'workspace-girl-xxxxx' // 替换为实际环境 ID
```

### 3. 创建云函数

在项目根目录创建 `cloudfunctions` 目录，并创建以下云函数：

```
cloudfunctions/
├── login/              # 用户登录
├── register/           # 用户注册
├── getCases/           # 获取案例列表
├── createCase/         # 创建案例
├── getCaseDetail/      # 获取案例详情
├── deleteCase/         # 删除案例
├── updateCaseProfile/  # 更新案例画像
├── getTimeline/        # 获取时间线
├── createTimeline/     # 创建时间线记录
├── getAssessments/     # 获取评估历史
├── reassess/           # 重新评估
├── getAISettings/      # 获取 AI 设置
└── updateAISettings/   # 更新 AI 设置
```

### 4. 本地开发

```bash
# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# App 开发
npm run dev:app
```

### 5. 部署

```bash
# 部署云函数
cloudbase functions:deploy --all

# 部署 H5
npm run build:h5
cloudbase hosting:deploy dist/build/h5 -e workspace-girl-xxxxx

# 微信小程序
npm run build:mp-weixin
# 用微信开发者工具打开 dist/build/mp-weixin 并上传
```

---

## 项目结构

```
src/
├── pages/                    # 页面
│   ├── index/               # 首页
│   ├── login/               # 登录 ✅
│   ├── register/            # 注册 ✅
│   ├── cases/               # 案例列表
│   ├── case-detail/         # 案例详情
│   ├── timeline/            # 时间线
│   ├── assessments/         # 评估历史
│   ├── reassess/            # 重新评估
│   ├── edit-profile/        # 编辑画像
│   └── me/                  # 个人中心
├── components/              # 组件
│   ├── MobileNav.vue
│   ├── ProfileAvatar.vue
│   ├── AssessmentForm.vue
│   └── CaseCard.vue
├── stores/                  # Pinia 状态管理
│   ├── user.ts
│   └── case.ts
├── utils/                   # 工具 ✅
│   ├── cloudbase.ts        # CloudBase 初始化 ✅
│   ├── api.ts              # API 封装 ✅
│   └── helpers.ts          # 辅助函数 ✅
├── static/                  # 静态资源
├── pages.json              # 页面配置 ✅
├── manifest.json           # 应用配置
└── App.vue                 # 应用入口
```

---

## 技术栈

- **前端框架**: uni-app (Vue 3 + Vite)
- **云服务**: 腾讯云 CloudBase
- **数据库**: CloudBase MongoDB
- **云函数**: Node.js
- **云存储**: CloudBase 云存储
- **部署**: CloudBase 静态托管

---

## 免费额度

- 云函数: 1000 次/天
- 数据库: 2GB 存储
- 云存储: 5GB
- CDN 流量: 5GB/月

个人使用完全免费！

---

## 相关文档

- [uni-app 官方文档](https://uniapp.dcloud.net.cn/)
- [CloudBase 官方文档](https://cloud.tencent.com/document/product/876)
- [迁移计划](../../.claude/plans/eventual-wishing-dongarra.md)

---

## 联系方式

如有问题，请参考迁移计划文档或联系开发者。
