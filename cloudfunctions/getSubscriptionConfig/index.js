/**
 * 公开读取订阅配置（套餐/试用/分享奖励）v3.2
 */
const cloudbase = require('@cloudbase/node-sdk')
const { ensureSubscriptionConfig } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event) => {
  try {
    const config = await ensureSubscriptionConfig(db)

    return {
      success: true,
      config: {
        configVersion: config.configVersion,
        tokenExchangeRate: config.tokenExchangeRate || 1.5,
        featureEstTokens: config.featureEstTokens || {},
        trial: config.trial,
        plans: config.plans,
        referral: {
          enabled: config.referral?.enabled,
          inviterRewardTokens: config.referral?.inviterRewardTokens ?? config.referral?.inviterRewardCalls ?? 3000,
          inviterTrialExtendDays: config.referral?.inviterTrialExtendDays,
          inviteeRewardTokens: config.referral?.inviteeRewardTokens ?? config.referral?.inviteeRewardCalls ?? 5000,
          inviteeRewardLabel: config.referral?.inviteeRewardLabel,
          weeklyInviteCap: config.referral?.weeklyInviteCap
        },
        welcomeTokens: config.welcomeTokens ?? config.welcomeCalls ?? 10000,
        welcomeCalls: config.welcomeTokens ?? config.welcomeCalls  // 兼容
      }
    }
  } catch (error) {
    console.error('getSubscriptionConfig error:', error)
    return { success: false, message: '读取订阅配置失败' }
  }
}
