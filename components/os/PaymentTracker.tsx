'use client';

import React, { useState } from 'react';

type Payment = {
  id: string;
  title: string;
  amount: number;
  payee: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'snoozed';
  dealContext?: string;
};

export default function PaymentTracker() {
  const [payments] = useState<Payment[]>([
    {
      id: '1',
      title: 'Legal Settlement',
      amount: 150000,
      payee: 'Cohen Law Firm Escrow',
      dueDate: 'Tomorrow',
      status: 'pending',
      dealContext: 'Bay Valley Shopping Center'
    },
    {
      id: '2',
      title: 'Q3 Investor Distribution',
      amount: 85000,
      payee: 'Sarah Chen',
      dueDate: 'Today',
      status: 'pending',
      dealContext: 'Downtown Office Plaza'
    },
    {
      id: '3',
      title: 'Vendor Invoice 402',
      amount: 12500,
      payee: 'Apex Roofing LLC',
      dueDate: 'Overdue',
      status: 'overdue'
    }
  ]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'overdue': return 'text-rose-500 bg-rose-500/10';
      case 'pending': return 'text-amber-500 bg-amber-500/10';
      case 'paid': return 'text-emerald-500 bg-emerald-500/10';
      case 'snoozed': return 'text-zinc-400 bg-zinc-800';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-zinc-200 border-r border-zinc-900 overflow-y-auto">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4 z-10">
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
          Payment & Deadline Tracker
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Capital Calls & Obligations
        </p>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {payments.map(payment => (
          <div key={payment.id} className={`border rounded-lg bg-zinc-950 p-4 transition-colors ${
            payment.status === 'overdue' ? 'border-rose-900/50' : 'border-zinc-800'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-white">{payment.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">To: {payment.payee}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-mono font-medium text-white">{formatCurrency(payment.amount)}</div>
                <div className={`mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded inline-block ${getStatusColor(payment.status)}`}>
                  {payment.status} &bull; {payment.dueDate}
                </div>
              </div>
            </div>
            
            {payment.dealContext && (
              <div className="mt-3 text-xs font-mono text-zinc-500 flex items-center gap-2 border-t border-zinc-900 pt-3">
                <span className="bg-zinc-900 px-1.5 py-0.5 rounded">Deal</span> {payment.dealContext}
              </div>
            )}
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Mark Paid
              </button>
              <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 transition-colors">
                Snooze
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
