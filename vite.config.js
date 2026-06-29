import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function patchMpWeixin() {
  return {
    name: 'patch-mp-weixin',
    closeBundle() {
      const outDir = process.env.UNI_OUTPUT_DIR
      if (!outDir) return

      // 1. Copy privacy.json to output root
      const privacySrc = path.join(__dirname, 'src', 'privacy.json')
      const privacyDest = path.join(outDir, 'privacy.json')
      if (fs.existsSync(privacySrc)) {
        fs.copyFileSync(privacySrc, privacyDest)
      }

      // 2. Patch app.json: 移除非法 permission 字段
      //    注意：scope.record / scope.writePhotosAlbum 属于隐私接口，
      //    必须通过管理后台（设置→服务内容声明）声明，不可写在 app.json 中。
      const appJsonPath = path.join(outDir, 'app.json')
      if (fs.existsSync(appJsonPath)) {
        const raw = fs.readFileSync(appJsonPath, 'utf8')
        const appJson = JSON.parse(raw)
        let changed = false

        // 移除非法 scope，避免开发者工具报 "无效的 app.json permission"
        if (appJson.permission) {
          delete appJson.permission
          changed = true
        }

        if (changed) {
          fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8')
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isAppBuild = process.env.UNI_PLATFORM === 'app'

  return {
    plugins: [
      uni(),
      patchMpWeixin(),
    ],
    build: isAppBuild ? {
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    } : undefined,
  }
})
