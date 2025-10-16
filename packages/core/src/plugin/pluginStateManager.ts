import type {
  PluginManifest,
  EventHandler,
  PluginState,
} from '@vue-plugin-arch/types'

// 插件状态管理器
export class PluginStateManager {
  private states = new Map<string, PluginState>()

  /**
   * 创建初始插件状态
   */
  createInitialState(name: string, manifest: PluginManifest): PluginState {
    const state: PluginState = {
      id: name,
      status: 'loading',
      manifest,
      panels: [],
      eventHandlers: new Map(),
    }

    this.states.set(name, state)
    return state
  }

  /**
   * 更新插件状态
   */
  updateState(name: string, updates: Partial<PluginState>): void {
    const current = this.states.get(name)
    if (!current) {
      throw new Error(`Plugin state not found: ${name}`)
    }

    const updated = { ...current, ...updates }
    this.states.set(name, updated)
  }

  /**
   * 获取插件状态
   */
  getState(name: string): PluginState | undefined {
    return this.states.get(name)
  }

  /**
   * 获取所有插件状态
   */
  getAllStates(): PluginState[] {
    return Array.from(this.states.values())
  }

  /**
   * 删除插件状态
   */
  removeState(name: string): void {
    this.states.delete(name)
  }

  /**
   * 检查插件是否已加载
   */
  isLoaded(name: string): boolean {
    const state = this.states.get(name)
    return state?.status === 'loaded'
  }

  /**
   * 检查插件是否正在加载
   */
  isLoading(name: string): boolean {
    const state = this.states.get(name)
    return state?.status === 'loading'
  }

  /**
   * 检查插件是否有错误
   */
  hasError(name: string): boolean {
    const state = this.states.get(name)
    return state?.status === 'error'
  }

  /**
   * 获取已加载的插件列表
   */
  getLoadedPlugins(): PluginState[] {
    return this.getAllStates().filter(state => state.status === 'loaded')
  }

  /**
   * 获取有错误的插件列表
   */
  getErrorPlugins(): PluginState[] {
    return this.getAllStates().filter(state => state.status === 'error')
  }

  /**
   * 添加面板到插件状态
   */
  addPanel(name: string, panelId: string): void {
    const state = this.states.get(name)
    if (state && !state.panels.includes(panelId)) {
      state.panels.push(panelId)
    }
  }

  /**
   * 从插件状态移除面板
   */
  removePanel(name: string, panelId: string): void {
    const state = this.states.get(name)
    if (state) {
      state.panels = state.panels.filter(id => id !== panelId)
    }
  }

  /**
   * 添加事件处理器到插件状态
   */
  addEventHandler(
    name: string,
    eventName: string,
    handler: EventHandler
  ): void {
    const state = this.states.get(name)
    if (state) {
      if (!state.eventHandlers.has(eventName)) {
        state.eventHandlers.set(eventName, [])
      }
      state.eventHandlers.get(eventName)!.push(handler)
    }
  }

  /**
   * 从插件状态移除事件处理器
   */
  removeEventHandler(
    name: string,
    eventName: string,
    handler?: EventHandler
  ): void {
    const state = this.states.get(name)
    if (state && state.eventHandlers.has(eventName)) {
      const handlers = state.eventHandlers.get(eventName)!
      if (handler) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      } else {
        // 移除所有处理器
        state.eventHandlers.delete(eventName)
      }
    }
  }

  /**
   * 获取插件的所有事件处理器
   */
  getEventHandlers(name: string): Map<string, EventHandler[]> {
    const state = this.states.get(name)
    return state?.eventHandlers || new Map()
  }

  /**
   * 清理插件的所有资源
   */
  clearPluginResources(name: string): void {
    const state = this.states.get(name)
    if (state) {
      state.panels = []
      state.eventHandlers.clear()
    }
  }
}
