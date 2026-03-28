import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import de from './translations/de'
import en from './translations/en'

type TranslationStrings = Record<string, string>

const translations: Record<string, TranslationStrings> = { de, en }

interface TranslationContextValue {
  t: (key: string, params?: Record<string, string | number>) => string
  language: string
  locale: string
}

const TranslationContext = createContext<TranslationContextValue>({ t: (k: string) => k, language: 'de', locale: 'de-DE' })

interface TranslationProviderProps {
  children: ReactNode
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const language = useSettingsStore((s) => s.settings.language) || 'de'

  const value = useMemo((): TranslationContextValue => {
    const strings = translations[language] || translations.de
    const fallback = translations.de

    function t(key: string, params?: Record<string, string | number>): string {
      let val: string = strings[key] ?? fallback[key] ?? key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
      }
      return val
    }

    return { t, language, locale: language === 'en' ? 'en-US' : 'de-DE' }
  }, [language])

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export function useTranslation(): TranslationContextValue {
  return useContext(TranslationContext)
}
