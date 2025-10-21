import type { Plugin, ResolvedConfig } from 'vite'
import { watch } from 'chokidar'
import { resolve as pathResolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

import { scanAllPlugins, ScannedPlugin } from './scanner'
import type { PluginRegistryManifest } from '@vue-plugin-arch/types'

// Export scanner functions for testing
export {
  scanAllPlugins,
  discoverLocalPlugins,
  findWorkspaceRoot,
  convertLocalPathToFsUrl,
  convertPluginDistToFsUrl,
  validateAndConvertPluginUrl,
} from './scanner'
export type { ScannedPlugin } from './scanner'

const REGISTRY_ENDPOINT = '/api/plugin-registry'

export function vuePluginArch(): Plugin {
  let config: ResolvedConfig
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
    console.log(
      `[@vue-plugin-arch/vite-plugin] Plugin manifest invalidated and will be regenerated on next request`
    )
  }

  function setupFileWatcher() {
    if (!config || config.command !== 'serve') {
      return // Only watch in development mode
    }

    // Find the workspace root by looking for pnpm-workspace.yaml or package.json with workspaces
    let workspaceRoot = config.root
    let currentDir = config.root

    while (currentDir !== pathResolve(currentDir, '..')) {
      const pnpmWorkspaceFile = join(currentDir, 'pnpm-workspace.yaml')
      const packageJsonFile = join(currentDir, 'package.json')

      if (existsSync(pnpmWorkspaceFile)) {
        workspaceRoot = currentDir
        break
      }

      if (existsSync(packageJsonFile)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf-8'))
          if (packageJson.workspaces) {
            workspaceRoot = currentDir
            break
          }
        } catch {
          // Continue searching
        }
      }

      currentDir = pathResolve(currentDir, '..')
    }

    const workspacePluginsDir = pathResolve(workspaceRoot, 'packages/plugins')

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
      setupFileWatcher()

      // Intercept registry endpoint requests
      devServer.middlewares.use(REGISTRY_ENDPOINT, async (req, res, next) => {
        if (req.method !== 'GET') {
          return next()
        }

        try {
          console.log(
            `[@vue-plugin-arch/vite-plugin] Serving plugin registry from ${REGISTRY_ENDPOINT}`
          )

          const plugins = await getScannedPlugins()

          // Convert ScannedPlugin[] to PluginManifest[] for the registry response
          const manifests = plugins.map(plugin => plugin.manifest)

          const registryResponse: PluginRegistryManifest = {
            plugins: manifests,
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          }

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(JSON.stringify(registryResponse, null, 2))
        } catch (error) {
          console.error(
            `[@vue-plugin-arch/vite-plugin] Failed to serve plugin registry:`,
            error
          )
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          const errorResponse: PluginRegistryManifest = {
            plugins: [],
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          }
          res.end(JSON.stringify(errorResponse))
        }
      })
    },

    buildEnd() {
      // Clean up watcher when build ends
      if (watcher) {
        watcher.close()
        watcher = undefined
      }
    },
  }
}

export default vuePluginArch
