// Inlined from cloudfunctions/_shared/config.js
// Only the UI-relevant fields; mapping rules live server-side.

export const questionDefinitions: any[] = [
  { id: 'Q1', title: '你们目前处于什么阶段？', type: 'single_select', required: true, order: 1,
    options: [
      { value: 'just_met', label: '刚认识' },
      { value: 'ongoing_chat', label: '有持续聊天' },
      { value: 'met_several_times', label: '已经见过几次 / 明显升温' },
      { value: 'advanced_but_unstable', label: '关系推进过但不稳定' },
      { value: 'unclear', label: '说不清' }
    ]
  },
  { id: 'Q2', title: '过去两周你们互动频率如何？', type: 'single_select', required: true, order: 2,
    options: [
      { value: 'almost_none', label: '几乎没有' },
      { value: 'occasional', label: '偶尔' },
      { value: 'stable', label: '比较稳定' },
      { value: 'frequent', label: '很频繁' },
      { value: 'hot_cold', label: '忽冷忽热' }
    ]
  },
  { id: 'Q3', title: '你最想搞清楚的是什么？', type: 'single_select', required: true, order: 3,
    options: [
      { value: 'intent', label: '他/她是否有意向' },
      { value: 'instability', label: '为什么忽冷忽热' },
      { value: 'credibility', label: '说的话是否可信' },
      { value: 'continue_or_not', label: '要不要继续投入' },
      { value: 'am_i_overthinking', label: '我是不是想多了' }
    ]
  },
  { id: 'Q4', title: '你现在最主要的依据是什么？', type: 'single_select', required: true, order: 4,
    options: [
      { value: 'mostly_instinct', label: '直觉' },
      { value: 'one_or_two_events', label: '一两次关键互动' },
      { value: 'continued_observation', label: '一段时间的持续观察' },
      { value: 'verifiable_facts', label: '一些可验证事实' },
      { value: 'many_chats_unstructured', label: '聊天记录很多但没整理' }
    ]
  },
  { id: 'Q5', title: '通常是谁先发起联系？', type: 'single_select', required: true, order: 5,
    options: [
      { value: 'almost_always_me', label: '基本都是我' },
      { value: 'mostly_me', label: '大多是我' },
      { value: 'balanced', label: '差不多' },
      { value: 'mostly_them', label: '大多是对方' },
      { value: 'almost_always_them', label: '基本都是对方' }
    ]
  },
  { id: 'Q6', title: '对方会主动延续话题吗？', type: 'single_select', required: true, order: 6,
    options: [
      { value: 'rarely', label: '很少' },
      { value: 'occasionally', label: '偶尔' },
      { value: 'normal', label: '一般' },
      { value: 'often', label: '经常' },
      { value: 'very_obvious', label: '很明显会' }
    ]
  },
  { id: 'Q7', title: '对方回复通常是什么状态？', type: 'single_select', required: true, order: 7,
    options: [
      { value: 'perfunctory', label: '敷衍短句' },
      { value: 'simple', label: '简单回应' },
      { value: 'normal', label: '正常交流' },
      { value: 'engaged', label: '有内容、有追问' },
      { value: 'highly_invested', label: '明显投入很多' }
    ]
  },
  { id: 'Q8', title: '对方会记住你的细节、情绪或之前说过的话吗？', type: 'single_select', required: true, order: 8,
    options: [
      { value: 'almost_never', label: '几乎不会' },
      { value: 'occasionally', label: '偶尔' },
      { value: 'average', label: '一般' },
      { value: 'noticeable', label: '比较明显' },
      { value: 'very_noticeable', label: '很明显' }
    ]
  },
  { id: 'Q9', title: '对方是否制造或接受更深入的互动机会？', prompt: '比如见面、通话、单独交流、延长相处时间',
    type: 'single_select', required: true, order: 9,
    options: [
      { value: 'rarely', label: '很少' },
      { value: 'sometimes', label: '偶尔' },
      { value: 'average', label: '一般' },
      { value: 'often', label: '经常' },
      { value: 'proactive', label: '很主动' }
    ]
  },
  { id: 'Q10', title: '对方是否会把你带入未来一点点的安排或设想中？', type: 'single_select', required: true, order: 10,
    options: [
      { value: 'never', label: '从不' },
      { value: 'rarely', label: '很少' },
      { value: 'occasionally', label: '偶尔' },
      { value: 'several_times', label: '有过几次' },
      { value: 'clear_future_reference', label: '比较明确' }
    ]
  },
  { id: 'Q11', title: '你感觉这段互动里，谁在承担更多推进成本？', type: 'single_select', required: true, order: 11,
    options: [
      { value: 'almost_all_me', label: '几乎全是我' },
      { value: 'mostly_me', label: '大多是我' },
      { value: 'balanced', label: '差不多' },
      { value: 'mostly_them', label: '大多是对方' },
      { value: 'clearly_them', label: '很明显是对方' }
    ]
  },
  { id: 'Q12', title: '如果你停止主动几天，对方通常会怎样？', type: 'single_select', required: true, order: 12,
    options: [
      { value: 'wont_reach_out', label: '基本不会来找我' },
      { value: 'occasionally_reach_out', label: '偶尔才会' },
      { value: 'uncertain', label: '不确定' },
      { value: 'will_reach_out', label: '会主动找我' },
      { value: 'notice_and_pursue', label: '会明显察觉并主动靠近' }
    ]
  },
  { id: 'Q13', title: '对方前后说法会明显不一致吗？', type: 'single_select', required: true, order: 13,
    options: [
      { value: 'often_inconsistent', label: '经常' },
      { value: 'sometimes_critical', label: '偶尔但关键处会' },
      { value: 'uncertain', label: '不确定' },
      { value: 'mostly_consistent', label: '大多一致' },
      { value: 'very_consistent', label: '很一致' }
    ]
  },
  { id: 'Q14', title: '答应你的事情，对方兑现情况如何？', type: 'single_select', required: true, order: 14,
    options: [
      { value: 'often_not_followed_through', label: '经常不兑现' },
      { value: 'sometimes_not_followed_through', label: '偶尔不兑现' },
      { value: 'hard_to_tell', label: '不好说' },
      { value: 'mostly_followed_through', label: '大多兑现' },
      { value: 'almost_always_followed_through', label: '基本都兑现' }
    ]
  },
  { id: 'Q15', title: '当你问到关键问题时，对方通常会？', type: 'single_select', required: true, order: 15,
    options: [
      { value: 'avoid', label: '回避' },
      { value: 'vague', label: '模糊带过' },
      { value: 'depends', label: '看情况' },
      { value: 'respond', label: '基本愿意回应' },
      { value: 'clarify', label: '愿意明确说明' }
    ]
  },
  { id: 'Q16', title: '你是否能验证对方一些关键说法？', type: 'single_select', required: true, order: 16,
    options: [
      { value: 'almost_cannot', label: '基本不能' },
      { value: 'rarely_can', label: '很少能' },
      { value: 'partially_can', label: '部分能' },
      { value: 'mostly_can', label: '大多能' },
      { value: 'easily_can', label: '很容易验证' }
    ]
  },
  { id: 'Q17', title: '对方对你的态度是否忽冷忽热？', type: 'single_select', required: true, order: 17,
    options: [
      { value: 'very_obvious', label: '非常明显' },
      { value: 'noticeable', label: '比较明显' },
      { value: 'a_little', label: '有一点' },
      { value: 'not_much', label: '不太明显' },
      { value: 'stable', label: '很稳定' }
    ]
  },
  { id: 'Q18', title: '线上和线下，对方表现是否差很多？', type: 'single_select', required: true, order: 18,
    options: [
      { value: 'very_different', label: '差很多' },
      { value: 'noticeably_different', label: '有明显差异' },
      { value: 'cannot_compare', label: '不确定 / 没法比较' },
      { value: 'similar', label: '差异不大' },
      { value: 'very_similar', label: '很一致' }
    ]
  },
  { id: 'Q19', title: '对方在敏感点上，是更倾向澄清，还是转移/防御？', type: 'single_select', required: true, order: 19,
    options: [
      { value: 'often_deflect', label: '常转移或防御' },
      { value: 'sometimes_deflect', label: '偶尔会' },
      { value: 'uncertain', label: '不确定' },
      { value: 'mostly_explain', label: '大多会解释' },
      { value: 'willing_to_clarify', label: '基本愿意澄清' }
    ]
  },
  { id: 'Q20', title: '你觉得自己现在掌握的是：', type: 'single_select', required: true, order: 20,
    options: [
      { value: 'mostly_feelings', label: '大多是感觉' },
      { value: 'few_facts_many_guesses', label: '少量事实 + 很多推测' },
      { value: 'half_half', label: '一半事实一半感觉' },
      { value: 'many_concrete_facts', label: '有不少具体事实' },
      { value: 'mostly_fact_based', label: '基本有事实依据' }
    ]
  },
  { id: 'Q21', title: '你能举出几个重复出现的模式，而不是单次事件吗？', type: 'single_select', required: true, order: 21,
    options: [
      { value: 'almost_none', label: '几乎不能' },
      { value: 'only_one', label: '只能举出1次' },
      { value: 'two_or_three', label: '有2-3次' },
      { value: 'multiple', label: '有多次' },
      { value: 'highly_repetitive', label: '非常稳定地重复出现' }
    ]
  },
  { id: 'Q22', title: '你观察这段关系多久了？', type: 'single_select', required: true, order: 22,
    options: [
      { value: 'under_3_days', label: '不到3天' },
      { value: 'several_days', label: '几天' },
      { value: 'one_to_two_weeks', label: '1-2周' },
      { value: 'two_to_six_weeks', label: '2-6周' },
      { value: 'longer', label: '更久' }
    ]
  },
  { id: 'Q23', title: '最近有没有一件事让你明显觉得"他/她可能是认真的"？', type: 'single_select', required: true, order: 23,
    options: [
      { value: 'none', label: '没有' },
      { value: 'yes_but_uncertain', label: '有，但不确定' },
      { value: 'yes_clear', label: '有，比较明确' }
    ]
  },
  { id: 'Q24', title: '最近有没有一件事让你明显觉得"哪里不对劲"？', type: 'single_select', required: true, order: 24,
    options: [
      { value: 'none', label: '没有' },
      { value: 'a_little', label: '有一点' },
      { value: 'yes_significant', label: '有，且影响很大' }
    ]
  },
  { id: 'T1', title: '请描述最近一次让你觉得"关系有推进"或"有好感迹象"的互动。',
    type: 'text_long', required: false, order: 25,
    placeholder: '例如：对方做了什么、说了什么、你为什么觉得这是一个推进信号',
    helpText: '尽量描述具体行为，而不只是你的感觉。'
  },
  { id: 'T2', title: '请描述最近一次让你觉得"不一致、回避或不舒服"的互动。',
    type: 'text_long', required: false, order: 26,
    placeholder: '例如：发生了什么、对方如何回应、你为什么觉得不对劲',
    helpText: '尽量写出关键对话或行为细节。'
  }
]

const closeFriendOverrides: Record<string, any> = {
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
  Q10: { title: '对方是否会把你放进后续安排或长期联系设想里？' },
  Q23: { title: '最近有没有一件事让你明显觉得"他/她是真的把你当回事"？' },
  T1: {
    title: '请描述最近一次让你觉得"关系更靠近"或"信任在上升"的互动。',
    placeholder: '例如：对方做了什么、说了什么、你为什么觉得你们更靠近了',
    helpText: '尽量描述具体行为，而不只是你的感觉。'
  }
}

export function getQuestionsForRelationType(relationType = 'romantic'): any[] {
  if (relationType !== 'close_friend') return questionDefinitions
  return questionDefinitions.map((q) => {
    const override = closeFriendOverrides[q.id]
    if (!override) return q
    return { ...q, ...override, options: override.options ?? q.options }
  })
}
