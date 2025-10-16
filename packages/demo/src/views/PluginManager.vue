<template>
  <div class="plugin-manager">
    <h2>插件管理</h2>

    <div class="plugin-list">
      <div v-for="plugin in plugins" :key="plugin.name" class="plugin-item">
        <div class="plugin-info">
          <h3>{{ plugin.name }}</h3>
          <p>{{ plugin.description }}</p>
          <span class="plugin-version">v{{ plugin.version }}</span>
        </div>

        <div class="plugin-actions">
          <button
            class="btn"
            :class="plugin.loaded ? 'btn-danger' : 'btn-success'"
            :disabled="plugin.loading"
            @click="togglePlugin(plugin)"
          >
            {{ plugin.loading ? '处理中...' : plugin.loaded ? '卸载' : '加载' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="plugins.length === 0" class="empty-state">
      <p>暂无可用插件</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IPluginManager,
  PluginLoader,
  PluginManifest,
} from '@vue-plugin-arch/types'
import { ref, onMounted, inject } from 'vue'

interface UIPlugin extends PluginManifest {
  loaded: boolean
  loading: boolean // Add loading state for UI feedback
}

const pluginManager = inject<IPluginManager>('pluginManager')!
const plugins = ref<UIPlugin[]>([])

const togglePlugin = async (plugin: UIPlugin) => {
  if (plugin.loading) return // Prevent multiple clicks
  plugin.loading = true

  try {
    if (plugin.loaded) {
      await pluginManager.unloadPlugin(plugin.name)
    } else {
      await pluginManager.loadPlugin(plugin.name)
    }
    // Update the loaded state after the operation
    plugin.loaded = pluginManager.isPluginLoaded(plugin.name)
  } catch (e) {
    console.error(`Error toggling plugin ${plugin.name}:`, e)
    alert(`操作插件失败: ${(e as Error).message}`)
  } finally {
    plugin.loading = false // Reset loading state
  }
}

import manifest from 'virtual:vue-plugin-arch/plugin-manifest'

onMounted(() => {
  try {
    plugins.value = Object.values(manifest).map((entry: PluginLoader) => ({
      ...entry.manifest,
      loaded: pluginManager.isPluginLoaded(entry.manifest.name),
      loading: false,
    }))
  } catch (error) {
    console.error('Could not load plugin list from virtual module:', error)
    plugins.value = []
  }
})
</script>

<style scoped>
.plugin-manager {
  max-width: 1000px;
  margin: 0 auto;
  padding: 12px;
}

.plugin-list {
  display: grid;
  gap: 1rem;
  margin: 2rem 0;
}

.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.plugin-info h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.plugin-info p {
  margin: 0 0 0.5rem 0;
  color: #666;
}

.plugin-version {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #666;
}

.plugin-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 80px; /* Ensure button width is consistent */
}

.btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-state .hint {
  font-size: 0.875rem;
  color: #999;
}
</style>
