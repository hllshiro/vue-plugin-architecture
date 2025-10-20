import type { Component, AsyncComponentLoader } from 'vue'
import { defineAsyncComponent } from 'vue'
import type {
  ComponentRegistration,
  ComponentLoadOptions,
} from '@vue-plugin-arch/types'

/**
 * 组件注册表 - 管理动态组件的注册和加载
 */
export class ComponentRegistry {
  private components = new Map<string, ComponentRegistration>()
  private loadingPromises = new Map<string, Promise<Component>>()

  /**
   * 注册同步组件
   */
  registerComponent(name: string, component: Component): void {
    if (this.components.has(name)) {
      console.warn(`Component ${name} is already registered, overwriting...`)
    }

    this.components.set(name, {
      name,
      component,
      isAsync: false,
      loadedAt: Date.now(),
    })
  }

  /**
   * 注册异步组件
   */
  registerAsyncComponent(
    name: string,
    loader: AsyncComponentLoader,
    options: ComponentLoadOptions = {}
  ): void {
    if (this.components.has(name)) {
      console.warn(`Component ${name} is already registered, overwriting...`)
    }

    const asyncComponent = defineAsyncComponent({
      loader,
      loadingComponent: options.loadingComponent,
      errorComponent: options.errorComponent,
      delay: options.delay || 200,
      timeout: options.timeout || 3000,
      suspensible: false,
      onError: (error, retry, fail, attempts) => {
        const maxRetries = options.retries || 3
        if (attempts <= maxRetries) {
          retry()
        } else {
          console.error(
            `Failed to load component ${name} after ${attempts} attempts:`,
            error
          )
          this.components.set(name, {
            name,
            component: loader,
            isAsync: true,
            error: error as Error,
          })
          fail()
        }
      },
    })

    this.components.set(name, {
      name,
      component: asyncComponent,
      isAsync: true,
      loadedAt: Date.now(),
    })
  }

  /**
   * 通过模块路径注册异步组件
   */
  registerComponentFromPath(
    name: string,
    modulePath: string,
    options: ComponentLoadOptions = {}
  ): void {
    const loader: AsyncComponentLoader = () =>
      import(/* @vite-ignore */ modulePath)
    this.registerAsyncComponent(name, loader, options)
  }

  /**
   * 获取组件
   */
  getComponent(name: string): Component | undefined {
    const registration = this.components.get(name)
    return registration?.component as Component
  }

  /**
   * 异步获取组件 (确保组件已加载)
   */
  async getComponentAsync(name: string): Promise<Component | undefined> {
    const registration = this.components.get(name)
    if (!registration) {
      return undefined
    }

    if (!registration.isAsync) {
      return registration.component as Component
    }

    // 如果是异步组件且有错误，返回 undefined
    if (registration.error) {
      return undefined
    }

    // 如果已经在加载中，等待加载完成
    if (this.loadingPromises.has(name)) {
      try {
        return await this.loadingPromises.get(name)
      } catch (error) {
        console.error(`Failed to load component ${name}:`, error)
        return undefined
      }
    }

    // 开始加载异步组件
    const loadingPromise = this.loadAsyncComponent(registration)
    this.loadingPromises.set(name, loadingPromise)

    try {
      const component = await loadingPromise
      this.loadingPromises.delete(name)
      return component
    } catch (error) {
      this.loadingPromises.delete(name)
      console.error(`Failed to load component ${name}:`, error)
      return undefined
    }
  }

  /**
   * 加载异步组件
   */
  private async loadAsyncComponent(
    registration: ComponentRegistration
  ): Promise<Component> {
    if (typeof registration.component === 'function') {
      // 如果是 AsyncComponentLoader
      const loader = registration.component as AsyncComponentLoader
      const module = await loader()

      // 处理不同的导出格式
      if (module && typeof module === 'object') {
        return (
          (module as { default?: Component }).default || (module as Component)
        )
      }

      return module as Component
    }

    // 如果已经是组件实例
    return registration.component as Component
  }

  /**
   * 检查组件是否已注册
   */
  hasComponent(name: string): boolean {
    return this.components.has(name)
  }

  /**
   * 取消注册组件
   */
  unregisterComponent(name: string): boolean {
    this.loadingPromises.delete(name)
    return this.components.delete(name)
  }

  /**
   * 获取所有已注册的组件名称
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.components.keys())
  }

  /**
   * 获取组件注册信息
   */
  getComponentRegistration(name: string): ComponentRegistration | undefined {
    return this.components.get(name)
  }

  /**
   * 清除所有组件
   */
  clear(): void {
    this.loadingPromises.clear()
    this.components.clear()
  }

  /**
   * 预加载异步组件
   */
  async preloadComponent(name: string): Promise<boolean> {
    try {
      const component = await this.getComponentAsync(name)
      return component !== undefined
    } catch (error) {
      console.error(`Failed to preload component ${name}:`, error)
      return false
    }
  }

  /**
   * 批量预加载组件
   */
  async preloadComponents(
    names: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const results = await Promise.allSettled(
      names.map(async name => {
        const success = await this.preloadComponent(name)
        return { name, success }
      })
    )

    const success: string[] = []
    const failed: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        success.push(names[index])
      } else {
        failed.push(names[index])
      }
    })

    return { success, failed }
  }
}
