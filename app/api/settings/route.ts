import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/db';
import { isUserAdmin } from '@/lib/admin';

const defaultSettings = {
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
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only return global admin settings
    const globalSettingsCollection = await getCollection('global_settings');
    const globalSettings = await globalSettingsCollection.findOne({ type: 'models' });

    if (globalSettings) {
      return NextResponse.json(globalSettings.settings);
    }

    // Fallback to defaults if no global settings exist
    return NextResponse.json(defaultSettings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({
        error: 'Forbidden - Only administrators can modify settings'
      }, { status: 403 });
    }

    // Redirect to admin endpoint
    return NextResponse.json({
      error: 'Use /api/admin/models endpoint for admin settings'
    }, { status: 400 });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
