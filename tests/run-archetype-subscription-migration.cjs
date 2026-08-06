'use strict'

const assert = require('assert')
const { ensureSubscriptionConfig } = require('../cloudfunctions/_shared/subscription')

const existing = {
  _id: 'settings_subscription', scope: 'global', key: 'subscription', configVersion: 5,
  trial: { features: ['命理桃花'], excludedFeatures: [] },
  plans: {
    free: { name: '免费版', features: [], excludedFeatures: ['命理桃花'] },
    pro: { name: 'Pro', features: ['命理桃花'], excludedFeatures: [] },
    ultra: { name: 'Ultra', features: ['Pro全部'], excludedFeatures: [] }
  },
  referral: {}
}

const db = {
  collection(name) {
    assert.strictEqual(name, 'system_settings')
    return {
      doc(id) {
        assert.strictEqual(id, 'settings_subscription')
        return {
          async get() { return { data: [existing] } },
          async update(patch) { Object.assign(existing, patch); return { updated: 1 } }
        }
      },
      async add(doc) { throw new Error(`unexpected add ${doc?._id}`) }
    }
  }
}

async function main() {
  const migrated = await ensureSubscriptionConfig(db)
  assert.strictEqual(migrated.configVersion, 8)
  assert.strictEqual(migrated.heartPersonaReportPayment.priceFen, 199)
  assert.strictEqual(migrated.heartPersonaReportPayment.sandboxProductId, '0001')
  for (const feature of ['关系女主角', 'Crush名人图鉴', '次元角色图鉴']) {
    assert(migrated.trial.features.includes(feature))
    assert(migrated.plans.free.excludedFeatures.includes(feature))
    assert(migrated.plans.pro.features.includes(feature))
    assert(migrated.plans.ultra.features.includes(feature))
  }
  console.log(JSON.stringify({ success: true, configVersion: migrated.configVersion }, null, 2))
}

main().catch((error) => { console.error(error); process.exit(1) })
