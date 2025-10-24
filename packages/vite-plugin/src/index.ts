import { existsSync } from 'fs'
import { readFile, stat, readdir } from 'fs/promises'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { join, dirname, resolve as pathResolve } from 'path'

import { viteStaticCopy } from 'vite-plugin-static-copy'
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite'

import type {
  PluginManifest,
  PluginRegistryManifest,
} from '@vue-plugin-arch/types'

interface ScannedPlugin {
  manifest: PluginManifest
  packageDir: string
  isWorkspacePlugin: boolean
}

interface StaticCopyTarget {
  src: string
  dest: string
  rename?: string
}

export interface VuePluginArchOptions {
  /**
   * Project workspace configuration
   */
  workspace: {
    root: string
    pluginsDir: string
  }

  /**
   * External dependencies configuration
   */
  external?: {
    deps: string[]
    staticTargets: StaticCopyTarget[]
    paths: Record<string, string>
  }

  /**
   * Plugin registry configuration
   */
  registry: {
    endpoint: string
    staticPath: string
  }

  /**
   * Build configuration
   */
  build: {
    copyPluginDist: boolean
    enableImportMap: boolean
  }
}

/**
 * Converts a local file system path to a /@fs/ URL for Vite dev server
 */
function convertLocalPathToFsUrl(localPath: string): string {
  const normalizedPath = localPath.replace(/\\/g, '/')
  return `/@fs/${normalizedPath}`
}

/**
 * Validates that a plugin's dist file exists and is accessible
 */
async function validatePluginDistFile(
  pkgName: string,
  distPath: string
): Promise<void> {
  if (!existsSync(distPath)) {
    throw new Error(
      `Plugin "${pkgName}" dist file not found at: ${distPath}. Please build the plugin first.`
    )
  }

  try {
    const stats = await stat(distPath)
    if (!stats.isFile()) {
      throw new Error(
        `Plugin "${pkgName}" dist path exists but is not a file: ${distPath}`
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not a file')) {
      throw error
    }
    throw new Error(
      `Plugin "${pkgName}" dist file is not accessible: ${distPath}`
    )
  }
}

/**
 * Scans plugins directory to find local plugins
 */
async function scanPluginsFromDirectory(
  workspaceRoot: string,
  pluginsDir: string,
  isDev: boolean = false
): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = []
  const fullPluginsDir = pathResolve(workspaceRoot, pluginsDir)

  if (!existsSync(fullPluginsDir)) {
    return results
  }

  try {
    const entries = await readdir(fullPluginsDir, { withFileTypes: true })
    const pluginDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('plugin-'))
      .map(entry => entry.name)

    for (const pluginDirName of pluginDirs) {
      const pluginDir = join(fullPluginsDir, pluginDirName)
      const packageJsonPath = join(pluginDir, 'package.json')

      try {
        if (!existsSync(packageJsonPath)) continue

        const pkgJsonStr = await readFile(packageJsonPath, 'utf-8')
        const packageJsonData: PluginManifest = JSON.parse(pkgJsonStr)

        if (!packageJsonData.main || !packageJsonData.name) continue

        let pluginUrl: string

        if (isDev) {
          const srcEntryPath = join(pluginDir, 'src/index.ts')
          if (existsSync(srcEntryPath)) {
            pluginUrl = convertLocalPathToFsUrl(srcEntryPath)
          } else {
            const distPath = join(pluginDir, packageJsonData.main)
            await validatePluginDistFile(packageJsonData.name, distPath)
            pluginUrl = convertLocalPathToFsUrl(distPath)
          }
        } else {
          const distPath = join(pluginDir, packageJsonData.main)
          await validatePluginDistFile(packageJsonData.name, distPath)
          pluginUrl = convertLocalPathToFsUrl(distPath)
        }

        const manifest: PluginManifest = {
          displayName:
            packageJsonData.displayName ??
            packageJsonData.name.replace('@vue-plugin-arch/plugin-', ''),
          name: packageJsonData.name,
          version: packageJsonData.version,
          description: packageJsonData.description ?? '',
          components: packageJsonData.components,
          icon: packageJsonData.icon,
          main: packageJsonData.main,
          url: pluginUrl,
        }

        results.push({
          manifest,
          packageDir: pluginDir,
          isWorkspacePlugin: true,
        })
      } catch {
        continue
      }
    }
  } catch {
    return []
  }

  return results
}

/**
 * Discovers local plugins and generates their manifests with /@fs/ URLs
 */
async function discoverLocalPlugins(
  workspaceRoot: string,
  pluginsDir: string,
  isDev: boolean = false
): Promise<PluginManifest[]> {
  const scannedPlugins = await scanPluginsFromDirectory(
    workspaceRoot,
    pluginsDir,
    isDev
  )
  return scannedPlugins
    .filter(plugin => plugin.isWorkspacePlugin)
    .map(plugin => plugin.manifest)
}

/**
 * Reads the static plugin registry file
 */
async function readStaticRegistry(
  workspaceRoot: string,
  staticRegistryPath?: string
): Promise<PluginRegistryManifest | null> {
  if (!staticRegistryPath) return null

  const fullPath = pathResolve(workspaceRoot, staticRegistryPath)

  if (!existsSync(fullPath)) {
    return null
  }

  try {
    const registryContent = await readFile(fullPath, 'utf-8')
    return JSON.parse(registryContent)
  } catch {
    return null
  }
}

/**
 * Merges local plugins with remote plugins from static registry
 * Local plugins take precedence over remote plugins with the same name
 */
