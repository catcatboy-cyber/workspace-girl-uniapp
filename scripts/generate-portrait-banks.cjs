'use strict'

const fs = require('fs')
const path = require('path')
const baseCelebrity = require('../cloudfunctions/_shared/crush-celebrity-v1.json')

const ROOT = path.resolve(__dirname, '..')
const DIMENSIONS = ['initiative', 'warmth', 'reliability', 'romance', 'boundary']

const celebrityGenders = {
  wu_zetian: 'female', xiang_yu: 'male', zhao_yun: 'male', zhuge_liang: 'male', li_qingzhao: 'female', wang_yangming: 'male', su_shi: 'male', li_bai: 'male', hua_mulan: 'female', wang_zhaojun: 'female', tang_bohu: 'male', cao_cao: 'male', du_fu: 'male', xin_qiji: 'male', shangguan_waner: 'female', lanling_wang: 'male',
  zhang_ailing: 'female', lin_huiyin: 'female', xu_zhimo: 'male', hu_shi: 'male', song_qingling: 'female', lu_xun: 'male', qian_zhongshu: 'male', yang_jiang: 'female', lu_xiaoman: 'female', liang_sicheng: 'male', bing_xin: 'female', mei_lanfang: 'male', xiao_hong: 'female', shen_congwen: 'male', zhang_xueliang: 'male', zhou_enlai: 'male',
  wang_fei: 'female', zhou_xun: 'female', liu_dehua: 'male', zhou_jielun: 'male', zhang_manyu: 'female', liang_chaowei: 'male', shu_qi: 'female', gong_li: 'female', mo_wenwei: 'female', chen_yixun: 'male', michelle_yeoh: 'female', tang_wei: 'female', takeshi_kaneshiro: 'male', leslie_cheung: 'male', brigitte_lin: 'female', cai_kangyong: 'male',
  cai_wenji: 'female', zhuo_wenjun: 'female', ban_zhao: 'female', deng_yingchao: 'female', hu_ge: 'male'
}

const celebrityReplacements = {
  tang_bohu: { key: 'cai_wenji', name: '蔡文姬', gender: 'female' },
  du_fu: { key: 'zhuo_wenjun', name: '卓文君', gender: 'female' },
  lanling_wang: { key: 'ban_zhao', name: '班昭', gender: 'female' },
  zhang_xueliang: { key: 'deng_yingchao', name: '邓颖超', gender: 'female' },
  tang_wei: { key: 'hu_ge', name: '胡歌', gender: 'male' }
}

function buildCelebrity() {
  const goldenAnswers = {}
  const people = baseCelebrity.people.map((person) => {
    const replacement = celebrityReplacements[person.key]
    const next = { ...person, ...(replacement || {}), gender: replacement?.gender || celebrityGenders[person.key] }
    if (baseCelebrity.goldenAnswers?.[person.key]) goldenAnswers[next.key] = baseCelebrity.goldenAnswers[person.key]
    return next
  })
  return { ...baseCelebrity, people, goldenAnswers }
}

