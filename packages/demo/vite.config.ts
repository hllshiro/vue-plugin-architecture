import { defineConfig, loadEnv, UserConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import {
  StaticCopyTarget,
  vuePluginArch,
  VuePluginArchOptions,
} from '@vue-plugin-arch/vite-plugin'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'

// Vue Plugin Architecture configuration
const VUE_PLUGIN_ARCH_CONFIG: VuePluginArchOptions = {
  externalDeps: ['vue', 'vue-i18n'],
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
  ] as StaticCopyTarget[],
  globals: {
    vue: 'Vue',
    'vue-i18n': 'VueI18n',
  },
  paths: {
    vue: '/libs/vue.js',
    'vue-i18n': '/libs/vue-i18n.js',
  },
  importMapPlaceholder:
    '<!-- !!!KEEP THIS!!! Import map will be injected by Vite -->',
  registryEndpoint: '/api/plugin-registry.json',
}

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

export default defineConfig(({ mode }): UserConfig => {
  console.log(`---- Mode: ${mode} ----\n`)
  const env = loadEnv(mode, process.cwd())
  const isDev = Boolean(env.VITE_DEBUG_MODE)

  const plugins = [
    vue(),
    // Vue Plugin Architecture with external dependency management
    ...vuePluginArch({
      // Use ES module versions for better compatibility
      externalDeps: isDev ? [] : VUE_PLUGIN_ARCH_CONFIG.externalDeps,
      staticTargets: isDev ? [] : VUE_PLUGIN_ARCH_CONFIG.staticTargets,
      globals: VUE_PLUGIN_ARCH_CONFIG.globals,
      paths: VUE_PLUGIN_ARCH_CONFIG.paths,
      importMapPlaceholder: VUE_PLUGIN_ARCH_CONFIG.importMapPlaceholder,
      registryEndpoint: VUE_PLUGIN_ARCH_CONFIG.registryEndpoint,
      enableExternalDeps: !isDev,
      enableStaticCopy: !isDev,
    }),
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
    vitePluginBundleObfuscator(allObfuscatorConfig),
  ]

  if (isDev) {
    plugins.push(Inspect())
  }

  const options: UserConfig = {
    build: {
      minify: true,
      sourcemap: isDev,
      rollupOptions: {
        output: {
          // Ensure proper ES module format for dynamic import
          format: 'es',
          // Preserve module structure for better tree-shaking
          preserveModules: false,
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