function mergePluginManifests(
  localPlugins: PluginManifest[],
  staticRegistry: PluginRegistryManifest | null
): PluginManifest[] {
  const mergedPlugins: PluginManifest[] = [...localPlugins]
  const localPluginNames = new Set(localPlugins.map(plugin => plugin.name))

  if (staticRegistry?.plugins) {
    for (const remotePlugin of staticRegistry.plugins) {
      if (!localPluginNames.has(remotePlugin.name)) {
        mergedPlugins.push(remotePlugin)
      }
    }
  }

  return mergedPlugins
}

/**
 * Gets the merged plugin registry combining local and remote plugins
 */
async function getMergedPluginRegistry(
  workspaceRoot: string,
  pluginsDir: string,
  staticRegistryPath: string | undefined,
  isDev: boolean = false
): Promise<PluginRegistryManifest> {
  const localPlugins = await discoverLocalPlugins(
    workspaceRoot,
    pluginsDir,
    isDev
  )
  const staticRegistry = await readStaticRegistry(
    workspaceRoot,
    staticRegistryPath
  )
  const mergedPlugins = mergePluginManifests(localPlugins, staticRegistry)

  return {
    plugins: mergedPlugins,
    version: staticRegistry?.version || '1.0.0',
    lastUpdated: new Date().toISOString(),
  }
}

export function vuePluginArch(options: VuePluginArchOptions): Plugin[] {
  const { workspace, external, registry, build } = options

  // Extract configuration values
  const workspaceRoot = workspace.root
  const pluginsDir = workspace.pluginsDir
  const externalDeps = external?.deps || []
  const staticTargets = external?.staticTargets || []
  const paths = external?.paths || {}
  const enableExternalDeps = !!external
  const enableStaticCopy = !!external?.staticTargets?.length
  const registryEndpoint = registry.endpoint
  const staticRegistryPath = registry.staticPath
  const copyPluginDist = build.copyPluginDist
  const enableImportMap = build.enableImportMap
  const pluginDistDir = 'plugins'

  let config: ResolvedConfig
  let isDev = false

  // Cache scanned plugins to avoid duplicate scanning
  let cachedScannedPlugins: ScannedPlugin[] | null = null

  async function getScannedPlugins() {
    if (!cachedScannedPlugins) {
      cachedScannedPlugins = await scanPluginsFromDirectory(
        workspaceRoot,
        pluginsDir,
        isDev
      )
    }
    return cachedScannedPlugins
  }

  async function getMergedRegistry(): Promise<PluginRegistryManifest> {
    return await getMergedPluginRegistry(
      workspaceRoot,
      pluginsDir,
      staticRegistryPath,
      isDev
    )
  }

  async function copyPluginDistFiles(): Promise<void> {
    if (!copyPluginDist || isDev) return

    const scannedPlugins = await getScannedPlugins()
    const buildOutDir = config.build.outDir || 'dist'
    const targetPluginDir = join(config.root, buildOutDir, pluginDistDir)

    if (!existsSync(targetPluginDir)) {
      await mkdir(targetPluginDir, { recursive: true })
    }

    for (const plugin of scannedPlugins) {
      if (!plugin.isWorkspacePlugin) continue

      const pluginName = plugin.manifest.name.replace('@vue-plugin-arch/', '')
      const pluginSourceDistDir = join(plugin.packageDir, 'dist')
      const targetDir = join(targetPluginDir, pluginName)

      if (!existsSync(pluginSourceDistDir)) continue

      try {
        if (!existsSync(targetDir)) {
          await mkdir(targetDir, { recursive: true })
        }

        const files = await readdir(pluginSourceDistDir)
        for (const file of files) {
          const srcFile = join(pluginSourceDistDir, file)
          const targetFile = join(targetDir, file)
          const stats = await stat(srcFile)

          if (stats.isFile()) {
            await copyFile(srcFile, targetFile)
          }
        }
      } catch {
        // Continue with other plugins
      }
    }
  }

  async function generateBuildRegistry(): Promise<void> {
    if (isDev) return

    const buildOutDir = config.build.outDir || 'dist'
    const registryPath = join(
      config.root,
      buildOutDir,
      registryEndpoint.replace(/^\//, '')
    )
    const registryDir = dirname(registryPath)

    if (!existsSync(registryDir)) {
      await mkdir(registryDir, { recursive: true })
    }

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

    const mergedRegistry = await getMergedRegistry()
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
  }

  const plugins: Plugin[] = []

  // Main plugin for registry management
  const mainPlugin: Plugin = {
    name: 'vue-plugin-arch',
    enforce: 'pre',

    async configResolved(resolvedConfig) {
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
      devServer.middlewares.use(registryEndpoint, async (req, res, next) => {
        if (req.method !== 'GET') {
          return next()
        }

        try {
          const registryResponse = await getMergedRegistry()
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(JSON.stringify(registryResponse, null, 2))
        } catch {
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
      if (!enableImportMap) return html

      // In development mode, no importMap needed
      if (context.server) {
        return html
      }

      // In build mode, inject importMap script before </head>
      const importMapScript = `  <script type="importmap">{"imports": ${JSON.stringify(paths)}}</script>\n`

      if (html.includes('</head>')) {
        return html.replace('</head>', `${importMapScript}</head>`)
      } else {
        console.warn(
          '[vue-plugin-arch] Warning: </head> tag not found in HTML template, importMap script not injected'
        )
        return html
      }
    },

    async writeBundle() {
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
