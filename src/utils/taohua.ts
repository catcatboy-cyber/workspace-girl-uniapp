// ============================================================
// 命理桃花 — 前端静态查表工具层
// 端口自 KIMI项目2命理 Python 引擎的核心算法
// 这些是纯查表运算，不依赖日历，结果终身不变
//
// 对应 Python 文件：
//   rules/taohua.py — 咸池桃花、红鸾天喜
//   rules/xingzuo.py — 星座双维度
//   data/signs.json — 星座知识数据
// ============================================================

// ── MBTI 性格类型选项 ──
export const MBTI_OPTIONS: string[] = [
  '', 'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
]

// ── TA 身份标签（Crush identityLabel） ──
export const IDENTITY_LABEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '请选择' },
  { value: 'ex', label: '前男友/前女友' },
  { value: 'crush_secret', label: '暗恋对象' },
  { value: 'classmate', label: '同学' },
  { value: 'colleague', label: '同事' },
  { value: 'online_friend', label: '网友' },
  { value: 'arranged', label: '相亲对象' },
  { value: '__custom__', label: '自定义' },
]

/** 解析 identityLabel → 中文展示文本 */
export function resolveIdentityLabel(profile: { identityLabel?: string; identityLabelCustom?: string } | null | undefined): string {
  if (!profile) return ''
  const map: Record<string, string> = {
    'ex': '前男友/前女友',
    'crush_secret': '暗恋对象',
    'classmate': '同学',
    'colleague': '同事',
    'online_friend': '网友',
    'arranged': '相亲对象',
  }
  const label = profile.identityLabel || ''
  if (label === '__custom__') {
    return String(profile.identityLabelCustom || '').trim().slice(0, 20) || '自定义'
  }
  return map[label] || ''
}

// ── 十二生肖 ↔ 地支 ──
export const ZODIAC_TO_ZHI: Record<string, string> = {
  '鼠': '子', '牛': '丑', '虎': '寅', '兔': '卯',
  '龙': '辰', '蛇': '巳', '马': '午', '羊': '未',
  '猴': '申', '鸡': '酉', '狗': '戌', '猪': '亥',
}

export const ZHI_TO_ZODIAC: Record<string, string> = {}
Object.entries(ZODIAC_TO_ZHI).forEach(([k, v]) => { ZHI_TO_ZODIAC[v] = k })

// ── 地支 → 方位 ──
const ZHI_TO_DIRECTION: Record<string, string> = {
  '子': '正北', '丑': '东北偏北', '寅': '东北偏东',
  '卯': '正东', '辰': '东南偏东', '巳': '东南偏南',
  '午': '正南', '未': '西南偏南', '申': '西南偏西',
  '酉': '正西', '戌': '西北偏西', '亥': '西北偏北',
}

export function getZhiDirection(zhi: string): string {
  return ZHI_TO_DIRECTION[zhi] || ''
}

const DIRECTION_DESC: Record<string, string> = {
  '正北': '子位属水，适合摆放水元素（如鱼缸、黑色饰品）催旺桃花。',
  '正东': '卯位属木，适合摆放绿植、木质饰品催旺桃花。',
  '正南': '午位属火，适合红色饰品、灯光等火元素催旺桃花。',
  '正西': '酉位属金，适合金属饰品、白色系装饰催旺桃花。',
  '东北偏北': '丑位属土，适合黄色/棕色系装饰。',
  '东北偏东': '寅位属木，适合绿植或木质摆件。',
  '东南偏东': '辰位属土，适合陶器、黄水晶。',
  '东南偏南': '巳位属火，适合红色元素或灯具。',
  '西南偏南': '未位属土，适合黄水晶、陶器。',
  '西南偏西': '申位属金，适合金属饰品、白水晶。',
  '西北偏西': '戌位属土，适合黄水晶。',
  '西北偏北': '亥位属水，适合水元素、黑色饰品。',
}

// ── 三合局 —《三命通会》"寅午戌见卯，巳酉丑见午，申子辰见酉，亥卯未见子" ──
const SANHE_JU: Record<string, { zhi_set: string[]; wuxing: string; changsheng: string; taohua: string }> = {}

const _sanhe_config: Array<{ zhi_set: string[]; wuxing: string; changsheng: string; taohua: string }> = [
  { zhi_set: ['寅', '午', '戌'], wuxing: '火', changsheng: '寅', taohua: '卯' },
  { zhi_set: ['巳', '酉', '丑'], wuxing: '金', changsheng: '巳', taohua: '午' },
  { zhi_set: ['申', '子', '辰'], wuxing: '水', changsheng: '申', taohua: '酉' },
  { zhi_set: ['亥', '卯', '未'], wuxing: '木', changsheng: '亥', taohua: '子' },
]

_sanhe_config.forEach(cfg => {
  cfg.zhi_set.forEach(z => {
    SANHE_JU[z] = cfg
  })
})

// ── 六合 / 六冲 ──
const LIUHE: Record<string, string> = {
  '子': '丑', '丑': '子', '寅': '亥', '亥': '寅',
  '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰',
  '巳': '申', '申': '巳', '午': '未', '未': '午',
}

const LIUCHONG: Record<string, string> = {
  '子': '午', '午': '子', '丑': '未', '未': '丑',
  '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳',
}

