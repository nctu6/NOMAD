export interface CityScores {
  cost: number | null
  internet: number | null
  safety: number | null
  climate: number | null
  healthcare: number | null
  air: number | null
  things_to_do: number | null
}

export interface CitySummary {
  id: number
  slug: string
  name: string
  country_code: string
  country_name: string | null
  regions: string[]
  lat: number
  lng: number
  population: number | null
  timezone: string | null
  languages: string[]
  english_official: boolean | null
  english_used: boolean | null
  overall_score: number | null
  score_count: number
  scores: CityScores
  typical_temp_c: number | null
  current_month: number
  price_level_ratio: number | null
  download_mbps: number | null
  homicide_per_100k: number | null
  physicians_per_1000: number | null
  pm25: number | null
  pm25_scope: 'city' | 'country' | null
  poi_count: number | null
  comfort_months: number | null
  best_months: number[]
}

export interface CityListResponse {
  cities: CitySummary[]
  total: number
  available: number
  regions: string[]
  scoring: {
    version: number
    categories: string[]
    weights: string
    filters: Record<string, number>
  }
}

export interface CityMetric {
  metric: string
  value: number
  unit: string | null
  source: string
  source_url: string | null
  license: string | null
  fetched_at: string
  period: string | null
  scope: string
  detail: Record<string, unknown> | null
}

export interface ClimateMonth {
  month: number
  temp_mean_c: number | null
  temp_min_c: number | null
  temp_max_c: number | null
  precip_mm: number | null
}

export interface CityDetail extends CitySummary {
  geoname_id: number | null
  geo_name: string | null
  facts_source: string | null
  facts_license: string | null
  facts_fetched_at: string | null
  geo_source: string | null
  geo_license: string | null
  geo_fetched_at: string | null
  upload_mbps: number | null
  latency_ms: number | null
  pm25_country: number | null
  climate_complete: boolean
}

export interface CityDetailResponse {
  city: CityDetail
  metrics: CityMetric[]
  climate: ClimateMonth[]
  climate_meta: {
    source: string | null
    source_url: string | null
    license: string | null
    fetched_at: string | null
    period: string | null
  } | null
  live: {
    temp_c: number
    observed_at: string | null
    source: string
    source_url: string
    license: string
    fetched_at: string
  } | null
  monthly_cost: null
  scoring: CityListResponse['scoring']
}
