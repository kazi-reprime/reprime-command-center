/* eslint-disable */
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { useCockpitQuery } from '@/hooks/useCockpitData'
import { 
  Activity, ArrowRight, Calendar, CheckSquare, MessageSquare, 
  TrendingUp, AlertCircle, Briefcase, Mail, Sparkles, Clock, 
  Zap, Star, ShieldCheck, Coffee, Bell
} from 'lucide-react'

// --- Interfaces for Briefing Data ---
interface BriefingMeeting {
  id: string
  title: string
  startTime: string
  endTime: string
  zoomLink: string | null
}

interface SuggestedFocus {
  id: string
  title: string
  priority: number
  reason?: string
}

interface BriefingData {
  date: string
  jewish_date: string
  hebcal_alert: string | null
  meetings: {
    count: number
    nextUp: BriefingMeeting | null
    items: BriefingMeeting[]
  }
  unread: {
    total: number
    by_panel: { '305': number; '718': number; investors: number }
  }
  suggested_focus: SuggestedFocus[]
  recent_memory: string[]
}

export default function CockpitDashboard() {
  const router = useRouter()
  
  // Data Queries
  const briefingQ = useCockpitQuery<BriefingData>('briefing', '/api/briefing/today')
  const healthQ = useCockpitQuery<any>('system-health', '/api/health')
  const statsQ = useCockpitQuery<any>('portal-stats', '/api/cockpit/portal-stats')

  const briefing = briefingQ.data?.data
  const healthData = healthQ.data
  const stats = statsQ.data?.data

  const isLoading = briefingQ.isLoading
  const dataSource = briefingQ.data?.source ?? 'unavailable'
  const dataWarning = briefingQ.data?.warning

  // Derived health status
  const systemServices = (() => {
    if (!healthData) return []
    const h = healthData?.data || healthData
    const getStatus = (label: string, isOk: boolean) => ({
      label,
      status: isOk ? 'Live' : 'Error',
      color: isOk ? 'text-success' : 'text-error',
    })
    return [
      getStatus('Nora AI', !!(h?.env?.ANTHROPIC_API_KEY || h?.env?.OPENAI_API_KEY)),
      getStatus('WhatsApp', !!(h?.adapters?.whatsapp?.isConfigured)),
      getStatus('Gmail', !!(h?.env?.GOOGLE_REFRESH_TOKEN)),
      getStatus('Database', !!(h?.db?.reachable)),
      getStatus('Zoom', !!(h?.env?.ZOOM_ACCOUNT_ID || h?.adapters?.zoom?.isConfigured)),
    ]
  })()

  if (isLoading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-b-2 border-accent animate-spin" style={{ animationDuration: '1.5s' }} />
          <div className="absolute inset-2 rounded-full border-t-2 border-accent/40 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent animate-pulse" />
          </div>
        </div>
        <LoadingState message="Nora is assembling your intelligence briefing..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      {/* --- HEADER: Date & Morning Alert --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[0.65rem] font-black tracking-[0.3em] text-accent uppercase bg-accent/10 px-2 py-0.5 rounded">
              Command Center v0.3.5
            </span>
            <span className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> {briefing?.date || new Date().toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-4xl font-black text-text-primary tracking-tight">
            Good Morning, <span className="text-accent">Gideon</span>.
          </h1>
        </div>
        
        {briefing?.hebcal_alert && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-warning/5 border border-warning/20 backdrop-blur-md animate-pulse">
            <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
              <Star className="w-4 h-4 fill-warning" />
            </div>
            <div>
              <div className="text-[0.6rem] font-black text-warning/60 uppercase tracking-widest">Shabbat Alert</div>
              <div className="text-sm font-bold text-warning leading-tight">{briefing.hebcal_alert}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT COLUMN: Nora Intelligence (4 cols) --- */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-card-elevated rounded-[2.5rem] p-8 relative overflow-hidden group border border-white/5">
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[80px] opacity-20 bg-accent group-hover:opacity-40 transition-opacity duration-1000" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-[0_0_30px_rgba(255,204,51,0.3)]">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-text-primary tracking-tight">Nora Intelligence</h2>
                <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-[0.15em]">AI Executive Hub</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 relative z-10">
              {/* Suggested Focus */}
              <div className="space-y-3">
                <h3 className="text-[0.6rem] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Zap className="w-3 h-3 text-accent" /> Suggested Focus
                </h3>
                {briefing?.suggested_focus?.map((focus, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-accent/30 transition-all cursor-pointer group/item">
                    <div className="flex justify-between items-start gap-3">
                      <div className="text-sm font-bold text-text-primary group-hover/item:text-accent transition-colors">{focus.title}</div>
                      <span className="text-[0.6rem] font-black text-accent bg-accent/10 px-2 py-0.5 rounded">P{focus.priority}</span>
                    </div>
                    {focus.reason && <div className="text-[0.65rem] font-semibold text-text-muted mt-1 leading-relaxed opacity-60">{focus.reason}</div>}
                  </div>
                ))}
              </div>

              {/* Nora Memory Fragment */}
              <div className="mt-4 p-5 rounded-3xl bg-accent/5 border border-accent/10">
                <div className="text-[0.6rem] font-black text-accent uppercase tracking-widest mb-3">Recent Context</div>
                <div className="text-xs font-semibold text-text-secondary leading-relaxed italic opacity-80">
                  {briefing?.recent_memory?.[0] || "Waiting for Gideon's next command..."}
                </div>
              </div>

              <Link href="/cockpit/tasks" className="btn-primary w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2">
                Manage Tasks <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* --- CENTER COLUMN: Consolidated Comms (5 cols) --- */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="glass-card-elevated rounded-[2.5rem] p-8 relative overflow-hidden border border-white/5 h-full">
            <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full blur-[90px] opacity-15 bg-success group-hover:opacity-25 transition-opacity duration-1000" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <MessageSquare className="w-7 h-7 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-text-primary tracking-tight">Comms Pulse</h2>
                  <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-[0.15em]">Unified Channel Hub</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-success">{briefing?.unread?.total || 0}</div>
                <div className="text-[0.6rem] font-black text-text-muted uppercase tracking-widest">Total Unreads</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 relative z-10">
              {/* WhatsApp Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Link href="/cockpit/comms" className="p-6 rounded-[2rem] bg-success/5 border border-success/10 hover:border-success/30 hover:bg-success/10 transition-all flex flex-col gap-3 group/comm">
                  <div className="flex justify-between items-center">
                    <MessageSquare className="w-5 h-5 text-success group-hover/comm:scale-110 transition-transform" />
                    <span className="text-lg font-black text-success">{briefing?.unread?.by_panel?.['305'] || 0}</span>
                  </div>
                  <div className="text-[0.65rem] font-black text-success/60 uppercase tracking-widest">WhatsApp 305</div>
                </Link>
                <Link href="/cockpit/comms" className="p-6 rounded-[2rem] bg-info/5 border border-info/10 hover:border-info/30 hover:bg-info/10 transition-all flex flex-col gap-3 group/comm">
                  <div className="flex justify-between items-center">
                    <Zap className="w-5 h-5 text-info group-hover/comm:scale-110 transition-transform" />
                    <span className="text-lg font-black text-info">{briefing?.unread?.by_panel?.['718'] || 0}</span>
                  </div>
                  <div className="text-[0.65rem] font-black text-info/60 uppercase tracking-widest">WhatsApp 718</div>
                </Link>
              </div>

              {/* Gmail Inbox Preview */}
              <Link href="/cockpit/email" className="p-6 rounded-[2rem] bg-error/5 border border-error/10 hover:border-error/30 hover:bg-error/10 transition-all group/comm mt-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-error group-hover/comm:scale-110 transition-transform" />
                    <span className="text-sm font-black text-error uppercase tracking-widest">Gmail Priority</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-error opacity-40" />
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-bold text-text-primary line-clamp-1 opacity-80">Loading latest priority emails...</div>
                  <div className="text-[0.6rem] font-semibold text-text-muted line-clamp-1 opacity-60 italic">Your inbox is being triaged by Nora.</div>
                </div>
              </Link>

              {/* Investor Pulse */}
              <Link href="/cockpit/investors" className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 hover:border-accent/30 hover:bg-accent/10 transition-all group/comm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-accent group-hover/comm:scale-110 transition-transform" />
                    <span className="text-sm font-black text-accent uppercase tracking-widest">Investors</span>
                  </div>
                  <span className="text-lg font-black text-accent">{briefing?.unread?.by_panel?.investors || 0}</span>
                </div>
                <p className="text-[0.6rem] font-semibold text-text-muted uppercase tracking-widest">Active Threads Requiring Review</p>
              </Link>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Today's Protocol (3 cols) --- */}
        <div className="lg:col-span-3 flex flex-col gap-8">
          {/* Meetings */}
          <Card title="Today's Protocol" className="rounded-[2.5rem] border-white/5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[0.65rem] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" /> Scheduled
                </div>
                <span className="text-xs font-bold text-accent">{briefing?.meetings?.count || 0} Total</span>
              </div>
              
              {briefing?.meetings?.items?.length === 0 ? (
                <div className="py-8 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <div className="text-2xl mb-2">🌿</div>
                  <div className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">Clear Calendar</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {briefing?.meetings?.items?.slice(0, 5).map((m) => (
                    <div key={m.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all flex flex-col gap-1.5 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                      <div className="text-[0.6rem] font-black text-accent uppercase tracking-widest">
                        {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs font-bold text-text-primary line-clamp-1">{m.title}</div>
                      {m.zoomLink && (
                        <a href={m.zoomLink} target="_blank" className="text-[0.55rem] font-black text-info uppercase tracking-widest hover:text-info-hover mt-1 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> Join Zoom
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* System Health */}
          <div className="glass-card rounded-[2.5rem] p-6 border-white/5 mt-auto">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-5 h-5 text-success" />
              <h3 className="text-[0.65rem] font-black text-text-primary uppercase tracking-[0.2em]">System Integrity</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {systemServices.map(sys => (
                <div key={sys.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest">{sys.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sys.status === 'Live' ? 'bg-success animate-pulse' : 'bg-error'}`} />
                    <span className={`text-[0.6rem] font-black uppercase ${sys.color}`}>{sys.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .glass-card-elevated {
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
          backdrop-filter: blur(40px) saturate(180%);
          box-shadow: 
            0 20px 50px rgba(0,0,0,0.3),
            inset 0 1px 1px rgba(255,255,255,0.1);
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          box-shadow: 0 10px 20px rgba(255,204,51,0.2), inset 0 1px 0 rgba(255,255,255,0.3);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(255,204,51,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  )
}
