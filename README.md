# Vue 插件架构系统

一个基于 Vue 3 + TypeScript + Vite 的现代化插件架构系统，为构建可扩展的前端应用提供插件化生态解决方案。

> **重大问题**
>
> 在插件化的探索工程中，遇到了前端工程化相关的几个问题：
>
> 1.  **Vue实例隔离问题**：如果主应用和每个插件都各自打包自己的Vue库，会导致应用内存在多个不兼容的Vue实例，使得`provide/inject`、全局组件/指令注册、以及`pinia`等状态管理库完全失效。
> 2.  **构建配置复杂性**：为了解决上述问题，所有插件在构建时都必须将`vue`等公共库外部化（external），并依赖主应用在运行时提供这些库。（插件构建后与宿主提供vue对象不匹配等问题）
> 3.  **代码优化限制**：在主应用和插件分离构建的模式下，无法进行有效的跨包代码优化，例如Tree-shaking和代码混淆（会导致API接口名称对不上而调用失败）。
>
> 因此，当前采用的“通过Vite插件在构建时集成”的方案，只是解决上述问题的临时措施。未来会继续探索，寻求有更好的解决方案。(省流：大佬救我)

## ✨ 核心特性

- **🔌 动态插件系统**: 支持运行时插件加载/卸载
- **🎛️ 可视化面板**: 基于 Dockview 的拖拽式面板布局系统（由宿主应用提供）
- **🔄 事件通信**: 基于 mitt 的轻量级事件总线
- **🛡️ 类型安全**: 完整的 TypeScript 类型系统
- **⚡ 自动发现**: 基于 vite 插件提供插件自动发现

## 📁 项目架构

```
vue-plugin-architecture/
├── docs/                           # 项目文档
├── packages/                       # 核心包目录
│   ├── types/                      # 📁 共享类型定义包
│   │
│   ├── core/                       # 📁 核心运行时包
│   │   └── src/
│   │       ├── plugin/             # 插件管理器
│   │       ├── layout/             # 布局管理器
│   │       ├── event/              # 事件总线
│   │       ├── data/               # 数据服务
│   │       ├── proxy/              # 服务代理
│   │       └── error/              # 错误处理
│   │
│   ├── vite-plugin/                # 📁 Vite 构建插件
│   │   └── src/
│   │       ├── index.ts            # 插件主入口
│   │       └── scanner.ts          # 插件扫描器
│   │
│   ├── demo/                       # 📁 示例应用
│   │   └── src/
│   │       ├── main.ts             # 应用入口
│   │       ├── App.vue             # 主应用组件
│   │       └── views/              # 页面视图
│   │
│   └── plugins/                    # 📁 插件包目录
│       └── plugin-helloworld/      # Hello World 示例插件
│
├── pnpm-workspace.yaml             # pnpm 工作空间配置
└── package.json                    # 根目录包配置
```

### 结构说明

| 包名                                 | 描述          | 主要功能                               |
| ------------------------------------ | ------------- | -------------------------------------- |
| `@vue-plugin-arch/types`             | 类型定义包    | 共享 TypeScript 类型定义               |
| `@vue-plugin-arch/core`              | 核心运行时包  | 插件管理、布局管理、事件通信、数据服务 |
| `@vue-plugin-arch/vite-plugin`       | Vite 构建插件 | 插件扫描、虚拟模块生成、热更新支持     |
| `@vue-plugin-arch/demo`              | 示例应用      | 完整的插件系统集成示例                 |
| `@vue-plugin-arch/plugin-helloworld` | 示例插件      | 展示插件开发的基础功能和最佳实践       |

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **包管理器**: pnpm >= 10.0.0

### 主要命令

```bash
# 开发
pnpm dev                    # 启动 demo 应用开发服务器
pnpm type-check            # 全项目类型检查
pnpm lint                  # 代码检查
pnpm format                # 代码格式化

# 构建
pnpm build                 # 构建所有核心包
pnpm build:demo            # 构建 demo 应用
pnpm build:all             # 构建所有包 (包括 demo)

# 其他
pnpm preview               # 预览构建后的 demo 应用
pnpm clean                 # 清理所有构建产物
```

### 示例应用功能

Demo 应用展示了插件系统的核心功能：

- 🏠 **插件系统概览**: 查看已加载的插件和系统状态
- 🔧 **动态插件管理**: 运行时加载/卸载插件
- 📋 **可视化面板布局**: 基于 Dockview 的拖拽式面板系统
- 🔄 **事件通信演示**: 插件间和插件与主应用的事件交互

## 📖 使用指南

### 在现有项目中集成

#### 1. 安装依赖

```bash
# 核心依赖
pnpm add @vue-plugin-arch/types @vue-plugin-arch/core @vue-plugin-arch/vite-plugin

# 必需的第三方依赖
pnpm add dockview-vue mitt vue
```

#### 2. 配置 Vite 插件

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'

export default defineConfig({
  plugins: [vue(), vuePluginArch()],
})
```

#### 3. 初始化插件系统 (main.ts)

在你的应用入口文件 (例如 `main.ts`) 中，创建并提供插件管理器。

```typescript
// src/main.ts
import 'dockview-vue/dist/styles/dockview.css' // 引入 Dockview 样式

import { createApp } from 'vue'
import App from './App.vue'
import { createPluginManager } from '@vue-plugin-arch/core'
import type { IPluginStorage } from '@vue-plugin-arch/types'

// 创建一个插件存储实现 (示例：基于内存的存储)
class MemoryPluginStorage implements IPluginStorage {
  private data = new Map<string, Map<string, unknown>>()

  async get(name: string, key: string): Promise<unknown> {
    const pluginData = this.data.get(name)
    return pluginData?.get(key)
  }

