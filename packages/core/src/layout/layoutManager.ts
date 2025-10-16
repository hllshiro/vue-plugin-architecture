import type { App, Component } from 'vue'
import { shallowRef } from 'vue'
import type { AddPanelPositionOptions, DockviewApi } from 'dockview-vue'
import type {
  PanelOptions,
  PanelInfo,
  PanelPosition,
  PanelState,
  LayoutSnapshot,
  IPluginLayoutManager,
  IEventBus,
} from '@vue-plugin-arch/types'
import { ComponentRegistry } from './componentRegistry'
import DynamicPanel from './dynamic-panel.vue'

export class PluginLayoutManager implements IPluginLayoutManager {
  private dockviewApi?: DockviewApi
  private panels = new Map<string, PanelInfo>()
  private eventBus: IEventBus
  private panelIdCounter = 0
  private componentRegistry: ComponentRegistry

  constructor(app: App, eventBus: IEventBus) {
    this.eventBus = eventBus
    this.componentRegistry = new ComponentRegistry()

    // 注册默认的动态面板组件
    app.component('DynamicPanel', DynamicPanel)

    // 在 app 中提供组件注册表
    app.provide('componentRegistry', shallowRef(this.componentRegistry))

    this.setupEventHandlers()
  }

  /**
   * 初始化 Dockview API
   */
  setDockviewApi(api: DockviewApi): void {
    this.dockviewApi = api
    this.setupDockviewEventHandlers()
  }

  /**
   * 获取 Dockview API
   */
  getDockviewApi(): DockviewApi | undefined {
    return this.dockviewApi
  }

  /**
   * 注册面板
   */
  registerPanel(options: PanelOptions): string {
    if (!this.dockviewApi) {
      throw new Error(
        'Dockview API not initialized. Call setDockviewApi() first.'
      )
    }

    const panelId = options.id || this.generatePanelId()
    const componentName = options.component

    try {
      // 检查组件是否在我们自己的注册表中
      if (!this.componentRegistry.hasComponent(componentName)) {
        throw new Error(`Failed to find Vue Component '${componentName}'`)
      }

      // 始终使用 DynamicPanel 作为包装器
      const panel = this.dockviewApi.addPanel({
        id: panelId,
        component: 'DynamicPanel', // 硬编码为我们的包装器组件
        title: options.title || panelId,
        params: {
          // 将真正的组件名和参数传给 DynamicPanel
          componentName: componentName,
          componentProps: options.params || {},
          panelId,
        },
        position: this.getPosition(options.position),
      })

      // 记录面板信息
      const panelInfo: PanelInfo = {
        id: panelId,
        panel,
        options,
        createdAt: Date.now(),
      }

      this.panels.set(panelId, panelInfo)

      // 发送事件
      this.eventBus?.emit('panel:registered', { panelId, options })

      return panelId
    } catch (error) {
      throw new Error(
        `Failed to register panel ${panelId}: ${(error as Error).message}`
      )
    }
  }

  /**
   * 移除面板
   */
  removePanel(panelId: string): void {
    if (!this.dockviewApi) {
      throw new Error('Dockview API not initialized')
    }

    const panelInfo = this.panels.get(panelId)
    if (!panelInfo) {
      throw new Error(`Panel ${panelId} not found`)
    }

    try {
      const panel = panelInfo.panel
      this.dockviewApi.removePanel(panel)
      this.panels.delete(panelId)
      this.eventBus?.emit('panel:removed', { panelId })
    } catch (error) {
      throw new Error(
        `Failed to remove panel ${panelId}: ${(error as Error).message}`
      )
    }
  }

  /**
   * 更新面板
   */
  updatePanel(panelId: string, options: Partial<PanelOptions>): void {
    const panelInfo = this.panels.get(panelId)
    if (!panelInfo) {
      throw new Error(`Panel ${panelId} not found`)
    }

    try {
      const panel = panelInfo.panel

      if (options.title !== undefined) {
        panel.setTitle(options.title)
      }

      if (options.params !== undefined) {
        panel.api.updateParameters(options.params)
      }

      // 更新记录
      panelInfo.options = { ...panelInfo.options, ...options }
      this.eventBus?.emit('panel:updated', { panelId, options })
    } catch (error) {
      throw new Error(
        `Failed to update panel ${panelId}: ${(error as Error).message}`
      )
    }
  }