function _sanheMembers(zhi: string): string[] {
  const m: Record<string, string[]> = {
    '申': ['子', '辰'], '子': ['申', '辰'], '辰': ['申', '子'],
    '亥': ['卯', '未'], '卯': ['亥', '未'], '未': ['亥', '卯'],
    '寅': ['午', '戌'], '午': ['寅', '戌'], '戌': ['寅', '午'],
    '巳': ['酉', '丑'], '酉': ['巳', '丑'], '丑': ['巳', '酉'],
  }
  return m[zhi] || []
}

// ── 红鸾天喜查表 —《三命通会》"卯起红鸾逆数通，欲知天喜是相冲" ──
const HONGLUAN_TABLE: Record<string, string> = {
  '子': '卯', '丑': '寅', '寅': '丑', '卯': '子',
  '辰': '亥', '巳': '戌', '午': '酉', '未': '申',
  '申': '未', '酉': '午', '戌': '巳', '亥': '辰',
}

// ── 催旺建议（五行 → 物品映射） ──
const CUIWANG_TIPS: Record<string, string> = {
  '子': '摆放鱼缸、黑色水晶、流水摆件等水元素催旺。',
  '卯': '摆放新鲜绿植、木质桃花符、绿色饰品等木元素催旺。',
  '午': '点红色蜡烛、红色水晶、暖色灯光等火元素催旺。',
  '酉': '摆放金属饰品、白水晶、镜子等金元素催旺。',
  '丑': '摆放黄水晶、陶瓷花瓶、棕色装饰等土元素催旺。',
  '寅': '摆放绿植、木质饰品、文昌塔等木元素催旺。',
  '辰': '摆放黄水晶、龙形摆件、陶瓷等土元素催旺。',
  '巳': '红色饰品、紫色水晶、柔和灯光等火元素催旺。',
  '未': '摆放黄水晶、羊形摆件、陶器等土元素催旺。',
  '申': '金属饰品、白水晶、圆形摆件等金元素催旺。',
  '戌': '黄水晶、狗形摆件、棕色饰品等土元素催旺。',
  '亥': '鱼缸、黑色饰品、水景摆件等水元素催旺。',
}

// ================================================================
// 导出类型
// ================================================================

export interface TaohuaResult {
  rule: string
  principle: string
  sanhe_ju: string[]
  wuxing: string
  taohua_zhi: string
  taohua_zodiac: string
  direction: string
  direction_desc: string
  taohua_type: string
  taohua_quality: string
}

export interface HongluanTianxiResult {
  rule: string
  hongluan: {
    zhi: string
    zodiac: string
    direction: string
    direction_desc: string
    meaning: string
    cuiwang: string
  }
  tianxi: {
    zhi: string
    zodiac: string
    direction: string
    direction_desc: string
    meaning: string
    cuiwang: string
  }
  summary: string
}

export interface SignChineseData {
  cizodiac: string
  zhi: string
  wuxing: string
  yinyang: string
  gong: string
  jieqi_range: string
  date_approx: string
  calendar: string
  character: string
}

export interface SignWesternData {
  planet: string
  element: string
  mode: string
  date_range: string
  calendar: string
  personality: string
  classical_note: string
  best_match: string[]
  best_match_reason: string
}

export interface CrossMatchResult {
  zodiac: string
  zodiacZhi: string
  sign: string
  chinese: {
    name: string
    zhi: string
    gong: string
    wuxing: string
    yinyang: string
    character: string
    jieqiRange: string
    dateApprox: string
    calendar: string
    source: string
  }
  relation: string
  relationDesc: string
  western: {
    planet: string
    element: string
    mode: string
    personality: string
    dateRange: string
    calendar: string
    classicalNote: string
    source: string
    bestMatch: string[]
    bestMatchReason: string
  }
  directionZodiac: string
  directionSign: string
}

export interface PairZodiacMatchResult {
  self: {
    zodiac: string
    zhi: string
    sign?: string
  }
  partner: {
    zodiac: string
    zhi: string
    sign?: string
  }
  relation: string
  relationDesc: string
  signRelation?: string
  signRelationDesc?: string
  combinedRelation: string
  combinedRelationDesc: string
}

// ================================================================
// 1. 咸池桃花算法
// ================================================================

export function xianchiAlgorithm(zhi: string): TaohuaResult {
  const sanhe = SANHE_JU[zhi]
  if (!sanhe) throw new Error(`未知地支: ${zhi}`)

  const taohuaZhi = sanhe.taohua
  const sanheMembers = sanhe.zhi_set.map(z => ZHI_TO_ZODIAC[z] || z)
  const direction = ZHI_TO_DIRECTION[taohuaZhi]
  const directionDesc = DIRECTION_DESC[direction] || ''

  return {
    rule: '咸池桃花（《三命通会》）',
    principle: `${zhi}属${sanhe.wuxing}，长生在${sanhe.changsheng}，沐浴在${taohuaZhi}（即桃花位）`,
    sanhe_ju: sanheMembers,
    wuxing: sanhe.wuxing,
    taohua_zhi: taohuaZhi,
    taohua_zodiac: ZHI_TO_ZODIAC[taohuaZhi] || taohuaZhi,
    direction,
    direction_desc: directionDesc,
    taohua_type: '咸池桃花位',
    taohua_quality:
      `年支桃花为"墙内桃花"（《三命通会》），主天性浪漫、夫妻恩爱。` +
      '若大运或流年行至桃花位，感情机缘增强，需注意把握分寸。',
  }
}

