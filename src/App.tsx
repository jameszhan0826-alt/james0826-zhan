import React, { useState, useEffect } from 'react';
import { VocabInput } from './components/VocabInput';
import { PracticeArea } from './components/PracticeArea';
import { ProgressView } from './components/ProgressView';
import { VocabItem, PracticeSession, SavedVocabList, PracticeQuestion, WordProgress } from './types';
import { generatePractice, extractVocabFromPDF } from './services/gemini';
import { BookOpen, Sparkles, FolderHeart, Play, Trash2, Calendar, FileDown, Trophy, CheckCircle2, TrendingUp, Backpack, Wand2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { printToPDF } from './utils/pdf';

export default function App() {
  const [vocabList, setVocabList] = useState<VocabItem[]>(() => {
    const saved = localStorage.getItem('vocabList');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedSessions, setSavedSessions] = useState<PracticeSession[]>(() => {
    const saved = localStorage.getItem('savedSessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedVocabLists, setSavedVocabLists] = useState<SavedVocabList[]>(() => {
    const saved = localStorage.getItem('savedVocabLists');
    return saved ? JSON.parse(saved) : [];
  });
  const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>(() => {
    const saved = localStorage.getItem('wordProgress');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentView, setCurrentView] = useState<'builder' | 'saved' | 'practice' | 'progress'>('builder');
  const [savedTab, setSavedTab] = useState<'todo' | 'mastered' | 'vocab'>('todo');
  const [questSortOrder, setQuestSortOrder] = useState<'newest' | 'oldest' | 'score-high' | 'score-low' | 'alpha'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearVocabConfirm, setShowClearVocabConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'session' | 'vocabList' } | null>(null);
  
  // Gamification & Daily Notify Mech
  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('dailyStreak');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lastPracticeDate, setLastPracticeDate] = useState<string | null>(() => {
    return localStorage.getItem('lastPracticeDate');
  });
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-flash-preview');
  const [batchSize, setBatchSize] = useState<number>(5);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if ((username === 'admin' && password === 'pass') || (username === 'james' && password === 'pass')) {
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setUsername('');
    setPassword('');
  };

  const handleNotify = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Vocab Quest 🚀', {
            body: 'Time to level up your brain! Come back and practice your words!',
            icon: 'https://cdn-icons-png.flaticon.com/512/3106/3106180.png'
          });
        } else {
          alert('Please enable notifications in your browser settings to receive fun reminders!');
        }
      });
    } else {
      alert('Your browser does not support notifications.');
    }
  };

  const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Balanced)' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (Fast)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Smart)' },
  ];

  useEffect(() => {
    localStorage.setItem('vocabList', JSON.stringify(vocabList));
  }, [vocabList]);

  useEffect(() => {
    localStorage.setItem('savedSessions', JSON.stringify(savedSessions));
  }, [savedSessions]);

  useEffect(() => {
    localStorage.setItem('savedVocabLists', JSON.stringify(savedVocabLists));
  }, [savedVocabLists]);

  useEffect(() => {
    localStorage.setItem('wordProgress', JSON.stringify(wordProgress));
  }, [wordProgress]);

  useEffect(() => {
    // One-time migration to upgrade old boring titles to adventurous ones
    const adventurousWords = ["Adventure", "Expedition", "Mission", "Quest", "Journey", "Safari", "Challenge", "Trial", "Clash", "Labyrinth", "Magic", "Epic", "Super", "Cosmic", "Mystic", "Crystal", "Golden", "Secret", "Galaxy"];
    
    let hasChanges = false;
    const upgradedSessions = savedSessions.map(session => {
      const isAlreadyAdventurous = adventurousWords.some(w => session.title.toLowerCase().includes(w.toLowerCase()));
      
      if (!isAlreadyAdventurous) {
        hasChanges = true;
        const prefixes = ["Super", "Epic", "Galaxy", "Cosmic", "Mystic", "Crystal", "Golden", "Secret"];
        const nouns = ["Adventure", "Expedition", "Mission", "Quest", "Journey", "Safari", "Challenge", "Trial"];
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return {
          ...session,
          title: `${randomPrefix} ${randomNoun}: ${session.title}`
        };
      }
      return session;
    });

    if (hasChanges) {
      setSavedSessions(upgradedSessions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let currentStreak = streak;

    if (lastPracticeDate) {
      const lastDate = new Date(lastPracticeDate);
      const todayDate = new Date(today);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1 && lastPracticeDate !== today) {
        // Streak broken
        currentStreak = 0;
        setStreak(0);
        localStorage.setItem('dailyStreak', '0');
      }
    }
    
    // Show welcome modal if they haven't practiced today
    if (lastPracticeDate !== today) {
      setShowWelcomeModal(true);
    }
  }, []);

  const updateStreak = () => {
    const today = new Date().toISOString().split('T')[0];
    if (lastPracticeDate !== today) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setLastPracticeDate(today);
      localStorage.setItem('dailyStreak', newStreak.toString());
      localStorage.setItem('lastPracticeDate', today);
      setShowStreakAnimation(true);
      setTimeout(() => setShowStreakAnimation(false), 3000);
    }
  };

  const handleAddVocab = (word: string, meaning: string) => {
    setVocabList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), word, meaning },
    ]);
  };

  const handleRemoveVocab = (id: string) => {
    setVocabList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllVocab = () => {
    setShowClearVocabConfirm(true);
  };

  const confirmClearAllVocab = () => {
    setVocabList([]);
    setShowClearVocabConfirm(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Chunk vocabList into arrays of batchSize
      const chunks: VocabItem[][] = [];
      for (let i = 0; i < vocabList.length; i += batchSize) {
        chunks.push(vocabList.slice(i, i + batchSize));
      }

      // Keep track of remaining vocabList
      let remainingVocab = [...vocabList];

      for (let i = 0; i < chunks.length; i++) {
        setProgress({ current: i + 1, total: chunks.length });
        const generatedSession = await generatePractice(chunks[i], selectedModel);
        
        // Add part number if there are multiple chunks
        if (chunks.length > 1) {
          generatedSession.title = `${generatedSession.title} (Part ${i + 1})`;
        }
        
        // Save incrementally
        setSavedSessions(prev => [generatedSession, ...prev]);
        
        // Update remaining vocabList (remove processed chunk)
        remainingVocab = remainingVocab.slice(chunks[i].length);
        setVocabList(remainingVocab);

        if (i < chunks.length - 1) {
          // Add a delay between generating sessions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }

      setCurrentView('saved');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Oops! Something went wrong while creating the practice. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleExtractFromPDF = async (files: File[]) => {
    setIsGenerating(true);
    setError(null);
    try {
      let allExtracted: VocabItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(files[i]);
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = (error) => reject(error);
        });

        const extracted = await extractVocabFromPDF(base64, selectedModel);
        allExtracted = [...allExtracted, ...extracted];
        
        // Save the extracted list to history
        const newList: SavedVocabList = {
          id: crypto.randomUUID(),
          title: files[i].name.replace('.pdf', ''),
          words: extracted,
          createdAt: Date.now()
        };
        setSavedVocabLists(prev => [newList, ...prev]);

        if (i < files.length - 1) {
          // Add a delay between PDF extractions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }

      setVocabList((prev) => [...prev, ...allExtracted]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Oops! Something went wrong while reading the PDFs or extracting words. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleApplyWordMeaningToSaved = async (sessionToUpdate: PracticeSession) => {
    setIsGenerating(true);
    setError(null);
    try {
      // Find the original vocab list that might contain these words
      // We'll search through all saved vocab lists and the current vocab list
      const allVocabItems = [
        ...vocabList,
        ...savedVocabLists.flatMap(list => list.words)
      ];

      // Create a map for faster lookup, sort by length descending to match longer words first
      const vocabEntries = Array.from(allVocabItems.map(item => [item.word.toLowerCase(), item.meaning] as [string, string]));
      vocabEntries.sort((a, b) => b[0].length - a[0].length);
      const vocabMap = new Map<string, string>(vocabEntries);

      const updatedQuestions = sessionToUpdate.questions.map(q => {
        // If it already has word and meaning, keep it
        if (q.word && q.meaning) return q;

        // Try to find the word in our vocab map
        // This is a simple heuristic: check if any vocab word is in the question or explanation
        let foundWord = '';
        let foundMeaning = '';

        for (const [word, meaning] of vocabMap.entries()) {
          // Use regex to match whole words only to prevent partial matches (e.g. "cat" in "caterpillar")
          // Escape the word for regex
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
          
          if (
            regex.test(q.question) || 
            regex.test(q.explanation) ||
            regex.test(q.correctAnswer)
          ) {
            foundWord = word;
            foundMeaning = meaning;
            break;
          }
        }

        // If we found a match, add it to the question
        if (foundWord && foundMeaning) {
          return {
            ...q,
            word: foundWord,
            meaning: foundMeaning
          };
        }

        return q;
      });

      const updatedSession = {
        ...sessionToUpdate,
        questions: updatedQuestions
      };

      setSavedSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setSession(updatedSession);
      setCurrentView('practice');

    } catch (err: any) {
      console.error(err);
      setError('Failed to apply word meanings to this session.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartPractice = (selectedSession: PracticeSession) => {
    // Check if any question is missing word/meaning
    const needsUpdate = selectedSession.questions.some(q => !q.word || !q.meaning);
    
    if (needsUpdate) {
      handleApplyWordMeaningToSaved(selectedSession);
    } else {
      setSession(selectedSession);
      setCurrentView('practice');
    }
  };

  const handleDeleteSession = (id: string) => {
    setItemToDelete({ id, type: 'session' });
  };

  const handleDeleteVocabList = (id: string) => {
    setItemToDelete({ id, type: 'vocabList' });
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'session') {
      setSavedSessions(prev => prev.filter(s => s.id !== itemToDelete.id));
    } else {
      setSavedVocabLists(prev => prev.filter(s => s.id !== itemToDelete.id));
    }
    setItemToDelete(null);
  };

  const handleLoadVocabList = (list: SavedVocabList) => {
    setVocabList(list.words);
    setCurrentView('builder');
  };

  const handleClearAllSessions = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    setSavedSessions([]);
    setShowClearConfirm(false);
  };

  const handleRestart = () => {
    setSession(null);
    setCurrentView('saved');
  };

  const handleMoveToMastered = (sessionId: string) => {
    setSavedSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, isMastered: true };
      }
      return s;
    }));
  };

  const handleCompletePractice = (score: number, total: number, failedQuestions: PracticeQuestion[]) => {
    if (!session) return;
    
    updateStreak();

    // Update word progress
    setWordProgress(prev => {
      const newProgress = { ...prev };
      const now = Date.now();
      
      session.questions.forEach(q => {
        if (!q.word) return;
        
        const isFailed = failedQuestions.some(fq => fq.id === q.id);
        const wordKey = q.word.toLowerCase();
        
        if (!newProgress[wordKey]) {
          newProgress[wordKey] = {
            word: q.word,
            meaning: q.meaning || '',
            attempts: 0,
            correct: 0,
            lastAttempted: now
          };
        }
        
        newProgress[wordKey].attempts += 1;
        if (!isFailed) {
          newProgress[wordKey].correct += 1;
        }
        newProgress[wordKey].lastAttempted = now;
      });
      
      return newProgress;
    });

    const percentage = (score / total) * 100;
    const isPassed = percentage >= 80;
    
    setSavedSessions(prev => {
      let updated = prev.map(s => {
        // Update the current session
        if (s.id === session.id) {
          return {
            ...s,
            bestScore: Math.max(s.bestScore || 0, score),
            isPassed: s.isPassed || isPassed,
            isMastered: s.isMastered || isPassed,
            lastAttempted: Date.now()
          };
        }
        
        // If this is a review session and it was passed, mark the original session as passed and mastered
        if (isPassed && session.title.startsWith('Review: ') && s.title === session.title.replace('Review: ', '')) {
          return {
            ...s,
            isPassed: true,
            isMastered: true,
            lastAttempted: Date.now()
          };
        }
        
        return s;
      });
      
      // If a review session was passed, we can remove it since the original is now mastered
      if (isPassed && session.title.startsWith('Review: ')) {
        updated = updated.filter(s => s.id !== session.id);
      }
      
      // If there are failed questions, generate a review session
      if (failedQuestions.length > 0 && !isPassed) {
        // Check if a review session already exists for this title
        const reviewTitle = session.title.startsWith('Review: ') ? session.title : `Review: ${session.title}`;
        const existingReviewIndex = updated.findIndex(s => s.title === reviewTitle && !s.isPassed);
        
        const reviewSession: PracticeSession = {
          id: crypto.randomUUID(),
          title: reviewTitle,
          questions: failedQuestions,
          createdAt: Date.now(),
          originalVocab: failedQuestions.map(q => ({ 
            id: crypto.randomUUID(), 
            word: q.word || 'Unknown Word', 
            meaning: q.meaning || 'Unknown Meaning' 
          }))
        };
        
        if (existingReviewIndex >= 0) {
          // Replace existing review session
          updated[existingReviewIndex] = reviewSession;
        } else {
          // Add new review session
          updated = [reviewSession, ...updated];
        }
      }
      
      return updated;
    });
  };

  const handleDownloadSingle = async (session: PracticeSession, withAnswers: boolean) => {
    let htmlContent = `<h1>${session.title} ${withAnswers ? '(Teacher Version)' : '(Student Version)'}</h1>`;
    
    session.questions.forEach((q, index) => {
      htmlContent += `
        <div class="question">
          <div class="q-text">${index + 1}. ${q.question}</div>
      `;
      
      if (q.type === 'multiple_choice') {
        htmlContent += `<div class="options">`;
        q.options.forEach((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
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

    await printToPDF(htmlContent, `${session.title}_${withAnswers ? 'With_Answers' : 'Student_Version'}`);
  };

  const handleBatchDownload = async (withAnswers: boolean) => {
    if (savedSessions.length === 0) return;
    setIsDownloading(true);

    try {
      const chunkSize = 20;
      for (let i = 0; i < savedSessions.length; i += chunkSize) {
        const chunk = savedSessions.slice(i, i + chunkSize);
        const partNumber = Math.floor(i / chunkSize) + 1;
        const totalParts = Math.ceil(savedSessions.length / chunkSize);
        
        let htmlContent = `<div style="text-align: center; padding-top: 30vh;">
          <h1 style="font-size: 36px; margin-bottom: 10px;">All Practice Sessions ${totalParts > 1 ? `(Part ${partNumber})` : ''}</h1>
          <h2 style="color: #64748b; font-weight: normal;">${withAnswers ? '(Teacher Version)' : '(Student Version)'}</h2>
        </div>`;

        chunk.forEach((session) => {
          htmlContent += `
            <div class="html2pdf__page-break"></div>
            <h2 style="color: #4f46e5; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${session.title}</h2>
          `;
          
          session.questions.forEach((q, index) => {
            htmlContent += `
              <div class="question">
                <div class="q-text">${index + 1}. ${q.question}</div>
            `;
            
            if (q.type === 'multiple_choice') {
              htmlContent += `<div class="options">`;
              q.options.forEach((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
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
        });

        const partSuffix = totalParts > 1 ? `_Part_${partNumber}` : '';
        await printToPDF(htmlContent, `Batch_Practice_${withAnswers ? 'With_Answers' : 'Student_Version'}${partSuffix}`);
        
        if (i + chunkSize < savedSessions.length) {
          // Add a delay between downloads to ensure the browser processes them correctly
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredAndSortedSessions = savedSessions
    .filter(s => savedTab === 'mastered' ? s.isMastered : !s.isMastered)
    .sort((a, b) => {
      switch (questSortOrder) {
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'score-high': return ((b.bestScore || 0) / b.questions.length) - ((a.bestScore || 0) / a.questions.length);
        case 'score-low': return ((a.bestScore || 0) / a.questions.length) - ((b.bestScore || 0) / b.questions.length);
        case 'alpha': return a.title.localeCompare(b.title);
        case 'newest':
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedSessions.length / ITEMS_PER_PAGE));
  const currentSessions = filteredAndSortedSessions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <BookOpen size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-slate-800 mb-2">Welcome to Vocab Quest</h1>
          <p className="text-center text-slate-500 mb-8">Please log in to continue</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                placeholder="Enter password"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm font-medium text-center">{loginError}</p>
            )}
            
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm mt-4"
            >
              Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-200 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <BookOpen size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden md:block tracking-tight">
              Vocab Quest
            </h1>
            {streak > 0 && (
              <motion.div 
                animate={showStreakAnimation ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-1.5 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm border border-orange-200 ml-2"
              >
                <span className="text-lg">🔥</span>
                <span>{streak} Day{streak !== 1 ? 's' : ''}</span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
            <div className="hidden lg:block">
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              >
                <option value={3}>Batch Size: 3</option>
                <option value={5}>Batch Size: 5</option>
                <option value={10}>Batch Size: 10</option>
              </select>
            </div>
          
            {currentView !== 'practice' && (
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => setCurrentView('builder')}
                className={`px-4 py-2.5 text-base font-bold rounded-xl transition-all flex items-center gap-2 ${
                  currentView === 'builder' ? 'bg-white text-fuchsia-600 shadow-sm scale-105' : 'text-slate-500 hover:text-fuchsia-500 hover:bg-fuchsia-50'
                }`}
              >
                <Wand2 size={20} />
                <span className="hidden sm:inline">Create Magic</span>
                <span className="sm:hidden">Create</span>
              </button>
              <button
                onClick={() => setCurrentView('saved')}
                className={`px-4 py-2.5 text-base font-bold rounded-xl transition-all flex items-center gap-2 ${
                  currentView === 'saved' ? 'bg-white text-cyan-600 shadow-sm scale-105' : 'text-slate-500 hover:text-cyan-500 hover:bg-cyan-50'
                }`}
              >
                <Backpack size={20} />
                <span className="hidden sm:inline">My Backpack</span>
                {savedSessions.length > 0 && (
                  <span className={`hidden md:flex items-center justify-center px-2 py-0.5 rounded-full text-xs ${currentView === 'saved' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-500'}`}>
                    {savedSessions.length}
                  </span>
                )}
                <span className="sm:hidden">Saved</span>
              </button>
              <button
                onClick={() => setCurrentView('progress')}
                className={`px-4 py-2.5 text-base font-bold rounded-xl transition-all flex items-center gap-2 ${
                  currentView === 'progress' ? 'bg-white text-amber-600 shadow-sm scale-105' : 'text-slate-500 hover:text-amber-500 hover:bg-amber-50'
                }`}
              >
                <Trophy size={20} />
                <span className="hidden sm:inline">Trophies</span>
                <span className="sm:hidden">Stats</span>
              </button>
            </div>
          )}

          {currentView === 'practice' && (
            <button
              onClick={handleRestart}
              className="px-5 py-2.5 bg-slate-100 text-base font-bold text-slate-600 rounded-xl hover:bg-slate-200 hover:text-indigo-600 transition-colors flex items-center gap-2"
            >
              <FolderHeart size={20} />
              Back to Saved
            </button>
          )}
          
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleNotify}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2"
              title="Enable Practice Reminders"
            >
              <Bell size={18} />
              <span className="hidden sm:inline">Remind Me</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              Log Out
            </button>
          </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {showWelcomeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10"></div>
                <div className="relative z-10">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-6xl mb-4"
                  >
                    🚀
                  </motion.div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Ready for your Daily Challenge?</h3>
                  <p className="text-slate-600 mb-6">
                    {streak > 0 
                      ? `You're on a ${streak} day streak! Keep it up and practice today to grow your brain.` 
                      : "Welcome back! Start a practice session today to build your daily streak."}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowWelcomeModal(false)}
                      className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                      Let's Go! 💪
                    </button>
                    <button
                      onClick={() => {
                        handleNotify();
                        setShowWelcomeModal(false);
                      }}
                      className="w-full px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Bell size={18} />
                      Enable Daily Reminders
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showClearVocabConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Clear All Words?</h3>
                <p className="text-slate-500 text-center mb-6">
                  Are you sure you want to delete all words from your vocabulary list? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearVocabConfirm(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClearAllVocab}
                    className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Yes, Delete All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Clear All Sessions?</h3>
                <p className="text-slate-500 text-center mb-6">
                  Are you sure you want to delete all saved practice sessions? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClearAll}
                    className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Yes, Delete All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {itemToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
                  Delete {itemToDelete.type === 'session' ? 'Session' : 'List'}?
                </h3>
                <p className="text-slate-500 text-center mb-6">
                  Are you sure you want to delete this {itemToDelete.type === 'session' ? 'practice session' : 'vocabulary list'}? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setItemToDelete(null)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Yes, Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-center font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {currentView === 'builder' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <VocabInput
                vocabList={vocabList}
                onAdd={handleAddVocab}
                onRemove={handleRemoveVocab}
                onClearAll={handleClearAllVocab}
                onGenerate={handleGenerate}
                onExtractFromPDF={handleExtractFromPDF}
                isGenerating={isGenerating}
                progress={progress}
              />
            </motion.div>
          )}

          {currentView === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl mx-auto"
            >
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-slate-800 mb-6 flex items-center justify-center gap-2">
                  <span>🎒</span> My Backpack <span>🎒</span>
                </h2>
                
                <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8 max-w-md mx-auto gap-1">
                  <button
                    onClick={() => { setSavedTab('todo'); setCurrentPage(1); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      savedTab === 'todo' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <BookOpen size={18} />
                    Quests ({savedSessions.filter(s => !s.isMastered).length})
                  </button>
                  <button
                    onClick={() => { setSavedTab('mastered'); setCurrentPage(1); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      savedTab === 'mastered' ? 'bg-white text-emerald-600 shadow-sm scale-105' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'
                    }`}
                  >
                    <Trophy size={18} />
                    Mastered ({savedSessions.filter(s => s.isMastered).length})
                  </button>
                  <button
                    onClick={() => { setSavedTab('vocab'); setCurrentPage(1); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      savedTab === 'vocab' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <FolderHeart size={18} />
                    Word Lists ({savedVocabLists.length})
                  </button>
                </div>

                {savedTab === 'todo' || savedTab === 'mastered' ? (
                  <>
                    <p className="text-slate-500 font-medium mb-6">
                      {savedTab === 'todo' 
                        ? (savedSessions.filter(s => !s.isMastered).length > 0 ? "Here are your active quests! Let's go!" : "No active quests right now. Go create some magic!")
                        : (savedSessions.filter(s => s.isMastered).length > 0 ? "Wow! Look at all these mastered quests! You're a star! 🌟" : "No mastered quests yet. Keep practicing!")}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm mb-6">
                    {savedVocabLists.length > 0
                      ? 'Load a saved word list to practice or generate more!'
                      : 'No saved word lists yet. Upload a PDF to extract words!'}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {savedTab === 'todo' || savedTab === 'mastered' ? (
                  <>
                    {savedSessions.filter(s => savedTab === 'mastered' ? s.isMastered : !s.isMastered).length > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleBatchDownload(false)}
                            disabled={isDownloading}
                            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Download All (Student)"
                          >
                            {isDownloading ? <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown size={16} />}
                            <span className="hidden sm:inline">Student PDF</span>
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => handleBatchDownload(true)}
                            disabled={isDownloading}
                            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Download All (With Answers)"
                          >
                            {isDownloading ? <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown size={16} />}
                            <span className="hidden sm:inline">Teacher PDF</span>
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={handleClearAllSessions}
                            className="text-sm text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Clear All</span>
                          </button>
                        </div>
                        <select
                          value={questSortOrder}
                          onChange={(e) => { setQuestSortOrder(e.target.value as any); setCurrentPage(1); }}
                          className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                          <option value="score-high">Highest Score</option>
                          <option value="score-low">Lowest Score</option>
                          <option value="alpha">Alphabetical</option>
                        </select>
                      </div>
                    )}
                    {savedSessions.filter(s => savedTab === 'mastered' ? s.isMastered : !s.isMastered).length === 0 ? (
                      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          {savedTab === 'todo' ? <BookOpen size={32} /> : <Trophy size={32} />}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                          {savedTab === 'todo' ? 'No Active Quests' : 'No Mastered Quests'}
                        </h3>
                        <p className="text-slate-500 mb-6">
                          {savedTab === 'todo' 
                            ? 'Go to the Create Magic tab to generate some fun practice!'
                            : 'Complete quests with 80% or more to master them!'}
                        </p>
                        {savedTab === 'todo' && (
                          <button
                            onClick={() => setCurrentView('builder')}
                            className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                          >
                            Create Magic
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {currentSessions.map((s) => (
                      <div key={s.id} className={`bg-white p-6 rounded-3xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${s.title.startsWith('Review:') ? 'border-amber-200 bg-amber-50/30 hover:border-amber-300' : 'border-slate-100 hover:border-indigo-200'}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {s.title.startsWith('Review:') && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-md uppercase tracking-wider">Needs Review</span>
                          )}
                          <h3 className="text-lg font-bold text-slate-800">{s.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <BookOpen size={14} />
                            {s.questions.length} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                          {s.bestScore !== undefined && (
                            <span className={`flex items-center gap-1 font-medium ${s.isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                              <Trophy size={14} />
                              Best: {Math.round((s.bestScore / s.questions.length) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.isPassed && !s.isMastered && (
                          <button
                            onClick={() => handleMoveToMastered(s.id)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 font-semibold rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2 text-sm"
                          >
                            <CheckCircle2 size={16} />
                            Move to Mastered
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadSingle(s, false)}
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Download Student Version"
                        >
                          <FileDown size={20} />
                        </button>
                        <button
                          onClick={() => handleStartPractice(s)}
                          className={`flex-1 sm:flex-none px-6 py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                            s.title.startsWith('Review:') 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          <Play size={18} />
                          {s.lastAttempted ? 'Retry' : 'Start'}
                        </button>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="Delete session"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-6">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-sm font-medium text-slate-500">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                  </>
                  )}
                  </>
                ) : savedVocabLists.length === 0 ? (
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FolderHeart size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      No Word Lists Yet
                    </h3>
                    <p className="text-slate-500 mb-6">
                      Go to the Create Magic tab to build your first word list!
                    </p>
                    <button
                      onClick={() => setCurrentView('builder')}
                      className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      Create Magic
                    </button>
                  </div>
                ) : (
                  savedVocabLists.map((list) => (
                    <div key={list.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition-colors">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">{list.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <BookOpen size={14} />
                            {list.words.length} words
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(list.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadVocabList(list)}
                          className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Play size={18} />
                          Load List
                        </button>
                        <button
                          onClick={() => handleDeleteVocabList(list.id)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="Delete list"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'practice' && session && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <PracticeArea 
                session={session} 
                onRestart={handleRestart} 
                onComplete={handleCompletePractice}
                onMoveToMastered={() => {
                  handleMoveToMastered(session.id);
                  handleRestart();
                }}
              />
            </motion.div>
          )}

          {currentView === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProgressView wordProgress={wordProgress} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
