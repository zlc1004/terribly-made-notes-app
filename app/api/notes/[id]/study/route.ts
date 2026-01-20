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
${content}

Generate flashcards that test understanding of key concepts, definitions, and important facts.`;

  try {
    console.log('[Flashcards] Calling LLM API...');
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
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Flashcards] LLM API error:', response.status, errorText);
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let responseContent = data.choices[0]?.message?.content;

    console.log('[Flashcards] Raw response length:', responseContent?.length);
    console.log('[Flashcards] Raw response preview:', responseContent?.substring(0, 200));

    if (!responseContent) {
      throw new Error('No content received from LLM API');
    }

    // Parse the JSON response
    let jsonContent = responseContent.trim();
    
    // Try to extract JSON from various formats
    const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
      console.log('[Flashcards] Extracted JSON array from response');
    }

    // Remove any markdown code block wrapper if present
    jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```$/g, '').trim();

    console.log('[Flashcards] JSON to parse:', jsonContent.substring(0, 200));

    const flashcards = JSON.parse(jsonContent);
    console.log('[Flashcards] Successfully parsed', flashcards.length, 'flashcards');
    return Array.isArray(flashcards) ? flashcards : [];
  } catch (error) {
    console.error('[Flashcards] Failed to generate flashcards:', error);
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
${content}

Generate questions that test understanding of key concepts, facts, and applications. Ensure wrong answers are plausible but clearly incorrect to someone who understands the material.`;

  try {
    console.log('[Quiz] Calling LLM API...');
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
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Quiz] LLM API error:', response.status, errorText);
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let responseContent = data.choices[0]?.message?.content;

    console.log('[Quiz] Raw response length:', responseContent?.length);
    console.log('[Quiz] Raw response preview:', responseContent?.substring(0, 200));

    if (!responseContent) {
      throw new Error('No content received from LLM API');
    }

    // Parse the JSON response
    let jsonContent = responseContent.trim();
    
    // Try to extract JSON array from various formats
    const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
      console.log('[Quiz] Extracted JSON array from response');
    }

    // Remove any markdown code block wrapper if present
    jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```$/g, '').trim();

    console.log('[Quiz] JSON to parse:', jsonContent.substring(0, 200));

    const questions = JSON.parse(jsonContent);
    console.log('[Quiz] Successfully parsed', questions.length, 'questions');
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error('[Quiz] Failed to generate quiz:', error);
    return [];
  }
}
