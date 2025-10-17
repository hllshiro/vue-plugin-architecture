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

// Event types
const EVENTS = {
  PLUGIN_DATA_CHANGED: 'plugin:data:changed',
  GLOBAL_DATA_CHANGED: 'global:data:changed',
} as const

export class PluginDataService implements IPluginDataService {
  private readonly pluginDataAPIs = new Map<string, IPluginDataAPI>()

  constructor(
    private readonly storage: IPluginStorage,
    private readonly eventBus: IEventBus
  ) {}

  private async handleDataOperation<T>(
    pluginName: string,
    operation: string,
    action: () => Promise<T>
  ): Promise<T> {
    try {
      return await action()
    } catch (error) {
      console.error(
        `[PluginDataService][${pluginName}] ${operation} failed`,
        error
      )
      throw error
    }
  }

  async get(name: string, key: string): Promise<unknown> {
    return this.handleDataOperation(name, `get data "${key}"`, () => {
      if (this.isGlobal(key)) {
        return this.getGlobal(key)
      }
      return this.storage.get(name, key)
    })
  }

  async set(name: string, key: string, value: unknown): Promise<void> {
    await this.handleDataOperation(name, `set data "${key}"`, async () => {
      const oldValue = await this.get(name, key)
      if (this.isGlobal(key)) {
        await this.setGlobal(key, value)
        this.notifyGlobalChange(key, oldValue, value)
      } else {
        await this.storage.set(name, key, value)
        this.notifyChange(name, key, oldValue, value)
      }
    })
  }

  async remove(name: string, key: string): Promise<void> {
    await this.handleDataOperation(name, `remove data "${key}"`, async () => {
      const oldValue = await this.get(name, key)
      if (this.isGlobal(key)) {
        await this.removeGlobal(key)
        this.notifyGlobalChange(key, oldValue)
      } else {
        await this.storage.remove(name, key)
        this.notifyChange(name, key, oldValue)
      }
    })
  }

  async getAll(name: string): Promise<Record<string, unknown>> {
    return this.handleDataOperation(name, 'get all data', async () => {
      const [data, globalData] = await Promise.all([
        this.storage.getAll(name),
        this.storage.getAll(CONSTANT_GLOBAL_PREFIX),
      ])
      return {
        ...data,
        ...globalData,
      }
    })
  }

  async removeAll(name: string): Promise<void> {
    await this.handleDataOperation(name, 'remove all data', () =>
      this.storage.removeAll(name)
    )
  }

  createAPI(name: string): IPluginDataAPI {
    if (this.pluginDataAPIs.has(name)) {
      return this.pluginDataAPIs.get(name)!
    }

    const api = new PluginDataAPI(name, this)
    this.pluginDataAPIs.set(name, api)

    console.debug(`Created data API for plugin: ${name}`)
    return api
  }

  destroyAPI(name: string): void {
    this.pluginDataAPIs.delete(name)
  }

  private isGlobal(key: string): boolean {
    return key.startsWith(CONSTANT_GLOBAL_KEY_PREFIX)
  }

  private getGlobal(key: string): Promise<unknown> {
    return this.storage.get(CONSTANT_GLOBAL_PREFIX, key)
  }

  private async setGlobal(key: string, value: unknown): Promise<void> {
    await this.storage.set(CONSTANT_GLOBAL_PREFIX, key, value)
  }

  private async removeGlobal(key: string): Promise<void> {
    await this.storage.remove(CONSTANT_GLOBAL_PREFIX, key)
  }

  private notifyChange(
    name: string,
    key: string,
    oldValue: unknown,
    newValue?: unknown
  ): void {
    this.eventBus.emit(EVENTS.PLUGIN_DATA_CHANGED, {
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
    this.eventBus.emit(EVENTS.GLOBAL_DATA_CHANGED, {
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
