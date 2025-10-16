import type { IPluginStorage } from '@vue-plugin-arch/types'

/**
 * Demo implementation of IPluginStorage using Map-based in-memory storage
 * Provides name isolation by using nested Maps
 */
export class MemoryPluginStorage implements IPluginStorage {
  private data = new Map<string, Map<string, unknown>>()

  /**
   * Get data for a specific plugin and key
   */
  async get(name: string, key: string): Promise<unknown> {
    const pluginData = this.data.get(name)
    return pluginData?.get(key)
  }

  /**
   * Set data for a specific plugin and key
   */
  async set(name: string, key: string, value: unknown): Promise<void> {
    if (!this.data.has(name)) {
      this.data.set(name, new Map<string, unknown>())
    }
    this.data.get(name)!.set(key, value)
  }

  /**
   * Get all data for a specific plugin
   */
  async getAll(name: string): Promise<Record<string, unknown>> {
    const pluginData = this.data.get(name)
    if (!pluginData) {
      return {}
    }
    return Object.fromEntries(pluginData.entries())
  }

  /**
   * Remove a specific key for a plugin
   */
  async remove(name: string, key: string): Promise<void> {
    const pluginData = this.data.get(name)
    if (pluginData) {
      pluginData.delete(key)
    }
  }

  /**
   * Remove all data for a specific plugin
   */
  async removeAll(name: string): Promise<void> {
    this.data.delete(name)
  }

  /**
   * Clear all data for all plugins
   */
  async clear(): Promise<void> {
    this.data.clear()
  }
}
