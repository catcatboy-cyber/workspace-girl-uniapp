# 公司认证 CloudBase 迁移清单

记录时间：2026-06-13

## 环境

- 新环境 ID：`cloud1-d0gvhqu2c8a2b61fd`
- 新小程序 AppID：`wxb8bd1a6b518e931e`
- 旧环境 ID：`cloud1-d8gqh3f5g49993a5a`
- 当前分支：`migrate-company-miniprogram`

## 已确认的新环境配置

### 登录策略

- `EmailLogin`: `false`
- `AnonymousLogin`: `true`
- `UserNameLogin`: `true`
- `PhoneNumberLogin`: `false`
- MFA：关闭
- 首次/周期改密：关闭

### 函数安全规则

当前函数权限为 `CUSTOM`：

```json
{
  "*": {
    "invoke": "auth.loginType != 'ANONYMOUS' && auth != null"
  },
  "login": {
    "invoke": true
  },
  "register": {
    "invoke": true
  },
  "wechatLogin": {
    "invoke": true
  }
}
```

含义：

- `login` / `register` / `wechatLogin` 允许匿名态调用，用于 H5/小程序登录入口。
- 其它函数仍禁止匿名用户调用。

### 数据库权限

以下集合当前权限为 `PRIVATE`：

- `users`
- `cases`
- `assessments`
- `timeline_records`
- `system_settings`
- `weekly_reviews`
- `token_usage_records`
- `token_accounts`
- `token_ledger_records`
- `call_usage_records`
- `voice_usage`
- `recharge_orders`

### 云存储

- 存储桶：`636c-cloud1-d0gvhqu2c8a2b61fd-1442786291`
- 权限：`PRIVATE`
- 已确认宠物资源：
  - `pets/xiaomi/manifest.json`
  - `pets/xiaomi/spritesheet.webp`
  - `pets/doggo/manifest.json`
  - `pets/doggo/spritesheet.webp`

### 已确认过的关键函数配置

- `wechatLogin`: 已配置微信小程序 `WX_APPSECRET`。
- `login` / `register`: 已配置 CloudBase 自定义登录密钥，并兼容 `env_id` / `private_key_id` / `private_key` 变量名。
- `speechToText`: 已配置 ASR 密钥。
- `weeklyReview`: 有月度定时触发器 `monthlyTimer`，cron 为 `0 0 0 1 * * *`。

敏感值不写入仓库。后续审计脚本只记录变量名、存在性和哈希，不明文输出密钥。

## 已迁移或已恢复的数据/资源

- `system_settings` 相关业务配置已迁到新环境。
- 宠物云存储资源已恢复到新环境，并已更新 `src/utils/pets.js` 中的 fileID。
- 云函数代码已部署到新环境。
- H5 静态托管已部署到新环境域名：
  `https://cloud1-d0gvhqu2c8a2b61fd-1442786291.tcloudbaseapp.com`

## 明确未迁移的数据

用户历史业务数据未作为本次公司认证迁移的默认迁移范围，包括但不限于：

- `users`
- `cases`
- `assessments`
- `timeline_records`
- `weekly_reviews`
- `token_usage_records`
- `token_accounts`
- `token_ledger_records`
- `call_usage_records`
- `voice_usage`
- `recharge_orders`

如果需要完整迁移用户数据，应先做旧/新环境快照和差异审计，再单独执行数据迁移。

## 后续审计流程

使用脚本：

```bash
node scripts/audit-cloudbase-env.cjs snapshot --env cloud1-d0gvhqu2c8a2b61fd --name new-company
node scripts/audit-cloudbase-env.cjs snapshot --env cloud1-d8gqh3f5g49993a5a --name old-original
node scripts/audit-cloudbase-env.cjs compare --old old-original --new new-company
```

重点检查：

- `system_settings` 是否完全一致，尤其是 AI 提示词、模型、计费、订阅、风格配置。
- 云函数列表、运行时、触发器、环境变量名是否一致。
- 登录策略、函数安全规则、集合权限、云存储权限是否一致或符合新环境设计。
- 云存储资源是否缺失。

