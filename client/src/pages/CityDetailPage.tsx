import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Plane } from 'lucide-react'
import Navbar from '../components/Layout/Navbar'
import CityMap from '../components/Cities/CityMap'
import TripFormModal from '../components/Trips/TripFormModal'
import { countryFlag, formatNumber, formatTemp, monthName, regionLabel, SCORE_KEYS, scoreColor } from '../components/Cities/format'
import type { CityDetailResponse, CityMetric } from '../components/Cities/types'
import { citiesApi, placesApi, tripsApi } from '../api/client'
import { useTranslation } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'
import { useToast } from '../components/shared/Toast'

const SCORE_LABEL: Record<string, string> = {
  cost: 'cities.metric.cost',
  internet: 'cities.metric.internet',
  safety: 'cities.metric.safety',
  climate: 'cities.metric.climate',
  healthcare: 'cities.metric.healthcare',
  air: 'cities.metric.air',
  things_to_do: 'cities.metric.things',
}

const SCORE_HINT: Record<string, string> = {
  cost: 'cities.scoreHint.cost',
  internet: 'cities.scoreHint.internet',
  safety: 'cities.scoreHint.safety',
  climate: 'cities.scoreHint.climate',
  healthcare: 'cities.scoreHint.healthcare',
  air: 'cities.scoreHint.air',
  things_to_do: 'cities.scoreHint.things',
}

