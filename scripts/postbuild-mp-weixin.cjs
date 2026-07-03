const fs = require('fs')
const path = require('path')

const root = path.join('dist', 'build', 'mp-weixin')
const transparentImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function walkFiles(dir, extensions, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, extensions, files)
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }
  return files
}

function patchDcloudShadowAssets() {
  const files = walkFiles(root, ['.js', '.wxss', '.wxml'])
  const shadowUrlPattern = /https:\/\/cdn1?\.dcloud\.net\.cn(?:\/[^"')\s]+)?\/img\/shadow-(?:grey|blue|green|orange|red|yellow)\.png/g
  const preloadPattern = /wx\.preloadAssets\(\{data:\[\{type:"image",src:"https:\/\/"\+e\+"\/[^"]*\/img\/shadow-grey\.png"\}\]\}\)/g
  let patched = 0

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8')
    const after = before
      .replace(shadowUrlPattern, transparentImage)
      .replace(preloadPattern, 'wx.preloadAssets({data:[]})')
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8')
      patched += 1
    }
  }

  if (patched > 0) {
    console.log(`[postbuild] patched DCloud shadow CDN refs in ${patched} file(s)`)
  }
}

const projectConfigPath = path.join(root, 'project.config.json')
if (fs.existsSync(projectConfigPath)) {
  const projectConfig = readJson(projectConfigPath)
  projectConfig.setting = {
    ...(projectConfig.setting || {}),
    urlCheck: true,
    postcss: true,
    minified: true,
    minifyWXML: true,
    minifyWXSS: true,
    uploadWithSourceMap: false
  }
  projectConfig.libVersion = projectConfig.libVersion || '3.7.0'
  projectConfig.miniprogramRoot = projectConfig.miniprogramRoot || ''
  writeJson(projectConfigPath, projectConfig)
}

// 不注入 __usePrivacyCheck__ — 2025 年后微信已内置隐私检查，开启此 flag 反而要求
// 管理后台为每个 API scope 单独声明（未声明则报 api scope is not declared），关闭即可正常工作。

const privacySrc = path.join('src', 'privacy.json')
const privacyDest = path.join(root, 'privacy.json')
if (fs.existsSync(privacySrc)) {
  fs.copyFileSync(privacySrc, privacyDest)
}

// 清理不参与小程序包的大体积文件（仅 H5/通用用途，放 static/ 是为了共用引用路径）
const largeStaticFiles = ['logo.png', 'app-icon.png']
for (const f of largeStaticFiles) {
  const fp = path.join(root, 'static', f)
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp)
    console.log(`[postbuild] removed large static file from mp-weixin: ${f}`)
  }
}

const staleSpritesheet = path.join(root, 'static', 'pets', 'xiaomi', 'spritesheet.webp')
if (fs.existsSync(staleSpritesheet)) {
  fs.unlinkSync(staleSpritesheet)
}

const staleTaohuaMock = path.join(root, 'pages', 'taohua', 'mock-data.js')
if (fs.existsSync(staleTaohuaMock)) {
  fs.unlinkSync(staleTaohuaMock)
}

const tabbarSrc = 'custom-tab-bar'
const tabbarDest = path.join(root, tabbarSrc)
if (!fs.existsSync(tabbarDest)) {
  fs.mkdirSync(tabbarDest, { recursive: true })
}
for (const file of ['index.json', 'index.wxml', 'index.js', 'index.wxss']) {
  fs.copyFileSync(path.join(tabbarSrc, file), path.join(tabbarDest, file))
}

const taohuaIconSrc = path.join('static', 'icons', 'taohua')
const taohuaIconDest = path.join(root, 'static', 'icons', 'taohua')
if (fs.existsSync(taohuaIconSrc)) {
  fs.mkdirSync(taohuaIconDest, { recursive: true })
  for (const file of fs.readdirSync(taohuaIconSrc)) {
    fs.copyFileSync(path.join(taohuaIconSrc, file), path.join(taohuaIconDest, file))
  }
}

patchDcloudShadowAssets()
