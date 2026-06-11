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
  '金': { colors: ['白色', '银色', '金色'], tip: '戴条银色项链或白水晶手串', material: '金属饰品、银饰' },
  '木': { colors: ['绿色', '青色'], tip: '戴个木质手串或绿色发饰', material: '木质饰品、绿松石' },
  '水': { colors: ['黑色', '深蓝', '藏青'], tip: '戴黑曜石或珍珠耳钉', material: '黑曜石、珍珠' },
  '火': { colors: ['红色', '紫色', '橙色'], tip: '涂个红唇或戴红绳手链', material: '红玛瑙、紫水晶' },
  '土': { colors: ['黄色', '棕色', '卡其色'], tip: '搭个棕色包包或黄水晶吊坠', material: '黄水晶、陶瓷、琥珀' },
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

function calcTaohuaScore(jianchu, taohuaDir, xishenDir, isTianxiDay, yiji) {
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

  if (isTianxiDay) { score += 15; reasons.push('今日为天喜日') }

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

function buildPracticalGuide(wuxing, taohuaDir, yiji, xishenDir, zodiac, jianchu, score) {
  const wear = WUXING_WEAR[wuxing] || WUXING_WEAR['火']
  const vibe = getDayVibe(yiji.jianchu)

  // 本命五行
  const ZODIAC_WUXING = { '鼠':'水','牛':'土','虎':'木','兔':'木','龙':'土','蛇':'火','马':'火','羊':'土','猴':'金','鸡':'金','狗':'土','猪':'水' }
  const benmingWx = zodiac ? (ZODIAC_WUXING[zodiac] || null) : null

  // 双层穿戴
  const wearInfo = {
    桃花五行: wuxing,
    桃花颜色: wear.colors,
    桃花材质: wear.material,
    桃花点睛: wear.tip,
  }
  if (benmingWx) {
    wearInfo.本命五行 = benmingWx
    const WX_REL = {
      '木,火':['木生火',`穿绿色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '木,土':['木克土',`穿绿色+${wear.colors[0]}，${wear.tip}，主动平衡`],
      '木,金':['金克木',`穿${wear.colors[0]}+绿色，${wear.tip}，金银饰和木质手串叠戴`],
      '木,水':['水生木',`桃花位在滋养你，穿${wear.colors[0]}即可——今天气场对你好`],
      '木,木':['双木成林',`穿绿色+${wear.colors[0]}层叠，${wear.tip}，天生契合`],
      '火,土':['火生土',`穿红色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '火,金':['火克金',`穿红色+${wear.colors[0]}，${wear.tip}，主动平衡`],
      '火,水':['水克火',`穿${wear.colors[0]}+红色，${wear.tip}，桃花位在克制你，叠戴化解`],
      '火,木':['木生火',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '火,火':['双火同辉',`穿红色+${wear.colors[0]}，${wear.tip}，能量共振`],
      '土,金':['土生金',`穿黄色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '土,水':['土克水',`穿黄色+${wear.colors[0]}，${wear.tip}，主动平衡`],
      '土,木':['木克土',`穿${wear.colors[0]}+黄色，${wear.tip}，桃花位在克制你，叠戴化解`],
      '土,火':['火生土',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '土,土':['双土厚重',`穿黄色+${wear.colors[0]}层叠，${wear.tip}，稳健搭配`],
      '金,水':['金生水',`穿白色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '金,木':['金克木',`穿白色+${wear.colors[0]}，${wear.tip}，主动平衡`],
      '金,火':['火克金',`穿${wear.colors[0]}+白色，${wear.tip}，桃花位在克制你，叠戴化解`],
      '金,土':['土生金',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '金,金':['双金铿锵',`穿白色+${wear.colors[0]}，${wear.tip}，能量共振`],
      '水,木':['水生木',`穿黑色为主，搭一点${wear.colors[0]}，把你的能量导向桃花位`],
      '水,火':['水克火',`穿黑色+${wear.colors[0]}，${wear.tip}，主动平衡`],
      '水,土':['土克水',`穿${wear.colors[0]}+黑色，${wear.tip}，桃花位在克制你，叠戴化解`],
      '水,金':['金生水',`桃花位在滋养你，穿${wear.colors[0]}即可`],
      '水,水':['双水共流',`穿黑色+${wear.colors[0]}层叠，${wear.tip}，能量共振`],
    }
    const key = `${benmingWx},${wuxing}`
    const rel = WX_REL[key]
    if (rel) { wearInfo.五行关系 = rel[0]; wearInfo.一句话 = rel[1] }
  } else {
    wearInfo.一句话 = `今天穿${wear.colors[0]}或${wear.colors[1]}，${wear.tip}，桃花运加成。`
  }

  // 约会建议根据指数自适应
  const sc = score?.分数 || score || 50
  const isLow = sc < 40
  const dateMsg = isLow ? `今日桃花指数仅${sc}分，不建议安排重要约会` : sc >= 70 ? `今日桃花在${taohuaDir}，指数${sc}分，大胆约！` : `今日桃花在${taohuaDir}，指数${sc}分，适合轻松约会`
  const venue = isLow ? '今天不适合线下约会，线上聊聊就好' : (DIRECTION_VENUES[taohuaDir] || '城市公共空间')
  const venueX = isLow ? '线上社交为主，改天再约见面' : (DIRECTION_VENUES[xishenDir] || '城市公共空间')
  const oneliner = isLow ? `今天桃花能量偏弱，不建议按方位安排线下约会；线上互动更稳妥，改天再约。` : `约会往${taohuaDir}走，社交往${xishenDir}走。`

  return {
    约会方位: {
      桃花方位: { 方位: taohuaDir, 场所建议: venue, 说明: dateMsg },
      喜神方位: { 方位: xishenDir, 场所建议: venueX, 说明: `喜神在${xishenDir}，` + (isLow ? '适合线上社交互动。' : '社交聚会选此方向气氛最好。') },
      一句话: oneliner,
    },
    活动建议: { 今日气场: vibe.vibe, 建除: yiji.jianchu, 解读: vibe.summary, 建议活动: vibe.activities, 宜做: vibe.dos, 避开: vibe.donts, 一句话: vibe.oneliner },
    穿戴建议: wearInfo,
  }
}

/**
 * 主入口
 * @param {object} event — { zodiac: string, sign: string }
 */
exports.main = async (event) => {
  let { zodiac, sign } = event || {}

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
    const wuxing = zhiWuxing[dayZhi] || '火'
    const taohuaMap = { '子':'正北','丑':'东北偏北','寅':'东北偏东','卯':'正东','辰':'东南偏东','巳':'东南偏南','午':'正南','未':'西南偏南','申':'西南偏西','酉':'正西','戌':'西北偏西','亥':'西北偏北' }
    const taohuaDir = taohuaMap[dayZhi] || '正南'
    const xishenDir = daily.fangwei.xishen.fangwei

    // 天喜日判断（日支与月建六合）
    const LIUHE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' }
    const monthZhi = (daily.ganzhi.monthPillar || '').slice(-1)
    const isTianxiDay = LIUHE[dayZhi] === monthZhi

    const score = calcTaohuaScore(daily.yiji.jianchu, taohuaDir, xishenDir, isTianxiDay, daily.yiji)
    const practical = buildPracticalGuide(wuxing, taohuaDir, daily.yiji, xishenDir, zodiac, daily.yiji.jianchu, score)

    return {
      success: true,
      data: {
        daily,
        practical,
        score,
        input: { zodiac: zodiac || '', sign: sign || '' },
      },
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}
