import { defineConfig, loadEnv, UserConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'

// External dependencies to be copied as static assets
const externalDeps = ['vue', 'vue-i18n']

export default defineConfig(({ mode }): UserConfig => {
  console.log(`---- Mode: ${mode} ----\n`)
  const plugins = [
    vue(),
    vuePluginArch(),
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      resolvers: [
        AntDesignVueResolver({
          importStyle: false,
        }),
      ],
      dts: 'src/components.d.ts',
    }),
    AutoImport({
      imports: ['vue', 'vue-router', 'vue-i18n'],
      dts: 'src/auto-import.d.ts',
      eslintrc: {
        enabled: true,
        filepath: '../../.eslintrc-auto-import.json',
        globalsPropValue: true, // 声明为全局变量
      },
    }),
    // Copy external dependencies as static assets
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/vue/dist/vue.global.prod.js',
          dest: 'libs',
          rename: 'vue.js',
        },
        {
          src: 'node_modules/vue-i18n/dist/vue-i18n.global.prod.js',
          dest: 'libs',
          rename: 'vue-i18n.js',
        },
      ],
    }),
  ]

  const env = loadEnv(mode, process.cwd())
  const debug = Boolean(env.VITE_DEBUG_MODE)
  if (debug) {
    plugins.push(Inspect())
  }

  const options: UserConfig = {
    build: {
      minify: true,
      sourcemap: debug,
      rollupOptions: {
        external: externalDeps,
        output: {
          compact: true,
          globals: {
            vue: 'Vue',
            'vue-i18n': 'VueI18n',
          },
          paths: {
            vue: '/libs/vue.js',
            'vue-i18n': '/libs/vue-i18n.js',
          },
        },
      },
    },
    plugins,
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        {
          find: /^@vue-plugin-arch\/core$/,
          replacement: path.resolve(__dirname, '../core/src'),
        },
        {
          find: /^@vue-plugin-arch\/(plugin-.+)$/,
          replacement: path.resolve(__dirname, '../plugins/$1/src'),
        },
      ],
    },
    server: {
      open: false,
      hmr: true,
      fs: {
        // Allow serving files from anywhere in development
        allow: ['..', '../..', '/'],
        // In development, allow @fs imports for testing
        strict: false,
      },
    },
  }

  return options
})
