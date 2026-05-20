const SYSTEM_SETTINGS = 'system_settings'
const TOKEN_ACCOUNTS = 'token_accounts'
const BILLING_DOC_ID = 'settings_billing'

async function ensureBillingSettings(db) {
  try {
    const { data } = await db.collection(SYSTEM_SETTINGS).doc(BILLING_DOC_ID).get()
    if (data && data.length > 0) return data[0]
  } catch {}
  const doc = {
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
  await db.collection(SYSTEM_SETTINGS).add(doc)
  return doc
}

async function ensureTokenAccount(db, userId) {
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

async function grantFirstGift(db, userId) {
  const billing = await ensureBillingSettings(db)
  if (billing.firstGiftEnabled === false) return null
  const account = await ensureTokenAccount(db, userId)
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

async function chargeTokenUsage(db, payload) {
  const { userId, realTokens, provider, model, usageId, feature } = payload
  if (!userId) return null

  const billing = await ensureBillingSettings(db)
  const multiplier = (billing.modelPricing || []).find(
    p => p.modelId === model || p.modelId === '*'
  )?.costMultiplier || 1

  const deducted = Math.ceil((realTokens || 0) * multiplier)
  if (deducted <= 0) return { deducted: 0 }

  const account = await ensureTokenAccount(db, userId)
  if (account.balanceTokens < deducted) {
    if (billing.insufficientBalanceMode === 'block') {
      return { deducted, insufficientBalance: true, balance: account.balanceTokens }
    }
  }

  const balanceAfter = Math.max(0, account.balanceTokens - deducted)
  const now = new Date()
  await db.collection(TOKEN_ACCOUNTS).doc(account._id).update({
    balanceTokens: balanceAfter,
    consumedTokens: (account.consumedTokens || 0) + deducted,
    updatedAt: now
  })

  await db.collection('token_ledger_records').add({
    userId,
    type: 'consume',
    amountTokens: -deducted,
    balanceAfter,
    relatedUsageId: usageId || '',
    feature: feature || 'unknown',
    provider: provider || '',
    model: model || '',
    realTokens: realTokens || 0,
    chargeMultiplier: multiplier,
    remark: `${feature || 'AI调用'} · ${model || 'unknown'} · 真实${realTokens || 0}t × ${multiplier}倍率`,
    createdAt: now
  })

  return { deducted, balanceAfter, insufficientBalance: false }
}

module.exports = {
  ensureBillingSettings,
  ensureTokenAccount,
  grantFirstGift,
  chargeTokenUsage
}
