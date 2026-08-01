const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')

process.env.CUSTOM_PET_STORAGE_ROOT = 'cloud://test-env.test-bucket'

const projectRoot = path.resolve(__dirname, '..')
const petsSource = fs.readFileSync(path.join(projectRoot, 'src', 'utils', 'pets.js'), 'utf8')
const resourceHelper = require(path.join(projectRoot, 'cloudfunctions', 'adminManage', '_shared', 'custom-pet-resource.js'))
const accessHelper = require(path.join(projectRoot, 'cloudfunctions', 'adminManage', '_shared', 'custom-pet-access.js'))
const catalogHelper = require(path.join(projectRoot, 'cloudfunctions', 'customPet', '_shared', 'custom-pet-catalog.js'))
const authHelper = require(path.join(projectRoot, 'cloudfunctions', 'customPet', '_shared', 'auth.js'))
const { createFakeCloudbase } = require('./support/fake-cloudbase.cjs')

function installUniStorage() {
  const values = new Map()
  global.uni = {
    getStorageSync(key) { return values.get(key) },
    setStorageSync(key, value) { values.set(key, value) },
    removeStorageSync(key) { values.delete(key) }
  }
  return values
}

async function loadPetsModule() {
  const url = `data:text/javascript;base64,${Buffer.from(petsSource).toString('base64')}#${Date.now()}`
  return import(url)
}

function loadCommonJsWithStubs(modulePath, stubs) {
  const resolved = require.resolve(modulePath)
  const originalLoad = Module._load
  delete require.cache[resolved]
  Module._load = function loadWithStubs(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request]
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    return require(resolved)
  } finally {
    Module._load = originalLoad
    delete require.cache[resolved]
  }
}

function deliveredPet(overrides = {}) {
  return {
    id: 'custom_1234567890abcdef12345678',
    requestId: 'request-a',
    version: 'v1',
    displayName: '奶糖',
    avatarFileID: 'cloud://env/pets/custom/avatar.png',
    spritesheetFileID: 'cloud://env/pets/custom/spritesheet.webp',
    manifestFileID: 'cloud://env/pets/custom/manifest.json',
    avatarURL: 'https://example.test/avatar.png',
    spritesheetURL: 'https://example.test/spritesheet.webp',
    urlExpiresAt: Date.now() + 30 * 60 * 1000,
    manifest: {
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 9,
      rowMap: {
        idle: 0,
        'running-right': 1,
        'running-left': 2,
        waving: 3,
        jumping: 4,
        failed: 5,
        waiting: 6,
        running: 7,
        review: 8
      }
    },
    ...overrides
  }
}

function validManifest(name) {
  return {
    name,
    renderer: 'spritesheet',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: {
      idle: 0,
      'running-right': 1,
      'running-left': 2,
      waving: 3,
      jumping: 4,
      failed: 5,
      waiting: 6,
      running: 7,
      review: 8
    },
    states: {}
  }
}

function validResourceApp(requestId, onDownload) {
  const petId = resourceHelper.buildExpectedPetId(requestId)
  return {
    async getFileInfo({ fileList }) {
      return {
        fileList: fileList.map((fileID) => ({
          code: 'SUCCESS',
          fileID,
          size: fileID.endsWith('manifest.json') ? 1024 : 64 * 1024,
          contentType: fileID.endsWith('.json') ? 'application/json' : fileID.endsWith('.webp') ? 'image/webp' : 'image/png'
        }))
      }
    },
    async downloadFile({ fileID }) {
      if (onDownload) await onDownload(fileID)
      return { fileContent: Buffer.from(JSON.stringify(validManifest(petId))) }
    }
  }
}

function createCatalogDatabase(records) {
  const command = {
    lt(value) { return { __op: 'lt', value } },
    all(values) { return { __op: 'all', values } },
    and(values) { return { __op: 'and', values } },
    or(values) { return { __op: 'or', values } }
  }
  const compare = (left, right) => {
    const a = left instanceof Date ? left.getTime() : left
    const b = right instanceof Date ? right.getTime() : right
    return a === b ? 0 : a > b ? 1 : -1
  }
  const matches = (item, condition) => {
    if (condition?.__op === 'and') return condition.values.every((entry) => matches(item, entry))
    if (condition?.__op === 'or') return condition.values.some((entry) => matches(item, entry))
    return Object.entries(condition || {}).every(([key, expected]) => {
      if (expected?.__op === 'lt') return compare(item[key], expected.value) < 0
      if (expected?.__op === 'all') return Array.isArray(item[key]) && expected.values.every((value) => item[key].includes(value))
      return compare(item[key], expected) === 0
    })
  }
  return {
    command,
    db: {
      command,
      collection() {
        const state = { where: {}, orders: [], limit: Infinity }
        const query = {
          where(value) { state.where = value; return query },
          orderBy(field, direction) { state.orders.push({ field, direction }); return query },
          limit(value) { state.limit = value; return query },
          async get() {
            const data = records.filter((item) => matches(item, state.where)).sort((left, right) => {
              for (const order of state.orders) {
                const result = compare(left[order.field], right[order.field])
                if (result) return order.direction === 'desc' ? -result : result
              }
              return 0
            }).slice(0, state.limit)
            return { data: structuredClone(data) }
          }
        }
        return query
      }
    }
  }
}

