declare module 'virtual:plugin-manifest' {
  import type { PluginLoaderMap } from './types/plugin'
  const manifest: PluginLoaderMap
  export default manifest
}
