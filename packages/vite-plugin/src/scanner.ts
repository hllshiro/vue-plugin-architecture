import { readFile, stat, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve as pathResolve, join } from 'path'
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
 * Scans plugins directory to find local plugins.
 * @param rootDir - The project root directory.
 * @returns A promise that resolves to an array of plugin scan results.
 */
export async function scanPluginsFromDirectory(
  rootDir: string
): Promise<ScannedPlugin[]> {
  const results: ScannedPlugin[] = []

  // Find the workspace root by looking for pnpm-workspace.yaml or package.json with workspaces
  let workspaceRoot = rootDir
  let currentDir = rootDir

  while (currentDir !== pathResolve(currentDir, '..')) {
    const pnpmWorkspaceFile = join(currentDir, 'pnpm-workspace.yaml')
    const packageJsonFile = join(currentDir, 'package.json')

    if (existsSync(pnpmWorkspaceFile)) {
      workspaceRoot = currentDir
      break
    }

    if (existsSync(packageJsonFile)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonFile, 'utf-8'))
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
          url: `/@fs/${distPath}`, // Use /@fs/ URL for local plugins
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
