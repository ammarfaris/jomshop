module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    /**
     * https://lingui.dev/installation?transpiler=babel
     * If you're using React Compiler, make sure that @lingui/babel-plugin-lingui-macro comes
     * before babel-preset-expo (which now wires up React Compiler when
     * `experiments.reactCompiler` is enabled in app.json), so macros expand before the
     * compiler processes the code.
     */
    plugins: [
      '@lingui/babel-plugin-lingui-macro',
      // Reanimated 4 moved the worklets transform into its own package. This must be the
      // last Babel plugin (see https://docs.expo.dev/versions/v55.0.0/sdk/reanimated/).
      [
        'react-native-worklets/plugin',
        {
          // Disable strict mode to suppress warnings from third-party libraries
          // that initialize shared values during render (e.g., react-native-zoom-toolkit).
          globals: ['__scanCodes'],
          strict: false,
        },
      ],
    ],
  }
}
