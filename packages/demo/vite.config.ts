import { defineConfig, loadEnv, UserConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'

export default defineConfig(({ mode }): UserConfig => {
  console.log(`---- Mode: ${mode} ----\n`)
  const plugins = [vue(), vuePluginArch()]

  const env = loadEnv(mode, process.cwd())
  const debug = env.VITE_DEBUG_MODE
  if (debug) {
    plugins.push(Inspect())
  }

  const options: UserConfig = {
    build: {
      minify: false, // Diagnostic step to disable minification
      sourcemap: true,
      rollupOptions: {
        output: {
          compact: false, // Prevent export aliasing
          manualChunks: {
            vue: ['vue'], // Create a chunk named 'vue' from the 'vue' package
          },
          chunkFileNames: chunkInfo => {
            if (chunkInfo.name === 'vue') {
              return 'assets/vue.js' // Name the vue chunk predictably
            }
            return 'assets/[name]-[hash].js' // Keep hashes for other chunks
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
    },
  }

  return options
})
