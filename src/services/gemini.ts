import { GoogleGenAI, Type, Modality } from '@google/genai';
import { PracticeSession, VocabItem } from '../types';

const practiceSessionSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A fun title for the practice session' },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, description: "'multiple_choice' or 'fill_in_blank'" },
          question: { type: Type.STRING, description: "The question text. For fill_in_blank, use '___' for the blank." },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Provide 3-4 options if type is multiple_choice. Empty array otherwise."
          },
          correctAnswer: { type: Type.STRING, description: "The correct answer" },
          explanation: { type: Type.STRING, description: "A short, encouraging explanation of why this is the answer." },
          word: { type: Type.STRING, description: "The vocabulary word being tested in this question." },
          meaning: { type: Type.STRING, description: "The Chinese meaning of the vocabulary word." }
        },
        required: ["id", "type", "question", "options", "correctAnswer", "explanation", "word", "meaning"]
      }
    }
  },
  required: ["title", "questions"]
};

export const generatePractice = async (
  vocabList: VocabItem[],
  model: string,
  onProgress?: (current: number, total: number) => void
): Promise<PracticeSession> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Limit to max 1000 words
  const limitedVocabList = vocabList.slice(0, 1000);
  const BATCH_SIZE = 30;
  const batches: VocabItem[][] = [];
  
  for (let i = 0; i < limitedVocabList.length; i += BATCH_SIZE) {
    batches.push(limitedVocabList.slice(i, i + BATCH_SIZE));
  }

  let allQuestions: any[] = [];
  let sessionTitle = 'Super Word Explorer Challenge!';

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    if (onProgress) {
      onProgress(Math.min((i * BATCH_SIZE) + BATCH_SIZE, limitedVocabList.length), limitedVocabList.length);
    }

    const prompt = `
      I want to help my child remember English words and phrases well.
      Here is the list of vocabulary words and their Chinese meanings:
      ${batch.map(v => `- Word/Phrase: "${v.word}" | Meaning: "${v.meaning}"`).join('\n')}

      Please generate an active practice session for a child.
      Include a fun, adventurous title (like "Super Adventure Word Challenge", "Epic Word Expedition", or "Galaxy Vocab Mission").
      IMPORTANT: You MUST generate exactly ONE question for EACH word in the list above. There are ${batch.length} words, so you must generate exactly ${batch.length} questions.
      Create a mix of 'multiple_choice' and 'fill_in_blank' questions in English.
      For 'fill_in_blank', use '___' to represent the blank space.
      For 'multiple_choice', provide 3 to 4 options in English.
      Make the sentences kid-friendly, engaging, and easy to understand.
      Provide a short, encouraging explanation for the correct answer. You can use the Chinese meaning in the explanation to help them understand.
      IMPORTANT: You must include the exact 'word' and 'meaning' from the list for each question you generate.
    `;

    let retries = 3;
    let success = false;
    let lastError: any = null;

    while (retries > 0 && !success) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: practiceSessionSchema
          }
        });

        const text = response.text;
        if (!text) {
          throw new Error('Failed to generate practice session.');
        }

        const parsed = JSON.parse(text) as PracticeSession;
        allQuestions = allQuestions.concat(parsed.questions);
        
        if (i === 0) {
          sessionTitle = parsed.title;
        }
        success = true;
      } catch (err: any) {
        lastError = err;
        retries--;
        if (retries > 0) {
          // Exponential backoff: 15s, 30s
          const waitTime = (4 - retries) * 15000;
          console.warn(`Rate limited or error occurred. Retrying in ${waitTime/1000}s...`, err.message);
          await delay(waitTime);
        }
      }
    }

    if (!success) {
      console.error('Failed after retries:', lastError);
      if (lastError?.status === 429 || lastError?.message?.toLowerCase().includes('quota') || lastError?.message?.toLowerCase().includes('429')) {
        throw new Error('AI quota exceeded. You may have hit your daily limit. Please check your billing details at https://ai.google.dev/gemini-api/docs/rate-limits or try again later.');
      }
      throw lastError || new Error('Failed to generate practice session after multiple attempts.');
    }

    // Add a larger delay between batches to prevent rate limiting
    if (i < batches.length - 1) {
      await delay(3000);
    }
  }

  return {
    id: crypto.randomUUID(),
    title: sessionTitle,
    questions: allQuestions,
    createdAt: Date.now(),
    originalVocab: vocabList
  };
};

export const extractVocabFromPDF = async (base64Pdf: string, model: string): Promise<VocabItem[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze the provided PDF document and extract the key English vocabulary words.
    For each English word, provide its exact 1:1 Chinese translation.
    Return a JSON array of objects, where each object has a 'word' (the English word) and a 'meaning' (the Chinese translation).
  `;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let retries = 3;
  let lastError: any = null;

  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                meaning: { type: Type.STRING }
              },
              required: ["word", "meaning"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Failed to extract vocabulary from PDF.');
      }

      const items = JSON.parse(text) as { word: string, meaning: string }[];
      return items.map(item => ({
        id: crypto.randomUUID(),
        word: item.word,
        meaning: item.meaning
      }));
    } catch (err: any) {
      lastError = err;
      retries--;
      if (retries > 0) {
        // Exponential backoff: 15s, 30s
        const waitTime = (4 - retries) * 15000;
        console.warn(`Rate limited or error occurred. Retrying in ${waitTime/1000}s...`, err.message);
        await delay(waitTime);
      }
    }
  }

  console.error('Failed to extract from PDF after retries:', lastError);
  if (lastError?.status === 429 || lastError?.message?.toLowerCase().includes('quota') || lastError?.message?.toLowerCase().includes('429')) {
    throw new Error('AI quota exceeded. You may have hit your daily limit. Please check your billing details at https://ai.google.dev/gemini-api/docs/rate-limits or try again later.');
  }
  throw lastError || new Error('Failed to extract vocabulary from PDF after multiple attempts.');
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Failed to generate audio');
  }

  return base64Audio;
};
