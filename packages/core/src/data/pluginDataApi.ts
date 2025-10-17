import type { IPluginDataAPI, IPluginDataService } from '@vue-plugin-arch/types'

/**
 * 插件数据API实现
 * 每个插件获得的数据API实例，自动绑定插件ID
 */
export class PluginDataAPI implements IPluginDataAPI {
  constructor(
    private name: string,
    private dataService: IPluginDataService
  ) {}

  async get(key: string): Promise<unknown> {
    return await this.dataService.get(this.name, key)
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.dataService.set(this.name, key, value)
  }

  async remove(key: string): Promise<void> {
    await this.dataService.remove(this.name, key)
  }

  async getAll(): Promise<Record<string, unknown>> {
    return await this.dataService.getAll(this.name)
  }

  async removeAll(): Promise<void> {
    await this.dataService.removeAll(this.name)
  }
}
