import {
  IPluginLayoutApi,
  IPluginLayoutManager,
  PanelOptions,
} from '@vue-plugin-arch/types'
import type { Component } from 'vue'

export class PluginLayoutApi implements IPluginLayoutApi {
  constructor(
    private readonly name: string,
    private readonly layoutManager: IPluginLayoutManager
  ) {
    console.debug(`[PluginLayoutApi] ${this.name} loaded`)
  }

  // 面板管理方法
  registerPanel(options: PanelOptions): string {
    return this.layoutManager.registerPanel(options)
  }

  removePanel(panelId: string): void {
    this.layoutManager.removePanel(panelId)
  }

  updatePanel(panelId: string, options: Partial<PanelOptions>): void {
    this.layoutManager.updatePanel(panelId, options)
  }

  registerComponent(name: string, component: Component): void {
    this.layoutManager.registerComponent(name, component)
  }

  unregisterComponent(name: string): void {
    this.layoutManager.unregisterComponent(name)
  }
}
