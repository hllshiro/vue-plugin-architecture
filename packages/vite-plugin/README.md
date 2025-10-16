# @vue-plugin-arch/vite-plugin

Vue 插件架构系统的 Vite 构建插件。

## 概述

这个包提供了 Vite 插件，用于在构建时自动发现和处理 Vue 插件架构系统中的插件，生成虚拟模块和插件注册代码。

> 目前自动发现仅基于项目的`package.json - dependencies`，查找所有以`@vue-plugin-arch/plugin-`开头的包

## 安装

```bash
pnpm add -D @vue-plugin-arch/vite-plugin
```

## 使用

**配置插件**

在你的 `vite.config.ts` 中配置插件：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'

export default defineConfig({
  plugins: [vue(), vuePluginArch()],
})
```

插件会生成下面格式的虚拟模块：

```typescript
// virtual:vue-plugin-arch/plugin-manifest
export default {
  '@vue-plugin-arch/plugin-helloworld': {
    loader: () => import('@vue-plugin-arch/plugin-helloworld'),
    manifest: {
      displayName: 'helloworld',
      name: '@vue-plugin-arch/plugin-helloworld',
      version: '0.1.0',
      description:
        'A simple Hello World plugin demonstrating basic plugin functionality',
      components: [
        {
          name: 'HelloWorldPanel',
          path: './components/HelloWorldPanel.vue',
          defaultPosition: 'center',
          title: 'Hello World',
          icon: '👋',
        },
      ],
      icon: '🤖',
      main: './dist/index.js',
    },
  },
}
```

**在应用中使用**

```typescript
import manifest from 'virtual:vue-plugin-arch/plugin-manifest'
```

manifest 类型为 PluginLoaderMap，详见`@vue-plugin-arch/types`

```typescript
export interface PluginLoaderMap {
  [packageName: string]: PluginLoader
}
```