function tempUrlApp(missingSuffix = '') {
  return {
    async getTempFileURL({ fileList }) {
      return {
        fileList: fileList
          .filter(({ fileID }) => !missingSuffix || !fileID.endsWith(missingSuffix))
          .map(({ fileID }) => ({ fileID, code: 'SUCCESS', tempFileURL: `https://example.test/${encodeURIComponent(fileID)}` }))
      }
    }
  }
}

async function run(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

async function main() {
  await run('dynamic catalogs and selected pets are isolated by user', async () => {
    const storage = installUniStorage()
    const pets = await loadPetsModule()
    const petA = deliveredPet()
    const petB = deliveredPet({ id: 'custom_abcdef1234567890abcdef12', requestId: 'request-b', displayName: '豆包' })

    pets.setCachedDeliveredPets('user-a', [petA])
    pets.setCachedDeliveredPets('user-b', [petB])
    assert.deepEqual(pets.getAvailablePets('user-a').map((pet) => pet.id), ['xiaomi', 'doggo', petA.id])
    assert.deepEqual(pets.getAvailablePets('user-b').map((pet) => pet.id), ['xiaomi', 'doggo', petB.id])
    assert.equal(pets.setSelectedPetId(petA.id, 'user-a'), true)
    assert.equal(pets.setSelectedPetId(petA.id, 'user-b'), false)
    assert.equal(pets.getSelectedPetId('user-a'), petA.id)
    assert.equal(pets.getSelectedPetId('user-b'), 'xiaomi')
    assert.equal(pets.getPetById(petA.id, 'user-a').displayName, '奶糖')
    assert.equal(pets.getPetById(petA.id, 'user-b').id, 'xiaomi')

    pets.clearPetUserState('user-a')
    assert.equal(storage.has('deliveredPetCatalog:user-a'), false)
    assert.equal(storage.has('selectedPetId:user-a'), false)
    assert.equal(pets.getCachedDeliveredPets('user-b').length, 1)
  })

  await run('legacy built-in selection migrates once to the signed-in user', async () => {
    const storage = installUniStorage()
    const pets = await loadPetsModule()
    storage.set('selectedPetId', 'doggo')
    assert.equal(pets.getSelectedPetId('legacy-user'), 'doggo')
    assert.equal(storage.get('selectedPetId:legacy-user'), 'doggo')
    assert.equal(storage.has('selectedPetId'), false)
  })

  await run('H5 uses only unexpired temporary spritesheet URLs', async () => {
    installUniStorage()
    const pets = await loadPetsModule()
    const active = deliveredPet()
    pets.setCachedDeliveredPets('user-a', [active])
    const pet = pets.getPetById(active.id, 'user-a')
    assert.equal(pets.isPetCachedLocally(pet, 'user-a'), true)
    assert.equal(pets.getResolvedSpritesheetPath(pet, 'user-a'), active.spritesheetURL)
    assert.equal(await pets.downloadPetAssets(pet, 'user-a'), true)

    pets.setCachedDeliveredPets('user-a', [deliveredPet({ urlExpiresAt: Date.now() - 1 })])
    const expired = pets.getPetById(active.id, 'user-a')
    assert.equal(pets.isPetCachedLocally(expired, 'user-a'), false)
    assert.equal(pets.getResolvedSpritesheetPath(expired, 'user-a'), '')
    assert.equal(await pets.downloadPetAssets(expired, 'user-a'), false)
  })

  await run('mini program custom pets use authorized URLs and isolated local cache paths', async () => {
    installUniStorage()
    const files = new Set(['/data', '/data/pets'])
    let downloadedUrl = ''
    let cloudDownloadCount = 0
    global.wx = {
      env: { USER_DATA_PATH: '/data' },
      getFileSystemManager() {
        return {
          accessSync(filePath) { if (!files.has(filePath)) throw new Error('missing') },
          mkdirSync(filePath) { files.add(filePath) },
          unlinkSync(filePath) { files.delete(filePath) },
          saveFileSync(_tempFilePath, destPath) { files.add(destPath) },
          writeFileSync(filePath) { files.add(filePath) }
        }
      },
      downloadFile({ url, success }) {
        downloadedUrl = url
        success({ statusCode: 200, tempFilePath: '/tmp/custom-pet.webp' })
      },
      cloud: {
        init() {},
        downloadFile() { cloudDownloadCount += 1 }
      }
    }
    try {
      const pets = await loadPetsModule()
      const custom = deliveredPet()
      pets.setCachedDeliveredPets('用户 A', [custom])
      const pet = pets.getPetById(custom.id, '用户 A')
      assert.equal(await pets.downloadPetAssets(pet, '用户 A'), true)
      assert.equal(downloadedUrl, custom.spritesheetURL)
      assert.equal(cloudDownloadCount, 0)
      assert.equal(pets.isPetCachedLocally(pet, '用户 A'), true)
      assert.match(pets.getLocalPetDir(pet, '用户 A'), /\/pets\/u_[0-9a-f]+\/custom_/)
      assert.equal(pets.getLocalPetDir(pet, '用户 A').includes('/anonymous/'), false)
    } finally {
      delete global.wx
    }
  })

  await run('mini program rejects custom catalog entries without authorized URLs', async () => {
    installUniStorage()
    global.wx = {
      env: { USER_DATA_PATH: '/data' },
      getFileSystemManager: () => ({})
    }
    try {
      const pets = await loadPetsModule()
      const incomplete = deliveredPet({ spritesheetURL: '' })
      assert.deepEqual(pets.setCachedDeliveredPets('user-a', [incomplete]), [])
      assert.deepEqual(pets.getCachedDeliveredPets('user-a'), [])
    } finally {
      delete global.wx
    }
  })

  await run('catalog refresh validates and stores server results', async () => {
    installUniStorage()
    const pets = await loadPetsModule()
    const result = await pets.refreshDeliveredPetCatalog('user-a', async () => ({ success: true, pets: [deliveredPet()] }))
    assert.equal(result.length, 1)
    assert.equal(pets.getCachedDeliveredPets('user-a')[0].displayName, '奶糖')
    await assert.rejects(() => pets.refreshDeliveredPetCatalog('user-a', async () => ({ success: false, message: 'denied' })), /denied/)
  })

  await run('custom pet auth ignores forged user IDs and requires a verified session', async () => {
    const verifiedApp = {
      auth: () => ({ getUserInfo: async () => ({ customUserId: 'user-a' }) })
    }
    assert.equal(await authHelper.requireVerifiedAuthenticatedUserId(verifiedApp, { authUserId: 'user-b' }), 'user-a')

    const anonymousApp = {
      auth: () => ({ getUserInfo: async () => ({}) })
    }
    await assert.rejects(
      () => authHelper.requireVerifiedAuthenticatedUserId(anonymousApp, { authUserId: 'user-b' }),
      /UNAUTHENTICATED/
    )
  })

  await run('delivered catalog feature flag fails closed', async () => {
    const enabledDb = {
      collection: () => ({ doc: () => ({ get: async () => ({ data: [{ catalogEnabled: true }] }) }) })
    }
    const missingDb = {
      collection: () => ({ doc: () => ({ get: async () => ({ data: [] }) }) })
    }
    const failingDb = {
      collection: () => ({ doc: () => ({ get: async () => { throw new Error('offline') } }) })
    }
    assert.equal(await catalogHelper.isCustomPetCatalogEnabled(enabledDb), true)
    assert.equal(await catalogHelper.isCustomPetCatalogEnabled(missingDb), false)
    assert.equal(await catalogHelper.isCustomPetCatalogEnabled(failingDb), false)
  })

  await run('customPet main enforces the catalog flag and authenticated owner', async () => {
    const wxDb = { command: {} }
    const authenticatedUsers = []
    const catalogCalls = []
    let catalogEnabled = false
    const customPetModule = loadCommonJsWithStubs(
      path.join(projectRoot, 'cloudfunctions', 'customPet', 'index.js'),
      {
        '@cloudbase/node-sdk': {
          SYMBOL_CURRENT_ENV: Symbol('test-env'),
          init: () => ({ database: () => ({}) })
        },
        'wx-server-sdk': {
          DYNAMIC_CURRENT_ENV: Symbol('wx-test-env'),
          init() {},
          database: () => wxDb,
          getWXContext: () => ({})
        },
        './_shared/auth': {
          async requireVerifiedAuthenticatedUserId() {
            authenticatedUsers.push('owner-user')
            return 'owner-user'
          },
          buildAuthErrorResponse: () => null
        },
        './_shared/subscription': {
          checkFeatureAccess: async () => ({ allowed: true })
        },
        './_shared/custom-pet-catalog': {
          isCustomPetCatalogEnabled: async () => catalogEnabled,
          listMyRequests: async () => ({ success: true, requests: [], nextCursor: null }),
          listMyDeliveredPets: async ({ userId }) => {
            catalogCalls.push(userId)
            return { success: true, pets: [deliveredPet()], warnings: [] }
          }
        }
      }
    )

    const disabled = await customPetModule.main({ action: 'listMyDeliveredPets', authUserId: 'forged-user' })
    assert.deepEqual(disabled, { success: true, catalogEnabled: false, pets: [], warnings: [] })
    assert.deepEqual(catalogCalls, [])

    catalogEnabled = true
    const enabled = await customPetModule.main({ action: 'listMyDeliveredPets', authUserId: 'forged-user' })
    assert.equal(enabled.catalogEnabled, true)
    assert.deepEqual(catalogCalls, ['owner-user'])
    assert.deepEqual(authenticatedUsers, ['owner-user', 'owner-user'])
  })

  await run('admin backfill endpoint returns a resumable nextCursor', async () => {
    const rows = [
      { _id: 'legacy-a', status: 'delivered' },
      { _id: 'legacy-b', status: 'delivered' },
      { _id: 'legacy-c', status: 'delivered' }
    ]
    const batches = []
    const accessCalls = []
    const command = {
      gt: (value) => ({ __op: 'gt', value }),
      and: (values) => ({ __op: 'and', values })
    }
    const db = {
      command,
      collection(name) {
        if (name === 'users') {
          return {
            doc: () => ({ get: async () => ({ data: { _id: 'admin-user', isAdmin: true } }) })
          }
        }
        assert.equal(name, 'custom_pet_requests')
        const state = { where: null, limit: 20 }
        const query = {
          where(value) { state.where = value; return query },
          orderBy() { return query },
          limit(value) { state.limit = value; return query },
          async get() {
            const gt = state.where?.__op === 'and'
              ? state.where.values.find((item) => item?._id?.__op === 'gt')?._id?.value
              : ''
            return { data: rows.filter((item) => !gt || item._id > gt).slice(0, state.limit) }
          },
          doc: () => ({ update: async () => ({}) })
        }
        return query
      }
    }
    const adminModule = loadCommonJsWithStubs(
      path.join(projectRoot, 'cloudfunctions', 'adminManage', 'index.js'),
      {
        '@cloudbase/node-sdk': {
          SYMBOL_CURRENT_ENV: Symbol('admin-test-env'),
          init: () => ({
            database: () => db,
            auth: () => ({ getUserInfo: async () => ({ customUserId: 'admin-user' }) })
          })
        },
        './_shared/custom-pet-resource': {
          buildExpectedPetId: () => 'unused',
          deliverCustomPetRequest: async () => ({ idempotent: false }),
          backfillDeliveredPetRecords: async ({ requests, dryRun }) => {
            batches.push({ ids: requests.map((item) => item._id), dryRun })
            return { total: requests.length, succeeded: requests.length, failed: 0, failures: [] }
          }
        },
        './_shared/custom-pet-access': {
          updateCustomPetAuthorizedUsers: async (args) => {
            accessCalls.push(args)
            return { success: true, authorizedUserIds: ['admin-user'] }
          },
          updateCustomPetPublic: async (args) => {
            accessCalls.push(args)
            return { success: true, isPublic: args.isPublic }
          }
        }
      }
    )

    const first = await adminModule.main({ action: 'backfillCustomPetDeliveries', limit: 2 })
    assert.equal(first.success, true)
    assert.equal(first.nextCursor, 'legacy-b')
    assert.deepEqual(batches[0], { ids: ['legacy-a', 'legacy-b'], dryRun: true })

    const second = await adminModule.main({ action: 'backfillCustomPetDeliveries', limit: 2, cursor: first.nextCursor })
    assert.equal(second.success, true)
    assert.equal(second.nextCursor, null)
    assert.deepEqual(batches[1], { ids: ['legacy-c'], dryRun: true })

    const access = await adminModule.main({
      action: 'setCustomPetAuthorizedUsers',
      requestId: 'request-access',
      authorizedUserIds: [],
      addCurrentAdmin: true,
      adminUserId: 'forged-admin'
    })
    assert.equal(access.success, true)
    assert.equal(accessCalls[0].adminUserId, 'admin-user')
    assert.equal(accessCalls[0].addCurrentAdmin, true)

    const publicAccess = await adminModule.main({
      action: 'setCustomPetPublic',
      requestId: 'request-access',
      isPublic: true,
      adminUserId: 'forged-admin'
    })
    assert.equal(publicAccess.success, true)
    assert.equal(accessCalls[1].adminUserId, 'admin-user')
    assert.equal(accessCalls[1].isPublic, true)
  })

  await run('request pagination is stable and delivered pets include explicitly authorized accounts', async () => {
    const sameTime = new Date('2026-07-31T12:00:00.000Z')
    const older = new Date('2026-07-30T12:00:00.000Z')
    const requestRecords = [
      { _id: 'req-c', userId: 'user-a', status: 'pending', createdAt: sameTime },
      { _id: 'req-b', userId: 'user-a', status: 'pending', createdAt: sameTime },
      { _id: 'req-a', userId: 'user-a', status: 'pending', createdAt: sameTime },
      { _id: 'req-old', userId: 'user-a', status: 'pending', createdAt: older },
      { _id: 'req-other', userId: 'user-b', status: 'pending', createdAt: new Date('2026-08-01T12:00:00.000Z') }
    ]
    const requestDb = createCatalogDatabase(requestRecords)
    const first = await catalogHelper.listMyRequests({
      db: requestDb.db,
      command: requestDb.command,
      app: tempUrlApp(),
      event: { limit: 2 },
      userId: 'user-a'
    })
    const second = await catalogHelper.listMyRequests({
      db: requestDb.db,
      command: requestDb.command,
      app: tempUrlApp(),
      event: { limit: 2, cursor: first.nextCursor },
      userId: 'user-a'
    })
    assert.deepEqual(first.requests.map((item) => item.requestId), ['req-c', 'req-b'])
    assert.deepEqual(second.requests.map((item) => item.requestId), ['req-a', 'req-old'])
    await assert.rejects(
      () => catalogHelper.listMyRequests({ db: requestDb.db, command: requestDb.command, app: tempUrlApp(), event: { cursor: 'bad' }, userId: 'user-a' }),
      (error) => error?.code === 'INVALID_CURSOR'
    )

    const petA = deliveredPet({ avatarURL: '', spritesheetURL: '' })
    const petB = deliveredPet({
      id: 'custom_abcdef1234567890abcdef12',
      requestId: 'request-b',
      displayName: '豆包',
      avatarFileID: 'cloud://env/pets/custom/b/avatar.png',
      spritesheetFileID: 'cloud://env/pets/custom/b/spritesheet.webp',
      manifestFileID: 'cloud://env/pets/custom/b/manifest.json',
      avatarURL: '',
      spritesheetURL: ''
    })
    const petC = deliveredPet({
      id: 'custom_fedcba0987654321fedcba09',
      requestId: 'request-c',
      displayName: '星星',
      avatarFileID: 'cloud://env/pets/custom/c/avatar.png',
      spritesheetFileID: 'cloud://env/pets/custom/c/spritesheet.webp',
      manifestFileID: 'cloud://env/pets/custom/c/manifest.json',
      avatarURL: '',
      spritesheetURL: ''
    })
    const deliveredRecords = [
      { _id: 'request-a', userId: 'user-a', status: 'delivered', createdAt: sameTime, nickname: '奶糖', deliveredPet: petA },
      { _id: 'request-b', userId: 'user-b', authorizedUserIds: ['user-a'], status: 'delivered', createdAt: sameTime, nickname: '豆包', deliveredPet: petB },
      { _id: 'request-c', userId: 'user-d', isPublic: true, status: 'delivered', createdAt: sameTime, nickname: '星星', deliveredPet: petC }
    ]
    const deliveredDb = createCatalogDatabase(deliveredRecords)
    const catalog = await catalogHelper.listMyDeliveredPets({ db: deliveredDb.db, app: tempUrlApp(), userId: 'user-a' })
    assert.deepEqual(catalog.pets.map((pet) => pet.id), [petC.id, petB.id, petA.id])
    assert.deepEqual(catalog.pets.map((pet) => pet.accessType), ['public', 'authorized', 'owner'])
    assert.equal(catalog.pets[0].requestId, undefined, 'public catalog must not expose the source request ID')
    assert.deepEqual(catalog.warnings, [])
    const unbound = await catalogHelper.listMyDeliveredPets({ db: deliveredDb.db, app: tempUrlApp(), userId: 'user-c' })
    assert.deepEqual(unbound.pets.map((pet) => pet.id), [petC.id])
    assert.equal(unbound.pets[0].accessType, 'public')

    installUniStorage()
    const pets = await loadPetsModule()
    const stored = await pets.refreshDeliveredPetCatalog('user-a', async () => catalog)
    assert.equal(stored.length, 3)
    assert.equal(stored.find((pet) => pet.id === petC.id).accessType, 'public')
    assert.equal(stored.find((pet) => pet.id === petC.id).requestId, petC.id)
  })

  await run('admin can bind multiple existing accounts to a delivered pet', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const users = fake.__store.getCollection('users')
    users.set('owner-user', { _id: 'owner-user' })
    users.set('admin-user', { _id: 'admin-user', isAdmin: true })
    users.set('viewer-user', { _id: 'viewer-user' })
    const requests = fake.__store.getCollection('custom_pet_requests')
    requests.set('request-access', {
      _id: 'request-access',
      userId: 'owner-user',
      status: 'delivered',
      deliveredPet: { id: 'custom_access' },
      authorizedUserIds: []
    })

    const currentAdmin = await accessHelper.updateCustomPetAuthorizedUsers({
      db,
      requestId: 'request-access',
      authorizedUserIds: [],
      addCurrentAdmin: true,
      adminUserId: 'admin-user'
    })
    assert.deepEqual(currentAdmin.authorizedUserIds, ['admin-user'])

    const multiple = await accessHelper.updateCustomPetAuthorizedUsers({
      db,
      requestId: 'request-access',
      authorizedUserIds: ['admin-user', 'viewer-user', 'viewer-user', 'owner-user'],
      adminUserId: 'admin-user'
    })
    assert.deepEqual(multiple.authorizedUserIds, ['admin-user', 'viewer-user'])
    assert.deepEqual(requests.get('request-access').authorizedUserIds, ['admin-user', 'viewer-user'])

    const published = await accessHelper.updateCustomPetPublic({
      db,
      requestId: 'request-access',
      isPublic: true,
      adminUserId: 'admin-user'
    })
    assert.equal(published.isPublic, true)
    assert.equal(requests.get('request-access').isPublic, true)
    const unpublished = await accessHelper.updateCustomPetPublic({
      db,
      requestId: 'request-access',
      isPublic: false,
      adminUserId: 'admin-user'
    })
    assert.equal(unpublished.isPublic, false)
    assert.equal(requests.get('request-access').isPublic, false)

    await assert.rejects(
      () => accessHelper.updateCustomPetAuthorizedUsers({
        db,
        requestId: 'request-access',
        authorizedUserIds: ['missing-user'],
        adminUserId: 'admin-user'
      }),
      (error) => error?.code === 'USER_NOT_FOUND'
    )

    requests.set('request-pending', {
      _id: 'request-pending',
      userId: 'owner-user',
      status: 'in_progress',
      deliveredPet: null
    })
    await assert.rejects(
      () => accessHelper.updateCustomPetPublic({
        db,
        requestId: 'request-pending',
        isPublic: true,
        adminUserId: 'admin-user'
      }),
      (error) => error?.code === 'PET_NOT_DELIVERED'
    )
  })

  await run('server-generated pet IDs are deterministic and paths are versioned', async () => {
    const first = resourceHelper.buildExpectedPetId('request-123')
    const second = resourceHelper.buildExpectedPetId('request-123')
    assert.equal(first, second)
    assert.match(first, /^custom_[a-f0-9]{24}$/)
    const current = resourceHelper.buildResourceFileIDs({ requestId: 'request-123', version: 'v2' })
    assert.ok(current.spritesheetFileID.includes(`/pets/custom/${first}/v2/spritesheet.webp`))
    const legacy = resourceHelper.buildResourceFileIDs({ requestId: 'request-123', legacy: true, legacyPetId: 'custom_old', version: 'legacy-v1' })
    assert.ok(legacy.spritesheetFileID.endsWith('/pets/custom/custom_old/spritesheet.webp'))
    assert.throws(() => resourceHelper.normalizeVersion('../v2'), /资源版本格式无效/)
    assert.throws(() => resourceHelper.normalizeVersion('release-2'), /资源版本格式无效/)
    assert.equal(resourceHelper.versionNumber('v12'), 12)

    const configuredRoot = process.env.CUSTOM_PET_STORAGE_ROOT
    delete process.env.CUSTOM_PET_STORAGE_ROOT
    assert.throws(() => resourceHelper.buildResourceFileIDs({ requestId: 'request-123', version: 'v1' }), /CUSTOM_PET_STORAGE_ROOT/)
    process.env.CUSTOM_PET_STORAGE_ROOT = configuredRoot
  })

  await run('admin delivery is transactional, idempotent and rejects concurrent changes', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const requests = fake.__store.getCollection('custom_pet_requests')
    const createdAt = new Date('2026-07-31T10:00:00.000Z')
    requests.set('delivery-a', {
      _id: 'delivery-a',
      userId: 'user-a',
      nickname: '奶糖',
      status: 'in_progress',
      createdAt,
      updatedAt: createdAt,
      deliveredPet: null
    })

    let updateCount = 0
    const originalStartTransaction = db.startTransaction.bind(db)
    db.startTransaction = async () => {
      const transaction = await originalStartTransaction()
      const originalCollection = transaction.collection
      transaction.collection = (name) => {
        const collection = originalCollection(name)
        const originalDoc = collection.doc.bind(collection)
        collection.doc = (id) => {
          const document = originalDoc(id)
          const originalUpdate = document.update.bind(document)
          document.update = async (value) => {
            updateCount += 1
            return originalUpdate(value)
          }
          return document
        }
        return collection
      }
      return transaction
    }

    const first = await resourceHelper.deliverCustomPetRequest({
      db,
      app: validResourceApp('delivery-a'),
      requestId: 'delivery-a',
      version: 'v1'
    })
    assert.equal(first.idempotent, false)
    assert.equal(updateCount, 1)
    assert.equal(fake.__store.getCollection('custom_pet_requests').get('delivery-a').status, 'delivered')

    const retry = await resourceHelper.deliverCustomPetRequest({
      db,
      app: validResourceApp('delivery-a'),
      requestId: 'delivery-a',
      version: 'v1'
    })
    assert.equal(retry.idempotent, true)
    assert.equal(updateCount, 1, 'idempotent retry must not write again')

    const redelivery = await resourceHelper.deliverCustomPetRequest({
      db,
      app: validResourceApp('delivery-a'),
      requestId: 'delivery-a',
      version: 'v2',
      allowRedelivery: true
    })
    assert.equal(redelivery.idempotent, false)
    assert.equal(updateCount, 2)
    assert.equal(fake.__store.getCollection('custom_pet_requests').get('delivery-a').deliveredPet.version, 'v2')
    await assert.rejects(
      () => resourceHelper.deliverCustomPetRequest({ db, app: validResourceApp('delivery-a'), requestId: 'delivery-a', version: 'v1', allowRedelivery: true }),
      (error) => error?.code === 'VERSION_NOT_INCREMENTED'
    )

    const conflictTime = new Date('2026-07-31T11:00:00.000Z')
    fake.__store.getCollection('custom_pet_requests').set('delivery-conflict', {
      _id: 'delivery-conflict',
      userId: 'user-a',
      nickname: '冲突测试',
      status: 'in_progress',
      createdAt: conflictTime,
      updatedAt: conflictTime,
      deliveredPet: null
    })
    const conflictApp = validResourceApp('delivery-conflict', async () => {
      fake.__store.getCollection('custom_pet_requests').get('delivery-conflict').updatedAt = new Date('2026-07-31T11:01:00.000Z')
    })
    await assert.rejects(
      () => resourceHelper.deliverCustomPetRequest({ db, app: conflictApp, requestId: 'delivery-conflict', version: 'v1' }),
      (error) => error?.code === 'DELIVERY_CONFLICT'
    )
    assert.equal(fake.__store.getCollection('custom_pet_requests').get('delivery-conflict').status, 'in_progress')
    assert.equal(updateCount, 2)
  })

  await run('delivery preflight downloads only manifest and validates image metadata', async () => {
    const requestId = 'request-validate'
    const petId = resourceHelper.buildExpectedPetId(requestId)
    const downloads = []
    const app = {
      async getFileInfo({ fileList }) {
        return {
          fileList: fileList.map((fileID) => ({
            code: 'SUCCESS',
            fileID,
            size: fileID.endsWith('manifest.json') ? 1024 : 64 * 1024,
            contentType: fileID.endsWith('.json') ? 'application/json' : fileID.endsWith('.webp') ? 'image/webp' : 'image/png'
          }))
        }
      },
      async downloadFile({ fileID }) {
        downloads.push(fileID)
        return { fileContent: Buffer.from(JSON.stringify(validManifest(petId))) }
      }
    }
    const delivered = await resourceHelper.validateAndBuildDeliveredPet({ app, requestId, displayName: '奶糖', version: 'v1' })
    assert.equal(delivered.id, petId)
    assert.equal(downloads.length, 1)
    assert.ok(downloads[0].endsWith('/manifest.json'))
  })

  await run('delivery preflight rejects missing files and malformed manifests', async () => {
    const requestId = 'request-invalid'
    const missingApp = {
      async getFileInfo({ fileList }) {
        return { fileList: fileList.filter((fileID) => !fileID.endsWith('.webp')).map((fileID) => ({ code: 'SUCCESS', fileID, size: 100, contentType: 'application/octet-stream' })) }
      },
      async downloadFile() { return { fileContent: Buffer.from('{}') } }
    }
    await assert.rejects(() => resourceHelper.validateAndBuildDeliveredPet({ app: missingApp, requestId, displayName: '坏资源' }), /spritesheet/)

    const malformedApp = {
      async getFileInfo({ fileList }) {
        return { fileList: fileList.map((fileID) => ({ code: 'SUCCESS', fileID, size: 100, contentType: 'application/octet-stream' })) }
      },
      async downloadFile() { return { fileContent: Buffer.from('{bad json') } }
    }
    await assert.rejects(() => resourceHelper.validateAndBuildDeliveredPet({ app: malformedApp, requestId, displayName: '坏资源' }), /合法 JSON/)
  })

  await run('legacy delivery backfill is dry-run safe, idempotent and reports failures', async () => {
    const requests = [
      { _id: 'legacy-good', status: 'delivered', deliveredPetId: 'custom_old', nickname: '老朋友' },
      { _id: 'legacy-bad', status: 'delivered', deliveredPetId: 'custom_missing', nickname: '缺资源' },
      { _id: 'already-done', status: 'delivered', deliveredPetId: 'custom_done', deliveredPet: { id: 'custom_done' } },
      { _id: 'not-delivered', status: 'in_progress', deliveredPetId: 'custom_pending' }
    ]
    const app = {
      async getFileInfo({ fileList }) {
        if (fileList.some((fileID) => fileID.includes('custom_missing'))) return { fileList: [] }
        return { fileList: fileList.map((fileID) => ({ code: 'SUCCESS', fileID, size: 100, contentType: 'application/octet-stream' })) }
      },
      async downloadFile({ fileID }) {
        const match = fileID.match(/\/pets\/custom\/([^/]+)\/manifest\.json$/)
        return { fileContent: Buffer.from(JSON.stringify(validManifest(match?.[1] || ''))) }
      }
    }
    const persisted = []
    const dryRun = await resourceHelper.backfillDeliveredPetRecords({
      app,
      requests,
      dryRun: true,
      persist: async (...args) => persisted.push(args)
    })
    assert.equal(dryRun.total, 2)
    assert.equal(dryRun.succeeded, 1)
    assert.equal(dryRun.failed, 1)
    assert.equal(persisted.length, 0)

    const live = await resourceHelper.backfillDeliveredPetRecords({
      app,
      requests: [requests[0]],
      dryRun: false,
      persist: async (request, pet) => persisted.push({ request, pet })
    })
    assert.equal(live.succeeded, 1)
    assert.equal(persisted.length, 1)
    assert.equal(persisted[0].pet.version, 'legacy-v1')
  })

  await run('UI and backend retain the unified catalog invariants', async () => {
    const me = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'me', 'me.vue'), 'utf8')
    const customPage = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'custom-pet', 'custom-pet.vue'), 'utf8')
    const admin = fs.readFileSync(path.join(projectRoot, 'cloudfunctions', 'adminManage', 'index.js'), 'utf8')
    assert.ok(me.includes('内置宠物'))
    assert.ok(me.includes('我的定制宠物'))
    assert.ok(me.includes('还想定制新的宠物？'))
    assert.ok(me.indexOf("checkFeatureAccess('更换宠物')") < me.indexOf('downloadPetAssets(pet, userId)'))
    assert.ok(customPage.includes('请前往「我的 → 更换宠物」选择使用。'))
    assert.equal(customPage.includes('usePet('), false)
    assert.ok(admin.includes('deliveredPet,'))
    assert.ok(admin.includes("status: 'delivered'"))
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
