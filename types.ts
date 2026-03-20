export interface Restaurant {
  id: string
  name: string
  lat: number
  lon: number
  tags: Record<string, string>
  distance?: number
}
