import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['ms', 'en'],
  catalogs: [
    {
      path: 'packages/app/locales/{locale}/messages',
      include: ['packages/app', 'apps/expo/app', 'apps/next/app'],
    },
  ],
  format: formatter({ explicitIdAsDefault: true }),
})
