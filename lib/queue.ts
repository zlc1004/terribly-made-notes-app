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
  sttRetries: number;
  llmRetries: number;
  fullRetries: number;
  currentStep: string;
}

class ProcessingQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  addItem(item: Omit<QueueItem, 'status' | 'progress' | 'sttRetries' | 'llmRetries' | 'fullRetries' | 'currentStep'>): void {
    this.queue.push({
      ...item,
      status: 'queued',
      progress: 0,
      sttRetries: 0,
      llmRetries: 0,
      fullRetries: 0,
      currentStep: 'queued',
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
      const { deleteFile, fileExists } = await import('./storage');
      const { getCollection } = await import('./db');

      let transcription: string = '';
      let summary: { title: string; description: string; content: string };

      // Step 1: Convert audio to MP3 (No retry for FFmpeg failures)
      if (item.currentStep === 'queued' || item.currentStep === 'converting') {
        try {
          item.currentStep = 'converting';
          item.progress = 10;
          await convertAudioToMp3(
            item.originalPath,
            item.mp3Path,
            (progress) => {
              item.progress = 10 + (progress * 0.3); // 10-40%
            }
          );
          item.progress = 40;
        } catch (error) {
          throw new Error('Unsupported audio format or corrupted file. Please try a different audio file.');
        }
      }

      // Step 2: Get global admin settings (Retry entire process once on failure)
      if (item.currentStep === 'converting' || item.currentStep === 'settings') {
        try {
          item.currentStep = 'settings';
          item.progress = 45;
          const globalSettingsCollection = await getCollection('global_settings');
          const globalSettings = await globalSettingsCollection.findOne({ type: 'models' });

          if (!globalSettings || !globalSettings.settings) {
            throw new Error('Global API settings not found. Please ask an administrator to configure API settings.');
          }

          const settings = globalSettings.settings;
          item.progress = 50;

          // Step 3: Transcribe audio (Retry up to 3 times for STT API failures)
          if (item.currentStep === 'settings' || item.currentStep === 'transcribing') {
            try {
              item.currentStep = 'transcribing';
              transcription = await transcribeAudio(item.mp3Path, settings.stt);
              item.progress = 70;
            } catch (sttError) {
              if (item.sttRetries < 3) {
                item.sttRetries++;
                console.log(`STT retry ${item.sttRetries}/3 for item ${item.id}`);
                // Retry from transcription step
                setTimeout(() => this.processItem(item), 2000 * item.sttRetries); // Exponential backoff
                return;
              } else {
                throw new Error(`Speech-to-text failed after 3 attempts: ${sttError instanceof Error ? sttError.message : 'Unknown error'}`);
              }
            }
          }

          // Step 4: Summarize with LLM (Retry up to 3 times for LLM API failures)
          if (item.currentStep === 'transcribing' || item.currentStep === 'summarizing') {
            try {
              item.currentStep = 'summarizing';
              summary = await summarizeText(transcription, settings.llm);
              item.progress = 90;
            } catch (llmError) {
              if (item.llmRetries < 3) {
                item.llmRetries++;
                console.log(`LLM retry ${item.llmRetries}/3 for item ${item.id}`);
                // Retry from summarization step
                setTimeout(() => this.processItem(item), 2000 * item.llmRetries); // Exponential backoff
                return;
              } else {
                throw new Error(`AI summarization failed after 3 attempts: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`);
              }
            }
          }

          // Step 5: Save markdown file and update database
          item.currentStep = 'saving';
          item.progress = 92;
          await saveMarkdownNote(item.markdownPath, summary!.content);

          // Update database with the results
          item.progress = 95;
          const { ObjectId } = await import('mongodb');
          const notesCollection = await getCollection('notes');
          await notesCollection.updateOne(
            { _id: new ObjectId(item.noteId), userId: item.userId },
            {
              $set: {
                title: summary!.title,
                description: summary!.description,
                content: summary!.content,
                status: 'completed',
                updatedAt: new Date(),
              },
            }
          );

          // Only delete original file after everything is saved successfully
          if (fileExists(item.originalPath)) {
            deleteFile(item.originalPath);
          }

          item.status = 'completed';
          item.progress = 100;
          item.currentStep = 'completed';

        } catch (error) {
          // For settings, saving, or database errors - retry entire process once
          if (item.fullRetries < 1) {
            item.fullRetries++;
            item.currentStep = 'converting'; // Restart from conversion
            item.sttRetries = 0; // Reset step-specific retries
            item.llmRetries = 0;
            console.log(`Full process retry ${item.fullRetries}/1 for item ${item.id}`);
            setTimeout(() => this.processItem(item), 3000); // 3 second delay
            return;
          } else {
            throw error; // Final failure after full retry
          }
        }
      }

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
      let retryInfo = '';

      if (item.currentStep === 'transcribing' && item.sttRetries > 0) {
        retryInfo = ` (Retry ${item.sttRetries}/3)`;
      } else if (item.currentStep === 'summarizing' && item.llmRetries > 0) {
        retryInfo = ` (Retry ${item.llmRetries}/3)`;
      } else if (item.fullRetries > 0) {
        retryInfo = ` (Retry ${item.fullRetries}/1)`;
      }

      if (progress < 10) {
        detailedStatus = `Starting processing...${retryInfo} (${progress}%)`;
      } else if (progress < 40) {
        detailedStatus = `Converting audio to MP3...${retryInfo} (${progress}%)`;
      } else if (progress < 50) {
        detailedStatus = `Loading API settings...${retryInfo} (${progress}%)`;
      } else if (progress < 70) {
        detailedStatus = `Transcribing audio to text...${retryInfo} (${progress}%)`;
      } else if (progress < 90) {
        detailedStatus = `Generating AI summary...${retryInfo} (${progress}%)`;
      } else if (progress < 100) {
        detailedStatus = `Saving markdown file...${retryInfo} (${progress}%)`;
      } else {
        detailedStatus = `Finalizing...${retryInfo} (${progress}%)`;
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
