import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import autoImportGlobals from './.eslintrc-auto-import.json' with { type: 'json' }

// 将旧版 globals 转换为 Flat Config 支持的格式
const flatAutoImportGlobals = Object.entries(autoImportGlobals.globals).reduce(
  (acc, [key, value]) => {
    acc[key] = value ? 'readonly' : 'off' // Flat Config 中 globals 取值为 'readonly' | 'writable' | 'off'
    return acc
  },
  {}
)

export default [
  {
    // 忽略文件
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      'coverage/**',
      '**/dist/**',
      '**/.vite/**',
    ],
  },

  // 基础配置
  js.configs.recommended,
  // Node.js scripts and config files
  {
    files: [
      'scripts/**/*.js',
      'packages/*/scripts/**/*.js',
      '**/*.config.js',
      '**/*.config.ts',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript 文件配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      semi: ['error', 'never'], // 禁用行尾分号
    },
  },

  // Vue 文件配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: typescriptParser,
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      vue,
      '@typescript-eslint': typescript,
    },
    rules: {
      ...vue.configs['vue3-recommended'].rules,
      ...typescript.configs.recommended.rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      'vue/script-setup-uses-vars': 'error',
      '@typescript-eslint/no-unused-vars': 'off', // Vue 文件中关闭，使用 vue/no-unused-vars
    },
  },

  // 通用规则
  {
    files: ['**/*.js', '**/*.ts', '**/*.vue'],
    rules: {
      'no-console': 'off', // 开发阶段允许 console
      'no-debugger': 'off', // 开发阶段允许 debugger
      'prefer-const': 'error',
      'no-var': 'error',
      semi: ['error', 'never'], // 禁用行尾分号
    },
    languageOptions: {
      globals: {
        ...flatAutoImportGlobals,
      },
    },
  },

  // Prettier 配置 - 必须放在最后，禁用与 Prettier 冲突的规则
  prettierConfig,
]
