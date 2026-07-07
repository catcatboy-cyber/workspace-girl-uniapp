export type ThemeId =
  | 'campus-pop'
  | 'sea-salt-lemon'
  | 'peach-oolong'
  | 'velvet-diary'
  | 'rose-letter'
  | 'seafoam-note'

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
  // Velvet Diary — warm, refined, paper-soft.
  velvet: {
    '--radius-sm': '18rpx',
    '--radius-md': '28rpx',
    '--radius-lg': '40rpx',
    '--shadow-sm': '0 6rpx 16rpx rgba(92,48,32,0.05)',
    '--shadow-md': '0 14rpx 34rpx rgba(92,48,32,0.08)',
    '--shadow-lg': '0 22rpx 52rpx rgba(92,48,32,0.10)',
    '--shadow-hard': '0 12rpx 28rpx rgba(92,48,32,0.10)',
    '--shadow-hero': '0 18rpx 42rpx rgba(154,93,62,0.16)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '600',
    '--font-weight-hero': '700',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '155deg',
    '--hero-gradient-angle': '160deg',
    '--spacing-page': '30rpx',
    '--spacing-card': '30rpx',
    '--text-line-height': '1.68',
    '--text-line-height-heading': '1.28'
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
  },
  // Current Campus Pop baseline: bouncy shape with hard poster shadows.
  campusHard: {
    '--radius-sm': '20rpx',
    '--radius-md': '28rpx',
    '--radius-lg': '36rpx',
    '--shadow-sm': '0 4rpx 12rpx rgba(0,0,0,0.03)',
    '--shadow-md': '0 10rpx 28rpx rgba(0,0,0,0.05)',
    '--shadow-lg': '0 18rpx 40rpx rgba(0,0,0,0.06)',
    '--shadow-hard': '6rpx 6rpx 0 var(--text-main, #111111)',
    '--shadow-hero': '8rpx 8rpx 0 var(--text-main, #111111)',
    '--font-weight-normal': '400',
    '--font-weight-strong': '600',
    '--font-weight-hero': '800',
    '--card-border-style': 'solid',
    '--card-gradient-angle': '145deg',
    '--hero-gradient-angle': '145deg',
    '--spacing-page': '28rpx',
    '--spacing-card': '32rpx',
    '--text-line-height': '1.6',
    '--text-line-height-heading': '1.2'
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
    '--placeholder': '#777777',
    '--on-active-muted': 'rgba(255,255,255,0.6)',
    '--primary-contrast': cardBg,
    '--accent-cool': cool,
    '--brand-warm': accentSoft,
    '--brand-cool': '#f5f5ff',
    '--success-soft': '#E0FFF0',
    '--success-text': '#0F6B45',
    '--dot-positive': cool,
    '--dot-risk': risk,
    '--chart-intent': textMain,
    '--chart-risk': risk,
    '--relation-good': '#0A8F86',
    '--relation-mid': '#A87600',
    '--relation-bad': '#D33F49',
    '--relation-neutral': textMain,
    '--warning': '#E67E22',
    '--warning-soft': '#FFF4E3',
    '--hero-text-color': textMain,
    '--hero-divider': 'rgba(0,0,0,0.12)',
    '--hero-tag-bg': textMain,
    '--hero-tag-color': accent,
    '--timeline-positive-gradient': 'linear-gradient(90deg, rgba(53,111,96,0.75), rgba(18,60,54,0.75))',
    '--timeline-risk-gradient': 'linear-gradient(90deg, rgba(184,74,58,0.75), rgba(126,43,35,0.75))',
    '--sync-gradient': 'linear-gradient(90deg, transparent, var(--hero-bg, #FF6B6B), transparent)',
    '--onboard-primary-bg': '#f6fffd',
    '--taohua-card-bg': 'linear-gradient(180deg, #FFF5F5 0%, var(--app-bg, #FFFDF5) 60%)',
    '--taohua-bar-gradient': 'linear-gradient(90deg, var(--hero, #FF6B6B), var(--accent, #FFD93D))',
    '--taohua-hongluan': '#FF5252',
    '--taohua-tianxi': '#0A8F86',
    '--stripe-surface': 'repeating-linear-gradient(45deg, var(--surface, #fff), var(--surface, #fff) 6rpx, var(--divider, #eeeeee) 6rpx, var(--divider, #eeeeee) 12rpx)',
    '--status-ai-bg': '#e8f5e9',
    '--status-ai-dot': '#4caf50',
    '--status-fallback-bg': '#fff3e0',
    '--status-fallback-dot': '#ff9800',
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
    '--shadow-hero': merged['--shadow-hero'] || `8rpx 8rpx 0 ${textMain}`,
    '--font-weight-hero': merged['--font-weight-hero'] || '800',
    '--text-line-height-heading': merged['--text-line-height-heading'] || '1.2',
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
    name: '原味校园',
    description: '明亮硬边，青春活泼的基础风格。',
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
    }, styleSheets.campusHard)
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
    }, styleSheets.campusHard)
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
    }, styleSheets.campusHard)
  },
  {
    id: 'velvet-diary',
    name: '暖绒手札',
    description: '暖调纸张感，柔和细腻的丝绒日记基础款。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#FFF7EE',
      '--page-wash': 'rgba(180, 106, 82, 0.08)',
      '--hero-bg': '#F2B39B',
      '--hero-bg-2': '#F8D9C8',
      '--card-bg': '#FFFDF8',
      '--card-soft': '#FFF3E8',
      '--surface': '#FFFDF8',
      '--surface-rgb': '255,253,248',
      '--surface-soft': '#FFF3E8',
      '--surface-dim': '#FFF0E2',
      '--surface-bright': '#FFFFFF',
      '--surface-raised': '#FFFDF8',
      '--text-main': '#5C3020',
      '--text-muted': '#8C6B58',
      '--text-soft': '#B99A86',
      '--placeholder': '#B99A86',
      '--primary': '#9F5B47',
      '--primary-2': '#D9896C',
      '--primary-contrast': '#FFFDF8',
      '--accent-cool': '#D9896C',
      '--accent': '#F0B869',
      '--accent-soft': '#FFF0DC',
      '--brand-warm': '#FFF0DC',
      '--brand-cool': '#F6ECE6',
      '--success': '#8C9A72',
      '--success-soft': '#EEF4E5',
      '--success-text': '#6F7D56',
      '--risk': '#B84A3A',
      '--risk-soft': '#FBE7E2',
      '--warning': '#C9823C',
      '--warning-soft': '#FFF1DF',
      '--dot-positive': '#D9896C',
      '--dot-risk': '#B84A3A',
      '--chart-intent': '#9F5B47',
      '--chart-risk': '#B84A3A',
      '--relation-good': '#6F7D56',
      '--relation-mid': '#A66E2F',
      '--relation-bad': '#B84A3A',
      '--relation-neutral': '#5C3020',
      '--hero-text-color': '#5C3020',
      '--hero-divider': 'rgba(92,48,32,0.14)',
      '--hero-tag-bg': '#5C3020',
      '--hero-tag-color': '#FFF0DC',
      '--border': '#D9B99D',
      '--divider': 'rgba(92,48,32,0.12)',
      '--divider-strong': '#C79A78',
      '--overlay': 'rgba(92,48,32,0.42)',
      '--scrim': 'rgba(92,48,32,0.32)',
      '--border-width': '1rpx',
      '--border-width-strong': '2rpx',
      '--border-style': 'solid',
      '--hero-transform': 'rotate(-0.2deg)',
      '--hero-rotate': '-0.2deg',
      '--timeline-positive-gradient': 'linear-gradient(90deg, rgba(217,137,108,0.82), rgba(159,91,71,0.82))',
      '--timeline-risk-gradient': 'linear-gradient(90deg, rgba(184,74,58,0.82), rgba(129,55,44,0.82))',
      '--sync-gradient': 'linear-gradient(90deg, transparent, rgba(217,137,108,0.84), transparent)',
      '--onboard-primary-bg': '#FFF2EA',
      '--taohua-card-bg': 'linear-gradient(180deg, #FFF0E8 0%, #FFF7EE 62%)',
      '--taohua-bar-gradient': 'linear-gradient(90deg, #D9896C, #F0B869)',
      '--taohua-hongluan': '#B84A3A',
      '--taohua-tianxi': '#6F7D56',
      '--stripe-surface': 'repeating-linear-gradient(45deg, #FFFDF8, #FFFDF8 6rpx, rgba(92,48,32,0.12) 6rpx, rgba(92,48,32,0.12) 12rpx)',
      '--status-ai-bg': '#EEF4E5',
      '--status-ai-dot': '#8C9A72',
      '--status-fallback-bg': '#FFF1DF',
      '--status-fallback-dot': '#C9823C',
      '--on-active-muted': 'rgba(255,253,248,0.72)'
    }, styleSheets.velvet)
  },
  {
    id: 'rose-letter',
    name: '松烟暮紫',
    description: '雾紫灰蓝纸张感，安静冷调的 Velvet 轻量变体。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#F7F4FA',
      '--page-wash': 'rgba(89, 73, 128, 0.07)',
      '--hero-bg': '#B9ADD8',
      '--hero-bg-2': '#DED7EF',
      '--card-bg': '#FFFEFF',
      '--card-soft': '#F1EEF8',
      '--surface': '#FFFEFF',
      '--surface-rgb': '255,254,255',
      '--surface-soft': '#F1EEF8',
      '--surface-dim': '#E9E4F2',
      '--surface-bright': '#FFFFFF',
      '--surface-raised': '#FFFEFF',
      '--text-main': '#332E46',
      '--text-muted': '#686179',
      '--text-soft': '#948CA5',
      '--placeholder': '#948CA5',
      '--primary': '#67508F',
      '--primary-2': '#8B79B7',
      '--primary-contrast': '#FFFEFF',
      '--accent-cool': '#8B79B7',
      '--accent': '#C9BDE5',
      '--accent-soft': '#F0ECFA',
      '--brand-warm': '#F0ECFA',
      '--brand-cool': '#E9F0F5',
      '--success': '#778E76',
      '--success-soft': '#ECF4EA',
      '--success-text': '#5B725B',
      '--risk': '#B65A5F',
      '--risk-soft': '#F8E8EA',
      '--warning': '#A7773E',
      '--warning-soft': '#FFF2DD',
      '--dot-positive': '#8B79B7',
      '--dot-risk': '#B65A5F',
      '--chart-intent': '#67508F',
      '--chart-risk': '#B65A5F',
      '--relation-good': '#5B725B',
      '--relation-mid': '#8A6E35',
      '--relation-bad': '#B65A5F',
      '--relation-neutral': '#332E46',
      '--hero-text-color': '#332E46',
      '--hero-divider': 'rgba(51,46,70,0.12)',
      '--hero-tag-bg': '#332E46',
      '--hero-tag-color': '#F0ECFA',
      '--border': '#C7BEDA',
      '--divider': 'rgba(51,46,70,0.10)',
      '--divider-strong': '#AFA2CC',
      '--overlay': 'rgba(51,46,70,0.42)',
      '--scrim': 'rgba(51,46,70,0.32)',
      '--border-width': '1rpx',
      '--border-width-strong': '2rpx',
      '--border-style': 'solid',
      '--hero-transform': 'rotate(-0.2deg)',
      '--hero-rotate': '-0.2deg',
      '--timeline-positive-gradient': 'linear-gradient(90deg, rgba(139,121,183,0.76), rgba(103,80,143,0.76))',
      '--timeline-risk-gradient': 'linear-gradient(90deg, rgba(182,90,95,0.80), rgba(128,67,83,0.80))',
      '--sync-gradient': 'linear-gradient(90deg, transparent, rgba(139,121,183,0.78), transparent)',
      '--onboard-primary-bg': '#F0ECFA',
      '--taohua-card-bg': 'linear-gradient(180deg, #F1EEF8 0%, #F7F4FA 62%)',
      '--taohua-bar-gradient': 'linear-gradient(90deg, #8B79B7, #C9BDE5)',
      '--taohua-hongluan': '#B65A5F',
      '--taohua-tianxi': '#5B725B',
      '--stripe-surface': 'repeating-linear-gradient(45deg, #FFFEFF, #FFFEFF 6rpx, rgba(51,46,70,0.10) 6rpx, rgba(51,46,70,0.10) 12rpx)',
      '--status-ai-bg': '#ECF4EA',
      '--status-ai-dot': '#778E76',
      '--status-fallback-bg': '#FFF2DD',
      '--status-fallback-dot': '#A7773E',
      '--on-active-muted': 'rgba(255,254,255,0.72)'
    }, styleSheets.velvet)
  },
  {
    id: 'seafoam-note',
    name: '海沫笔记',
    description: '海沫蓝绿笔记感，清爽中性的 Velvet 轻量变体。',
    navText: 'black',
    vars: mergeStyleSheet({
      '--app-bg': '#F4FAF8',
      '--page-wash': 'rgba(79, 143, 163, 0.06)',
      '--hero-bg': '#B7DDD8',
      '--hero-bg-2': '#D8EFEC',
      '--card-bg': '#FFFFFF',
      '--card-soft': '#EEF7F5',
      '--surface': '#FFFFFF',
      '--surface-rgb': '255,255,255',
      '--surface-soft': '#EEF7F5',
      '--surface-dim': '#E6F2F0',
      '--surface-bright': '#FFFFFF',
      '--surface-raised': '#FFFFFF',
      '--text-main': '#24383D',
      '--text-muted': '#647B80',
      '--text-soft': '#8FA4A8',
      '--placeholder': '#8FA4A8',
      '--primary': '#3F7F8B',
      '--primary-2': '#6BB6AE',
      '--primary-contrast': '#FFFFFF',
      '--accent-cool': '#6BB6AE',
      '--accent': '#D7EDE8',
      '--accent-soft': '#EEF8F5',
      '--brand-warm': '#EEF8F5',
      '--brand-cool': '#E7F3F7',
      '--success': '#6F9B83',
      '--success-soft': '#E9F5EE',
      '--success-text': '#527A63',
      '--risk': '#B85C4A',
      '--risk-soft': '#F8E9E5',
      '--warning': '#A7783C',
      '--warning-soft': '#FFF3DF',
      '--dot-positive': '#6BB6AE',
      '--dot-risk': '#B85C4A',
      '--chart-intent': '#3F7F8B',
      '--chart-risk': '#B85C4A',
      '--relation-good': '#527A63',
      '--relation-mid': '#8A6E35',
      '--relation-bad': '#B85C4A',
      '--relation-neutral': '#24383D',
      '--hero-text-color': '#24383D',
      '--hero-divider': 'rgba(36,56,61,0.12)',
      '--hero-tag-bg': '#24383D',
      '--hero-tag-color': '#EEF8F5',
      '--border': '#BFD4D2',
      '--divider': 'rgba(36,56,61,0.10)',
      '--divider-strong': '#9EBDBB',
      '--overlay': 'rgba(36,56,61,0.42)',
      '--scrim': 'rgba(36,56,61,0.32)',
      '--border-width': '1rpx',
      '--border-width-strong': '2rpx',
      '--border-style': 'solid',
      '--hero-transform': 'rotate(-0.2deg)',
      '--hero-rotate': '-0.2deg',
      '--timeline-positive-gradient': 'linear-gradient(90deg, rgba(107,182,174,0.76), rgba(63,127,139,0.76))',
      '--timeline-risk-gradient': 'linear-gradient(90deg, rgba(184,92,74,0.80), rgba(137,68,56,0.80))',
      '--sync-gradient': 'linear-gradient(90deg, transparent, rgba(107,182,174,0.78), transparent)',
      '--onboard-primary-bg': '#EEF8F5',
      '--taohua-card-bg': 'linear-gradient(180deg, #EFF8F6 0%, #F4FAF8 62%)',
      '--taohua-bar-gradient': 'linear-gradient(90deg, #6BB6AE, #D7EDE8)',
      '--taohua-hongluan': '#B85C4A',
      '--taohua-tianxi': '#527A63',
      '--stripe-surface': 'repeating-linear-gradient(45deg, #FFFFFF, #FFFFFF 6rpx, rgba(36,56,61,0.10) 6rpx, rgba(36,56,61,0.10) 12rpx)',
      '--status-ai-bg': '#E9F5EE',
      '--status-ai-dot': '#6F9B83',
      '--status-fallback-bg': '#FFF3DF',
      '--status-fallback-dot': '#A7783C',
      '--on-active-muted': 'rgba(255,255,255,0.72)'
    }, styleSheets.velvet)
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
