'use client';

import React, { useState, useEffect } from 'react';

type SearchResult = {
  id: string;
  type: string;
  source: string;
  snippet: string;
  date: string;
  score: number;
};

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length > 2) {
      setLoading(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setResults(data.results || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-surface/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <span className="text-text-muted mr-3">🔍</span>
          <input
            type="text"
            className="flex-1 bg-transparent border-none text-text-primary focus:outline-none font-mono text-sm placeholder:text-text-muted"
            placeholder="Search memory, deals, messages, or ask Nora..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button onClick={() => setIsOpen(false)} className="text-xs text-text-muted font-mono hover:text-text-primary px-2 py-1 rounded bg-surface ml-2">ESC</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-text-muted text-xs font-mono">Searching memory matrix...</div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 text-[10px] uppercase font-mono text-text-muted mb-1">Semantic Results</div>
              {results.map(r => (
                <div key={r.id} className="p-3 rounded hover:bg-surface cursor-pointer flex gap-3 group transition-colors">
                  <div className="mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-surface-raised text-text-secondary group-hover:text-text-primary transition-colors">{r.source}</span>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">...{r.snippet}...</p>
                    <p className="text-xs text-text-muted font-mono mt-1">{new Date(r.date).toLocaleDateString()} &bull; Match: {Math.round(r.score * 100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : query.trim().length > 2 ? (
            <div className="p-4 text-center text-text-muted text-xs font-mono">No relevant memories found.</div>
          ) : (
            <div className="p-4">
              <div className="text-[10px] uppercase font-mono text-text-muted mb-2">Suggested Actions</div>
              <div className="flex flex-col gap-1">
                {['Create a new deal', 'Summarize today', 'Launch capital campaign', 'View overdue payments'].map(action => (
                  <button key={action} className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface rounded transition-colors flex items-center gap-2">
                    <span className="text-text-muted">&rarr;</span> {action}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
