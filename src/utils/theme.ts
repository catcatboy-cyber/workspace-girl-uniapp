export type ThemeId = 'campus-pop' | 'sea-salt-lemon' | 'peach-oolong'

export type ThemeOption = {
  id: ThemeId
  name: string
  description: string
  vars: Record<string, string>
  navText: 'black' | 'white'
}

// Shared shape variables that define each style's personality beyond color
type StyleSheet = Record<string, string>

const styleSheets: Record<string, StyleSheet> = {
  // Styles 1-5: original themes share a classic warm style sheet
  classic: {
    '--radius-sm': '12rpx',
    '--radius-md': '18rpx',
    '--radius-lg': '24rpx',
    '--shadow-sm': '0 2rpx 8rpx rgba(0,0,0,0.04)',
    '--shadow-md': '0 8rpx 24rpx rgba(0,0,0,0.06)',
    '--shadow-lg': '0 16rpx 36rpx rgba(0,0,0,0.08)',
    '--shadow-hero': '0 22rpx 44rpx rgba(0,0,0,0.12)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '600',
    '--font-weight-hero': '700',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '135deg',
    '--hero-gradient-angle': '135deg',
    '--spacing-page': '28rpx',
    '--spacing-card': '32rpx',
    '--text-line-height': '1.55',
    '--text-line-height-heading': '1.3'
  },
  // Twin Bloom — soft, rounded, airy
  soft: {
    '--radius-sm': '16rpx',
    '--radius-md': '24rpx',
    '--radius-lg': '32rpx',
    '--shadow-sm': '0 4rpx 16rpx rgba(0,0,0,0.03)',
    '--shadow-md': '0 12rpx 32rpx rgba(0,0,0,0.04)',
    '--shadow-lg': '0 20rpx 48rpx rgba(0,0,0,0.06)',
    '--shadow-hero': '0 24rpx 56rpx rgba(0,0,0,0.10)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '550',
    '--font-weight-hero': '650',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '160deg',
    '--hero-gradient-angle': '160deg',
    '--spacing-page': '32rpx',
    '--spacing-card': '36rpx',
    '--text-line-height': '1.65',
    '--text-line-height-heading': '1.35'
  },
  // Tea Mist — minimal, structured, crisp
  minimal: {
    '--radius-sm': '4rpx',
    '--radius-md': '8rpx',
    '--radius-lg': '12rpx',
    '--shadow-sm': '0 1rpx 2rpx rgba(0,0,0,0.04)',
    '--shadow-md': '0 2rpx 6rpx rgba(0,0,0,0.04)',
    '--shadow-lg': '0 4rpx 12rpx rgba(0,0,0,0.05)',
    '--shadow-hero': '0 1rpx 4rpx rgba(0,0,0,0.08)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '500',
    '--font-weight-hero': '600',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '180deg',
    '--hero-gradient-angle': '180deg',
    '--spacing-page': '40rpx',
    '--spacing-card': '40rpx',
    '--text-line-height': '1.75',
    '--text-line-height-heading': '1.4'
  },
  // Deep Ink — dark, immersive, glowing
  dark: {
    '--radius-sm': '14rpx',
    '--radius-md': '20rpx',
    '--radius-lg': '28rpx',
    '--shadow-sm': '0 2rpx 8rpx rgba(0,0,0,0.20)',
    '--shadow-md': '0 8rpx 24rpx rgba(0,0,0,0.30)',
    '--shadow-lg': '0 16rpx 40rpx rgba(0,0,0,0.40)',
    '--shadow-hero': '0 20rpx 48rpx rgba(0,0,0,0.50), 0 0 40rpx rgba(100,120,220,0.08)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '550',
    '--font-weight-hero': '650',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '135deg',
    '--hero-gradient-angle': '135deg',
    '--spacing-page': '28rpx',
    '--spacing-card': '32rpx',
    '--text-line-height': '1.6',
    '--text-line-height-heading': '1.3'
  },
  // Mint Sugar — playful, bouncy, fresh
  bouncy: {
    '--radius-sm': '20rpx',
    '--radius-md': '28rpx',
    '--radius-lg': '36rpx',
    '--shadow-sm': '0 4rpx 12rpx rgba(0,0,0,0.03)',
    '--shadow-md': '0 10rpx 28rpx rgba(0,0,0,0.05)',
    '--shadow-lg': '0 18rpx 40rpx rgba(0,0,0,0.06)',
    '--shadow-hero': '0 22rpx 48rpx rgba(0,0,0,0.08)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '600',
    '--font-weight-hero': '700',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '145deg',
    '--hero-gradient-angle': '145deg',
    '--spacing-page': '28rpx',
    '--spacing-card': '32rpx',
    '--text-line-height': '1.6',
    '--text-line-height-heading': '1.3'
  }
}

