import type {
  PluginModule,
  IPluginServiceProxy,
  PluginAPI,
} from '@vue-plugin-arch/types'
import HelloWorldPanel from './components/HelloWorldPanel.vue'
import manifest from '../package.json'

// 定义一个唯一的组件名
const HELLO_WORLD_PANEL_COMPONENT = 'HelloWorldPanelComponent'

/**
 * Hello World Plugin
 *
 * A simple demonstration plugin showing basic plugin functionality:
 * - Panel registration
 * - Event communication
 * - Data storage
 */
export const install = (proxy: IPluginServiceProxy): PluginAPI => {
  // 1. 通过 proxy 将组件注册到主应用
  proxy.layoutApi.registerComponent(
    HELLO_WORLD_PANEL_COMPONENT,
    HelloWorldPanel
  )

  // 2. 使用组件的注册名 (string) 来注册面板
  const panelId = proxy.layoutApi.registerPanel({
    id: 'hello-world-panel',
    component: HELLO_WORLD_PANEL_COMPONENT, // 传递字符串ID
    title: 'Hello World',
    position: 'center',
    params: {
      name: manifest.name,
      version: manifest.version,
      proxy,
    },
  })

  // Set up a simple welcome message in storage
  proxy.dataApi.set('welcomeMessage', 'Hello from Vue Plugin Architecture!')

  // Return plugin API with teardown method
  return {
    teardown: async () => {
      // 移除面板
      proxy.layoutApi.removePanel(panelId)

      // 注销组件
      proxy.layoutApi.unregisterComponent(HELLO_WORLD_PANEL_COMPONENT)

      // Emit plugin unloaded event
      proxy.eventApi.emit('plugin:unloaded', {
        name: manifest.name,
      })
    },
  }
}

// Export plugin module
export const pluginModule: PluginModule = {
  install,
}

// Default export
export default pluginModule
