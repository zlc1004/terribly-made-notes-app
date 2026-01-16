import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }

    const classesCollection = await getCollection('user_classes');
    const result = await classesCollection.deleteOne({ 
      _id: new ObjectId(id), 
      userId 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user class:', error);
    return NextResponse.json(
      { error: 'Failed to delete user class' },
      { status: 500 }
    );
  }
}
