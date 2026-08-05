export type RelationSubjectGender = 'female' | 'male'
export type ResolvedRelationGender = RelationSubjectGender | 'unknown'

export function normalizeRelationGender(value: unknown): ResolvedRelationGender {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'male' || raw === '男') return 'male'
  if (raw === 'female' || raw === '女') return 'female'
  return 'unknown'
}

export function resolveRelationSubjectGender(params: {
  mode: 'self' | 'target'
  selfProfile?: any
  crushProfile?: any
  fallback?: RelationSubjectGender | ''
}): ResolvedRelationGender {
  const resolved = normalizeRelationGender(params.mode === 'self' ? params.selfProfile?.gender : params.crushProfile?.gender)
  return resolved === 'unknown' ? normalizeRelationGender(params.fallback) : resolved
}

export function relationDisplayTitle(gender: RelationSubjectGender) {
  return gender === 'male' ? '关系男主角' : '关系女主角'
}
