import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

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

// Helper function to save uploaded file
async function saveUploadedFile(file: File, userId: string) {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  // Generate unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `shortcut_${userId}_${timestamp}_${file.name || 'recording'}`;
  const filepath = path.join(uploadsDir, filename);

  // Write file to uploads directory
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await fs.writeFile(filepath, buffer);

  return { filename, filepath };
}

// Helper function to queue recording for processing
async function queueRecording(userId: string, filename: string, filepath: string) {
  const queueCollection = await getCollection('processing_queue');

  const queueItem = {
    _id: new ObjectId(),
    userId,
    filename,
    filepath,
    source: 'shortcut',
    status: 'pending',
    createdAt: new Date(),
    metadata: {
      originalName: filename,
      uploadMethod: 'Apple Shortcut',
    }
  };

  await queueCollection.insertOne(queueItem);
  return queueItem;
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
    let filename: string;
    let filepath: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await request.formData();
      const file = formData.get('recording') as File;

      if (!file) {
        return NextResponse.json({ error: 'No recording file provided' }, { status: 400 });
      }

      const result = await saveUploadedFile(file, tokenRecord.userId);
      filename = result.filename;
      filepath = result.filepath;
    } else {
      // Handle raw file upload (direct body)
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return NextResponse.json({ error: 'No recording data provided' }, { status: 400 });
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `shortcut_${tokenRecord.userId}_${timestamp}_recording.m4a`;
      filepath = path.join(uploadsDir, filename);

      // Write file to uploads directory
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filepath, buffer);
    }

    // Queue for processing
    const queueItem = await queueRecording(tokenRecord.userId, filename, filepath);

    return NextResponse.json({
      success: true,
      message: 'Recording uploaded successfully',
      queueId: queueItem._id.toString(),
      filename: filename
    });

  } catch (error) {
    console.error('Error processing shortcut upload:', error);
    return NextResponse.json(
      { error: 'Failed to process recording upload' },
      { status: 500 }
    );
  }
}
