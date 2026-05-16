export type ThemeId = 'pine-mist' | 'rose-mist' | 'moon-almond' | 'sea-fog' | 'cocoa-night'

export type ThemeOption = {
  id: ThemeId
  name: string
  description: string
  vars: Record<string, string>
  navText: 'black' | 'white'
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
    id: 'pine-mist',
    name: '松雾绿',
    description: '安静、专业、可信，适合长期使用。',
    navText: 'black',
    vars: {
      '--app-bg': '#f6f1e8',
      '--hero-bg': '#123c36',
      '--hero-bg-2': '#0f2f2b',
      '--card-bg': '#fffcf7',
      '--card-soft': '#fffaf3',
      '--text-main': '#201914',
      '--text-muted': '#76695c',
      '--primary': '#123c36',
      '--primary-2': '#2f6a5c',
      '--accent': '#c9a45c',
      '--accent-soft': '#efe6d6',
      '--risk': '#b84a3a',
      '--risk-soft': '#f7dfd8',
      '--success': '#0f6b45'
    }
  },
  {
    id: 'rose-mist',
    name: '玫瑰雾粉',
    description: '柔和、亲近、有情绪容纳感。',
    navText: 'black',
    vars: {
      '--app-bg': '#faf3f1',
      '--hero-bg': '#7a3e4d',
      '--hero-bg-2': '#5d2f3b',
      '--card-bg': '#fff9f7',
      '--card-soft': '#fff3f0',
      '--text-main': '#2a1d1f',
      '--text-muted': '#806a68',
      '--primary': '#7a3e4d',
      '--primary-2': '#9b6070',
      '--accent': '#c9a1a8',
      '--accent-soft': '#f0dde0',
      '--risk': '#a6473d',
      '--risk-soft': '#f5ded9',
      '--success': '#5b7d60'
    }
  },
  {
    id: 'moon-almond',
    name: '月光米杏',
    description: '轻盈、温暖、无压力。',
    navText: 'black',
    vars: {
      '--app-bg': '#f8f2e9',
      '--hero-bg': '#5f5142',
      '--hero-bg-2': '#473d33',
      '--card-bg': '#fffcf6',
      '--card-soft': '#fff7eb',
      '--text-main': '#241b12',
      '--text-muted': '#7a6b5c',
      '--primary': '#5f5142',
      '--primary-2': '#86715a',
      '--accent': '#d6b678',
      '--accent-soft': '#efe2c4',
      '--risk': '#b76e57',
      '--risk-soft': '#f4e2da',
      '--success': '#6d805b'
    }
  },
  {
    id: 'sea-fog',
    name: '静海蓝灰',
    description: '清醒、干净、理性可信。',
    navText: 'black',
    vars: {
      '--app-bg': '#f3f6f5',
      '--hero-bg': '#254a52',
      '--hero-bg-2': '#1b373e',
      '--card-bg': '#ffffff',
      '--card-soft': '#f7fbfa',
      '--text-main': '#172426',
      '--text-muted': '#68797a',
      '--primary': '#254a52',
      '--primary-2': '#487078',
      '--accent': '#afc6c2',
      '--accent-soft': '#dce8e6',
      '--risk': '#a85b4a',
      '--risk-soft': '#f0ded9',
      '--success': '#43735f'
    }
  },
  {
    id: 'cocoa-night',
    name: '暖夜可可',
    description: '私密、沉浸，适合夜间记录。',
    navText: 'white',
    vars: {
      '--app-bg': '#211b18',
      '--hero-bg': '#2b2420',
      '--hero-bg-2': '#161210',
      '--card-bg': '#2b2420',
      '--card-soft': '#342b26',
      '--text-main': '#fff8ee',
      '--text-muted': '#cbbba6',
      '--primary': '#e8d7bd',
      '--primary-2': '#c9a45c',
      '--accent': '#c9a45c',
      '--accent-soft': '#3b3129',
      '--risk': '#e28b76',
      '--risk-soft': '#4a302a',
      '--success': '#9fc6a5'
    }
  }
]

export function getTheme(id?: string | null): ThemeOption {
  return themeOptions.find((item) => item.id === id) || themeOptions[0]
}

export function getCurrentThemeId(): ThemeId {
  try {
    return (uni.getStorageSync(THEME_STORAGE_KEY) as ThemeId) || 'pine-mist'
  } catch {
    return 'pine-mist'
  }
}

export function getCurrentTheme() {
  return getTheme(getCurrentThemeId())
}

export function getThemeStyle(theme = getCurrentTheme()) {
  return theme.vars
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
  // Skip runtime chrome APIs on WeChat Mini Program.
  return
  // #endif
  // #ifdef MP-WEIXIN
  // 微信开发者工具/基础库 3.15.x 偶发在动态原生 chrome API 内部读取空 errMsg。
  // 小程序端全部使用 pages.json 静态 navigationBar/tabBar 配置，页面色彩由 CSS 变量承接主题。
  return
  // #endif

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
      borderStyle: theme.id === 'cocoa-night' ? 'white' : 'black'
    })
  } catch {}
}

export function setCurrentTheme(id: ThemeId) {
  const theme = getTheme(id)
  try {
    uni.setStorageSync(THEME_STORAGE_KEY, theme.id)
  } catch {}
  applyThemeChrome(theme)
  return theme
}
