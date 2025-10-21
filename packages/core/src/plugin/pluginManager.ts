import type { App } from 'vue'
import type {
  Plugin,
  PluginAPI,
  IEventBus,
  PluginInfo,
  IPluginManager,
  IPluginLayoutManager,
  IPluginStorage,
  IPluginDataService,
  PluginModule,
  PluginManifest,
} from '@vue-plugin-arch/types'

import { PluginStateManager } from './pluginStateManager'
import {
  createPluginDataService,
  createPluginServiceProxy,
  PluginError,
} from '..'
import { createPluginLayoutManager, globalEventBus } from '..'

// PluginManager main class
export class PluginManager implements IPluginManager {
  public readonly layoutManager: IPluginLayoutManager
  public readonly eventBus: IEventBus

  private dataService: IPluginDataService
  private stateManager: PluginStateManager
  private storage: IPluginStorage
  private loadingPromises = new Map<string, Promise<void>>()

  constructor(app: App, storage: IPluginStorage) {
    this.eventBus = globalEventBus
    this.storage = storage

    this.dataService = createPluginDataService(this.storage, this.eventBus)
    this.layoutManager = createPluginLayoutManager(app, this.eventBus)
    this.stateManager = new PluginStateManager()

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Event handlers can be set up here if needed
  }

  // loadPluginManifest method removed - no longer needed for URL-based loading

  async loadPlugin(manifest: PluginManifest): Promise<void> {
    const pluginName = manifest.name
    try {
      if (this.loadingPromises.has(pluginName)) {
        return this.loadingPromises.get(pluginName)!
      }

      const loadPromise = this.doLoadPlugin(manifest)
      this.loadingPromises.set(pluginName, loadPromise)

      try {
        await loadPromise
      } finally {
        this.loadingPromises.delete(pluginName)
      }
    } catch (error) {
      this.handlePluginError(pluginName, error as Error, 'load')
      throw error
    }
  }

  private async doLoadPlugin(manifest: PluginManifest): Promise<void> {
    const pluginName = manifest.name
    console.info(`Loading plugin: ${pluginName}`)

    try {
      const plugin = await this.importPluginModule(manifest)

      this.stateManager.createInitialState(pluginName, plugin.manifest)

      // The host application is responsible for fetching the manifest
      // and loading plugins in an order that respects dependencies.
      const api = await this.installPlugin(pluginName, plugin.module)

      this.stateManager.updateState(pluginName, {
        status: 'loaded',
        api,
        loadedAt: Date.now(),
      })

      console.info(`Plugin ${pluginName} loaded successfully`)
      this.eventBus.emit('plugin:loaded', {
        name: pluginName,
        manifest: plugin.manifest,
      })
    } catch (error) {
      this.stateManager.updateState(pluginName, {
        status: 'error',
        error: error as Error,
      })
      throw error
    }
  }

  private async importPluginModule(manifest: PluginManifest): Promise<Plugin> {
    const pluginName = manifest.name
    try {
      // Use dynamic import with the URL from the manifest
      const module = await import(/* @vite-ignore */ manifest.url)

      if (!module || typeof module.install !== 'function') {
        throw new PluginError(
          pluginName,
          "Plugin module must export an 'install' function"
        )
      }

      return {
        module: module.default,
        manifest,
      }
    } catch (error) {
      if (error instanceof PluginError) {
        throw error
      }
      throw new PluginError(
        pluginName,
        `Failed to import plugin module from URL ${manifest.url}: ${(error as Error).message}`,
        error as Error
      )
    }
  }

  private async installPlugin(
    name: string,
    module: PluginModule
  ): Promise<PluginAPI> {
    try {
      const api = await module.install(
        createPluginServiceProxy(
          name,
          this.layoutManager,
          this.eventBus,
          this.dataService
        )
      )
      if (!api || typeof api !== 'object') {
        throw new PluginError(
          name,
          'Plugin install function must return an API object'
        )
      }
      return api
    } catch (error) {
      throw new PluginError(
        name,
        `Plugin installation failed: ${(error as Error).message}`,
        error as Error
      )
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    // Unload logic remains largely the same
    console.info(`Unloading plugin: ${name}`)
    const state = this.stateManager.getState(name)
    if (!state || state.status !== 'loaded') {
      console.warn(`Plugin ${name} is not loaded or does not exist.`)
      return
    }

    if (state.api?.teardown) {
      await state.api.teardown()
    }

    this.stateManager.removeState(name)
    console.info(`Plugin ${name} unloaded successfully`)
    this.eventBus.emit('plugin:unloaded', { name })
  }

  getLoadedPlugins(): PluginInfo[] {
    return this.stateManager.getLoadedPlugins().map(state => ({
      id: state.id,
      manifest: state.manifest,
      api: state.api!,
      loadedAt: state.loadedAt!,
    }))
  }

  isPluginLoaded(name: string): boolean {
    return this.stateManager.isLoaded(name)
  }

  private handlePluginError(
    name: string,
    error: Error,
    operation: string
  ): void {
    const pluginError =
      error instanceof PluginError
        ? error
        : new PluginError(name, error.message, error)

    console.error(`Plugin error in ${name} during ${operation}:`, pluginError)

    this.eventBus.emit('plugin:error', {
      name,
      error: pluginError,
    })
  }

  async destroy(): Promise<void> {
    const loadedPlugins = this.getLoadedPlugins()
    for (const plugin of loadedPlugins.reverse()) {
      await this.unloadPlugin(plugin.id)
    }
    this.loadingPromises.clear()
  }
}

export function createPluginManager(
  app: App,
  storage: IPluginStorage
): IPluginManager {
  return new PluginManager(app, storage)
}
