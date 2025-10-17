// PluginServiceProxy 接口的具体实现

import type {
  PanelOptions,
  IEventBus,
  IPluginLayoutManager,
  IPluginDataAPI,
  IPluginServiceProxy,
  IPluginDataService,
} from '@vue-plugin-arch/types'
import type { Component } from 'vue'

// PluginServiceProxy 实现类
export class PluginServiceProxy implements IPluginServiceProxy {
  private readonly name: string
  private readonly layoutManager: IPluginLayoutManager
  private readonly dataService: IPluginDataService
  public readonly eventBus: IEventBus

  constructor(
    name: string,
    layoutManager: IPluginLayoutManager,
    eventBus: IEventBus,
    dataService: IPluginDataService
  ) {
    this.name = name
    this.layoutManager = layoutManager
    this.eventBus = eventBus
    this.dataService = dataService
  }

  // 面板管理方法
  registerPanel(options: PanelOptions): string {
    try {
      const panelId = this.layoutManager.registerPanel(options)
      console.info(`Panel registered: ${panelId}`, { options })
      return panelId
    } catch (error) {
      console.error(`Failed to register panel: ${options.id}`, error)
      throw error
    }
  }

  removePanel(panelId: string): void {
    try {
      this.layoutManager.removePanel(panelId)
      console.info(`Panel removed: ${panelId}`)
    } catch (error) {
      console.error(`Failed to remove panel: ${panelId}`, error)
      throw error
    }
  }

  updatePanel(panelId: string, options: Partial<PanelOptions>): void {
    try {
      this.layoutManager.updatePanel(panelId, options)
      console.info(`Panel updated: ${panelId}`, { options })
    } catch (error) {
      console.error(`Failed to update panel: ${panelId}`, error)
      throw error
    }
  }

  registerComponent(name: string, component: Component): void {
    try {
      this.layoutManager.registerComponent(name, component)
      console.info(`Component registered: ${name}`)
    } catch (error) {
      console.error(`Failed to register component: ${name}`, error)
      throw error
    }
  }

  unregisterComponent(name: string): void {
    try {
      this.layoutManager.unregisterComponent(name)
      console.info(`Component unregistered: ${name}`)
    } catch (error) {
      console.error(`Failed to unregister component: ${name}`, error)
      throw error
    }
  }

  // 数据存储管理方法
  getDataAPI(): IPluginDataAPI {
    try {
      const dataAPI = this.dataService.createAPI(this.name)
      console.debug(`Data API created for plugin: ${this.name}`)
      return dataAPI
    } catch (error) {
      console.error(`Failed to create data API for plugin: ${this.name}`, error)
      throw error
    }
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
