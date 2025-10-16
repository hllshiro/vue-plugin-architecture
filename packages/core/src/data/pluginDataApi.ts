import type {
  IEventBus,
  IPluginDataAPI,
  IPluginDataService,
} from '@vue-plugin-arch/types'

/**
 * 插件数据API实现
 * 每个插件获得的数据API实例，自动绑定插件ID
 * 提供简化的异步数据操作方法，支持全局数据合并和变更监听
 */
export class PluginDataAPI implements IPluginDataAPI {
  constructor(
    private name: string,
    private storage: IPluginDataService,
    public readonly eventBus: IEventBus
  ) {}

  async get(key: string): Promise<unknown> {
    try {
      return await this.storage.get(this.name, key)
    } catch (error) {
      console.error(
        `Failed to get data for plugin ${this.name}, key: ${key}`,
        error
      )
      throw error
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      // 设置新值
      await this.storage.set(this.name, key, value)
      console.debug(`Data set for plugin ${this.name}, key: ${key}`)
    } catch (error) {
      console.error(
        `Failed to set data for plugin ${this.name}, key: ${key}`,
        error
      )
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      // 删除数据
      await this.storage.remove(this.name, key)
      console.debug(`Data removed for plugin ${this.name}, key: ${key}`)
    } catch (error) {
      console.error(
        `Failed to remove data for plugin ${this.name}, key: ${key}`,
        error
      )
      throw error
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    try {
      // 获取插件数据
      return await this.storage.getAll(this.name)
    } catch (error) {
      console.error(`Failed to get all data for plugin ${this.name}`, error)
      throw error
    }
  }

  async removeAll(): Promise<void> {
    try {
      await this.storage.removeAll(this.name)
      console.debug(`All data removed for plugin ${this.name}`)
    } catch (error) {
      console.error(`Failed to remove all data for plugin ${this.name}`, error)
      throw error
    }
  }
}
