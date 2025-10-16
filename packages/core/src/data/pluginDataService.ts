import type {
  IEventBus,
  IPluginStorage,
  IPluginDataAPI,
  IPluginDataService,
} from '@vue-plugin-arch/types'
import { PluginDataAPI } from './pluginDataApi'

/**
 * 插件数据存储服务
 * 负责插件数据管理、全局数据支持和变更通知
 */
export class PluginDataService implements IPluginDataService {
  private globalData = new Map<string, unknown>()
  private pluginDataAPIs = new Map<string, IPluginDataAPI>()

  constructor(
    private readonly storage: IPluginStorage,
    private readonly eventBus: IEventBus
  ) {}

  async get(name: string, key: string): Promise<unknown> {
    return await this.storage.get(name, key)
  }

  async set(name: string, key: string, value: unknown): Promise<void> {
    try {
      const oldValue = await this.get(name, key)
      await this.storage.set(name, key, value)
      // 通知插件数据变更
      this.notifyChange(name, key, oldValue, value)
      console.debug(`plugin data set: ${key}`)
    } catch (error) {
      console.error(
        `Failed to set plugin "${name}" data for key "${key}":`,
        error
      )
      throw error
    }
  }

  async remove(name: string, key: string): Promise<void> {
    return await this.storage.remove(name, key)
  }

  async getAll(name: string): Promise<Record<string, unknown>> {
    const data = await this.storage.getAll(name)
    return {
      ...data,
      ...this.globalData,
    }
  }

  async removeAll(name: string): Promise<void> {
    return await this.storage.removeAll(name)
  }

  initGlobalData(data: Record<string, unknown>): void {
    try {
      for (const [key, value] of Object.entries(data)) {
        this.globalData.set(key, value)
      }
      console.debug('Global data initialized:', Object.keys(data))
    } catch (error) {
      console.error('Failed to initialize global data:', error)
      throw error
    }
  }

  setGlobalData(key: string, value: unknown): void {
    try {
      const oldValue = this.globalData.get(key)
      this.globalData.set(key, value)

      // 通知全局数据变更
      this.notifyGlobalChange(key, oldValue, value)

      console.debug(`Global data set: ${key}`)
    } catch (error) {
      console.error(`Failed to set global data for key "${key}":`, error)
      throw error
    }
  }

  getGlobalData(key: string): unknown {
    return this.globalData.get(key)
  }

  createPluginDataAPI(name: string): IPluginDataAPI {
    // 如果已存在，直接返回
    if (this.pluginDataAPIs.has(name)) {
      return this.pluginDataAPIs.get(name)!
    }

    // 创建新的API实例
    const api = new PluginDataAPI(name, this, this.eventBus)
    this.pluginDataAPIs.set(name, api)

    console.debug(`Created data API for plugin: ${name}`)
    return api
  }

  destroyPluginDataAPI(name: string): void {
    if (!this.pluginDataAPIs.has(name)) {
      return
    }
    this.pluginDataAPIs.delete(name)
  }

  notifyChange(
    name: string,
    key: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this.eventBus.emit('plugin:data:changed', {
      name,
      key,
      oldValue,
      newValue,
    })
  }

  notifyGlobalChange(key: string, oldValue: unknown, newValue: unknown): void {
    this.eventBus.emit('global:data:changed', {
      key,
      oldValue,
      newValue,
    })
  }
}

export function createPluginDataService(
  storage: IPluginStorage,
  eventBus: IEventBus
): IPluginDataService {
  return new PluginDataService(storage, eventBus)
}
