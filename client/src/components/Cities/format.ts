export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map(char => 0x1F1E6 + char.charCodeAt(0) - 65))
}

export function scoreColor(score: number | null): string {
  if (score == null) return 'var(--text-faint)'
  if (score >= 75) return '#059669'
  if (score >= 50) return '#d97706'
  return '#e11d48'
}

export function formatTemp(celsius: number | null, fahrenheit: boolean): string {
  if (celsius == null || Number.isNaN(celsius)) return '—'
  const value = fahrenheit ? celsius * 9 / 5 + 32 : celsius
  return `${Math.round(value)}°${fahrenheit ? 'F' : 'C'}`
}

export function tempUnit(fahrenheit: boolean): string {
  return fahrenheit ? '°F' : '°C'
}

export function formatNumber(value: number | null, locale: string, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function regionLabel(name: string, t: (key: string) => string): string {
  const key = `cities.region.${name}`
  const label = t(key)
  return label === key ? name : label
}

export const SCORE_KEYS = ['cost', 'internet', 'safety', 'climate', 'healthcare', 'air', 'things_to_do'] as const

export function monthName(month: number, locale: string, width: 'short' | 'long' = 'short'): string {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString(locale, { month: width, timeZone: 'UTC' })
}
