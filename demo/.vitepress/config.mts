import { defineVOAPlugin } from 'vitepress-openapi'
import { defineConfig } from 'vitepress'
import path from 'node:path'

export default defineConfig({
  title: 'API Docs',
  vite: {
    plugins: [
      defineVOAPlugin({
        specPath: path.resolve(__dirname, 'public/openapi.json'), // relative to VitePress root (docs folder)
        outputDir: path.resolve(__dirname, 'api'),
      }),
    ],
  },
})
