'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import RestaurantModal from '@/components/RestaurantModal'
import { Restaurant } from '@/types'

// Load SpinWheel client-side only (uses canvas)
const SpinWheel = dynamic(() => import('@/components/SpinWheel'), { ssr: false })

// ── Helpers ────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Best-effort check: return false only if we can clearly determine the place is closed. */
function isLikelyOpen(tags: Record<string, string>): boolean {
  const oh = tags['opening_hours']
  if (!oh) return true
  if (oh === '24/7') return true
  const lower = oh.toLowerCase()
  if (lower === 'closed' || lower === 'off') return false

  const now = new Date()
  const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const today = dayOrder[now.getDay() === 0 ? 6 : now.getDay() - 1]
  const todayIdx = dayOrder.indexOf(today)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const dayInRange = (spec: string): boolean => {
    const parts = spec.trim().split(',')
    for (const part of parts) {
      const sides = part.trim().split('-')
      if (sides.length === 2) {
        const si = dayOrder.indexOf(sides[0].trim())
        const ei = dayOrder.indexOf(sides[1].trim())
        if (si !== -1 && ei !== -1) {
          if (si <= ei ? todayIdx >= si && todayIdx <= ei : todayIdx >= si || todayIdx <= ei)
            return true
        }
      } else if (dayOrder.indexOf(part.trim()) === todayIdx) {
        return true
      }
    }
    return false
  }

  for (const rule of oh.split(';')) {
    const r = rule.trim()
    // "DAYS off"
    const offM = r.match(/^([A-Za-z,\s\-]+)\s+off$/i)
    if (offM && dayInRange(offM[1])) return false
    // "DAYS HH:MM-HH:MM"
    const timeM = r.match(/^([A-Za-z,\s\-]+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/)
    if (timeM && dayInRange(timeM[1])) {
      const open = parseTime(timeM[2])
      const close = parseTime(timeM[3])
      return close < open
        ? nowMin >= open || nowMin < close
        : nowMin >= open && nowMin < close
    }
  }
  return true // can't determine → include
}

// ── Config ─────────────────────────────────────────────────────────────────

type PlaceType = 'food' | 'drink'

const PLACE_TYPES: { value: PlaceType; label: string; emoji: string; amenities: string[] }[] = [
  {
    value: 'food',
    label: 'Quán ăn',
    emoji: '🍜',
    amenities: ['restaurant', 'fast_food', 'food_court', 'bakery'],
  },
  {
    value: 'drink',
    label: 'Quán nước',
    emoji: '🧋',
    // cafe covers most cafes & trà sữa in OSM Vietnam; bubble_tea for explicit tags
    amenities: ['cafe', 'bubble_tea', 'juice_bar', 'ice_cream'],
  },
]

// ── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const [radius, setRadius] = useState(1)
  const [placeType, setPlaceType] = useState<PlaceType>('food')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [totalFound, setTotalFound] = useState(0)
  const allPlacesRef = useRef<Restaurant[]>([])
  const spinWheelKey = useRef(0)

  const search = useCallback(async () => {
    const r = Number(radius)
    if (!r || r < 0.1 || r > 50) {
      setError('Bán kính phải từ 0.1 đến 50 km')
      return
    }
    setLoading(true)
    setError('')
    setRestaurants([])
    setSearched(false)
    setSelected(null)

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Trình duyệt không hỗ trợ định vị GPS'))
          return
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 12000,
          enableHighAccuracy: true,
        })
      })

      const { latitude: lat, longitude: lon } = pos.coords
      setUserLocation({ lat, lon })

      const radiusM = Math.round(r * 1000)
      const cfg = PLACE_TYPES.find((t) => t.value === placeType)!
      const amenityRegex = `^(${cfg.amenities.join('|')})$`

      const query = `[out:json][timeout:30];
(
  node["amenity"~"${amenityRegex}"]["name"](around:${radiusM},${lat},${lon});
  way["amenity"~"${amenityRegex}"]["name"](around:${radiusM},${lat},${lon});
);
out center tags;`

      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
      })

      if (!resp.ok) throw new Error(`Lỗi từ máy chủ Overpass: ${resp.status}`)

      const data = await resp.json()

      const places: Restaurant[] = (data.elements as any[])
        .map((el) => ({
          id: String(el.id),
          name: (el.tags?.name as string) || '',
          lat: (el.lat ?? el.center?.lat) as number,
          lon: (el.lon ?? el.center?.lon) as number,
          tags: (el.tags || {}) as Record<string, string>,
          distance: haversine(lat, lon, el.lat ?? el.center?.lat, el.lon ?? el.center?.lon),
        }))
        .filter((p) => p.name && p.lat && p.lon)
        .filter((p) => isLikelyOpen(p.tags))
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))

      const total = places.length
      allPlacesRef.current = places
      // Show 25 random ones on the wheel (visual only)
      const sample = [...places].sort(() => Math.random() - 0.5).slice(0, 25)

      spinWheelKey.current += 1
      setRestaurants(sample)
      setTotalFound(total)
      setSearched(true)

      if (total === 0) {
        setError(`Không tìm thấy ${cfg.label.toLowerCase()} đang mở trong ${r} km. Thử tăng bán kính lên?`)
      }
    } catch (err: any) {
      if (err.code === 1) setError('Vui lòng cho phép truy cập vị trí trong trình duyệt.')
      else if (err.code === 2) setError('Không thể xác định vị trí. Hãy thử lại.')
      else if (err.code === 3) setError('Xác định vị trí quá thời gian. Hãy thử lại.')
      else setError(err.message || 'Đã xảy ra lỗi không xác định.')
    } finally {
      setLoading(false)
    }
  }, [radius, placeType])

  const handleSpinEnd = useCallback(() => {
    const all = allPlacesRef.current
    const winner = all[Math.floor(Math.random() * all.length)]
    setSelected(winner)
  }, [])

  const currentType = PLACE_TYPES.find((t) => t.value === placeType)!

  return (
    <main className="page">
      <div className="card">
        {/* Header */}
        <div className="header">
          <h1 className="title">🍜 Hôm Nay Ăn Gì?</h1>
          <p className="subtitle">Để số phận quyết định bữa ăn hôm nay!</p>
        </div>

        {/* Search */}
        <div className="search-section">
          <label className="label">Tìm trong bán kính</label>
          <div className="input-row">
            <input
              type="number"
              min={0.1}
              max={50}
              step={0.5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              className="radius-input"
              disabled={loading}
            />
            <span className="unit">km</span>

            <select
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value as PlaceType)}
              className="type-select"
              disabled={loading}
            >
              {PLACE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>

            <button onClick={search} disabled={loading} className="btn-search">
              {loading ? '⏳ Đang tìm…' : '🔍 Tìm'}
            </button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading && (
          <div className="loading-box">
            <div className="loader" />
            <p>Đang xác định vị trí và tìm {currentType.label.toLowerCase()} gần bạn…</p>
          </div>
        )}

        {searched && restaurants.length > 0 && (
          <div className="wheel-section">
            <p className="found-label">
              ✅ Tìm thấy <strong>{totalFound}</strong> {currentType.label.toLowerCase()} đang mở
              {totalFound > 25 && <> — hiển thị <strong>25</strong> ngẫu nhiên trên vòng quay</>}
              {' '}— bấm <strong>Quay ngay!</strong> hoặc click vào vòng quay
            </p>
            <SpinWheel
              key={spinWheelKey.current}
              restaurants={restaurants}
              onSpinEnd={handleSpinEnd}
            />
          </div>
        )}
      </div>

      {selected && (
        <RestaurantModal
          restaurant={selected}
          userLocation={userLocation}
          onClose={() => setSelected(null)}
          onRespin={() => setSelected(null)}
        />
      )}
    </main>
  )
}
