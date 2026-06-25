/**
 * 统一邀请奖励结算模块
 * 使用方式：const { settleReward, blockClaim } = require('./_shared/referral-settlement')
 */

const { addExtraTokens, getSubscriptionConfig } = require('./subscription')

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

async function settleReward(db, inviteeUserId, inviterUserId, inviteCode, shareId, channel) {
  // 1. 自邀请检查
  if (inviteeUserId === inviterUserId) {
    return { success: false, message: '自邀请不发放奖励' }
  }

  // 2. 幂等检查：一个被邀请人只能有一条 claim（集合不存在时直接放行）
  try {
    const existing = await db.collection('referral_claims')
      .where({ inviteeUserId }).limit(1).get()
    if (existing.data?.length > 0) {
      return { success: false, message: '该用户已被邀请过' }
    }
  } catch (err) {
    // 集合不存在 → 首次创建，继续
    void err
  }

  // 3. 读取奖励配置
  let inviterReward = 3000
  let inviteeReward = 5000
  try {
    const config = await getSubscriptionConfig(db)
    if (config?.referral) {
      if (Number.isFinite(Number(config.referral.inviterRewardTokens)) && Number(config.referral.inviterRewardTokens) > 0) {
        inviterReward = Number(config.referral.inviterRewardTokens)
      }
      if (Number.isFinite(Number(config.referral.inviteeRewardTokens)) && Number(config.referral.inviteeRewardTokens) > 0) {
        inviteeReward = Number(config.referral.inviteeRewardTokens)
      }
    }
  } catch (err) {
    void err
  }

  // 4. 创建 claim（_id = inviteeUserId，天然幂等：并发写入第二个会失败）
  const now = new Date()
  await db.collection('referral_claims').add({
    _id: inviteeUserId,
    inviteeUserId,
    inviterUserId,
    inviteCode: inviteCode || '',
    shareId: shareId || '',
    channel: channel || '',
    status: 'rewarded',
    inviterTokens: inviterReward,
    inviteeTokens: inviteeReward,
    rewardedAt: now,
    createdAt: now,
    updatedAt: now
  })

  // 5. 给邀请人发 Token
  await addExtraTokens(db, inviterUserId, inviterReward,
    `referral_inviter:${inviteeUserId}`)

  // 6. 给被邀请人发 Token
  await addExtraTokens(db, inviteeUserId, inviteeReward,
    `referral_invitee:${inviteeUserId}`)

  // 7. 更新邀请人的 referralCount（前端据此检测新邀请并弹出通知）
  try {
    const weekStart = getWeekStart(new Date())
    const inviterDoc = await db.collection('users').doc(inviterUserId).get().catch(() => null)
    const inviter = inviterDoc?.data?.[0]
    if (inviter) {
      let referralWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
      let referralWeekCount = inviter.referralWeekCount || 0
      if (!referralWeekStart || referralWeekStart < weekStart) {
        referralWeekCount = 0
      }
      await db.collection('users').doc(inviterUserId).update({
        referralCount: db.command.inc(1),
        referralWeekStart: weekStart,
        referralWeekCount: referralWeekCount + 1
      })
    }
  } catch (err) {
    void err
  }

  return { success: true, inviteeUserId, inviterReward, inviteeReward }
}

async function blockClaim(db, inviteeUserId, reason) {
  try {
    await db.collection('referral_claims')
      .where({ inviteeUserId }).update({ status: 'blocked', updatedAt: new Date() })
    return { success: true }
  } catch (err) {
    return { success: false, message: err?.message || '封禁失败' }
  }
}

module.exports = { settleReward, blockClaim }
