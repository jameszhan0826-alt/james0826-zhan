export interface VocabItem {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  exampleTranslation?: string;
  imageUrl?: string;
}

export interface SavedVocabList {
  id: string;
  title: string;
  words: VocabItem[];
  createdAt: number;
  category?: 'NCE' | 'PET' | 'General' | 'MistakeBook';
}

export type QuestionType = 'multiple_choice' | 'fill_in_blank' | 'sentence_translation';

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  memoryTip?: string;
  word?: string;
  meaning?: string;
  example?: string;
  exampleTranslation?: string;
  imageUrl?: string;
}

export interface PracticeSession {
  id: string;
  title: string;
  questions: PracticeQuestion[];
  createdAt: number;
  bestScore?: number;
  isPassed?: boolean;
  isMastered?: boolean;
  lastAttempted?: number;
  originalVocab?: VocabItem[];
  wordsToReview?: string[];
  category?: 'NCE' | 'PET' | 'General' | 'MistakeBook';
}

export interface AdvancedOptions {
  customMemoryTips?: string;
  supportGrammarExam?: boolean;
  supportZhongkao?: boolean;
  batchSize?: number;
}

export interface WordProgress {
  word: string;
  meaning: string;
  attempts: number;
  correct: number;
  lastAttempted: number;
  isMastered?: boolean;
}
