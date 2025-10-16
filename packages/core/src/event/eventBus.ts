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

  /**
   * 注册一个事件监听器。
   * @param event 事件名称。
   * @param handler 事件处理函数。
   */
  on<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>
  ): void {
    this.emitter.on(event, handler)
  }

  /**
   * 移除一个事件监听器。
   * @param event 事件名称。
   * @param handler 如果提供了具体的处理函数，则只移除该函数；否则，移除该事件的所有监听器。
   */
  off<Key extends keyof PluginEvents>(
    event: Key,
    handler?: Handler<PluginEvents[Key]>
  ): void {
    this.emitter.off(event, handler)
  }

  /**
   * 触发一个事件。
   * 所有监听器都会被同步调用。单个监听器中的错误会被捕获并打印到控制台，以防中断整个调用链。
   * @param event 事件名称。
   * @param payload 传递给监听器的数据。
   */
  emit<Key extends keyof PluginEvents>(
    event: Key,
    payload: PluginEvents[Key]
  ): void
  emit<Key extends keyof PluginEvents>(
    event: undefined extends PluginEvents[Key] ? Key : never
  ): void
  emit<Key extends keyof PluginEvents>(
    event: Key,
    payload?: PluginEvents[Key]
  ): void {
    try {
      this.emitter.emit(event, payload as PluginEvents[Key])
    } catch (error) {
      console.error(`Error in event handler for "${String(event)}":`, error)
    }
  }

  /**
   * 注册一个只执行一次的事件监听器。
   * @param event 事件名称。
   * @param handler 事件处理函数。
   */
  once<Key extends keyof PluginEvents>(
    event: Key,
    handler: Handler<PluginEvents[Key]>
  ): void {
    const onceHandler: Handler<PluginEvents[Key]> = payload => {
      handler(payload)
      this.emitter.off(event, onceHandler)
    }
    this.emitter.on(event, onceHandler)
  }

  /**
   * 清空所有事件的所有监听器。
   */
  clear(): void {
    this.emitter.all.clear()
  }
}

/**
 * 提供一个默认的全局事件总线实例，方便在应用中使用。
 */
export const globalEventBus = new EventBus()
