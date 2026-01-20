import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getNoteDir, fileExists, readFile, saveFile } from '@/lib/storage';
import path from 'path';
import { getCollection } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const noteDir = getNoteDir(userId, id);
    const transcriptPath = path.join(noteDir, 'output.txt');

    // Check if transcript file exists
    if (!fileExists(transcriptPath)) {
      // For older notes without transcript, create one from the markdown content
      const notesCollection = await getCollection('notes');
      const note = await notesCollection.findOne({
        _id: new ObjectId(id),
        userId,
      });

      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      // Copy the markdown content as the transcript
      const transcriptContent = note.content || '';
      saveFile(transcriptPath, transcriptContent);

      return new NextResponse(transcriptContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="transcript-${id}.txt"`,
        },
      });
    }

    const transcript = readFile(transcriptPath).toString('utf-8');

    return new NextResponse(transcript, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${id}.txt"`,
      },
    });
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
