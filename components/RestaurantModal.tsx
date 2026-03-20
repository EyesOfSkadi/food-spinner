'use client'

import { Restaurant } from '@/types'

interface Props {
  restaurant: Restaurant
  userLocation: { lat: number; lon: number } | null
  onClose: () => void
  onRespin: () => void
}

export default function RestaurantModal({ restaurant, onClose, onRespin }: Props) {
  const { name, tags, lat, lon, distance } = restaurant

  const formatDistance = (d: number) =>
    d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(2)} km`

  const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']]
    .filter(Boolean)
    .join(', ') || tags['addr:full'] || null

  const phone = tags['contact:phone'] || tags['phone'] || null
  const website = tags['contact:website'] || tags['website'] || null
  const cuisine = tags['cuisine']
    ? tags['cuisine'].replace(/;/g, ' · ').replace(/_/g, ' ')
    : null

  const amenityLabel: Record<string, string> = {
    restaurant: 'Nhà hàng',
    cafe: 'Quán cà phê',
    fast_food: 'Đồ ăn nhanh',
    food_court: 'Khu ăn uống',
    bar: 'Bar',
    pub: 'Pub',
    bakery: 'Tiệm bánh',
    ice_cream: 'Kem',
  }
  const typeLabel = amenityLabel[tags['amenity']] || 'Quán ăn'

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="modal-header">
          <span className="modal-type-badge">{typeLabel}</span>
          <h2 className="modal-name">{name}</h2>
          {distance !== undefined && (
            <span className="distance-badge">📍 {formatDistance(distance)} từ bạn</span>
          )}
        </div>

        <div className="modal-body">
          {cuisine && <InfoRow icon="🍴" label="Ẩm thực" value={cuisine} />}
          {address && <InfoRow icon="🏠" label="Địa chỉ" value={address} />}
          {phone && (
            <div className="info-row">
              <span className="info-icon">📞</span>
              <div>
                <span className="info-label">Điện thoại</span>
                <a href={`tel:${phone}`} className="info-link">
                  {phone}
                </a>
              </div>
            </div>
          )}
          {tags['opening_hours'] ? (
            <InfoRow icon="🕐" label="Giờ mở cửa" value={tags['opening_hours']} />
          ) : (
            <InfoRow icon="🕐" label="Giờ mở cửa" value="Chưa có thông tin" muted />
          )}
          {website && (
            <div className="info-row">
              <span className="info-icon">🌐</span>
              <div>
                <span className="info-label">Website</span>
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                >
                  {website}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-maps">
            🗺️ Xem trên Maps
          </a>
          <a href={dirUrl} target="_blank" rel="noopener noreferrer" className="btn-dir">
            🧭 Chỉ đường
          </a>
        </div>

        <button className="btn-respin" onClick={onRespin}>
          🔄 Quay lại
        </button>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: string
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="info-row">
      <span className="info-icon">{icon}</span>
      <div>
        <span className="info-label">{label}</span>
        <span className={`info-value${muted ? ' muted' : ''}`}>{value}</span>
      </div>
    </div>
  )
}
