import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokensCollection = await getCollection('shortcut_tokens');
    const tokens = await tokensCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch shortcut tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shortcut tokens' },
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

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Token name is required' }, { status: 400 });
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');

    const tokensCollection = await getCollection('shortcut_tokens');
    
    // Check if token name already exists for this user
    const existingToken = await tokensCollection.findOne({ 
      userId, 
      name: name.trim() 
    });

    if (existingToken) {
      return NextResponse.json({ error: 'Token name already exists' }, { status: 400 });
    }

    const newToken = {
      _id: new ObjectId(),
      userId,
      name: name.trim(),
      description: description?.trim() || '',
      token,
      createdAt: new Date(),
      lastUsed: null,
      isActive: true,
    };

    await tokensCollection.insertOne(newToken);

    return NextResponse.json(newToken);
  } catch (error) {
    console.error('Failed to create shortcut token:', error);
    return NextResponse.json(
      { error: 'Failed to create shortcut token' },
      { status: 500 }
    );
  }
}
