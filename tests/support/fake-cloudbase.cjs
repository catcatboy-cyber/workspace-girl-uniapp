const path = require('path')
const Module = require('module')

let currentFakeCloudbase = null
let mockInstalled = false
const originalLoad = Module._load

function clone(value) {
  return structuredClone(value)
}

function valuesEqual(left, right) {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }
  return left === right
}

function toComparable(value) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const ts = Date.parse(value)
    if (!Number.isNaN(ts)) return ts
  }
  return value
}

function matchesCondition(left, right) {
  if (right && typeof right === 'object' && right.__op === 'exists') {
    return right.value ? left !== undefined : left === undefined
  }
  if (right && typeof right === 'object' && right.__op === 'in' && Array.isArray(right.values)) {
    return right.values.some((value) => valuesEqual(left, value))
  }
  if (right && typeof right === 'object' && right.__op === 'nin' && Array.isArray(right.values)) {
    return !right.values.some((value) => valuesEqual(left, value))
  }
  if (right && typeof right === 'object' && right.__op === 'all' && Array.isArray(right.values)) {
    return Array.isArray(left) && right.values.every((value) => left.some((item) => valuesEqual(item, value)))
  }
  if (right && typeof right === 'object' && right.__op === 'neq') {
    return !valuesEqual(left, right.value)
  }
  if (right && typeof right === 'object' && (right.__op === 'lte' || right.__op === 'lt' || right.__op === 'gte' || right.__op === 'gt')) {
    const a = toComparable(left)
    const b = toComparable(right.value)
    if (a == null || b == null) return false
    if (right.__op === 'lte') return a <= b
    if (right.__op === 'lt') return a < b
    if (right.__op === 'gte') return a >= b
    if (right.__op === 'gt') return a > b
  }

  return valuesEqual(left, right)
}

function compareValues(left, right) {
  const a = left instanceof Date ? left.getTime() : left
  const b = right instanceof Date ? right.getTime() : right
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  return a > b ? 1 : -1
}

class FakeQuery {
  constructor(store, name, options = {}) {
    this.store = store
    this.name = name
    this.query = options.query || null
    this.order = options.order || null
    this.limitValue = options.limitValue || null
    this.skipValue = options.skipValue || 0
  }

  where(query) {
    return new FakeQuery(this.store, this.name, {
      query,
      order: this.order,
      limitValue: this.limitValue,
      skipValue: this.skipValue
    })
  }

  orderBy(field, direction) {
    return new FakeQuery(this.store, this.name, {
      query: this.query,
      order: { field, direction },
      limitValue: this.limitValue,
      skipValue: this.skipValue
    })
  }

  limit(limitValue) {
    return new FakeQuery(this.store, this.name, {
      query: this.query,
      order: this.order,
      limitValue,
      skipValue: this.skipValue
    })
  }

  skip(skipValue) {
    return new FakeQuery(this.store, this.name, {
      query: this.query,
      order: this.order,
      limitValue: this.limitValue,
      skipValue
    })
  }

  async _filterData() {
    let data = [...this.store.getCollection(this.name).values()]

    if (this.query) {
      data = data.filter((item) => Object.entries(this.query).every(([key, value]) => matchesCondition(item[key], value)))
    }

    if (this.order) {
      const factor = this.order.direction === 'desc' ? -1 : 1
      data.sort((left, right) => compareValues(left[this.order.field], right[this.order.field]) * factor)
    }

    return data
  }

  async get() {
    let data = await this._filterData()

    if (typeof this.skipValue === 'number' && this.skipValue > 0) {
      data = data.slice(this.skipValue)
    }

    if (typeof this.limitValue === 'number') {
      data = data.slice(0, this.limitValue)
    }

    return { data: clone(data) }
  }

  async count() {
    const data = await this._filterData()
    return { total: data.length }
  }

