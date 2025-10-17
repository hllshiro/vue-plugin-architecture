import type { IEventBus, PluginEvents } from '@vue-plugin-arch/types'
import mitt, { type Emitter, type Handler } from 'mitt'

/**
 * 基于 mitt 的简化版事件总线
 */
export class EventBus implements IEventBus {
  private readonly emitter: Emitter<PluginEvents>

  constructor() {
    this.emitter = mitt<PluginEvents>()
  }

  private getScopedEvent<Key extends keyof PluginEvents>(
    event: Key,
    scope?: string
  ): Key {
    return scope ? (`${scope}:${String(event)}` as Key) : event
  }

  /**
   * 注册一个事件监听器。
   * @param event 事件名称。
   * @param handler 事件处理函数。
   * @param scope 可选的作用域，用于隔离事件。
   */
  on<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    const scopedEvent = this.getScopedEvent(event, scope)
    this.emitter.on(scopedEvent, handler)
  }

  /**
   * 移除一个事件监听器。
   * @param event 事件名称。
   * @param handler 如果提供了具体的处理函数，则只移除该函数；否则，移除该事件的所有监听器。
   * @param scope 可选的作用域。
   */
  off<Key extends keyof PluginEvents>(
    event: Key,
    handler?: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    const scopedEvent = this.getScopedEvent(event, scope)
    this.emitter.off(scopedEvent, handler)
  }

  /**
   * 触发一个事件。
   * 所有监听器都会被同步调用。单个监听器中的错误会被捕获并打印到控制台，以防中断整个调用链。
   * @param event 事件名称。
   * @param payload 传递给监听器的数据。
   * @param scope 可选的作用域。
   */
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
    const scopedEvent = this.getScopedEvent(event, scope)
    try {
      this.emitter.emit(scopedEvent, payload as PluginEvents[Key])
    } catch (error) {
      console.error(
        `Error in event handler for "${String(scopedEvent)}":`,
        error
      )
    }
  }

  /**
   * 注册一个只执行一次的事件监听器。
   * @param event 事件名称。
   * @param handler 事件处理函数。
   * @param scope 可选的作用域。
   */
  once<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>,
    scope?: string
  ): void {
    const scopedEvent = this.getScopedEvent(event, scope)
    const onceHandler: Handler<PluginEvents[Key]> = payload => {
      handler(payload)
      this.emitter.off(scopedEvent, onceHandler)
    }
    this.emitter.on(scopedEvent, onceHandler)
  }

  /**
   * 清空所有事件的所有监听器。
   * @param scope 如果提供了作用域，则只清空该作用域下的监听器。
   */
  clear(scope?: string): void {
    if (scope) {
      const eventsToRemove = Object.keys(this.emitter.all).filter(event =>
        event.startsWith(`${scope}:`)
      )
      eventsToRemove.forEach(event => this.emitter.all.delete(event))
    } else {
      this.emitter.all.clear()
    }
  }
}

/**
 * 提供一个默认的全局事件总线实例，方便在应用中使用。
 */
export const globalEventBus = new EventBus()
