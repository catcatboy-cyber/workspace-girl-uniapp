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

function matchesCondition(left, right) {
  if (right && typeof right === 'object' && right.__op === 'in' && Array.isArray(right.values)) {
    return right.values.some((value) => valuesEqual(left, value))
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
  }

  where(query) {
    return new FakeQuery(this.store, this.name, {
      query,
      order: this.order,
      limitValue: this.limitValue
    })
  }

  orderBy(field, direction) {
    return new FakeQuery(this.store, this.name, {
      query: this.query,
      order: { field, direction },
      limitValue: this.limitValue
    })
  }

  limit(limitValue) {
    return new FakeQuery(this.store, this.name, {
      query: this.query,
      order: this.order,
      limitValue
    })
  }

  async get() {
    let data = [...this.store.getCollection(this.name).values()]

    if (this.query) {
      data = data.filter((item) => Object.entries(this.query).every(([key, value]) => matchesCondition(item[key], value)))
    }

    if (this.order) {
      const factor = this.order.direction === 'desc' ? -1 : 1
      data.sort((left, right) => compareValues(left[this.order.field], right[this.order.field]) * factor)
    }

    if (typeof this.limitValue === 'number') {
      data = data.slice(0, this.limitValue)
    }

    return { data: clone(data) }
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

    map.set(this.id, {
      ...current,
      ...clone(patch)
    })

    return { updated: 1 }
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

  async get() {
    return new FakeQuery(this.store, this.name).get()
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

  function maybeFail(key) {
    const index = failures.findIndex((item) => item.key === key)
    if (index === -1) return
    const [failure] = failures.splice(index, 1)
    throw new Error(failure.message || `Mock failure for ${key}`)
  }

  function createDatabaseApi(targetStore) {
    return {
      command: {
        in(values) {
          return { __op: 'in', values: [...values] }
        }
      },
      collection(name) {
        const collection = new FakeCollection(targetStore, name)
        const originalAdd = collection.add.bind(collection)
        const originalDoc = collection.doc.bind(collection)
        const originalWhere = collection.where.bind(collection)

        collection.add = async (doc) => {
          maybeFail(`collection.add:${name}`)
          return originalAdd(doc)
        }

        collection.doc = (id) => {
          const document = originalDoc(id)
          const originalGet = document.get.bind(document)
          const originalUpdate = document.update.bind(document)
          const originalRemove = document.remove.bind(document)

          document.get = async () => {
            maybeFail(`doc.get:${name}`)
            return originalGet()
          }

          document.update = async (patch) => {
            maybeFail(`doc.update:${name}`)
            return originalUpdate(patch)
          }

          document.remove = async () => {
            maybeFail(`doc.remove:${name}`)
            return originalRemove()
          }

          return document
        }

        collection.where = (query) => {
          const queryInstance = originalWhere(query)
          const originalGet = queryInstance.get.bind(queryInstance)
          const originalRemove = queryInstance.remove.bind(queryInstance)

          queryInstance.get = async () => {
            maybeFail(`query.get:${name}`)
            return originalGet()
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
        const transactionStore = targetStore.snapshot()
        const transactionDb = createDatabaseApi(transactionStore)
        let closed = false

        return {
          command: transactionDb.command,
          collection: transactionDb.collection,
          async commit() {
            if (closed) throw new Error('Transaction already closed')
            maybeFail('transaction.commit')
            store.replaceWith(transactionStore)
            closed = true
            return { committed: true }
          },
          async rollback() {
            closed = true
            return { rolledBack: true }
          }
        }
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
