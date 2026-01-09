import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AWS Inventory Dashboard',
  description: 'Enterprise AWS Resource Inventory Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script src="/sw-unregister.js" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Force reload if old cached files detected
            if (window.performance && window.performance.getEntriesByType) {
              const resources = window.performance.getEntriesByType('resource');
              const hasOldCache = resources.some(r => r.name.includes('index-DK8HSD9y'));
              if (hasOldCache) {
                console.warn('⚠️ Old cached files detected! Force reloading...');
                window.location.reload(true);
              }
            }
          `
        }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

