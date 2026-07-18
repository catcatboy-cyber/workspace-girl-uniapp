// 生肖/星座 → SVG 图标路径（Twemoji）
const BASE = '/static/icons/taohua';

export const ZODIAC_SVG: Record<string, string> = {
  '鼠': BASE + '/zodiac-rat.svg',
  '牛': BASE + '/zodiac-ox.svg',
  '虎': BASE + '/zodiac-tiger.svg',
  '兔': BASE + '/zodiac-rabbit.svg',
  '龙': BASE + '/zodiac-dragon.svg',
  '蛇': BASE + '/zodiac-snake.svg',
  '马': BASE + '/zodiac-horse.svg',
  '羊': BASE + '/zodiac-goat.svg',
  '猴': BASE + '/zodiac-monkey.svg',
  '鸡': BASE + '/zodiac-rooster.svg',
  '狗': BASE + '/zodiac-dog.svg',
  '猪': BASE + '/zodiac-pig.svg',
};

export const CONSTELLATION_SVG: Record<string, string> = {
  '白羊座': BASE + '/aries.svg',
  '金牛座': BASE + '/taurus.svg',
  '双子座': BASE + '/gemini.svg',
  '巨蟹座': BASE + '/cancer.svg',
  '狮子座': BASE + '/leo.svg',
  '处女座': BASE + '/virgo.svg',
  '天秤座': BASE + '/libra.svg',
  '天蝎座': BASE + '/scorpio.svg',
  '射手座': BASE + '/sagittarius.svg',
  '摩羯座': BASE + '/capricorn.svg',
  '水瓶座': BASE + '/aquarius.svg',
  '双鱼座': BASE + '/pisces.svg',
};

export function getZodiacSvg(zodiac: string): string {
  return ZODIAC_SVG[zodiac] || '';
}

export function getConstellationSvg(sign: string): string {
  return CONSTELLATION_SVG[sign] || '';
}


// ── 文本中 emoji → SVG 图标替换 ──
const EMOJI_SVG: Record<string, string> = {
  '➖': BASE + '/minus.svg',
  '⚠️': BASE + '/warning.svg',
  '❄️': BASE + '/snowflake.svg',
  '🔥': BASE + '/fire.svg',
  '🌸': BASE + '/flower.svg',
  '❤️': BASE + '/heart-filled.svg',
  '⭐': BASE + '/star-filled.svg',
  '🔍': BASE + '/search.svg',
  '⚖️': BASE + '/scale.svg',
  '🧭': BASE + '/compass.svg',
  '✎': BASE + '/pencil.svg',
  '🖼': BASE + '/image.svg',
  '🎤': BASE + '/mic.svg',
  '✅': BASE + '/check.svg',
  '❌': BASE + '/cross.svg',
  '📊': BASE + '/chart.svg',
  '📋': BASE + '/clipboard.svg',
  '💡': BASE + '/bulb.svg',
  '💬': BASE + '/bubble.svg',
  '⏳': BASE + '/hourglass.svg',
  '🤖': BASE + '/robot.svg',
  '🪷': BASE + '/lotus.svg',
  '👗': BASE + '/shirt.svg',
  '💎': BASE + '/gem.svg',
  '📍': BASE + '/pin.svg',
  '🌿': BASE + '/leaf.svg',
  '🎯': BASE + '/target.svg',
  '🔔': BASE + '/bell.svg',
  '🔒': BASE + '/lock.svg',
  // queryTaohua 评级/文案 emoji（🔥⚠️❄️ 已在上方）
  '🌤️': BASE + '/sun-cloud.svg',
  '😐': BASE + '/face-neutral.svg',
  '🌧️': BASE + '/rain.svg',
  '✨': BASE + '/sparkles.svg',
  '🌕': BASE + '/moon.svg',
  '⚓': BASE + '/anchor.svg',
  '📝': BASE + '/memo.svg',
  '🔇': BASE + '/mute.svg',
  '🧹': BASE + '/broom.svg',
  '🌱': BASE + '/seedling.svg',
  // insights.js 关系氛围 vibe emoji（部分不带 FE0F 变体选择符，两种写法都映射）
  '🌤': BASE + '/sun-cloud.svg',
  '☁️': BASE + '/cloud.svg',
  '☁': BASE + '/cloud.svg',
  '☀️': BASE + '/sun.svg',
  '☀': BASE + '/sun.svg',
  '⛈️': BASE + '/storm.svg',
  '⛈': BASE + '/storm.svg',
  '🌬️': BASE + '/wind.svg',
  '🌬': BASE + '/wind.svg',
  '📉': BASE + '/chart-down.svg',
}

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'icon'; src: string }

export function parseEmojiText(text: string): TextSegment[] {
  if (!text) return []
  // 按 emoji 最长优先排序
  const emojis = Object.keys(EMOJI_SVG).sort((a, b) => b.length - a.length)
  const segments: TextSegment[] = []
  let remaining = text
  while (remaining.length > 0) {
    let matched = false
    for (const emoji of emojis) {
      if (remaining.startsWith(emoji)) {
        segments.push({ type: 'icon', src: EMOJI_SVG[emoji] })
        remaining = remaining.slice(emoji.length)
        matched = true
        break
      }
    }
    if (!matched) {
      // 找下一个 emoji 出现的位置
      let nextIdx = remaining.length
      for (const emoji of emojis) {
        const idx = remaining.indexOf(emoji)
        if (idx !== -1 && idx < nextIdx) nextIdx = idx
      }
      if (nextIdx > 0) {
        segments.push({ type: 'text', value: remaining.slice(0, nextIdx) })
      }
      remaining = remaining.slice(nextIdx)
    }
  }
  return segments
}
