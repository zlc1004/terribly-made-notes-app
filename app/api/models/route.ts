import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Base URL and API key are required' },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id) || [];

      return NextResponse.json({ models });
    } catch (apiError) {
      console.error('Failed to fetch models from API:', apiError);
      return NextResponse.json(
        { error: 'Failed to fetch models from the provided API' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
