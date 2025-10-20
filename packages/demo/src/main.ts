import 'dockview-vue/dist/styles/dockview.css'

import { createApp } from 'vue'

import App from './App.vue'
import { MemoryPluginStorage } from './storage'
import { createPluginManager } from '@vue-plugin-arch/core'
import i18n from './i18n'

const app = createApp(App)

// 创建存储实现
const storage = new MemoryPluginStorage()
storage.set('global', 'global:theme', 'light')
storage.set('global', 'global:language', 'zh-CN')

// 创建插件管理器
const pluginManager = createPluginManager(app, storage)

// 将插件管理器提供给整个应用
app.provide('pluginManager', pluginManager)

// 使用 i18n
app.use(i18n)

app.mount('#app')