export function zodiacToTaohua(zodiac: string): TaohuaResult {
  const zhi = ZODIAC_TO_ZHI[zodiac]
  if (!zhi) throw new Error(`未知生肖: ${zodiac}`)
  return xianchiAlgorithm(zhi)
}

// ================================================================
// 2. 红鸾天喜算法
// ================================================================

export function hongluanTianxi(zodiacOrZhi: string): HongluanTianxiResult {
  let zhi = ZODIAC_TO_ZHI[zodiacOrZhi]
  if (!zhi) zhi = zodiacOrZhi // 允许直接传地支
  if (!HONGLUAN_TABLE[zhi]) throw new Error(`无法识别: ${zodiacOrZhi}`)

  const hongluanZhi = HONGLUAN_TABLE[zhi]
  const tianxiZhi = LIUCHONG[hongluanZhi]
  if (!tianxiZhi) throw new Error('天喜推算失败')

  const hDir = ZHI_TO_DIRECTION[hongluanZhi]
  const tDir = ZHI_TO_DIRECTION[tianxiZhi]
  const baseHL = CUIWANG_TIPS[hongluanZhi] || '放置粉色水晶球、鸳鸯摆件等催旺。'
  const baseTX = CUIWANG_TIPS[tianxiZhi] || '放置粉色水晶球、鸳鸯摆件等催旺。'

  return {
    rule: '红鸾天喜（《三命通会》）',
    hongluan: {
      zhi: hongluanZhi,
      zodiac: ZHI_TO_ZODIAC[hongluanZhi] || hongluanZhi,
      direction: hDir,
      direction_desc: DIRECTION_DESC[hDir] || '',
      meaning: '主姻缘开端、恋爱机遇、婚讯。红鸾星动之年宜求婚、订婚、相亲。',
      cuiwang: `红鸾催旺：${baseHL}建议在此方位放置粉水晶球或双鱼图，增强恋爱机缘。`,
    },
    tianxi: {
      zhi: tianxiZhi,
      zodiac: ZHI_TO_ZODIAC[tianxiZhi] || tianxiZhi,
      direction: tDir,
      direction_desc: DIRECTION_DESC[tDir] || '',
      meaning: '主婚姻稳固、添丁进口、喜庆落地。天喜照命之年宜结婚、生育。',
      cuiwang: `天喜催旺：${baseTX}建议在此方位点红色香薰或放置麒麟摆件，催旺婚庆之喜。`,
    },
    summary: `${zodiacOrZhi}命：红鸾在${hongluanZhi}方（${hDir}），天喜在${tianxiZhi}方（${tDir}）。红鸾为因（桃花初萌），天喜为果（姻缘结果），阴阳互补。`,
  }
}

// ================================================================
// 3. 星座双维度数据（从 Python data/signs.json 端口）
// ================================================================

