import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyGroup } from '@/lib/center/notify'

export const dynamic = 'force-dynamic'

// Tracked video link. The WhatsApp + email invites point here instead of at
// YouTube directly, so a click is a real human watch (nothing pre-follows a
// /v/ redirect — unlike the invite link, which preview bots and email
// prefetch hit on their own). We log the click, nudge the group on the FIRST
// watch per person, then 302 straight to the video.
const VIDEO = 'https://youtu.be/1tFycgsst1c'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('invitations')
      .select('contact_name, contact_first_name, first_video_at, video_click_count')
      .eq('id', token)
      .maybeSingle()
    if (data) {
      const first = !data.first_video_at
      await supabase.from('invitations').update({
        video_click_count: (data.video_click_count ?? 0) + 1,
        first_video_at: data.first_video_at ?? new Date().toISOString(),
      }).eq('id', token)
      if (first) {
        const name = data.contact_name || data.contact_first_name || 'Someone'
        void notifyGroup(`▶️ ${name} just watched the video.`)
      }
    }
  } catch { /* never block the redirect on a tracking hiccup */ }
  return NextResponse.redirect(VIDEO, 302)
}
