const DIMENSION_SHORT_LABELS: Record<string, string> = {
  initiative: '主动',
  warmth: '温度',
  reliability: '兑现',
  romance: '浪漫',
  boundary: '边界'
}

export function sortCelebrityDimensions(person: any, dimensions: any[]) {
  return [...(dimensions || [])].sort((left, right) => {
    const scoreDiff = Number(person?.profile?.[right.key] || 0) - Number(person?.profile?.[left.key] || 0)
    return scoreDiff || String(left.key).localeCompare(String(right.key), 'en')
  })
}

export function buildCelebrityTypeLabel(person: any, dimensions: any[]) {
  if (person?.typeLabel) return String(person.typeLabel)
  return sortCelebrityDimensions(person, dimensions)
    .slice(0, 2)
    .map((dimension) => DIMENSION_SHORT_LABELS[dimension.key] || dimension.name)
    .join('') + '型'
}

export function buildCelebritySummary(person: any, dimensions: any[], resultCopy: Record<string, any>) {
  if (person?.summary) return String(person.summary)
  const strongest = sortCelebrityDimensions(person, dimensions).slice(0, 2)
  const phrases = strongest.map((dimension) => resultCopy?.[dimension.key]?.high).filter(Boolean)
  if (!person?.name || phrases.length === 0) return ''
  return `${person.name}型的核心特征是：${phrases[0]}${phrases[1] ? `；同时，${phrases[1]}。` : '。'}`
}

export function buildCelebrityShareCopy(params: {
  mode: 'self' | 'target'
  primary: any
  primarySimilarity: number
  secondary?: any
  secondarySimilarity?: number
  template?: string
}) {
  const subject = params.mode === 'target' ? 'TA' : '自己'
  if (params.primary?.shareCopy) return String(params.primary.shareCopy)
  if (!params.secondary) return `我在 Crush 名人图鉴里测出${subject}像「${params.primary?.name || '古今名人'}」${params.primarySimilarity}%。`
  const values: Record<string, string> = {
    '{主体}': subject,
    '{人物名}': params.primary?.name || '',
    '{similarity}': String(params.primarySimilarity),
    '{第二人物名}': params.secondary.name || '',
    '{secondarySimilarity}': String(params.secondarySimilarity || 0)
  }
  let copy = params.template || '我在 Crush 名人图鉴里测出{主体}像「{人物名}」{similarity}%，第二像「{第二人物名}」{secondarySimilarity}%。'
  for (const [token, value] of Object.entries(values)) copy = copy.split(token).join(value)
  return copy
}
