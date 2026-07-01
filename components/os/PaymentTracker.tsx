'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Check, Clock } from 'lucide-react';

type Payment = {
  id: string;
  title: string;
  amount: number;
  payee: string;
  due_date: string;
  dueDateFormatted: string;
  status: 'pending' | 'paid' | 'overdue' | 'snoozed';
  dealContext?: string;
};

export default function PaymentTracker() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/center/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleUpdateStatus = async (id: string, status: Payment['status']) => {
    try {
      const res = await fetch('/api/center/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setPayments(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      }
    } catch (err) {
      console.error('Failed to update payment status:', err);
    }
  };

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
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs font-mono">
            No active payment obligations.
          </div>
        ) : (
          payments.map(payment => (
            <div key={payment.id} className={`border rounded-lg bg-zinc-950 p-4 transition-colors ${
              payment.status === 'overdue' ? 'border-rose-900/50' : 'border-zinc-800'
            } ${payment.status === 'paid' ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{payment.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">To: {payment.payee}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-mono font-medium text-white">{formatCurrency(payment.amount)}</div>
                  <div className={`mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded inline-block ${getStatusColor(payment.status)}`}>
                    {payment.status} &bull; {payment.dueDateFormatted}
                  </div>
                </div>
              </div>
              
              {payment.dealContext && (
                <div className="mt-3 text-xs font-mono text-zinc-500 flex items-center gap-2 border-t border-zinc-900 pt-3">
                  <span className="bg-zinc-900 px-1.5 py-0.5 rounded">Deal</span> {payment.dealContext}
                </div>
              )}
              
              {payment.status !== 'paid' && (
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => handleUpdateStatus(payment.id, 'paid')}
                    className="flex-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 text-xs py-1.5 rounded border border-emerald-600/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="h-3 w-3" /> Mark Paid
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(payment.id, 'snoozed')}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs py-1.5 rounded text-zinc-300 border border-zinc-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="h-3 w-3" /> Snooze
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
