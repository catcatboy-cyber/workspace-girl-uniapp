const questionDefinitions = [
  {
    id: 'Q1',
    version: 'v0.1',
    title: '你们目前处于什么阶段？',
    type: 'single_select',
    category: 'background',
    required: true,
    order: 1,
    options: [
      { value: 'just_met', label: '刚认识' },
      { value: 'ongoing_chat', label: '有持续聊天' },
      { value: 'met_several_times', label: '已经见过几次 / 明显升温' },
      { value: 'advanced_but_unstable', label: '关系推进过但不稳定' },
      { value: 'unclear', label: '说不清' }
    ]
  },
  {
    id: 'Q2',
    version: 'v0.1',
    title: '过去两周你们互动频率如何？',
    type: 'single_select',
    category: 'background',
    required: true,
    order: 2,
    options: [
      { value: 'almost_none', label: '几乎没有' },
      { value: 'occasional', label: '偶尔' },
      { value: 'stable', label: '比较稳定' },
      { value: 'frequent', label: '很频繁' },
      { value: 'hot_cold', label: '忽冷忽热' }
    ]
  },
  {
    id: 'Q3',
    version: 'v0.1',
    title: '你最想搞清楚的是什么？',
    type: 'single_select',
    category: 'background',
    required: true,
    order: 3,
    options: [
      { value: 'intent', label: '他/她是否有意向' },
      { value: 'instability', label: '为什么忽冷忽热' },
      { value: 'credibility', label: '说的话是否可信' },
      { value: 'continue_or_not', label: '要不要继续投入' },
      { value: 'am_i_overthinking', label: '我是不是想多了' }
    ]
  },
  {
    id: 'Q5',
    version: 'v0.1',
    title: '通常是谁先发起联系？',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 5,
    weightHint: 3,
    options: [
      { value: 'almost_always_me', label: '基本都是我' },
      { value: 'mostly_me', label: '大多是我' },
      { value: 'balanced', label: '差不多' },
      { value: 'mostly_them', label: '大多是对方' },
      { value: 'almost_always_them', label: '基本都是对方' }
    ]
  },
  {
    id: 'Q7',
    version: 'v0.1',
    title: '对方回复通常是什么状态？',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 7,
    weightHint: 3,
    options: [
      { value: 'perfunctory', label: '敷衍短句' },
      { value: 'simple', label: '简单回应' },
      { value: 'normal', label: '正常交流' },
      { value: 'engaged', label: '有内容、有追问' },
      { value: 'highly_invested', label: '明显投入很多' }
    ]
  },
  {
    id: 'Q9',
    version: 'v0.1',
    title: '对方是否制造或接受更深入的互动机会？',
    prompt: '比如见面、通话、单独交流、延长相处时间',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 9,
    weightHint: 4,
    options: [
      { value: 'rarely', label: '很少' },
      { value: 'sometimes', label: '偶尔' },
      { value: 'average', label: '一般' },
      { value: 'often', label: '经常' },
      { value: 'proactive', label: '很主动' }
    ]
  },
  {
    id: 'Q10',
    version: 'v0.1',
    title: '对方是否会把你带入未来一点点的安排或设想中？',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 10,
    weightHint: 2,
    options: [
      { value: 'never', label: '从不' },
      { value: 'rarely', label: '很少' },
      { value: 'occasionally', label: '偶尔' },
      { value: 'several_times', label: '有过几次' },
      { value: 'clear_future_reference', label: '比较明确' }
    ]
  },
  {
    id: 'Q12',
    version: 'v0.1',
    title: '如果你停止主动几天，对方通常会怎样？',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 12,
    weightHint: 4,
    options: [
      { value: 'wont_reach_out', label: '基本不会来找我' },
      { value: 'occasionally_reach_out', label: '偶尔才会' },
      { value: 'uncertain', label: '不确定' },
      { value: 'will_reach_out', label: '会主动找我' },
      { value: 'notice_and_pursue', label: '会明显察觉并主动靠近' }
    ]
  },
  {
    id: 'Q13',
    version: 'v0.1',
    title: '对方前后说法会明显不一致吗？',
    type: 'single_select',
    category: 'consistency',
    required: true,
    order: 13,
    weightHint: 4,
    options: [
      { value: 'often_inconsistent', label: '经常' },
      { value: 'sometimes_critical', label: '偶尔但关键处会' },
      { value: 'uncertain', label: '不确定' },
      { value: 'mostly_consistent', label: '大多一致' },
      { value: 'very_consistent', label: '很一致' }
    ]
  },
  {
    id: 'Q14',
    version: 'v0.1',
    title: '答应你的事情，对方兑现情况如何？',
    type: 'single_select',
    category: 'consistency',
    required: true,
    order: 14,
    weightHint: 5,
    options: [
      { value: 'often_not_followed_through', label: '经常不兑现' },
      { value: 'sometimes_not_followed_through', label: '偶尔不兑现' },
      { value: 'hard_to_tell', label: '不好说' },
      { value: 'mostly_followed_through', label: '大多兑现' },
      { value: 'almost_always_followed_through', label: '基本都兑现' }
    ]
  },
  {
    id: 'Q15',
    version: 'v0.1',
    title: '当你问到关键问题时，对方通常会？',
    type: 'single_select',
    category: 'consistency',
    required: true,
    order: 15,
    weightHint: 5,
    options: [
      { value: 'avoid', label: '回避' },
      { value: 'vague', label: '模糊带过' },
      { value: 'depends', label: '看情况' },
      { value: 'respond', label: '基本愿意回应' },
      { value: 'clarify', label: '愿意明确说明' }
    ]
  },
  {
    id: 'Q17',
    version: 'v0.1',
    title: '对方对你的态度是否忽冷忽热？',
    type: 'single_select',
    category: 'consistency',
    required: true,
    order: 17,
    weightHint: 5,
    options: [
      { value: 'very_obvious', label: '非常明显' },
      { value: 'noticeable', label: '比较明显' },
      { value: 'a_little', label: '有一点' },
      { value: 'not_much', label: '不太明显' },
      { value: 'stable', label: '很稳定' }
    ]
  },
  {
    id: 'Q20',
    version: 'v0.1',
    title: '你觉得自己现在掌握的是：',
    type: 'single_select',
    category: 'evidence',
    required: true,
    order: 20,
    weightHint: 4,
    options: [
      { value: 'mostly_feelings', label: '大多是感觉' },
      { value: 'few_facts_many_guesses', label: '少量事实 + 很多推测' },
      { value: 'half_half', label: '一半事实一半感觉' },
      { value: 'many_concrete_facts', label: '有不少具体事实' },
      { value: 'mostly_fact_based', label: '基本有事实依据' }
    ]
  },
  {
    id: 'QC',
    version: 'v0.1',
    title: '对方是否有过暧昧或让你觉得”不止是朋友”的暗示？',
    type: 'single_select',
    category: 'intent',
    required: true,
    order: 14,
    weightHint: 3,
    options: [
      { value: 'none', label: '没有' },
      { value: 'a_little', label: '有一点但不明显' },
      { value: 'yes_clear', label: '有，比较明确' },
      { value: 'often', label: '经常有' },
      { value: 'unsure', label: '说不清' }
    ]
  },
  {
    id: 'T1',
    version: 'v0.1',
    title: '请描述最近一次让你觉得”关系有推进”或”有好感迹象”的互动。',
    type: 'text_long',
    category: 'scene_context',
    required: false,
    order: 25,
    placeholder: '例如：对方做了什么、说了什么、你为什么觉得这是一个推进信号',
    helpText: '尽量描述具体行为，而不只是你的感觉。'
  },
  {
    id: 'T2',
    version: 'v0.1',
    title: '请描述最近一次让你觉得“不一致、回避或不舒服”的互动。',
    type: 'text_long',
    category: 'scene_context',
    required: false,
    order: 26,
    placeholder: '例如：发生了什么、对方如何回应、你为什么觉得不对劲',
    helpText: '尽量写出关键对话或行为细节。'
  }
]

