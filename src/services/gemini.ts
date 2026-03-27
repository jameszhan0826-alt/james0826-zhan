import { GoogleGenAI, Type, Modality } from '@google/genai';
import { PracticeSession, VocabItem, AdvancedOptions } from '../types';

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
          type: { type: Type.STRING, description: "'multiple_choice', 'fill_in_blank', or 'sentence_translation'" },
          question: { type: Type.STRING, description: "The question text. For fill_in_blank, use '___' for the blank." },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Provide 3-4 options if type is multiple_choice or sentence_translation. Empty array otherwise."
          },
          correctAnswer: { type: Type.STRING, description: "The correct answer" },
          explanation: { type: Type.STRING, description: "A short, encouraging explanation of why this is the answer." },
          memoryTip: { type: Type.STRING, description: "A short, fun mnemonic or memory tip to help remember the word." },
          word: { type: Type.STRING, description: "The vocabulary word being tested in this question." },
          meaning: { type: Type.STRING, description: "The Chinese meaning of the vocabulary word." }
        },
        required: ["id", "type", "question", "options", "correctAnswer", "explanation", "memoryTip", "word", "meaning"]
      }
    }
  },
  required: ["title", "questions"]
};

const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  
  let errObj = err;
  if (typeof err === 'string') {
    try {
      errObj = JSON.parse(err);
    } catch (e) {
      // Not JSON
    }
  }

  const errStr = JSON.stringify(errObj).toLowerCase();
  const message = (errObj.message || (typeof err === 'string' ? err : '')).toLowerCase();
  
  return (
    message.includes('429') || 
    message.includes('quota') || 
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    errObj.status === 429 ||
    errObj.code === 429 ||
    errObj.error?.code === 429 ||
    errObj.error?.status === 'RESOURCE_EXHAUSTED' ||
    errObj.error?.message?.toLowerCase().includes('quota') ||
    errStr.includes('429') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('quota') ||
    errStr.includes('rate limit') ||
    (typeof errObj === 'object' && errObj !== null && (errObj.code === 429 || errObj.status === 429))
  );
};

