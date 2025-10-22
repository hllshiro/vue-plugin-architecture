# 插件开发指南

本指南将通过一个具体的“Hello World”示例，一步步教您如何为本系统创建、构建和运行一个新插件。

## 准备工作

在开始之前，请确保您已经拥有一个集成了本框架核心库（`@vue-plugin-arch/core`）的主应用项目，类似于本仓库中的 `demo` 包。

### 新的URL-based加载机制

从最新版本开始，插件系统采用URL-based的动态加载机制：

- **开发模式**: 使用 `/@fs/` URL直接访问本地构建产物
- **构建模式**: 通过importMap和静态资源支持远程插件加载
- **混合部署**: 支持本地插件和远程插件的同时使用

## 第一步：创建插件目录和 `package.json`

所有的插件都应存放在 `packages/plugins/` 目录下。

1.  在 `packages/plugins/` 下创建一个新目录，例如 `my-first-plugin`。

2.  在该目录中创建一个 `package.json` 文件。这个文件是插件的身份标识，至关重要。

    ```json
    // packages/plugins/my-first-plugin/package.json
    {
      "name": "@my-scope/my-first-plugin",
      "version": "1.0.0",
      "description": "My first plugin for the Vue Plugin Arch.",
      "main": "dist/index.js",
      "types": "dist/index.d.ts",
      "scripts": {
        "build": "vite build"
      },
      "dependencies": {
        "vue": "^3.0.0"
      },
      "devDependencies": {
        "@vue-plugin-arch/types": "workspace:*",
        "vite": "^5.0.0",
        "typescript": "^5.0.0"
      }
    }
    ```

    - **`name`**: 插件的唯一包名，系统通过它来识别和加载插件。
    - **`main`**: 插件构建后JavaScript入口文件的路径，系统将基于此生成加载URL。

## 第二步：创建插件入口文件

在 `my-first-plugin` 目录下创建 `src/index.ts`。这是插件的逻辑入口，必须导出一个 `install` 方法。

```typescript
// packages/plugins/my-first-plugin/src/index.ts

import type { IPluginServiceProxy, PluginAPI } from '@vue-plugin-arch/types'
import MyPanel from './components/MyPanel.vue'

// 定义一个在插件内部唯一的组件名
const MY_PANEL_COMPONENT_KEY = 'MyFirstPlugin.Panel'

// 插件的安装方法
export const install = (proxy: IPluginServiceProxy): PluginAPI => {
  // 1. 注册Vue组件
  proxy.layoutApi.registerComponent(MY_PANEL_COMPONENT_KEY, MyPanel)

  // 2. 注册UI面板
  const panelId = proxy.layoutApi.registerPanel({
    id: 'my-first-plugin-panel',
    component: MY_PANEL_COMPONENT_KEY, // 使用上面注册的组件名
    title: 'My First Plugin',
    position: 'center',
    params: {
      // 这些参数会作为props传递给MyPanel.vue
      message: 'Hello from Plugin Development Guide!',
    },
  })

  console.log('My First Plugin has been installed!')

  // 3. 返回一个包含teardown方法的API对象，用于卸载时清理
  return {
    teardown: async () => {
      // 移除面板和组件，防止内存泄漏
      proxy.layoutApi.removePanel(panelId)
      proxy.layoutApi.unregisterComponent(MY_PANEL_COMPONENT_KEY)
      console.log('My First Plugin has been uninstalled!')
    },
  }
}
```

## 第三步：创建Vue组件

现在，创建插件要显示的UI界面。

1.  创建 `src/components/MyPanel.vue` 文件。

2.  编写组件代码。注意，`proxy` 对象和在 `registerPanel` 中传递的 `params` 都会作为 `props` 注入到组件中。

    ```vue
    <!-- packages/plugins/my-first-plugin/src/components/MyPanel.vue -->
    <template>
      <div class="my-panel">
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
        <button @click="sayHello">Say Hello via Event Bus</button>
      </div>
    </template>

    <script setup lang="ts">
    import type { IPluginServiceProxy } from '@vue-plugin-arch/types';

    // 定义组件接收的props
    interface Props {
      title?: string;
      message?: string;
      proxy: IPluginServiceProxy;
    }
    const props = defineProps<Props>();

    // 使用proxy来调用核心API
    const sayHello = () => {
      props.proxy.eventApi.emit('my-plugin:hello', { text: 'Hello, World!' });
      alert(''Hello' event emitted! Check the console of other plugins listening to this event.');
    };
    </script>

    <style scoped>
    .my-panel {
      padding: 20px;
      background-color: #f0f8ff;
      border: 1px solid #add8e6;
      border-radius: 8px;
      height: 100%;
    }
    </style>
    ```

