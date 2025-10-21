import type { Plugin, ResolvedConfig } from 'vite'
import { watch } from 'chokidar'
import { resolve as pathResolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

import { getMergedPluginRegistry } from './scanner'
import type { PluginRegistryManifest } from '@vue-plugin-arch/types'

// Export scanner functions for testing
export {
  scanAllPlugins,
  discoverLocalPlugins,
  findWorkspaceRoot,
  convertLocalPathToFsUrl,
  convertPluginDistToFsUrl,
  validateAndConvertPluginUrl,
  readStaticRegistry,
  mergePluginManifests,
  getMergedPluginRegistry,
} from './scanner'
export type { ScannedPlugin } from './scanner'

const REGISTRY_ENDPOINT = '/api/plugin-registry'

export function vuePluginArch(): Plugin {
  let config: ResolvedConfig
  let cachedRegistry: PluginRegistryManifest | undefined
  let watcher: ReturnType<typeof watch> | undefined

  async function getMergedRegistry(): Promise<PluginRegistryManifest> {
    if (cachedRegistry) {
      return cachedRegistry
    }
    cachedRegistry = await getMergedPluginRegistry(config.root)
    return cachedRegistry
  }

  function invalidateManifest() {
    // Clear cached registry to force rescan
    cachedRegistry = undefined
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
    const staticRegistryPath = pathResolve(
      workspaceRoot,
      'packages/demo/public/plugin-registry.json'
    )

    const watchPaths: string[] = []

    // Add plugin directories to watch if they exist
    if (existsSync(workspacePluginsDir)) {
      watchPaths.push(
        join(workspacePluginsDir, '*/package.json'),
        join(workspacePluginsDir, '*/src/**/*'),
        join(workspacePluginsDir, '*/dist/**/*')
      )
    }

    // Add static registry file to watch if it exists
    if (existsSync(staticRegistryPath)) {
      watchPaths.push(staticRegistryPath)
    }

    if (watchPaths.length === 0) {
      console.log(
        `[@vue-plugin-arch/vite-plugin] No plugin directories or static registry found, skipping file watcher setup`
      )
      return
    }

    console.log(
      `[@vue-plugin-arch/vite-plugin] Setting up file watcher for workspace plugins and static registry`
    )

    // Watch for changes in workspace plugin directories and static registry
    watcher = watch(watchPaths, {
      ignored: ['**/node_modules/**', '**/.git/**'],
      persistent: true,
      ignoreInitial: true,
    })

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
      console.log(`[@vue-plugin-arch/vite-plugin] File changed: ${path}`)

      // For static registry changes, invalidate manifest immediately
      if (path.endsWith('plugin-registry.json')) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] Static registry file changed, invalidating manifest`
        )
        invalidateManifest()
        return
      }

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
            `[@vue-plugin-arch/vite-plugin] Serving merged plugin registry from ${REGISTRY_ENDPOINT}`
          )

          const registryResponse = await getMergedRegistry()

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
