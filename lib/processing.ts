import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { saveFile, deleteFile, readFile, fileExists } from './storage';

export interface ProcessingProgress {
  queueProgress: number;
  processProgress: number;
  status: string;
}

export async function convertAudioToMp3(
  inputPath: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)
      .on('progress', (progress) => {
        if (onProgress) {
          onProgress(progress.percent || 0);
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      })
      .save(outputPath);
  });
}

export async function transcribeAudio(
  audioPath: string,
  settings: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    task: 'transcribe' | 'translate';
    temperature: number;
  }
): Promise<string> {
  try {
    const audioBuffer = readFile(audioPath);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mp3' });
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', settings.modelName);
    formData.append('task', settings.task);
    formData.append('temperature', settings.temperature.toString());
    formData.append('response_format', 'text');

    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`STT API error: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
}

export async function summarizeText(
  text: string,
  settings: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  }
): Promise<{
  title: string;
  description: string;
  content: string;
}> {
  try {
    const prompt = `Analyze the following transcribed audio and create a structured summary.

CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON object
- Do NOT include any markdown code blocks, explanations, or other text
- Do NOT wrap the JSON in \`\`\`json code blocks
- Your entire response must be parseable JSON

Required JSON structure:
{
  "title": "A concise, descriptive title for the content",
  "description": "A one-line summary description",
  "content": "A detailed markdown-formatted summary of the main points, organized with headers, bullet points, and proper formatting"
}

Transcribed text:
${text}

Remember: Return ONLY the JSON object, nothing else.`;

    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.modelName,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from LLM API');
    }

    try {
      // Try to extract JSON from content if it's wrapped in code blocks
      let jsonContent = content.trim();

      // Remove markdown code block wrapper if present
      if (jsonContent.startsWith('```json\n')) {
        jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```\n')) {
        jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '');
      }

      const result = JSON.parse(jsonContent);

      // Validate the response structure
      if (!result.title || !result.description || !result.content) {
        throw new Error('Invalid response structure from LLM');
      }

      return result;
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content);
      throw new Error('Failed to parse LLM response as JSON');
    }
  } catch (error) {
    console.error('Summarization failed:', error);
    throw error;
  }
}

export async function saveMarkdownNote(filePath: string, content: string): Promise<void> {
  saveFile(filePath, content);
}
