'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { ThemeProvider } from 'next-themes'
import { useSharedRealtime } from '@/hooks/useSharedRealtime'

/**
 * SharedRealtimeMount — mounts the shared realtime hook at the provider level.
 * This ensures a single Supabase subscription and notification poll loop
 * runs for the entire app, feeding both /center and /cockpit experiences.
 */
function SharedRealtimeMount({ children }: { children: React.ReactNode }) {
  useSharedRealtime()
  return <>{children}</>
}

import GlobalNoraManager from './nora/GlobalNoraManager'
import NoraOverlay from './nora/NoraOverlay'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      themes={['light', 'midnight', 'aurora', 'high-contrast', 'slate']}
      storageKey="reprime-theme"
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={client}>
        <GlobalNoraManager />
        <NoraOverlay />
        <ToastProvider>
          <SharedRealtimeMount>
            {children}
          </SharedRealtimeMount>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

