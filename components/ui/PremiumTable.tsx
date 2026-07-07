/* eslint-disable */
'use client'

import React from 'react'
import Link from 'next/link'
import { Briefcase, ArrowRight } from 'lucide-react'

export interface TableColumn<T> {
  header: string
  accessor: (item: T) => React.ReactNode
  className?: string
}

export interface PremiumTableProps<T> {
  title: string
  data: T[]
  columns: TableColumn<T>[]
  viewAllLink?: string
  emptyMessage?: string
  keyExtractor: (item: T) => string
}

export function PremiumTable<T>({ 
  title, 
  data, 
  columns, 
  viewAllLink, 
  emptyMessage = "No data found.",
  keyExtractor
}: PremiumTableProps<T>) {
  return (
    <div className="rounded-3xl bg-surface border border-border shadow-glass-elevated overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between border-b border-border">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-accent" />
          {title}
        </h3>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted bg-surface-raised/50 border-b border-border ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-semibold text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr key={keyExtractor(item)} className="group hover:bg-surface-hover transition-colors border-b border-border/40 last:border-0">
                  {columns.map((col, j) => (
                    <td key={j} className={`px-6 py-4 ${col.className || ''}`}>
                      {col.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