## 第四步：配置构建

插件需要被编译成标准的JavaScript。我们可以使用Vite来完成这个任务。

1.  在 `my-first-plugin` 目录下创建 `vite.config.ts`。

    ```typescript
    // packages/plugins/my-first-plugin/vite.config.ts
    import { defineConfig } from 'vite'
    import vue from '@vitejs/plugin-vue'
    import path from 'path'

    export default defineConfig({
      plugins: [vue()],
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'MyFirstPlugin',
          fileName: format => `index.${format}.js`,
        },
        rollupOptions: {
          // 确保外部化处理那些你不想打包进库的依赖
          external: ['vue'],
          output: {
            globals: {
              vue: 'Vue',
            },
          },
        },
      },
    })
    ```

## 第五步：构建和运行

1.  **构建插件**: 在项目根目录下，运行构建命令。

    ```bash
    # pnpm
    pnpm --filter @my-scope/my-first-plugin build

    # npm
    # npm run build -w packages/plugins/my-first-plugin
    ```

2.  **运行主应用**: 启动 `demo` 应用。

    ```bash
    pnpm dev
    ```

    `@vue-plugin-arch/vite-plugin` 会在Vite启动时自动扫描并发现你新构建的插件，为其生成 `/@fs/` URL。

3.  **获取插件注册表**: 主应用通过 `/api/plugin-registry.json` 端点获取可用插件列表。

4.  **加载插件**: 在 `demo` 应用中，通过UI选择插件并调用 `pluginManager.loadPlugin(manifest)`，其中manifest包含插件的URL。系统将使用 `import(pluginUrl)` 动态加载插件模块。

## 远程插件部署

### 构建配置

对于远程部署的插件，需要特殊的构建配置以确保兼容性：

```typescript
// vite.config.ts for remote plugin
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePluginCssInjectedByJs } from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    vue(),
    vitePluginCssInjectedByJs(), // 将CSS注入到JS中
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'], // 只构建ES模块格式
      fileName: 'index',
    },
    rollupOptions: {
      // 外部化公共依赖
      external: ['vue', 'vue-i18n'],
      output: {
        // 全局变量映射（如果需要）
        globals: {
          vue: 'Vue',
          'vue-i18n': 'VueI18n',
        },
      },
    },
    target: 'es2020', // 现代浏览器目标
  },
})
```

### 部署到CDN

1. **构建插件**:

   ```bash
   pnpm build
   ```

2. **上传到CDN**: 将 `dist/` 目录的内容上传到CDN或静态文件服务器。

3. **配置插件注册表**: 在主应用的静态注册表中添加远程插件：

```json
// packages/demo/public/api/plugin-registry.json
{
  "plugins": [
    {
      "name": "@my-org/remote-plugin",
      "version": "1.0.0",
      "description": "A remote plugin",
      "main": "dist/index.js",
      "url": "https://cdn.example.com/plugins/my-plugin/1.0.0/index.js",
      "icon": "🌐",
      "components": [
        {
          "name": "RemotePanel",
          "path": "./components/RemotePanel.vue",
          "title": "Remote Panel",
          "defaultPosition": "center"
        }
      ]
    }
  ],
  "version": "1.0.0",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### CORS配置

如果插件部署在不同域名，需要配置CORS头：

```nginx
# Nginx配置示例
location /plugins/ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods GET,OPTIONS;
    add_header Access-Control-Allow-Headers Content-Type;
}
```

## 最佳实践

### 1. 依赖管理

- 将Vue等公共库外部化，避免重复打包
- 使用peerDependencies声明对主应用的依赖要求
- 保持插件体积小巧，提高加载速度

### 2. 版本控制

- 在插件URL中包含版本号
- 使用语义化版本控制
- 提供向后兼容的API

### 3. 错误处理

- 在install函数中添加错误处理
- 提供有意义的错误信息
- 实现优雅的降级策略

### 4. 开发调试

- 使用浏览器开发者工具调试插件加载
- 在开发模式下利用热重载功能
- 添加详细的日志输出

## 故障排除

### 常见问题

1. **插件未被发现**
   - 确认插件已正确构建
   - 检查package.json的main字段
   - 验证插件目录结构

2. **模块加载失败**
   - 检查插件的依赖外部化配置
   - 确认importMap配置正确
   - 验证插件URL的可访问性

3. **CORS错误**
   - 配置服务器的CORS头
   - 使用相同域名部署
   - 考虑使用代理服务器

通过遵循这些指南和最佳实践，您可以成功开发和部署支持URL动态加载的Vue插件。
