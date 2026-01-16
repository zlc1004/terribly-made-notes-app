import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import path from 'path';
import { getCollection } from '@/lib/db';
import { getNoteDir, saveFile, getFileExtension } from '@/lib/storage';
import { processingQueue } from '@/lib/queue';
import { extractAudioMetadata } from '@/lib/processing';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Type assertion for File from FormData
    const file = fileEntry as File & { type: string; name: string };

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an audio file.' }, { status: 400 });
    }

    // Create new note record
    const noteId = new ObjectId().toString();

    // Set up file paths
    const noteDir = getNoteDir(userId, noteId);
    const fileExtension = getFileExtension(file.name);
    const originalPath = path.join(noteDir, `original${fileExtension}`);
    const mp3Path = path.join(noteDir, 'converted.mp3');
    const markdownPath = path.join(noteDir, 'output.md');

    // Save the uploaded file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    saveFile(originalPath, fileBuffer);

    // Extract metadata from the audio file
    const metadata = await extractAudioMetadata(originalPath);

    const notesCollection = await getCollection('notes');
    await notesCollection.insertOne({
      _id: new ObjectId(noteId),
      userId,
      title: `Processing: ${file.name}`,
      description: 'Processing audio file...',
      content: '',
      status: 'processing',
      originalFileName: file.name,
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      format: metadata.format,
      recordedAt: metadata.recordedAt || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Add to processing queue
    processingQueue.addItem({
      id: `${userId}_${noteId}`,
      userId,
      noteId,
      originalPath,
      mp3Path,
      markdownPath,
    });

    return NextResponse.json({
      noteId,
      message: 'File uploaded successfully and queued for processing',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
