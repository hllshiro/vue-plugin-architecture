# 插件开发指南

本指南将通过一个具体的“Hello World”示例，一步步教您如何为本系统创建、构建和运行一个新插件。

## 准备工作

在开始之前，请确保您已经拥有一个集成了本框架核心库（`@layout-plugin-loader/core`）的主应用项目，类似于本仓库中的 `demo` 包。

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
    - **`main`**: 插件构建后JavaScript入口文件的路径。

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

    `@layout-plugin-loader/vite-plugin` 会在Vite启动时自动扫描并发现你新构建的插件。

3.  **加载插件**: 在 `demo` 应用中，通过UI或其他方式调用 `pluginManager.loadPlugin('@my-scope/my-first-plugin')`。一旦调用，你就会在控制台看到安装日志，并且你新创建的面板会出现在指定的布局位置。
