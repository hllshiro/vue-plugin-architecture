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
      bundledPackages: ['@vue-plugin-arch/core'],
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
      external: [
        'vite',
        'chokidar',
        'fast-glob',
        'magic-string',
        'resolve',
        'find-up',
        'fs',
        'fs/promises',
        'path',
        /^node:.*/,
        '@vue-plugin-arch/core',
      ],
      output: {
        globals: {
          vite: 'vite',
          'fast-glob': 'fastGlob',
          'magic-string': 'MagicString',
        },
      },
    },
  },
})
