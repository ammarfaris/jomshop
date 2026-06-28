import { i18n } from '@lingui/core'
import { messages as enMessages } from '../../locales/en/messages'
import { messages as msMessages } from '../../locales/ms/messages'

export const locales = {
  en: 'English',
  ms: 'Bahasa Malaysia',
}

export const defaultLocale = 'en'

// Load all messages at startup
i18n.load('en', enMessages)
i18n.load('ms', msMessages)
i18n.activate(defaultLocale)

/**
 * Switch to a different locale
 */
export function activateLocale(locale: keyof typeof locales) {
  i18n.activate(locale)
}

export { i18n }
