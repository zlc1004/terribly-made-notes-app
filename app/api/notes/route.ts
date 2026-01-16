import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'uploaded';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';

    const notesCollection = await getCollection('notes');

    // Build search query
    let query: any = { userId };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortField = sortBy === 'recorded' ? 'recordedAt' : 'createdAt';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObj: any = { [sortField]: sortDirection };

    // Add secondary sort by createdAt if sorting by recordedAt
    if (sortBy === 'recorded') {
      sortObj.createdAt = sortDirection;
    }

    const notes = await notesCollection
      .find(query)
      .sort(sortObj)
      .toArray();

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