const maleCharacters = [
  ['xi_men_qing','西门庆','《金瓶梅》','classic','gray',[88,48,35,84,22]],
  ['jia_baoyu','贾宝玉','《红楼梦》','classic','gray',[42,92,46,94,38]],
  ['sun_wukong_journey','孙悟空','《西游记》','classic','heroic',[96,72,67,24,58]],
  ['zhuge_liang_romance','诸葛亮','《三国演义》','classic','heroic',[72,58,98,30,92]],
  ['lu_zhishen','鲁智深','《水浒传》','classic','heroic',[91,86,78,28,52]],
  ['xu_xian','许仙','《白蛇传》','classic','gray',[35,82,66,91,34]],
  ['guo_jing','郭靖','《射雕英雄传》','wuxia','heroic',[58,86,99,62,84]],
  ['yang_guo','杨过','《神雕侠侣》','wuxia','gray',[86,76,65,100,44]],
  ['linghu_chong','令狐冲','《笑傲江湖》','wuxia','gray',[77,88,54,83,41]],
  ['zhang_wuji','张无忌','《倚天屠龙记》','wuxia','heroic',[48,91,73,74,32]],
  ['qiao_feng','乔峰','《天龙八部》','wuxia','heroic',[92,84,96,53,90]],
  ['yue_buqun','岳不群','《笑傲江湖》','wuxia','villain',[76,34,68,24,94]],
  ['wu_xie','吴邪','《盗墓笔记》','tomb_raiding','heroic',[68,86,76,58,63]],
  ['zhang_qiling','张起灵','《盗墓笔记》','tomb_raiding','heroic',[36,52,97,20,100]],
  ['wang_pangzi','王胖子','《盗墓笔记》','tomb_raiding','heroic',[82,96,83,57,45]],
  ['hu_bayi','胡八一','《鬼吹灯》','tomb_raiding','heroic',[91,72,93,52,82]],
  ['zhe_gu_shao','鹧鸪哨','《鬼吹灯》','tomb_raiding','gray',[88,55,94,46,91]],
  ['xiang_yunfeng','项云峰','《北派盗墓笔记》','tomb_raiding','gray',[85,66,80,42,74]],
  ['qi_tongwei','祁同伟','《人民的名义》','chinese_screen','gray',[98,38,61,52,69]],
  ['gao_qiqiang','高启强','《狂飙》','chinese_screen','gray',[92,73,72,60,48]],
  ['mei_changsu','梅长苏','《琅琊榜》','chinese_screen','heroic',[78,62,99,42,96]],
  ['fan_xian','范闲','《庆余年》','chinese_screen','gray',[89,82,78,72,75]],
  ['dongfang_qingcang','东方青苍','《苍兰诀》','chinese_screen','gray',[95,37,79,88,89]],
  ['xiao_nai','肖奈','《微微一笑很倾城》','chinese_screen','heroic',[73,66,94,76,91]],
  ['harry_potter','哈利·波特','《哈利·波特》','international','heroic',[86,81,79,55,67]],
  ['sherlock_holmes','夏洛克·福尔摩斯','《福尔摩斯探案集》','international','gray',[74,28,91,15,98]],
  ['mr_darcy','达西先生','《傲慢与偏见》','international','heroic',[39,56,94,83,95]],
  ['jack_dawson','杰克·道森','《泰坦尼克号》','international','heroic',[91,95,63,100,42]],
  ['tony_stark','托尼·斯塔克','漫威电影宇宙','international','gray',[100,72,59,79,53]],
  ['aragorn','阿拉贡','《指环王》','international','heroic',[82,76,100,57,94]],
  ['son_goku_db','孙悟空（龙珠）','《龙珠》','anime','heroic',[100,87,68,20,29]],
  ['vegeta','贝吉塔','《龙珠》','anime','gray',[98,42,85,38,93]],
  ['monkey_d_luffy','蒙奇·D·路飞','《海贼王》','anime','heroic',[100,98,73,22,31]],
  ['gojo_satoru','五条悟','《咒术回战》','anime','gray',[94,69,72,51,87]],
  ['uzumaki_naruto','漩涡鸣人','《火影忍者》','anime','heroic',[99,97,83,43,40]],
  ['edogawa_conan','江户川柯南','《名侦探柯南》','anime','heroic',[78,58,98,35,92]]
]