const SIGN_DUAL: Record<string, { chinese: SignChineseData; western: SignWesternData }> = {
  '白羊座': {
    chinese: {
      cizodiac: '降娄', zhi: '戌', wuxing: '土', yinyang: '阳', gong: '戌宫',
      jieqi_range: '惊蛰 → 清明', date_approx: '约3月6日 – 4月5日',
      calendar: '农历节气（太阳黄经345°→15°）',
      character: '戌为火库，厚重诚实，刚毅果敢。降娄者降下而娄敛，具行动力与奉献精神。地支属土，藏戊辛丁，外刚内柔。',
    },
    western: {
      planet: '火星', element: '火', mode: '创始（Cardinal，二至星座）',
      date_range: '3月21日 – 4月19日', calendar: '公历（热带黄道，太阳黄经0°→30°）',
      personality: '冲动热烈型——一见钟情、快速来电，但也容易三分钟热度',
      classical_note: '『适合人群交往、喜好荣誉、高贵活跃、善于推测』（《Tetrabiblos》III.13，二至星座共性）',
      best_match: ['狮子座', '射手座', '双子座'],
      best_match_reason: '同火象三合（狮/射）+ 风象六合（双子）',
    },
  },
  '金牛座': {
    chinese: {
      cizodiac: '大梁', zhi: '酉', wuxing: '金', yinyang: '阴', gong: '酉宫',
      jieqi_range: '清明 → 立夏', date_approx: '约4月5日 – 5月6日',
      calendar: '农历节气（太阳黄经15°→45°）',
      character: '酉为金之正位，精致锐利，善于规划。大梁者强梁积蓄，成熟稳重。地支属金，藏辛金，纯粹专注。',
    },
    western: {
      planet: '金星', element: '土', mode: '固定（Fixed，固定星座）',
      date_range: '4月20日 – 5月20日', calendar: '公历（热带黄道，太阳黄经30°→60°）',
      personality: '慢热稳重型——日久生情、注重物质安全感，感情持久',
      classical_note: '『公正、不受奉承影响、持久坚定、明智耐心、不妥协』（《Tetrabiblos》III.13，固定星座共性）',
      best_match: ['处女座', '摩羯座', '巨蟹座'],
      best_match_reason: '同土象三合（处/羯）+ 水象六合（巨蟹）',
    },
  },
  '双子座': {
    chinese: {
      cizodiac: '实沈', zhi: '申', wuxing: '金', yinyang: '阳', gong: '申宫',
      jieqi_range: '立夏 → 芒种', date_approx: '约5月6日 – 6月6日',
      calendar: '农历节气（太阳黄经45°→75°）',
      character: '申为金之偏位，灵活善变，机智多变。实沈者伸张舒展，善随机应变。地支属金，藏庚壬戊，刚柔并济。',
    },
    western: {
      planet: '水星', element: '风', mode: '变动（Mutable，双体星座）',
      date_range: '5月21日 – 6月21日', calendar: '公历（热带黄道，太阳黄经60°→90°）',
      personality: '灵动多变型——口才魅力吸引、朋友变恋人概率高',
      classical_note: '『复杂多变、难以捉摸、多情、多才多艺、易改变心意』（《Tetrabiblos》III.13，双体星座共性）',
      best_match: ['天秤座', '水瓶座', '白羊座'],
      best_match_reason: '同风象三合（秤/瓶）+ 火象六合（白羊）',
    },
  },
  '巨蟹座': {
    chinese: {
      cizodiac: '鹑首', zhi: '未', wuxing: '土', yinyang: '阴', gong: '未宫',
      jieqi_range: '芒种 → 小暑', date_approx: '约6月6日 – 7月7日',
      calendar: '农历节气（太阳黄经75°→105°）',
      character: '未为木库，温和包容，沉稳内敛。鹑首者宁静致远，善解人意。地支属土，藏己丁乙，外柔内秀。',
    },
    western: {
      planet: '月亮', element: '水', mode: '创始（Cardinal，二至星座）',
      date_range: '6月22日 – 7月22日', calendar: '公历（热带黄道，太阳黄经90°→120°）',
      personality: '温柔细腻型——家庭感召力、母性魅力，容易在照顾中产生感情',
      classical_note: '『适合人群交往、喜好荣誉、高贵活跃、善于推测』（《Tetrabiblos》III.13，二至星座共性）',
      best_match: ['天蝎座', '双鱼座', '金牛座'],
      best_match_reason: '同水象三合（蝎/鱼）+ 土象六合（金牛）',
    },
  },
  '狮子座': {
    chinese: {
      cizodiac: '鹑火', zhi: '午', wuxing: '火', yinyang: '阳', gong: '午宫',
      jieqi_range: '小暑 → 立秋', date_approx: '约7月7日 – 8月7日',
      calendar: '农历节气（太阳黄经105°→135°）',
      character: '午为火之正位，光明热烈，热情坦率。鹑火者不死鸟之心，具燃烧生命力与领导气质。地支属火，藏丁己，外放内明。',
    },
    western: {
      planet: '太阳', element: '火', mode: '固定（Fixed，固定星座）',
      date_range: '7月23日 – 8月22日', calendar: '公历（热带黄道，太阳黄经120°→150°）',
      personality: '光芒万丈型——舞台中央的吸引力，热情大方，桃花主动找上门',
      classical_note: '『公正、不受奉承影响、持久坚定、明智耐心、不妥协』（《Tetrabiblos》III.13，固定星座共性）',
      best_match: ['白羊座', '射手座', '天秤座'],
      best_match_reason: '同火象三合（羊/射）+ 风象六合（天秤）',
    },
  },
  '处女座': {
    chinese: {
      cizodiac: '鹑尾', zhi: '巳', wuxing: '火', yinyang: '阴', gong: '巳宫',
      jieqi_range: '立秋 → 白露', date_approx: '约8月7日 – 9月8日',
      calendar: '农历节气（太阳黄经135°→165°）',
      character: '巳为火之偏位，热情细腻，精于细节。鹑尾者收束整理，善分析归纳。地支属火，藏丙戊庚，外热内刚。',
    },
    western: {
      planet: '水星', element: '土', mode: '变动（Mutable，双体星座）',
      date_range: '8月23日 – 9月22日', calendar: '公历（热带黄道，太阳黄经150°→180°）',
      personality: '细致周到型——用细节打动人，服务型付出，日久见人心',
      classical_note: '『复杂多变、难以捉摸、多情、多才多艺、易改变心意』（《Tetrabiblos》III.13，双体星座共性）',
      best_match: ['金牛座', '摩羯座', '天蝎座'],
      best_match_reason: '同土象三合（牛/羯）+ 水象六合（天蝎）',
    },
  },
  '天秤座': {
    chinese: {
      cizodiac: '寿星', zhi: '辰', wuxing: '土', yinyang: '阳', gong: '辰宫',
      jieqi_range: '白露 → 寒露', date_approx: '约9月8日 – 10月8日',
      calendar: '农历节气（太阳黄经165°→195°）',
      character: '辰为水库，包容和谐，善于平衡。寿星者福寿绵长，优雅从容。地支属土，藏戊乙癸，外圆内方。',
    },
    western: {
      planet: '金星', element: '风', mode: '创始（Cardinal，二至星座）',
      date_range: '9月23日 – 10月23日', calendar: '公历（热带黄道，太阳黄经180°→210°）',
      personality: '优雅社交型——天生外交家，颜值魅力，容易在社交场合遇正缘',
      classical_note: '『适合人群交往、喜好荣誉、高贵活跃、善于推测』（《Tetrabiblos》III.13，二至星座共性）',
      best_match: ['双子座', '水瓶座', '狮子座'],
      best_match_reason: '同风象三合（双/瓶）+ 火象六合（狮子）',
    },
  },
  '天蝎座': {
    chinese: {
      cizodiac: '大火', zhi: '卯', wuxing: '木', yinyang: '阴', gong: '卯宫',
      jieqi_range: '寒露 → 立冬', date_approx: '约10月8日 – 11月7日',
      calendar: '农历节气（太阳黄经195°→225°）',
      character: '卯为木之正位，柔美深沉，情感浓烈。大火者心宿之光，具神秘吸引力与深度洞察。地支属木，藏乙木，纯粹情深。',
    },
    western: {
      planet: '火星', element: '水', mode: '固定（Fixed，固定星座）',
      date_range: '10月24日 – 11月22日', calendar: '公历（热带黄道，太阳黄经210°→240°）',
      personality: '深度魅惑型——神秘吸引力，一眼万年，感情浓度极高',
      classical_note: '『公正、不受奉承影响、持久坚定、明智耐心、不妥协』（《Tetrabiblos》III.13，固定星座共性）',
      best_match: ['巨蟹座', '双鱼座', '处女座'],
      best_match_reason: '同水象三合（蟹/鱼）+ 土象六合（处女）',
    },
  },
  '射手座': {
    chinese: {
      cizodiac: '析木', zhi: '寅', wuxing: '木', yinyang: '阳', gong: '寅宫',
      jieqi_range: '立冬 → 大雪', date_approx: '约11月7日 – 12月7日',
      calendar: '农历节气（太阳黄经225°→255°）',
      character: '寅为木之偏位，生机勃发，自由奔放。析木者解析万物，胸怀广阔。地支属木，藏甲丙戊，外放内明。',
    },
    western: {
      planet: '木星', element: '火', mode: '变动（Mutable，双体星座）',
      date_range: '11月23日 – 12月21日', calendar: '公历（热带黄道，太阳黄经240°→270°）',
      personality: '自由奔放型——异国/异地恋多发，旅行中邂逅正缘',
      classical_note: '『复杂多变、难以捉摸、多情、多才多艺、易改变心意』（《Tetrabiblos》III.13，双体星座共性）',
      best_match: ['白羊座', '狮子座', '水瓶座'],
      best_match_reason: '同火象三合（羊/狮）+ 风象六合（水瓶）',
    },
  },
  '摩羯座': {
    chinese: {
      cizodiac: '星纪', zhi: '丑', wuxing: '土', yinyang: '阴', gong: '丑宫',
      jieqi_range: '大雪 → 小寒', date_approx: '约12月7日 – 1月6日',
      calendar: '农历节气（太阳黄经255°→285°）',
      character: '丑为金库，坚韧不拔，踏实稳重。星纪者星之纪纲，十二次之起点，具责任感与持久力。地支属土，藏己癸辛，内敛深厚。',
    },
    western: {
      planet: '土星', element: '土', mode: '创始（Cardinal，二至星座）',
      date_range: '12月22日 – 1月19日', calendar: '公历（热带黄道，太阳黄经270°→300°）',
      personality: '事业型桃花——职场中遇正缘，事业合作伙伴变人生伴侣',
      classical_note: '『适合人群交往、喜好荣誉、高贵活跃、善于推测』（《Tetrabiblos》III.13，二至星座共性）',
      best_match: ['金牛座', '处女座', '双鱼座'],
      best_match_reason: '同土象三合（牛/处）+ 水象六合（双鱼）',
    },
  },
  '水瓶座': {
    chinese: {
      cizodiac: '玄枵', zhi: '子', wuxing: '水', yinyang: '阳', gong: '子宫',
      jieqi_range: '小寒 → 立春', date_approx: '约1月6日 – 2月4日',
      calendar: '农历节气（太阳黄经285°→315°）',
      character: '子为水之正位，智慧灵动，独立独行。玄枵者玄妙虚空，具开创性与独特思维。地支属水，藏癸水，纯粹深邃。',
    },
    western: {
      planet: '土星', element: '风', mode: '固定（Fixed，固定星座）',
      date_range: '1月20日 – 2月18日', calendar: '公历（热带黄道，太阳黄经300°→330°）',
      personality: '独特另类型——灵魂伴侣型，精神共鸣先于生理吸引',
      classical_note: '『公正、不受奉承影响、持久坚定、明智耐心、不妥协』（《Tetrabiblos》III.13，固定星座共性）',
      best_match: ['双子座', '天秤座', '射手座'],
      best_match_reason: '同风象三合（双/秤）+ 火象六合（射手）',
    },
  },
  '双鱼座': {
    chinese: {
      cizodiac: '娵訾', zhi: '亥', wuxing: '水', yinyang: '阴', gong: '亥宫',
      jieqi_range: '立春 → 惊蛰', date_approx: '约2月4日 – 3月6日',
      calendar: '农历节气（太阳黄经315°→345°）',
      character: '亥为水之偏位，深邃浪漫，感应敏锐。娵訾者聚核含仁，具梦幻气质与包容力。地支属水，藏壬甲，外柔内深。',
    },
    western: {
      planet: '木星', element: '水', mode: '变动（Mutable，双体星座）',
      date_range: '2月19日 – 3月20日', calendar: '公历（热带黄道，太阳黄经330°→360°）',
      personality: '梦幻浪漫型——自带滤镜，容易有宿命感恋情，感性至上',
      classical_note: '『复杂多变、难以捉摸、多情、多才多艺、易改变心意』（《Tetrabiblos》III.13，双体星座共性）',
      best_match: ['巨蟹座', '天蝎座', '摩羯座'],
      best_match_reason: '同水象三合（蟹/蝎）+ 土象六合（摩羯）',
    },
  },
}

