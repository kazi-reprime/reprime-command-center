import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/server'

// Locked Screen 1 OG Card spec — dashboard/_terminal-design-reference/01_Screen1_OG_Card.html
// 1200×630 native canvas, Brand Navy background, Imperial Gold typography,
// Cinzel TERMINAL wordmark + Playfair Display recipient name + EB Garamond
// "by RePrime" italic. Rendered via @vercel/og ImageResponse at edge.

export const runtime = 'edge'
export const alt = 'Terminal Introduction — RePrime Group'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const NAVY = '#0E3470'
const GOLD = '#FFCC33'
const GOLD_RGBA_85 = 'rgba(255, 204, 51, 0.85)'
const GOLD_RGBA_70 = 'rgba(255, 204, 51, 0.70)'
const GOLD_RGBA_45 = 'rgba(255, 204, 51, 0.45)'

async function fetchFont(family: string, weight: number, italic = false): Promise<ArrayBuffer | null> {
  try {
    const ital = italic ? 'ital,' : ''
    const style = italic ? `1,${weight}` : `${weight}`
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${ital}wght@${style}&display=swap`
    const cssRes = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!cssRes.ok) return null
    const css = await cssRes.text()
    const fontUrlMatch = css.match(/url\((https:\/\/[^)]+\.(?:woff2|woff|ttf|otf))\)/)
    if (!fontUrlMatch) return null
    const fontRes = await fetch(fontUrlMatch[1])
    if (!fontRes.ok) return null
    return await fontRes.arrayBuffer()
  } catch {
    return null
  }
}

export default async function OGImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Fetch recipient name from invitation row
  let displayName = 'Guest'
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('invitations')
      .select('contact_first_name, contact_name')
      .eq('id', token)
      .maybeSingle()
    if (data) {
      displayName = data.contact_name || data.contact_first_name || 'Guest'
    }
  } catch {
    // fall through with 'Guest'
  }

  // Load brand fonts in parallel. Use Mozilla UA so Google Fonts returns TTF
  // (Satori in @vercel/og doesn't support WOFF2).
  // Captain 2026-05-24: added Playfair Display Italic 400 because the bumped
  // "By Invitation Only" + "Private Membership" labels render in italic per
  // the locked Screen 1 spec.
  const [cinzelBuf, playfairBuf, playfairItalicBuf, ebGaramondBuf, poppinsBuf] = await Promise.all([
    fetchFont('Cinzel', 600),
    fetchFont('Playfair Display', 700),
    fetchFont('Playfair Display', 400, true),
    fetchFont('EB Garamond', 400, true),
    fetchFont('Poppins', 600),
  ])

  // Adaptive sizing — long names shrink so they fit on one line
  const nameLength = displayName.length
  const nameFontSize = nameLength > 22 ? 88 : nameLength > 16 ? 112 : nameLength > 11 ? 124 : 140

  const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style?: 'normal' | 'italic' }> = []
  if (cinzelBuf) fonts.push({ name: 'Cinzel', data: cinzelBuf, weight: 600, style: 'normal' })
  if (playfairBuf) fonts.push({ name: 'Playfair Display', data: playfairBuf, weight: 700, style: 'normal' })
  if (playfairItalicBuf) fonts.push({ name: 'Playfair Display', data: playfairItalicBuf, weight: 400, style: 'italic' })
  if (ebGaramondBuf) fonts.push({ name: 'EB Garamond', data: ebGaramondBuf, weight: 400, style: 'italic' })
  if (poppinsBuf) fonts.push({ name: 'Poppins', data: poppinsBuf, weight: 600, style: 'normal' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: NAVY,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px 80px',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        {/* TOP: TERMINAL wordmark with spindle accents */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Top spindle */}
          <div
            style={{
              width: '780px',
              height: '2px',
              background: `linear-gradient(90deg, rgba(255,204,51,0) 0%, ${GOLD} 6%, ${GOLD} 94%, rgba(255,204,51,0) 100%)`,
              display: 'flex',
            }}
          />
          {/* TERMINAL — Cinzel SemiBold per logo spec */}
          <div
            style={{
              fontFamily: 'Cinzel, Georgia, serif',
              fontWeight: 600,
              fontSize: '70px',
              color: GOLD,
              letterSpacing: '10px',
              textTransform: 'uppercase',
              margin: '14px 0',
              display: 'flex',
            }}
          >
            TERMINAL
          </div>
          {/* Bottom spindle */}
          <div
            style={{
              width: '780px',
              height: '2px',
              background: `linear-gradient(90deg, rgba(255,204,51,0) 0%, ${GOLD} 6%, ${GOLD} 94%, rgba(255,204,51,0) 100%)`,
              display: 'flex',
            }}
          />
          {/* by RePrime — bumped to 48px so it stays readable when WhatsApp
              scales the 1200x630 PNG down to ~350px wide. */}
          <div
            style={{
              fontFamily: 'EB Garamond, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '48px',
              color: GOLD,
              marginTop: '14px',
              display: 'flex',
            }}
          >
            by RePrime
          </div>
        </div>

        {/* MIDDLE: Recipient name in Playfair Display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Private Introduction label — bumped from 16px Poppins → 40px Poppins
              so it survives WhatsApp's downscale. Letter-spacing kept tight. */}
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '40px',
              letterSpacing: '6px',
              color: GOLD,
              textTransform: 'uppercase',
              marginBottom: '32px',
              display: 'flex',
            }}
          >
            Private Introduction
          </div>
          {/* Name */}
          <div
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontWeight: 700,
              fontSize: `${nameFontSize}px`,
              color: GOLD,
              lineHeight: 1.0,
              letterSpacing: '-1.5px',
              textAlign: 'center',
              maxWidth: '1040px',
              display: 'flex',
            }}
          >
            {displayName}
          </div>
        </div>

        {/* BOTTOM: Private Membership · By Invitation Only — bumped to the
            locked-spec sizes (38-50px Playfair Italic) so labels are readable
            in WhatsApp's compressed preview render. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '50px',
              color: GOLD,
              marginBottom: '14px',
              display: 'flex',
            }}
          >
            By Invitation Only
          </div>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: GOLD,
              marginBottom: '14px',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '38px',
              color: GOLD,
              display: 'flex',
            }}
          >
            Private Membership
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length > 0 ? fonts : undefined,
      // Captain hotfix 2026-05-20: cache the rendered OG card at Vercel's
      // edge for 24 hours, with stale-while-revalidate up to 30 days. First
      // fetch (~2-4s cold render: font fetch + Satori) primes the cache;
      // subsequent fetches return instantly. WhatsApp's link preview fetcher
      // gets a fast response on send, so the gold card actually shows up
      // in the chat instead of being skipped on a timeout.
      headers: {
        'Cache-Control': 'public, immutable, no-transform, s-maxage=86400, stale-while-revalidate=2592000',
      },
    }
  )
}
