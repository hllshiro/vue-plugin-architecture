import { defineConfig, loadEnv, UserConfig, PluginOption } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import {
  vuePluginArch,
  VuePluginArchOptions,
} from '@vue-plugin-arch/vite-plugin'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'

// Vue Plugin Architecture configuration
const createVuePluginArchConfig = (isDev: boolean): VuePluginArchOptions => {
  const options: VuePluginArchOptions = {
    workspace: {
      root: path.resolve(__dirname, '../..'),
      pluginsDir: 'packages/plugins',
    },
    registry: {
      endpoint: '/api/plugin-registry.json',
      staticPath: 'packages/demo/public/api/plugin-registry.json',
    },
    build: {
      copyPluginDist: !isDev,
      enableImportMap: !isDev,
    },
  }
  if (!isDev) {
    options.external = {
      deps: ['vue', 'vue-i18n'],
      staticTargets: [
        {
          src: 'node_modules/vue/dist/vue.esm-browser.prod.js',
          dest: 'libs',
          rename: 'vue.js',
        },
        {
          src: 'node_modules/vue-i18n/dist/vue-i18n.esm-browser.prod.js',
          dest: 'libs',
          rename: 'vue-i18n.js',
        },
      ],
      paths: {
        vue: '/libs/vue.js',
        'vue-i18n': '/libs/vue-i18n.js',
      },
    }
  }

  return options
}

// encrypt configuration
const allObfuscatorConfig = {
  excludes: [],
  enable: true,
  log: true,
  autoExcludeNodeModules: {
    enable: true,
    manualChunks: ['vue-router', 'vue-i18n', 'vue'],
  },
  threadPool: false, // close to avoid memory error
  options: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    // 调试控制_start
    deadCodeInjection: false,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    // 调试控制_end
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: false,
    ignoreImports: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: [],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
  } as ObfuscatorOptions,
}

export default defineConfig(({ command, mode }): UserConfig => {
  console.log(`---- Mode: ${mode} ----\n`)
  const env = loadEnv(mode, process.cwd())
  const isDebug = Boolean(env.VITE_DEBUG_MODE)
  const isDev = command === 'serve'
  const encrypt = Boolean(env.VITE_CODE_ENCRYPTION)

  // 默认插件配置
  const plugins: PluginOption[] = [
    vue(),
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
  ]

  // 插件机制相关处理
  plugins.push(
    // Vue Plugin Architecture with external dependency management
    ...vuePluginArch(createVuePluginArchConfig(isDev))
  )

  // Inspect 插件
  if (isDebug) {
    plugins.push(Inspect())
  }

  // 代码加密
  if (encrypt) {
    plugins.push(vitePluginBundleObfuscator(allObfuscatorConfig))
  }

  const options: UserConfig = {
    build: {
      minify: true,
      sourcemap: isDev,
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
