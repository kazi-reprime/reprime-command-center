import type { ReactNode } from 'react'
import CockpitShell from '@/components/cockpit/CockpitShell'

export default function CockpitLayout({ children }: { children: ReactNode }) {
  return <CockpitShell>{children}</CockpitShell>
}
