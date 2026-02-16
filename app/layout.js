import './globals.css'

export const metadata = {
  title: 'EU Employment Statistics',
  description: 'Employment data for all 27 EU countries from Eurostat',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
