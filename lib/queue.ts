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
      item.progress = 5;

      // Import processing functions dynamically to avoid circular dependencies
      const { convertAudioToMp3, transcribeAudio, summarizeText, saveMarkdownNote } = await import('./processing');
      const { deleteFile } = await import('./storage');
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

      item.progress = 42;

      // Get global admin settings
      item.progress = 45;
      const globalSettingsCollection = await getCollection('global_settings');
      const globalSettings = await globalSettingsCollection.findOne({ type: 'models' });

      if (!globalSettings || !globalSettings.settings) {
        throw new Error('Global API settings not found. Please ask an administrator to configure API settings.');
      }

      const settings = globalSettings.settings;
      item.progress = 50;

      // Transcribe audio
      const transcription = await transcribeAudio(item.mp3Path, settings.stt);
      item.progress = 70;

      // Get user classes for classification
      const userClassesCollection = await getCollection('user_classes');
      const userClassDocs = await userClassesCollection.find({ userId: item.userId }).toArray();
      const userClasses = userClassDocs.map(doc => doc.name);

      // Summarize with LLM
      const summary = await summarizeText(transcription, settings.llm, userClasses, 'summarization');
      item.progress = 90;

      // Save markdown file
      item.progress = 92;
      await saveMarkdownNote(item.markdownPath, summary.content);

      // Save transcript as txt file
      item.progress = 93;
      const transcriptPath = item.markdownPath.replace(/\.md$/, '.txt');
      await saveMarkdownNote(transcriptPath, transcription);

      // Update database with the results
      item.progress = 95;
      const { ObjectId } = await import('mongodb');
      const notesCollection = await getCollection('notes');
      const updateData: any = {
        title: summary.title,
        description: summary.description,
        content: summary.content,
        status: 'completed',
        updatedAt: new Date(),
      };

      if (summary.noteClass) {
        updateData.noteClass = summary.noteClass;
      }

      await notesCollection.updateOne(
        { _id: new ObjectId(item.noteId), userId: item.userId },
        { $set: updateData }
      );

      // Delete original file after everything is saved successfully
      deleteFile(item.originalPath);

      item.status = 'completed';
      item.progress = 100;

    } catch (error) {
      console.error('Processing failed for item:', item.id, error);

      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';

      // Update database to reflect error status
      try {
        const { ObjectId } = await import('mongodb');
        const { getCollection } = await import('./db');
        const notesCollection = await getCollection('notes');
        await notesCollection.updateOne(
          { _id: new ObjectId(item.noteId), userId: item.userId },
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

    let detailedStatus = '';
    if (item.status === 'error') {
      detailedStatus = `Error: ${item.error}`;
    } else if (item.status === 'queued') {
      detailedStatus = 'Waiting in queue...';
    } else if (item.status === 'completed') {
      detailedStatus = 'Complete';
    } else if (item.status === 'processing') {
      const progress = Math.round(item.progress);
      if (progress < 10) {
        detailedStatus = `Starting processing... (${progress}%)`;
      } else if (progress < 40) {
        detailedStatus = `Converting audio to MP3... (${progress}%)`;
      } else if (progress < 50) {
        detailedStatus = `Loading API settings... (${progress}%)`;
      } else if (progress < 70) {
        detailedStatus = `Transcribing audio to text... (${progress}%)`;
      } else if (progress < 90) {
        detailedStatus = `Generating AI summary... (${progress}%)`;
      } else if (progress < 100) {
        detailedStatus = `Saving markdown file... (${progress}%)`;
      } else {
        detailedStatus = `Finalizing... (${progress}%)`;
      }
    } else {
      detailedStatus = item.status;
    }

    return {
      queueProgress,
      processProgress: item.progress,
      status: detailedStatus,
    };
  }
}

export const processingQueue = new ProcessingQueue();
