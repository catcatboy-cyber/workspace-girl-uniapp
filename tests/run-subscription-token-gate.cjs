#!/usr/bin/env node

const assert = require('assert')
const {
  checkTokenBalance,
  resolveEstimatedTokens,
  getModelCostMultiplier,
  DEFAULT_FEATURE_EST_TOKENS
} = require('../cloudfunctions/_shared/subscription')

function createDb({ user, subscription, billing }) {
  const docs = {
    users: { user1: user },
    system_settings: {
      settings_subscription: subscription,
      settings_billing: billing
    }
  }
  const command = { inc: value => ({ __inc: value }) }
  return {
    command,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              const value = docs[name]?.[id]
              return { data: value ? [value] : [] }
            },
            async update(patch) {
              docs[name][id] = { ...(docs[name][id] || {}), ...patch }
              return { updated: 1 }
            }
          }
        }
      }
    }
  }
}

async function main() {
  assert.strictEqual(resolveEstimatedTokens({ featureEstTokens: { quickRead: 123 } }, 'quickRead', 800), 123)
  assert.strictEqual(resolveEstimatedTokens({}, 'quickRead', 800), 800)
  assert.strictEqual(DEFAULT_FEATURE_EST_TOKENS.initial_assessment_text, 800)
  assert.strictEqual(DEFAULT_FEATURE_EST_TOKENS.petReplyStrategy, 1200)
  assert.strictEqual(DEFAULT_FEATURE_EST_TOKENS.petQaSingle, 300)
  assert.strictEqual(DEFAULT_FEATURE_EST_TOKENS.petQaGeneration, 600)

  const billing = {
    modelPricing: [
      { modelId: '*', costMultiplier: 1 },
      { modelId: 'deepseek-chat', costMultiplier: 0.1 }
    ]
  }
  const db = createDb({
    user: {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 86400000),
      monthlyTokensReset: new Date(),
      monthlyTokensUsed: 0,
      extraTokens: 79
    },
    subscription: {
      _id: 'settings_subscription',
      configVersion: 7,
      plans: { free: { monthlyTokens: 0 }, pro: { monthlyTokens: 0 }, ultra: { monthlyTokens: -1 } },
      featureEstTokens: { quickRead: 800 }
    },
    billing
  })

  assert.strictEqual(await getModelCostMultiplier(db, 'deepseek-chat'), 0.1)
  assert.strictEqual(await getModelCostMultiplier(db, 'other-model'), 1)

  const denied = await checkTokenBalance(db, 'user1', {
    featureKey: 'quickRead',
    modelId: 'deepseek-chat',
    fallbackTokens: 800
  })
  assert.strictEqual(denied.required, 80)
  assert.strictEqual(denied.ok, false)

  db.collection('users').doc('user1').update({ extraTokens: 80 })
  const allowed = await checkTokenBalance(db, 'user1', {
    featureKey: 'quickRead',
    modelId: 'deepseek-chat',
    fallbackTokens: 800
  })
  assert.strictEqual(allowed.required, 80)
  assert.strictEqual(allowed.ok, true)

  console.log('subscription token gate tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
