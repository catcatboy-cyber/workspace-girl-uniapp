const crypto = require('crypto')

const PROOF_FIELD = 'avatarSecurityProofs'
const PROOF_TTL_MS = 24 * 60 * 60 * 1000
const MAX_PROOFS = 8

function getDocumentData(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data || null
}

function createAvatarProofKey(fileID) {
  return crypto.createHash('sha256').update(String(fileID || '')).digest('hex').slice(0, 40)
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
    active[key] = { fileID, checkedAtMs: Number(proof.checkedAtMs || 0), expiresAtMs }
  }
  return active
}

async function storeAvatarSecurityProof(db, userId, fileID, nowMs = Date.now()) {
  const normalizedUserId = String(userId || '').trim()
  const normalizedFileID = String(fileID || '').trim()
  if (!normalizedUserId || !normalizedFileID.startsWith('cloud://')) throw new Error('invalid avatar proof input')

  const user = getDocumentData(await db.collection('users').doc(normalizedUserId).get())
  if (!user) throw new Error('user not found for avatar proof')
  const proofs = readActiveProofs(user, nowMs)
  const key = createAvatarProofKey(normalizedFileID)
  proofs[key] = { fileID: normalizedFileID, checkedAtMs: nowMs, expiresAtMs: nowMs + PROOF_TTL_MS }

  const keys = Object.keys(proofs).sort((a, b) => proofs[b].checkedAtMs - proofs[a].checkedAtMs)
  for (const staleKey of keys.slice(MAX_PROOFS)) delete proofs[staleKey]
  await db.collection('users').doc(normalizedUserId).update({ [PROOF_FIELD]: proofs })
  return proofs[key]
}

module.exports = { storeAvatarSecurityProof }
