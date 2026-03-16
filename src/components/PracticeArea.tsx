import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, Download, FileDown, Volume2 } from 'lucide-react';
import { PracticeSession, PracticeQuestion } from '../types';
import { printToPDF } from '../utils/pdf';
import { playHighQualityAudio } from '../utils/audio';

interface PracticeAreaProps {
  session: PracticeSession;
  onRestart: () => void;
  onComplete?: (score: number, total: number, failedQuestions: PracticeQuestion[]) => void;
  onMoveToMastered?: () => void;
}

export const PracticeArea: React.FC<PracticeAreaProps> = ({ session, onRestart, onComplete, onMoveToMastered }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [failedQuestions, setFailedQuestions] = useState<PracticeQuestion[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewingSession, setIsReviewingSession] = useState(true);

  const question = session.questions[currentIndex];

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return; // Prevent multiple answers

    setSelectedAnswer(answer);
    const correct = answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
    } else {
      setFailedQuestions((prev) => [...prev, question]);
    }
  };

  const handleNext = () => {
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

  const handleDownloadPDF = () => {
    let htmlContent = `<h1>${session.title}</h1>`;

    session.questions.forEach((q, index) => {
      htmlContent += `
        <div class="question">
          <div class="q-text">${index + 1}. ${q.question}</div>
      `;
      
      if (q.type === 'multiple_choice') {
        htmlContent += `<div class="options">`;
        q.options.forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          htmlContent += `<div class="option">${letter}) ${opt}</div>`;
        });
        htmlContent += `</div>`;
      }
      
      htmlContent += `
          <div class="answer-box">
            <div class="answer">Answer: ${q.correctAnswer}</div>
            <div class="explanation">${q.explanation}</div>
          </div>
        </div>
      `;
    });

    printToPDF(htmlContent, session.title);
  };

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playAudio = async (text: string, lang: string = 'en-US') => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const cleanText = text.replace(/___/g, 'blank');
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
            <p className="font-bold text-lg mb-2">We've created a special review quest with the {failedQuestions.length} questions you missed.</p>
            <p className="font-medium">You can find it in your "My Backpack" list!</p>
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
            onClick={handleDownloadPDF}
            className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-200 font-bold rounded-2xl hover:bg-indigo-50 transition-colors shadow-sm flex items-center justify-center gap-3 text-lg"
          >
            <FileDown size={24} />
            <span>Save as PDF</span>
          </button>
        </div>
      </motion.div>
    );
  }

  // Get review items for the entire session.
  // Prefer the original static vocab list if available, otherwise fallback to mapping questions.
  // We slice it to match the number of questions in case the AI generated fewer questions.
  const reviewItems = session.originalVocab 
    ? session.originalVocab.slice(0, session.questions.length).map(v => ({ word: v.word, meaning: v.meaning }))
    : session.questions.map(q => ({ 
        word: q.word || 'Unknown Word', 
        meaning: q.meaning || 'Unknown Meaning' 
      }));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-lg border border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold text-indigo-600">{session.title}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
            title="Download as PDF"
          >
            <FileDown size={20} />
          </button>
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
                <div key={idx} className="p-5 bg-indigo-50 rounded-2xl border-2 border-indigo-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <h4 className="text-2xl font-black text-indigo-700">{item.word}</h4>
                    <p className="text-slate-600 mt-1 font-medium">{item.meaning}</p>
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
            <div className="flex items-start gap-4 mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
              <h3 className="text-3xl font-bold text-slate-800 leading-relaxed flex-1">
              {question.question.split('___').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="inline-block w-24 border-b-4 border-indigo-400 mx-2 align-baseline" />
                  )}
                </React.Fragment>
              ))}
            </h3>
            <button
              onClick={() => playAudio(question.question, 'en-US')}
              className="p-4 text-indigo-500 bg-white hover:bg-indigo-50 rounded-2xl transition-all shadow-sm hover:shadow-md shrink-0 border-2 border-indigo-100"
              title="Listen to question"
            >
              <Volume2 size={28} />
            </button>
          </div>

          {question.type === 'multiple_choice' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === question.correctAnswer;
                
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
                  <p className="text-indigo-900 font-bold text-lg flex-1 leading-relaxed">{question.explanation}</p>
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
