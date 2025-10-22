# Vite 插件用法 (`@vue-plugin-arch/vite-plugin`)

`@vue-plugin-arch/vite-plugin` 是本插件化架构中一个至关重要的**构建时**工具。它通过 ImportMap 机制和插件注册表服务，实现了开发和构建模式下通过 URL 动态加载插件的统一解决方案。

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
    import {
      vuePluginArch,
      VuePluginArchOptions,
    } from '@vue-plugin-arch/vite-plugin'
    import path from 'path'

    const createVuePluginArchConfig = (
      isDev: boolean
    ): VuePluginArchOptions => {
      const options: VuePluginArchOptions = {
        workspace: {
          root: path.resolve(__dirname, '../..'),
          pluginsDir: 'packages/plugins',
        },
        registry: {
          endpoint: '/api/plugin-registry.json',
          staticPath: 'public/api/plugin-registry.json',
        },
        build: {
          copyPluginDist: !isDev,
          enableImportMap: !isDev,
        },
      }

      // 仅在构建模式下配置外部依赖
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

    export default defineConfig(({ command }) => ({
      plugins: [
        vue(),
        ...vuePluginArch(createVuePluginArchConfig(command === 'serve')),
      ],
    }))
    ```

### 高级配置选项

```typescript
interface VuePluginArchOptions {
  // 工作空间配置
  workspace: {
    root: string // 工作空间根目录
    pluginsDir: string // 插件目录相对路径
  }

  // 外部依赖配置（可选，仅构建模式）
  external?: {
    deps: string[] // 外部依赖列表
    staticTargets: StaticCopyTarget[] // 静态资源复制目标
    paths: Record<string, string> // ImportMap 路径映射
  }

  // 插件注册表配置
  registry: {
    endpoint: string // 注册表 API 端点
    staticPath: string // 静态注册表文件路径
  }

  // 构建配置
  build: {
    copyPluginDist: boolean // 是否复制插件构建产物
    enableImportMap: boolean // 是否启用 ImportMap 自动注入（注入到 </head> 前）
  }
}

interface StaticCopyTarget {
  src: string // 源文件路径
  dest: string // 目标目录
  rename?: string // 重命名文件（可选）
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
- 在构建模式下注入 ImportMap 和复制静态资源
- 支持本地插件和远程插件的混合加载

## ImportMap 兼容性

### 浏览器支持

| 浏览器  | 最低版本 | ImportMap 支持 | 备注          |
| ------- | -------- | -------------- | ------------- |
| Chrome  | 89+      | ✅ 原生支持    | 推荐使用      |
| Edge    | 89+      | ✅ 原生支持    | 基于 Chromium |
| Firefox | 108+     | ✅ 原生支持    | 完全兼容      |
| Safari  | 16.4+    | ✅ 原生支持    | 需要较新版本  |

详情请查看 [Can I use ImportMap?](https://caniuse.com/?search=ImportMap)

### 降级策略

对于不支持 ImportMap 的旧版浏览器，可以添加 polyfill：

```html
<!-- 在 index.html 的 <head> 中添加 -->
<script
  async
  src="https://ga.jspm.io/npm:es-module-shims@1.8.0/dist/es-module-shims.js"
></script>
```

## 故障排除

### 常见问题

#### 1. 插件加载失败

**症状**: 控制台显示插件加载错误

**解决方案**:

```bash
# 检查插件注册表端点
curl http://localhost:5173/api/plugin-registry.json

# 验证插件 URL 是否可访问
curl -I http://localhost:5173/@fs/path/to/plugin/index.js
```

#### 2. ImportMap 未注入

**症状**: 构建后的 HTML 中没有 importMap 脚本

**解决方案**:

- 确保 HTML 模板中包含 `</head>` 标签
- 检查 `enableImportMap` 配置是否为 `true`
- 验证构建模式下是否正确配置了 `external.paths`

#### 3. 模块解析错误

**症状**: 运行时出现模块解析失败

**解决方案**:

```javascript
// 在浏览器控制台检查 ImportMap
console.log(document.querySelector('script[type="importmap"]')?.textContent)

// 验证静态资源是否存在
fetch('/libs/vue.js').then(r => console.log(r.status))
```

#### 4. CORS 错误

**症状**: 远程插件加载时出现跨域错误

**解决方案**:

- 配置远程服务器的 CORS 头
- 或使用同源部署策略

### 调试技巧

#### 开发模式调试

```bash
# 检查插件注册表
curl http://localhost:5173/api/plugin-registry.json | jq '.'

# 验证特定插件
curl -s http://localhost:5173/api/plugin-registry.json | \
  jq '.plugins[] | select(.name=="@vue-plugin-arch/plugin-helloworld")'

# 测试插件文件访问
curl -I "http://localhost:5173/@fs/$(pwd)/packages/plugins/plugin-helloworld/dist/index.js"
```

#### 构建模式调试

```bash
# 检查静态资源
ls -la dist/libs/
ls -la dist/plugins/

# 验证注册表文件
cat dist/api/plugin-registry.json | jq '.'

# 测试静态服务器
python -m http.server 8000 -d dist
curl http://localhost:8000/api/plugin-registry.json
```

#### 浏览器调试

```javascript
// 检查 ImportMap 配置
const importMap = document.querySelector('script[type="importmap"]')
console.log('ImportMap:', JSON.parse(importMap.textContent))

// 测试模块解析
import('vue').then(Vue => console.log('Vue loaded:', Vue))

// 手动测试插件加载
fetch('/api/plugin-registry.json')
  .then(r => r.json())
  .then(registry => {
    const plugin = registry.plugins[0]
    return import(plugin.url)
  })
  .then(pluginModule => console.log('Plugin loaded:', pluginModule))
  .catch(error => console.error('Plugin load failed:', error))
```

### 性能优化

#### 1. 预加载关键资源

```html
<!-- 预加载核心依赖 -->
<link rel="modulepreload" href="/libs/vue.js" />
<link rel="modulepreload" href="/libs/vue-i18n.js" />

<!-- 预加载关键插件 -->
<link rel="modulepreload" href="/plugins/plugin-core/index.js" />
```

#### 2. 启用压缩

```nginx
# Nginx 配置示例
location ~* \.(js|css)$ {
    gzip on;
    gzip_types application/javascript text/css;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 3. CDN 优化

```typescript
// 使用 CDN 加速外部依赖
const options: VuePluginArchOptions = {
  external: {
    paths: {
      vue: 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js',
      'vue-i18n':
        'https://unpkg.com/vue-i18n@9/dist/vue-i18n.esm-browser.prod.js',
    },
  },
}
```
