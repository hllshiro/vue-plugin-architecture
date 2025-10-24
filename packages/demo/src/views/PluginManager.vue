<template>
  <div class="plugin-manager">
    <h2>{{ t('pluginManager.title') }}</h2>

    <!-- Loading state for registry fetching -->
    <div v-if="registryLoading" class="loading-state">
      <p>{{ t('pluginManager.loading.registry') }}</p>
    </div>

    <!-- Error state for registry fetching -->
    <div v-else-if="registryError" class="error-state">
      <p>{{ t('pluginManager.error.registryFailed') }}: {{ registryError }}</p>
      <button class="btn btn-primary" @click="loadPluginRegistry">
        {{ t('pluginManager.actions.retry') }}
      </button>
    </div>

    <!-- Plugin list -->
    <div v-else class="plugin-list">
      <div v-for="plugin in plugins" :key="plugin.name" class="plugin-item">
        <div class="plugin-info">
          <div class="plugin-header">
            <span class="plugin-icon">{{ plugin.icon || '🔌' }}</span>
            <h3>{{ plugin.displayName || plugin.name }}</h3>
          </div>
          <p>{{ plugin.description }}</p>
          <div class="plugin-meta">
            <span class="plugin-version">v{{ plugin.version }}</span>
            <span v-if="plugin.url.startsWith('/@fs/')" class="plugin-local">
              {{ t('pluginManager.labels.local') }}
            </span>
            <span v-else class="plugin-remote">
              {{ t('pluginManager.labels.remote') }}
            </span>
          </div>
        </div>

        <div class="plugin-actions">
          <button
            class="btn"
            :class="plugin.loaded ? 'btn-danger' : 'btn-success'"
            :disabled="plugin.loading"
            @click="togglePlugin(plugin)"
          >
            {{ getButtonText(plugin) }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!registryLoading && !registryError && plugins.length === 0"
      class="empty-state"
    >
      <p>{{ t('pluginManager.emptyState') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IPluginManager, PluginManifest } from '@vue-plugin-arch/types'
import { PluginRegistryService } from '../services/pluginRegistryService'

const { t } = useI18n()

interface UIPlugin extends PluginManifest {
  loaded: boolean
  loading: boolean // Add loading state for UI feedback
}

const pluginManager = inject<IPluginManager>('pluginManager')!
const plugins = ref<UIPlugin[]>([])
const registryLoading = ref(false)
const registryError = ref<string | null>(null)

// Initialize registry service
const registryService = new PluginRegistryService()

const getButtonText = (plugin: UIPlugin): string => {
  if (plugin.loading) {
    return t('pluginManager.actions.loading')
  }
  return plugin.loaded
    ? t('pluginManager.actions.unload')
    : t('pluginManager.actions.load')
}

const togglePlugin = async (plugin: UIPlugin) => {
  if (plugin.loading) return // Prevent multiple clicks
  plugin.loading = true

  try {
    if (plugin.loaded) {
      await pluginManager.unloadPlugin(plugin.name)
    } else {
      await pluginManager.loadPlugin(plugin as PluginManifest)
    }
    // Update the loaded state after the operation
    plugin.loaded = pluginManager.isPluginLoaded(plugin.name)
  } catch (e) {
    console.error(`Error toggling plugin ${plugin.name}:`, e)
    alert(
      `${t('pluginManager.error.operationFailed')}: ${(e as Error).message}`
    )
  } finally {
    plugin.loading = false // Reset loading state
  }
}

const loadPluginRegistry = async () => {
  registryLoading.value = true
  registryError.value = null

  try {
    const availablePlugins = await registryService.getMergedPluginList()

    // Convert to UI plugins with loading states
    plugins.value = availablePlugins.map(plugin => ({
      ...plugin,
      loaded: pluginManager.isPluginLoaded(plugin.name),
      loading: false,
    }))
  } catch (error) {
    console.error('Failed to load plugin registry:', error)
    registryError.value = (error as Error).message
    plugins.value = []
  } finally {
    registryLoading.value = false
  }
}

// Load plugin registry on component mount
onMounted(() => {
  loadPluginRegistry()
})
</script>

<style scoped>
.plugin-manager {
  max-width: 1000px;
  margin: 0 auto;
  padding: 12px;
  background-color: var(--dv-group-view-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  height: 100%;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.error-state {
  color: var(--dv-drag-over-border-color);
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
  background-color: var(--dv-tabs-and-actions-container-background-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 8px;
  box-shadow: var(--dv-floating-box-shadow);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.plugin-icon {
  font-size: 1.25rem;
}

.plugin-info h3 {
  margin: 0;
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.plugin-info p {
  margin: 0 0 0.5rem 0;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.plugin-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.plugin-version {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.plugin-local {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: var(--dv-paneview-active-outline-color);
  border-radius: 4px;
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.plugin-remote {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: var(--dv-inactivegroup-visiblepanel-tab-background-color);
  border: 1px solid var(--dv-separator-border);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.plugin-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--dv-separator-border);
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 80px;
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
}

.btn:disabled {
  background-color: var(--dv-inactivegroup-hiddenpanel-tab-background-color);
  color: var(--dv-inactivegroup-hiddenpanel-tab-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  background-color: var(--dv-paneview-active-outline-color);
  color: white;
  border-color: var(--dv-paneview-active-outline-color);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-success {
  background-color: var(--dv-activegroup-visiblepanel-tab-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border-color: var(--dv-paneview-active-outline-color);
}

.btn-success:hover:not(:disabled) {
  background-color: var(--dv-icon-hover-background-color);
}

.btn-danger {
  background-color: var(--dv-drag-over-background-color);
  color: var(--dv-activegroup-visiblepanel-tab-color);
  border-color: var(--dv-drag-over-border-color);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--dv-icon-hover-background-color);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--dv-inactivegroup-visiblepanel-tab-color);
}

.empty-state .hint {
  font-size: 0.875rem;
  color: var(--dv-inactivegroup-hiddenpanel-tab-color);
}
</style>