function mergeStyleSheet(vars: Record<string, string>, sheet: StyleSheet): Record<string, string> {
  const merged = { ...vars, ...sheet }
  const textMain = merged['--text-main'] || '#111111'
  const textMuted = merged['--text-muted'] || '#666666'
  const cardBg = merged['--card-bg'] || '#ffffff'
  const cardSoft = merged['--card-soft'] || '#f9f9f9'
  const accent = merged['--accent'] || '#FFD93D'
  const accentSoft = merged['--accent-soft'] || '#FFFBEB'
  const cool = merged['--primary-2'] || merged['--success'] || '#4ECDC4'
  const risk = merged['--risk'] || '#FF5252'
  const riskSoft = merged['--risk-soft'] || '#FFEEEC'

  return {
    '--ink': textMain,
    '--hero': merged['--hero-bg'] || '#FF6B6B',
    '--surface': cardBg,
    '--surface-rgb': '255,255,255',
    '--surface-soft': cardSoft,
    '--surface-dim': cardSoft,
    '--surface-bright': cardBg,
    '--surface-raised': cardBg,
    '--surface-blur': '18rpx',
    '--surface-opacity': '0.86',
    '--page-wash': 'rgba(18, 60, 54, 0.07)',
    '--primary-contrast': cardBg,
    '--accent-cool': cool,
    '--brand-warm': accentSoft,
    '--brand-cool': '#f5f5ff',
    '--success-soft': '#E0FFF0',
    '--dot-positive': cool,
    '--dot-risk': risk,
    '--warning': '#E67E22',
    '--warning-soft': '#FFF4E3',
    '--hero-text-color': textMain,
    '--hero-tag-bg': textMain,
    '--hero-tag-color': accent,
    '--border': textMain,
    '--divider': 'rgba(0,0,0,0.08)',
    '--divider-strong': textMain,
    '--scrim': 'rgba(0,0,0,0.4)',
    '--overlay': 'rgba(0,0,0,0.5)',
    '--radius-xs': '4rpx',
    '--radius-pill': '999rpx',
    '--border-width': '2rpx',
    '--border-width-strong': '3rpx',
    '--border-style': 'solid',
    '--shadow-glow': merged['--shadow-lg'] || '0 16rpx 36rpx rgba(0,0,0,0.08)',
    '--control-height-sm': '48rpx',
    '--control-height-md': '64rpx',
    '--control-height-lg': '80rpx',
    '--section-gap': '16rpx',
    '--card-padding': '28rpx',
    '--card-gap': '24rpx',
    '--motion-fast': '150ms',
    '--motion-normal': '260ms',
    '--motion-ease': 'ease-out',
    '--press-scale': '0.98',
    '--hero-rotate': '-0.5deg',
    '--hero-transform': 'rotate(-0.5deg)',
    '--font-ui': '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    '--font-display': '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    '--font-mono': 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    '--font-weight-body': merged['--font-weight-normal'] || '400',
    '--font-weight-heading': '800',
    ...merged,
    '--shadow-hard': merged['--shadow-hard'] || `6rpx 6rpx 0 ${textMain}`,
    '--shadow-hero': merged['--shadow-hero-hard'] || `8rpx 8rpx 0 ${textMain}`,
    '--font-weight-hero': merged['--font-weight-hero-hard'] || '800',
    '--text-line-height-heading': merged['--text-line-height-heading-hard'] || '1.2',
    '--text-soft': merged['--text-soft'] || '#999999',
    '--risk-soft': riskSoft,
    '--text-muted': textMuted
  }
}

const THEME_STORAGE_KEY = 'uiThemeId'
const TAB_BAR_PAGES = new Set([
  'pages/index/index',
  'pages/case-detail/case-detail',
  'pages/timeline/timeline',
  'pages/cases/cases',
  'pages/me/me'
])

