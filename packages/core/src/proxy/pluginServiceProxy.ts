// PluginServiceProxy 接口的具体实现

import type {
  IEventBus,
  IPluginLayoutManager,
  IPluginServiceProxy,
  IPluginDataService,
  IPluginLayoutApi,
  IPluginDataAPI,
  IPluginEventAPI,
} from '@vue-plugin-arch/types'
import { PluginDataAPI, PluginEventApi, PluginLayoutApi } from '..'

// PluginServiceProxy 实现类
export class PluginServiceProxy implements IPluginServiceProxy {
  public readonly dataApi: IPluginDataAPI
  public readonly eventApi: IPluginEventAPI
  public readonly layoutApi: IPluginLayoutApi

  constructor(
    private readonly name: string,
    private readonly layoutManager: IPluginLayoutManager,
    private readonly eventBus: IEventBus,
    private readonly dataService: IPluginDataService
  ) {
    this.dataApi = new PluginDataAPI(this.name, this.dataService)
    this.eventApi = new PluginEventApi(this.name, this.eventBus)
    this.layoutApi = new PluginLayoutApi(this.name, this.layoutManager)
  }

  destroy() {
    this.eventBus.clear(this.name)
  }
}

// PluginServiceProxy 工厂函数
export function createPluginServiceProxy(
  name: string,
  layoutManager: IPluginLayoutManager,
  eventBus: IEventBus,
  dataService: IPluginDataService
): IPluginServiceProxy {
  return new PluginServiceProxy(name, layoutManager, eventBus, dataService)
}
