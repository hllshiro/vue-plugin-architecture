import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['node_modules/**/*'],
      rollupTypes: true,
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VuePluginArchVitePlugin',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      // 只需要 external 以下几个关键依赖：
      // 1. vite - 作为 peerDependency，由使用者提供
      // 2. Node.js 内置模块 - 运行时环境提供
      // 3. 大型依赖包 - 避免重复打包
      external: [
        'vite',
        /^node:/, // Node.js 内置模块（node: 前缀）
        // Node.js 内置模块（无前缀，为了兼容性）
        'fs',
        'fs/promises',
        'path',
        'url',
        'module',
        'events',
        'stream',
        'os',
        'util',
      ],
      output: {
        // Vite 插件运行在 Node.js 环境，不需要 globals
        // globals 主要用于浏览器环境的 UMD 格式
      },
    },
  },
})
