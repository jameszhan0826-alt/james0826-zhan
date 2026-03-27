import { VocabItem, PracticeSession, PracticeQuestion } from '../types';

/**
 * Generates a practice session locally without calling the AI.
 * This is useful for quick reviews and when the AI is slow or unavailable.
 */
export const generateLocalPractice = (
  vocabList: VocabItem[], 
  title: string
): PracticeSession => {
  // If we have very few words, we might need to pull from a larger pool for distractors
  // But for now, we'll just use what's available in the list
  
  const questions: PracticeQuestion[] = vocabList.flatMap(item => {
    const otherItems = vocabList.filter(v => v.id !== item.id);
    const shuffledOthers = [...otherItems].sort(() => 0.5 - Math.random());
    
    // 1. Multiple Choice Question
    const options = [item.meaning, ...shuffledOthers.slice(0, 3).map(v => v.meaning)];
    // Add some generic distractors if we don't have enough words
    while (options.length < 4) {
      options.push(`Distractor ${options.length}`);
    }
    
    const mcQuestion: PracticeQuestion = {
      id: crypto.randomUUID(),
      type: 'multiple_choice',
      question: `Translate the underlined word: This is a _${item.word}_.`,
      options: options.sort(() => 0.5 - Math.random()),
      correctAnswer: item.meaning,
      explanation: `The word "${item.word}" means "${item.meaning}".`,
      word: item.word,
      meaning: item.meaning,
      imageUrl: item.imageUrl
    };

    // 2. Fill-in-blank Question
    const fibQuestion: PracticeQuestion = {
      id: crypto.randomUUID(),
      type: 'fill_in_blank',
      question: `${item.meaning}: ___`,
      options: [],
      correctAnswer: item.word,
      explanation: `The English word for "${item.meaning}" is "${item.word}".`,
      word: item.word,
      meaning: item.meaning,
      imageUrl: item.imageUrl
    };

    return [mcQuestion, fibQuestion];
  });

  return {
    id: crypto.randomUUID(),
    title: `⚡ ${title}`,
    questions: questions.sort(() => 0.5 - Math.random()),
    createdAt: Date.now(),
    originalVocab: vocabList
  };
};
