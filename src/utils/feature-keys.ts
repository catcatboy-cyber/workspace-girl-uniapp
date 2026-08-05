export const FEATURE_RELATION_HEROINE = '关系女主角' as const
export const FEATURE_CRUSH_CELEBRITY = 'Crush名人图鉴' as const
export const FEATURE_DIMENSION_CHARACTER = '次元角色图鉴' as const

export type ArchetypeFeatureKey =
  | typeof FEATURE_RELATION_HEROINE
  | typeof FEATURE_CRUSH_CELEBRITY
  | typeof FEATURE_DIMENSION_CHARACTER
