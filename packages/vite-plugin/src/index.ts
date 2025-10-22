import { existsSync } from 'fs'
import { readFile, stat, readdir } from 'fs/promises'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { join, dirname, relative, resolve as pathResolve } from 'path'

import { viteStaticCopy } from 'vite-plugin-static-copy'
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite'

import type {
  PluginManifest,
  PluginRegistryManifest,
} from '@vue-plugin-arch/types'

const STATIC_PATH = 'packages/demo/public/api/plugin-registry.json'

interface ScannedPlugin {
  manifest: PluginManifest
  packageDir: string
  isWorkspacePlugin: boolean
}

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

/**
 * Converts a local file system path to a /@fs/ URL for Vite dev server
 * @param localPath - The absolute local file system path
 * @returns The /@fs/ URL that can be used for dynamic imports in Vite dev server
 */
function convertLocalPathToFsUrl(localPath: string): string {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = localPath.replace(/\\/g, '/')
  return `/@fs/${normalizedPath}`
}

/**
 * Validates and converts a plugin's main entry to a /@fs/ URL
 * @param pluginDir - The plugin directory path
 * @param mainEntry - The main entry point from package.json
 * @param pluginName - The plugin name for error messages
 * @returns The validated /@fs/ URL
 * @throws Error if the dist file doesn't exist or is invalid
 */
async function validateAndConvertPluginUrl(
  pluginDir: string,
  mainEntry: string,
  pluginName: string
): Promise<string> {
  const distPath = pathResolve(pluginDir, mainEntry)

  // Validate the dist file exists and is accessible
  await validatePluginDistFile(pluginName, distPath)

  // Convert to /@fs/ URL
  return convertLocalPathToFsUrl(distPath)
}

/**
 * Validates that a plugin's dist file exists and is accessible
 * @param pkgName - The plugin package name
 * @param distPath - The path to the dist file
 * @throws Error with descriptive message if validation fails
 */
