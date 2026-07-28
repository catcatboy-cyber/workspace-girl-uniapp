const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  MEDIA_TYPE_IMAGE,
  MEDIA_CHECK_VERSION,
  getSceneNumber,
  requestImageSafetyCheck,
  normalizeMediaCheckCallback
} = require('../cloudfunctions/contentSecCheck/_shared/content-security')
const {
  PROOF_TTL_MS,
  storeAvatarSecurityProof,
  verifyAvatarForPublish
} = require('../cloudfunctions/_shared/avatar-security')

function fakeMediaCloud(handler, tempFileURL = 'https://example.tcb.qcloud.la/avatar.jpg') {
  return {
    async getTempFileURL() {
      return { fileList: [{ status: 0, tempFileURL }] }
    },
    openapi: { security: { mediaCheckAsync: handler } }
  }
}

function fakeDb(initialUser) {
  const state = { ...initialUser }
  return {
    state,
    collection(name) {
      assert.strictEqual(name, 'users')
      return {
        doc(id) {
          assert.strictEqual(id, state._id)
          return {
            async get() { return { data: [state] } },
            async update(patch) { Object.assign(state, patch); return { updated: 1 } }
          }
        }
      }
    }
  }
}

async function main() {
  assert.strictEqual(MEDIA_TYPE_IMAGE, 2)
  assert.strictEqual(MEDIA_CHECK_VERSION, 2)
  assert.strictEqual(getSceneNumber('avatar'), 1)
  assert.strictEqual(getSceneNumber('timeline'), 4)

  let calledPayload = null
  const accepted = await requestImageSafetyCheck('cloud://env/avatars/safe.jpg', {
    openid: 'openid-1',
    scene: 'avatar',
    cloud: fakeMediaCloud(async (payload) => {
      calledPayload = payload
      return { errCode: 0, traceId: 'trace-safe' }
    })
  })
  assert.deepStrictEqual(accepted, {
    accepted: true,
    pending: true,
    code: 'SECURITY_CHECK_PENDING',
    traceId: 'trace-safe'
  })
  assert.deepStrictEqual(calledPayload, {
    mediaUrl: 'https://example.tcb.qcloud.la/avatar.jpg',
    mediaType: 2,
    version: 2,
    scene: 1,
    openid: 'openid-1'
  })

  const missingOpenId = await requestImageSafetyCheck('cloud://env/avatars/safe.jpg', {
    cloud: fakeMediaCloud(async () => ({ errCode: 0, traceId: 'unused' }))
  })
  assert.deepStrictEqual(missingOpenId, { accepted: false, code: 'AUTH_REQUIRED' })

  const unavailable = await requestImageSafetyCheck('cloud://env/avatars/fail.jpg', {
    openid: 'openid-1',
    cloud: fakeMediaCloud(async () => { throw new Error('api unavailable') })
  })
  assert.deepStrictEqual(unavailable, { accepted: false, code: 'SECURITY_CHECK_UNAVAILABLE' })

  assert.deepStrictEqual(
    normalizeMediaCheckCallback({ trace_id: 't-pass', errcode: 0, result: { suggest: 'pass', label: 100 } }),
    { valid: true, traceId: 't-pass', status: 'pass', code: 'OK', errCode: 0, suggest: 'pass', label: 100 }
  )
  assert.deepStrictEqual(
    normalizeMediaCheckCallback({ trace_id: 't-risk', errcode: 0, result: { suggest: 'risky', label: 20002 } }),
    { valid: true, traceId: 't-risk', status: 'rejected', code: 'CONTENT_RISK', errCode: 0, suggest: 'risky', label: 20002 }
  )
  assert.strictEqual(normalizeMediaCheckCallback({ trace_id: 't-review', errcode: 0, result: { suggest: 'review' } }).status, 'rejected')
  assert.strictEqual(normalizeMediaCheckCallback({ trace_id: 't-download', errcode: -1008 }).status, 'failed')
  assert.deepStrictEqual(normalizeMediaCheckCallback({ errcode: 0 }), { valid: false, code: 'INVALID_CALLBACK' })

  const db = fakeDb({ _id: 'user-1' })
  const fileID = 'cloud://env/avatars/verified.jpg'
  await storeAvatarSecurityProof(db, 'user-1', fileID, 1000)
  assert.deepStrictEqual(verifyAvatarForPublish(db.state, fileID, '', 1001), { ok: true, code: 'OK' })
  assert.deepStrictEqual(verifyAvatarForPublish(db.state, 'cloud://env/avatars/missing.jpg', '', 1001), { ok: false, code: 'AVATAR_SECURITY_REQUIRED' })
  assert.deepStrictEqual(verifyAvatarForPublish(db.state, fileID, '', 1000 + PROOF_TTL_MS + 1), { ok: false, code: 'AVATAR_SECURITY_REQUIRED' })

  const root = path.resolve(__dirname, '..')
  const activeHelper = fs.readFileSync(path.join(root, 'cloudfunctions/contentSecCheck/_shared/content-security.js'), 'utf8')
  assert.match(activeHelper, /mediaCheckAsync/)
  assert.doesNotMatch(activeHelper, /imgSecCheck|msgSecCheck/)

  const checkFunction = fs.readFileSync(path.join(root, 'cloudfunctions/contentSecCheck/index.js'), 'utf8')
  assert.match(checkFunction, /getImageCheckResult/)
  assert.match(checkFunction, /content_security_checks/)
  assert.doesNotMatch(checkFunction, /const submitting = \{\s*_id:/)
  const functionConfig = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/contentSecCheck/config.json'), 'utf8'))
  assert.deepStrictEqual(functionConfig.permissions?.openapi, ['security.mediaCheckAsync'])

  const callbackFunction = fs.readFileSync(path.join(root, 'cloudfunctions/contentSecCallback/index.js'), 'utf8')
  assert.match(callbackFunction, /wxa_media_check/)
  assert.match(callbackFunction, /WECHAT_MESSAGE_TOKEN/)
  assert.match(callbackFunction, /verifyMessageSignature/)

  for (const relative of [
    'cloudfunctions/userProfile/index.js',
    'cloudfunctions/createCase/index.js',
    'cloudfunctions/updateCaseProfile/index.js'
  ]) {
    assert.match(fs.readFileSync(path.join(root, relative), 'utf8'), /verifyAvatarForPublish/)
  }

  const clientSource = fs.readFileSync(path.join(root, 'src/utils/api.ts'), 'utf8')
  assert.match(clientSource, /mediaCheckAsync/)
  assert.match(clientSource, /SECURITY_CHECK_PENDING/)
  assert.match(clientSource, /所发布内容含违规信息/)

  console.log('PASS content security uses mediaCheckAsync 2.0 with official parameters')
  console.log('PASS asynchronous callback results are normalized fail-closed')
  console.log('PASS avatar persistence still requires a server-issued pass proof')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
