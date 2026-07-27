/**
 * Case Profile 规范化与序列化模块（v5 终版）
 *
 * 统一管理 Crush 档案的 MBTI 性格类型、TA 身份标签校验，
 * 以及 AI 上下文所需的序列化逻辑。
 */

// ── MBTI 16 型严格校验 ──
const VALID_MBTI = new Set([
  '', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
])

// ── TA 身份标签（Crush identityLabel） ──
const VALID_IDENTITY_LABEL = new Set([
  '', 'ex', 'crush_secret', 'classmate', 'colleague',
  'online_friend', 'arranged', '__custom__'
])

// 前端展示用：英文 key → 中文 label
const IDENTITY_LABEL_MAP = {
  'ex': '前男友/前女友',
  'crush_secret': '暗恋对象',
  'classmate': '同学',
  'colleague': '同事',
  'online_friend': '网友',
  'arranged': '相亲对象',
}

/**
 * 解析 identityLabel，处理 __custom__ 回退到 identityLabelCustom
 * 接受整个 profile 对象，与方案 v5 签名保持一致
 */
function resolveIdentityLabel(profile) {
  if (!profile || typeof profile !== 'object') return ''
  const label = String(profile.identityLabel || '').trim()
  if (label === '__custom__') {
    return String(profile.identityLabelCustom || '').trim().slice(0, 20) || '自定义'
  }
  return IDENTITY_LABEL_MAP[label] || ''
}

// ── Case Profile 合法字段白名单 ──
const CASE_PROFILE_FIELDS = new Set([
  'relationType', 'age', 'gender', 'occupation', 'zodiac', 'constellation',
  'avatar', 'mbtiCode', 'identityLabel', 'identityLabelCustom'
])

/**
 * 全量规范化（用于 createCase）
 * 仅允许白名单字段，非法字段静默丢弃。方案 v5 验证项 #11
 */
function normalizeCaseProfile(profile) {
  if (!profile || typeof profile !== 'object') return {}

  const out = {}

  // 仅透传白名单字段（非新增字段直接复制）
  for (const key of Object.keys(profile)) {
    if (key === 'mbtiCode' || key === 'identityLabel' || key === 'identityLabelCustom') continue
    if (CASE_PROFILE_FIELDS.has(key)) {
      out[key] = profile[key]
    }
    // 不在白名单的字段静默丢弃
  }

  // mbtiCode — 严格 16 型校验（不 toUpperCase，小写拒绝）
  const mbti = String(profile.mbtiCode || '').trim()
  out.mbtiCode = VALID_MBTI.has(mbti) ? mbti : ''

  // identityLabel — 枚举白名单
  const label = String(profile.identityLabel || '').trim()
  out.identityLabel = VALID_IDENTITY_LABEL.has(label) ? label : ''

  // identityLabelCustom — 仅 __custom__ 时有效
  out.identityLabelCustom = out.identityLabel === '__custom__'
    ? String(profile.identityLabelCustom || '').trim().slice(0, 20)
    : ''

  return out
}

/**
 * 增量规范化（用于 updateCaseProfile）
 * 仅校验客户端明确提交的字段（hasOwnProperty），未提交的字段不影响。
 * 新增字段走白名单校验，其他字段原样透传。
 */
function normalizeCaseProfilePatch(input) {
  if (!input || typeof input !== 'object') return {}

  const patch = {}

  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue

    if (key === 'mbtiCode') {
      const v = String(input.mbtiCode || '').trim()
      patch.mbtiCode = VALID_MBTI.has(v) ? v : '' // 小写 'intj' → ''
    } else if (key === 'identityLabel') {
      const v = String(input.identityLabel || '').trim()
      patch.identityLabel = VALID_IDENTITY_LABEL.has(v) ? v : ''
    } else if (key === 'identityLabelCustom') {
      patch.identityLabelCustom = String(input.identityLabelCustom || '').trim().slice(0, 20)
    } else if (CASE_PROFILE_FIELDS.has(key)) {
      // 其他合法画像字段（age/gender/occupation/zodiac/constellation/avatar/relationType）原样透传
      patch[key] = input[key]
    }
    // 不在白名单的字段静默丢弃
  }

  return patch
}

/**
 * 序列化 Case Profile 用于 AI 上下文
 * 供 event-understanding、adminManage、ai-event 等的内部函数使用
 */
function serializeCaseProfileForAI(profile) {
  if (!profile) return '未提供'

  const normalized = {
    relationType: mapRelationType(profile.relationType),
    age: profile.age,
    gender: profile.gender,
    occupation: profile.occupation,
    zodiac: profile.zodiac,
    constellation: profile.constellation
  }

  // MBTI 性格类型（字段空则不追加）
  if (profile.mbtiCode && VALID_MBTI.has(profile.mbtiCode)) {
    normalized.mbti = profile.mbtiCode
  }

  // TA 身份标签
  const identityResolved = resolveIdentityLabel(profile)
  if (identityResolved) {
    normalized.identityLabel = identityResolved
  }

  return Object.values(normalized).some(Boolean) ? JSON.stringify(normalized) : '未提供'
}

function mapRelationType(value) {
  const map = { romantic: 'Crush', close_friend: 'Friend Crush' }
  return map[value] || value || ''
}

module.exports = {
  VALID_MBTI,
  VALID_IDENTITY_LABEL,
  IDENTITY_LABEL_MAP,
  resolveIdentityLabel,
  normalizeCaseProfile,
  normalizeCaseProfilePatch,
  serializeCaseProfileForAI,
  mapRelationType
}
