/**
 * 兼容旧调用方的最小输入提示。主体语义协议由 normalized-event/ai-event 固定，
 * 不再从 DB rules 跨模块注入，也不在这里维护评分说明。
 */
function buildSubjectPrompt(inputSubjectRole) {
  return inputSubjectRole === 'both' ? '这是微信对话记录，请按说话人拆分双方动作。' : ''
}

/**
 * 归一化已存储的 subjectRole 值。
 * 合法值原样保留，缺失/非法值统一降级为 'unknown'。
 */
function normalizeStoredSubjectRole(value) {
  return ['target', 'self', 'both', 'unknown'].includes(value) ? value : 'unknown'
}

/**
 * 归一化已存储的 inputSubjectRole 值。
 * 合法值原样保留，缺失/非法值返回 undefined。
 */
function normalizeOptionalInputSubjectRole(value) {
  return ['unspecified', 'both'].includes(value) ? value : undefined
}

/**
 * 归一化已存储的 subjectRoleSource 值。
 * 合法值原样保留，缺失/非法值返回 undefined。
 */
function normalizeOptionalSubjectRoleSource(value) {
  return ['pending', 'ai_inferred', 'fallback_unknown'].includes(value) ? value : undefined
}

module.exports = {
  buildSubjectPrompt,
  normalizeStoredSubjectRole,
  normalizeOptionalInputSubjectRole,
  normalizeOptionalSubjectRoleSource
}
