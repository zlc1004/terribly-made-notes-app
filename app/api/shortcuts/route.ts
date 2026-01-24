import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import { getNoteDir, saveFile, getFileExtension } from '@/lib/storage';
import { processingQueue } from '@/lib/queue';
import { extractAudioMetadata } from '@/lib/processing';

// Helper function to validate token
async function validateToken(token: string) {
  if (!token) return null;

  const tokensCollection = await getCollection('shortcut_tokens');
  const tokenRecord = await tokensCollection.findOne({
    token,
    isActive: true
  });

  if (!tokenRecord) return null;

  // Update last used timestamp
  await tokensCollection.updateOne(
    { _id: tokenRecord._id },
    { $set: { lastUsed: new Date() } }
  );

  return tokenRecord;
}

// Helper function to create note record and queue for processing
async function createAndQueueNote(userId: string, file: File | null, fileBuffer: Buffer, originalFileName: string, language: 'english' | 'other' = 'english') {
  // Create new note record
  const noteId = new ObjectId().toString();

  // Set up file paths using the same structure as regular uploads
  const noteDir = getNoteDir(userId, noteId);
  const fileExtension = getFileExtension(originalFileName);
  const originalPath = path.join(noteDir, `original${fileExtension}`);
  const mp3Path = path.join(noteDir, 'converted.mp3');
  const markdownPath = path.join(noteDir, 'output.md');

  // Save the uploaded file
  saveFile(originalPath, fileBuffer);

  // Extract metadata from the audio file
  const metadata = await extractAudioMetadata(originalPath);

  // Create note record in database
  const notesCollection = await getCollection('notes');
  await notesCollection.insertOne({
    _id: new ObjectId(noteId),
    userId,
    title: `Processing: ${originalFileName}`,
    description: 'Processing audio file from Apple Shortcut...',
    content: '',
    status: 'processing',
    originalFileName,
    language,
    duration: metadata.duration,
    bitrate: metadata.bitrate,
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    format: metadata.format,
    recordedAt: metadata.recordedAt || new Date(),
    source: 'Apple Shortcut',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Add to processing queue (same as regular uploads)
  processingQueue.addItem({
    id: `${userId}_${noteId}`,
    userId,
    noteId,
    originalPath,
    mp3Path,
    markdownPath,
    language,
  });

  return { noteId, filename: path.basename(originalPath) };
}

export async function PUT(request: NextRequest) {
  try {
    // Get authorization token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const tokenRecord = await validateToken(token);

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 401 });
    }

    // Check if it's form data or raw file
    const contentType = request.headers.get('content-type') || '';
    const languageHeader = request.headers.get('language') || 'english';

    // Validate language parameter
    if (!['english', 'other'].includes(languageHeader.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid Language header. Must be "english" or "other".' }, { status: 400 });
    }

    const language = languageHeader.toLowerCase() as 'english' | 'other';
    let file: File | null = null;
    let fileBuffer: Buffer;
    let originalFileName: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await request.formData();
      const fileEntry = formData.get('recording') as File;

      if (!fileEntry) {
        return NextResponse.json({ error: 'No recording file provided' }, { status: 400 });
      }

      file = fileEntry;
      fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
      originalFileName = fileEntry.name || 'recording.wav';
    } else {
      // Handle raw file upload (direct body)
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return NextResponse.json({ error: 'No recording data provided' }, { status: 400 });
      }

      fileBuffer = Buffer.from(arrayBuffer);
      // Generate filename for raw upload based on content type
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (contentType.includes('wav')) {
        originalFileName = `shortcut_${timestamp}_recording.wav`;
      } else if (contentType.includes('m4a') || contentType.includes('aac')) {
        originalFileName = `shortcut_${timestamp}_recording.m4a`;
      } else {
        originalFileName = `shortcut_${timestamp}_recording.mp3`;
      }
    }

    // Create note and add to queue using the same system as regular uploads
    const result = await createAndQueueNote(tokenRecord.userId, file, fileBuffer, originalFileName, language);

    return NextResponse.json({
      success: true,
      message: 'Recording uploaded successfully and queued for processing',
      noteId: result.noteId,
      filename: result.filename
    });

  } catch (error) {
    console.error('Error processing shortcut upload:', error);
    return NextResponse.json(
      { error: 'Failed to process recording upload' },
      { status: 500 }
    );
  }
}
