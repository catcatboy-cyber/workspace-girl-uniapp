import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
export default defineConfig(() => {
  const isAppBuild = process.env.UNI_PLATFORM === 'app'

  return {
    plugins: [
      uni(),
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
