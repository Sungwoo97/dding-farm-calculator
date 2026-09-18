import './globals.css'

import { AppShell } from '@/components/app-shell/app-shell'

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><AppShell>{children}</AppShell></body>
    </html>
  )
}
