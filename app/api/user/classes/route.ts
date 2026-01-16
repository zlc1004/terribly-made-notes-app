import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classesCollection = await getCollection('user_classes');
    const classes = await classesCollection
      .find({ userId })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(classes);
  } catch (error) {
    console.error('Failed to fetch user classes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user classes' },
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
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    const classesCollection = await getCollection('user_classes');
    
    // Check if class name already exists for this user
    const existingClass = await classesCollection.findOne({ 
      userId, 
      name: name.trim() 
    });

    if (existingClass) {
      return NextResponse.json({ error: 'Class name already exists' }, { status: 400 });
    }

    const newClass = {
      _id: new ObjectId(),
      userId,
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date(),
    };

    await classesCollection.insertOne(newClass);

    return NextResponse.json(newClass);
  } catch (error) {
    console.error('Failed to create user class:', error);
    return NextResponse.json(
      { error: 'Failed to create user class' },
      { status: 500 }
    );
  }
}
