const fs = require('fs')
const path = require('path')

const root = path.join('dist', 'build', 'mp-weixin')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const appJsonPath = path.join(root, 'app.json')
if (fs.existsSync(appJsonPath)) {
  const appJson = readJson(appJsonPath)
  appJson.__usePrivacyCheck__ = true
  writeJson(appJsonPath, appJson)
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
  writeJson(projectConfigPath, projectConfig)
}

const privacySrc = 'privacy.json'
const privacyDest = path.join(root, 'privacy.json')
if (fs.existsSync(privacySrc)) {
  fs.copyFileSync(privacySrc, privacyDest)
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
