# 新版 UI 清理计划 - 2026-05-21

## 目标

只处理新版实际可触达页面，移除经典版 UI 和切换器；新版没有入口的旧页面暂不改动。

## 暂不处理的页面

以下页面新版主链路没有入口，先不改 UI、不删除文件、不从 `pages.json` 移除：

- `src/pages/reassess/reassess.vue`
- `src/pages/edit-profile/edit-profile.vue`
- `src/pages/assessments/assessments.vue`
- `src/pages/ai-settings/ai-settings.vue`

原因：

- `reassess`、`edit-profile`、`assessments` 的入口主要在 `case-detail.vue` 经典版模板里。
- 新版关系主页没有对应按钮。
- `assessments` 的能力已部分被 `timeline.vue` 新版里的“评估历史”Tab 替代。
- `ai-settings` 没有明显入口，后台 `admin.vue` 已经承担 AI 设置。

## 第一批：主 Tab 页面

优先处理用户最高频路径。

1. `src/pages/index/index.vue`
   - 删除经典版模板。
   - 删除“经典版 / 新首页”切换器。
   - 删除 `showV2`、`debug-classic`、`debug-banner`。
   - 将新首页模板改为默认唯一模板。

2. `src/pages/case-detail/case-detail.vue`
   - 删除经典版模板。
   - 保留新版关系主页。
   - 保留新版已有入口：周复盘、时间线等。
   - 不补回 `重新评估 / 编辑画像 / 独立评估历史`，除非之后明确需要。

3. `src/pages/timeline/timeline.vue`
   - 删除经典版模板。
   - 保留新版时间线、评估历史 Tab、系统记录 Tab。

4. `src/pages/cases/cases.vue`
   - 删除经典版模板。
   - 保留新版案例列表。

5. `src/pages/me/me.vue`
   - 删除经典版模板。
   - 保留新版个人中心、Token、本人画像等入口。

## 第二批：新版可触达业务页

6. `src/pages/new/new.vue`
   - 从案例页 / 关系页可进入。
   - 删除经典版模板，只保留新版新建对象页。

7. `src/pages/weekly-review/weekly-review.vue`
   - 从新版关系主页底部按钮进入。
   - 删除经典版模板，只保留新版周复盘。

8. `src/pages/self-profile/self-profile.vue`
   - 登录 onboarding / 我的页面可进入。
   - 删除经典版模板，只保留新版本人画像。

9. `src/pages/token-usage/token-usage.vue`
   - 我的页面可进入。
   - 删除经典版模板，只保留新版 Token 用量页。

10. `src/pages/token-recharge/token-recharge.vue`
    - 我的页面 / 额度不足弹窗可进入。
    - 删除经典版模板，只保留新版充值页。

## 第三批：账号与后台

11. `src/pages/login/login.vue`
    - 删除经典版模板，只保留新版登录。
    - 保持管理员登录跳转逻辑不变。

12. `src/pages/register/register.vue`
    - 删除经典版模板，只保留新版注册。

13. `src/pages/admin/admin.vue`
    - 删除顶部切换器和 `showV2` 残留。
    - 该页没有明显双模板，主要做残留清理，不大改结构。

## 每页清理清单

每个可触达页面完成后检查：

- 删除 `showV2`
- 删除 `version-toggle`
- 删除 `toggle-tab`
- 删除 `经典版`
- 删除 `新首页` 切换文案
- 删除 `debug-classic`
- 删除 `debug-banner`
- 删除 `<block v-if="!showV2">`
- 将 `<block v-if="showV2">` 内模板提升为默认模板
- 清理只服务经典版的入口函数和样式

## 验证计划

每批完成后运行：

```bash
npm.cmd run build:h5
npm.cmd run build:mp-weixin
```

手动验证主链路：

- 登录 / 注册
- 首页空状态新建对象
- 首页快速记录
- 生成即时反馈
- 生成属相星座侧写
- 关系主页
- 时间线三 Tab
- 周复盘 / 本周侧写
- 我的 / 本人画像 / Token 用量 / 充值
- 后台管理页

## 明确暂不做

- 不删除 `reassess/edit-profile/assessments/ai-settings` 文件。
- 不从 `pages.json` 移除这些页面。
- 不补新版入口。
- 不改这些页面 UI。

