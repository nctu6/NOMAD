import React, { useState, useEffect } from 'react'
import { mapsApi } from '../../api/client'
import { getCategoryIcon } from './categoryIcons'
import type { Place } from '../../types'

interface Category {
  color?: string
  icon?: string
}

interface PlaceAvatarProps {
  place: Pick<Place, 'id' | 'name' | 'image_url' | 'google_place_id'>
  size?: number
  category?: Category | null
}

const googlePhotoCache = new Map<string, string>()

export default function PlaceAvatar({ place, size = 32, category }: PlaceAvatarProps) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(place.image_url || null)

  useEffect(() => {
    if (place.image_url) { setPhotoSrc(place.image_url); return }
    if (!place.google_place_id) { setPhotoSrc(null); return }

    if (googlePhotoCache.has(place.google_place_id)) {
      setPhotoSrc(googlePhotoCache.get(place.google_place_id)!)
      return
    }

    mapsApi.placePhoto(place.google_place_id)
      .then((data: { photoUrl?: string }) => {
        if (data.photoUrl) {
          googlePhotoCache.set(place.google_place_id!, data.photoUrl)
          setPhotoSrc(data.photoUrl)
        }
      })
      .catch(() => {})
  }, [place.id, place.image_url, place.google_place_id])

  const bgColor = category?.color || '#6366f1'
  const IconComp = getCategoryIcon(category?.icon)
  const iconSize = Math.round(size * 0.46)

  const containerStyle: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: bgColor,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (photoSrc) {
    return (
      <div style={containerStyle}>
        <img
          src={photoSrc}
          alt={place.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setPhotoSrc(null)}
        />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <IconComp size={iconSize} strokeWidth={1.8} color="rgba(255,255,255,0.92)" />
    </div>
  )
}
