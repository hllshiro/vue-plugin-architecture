# Vite 插件用法 (`@layout-plugin-loader/vite-plugin`)

`@layout-plugin-loader/vite-plugin` 是本插件化架构中一个至关重要的**构建时**工具。它不是一个运行时库，而是一个在开发和构建阶段自动发现插件、并为核心运行时库生成插件清单的Vite插件。

## 核心功能

1.  **自动插件扫描**: 插件会自动扫描项目 `packages/plugins/` 目录，识别所有合法的插件包（即包含 `package.json` 的目录）。

2.  **生成插件清单**: 它会创建一个名为 `virtual:vue-plugin-arch/plugin-manifest` 的虚拟模块。这个模块在文件系统中并不真实存在，是在内存中动态生成的。它导出了一个包含所有已发现插件信息的对象。

3.  **按需加载支持**: 生成的清单中的每个插件都对应一个动态的 `import()` 加载器函数。这确保了插件代码不会被打包进主应用的核心代码束（bundle）中，从而实现了真正的按需加载（Code Splitting）。

4.  **热更新 (HMR)**: 在开发模式下，该插件会启动一个文件监视器（watcher）。当任何插件的源文件、`package.json` 或构建产物发生变化时，它会自动使插件清单失效并触发模块重载，开发者无需手动刷新页面即可看到变更，提供了流畅的开发体验。

## 工作原理

1.  **拦截导入**: 当你的代码（通常是 `@layout-plugin-loader/core` 中的 `PluginManager`）尝试导入 `virtual:vue-plugin-arch/plugin-manifest` 时，Vite会将这个请求交由本插件的 `load` 钩子处理。

2.  **动态生成代码**: `load` 钩子会执行插件扫描逻辑，然后动态地生成一个JavaScript模块的字符串内容。这个模块的内容大致如下：

    ```javascript
    // This is a virtual module generated on the fly

    export default {
      '@my-scope/plugin-a': {
        loader: () => import('@my-scope/plugin-a'),
        manifest: {
          /* plugin-a/package.json 的内容 */
        },
      },
      '@my-scope/plugin-b': {
        loader: () => import('@my-scope/plugin-b'),
        manifest: {
          /* plugin-b/package.json 的内容 */
        },
      },
      // ...更多插件
    }
    ```

3.  **提供给运行时**: `PluginManager` 在获取到这个清单对象后，就可以根据插件的包名，调用对应的 `loader` 函数来异步加载插件模块。

## 如何使用

该插件默认是零配置的，使用起来非常简单。

1.  **安装依赖**:

    ```bash
    pnpm add -D @layout-plugin-loader/vite-plugin
    ```

2.  **配置 `vite.config.ts`**: 在你的主应用（例如 `demo` 包）的 `vite.config.ts` 文件中，引入并使用该插件。

    ```typescript
    import { defineConfig } from 'vite'
    import vue from '@vitejs/plugin-vue'
    import { vuePluginArch } from '@layout-plugin-loader/vite-plugin'

    export default defineConfig({
      plugins: [
        vue(),

        // 在这里添加插件
        vuePluginArch(),
      ],
      // ...其他配置
    })
    ```

完成以上配置后，Vite在启动时就会自动运行插件扫描和清单生成逻辑。你无需进行任何其他配置。
