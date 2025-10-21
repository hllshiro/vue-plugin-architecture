import { readFile, stat, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve as pathResolve, join } from 'path'
import type {
  PluginManifest,
  PluginRegistryManifest,
} from '@vue-plugin-arch/types'

export const STATIC_PATH = 'packages/demo/public/api/plugin-registry.json'

/**
 * Utility functions for converting local paths to /@fs/ URLs
 */

/**
 * Converts a local file system path to a /@fs/ URL for Vite dev server
 * @param localPath - The absolute local file system path
 * @returns The /@fs/ URL that can be used for dynamic imports in Vite dev server
 */
export function convertLocalPathToFsUrl(localPath: string): string {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = localPath.replace(/\\/g, '/')
  return `/@fs/${normalizedPath}`
}

/**
 * Converts a plugin's dist file path to a /@fs/ URL
 * @param pluginDir - The plugin directory path
 * @param mainEntry - The main entry point from package.json (e.g., "dist/index.js")
 * @returns The /@fs/ URL pointing to the plugin's built file
 */
export function convertPluginDistToFsUrl(
  pluginDir: string,
  mainEntry: string
): string {
  const distPath = pathResolve(pluginDir, mainEntry)
  return convertLocalPathToFsUrl(distPath)
}

/**
 * Validates and converts a plugin's main entry to a /@fs/ URL
 * @param pluginDir - The plugin directory path
 * @param mainEntry - The main entry point from package.json
 * @param pluginName - The plugin name for error messages
 * @returns The validated /@fs/ URL
 * @throws Error if the dist file doesn't exist or is invalid
 */
export async function validateAndConvertPluginUrl(
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

export interface ScannedPlugin {
  manifest: PluginManifest
  packageDir: string
  isWorkspacePlugin: boolean
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
 * @returns A promise that resolves to an array of plugin scan results.
 */
export async function scanPluginsFromDirectory(
  rootDir: string
): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = []

  // Find the workspace root using utility function
  const workspaceRoot = await findWorkspaceRoot(rootDir)

  const pluginsDir = pathResolve(workspaceRoot, 'packages/plugins')

  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting plugin discovery from plugins directory: ${pluginsDir} (workspace root: ${workspaceRoot})`
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

        // Always point to dist artifacts
        const distPath = join(pluginDir, packageJsonData.main)
        console.log(
          `[@vue-plugin-arch/vite-plugin] Checking dist file: ${distPath}`
        )

        // Comprehensive dist file validation
        await validatePluginDistFile(packageJsonData.name, distPath)

        // Generate /@fs/ URL using utility function
        const pluginUrl = await validateAndConvertPluginUrl(
          pluginDir,
          packageJsonData.main,
          packageJsonData.name
        )

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
          url: pluginUrl, // Use validated /@fs/ URL for local plugins
        }

        results.push({
          manifest,
          packageDir: pluginDir,
          isWorkspacePlugin: true,
        })
        console.log(
          `[@vue-plugin-arch/vite-plugin] Successfully loaded plugin: ${packageJsonData.name}`
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
        `  2. Plugin packages are not built (missing dist files)\n` +
        `  3. Plugin packages have invalid package.json structure\n` +
        `To resolve: Ensure plugins are built before running the application.`
    )
  }

  return results
}

/**
 * Discovers local plugins and generates their manifests with /@fs/ URLs
 * @param rootDir - The project root directory
 * @returns A promise that resolves to an array of local plugin manifests
 */
export async function discoverLocalPlugins(
  rootDir: string
): Promise<PluginManifest[]> {
  console.log(`[@vue-plugin-arch/vite-plugin] Starting local plugin discovery`)

  const scannedPlugins = await scanPluginsFromDirectory(rootDir)
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
export async function findWorkspaceRoot(startDir: string): Promise<string> {
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
export async function readStaticRegistry(
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
export function mergePluginManifests(
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
 * @returns A promise that resolves to the complete plugin registry manifest
 */
export async function getMergedPluginRegistry(
  rootDir: string
): Promise<PluginRegistryManifest> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting merged plugin registry generation`
  )

  // Get local plugins
  const localPlugins = await discoverLocalPlugins(rootDir)

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
 * @returns A promise that resolves to an array of all plugin scan results.
 */
export async function scanAllPlugins(
  rootDir: string
): Promise<ScannedPlugin[]> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting comprehensive plugin discovery`
  )

  const directoryPlugins = await scanPluginsFromDirectory(rootDir)

  console.log(
    `[@vue-plugin-arch/vite-plugin] Comprehensive plugin discovery completed. ` +
      `Found ${directoryPlugins.length} plugins from directory scan.`
  )

  return directoryPlugins
}