async function validatePluginDistFile(
  pkgName: string,
  distPath: string
): Promise<void> {
  if (!existsSync(distPath)) {
    throw new Error(
      `Plugin "${pkgName}" dist file not found at: ${distPath}\n` +
        `Please ensure the plugin is built by running:\n` +
        `  1. Navigate to the plugin directory\n` +
        `  2. Run "npm run build" or "pnpm build"\n` +
        `  3. Verify the dist file exists at the expected location\n` +
        `Build requirements: Plugins must be pre-built before the main application can discover them.`
    )
  }

  try {
    const stats = await stat(distPath)
    if (!stats.isFile()) {
      throw new Error(
        `Plugin "${pkgName}" dist path exists but is not a file: ${distPath}\n` +
          `Expected a JavaScript file (.js) at this location.`
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not a file')) {
      throw error
    }
    throw new Error(
      `Plugin "${pkgName}" dist file is not accessible: ${distPath}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n` +
        `Please check file permissions and ensure the plugin build completed successfully.`
    )
  }
}

/**
 * Scans plugins directory to find local plugins.
 * @param rootDir - The project root directory.
 * @param isDev - Whether running in development mode.
 * @returns A promise that resolves to an array of plugin scan results.
 */
async function scanPluginsFromDirectory(
  rootDir: string,
  isDev: boolean = false
): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = []

  // Find the workspace root using utility function
  const workspaceRoot = await findWorkspaceRoot(rootDir)

  const pluginsDir = pathResolve(workspaceRoot, 'packages/plugins')

  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting plugin discovery from plugins directory: ${pluginsDir} (workspace root: ${workspaceRoot}, dev mode: ${isDev})`
  )

  if (!existsSync(pluginsDir)) {
    console.log(
      `[@vue-plugin-arch/vite-plugin] Plugins directory not found: ${pluginsDir}`
    )
    return results
  }

  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true })
    const pluginDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('plugin-'))
      .map(entry => entry.name)

    console.log(
      `[@vue-plugin-arch/vite-plugin] Found ${pluginDirs.length} potential plugin directories: ${pluginDirs.join(', ')}`
    )

    for (const pluginDirName of pluginDirs) {
      const pluginDir = join(pluginsDir, pluginDirName)
      const packageJsonPath = join(pluginDir, 'package.json')

      console.log(
        `[@vue-plugin-arch/vite-plugin] Processing plugin directory: ${pluginDirName}`
      )

      try {
        if (!existsSync(packageJsonPath)) {
          console.warn(
            `[@vue-plugin-arch/vite-plugin] Skipping "${pluginDirName}": No package.json found`
          )
          continue
        }

        let packageJsonData: PluginManifest
        try {
          const pkgJsonStr = await readFile(packageJsonPath, 'utf-8')
          packageJsonData = JSON.parse(pkgJsonStr)
        } catch (parseError) {
          throw new Error(
            `Failed to read or parse package.json for plugin "${pluginDirName}" at: ${packageJsonPath}\n` +
              `Error: ${parseError instanceof Error ? parseError.message : String(parseError)}\n` +
              `Please ensure the package.json file is valid JSON.`
          )
        }

        // Validate package.json structure
        if (!packageJsonData.main || packageJsonData.main === '') {
          console.warn(
            `[@vue-plugin-arch/vite-plugin] Skipping plugin "${pluginDirName}": No valid main entry point found in package.json.\n` +
              `Expected a "main" field pointing to the built JavaScript file (e.g., "dist/index.js").`
          )
          continue
        }

        if (!packageJsonData.name) {
          console.warn(
            `[@vue-plugin-arch/vite-plugin] Skipping plugin "${pluginDirName}": Missing "name" field in package.json.`
          )
          continue
        }

        let pluginUrl: string

        if (isDev) {
          // In development mode, load source files directly for HMR
          const srcEntryPath = join(pluginDir, 'src/index.ts')

          if (existsSync(srcEntryPath)) {
            pluginUrl = convertLocalPathToFsUrl(srcEntryPath)
            console.log(
              `[@vue-plugin-arch/vite-plugin] Development mode: Loading source file: ${srcEntryPath}`
            )
          } else {
            // Fallback to dist if src doesn't exist
            const distPath = join(pluginDir, packageJsonData.main)
            await validatePluginDistFile(packageJsonData.name, distPath)
            pluginUrl = convertLocalPathToFsUrl(distPath)
            console.log(
              `[@vue-plugin-arch/vite-plugin] Development mode fallback: Loading dist file: ${distPath}`
            )
          }
        } else {
          // In production mode, always use dist artifacts
          const distPath = join(pluginDir, packageJsonData.main)
          console.log(
            `[@vue-plugin-arch/vite-plugin] Production mode: Checking dist file: ${distPath}`
          )

          // Comprehensive dist file validation
          await validatePluginDistFile(packageJsonData.name, distPath)

          // Generate /@fs/ URL using utility function
          pluginUrl = await validateAndConvertPluginUrl(
            pluginDir,
            packageJsonData.main,
            packageJsonData.name
          )
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
          url: pluginUrl, // Use appropriate URL based on mode
        }

        results.push({
          manifest,
          packageDir: pluginDir,
          isWorkspacePlugin: true,
        })
        console.log(
          `[@vue-plugin-arch/vite-plugin] Successfully loaded plugin: ${packageJsonData.name} (${isDev ? 'src' : 'dist'})`
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `[@vue-plugin-arch/vite-plugin] Failed to load plugin "${pluginDirName}":\n${errorMessage}`
        )

        // Continue processing other plugins instead of failing completely
        continue
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `[@vue-plugin-arch/vite-plugin] Critical error during plugin directory scan:\n` +
        `Failed to read plugins directory at: ${pluginsDir}\n` +
        `Error: ${errorMessage}`
    )

    // Return empty array instead of throwing to allow graceful degradation
    return []
  }

  console.log(
    `[@vue-plugin-arch/vite-plugin] Plugin directory scan completed. Found ${results.length} valid plugins.`
  )

  if (results.length === 0) {
    console.warn(
      `[@vue-plugin-arch/vite-plugin] No valid plugins found in plugins directory. This could mean:\n` +
        `  1. No plugin directories exist in packages/plugins/\n` +
        `  2. Plugin packages are not built (missing dist files) - only applies to production mode\n` +
        `  3. Plugin packages have invalid package.json structure\n` +
        `To resolve: ${isDev ? 'Ensure plugin src/index.ts files exist' : 'Ensure plugins are built before running the application'}.`
    )
  }

  return results
}

/**
 * Discovers local plugins and generates their manifests with /@fs/ URLs
 * @param rootDir - The project root directory
 * @param isDev - Whether running in development mode
 * @returns A promise that resolves to an array of local plugin manifests
 */
async function discoverLocalPlugins(
  rootDir: string,
  isDev: boolean = false
): Promise<PluginManifest[]> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting local plugin discovery (dev mode: ${isDev})`
  )

  const scannedPlugins = await scanPluginsFromDirectory(rootDir, isDev)
  const manifests = scannedPlugins
    .filter(plugin => plugin.isWorkspacePlugin)
    .map(plugin => plugin.manifest)

  console.log(
    `[@vue-plugin-arch/vite-plugin] Local plugin discovery completed. ` +
      `Found ${manifests.length} local plugins with /@fs/ URLs.`
  )

  return manifests
}

/**
 * Gets the workspace root directory by looking for workspace configuration files
 * @param startDir - The directory to start searching from
 * @returns The workspace root directory path
 */
async function findWorkspaceRoot(startDir: string): Promise<string> {
  let currentDir = startDir

  while (currentDir !== pathResolve(currentDir, '..')) {
    const pnpmWorkspaceFile = join(currentDir, 'pnpm-workspace.yaml')
    const packageJsonFile = join(currentDir, 'package.json')

    if (existsSync(pnpmWorkspaceFile)) {
      return currentDir
    }

    if (existsSync(packageJsonFile)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonFile, 'utf-8'))
        if (packageJson.workspaces) {
          return currentDir
        }
      } catch {
        // Continue searching
      }
    }

    currentDir = pathResolve(currentDir, '..')
  }

  // If no workspace root found, return the start directory
  return startDir
}

