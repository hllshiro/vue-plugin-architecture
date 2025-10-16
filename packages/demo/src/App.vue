<template>
  <div id="app">
    <main class="app-main">
      <!-- Dockview 容器 -->
      <!-- 路由视图作为默认内容面板 -->
      <dockview-vue
        ref="dockviewRef"
        class="dockview-container"
        :theme="themeLight"
        @ready="onDockviewReady"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { DockviewVue, DockviewReadyEvent, themeLight } from 'dockview-vue'
import type { IPluginManager } from '@vue-plugin-arch/types'
import Home from './views/Home.vue'
import PluginManager from './views/PluginManager.vue'

defineOptions({
  components: {
    Home,
    PluginManager,
  },
})

// 注入依赖
const pluginManager = inject<IPluginManager>('pluginManager')

// 响应式数据
const dockviewRef = ref<InstanceType<typeof DockviewVue>>()
const isDockviewReady = ref(false)

// Dockview 就绪回调
const onDockviewReady = (event: DockviewReadyEvent) => {
  const api = event.api
  console.log('Dockview API ready:', api)

  if (pluginManager) {
    // Get the layout manager from the plugin manager
    const layoutManager = pluginManager.layoutManager
    if (layoutManager) {
      layoutManager.setDockviewApi(api)
      isDockviewReady.value = true
    }
  }

  // 加载默认界面
  api.addPanel({
    id: 'home',
    component: 'Home',
    title: '首页',
  })
  api.addPanel({
    id: 'plugins',
    component: 'PluginManager',
    title: '插件管理',
    position: {
      direction: 'right',
    },
  })
}

// 组件挂载时的初始化
onMounted(() => {
  console.log('App mounted, plugin manager:', pluginManager)
})

// 组件卸载时的清理
onUnmounted(() => {
  if (pluginManager) {
    pluginManager.destroy()
  }
})
</script>

<style scoped>
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dockview-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.loading-content {
  flex: 1;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 欢迎面板样式 */
:deep(.welcome-panel) {
  padding: 2rem;
  background: white;
  height: 100%;
  overflow-y: auto;
}

:deep(.welcome-panel h2) {
  color: #333;
  margin-bottom: 1rem;
}

:deep(.welcome-panel p) {
  color: #666;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

:deep(.feature-list) {
  margin-bottom: 2rem;
}

:deep(.feature-list h3) {
  color: #333;
  margin-bottom: 0.5rem;
}

:deep(.feature-list ul) {
  list-style-type: disc;
  margin-left: 1.5rem;
  color: #666;
}

:deep(.feature-list li) {
  margin-bottom: 0.5rem;
}

:deep(.quick-actions) {
  display: flex;
  gap: 1rem;
}

:deep(.btn) {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

:deep(.btn-primary) {
  background-color: #007acc;
  color: white;
}

:deep(.btn-primary:hover) {
  background-color: #005a9e;
}

:deep(.btn-secondary) {
  background-color: #6c757d;
  color: white;
}

:deep(.btn-secondary:hover) {
  background-color: #545b62;
}

:deep(.btn-success) {
  background-color: #28a745;
  color: white;
}

:deep(.btn-success:hover) {
  background-color: #218838;
}
</style>