  async set(name: string, key: string, value: unknown): Promise<void> {
    if (!this.data.has(name)) {
      this.data.set(name, new Map<string, unknown>())
    }
    this.data.get(name)!.set(key, value)
  }

  async getAll(name: string): Promise<Record<string, unknown>> {
    const pluginData = this.data.get(name)
    if (!pluginData) {
      return {}
    }
    return Object.fromEntries(pluginData.entries())
  }

  async remove(name: string, key: string): Promise<void> {
    const pluginData = this.data.get(name)
    if (pluginData) {
      pluginData.delete(key)
    }
  }

  async removeAll(name: string): Promise<void> {
    this.data.delete(name)
  }

  async clear(): Promise<void> {
    this.data.clear()
  }
}

const app = createApp(App)

// 创建插件管理器
const pluginManager = createPluginManager(app, new MemoryPluginStorage())

// 将插件管理器提供给整个应用
app.provide('pluginManager', pluginManager)
app.mount('#app')
```

#### 4. 在组件中使用插件布局

在你的根组件 (例如 `App.vue`) 中，集成 `dockview-vue` 并将其与插件系统的布局管理器连接。

```vue
<!-- src/App.vue -->
<template>
  <main class="app-main">
    <!-- Dockview 容器 -->
    <dockview-vue
      class="dockview-container"
      :theme="themeLight"
      @ready="onDockviewReady"
    />
  </main>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { DockviewVue, type DockviewReadyEvent, themeLight } from 'dockview-vue'
import type { IPluginManager } from '@vue-plugin-arch/types'

// 注入插件管理器
const pluginManager = inject<IPluginManager>('pluginManager')

// Dockview 就绪回调
const onDockviewReady = (event: DockviewReadyEvent) => {
  if (pluginManager) {
    // 将 Dockview API 设置到布局管理器
    pluginManager.layoutManager.setDockviewApi(event.api)
  }

  // 你可以在这里添加默认面板
  event.api.addPanel({
    id: 'default-panel',
    component: 'div', // 可以是任意已注册的组件名
    title: 'Welcome',
  })
}
</script>

<style>
.app-main,
.dockview-container {
  height: 100vh;
  width: 100%;
}
</style>
```

### 插件开发

#### 1. 创建插件包

> 插件可以存在于项目 `packages/plugins` 目录中，也可以是独立的仓库，通过 npm/pnpm 安装后即可被识别。

以下是在本仓库中创建插件的示例：

```bash
# 在 packages/plugins/ 目录下创建新插件
mkdir packages/plugins/plugin-my-feature
cd packages/plugins/plugin-my-feature
```

#### 2. 配置插件清单 (package.json)

```json
{
  "name": "@vue-plugin-arch/plugin-my-feature",
  "version": "0.1.0",
  "description": "My awesome feature plugin",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "icon": "🚀",
  "components": [
    {
      "name": "MyFeaturePanel",
      "path": "./components/MyFeaturePanel.vue",
      "title": "My Feature",
      "defaultPosition": "center"
    }
  ],
  "devDependencies": {
    "@vue-plugin-arch/types": "workspace:*"
  }
}
```

#### 3. 实现插件入口

```typescript
// src/index.ts
import type { IPluginServiceProxy, PluginAPI } from '@vue-plugin-arch/types'
import MyFeaturePanel from './components/MyFeaturePanel.vue'

export const install = (proxy: IPluginServiceProxy): PluginAPI => {
  // 注册面板
  const panelId = proxy.registerPanel({
    id: 'my-feature-panel',
    component: MyFeaturePanel,
    title: 'My Feature',
    position: 'center',
  })

  // 获取插件专属数据 API
  const dataAPI = proxy.getDataAPI()

  return {
    teardown: async () => {
      proxy.removePanel(panelId)
      await dataAPI.removeAll()
    },
  }
}
```

#### 4. 创建插件组件

```vue
<!-- src/components/MyFeaturePanel.vue -->
<template>
  <div class="my-feature-panel">
    <h3>{{ title }}</h3>
    <button @click="doSomething">执行功能</button>
    <p v-if="result">结果: {{ result }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IPluginServiceProxy } from '@vue-plugin-arch/types'

const props = defineProps<{
  title?: string
  // 核心：插件服务代理通过 props 注入
  proxy: IPluginServiceProxy
}>()

const result = ref('')

const doSomething = async () => {
  result.value = 'Feature executed!'

  // 通过 props.proxy 调用核心 API
  props.proxy.eventBus.emit('my-feature:executed', {
    timestamp: Date.now(),
  })
}
</script>
```

## 📦 构建

```bash
# 构建所有核心包 (按依赖顺序)
pnpm build

# 构建特定包 (等价于 pnpm build)
pnpm build:types          # 构建类型定义包
pnpm build:core           # 构建核心运行时包
pnpm build:vite-plugin    # 构建 Vite 插件包
pnpm build:plugins        # 构建所有插件包

# 构建示例应用
pnpm build:demo           # 构建 demo 应用
pnpm build:all            # 构建所有包 (包括 demo)

# 清理构建产物
pnpm clean
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- **技术文档**
  - [Vue 3 文档](https://vuejs.org/)
  - [Vite 文档](https://vitejs.dev/)
  - [TypeScript 文档](https://www.typescriptlang.org/) - 类型系统
  - [pnpm 文档](https://pnpm.io/) - 包管理器
  - [Dockview 文档](https://dockview.dev/) - 面板布局系统
  - [mitt 文档](https://github.com/developit/mitt) - 事件总线

- **项目文档**
  - [架构设计文档](docs/vue-plugin-arch-design.md) - 详细的架构说明

---

<div align="center">

**Vue 插件架构系统** - 让你的 Vue 应用具备扩展能力

Made with ❤️ by hllshiro

</div>
