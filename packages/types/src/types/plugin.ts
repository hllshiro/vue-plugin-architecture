// 插件系统相关类型定义

import type { DockviewApi, IDockviewPanel } from 'dockview-vue'
import type { EventHandler, IEventBus, PluginEvents } from './events'
import type { Component } from 'vue'
import { Handler } from 'mitt'

// Forward declarations to avoid circular imports
export type PanelPosition = 'left' | 'right' | 'top' | 'bottom' | 'center'

// ConfigSchema is defined in data-and-config.ts to avoid duplication

export interface PanelOptions {
  id: string
  component: string
  title?: string
  position?: PanelPosition
  params?: Record<string, unknown>
  closable?: boolean
  resizable?: boolean
}

export interface IPluginLayoutManager {
  registerPanel(options: PanelOptions): string
  removePanel(panelId: string): void
  updatePanel(panelId: string, options: Partial<PanelOptions>): void
  registerComponent(name: string, component: Component): void
  unregisterComponent(name: string): void

  setDockviewApi(api: DockviewApi): void
  getDockviewApi(): DockviewApi | undefined
}

// 面板信息接口
export interface PanelInfo {
  id: string
  panel: IDockviewPanel
  options: PanelOptions
}

// 面板状态接口
export interface PanelState {
  id: string
  title: string
  isVisible: boolean
  isActive: boolean
  size: { width?: number; height?: number }
  position?: PanelPosition
}

// 布局快照接口
export interface LayoutSnapshot {
  layoutData: Record<string, unknown>
  panelStates: PanelState[]
  timestamp: number
}

// 插件组件定义
export interface PluginComponent {
  name: string // 组件名称
  path: string // 组件文件路径
  defaultPosition?: PanelPosition // 默认面板位置
  title?: string // 面板标题
  icon?: string // 面板图标
}

// 插件清单接口 - 来源 package.json
export interface PluginManifest {
  name: string // 包名，唯一
  version: string // 插件版本
  description: string // 插件描述
  main: string // 入口文件
  displayName?: string // 通过id生成（删除固定头）
  components?: PluginComponent[] // 组件列表
  icon?: string // 插件图标
}

export interface PluginLoader {
  loader: () => Promise<PluginModule>
  manifest: PluginManifest
}

// Plugin manifest map for virtual module
export interface PluginLoaderMap {
  [packageName: string]: PluginLoader
}

// 插件模块接口
export interface PluginModule {
  install: (host: IPluginServiceProxy) => PluginAPI
}

export interface Plugin {
  module: PluginModule
  manifest: PluginManifest
}

// 插件API接口
export interface PluginAPI {
  teardown?: () => void | Promise<void>
  [key: string]: unknown
}

// 插件管理器接口
export interface IPluginManager {
  readonly layoutManager: IPluginLayoutManager
  readonly eventBus: IEventBus

  loadPlugin(packageName: string): Promise<void>
  unloadPlugin(name: string): Promise<void>
  getLoadedPlugins(): PluginInfo[]
  isPluginLoaded(name: string): boolean
  destroy(): Promise<void>
}

// 插件信息
export interface PluginInfo {
  id: string
  manifest: PluginManifest
  api: PluginAPI
  loadedAt: number
}

// 插件状态枚举
export type PluginStatus = 'loading' | 'loaded' | 'error' | 'unloaded'

// 插件状态接口
export interface PluginState {
  id: string
  status: PluginStatus
  manifest: PluginManifest
  api?: PluginAPI
  loadedAt?: number
  error?: Error
  panels: string[]
  eventHandlers: Map<string, EventHandler[]>
}

/**
 * 数据变更监听器
 */
export type DataChangeListener = (event: DataChangeEvent) => void

/**
 * 插件存储接口 - 宿主应用需要实现的存储接口
 * 支持异步操作，包含name参数用于数据隔离
 */
export interface IPluginStorage {
  /**
   * 设置插件数据
   * @param name 插件ID，用于数据隔离
   * @param key 数据键
   * @param value 数据值
   */
  set(name: string, key: string, value: unknown): Promise<void>

  /**
   * 获取插件数据
   * @param name 插件ID
   * @param key 数据键
   * @returns 数据值，不存在时返回undefined
   */
  get(name: string, key: string): Promise<unknown>

  /**
   * 获取插件所有数据
   * @param name 插件ID
   * @returns 插件的所有数据
   */
  getAll(name: string): Promise<Record<string, unknown>>

  /**
   * 删除插件数据
   * @param name 插件ID
   * @param key 数据键
   */
  remove(name: string, key: string): Promise<void>

  /**
   * 删除插件所有数据
   * @param name 插件ID
   */
  removeAll(name: string): Promise<void>

  /**
   * 清空所有插件数据
   */
  clear(): Promise<void>
}

/**
 * 数据变更事件
 */
export interface DataChangeEvent {
  /** 插件ID，global代表全局 */
  name: string
  /** 变更的数据键 */
  key: string
  /** 旧值，null代表新增 */
  oldValue: unknown
  /** 新值，null代表删除 */
  newValue?: unknown
}

export interface IPluginDataService {
  /**
   * 获取数据
   * @param key 数据键
   * @returns 数据值，不存在时返回undefined
   */
  get(name: string, key: string): Promise<unknown>

  /**
   * 设置数据
   * @param key 数据键
   * @param value 数据值
   */
  set(name: string, key: string, value: unknown): Promise<void>

  /**
   * 删除数据
   * @param key 数据键
   */
  remove(name: string, key: string): Promise<void>

  /**
   * 获取插件所有数据（包含全局数据）
   * @returns 插件数据与全局数据的合并结果，插件数据优先
   */
  getAll(name: string): Promise<Record<string, unknown>>

  /**
   * 删除插件所有数据（重置）
   */
  removeAll(name: string): Promise<void>
}

/**
 * 插件数据API接口
 */
export interface IPluginDataAPI {
  /**
   * 获取数据
   * @param key 数据键
   * @returns 数据值，不存在时返回undefined
   */
  get(key: string): Promise<unknown>

  /**
   * 设置数据
   * @param key 数据键
   * @param value 数据值
   */
  set(key: string, value: unknown): Promise<void>

  /**
   * 删除数据
   * @param key 数据键
   */
  remove(key: string): Promise<void>

  /**
   * 获取所有数据（包含全局数据）
   * @returns 插件数据与全局数据的合并结果，插件数据优先
   */
  getAll(): Promise<Record<string, unknown>>

  /**
   * 删除所有插件数据（重置）
   */
  removeAll(): Promise<void>
}
/**
 * 插件事件API接口
 */
export interface IPluginEventAPI {
  on<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void
  off<Key extends keyof PluginEvents>(
    event: Key,
    handler?: Handler<PluginEvents[Key]>,
    scope?: string
  ): void
  emit<Key extends keyof PluginEvents>(
    event: Key,
    payload: PluginEvents[Key],
    scope?: string
  ): void
  emit<Key extends keyof PluginEvents>(
    event: undefined extends PluginEvents[Key] ? Key : never,
    scope?: string
  ): void
  once<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void
}

export interface IPluginLayoutApi {
  registerPanel(options: PanelOptions): string
  removePanel(panelId: string): void
  updatePanel(panelId: string, options: Partial<PanelOptions>): void
  registerComponent(name: string, component: Component): void
  unregisterComponent(name: string): void
}

// 插件服务代理接口
export interface IPluginServiceProxy {
  readonly dataApi: IPluginDataAPI
  readonly eventApi: IPluginEventAPI
  readonly layoutApi: IPluginLayoutApi

  destroy(): void
}