// ================================================================
// 4. 星座双维度查询
// ================================================================

export function getSignDualData(sign: string): { chinese: SignChineseData; western: SignWesternData } | null {
  // 精确匹配
  if (SIGN_DUAL[sign]) return SIGN_DUAL[sign]
  // 模糊匹配
  for (const k of Object.keys(SIGN_DUAL)) {
    if (sign.includes(k) || k.startsWith(sign)) return SIGN_DUAL[k]
  }
  return null
}

// ================================================================
// 5. 属相 × 星座 交叉匹配分析
// ================================================================

export function zodiacSignMatch(zodiac: string, sign: string): CrossMatchResult {
  const zhi = ZODIAC_TO_ZHI[zodiac]
  const signData = getSignDualData(sign)
  if (!zhi) throw new Error(`未知生肖: ${zodiac}`)
  if (!signData) throw new Error(`未知星座: ${sign}`)

  const signZhi = signData.chinese.zhi

  // 地支关系
  let relation = '平'
  let relationDesc = ''
  if (signZhi === zhi) {
    relation = '同宫'
    relationDesc = '星次地支与生肖地支完全一致（同宫），个性强烈纯粹，桃花气质鲜明，但容易走极端。'
  } else if (LIUHE[zhi] === signZhi) {
    relation = '六合（大吉）'
    relationDesc = '生肖地支与星座地支六合，阴阳互补，能量完美融合，为"天作之合"。'
  } else if (_sanheMembers(zhi).includes(signZhi)) {
    relation = '三合（吉利）'
    relationDesc = '生肖地支与星座地支同属三合局，五行能量相互助力，桃花运有基础。'
  } else if (LIUCHONG[zhi] === signZhi) {
    relation = '六冲（冲突）'
    relationDesc = '生肖地支与星座地支六冲，能量对冲。桃花来得猛烈但波动大，需谨慎处理。'
  } else {
    relationDesc = '生肖地支与星座地支无特殊关系，能量独立运行，属正常范畴。'
  }

  return {
    zodiac,
    zodiacZhi: zhi,
    sign: sign,
    chinese: {
      name: signData.chinese.cizodiac,
      zhi: signData.chinese.zhi,
      gong: signData.chinese.gong,
      wuxing: signData.chinese.wuxing,
      yinyang: signData.chinese.yinyang,
      character: signData.chinese.character,
      jieqiRange: signData.chinese.jieqi_range,
      dateApprox: signData.chinese.date_approx,
      calendar: '农历节气（太阳黄经，每年微调±1天）',
      source: '《汉书·律历志》十二次 +《果老星宗》七政四余十二宫框架',
    },
    relation,
    relationDesc,
    western: {
      planet: signData.western.planet,
      element: signData.western.element,
      mode: signData.western.mode,
      personality: signData.western.personality,
      dateRange: signData.western.date_range,
      calendar: signData.western.calendar,
      classicalNote: signData.western.classical_note,
      source: 'Ptolemy《Tetrabiblos》（《占星四书》）Book I + Book III',
      bestMatch: signData.western.best_match,
      bestMatchReason: signData.western.best_match_reason,
    },
    directionZodiac: ZHI_TO_DIRECTION[zhi] || '',
    directionSign: ZHI_TO_DIRECTION[signZhi] || '',
  }
}