const closeFriendQuestionOverrides = {
  Q3: {
    options: [
      { value: 'intent', label: '他/她是否真心重视这段关系' },
      { value: 'instability', label: '为什么忽冷忽热' },
      { value: 'credibility', label: '说的话是否可信' },
      { value: 'continue_or_not', label: '要不要继续深交/投入' },
      { value: 'am_i_overthinking', label: '我是不是想多了' }
    ]
  },
  Q9: {
    title: '对方是否会制造或接受更深入的互动机会？',
    prompt: '比如单独见面、长聊、主动分享近况、把你带进自己的日常圈子'
  },
  Q10: {
    title: '对方是否会把你放进后续安排或长期联系设想里？'
  },
  QC: {
    title: '对方是否主要在自己需要时才找你？',
    options: [
      { value: 'almost_always_need', label: '基本只在需要时找我' },
      { value: 'often_need', label: '经常是这样' },
      { value: 'half_half', label: '一半一半' },
      { value: 'rarely_need', label: '很少' },
      { value: 'no_proactive', label: '不会，平时也会主动联系' }
    ]
  },
  T1: {
    title: '请描述最近一次让你觉得“关系更靠近”或“信任在上升”的互动。',
    placeholder: '例如：对方做了什么、说了什么、你为什么觉得你们更靠近了',
    helpText: '尽量描述具体行为，而不只是你的感觉。'
  }
}

