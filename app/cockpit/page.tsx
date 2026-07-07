'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatCard, Card } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { PremiumChart } from '@/components/ui/PremiumChart'
import { PremiumTable } from '@/components/ui/PremiumTable'
import { useCockpitQuery } from '@/hooks/useCockpitData'
import { 
  Activity, ArrowRight, Calendar, CheckSquare, MessageSquare, 
  TrendingUp, AlertCircle, Briefcase, Mail
} from 'lucide-react'

interface PortalStats {
  listingsCount: number; brokersCount: number;
  activeCampaigns: number; totalCampaigns: number;
  emailsSent: number; replyRate: number;
  activeAutomations: number; needsAttention: number;
  pipelineDeals: number; pipelineValue: number;
  topScoreCount: number;
}

interface Deal { id: string; name: string; address?: string; purchasePrice?: number; status?: string }
interface Task { id: string; title: string; priority: number; status: string; dueDate?: string; projectTag?: string; assignee?: string }

export default function CockpitDashboard() {
  const router = useRouter()
  const statsQ = useCockpitQuery<PortalStats>('portal-stats', '/api/cockpit/portal-stats')
  const dealsQ = useCockpitQuery<Deal[]>('deals', '/api/deals')
  const tasksQ = useCockpitQuery<Task[]>('tasks', '/api/cockpit/tasks')
  const healthQ = useCockpitQuery<any>('system-health', '/api/health')

  const stats = statsQ.data?.data
  const deals = Array.isArray(dealsQ.data) ? dealsQ.data : (dealsQ.data?.data ?? [])
  const tasks = tasksQ.data?.data ?? []
  const dataSource = statsQ.data?.source ?? 'unavailable'
  const dataWarning = statsQ.data?.warning
  const healthData = healthQ.data

  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`
  const priorities = tasks.filter((t: Task) => t.status !== 'done').sort((a: Task, b: Task) => a.priority - b.priority).slice(0, 4)
  const recentDeals = deals.slice(0, 4)
  const topDeal = recentDeals[0] ?? null

  // Derive system health from /api/health response
  const systemServices = (() => {
    if (!healthData) return [
      { label: 'Nora AI', status: 'Checking...', color: 'text-text-muted', bg: 'bg-surface-raised' },
      { label: 'WhatsApp', status: 'Checking...', color: 'text-text-muted', bg: 'bg-surface-raised' },
      { label: 'Gmail', status: 'Checking...', color: 'text-text-muted', bg: 'bg-surface-raised' },
      { label: 'Database', status: 'Checking...', color: 'text-text-muted', bg: 'bg-surface-raised' },
    ]

    const getStatus = (label: string, isOk: boolean) => ({
      label,
      status: isOk ? 'Live' : 'Error',
      color: isOk ? 'text-success' : 'text-error',
      bg: 'bg-surface-raised'
    })

    return [
      getStatus('Nora AI', !!healthData.env?.ANTHROPIC_API_KEY),
      getStatus('WhatsApp', healthData.adapters?.whatsapp?.isConfigured),
      getStatus('Gmail', !!healthData.env?.GOOGLE_REFRESH_TOKEN),
      getStatus('Database', healthData.db?.reachable),
    ]
  })()

  const isLoading = statsQ.isLoading

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <DataSourceBanner source={dataSource} warning={dataWarning} />

      {isLoading ? (
        <div className="h-[60vh] flex items-center justify-center">
          <LoadingState message="Synchronizing AI Operating System..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Main Focus & Deals (8 cols) */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            
            {/* APEX NOW CARD */}
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden group border-l-4 border-l-accent">
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-gradient-to-tl from-accent/10 to-info/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
              
              <div className="flex justify-between items-start relative z-10 mb-8">
                <div>
                  <h2 className="text-xs font-black tracking-widest text-accent uppercase mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    APEX NOW
                  </h2>
                  <h3 className="text-3xl font-black text-text-primary tracking-tight leading-tight max-w-lg">
                    {topDeal ? `Review ${topDeal.name}` : priorities.length > 0 ? priorities[0].title : 'All Clear — No Urgent Actions'}
                  </h3>
                </div>
                <button 
                  onClick={() => topDeal ? router.push(`/cockpit/pipeline`) : router.push('/cockpit/tasks')}
                  className="h-12 px-6 rounded-2xl bg-accent hover:bg-accent-hover text-accent-foreground font-bold tracking-wide transition-all shadow-lg flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Execute
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="p-4 rounded-2xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Top Deal</div>
                  <div className="text-sm font-semibold text-text-primary">{topDeal?.name || 'None'}</div>
                </div>
                <div className="p-4 rounded-2xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Status</div>
                  <div className="text-sm font-semibold text-text-primary">{topDeal?.status || 'N/A'}</div>
                </div>
                <div className="p-4 rounded-2xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Value</div>
                  <div className="text-sm font-semibold text-text-primary">{topDeal?.purchasePrice ? fmt(topDeal.purchasePrice) : 'TBD'}</div>
                </div>
                <div className="p-4 rounded-2xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Tasks</div>
                  <div className="text-sm font-semibold text-text-primary">{priorities.length} Pending</div>
                </div>
              </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Pipeline Value" value={fmt(stats?.pipelineValue ?? 0)} color="var(--chart-1)" icon={<TrendingUp className="w-5 h-5" />} change={12} changeLabel="vs last month" />
              <StatCard label="Active Deals" value={stats?.pipelineDeals ?? 0} color="var(--chart-2)" icon={<Briefcase className="w-5 h-5" />} />
              <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} color="var(--chart-3)" icon={<Activity className="w-5 h-5" />} />
              <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} color="var(--chart-4)" icon={<MessageSquare className="w-5 h-5" />} change={5} />
            </div>

            {/* PREMIUM ANALYTICS CHART */}
            <PremiumChart title="Portfolio Velocity & Revenue Pipeline" />

            {/* DEAL PIPELINE TABLE */}
            <PremiumTable 
              title="Deal Intelligence" 
              viewAllLink="/cockpit/pipeline"
              data={recentDeals}
              keyExtractor={(d) => d.id}
              emptyMessage="No active deals found."
              columns={[
                {
                  header: "Asset",
                  accessor: (d) => (
                    <div>
                      <Link href={`/cockpit/pipeline/${d.id}`} className="font-bold text-text-primary hover:text-accent transition-colors">{d.name}</Link>
                      {d.address && <div className="text-xs font-semibold text-text-muted mt-0.5">{d.address}</div>}
                    </div>
                  )
                },
                {
                  header: "Status",
                  accessor: (d) => (
                    <span className="px-2 py-1 rounded-md bg-warning/10 text-warning text-[9px] font-black uppercase tracking-widest border border-warning/20">
                      {d.status || 'Active'}
                    </span>
                  )
                },
                {
                  header: "Value",
                  className: "text-right",
                  accessor: (d) => (
                    <span className="font-black text-text-primary">
                      {d.purchasePrice ? fmt(d.purchasePrice) : 'TBD'}
                    </span>
                  )
                }
              ]}
            />

          </div>

          {/* RIGHT COLUMN: Today, Comms, Intelligence (4 cols) */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* TODAY / TASKS */}
            <Card title="Today's Protocol" action={<Link href="/cockpit/tasks" className="text-xs font-bold text-accent hover:text-accent-hover tracking-wider">TASKS</Link>}>
              <div className="flex flex-col gap-3">
                {priorities.length === 0 ? (
                  <div className="py-8 text-center text-text-muted text-sm font-semibold">No pending actions required.</div>
                ) : priorities.map((task: Task) => (
                  <div key={task.id} className="flex gap-3 p-4 rounded-2xl bg-surface-raised border border-border relative overflow-hidden group hover:border-border-strong transition-colors">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.priority === 1 ? 'bg-error' : task.priority === 2 ? 'bg-warning' : 'bg-accent'}`} />
                    <div className="flex-1 pl-1">
                      <div className="font-bold text-text-primary text-sm mb-1">{task.title}</div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.dueDate || 'ASAP'}</span>
                        <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> {task.projectTag || 'General'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* COMMUNICATIONS INTEL */}
            <Card title="Communications">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Link href="/cockpit/comms" className="p-4 rounded-2xl bg-success/10 hover:bg-success/20 border border-success/20 transition-colors flex flex-col items-center justify-center text-center gap-2">
                  <MessageSquare className="w-6 h-6 text-success" />
                  <div className="font-bold text-success text-sm">WhatsApp</div>
                  <div className="text-[10px] font-bold text-success/70 uppercase tracking-widest">View Threads</div>
                </Link>
                <Link href="/cockpit/email" className="p-4 rounded-2xl bg-error/10 hover:bg-error/20 border border-error/20 transition-colors flex flex-col items-center justify-center text-center gap-2">
                  <Mail className="w-6 h-6 text-error" />
                  <div className="font-bold text-error text-sm">Gmail</div>
                  <div className="text-[10px] font-bold text-error/70 uppercase tracking-widest">View Inbox</div>
                </Link>
              </div>
              <div className="p-4 rounded-2xl bg-surface-raised border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Pending Tasks</div>
                  <span className="w-5 h-5 rounded-full bg-error/10 text-error flex items-center justify-center text-[10px] font-bold">{priorities.length}</span>
                </div>
                <div className="text-sm font-semibold text-text-primary">
                  {priorities.length > 0 ? priorities[0].title : 'No urgent items'}
                </div>
              </div>
            </Card>

            {/* SYSTEM HEALTH */}
            <Card title="System Integrity">
              <div className="flex flex-col gap-3">
                {(stats?.needsAttention ?? 0) > 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-error/10 border border-error/20">
                    <AlertCircle className="w-5 h-5 text-error" />
                    <span className="text-xs font-bold text-error uppercase tracking-widest">{stats?.needsAttention} Interruptions</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-center">
                    <span className="text-xs font-bold text-success uppercase tracking-widest">Systems Operational</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {systemServices.map(sys => (
                    <div key={sys.label} className={`px-3 py-2 rounded-xl ${sys.bg} border border-border flex items-center justify-between`}>
                      <span className="text-[10px] font-bold text-text-muted uppercase">{sys.label}</span>
                      <span className={`text-[10px] font-bold uppercase ${sys.color}`}>{sys.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}
