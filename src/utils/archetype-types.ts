import type { ArchetypeFeatureKey } from './feature-keys'

export type ArchetypeMode = 'self' | 'target'
export type RelationSubjectGender = 'female' | 'male'
export type RelationshipStageKey = 'pre_relationship' | 'early_dating' | 'steady_relationship' | 'long_term'
export type QuestionOptionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'U'

export type ArchetypeAnswer = {
  questionId: string
  optionKey: QuestionOptionKey
}

export type ArchetypeQuestionBank<T = any> = {
  featureKey: ArchetypeFeatureKey
  contentVersion: string
  checksum: string
  subjectGender?: RelationSubjectGender
  displayTitle?: string
  content: T
  publishedAt?: string | Date | null
}

export type RelationArchetypeDraft = {
  kind: 'relation_archetype'
  subjectGender: RelationSubjectGender
  mode: ArchetypeMode
  caseId?: string
  stageKey: RelationshipStageKey
  personKey: string
  answers: ArchetypeAnswer[]
  scenarioAnswers: ArchetypeAnswer[]
  contentVersion: string
  updatedAt: number
}

export type CrushCelebrityDraft = {
  kind: 'crush_celebrity' | 'dimension_character'
  mode: ArchetypeMode
  caseId?: string
  answers: ArchetypeAnswer[]
  contentVersion: string
  updatedAt: number
}

export type ArchetypeDraft = RelationArchetypeDraft | CrushCelebrityDraft
