import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import dts from 'vite-plugin-dts'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      copyDtsFiles: true,
      outDir: 'dist',
      entryRoot: 'src',
      include: ['src/**/*'],
      exclude: ['**/*.test.*', '**/*.spec.*'],
      rollupTypes: true,
    }),
    cssInjectedByJsPlugin(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PluginHelloWorld',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n'],
      output: {
        sourcemapPathTransform: relativeSourcePath => {
          // 确保 source map 中的路径指向正确的源码位置
          return relativeSourcePath.replace(/^\.\.\//, '')
        },
      },
    },
    // Optimize for production and dynamic loading
    minify: 'esbuild',
    target: 'es2020',
    // Generate source maps for debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
