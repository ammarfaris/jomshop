module.exports = {
  plugins: {
    // Must run before @tailwindcss/postcss so Uniwind can inject its
    // generated CSS / resolve `@import 'uniwind'` for the web build.
    'uniwind-plugin-next/postcss': {},
    '@tailwindcss/postcss': {},
  },
}
