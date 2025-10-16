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
  PluginLoaderMap,
  PluginModule,
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
  private pluginManifest: PluginLoaderMap | null = null

  constructor(
    app: App,
    storage: IPluginStorage,
    globalData?: Record<string, unknown>
  ) {
    this.eventBus = globalEventBus
    this.storage = storage

    this.dataService = createPluginDataService(this.storage, this.eventBus)
    if (globalData) {
      this.dataService.initGlobalData(globalData)
    }
    this.layoutManager = createPluginLayoutManager(app, this.eventBus)
    this.stateManager = new PluginStateManager()

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Event handlers can be set up here if needed
  }

  private async loadPluginManifest(): Promise<PluginLoaderMap> {
    if (!this.pluginManifest) {
      try {
        // Use dynamic import with string to avoid build-time resolution
        const manifestModule = await import(
          'virtual:vue-plugin-arch/plugin-manifest'
        )
        this.pluginManifest = manifestModule.default
      } catch (error) {
        console.error('Failed to load plugin manifest:', error)
        throw new Error(
          'Plugin manifest not available. Make sure the vite-plugin is properly configured.'
        )
      }
    }
    return this.pluginManifest!
  }

  async loadPlugin(packageName: string): Promise<void> {
    try {
      if (this.loadingPromises.has(packageName)) {
        return this.loadingPromises.get(packageName)!
      }

      const loadPromise = this.doLoadPlugin(packageName)
      this.loadingPromises.set(packageName, loadPromise)

      try {
        await loadPromise
      } finally {
        this.loadingPromises.delete(packageName)
      }
    } catch (error) {
      this.handlePluginError(packageName, error as Error, 'load')
      throw error
    }
  }

  private async doLoadPlugin(packageName: string): Promise<void> {
    console.info(`Loading plugin: ${packageName}`)

    try {
      const plugin = await this.importPluginModule(packageName)

      this.stateManager.createInitialState(packageName, plugin.manifest)

      // The host application is responsible for fetching the manifest
      // and loading plugins in an order that respects dependencies.
      const api = await this.installPlugin(packageName, plugin.module)

      this.stateManager.updateState(packageName, {
        status: 'loaded',
        api,
        loadedAt: Date.now(),
      })

      console.info(`Plugin ${packageName} loaded successfully`)
      this.eventBus.emit('plugin:loaded', {
        name: packageName,
        manifest: plugin.manifest,
      })
    } catch (error) {
      this.stateManager.updateState(packageName, {
        status: 'error',
        error: error as Error,
      })
      throw error
    }
  }

  private async importPluginModule(packageName: string): Promise<Plugin> {
    try {
      const manifest = await this.loadPluginManifest()
      const loader = manifest[packageName]
      const importFn = loader.loader

      if (!importFn) {
        throw new PluginError(
          packageName,
          `Plugin not found in manifest. Make sure "${packageName}" is installed as a dependency.`
        )
      }

      const module = await importFn()

      if (!module || typeof module.install !== 'function') {
        throw new PluginError(
          packageName,
          "Plugin module must export an 'install' function"
        )
      }

      return {
        module,
        manifest: loader.manifest,
      }
    } catch (error) {
      if (error instanceof PluginError) {
        throw error
      }
      throw new PluginError(
        packageName,
        `Failed to import plugin module: ${(error as Error).message}`,
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
  storage: IPluginStorage,
  globalData?: Record<string, unknown>
): IPluginManager {
  return new PluginManager(app, storage, globalData)
}
