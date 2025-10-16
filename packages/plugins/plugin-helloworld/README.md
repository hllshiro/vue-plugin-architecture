# Hello World 插件

这是一个 Vue 插件架构系统的示例插件，展示了插件开发的基础功能和最佳实践。

## 功能特性

### 🎯 核心功能演示

- **面板注册**: 展示如何注册和管理多个面板
- **事件通信**: 演示插件间和插件与主应用的事件通信
- **数据存储**: 展示数据的持久化存储和读取
- **配置管理**: 演示插件配置的管理和更新
- **日志记录**: 展示统一的日志记录功能

### 📊 包含的面板

1. **Hello World 面板**: 主功能演示面板
   - 插件信息显示
   - 配置管理演示
   - 事件通信演示
   - 数据存储演示
   - 统计信息展示

2. **计数器面板**: 交互功能演示面板
   - 基础计数器操作
   - 操作历史记录
   - 统计信息展示
   - 自动计数器功能
   - 数据持久化演示

## 项目结构

```
packages/plugins/plugin-helloworld/
├── src/
│   ├── components/
│   │   ├── HelloWorldPanel.vue    # 主演示面板
│   │   └── CounterPanel.vue       # 计数器演示面板
│   └── index.ts                   # 插件入口文件
├── manifest           # 插件清单文件
├── package.json                   # 包配置文件
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                  # TypeScript 配置
└── README.md                      # 说明文档
```

## 插件清单

```json
{
  "id": "plugin-helloworld",
  "name": "Hello World 插件",
  "version": "0.1.0",
  "description": "一个简单的 Hello World 示例插件，展示插件开发的基础功能和最佳实践",
  "entry": "./dist/index.js",
  "icon": "👋",
  "components": [
    {
      "name": "HelloWorldPanel",
      "path": "./components/HelloWorldPanel.vue",
      "defaultPosition": "right",
      "title": "Hello World",
      "icon": "👋"
    },
    {
      "name": "CounterPanel",
      "path": "./components/CounterPanel.vue",
      "defaultPosition": "bottom",
      "title": "计数器",
      "icon": "🔢"
    }
  ],
  "permissions": ["data:read", "data:write", "events:emit", "events:listen"]
}
```

## 开发指南

### 安装依赖

```bash
# 在项目根目录执行
pnpm install
```

### 构建插件

```bash
# 开发模式 (监听文件变化)
pnpm --filter @vue-plugin-arch/plugin-helloworld dev

# 生产构建
pnpm --filter @vue-plugin-arch/plugin-helloworld build
```

### 类型检查

```bash
pnpm --filter @vue-plugin-arch/plugin-helloworld type-check
```

## 插件 API 使用示例

### 基础插件结构

```typescript
import type { PluginModule, PluginHost, PluginAPI } from '@vue-plugin-arch/core'

export const install = (host: PluginHost): PluginAPI => {
  // 插件初始化逻辑

  return {
    // 插件 API 方法
    teardown: async () => {
      // 清理资源
    },
  }
}

export const pluginModule: PluginModule = {
  install,
  manifest,
}
```

### 面板注册

```typescript
const panelId = host.registerPanel({
  id: 'my-panel',
  component: MyPanelComponent,
  title: '我的面板',
  position: 'right',
  params: {
    // 传递给组件的参数
  },
})
```

### 事件通信

```typescript
// 监听事件
host.onEvent('my-event', payload => {
  console.log('收到事件:', payload)
})

// 发送事件
host.emitEvent('my-event', {
  message: 'Hello World',
})

// 移除事件监听器
host.offEvent('my-event', handler)
```

### 数据存储

```typescript
// 存储数据
await host.setData('my-key', { value: 'Hello World' })

// 读取数据
const data = await host.getData('my-key')

// 删除数据
await host.removeData('my-key')
```

### 配置管理

```typescript
// 设置配置
host.setConfig('theme', 'dark')

// 读取配置
const theme = host.getConfig('theme')
```

### 日志记录

```typescript
// 不同级别的日志
host.log('debug', '调试信息', { data: 'debug data' })
host.log('info', '信息日志', { data: 'info data' })
host.log('warn', '警告信息', { data: 'warning data' })
host.log('error', '错误信息', { error: new Error('Something went wrong') })
```

## 最佳实践

### 1. 资源清理

确保在 `teardown` 方法中正确清理所有资源：

```typescript
teardown: async () => {
  // 清理定时器
  clearInterval(timer)

  // 移除事件监听器
  eventHandlers.forEach((handler, event) => {
    host.offEvent(event, handler)
  })

  // 移除面板
  panels.forEach(panelId => {
    host.removePanel(panelId)
  })
}
```

### 2. 错误处理

使用 try-catch 包装可能出错的操作：

```typescript
try {
  const data = await host.getData('key')
  // 处理数据
} catch (error) {
  host.log('error', '数据读取失败', { error })
}
```

### 3. 状态管理

维护插件的内部状态：

```typescript
const state = {
  panels: new Map<string, string>(),
  eventHandlers: new Map<string, Function>(),
  isActive: true,
}
```

### 4. 配置默认值

为插件配置提供合理的默认值：

```typescript
const defaultConfig = {
  theme: 'light',
  autoSave: true,
  refreshInterval: 5000,
}

Object.entries(defaultConfig).forEach(([key, value]) => {
  if (host.getConfig(key) === undefined) {
    host.setConfig(key, value)
  }
})
```

## 调试技巧

1. **使用日志**: 充分利用日志系统记录插件的运行状态
2. **事件追踪**: 监听和记录事件的发送和接收
3. **状态检查**: 定期检查和记录插件的内部状态
4. **错误捕获**: 使用 try-catch 捕获和记录错误信息

## 扩展功能

基于这个示例插件，你可以扩展以下功能：

- 添加更多的面板类型
- 实现复杂的插件间通信协议
- 集成外部 API 和服务
- 添加用户界面主题支持
- 实现数据导入导出功能
- 添加插件设置页面

## 相关文档

- [Vue 插件架构系统文档](../../../docs/)
- [核心 API 参考](../../core/README.md)
- [Vite 插件文档](../../vite-plugin/README.md)
