const LEGACY_IDENTITY_MAP: Record<string, string> = {
  high_school: 'student',
  college: 'student',
  graduate: 'student',
}

/** 统一归一化旧身份枚举 → 新枚举 */
export function normalizeSelfIdentity(value?: string): string {
  const v = String(value || '').trim()
  return LEGACY_IDENTITY_MAP[v] || v
}