// ================================================================
// 6. 双方生肖地支匹配
// ================================================================

function getWesternElement(sign: string): string {
  return getSignDualData(sign)?.western.element || ''
}

function getWesternMode(sign: string): string {
  return getSignDualData(sign)?.western.mode || ''
}

function getSignPairRelation(selfSign = '', partnerSign = ''): { relation?: string; relationDesc?: string } {
  if (!selfSign || !partnerSign) return {}
  const selfElement = getWesternElement(selfSign)
  const partnerElement = getWesternElement(partnerSign)
  if (!selfElement || !partnerElement) return {}

  const sameMode = getWesternMode(selfSign) && getWesternMode(selfSign) === getWesternMode(partnerSign)
  if (selfSign === partnerSign) {
    return {
      relation: '星座同频',
      relationDesc: '你们太阳星座相同，表达方式和情绪节奏更容易互相看懂，但也容易把同一种优缺点同时放大。',
    }
  }
  if (selfElement === partnerElement) {
    return {
      relation: `${selfElement}象同频`,
      relationDesc: `你们同属${selfElement}象，亲近方式、兴奋点和安全感来源更接近，天然话题和默契更容易形成。`,
    }
  }

  const pairKey = [selfElement, partnerElement].sort().join('')
  if (pairKey === '火风') {
    return {
      relation: '火风助燃',
      relationDesc: '火象带行动和热度，风象带话题和新鲜感，容易越聊越有火花，但也要避免只升温不落地。',
    }
  }
  if (pairKey === '土水') {
    return {
      relation: '土水滋养',
      relationDesc: '水象给情绪流动，土象给稳定承接，适合慢慢建立信任，但推进速度不宜太急。',
    }
  }
  if (pairKey === '水火') {
    return {
      relation: '水火节奏差',
      relationDesc: '一方更看情绪安全，一方更看即时行动，吸引感不弱，但容易在快慢和表达方式上误会。',
    }
  }
  if (pairKey === '土风') {
    return {
      relation: '风土磨合',
      relationDesc: '风象重自由和变化，土象重确定和稳定，需要把期待说清楚，别让一个觉得被管、一个觉得不安。',
    }
  }
  if (pairKey === '土火') {
    return {
      relation: '火土校准',
      relationDesc: '火象想快速推进，土象更重现实判断，适合把热度变成具体行动，少用情绪催进度。',
    }
  }
  if (pairKey === '水风') {
    return {
      relation: '风水互译',
      relationDesc: '风象偏理性沟通，水象偏情绪感受，需要多确认对方真正的意思，避免一个讲逻辑、一个等共情。',
    }
  }

  return {
    relation: sameMode ? '星座节奏相近' : '星座节奏平衡',
    relationDesc: sameMode
      ? '你们做决定的节奏相近，容易理解彼此的反应模式，但相似节奏也可能让问题一起卡住。'
      : '你们的星座互动没有明显冲突点，关系质量更取决于现实互动和沟通稳定度。',
  }
}

