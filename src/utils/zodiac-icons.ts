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
