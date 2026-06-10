import { ref, computed, provide, inject, type InjectionKey, type Ref } from 'vue'
import zh from './locales/zh'
import en from './locales/en'

export type Locale = 'zh' | 'en'
export type Messages = typeof zh

const locales: Record<Locale, Messages> = { zh, en }

const LOCALE_KEY: InjectionKey<Ref<Locale>> = Symbol('locale')
const MESSAGES_KEY: InjectionKey<Ref<Messages>> = Symbol('messages')

export function createI18n(defaultLocale: Locale = 'zh') {
  const locale = ref<Locale>(defaultLocale)
  const messages = computed(() => locales[locale.value])

  provide(LOCALE_KEY, locale)
  provide(MESSAGES_KEY, messages)

  function setLocale(l: Locale) {
    locale.value = l
    try { localStorage.setItem('lingjing-locale', l) } catch {}
  }

  return { locale, messages, setLocale }
}

export function useI18n() {
  const locale = inject<Ref<Locale>>(LOCALE_KEY)
  const messages = inject<Ref<Messages>>(MESSAGES_KEY)

  if (!locale || !messages) {
    throw new Error('useI18n() must be used within a component that has createI18n() called in a parent')
  }

  function t(path: string): any {
    const keys = path.split('.')
    let result: any = messages.value
    for (const key of keys) {
      if (result == null) return path
      result = result[key]
    }
    return result ?? path
  }

  return { locale, messages, t }
}
