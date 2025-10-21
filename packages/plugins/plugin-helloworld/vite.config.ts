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
        globals: {
          vue: 'Vue',
          'vue-i18n': 'VueI18n',
        },
        // Ensure proper ES module format for dynamic import
        format: 'es',
        // Preserve module structure for better tree-shaking
        preserveModules: false,
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
