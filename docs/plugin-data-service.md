# 插件数据服务 (PluginDataService)

插件数据服务是一个为插件设计的、带作用域的键值(Key-Value)存储系统。它使得插件可以方便地持久化自己的配置和状态，并在不同插件间安全地共享数据。

## 设计思想

该服务的设计遵循以下几个核心原则：

1.  **存储无关性**: `PluginDataService` 本身不负责数据的物理存储。它通过一个标准的 `IPluginStorage` 接口与一个可插拔的“存储适配器”进行交互。这意味着底层存储可以是 `localStorage`、`sessionStorage`、`IndexDB`，甚至是远程服务器，而数据服务的上层API保持不变。

2.  **作用域隔离**: 为了防止不同插件之间的数据键名冲突，服务会自动为每个插件的数据操作限定在一个默认的作用域内（通常是插件的包名）。

3.  **全局共享**: 除了插件的私有作用域，系统还提供了一个特殊的 `'global'` 作用域。存放在此作用域内的数据可以被任何插件读取和写入，是实现插件间数据共享的标准方式。

4.  **变更通知**: 每当数据发生变化（通过 `set` 或 `remove`），服务都会在全局事件总线上发布一个 `data:changed` 事件。这使得应用的其他部分（例如UI组件）可以监听并响应数据的变化，实现UI的自动更新。

## 核心组件

### `IPluginStorage` (存储适配器接口)

这是一个需要由主应用（Host Application）实现的接口，定义了数据持久化的基本操作。`demo` 应用中提供了一个 `MemoryPluginStorage` 作为示例。

```typescript
// @vue-plugin-arch/types/src/types/plugin.ts
export interface IPluginStorage {
  set(name: string, key: string, value: unknown): Promise<void>
  get(name: string, key: string): Promise<unknown>
  getAll(name: string): Promise<Record<string, unknown>>
  remove(name: string, key: string): Promise<void>
  // ...
}
```

### `PluginDataService` (核心服务)

该服务在内部管理着对 `IPluginStorage` 的调用，并处理作用域逻辑和事件发布。它不会直接暴露给插件。

### `PluginDataAPI` (插件API代理)

这是最终提供给每个插件的API接口。当 `PluginManager` 初始化一个插件时，它会创建一个 `PluginDataAPI` 的实例，该实例已经自动绑定了当前插件的名称（即默认作用域）。

## API 使用方法

插件通过注入的 `proxy.dataApi` 来使用数据服务。

### 1. 读写插件私有数据

默认情况下，所有操作都在插件自己的作用域内。

```typescript
// 保存当前插件的视图模式
await proxy.dataApi.set('viewMode', 'grid')

// 在稍后或其他地方读取
const savedMode = await proxy.dataApi.get('viewMode') // -> 'grid'

// 删除数据
await proxy.dataApi.remove('viewMode')
```

### 2. 读写全局共享数据

通过 `global:` 前缀来访问全局作用域。

```typescript
// 插件A：设置全局主题
await proxy.dataApi.set('global:theme', 'dark')

// 插件B：读取全局主题
const currentTheme = await proxy.dataApi.get('global:theme') // -> 'dark'
```

### 3. 监听数据变化

通过事件总线监听 `data:changed` 事件，可以响应任意作用域内的数据变更。

```typescript
// 监听全局主题的变化
proxy.eventApi.on('data:changed', event => {
  // event: { name: string, key: string, oldValue: any, newValue: any }
  if (event.name === 'global' && event.key === 'global:theme') {
    console.log(`Theme changed from ${event.oldValue} to ${event.newValue}`)
    // 更新UI...
  }
})

// 别忘了在 teardown 中清理监听
// proxy.eventApi.off('data:changed', ...);
```