export const generatePractice = async (
  vocabList: VocabItem[],
  model: string,
  onProgress?: (current: number, total: number) => void,
  questTitle?: string,
  batchDelay: number = 3000,
  advancedOptions?: AdvancedOptions,
  onStatus?: (status: string | null) => void
): Promise<PracticeSession> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Limit to max 1000 words
  const limitedVocabList = vocabList.slice(0, 1000);
  if (!limitedVocabList || limitedVocabList.length === 0) {
    throw new Error('No words selected for practice. Please select some words first!');
  }

  const BATCH_SIZE = advancedOptions?.batchSize || 1; // Use advancedOptions.batchSize if provided, else default to 1
  const batches: VocabItem[][] = [];
  
  for (let i = 0; i < limitedVocabList.length; i += BATCH_SIZE) {
    batches.push(limitedVocabList.slice(i, i + BATCH_SIZE));
  }

  console.log(`Generating practice for ${limitedVocabList.length} words in ${batches.length} batches...`);

  let allQuestions: any[] = [];
  let sessionTitle = questTitle || 'Super Word Explorer Challenge!';

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to fix common JSON issues from cut-off AI responses
  const tryParseJson = (text: string) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('Initial JSON parse failed, attempting to fix...', e);
      // Try to fix common issues like missing closing braces/brackets
      let fixed = text.trim();
      
      // If it ends with a comma, remove it
      if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);
      
      // Count braces and brackets
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      // Close open strings if needed (very basic check)
      const quoteCount = (fixed.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) fixed += '"';
      
      // Close objects and arrays
      for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
      for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
      
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        console.error('Failed to fix JSON:', e2);
        throw e; // Throw original error if fix fails
      }
    }
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length}...`);

    const prompt = `
      I want to help my child remember English words and phrases well.
      Here is the list of vocabulary words, their Chinese meanings, and example sentences:
      ${batch.map(v => `- Word/Phrase: "${v.word}" | Meaning: "${v.meaning}" | Example: "${v.example || 'N/A'}" | Example Translation: "${v.exampleTranslation || 'N/A'}"`).join('\n')}

      Please generate an active practice session for a child.
      ${questTitle ? `The title of this session MUST be exactly: "${questTitle}".` : `Include a fun, adventurous title (like "Super Adventure Word Challenge", "Epic Word Expedition", or "Galaxy Vocab Mission").`}
      
      IMPORTANT: You MUST generate exactly THREE questions for EACH word in the list above:
      1. One 'multiple_choice' question for the word meaning.
      2. One 'fill_in_blank' question for the word spelling.
      3. One 'sentence_translation' question for the example sentence (if available).

      FORMAT INSTRUCTIONS:
      For 'multiple_choice' (选择题):
      - The question MUST be an English sentence containing the vocabulary word.
      - You MUST underline the vocabulary word in the sentence using underscores (e.g., "I like to eat _apple_.").
      - The 'correctAnswer' MUST be the Chinese meaning of the vocabulary word.
      - The 'options' MUST be 4 different Chinese meanings (1 correct, 3 incorrect). The correct answer MUST NOT always be the first option.
      ${advancedOptions?.supportGrammarExam ? `- ADVANCED: Make the multiple-choice questions focus on grammar usage (e.g., verb tenses, prepositions) related to the word.` : ''}
      ${advancedOptions?.supportZhongkao ? `- ADVANCED: Style the multiple-choice questions similar to Chinese Zhongkao (中考) English exam questions.` : ''}

      For 'fill_in_blank' (填空题):
      - The question MUST provide the Chinese meaning as a hint, and ask the student to fill in the English word. (e.g., "苹果: ___")
      - The 'correctAnswer' MUST be the English vocabulary word.
      - Use '___' to represent the blank space where the student will type the English word.
      ${advancedOptions?.supportGrammarExam ? `- ADVANCED: The fill-in-the-blank should test the correct grammatical form of the word in a sentence.` : ''}
      ${advancedOptions?.supportZhongkao ? `- ADVANCED: Style the fill-in-the-blank questions similar to Chinese Zhongkao (中考) English exam questions.` : ''}

      For 'sentence_translation' (句子翻译):
      - The question MUST be the Chinese example translation (Example Translation).
      - The student must pick the correct English example sentence (Example) from the options.
      - The 'correctAnswer' MUST be the English example sentence.
      - The 'options' MUST be 4 different English sentences (1 correct, 3 incorrect). The correct answer MUST NOT always be the first option.
      - If no example is available for a word, skip this question type for that word and generate only the first two.
      ${advancedOptions?.supportZhongkao ? `- ADVANCED: Style the sentence translation options similar to Chinese Zhongkao (中考) English exam questions.` : ''}

      Make the sentences kid-friendly, engaging, and easy to understand.
      Provide a short, encouraging explanation for the correct answer.
      Provide a short, fun mnemonic or memory tip for each word to help remember it.
      ${advancedOptions?.customMemoryTips ? `IMPORTANT MEMORY TIP INSTRUCTION: ${advancedOptions.customMemoryTips}` : ''}
      
      IMPORTANT: You must include the exact 'word' and 'meaning' from the list for each question you generate in the 'word' and 'meaning' fields of the JSON.
    `;

    let retries = 3; // Reduced from 5 to 3 to avoid hanging too long on quota errors
    let success = false;
    let lastError: any = null;

    while (retries > 0 && !success) {
      try {
        const response = await ai.models.generateContentStream({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: practiceSessionSchema
          }
        });

        let text = '';
        for await (const chunk of response) {
          if (chunk.text) {
            text += chunk.text;
            if (onProgress) {
              const matchCount = (text.match(/"question"\s*:/g) || []).length;
              onProgress(Math.min(Math.floor(matchCount / 2), batch.length), batch.length);
            }
          }
        }

        if (!text) {
          throw new Error('AI returned an empty response.');
        }

        const parsed = tryParseJson(text) as PracticeSession;
        if (parsed.questions && Array.isArray(parsed.questions)) {
          console.log(`Batch ${i + 1} generated ${parsed.questions.length} questions.`);
          allQuestions = allQuestions.concat(parsed.questions);
        } else {
          console.warn(`Batch ${i + 1} returned no questions in the expected format.`);
          // If it's the last batch and we have nothing, it's an error
          if (allQuestions.length === 0 && i === batches.length - 1) {
            throw new Error('AI returned a response but no questions were found. Please try a different model or smaller batch.');
          }
        }
        
        if (i === 0 && parsed.title && !questTitle) {
          sessionTitle = parsed.title;
        }
        success = true;
      } catch (err: any) {
        lastError = err;
        retries--;
        
        const errStr = JSON.stringify(err);
        const isQuota = isQuotaError(err);
          
        const isNetworkError = 
          err.message?.includes('http status code: 0') || 
          err.message?.includes('Failed to fetch') || 
          err.message?.includes('NetworkError') ||
          err.message?.includes('Rpc failed') ||
          errStr.includes('NetworkError') ||
          errStr.includes('fetch') ||
          errStr.includes('Rpc failed');
        const isJsonError = err instanceof SyntaxError;
        
        console.error(`Error in batch ${i + 1} (Retries left: ${retries}):`, err.message || err);
        
        if (retries > 0) {
          // Exponential backoff for quota errors, longer wait for network errors
          let waitTime = 5000; // Default 5s
          
          if (isQuota) {
            // Exponential backoff: 60s, 120s
            waitTime = (4 - retries) * 60000; 
            if (onStatus) onStatus(`Quota exceeded. Waiting ${waitTime/1000}s before retry...`);
            console.warn(`Quota exceeded. Waiting ${waitTime/1000}s before retry...`);
          } else if (isNetworkError) {
            waitTime = 15000;
            if (onStatus) onStatus(`Network error. Waiting ${waitTime/1000}s before retry...`);
          }
          
          waitTime += (Math.random() * 5000); // Add jitter
          await delay(waitTime);
          if (onStatus) onStatus(null);
        } else {
          if (isQuota) {
            throw new Error('Gemini API Quota Exceeded. You may have hit the daily limit. Please try again tomorrow or use a different API key.');
          }
          if (isNetworkError) {
            throw new Error('Network error while connecting to Gemini. Please check your connection and try again.');
          }
          throw lastError;
        }
      }
    }

    if (!success) {
      throw lastError || new Error('Failed to generate practice session after multiple attempts.');
    }

    if (i < batches.length - 1) {
      await delay(batchDelay);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error('The AI was unable to generate any questions for the selected words. Please try again!');
  }

  // Map imageUrl, example, and exampleTranslation from original vocab to questions
  const questionsWithImages = allQuestions.map(q => {
    const original = vocabList.find(v => v.word.toLowerCase() === q.word?.toLowerCase());
    
    // Shuffle options for multiple choice and sentence translation
    let shuffledOptions = q.options;
    if (q.options && Array.isArray(q.options) && q.options.length > 0) {
      // Ensure the correct answer is in the options if it's missing (rare AI error)
      if (q.correctAnswer && !q.options.includes(q.correctAnswer)) {
        shuffledOptions = [...q.options, q.correctAnswer];
      }
      // Fisher-Yates shuffle
      shuffledOptions = [...shuffledOptions];
      for (let j = shuffledOptions.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffledOptions[j], shuffledOptions[k]] = [shuffledOptions[k], shuffledOptions[j]];
      }
    }

    return { 
      ...q, 
      options: shuffledOptions,
      imageUrl: original?.imageUrl,
      example: original?.example,
      exampleTranslation: original?.exampleTranslation
    };
  });

  console.log(`Total questions generated: ${questionsWithImages.length}`);

  return {
    id: crypto.randomUUID(),
    title: sessionTitle,
    questions: questionsWithImages,
    createdAt: Date.now(),
    originalVocab: vocabList
  };
};

export const extractVocabFromDoc = async (
  input: string | { mimeType: string, data: string }[], 
  mimeType: string, 
  model: string,
  level?: string,
  onStatus?: (status: string | null) => void,
  isGridPattern?: boolean
): Promise<VocabItem[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const basePrompt = `
    Analyze the provided document (which may be a text file, a PDF, or an image containing text, or a collection of these) and extract English vocabulary words/phrases, full sentences, their Chinese meanings, and an example sentence for each with its Chinese translation.
    
    CRITICAL INSTRUCTIONS:
    1. EXTRACT PHRASES & SENTENCES: Do not limit yourself to single words. Extract meaningful English phrases, idioms, and full sentences that are meant to be learned or practiced.
    2. OCR & TABLE RECOGNITION: If the input is an image or PDF, perform high-accuracy OCR. Pay special attention to complex table or grid structures.
    3. PATTERN RECOGNITION: The document structure may follow several patterns:
       Pattern A: [Chinese Meaning] [English Word] (e.g., "永远 forever")
       Pattern B: [English Word] [Chinese Meaning] (e.g., "forever 永远")
       Pattern C: English words in one column/row and Chinese meanings in the next.
       Example of Pattern C (Rows):
       Row 1: "forever, cushion, sock, password, snowboard"
       Row 2: "永远, 软垫, 短袜, 口令, 滑雪板"
       Example of Pattern C (Columns/Table):
       Column 1 (English) | Column 2 (Chinese)
       forever            | 永远
       cushion            | 软垫
       sock               | 短袜
    4. FLEXIBLE IDENTIFICATION: Be intelligent about identifying which text is English and which is Chinese, regardless of the order or layout. If you see a table, the left column is often English and the right is Chinese, but it could be reversed. Use your knowledge of both languages to pair them correctly. Use context like headers (e.g., ①, ②, ③) or unit numbers (1-9) to group related items.
    5. EXAMPLE SENTENCES: Extract the example sentence following the English term if present. If none exists, generate a simple, kid-friendly English example sentence using the word.
    6. EXAMPLE TRANSLATIONS: For each example sentence, provide its Chinese translation.
    7. OUTPUT FORMAT: Return a JSON array of objects: [{"word": "English Word, Phrase, or Sentence", "meaning": "Chinese Meaning(s)", "example": "English example sentence", "exampleTranslation": "Chinese translation of the example sentence"}, ...].
  `;

  const levelSpecificPrompt = (level || isGridPattern) ? `
    8. COMPLEX LAYOUT HANDLING: The document typically has 3 main columns of tables side-by-side, and each of these 3 columns contains 3 units (单元项) stacked vertically. This creates a 3x3 grid of units on the page. Process each table carefully. Do not skip any units. Each unit (单元项) MUST have 5 English words and 5 corresponding Chinese meanings.
    9. DOCUMENT STRUCTURE (66 LEVELS): The document contains 66 levels (关), with one level per page. Each page/level has EXACTLY 9 units (单元项), and each unit contains EXACTLY 5 English words and 5 Chinese meanings. This means there are EXACTLY 45 English-Chinese pairs per page.
    10. SELF-CORRECTION & VERIFICATION: After extracting, count the number of items. If you have fewer than 45 items, re-scan the page to find the missing units or words. You MUST aim for exactly 45 items per page.
    11. LAYOUT HINT: Look for a 3x3 grid of units. Each unit is often numbered 1 through 9. Each unit contains 5 rows of English-Chinese pairs.
    ${level ? `12. TARGET LEVEL: The user wants to extract vocabulary from "${level}". Find the page corresponding to "${level}" and extract all 45 words from its 9 units. Ensure you capture every single word-meaning pair.` : `12. TARGET LEVEL: Extract all 45 words from the provided page.`}
  ` : `
    8. EXTRACTION: Extract ALL vocabulary words, phrases, and sentences from the provided document. Do not miss any items. Process all content you can find.
  `;

  const prompt = basePrompt + levelSpecificPrompt;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let retries = 3;
  let lastError: any = null;

  // Use a more stable model for extraction if the user selected a pro model that might have connection issues
  const modelToUse = model === 'gemini-3.1-pro-preview' ? 'gemini-3-flash-preview' : model;

  let contents: any;
  
  if (Array.isArray(input)) {
    // Handle multiple parts (e.g., text and images from a docx)
    contents = {
      parts: [
        ...input.map(part => {
          if (part.mimeType === 'text/plain') {
            return { text: part.data };
          } else {
            return { inlineData: { mimeType: part.mimeType, data: part.data } };
          }
        }),
        { text: prompt }
      ]
    };
  } else if (mimeType === 'text/plain') {
    try {
      // Better way to decode base64 to UTF-8 string
      const binString = atob(input);
      const bytes = new Uint8Array(binString.length);
      for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
      }
      const decodedText = new TextDecoder().decode(bytes);
      
      contents = {
        parts: [
          { text: `Document Content:\n${decodedText}` },
          { text: prompt }
        ]
      };
    } catch (e) {
      console.warn('Failed to decode text/plain as base64, falling back to inlineData');
      contents = {
        parts: [
          { inlineData: { mimeType, data: input } },
          { text: prompt }
        ]
      };
    }
  } else {
    contents = {
      parts: [
        { inlineData: { mimeType, data: input } },
        { text: prompt }
      ]
    };
  }

  while (retries > 0) {
    try {
      console.log(`Calling Gemini API (${modelToUse}) for extraction...`);
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                meaning: { type: Type.STRING },
                example: { type: Type.STRING, description: "An example sentence in English using the word/phrase/sentence." },
                exampleTranslation: { type: Type.STRING, description: "The Chinese translation of the example sentence." }
              },
              required: ["word", "meaning"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      const items = JSON.parse(text) as { word: string, meaning: string, example?: string, exampleTranslation?: string }[];
      console.log(`Successfully extracted ${items.length} words.`);
      return items.map(item => ({
        id: crypto.randomUUID(),
        word: item.word,
        meaning: item.meaning,
        example: item.example,
        exampleTranslation: item.exampleTranslation
      }));
    } catch (err: any) {
      console.error('Gemini API Error during extraction:', err);
      lastError = err;
      retries--;
      
      const errStr = JSON.stringify(err);
      const isQuota = isQuotaError(err);
      const isNetworkError = 
        err.message?.includes('http status code: 0') || 
        err.message?.includes('Failed to fetch') || 
        err.message?.includes('NetworkError') ||
        err.message?.includes('Rpc failed') ||
        errStr.includes('NetworkError') ||
        errStr.includes('fetch') ||
        errStr.includes('Rpc failed');

      if (retries > 0) {
        let waitTime = (4 - retries) * 5000; // Default linear backoff
        if (isQuota) {
          waitTime = (4 - retries) * 60000; // 60s, 120s
          if (onStatus) onStatus(`Quota exceeded. Waiting ${waitTime/1000}s before retry...`);
          console.warn(`Quota exceeded. Waiting ${waitTime/1000}s before retry...`);
        } else if (isNetworkError) {
          waitTime = 15000;
          if (onStatus) onStatus(`Network error. Waiting ${waitTime/1000}s before retry...`);
        }
        
        waitTime += (Math.random() * 2000); // Add jitter
        await delay(waitTime);
        if (onStatus) onStatus(null);
      } else {
        if (isQuota) {
          throw new Error('Gemini API Quota Exceeded. You may have hit the daily limit. Please try again tomorrow.');
        }
        if (isNetworkError) {
          throw new Error('Network error while connecting to Gemini. Please check your connection and try again.');
        }
        throw lastError;
      }
    }
  }

  if (lastError?.status === 429 || lastError?.message?.toLowerCase().includes('quota')) {
    throw new Error('AI quota exceeded. Please try again later.');
  }
  
  throw new Error(`Failed to extract vocabulary: ${lastError?.message || 'Unknown error'}`);
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const cleanText = text.replace(/___/g, 'blank');
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let retries = 5;
  let lastError: any = null;

  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
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
        console.error('Gemini TTS response:', JSON.stringify(response, null, 2));
        throw new Error('Failed to generate audio');
      }

      return base64Audio;
    } catch (err: any) {
      console.error('Gemini TTS Error:', err);
      lastError = err;
      retries--;
      
      if (retries > 0) {
        const errStr = JSON.stringify(err);
        const isQuotaError = 
          err.message?.includes('429') || 
          err.message?.toLowerCase().includes('quota') || 
          err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.status === 429 ||
          err.code === 429 ||
          err.error?.code === 429 ||
          err.error?.status === 'RESOURCE_EXHAUSTED' ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('quota') ||
          (typeof err === 'object' && err !== null && (err.code === 429 || err.status === 429));
          
        let waitTime = 2000;
        if (isQuotaError) {
          // 30s, 60s, 120s...
          waitTime = Math.pow(2, 6 - retries) * 15000;
          console.warn(`TTS Quota exceeded. Waiting ${waitTime/1000}s before retry...`);
        }
        await delay(waitTime + (Math.random() * 2000));
      } else {
        const errStr = JSON.stringify(err);
        const isQuotaError = 
          err.message?.includes('429') || 
          err.message?.toLowerCase().includes('quota') || 
          err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.status === 429 ||
          err.code === 429 ||
          err.error?.code === 429 ||
          err.error?.status === 'RESOURCE_EXHAUSTED' ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED') ||
          errStr.includes('quota') ||
          (typeof err === 'object' && err !== null && (err.code === 429 || err.status === 429));

        if (isQuotaError) {
          throw new Error('Gemini TTS Quota Exceeded. Please wait a minute before trying again.');
        }
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to generate speech after multiple attempts.');
};