  async update(patch) {
    const map = this.store.getCollection(this.name)
    const data = await this._filterData()
    const cloned = clone(patch)
    let updated = 0
    for (const item of data) {
      const current = map.get(item._id)
      if (!current) continue
      // CAS 模拟：写入前用当前 store 值重新验证查询条件。
      // 真实 CloudBase 的条件更新在数据库端原子评估；并发下过滤快照可能过期，
      // 重验保证"并发抢占"（如 pending→paid 条件更新）只有一个调用成功。
      if (this.query && !Object.entries(this.query).every(([key, value]) => matchesCondition(current[key], value))) {
        continue
      }
      const values = {}
      for (const [key, value] of Object.entries(cloned)) {
        if (value && typeof value === 'object' && value.__op === 'inc') {
          values[key] = (current[key] || 0) + value.amount
        } else if (value && typeof value === 'object' && value.__op === 'push') {
          values[key] = [...(Array.isArray(current[key]) ? current[key] : []), ...value.values]
        } else if (value && typeof value === 'object' && value.__op === 'set') {
          values[key] = value.value
        } else {
          values[key] = value
        }
      }
      map.set(item._id, { ...current, ...values })
      updated += 1
    }
    return { updated }
  }

  async remove() {
    const map = this.store.getCollection(this.name)
    const { data } = await this.get()
    for (const item of data) {
      map.delete(item._id)
    }
    return { deleted: data.length }
  }
}

class FakeDocument {
  constructor(store, name, id) {
    this.store = store
    this.name = name
    this.id = id
  }

  async get() {
    const item = this.store.getCollection(this.name).get(this.id)
    return { data: item ? [clone(item)] : [] }
  }

  async update(patch) {
    const map = this.store.getCollection(this.name)
    const current = map.get(this.id)
    if (!current) {
      throw new Error(`Document not found: ${this.name}/${this.id}`)
    }

    const cloned = clone(patch)
    for (const [key, value] of Object.entries(cloned)) {
      if (value && typeof value === 'object' && value.__op === 'inc') {
        cloned[key] = (current[key] || 0) + value.amount
      } else if (value && typeof value === 'object' && value.__op === 'push') {
        cloned[key] = [...(Array.isArray(current[key]) ? current[key] : []), ...value.values]
      } else if (value && typeof value === 'object' && value.__op === 'set') {
        cloned[key] = value.value
      }
    }

    map.set(this.id, {
      ...current,
      ...cloned
    })

    return { updated: 1 }
  }

  async set(value) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '_id')) {
      const error = new Error('不能更新_id的值')
      error.code = 'INVALID_PARAM'
      throw error
    }
    const map = this.store.getCollection(this.name)
    map.set(this.id, { _id: this.id, ...clone(value) })
    return { created: 1, updated: 1 }
  }

  async remove() {
    const map = this.store.getCollection(this.name)
    map.delete(this.id)
    return { deleted: 1 }
  }
}

class FakeCollection {
  constructor(store, name) {
    this.store = store
    this.name = name
  }

