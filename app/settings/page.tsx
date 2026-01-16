'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface UserClass {
  _id: string;
  name: string;
  description: string;
}

export default function UserSettings() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<UserClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
    } else if (isLoaded && isSignedIn) {
      fetchClasses();
    }
  }, [isLoaded, isSignedIn, router]);

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/user/classes');
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addClass = async () => {
    if (!newClassName.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/user/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClassName.trim(),
          description: newClassDescription.trim(),
        }),
      });

      if (response.ok) {
        setNewClassName('');
        setNewClassDescription('');
        fetchClasses();
      } else {
        alert('Failed to add class');
      }
    } catch (error) {
      console.error('Failed to add class:', error);
      alert('Failed to add class');
    } finally {
      setSaving(false);
    }
  };

  const removeClass = async (classId: string) => {
    if (!confirm('Are you sure you want to remove this class? This will not affect existing notes.')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/classes/${classId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchClasses();
      } else {
        alert('Failed to remove class');
      }
    } catch (error) {
      console.error('Failed to remove class:', error);
      alert('Failed to remove class');
    }
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

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => router.back()} className="btn btn-secondary">
          ← Back
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>User Settings</h2>
        
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>Note Classes</h3>
          <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '14px' }}>
            Define categories for your notes. The AI will automatically classify new notes into these categories.
          </p>

          {/* Add new class form */}
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '15px', fontSize: '16px' }}>Add New Class</h4>
            <div className="form-group">
              <label className="form-label">Class Name</label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g., Meetings, Lectures, Ideas"
                className="form-input"
                maxLength={50}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <input
                type="text"
                value={newClassDescription}
                onChange={(e) => setNewClassDescription(e.target.value)}
                placeholder="Brief description of what this class contains"
                className="form-input"
                maxLength={200}
              />
            </div>
            <button
              onClick={addClass}
              disabled={!newClassName.trim() || saving}
              className="btn btn-primary"
            >
              {saving ? 'Adding...' : 'Add Class'}
            </button>
          </div>

          {/* Existing classes list */}
          <div>
            <h4 style={{ marginBottom: '15px', fontSize: '16px' }}>Your Classes</h4>
            {classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <p style={{ color: '#64748b' }}>
                  No classes defined yet. Add your first class above to start organizing your notes.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {classes.map((noteClass) => (
                  <div key={noteClass._id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: 'white'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                        {noteClass.name}
                      </div>
                      {noteClass.description && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {noteClass.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeClass(noteClass._id)}
                      className="btn btn-danger"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
