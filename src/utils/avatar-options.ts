export const presetAvatarOptions = [
  { value: '/static/avatars/anime-mint.svg', label: '薄荷短发' },
  { value: '/static/avatars/anime-sky.svg', label: '天蓝卷发' },
  { value: '/static/avatars/anime-coral.svg', label: '珊瑚波浪' },
  { value: '/static/avatars/anime-amber.svg', label: '琥珀齐刘海' }
] as const

export function isPresetAvatar(value?: string) {
  if (!value) return false
  return presetAvatarOptions.some((item) => item.value === value)
}
