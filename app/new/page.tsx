'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function NewNote() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);
  const [processProgress, setProcessProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
    }
  }, [isLoaded, isSignedIn, router]);

  const handleFileSelect = (selectedFile: File) => {
    // Check if file is audio
    if (!selectedFile.type.startsWith('audio/')) {
      alert('Please select an audio file.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);
    setCurrentStatus('Uploading file...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      // Start polling for progress
      pollProgress(result.noteId);

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const pollProgress = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/progress`);
      if (response.ok) {
        const progress = await response.json();

        setQueueProgress(progress.queueProgress);
        setProcessProgress(progress.processProgress);
        setCurrentStatus(progress.status);

        if (progress.status === 'completed') {
          setUploading(false);
          showNotification('Note created successfully!', false);
          // Immediately redirect to the completed note
          router.push(`/note/${noteId}`);
        } else if (progress.status.includes('Error:')) {
          setUploading(false);
          showNotification('Processing failed. Please try again.', true);
        } else {
          // Continue polling
          setTimeout(() => pollProgress(noteId), 1000);
        }
      }
    } catch (error) {
      console.error('Failed to get progress:', error);
    }
  };

  const showNotification = (message: string, isError: boolean) => {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 5000);
  };

  const resetUpload = () => {
    setFile(null);
    setUploading(false);
    setQueueProgress(0);
    setProcessProgress(0);
    setCurrentStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isLoaded || !isSignedIn) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>Create New Note</h2>

        {!file && !uploading && (
          <div
            className={`upload-area ${isDragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>
              Drop an audio file here or click to select
            </p>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Supported formats: MP3, WAV, M4A, OGG, FLAC
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {file && !uploading && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '20px' }}>
              Selected file: <strong>{file.name}</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={uploadFile} className="btn btn-primary">
                Upload & Process
              </button>
              <button onClick={resetUpload} className="btn btn-secondary">
                Choose Different File
              </button>
            </div>
          </div>
        )}

        {uploading && (
          <div>
            {queueProgress === 0 && currentStatus === 'Uploading file...' && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <strong>⚠️ Don't leave this page while uploading!</strong>
              </div>
            )}

            {queueProgress < 100 && (
              <div className="progress-container">
                <div className="progress-label">Queue Position</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${queueProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="progress-container">
              <div className="progress-label">Processing Progress</div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${processProgress}%` }}
                />
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ color: '#6b7280' }}>{currentStatus}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
