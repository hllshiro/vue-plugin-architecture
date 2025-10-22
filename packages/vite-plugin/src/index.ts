import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, relative } from 'path'

import {
  getMergedPluginRegistry,
  scanAllPlugins,
  findWorkspaceRoot,
} from './scanner'
import type { PluginRegistryManifest } from '@vue-plugin-arch/types'

export interface StaticCopyTarget {
  src: string
  dest: string
  rename?: string
}

export interface VuePluginArchOptions {
  /**
   * External dependencies to exclude from bundle
   */
  externalDeps?: string[]

  /**
   * Static copy targets for external dependencies
   */
  staticTargets?: StaticCopyTarget[]

  /**
   * Import paths for external dependencies
   */
  paths?: Record<string, string>

  /**
   * Whether to enable external dependency management
   * @default true
   */
  enableExternalDeps?: boolean

  /**
   * Whether to enable static copy for external dependencies
   * @default true
   */
  enableStaticCopy?: boolean

  /**
   * Whether to enable import map injection
   * @default true
   */
  enableImportMap?: boolean

  /**
   * Import map placeholder in HTML
   * @default '<!-- !!!KEEP THIS!!! Import map will be injected by Vite -->'
   */
  importMapPlaceholder?: string

  /**
   * Registry endpoint for plugin discovery
   * @default '/api/plugin-registry.json'
   */
  registryEndpoint?: string

  /**
   * Whether to copy local plugin dist files to build output
   * @default true
   */
  copyPluginDist?: boolean

  /**
   * Target directory for copied plugin dist files (relative to build output)
   * @default 'plugins'
   */
  pluginDistDir?: string
}

