# Vite 插件用法 (`@vue-plugin-arch/vite-plugin`)

`@vue-plugin-arch/vite-plugin` 是本插件化架构中一个至关重要的**构建时**工具。它通过importMap机制和插件注册表服务，实现了dev和build模式下通过URL动态加载预构建插件的统一解决方案。

## 核心功能

1.  **插件注册表服务**: 提供 `/api/plugin-registry.json` HTTP端点，动态合并本地插件和远程插件清单。

2.  **本地插件扫描**: 自动扫描项目 `packages/plugins/` 目录，为每个插件生成 `/@fs/` URL用于开发模式的直接访问。

3.  **importMap注入**: 在构建模式下，自动向HTML注入importMap配置，支持外部依赖的模块解析和CDN加载。

4.  **静态资源管理**: 复制外部依赖到构建输出目录，确保运行时模块解析的可用性。

5.  **热更新 (HMR)**: 在开发模式下监听插件文件变化，自动更新插件注册表，支持插件的热重载。

## 工作原理

### 开发模式

1.  **注册表端点**: 插件拦截 `/api/plugin-registry.json` 请求，动态生成插件注册表响应。

2.  **本地插件扫描**: 扫描 `packages/plugins/` 目录，为每个插件生成 `/@fs/` URL指向其构建产物：

    ```javascript
    // 开发模式下的插件注册表响应示例
    {
      "plugins": [
        {
          "name": "@vue-plugin-arch/plugin-helloworld",
          "version": "1.0.0",
          "url": "/@fs/D:/project/packages/plugins/plugin-helloworld/dist/index.js",
          "main": "dist/index.js",
          // ...其他元数据
        }
      ],
      "version": "1.0.0",
      "lastUpdated": "2024-01-01T00:00:00.000Z"
    }
    ```

3.  **动态加载**: 主应用通过 `import(pluginUrl)` 直接加载插件模块。

### 构建模式

1.  **importMap注入**: 在HTML中注入importMap配置：

    ```html
    <script type="importmap">
      {
        "imports": {
          "vue": "/libs/vue.js",
          "vue-i18n": "/libs/vue-i18n.js"
        }
      }
    </script>
    ```

2.  **静态资源复制**: 将外部依赖复制到 `/libs/` 目录，支持运行时解析。

3.  **远程插件支持**: 插件注册表可包含远程URL，支持CDN或其他服务器上的预构建插件。

## 如何使用

### 基础配置

1.  **安装依赖**:

    ```bash
    pnpm add -D @vue-plugin-arch/vite-plugin
    ```

2.  **配置 `vite.config.ts`**: 在你的主应用的 `vite.config.ts` 文件中配置插件。

    ```typescript
    import { defineConfig } from 'vite'
    import vue from '@vitejs/plugin-vue'
    import { vuePluginArch } from '@vue-plugin-arch/vite-plugin'

    export default defineConfig({
      plugins: [
        vue(),
        ...vuePluginArch({
          // 外部依赖配置（构建模式）
          externalDeps: ['vue', 'vue-i18n'],
          // 静态资源复制配置
          staticTargets: [
            {
              src: 'node_modules/vue/dist/vue.esm-browser.prod.js',
              dest: 'libs',
              rename: 'vue.js',
            },
          ],
          // importMap路径映射
          paths: {
            vue: '/libs/vue.js',
            'vue-i18n': '/libs/vue-i18n.js',
          },
          // 插件注册表端点
          registryEndpoint: '/api/plugin-registry.json',
        }),
      ],
    })
    ```

### 高级配置选项

```typescript
interface VuePluginArchOptions {
  // 外部依赖列表（构建时外部化）
  externalDeps?: string[]

  // 静态资源复制目标
  staticTargets?: StaticCopyTarget[]

  // importMap路径映射
  paths?: Record<string, string>

  // 是否启用外部依赖管理
  enableExternalDeps?: boolean

  // 是否启用静态资源复制
  enableStaticCopy?: boolean

  // 是否启用importMap注入
  enableImportMap?: boolean

  // HTML中的importMap占位符
  importMapPlaceholder?: string

  // 插件注册表端点路径
  registryEndpoint?: string
}
```

### 远程插件配置

创建静态插件注册表文件 `packages/demo/public/api/plugin-registry.json`：

```json
{
  "plugins": [
    {
      "name": "@my-org/remote-plugin",
      "version": "1.0.0",
      "description": "A remote plugin",
      "main": "dist/index.js",
      "url": "https://cdn.example.com/plugins/remote-plugin/1.0.0/index.js",
      "icon": "🌐"
    }
  ],
  "version": "1.0.0",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

完成配置后，系统将自动：

- 在开发模式下提供插件注册表服务
- 在构建模式下注入importMap和复制静态资源
- 支持本地插件和远程插件的混合加载