  /**
   * 获取面板信息
   */
  getPanel(panelId: string): PanelInfo | undefined {
    return this.panels.get(panelId)
  }

  /**
   * 获取所有面板
   */
  getAllPanels(): PanelInfo[] {
    return Array.from(this.panels.values())
  }

  /**
   * 检查面板是否存在
   */
  hasPanel(panelId: string): boolean {
    return this.panels.has(panelId)
  }

  /**
   * 获取组件注册表
   */
  getComponentRegistry(): ComponentRegistry {
    return this.componentRegistry
  }

  /**
   * 注册组件
   */
  registerComponent(name: string, component: Component): void {
    this.componentRegistry.registerComponent(name, component)
    this.eventBus?.emit('component:registered', { name })
  }

  /**
   * 注销组件
   */
  unregisterComponent(name: string): void {
    this.componentRegistry.unregisterComponent(name)
    this.eventBus?.emit('component:unregistered', { name })
  }

  /**
   * 注册异步组件
   */
  registerAsyncComponent(name: string, loader: () => Promise<Component>): void {
    this.componentRegistry.registerAsyncComponent(name, loader)
    this.eventBus?.emit('component:registered', { name, async: true })
  }

  /**
   * 通过模块路径注册组件
   */
  registerComponentFromPath(name: string, modulePath: string): void {
    this.componentRegistry.registerComponentFromPath(name, modulePath)
    this.eventBus?.emit('component:registered', { name, path: modulePath })
  }

  /**
   * 注册动态面板 (使用组件名称而不是组件实例)
   */
  async registerDynamicPanel(
    options: Omit<PanelOptions, 'component'> & { componentName: string }
  ): Promise<string> {
    if (!this.dockviewApi) {
      throw new Error(
        'Dockview API not initialized. Call setDockviewApi() first.'
      )
    }

    const panelId = options.id || this.generatePanelId()

    try {
      // 检查组件是否已注册
      if (!this.componentRegistry.hasComponent(options.componentName)) {
        throw new Error(
          `Component "${options.componentName}" is not registered`
        )
      }

      // 使用 DynamicPanel 作为包装器
      const panel = this.dockviewApi.addPanel({
        id: panelId,
        component: 'DynamicPanel',
        title: options.title || panelId,
        params: {
          ...options.params,
          componentName: options.componentName,
          componentProps: options.params || {},
          panelId,
        },
        position: this.getPosition(options.position),
      })

      // 记录面板信息
      const panelInfo: PanelInfo = {
        id: panelId,
        panel,
        options: {
          ...options,
          component: options.componentName,
        },
        createdAt: Date.now(),
      }

      this.panels.set(panelId, panelInfo)

      // 发送事件 - 构造完整的 PanelOptions 对象
      const completeOptions: PanelOptions = {
        ...options,
        component: options.componentName,
      }
      this.eventBus?.emit('panel:registered', {
        panelId,
        options: completeOptions,
      })

      return panelId
    } catch (error) {
      throw new Error(
        `Failed to register dynamic panel ${panelId}: ${
          (error as Error).message
        }`
      )
    }
  }

  /**
   * 更新面板组件
   */
  async updatePanelComponent(
    panelId: string,
    componentName: string,
    componentProps?: Record<string, unknown>
  ): Promise<void> {
    const panelInfo = this.panels.get(panelId)
    if (!panelInfo) {
      throw new Error(`Panel ${panelId} not found`)
    }

    try {
      // 检查新组件是否已注册
      if (!this.componentRegistry.hasComponent(componentName)) {
        throw new Error(`Component "${componentName}" is not registered`)
      }

      const panel = panelInfo.panel

      // 更新面板参数
      const newParams = {
        ...panelInfo.options.params,
        componentName,
        componentProps: componentProps || {},
      }

      panel.api.updateParameters(newParams)

      // 更新记录
      panelInfo.options = {
        ...panelInfo.options,
        component: componentName,
        params: newParams,
      }

      this.eventBus?.emit('panel:component-updated', {
        panelId,
        componentName,
        componentProps,
      })
    } catch (error) {
      throw new Error(
        `Failed to update panel component ${panelId}: ${
          (error as Error).message
        }`
      )
    }
  }

