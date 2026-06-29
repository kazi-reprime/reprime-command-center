import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in — RePrime Command Center',
  description: 'Authorized access for g@reprime.com.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'RePrime Command Center',
    description: 'Authorized access for g@reprime.com.',
    type: 'website',
    siteName: 'RePrime Command Center',
    images: [
      {
        url: '/icon.svg',
        width: 1024,
        height: 1024,
        alt: 'RePrime Terminal',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'RePrime Command Center',
    description: 'Authorized access for g@reprime.com.',
    images: ['/icon.svg'],
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
