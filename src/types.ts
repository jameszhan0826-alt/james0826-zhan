export interface VocabItem {
  id: string;
  word: string;
  meaning: string;
}

export interface SavedVocabList {
  id: string;
  title: string;
  words: VocabItem[];
  createdAt: number;
}

export type QuestionType = 'multiple_choice' | 'fill_in_blank';

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  word?: string;
  meaning?: string;
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
}

export interface WordProgress {
  word: string;
  meaning: string;
  attempts: number;
  correct: number;
  lastAttempted: number;
}
