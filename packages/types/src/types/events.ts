// 事件系统相关类型定义

import type { IPluginError } from './errors'
import type { PluginManifest, PanelOptions, DataChangeEvent } from './plugin'
import type { Handler } from 'mitt'

export type EventHandler = (payload?: unknown) => void | Promise<void>

// 插件事件类型
export interface PluginEvents extends Record<string | symbol, unknown> {
  'plugin:loaded': { name: string; manifest: PluginManifest }
  'plugin:unloaded': { name: string }
  'plugin:error': { name: string; error: IPluginError }
  'panel:registered': { panelId: string; options: PanelOptions }
  'panel:removed': { panelId: string }
  'panel:updated': { panelId: string; options: Partial<PanelOptions> }
  'data:changed': DataChangeEvent
}

// 事件总线接口
export interface IEventBus {
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
  clear(scope?: string): void
}
