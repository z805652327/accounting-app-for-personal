import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@dcloudio/uni-app': resolve(__dirname, 'src/uni-shim.ts'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: ``,

      },
    },
  },
})
