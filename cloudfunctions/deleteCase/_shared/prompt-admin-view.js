/**
 * 提示词管理视图 — canonical helper
 *
 * 集中导出 Admin 预览（promptAdminView）的固定结构、guardrails、
 * runtime preview 字段说明和 outputContract 描述。
 *
 * adminManage、getAISettings、updateAISettings 应统一从本文件获取
 * 这些定义，删除各自的重复实现。
 *
 * TODO(B31-full): 将 getAISettings 和 updateAISettings 中的
 * PROMPT_FIXED_GUARDRAILS / getRuntimePreview / normalizePromptAdminView
 * 全部迁移到本文件并由三个云函数统一导入。
 */

const PROMPT_MODULE_KEYS = ['eventAssessment', 'weeklyReview', 'sideRead', 'attachmentAnalysis']

/**
 * 各模块的 outputContract 描述。
 * 三个云函数目前各自硬编码了一份，应统一从此处获取。
 */
const MODULE_OUTPUT_CONTRACTS = {
  eventAssessment: [
    'NormalizedEventV1={schemaVersion,event,copy}',
    'event={actor,interaction,commitmentStatus,commitmentType,evidenceType,scene,signals,strength}',
    'copy={title,summary,reason,answer,targetMind,nextStep,caution,petLine,petMood}',
    'AI 不返回 eventType、intentDelta、riskDelta、evidenceDelta、categories、semanticTags 或 rawReply。',
    '代码统一校验协议、计算 SCORING_POLICY_V1、投影标签并拼装 rawReply。',
    'actor=self/unknown 或 AI 失败时三项增量为零，eventType=note。'
  ],
  eventUnderstanding: [
    'eventType,eventTitle,summary,semanticTags',
    'semanticTags={scene,behavior,outcome,risk,initiator,response,commitment}',
    'scene/behavior/outcome/risk 必须从预定义可选值中选择，不要自创标签。',
    'initiator: target | self | both | unknown',
    'response: accepted | rejected | pending | unclear | none',
    'commitment={exists,type,promisedBy,fulfilled}'
  ]
}

/**
 * 新协议下各模块的运行时上下文字段说明。
 */
const MODULE_RUNTIME_FIELDS = {
  eventAssessment: [
    'selfProfile={gender,ageRange,identity,zodiac,constellation,aiStyle,aiBoldness}',
    'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
    'recentTimeline limited by runtimeConfig.eventContextLimit',
    'currentEvent={description,inputSubjectRole,userQuestion,chatSelfName,chatTargetName,occurrenceAt,createdAt}'
  ],
  eventUnderstanding: [
    'targetProfile={relationType,age,gender,occupation,zodiac,constellation}',
    'recentTimeline latest 3 records',
    'newEvent={inputSubjectRole,description}'
  ]
}

/**
 * 新协议下三大字段的说明文档。
 */
const SUBJECT_FIELD_DESCRIPTIONS = {
  subjectRole: '由后端根据 NormalizedEventV1.event.actor 强制生成（target/self/both/unknown）。代码不信任客户端传入的 subjectRole。',
  inputSubjectRole: '前端传入（unspecified/both）。unspecified=未指定；both=用户粘贴了聊天记录。后端只用于提示词构建，不直接作为 subjectRole 来源。',
  subjectRoleSource: '后端状态字段（pending/ai_inferred/fallback_unknown）。pending=等待 AI；ai_inferred=AI 语义结果；fallback_unknown=协议或模型失败后的保守结果。'
}

module.exports = {
  PROMPT_MODULE_KEYS,
  MODULE_OUTPUT_CONTRACTS,
  MODULE_RUNTIME_FIELDS,
  SUBJECT_FIELD_DESCRIPTIONS
}
