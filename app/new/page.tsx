'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function NewNote() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<'english' | 'other'>('english');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
    setUploadProgress(0);
    setQueueProgress(0);
    setProcessProgress(0);
    setCurrentStatus('Preparing upload...');

    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
          setCurrentStatus(`Uploading: ${percentComplete}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText);
          setCurrentStatus('Upload complete! Processing...');
          pollProgress(result.noteId);
          resolve();
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        console.error('Upload failed');
        alert('Upload failed. Please try again.');
        setUploading(false);
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        setUploading(false);
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
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
    setLanguage('english');
    setUploading(false);
    setUploadProgress(0);
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
              accept=".mp3, .wav, .m4a, .aac, audio/*"
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

            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
                Audio Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'english' | 'other')}
                className="form-select"
                style={{ maxWidth: '200px', margin: '0 auto' }}
              >
                <option value="english">English</option>
                <option value="other">Other Language</option>
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Select the primary language of the audio
              </p>
            </div>

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
            {uploadProgress < 100 && (
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

            {uploadProgress < 100 && (
              <div className="progress-container">
                <div className="progress-label">Upload Progress</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: uploadProgress < 100 ? '#3b82f6' : '#10b981'
                    }}
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                  {uploadProgress}% of {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
                </div>
              </div>
            )}

            {(uploadProgress >= 100 || queueProgress > 0 || processProgress > 0) && (
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

            {(uploadProgress >= 100 || queueProgress >= 100) && (
              <div className="progress-container">
                <div className="progress-label">Processing Progress</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${processProgress}%`,
                      backgroundColor: processProgress >= 100 ? '#10b981' : '#3b82f6'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ color: '#6b7280' }}>{currentStatus}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
