const crypto = require('crypto')

const PROOF_FIELD = 'avatarSecurityProofs'
const PROOF_TTL_MS = 24 * 60 * 60 * 1000
const MAX_PROOFS = 8
const BUILTIN_AVATAR_PATTERN = /^\/static\/avatars\//

function getDocumentData(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data || null
}

function createAvatarProofKey(fileID) {
  return crypto.createHash('sha256').update(String(fileID || '')).digest('hex').slice(0, 40)
}

function isBuiltInAvatar(value) {
  return BUILTIN_AVATAR_PATTERN.test(String(value || '').trim())
}

function readActiveProofs(user, nowMs = Date.now()) {
  const source = user?.[PROOF_FIELD]
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}

  const active = {}
  for (const [key, proof] of Object.entries(source)) {
    if (!proof || typeof proof !== 'object') continue
    const expiresAtMs = Number(proof.expiresAtMs || 0)
    const fileID = String(proof.fileID || '').trim()
    if (!fileID || expiresAtMs <= nowMs) continue
    active[key] = {
      fileID,
      checkedAtMs: Number(proof.checkedAtMs || 0),
      expiresAtMs
    }
  }
  return active
}

async function storeAvatarSecurityProof(db, userId, fileID, nowMs = Date.now()) {
  const normalizedUserId = String(userId || '').trim()
  const normalizedFileID = String(fileID || '').trim()
  if (!normalizedUserId || !normalizedFileID.startsWith('cloud://')) {
    throw new Error('invalid avatar security proof input')
  }

  const result = await db.collection('users').doc(normalizedUserId).get()
  const user = getDocumentData(result)
  if (!user) throw new Error('user not found for avatar security proof')

  const proofs = readActiveProofs(user, nowMs)
  const key = createAvatarProofKey(normalizedFileID)
  proofs[key] = {
    fileID: normalizedFileID,
    checkedAtMs: nowMs,
    expiresAtMs: nowMs + PROOF_TTL_MS
  }

  const sortedKeys = Object.keys(proofs).sort((a, b) => proofs[b].checkedAtMs - proofs[a].checkedAtMs)
  for (const staleKey of sortedKeys.slice(MAX_PROOFS)) delete proofs[staleKey]

  await db.collection('users').doc(normalizedUserId).update({
    [PROOF_FIELD]: proofs
  })

  return proofs[key]
}

function verifyAvatarForPublish(user, avatarValue, existingAvatarValue = '', nowMs = Date.now()) {
  const avatar = String(avatarValue || '').trim()
  const existingAvatar = String(existingAvatarValue || '').trim()

  if (!avatar || isBuiltInAvatar(avatar) || avatar === existingAvatar) {
    return { ok: true, code: 'OK' }
  }
  if (!avatar.startsWith('cloud://')) {
    return { ok: false, code: 'INVALID_AVATAR' }
  }

  const proofs = readActiveProofs(user, nowMs)
  const proof = proofs[createAvatarProofKey(avatar)]
  if (!proof || proof.fileID !== avatar) {
    return { ok: false, code: 'AVATAR_SECURITY_REQUIRED' }
  }
  return { ok: true, code: 'OK' }
}

module.exports = {
  PROOF_FIELD,
  PROOF_TTL_MS,
  MAX_PROOFS,
  createAvatarProofKey,
  isBuiltInAvatar,
  readActiveProofs,
  storeAvatarSecurityProof,
  verifyAvatarForPublish
}
