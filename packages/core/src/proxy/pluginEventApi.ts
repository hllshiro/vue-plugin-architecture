import {
  IEventBus,
  IPluginEventAPI,
  PluginEvents,
} from '@vue-plugin-arch/types'
import { Handler } from 'mitt'

export class PluginEventApi implements IPluginEventAPI {
  constructor(
    private readonly name: string,
    private readonly eventBus: IEventBus
  ) {}

  on<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.on(event, handler, scope ?? this.name)
  }
  off<Key extends keyof PluginEvents>(
    event: Key,
    handler?: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.off(event, handler, scope ?? this.name)
  }
  emit<Key extends keyof PluginEvents>(
    event: Key,
    payload: PluginEvents[Key],
    scope?: string
  ): void
  emit<Key extends keyof PluginEvents>(
    event: undefined extends PluginEvents[Key] ? Key : never,
    scope?: string
  ): void
  emit<Key extends keyof PluginEvents>(
    event: Key,
    payload?: PluginEvents[Key],
    scope?: string
  ): void {
    this.eventBus.emit(event, payload as PluginEvents[Key], scope ?? this.name)
  }
  once<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.once(event, handler, scope ?? this.name)
  }
}
