interface QueueItem {
  id: string;
  userId: string;
  noteId: string;
  originalPath: string;
  mp3Path: string;
  markdownPath: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

class ProcessingQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  addItem(item: Omit<QueueItem, 'status' | 'progress'>): void {
    this.queue.push({
      ...item,
      status: 'queued',
      progress: 0,
    });
    
    if (!this.processing) {
      this.processNext();
    }
  }

  getItem(id: string): QueueItem | undefined {
    return this.queue.find(item => item.id === id);
  }

  getQueuePosition(id: string): number {
    const queuedItems = this.queue.filter(item => item.status === 'queued');
    const index = queuedItems.findIndex(item => item.id === id);
    return index + 1; // 1-based position
  }

  getQueueLength(): number {
    return this.queue.filter(item => item.status === 'queued').length;
  }

  private async processNext(): Promise<void> {
    const nextItem = this.queue.find(item => item.status === 'queued');
    
    if (!nextItem) {
      this.processing = false;
      return;
    }

    this.processing = true;
    await this.processItem(nextItem);
    
    // Continue processing
    setTimeout(() => this.processNext(), 100);
  }

  private async processItem(item: QueueItem): Promise<void> {
    try {
      item.status = 'processing';
      item.progress = 0;

      // Import processing functions dynamically to avoid circular dependencies
      const { convertAudioToMp3, transcribeAudio, summarizeText, saveMarkdownNote, deleteFile } = await import('./processing');
      const { getCollection } = await import('./db');

      // Convert audio to MP3
      item.progress = 10;
      await convertAudioToMp3(
        item.originalPath,
        item.mp3Path,
        (progress) => {
          item.progress = 10 + (progress * 0.3); // 10-40%
        }
      );

      // Delete original file to save space
      deleteFile(item.originalPath);
      item.progress = 40;

      // Get user settings
      const settingsCollection = await getCollection('settings');
      const userSettings = await settingsCollection.findOne({ userId: item.userId });

      if (!userSettings) {
        throw new Error('User settings not found. Please configure API settings first.');
      }

      // Transcribe audio
      item.progress = 50;
      const transcription = await transcribeAudio(item.mp3Path, userSettings.stt);
      item.progress = 70;

      // Summarize with LLM
      const summary = await summarizeText(transcription, userSettings.llm);
      item.progress = 90;

      // Save markdown file
      await saveMarkdownNote(item.markdownPath, summary.content);

      // Update database with the results
      const notesCollection = await getCollection('notes');
      await notesCollection.updateOne(
        { _id: item.noteId, userId: item.userId },
        {
          $set: {
            title: summary.title,
            description: summary.description,
            content: summary.content,
            status: 'completed',
            updatedAt: new Date(),
          },
        }
      );

      item.status = 'completed';
      item.progress = 100;

    } catch (error) {
      console.error('Processing failed for item:', item.id, error);
      
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';

      // Update database to reflect error status
      try {
        const { getCollection } = await import('./db');
        const notesCollection = await getCollection('notes');
        await notesCollection.updateOne(
          { _id: item.noteId, userId: item.userId },
          {
            $set: {
              status: 'error',
              error: item.error,
              updatedAt: new Date(),
            },
          }
        );
      } catch (dbError) {
        console.error('Failed to update database with error status:', dbError);
      }
    }
  }

  getProgress(id: string): {
    queueProgress: number;
    processProgress: number;
    status: string;
  } {
    const item = this.getItem(id);
    if (!item) {
      return {
        queueProgress: 0,
        processProgress: 0,
        status: 'not found',
      };
    }

    const queuePosition = this.getQueuePosition(id);
    const totalQueued = this.getQueueLength();
    
    let queueProgress = 0;
    if (item.status !== 'queued') {
      queueProgress = 100;
    } else if (totalQueued > 0) {
      queueProgress = ((totalQueued - queuePosition + 1) / totalQueued) * 100;
    }

    return {
      queueProgress,
      processProgress: item.progress,
      status: item.status === 'error' ? `Error: ${item.error}` : item.status,
    };
  }
}

export const processingQueue = new ProcessingQueue();