export function vuePluginArch(options: VuePluginArchOptions = {}): Plugin[] {
  const {
    externalDeps = [],
    staticTargets = [],
    paths = {},
    enableExternalDeps = true,
    enableStaticCopy = true,
    enableImportMap = true,
    importMapPlaceholder = '<!-- !!!KEEP THIS!!! Import map will be injected by Vite -->',
    registryEndpoint = '/api/plugin-registry.json',
    copyPluginDist = true,
    pluginDistDir = 'plugins',
  } = options

  let config: ResolvedConfig
  let isDev = false

  // Cache scanned plugins to avoid duplicate scanning
  let cachedScannedPlugins: Awaited<ReturnType<typeof scanAllPlugins>> | null =
    null

  async function getScannedPlugins() {
    if (!cachedScannedPlugins) {
      cachedScannedPlugins = await scanAllPlugins(config.root, isDev)
    }
    return cachedScannedPlugins
  }

  async function getMergedRegistry(): Promise<PluginRegistryManifest> {
    return await getMergedPluginRegistry(config.root, isDev)
  }

  async function copyPluginDistFiles(): Promise<void> {
    if (!copyPluginDist || isDev) {
      return
    }

    console.log(
      '[@vue-plugin-arch/vite-plugin] Starting plugin dist files copy...'
    )

    const workspaceRoot = await findWorkspaceRoot(config.root)
    const scannedPlugins = await getScannedPlugins()
    const buildOutDir = config.build.outDir || 'dist'
    const targetPluginDir = join(config.root, buildOutDir, pluginDistDir)

    // Ensure target directory exists
    if (!existsSync(targetPluginDir)) {
      await mkdir(targetPluginDir, { recursive: true })
    }

    for (const plugin of scannedPlugins) {
      if (!plugin.isWorkspacePlugin) continue

      const pluginName = plugin.manifest.name.replace('@vue-plugin-arch/', '')
      const pluginSourceDistDir = join(plugin.packageDir, 'dist')
      const targetDir = join(targetPluginDir, pluginName)

      if (!existsSync(pluginSourceDistDir)) {
        console.warn(
          `[@vue-plugin-arch/vite-plugin] Plugin dist not found: ${pluginSourceDistDir}`
        )
        continue
      }

      try {
        // Ensure target plugin directory exists
        if (!existsSync(targetDir)) {
          await mkdir(targetDir, { recursive: true })
        }

        // Copy all files from plugin dist to target
        const { readdir, stat } = await import('fs/promises')
        const files = await readdir(pluginSourceDistDir)

        for (const file of files) {
          const srcFile = join(pluginSourceDistDir, file)
          const targetFile = join(targetDir, file)
          const stats = await stat(srcFile)

          if (stats.isFile()) {
            await copyFile(srcFile, targetFile)
            console.log(
              `[@vue-plugin-arch/vite-plugin] Copied: ${relative(workspaceRoot, srcFile)} -> ${relative(config.root, targetFile)}`
            )
          }
        }
      } catch (error) {
        console.error(
          `[@vue-plugin-arch/vite-plugin] Failed to copy plugin ${pluginName}:`,
          error
        )
      }
    }

    console.log(
      '[@vue-plugin-arch/vite-plugin] Plugin dist files copy completed'
    )
  }

  async function generateBuildRegistry(): Promise<void> {
    if (isDev) return

    console.log(
      '[@vue-plugin-arch/vite-plugin] Generating build-time plugin registry...'
    )

    const buildOutDir = config.build.outDir || 'dist'
    const registryPath = join(
      config.root,
      buildOutDir,
      registryEndpoint.replace(/^\//, '')
    )
    const registryDir = dirname(registryPath)

    // Ensure registry directory exists
    if (!existsSync(registryDir)) {
      await mkdir(registryDir, { recursive: true })
    }

    // Reuse scanned plugins from cache
    const scannedPlugins = await getScannedPlugins()
    const localPlugins = scannedPlugins
      .filter(plugin => plugin.isWorkspacePlugin)
      .map(plugin => {
        const pluginName = plugin.manifest.name.replace('@vue-plugin-arch/', '')
        const buildUrl = `/${pluginDistDir}/${pluginName}/index.js`

        return {
          ...plugin.manifest,
          url: buildUrl,
        }
      })

    // Get merged registry (includes remote plugins from static registry)
    const mergedRegistry = await getMergedRegistry()

    // Create final registry with local plugins taking precedence
    const localPluginNames = new Set(localPlugins.map(p => p.name))
    const remotePlugins = mergedRegistry.plugins.filter(
      p => !localPluginNames.has(p.name)
    )

    const finalRegistry: PluginRegistryManifest = {
      plugins: [...localPlugins, ...remotePlugins],
      version: mergedRegistry.version,
      lastUpdated: new Date().toISOString(),
    }

    await writeFile(
      registryPath,
      JSON.stringify(finalRegistry, null, 2),
      'utf-8'
    )

    console.log(
      `[@vue-plugin-arch/vite-plugin] Registry generated at: ${relative(config.root, registryPath)}`
    )
    console.log(
      `[@vue-plugin-arch/vite-plugin] Total plugins: ${finalRegistry.plugins.length} (${localPlugins.length} local, ${remotePlugins.length} remote)`
    )
  }

  const plugins: Plugin[] = []

  // Main plugin for registry management
  const mainPlugin: Plugin = {
    name: 'vue-plugin-arch',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig
      isDev = config.command === 'serve'
    },

    config(config, { command }) {
      // Only apply external deps configuration for build mode
      if (command === 'build' && enableExternalDeps) {
        config.build = config.build || {}
        config.build.rollupOptions = config.build.rollupOptions || {}

        // Set external dependencies
        const existingExternal = config.build.rollupOptions.external
        const existingExternalArray = Array.isArray(existingExternal)
          ? existingExternal
          : existingExternal
            ? [existingExternal]
            : []

        config.build.rollupOptions.external = [
          ...existingExternalArray.filter(
            (ext): ext is string | RegExp =>
              typeof ext === 'string' || ext instanceof RegExp
          ),
          ...externalDeps,
        ]

        // Set output configuration
        config.build.rollupOptions.output = {
          ...(config.build.rollupOptions.output || {}),
          globals: {
            ...(typeof config.build.rollupOptions.output === 'object' &&
            config.build.rollupOptions.output &&
            'globals' in config.build.rollupOptions.output
              ? config.build.rollupOptions.output.globals
              : {}),
          },
          paths: {
            ...(typeof config.build.rollupOptions.output === 'object' &&
            config.build.rollupOptions.output &&
            'paths' in config.build.rollupOptions.output
              ? config.build.rollupOptions.output.paths
              : {}),
            ...paths,
          },
          compact: true,
        }
      }
    },

    configureServer(devServer) {
      // Intercept registry endpoint requests
      devServer.middlewares.use(registryEndpoint, async (req, res, next) => {
        if (req.method !== 'GET') {
          return next()
        }

        try {
          console.log(
            `[@vue-plugin-arch/vite-plugin] Serving merged plugin registry from ${registryEndpoint}`
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

    transformIndexHtml(html: string, context: IndexHtmlTransformContext) {
      // Only inject import map in build mode and when enabled
      if (context.server || !enableImportMap) {
        // In development, remove the placeholder
        return html.replace(importMapPlaceholder, '')
      }

      // In production, inject import map for external dependencies
      const importMapScript = `<script type="importmap">{"imports": ${JSON.stringify(paths)}}</script>`
      return html.replace(importMapPlaceholder, importMapScript)
    },

    async buildStart() {
      // This runs at the start of the build process
      if (!isDev) {
        console.log(
          '[@vue-plugin-arch/vite-plugin] Build started, preparing plugin assets...'
        )
      }
    },

    async writeBundle() {
      // This runs after the bundle is written
      if (!isDev) {
        await copyPluginDistFiles()
        await generateBuildRegistry()
      }
    },
  }

  plugins.push(mainPlugin)

  // Add static copy plugin if enabled
  if (enableStaticCopy && staticTargets.length > 0) {
    const staticCopyPlugin = viteStaticCopy({
      targets: staticTargets,
    })

    if (Array.isArray(staticCopyPlugin)) {
      plugins.push(...staticCopyPlugin)
    } else {
      plugins.push(staticCopyPlugin)
    }
  }

  return plugins
}
