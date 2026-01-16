'use client';

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Note {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'processing' | 'completed';
}

interface Progress {
  queueProgress: number;
  processProgress: number;
  status: string;
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{[key: string]: Progress}>({});

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    // Poll progress for processing notes
    const processingNotes = notes.filter(note => note.status === 'processing');
    if (processingNotes.length > 0) {
      const interval = setInterval(() => {
        processingNotes.forEach(note => {
          fetchProgress(note._id);
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [notes]);

  const fetchNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/progress`);
      if (response.ok) {
        const progressData = await response.json();
        setProgress(prev => ({
          ...prev,
          [noteId]: progressData
        }));

        // If completed, refresh notes list
        if (progressData.status === 'completed') {
          fetchNotes();
        }
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setNotes(notes.filter(note => note._id !== id));
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container">
      <SignedOut>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Welcome to terribly made notes app</h2>
          <p style={{ margin: '20px 0', color: '#64748b' }}>
            Sign in to start creating AI-powered notes from your audio recordings.
          </p>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ marginBottom: '30px' }}>
          <Link href="/new" className="btn btn-primary">
            + New Note
          </Link>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '20px' }}>Your Notes</h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#64748b' }}>
                No notes yet. Create your first note by uploading an audio file!
              </p>
            </div>
          ) : (
            <div className="note-list">
              {notes.map((note) => {
                const noteProgress = progress[note._id];

                return (
                  <div key={note._id} className="note-item">
                    <div className="note-content">
                      <h3 className="note-title">
                        {note.status === 'completed' ? (
                          <Link href={`/note/${note._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {note.title}
                          </Link>
                        ) : (
                          note.title
                        )}
                      </h3>

                      {note.status === 'processing' && noteProgress ? (
                        <div style={{ margin: '12px 0' }}>
                          {noteProgress.queueProgress < 100 && (
                            <div style={{ marginBottom: '8px' }}>
                              <div className="progress-label">Queue Position</div>
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${noteProgress.queueProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <div style={{ marginBottom: '8px' }}>
                            <div className="progress-label">Processing Progress</div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${noteProgress.processProgress}%` }}
                              />
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            {noteProgress.status}
                          </p>
                        </div>
                      ) : (
                        <p className="note-description">
                          {note.status === 'processing' ? 'Initializing...' : note.description}
                        </p>
                      )}

                      <p className="note-date">{formatDate(note.createdAt)}</p>
                    </div>
                    <div className="note-actions">
                      {note.status === 'completed' && (
                        <Link href={`/note/${note._id}`} className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 12px' }}>
                          View
                        </Link>
                      )}
                      <button
                        onClick={() => deleteNote(note._id)}
                        className="btn btn-danger"
                        style={{ fontSize: '12px', padding: '8px 12px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
