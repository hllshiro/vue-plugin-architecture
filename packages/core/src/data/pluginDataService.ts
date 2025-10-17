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
const CONSTANT_GLOBAL_PREFIX = 'global'
const CONSTANT_GLOBAL_KEY_PREFIX = `${CONSTANT_GLOBAL_PREFIX}:`
export class PluginDataService implements IPluginDataService {
  private pluginDataAPIs = new Map<string, IPluginDataAPI>()

  constructor(
    private readonly storage: IPluginStorage,
    private readonly eventBus: IEventBus
  ) {}

  async get(name: string, key: string): Promise<unknown> {
    try {
      if (this.isGlobal(key)) {
        return await this.getGlobal(key)
      }
      return await this.storage.get(name, key)
    } catch (error) {
      console.error(
        `[PluginDataService][${name}] Failed to get data "${key}"`,
        error
      )
      throw error
    }
  }

  async set(name: string, key: string, value: unknown): Promise<void> {
    try {
      const oldValue = await this.get(name, key)
      if (this.isGlobal(key)) {
        await this.setGlobal(key, value)
        this.notifyGlobalChange(key, oldValue, value)
      } else {
        await this.storage.set(name, key, value)
        this.notifyChange(name, key, oldValue, value)
      }
    } catch (error) {
      console.error(
        `[PluginDataService][${name}] Failed to set data "${key}"`,
        error
      )
      throw error
    }
  }

  async remove(name: string, key: string): Promise<void> {
    try {
      const oldValue = await this.get(name, key)
      if (this.isGlobal(key)) {
        await this.removeGlobal(key)
        this.notifyGlobalChange(key, oldValue)
      } else {
        await this.storage.remove(name, key)
        this.notifyChange(name, key, oldValue)
      }
    } catch (error) {
      console.error(
        `[PluginDataService][${name}] Failed to remove data "${key}":`,
        error
      )
      throw error
    }
  }

  async getAll(name: string): Promise<Record<string, unknown>> {
    try {
      const data = await this.storage.getAll(name)
      const global = await this.storage.getAll(CONSTANT_GLOBAL_PREFIX)
      return {
        ...data,
        ...global,
      }
    } catch (error) {
      console.error(`[PluginDataService][${name}] Failed to getAll`, error)
      throw error
    }
  }

  async removeAll(name: string): Promise<void> {
    try {
      return await this.storage.removeAll(name)
    } catch (error) {
      console.error(`[PluginDataService][${name}] Failed to removeAll`, error)
      throw error
    }
  }

  createAPI(name: string): IPluginDataAPI {
    // 如果已存在，直接返回
    if (this.pluginDataAPIs.has(name)) {
      return this.pluginDataAPIs.get(name)!
    }

    // 创建新的API实例
    const api = new PluginDataAPI(name, this)
    this.pluginDataAPIs.set(name, api)

    console.debug(`Created data API for plugin: ${name}`)
    return api
  }

  destroyAPI(name: string): void {
    if (!this.pluginDataAPIs.has(name)) {
      return
    }
    this.pluginDataAPIs.delete(name)
  }

  private isGlobal(key: string): boolean {
    return key.startsWith(CONSTANT_GLOBAL_KEY_PREFIX)
  }

  private async getGlobal(key: string): Promise<unknown> {
    return await this.storage.get(CONSTANT_GLOBAL_PREFIX, key)
  }

  private async setGlobal(key: string, value: unknown): Promise<void> {
    this.storage.set(CONSTANT_GLOBAL_PREFIX, key, value)
  }

  private async removeGlobal(key: string): Promise<void> {
    return this.storage.remove(CONSTANT_GLOBAL_PREFIX, key)
  }

  private notifyChange(
    name: string,
    key: string,
    oldValue: unknown,
    newValue?: unknown
  ): void {
    this.eventBus.emit('plugin:data:changed', {
      name,
      key,
      oldValue,
      newValue,
    })
  }

  private notifyGlobalChange(
    key: string,
    oldValue: unknown,
    newValue?: unknown
  ): void {
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
