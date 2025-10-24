import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      entryRoot: 'src',
      tsconfigPath: 'tsconfig.json',
      include: ['src/**/*'],
      exclude: ['src/vite-env.d.ts'],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.d.ts', '.js', '.vue', '.json'],
  },
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VuePluginArchCore',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'mitt', 'dockview-vue', '@vue-plugin-arch/types'],
    },
  },
})
