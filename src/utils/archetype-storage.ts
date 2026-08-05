import type { ArchetypeDraft } from './archetype-types'

function safeUserPart(value?: string) {
  return String(value || '').trim() || 'anonymous'
}

export function getArchetypeDraftKey(params: {
  kind: 'relation_archetype' | 'crush_celebrity' | 'dimension_character'
  userId: string
  mode: 'self' | 'target'
  caseId?: string
  personKey?: string
  subjectGender?: 'female' | 'male'
  contentVersion: string
}) {
  const parts = [
    'archetype_draft',
    params.kind,
    safeUserPart(params.userId),
    params.mode,
    params.mode === 'target' ? safeUserPart(params.caseId) : 'self'
  ]
  if (params.kind === 'relation_archetype') parts.push(safeUserPart(params.subjectGender), safeUserPart(params.personKey))
  parts.push(safeUserPart(params.contentVersion))
  return parts.join(':')
}

export function saveArchetypeDraft(key: string, draft: ArchetypeDraft) {
  try {
    uni.setStorageSync(key, JSON.stringify({ ...draft, updatedAt: Date.now() }))
    return true
  } catch (_) {
    return false
  }
}

export function loadArchetypeDraft<T extends ArchetypeDraft>(key: string): T | null {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return value && typeof value === 'object' ? value as T : null
  } catch (_) {
    return null
  }
}

export function clearArchetypeDraft(key: string) {
  try {
    uni.removeStorageSync(key)
  } catch (_) {}
}