const femaleCharacters = [
  ['pan_jinlian','潘金莲','《金瓶梅》','classic','gray',[76,61,35,91,27]],
  ['lin_daiyu','林黛玉','《红楼梦》','classic','gray',[35,92,56,98,72]],
  ['xue_baochai','薛宝钗','《红楼梦》','classic','gray',[58,77,95,60,93]],
  ['wang_xifeng','王熙凤','《红楼梦》','classic','gray',[98,59,88,45,86]],
  ['bai_suzhen','白素贞','《白蛇传》','classic','heroic',[84,96,91,98,71]],
  ['hua_mulan_character','花木兰','《木兰辞》','classic','heroic',[92,74,100,34,94]],
  ['huang_rong','黄蓉','《射雕英雄传》','wuxia','heroic',[96,91,82,89,68]],
  ['xiaolongnu','小龙女','《神雕侠侣》','wuxia','heroic',[28,61,98,94,100]],
  ['zhao_min','赵敏','《倚天屠龙记》','wuxia','gray',[100,73,78,91,88]],
  ['zhou_zhiruo','周芷若','《倚天屠龙记》','wuxia','gray',[72,52,84,82,91]],
  ['ren_yingying','任盈盈','《笑傲江湖》','wuxia','heroic',[76,85,94,86,92]],
  ['cheng_lingsu','程灵素','《飞狐外传》','wuxia','heroic',[48,96,100,72,86]],
  ['a_ning','阿宁','《盗墓笔记》','tomb_raiding','gray',[94,47,83,39,92]],
  ['huo_xiuxiu','霍秀秀','《盗墓笔记》','tomb_raiding','heroic',[82,78,88,63,84]],
  ['yin_nanfeng','尹南风','《沙海》','tomb_raiding','gray',[91,54,90,43,97]],
  ['shirley_yang','Shirley杨','《鬼吹灯》','tomb_raiding','heroic',[89,75,98,52,96]],
  ['hong_guniang','红姑娘','《怒晴湘西》','tomb_raiding','heroic',[94,78,86,68,79]],
  ['zhang_haixing','张海杏','《藏海花》','tomb_raiding','gray',[86,46,82,38,94]],
  ['shen_meizhuang','沈眉庄','《甄嬛传》','chinese_screen','heroic',[52,86,100,58,98]],
  ['zhen_huan','甄嬛','《甄嬛传》','chinese_screen','gray',[89,72,91,73,95]],
  ['sheng_minglan','盛明兰','《知否知否应是绿肥红瘦》','chinese_screen','heroic',[68,79,99,60,100]],
  ['an_lingrong','安陵容','《甄嬛传》','chinese_screen','gray',[43,58,48,77,55]],
  ['xu_qin','许沁','《我的人间烟火》','chinese_screen','gray',[38,67,42,88,35]],
  ['huang_yimei','黄亦玫','《玫瑰的故事》','chinese_screen','gray',[91,89,72,100,77]],
  ['hermione_granger','赫敏·格兰杰','《哈利·波特》','international','heroic',[82,75,100,45,96]],
  ['elizabeth_bennet','伊丽莎白·班纳特','《傲慢与偏见》','international','heroic',[78,82,87,76,94]],
  ['wednesday_addams','星期三·亚当斯','《星期三》','international','gray',[62,22,88,18,100]],
  ['daenerys','丹妮莉丝','《权力的游戏》','international','gray',[99,67,72,66,91]],
  ['barbie','芭比','《芭比》','international','heroic',[88,99,82,77,79]],
  ['rose_dewitt','露丝','《泰坦尼克号》','international','gray',[79,87,61,100,73]],
  ['bulma','布尔玛','《龙珠》','anime','heroic',[97,77,85,66,82]],
  ['android_18','人造人18号','《龙珠》','anime','gray',[84,58,91,50,97]],
  ['sailor_moon','月野兔','《美少女战士》','anime','heroic',[83,100,69,94,42]],
  ['kamado_nezuko','灶门祢豆子','《鬼灭之刃》','anime','heroic',[55,100,95,43,66]],
  ['mikasa_ackerman','三笠·阿克曼','《进击的巨人》','anime','heroic',[91,65,100,79,88]],
  ['chihiro','荻野千寻','《千与千寻》','anime','heroic',[67,91,88,46,79]]
]

function dimensionFromAnswers(questions, keys) {
  const sums = Object.fromEntries(DIMENSIONS.map((key) => [key, 0]))
  const counts = Object.fromEntries(DIMENSIONS.map((key) => [key, 0]))
  questions.forEach((question, index) => {
    const option = question.options.find((item) => item.key === keys[index])
    for (const [dimension, score] of Object.entries(option.scores)) {
      sums[dimension] += Number(score)
      counts[dimension] += 1
    }
  })
  return Object.fromEntries(DIMENSIONS.map((key) => [key, Math.round(sums[key] / counts[key])]))
}

