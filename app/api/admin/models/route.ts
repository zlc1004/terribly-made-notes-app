import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/db';
import { isUserAdmin } from '@/lib/admin';

interface GlobalModelSettings {
  stt: {
    baseUrl: string;
    apiKey: string;
    english: {
      modelName: string;
      task: 'transcribe' | 'translate';
      temperature: number;
    };
    other: {
      modelName: string;
      task: 'transcribe' | 'translate';
      temperature: number;
    };
  };
  llm: {
    baseUrl: string;
    apiKey: string;
    summarizationModel: string;
    quizModel: string;
    chatModel: string;
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

const defaultGlobalSettings: GlobalModelSettings = {
  stt: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    english: {
      modelName: 'whisper-1',
      task: 'transcribe',
      temperature: 0.0,
    },
    other: {
      modelName: 'whisper-1',
      task: 'transcribe',
      temperature: 0.0,
    },
  },
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    summarizationModel: 'gpt-3.5-turbo',
    quizModel: 'gpt-3.5-turbo',
    chatModel: 'gpt-3.5-turbo',
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

    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const globalSettingsCollection = await getCollection('global_settings');
    const settings = await globalSettingsCollection.findOne({ type: 'models' });

    return NextResponse.json(settings?.settings || defaultGlobalSettings);
  } catch (error) {
    console.error('Failed to fetch global model settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global model settings' },
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

    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const settings = await request.json();
    const globalSettingsCollection = await getCollection('global_settings');

    const existingSettings = await globalSettingsCollection.findOne({ type: 'models' });

    if (existingSettings) {
      await globalSettingsCollection.updateOne(
        { type: 'models' },
        {
          $set: {
            settings,
            updatedAt: new Date(),
            updatedBy: userId
          }
        }
      );
    } else {
      await globalSettingsCollection.insertOne({
        type: 'models',
        settings,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      });
    }

    return NextResponse.json({ message: 'Global model settings saved successfully' });
  } catch (error) {
    console.error('Failed to save global model settings:', error);
    return NextResponse.json(
      { error: 'Failed to save global model settings' },
      { status: 500 }
    );
  }
}
