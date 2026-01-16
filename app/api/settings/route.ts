import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/db';

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

    const settingsCollection = await getCollection('settings');
    const settings = await settingsCollection.findOne({ userId });

    return NextResponse.json(settings || defaultSettings);
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

    const settings = await request.json();
    const settingsCollection = await getCollection('settings');

    await settingsCollection.replaceOne(
      { userId },
      { userId, ...settings, updatedAt: new Date() },
      { upsert: true }
    );

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
