const fs = require('fs')
const path = require('path')
const { withUniwind } = require('uniwind-plugin-next')

/**
 * @type {import('next').NextConfig}
 */
const withWebpack = {
  // fix nextjs warning => The global process.env.EXPO_OS is not defined. This should be inlined by babel-preset-expo during transformation.
  env: {
    EXPO_OS: 'web',
  },
  webpack(config, { isServer }) {
    if (!config.resolve) {
      config.resolve = {}
    }

    // react-native-web (+ yet-another-react-lightbox) are only installed under
    // apps/next/node_modules (yarn didn't hoist them), yet they're imported by
    // ROOT-level packages (expo, react-native-reanimated) and by packages/app.
    // Point webpack at the single copy in apps/next so those bare AND deep
    // subpath imports resolve from anywhere in the monorepo.
    const reactNativeWebDir = path.dirname(
      require.resolve('react-native-web/package.json')
    )

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // NOTE: bare `react-native` is intentionally NOT aliased to
      // react-native-web here. uniwind-plugin-next rewrites `react-native`
      // imports to `uniwind/components/index` (its web interop wrappers) so
      // Tailwind `className`s actually apply on web. Aliasing it to
      // react-native-web would bypass Uniwind and drop the classNames.
      '@marsidev/react-turnstile': require.resolve('@marsidev/react-turnstile'),
      'next-themes': require.resolve('next-themes'),
      sonner: require.resolve('sonner'),
      // Alias the PACKAGE DIRECTORY (react-native-web has no `exports` field) so
      // deep imports like `react-native-web/dist/exports/StyleSheet` resolve.
      // Do NOT use require.resolve('react-native-web') here — that returns
      // dist/index.js (a file), so webpack would rewrite subpaths to
      // `dist/index.js/dist/exports/...` and fail to resolve them.
      'react-native-web': reactNativeWebDir,
      // yet-another-react-lightbox is web-only, imported (dynamically) from
      // packages/app, and also isolated in apps/next/node_modules. It ships an
      // `exports` map so a directory alias would bypass it — alias each used
      // specifier exactly ($) to its resolved file instead.
      'yet-another-react-lightbox$': require.resolve('yet-another-react-lightbox'),
      'yet-another-react-lightbox/plugins/zoom$': require.resolve(
        'yet-another-react-lightbox/plugins/zoom'
      ),
      'yet-another-react-lightbox/plugins/captions$': require.resolve(
        'yet-another-react-lightbox/plugins/captions'
      ),
      'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
      'react-native/Libraries/vendor/emitter/EventEmitter$':
        'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
      'react-native/Libraries/EventEmitter/NativeEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter',
    }

    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...(config.resolve?.extensions ?? []),
    ]

    // Force a single Uniwind build on web. Uniwind ships ESM (dist/module) and
    // CJS (dist/common); with package `type: module` the CJS files break
    // (`exports is not defined` on the client) and loading both instantiates
    // Uniwind twice (`Cannot redefine property: ActivityIndicator` on the
    // server). Mirror apps/expo/metro.config.js by rewriting every dist/common
    // resolution to the matching dist/module file.
    config.resolve.plugins = config.resolve.plugins || []
    config.resolve.plugins.push({
      apply(resolver) {
        resolver
          .getHook('resolved')
          .tapAsync('UniwindForceEsmBuild', (request, _ctx, callback) => {
            const p = request.path
            if (typeof p === 'string' && p.includes('/uniwind/dist/common/')) {
              const moduleBuild = p.replace(
                '/uniwind/dist/common/',
                '/uniwind/dist/module/'
              )
              if (fs.existsSync(moduleBuild)) {
                request.path = moduleBuild
              }
            }
            callback()
          })
      },
    })

    return config
  },
}

/**
 * @type {import('next').NextConfig}
 */
const withTurbopack = {
  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
      'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
      'react-native/Libraries/vendor/emitter/EventEmitter$':
        'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
      'react-native/Libraries/EventEmitter/NativeEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter',
    },
    resolveExtensions: [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      '.js',
      '.mjs',
      '.tsx',
      '.ts',
      '.jsx',
      '.json',
      '.wasm',
    ],
  },
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  allowedDevOrigins: ['192.168.68.*', 'localhost'],

  images: {
    remotePatterns: [
      new URL('https://api.lets.app/'),
      new URL('https://api.jomcontest.com/'),
    ],
  },

  transpilePackages: [
    'react-native',
    'react-native-web',
    'solito',
    'react-native-reanimated',
    'moti',
    'react-native-gesture-handler',
    'react-native-svg',
    // Expo
    'expo-image-picker',
    'expo-modules-core', // results in warning "The global process.env.EXPO_OS is not defined", needed by expo-image-picker, maybe the rest also
    'expo-image',
    'expo', // expo-image's dependency
    '@expo/app', // expo-image's dependency
    '@expo/config-runtime', // expo-image's dependency
    'expo-clipboard',
  ],

  compiler: {
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
  },

  /**
   *  https://lingui.dev/installation?transpiler=swc#choosing-a-transpiler
   *  If you're using React Compiler with SWC, the @lingui/swc-plugin must run before the React Compiler plugin.
   *  This is necessary because Lingui macros need to be expanded before the React Compiler processes your code.
   *
   *  However, in Next.js, the React Compiler is enabled via a simple boolean flag (reactCompiler: true) in next.config.js,
   *  and there's currently no way to control plugin ordering.
   *
   *  As a result, Lingui may not work correctly with the React Compiler in SWC-based setups like Next.js.
   */
  experimental: {
    // Enable Lingui SWC plugin to transform macros without Babel
    swcPlugins: [['@lingui/swc-plugin', {}]],
  },

  reactStrictMode: false, // reanimated doesn't support this on web

  ...withWebpack,
  ...withTurbopack,
}

/**
 * Uniwind web integration (webpack only — Turbopack is unsupported by
 * uniwind-plugin-next, so keep dev/build on webpack). This injects the loader
 * that makes `className` on shared react-native components apply on web.
 */
module.exports = withUniwind(nextConfig, {
  // CSS entry that imports `tailwindcss` + `uniwind` (relative to apps/next).
  cssEntryFile: './app/globals.css',
})
