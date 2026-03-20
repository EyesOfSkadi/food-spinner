import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hôm Nay Ăn Gì? 🍜',
  description: 'Quay ngẫu nhiên để chọn quán ăn gần bạn',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
