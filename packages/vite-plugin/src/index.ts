import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

import { getMergedPluginRegistry } from './scanner'
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
   * Global variable names for external dependencies
   */
  globals?: Record<string, string>

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
}

export function vuePluginArch(options: VuePluginArchOptions = {}): Plugin[] {
  const {
    externalDeps = [],
    staticTargets = [],
    globals = {},
    paths = {},
    enableExternalDeps = true,
    enableStaticCopy = true,
    enableImportMap = true,
    importMapPlaceholder = '<!-- !!!KEEP THIS!!! Import map will be injected by Vite -->',
    registryEndpoint = '/api/plugin-registry.json',
  } = options

  let config: ResolvedConfig

  async function getMergedRegistry(): Promise<PluginRegistryManifest> {
    return await getMergedPluginRegistry(config.root)
  }

  const plugins: Plugin[] = []

  // Main plugin for registry management
  const mainPlugin: Plugin = {
    name: 'vue-plugin-arch',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig
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
            ...globals,
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
