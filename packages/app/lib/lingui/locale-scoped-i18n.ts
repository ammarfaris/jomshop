import { setupI18n, type I18n } from '@lingui/core'
import { messages as enMessages } from '../../locales/en/messages'
import { messages as msMessages } from '../../locales/ms/messages'

// The app mounts a single global I18nProvider (see app/provider/index.tsx) whose
// active locale tracks the user's language preference. The admin "Both" view on
// the contest detail page needs to render two fully-localized columns at once
// (English + Bahasa Malaysia) — child components read the locale via useLingui /
// <Trans>, so each column must own a separate I18nProvider with its own i18n
// instance. This module memoizes one independent i18n instance per locale.
//
// Instances are created lazily on first use; messages are loaded from the same
// compiled catalogs the global instance uses, so no new extraction is needed.

export type AppLocale = 'en' | 'ms'

const cache = new Map<AppLocale, I18n>()

/**
 * Returns a memoized, locale-pinned i18n instance suitable for mounting a
 * locale-scoped <I18nProvider i18n={...}> subtree.
 */
export function getLocaleScopedI18n(locale: AppLocale): I18n {
  let instance = cache.get(locale)
  if (!instance) {
    instance = setupI18n({ locale })
    instance.load('en', enMessages)
    instance.load('ms', msMessages)
    instance.activate(locale)
    cache.set(locale, instance)
  }
  return instance
}
