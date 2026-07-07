'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  updated_at: string;
}

export default function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (e) {
      console.error('Failed to fetch notes', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    try {
      if (activeNote && activeNote.id !== 'new') {
        // Update
        const res = await fetch('/api/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeNote.id, title: editTitle, body: editBody })
        });
        if (res.ok) fetchNotes();
      } else {
        // Create
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editTitle, body: editBody })
        });
        if (res.ok) fetchNotes();
      }
      setActiveNote(null);
    } catch (e) {
      console.error('Failed to save note', e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchNotes();
      if (activeNote?.id === id) setActiveNote(null);
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  if (activeNote) {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" style={{ fontFamily: 'inherit' }}>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={editTitle} 
            onChange={e => setEditTitle(e.target.value)} 
            placeholder="Note Title" 
            className="flex-1 bg-surface-raised border border-border/50 rounded-xl px-4 py-2.5 text-sm font-black text-text-primary outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-text-muted" 
          />
        </div>
        <textarea
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          placeholder="Start writing..."
          className="flex-1 resize-none bg-surface-raised border border-border/50 rounded-[20px] p-4 text-sm font-medium text-text-secondary outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-text-muted leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => setActiveNote(null)} 
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-secondary hover:bg-surface-raised transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-5 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-black uppercase tracking-wider hover:bg-accent transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Note</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'inherit' }}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-accent">
            <Plus className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-black text-text-primary uppercase tracking-widest">Your Notes</h2>
        </div>
        <button 
          onClick={() => {
            setActiveNote({ id: 'new', title: '', body: '', is_pinned: false, updated_at: '' });
            setEditTitle('');
            setEditBody('');
          }}
          className="w-8 h-8 flex items-center justify-center bg-surface-raised hover:bg-indigo-500 hover:text-text-primary text-accent rounded-xl transition-all duration-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-text-muted" />
            </div>
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Archive Empty</span>
          </div>
        ) : (
          notes.map(note => (
            <div 
              key={note.id} 
              onClick={() => {
                setActiveNote(note);
                setEditTitle(note.title);
                setEditBody(note.body);
              }}
              className="group p-4 bg-surface-raised border border-border/50 rounded-2xl hover:bg-surface hover:border-indigo-500/20 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer"
            >
              <div className="flex justify-between items-start gap-3">
                <span className="text-xs font-black text-text-primary line-clamp-1 flex-1 tracking-tight">{note.title}</span>
                <button 
                  onClick={(e) => handleDelete(note.id, e)}
                  className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-all rounded-lg"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[11px] font-medium text-text-secondary mt-1 line-clamp-2 leading-relaxed">{note.body || 'No description provided'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
