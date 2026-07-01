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
      <div className="flex flex-col h-full space-y-3">
        <div className="flex items-center space-x-2">
          <input 
            type="text" 
            value={editTitle} 
            onChange={e => setEditTitle(e.target.value)} 
            placeholder="Note Title" 
            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#FFCC33]/50" 
          />
        </div>
        <textarea
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          placeholder="Note details..."
          className="flex-1 resize-none bg-black/20 border border-white/10 rounded p-2 text-xs text-gray-300 outline-none focus:border-[#FFCC33]/50"
        />
        <div className="flex justify-end space-x-2">
          <button 
            onClick={() => setActiveNote(null)} 
            className="text-xs px-3 py-1 rounded bg-white/5 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="text-xs px-3 py-1 rounded bg-[#FFCC33]/20 text-[#FFCC33] hover:bg-[#FFCC33]/30 flex items-center space-x-1"
          >
            <Save className="h-3 w-3" />
            <span>Save</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-gray-400 font-semibold uppercase">Your Notes</span>
        <button 
          onClick={() => {
            setActiveNote({ id: 'new', title: '', body: '', is_pinned: false, updated_at: '' });
            setEditTitle('');
            setEditBody('');
          }}
          className="p-1 text-[#FFCC33] hover:bg-[#FFCC33]/10 rounded transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin text-[#FFCC33]" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center p-4 text-xs text-gray-500">
            No notes yet.
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
              className="p-2.5 bg-[#08224d] border border-white/5 rounded-lg cursor-pointer hover:border-[#FFCC33]/30 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-white line-clamp-1">{note.title}</span>
                <button 
                  onClick={(e) => handleDelete(note.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{note.body || 'No details'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
