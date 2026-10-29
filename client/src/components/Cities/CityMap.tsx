import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { scoreColor } from './format'
import type { CitySummary } from './types'

function markerIcon(score: number | null, selected = false): L.DivIcon {
  const size = selected ? 36 : 28
  const background = score == null ? 'var(--bg-tertiary)' : scoreColor(score)
  const color = score == null ? 'var(--text-muted)' : '#ffffff'
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${background};color:${color};font-size:${selected ? 12 : 10}px;font-weight:800;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:-apple-system,system-ui,sans-serif;">${score == null ? '–' : score}</div>`,
  })
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const signature = points.map(point => `${point[0].toFixed(4)},${point[1].toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 6)
      return
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 5 })
    // signature is the coordinate list; points is the matching array from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature])
  return null
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 80)
    return () => window.clearTimeout(timer)
  }, [map])
  return null
}

interface CityMapProps {
  cities: Pick<CitySummary, 'slug' | 'name' | 'lat' | 'lng' | 'overall_score'>[]
  dark: boolean
  selectedSlug?: string
  onSelect?: (slug: string) => void
}

export default function CityMap({ cities, dark, selectedSlug, onSelect }: CityMapProps) {
  const points = cities.map(city => [city.lat, city.lng] as [number, number])
  const focus = points[0] || [20, 0]

  return (
    <MapContainer
      center={focus}
      zoom={points.length === 1 ? 6 : 2}
      className={`w-full h-full${dark ? ' city-map-dark' : ''}`}
      style={{ background: dark ? '#121215' : '#e5e7eb' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <InvalidateSize />
      <FitBounds points={points} />
      {cities.map(city => (
        <Marker
          key={city.slug}
          position={[city.lat, city.lng]}
          icon={markerIcon(city.overall_score, city.slug === selectedSlug)}
          eventHandlers={onSelect ? { click: () => onSelect(city.slug) } : undefined}
        >
          <Tooltip className="map-tooltip" direction="top" offset={[0, -12]}>
            <span style={{ fontWeight: 700 }}>{city.name}</span>
            {city.overall_score != null && <span> · {city.overall_score}</span>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
