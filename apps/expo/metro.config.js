// Learn more https://docs.expo.dev/guides/monorepos
// Learn more https://docs.expo.io/guides/customizing-metro
/**
 * @type {import('expo/metro-config')}
 */
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const fs = require('fs')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders || []), workspaceRoot]

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

const uniwindConfig = withUniwindConfig(config, {
  // Relative path to the Tailwind v4 / Uniwind CSS entry.
  cssEntryFile: './global.css',
  // Auto-generated className typings.
  dtsFile: './uniwind-types.d.ts',
  // Keep the app's original 14px rem so native spacing/sizing is unchanged
  // (Uniwind defaults to 16px). Web keeps the browser's 16px, as before.
  polyfills: { rem: 14 },
})

// Uniwind ships both an ESM build (dist/module) and a CJS build (dist/common)
// exposed via separate `import` / `default` export conditions. With
// package-exports resolution, ESM importers get dist/module while CJS `require`s
// get dist/common. Because each build instantiates its OWN config singleton +
// Appearance listener, that loads Uniwind TWICE and the two instances fight over
// the active theme. Collapse every dist/common resolution onto the matching
// dist/module file so there is a single Uniwind instance.
const uniwindResolveRequest = uniwindConfig.resolver.resolveRequest
uniwindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolution = uniwindResolveRequest
    ? uniwindResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)

  if (
    resolution &&
    resolution.type === 'sourceFile' &&
    typeof resolution.filePath === 'string' &&
    resolution.filePath.includes('/uniwind/dist/common/')
  ) {
    const moduleBuildPath = resolution.filePath.replace(
      '/uniwind/dist/common/',
      '/uniwind/dist/module/'
    )
    if (fs.existsSync(moduleBuildPath)) {
      return { ...resolution, filePath: moduleBuildPath }
    }
  }

  return resolution
}

module.exports = uniwindConfig
