const relationTypeOptions = [
  { value: 'romantic', label: 'Crush' },
  { value: 'close_friend', label: '亲密朋友' }
]

const genderOptions = ['男', '女', '非二元', '未说明']

const zodiacOptions = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

const constellationOptions = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座'
]

function normalizeRelationType(value) {
  return value === 'close_friend' ? 'close_friend' : 'romantic'
}

function getRelationTypeLabel(value) {
  return value === 'close_friend' ? '亲密朋友' : 'Crush'
}

module.exports = {
  relationTypeOptions,
  genderOptions,
  zodiacOptions,
  constellationOptions,
  normalizeRelationType,
  getRelationTypeLabel
}
