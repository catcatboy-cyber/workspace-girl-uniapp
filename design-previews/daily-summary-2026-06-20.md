# 2026-06-20 今日工作总结

今天主要完成了 Crush Master 拉新 / 邀请奖励链路的上线前审计和实测。

## 1. 确认邀请奖励主链路可用

- 新用户带 `inviteCode` 注册后，成功生成 1 条 `referral_claims`
- 邀请人和被邀请人均成功发放 Token
- `call_usage_records.source` 已能区分：
  - `referral_inviter:<inviteeUserId>`
  - `referral_invitee:<inviteeUserId>`
- 重复调用 `redeemInviteCode` 会被幂等拦截，不会重复发 Token

## 2. 确认老用户回访不发奖

- 老用户点击分享链接后，只新增 `share_visits`
- 不新增 `referral_claims`
- 不新增 Token grant
- 不影响已有奖励数据

## 3. 修复并验证分享访问来源字段

- 之前 `trackShareVisit` 的登录态访问会丢失 `channel / scene / inviteCode`
- 修改后已线上验证成功：
  - `channel` 正常落库
  - `scene` 正常落库
  - `inviteCode` 正常落库
  - `visitorUserId` 正常落库
  - `loginSuccess=true`

## 4. 完成本地冒烟测试

- 新增/运行 `tests/run-referral-smoke.cjs`
- 覆盖邀请码奖励、重复兑换、source 格式、老用户回访、自邀请拦截、无效邀请码、鉴权等场景
- 结果：`9 passed, 0 failed`

## 5. 完成线上生产环境实测

- 使用 `audit_20260620` 前缀创建测试数据
- 实际调用了：
  - `register`
  - `redeemInviteCode`
  - `trackShareVisit`
- 查询线上 `users / referral_claims / call_usage_records / share_visits` 验证落库结果正确

## 6. 明确上线判断

- 分享 -> 邀请归因 -> 邀请人/被邀请人 Token 发放 -> 重复兑换幂等 -> 老用户回访不发奖，这条主链路已通过实测
- v1.3 后台可见性、v1.4 风控、v1.5 活动配置属于增强项，不阻塞当前上线
- 上线前只需再做一次微信真机扫码完整流程验证

## 当前结论

邀请奖励 MVP 主链路已经可以认为 OK，具备上线条件。
