import type {
  PluginManifest,
  PluginRegistryManifest,
} from '@vue-plugin-arch/types'

/**
 * 示例插件注册表服务实现
 * 宿主应用应该根据自己的需求实现IPluginRegistryService接口
 */
export class PluginRegistryService {
  private readonly registryUrl: string
  private cache: PluginManifest[] | null = null
  private cacheExpiry: number = 0
  private readonly cacheTimeout: number = 5 * 60 * 1000 // 5分钟缓存

  constructor(registryUrl: string = '/api/plugin-registry') {
    this.registryUrl = registryUrl
  }

  /**
   * 从注册表端点获取可用插件
   */
  async fetchAvailablePlugins(): Promise<PluginManifest[]> {
    // 检查缓存
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache
    }

    try {
      const response = await fetch(this.registryUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(
          `获取插件注册表失败: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      // 验证响应结构
      if (!this.isValidRegistryResponse(data)) {
        throw new Error('插件注册表响应格式无效')
      }

      const plugins = data.plugins || []

      // 验证每个插件清单
      const validPlugins = plugins.filter((plugin: unknown) =>
        this.isValidPluginManifest(plugin)
      )

      if (validPlugins.length !== plugins.length) {
        console.warn(
          `过滤掉了 ${plugins.length - validPlugins.length} 个无效的插件清单`
        )
      }

      // 更新缓存
      this.cache = validPlugins
      this.cacheExpiry = Date.now() + this.cacheTimeout

      return validPlugins
    } catch (error) {
      // 优雅处理网络故障
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('网络错误：无法连接到插件注册表')
      }

      if (error instanceof SyntaxError) {
        throw new Error('插件注册表返回的JSON格式无效')
      }

      throw error
    }
  }

  /**
   * 获取本地发现的插件（开发模式）
   * 注意：此方法返回空数组，因为本地插件发现
   * 在开发期间由Vite插件处理
   */
  async getLocalPlugins(): Promise<PluginManifest[]> {
    // 在生产环境中，本地插件不可用
    // 在开发环境中，Vite插件处理本地插件发现
    // 并将它们合并到注册表响应中
    return []
  }

  /**
   * 获取合并的插件列表（远程 + 本地）
   * 在此实现中，Vite插件在开发期间处理合并
   */
  async getMergedPluginList(): Promise<PluginManifest[]> {
    // Vite插件拦截注册表端点并处理合并
    // 所以此方法等同于fetchAvailablePlugins
    return this.fetchAvailablePlugins()
  }

  /**
   * 清除插件注册表缓存
   */
  clearCache(): void {
    this.cache = null
    this.cacheExpiry = 0
  }

  /**
   * 验证注册表响应结构
   */
  private isValidRegistryResponse(
    data: unknown
  ): data is PluginRegistryManifest {
    if (!data || typeof data !== 'object') {
      return false
    }

    const manifest = data as Record<string, unknown>

    return (
      Array.isArray(manifest.plugins) &&
      typeof manifest.version === 'string' &&
      typeof manifest.lastUpdated === 'string'
    )
  }

  /**
   * 验证单个插件清单
   */
  private isValidPluginManifest(plugin: unknown): plugin is PluginManifest {
    if (!plugin || typeof plugin !== 'object') {
      return false
    }

    const manifest = plugin as Record<string, unknown>

    // 检查必需字段
    if (
      typeof manifest.name !== 'string' ||
      typeof manifest.version !== 'string' ||
      typeof manifest.description !== 'string' ||
      typeof manifest.main !== 'string' ||
      typeof manifest.url !== 'string'
    ) {
      return false
    }

    // 检查可选字段
    if (
      manifest.displayName !== undefined &&
      typeof manifest.displayName !== 'string'
    ) {
      return false
    }

    if (manifest.icon !== undefined && typeof manifest.icon !== 'string') {
      return false
    }

    if (manifest.components !== undefined) {
      if (!Array.isArray(manifest.components)) {
        return false
      }

      // 验证每个组件
      for (const component of manifest.components) {
        if (!this.isValidPluginComponent(component)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * 验证插件组件结构
   */
  private isValidPluginComponent(component: unknown): boolean {
    if (!component || typeof component !== 'object') {
      return false
    }

    const comp = component as Record<string, unknown>

    // 检查必需字段
    if (typeof comp.name !== 'string' || typeof comp.path !== 'string') {
      return false
    }

    // 检查可选字段
    if (comp.title !== undefined && typeof comp.title !== 'string') {
      return false
    }

    if (comp.icon !== undefined && typeof comp.icon !== 'string') {
      return false
    }

    if (comp.defaultPosition !== undefined) {
      const validPositions = ['left', 'right', 'top', 'bottom', 'center']
      if (!validPositions.includes(comp.defaultPosition as string)) {
        return false
      }
    }

    return true
  }
}
