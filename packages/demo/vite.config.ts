import { defineConfig, loadEnv, UserConfig } from 'vite'
import path from 'path'
import { cpus } from 'os'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'

// 获取CPU核心数，设置线程池大小为核心数-1
const cpuCores = cpus().length
const threadPoolSize = Math.max(1, cpuCores - 1)
console.log(`CPU cores: ${cpuCores}, Thread pool size: ${threadPoolSize}`)

const allObfuscatorConfig = {
  excludes: [],
  enable: true,
  log: true,
  autoExcludeNodeModules: {
    enable: true,
    manualChunks: ['vue-router', 'vue-i18n', 'vue'],
  },
  threadPool: {
    enable: true,
    size: threadPoolSize,
  },
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
  const plugins = [
    vue(),
    vuePluginArch(),
    vitePluginBundleObfuscator(allObfuscatorConfig),
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
        output: {
          compact: true,
          /* manualChunks: {
            vue: ['vue'],
          }, */
          /* chunkFileNames: chunkInfo => {
            if (chunkInfo.name === 'vue') {
              return 'assets/vue.js' // Name the vue chunk predictably
            }
            return 'assets/[name]-[hash].js' // Keep hashes for other chunks
          }, */
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
    },
  }

  return options
})
