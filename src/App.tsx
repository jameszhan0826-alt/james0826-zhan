import React, { useState, useEffect } from 'react';
import { VocabInput } from './components/VocabInput';
import { Discover } from './components/Discover';
import { PracticeArea } from './components/PracticeArea';
import { ProgressView } from './components/ProgressView';
import { VocabItem, PracticeSession, SavedVocabList, PracticeQuestion, WordProgress, AdvancedOptions } from './types';
import { generatePractice, extractVocabFromDoc } from './services/gemini';
import { generateLocalPractice } from './services/localPractice';
import { BookOpen, Sparkles, FolderHeart, Play, Trash2, Calendar, FileDown, Trophy, CheckCircle2, TrendingUp, Backpack, Wand2, Bell, X, AlertCircle, RotateCcw, Zap, AlertTriangle, Pencil, Check, ChevronDown, LogOut, Image as ImageIcon, Upload, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { printToPDF, splitPdfToImages, loadPdfDocument, resizeImageBase64 } from './utils/pdf';
import mammoth from 'mammoth';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return window.getStoreItem('isLoggedIn') === 'true';
  });
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(() => {
    return window.getStoreItem('userRole') as 'teacher' | 'student' | null;
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return window.getStoreItem('currentUser');
  });
  const [userIcon, setUserIcon] = useState(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`userIcon_${user || 'default'}`);
    return saved || '👤';
  });

  const [vocabList, setVocabList] = useState<VocabItem[]>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`vocabList_${user || 'default'}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentCategory, setCurrentCategory] = useState<'NCE' | 'PET' | 'General' | 'MistakeBook'>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`currentCategory_${user || 'default'}`);
    return (saved as any) || 'General';
  });
  const [vocabHistory, setVocabHistory] = useState<VocabItem[][]>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`vocabHistory_${user || 'default'}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [savedSessions, setSavedSessions] = useState<PracticeSession[]>(() => {
    const user = window.getStoreItem('currentUser');
    const role = window.getStoreItem('userRole');
    if (role === 'teacher') {
      const saved = window.getStoreItem('teacherSessions');
      return saved ? JSON.parse(saved) : [];
    } else {
      const studentSaved = window.getStoreItem(`savedSessions_${user || 'default'}`);
      let sessions: PracticeSession[] = studentSaved ? JSON.parse(studentSaved) : [];
      const teacherSaved = window.getStoreItem('teacherSessions');
      const tSessions: PracticeSession[] = teacherSaved ? JSON.parse(teacherSaved) : [];
      let changed = false;
      tSessions.forEach(ts => {
        if (!sessions.find(s => s.id === ts.id)) {
          sessions.push({ ...ts, isPassed: false, isMastered: false, wordsToReview: [] });
          changed = true;
        }
      });
      if (changed) {
        window.setStoreItem(`savedSessions_${user || 'default'}`, JSON.stringify(sessions));
      }
      return sessions;
    }
  });
  const [savedVocabLists, setSavedVocabLists] = useState<SavedVocabList[]>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`savedVocabLists_${user || 'default'}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>(() => {
    const user = window.getStoreItem('currentUser');
    const role = window.getStoreItem('userRole');
    if (role === 'teacher') {
      const saved = window.getStoreItem('wordProgress_james'); // Load james's progress for teacher
      return saved ? JSON.parse(saved) : {};
    } else {
      const saved = window.getStoreItem(`wordProgress_${user || 'default'}`);
      return saved ? JSON.parse(saved) : {};
    }
  });
  const [currentView, setCurrentView] = useState<'builder' | 'saved' | 'practice' | 'progress' | 'resources'>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`currentView_${user || 'default'}`);
    if (saved === 'builder' || saved === 'saved' || saved === 'practice' || saved === 'progress' || saved === 'resources') {
      return saved;
    }
    const role = window.getStoreItem('userRole');
    return role === 'teacher' ? 'builder' : 'saved';
  });
  const [selectedVocabListIds, setSelectedVocabListIds] = useState<string[]>([]);
  const [savedTab, setSavedTab] = useState<'todo' | 'mastered' | 'vocab'>(() => {
    const user = window.getStoreItem('currentUser');
    const role = window.getStoreItem('userRole');
    const saved = window.getStoreItem(`savedTab_${user || 'default'}`);
    if (role === 'student' && saved === 'vocab') {
      return 'todo';
    }
    if (saved === 'todo' || saved === 'mastered' || saved === 'vocab') {
      return saved;
    }
    return 'todo';
  });
  const [savedCategoryFilter, setSavedCategoryFilter] = useState<'ALL' | 'NCE' | 'PET' | 'General' | 'MistakeBook'>('ALL');
  const [questSortOrder, setQuestSortOrder] = useState<'newest' | 'oldest' | 'score-high' | 'score-low' | 'alpha' | 'retry'>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`questSortOrder_${user || 'default'}`);
    if (saved === 'newest' || saved === 'oldest' || saved === 'score-high' || saved === 'score-low' || saved === 'alpha' || saved === 'retry') {
      return saved;
    }
    return 'newest';
  });

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`currentView_${user}`, currentView);
  }, [currentView, currentUser]);

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`savedTab_${user}`, savedTab);
  }, [savedTab, currentUser]);

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`questSortOrder_${user}`, questSortOrder);
  }, [questSortOrder, currentUser]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [session, setSession] = useState<PracticeSession | null>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`activeSession_${user || 'default'}`);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const user = currentUser || 'default';
    if (session) {
      window.setStoreItem(`activeSession_${user}`, JSON.stringify(session));
    } else {
      window.removeStoreItem(`activeSession_${user}`);
    }
  }, [session, currentUser]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearVocabConfirm, setShowClearVocabConfirm] = useState(false);
  const [lastClearedVocabList, setLastClearedVocabList] = useState<VocabItem[] | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'session' | 'vocabList' } | null>(null);
  
  // Gamification & Daily Notify Mech
  const [streak, setStreak] = useState<number>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`dailyStreak_${user || 'default'}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lastPracticeDate, setLastPracticeDate] = useState<string | null>(() => {
    const user = window.getStoreItem('currentUser');
    return window.getStoreItem(`lastPracticeDate_${user || 'default'}`);
  });
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [importDataToConfirm, setImportDataToConfirm] = useState<any>(null);
  const [conflictingKeys, setConflictingKeys] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [students, setStudents] = useState<string[]>([]);

  useEffect(() => {
    if (currentView === 'progress' && userRole === 'teacher') {
      const allKeys = Object.keys(window.appStore || {});
      const studentProgressKeys = allKeys.filter(key => key.startsWith('wordProgress_'));
      const studentNames = studentProgressKeys.map(key => key.replace('wordProgress_', ''));
      setStudents(studentNames);
    }
  }, [currentView, userRole]);
  const [isDownloadingStudent, setIsDownloadingStudent] = useState(false);
  const [isDownloadingTeacher, setIsDownloadingTeacher] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const user = window.getStoreItem('currentUser');
    return window.getStoreItem(`selectedModel_${user || 'default'}`) || 'gemini-3-flash-preview';
  });
  const [batchSize, setBatchSize] = useState<number>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`batchSize_${user || 'default'}`);
    return saved ? parseInt(saved, 10) : 3; // Reduced default to 3
  });

  const [magicWaitTime, setMagicWaitTime] = useState<number>(() => {
    const user = window.getStoreItem('currentUser');
    const saved = window.getStoreItem(`magicWaitTime_${user || 'default'}`);
    return saved ? parseInt(saved, 10) : 60; // Increased default to 60s
  });

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`selectedModel_${user}`, selectedModel);
  }, [selectedModel, currentUser]);

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`batchSize_${user}`, batchSize.toString());
  }, [batchSize, currentUser]);

  useEffect(() => {
    const user = currentUser || 'default';
    window.setStoreItem(`magicWaitTime_${user}`, magicWaitTime.toString());
  }, [magicWaitTime, currentUser]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleStoreError = (e: Event) => {
      const customEvent = e as CustomEvent;
      setNotification({ message: `Storage Error: ${customEvent.detail}. Please check file permissions or try again.`, type: 'error' });
    };
    window.addEventListener('store-error', handleStoreError);
    return () => window.removeEventListener('store-error', handleStoreError);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let role: 'teacher' | 'student' | null = null;
    let user = '';
    if (username === 'admin' && password === 'pass') {
      role = 'teacher';
      user = 'admin';
    } else if (username === 'james' && password === 'pass') {
      role = 'student';
      user = 'james';
    }

    if (role && user) {
      setIsLoggedIn(true);
      setUserRole(role);
      setCurrentUser(user);
      window.setStoreItem('isLoggedIn', 'true');
      window.setStoreItem('userRole', role);
      window.setStoreItem('currentUser', user);
      
      // Load user icon
      const savedIcon = window.getStoreItem(`userIcon_${user}`);
      if (savedIcon) {
        setUserIcon(savedIcon);
      } else {
        const defaultIcon = role === 'teacher' ? '👨‍🏫' : '🎓';
        setUserIcon(defaultIcon);
        window.setStoreItem(`userIcon_${user}`, defaultIcon);
      }
      
      if (role === 'student') {
        setSavedTab('todo');
        window.setStoreItem(`savedTab_${user}`, 'todo');
      }
      
      setLoginError('');

      // Load data immediately
      const savedVocab = window.getStoreItem(`vocabList_${user}`);
      setVocabList(savedVocab ? JSON.parse(savedVocab) : []);
      
      const savedHistory = window.getStoreItem(`vocabHistory_${user}`);
      setVocabHistory(savedHistory ? JSON.parse(savedHistory) : []);
      
      const savedLists = window.getStoreItem(`savedVocabLists_${user}`);
      setSavedVocabLists(savedLists ? JSON.parse(savedLists) : []);
      
      const savedProgress = window.getStoreItem(`wordProgress_${role === 'teacher' ? 'james' : user}`);
      setWordProgress(savedProgress ? JSON.parse(savedProgress) : {});

      const savedStreak = window.getStoreItem(`dailyStreak_${user}`);
      setStreak(savedStreak ? parseInt(savedStreak, 10) : 0);

      const savedLastPractice = window.getStoreItem(`lastPracticeDate_${user}`);
      setLastPracticeDate(savedLastPractice);
      
      if (role === 'teacher') {
        const teacherSessions = window.getStoreItem('teacherSessions');
        setSavedSessions(teacherSessions ? JSON.parse(teacherSessions) : []);
        setCurrentView('builder');
      } else {
        const studentSaved = window.getStoreItem(`savedSessions_${user}`);
        let sessions: PracticeSession[] = studentSaved ? JSON.parse(studentSaved) : [];
        const teacherSaved = window.getStoreItem('teacherSessions');
        const tSessions: PracticeSession[] = teacherSaved ? JSON.parse(teacherSaved) : [];
        let changed = false;
        tSessions.forEach(ts => {
          if (!sessions.find(s => s.id === ts.id)) {
            sessions.push({ ...ts, isPassed: false, isMastered: false, wordsToReview: [] });
            changed = true;
          }
        });
        if (changed) {
          window.setStoreItem(`savedSessions_${user}`, JSON.stringify(sessions));
        }
        setSavedSessions(sessions);
        setCurrentView('saved');
      }
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentUser(null);
    window.removeStoreItem('isLoggedIn');
    window.removeStoreItem('userRole');
    window.removeStoreItem('currentUser');
    setUsername('');
    setPassword('');
  };

  const handleRegenerate = async (words: VocabItem[], title: string = "Targeted Practice") => {
    setIsGenerating(true);
    setNotification({ message: 'Generating your AI Quest... this may take a moment.', type: 'info' });
    try {
      const newSession = await generatePractice(words, selectedModel, (current, total) => {
        setProgress({ current, total });
      }, title);
      setSession(newSession);
      setCurrentView('practice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate practice.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleNotify = () => {
    const words = Object.values(wordProgress) as WordProgress[];
    const needsImprovement = words.filter((w: WordProgress) => w.attempts >= 3 && (w.correct / w.attempts) < 0.5);
    const body = needsImprovement.length > 0 
      ? `Time to power up! You have ${needsImprovement.length} words that need practice: ${needsImprovement.slice(0, 3).map(w => w.word).join(', ')}...`
      : 'Time to level up your brain! Come back and practice your words!';

    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Vocab Quest 🚀', {
            body,
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
    { id: 'gemini-flash-latest', name: 'Gemini 1.5 Flash (Reliable)' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (Fast)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Smart)' },
  ];

  useEffect(() => {
    if (currentUser) {
      window.setStoreItem(`vocabList_${currentUser}`, JSON.stringify(vocabList));
      window.setStoreItem(`currentCategory_${currentUser}`, currentCategory);
    }
  }, [vocabList, currentCategory, currentUser]);

  useEffect(() => {
    if (currentUser) {
      window.setStoreItem(`vocabHistory_${currentUser}`, JSON.stringify(vocabHistory));
    }
  }, [vocabHistory, currentUser]);

  useEffect(() => {
    if (currentUser) {
      if (userRole === 'teacher') {
        window.setStoreItem('teacherSessions', JSON.stringify(savedSessions));
      } else {
        window.setStoreItem(`savedSessions_${currentUser}`, JSON.stringify(savedSessions));
      }
    }
  }, [savedSessions, currentUser, userRole]);

  useEffect(() => {
    if (currentUser) {
      window.setStoreItem(`savedVocabLists_${currentUser}`, JSON.stringify(savedVocabLists));
    }
  }, [savedVocabLists, currentUser]);

  useEffect(() => {
    if (currentUser) {
      if (userRole === 'teacher') {
        // We don't auto-save teacher's view of student progress to avoid overwriting it accidentally
      } else {
        window.setStoreItem(`wordProgress_${currentUser}`, JSON.stringify(wordProgress));
      }
    }
  }, [wordProgress, currentUser, userRole]);

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
    if (!currentUser) return;
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
        window.setStoreItem(`dailyStreak_${currentUser}`, '0');
      }
    }
    
    // Show welcome modal if they haven't practiced today
    if (lastPracticeDate !== today && userRole === 'student') {
      setShowWelcomeModal(true);
    }
  }, [currentUser, lastPracticeDate, streak, userRole]);

  const updateStreak = () => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    if (lastPracticeDate !== today) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setLastPracticeDate(today);
      window.setStoreItem(`dailyStreak_${currentUser}`, newStreak.toString());
      window.setStoreItem(`lastPracticeDate_${currentUser}`, today);
      setShowStreakAnimation(true);
      setTimeout(() => setShowStreakAnimation(false), 3000);
    }
  };

  const handleAddVocab = (word: string, meaning: string, example?: string, exampleTranslation?: string, imageUrl?: string) => {
    const id = crypto.randomUUID();
    setVocabList((prev) => [
      ...prev,
      { id, word, meaning, example, exampleTranslation, imageUrl },
    ]);
    return id;
  };

  const handleBulkAddVocab = (vocab: { word: string; meaning: string; example?: string; exampleTranslation?: string }[], category?: 'NCE' | 'PET' | 'General' | 'MistakeBook') => {
    const newItems: VocabItem[] = vocab.map(v => ({
      id: crypto.randomUUID(),
      word: v.word,
      meaning: v.meaning,
      example: v.example,
      exampleTranslation: v.exampleTranslation,
    }));
    setVocabList(prev => [...prev, ...newItems]);
    if (category) setCurrentCategory(category);
    setNotification({ message: `Successfully extracted ${vocab.length} words!`, type: 'success' });
  };

  const handleRemoveVocab = (id: string) => {
    setVocabList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllVocab = () => {
    setShowClearVocabConfirm(true);
  };

  const confirmClearAllVocab = () => {
    if (vocabList.length > 0) {
      setVocabHistory(prev => [vocabList, ...prev].slice(0, 5)); // Keep last 5 clears
      setLastClearedVocabList([...vocabList]);
      setVocabList([]);
      setShowClearVocabConfirm(false);
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 10000);
    } else {
      setShowClearVocabConfirm(false);
    }
  };

  const handleUndoClear = () => {
    if (lastClearedVocabList) {
      setVocabList(lastClearedVocabList);
      setLastClearedVocabList(null);
      setShowUndoToast(false);
    } else if (vocabHistory.length > 0) {
      const lastFromHistory = vocabHistory[0];
      setVocabList(lastFromHistory);
      setVocabHistory(prev => prev.slice(1));
    }
  };

  const handleGenerate = async (questTitle?: string, advancedOptions?: AdvancedOptions) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${mm}${dd}${hh}${min}`;
      
      const baseTitle = questTitle?.trim() || 'Magic Quest';
      const finalTitle = `${baseTitle}_${timestamp}`;

      // Chunk vocabList into arrays of batchSize
      const chunks: VocabItem[][] = [];
      for (let i = 0; i < vocabList.length; i += batchSize) {
        chunks.push(vocabList.slice(i, i + batchSize));
      }

      // Keep track of remaining vocabList
      let remainingVocab = [...vocabList];
      let generatedCount = 0;
      const totalWords = vocabList.length;

      let firstSession: PracticeSession | null = null;

      for (let i = 0; i < chunks.length; i++) {
        const generatedSession = await generatePractice(
          chunks[i], 
          selectedModel,
          (currentBatchCount) => {
            setProgress({ current: generatedCount + currentBatchCount, total: totalWords });
          },
          finalTitle,
          magicWaitTime * 1000,
          advancedOptions,
          setStatus
        );
        
        if (!generatedSession.questions || generatedSession.questions.length === 0) {
          throw new Error(`Failed to generate questions for batch ${i + 1}.`);
        }

        generatedCount += chunks[i].length;
        
        // Add part number if there are multiple chunks
        if (chunks.length > 1) {
          generatedSession.title = `${finalTitle} (Part ${i + 1})`;
        } else {
          generatedSession.title = finalTitle;
        }
        
        generatedSession.category = currentCategory;

        if (i === 0) {
          firstSession = generatedSession;
        }

        // Save incrementally
        setSavedSessions(prev => [generatedSession, ...prev]);
        
        // Update remaining vocabList (remove processed chunk)
        remainingVocab = remainingVocab.slice(chunks[i].length);
        setVocabList(remainingVocab);

        if (i < chunks.length - 1) {
          // Add a delay between generating sessions to avoid rate limits
          // Configurable wait time to handle quota limits
          await new Promise(resolve => setTimeout(resolve, magicWaitTime * 1000));
        }
      }

      if (chunks.length === 1 && firstSession) {
        setSession(firstSession);
        setCurrentView('practice');
      } else {
        setCurrentView('saved');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Oops! Something went wrong while creating the practice. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleExtractFromDoc = async (files: File[], level?: string, startPage?: number, endPage?: number, isGridPattern?: boolean) => {
    setIsGenerating(true);
    setError(null);
    try {
      let allExtracted: VocabItem[] = [];
      
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${mm}${dd}${hh}${min}`;

      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const file = files[i];
        
        let mimeType = file.type || 'application/octet-stream';

        if (file.type === 'application/pdf') {
          setStatus(`Analyzing PDF ${file.name}...`);
          const pdfDoc = await loadPdfDocument(file);
          const numPages = pdfDoc.numPages;
          
          const start = startPage && startPage > 0 ? Math.max(1, startPage) : 1;
          const end = endPage && endPage > 0 ? Math.min(numPages, endPage) : numPages;
          
          for (let p = start; p <= end; p++) {
            try {
              setStatus(`Extracting words from ${file.name} (Page ${p} of ${numPages})...`);
              
              // Extract just this page to save memory
              const pageImageBase64 = await pdfDoc.extractPageAsImage(p);
              
              const pageExtracted = await extractVocabFromDoc(pageImageBase64, 'image/jpeg', selectedModel, level, setStatus, isGridPattern);
              
              const pagesToExtract = end - start + 1;
              if (pagesToExtract <= 2) {
                allExtracted = [...allExtracted, ...pageExtracted];
              }
              
              // Save each page as a separate list
              const newList: SavedVocabList = {
                id: crypto.randomUUID(),
                title: `${file.name.split('.')[0]}_Page_${p}${level ? `_${level}` : ''}_${timestamp}`,
                words: pageExtracted,
                category: currentCategory,
                createdAt: Date.now()
              };
              setSavedVocabLists(prev => [newList, ...prev]);
            } catch (pageErr) {
              console.error(`Failed to extract page ${p} of ${file.name}:`, pageErr);
              // Continue to next page instead of failing the whole document
            }
            
            if (p < numPages) {
              await new Promise(resolve => setTimeout(resolve, magicWaitTime * 1000));
            }
          }
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Handle .docx by extracting text AND images
          const arrayBuffer = await file.arrayBuffer();
          
          // Extract text
          const textResult = await mammoth.extractRawText({ arrayBuffer });
          const text = textResult.value;
          
          // Extract images
          const images: { mimeType: string, data: string }[] = [];
          try {
            await mammoth.convertToHtml({ arrayBuffer }, {
              convertImage: (mammoth.images as any).inline((element: any) => {
                return element.read("base64").then(async (imageBuffer: string) => {
                  const resizedBuffer = await resizeImageBase64(imageBuffer, element.contentType);
                  images.push({
                    mimeType: element.contentType,
                    data: resizedBuffer
                  });
                  return { src: "" };
                });
              })
            });
          } catch (imageErr) {
            console.warn('Failed to extract images from docx, continuing with text only', imageErr);
          }
          
          const parts = [
            { mimeType: 'text/plain', data: text },
            ...images
          ];
          
          const extracted = await extractVocabFromDoc(parts, mimeType, selectedModel, level, setStatus, isGridPattern);
          allExtracted = [...allExtracted, ...extracted];
          
          const newList: SavedVocabList = {
            id: crypto.randomUUID(),
            title: `${file.name.split('.')[0]}${level ? `_${level}` : ''}_${timestamp}`,
            words: extracted,
            category: currentCategory,
            createdAt: Date.now()
          };
          setSavedVocabLists(prev => [newList, ...prev]);
        } else {
          // Handle other files (images, text)
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(file);
          let base64 = await base64Promise;
          
          if (file.type.startsWith('image/')) {
            base64 = await resizeImageBase64(base64, file.type);
          }
          
          const extracted = await extractVocabFromDoc(base64, mimeType, selectedModel, level, setStatus, isGridPattern);
          
          allExtracted = [...allExtracted, ...extracted];
          
          const newList: SavedVocabList = {
            id: crypto.randomUUID(),
            title: `${file.name.split('.')[0]}${level ? `_${level}` : ''}_${timestamp}`,
            words: extracted,
            category: currentCategory,
            createdAt: Date.now()
          };
          setSavedVocabLists(prev => [newList, ...prev]);
        }

        if (i < files.length - 1 && file.type !== 'application/pdf') {
          // Add a delay between extractions to avoid rate limits
          // (PDFs already have internal delays between pages)
          await new Promise(resolve => setTimeout(resolve, magicWaitTime * 1000));
        }
      }

      if (allExtracted.length > 0) {
        setVocabList((prev) => [...prev, ...allExtracted]);
      }
      
      // Only navigate to saved view if we processed a PDF with > 2 pages extracted
      let hasLargePdf = false;
      for (const f of files) {
        if (f.type === 'application/pdf') {
          const pdfDoc = await loadPdfDocument(f);
          const start = startPage && startPage > 0 ? Math.max(1, startPage) : 1;
          const end = endPage && endPage > 0 ? Math.min(pdfDoc.numPages, endPage) : pdfDoc.numPages;
          const pagesToExtract = end - start + 1;
          
          if (pagesToExtract > 2) {
            hasLargePdf = true;
            break;
          }
        }
      }
      
      if (hasLargePdf) {
        setCurrentView('saved');
        setSavedTab('vocab');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Oops! Something went wrong while reading the documents or extracting words. Please try again.');
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

  const handleQuickReview = (words: VocabItem[], title?: string) => {
    if (words.length === 0) {
      setNotification({ message: 'No words selected for review!', type: 'error' });
      return;
    }
    const newSession = generateLocalPractice(words, title || 'Quick Power Up');
    setSession(newSession);
    setCurrentView('practice');
    setNotification({ message: `Quick Review "${newSession.title}" started!`, type: 'success' });
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

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingItemId(id);
    setEditingItemTitle(currentTitle);
  };

  const handleSaveRename = (type: 'session' | 'vocabList') => {
    if (!editingItemId || !editingItemTitle.trim()) {
      setEditingItemId(null);
      return;
    }

    if (type === 'session') {
      setSavedSessions(prev => prev.map(s => 
        s.id === editingItemId ? { ...s, title: editingItemTitle.trim() } : s
      ));
    } else {
      setSavedVocabLists(prev => prev.map(s => 
        s.id === editingItemId ? { ...s, title: editingItemTitle.trim() } : s
      ));
    }
    setEditingItemId(null);
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

  const toggleVocabListSelection = (id: string) => {
    setSelectedVocabListIds(prev => 
      prev.includes(id) ? prev.filter(listId => listId !== id) : [...prev, id]
    );
  };

  const handleBatchLoadVocabLists = () => {
    const selectedLists = savedVocabLists.filter(list => selectedVocabListIds.includes(list.id));
    const combinedWords = selectedLists.flatMap(list => list.words);
    // Deduplicate words based on the word string (case-insensitive)
    const uniqueWordsMap = new Map();
    combinedWords.forEach(item => {
      const key = item.word.toLowerCase();
      if (!uniqueWordsMap.has(key)) {
        uniqueWordsMap.set(key, item);
      }
    });
    setVocabList(Array.from(uniqueWordsMap.values()));
    setCurrentView('builder');
    setSelectedVocabListIds([]);
  };

  const handleBatchGenerateIndividual = async (listsToGenerate?: SavedVocabList[] | React.MouseEvent) => {
    const selectedLists = Array.isArray(listsToGenerate) 
      ? listsToGenerate 
      : savedVocabLists.filter(list => selectedVocabListIds.includes(list.id));
    if (selectedLists.length === 0) return;

    setIsGenerating(true);
    setError(null);
    // Do not switch to builder view, stay on saved view to show progress
    
    try {
      let generatedCount = 0;
      const totalWords = selectedLists.reduce((acc, list) => acc + list.words.length, 0);

      for (let i = 0; i < selectedLists.length; i++) {
        const list = selectedLists[i];
        if (list.words.length === 0) continue;

        // Use the list's title for the session
        const finalTitle = list.title;

        const generatedSession = await generatePractice(
          list.words,
          selectedModel,
          (currentBatchCount) => {
            setProgress({ current: generatedCount + currentBatchCount, total: totalWords });
          },
          finalTitle,
          magicWaitTime * 1000,
          { batchSize: 1 }, // Force batch size 1 for individual list generation
          setStatus
        );

        if (!generatedSession.questions || generatedSession.questions.length === 0) {
          throw new Error(`Failed to generate questions for list ${list.title}.`);
        }

        generatedCount += list.words.length;
        generatedSession.title = finalTitle;
        generatedSession.category = list.category || currentCategory;

        setSavedSessions(prev => [generatedSession, ...prev]);

        if (i < selectedLists.length - 1) {
          await new Promise(resolve => setTimeout(resolve, magicWaitTime * 1000));
        }
      }

      setSavedTab('todo');
      setCurrentView('saved');
      setSelectedVocabListIds([]);
    } catch (err) {
      console.error('Batch generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate practice sessions');
    } finally {
      setIsGenerating(false);
      setStatus('');
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleRestoreFromSession = (session: PracticeSession) => {
    if (session.originalVocab) {
      setVocabList(session.originalVocab);
      setCurrentView('builder');
    }
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
          if (newProgress[wordKey].correct >= 3) {
            newProgress[wordKey].isMastered = true;
          }
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
            lastAttempted: Date.now(),
            wordsToReview: isPassed ? [] : failedQuestions.map(q => q.word).filter(Boolean) as string[]
          };
        }
        
        // If this is a review session and it was passed, mark the original session as passed and mastered
        if (isPassed && session.title.startsWith('Review: ') && s.title === session.title.replace('Review: ', '')) {
          return {
            ...s,
            isPassed: true,
            isMastered: true,
            lastAttempted: Date.now(),
            wordsToReview: []
          };
        }
        
        return s;
      });
      
      // If a review session was passed, we can remove it since the original is now mastered
      if (isPassed && session.title.startsWith('Review: ')) {
        updated = updated.filter(s => s.id !== session.id);
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
    const setDownloading = withAnswers ? setIsDownloadingTeacher : setIsDownloadingStudent;
    setDownloading(true);

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
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportData = () => {
    const data = JSON.stringify(window.appStore, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab_backup_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Check for conflicts
        const conflicts = Object.keys(data).filter(key => {
          // Only count as conflict if the value is different
          return window.appStore[key] !== undefined && window.appStore[key] !== data[key];
        });
        
        if (conflicts.length > 0) {
          setConflictingKeys(conflicts);
          setImportDataToConfirm(data);
        } else {
          // No conflicts or identical values, just import
          await performImport(data);
        }
      } catch (err) {
        setError('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const performImport = async (data: any) => {
    const keys = Object.keys(data);
    const total = keys.length;
    setImportProgress({ current: 0, total });
    
    try {
      const timestamp = Date.now();
      const timestampStr = new Date(timestamp).toLocaleString();
      
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        let value = data[key];
        
        // Add timestamp to the value if it's an object or array of objects
        if (Array.isArray(value)) {
          value = value.map(item => {
            if (typeof item === 'object' && item !== null) {
              return { ...item, lastImportedAt: timestamp, lastImportedStr: timestampStr };
            }
            return item;
          });
        } else if (typeof value === 'object' && value !== null) {
          value = { ...value, lastImportedAt: timestamp, lastImportedStr: timestampStr };
        }
        
        await window.setStoreItem(key, value);
        setImportProgress({ current: i + 1, total });
        // Small delay to show progress if it's too fast
        if (total < 20) await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Redirect to library tab (saved view) after reload
      const user = window.getStoreItem('currentUser');
      window.setStoreItem(`currentView_${user || 'default'}`, 'saved');
      
      window.location.reload();
    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to import data.');
      setImportProgress(null);
      setImportDataToConfirm(null);
    }
  };

  const confirmImport = async () => {
    if (!importDataToConfirm) return;
    await performImport(importDataToConfirm);
  };

  const filteredAndSortedSessions = savedSessions
    .filter(s => {
      const matchesTab = savedTab === 'mastered' ? s.isMastered : !s.isMastered;
      const matchesCategory = savedCategoryFilter === 'ALL' || s.category === savedCategoryFilter;
      return matchesTab && matchesCategory;
    })
    .sort((a, b) => {
      switch (questSortOrder) {
        case 'retry': {
          const aFailed = a.lastAttempted && !a.isPassed ? 1 : 0;
          const bFailed = b.lastAttempted && !b.isPassed ? 1 : 0;
          if (aFailed !== bFailed) return bFailed - aFailed;
          return ((a.bestScore || 0) / a.questions.length) - ((b.bestScore || 0) / b.questions.length);
        }
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'score-high': return ((b.bestScore || 0) / b.questions.length) - ((a.bestScore || 0) / a.questions.length);
        case 'score-low': return ((a.bestScore || 0) / a.questions.length) - ((b.bestScore || 0) / b.questions.length);
        case 'alpha': return a.title.localeCompare(b.title);
        case 'newest':
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const filteredVocabLists = savedVocabLists.filter(l => {
    return savedCategoryFilter === 'ALL' || l.category === savedCategoryFilter;
  });

  const totalItems = savedTab === 'vocab' ? filteredVocabLists.length : filteredAndSortedSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentSessions = filteredAndSortedSessions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const currentVocabLists = filteredVocabLists.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const [showIconPicker, setShowIconPicker] = useState(false);
  const AVAILABLE_ICONS = ['👤', '👨‍🏫', '👩‍🏫', '🎓', '🧒', '👧', '👦', '🦁', '🐯', '🐼', '🦊', '🐨', '🚀', '🌈', '🎨', '🎮', '⚽', '🎸'];

  const handleUpdateIcon = (icon: string) => {
    setUserIcon(icon);
    window.setStoreItem(`userIcon_${currentUser}`, icon);
    setShowIconPicker(false);
    setNotification({ type: 'success', message: 'Profile icon updated!' });
  };

  const handleUploadIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit for localStorage
      setNotification({ type: 'error', message: 'Image too large! Please use a smaller photo (< 500KB).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUserIcon(base64);
      window.setStoreItem(`userIcon_${currentUser}`, base64);
      setShowIconPicker(false);
      setNotification({ type: 'success', message: 'Profile photo uploaded!' });
    };
    reader.readAsDataURL(file);
  };

  const renderUserIcon = (icon: string, className: string = "text-2xl") => {
    if (icon.startsWith('data:image')) {
      return (
        <img 
          src={icon} 
          alt="User Profile" 
          className={`${className} w-full h-full object-cover rounded-lg`}
          referrerPolicy="no-referrer"
        />
      );
    }
    return <span className={className}>{icon}</span>;
  };

  if (!isLoggedIn) {
    const previewIcon = window.getStoreItem(`userIcon_${username}`);
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <motion.div 
              key={previewIcon || 'default'}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl text-5xl overflow-hidden border-4 border-white"
            >
              {previewIcon ? (
                renderUserIcon(previewIcon, "text-4xl")
              ) : (
                <BookOpen size={44} className="text-white" />
              )}
            </motion.div>
          </div>
          <h1 className="text-3xl font-black text-center text-slate-800 mb-2 tracking-tight">Vocab Quest</h1>
          <p className="text-center text-slate-500 mb-8 font-medium">Welcome back, Hero! 🚀</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
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
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 min-w-[300px] ${
              notification.type === 'error' ? 'bg-red-600 text-white' : 
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 
              'bg-indigo-600 text-white'
            }`}
          >
            {notification.type === 'error' ? <AlertCircle size={20} /> : 
             notification.type === 'success' ? <CheckCircle2 size={20} /> : 
             <Bell size={20} />}
            <span className="font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            {/* Logo Section */}
            <div className="flex items-center gap-3 shrink-0">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: -5 }}
                className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200"
              >
                <BookOpen size={26} className="text-white" />
              </motion.div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight leading-none">
                  Vocab Quest
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">AI Language Mastery</p>
              </div>
              {streak > 0 && (
                <motion.div 
                  animate={showStreakAnimation ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-100 ml-1"
                >
                  <span>🔥</span>
                  <span>{streak} Day{streak !== 1 ? 's' : ''}</span>
                </motion.div>
              )}
            </div>

            {/* Center Navigation */}
            {currentView !== 'practice' && (
              <nav className="flex bg-slate-100/80 p-1 rounded-2xl gap-1 border border-slate-200/50">
                {userRole === 'teacher' && (
                  <button
                    onClick={() => setCurrentView('builder')}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                      currentView === 'builder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                    }`}
                  >
                    <Wand2 size={18} />
                    <span className="hidden sm:inline">Create</span>
                  </button>
                )}
                <button
                  onClick={() => setCurrentView('saved')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                    currentView === 'saved' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                  }`}
                >
                  <Backpack size={18} />
                  <span className="hidden sm:inline">{userRole === 'teacher' ? 'Library' : 'Backpack'}</span>
                  {savedSessions.length > 0 && (
                    <span className={`hidden md:flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] ${currentView === 'saved' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                      {savedSessions.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCurrentView('progress')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                    currentView === 'progress' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                  }`}
                >
                  <Trophy size={18} />
                  <span className="hidden sm:inline">{userRole === 'teacher' ? 'Trophies' : 'Stats'}</span>
                </button>
                <button
                  onClick={() => setCurrentView('resources')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                    currentView === 'resources' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                  }`}
                >
                  <Sparkles size={18} className="text-amber-500" />
                  <span className="hidden sm:inline">Discover</span>
                </button>
              </nav>
            )}

            {currentView === 'practice' && (
              <button
                onClick={handleRestart}
                className="px-5 py-2.5 bg-slate-100 text-sm font-bold text-slate-600 rounded-xl hover:bg-slate-200 hover:text-indigo-600 transition-colors flex items-center gap-2"
              >
                <FolderHeart size={18} />
                <span>Exit Quest</span>
              </button>
            )}

            {/* Right Section: Settings & Profile */}
            <div className="flex items-center gap-3">
              {userRole === 'teacher' && (
                <div className="hidden xl:flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                  >
                    <option value={3}>Batch: 3</option>
                    <option value={5}>Batch: 5</option>
                    <option value={10}>Batch: 10</option>
                  </select>
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 hover:bg-white rounded-xl transition-all border border-slate-200 hover:border-indigo-200 group shadow-sm"
                >
                  <div className="w-9 h-9 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden rounded-lg bg-white shadow-inner">
                    {renderUserIcon(userIcon, "text-2xl")}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Hero</p>
                    <p className="text-sm font-black text-slate-700 leading-none">{currentUser}</p>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showIconPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50"
                    >
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Profile Settings</h3>
                        <button onClick={() => setShowIconPicker(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-6 gap-2 mb-6">
                        {AVAILABLE_ICONS.map(icon => (
                          <button
                            key={icon}
                            onClick={() => handleUpdateIcon(icon)}
                            className={`text-2xl p-2 rounded-xl hover:bg-indigo-50 transition-all ${userIcon === icon ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' : 'hover:scale-110'}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="w-full py-3 px-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm shadow-sm">
                          <Upload size={18} />
                          Upload Custom Photo
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleUploadIcon}
                          />
                        </label>
                        
                        <button
                          onClick={handleLogout}
                          className="w-full py-3 text-sm font-black text-red-600 hover:bg-red-50 rounded-2xl transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-red-100"
                        >
                          <LogOut size={18} />
                          Log Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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

        <AnimatePresence>
          {showUndoToast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-4 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <Wand2 size={16} />
                </div>
                <span className="font-medium">Vocabulary list cleared!</span>
              </div>
              <div className="h-6 w-px bg-slate-700 mx-2" />
              <button
                onClick={handleUndoClear}
                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-2 transition-colors"
              >
                UNDO
              </button>
              <button
                onClick={() => setShowUndoToast(false)}
                className="text-slate-400 hover:text-white transition-colors ml-2"
              >
                <X size={18} />
              </button>
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
                  Are you sure you want to delete all words from your vocabulary list? (You can undo this for 10 seconds).
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
                savedVocabLists={savedVocabLists}
                onAdd={handleAddVocab}
                onBulkAdd={handleBulkAddVocab}
                onRemove={handleRemoveVocab}
                onClearAll={handleClearAllVocab}
                onGenerate={handleGenerate}
                onExtractFromDoc={handleExtractFromDoc}
                onRestoreLastCleared={handleUndoClear}
                hasHistory={vocabHistory.length > 0}
                isGenerating={isGenerating}
                progress={progress}
                status={status}
                currentCategory={currentCategory}
                onCategoryChange={setCurrentCategory}
              />
            </motion.div>
          )}

          {currentView === 'resources' && (
          <Discover 
            onExtract={handleBulkAddVocab} 
            onViewBuilder={() => setCurrentView('builder')} 
            userResources={savedVocabLists}
          />
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
                  <span>{userRole === 'teacher' ? '📚' : '🎒'}</span> {userRole === 'teacher' ? 'Library' : 'My Backpack'} <span>{userRole === 'teacher' ? '📚' : '🎒'}</span>
                </h2>
                
                <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8 max-w-md mx-auto gap-1">
                  <button
                    onClick={() => { setSavedTab('todo'); setCurrentPage(1); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      savedTab === 'todo' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <BookOpen size={18} />
                    Quests
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      savedTab === 'todo' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {savedSessions.filter(s => !s.isMastered && (savedCategoryFilter === 'ALL' || s.category === savedCategoryFilter)).length}
                    </span>
                  </button>
                  <button
                    onClick={() => { setSavedTab('mastered'); setCurrentPage(1); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      savedTab === 'mastered' ? 'bg-white text-emerald-600 shadow-sm scale-105' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50'
                    }`}
                  >
                    <Trophy size={18} />
                    Mastered
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      savedTab === 'mastered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {savedSessions.filter(s => s.isMastered && (savedCategoryFilter === 'ALL' || s.category === savedCategoryFilter)).length}
                    </span>
                  </button>
                  {userRole === 'teacher' && (
                    <button
                      onClick={() => { setSavedTab('vocab'); setCurrentPage(1); }}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                        savedTab === 'vocab' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
                      }`}
                    >
                      <FolderHeart size={18} />
                      Word Lists
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        savedTab === 'vocab' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {savedVocabLists.filter(l => savedCategoryFilter === 'ALL' || l.category === savedCategoryFilter).length}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex justify-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                  {(['ALL', 'NCE', 'PET', 'General', 'MistakeBook'] as const).map((cat) => {
                    let count = 0;
                    if (savedTab === 'vocab') {
                      count = cat === 'ALL' ? savedVocabLists.length : savedVocabLists.filter(l => l.category === cat).length;
                    } else if (savedTab === 'todo') {
                      count = cat === 'ALL' ? savedSessions.filter(s => !s.isMastered).length : savedSessions.filter(s => !s.isMastered && s.category === cat).length;
                    } else if (savedTab === 'mastered') {
                      count = cat === 'ALL' ? savedSessions.filter(s => s.isMastered).length : savedSessions.filter(s => s.isMastered && s.category === cat).length;
                    }
                    
                    return (
                      <button
                        key={cat}
                        onClick={() => { setSavedCategoryFilter(cat); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold rounded-full transition-all border flex items-center gap-1.5 ${
                          savedCategoryFilter === cat 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        <span>{cat === 'ALL' ? 'All Types' : cat === 'NCE' ? '新概念' : cat === 'PET' ? 'PET' : cat === 'General' ? 'General' : '错题本'}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          savedCategoryFilter === cat ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {savedTab === 'todo' || savedTab === 'mastered' ? (
                  <>
                    <div className="flex justify-center gap-4 mb-6">
                      <button
                        onClick={handleExportData}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors"
                      >
                        Export Data
                      </button>
                      <label className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-xl hover:bg-emerald-200 transition-colors cursor-pointer">
                        Import Data
                        <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                      </label>
                    </div>
                    {savedTab === 'mastered' && savedSessions.filter(s => s.isMastered).length > 0 && (
                      <p className="text-slate-500 font-medium mb-6">
                        {userRole === 'teacher' ? 'These quests have been mastered by students.' : "Wow! Look at all these mastered quests! You're a star! 🌟"}
                      </p>
                    )}
                    {savedTab === 'todo' && savedSessions.filter(s => !s.isMastered).length === 0 && (
                      <p className="text-slate-500 font-medium mb-6">
                        {userRole === 'teacher' ? 'No active quests right now. Create some magic!' : 'No active quests right now. Go create some magic!'}
                      </p>
                    )}
                    {savedTab === 'todo' && savedSessions.filter(s => !s.isMastered).length > 0 && (
                      <p className="text-slate-500 font-medium mb-6">
                        {userRole === 'teacher' ? 'Here are the active quests you have created.' : "Here are your active quests! Let's go!"}
                      </p>
                    )}
                    {savedTab === 'mastered' && savedSessions.filter(s => s.isMastered).length === 0 && (
                      <p className="text-slate-500 font-medium mb-6">
                        {userRole === 'teacher' ? 'No mastered quests yet.' : 'No mastered quests yet. Keep practicing!'}
                      </p>
                    )}
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
                    {filteredAndSortedSessions.length > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleBatchDownload(false)}
                            disabled={isDownloadingStudent}
                            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Download All (Student)"
                          >
                            {isDownloadingStudent ? <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown size={16} />}
                            <span className="hidden sm:inline">Student PDF</span>
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => handleBatchDownload(true)}
                            disabled={isDownloadingTeacher}
                            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Download All (With Answers)"
                          >
                            {isDownloadingTeacher ? <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown size={16} />}
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
                          <option value="retry">Needs Retry</option>
                          <option value="alpha">Alphabetical</option>
                        </select>
                      </div>
                    )}
                    {filteredAndSortedSessions.length === 0 ? (
                      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          {savedTab === 'todo' ? <BookOpen size={32} /> : <Trophy size={32} />}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                          {savedTab === 'todo' ? 'No Active Quests' : 'No Mastered Quests'}
                        </h3>
                        <p className="text-slate-500 mb-6">
                          {savedTab === 'todo' 
                            ? (userRole === 'teacher' ? 'Go to the Create Magic tab to generate some fun practice!' : 'Ask your teacher to create some fun practice quests for you!')
                            : 'Complete quests with 80% or more to master them!'}
                        </p>
                        {savedTab === 'todo' && userRole === 'teacher' && (
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
                      <div key={s.id} className={`bg-white p-6 rounded-3xl shadow-sm border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${s.wordsToReview && s.wordsToReview.length > 0 ? 'border-amber-200 bg-amber-50/30 hover:border-amber-300' : 'border-slate-100 hover:border-indigo-200'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {s.category && s.category !== 'General' && (
                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${
                              s.category === 'NCE' ? 'bg-emerald-100 text-emerald-700' : 
                              s.category === 'PET' ? 'bg-amber-100 text-amber-700' : 
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {s.category === 'NCE' ? '新概念' : s.category === 'PET' ? 'PET' : '错题本'}
                            </span>
                          )}
                          {s.wordsToReview && s.wordsToReview.length > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-md uppercase tracking-wider">Needs Review</span>
                          )}
                          {editingItemId === s.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingItemTitle}
                                onChange={(e) => setEditingItemTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename('session');
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                                autoFocus
                                className="px-3 py-1 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500 text-lg font-bold text-slate-800"
                              />
                              <button onClick={() => handleSaveRename('session')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                <Check size={18} />
                              </button>
                              <button onClick={() => setEditingItemId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <h3 className="text-lg font-bold text-slate-800">
                                {['Review Test', 'Targeted Practice', 'Review Practice', 'Learning Practice', 'Mastery Review'].includes(s.title) && s.originalVocab 
                                  ? s.originalVocab.map(v => v.word).join(', ') 
                                  : s.title}
                              </h3>
                              {s.category && (
                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${
                                  s.category === 'NCE' ? 'bg-emerald-100 text-emerald-700' : 
                                  s.category === 'PET' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {s.category === 'NCE' ? '新概念' : s.category === 'PET' ? 'PET' : 'General'}
                                </span>
                              )}
                              <button 
                                onClick={() => handleStartRename(s.id, s.title)}
                                className="p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Rename Quest"
                              >
                                <Pencil size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
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
                        {s.wordsToReview && s.wordsToReview.length > 0 && (
                          <div className="mt-2 bg-white/50 rounded-xl p-3 border border-amber-100">
                            <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                              <AlertCircle size={14} />
                              Words to Review:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {s.wordsToReview.map((word, idx) => (
                                <span key={idx} className="px-2.5 py-1 bg-white text-amber-700 text-xs font-medium rounded-lg border border-amber-200 shadow-sm">
                                  {word}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start mt-2 sm:mt-0">
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
                        {s.originalVocab && (
                          <button
                            onClick={() => handleRestoreFromSession(s)}
                            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                            title="Restore words to Builder"
                          >
                            <Wand2 size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => handleStartPractice(s)}
                          className={`flex-1 sm:flex-none px-6 py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                            s.wordsToReview && s.wordsToReview.length > 0
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          {s.lastAttempted && (!s.isPassed || (s.wordsToReview && s.wordsToReview.length > 0)) ? <RotateCcw size={18} /> : <Play size={18} />}
                          {s.lastAttempted ? ((!s.isPassed || (s.wordsToReview && s.wordsToReview.length > 0)) ? 'Retry' : 'Practice Again') : 'Start'}
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
          ) : (
            <>
              {filteredVocabLists.length === 0 ? (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FolderHeart size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">
                        {savedCategoryFilter === 'ALL' ? 'No Word Lists Yet' : savedCategoryFilter === 'MistakeBook' ? 'No Mistake Book Lists' : `No ${savedCategoryFilter} Lists`}
                      </h3>
                      <p className="text-slate-500 mb-6">
                        {savedCategoryFilter === 'ALL' 
                          ? 'Go to the Create Magic tab to build your first word list!'
                          : `You don't have any ${savedCategoryFilter === 'NCE' ? '新概念' : savedCategoryFilter === 'MistakeBook' ? '错题本' : savedCategoryFilter} word lists yet.`}
                      </p>
                      {savedCategoryFilter === 'ALL' && (
                        <button
                          onClick={() => setCurrentView('builder')}
                          className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          Create Magic
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100 gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={currentVocabLists.length > 0 && currentVocabLists.every(list => selectedVocabListIds.includes(list.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newIds = new Set([...selectedVocabListIds, ...currentVocabLists.map(l => l.id)]);
                                setSelectedVocabListIds(Array.from(newIds));
                              } else {
                                setSelectedVocabListIds(selectedVocabListIds.filter(id => !currentVocabLists.some(l => l.id === id)));
                              }
                            }}
                            className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-sm font-bold text-slate-700">Select All on Page</span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4">
                          {selectedVocabListIds.length === 0 && filteredVocabLists.length > 0 && (
                            <button
                              onClick={() => handleBatchGenerateIndividual(filteredVocabLists)}
                              disabled={isGenerating}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                              title={`Generate a separate Qtest for all ${filteredVocabLists.length} lists in this category`}
                            >
                              {isGenerating ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <Wand2 size={16} />
                              )}
                              {isGenerating ? 'Generating...' : `Generate All ${filteredVocabLists.length} Quests`}
                            </button>
                          )}
                          
                          {selectedVocabListIds.length > 0 && (
                            <>
                              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                {selectedVocabListIds.length} selected
                              </span>
                              <button
                                onClick={handleBatchGenerateIndividual}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                title="Generate a separate Qtest for each selected list"
                              >
                                {isGenerating ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <Wand2 size={16} />
                                )}
                                {isGenerating ? 'Generating...' : 'Batch Gen Qtests'}
                              </button>
                              <button
                                onClick={handleBatchLoadVocabLists}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                title="Combine all selected lists into the builder"
                              >
                                <Play size={16} />
                                Combine & Load
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {isGenerating && progress && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 mb-4">
                          <div className="flex justify-between text-sm font-bold text-indigo-600 mb-2">
                            <span>{status || 'Generating practice sessions...'}</span>
                            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                            <motion.div
                              className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      )}

                      {currentVocabLists.map((list) => (
                          <div key={list.id} className={`bg-white p-6 rounded-3xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${selectedVocabListIds.includes(list.id) ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200'}`}>
                            <div className="flex items-center gap-4 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedVocabListIds.includes(list.id)}
                                onChange={() => toggleVocabListSelection(list.id)}
                                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {list.category && list.category !== 'General' && (
                                  <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${
                                    list.category === 'NCE' ? 'bg-emerald-100 text-emerald-700' : 
                                    list.category === 'PET' ? 'bg-amber-100 text-amber-700' : 
                                    'bg-rose-100 text-rose-700'
                                  }`}>
                                    {list.category === 'NCE' ? '新概念' : list.category === 'PET' ? 'PET' : '错题本'}
                                  </span>
                                )}
                                {editingItemId === list.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingItemTitle}
                                      onChange={(e) => setEditingItemTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRename('vocabList');
                                        if (e.key === 'Escape') setEditingItemId(null);
                                      }}
                                      autoFocus
                                      className="px-3 py-1 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500 text-lg font-bold text-slate-800"
                                    />
                                    <button onClick={() => handleSaveRename('vocabList')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                      <Check size={18} />
                                    </button>
                                    <button onClick={() => setEditingItemId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                      <X size={18} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 group">
                                    <h3 className="text-lg font-bold text-slate-800">{list.title}</h3>
                                    {list.category && (
                                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${
                                        list.category === 'NCE' ? 'bg-emerald-100 text-emerald-700' : 
                                        list.category === 'PET' ? 'bg-amber-100 text-amber-700' : 
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                        {list.category === 'NCE' ? '新概念' : list.category === 'PET' ? 'PET' : 'General'}
                                      </span>
                                    )}
                                    <button 
                                      onClick={() => handleStartRename(list.id, list.title)}
                                      className="p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="Rename List"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
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
                    </div>
                  )}
                </>
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
                vocabList={vocabList}
                wordProgress={wordProgress}
                onRestart={handleRestart} 
                onComplete={handleCompletePractice}
                onMoveToMastered={() => {
                  handleMoveToMastered(session.id);
                  handleRestart();
                }}
                onPowerUp={(words) => handleRegenerate(words, 'Power Up Practice')}
                onQuickReview={(words) => handleQuickReview(words, 'Quick Power Up')}
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
              <ProgressView 
                wordProgress={wordProgress} 
                vocabList={vocabList} 
                savedSessions={savedSessions}
                onRegenerate={handleRegenerate} 
                onQuickReview={handleQuickReview}
                isGenerating={isGenerating}
                students={students}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showChangelogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">What's New</h2>
              <button onClick={() => setShowChangelogModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="prose prose-slate">
              <h3>[1.3.0] - 2026-03-20</h3>
              <ul>
                <li><strong>Smart Import:</strong> Importing data now checks for conflicts and asks for confirmation before replacing existing data.</li>
                <li><strong>Improved API Reliability:</strong> Added robust exponential backoff and quota detection for smoother AI generation.</li>
                <li><strong>Dual Backup System:</strong> Your data is now backed up both on our server and in your browser's local storage.</li>
              </ul>
              <h3>[1.2.0] - 2026-03-17</h3>
              <ul>
                <li>Added "Regenerate Practice" functionality for "Brain Growing" and "Power Up Needed" words to ensure repeated training.</li>
                <li>Daily notifications now include specific words that need practice.</li>
              </ul>
              <h3>[1.1.0] - 2026-03-17</h3>
              <ul>
                <li>Improved practice sessions: Now generates both multiple-choice and fill-in-the-blank questions for every word.</li>
                <li>Added "Memory Tips" (mnemonics) to help users remember words better.</li>
              </ul>
              <h3>[1.0.0] - 2026-03-17</h3>
              <ul>
                <li>Implemented "Review Test" feature in the Mastered tab, allowing users to practice words in a "Meaning &rarr; Word" format.</li>
                <li>Added automatic word mastery tracking: words are marked as mastered after 3 correct answers.</li>
                <li>Added a changelog to keep users updated on new features and improvements.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {importDataToConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl">
            {importProgress ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Importing Data...</h3>
                <p className="text-slate-500 mb-6">Please wait while we update your records.</p>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                  <div 
                    className="bg-amber-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Progress</span>
                  <span>{importProgress.current} / {importProgress.total} items</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                  <AlertTriangle size={32} />
                  <h3 className="text-2xl font-bold">Data Conflict Detected</h3>
                </div>
                <p className="text-slate-600 mb-6">
                  The file you are importing contains data that already exists in your browser. 
                  Importing will <span className="font-bold text-red-600">overwrite</span> the following items:
                </p>
                <div className="bg-slate-50 rounded-xl p-4 mb-8 max-h-40 overflow-y-auto border border-slate-200">
                  <ul className="space-y-1">
                    {conflictingKeys.map(key => (
                      <li key={key} className="text-xs font-mono text-slate-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {key}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setImportDataToConfirm(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmImport}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200"
                  >
                    Replace All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <footer className="bg-slate-50/50 border-t border-slate-200/60 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <BookOpen size={18} className="text-white" />
                </div>
                <span className="text-lg font-black text-slate-800 tracking-tight">Vocab Quest</span>
              </div>
              <p className="text-sm text-slate-500 font-medium">Empowering language learners with AI magic.</p>
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                <span>Made with</span>
                <Heart size={12} className="text-red-400 fill-red-400" />
                <span>for students everywhere</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {userRole === 'student' && (
                <button
                  onClick={handleNotify}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all flex items-center gap-2 border border-slate-200 hover:border-indigo-100 shadow-sm"
                >
                  <Bell size={18} />
                  <span>Remind Me</span>
                </button>
              )}
              <button
                onClick={() => setShowChangelogModal(true)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all flex items-center gap-2 border border-slate-200 hover:border-indigo-100 shadow-sm"
              >
                <Sparkles size={18} />
                <span>What's New</span>
              </button>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-200/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">© 2026 Vocab Quest AI</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest">Privacy</a>
              <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest">Terms</a>
              <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
