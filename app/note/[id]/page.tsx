'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { marked } from "marked";
import { markedKatex } from "marked-katex-extension";

interface Note {
  _id: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  status: string;
}

export default function NotePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configure marked with KaTeX extension
    marked.use(markedKatex({
      throwOnError: false,
      output: 'html'
    }));

    const initPage = async () => {
      if (isLoaded && !isSignedIn) {
        router.push('/');
        return;
      }

      if (isLoaded && isSignedIn) {
        fetchNote();
      }
    };

    initPage();
  }, [isLoaded, isSignedIn]);

  const fetchNote = async () => {
    try {
      const { id } = await params;
      const response = await fetch(`/api/notes/${id}`);
      if (response.ok) {
        const data = await response.json();
        setNote(data);
      } else if (response.status === 404) {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to fetch note:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async () => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const { id } = await params;
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  if (!note) {
    return (
      <div className="container">
        <div className="card">
          <p>Note not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => router.back()} className="btn btn-secondary">
          ← Back
        </button>
        <button onClick={deleteNote} className="btn btn-danger">
          Delete Note
        </button>
      </div>

      <div className="card">
        <header style={{ marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '10px' }}>
            {note.title}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '10px' }}>
            {note.description}
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Created on {formatDate(note.createdAt)}
          </p>
        </header>

        {note.status === 'processing' ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>This note is still being processed. Please check back in a few minutes.</p>
          </div>
        ) : (
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: marked(note.content) }}
          />
        )}
      </div>
    </div>
  );
}
