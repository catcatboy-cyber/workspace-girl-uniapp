/**
 * queryTaohua — 每日命理桃花日历数据云函数
 *
 * 职责：返回基于当前日期的日历数据（日柱/方位/宜忌/节气）
 * 个人数据（本命桃花/红鸾天喜/星座）由客户端 taohua.ts 本地计算
 *
 * 依赖：lunar-javascript（寿星天文历 JS 移植，MIT 协议）
 * 等价于 Python 引擎的 lunar-python
 */
const cloudbase = require('@cloudbase/node-sdk')
const { Solar } = require('lunar-javascript')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { checkFeatureAccess } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function buildDailyData() {
  const solar = Solar.fromDate(new Date())
  const lunar = solar.getLunar()

  const nextJieQi = lunar.getNextJieQi()
  const nextJieQiName = nextJieQi ? nextJieQi.getName() : ''

  const xiu = lunar.getXiu()
  const zheng = lunar.getZheng()
  const animal = lunar.getAnimal()
  const gong = lunar.getGong()
  const shou = lunar.getShou()

  return {
    /** 公历日期字符串 */
    solarDate: solar.toFullString(),
    /** 农历 */
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,

    /** 干支 */
    ganzhi: {
      dayGanZhi: lunar.getDayInGanZhi(),
      dayGan: lunar.getDayGan(),
      dayZhi: lunar.getDayZhi(),
      yearPillar: `${lunar.getYearInGanZhi()} ${lunar.getYearShengXiao()}年`,
      monthPillar: lunar.getMonthInGanZhi(),
    },

    /** 神煞方位 */
    fangwei: {
      xishen: { gua: lunar.getDayPositionXi(), fangwei: lunar.getDayPositionXiDesc() },
      caishen: { gua: lunar.getDayPositionCai(), fangwei: lunar.getDayPositionCaiDesc() },
      fushen: { gua: lunar.getDayPositionFu(), fangwei: lunar.getDayPositionFuDesc() },
      yanggui: { gua: lunar.getDayPositionYangGui(), fangwei: lunar.getDayPositionYangGuiDesc() },
      yingui: { gua: lunar.getDayPositionYinGui(), fangwei: lunar.getDayPositionYinGuiDesc() },
      taishen: lunar.getDayPositionTai(),
    },

    /** 宜忌 */
    yiji: {
      jianchu: lunar.getZhiXing(),
      yi: lunar.getDayYi(),
      ji: lunar.getDayJi(),
      jishen: lunar.getDayJiShen(),
      xiongsha: lunar.getDayXiongSha(),
    },

    /** 星宿 */
    ershibaxiu: `${xiu}${zheng}${animal}（${gong}${shou}）`,
    /** 彭祖百忌 */
    pengzu: `${lunar.getPengZuGan()}；${lunar.getPengZuZhi()}`,
    /** 冲煞 */
    chongsha: lunar.getDayChongDesc(),
    shafang: lunar.getDaySha(),

    /** 节气 */
    jieqi: {
      current: lunar.getJieQi() || '',
      next: nextJieQiName,
      lunarMonth: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月`,
      yearPillar: `${lunar.getYearInGanZhi()} ${lunar.getYearShengXiao()}年`,
      monthPillar: lunar.getMonthInGanZhi(),
    },
  }
}

// ── 行动指南映射表 ──

const WUXING_WEAR = {
  '金': { colors: ['白色', '银色', '金色'], material: '金属饰品、银饰', neutral: '戴银色项链/手链或白水晶', male: '戴银色手表或白水晶手串', female: '戴条银色项链或白水晶手串' },
  '木': { colors: ['绿色', '青色'], material: '木质饰品、绿松石', neutral: '戴木质手串或绿色配饰', male: '穿绿色T恤/卫衣，戴木质手串', female: '戴木质手串或绿色发饰' },
  '水': { colors: ['黑色', '深蓝', '藏青'], material: '黑曜石、珍珠', neutral: '穿黑色/深蓝色，戴黑曜石', male: '穿黑色/深蓝色上衣，戴黑曜石手串', female: '穿黑色/深蓝色，戴黑曜石或珍珠耳钉' },
  '火': { colors: ['红色', '紫色', '橙色'], material: '红玛瑙、紫水晶', neutral: '穿红色系，戴红绳手链', male: '穿红色内搭或红绳手链', female: '涂个红唇或戴红绳手链' },
  '土': { colors: ['黄色', '棕色', '卡其色'], material: '黄水晶、陶瓷、琥珀', neutral: '穿卡其色/棕色系，搭配黄色配饰', male: '穿卡其色外套/棕色鞋，戴黄水晶手串', female: '搭个棕色包包或黄水晶吊坠' },
}

const DIRECTION_VENUES = {
  '正北': '城市北边的咖啡馆、水边餐厅、海洋馆',
  '正南': '城南的livehouse、火锅店、运动场馆',
  '正东': '城东的书店、公园、植物园',
  '正西': '城西的商场、金饰店、美术馆',
  '东北': '东北方向的书店、茶馆',
  '东南': '东南方向的花园、夜市',
  '西南': '西南方向的甜品店、花店',
  '西北': '西北方向的艺术馆、咖啡厅',
}

function coarseDirection(direction) {
  return String(direction || '').replace(/偏.*/, '')
}

// ── 建除十二神 → 每日感情 vibe（日常交往指导） ──
const DAY_VIBE = {
  '成': { vibe: '🌤️ 好日子', summary: '成日万事圆满，是感情上最好的日子。', dos: ['主动发消息聊天，TA回复的概率比平时高','约TA出来见面，今天的气场适合深度交流','表达好感，成日的能量会让真诚被看见'], donts: ['别宅在家，好日子不出门就浪费了'], activities: ['看电影','吃顿好的','看展览/逛博物馆','散步聊天'], oneliner: '成日大吉——主动一点，真诚一点。适合约TA看电影、吃饭、散步，做什么都顺。' },
  '开': { vibe: '✨ 新开始', summary: '开日开创之日，适合开启新的互动。', dos: ['第一次约TA出来，开日的气场适合破冰','开启新话题，聊点平时没聊过的','主动加微信或发第一条消息'], donts: ['别犹豫太久，开日的能量过了就没了','不要纠结过去的误会'], activities: ['喝咖啡/下午茶','逛市集/创意园区','打羽毛球/台球','一起去书店'], oneliner: '开日——适合迈出第一步。约TA喝咖啡、逛市集、打羽毛球，轻松破冰。' },
  '满': { vibe: '🌕 丰收日', summary: '满日代表圆满收获，适合巩固关系。', dos: ['送个小礼物或请TA吃饭','约TA去热闹的地方，人多氛围好','朋友聚会时带上TA'], donts: ['不要急着推进太快','不要因为小事计较'], activities: ['吃火锅/烧烤','看livehouse/演出','参加朋友聚会','逛夜市/美食街'], oneliner: '满日——适合热闹的约会。吃火锅、看演出、逛夜市，大家一起更开心。' },
  '定': { vibe: '⚓ 稳定日', summary: '定日安定稳固，适合确定心意。', dos: ['好好聊一次天，把彼此想法说清楚','给对方一个明确的信号','今天说的话容易被记住'], donts: ['不要忽冷忽热','不要同时撩好几个人'], activities: ['安静咖啡馆长谈','一起做饭','公园长椅聊天','江边/湖边散步'], oneliner: '定日——适合安静的深度约会。咖啡馆长谈、一起做饭、江边散步，把话说清楚。' },
  '平': { vibe: '😐 平常心', summary: '平日诸事平常，顺其自然就好。', dos: ['按平时的节奏聊天就好','做你自己，真诚比套路更重要'], donts: ['不要刻意制造惊喜','不要因为回复慢了就焦虑'], activities: ['随便吃个饭','一起散步','看剧/刷综艺','线上聊天'], oneliner: '平日——平常心。随便吃个饭、散个步、线上聊聊都行，不用刻意安排。' },
  '执': { vibe: '🔒 观望日', summary: '执日宜守不宜攻，适合观察等待。', dos: ['观察TA的动态，收集信息比行动重要','花时间提升自己——健身、看书、学技能'], donts: ['不要冲动表白','不要频繁发消息追问','不要做重大感情决定'], activities: ['自己去健身/跑步','在家看书/看电影','整理房间/换发型','线上随便聊聊即可'], oneliner: '执日——观望比行动明智。今天适合提升自己，健身、看书、换个发型，让TA注意到你的变化。' },
  '破': { vibe: '⚠️ 避开日', summary: '破日大凶，感情上宜静不宜动。', dos: ['保持现有节奏，不主动也不刻意冷淡','如果TA心情不好，给TA空间'], donts: ['千万不要表白或提分手','不要翻旧账或挑起争论','不要约重要约会','不要发情绪化的长消息'], activities: ['不适合约会','自己待着最安全','打游戏/刷剧转移注意力'], oneliner: '破日——不适合任何感情大动作。自己待着，打打游戏刷刷剧，过了今天再说。' },
  '危': { vibe: '🌧️ 谨慎日', summary: '危日小心行事，稳妥为上。', dos: ['保持日常问候即可','如果一定要见面，选熟悉的地方'], donts: ['不要试探TA的态度','不要发暗示性内容','不要酒后发消息或打电话'], activities: ['线上聊天最安全','约在常去的老地方','一起打游戏（线上）','看同一部电影然后聊感受'], oneliner: '危日——谨慎一点。线上聊聊、一起打打游戏就好，别急着见面。' },
  '收': { vibe: '📝 回顾日', summary: '收日宜收纳整理，适合回顾小结。', dos: ['回顾最近的互动','整理聊天记录或你们的照片','发个简单问候但不适合深聊'], donts: ['不要急着推进关系','不要翻旧账'], activities: ['整理照片做个小合集发给TA','约TA一起整理东西/大扫除','轻松吃个便饭','一起逛超市'], oneliner: '收日——适合整理回顾。翻翻聊天记录找感觉，约TA逛超市、吃便饭这种日常小事就很好。' },
  '闭': { vibe: '🔇 低调日', summary: '闭日诸事不宜，适合低调内省。', dos: ['今天适合独处充电','如果TA主动找你，正常回应就好'], donts: ['不要主动发起社交或约会','不要做任何重要的感情决定'], activities: ['一个人待着最好','泡澡/做面膜/护肤','写日记/整理心情','早点睡'], oneliner: '闭日——适合独处充电。泡个澡做做面膜早点睡，明天状态更好。' },
  '除': { vibe: '🧹 除旧日', summary: '除日宜除旧布新，适合化解误会。', dos: ['如果有误会或冷战，今天是和解的好时机','坦诚沟通，把心里的疙瘩说出来','约TA去新鲜的地方，换换环境'], donts: ['不要揪着旧事不放','不要在新关系里重复旧错误'], activities: ['约TA去新开的餐厅','一起去爬山/徒步','看一场电影然后聊聊感受','泡温泉/汗蒸'], oneliner: '除日——适合化解误会、翻篇重来。约TA去新餐厅、爬山、泡温泉，换个环境把话说开。' },
  '建': { vibe: '🌱 尝试日', summary: '建日万物开始，适合新的尝试。', dos: ['尝试新的聊天方式或话题','换个形象或风格','迈出一小步，不必太大'], donts: ['不要一上来就要承诺','不要因为小挫折就放弃'], activities: ['约TA去新开的店','一起体验没做过的事（陶艺/烘焙/密室）','换个穿衣风格约TA','一起运动（攀岩/骑行/打球）'], oneliner: '建日——适合新尝试。约TA去新店、做陶艺、攀岩骑行，新鲜感是最好的吸引力。' },
}

function getDayVibe(jianchu) {
  return DAY_VIBE[jianchu] || DAY_VIBE['平']
}

function calcTaohuaScore(jianchu, taohuaDir, xishenDir, isLiuheDay, yiji) {
  let score = 50
  const reasons = []
  const weights = {
    '成':[30,'成日最吉'],'开':[30,'开日大吉'],'满':[20,'满日丰收'],'定':[15,'定日安稳'],
    '除':[15,'除日翻新'],'建':[10,'建日开始'],'平':[0,''],'收':[-5,'收日收敛'],
    '执':[-10,'执日观望'],'危':[-15,'危日谨慎'],'破':[-30,'破日大凶'],'闭':[-30,'闭日大凶'],
  }
  const [w, r] = weights[jianchu] || [0,'']
  score += w; if (r) reasons.push(r)

  const tBase = taohuaDir.replace(/偏.*/, '')
  const xBase = xishenDir.replace(/偏.*/, '')
  if (tBase === xishenDir || xBase === taohuaDir || tBase === xBase) {
    score += 20; reasons.push('桃花与喜神同方位')
  }

  if (isLiuheDay) { score += 15; reasons.push('今日六合助缘') }

  const loveGood = ['嫁娶','纳采','订婚','出行','会友','安床']
  const yiLove = (yiji.yi||[]).filter(y => loveGood.includes(y))
  if (yiLove.length) score += Math.min(yiLove.length * 3, 10)
  if ((yiji.yi||[]).some(y => ['嫁娶','纳采','订婚'].includes(y))) reasons.push('宜嫁娶纳采')
  if ((yiji.ji||[]).includes('嫁娶')) { score -= 15; reasons.push('忌嫁娶') }
  if ((yiji.ji||[]).includes('词讼')) { score -= 10; reasons.push('忌词讼口舌') }

  score = Math.max(0, Math.min(100, score))
  let level = score >= 85 ? '🔥 爆棚' : score >= 70 ? '🌤️ 不错' : score >= 55 ? '😐 平常' : score >= 40 ? '🌧️ 偏低' : score >= 25 ? '⚠️ 低迷' : '❄️ 冰点'
  return { 分数: score, 评级: level, 加分项: reasons, 一句话: `桃花指数 ${score}/100，${level}` + (reasons.length ? `——${reasons[0]}` : '') }
}

function buildPracticalGuide(wuxing, taohuaDir, yiji, xishenDir, zodiac, jianchu, score, isLiuheDay, liuheDir, gender) {
  const wear = WUXING_WEAR[wuxing] || WUXING_WEAR['火']
  const genderKey = (gender === 'male' || gender === 'female') ? gender : 'neutral'
  const wearTip = wear[genderKey]
  const vibe = getDayVibe(yiji.jianchu)

  // 本命五行
  const ZODIAC_WUXING = { '鼠':'水','牛':'土','虎':'木','兔':'木','龙':'土','蛇':'火','马':'火','羊':'土','猴':'金','鸡':'金','狗':'土','猪':'水' }
  const benmingWx = zodiac ? (ZODIAC_WUXING[zodiac] || null) : null

  // 双层穿戴
  const wearInfo = {
    桃花五行: wuxing,
    桃花颜色: wear.colors,
    桃花材质: wear.material,
    桃花点睛: wearTip,
  }
  if (benmingWx) {
    wearInfo.本命五行 = benmingWx
    const WX_REL = {
      '木,火':['木生火',`穿绿色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '木,土':['木克土',`穿绿色+${wear.colors[0]}，${wearTip}，主动平衡`],
      '木,金':['金克木',`穿${wear.colors[0]}+绿色，${wearTip}，金银饰和木质手串叠戴`],
      '木,水':['水生木',`桃花位在滋养你，穿${wear.colors[0]}即可——今天气场对你好`],
      '木,木':['双木成林',`穿绿色+${wear.colors[0]}层叠，${wearTip}，天生契合`],
      '火,土':['火生土',`穿红色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '火,金':['火克金',`穿红色+${wear.colors[0]}，${wearTip}，主动平衡`],
      '火,水':['水克火',`穿${wear.colors[0]}+红色，${wearTip}，桃花位在克制你，叠戴化解`],
      '火,木':['木生火',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '火,火':['双火同辉',`穿红色+${wear.colors[0]}，${wearTip}，能量共振`],
      '土,金':['土生金',`穿黄色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '土,水':['土克水',`穿黄色+${wear.colors[0]}，${wearTip}，主动平衡`],
      '土,木':['木克土',`穿${wear.colors[0]}+黄色，${wearTip}，桃花位在克制你，叠戴化解`],
      '土,火':['火生土',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '土,土':['双土厚重',`穿黄色+${wear.colors[0]}层叠，${wearTip}，稳健搭配`],
      '金,水':['金生水',`穿白色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '金,木':['金克木',`穿白色+${wear.colors[0]}，${wearTip}，主动平衡`],
      '金,火':['火克金',`穿${wear.colors[0]}+白色，${wearTip}，桃花位在克制你，叠戴化解`],
      '金,土':['土生金',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '金,金':['双金铿锵',`穿白色+${wear.colors[0]}，${wearTip}，能量共振`],
      '水,木':['水生木',`穿黑色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '水,火':['水克火',`穿黑色+${wear.colors[0]}，${wearTip}，主动平衡`],
      '水,土':['土克水',`穿${wear.colors[0]}+黑色，${wearTip}，桃花位在克制你，叠戴化解`],
      '水,金':['金生水',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '水,水':['双水共流',`穿黑色+${wear.colors[0]}层叠，${wearTip}，能量共振`],
    }
    const key = `${benmingWx},${wuxing}`
    const rel = WX_REL[key]
    if (rel) { wearInfo.五行关系 = rel[0]; wearInfo.一句话 = rel[1] }
  } else {
    wearInfo.一句话 = `今天穿${wear.colors[0]}或${wear.colors[1]}，${wearTip}，桃花运加成。`
  }

  // 约会建议根据指数自适应
  const sc = score?.分数 || score || 50
  const isLow = sc < 40
  const dateMsg = isLow ? `今日桃花指数仅${sc}分，不建议安排重要约会` : sc >= 70 ? `今日桃花在${taohuaDir}，指数${sc}分，大胆约！` : `今日桃花在${taohuaDir}，指数${sc}分，适合轻松约会`
  const venue = isLow ? '今天不适合线下约会，线上聊聊就好' : (DIRECTION_VENUES[taohuaDir] || DIRECTION_VENUES[coarseDirection(taohuaDir)] || '城市公共空间')
  const oneliner = isLow ? `桃花能量偏弱，不建议线下约会；线上互动更稳妥，改天再约。` : (isLiuheDay ? `今日咸池桃花在${taohuaDir}，六合助缘同至${liuheDir || taohuaDir}——两个吉位重叠，约会往这方向走错不了。` : `今日咸池桃花在${taohuaDir}，约会往这个方向走——有合适的场所就约。`)

  return {
    约会指南: {
      方位: taohuaDir,
      六合方位: isLiuheDay ? (liuheDir || taohuaDir) : '',
      六合助缘: isLiuheDay,
      天喜方位: '',
      天喜日: false,
      场所建议: venue,
      今日气场: vibe.vibe,
      建除: yiji.jianchu,
      解读: vibe.summary,
      建议活动: vibe.activities,
      宜做: vibe.dos,
      避开: vibe.donts,
      一句话: oneliner,
      isLow: sc < 40,
    },
    穿戴建议: wearInfo,
  }
}

/**
 * 主入口
 * @param {object} event — { zodiac: string, sign: string }
 */
// ── MBTI 性格简释 ──
const MBTI_FLAVORS = {
  'INTJ': { label: '建筑师', desc: '理性、独立、注重系统性，重视深度和质量胜过数量。不喜表面寒暄，倾向于用行动和规划表达关心。感情节奏偏慢热，一旦确定全力以赴。', dating: '偏好安静有深度的环境，喜欢计划好的约会。建议：咖啡厅深度聊天、参观博物馆。' },
  'INTP': { label: '逻辑家', desc: '好奇心驱动、爱分析，重视智识契合。不擅长表达情绪，但会通过"帮你解决问题"表达关心。有点笨拙但真诚。', dating: '偏好新奇能激发思考的地方。建议：科技馆、书店、密室逃脱。' },
  'ENTJ': { label: '指挥官', desc: '自信、果断、目标导向，主动且直接。重视伴侣的能力和潜力，喜欢一起成长的伙伴关系。温柔不足但绝对可靠。', dating: '偏好高质量高效的活动，会主动安排。建议：高品质晚餐、红酒品鉴。' },
  'ENTP': { label: '辩论家', desc: '聪明、幽默、热爱智力挑战，喜欢"你来我往"的思维碰撞。撩人于无形，但有时因太爱抬杠让对方迷惑。', dating: '偏好新鲜有趣的非常规活动。建议：喜剧俱乐部、辩论活动、即兴戏剧。' },
  'INFJ': { label: '提倡者', desc: '深思熟虑、有洞察力、理想主义，追求灵魂连接。善解人意但内心难打开，一旦信任会给出极深的情感投入。', dating: '偏好有意义能深度交流的场合。建议：艺术画廊、安静书店咖啡馆、日落散步。' },
  'INFP': { label: '调停者', desc: '温柔、有创造力、价值观驱动，追求真实和灵魂共鸣。极富同理心，易被故事和情感打动。有时过于理想化对方。', dating: '偏好浪漫有故事感的地方。建议：花园散步、手作工坊、独立电影。' },
  'ENFJ': { label: '主人公', desc: '温暖、有感染力、善于激励，热情而体贴。天生擅长把握关系节奏，主动照顾对方情绪。注意别因太想帮助而忽略了倾听。', dating: '偏好社交性强的活动，喜欢制造惊喜。建议：小型聚会、音乐会、一日游。' },
  'ENFP': { label: '竞选家', desc: '热情、好奇、充满可能性，天真又热烈。容易被新鲜的人和想法吸引，感情直接而迷人。需警惕注意力过于分散。', dating: '偏好即兴快乐的体验，讨厌按部就班。建议：节日市集、街头美食之旅、即兴公路旅行。' },
  'ISTJ': { label: '物流师', desc: '务实、负责、极其可靠，用行动表达爱非语言。重视承诺和稳定，可能不够浪漫但默默记住每件小事并兑现。', dating: '偏好传统可靠经验证的经典方案。建议：经典晚餐+电影、参观当地历史地标。' },
  'ISFJ': { label: '守卫者', desc: '温暖、细心、默默付出，极致温柔。善察对方微小需求并提前满足。感情深沉表达含蓄，需对方主动才能打开。', dating: '偏好温馨私密有意义的小确幸。建议：一起做饭、逛古董店或手工艺市集、温暖咖啡馆。' },
  'ESTJ': { label: '总经理', desc: '果断、有条理、有责任心，重视秩序和清晰承诺。喜欢明确边界和可预期互动。需在效率和情绪间找平衡。', dating: '偏好高效有成果的活动。建议：运动健身、高级餐厅晚餐。' },
  'ESFJ': { label: '执政官', desc: '社交高手、重视和谐、极具责任心，非常投入且乐于付出。重视传统关系模式和社交圈认可。需懂得感恩的伴侣。', dating: '偏好经典浪漫有社交元素的场合。建议：餐厅+朋友一起活动、社区活动。' },
  'ISTP': { label: '鉴赏家', desc: '冷静、务实、行动派，用行动多于言语。重视个人空间和自由，不太适应过于情绪化表达。吸引人的是自在感。', dating: '偏好有动手参与感的实践活动。建议：攀岩、骑行、DIY工作坊。' },
  'ISFP': { label: '探险家', desc: '感性、有艺术气质、活在当下，追求美的体验和真实瞬间。温柔但有自己的节奏。表达爱的方式是和你一起体验美好。', dating: '偏好充满美感有创造性的体验。建议：艺术创作体验课、户外野餐音乐会、拍照徒步。' },
  'ESTP': { label: '企业家', desc: '大胆、适应力强、喜欢即兴行动，充满活力和激情。擅长制造刺激惊喜，可能对长期承诺不耐。吸引人的是冒险感。', dating: '偏好激动人心有肾上腺素的活动。建议：极限运动、卡丁车、演唱会。' },
  'ESFP': { label: '表演家', desc: '热情、社交、享受当下，像阳光一样温暖。天生人群焦点，轻易让对方感到特别。需学会区分好感与持续投入。', dating: '偏好热闹有趣能展现魅力的场合。建议：主题派对、KTV、游乐园。' },
}

exports.main = async (event) => {
  let { zodiac, sign, gender, mbtiCode } = event || {}

  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const access = await checkFeatureAccess(db, userId, '命理桃花')
    if (!access.allowed) {
      return {
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        message: access.reason || '当前套餐不支持命理桃花功能，请升级套餐。'
      }
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    return { success: false, message: '功能权限检查失败' }
  }

  // 校验生肖
  const validZodiac = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
  if (zodiac && !validZodiac.includes(zodiac)) {
    return { success: false, message: `未知生肖: ${zodiac}` }
  }

  // 校验星座
  const validSigns = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座']
  if (sign && !validSigns.includes(sign)) {
    // 模糊匹配
    const matched = validSigns.find(s => sign.includes(s) || s.startsWith(sign))
    if (!matched) return { success: false, message: `未知星座: ${sign}` }
    sign = matched
  }

  try {
    const daily = buildDailyData()
    // 生成行动指南
    const dayZhi = daily.ganzhi.dayZhi
    // 根据日支查五行：寅卯→木 巳午→火 申酉→金 亥子→水 辰未戌丑→土
    const zhiWuxing = { '寅':'木','卯':'木','巳':'火','午':'火','申':'金','酉':'金','亥':'水','子':'水','辰':'土','未':'土','戌':'土','丑':'土' }
    // 咸池桃花：日支→三合局→沐浴位（《三命通会》三合沐浴算法）
    const SANHE_BATHING = { '申':'酉','子':'酉','辰':'酉', '亥':'子','卯':'子','未':'子', '寅':'卯','午':'卯','戌':'卯', '巳':'午','酉':'午','丑':'午' }
    const taohuaZhi = SANHE_BATHING[dayZhi] || '午'
    const DIR_MAP = { '子':'正北','丑':'东北偏北','寅':'东北偏东','卯':'正东','辰':'东南偏东','巳':'东南偏南','午':'正南','未':'西南偏南','申':'西南偏西','酉':'正西','戌':'西北偏西','亥':'西北偏北' }
    const taohuaDir = DIR_MAP[taohuaZhi] || '正南'
    const wuxing = zhiWuxing[taohuaZhi] || zhiWuxing[dayZhi] || '火'
    const xishenDir = daily.fangwei.xishen.fangwei

    // 六合助缘判断（日支与月建六合）。这是地支六合，不等同于红鸾天喜体系的“天喜”。
    const LIUHE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' }
    const monthZhi = (daily.ganzhi.monthPillar || '').slice(-1)
    const isLiuheDay = LIUHE[dayZhi] === monthZhi

    const liuheZhi = LIUHE[dayZhi] || ''
    const liuheDir = liuheZhi ? DIR_MAP[liuheZhi] || '' : ''

    const score = calcTaohuaScore(daily.yiji.jianchu, taohuaDir, xishenDir, isLiuheDay, daily.yiji)
    const practical = buildPracticalGuide(wuxing, taohuaDir, daily.yiji, xishenDir, zodiac, daily.yiji.jianchu, score, isLiuheDay, liuheDir, gender)

    // MBTI 性格简释
    const validMbti = new Set(['','INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'])
    const mbtiData = (mbtiCode && validMbti.has(mbtiCode) && MBTI_FLAVORS[mbtiCode])
      ? {
          code: mbtiCode,
          label: MBTI_FLAVORS[mbtiCode].label,
          desc: MBTI_FLAVORS[mbtiCode].desc,
          dating: MBTI_FLAVORS[mbtiCode].dating,
        }
      : null

    return {
      success: true,
      data: {
        daily,
        practical,
        score,
        input: { zodiac: zodiac || '', sign: sign || '', mbtiCode: mbtiCode || '' },
        mbti: mbtiData,
      },
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}
