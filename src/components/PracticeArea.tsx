import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, Download, FileDown, Volume2, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { PracticeSession, PracticeQuestion, WordProgress, VocabItem } from '../types';
import { printToPDF } from '../utils/pdf';
import { playHighQualityAudio } from '../utils/audio';

interface PracticeAreaProps {
  session: PracticeSession;
  vocabList: VocabItem[];
  wordProgress: Record<string, WordProgress>;
  onRestart: () => void;
  onComplete?: (score: number, total: number, failedQuestions: PracticeQuestion[]) => void;
  onMoveToMastered?: () => void;
  onPowerUp?: (words: VocabItem[]) => void;
  onQuickReview?: (words: VocabItem[]) => void;
  userRole?: 'student' | 'teacher';
}

const normalizeAnswer = (text: string) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'") // Normalize various apostrophes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '"') // Normalize various quotes
    .replace(/[.,!?;:]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Normalize multiple spaces to single space
    .replace(/n't/g, " not") // Expand contractions
    .replace(/'m/g, " am")
    .replace(/'re/g, " are")
    .replace(/'s/g, " is")
    .replace(/'ve/g, " have")
    .replace(/'ll/g, " will")
    .replace(/'d/g, " would")
    .trim();
};

export const PracticeArea: React.FC<PracticeAreaProps> = ({ session, vocabList, wordProgress, onRestart, onComplete, onMoveToMastered, onPowerUp, onQuickReview, userRole }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [failedQuestions, setFailedQuestions] = useState<PracticeQuestion[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewingSession, setIsReviewingSession] = useState(true);
  const [showBreak, setShowBreak] = useState(false);
  const [breakTimer, setBreakTimer] = useState(10);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);

  if (!session || !session.questions || session.questions.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto p-12 bg-white rounded-3xl shadow-lg border border-slate-100 text-center">
        <h2 className="text-3xl font-black text-slate-800 mb-4">Oops! No Questions Found</h2>
        <p className="text-slate-600 mb-8 font-medium">Something went wrong while generating your quest. Please try again!</p>
        <button
          onClick={onRestart}
          className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-3 mx-auto"
        >
          <ArrowRight size={24} />
          <span>Back to Menu</span>
        </button>
      </div>
    );
  }

  const question = session.questions[currentIndex];

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null || !question) return; // Prevent multiple answers or crash if question is missing

    setSelectedAnswer(answer);
    
    const normalizedUser = normalizeAnswer(answer);
    const normalizedCorrect = normalizeAnswer(question.correctAnswer);
    
    // For multiple choice, we still want a relatively strict match but normalized
    // For fill in blank, we want the normalized match
    const correct = normalizedUser === normalizedCorrect;
    
    setIsCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
    } else {
      setFailedQuestions((prev) => [...prev, question]);
    }
  };

  const handleNext = () => {
    const nextAnswered = questionsAnswered + 1;
    setQuestionsAnswered(nextAnswered);

    if (nextAnswered % 10 === 0 && currentIndex < session.questions.length - 1) {
      setShowBreak(true);
      setBreakTimer(10);
      const interval = setInterval(() => {
        setBreakTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      setIsFinished(true);
      if (onComplete) {
        onComplete(score, session.questions.length, failedQuestions);
      }
    }
  };

  const handleDownloadPDF = (withAnswers: boolean) => {
    let htmlContent = `<div style="text-align: center; padding-top: 30vh;">
      <h1 style="font-size: 36px; margin-bottom: 10px;">${session.title}</h1>
      <h2 style="color: #64748b; font-weight: normal;">${withAnswers ? '(Teacher PDF)' : '(Student PDF)'}</h2>
    </div>`;

    htmlContent += `
      <div class="html2pdf__page-break"></div>
      <h2 style="color: #4f46e5; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${session.title}</h2>
    `;

    session.questions.forEach((q, index) => {
      htmlContent += `
        <div class="question">
          <div class="q-text">${index + 1}. ${q.question}</div>
      `;
      
      if (q.type === 'multiple_choice' || q.type === 'sentence_translation') {
        htmlContent += `<div class="options">`;
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          htmlContent += `<div class="option">${letter}) ${opt}</div>`;
        });
        htmlContent += `</div>`;
      }
      
      if (withAnswers) {
        htmlContent += `
          <div class="answer-box">
            <div class="answer">Answer: ${q.correctAnswer}</div>
            <div class="explanation">${q.explanation}</div>
          </div>
        `;
      } else {
        if (q.type === 'fill_in_blank') {
          htmlContent += `<div style="margin-top: 20px; border-bottom: 1px solid #cbd5e1; width: 200px;"></div>`;
        }
      }
      
      htmlContent += `</div>`;
    });

    printToPDF(htmlContent, `${session.title}_${withAnswers ? 'Teacher_PDF' : 'Student_PDF'}`);
  };

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playAudio = async (text: string, lang: string = 'en-US') => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const cleanText = text.replace(/___/g, 'blank').replace(/_/g, '');
      await playHighQualityAudio(cleanText, lang);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  if (isFinished) {
    const percentage = (score / session.questions.length) * 100;
    const isPassed = percentage >= 80;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-lg border border-slate-100 text-center relative overflow-hidden"
      >
        {isPassed && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
            <span className="text-[200px]">🎉</span>
          </div>
        )}
        <div className="flex justify-center mb-6 relative z-10">
          <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-inner ${isPassed ? 'bg-gradient-to-br from-yellow-100 to-yellow-300' : 'bg-gradient-to-br from-amber-100 to-amber-200'}`}>
            {isPassed ? (
              <Trophy size={56} className="text-yellow-600 drop-shadow-sm" />
            ) : (
              <RefreshCw size={56} className="text-amber-600 drop-shadow-sm" />
            )}
          </div>
        </div>
        <h2 className="text-5xl font-black text-slate-800 mb-4 relative z-10">
          {isPassed ? 'Quest Complete! 🌟' : 'Almost There! 💪'}
        </h2>
        <p className="text-2xl text-slate-600 mb-6 relative z-10 font-medium">
          You scored <span className={`font-black text-3xl ${isPassed ? 'text-emerald-500' : 'text-amber-500'}`}>{score}</span> out of <span className="font-black text-3xl">{session.questions.length}</span>!
        </p>
        
        {!isPassed && failedQuestions.length > 0 && (
          <div className="mb-8 p-6 bg-amber-50 rounded-2xl border-2 border-amber-200 text-amber-800 relative z-10">
            <p className="font-bold text-lg mb-2">You missed {failedQuestions.length} questions.</p>
            <div className="flex flex-wrap justify-center gap-2 my-4">
              {Array.from(new Set(failedQuestions.map(q => q.word).filter(Boolean))).map((word, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-white text-amber-700 text-sm font-bold rounded-xl border-2 border-amber-200 shadow-sm">
                  {word}
                </span>
              ))}
            </div>
            
            {(() => {
              const sessionWords = Array.from(new Set(session.questions.map(q => q.word?.toLowerCase()).filter(Boolean))) as string[];
              const powerUpWords = sessionWords
                .map(w => wordProgress[w])
                .filter(p => p && p.attempts >= 3 && (p.correct / p.attempts) < 0.5);

              if (powerUpWords.length > 0) {
                return (
                  <div className="mt-6 pt-6 border-t border-amber-200">
                    <div className="flex items-center justify-center gap-2 mb-4 text-amber-700">
                      <AlertCircle size={20} />
                      <span className="font-black uppercase tracking-wider">💪 Power Up Needed!</span>
                    </div>
                    <p className="text-sm mb-4">These words are tricky for you. Want to focus on them right now?</p>
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {powerUpWords.map((p, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-black rounded-lg border border-amber-300">
                          {p.word}
                        </span>
                      ))}
                    </div>
                    {onPowerUp && session.originalVocab && (
                      <div className="flex flex-col gap-2 w-full">
                        {onQuickReview && (
                          <button
                            onClick={() => {
                              const vocabToPowerUp = session.originalVocab!.filter(v => 
                                powerUpWords.some(p => p.word.toLowerCase() === v.word.toLowerCase())
                              );
                              onQuickReview(vocabToPowerUp);
                            }}
                            className="w-full py-3 bg-amber-100 text-amber-700 font-black rounded-xl hover:bg-amber-200 transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            <Zap size={18} />
                            <span>Quick Power Up (Instant)</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const vocabToPowerUp = session.originalVocab!.filter(v => 
                              powerUpWords.some(p => p.word.toLowerCase() === v.word.toLowerCase())
                            );
                            onPowerUp(vocabToPowerUp);
                          }}
                          className="w-full py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={18} />
                          <span>AI Power Up Quest (Better)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              return <p className="font-medium">You can retry this quest from your "My Backpack" list to master these words!</p>;
            })()}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors shadow-sm flex items-center justify-center gap-3 text-lg"
          >
            <ArrowRight size={24} />
            <span>Back to Menu</span>
          </button>
          
          {isPassed && !session.isMastered && onMoveToMastered && (
            <button
              onClick={onMoveToMastered}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-black rounded-2xl hover:from-emerald-500 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-1 flex items-center justify-center gap-3 text-lg"
            >
              <CheckCircle2 size={28} />
              <span>Mastered!</span>
            </button>
          )}

          <button
            onClick={() => handleDownloadPDF(false)}
            className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-200 font-bold rounded-2xl hover:bg-indigo-50 transition-colors shadow-sm flex items-center justify-center gap-3 text-lg"
          >
            <FileDown size={24} />
            <span>Student PDF</span>
          </button>

          {userRole === 'teacher' && (
            <button
              onClick={() => handleDownloadPDF(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-purple-600 border-2 border-purple-200 font-bold rounded-2xl hover:bg-purple-50 transition-colors shadow-sm flex items-center justify-center gap-3 text-lg"
            >
              <FileDown size={24} />
              <span>Teacher PDF</span>
            </button>
          )}
        </div>

        {(() => {
          const globalTrickyWords = (Object.values(wordProgress) as WordProgress[])
            .filter(p => p.attempts >= 3 && (p.correct / p.attempts) < 0.5)
            .map(p => p.word.toLowerCase());
          
          if (globalTrickyWords.length > 0 && onPowerUp) {
            const trickyVocab = (Object.values(wordProgress) as WordProgress[])
              .filter(p => p.attempts >= 3 && (p.correct / p.attempts) < 0.5)
              .map(p => {
                const existing = vocabList.find(v => v.word.toLowerCase() === p.word.toLowerCase());
                if (existing) return existing;
                return {
                  id: crypto.randomUUID(),
                  word: p.word,
                  meaning: p.meaning
                } as VocabItem;
              });
            
            return (
              <div className="mt-10 pt-8 border-t-2 border-slate-100 relative z-10">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border-2 border-indigo-100">
                  <div className="flex items-center justify-center gap-3 mb-4 text-indigo-700">
                    <Sparkles size={24} className="text-indigo-500" />
                    <h3 className="text-xl font-black uppercase tracking-tight">Global Review Challenge!</h3>
                  </div>
                  <p className="text-slate-600 mb-6 font-medium">
                    You have <span className="text-indigo-600 font-bold">{trickyVocab.length}</span> words in your "Review 💪" list across all quests. Ready to conquer them?
                  </p>
                  <div className="flex flex-col gap-3">
                    {onQuickReview && (
                      <button
                        onClick={() => onQuickReview(trickyVocab)}
                        className="w-full py-4 bg-white text-indigo-600 border-2 border-indigo-200 font-black rounded-2xl hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center gap-3 text-lg"
                      >
                        <Zap size={24} />
                        <span>Quick Global Review (Instant)</span>
                      </button>
                    )}
                    <button
                      onClick={() => onPowerUp(trickyVocab)}
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
                    >
                      <RefreshCw size={24} />
                      <span>AI Global Review Quest (Better)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </motion.div>
    );
  }

  // Get review items for the entire session.
  const reviewItems = session.originalVocab 
    ? session.originalVocab.slice(0, session.questions.length).map(v => ({ 
        word: v.word, 
        meaning: v.meaning, 
        imageUrl: v.imageUrl,
        example: v.example,
        exampleTranslation: v.exampleTranslation
      }))
    : session.questions.map(q => ({ 
        word: q.word || 'Unknown Word', 
        meaning: q.meaning || 'Unknown Meaning',
        imageUrl: q.imageUrl,
        example: q.example,
        exampleTranslation: q.exampleTranslation
      }));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-lg border border-slate-100 relative">
      <AnimatePresence>
        {showBreak && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white/98 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-8 text-center overflow-hidden"
          >
            {/* Confetti-like particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: Math.random() * 400 - 200, 
                  y: Math.random() * 400 - 200, 
                  scale: 0,
                  rotate: 0 
                }}
                animate={{ 
                  x: Math.random() * 600 - 300, 
                  y: Math.random() * 600 - 300, 
                  scale: [0, 1, 0],
                  rotate: 360 
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  delay: Math.random() * 2,
                  ease: "easeInOut"
                }}
                className={`absolute w-4 h-4 rounded-full opacity-20 ${
                  ['bg-yellow-400', 'bg-indigo-400', 'bg-pink-400', 'bg-emerald-400'][i % 4]
                }`}
              />
            ))}

            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="space-y-6 relative z-10"
            >
              <div className="w-56 h-56 mx-auto rounded-full overflow-hidden border-8 border-indigo-50 shadow-2xl relative">
                <img 
                  src="https://picsum.photos/seed/celebrate/400/400" 
                  alt="Congratulations!" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent"></div>
              </div>
              
              <div className="space-y-2">
                <motion.h3 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  Amazing Progress! 🏆
                </motion.h3>
                <p className="text-xl text-slate-600 font-bold">
                  You've crushed 10 questions!
                </p>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Brain Recharge Timer</p>
                <div className="text-7xl font-black text-indigo-600 tabular-nums">
                  {breakTimer}s
                </div>
              </div>

              {breakTimer === 0 && (
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowBreak(false)}
                  className="px-12 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl hover:shadow-2xl transition-all shadow-lg flex items-center gap-3 mx-auto text-xl"
                >
                  <span>Continue the Quest!</span>
                  <ArrowRight size={28} />
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold text-indigo-600">{session.title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadPDF(false)}
            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
            title="Download Student PDF"
          >
            <FileDown size={20} />
          </button>
          {userRole === 'teacher' && (
            <button
              onClick={() => handleDownloadPDF(true)}
              className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors"
              title="Download Teacher PDF"
            >
              <FileDown size={20} />
            </button>
          )}
          {!isReviewingSession && (
            <div className="px-4 py-2 bg-slate-100 rounded-full text-sm font-semibold text-slate-600 whitespace-nowrap">
              Question {currentIndex + 1} of {session.questions.length}
            </div>
          )}
        </div>
      </div>

      {!isReviewingSession && (
        <div className="mb-8">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / session.questions.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isReviewingSession && reviewItems.length > 0 ? (
          <motion.div
            key="session-review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-[300px] flex flex-col items-center justify-center text-center"
          >
            <h3 className="text-2xl text-slate-600 mb-6 font-bold flex items-center gap-2">
              <span>👀</span> Words to Learn ({reviewItems.length}) <span>👀</span>
            </h3>
            
            <div className="w-full max-w-lg space-y-4 mb-10 text-left">
              {reviewItems.map((item, idx) => (
                <div key={idx} className="p-5 bg-indigo-50 rounded-2xl border-2 border-indigo-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                  {item?.imageUrl && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                      <img 
                        src={item.imageUrl} 
                        alt={item.word} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="text-2xl font-black text-indigo-700">{item.word}</h4>
                    <p className="text-slate-600 mt-1 font-medium">{item.meaning}</p>
                    {item.example && (
                      <div className="mt-2 p-2 bg-white/50 rounded-lg border border-indigo-100">
                        <p className="text-sm text-indigo-600 italic">"{item.example}"</p>
                        {item.exampleTranslation && (
                          <p className="text-xs text-slate-500 mt-1">{item.exampleTranslation}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => playAudio(item.word, 'en-US')}
                      className="p-3 text-indigo-500 hover:bg-indigo-200 bg-indigo-100 rounded-xl transition-colors"
                      title="Listen to word"
                    >
                      <Volume2 size={24} />
                    </button>
                    <button
                      onClick={() => playAudio(item.meaning, 'zh-CN')}
                      className="p-3 text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
                      title="Listen to meaning"
                    >
                      <Volume2 size={24} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsReviewingSession(false)}
              className="px-10 py-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black rounded-2xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-3 text-xl"
            >
              <span>Start Quest!</span>
              <ArrowRight size={28} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={`question-${currentIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-[300px]"
          >
            <div className="flex flex-col gap-6 mb-8">
              {question?.imageUrl && (
                <div className="w-full max-w-xs mx-auto aspect-square rounded-3xl overflow-hidden border-4 border-indigo-100 shadow-lg">
                  <img 
                    src={question.imageUrl} 
                    alt="Visual clue" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              
              <div className="flex items-start gap-4 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 relative">
                {question?.word && session.wordsToReview?.includes(question.word) && (
                  <div className="absolute -top-3 -left-3 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border-2 border-amber-200 flex items-center gap-1 shadow-sm">
                    <AlertCircle size={14} />
                    Needs Review: {question.word}
                  </div>
                )}
                {question?.type === 'sentence_translation' && (
                  <div className="absolute -top-3 left-6 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-md">
                    Translate to English 句子翻译
                  </div>
                )}
                <h3 className="text-3xl font-bold text-slate-800 leading-relaxed flex-1 mt-2">
                {question?.question.split('___').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part.split(/_([^_]+)_/).map((subPart, j) => (
                      j % 2 === 1 ? (
                        <u key={j} className="underline decoration-indigo-400 decoration-4 underline-offset-4">{subPart}</u>
                      ) : (
                        <span key={j}>{subPart}</span>
                      )
                    ))}
                    {i < arr.length - 1 && (
                      <span className="inline-block w-24 border-b-4 border-indigo-400 mx-2 align-baseline" />
                    )}
                  </React.Fragment>
                ))}
              </h3>
                <button
                  onClick={() => {
                    if (!question) return;
                    const lang = question.type === 'sentence_translation' ? 'zh-CN' : 'en-US';
                    playAudio(question.question, lang);
                  }}
                  className="p-4 text-indigo-500 bg-white hover:bg-indigo-50 rounded-2xl transition-all shadow-sm hover:shadow-md shrink-0 border-2 border-indigo-100"
                  title="Listen to question"
                >
                <Volume2 size={28} />
              </button>
            </div>
            {question?.memoryTip && (
              <div className="mt-4 p-4 bg-purple-50 rounded-2xl border-2 border-purple-100 text-purple-800 flex items-center gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <p className="font-bold text-sm uppercase tracking-wider text-purple-600">Memory Tip</p>
                  <p className="font-medium">{question.memoryTip}</p>
                </div>
              </div>
            )}
          </div>

          {question?.type === 'multiple_choice' || question?.type === 'sentence_translation' ? (
            <div className={`grid gap-4 ${question?.type === 'sentence_translation' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {question?.options?.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === question?.correctAnswer;
                
                let buttonClass = "p-5 rounded-2xl border-4 text-left font-bold transition-all text-xl shadow-sm hover:shadow-md ";
                
                if (selectedAnswer === null) {
                  buttonClass += "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:-translate-y-1";
                } else if (isSelected && isCorrect) {
                  buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700 scale-[1.02]";
                } else if (isSelected && !isCorrect) {
                  buttonClass += "border-red-500 bg-red-50 text-red-700";
                } else if (isCorrectOption) {
                  buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700";
                } else {
                  buttonClass += "border-slate-200 bg-slate-50 text-slate-400 opacity-50";
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {selectedAnswer !== null && isCorrectOption && <CheckCircle2 size={28} className="text-emerald-500" />}
                      {isSelected && !isCorrect && <XCircle size={28} className="text-red-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Type your answer here..."
                disabled={selectedAnswer !== null}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleAnswer(e.currentTarget.value.trim());
                  }
                }}
                className={`w-full p-6 rounded-2xl border-4 text-2xl font-bold transition-all focus:outline-none shadow-sm ${
                  selectedAnswer === null
                    ? 'border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 placeholder:text-slate-300'
                    : isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-red-500 bg-red-50 text-red-700'
                }`}
              />
              {selectedAnswer !== null && !isCorrect && (
                <div className="p-6 bg-emerald-50 border-4 border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-4 shadow-sm">
                  <CheckCircle2 size={32} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold text-lg">The correct answer is:</p>
                    <p className="text-2xl font-black text-emerald-600">{question.correctAnswer}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {selectedAnswer !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-indigo-50 rounded-3xl border-2 border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm"
              >
                <div className="flex-1 flex items-start gap-4">
                  <div className="text-3xl mt-1">💡</div>
                  <div className="flex-1">
                    <p className="text-indigo-900 font-bold text-lg leading-relaxed">{question.explanation}</p>
                    {question.example && (
                      <div className="mt-3 p-3 bg-white/60 rounded-xl border border-indigo-200">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-indigo-700 italic font-medium">"{question.example}"</p>
                          <button 
                            onClick={() => playAudio(question.example!, 'en-US')}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="Listen to example"
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                        {question.exampleTranslation && (
                          <p className="text-xs text-slate-500 mt-1">{question.exampleTranslation}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => playAudio(question.explanation, 'en-US')}
                    className="p-3 text-indigo-500 hover:bg-indigo-200 bg-white rounded-xl transition-colors shrink-0 shadow-sm"
                    title="Listen to explanation"
                  >
                    <Volume2 size={24} />
                  </button>
                </div>
                <button
                  onClick={handleNext}
                  className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black rounded-2xl hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-3 shrink-0 shadow-md hover:shadow-lg hover:-translate-y-1 text-xl"
                >
                  <span>{currentIndex < session.questions.length - 1 ? 'Next Question!' : 'Finish Quest!'}</span>
                  <ArrowRight size={28} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
