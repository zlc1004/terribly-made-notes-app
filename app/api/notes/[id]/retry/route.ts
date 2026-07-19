import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import path from 'path';
import { getCollection } from '@/lib/db';
import { getNoteDir, getFileExtension, fileExists } from '@/lib/storage';
import { processingQueue } from '@/lib/queue';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notesCollection = await getCollection('notes');
    const note = await notesCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.status !== 'error') {
      return NextResponse.json({ error: 'Note is not in error state' }, { status: 400 });
    }

    if (!note.originalFileName) {
      return NextResponse.json({ error: 'Original filename not recorded. Cannot retry.' }, { status: 400 });
    }

    // Set up file paths
    const noteDir = getNoteDir(userId, id);
    const fileExtension = getFileExtension(note.originalFileName);
    const originalPath = path.join(noteDir, `original${fileExtension}`);
    const mp3Path = path.join(noteDir, 'converted.mp3');
    const markdownPath = path.join(noteDir, 'output.md');

    // Check if the original file still exists
    if (!fileExists(originalPath)) {
      return NextResponse.json({ error: 'Original audio file not found on disk. Cannot retry.' }, { status: 400 });
    }

    // Reset status in MongoDB to processing
    await notesCollection.updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          status: 'processing',
          description: 'Retrying processing...',
          error: null,
          updatedAt: new Date(),
        },
      }
    );

    // Add to processing queue
    processingQueue.addItem({
      id: `${userId}_${id}`,
      userId,
      noteId: id,
      originalPath,
      mp3Path,
      markdownPath,
      language: note.language || 'english',
    });

    return NextResponse.json({
      message: 'Note queued for reprocessing',
    });

  } catch (error) {
    console.error('Retry route error:', error);
    return NextResponse.json(
      { error: 'Failed to queue note for retry' },
      { status: 500 }
    );
  }
}
