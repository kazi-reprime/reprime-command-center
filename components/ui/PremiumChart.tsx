'use client'

import React, { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

// Sample/placeholder chart data — no real API backs this yet.
// Replace with live data once an analytics endpoint is available.
const data = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 4500 },
  { name: 'May', value: 6000 },
  { name: 'Jun', value: 5500 },
  { name: 'Jul', value: 7000 },
]

export function PremiumChart({ title = "Growth Metrics" }: { title?: string }) {
  const [timeRange, setTimeRange] = useState('last7')

  return (
    <div className="p-5 rounded-3xl bg-surface border border-border shadow-glass-elevated">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-surface-raised border border-border text-text-secondary text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <option value="last7">Last 7 Months</option>
          <option value="ytd">Year to Date</option>
        </select>
      </div>
      
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} 
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-raised)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--text-primary)'
              }}
              itemStyle={{ color: 'var(--chart-1)', fontWeight: 900 }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="var(--chart-1)" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--chart-1)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
