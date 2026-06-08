const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const TOKEN_ACCOUNTS = 'token_accounts'
const SYSTEM_SETTINGS = 'system_settings'
const BILLING_DOC_ID = 'settings_billing'

function defaultBillingSettings() {
  return {
    _id: BILLING_DOC_ID,
    scope: 'global',
    key: 'billing',
    firstGiftEnabled: true,
    welcomeTokens: 1000000,
    tokensPerYuan: 100000,
    rechargeTiers: [
      { id: 'p9_9', name: '基础包', priceFen: 990, bonusTokens: 0, enabled: true },
      { id: 'p19_9', name: '进阶包', priceFen: 1990, bonusTokens: 100000, enabled: true }
    ],
    modelPricing: [
      { modelId: '*', costMultiplier: 1 }
    ],
    insufficientBalanceMode: 'block',
    noUsageFallback: 'zero'
  }
}

async function ensureBillingSettings() {
  try {
    const { data } = await db.collection(SYSTEM_SETTINGS).doc(BILLING_DOC_ID).get()
    if (data && data.length > 0) return data[0]
  } catch {}
  const doc = defaultBillingSettings()
  await db.collection(SYSTEM_SETTINGS).add(doc)
  return doc
}

async function ensureTokenAccount(userId) {
  const { data } = await db.collection(TOKEN_ACCOUNTS).where({ userId }).limit(1).get()
  if (data && data.length > 0) return data[0]
  const now = new Date()
  const account = {
    userId,
    balanceTokens: 0,
    giftedTokens: 0,
    purchasedTokens: 0,
    consumedTokens: 0,
    firstGiftGranted: false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(TOKEN_ACCOUNTS).add(account)
  account._id = result.id || result._id
  return account
}

async function grantFirstGift(userId, billing) {
  if (billing.firstGiftEnabled === false) return null
  const account = await ensureTokenAccount(userId)
  if (account.firstGiftGranted) return { ...account, alreadyGranted: true }

  const tokens = billing.welcomeTokens || 1000000
  const now = new Date()
  await db.collection(TOKEN_ACCOUNTS).doc(account._id).update({
    balanceTokens: tokens,
    giftedTokens: tokens,
    firstGiftGranted: true,
    updatedAt: now
  })

  await db.collection('token_ledger_records').add({
    userId,
    type: 'gift',
    amountTokens: tokens,
    balanceAfter: tokens,
    remark: '新用户首次赠送',
    createdAt: now
  })

  return {
    ...account,
    balanceTokens: tokens,
    giftedTokens: tokens,
    firstGiftGranted: true,
    alreadyGranted: false
  }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const billing = await ensureBillingSettings()
    const action = String(event.action || 'getAccount')

    // 并行获取订阅状态
    let subscription = null
    try {
      const { getSubscriptionConfig, getMonthStart } = require('./_shared/subscription')
      const config = await getSubscriptionConfig(db)
      const { data } = await db.collection('users').doc(userId).get()
      const user = (data && data.length > 0) ? data[0] : null

      if (user && user.plan !== undefined) {
        const now = new Date()
        const monthStart = getMonthStart(now)
        let monthlyUsed = user.monthlyCallsUsed || 0
        const planConfig = config.plans[user.plan || 'free'] || config.plans.free
        const monthlyLimit = planConfig.monthlyTokens

        let isTrial = false
        if (user.trialEndsAt && now < new Date(user.trialEndsAt)) isTrial = true

        subscription = {
          plan: user.plan || 'free',
          planName: planConfig.name,
          isTrial,
          trialEndsAt: user.trialEndsAt || null,
          monthlyTokensUsed: monthlyUsed,
          monthlyTokensLimit: monthlyLimit,
          extraTokens: user.extraTokens || 0,
          inviteCode: user.inviteCode || ''
        }
      }
    } catch (err) {
      console.warn('getSubscriptionStatus in getTokenAccount failed (non-fatal):', err.message)
    }

    if (action === 'claimGift') {
      const result = await grantFirstGift(userId, billing)
      return { success: true, account: result || await ensureTokenAccount(userId), billing, subscription }
    }

    const account = await ensureTokenAccount(userId)
    return { success: true, account, billing, subscription }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getTokenAccount error:', error)
    return { success: false, message: '读取账户失败' }
  }
}
