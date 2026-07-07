'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { StatCard, Card, StatusBadge } from '@/components/ui/shared'
import { DataSourceBanner, LoadingState } from '@/components/ui/LiveStatus'
import { PremiumChart } from '@/components/ui/PremiumChart'
import { PremiumTable } from '@/components/ui/PremiumTable'
import { useCockpitQuery } from '@/hooks/useCockpitData'
import { 
  Activity, ArrowRight, Calendar, CheckSquare, MessageSquare, 
  TrendingUp, AlertCircle, Phone, FileText, Briefcase, Mail
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
  const statsQ = useCockpitQuery<PortalStats>('portal-stats', '/api/cockpit/portal-stats')
  const dealsQ = useCockpitQuery<Deal[]>('deals', '/api/deals')
  const tasksQ = useCockpitQuery<Task[]>('tasks', '/api/cockpit/tasks')

  const stats = statsQ.data?.data
  const deals = Array.isArray(dealsQ.data) ? dealsQ.data : (dealsQ.data?.data ?? [])
  const tasks = tasksQ.data?.data ?? []
  const dataSource = statsQ.data?.source ?? 'unavailable'
  const dataWarning = statsQ.data?.warning

  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`
  const priorities = tasks.filter((t: Task) => t.status !== 'done').sort((a: Task, b: Task) => a.priority - b.priority).slice(0, 4)
  const recentDeals = deals.slice(0, 4)

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
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden group border-l-4 border-l-blue-500">
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-gradient-to-tl from-blue-500/10 to-purple-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
              
              <div className="flex justify-between items-start relative z-10 mb-8">
                <div>
                  <h2 className="text-xs font-black tracking-widest text-blue-600 uppercase mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    APEX NOW
                  </h2>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight max-w-lg">
                    Review Due Diligence for "Project Orion" Acquisition.
                  </h3>
                </div>
                <button className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 flex items-center gap-2">
                  Execute
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="p-4 rounded-2xl bg-white/50 border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Deadline</div>
                  <div className="text-sm font-semibold text-slate-800">Today, 2:00 PM</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/50 border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Context</div>
                  <div className="text-sm font-semibold text-slate-800">Legal Review</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/50 border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</div>
                  <div className="text-sm font-semibold text-slate-800">$12.5M</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/50 border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Assignee</div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">G</div>
                    <div className="text-sm font-semibold text-slate-800">Gideon</div>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Pipeline Value" value={fmt(stats?.pipelineValue ?? 0)} color="#3b82f6" icon={<TrendingUp className="w-5 h-5" />} change={12} changeLabel="vs last month" />
              <StatCard label="Active Deals" value={stats?.pipelineDeals ?? 0} color="#a855f7" icon={<Briefcase className="w-5 h-5" />} />
              <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} color="#10b981" icon={<Activity className="w-5 h-5" />} />
              <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} color="#f59e0b" icon={<MessageSquare className="w-5 h-5" />} change={5} />
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
                      <Link href={`/cockpit/pipeline/${d.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition-colors">{d.name}</Link>
                      {d.address && <div className="text-xs font-semibold text-slate-500 mt-0.5">{d.address}</div>}
                    </div>
                  )
                },
                {
                  header: "Status",
                  accessor: (d) => (
                    <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-100">
                      {d.status || 'Active'}
                    </span>
                  )
                },
                {
                  header: "Value",
                  className: "text-right",
                  accessor: (d) => (
                    <span className="font-black text-slate-900">
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
            <Card title="Today's Protocol" action={<Link href="/cockpit/tasks" className="text-xs font-bold text-blue-500 hover:text-blue-600 tracking-wider">TASKS</Link>}>
              <div className="flex flex-col gap-3">
                {priorities.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm font-semibold">No pending actions required.</div>
                ) : priorities.map((task: Task) => (
                  <div key={task.id} className="flex gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden group hover:border-slate-300 transition-colors">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.priority === 1 ? 'bg-red-500' : task.priority === 2 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div className="flex-1 pl-1">
                      <div className="font-bold text-slate-900 text-sm mb-1">{task.title}</div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                <Link href="/cockpit/comms" className="p-4 rounded-2xl bg-green-50 hover:bg-green-100 border border-green-100 transition-colors flex flex-col items-center justify-center text-center gap-2">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                  <div className="font-bold text-green-900 text-sm">3 Unread</div>
                  <div className="text-[10px] font-bold text-green-600/70 uppercase tracking-widest">WhatsApp</div>
                </Link>
                <Link href="/cockpit/email" className="p-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors flex flex-col items-center justify-center text-center gap-2">
                  <Mail className="w-6 h-6 text-red-600" />
                  <div className="font-bold text-red-900 text-sm">12 New</div>
                  <div className="text-[10px] font-bold text-red-600/70 uppercase tracking-widest">Gmail</div>
                </Link>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Urgent Follow-ups</div>
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">2</span>
                </div>
                <div className="text-sm font-semibold text-slate-800">Investments Team • Term Sheet</div>
              </div>
            </Card>

            {/* SYSTEM HEALTH */}
            <Card title="System Integrity">
              <div className="flex flex-col gap-3">
                {(stats?.needsAttention ?? 0) > 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-xs font-bold text-red-700 uppercase tracking-widest">{stats?.needsAttention} Interruptions</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Systems Operational</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Nora AI', status: 'Idle', color: 'text-blue-500', bg: 'bg-slate-50' },
                    { label: 'WhatsApp', status: 'Live', color: 'text-emerald-500', bg: 'bg-slate-50' },
                    { label: 'Gmail', status: 'Live', color: 'text-emerald-500', bg: 'bg-slate-50' },
                    { label: 'Database', status: 'Live', color: 'text-emerald-500', bg: 'bg-slate-50' },
                  ].map(sys => (
                    <div key={sys.label} className={`px-3 py-2 rounded-xl ${sys.bg} border border-slate-100 flex items-center justify-between`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{sys.label}</span>
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
