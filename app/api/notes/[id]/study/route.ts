import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db';

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  answers: string[];
  correctAnswerIndex: number;
  explanation: string;
}

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

    const { type } = await request.json();
    const { searchParams } = new URL(request.url);
    const generateFlashcards = searchParams.get('flashcards') === 'true';
    const generateQuiz = searchParams.get('quiz') === 'true';

    if (!generateFlashcards && !generateQuiz) {
      return NextResponse.json({ error: 'Must specify flashcards or quiz' }, { status: 400 });
    }

    const notesCollection = await getCollection('notes');
    const note = await notesCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get global admin settings
    const globalSettingsCollection = await getCollection('global_settings');
    const globalSettings = await globalSettingsCollection.findOne({ type: 'models' });

    if (!globalSettings || !globalSettings.settings) {
      return NextResponse.json({ error: 'Global API settings not configured' }, { status: 500 });
    }

    const settings = globalSettings.settings;
    const llmSettings = settings.llm;

    // Generate content based on type
    let flashcards: Flashcard[] = [];
    let quizQuestions: QuizQuestion[] = [];

    if (generateFlashcards) {
      flashcards = await generateFlashcardsFromContent(note.content, llmSettings);
    }

    if (generateQuiz) {
      quizQuestions = await generateQuizFromContent(note.content, llmSettings);
    }

    return NextResponse.json({
      flashcards,
      quizQuestions,
    });
  } catch (error) {
    console.error('Failed to generate flashcards/quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate flashcards/quiz' },
      { status: 500 }
    );
  }
}

async function generateFlashcardsFromContent(
  content: string,
  settings: { baseUrl: string; apiKey: string; quizModel: string }
): Promise<Flashcard[]> {
  const prompt = `Based on the following note content, generate 5-10 flashcards.

Return ONLY a valid JSON array (no markdown code blocks, no explanations):
[
  {"front": "Question or term", "back": "Answer or definition"}
]

Note content:
${content.substring(0, 8000)}

Generate flashcards that test understanding of key concepts, definitions, and important facts.`;

  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.quizModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error('No content received from LLM API');
    }

    // Parse the JSON response
    let jsonContent = responseContent.trim();
    // Remove any markdown code block wrapper if present
    if (jsonContent.startsWith('```json\n')) {
      jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonContent.startsWith('```\n')) {
      jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const flashcards = JSON.parse(jsonContent);
    return Array.isArray(flashcards) ? flashcards : [];
  } catch (error) {
    console.error('Failed to generate flashcards:', error);
    return [];
  }
}

async function generateQuizFromContent(
  content: string,
  settings: { baseUrl: string; apiKey: string; quizModel: string }
): Promise<QuizQuestion[]> {
  const prompt = `Based on the following note content, generate 5-10 quiz questions.

Return ONLY a valid JSON array (no markdown code blocks, no explanations):
[
  {
    "question": "Question text",
    "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"],
    "correctAnswerIndex": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]

Note content:
${content.substring(0, 8000)}

Generate questions that test understanding of key concepts, facts, and applications. Ensure wrong answers are plausible but clearly incorrect to someone who understands the material.`;

  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.quizModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error('No content received from LLM API');
    }

    // Parse the JSON response
    let jsonContent = responseContent.trim();
    // Remove any markdown code block wrapper if present
    if (jsonContent.startsWith('```json\n')) {
      jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonContent.startsWith('```\n')) {
      jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const questions = JSON.parse(jsonContent);
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error('Failed to generate quiz:', error);
    return [];
  }
}