  async add(doc) {
    const map = this.store.getCollection(this.name)
    const value = clone(doc)
    const id = value._id || `${this.name}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
    if (value._id && map.has(id)) {
      const err = new Error(`DOCUMENT_EXISTS: ${this.name}/${id}`)
      err.code = 'DOCUMENT_EXISTS'
      throw err
    }
    value._id = id
    map.set(id, value)
    return { id }
  }

  doc(id) {
    return new FakeDocument(this.store, this.name, id)
  }

  where(query) {
    return new FakeQuery(this.store, this.name, { query })
  }

  orderBy(field, direction) {
    return new FakeQuery(this.store, this.name, { order: { field, direction } })
  }

  limit(limitValue) {
    return new FakeQuery(this.store, this.name, { limitValue })
  }

  skip(skipValue) {
    return new FakeQuery(this.store, this.name, { skipValue })
  }

  async get() {
    return new FakeQuery(this.store, this.name).get()
  }

  async count() {
    return new FakeQuery(this.store, this.name).count()
  }
}

class FakeStore {
  constructor() {
    this.collections = new Map()
  }

  getCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map())
    }
    return this.collections.get(name)
  }

  dumpCollection(name) {
    return [...this.getCollection(name).values()].map((item) => clone(item))
  }

  snapshot() {
    const next = new FakeStore()
    for (const [name, collection] of this.collections.entries()) {
      const copied = new Map()
      for (const [id, item] of collection.entries()) {
        copied.set(id, clone(item))
      }
      next.collections.set(name, copied)
    }
    return next
  }

  replaceWith(nextStore) {
    this.collections = nextStore.snapshot().collections
  }
}

function createFakeCloudbase() {
  const store = new FakeStore()
  let currentAuthUserId = null
  const failures = []
  let injectedNow = null
  let transactionDocumentShape = 'array'

  function ensureUser(userId) {
    if (!userId) return
    const users = store.getCollection('users')
    if (users.has(userId)) return
    users.set(userId, {
      _id: userId,
      email: `${userId}@example.com`,
      role: 'admin',
      isAdmin: true,
      selfProfile: null,
      plan: 'free',
      trialEndsAt: null,
      planExpiresAt: null,
      monthlyTokensReset: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      monthlyTokensUsed: 0,
      extraTokens: 1000000,
      inviteCode: 'TEST00',
      invitedBy: null,
      referralCount: 0,
      referralWeekStart: null,
      referralWeekCount: 0,
      createdAt: new Date()
    })
  }

  function maybeFail(key) {
    const index = failures.findIndex((item) => item.key === key)
    if (index === -1) return
    const [failure] = failures.splice(index, 1)
    throw new Error(failure.message || `Mock failure for ${key}`)
  }

  function createDatabaseApi(targetStore, options = {}) {
    const isTransaction = Boolean(options.isTransaction)
    return {
      command: {
        exists(value) {
          return { __op: 'exists', value: Boolean(value) }
        },
        all(values) {
          return { __op: 'all', values: [...values] }
        },
        in(values) {
          return { __op: 'in', values: [...values] }
        },
        nin(values) {
          return { __op: 'nin', values: [...values] }
        },
        neq(value) {
          return { __op: 'neq', value }
        },
        lte(value) {
          return { __op: 'lte', value }
        },
        lt(value) {
          return { __op: 'lt', value }
        },
        gte(value) {
          return { __op: 'gte', value }
        },
        gt(value) {
          return { __op: 'gt', value }
        },
        inc(amount) {
          return { __op: 'inc', amount }
        },
        push(values) {
          return { __op: 'push', values: Array.isArray(values) ? [...values] : [values] }
        },
        set(value) {
          return { __op: 'set', value }
        }
      },
      async createCollection(name) {
        if (!targetStore.collections.has(name)) targetStore.collections.set(name, new Map())
        return { ok: true }
      },
      collection(name) {
        const collection = new FakeCollection(targetStore, name)
        const originalAdd = collection.add.bind(collection)
        const originalDoc = collection.doc.bind(collection)
        const originalWhere = collection.where.bind(collection)

        collection.add = async (doc) => {
          maybeFail(`collection.add:${name}`)
          if (isTransaction) maybeFail(`tx.collection.add:${name}`)
          return originalAdd(doc)
        }

        collection.doc = (id) => {
          const document = originalDoc(id)
          const originalGet = document.get.bind(document)
          const originalUpdate = document.update.bind(document)
          const originalSet = document.set.bind(document)
          const originalRemove = document.remove.bind(document)

          document.get = async () => {
            maybeFail(`doc.get:${name}`)
            maybeFail(`doc.get:${name}:${id}`)
            if (isTransaction) {
              maybeFail(`tx.doc.get:${name}`)
              maybeFail(`tx.doc.get:${name}:${id}`)
            }
            const result = await originalGet()
            if (isTransaction && transactionDocumentShape === 'object') {
              return { data: result.data?.[0] || null }
            }
            return result
          }

          document.update = async (patch) => {
            maybeFail(`doc.update:${name}`)
            maybeFail(`doc.update:${name}:${id}`)
            if (isTransaction) {
              maybeFail(`tx.doc.update:${name}`)
              maybeFail(`tx.doc.update:${name}:${id}`)
            }
            return originalUpdate(patch)
          }

          document.set = async (value) => {
            maybeFail(`doc.set:${name}`)
            maybeFail(`doc.set:${name}:${id}`)
            if (isTransaction) maybeFail(`tx.doc.set:${name}:${id}`)
            return originalSet(value)
          }

          document.remove = async () => {
            maybeFail(`doc.remove:${name}`)
            maybeFail(`doc.remove:${name}:${id}`)
            return originalRemove()
          }

          return document
        }

        collection.where = (query) => {
          const queryInstance = originalWhere(query)
          const originalGet = queryInstance.get.bind(queryInstance)
          const originalCount = queryInstance.count.bind(queryInstance)
          const originalRemove = queryInstance.remove.bind(queryInstance)

          queryInstance.get = async () => {
            maybeFail(`query.get:${name}`)
            return originalGet()
          }

          queryInstance.count = async () => {
            maybeFail(`query.count:${name}`)
            return originalCount()
          }

          queryInstance.remove = async () => {
            maybeFail(`query.remove:${name}`)
            return originalRemove()
          }

          return queryInstance
        }

        return collection
      },
      async startTransaction() {
        maybeFail('transaction.start')
        const transactionStore = targetStore.snapshot()
        const transactionDb = createDatabaseApi(transactionStore, { isTransaction: true })
        let closed = false

        return {
          command: transactionDb.command,
          collection: transactionDb.collection,
          async commit() {
            if (closed) throw new Error('Transaction already closed')
            maybeFail('transaction.commit')
            // 将事务快照写回主 store（targetStore 在顶层即 store）
            store.replaceWith(transactionStore)
            closed = true
            return { committed: true }
          },
          async rollback() {
            closed = true
            return { rolledBack: true }
          }
        }
      },
      async runTransaction(callback, times = 1) {
        let lastError = null
        for (let i = 0; i < times; i += 1) {
          const tx = await this.startTransaction()
          try {
            const result = await callback(tx)
            await tx.commit()
            return result
          } catch (error) {
            lastError = error
            try { await tx.rollback() } catch (_) {}
          }
        }
        throw lastError || new Error('runTransaction failed')
      }
    }
  }

  const app = {
    database() {
      return createDatabaseApi(store)
    },
    auth() {
      return {
        async getUserInfo() {
          return currentAuthUserId
            ? { customUserId: currentAuthUserId, uid: currentAuthUserId }
            : {}
        },
        async createTicket(userId) {
          return `ticket-${userId}`
        }
      }
    }
  }

  return {
    SYMBOL_CURRENT_ENV: 'mock-env',
    init() {
      return app
    },
    __failNext(key, message) {
      failures.push({ key, message })
    },
    __setAuthUser(userId) {
      currentAuthUserId = userId || null
      ensureUser(currentAuthUserId)
    },
    __setNow(value) {
      injectedNow = value == null ? null : new Date(value)
    },
    __setTransactionDocumentShape(shape) {
      transactionDocumentShape = shape === 'object' ? 'object' : 'array'
    },
    __now() {
      return injectedNow ? new Date(injectedNow) : new Date()
    },
    __store: store
  }
}

function installCloudbaseMock() {
  if (mockInstalled) return
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@cloudbase/node-sdk' && currentFakeCloudbase) {
      return currentFakeCloudbase
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  mockInstalled = true
}

function setCurrentFakeCloudbase(fakeCloudbase) {
  currentFakeCloudbase = fakeCloudbase
}

function clearCloudFunctionCache(projectRoot) {
  const cloudFunctionsRoot = path.join(projectRoot, 'cloudfunctions')
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(cloudFunctionsRoot)) {
      delete require.cache[key]
    }
  }
}

module.exports = {
  createFakeCloudbase,
  installCloudbaseMock,
  setCurrentFakeCloudbase,
  clearCloudFunctionCache
}
