/**
 * 统一邀请奖励结算模块
 * 使用方式：const { settleReward, blockClaim } = require('./_shared/referral-settlement')
 */

const { addExtraTokens, getSubscriptionConfig } = require('./subscription')

async function settleReward(db, inviteeUserId, inviterUserId, inviteCode, shareId, channel) {
  console.log('[settleReward] START', { invitee: inviteeUserId?.slice(0,20), inviter: inviterUserId?.slice(0,20), inviteCode: inviteCode?.slice(0,8), channel })
  // 1. 自邀请检查
  if (inviteeUserId === inviterUserId) {
    console.log('[settleReward] self-invite blocked')
    return { success: false, message: '自邀请不发放奖励' }
  }

  // 2. 幂等检查：一个被邀请人只能有一条 claim
  const existing = await db.collection('referral_claims')
    .where({ inviteeUserId }).limit(1).get()
  if (existing.data.length > 0) {
    console.log('[settleReward] invitee already has claim, skip')
    return { success: false, message: '该用户已被邀请过' }
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
    console.warn('[settleReward] read config failed, using defaults:', err?.message || err)
  }

  // 4. 创建 claim
  const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date()
  await db.collection('referral_claims').add({
    _id: claimId,
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
  const inviterResult = await addExtraTokens(db, inviterUserId, inviterReward,
    `referral_inviter:${claimId}`)
  if (!inviterResult.success) {
    console.warn('[settleReward] inviter addExtraTokens failed:', inviterResult.message)
  }

  // 6. 给被邀请人发 Token
  const inviteeResult = await addExtraTokens(db, inviteeUserId, inviteeReward,
    `referral_invitee:${claimId}`)
  if (!inviteeResult.success) {
    console.warn('[settleReward] invitee addExtraTokens failed:', inviteeResult.message)
  }

  console.log('[settleReward] done', { claimId, inviterReward, inviteeReward,
    invitee: inviteeUserId?.slice(0, 20), inviter: inviterUserId?.slice(0, 20) })

  return { success: true, claimId, inviterReward, inviteeReward }
}

async function blockClaim(db, inviteeUserId, reason) {
  try {
    await db.collection('referral_claims')
      .where({ inviteeUserId }).update({ status: 'blocked', updatedAt: new Date() })
    console.log('[blockClaim] blocked', inviteeUserId?.slice(0, 20), reason)
    return { success: true }
  } catch (err) {
    console.error('[blockClaim] error:', err?.message || err)
    return { success: false, message: err?.message || '封禁失败' }
  }
}

module.exports = { settleReward, blockClaim }
