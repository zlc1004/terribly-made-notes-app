'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface Settings {
  stt: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    task: 'transcribe' | 'translate';
    temperature: number;
  };
  llm: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
  tts: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    voice: string;
    responseFormat: string;
    speed: number;
    sampleRate: number;
  };
}

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    stt: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'whisper-1',
      task: 'transcribe',
      temperature: 0.0,
    },
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-3.5-turbo',
    },
    tts: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'tts-1',
      voice: 'alloy',
      responseFormat: 'mp3',
      speed: 1.0,
      sampleRate: 22050,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<{[key: string]: string[]}>({});

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
      return;
    }
    
    if (isLoaded && isSignedIn) {
      fetchSettings();
    }
  }, [isLoaded, isSignedIn]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (baseUrl: string, apiKey: string, type: 'stt' | 'llm' | 'tts') => {
    if (!baseUrl || !apiKey) return;
    
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setModels(prev => ({ ...prev, [type]: data.models }));
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showNotification('Settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification('Failed to save settings. Please try again.', true);
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message: string, isError = false) => {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  };

  const updateSettings = (section: keyof Settings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
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
      <div className="card">
        <h2 style={{ marginBottom: '30px' }}>API Settings</h2>
        
        {/* STT Settings */}
        <section style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
            Speech-to-Text (STT) API
          </h3>
          
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <input
              type="url"
              className="form-input"
              value={settings.stt.baseUrl}
              onChange={(e) => updateSettings('stt', 'baseUrl', e.target.value)}
              onBlur={() => fetchModels(settings.stt.baseUrl, settings.stt.apiKey, 'stt')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              type="password"
              className="form-input"
              value={settings.stt.apiKey}
              onChange={(e) => updateSettings('stt', 'apiKey', e.target.value)}
              onBlur={() => fetchModels(settings.stt.baseUrl, settings.stt.apiKey, 'stt')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Model Name</label>
            {models.stt ? (
              <select
                className="form-select"
                value={settings.stt.modelName}
                onChange={(e) => updateSettings('stt', 'modelName', e.target.value)}
              >
                {models.stt.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={settings.stt.modelName}
                onChange={(e) => updateSettings('stt', 'modelName', e.target.value)}
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Task</label>
            <select
              className="form-select"
              value={settings.stt.task}
              onChange={(e) => updateSettings('stt', 'task', e.target.value as 'transcribe' | 'translate')}
            >
              <option value="transcribe">Transcribe</option>
              <option value="translate">Translate</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Temperature (0.0 - 1.0)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              className="form-input"
              value={settings.stt.temperature}
              onChange={(e) => updateSettings('stt', 'temperature', parseFloat(e.target.value))}
            />
          </div>
        </section>

        {/* LLM Settings */}
        <section style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
            Large Language Model (LLM) API
          </h3>
          
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <input
              type="url"
              className="form-input"
              value={settings.llm.baseUrl}
              onChange={(e) => updateSettings('llm', 'baseUrl', e.target.value)}
              onBlur={() => fetchModels(settings.llm.baseUrl, settings.llm.apiKey, 'llm')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              type="password"
              className="form-input"
              value={settings.llm.apiKey}
              onChange={(e) => updateSettings('llm', 'apiKey', e.target.value)}
              onBlur={() => fetchModels(settings.llm.baseUrl, settings.llm.apiKey, 'llm')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Model Name</label>
            {models.llm ? (
              <select
                className="form-select"
                value={settings.llm.modelName}
                onChange={(e) => updateSettings('llm', 'modelName', e.target.value)}
              >
                {models.llm.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={settings.llm.modelName}
                onChange={(e) => updateSettings('llm', 'modelName', e.target.value)}
              />
            )}
          </div>
        </section>

        {/* TTS Settings */}
        <section style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
            Text-to-Speech (TTS) API
          </h3>
          
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <input
              type="url"
              className="form-input"
              value={settings.tts.baseUrl}
              onChange={(e) => updateSettings('tts', 'baseUrl', e.target.value)}
              onBlur={() => fetchModels(settings.tts.baseUrl, settings.tts.apiKey, 'tts')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              type="password"
              className="form-input"
              value={settings.tts.apiKey}
              onChange={(e) => updateSettings('tts', 'apiKey', e.target.value)}
              onBlur={() => fetchModels(settings.tts.baseUrl, settings.tts.apiKey, 'tts')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Model Name</label>
            {models.tts ? (
              <select
                className="form-select"
                value={settings.tts.modelName}
                onChange={(e) => updateSettings('tts', 'modelName', e.target.value)}
              >
                {models.tts.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={settings.tts.modelName}
                onChange={(e) => updateSettings('tts', 'modelName', e.target.value)}
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Voice</label>
            <input
              type="text"
              className="form-input"
              value={settings.tts.voice}
              onChange={(e) => updateSettings('tts', 'voice', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Response Format</label>
            <input
              type="text"
              className="form-input"
              value={settings.tts.responseFormat}
              onChange={(e) => updateSettings('tts', 'responseFormat', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Speed (0.5 - 2.0)</label>
            <input
              type="number"
              min="0.5"
              max="2.0"
              step="0.1"
              className="form-input"
              value={settings.tts.speed}
              onChange={(e) => updateSettings('tts', 'speed', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sample Rate (8000 - 48000)</label>
            <input
              type="number"
              min="8000"
              max="48000"
              step="1000"
              className="form-input"
              value={settings.tts.sampleRate}
              onChange={(e) => updateSettings('tts', 'sampleRate', parseInt(e.target.value))}
            />
          </div>
        </section>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn btn-primary"
            style={{ minWidth: '120px' }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