export const themeOptions: ThemeOption[] = [
  {
    id: 'campus-pop',
    name: 'Campus Pop',
    description: '硬边海报风，黑边框粗线条，年轻有活力。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#FFFDF5',
      '--hero-bg': '#FF6B6B',
      '--hero-bg-2': '#e85d5d',
      '--card-bg': '#ffffff',
      '--card-soft': '#f9f9f9',
      '--text-main': '#111111',
      '--text-muted': '#666666',
      '--primary': '#111111',
      '--primary-2': '#4ECDC4',
      '--accent': '#FFD93D',
      '--accent-soft': '#FFFBEB',
      '--risk': '#FF5252',
      '--risk-soft': '#FFEEEC',
      '--success': '#4ECDC4'
    }, styleSheets.bouncy)
  },
  {
    id: 'sea-salt-lemon',
    name: '海盐柠檬',
    description: '清爽蓝白配柠檬黄，干净理性，对比清晰。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#F4F7FA',
      '--hero-bg': '#5DADE2',
      '--hero-bg-2': '#3d8ec8',
      '--card-bg': '#ffffff',
      '--card-soft': '#f5f9fc',
      '--text-main': '#111111',
      '--text-muted': '#5a7d8e',
      '--primary': '#2E86C1',
      '--primary-2': '#3498DB',
      '--accent': '#F4D03F',
      '--accent-soft': '#FEF9E7',
      '--risk': '#E74C3C',
      '--risk-soft': '#FDEDEC',
      '--success': '#27AE60'
    }, styleSheets.bouncy)
  },
  {
    id: 'peach-oolong',
    name: '蜜桃乌龙',
    description: '暖蜜桃底配乌龙茶色，温柔日常，有温度。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#FFF8F2',
      '--hero-bg': '#D4795E',
      '--hero-bg-2': '#b86048',
      '--card-bg': '#ffffff',
      '--card-soft': '#fdf6f1',
      '--text-main': '#111111',
      '--text-muted': '#8b6f60',
      '--primary': '#D4795E',
      '--primary-2': '#27AE60',
      '--accent': '#F0C060',
      '--accent-soft': '#FEF8EE',
      '--risk': '#C0392B',
      '--risk-soft': '#FDEDEC',
      '--success': '#27AE60'
    }, styleSheets.bouncy)
  }
]

export function getTheme(id?: string | null): ThemeOption {
  return themeOptions.find((item) => item.id === id) || themeOptions[0]
}

export function getCurrentThemeId(): ThemeId {
  try {
    return (uni.getStorageSync(THEME_STORAGE_KEY) as ThemeId) || 'campus-pop'
  } catch {
    return 'campus-pop'
  }
}

export function getCurrentTheme() {
  return getTheme(getCurrentThemeId())
}

export function getThemeStyle(theme = getCurrentTheme()) {
  return theme.vars
}

export function getThemeClass(id: ThemeId | string = getCurrentThemeId()) {
  return `theme-${id}`
}

function isCurrentTabBarPage() {
  try {
    const pages = getCurrentPages()
    const route = pages[pages.length - 1]?.route
    return Boolean(route && TAB_BAR_PAGES.has(route))
  } catch {
    return false
  }
}

export function applyThemeChrome(theme = getCurrentTheme()) {
  // #ifdef MP-WEIXIN
  // WeChat base library 3.15.x crashes on dynamic navigationBar/tabBar API.
  return
  // #endif

  // #ifndef MP-WEIXIN
  try {
    uni.setNavigationBarColor({
      frontColor: theme.navText === 'white' ? '#ffffff' : '#000000',
      backgroundColor: theme.vars['--app-bg']
    })
  } catch {}

  if (!isCurrentTabBarPage()) return

  try {
    uni.setTabBarStyle({
      color: theme.vars['--text-muted'],
      selectedColor: theme.vars['--primary'],
      backgroundColor: theme.vars['--card-bg'],
      borderStyle: (theme.id === 'cocoa-night' || theme.id === 'deep-ink') ? 'white' : 'black'
    })
  } catch {}
  // #endif
}

export function setCurrentTheme(id: ThemeId) {
  const theme = getTheme(id)
  try {
    uni.setStorageSync(THEME_STORAGE_KEY, theme.id)
  } catch {}
  applyThemeChrome(theme)
  return theme
}

const FONT_SIZE_STORAGE_KEY = 'fontSizeMode'
export type FontSizeMode = 'default' | 'large'

export function getFontSizeMode(): FontSizeMode {
  try {
    const value = uni.getStorageSync(FONT_SIZE_STORAGE_KEY)
    if (value === 'large') return 'large'
  } catch {}
  return 'default'
}

export function setFontSizeMode(mode: FontSizeMode) {
  try {
    uni.setStorageSync(FONT_SIZE_STORAGE_KEY, mode)
  } catch {}
  // 即时更新 page 属性的工具函数，由调用方在合适的上下文中执行
  const pageStyle = mode === 'large' ? { 'data-font-size': 'large' } : {}
  // 仅 H5 可通过 DOM 更新; 微信小程序通过 page 选择器自动生效
  // #ifdef H5
  if (typeof document !== 'undefined' && document.documentElement) {
    if (mode === 'large') {
      document.documentElement.setAttribute('data-font-size', 'large')
    } else {
      document.documentElement.removeAttribute('data-font-size')
    }
  }
  // #endif
}