export function zodiacPairMatch(
  selfZodiac: string,
  partnerZodiac: string,
  selfSign = '',
  partnerSign = '',
): PairZodiacMatchResult {
  const selfZhi = ZODIAC_TO_ZHI[selfZodiac]
  const partnerZhi = ZODIAC_TO_ZHI[partnerZodiac]
  if (!selfZhi) throw new Error(`未知生肖: ${selfZodiac}`)
  if (!partnerZhi) throw new Error(`未知生肖: ${partnerZodiac}`)

  let relation = '平'
  let relationDesc = '双方生肖地支无特殊合冲关系，能量独立运行，关系走向更取决于相处质量。'
  if (partnerZhi === selfZhi) {
    relation = '同宫'
    relationDesc = '双方生肖地支相同，个性强烈纯粹，容易互相理解，也容易互相较劲。'
  } else if (LIUHE[selfZhi] === partnerZhi) {
    relation = '六合（大吉）'
    relationDesc = '双方生肖地支六合，阴阳互补，能量容易融合，为较顺的组合。'
  } else if (_sanheMembers(selfZhi).includes(partnerZhi)) {
    relation = '三合（吉利）'
    relationDesc = '双方生肖地支同属三合局，五行能量相互助力，天然默契较强。'
  } else if (LIUCHONG[selfZhi] === partnerZhi) {
    relation = '六冲（冲突）'
    relationDesc = '双方生肖地支六冲，吸引力和波动性都更强，需要更主动地磨合节奏。'
  }
  const signPair = getSignPairRelation(selfSign, partnerSign)
  const combinedRelation = signPair.relation ? `${relation} · ${signPair.relation}` : relation
  const combinedRelationDesc = signPair.relationDesc
    ? `${relationDesc} 星座互动上，${signPair.relationDesc}`
    : relationDesc

  return {
    self: { zodiac: selfZodiac, zhi: selfZhi, sign: selfSign || undefined },
    partner: { zodiac: partnerZodiac, zhi: partnerZhi, sign: partnerSign || undefined },
    relation,
    relationDesc,
    signRelation: signPair.relation,
    signRelationDesc: signPair.relationDesc,
    combinedRelation,
    combinedRelationDesc,
  }
}

// ================================================================
// 7. 工具函数
// ================================================================

/** 获取当日简易日期字符串 */
export function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 所有生肖名 */
export const ZODIAC_NAMES = Object.keys(ZODIAC_TO_ZHI)

/** 所有星座名 */
export const SIGN_NAMES = Object.keys(SIGN_DUAL)

// ================================================================
// 8. 双人解读生成器（Phase B）
// ================================================================

export interface PairInsight {
  styleClash: string      // 风格碰撞
  activities: string[]    // 适合一起做的事
  watchOut: string[]      // 要注意什么
  classicalNote: string   // 古籍依据
}