function getQuestionDefinitionsForRelationType(relationType = 'romantic') {
  if (relationType !== 'close_friend') {
    return questionDefinitions
  }

  return questionDefinitions.map((question) => {
    const override = closeFriendQuestionOverrides[question.id]
    if (!override) return question

    return {
      ...question,
      ...override,
      options: override.options ?? question.options
    }
  })
}

const fiveLevel = (questionId, items) =>
  items.map((item) => ({
    questionId,
    optionValue: item.value,
    signals: [{ category: item.category, direction: item.direction, weight: item.weight, magnitude: item.magnitude }]
  }))

const questionMappingRules = [
  ...fiveLevel('Q5', [
    { value: 'almost_always_me', category: 'initiative', direction: 'negative', weight: 3, magnitude: 3 },
    { value: 'mostly_me', category: 'initiative', direction: 'negative', weight: 3, magnitude: 2 },
    { value: 'balanced', category: 'initiative', direction: 'neutral', weight: 2, magnitude: 1 },
    { value: 'mostly_them', category: 'initiative', direction: 'positive', weight: 3, magnitude: 2 },
    { value: 'almost_always_them', category: 'initiative', direction: 'positive', weight: 3, magnitude: 3 }
  ]),
  ...fiveLevel('Q7', [
    { value: 'perfunctory', category: 'investment', direction: 'negative', weight: 3, magnitude: 3 },
    { value: 'simple', category: 'investment', direction: 'negative', weight: 3, magnitude: 2 },
    { value: 'normal', category: 'investment', direction: 'neutral', weight: 2, magnitude: 1 },
    { value: 'engaged', category: 'investment', direction: 'positive', weight: 3, magnitude: 2 },
    { value: 'highly_invested', category: 'investment', direction: 'positive', weight: 3, magnitude: 3 }
  ]),
  ...fiveLevel('Q9', [
    { value: 'rarely', category: 'progression', direction: 'negative', weight: 4, magnitude: 3 },
    { value: 'sometimes', category: 'progression', direction: 'negative', weight: 4, magnitude: 1 },
    { value: 'average', category: 'progression', direction: 'neutral', weight: 2, magnitude: 1 },
    { value: 'often', category: 'progression', direction: 'positive', weight: 4, magnitude: 2 },
    { value: 'proactive', category: 'progression', direction: 'positive', weight: 4, magnitude: 3 }
  ]),
  ...fiveLevel('Q10', [
    { value: 'never', category: 'progression', direction: 'negative', weight: 2, magnitude: 3 },
    { value: 'rarely', category: 'progression', direction: 'negative', weight: 2, magnitude: 2 },
    { value: 'occasionally', category: 'progression', direction: 'neutral', weight: 1, magnitude: 1 },
    { value: 'several_times', category: 'progression', direction: 'positive', weight: 2, magnitude: 2 },
    { value: 'clear_future_reference', category: 'progression', direction: 'positive', weight: 2, magnitude: 3 }
  ]),
  ...fiveLevel('Q12', [
    { value: 'wont_reach_out', category: 'initiative', direction: 'negative', weight: 4, magnitude: 3 },
    { value: 'occasionally_reach_out', category: 'initiative', direction: 'negative', weight: 4, magnitude: 1 },
    { value: 'uncertain', category: 'initiative', direction: 'uncertain', weight: 1, magnitude: 1 },
    { value: 'will_reach_out', category: 'initiative', direction: 'positive', weight: 4, magnitude: 2 },
    { value: 'notice_and_pursue', category: 'initiative', direction: 'positive', weight: 4, magnitude: 3 }
  ]),
  ...fiveLevel('Q13', [
    { value: 'often_inconsistent', category: 'consistency', direction: 'negative', weight: 4, magnitude: 3 },
    { value: 'sometimes_critical', category: 'consistency', direction: 'negative', weight: 4, magnitude: 2 },
    { value: 'uncertain', category: 'consistency', direction: 'uncertain', weight: 2, magnitude: 1 },
    { value: 'mostly_consistent', category: 'consistency', direction: 'positive', weight: 4, magnitude: 2 },
    { value: 'very_consistent', category: 'consistency', direction: 'positive', weight: 4, magnitude: 3 }
  ]),
  {
    questionId: 'Q14',
    optionValue: 'often_not_followed_through',
    signals: [
      { category: 'consistency', direction: 'negative', weight: 5, magnitude: 3 },
      { category: 'verifiability', direction: 'negative', weight: 2, magnitude: 1 }
    ]
  },
  {
    questionId: 'Q14',
    optionValue: 'sometimes_not_followed_through',
    signals: [{ category: 'consistency', direction: 'negative', weight: 5, magnitude: 2 }]
  },
  {
    questionId: 'Q14',
    optionValue: 'hard_to_tell',
    signals: [{ category: 'consistency', direction: 'uncertain', weight: 2, magnitude: 1 }]
  },
  {
    questionId: 'Q14',
    optionValue: 'mostly_followed_through',
    signals: [{ category: 'consistency', direction: 'positive', weight: 5, magnitude: 2 }]
  },
  {
    questionId: 'Q14',
    optionValue: 'almost_always_followed_through',
    signals: [{ category: 'consistency', direction: 'positive', weight: 5, magnitude: 3 }]
  },
  ...fiveLevel('Q15', [
    { value: 'avoid', category: 'avoidance', direction: 'negative', weight: 5, magnitude: 3 },
    { value: 'vague', category: 'avoidance', direction: 'negative', weight: 5, magnitude: 2 },
    { value: 'depends', category: 'avoidance', direction: 'uncertain', weight: 2, magnitude: 1 },
    { value: 'respond', category: 'avoidance', direction: 'positive', weight: 5, magnitude: 2 },
    { value: 'clarify', category: 'avoidance', direction: 'positive', weight: 5, magnitude: 3 }
  ]),
  ...fiveLevel('Q17', [
    { value: 'very_obvious', category: 'instability', direction: 'negative', weight: 5, magnitude: 3 },
    { value: 'noticeable', category: 'instability', direction: 'negative', weight: 5, magnitude: 2 },
    { value: 'a_little', category: 'instability', direction: 'negative', weight: 4, magnitude: 1 },
    { value: 'not_much', category: 'instability', direction: 'positive', weight: 3, magnitude: 1 },
    { value: 'stable', category: 'instability', direction: 'positive', weight: 5, magnitude: 3 }
  ]),
  ...fiveLevel('Q20', [
    { value: 'mostly_feelings', category: 'evidence_strength', direction: 'negative', weight: 4, magnitude: 3 },
    { value: 'few_facts_many_guesses', category: 'evidence_strength', direction: 'negative', weight: 4, magnitude: 2 },
    { value: 'half_half', category: 'evidence_strength', direction: 'neutral', weight: 2, magnitude: 1 },
    { value: 'many_concrete_facts', category: 'evidence_strength', direction: 'positive', weight: 4, magnitude: 2 },
    { value: 'mostly_fact_based', category: 'evidence_strength', direction: 'positive', weight: 4, magnitude: 3 }
  ]),
  ...fiveLevel('QC', [
    { value: 'none', category: 'progression', direction: 'negative', weight: 2, magnitude: 2 },
    { value: 'a_little', category: 'progression', direction: 'positive', weight: 1, magnitude: 1 },
    { value: 'yes_clear', category: 'progression', direction: 'positive', weight: 3, magnitude: 2 },
    { value: 'often', category: 'progression', direction: 'positive', weight: 3, magnitude: 3 },
    { value: 'unsure', category: 'verifiability', direction: 'negative', weight: 1, magnitude: 1 },
    // Friend Crush override option values
    { value: 'almost_always_need', category: 'investment', direction: 'negative', weight: 3, magnitude: 3 },
    { value: 'often_need', category: 'investment', direction: 'negative', weight: 3, magnitude: 2 },
    { value: 'half_half', category: 'investment', direction: 'neutral', weight: 1, magnitude: 1 },
    { value: 'rarely_need', category: 'investment', direction: 'positive', weight: 3, magnitude: 1 },
    { value: 'no_proactive', category: 'investment', direction: 'positive', weight: 3, magnitude: 2 }
  ])

]

module.exports = {
  questionDefinitions,
  getQuestionDefinitionsForRelationType,
  questionMappingRules
}