function distance(a, b) {
  return Math.sqrt(DIMENSIONS.reduce((sum, key) => sum + ((a[key] - b[key]) ** 2), 0))
}

function candidateProfiles(questions) {
  let seed = 20260804
  const random = () => {
    seed += 0x6D2B79F5
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const unique = new Map()
  for (let index = 0; index < 120000; index += 1) {
    const keys = questions.map(() => 'ABCD'[Math.floor(random() * 4)])
    const profile = dimensionFromAnswers(questions, keys)
    const signature = DIMENSIONS.map((key) => profile[key]).join('|')
    if (!unique.has(signature)) unique.set(signature, { profile, keys })
  }
  return [...unique.values()]
}

function buildCharacters() {
  const questions = JSON.parse(JSON.stringify(baseCelebrity.questions))
  const candidates = candidateProfiles(questions)
  const used = new Set()
  const goldenAnswers = {}
  const metadata = [...maleCharacters.map((item) => [...item, 'male']), ...femaleCharacters.map((item) => [...item, 'female'])]
  const desiredProfiles = new Map(metadata.map(([key, , , , , desired]) => [key, Object.fromEntries(DIMENSIONS.map((dimension, dimensionIndex) => [dimension, desired[dimensionIndex]]))]))
  const people = metadata.map(([key, name, source, category, alignment, desired, gender], index) => {
    let best = null
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      if (used.has(candidateIndex)) continue
      const candidate = candidates[candidateIndex]
      const score = distance(candidate.profile, desiredProfiles.get(key))
      if (!best || score < best.score) best = { candidateIndex, score, ...candidate }
    }
    used.add(best.candidateIndex)
    goldenAnswers[key] = Object.fromEntries(questions.map((question, questionIndex) => [question.id, best.keys[questionIndex]]))
    const audienceTags = category === 'anime' ? ['youth', 'all_age'] : ['middle_age', 'all_age']
    return {
      key, name, source, category, alignment, gender,
      audienceTags,
      heatLevel: ['xi_men_qing','wu_xie','zhang_qiling','qi_tongwei','gao_qiqiang','harry_potter','son_goku_db','vegeta','lin_daiyu','huang_rong','shen_meizhuang','zhen_huan','hermione_granger'].includes(key) ? 5 : 4,
      profile: best.profile,
      summary: `${name}式人物风格：在关系里有鲜明的行动、情绪和边界表达。`,
      attraction: `吸引点是${name}身上辨识度很高的真性情与处事节奏。`,
      caution: `别只看角色高光，也要观察这种风格在现实相处里是否让双方舒服。`,
      enabled: true,
      sortOrder: index + 1,
      coverUrl: ''
    }
  })
  const malePool = people.filter((person) => person.gender === 'male').map((person) => ({ profile: person.profile, answers: goldenAnswers[person.key] }))
  const assignedMaleProfiles = new Set()
  for (const person of people.filter((item) => item.gender === 'female')) {
    let best = null
    for (let index = 0; index < malePool.length; index += 1) {
      if (assignedMaleProfiles.has(index)) continue
      const score = distance(malePool[index].profile, desiredProfiles.get(person.key))
      if (!best || score < best.score) best = { index, score }
    }
    assignedMaleProfiles.add(best.index)
    person.profile = { ...malePool[best.index].profile }
    goldenAnswers[person.key] = { ...malePool[best.index].answers }
  }
  return {
    dimensions: JSON.parse(JSON.stringify(baseCelebrity.dimensions)),
    questions,
    people,
    resultCopy: {
      ...JSON.parse(JSON.stringify(baseCelebrity.resultCopy)),
      shareTemplate: '测完才发现，{subject}最像{primary}（{primarySimilarity}%），第二像{secondary}（{secondarySimilarity}%）。'
    },
    goldenAnswers
  }
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

writeJson('cloudfunctions/_shared/crush-celebrity-v1.json', buildCelebrity())
writeJson('cloudfunctions/_shared/dimension-character-v1.json', buildCharacters())
console.log('Generated gendered celebrity bank and 72-character dimension bank.')
