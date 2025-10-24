# @vue-plugin-arch/vite-plugin

Vue 插件架构系统的 Vite 构建插件，提供插件自动发现、importMap 机制和统一的开发/构建模式支持。

## 概述

这个包提供了 Vite 插件，用于：

- **插件自动发现**: 扫描 `packages/plugins/` 目录中的本地插件
- **ImportMap 机制**: 统一开发和生产环境的模块解析
- **外部依赖管理**: 自动外部化共享依赖并复制到静态目录
- **插件注册表**: 提供动态插件注册表端点
- **热更新支持**: 开发模式下的插件热重载

## 核心特性

### ImportMap 机制

ImportMap 是实现统一插件加载的核心机制：

- **开发模式**: 使用 `/@fs/` URL 直接访问本地文件系统
- **构建模式**: 注入 importMap 配置，支持远程插件加载
- **统一接口**: 开发和生产环境使用相同的插件加载 API

### 插件发现策略

1. **本地插件**: 扫描 `packages/plugins/plugin-*` 目录
2. **静态注册表**: 读取预定义的插件注册表文件
3. **合并策略**: 本地插件优先，远程插件补充

## 安装

```bash
pnpm add -D @vue-plugin-arch/vite-plugin
```

## 配置选项

### 完整配置示例

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {
  vuePluginArch,
  VuePluginArchOptions,
} from '@vue-plugin-arch/vite-plugin'

const vuePluginArchConfig: VuePluginArchOptions = {
  // 工作空间配置
  workspace: {
    root: path.resolve(__dirname, '../..'),
    pluginsDir: 'packages/plugins',
  },

  // 外部依赖配置（仅构建模式）
  external: {
    deps: ['vue', 'vue-i18n', 'vue-router'],
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
  },

  // 插件注册表配置
  registry: {
    endpoint: '/api/plugin-registry.json',
    staticPath: 'public/api/plugin-registry.json',
  },

  // 构建配置
  build: {
    copyPluginDist: true,
    enableImportMap: true,
  },
}

export default defineConfig({
  plugins: [vue(), ...vuePluginArch(vuePluginArchConfig)],
})
```

### 配置选项详解

#### workspace

- `root`: 工作空间根目录
- `pluginsDir`: 插件目录相对路径

#### external (可选)

- `deps`: 需要外部化的依赖列表
- `staticTargets`: 静态文件复制配置
- `paths`: importMap 路径映射

#### registry

- `endpoint`: 插件注册表 API 端点
- `staticPath`: 静态注册表文件路径

#### build

- `copyPluginDist`: 是否复制插件构建产物
- `enableImportMap`: 是否启用 importMap 自动注入（注入到 `</head>` 标签前）

## 开发模式 vs 构建模式

### 开发模式特性

```typescript
// 开发模式下的插件 URL 示例
{
  "name": "@vue-plugin-arch/plugin-helloworld",
  "url": "/@fs/C:/project/packages/plugins/plugin-helloworld/src/index.ts"
}
```

- 使用 `/@fs/` URL 直接访问源码
- 支持 TypeScript 和 Vue 文件热重载
- 提供实时插件注册表端点
- 无需构建即可开发插件

### 构建模式特性

```typescript
// 构建模式下的插件 URL 示例
{
  "name": "@vue-plugin-arch/plugin-helloworld",
  "url": "/plugins/plugin-helloworld/index.js"
}
```

- 自动注入 importMap 到 HTML 的 `</head>` 标签前
- 复制外部依赖到 `/libs/` 目录
- 生成静态插件注册表文件
- 支持远程插件加载

## 插件注册表格式

插件注册表是一个 JSON 文件，包含所有可用插件的元数据：

```json
{
  "plugins": [
    {
      "name": "@vue-plugin-arch/plugin-helloworld",
      "displayName": "Hello World",
      "version": "0.1.0",
      "description": "A simple Hello World plugin",
      "url": "/plugins/plugin-helloworld/index.js",
      "icon": "👋",
      "components": [
        {
          "name": "HelloWorldPanel",
          "path": "./components/HelloWorldPanel.vue",
          "title": "Hello World",
          "defaultPosition": "center",
          "icon": "👋"
        }
      ]
    }
  ],
  "version": "1.0.0",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

## 插件开发要求

### 构建配置

所有插件必须配置为动态加载：

```typescript
// plugin vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    vue(),
    dts(),
    cssInjectedByJsPlugin(), // 必需：CSS 注入到 JS
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'], // 仅 ES 模块格式
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'], // 外部化共享依赖
    },
    target: 'es2020', // 现代浏览器支持
  },
})
```

### package.json 要求

```json
{
  "name": "@vue-plugin-arch/plugin-example",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "icon": "🚀",
  "components": [
    {
      "name": "ExamplePanel",
      "path": "./components/ExamplePanel.vue",
      "title": "Example",
      "defaultPosition": "center",
      "icon": "🚀"
    }
  ]
}
```

## 兼容性说明

### 浏览器兼容性

- **ES Modules**: 需要支持 ES2020+ 的现代浏览器
- **ImportMap**: Chrome 89+, Firefox 108+, Safari 16.4+
- **Dynamic Import**: Chrome 63+, Firefox 67+, Safari 11.1+

### 降级策略

对于不支持 importMap 的浏览器，可以使用 polyfill：

```html
<script
  async
  src="https://ga.jspm.io/npm:es-module-shims@1.8.0/dist/es-module-shims.js"
></script>
```

### Node.js 版本

- **最低要求**: Node.js >= 18.0.0
- **推荐版本**: Node.js >= 20.0.0

## 故障排除

### 常见问题

1. **插件加载失败**

   ```bash
   # 检查插件注册表
   curl http://localhost:5173/api/plugin-registry.json
   ```

2. **模块解析错误**

   ```javascript
   // 浏览器控制台检查 importMap
   console.log(document.querySelector('script[type="importmap"]')?.textContent)
   ```

3. **CORS 错误**
   - 确保远程插件服务器配置了正确的 CORS 头
   - 或使用同源部署

4. **依赖冲突**
   - 检查插件是否正确外部化了共享依赖
   - 确保版本兼容性

### 调试命令

```bash
# 测试插件注册表端点
curl http://localhost:5173/api/plugin-registry.json | jq '.'

# 检查特定插件
curl -s http://localhost:5173/api/plugin-registry.json | jq '.plugins[] | select(.name=="@vue-plugin-arch/plugin-helloworld")'

# 验证静态资源
curl -I http://localhost:5173/libs/vue.js
```

## API 参考

### VuePluginArchOptions

```typescript
interface VuePluginArchOptions {
  workspace: {
    root: string
    pluginsDir: string
  }
  external?: {
    deps: string[]
    staticTargets: StaticCopyTarget[]
    paths: Record<string, string>
  }
  registry: {
    endpoint: string
    staticPath: string
  }
  build: {
    copyPluginDist: boolean
    enableImportMap: boolean
  }
}
```

### StaticCopyTarget

```typescript
interface StaticCopyTarget {
  src: string
  dest: string
  rename?: string
}
```
