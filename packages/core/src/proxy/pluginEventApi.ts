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

  private getScope(scope?: string) {
    return scope ?? this.name
  }

  on<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.on(event, handler, this.getScope(scope))
  }
  off<Key extends keyof PluginEvents>(
    event: Key,
    handler?: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.off(event, handler, this.getScope(scope))
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
    this.eventBus.emit(
      event,
      payload as PluginEvents[Key],
      this.getScope(scope)
    )
  }
  once<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    this.eventBus.once(event, handler, this.getScope(scope))
  }
}