export default function CityDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { t, locale } = useTranslation()
  const dm = useSettingsStore(s => s.settings.dark_mode)
  const fahrenheit = useSettingsStore(s => s.settings.temperature_unit) === 'fahrenheit'
  const dark = dm === true || dm === 'dark' || (dm === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [data, setData] = useState<CityDetailResponse | null>(null)
  const [error, setError] = useState(false)
  const [tripOpen, setTripOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    citiesApi.get(slug).then((response: CityDetailResponse) => {
      if (!cancelled) setData(response)
    }).catch(() => {
      if (!cancelled) setError(true)
    })
    return () => { cancelled = true }
  }, [slug])

  const city = data?.city
  const metrics = new Map((data?.metrics || []).map(metric => [metric.metric, metric]))

  const createTrip = async (form: Record<string, string | number | null>) => {
    if (!city) return
    const created = await tripsApi.create(form)
    try {
      await placesApi.create(created.trip.id, {
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        address: [city.name, city.country_name].filter(Boolean).join(', '),
      })
    } catch {
      toast.error(t('cities.placeError'))
    }
    toast.success(t('cities.tripCreated'))
    navigate(`/trips/${created.trip.id}`)
    return created
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      <div style={{ marginTop: 'var(--nav-h)' }} className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">
        <Link to="/cities" className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> {t('cities.back')}
        </Link>

        {error && <p className="text-sm" style={{ color: '#e11d48' }}>{t('cities.error')}</p>}
        {!data && !error && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('cities.loading')}</p>}

        {city && data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight">{countryFlag(city.country_code)} {city.name}</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {city.country_name || city.country_code}
                  {city.regions.length > 0 && ` · ${city.regions.map(name => regionLabel(name, t)).join(', ')}`}
                  {city.population != null && ` · ${t('cities.population')} ${formatNumber(city.population, locale)}`}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
                  {city.overall_score == null
                    ? t('cities.noOverall')
                    : t('cities.basedOn', { have: city.score_count, total: SCORE_KEYS.length })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-4xl font-black tabular-nums" style={{ color: scoreColor(city.overall_score) }}>
                    {city.overall_score == null ? '—' : city.overall_score}
                  </div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{t('cities.overall')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTripOpen(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 12, padding: '10px 14px' }}
                >
                  <Plane className="w-4 h-4" /> {t('cities.planTrip')}
                </button>
              </div>
            </div>

            <section className="rounded-2xl border p-4 sm:p-5 mb-4" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}>
              <h2 className="text-sm font-bold mb-1">{t('cities.scoreBreakdown')}</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>{t('cities.scoreNote')}</p>
              <div className="space-y-4">
                {SCORE_KEYS.map(key => (
                  <ScoreRow
                    key={key}
                    label={t(SCORE_LABEL[key])}
                    hint={t(SCORE_HINT[key])}
                    score={city.scores[key]}
                    raw={rawLine(key, city, metrics, locale, fahrenheit, t)}
                    scope={scopeFor(key, city, metrics, t)}
                  />
                ))}
                <ScoreRow
                  label={t('cities.monthlyCost')}
                  hint={t('cities.monthlyCostMissing')}
                  score={null}
                  raw={t('cities.noData')}
                  scope={null}
                />
                <div className="pt-2" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                  <p className="text-sm font-semibold">{t('cities.metric.english')}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {city.languages.length ? city.languages.join(', ') : t('cities.noData')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('cities.englishOfficial')}: {yesNo(city.english_official, t)}
                    {' · '}
                    {t('cities.englishUsed')}: {city.english_used == null ? t('cities.noData') : yesNo(city.english_used, t)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border p-4 sm:p-5 mb-4" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold">{t('cities.climate')}</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('cities.liveTemp')}: {data.live ? formatTemp(data.live.temp_c, fahrenheit) : t('cities.noData')}
                  {data.climate_meta?.period ? ` · ${data.climate_meta.period}` : ''}
                </p>
              </div>
              {data.climate.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('cities.noClimate')}</p>
              ) : (
                <ClimateChart
                  months={data.climate}
                  currentMonth={city.current_month}
                  bestMonths={city.best_months}
                  locale={locale}
                  fahrenheit={fahrenheit}
                  t={t}
                />
              )}
              {city.best_months.length > 0 && (
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  {t('cities.bestMonths')}: {city.best_months.map(month => monthName(month, locale, 'long')).join(', ')}. {t('cities.bestMonthsHint')}
                </p>
              )}
            </section>

            <section className="rounded-2xl overflow-hidden border mb-4" style={{ borderColor: 'var(--border-primary)', height: 360 }}>
              <CityMap cities={[city]} dark={dark} selectedSlug={city.slug} />
            </section>

            <section className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}>
              <h2 className="text-sm font-bold mb-3">{t('cities.sources')}</h2>
              <ul className="space-y-3">
                {city.geo_source && (
                  <SourceLine
                    label={t('cities.source.place')}
                    source={city.geo_source}
                    license={city.geo_license}
                    fetched={city.geo_fetched_at}
                    locale={locale}
                    t={t}
                  />
                )}
                {city.facts_source && (
                  <SourceLine
                    label={t('cities.source.facts')}
                    source={city.facts_source}
                    license={city.facts_license}
                    fetched={city.facts_fetched_at}
                    url="https://www.wikidata.org/"
                    locale={locale}
                    t={t}
                  />
                )}
                {data.climate_meta?.source && (
                  <SourceLine
                    label={t('cities.climate')}
                    source={data.climate_meta.source}
                    license={data.climate_meta.license}
                    fetched={data.climate_meta.fetched_at}
                    url={data.climate_meta.source_url}
                    period={data.climate_meta.period}
                    locale={locale}
                    t={t}
                  />
                )}
                {data.metrics.map(metric => (
                  <SourceLine
                    key={metric.metric}
                    label={metric.metric}
                    source={metric.source}
                    license={metric.license}
                    fetched={metric.fetched_at}
                    url={metric.source_url}
                    period={metric.period}
                    scope={metric.scope === 'country' ? t('cities.countryScope') : metric.scope === 'tile' ? t('cities.tileScope') : t('cities.cityScope')}
                    locale={locale}
                    t={t}
                  />
                ))}
                {data.live && (
                  <SourceLine
                    label={t('cities.liveTemp')}
                    source={data.live.source}
                    license={data.live.license}
                    fetched={data.live.fetched_at}
                    url={data.live.source_url}
                    locale={locale}
                    t={t}
                  />
                )}
              </ul>
              <p className="text-xs mt-4" style={{ color: 'var(--text-faint)' }}>{t('cities.attribution')}</p>
            </section>

            <TripFormModal
              isOpen={tripOpen}
              onClose={() => setTripOpen(false)}
              onSave={createTrip}
              trip={null}
              onCoverUpdate={() => {}}
              preset={{
                title: city.name,
                description: [city.name, city.country_name].filter(Boolean).join(', '),
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function yesNo(value: boolean | null, t: (key: string) => string): string {
  if (value == null) return t('cities.noData')
  return value ? t('common.yes') : t('common.no')
}

function scopeFor(key: string, city: CityDetailResponse['city'], metrics: Map<string, CityMetric>, t: (key: string) => string): string | null {
  if (key === 'cost' || key === 'safety' || key === 'healthcare') {
    return metrics.has(metricKey(key)) ? t('cities.countryScope') : null
  }
  if (key === 'internet') return metrics.has('internet_download_mbps') ? t('cities.tileScope') : null
  if (key === 'air') {
    if (city.pm25 == null) return null
    return city.pm25_scope === 'country' ? t('cities.countryScope') : t('cities.cityScope')
  }
  if (key === 'things_to_do') return metrics.has('poi_count') ? t('cities.cityScope') : null
  if (key === 'climate') return city.climate_complete ? t('cities.cityScope') : null
  return null
}

function metricKey(scoreKey: string): string {
  if (scoreKey === 'cost') return 'price_level_ratio'
  if (scoreKey === 'safety') return 'homicide_per_100k'
  if (scoreKey === 'healthcare') return 'physicians_per_1000'
  return scoreKey
}

function rawLine(
  key: string,
  city: CityDetailResponse['city'],
  metrics: Map<string, CityMetric>,
  locale: string,
  fahrenheit: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (key === 'cost') {
    if (city.price_level_ratio == null) return t('cities.noData')
    const year = metrics.get('price_level_ratio')?.period
    return `${formatNumber(city.price_level_ratio, locale, 2)}× US${year ? ` (${year})` : ''}`
  }
  if (key === 'internet') {
    if (city.download_mbps == null) return t('cities.noData')
    const upload = city.upload_mbps == null ? t('cities.noData') : `${formatNumber(city.upload_mbps, locale, 0)} Mbps`
    const latency = city.latency_ms == null ? t('cities.noData') : `${formatNumber(city.latency_ms, locale, 0)} ms`
    return `${formatNumber(city.download_mbps, locale, 0)} Mbps · ${t('cities.upload')} ${upload} · ${t('cities.latency')} ${latency}`
  }
  if (key === 'safety') {
    if (city.homicide_per_100k == null) return t('cities.noData')
    return `${formatNumber(city.homicide_per_100k, locale, 2)} ${t('cities.unit.homicide')}`
  }
  if (key === 'healthcare') {
    if (city.physicians_per_1000 == null) return t('cities.noData')
    return `${formatNumber(city.physicians_per_1000, locale, 2)} ${t('cities.unit.physicians')}`
  }
  if (key === 'air') {
    if (city.pm25 == null) return t('cities.noData')
    const country = city.pm25_country == null ? '' : ` · ${t('cities.countryAnnual')} ${formatNumber(city.pm25_country, locale, 1)}`
    return `${formatNumber(city.pm25, locale, 1)} µg/m³${country}`
  }
  if (key === 'things_to_do') {
    if (city.poi_count == null) return t('cities.noData')
    return `${formatNumber(city.poi_count, locale)} ${t('cities.unit.places')}`
  }
  if (key === 'climate') {
    if (city.comfort_months == null) return t('cities.noData')
    const typical = city.typical_temp_c == null ? t('cities.noData') : formatTemp(city.typical_temp_c, fahrenheit)
    return t('cities.comfortCount', { comfortable: city.comfort_months, temp: typical })
  }
  return t('cities.noData')
}

function ScoreRow({ label, hint, score, raw, scope }: { label: string; hint: string; score: number | null; raw: string; scope: string | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {label}
            {scope && <span className="ml-2 text-[10px] uppercase tracking-wide font-bold" style={{ color: 'var(--text-faint)' }}>{scope}</span>}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{raw}</p>
        </div>
        <span className="text-lg font-black tabular-nums" style={{ color: scoreColor(score) }}>{score == null ? '—' : score}</span>
      </div>
      <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        {score != null && <div style={{ width: `${score}%`, height: '100%', background: scoreColor(score) }} />}
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{hint}</p>
    </div>
  )
}

function ClimateChart({
  months, currentMonth, bestMonths, locale, fahrenheit, t,
}: {
  months: CityDetailResponse['climate']
  currentMonth: number
  bestMonths: number[]
  locale: string
  fahrenheit: boolean
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const means = months.map(month => month.temp_mean_c).filter((value): value is number => value != null)
  const scaleMin = Math.min(0, ...(means.length ? means : [0]))
  const scaleMax = Math.max(30, ...(means.length ? means : [30]))
  const span = scaleMax - scaleMin || 1
  const height = 120
  const y = (value: number) => ((scaleMax - value) / span) * height

  return (
    <div className="flex items-end gap-1 sm:gap-2 overflow-x-auto">
      {Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        const row = months.find(item => item.month === month)
        const mean = row?.temp_mean_c
        const best = bestMonths.includes(month)
        const current = month === currentMonth
        const zero = y(0)
        const valueY = mean == null ? zero : y(mean)
        const top = Math.min(zero, valueY)
        const bar = Math.max(2, Math.abs(zero - valueY))
        return (
          <div key={month} className="flex-1 min-w-[36px] text-center">
            <p className="text-[10px] font-bold tabular-nums mb-1" style={{ color: mean == null ? 'var(--text-faint)' : 'var(--text-primary)' }}>
              {mean == null ? '—' : formatTemp(mean, fahrenheit)}
            </p>
            <div className="relative mx-auto" style={{ height, width: '70%', outline: current ? '1px solid var(--text-primary)' : 'none', borderRadius: 6 }}>
              {mean != null && (
                <div style={{
                  position: 'absolute', top, height: bar, left: 0, right: 0, borderRadius: 4,
                  background: best ? '#059669' : 'var(--text-faint)',
                  opacity: best ? 1 : 0.55,
                }} />
              )}
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{monthName(month, locale, 'short')}</p>
            <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }} title={t('cities.precip')}>
              {row?.precip_mm == null ? '—' : `${formatNumber(row.precip_mm, locale, 0)}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function SourceLine({
  label, source, license, fetched, url, period, scope, locale, t,
}: {
  label: string
  source: string | null
  license: string | null
  fetched: string | null
  url?: string | null
  period?: string | null
  scope?: string | null
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const when = fetched ? new Date(fetched).toLocaleString(locale) : null
  return (
    <li className="text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {scope && ` · ${scope}`}
      {' · '}
      {url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>{source}</a> : source}
      {license && ` · ${license}`}
      {period && ` · ${period}`}
      {when && ` · ${t('cities.fetched', { date: when })}`}
    </li>
  )
}
