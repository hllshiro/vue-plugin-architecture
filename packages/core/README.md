# @vue-plugin-arch/core

Vue 插件架构系统的核心运行时包。

## 概述

这个包提供了 Vue 插件架构系统的核心功能，包括插件管理、布局管理、事件通信和数据持久化等运行时服务。

## 主要功能

- 🔌 动态插件加载和卸载
- 📐 基于 dockview 的可视化面板布局
- 🔄 基于 mitt 的事件总线
- 💾 插件数据存储
- 🔗 API 接口代理

## 安装

```bash
pnpm add @vue-plugin-arch/core
```

## 使用

```typescript
import { createPluginManager } from '@vue-plugin-arch/core'

// 创建插件管理器
const pluginManager = createPluginManager(app, storage, {
  appInfo: {
    name: 'Vue Plugin Architecture Demo',
    version: '0.1.0',
    environment: 'development',
  },
})
```
