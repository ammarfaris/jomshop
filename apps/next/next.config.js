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

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native': 'react-native-web',
      'react-native$': 'react-native-web',
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
module.exports = {
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
