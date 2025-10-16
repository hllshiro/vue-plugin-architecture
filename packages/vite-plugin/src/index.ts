import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { watch } from 'chokidar'
import { resolve as pathResolve, join } from 'path'
import { existsSync } from 'fs'

import { scanAllPlugins, ScannedPlugin } from './scanner'

// Export scanner functions for testing
export { scanAllPlugins } from './scanner'
export type { ScannedPlugin } from './scanner'

const VIRTUAL_MODULE_ID = 'virtual:vue-plugin-arch/plugin-manifest'
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`

export function vuePluginArch(): Plugin {
  let config: ResolvedConfig
  let server: ViteDevServer | undefined
  let scannedPlugins: ScannedPlugin[] | undefined
  let watcher: ReturnType<typeof watch> | undefined

  async function getScannedPlugins(): Promise<ScannedPlugin[]> {
    if (scannedPlugins) {
      return scannedPlugins
    }
    scannedPlugins = await scanAllPlugins(config.root)
    return scannedPlugins
  }

  function invalidateManifest() {
    // Clear cached plugins to force rescan
    scannedPlugins = undefined

    if (server) {
      // Invalidate the virtual module
      const module = server.moduleGraph.getModuleById(
        RESOLVED_VIRTUAL_MODULE_ID
      )
      if (module) {
        server.reloadModule(module)
        console.log(
          `[@vue-plugin-arch/vite-plugin] Plugin manifest invalidated and reloaded`
        )
      }
    }
  }

  function setupFileWatcher() {
    if (!config || config.command !== 'serve') {
      return // Only watch in development mode
    }

    const workspacePluginsDir = pathResolve(config.root, 'packages/plugins')

    if (!existsSync(workspacePluginsDir)) {
      console.log(
        `[@vue-plugin-arch/vite-plugin] Workspace plugins directory not found, skipping file watcher setup`
      )
      return
    }

    console.log(
      `[@vue-plugin-arch/vite-plugin] Setting up file watcher for workspace plugins`
    )

    // Watch for changes in workspace plugin directories
    watcher = watch(
      [
        join(workspacePluginsDir, '*/package.json'),
        join(workspacePluginsDir, '*/src/**/*'),
        join(workspacePluginsDir, '*/dist/**/*'),
      ],
      {
        ignored: ['**/node_modules/**', '**/.git/**'],
        persistent: true,
        ignoreInitial: true,
      }
    )

    watcher.on('add', (path: string) => {
      console.log(
        `[@vue-plugin-arch/vite-plugin] Workspace plugin file added: ${path}`
      )
      invalidateManifest()
    })

    watcher.on('unlink', (path: string) => {
      console.log(
        `[@vue-plugin-arch/vite-plugin] Workspace plugin file removed: ${path}`
      )
      invalidateManifest()
    })

    watcher.on('change', (path: string) => {
      console.log(
        `[@vue-plugin-arch/vite-plugin] Workspace plugin file changed: ${path}`
      )

      // For source file changes, we need to trigger a rebuild
      if (path.includes('/src/')) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] Source file changed, plugin needs rebuild: ${path}`
        )
      }

      // For dist file changes or package.json changes, invalidate manifest
      if (path.includes('/dist/') || path.endsWith('package.json')) {
        invalidateManifest()
      }
    })

    watcher.on('addDir', (path: string) => {
      if (path.includes('plugin-')) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] New workspace plugin directory detected: ${path}`
        )
        invalidateManifest()
      }
    })

    watcher.on('unlinkDir', (path: string) => {
      if (path.includes('plugin-')) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] Workspace plugin directory removed: ${path}`
        )
        invalidateManifest()
      }
    })

    watcher.on('error', (error: unknown) => {
      console.error(`[@vue-plugin-arch/vite-plugin] File watcher error:`, error)
    })
  }

  return {
    name: 'vue-plugin-arch',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    configureServer(devServer) {
      server = devServer
      setupFileWatcher()
    },

    buildEnd() {
      // Clean up watcher when build ends
      if (watcher) {
        watcher.close()
        watcher = undefined
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] Generating virtual module for command: ${config.command}`
        )
        try {
          const plugins = await getScannedPlugins()

          // Generate the manifest map with lazy import functions
          const manifestEntries = plugins
            .map(plugin => {
              const packageName = plugin.manifest.name
              return `  '${packageName}': {
    loader: () => import('${packageName}'),
    manifest: ${JSON.stringify(plugin.manifest)}
  }`
            })
            .join(',\n')

          const manifestCode = `// virtual:vue-plugin-arch/plugin-manifest
export default {
${manifestEntries}
};`

          console.log(
            `[@vue-plugin-arch/vite-plugin] Generated manifest for ${plugins.length} plugins`
          )

          return manifestCode
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          console.error(
            `[@vue-plugin-arch/vite-plugin] Failed to generate virtual module for plugin manifest:\n${errorMessage}\n` +
              `Returning empty manifest.`
          )

          // Return empty manifest to prevent build failure
          return `export default {}`
        }
      }
    },
  }
}

export default vuePluginArch