/**
 * Reads the static plugin registry file from the public directory
 * @param rootDir - The project root directory
 * @returns A promise that resolves to the static registry manifest, or null if not found
 */
async function readStaticRegistry(
  rootDir: string
): Promise<PluginRegistryManifest | null> {
  const workspaceRoot = await findWorkspaceRoot(rootDir)
  const staticRegistryPath = pathResolve(workspaceRoot, STATIC_PATH)

  console.log(
    `[@vue-plugin-arch/vite-plugin] Looking for static registry at: ${staticRegistryPath}`
  )

  if (!existsSync(staticRegistryPath)) {
    console.log(
      `[@vue-plugin-arch/vite-plugin] Static registry file not found, using empty registry`
    )
    return null
  }

  try {
    const registryContent = await readFile(staticRegistryPath, 'utf-8')
    const registry: PluginRegistryManifest = JSON.parse(registryContent)

    console.log(
      `[@vue-plugin-arch/vite-plugin] Successfully loaded static registry with ${registry.plugins.length} remote plugins`
    )

    return registry
  } catch (error) {
    console.error(
      `[@vue-plugin-arch/vite-plugin] Failed to read static registry file:`,
      error
    )
    return null
  }
}

/**
 * Merges local plugins with remote plugins from static registry
 * Local plugins take precedence over remote plugins with the same name
 * @param localPlugins - Array of local plugin manifests
 * @param staticRegistry - Static registry manifest with remote plugins
 * @returns Merged array of plugin manifests
 */
function mergePluginManifests(
  localPlugins: PluginManifest[],
  staticRegistry: PluginRegistryManifest | null
): PluginManifest[] {
  const mergedPlugins: PluginManifest[] = [...localPlugins]
  const localPluginNames = new Set(localPlugins.map(plugin => plugin.name))

  if (staticRegistry && staticRegistry.plugins) {
    for (const remotePlugin of staticRegistry.plugins) {
      if (localPluginNames.has(remotePlugin.name)) {
        console.log(
          `[@vue-plugin-arch/vite-plugin] Name conflict detected: Local plugin "${remotePlugin.name}" takes precedence over remote plugin`
        )
        continue
      }

      mergedPlugins.push(remotePlugin)
    }

    console.log(
      `[@vue-plugin-arch/vite-plugin] Merged ${localPlugins.length} local plugins with ${staticRegistry.plugins.length - (staticRegistry.plugins.length - (mergedPlugins.length - localPlugins.length))} remote plugins (${staticRegistry.plugins.length - (mergedPlugins.length - localPlugins.length)} conflicts resolved)`
    )
  } else {
    console.log(
      `[@vue-plugin-arch/vite-plugin] No static registry available, using only local plugins`
    )
  }

  return mergedPlugins
}

/**
 * Gets the merged plugin registry combining local and remote plugins
 * @param rootDir - The project root directory
 * @param isDev - Whether running in development mode
 * @returns A promise that resolves to the complete plugin registry manifest
 */
async function getMergedPluginRegistry(
  rootDir: string,
  isDev: boolean = false
): Promise<PluginRegistryManifest> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting merged plugin registry generation (dev mode: ${isDev})`
  )

  // Get local plugins
  const localPlugins = await discoverLocalPlugins(rootDir, isDev)

  // Read static registry
  const staticRegistry = await readStaticRegistry(rootDir)

  // Merge plugins with local taking precedence
  const mergedPlugins = mergePluginManifests(localPlugins, staticRegistry)

  const registryManifest: PluginRegistryManifest = {
    plugins: mergedPlugins,
    version: staticRegistry?.version || '1.0.0',
    lastUpdated: new Date().toISOString(),
  }

  console.log(
    `[@vue-plugin-arch/vite-plugin] Merged plugin registry completed. ` +
      `Total plugins: ${mergedPlugins.length} (${localPlugins.length} local, ${mergedPlugins.length - localPlugins.length} remote)`
  )

  return registryManifest
}

/**
 * Scans for all plugins from the plugins directory.
 * @param rootDir - The project root directory.
 * @param isDev - Whether running in development mode.
 * @returns A promise that resolves to an array of all plugin scan results.
 */
async function scanAllPlugins(
  rootDir: string,
  isDev: boolean = false
): Promise<ScannedPlugin[]> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting comprehensive plugin discovery (dev mode: ${isDev})`
  )

  const directoryPlugins = await scanPluginsFromDirectory(rootDir, isDev)

  console.log(
    `[@vue-plugin-arch/vite-plugin] Comprehensive plugin discovery completed. ` +
      `Found ${directoryPlugins.length} plugins from directory scan.`
  )

  return directoryPlugins
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