export function generatePairInsight(
  selfMatch: CrossMatchResult,
  partnerMatch: CrossMatchResult,
  pairMatch?: PairZodiacMatchResult,
): PairInsight {
  const relation = pairMatch?.relation || selfMatch.relation
  const signRelationDesc = pairMatch?.signRelationDesc || ''
  const selfElement = selfMatch.western.element
  const partnerElement = partnerMatch.western.element

  // 风格碰撞
  const styleClashMap: Record<string, string> = {
    '六合（大吉）': '你们天生互补——阴阳完美咬合，彼此的差异恰好填满对方的空缺。这种组合在命理上被称为"天作之合"，不是没有摩擦，而是摩擦之后更容易找到平衡。',
    '三合（吉利）': '你们是同频共振的人——三合局的能量让你们天然互相理解、互相助力。在一起时不需要刻意找话题，舒服自在就是最大的默契。',
    '六冲（冲突）': '你们是"火星撞地球"的组合——吸引力极强，冲突也极强。六冲的关系像过山车，激情四射但也容易翻车。如果能磨合好，反而是最刻骨铭心的关系。',
    '同宫': '你们太像了——个性强烈而纯粹，互相懂得但也容易互相较劲。像照镜子，优点放大，缺点也放大。需要学会给彼此空间。',
    '平': '你们是稳扎稳打的组合——没有天生的buff也没有天然的障碍，一切取决于你们的经营和用心。这种关系最真实，也最有成长空间。',
  }
  const baseStyleClash = styleClashMap[relation]
    || '你们的组合属于中规中矩——没有天生的buff也没有天然的障碍，一切都取决于彼此的用心经营。'
  const styleClash = signRelationDesc
    ? `${baseStyleClash} 星座层面，${signRelationDesc}`
    : baseStyleClash

  // 适合一起做的事
  const activities: string[] = []
  const elements = [selfElement, partnerElement]
  if (elements.includes('火')) activities.push('一起运动、看演出、去热闹的地方')
  if (elements.includes('水')) activities.push('安静的深度约会、海边湖边散步、一起看电影')
  if (elements.includes('风')) activities.push('一起旅行、逛展览、聊哲学人生')
  if (elements.includes('土')) activities.push('一起做饭、逛超市、打理家居')

  if (relation.includes('六合')) activities.push('任何事——六合的默契让做什么都愉快')
  if (relation.includes('三合')) activities.push('一起去探索新事物，你们的节奏天然合拍')
  if (relation.includes('冲')) activities.push('需要刺激性活动来释放张力——密室逃脱、攀岩、竞技运动')

  // 要注意什么
  const watchOut: string[] = []
  if (relation.includes('冲')) {
    watchOut.push('情绪爆发时别互相伤害——冷静24小时再谈')
    watchOut.push('不要在小事上争对错，六冲容易把小事放大')
  }
  if (relation.includes('六合')) {
    watchOut.push('太合拍了反而容易忽视问题——定期坦诚交流')
  }
  if (relation.includes('三合')) {
    watchOut.push('舒适区太舒服可能导致关系停滞——偶尔给点新鲜感')
  }
  if (selfElement === '火' && partnerElement === '水') watchOut.push('她的感性和你的冲动需要互相适应——她需要安全感，你需要自由')
  if (selfElement === '水' && partnerElement === '火') watchOut.push('你的细腻和她的热烈需要节奏磨合——别催她，也别说他慢')
  if (selfElement === '风' && partnerElement === '土') watchOut.push('你爱自由她求安稳——约好"你的冒险时间"和"我们的安静时光"')
  if (selfElement === '土' && partnerElement === '风') watchOut.push('别嫌她飘忽不定——她的灵活正是你需要的调味剂')

  // 古籍依据
  const classicalNoteMap: Record<string, string> = {
    '六合（大吉）': '《三命通会》：地支六合，阴阳互补，能量完美融合，为天作之合。',
    '三合（吉利）': '《三命通会》：地支三合局成员，五行能量相互助力，相互促进。',
    '六冲（冲突）': '《三命通会》：地支六冲，能量对冲，激情与波动并存，需双方用心经营。',
    '同宫': '地支相同（同宫），个性强烈纯粹，优势劣势皆放大，需互补空间。',
    '平': '地支无特殊关系，能量独立运行，属于正常组合。',
  }
  const classicalNote = classicalNoteMap[relation] || '地支无特殊关系，能量独立运行。'

  return { styleClash, activities, watchOut: watchOut.length ? watchOut : ['顺其自然，真诚相待最重要'], classicalNote }
}

export interface PairMatchPayload {
  self: {
    zodiac: string
    sign: string
  }
  partner: {
    zodiac: string
    sign: string
  }
  match: PairZodiacMatchResult
  insight: PairInsight
  partnerStyle: string
}

export function buildPairMatchPayload(
  selfZodiac: string,
  selfSign: string,
  partnerZodiac: string,
  partnerSign: string,
): PairMatchPayload {
  const selfMatch = zodiacSignMatch(selfZodiac, selfSign)
  const partnerMatch = zodiacSignMatch(partnerZodiac, partnerSign)
  const match = zodiacPairMatch(selfZodiac, partnerZodiac, selfSign, partnerSign)
  const insight = generatePairInsight(selfMatch, partnerMatch, match)
  return {
    self: { zodiac: selfZodiac, sign: selfSign },
    partner: { zodiac: partnerZodiac, sign: partnerSign },
    match,
    insight,
    partnerStyle: partnerMatch.western.personality,
  }
}

/** 标准化云函数返回的行动指南数据，供首页和命理桃花页面共享 */
export function normalizeActionGuideData(practical: Record<string, any>) {
  const guide = practical?.约会指南 || {}
  const wear = practical?.穿戴建议 || {}
  return {
    venue: guide.场所建议 || '',
    venueActivities: (guide.建议活动 || []) as string[],
    doList: (guide.宜做 || []) as string[],
    dontList: (guide.避开 || []) as string[],
    aura: guide.今日气场 || '',
    guideSummary: guide.解读 || '',
    oneliner: guide.一句话 || '',
    isLow: Boolean(guide.isLow),
    liuheDir: guide.六合方位 || '',
    liuheDay: Boolean(guide.六合助缘),
    wearColors: (wear.桃花颜色 || []) as string[],
    wearMaterial: wear.桃花材质 || '',
    wearHighlight: wear.桃花点睛 || '',
    wearOneLiner: wear.一句话 || '',
    taohuaWuxing: wear.桃花五行 || '',
    benmingWuxing: wear.本命五行 || '',
    fiveElementRelation: wear.五行关系 || '',
  }
}

