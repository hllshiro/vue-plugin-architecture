import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve as pathResolve, dirname, join } from 'path'
import resolvePackage from 'resolve'
import { findUp } from 'find-up'
import type { PluginManifest } from '@vue-plugin-arch/types'

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
 * Scans package.json dependencies to find plugins.
 * @param rootDir - The project root directory.
 * @param command - The current Vite command ('build' or 'serve').
 * @returns A promise that resolves to an array of plugin scan results.
 */
export async function scanPluginsFromDependencies(
  rootDir: string
): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = []
  const packageJsonPath = pathResolve(rootDir, 'package.json')

  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting plugin discovery from: ${packageJsonPath}`
  )

  try {
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonContent)

    const PluginManifests = Object.keys(packageJson.dependencies).filter(pkg =>
      pkg.startsWith('@vue-plugin-arch/plugin-')
    )

    console.log(
      `[@vue-plugin-arch/vite-plugin] Found ${PluginManifests.length} potential plugin packages: ${PluginManifests.join(', ')}`
    )

    for (const pkgName of PluginManifests) {
      console.log(
        `[@vue-plugin-arch/vite-plugin] Processing plugin: ${pkgName}`
      )

      try {
        // 1. Resolve the package's main entry point from the project root.
        let packageEntryPoint: string
        try {
          packageEntryPoint = resolvePackage.sync(pkgName, { basedir: rootDir })
        } catch (resolveError) {
          throw new Error(
            `Failed to resolve plugin package "${pkgName}".\n` +
              `This usually means the package is not installed or not accessible from the project root.\n` +
              `Please ensure the plugin is properly installed with: npm install ${pkgName}\n` +
              `Original error: ${resolveError instanceof Error ? resolveError.message : String(resolveError)}`
          )
        }

        // 2. Find the package.json file by searching upwards from the entry point.
        const pkgJsonPath = await findUp('package.json', {
          cwd: dirname(packageEntryPoint),
        })
        if (!pkgJsonPath) {
          throw new Error(
            `Could not find package.json for plugin "${pkgName}".\n` +
              `Searched upwards from: ${dirname(packageEntryPoint)}\n` +
              `This indicates a malformed package structure.`
          )
        }

        const packageDir = dirname(pkgJsonPath)
        console.log(
          `[@vue-plugin-arch/vite-plugin] Found plugin package directory: ${packageDir}`
        )

        let packageJsonData: PluginManifest
        try {
          const pkgJsonStr = await readFile(pkgJsonPath, 'utf-8')
          packageJsonData = JSON.parse(pkgJsonStr)
        } catch (parseError) {
          throw new Error(
            `Failed to read or parse package.json for plugin "${pkgName}" at: ${pkgJsonPath}\n` +
              `Error: ${parseError instanceof Error ? parseError.message : String(parseError)}\n` +
              `Please ensure the package.json file is valid JSON.`
          )
        }

        // Validate package.json structure
        if (!packageJsonData.main || packageJsonData.main === '') {
          console.warn(
            `[@vue-plugin-arch/vite-plugin] Skipping plugin "${pkgName}": No valid main entry point found in package.json.\n` +
              `Expected a "main" field pointing to the built JavaScript file (e.g., "dist/index.js").`
          )
          continue
        }

        if (!packageJsonData.name) {
          console.warn(
            `[@vue-plugin-arch/vite-plugin] Skipping plugin "${pkgName}": Missing "name" field in package.json.`
          )
          continue
        }

        // Always point to dist artifacts
        const distPath = join(packageDir, packageJsonData.main)
        console.log(
          `[@vue-plugin-arch/vite-plugin] Checking dist file: ${distPath}`
        )

        // Comprehensive dist file validation
        await validatePluginDistFile(pkgName, distPath)

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
          url: packageJsonData.name, // Temporary: will be replaced with actual URL in later tasks
        }

        results.push({ manifest, packageDir, isWorkspacePlugin: false })
        console.log(
          `[@vue-plugin-arch/vite-plugin] Successfully loaded plugin: ${pkgName}`
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `[@vue-plugin-arch/vite-plugin] Failed to load plugin "${pkgName}":\n${errorMessage}`
        )

        // Continue processing other plugins instead of failing completely
        continue
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `[@vue-plugin-arch/vite-plugin] Critical error during plugin discovery:\n` +
        `Failed to read or parse root package.json at: ${packageJsonPath}\n` +
        `Error: ${errorMessage}\n` +
        `Please ensure the package.json file exists and contains valid JSON.`
    )

    // Return empty array instead of throwing to allow graceful degradation
    return []
  }

  console.log(
    `[@vue-plugin-arch/vite-plugin] Plugin discovery completed. Found ${results.length} valid plugins.`
  )

  if (results.length === 0) {
    console.warn(
      `[@vue-plugin-arch/vite-plugin] No valid plugins found. This could mean:\n` +
        `  1. No plugin packages are installed (packages starting with "@vue-plugin-arch/plugin-")\n` +
        `  2. Plugin packages are not built (missing dist files)\n` +
        `  3. Plugin packages have invalid package.json structure\n` +
        `To resolve: Install plugin packages and ensure they are built before running the application.`
    )
  }

  return results
}

/**
 * Scans for all plugins from both dependencies and workspace.
 * @param rootDir - The project root directory.
 * @returns A promise that resolves to an array of all plugin scan results.
 */
export async function scanAllPlugins(
  rootDir: string
): Promise<ScannedPlugin[]> {
  console.log(
    `[@vue-plugin-arch/vite-plugin] Starting comprehensive plugin discovery`
  )

  const dependencyPlugins = await scanPluginsFromDependencies(rootDir)

  // Combine results, with workspace plugins taking precedence over dependency plugins
  // if there are name conflicts
  const pluginMap = new Map<string, ScannedPlugin>()

  // Add dependency plugins first
  for (const plugin of dependencyPlugins) {
    pluginMap.set(plugin.manifest.name, plugin)
  }

  const allPlugins = Array.from(pluginMap.values())

  console.log(
    `[@vue-plugin-arch/vite-plugin] Comprehensive plugin discovery completed. ` +
      `Found ${allPlugins.length} dependency plugins. `
  )

  return allPlugins
}
