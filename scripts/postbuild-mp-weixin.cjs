const fs = require('fs')
const path = require('path')

const root = path.join('dist', 'build', 'mp-weixin')

const staleSpritesheet = path.join(root, 'static', 'pets', 'xiaomi', 'spritesheet.webp')
if (fs.existsSync(staleSpritesheet)) {
  fs.unlinkSync(staleSpritesheet)
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
