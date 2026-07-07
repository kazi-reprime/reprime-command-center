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
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between border-b border-slate-50">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-500" />
          {title}
        </h3>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 border-b border-slate-100 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr key={keyExtractor(item)} className="group hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
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
