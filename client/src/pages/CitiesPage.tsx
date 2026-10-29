import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, Map as MapIcon, Search } from 'lucide-react'
import Navbar from '../components/Layout/Navbar'
import CityMap from '../components/Cities/CityMap'
import { countryFlag, formatNumber, formatTemp, monthName, regionLabel, SCORE_KEYS, scoreColor } from '../components/Cities/format'
import type { CityListResponse, CitySummary } from '../components/Cities/types'
import { citiesApi } from '../api/client'
import { useTranslation } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'

const SORTS = ['overall', 'name', 'cost', 'internet', 'safety', 'climate', 'healthcare', 'air', 'things_to_do', 'temp'] as const

const SCORE_LABEL: Record<string, string> = {
  cost: 'cities.metric.cost',
  internet: 'cities.metric.internet',
  safety: 'cities.metric.safety',
  climate: 'cities.metric.climate',
  healthcare: 'cities.metric.healthcare',
  air: 'cities.metric.air',
  things_to_do: 'cities.metric.things',
}

export default function CitiesPage() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const dm = useSettingsStore(s => s.settings.dark_mode)
  const fahrenheit = useSettingsStore(s => s.settings.temperature_unit) === 'fahrenheit'
  const dark = dm === true || dm === 'dark' || (dm === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState<string>('overall')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [view, setView] = useState<'cards' | 'map'>('cards')
  const [filters, setFilters] = useState({ warm: false, cheap: false, fast: false, safe: false, healthcare: false, english: false })
  const [data, setData] = useState<CityListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const params: Record<string, string> = { sort, order, limit: '500' }
    if (debouncedQuery) params.q = debouncedQuery
    if (region) params.region = region
    if (filters.warm) params.warm = '1'
    if (filters.cheap) params.cheap = '1'
    if (filters.fast) params.fast = '1'
    if (filters.safe) params.safe = '1'
    if (filters.healthcare) params.healthcare = '1'
    if (filters.english) params.english = 'official'
    let cancelled = false
    setLoading(true)
    citiesApi.list(params).then((response: CityListResponse) => {
      if (!cancelled) {
        setData(response)
        setError(false)
      }
    }).catch(() => {
      if (!cancelled) setError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [debouncedQuery, region, sort, order, filters])

  const cities = data?.cities || []
  const regions = data?.regions || []
  const filterChips = useMemo(() => [
    { key: 'warm' as const, label: t('cities.warm'), hint: t('cities.hint.warm') },
    { key: 'cheap' as const, label: t('cities.cheap'), hint: t('cities.hint.cheap') },
    { key: 'fast' as const, label: t('cities.fast'), hint: t('cities.hint.fast') },
    { key: 'safe' as const, label: t('cities.safe'), hint: t('cities.hint.safe') },
    { key: 'healthcare' as const, label: t('cities.healthcare'), hint: t('cities.hint.healthcare') },
    { key: 'english' as const, label: t('cities.english'), hint: t('cities.hint.english') },
  ], [t])

  const changeSort = (next: string) => {
    setSort(next)
    setOrder(next === 'name' ? 'asc' : 'desc')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      <div style={{ marginTop: 'var(--nav-h)' }} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('cities.title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', maxWidth: 640 }}>{t('cities.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewButton active={view === 'cards'} label={t('cities.view.cards')} onClick={() => setView('cards')} icon={<LayoutGrid className="w-3.5 h-3.5" />} />
            <ViewButton active={view === 'map'} label={t('cities.view.map')} onClick={() => setView('map')} icon={<MapIcon className="w-3.5 h-3.5" />} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mb-3">
          <label className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('cities.search')}
              aria-label={t('cities.search')}
              className="w-full text-sm"
              style={{
                background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: '10px 12px 10px 36px', outline: 'none',
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="sr-only">{t('cities.sort')}</span>
            <select
              aria-label={t('cities.sort')}
              value={sort}
              onChange={event => changeSort(event.target.value)}
              style={{
                background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: '10px 12px',
              }}
            >
              {SORTS.map(key => <option key={key} value={key}>{t(`cities.sort.${key}`)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
              aria-label={order === 'asc' ? t('cities.order.asc') : t('cities.order.desc')}
              style={{
                background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: '10px 12px', fontWeight: 700,
              }}
            >
              {order === 'asc' ? '↑' : '↓'}
            </button>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          <Chip active={region === ''} onClick={() => setRegion('')} label={t('cities.region.all')} />
          {regions.map(name => (
            <Chip key={name} active={region === name} onClick={() => setRegion(region === name ? '' : name)} label={regionLabel(name, t)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {filterChips.map(chip => (
            <Chip
              key={chip.key}
              active={filters[chip.key]}
              hint={chip.hint}
              onClick={() => setFilters(current => ({ ...current, [chip.key]: !current[chip.key] }))}
              label={chip.label}
            />
          ))}
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
          {loading && !data ? t('cities.loading') : t('cities.results', { count: data?.total ?? 0 })}
          {(filters.warm || filters.cheap || filters.fast || filters.safe || filters.healthcare || filters.english) && ` · ${t('cities.filterHidesMissing')}`}
        </p>

        {error && <p className="text-sm" style={{ color: '#e11d48' }}>{t('cities.error')}</p>}

        {!error && data && data.available === 0 && (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}>
            <p className="font-semibold">{t('cities.unseeded')}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{t('cities.unseededHint')}</p>
            <code className="inline-block mt-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              cd server && npm run seed:cities
            </code>
          </div>
        )}

        {!error && data && data.available > 0 && cities.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('cities.empty')}</p>
        )}

        {view === 'map' && cities.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 mb-6" style={{ minHeight: 520 }}>
            <div className="overflow-auto rounded-2xl border" style={{ borderColor: 'var(--border-primary)', maxHeight: 640 }}>
              {cities.map(city => (
                <button
                  key={city.slug}
                  type="button"
                  onClick={() => navigate(`/cities/${city.slug}`)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-primary)' }}
                >
                  <ScoreBadge score={city.overall_score} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{countryFlag(city.country_code)} {city.name}</span>
                    <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>{city.country_name}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-primary)', minHeight: 420 }}>
              <CityMap cities={cities} dark={dark} onSelect={slug => navigate(`/cities/${slug}`)} />
            </div>
          </div>
        )}

        {view === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cities.map(city => (
              <CityCard key={city.slug} city={city} locale={locale} fahrenheit={fahrenheit} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CityCard({ city, locale, fahrenheit, t }: { city: CitySummary; locale: string; fahrenheit: boolean; t: (key: string, params?: Record<string, string | number>) => string }) {
  const month = monthName(city.current_month, locale, 'short')
  return (
    <Link
      to={`/cities/${city.slug}`}
      className="block rounded-2xl border p-4 transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{countryFlag(city.country_code)} {city.name}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {city.country_name || city.country_code}
            {city.regions.length > 0 && ` · ${city.regions.map(name => regionLabel(name, t)).join(', ')}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black tabular-nums" style={{ color: scoreColor(city.overall_score) }}>
            {city.overall_score == null ? '—' : city.overall_score}
          </div>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            {city.overall_score == null ? t('cities.noData') : t('cities.overall')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <Fact label={t('cities.typicalMonth', { month })} value={formatTemp(city.typical_temp_c, fahrenheit)} missing={city.typical_temp_c == null} missingLabel={t('cities.noData')} />
        <Fact label={t('cities.metric.cost')} value={city.price_level_ratio == null ? '—' : `${formatNumber(city.price_level_ratio, locale, 2)}×`} missing={city.price_level_ratio == null} missingLabel={t('cities.noData')} />
        <Fact label={t('cities.download')} value={city.download_mbps == null ? '—' : `${formatNumber(city.download_mbps, locale, 0)}`} missing={city.download_mbps == null} missingLabel={t('cities.noData')} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4">
        {SCORE_KEYS.map(key => (
          <div key={key} className="flex items-center justify-between gap-2 text-xs" title={city.scores[key] == null ? t('cities.noData') : undefined}>
            <span style={{ color: 'var(--text-muted)' }}>{t(SCORE_LABEL[key])}</span>
            <span className="font-bold tabular-nums" style={{ color: scoreColor(city.scores[key]) }}>
              {city.scores[key] == null ? '—' : city.scores[key]}
            </span>
          </div>
        ))}
      </div>
      {city.overall_score != null && (
        <p className="text-[10px] mt-3" style={{ color: 'var(--text-faint)' }}>
          {t('cities.basedOn', { count: city.score_count, total: SCORE_KEYS.length })}
        </p>
      )}
    </Link>
  )
}

function Fact({ label, value, missing, missingLabel }: { label: string; value: string; missing: boolean; missingLabel: string }) {
  return (
    <div title={missing ? missingLabel : undefined}>
      <p className="text-sm font-bold tabular-nums" style={{ color: missing ? 'var(--text-faint)' : 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</p>
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0" style={{
      background: score == null ? 'var(--bg-tertiary)' : scoreColor(score),
      color: score == null ? 'var(--text-faint)' : '#fff',
    }}>{score == null ? '—' : score}</span>
  )
}

function Chip({ active, label, onClick, hint }: { active: boolean; label: string; onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onClick}
      className="text-xs font-semibold"
      style={{
        borderRadius: 999, padding: '6px 12px',
        border: '1px solid var(--border-primary)',
        background: active ? 'var(--accent)' : 'var(--bg-card)',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

function ViewButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-semibold"
      style={{
        borderRadius: 999, padding: '7px 12px',
        border: '1px solid var(--border-primary)',
        background: active ? 'var(--accent)' : 'var(--bg-card)',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
      }}
    >
      {icon}{label}
    </button>
  )
}