  /**
   * 预加载组件
   */
  async preloadComponent(componentName: string): Promise<boolean> {
    try {
      return await this.componentRegistry.preloadComponent(componentName)
    } catch (error) {
      console.error(`Failed to preload component ${componentName}:`, error)
      return false
    }
  }

  /**
   * 批量预加载组件
   */
  async preloadComponents(
    componentNames: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    return await this.componentRegistry.preloadComponents(componentNames)
  }

  /**
   * 生成面板ID
   */
  private generatePanelId(): string {
    return `panel-${++this.panelIdCounter}`
  }

  /**
   * 获取位置配置
   */
  private getPosition(
    position?: PanelPosition
  ): AddPanelPositionOptions | undefined {
    if (!position) return undefined

    const positionMap: Record<PanelPosition, { direction: string }> = {
      left: { direction: 'left' },
      right: { direction: 'right' },
      top: { direction: 'above' },
      bottom: { direction: 'below' },
      center: { direction: 'within' },
    }

    return positionMap[position]
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {}

  /**
   * 设置 Dockview 事件处理器
   */
  private setupDockviewEventHandlers(): void {}

  /**
   * 移动面板到指定位置
   */
  movePanelToPosition(
    panelId: string,
    position: PanelPosition,
    targetPanelId?: string
  ): void {
    console.debug('movePanelToPosition', panelId, position, targetPanelId)
    throw Error('no implements')
  }

  /**
   * 激活面板
   */
  activatePanel(panelId: string): void {
    console.debug('activatePanel', panelId)
    throw Error('no implements')
  }

  /**
   * 隐藏面板
   */
  hidePanel(panelId: string): void {
    console.debug('hidePanel', panelId)
    throw Error('no implements')
  }

  /**
   * 显示面板
   */
  showPanel(panelId: string): void {
    console.debug('showPanel', panelId)
    throw Error('no implements')
  }

  /**
   * 切换面板可见性
   */
  togglePanel(panelId: string): void {
    console.debug('togglePanel', panelId)
    throw Error('no implements')
  }

  /**
   * 设置面板大小
   */
  resizePanel(panelId: string, width?: number, height?: number): void {
    console.debug('resizePanel', panelId, width, height)
    throw Error('no implements')
  }

  /**
   * 获取面板状态
   */
  getPanelState(panelId: string): PanelState | undefined {
    console.debug('getPanelState', panelId)
    throw Error('no implements')
  }

  /**
   * 获取所有面板状态
   */
  getAllPanelStates(): PanelState[] {
    console.debug('getAllPanelStates')
    throw Error('no implements')
  }

  /**
   * 保存布局配置
   */
  saveLayout(): LayoutSnapshot {
    console.debug('saveLayout')
    throw Error('no implements')
  }

  /**
   * 恢复布局配置
   */
  restoreLayout(snapshot: LayoutSnapshot): void {
    console.debug('restoreLayout', snapshot)
    throw Error('no implements')
  }

  /**
   * 清除所有面板
   */
  clearAllPanels(): void {
    console.debug('clearAllPanels')
    throw Error('no implements')
  }

  /**
   * 获取面板位置
   */
  public getPanelPosition(panelId: string): PanelPosition | undefined {
    console.debug('getPanelPosition', panelId)
    throw Error('no implements')
  }

  /**
   * 清理插件相关的面板
   */
  public cleanupPluginPanels(name: string): void {
    console.debug('cleanupPluginPanels', name)
    throw Error('no implements')
  }
}

export function createPluginLayoutManager(
  app: App,
  eventBus: IEventBus
): PluginLayoutManager {
  return new PluginLayoutManager(app, eventBus)
}
