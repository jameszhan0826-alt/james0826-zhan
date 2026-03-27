import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Sparkles, FileText, Upload, X, List, Download, FileDown, Volume2, BookOpen, Wand2, Loader2, Check, Library } from 'lucide-react';
import { VocabItem, AdvancedOptions } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { printToPDF } from '../utils/pdf';
import { playHighQualityAudio } from '../utils/audio';
import { Discover } from './Discover';

interface SavedVocabList {
  id: string;
  title: string;
  words: VocabItem[];
  createdAt: string | number;
  category?: 'General' | 'NCE' | 'PET' | 'MistakeBook';
}

interface VocabInputProps {
  vocabList: VocabItem[];
  savedVocabLists: SavedVocabList[];
  onAdd: (word: string, meaning: string, example?: string, exampleTranslation?: string) => string;
  onBulkAdd: (vocab: { word: string; meaning: string; example?: string; exampleTranslation?: string }[], category?: 'NCE' | 'PET' | 'General' | 'MistakeBook') => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onGenerate: (questTitle?: string, advancedOptions?: AdvancedOptions) => void;
  onExtractFromDoc: (files: File[], level?: string, startPage?: number, endPage?: number, isGridPattern?: boolean) => Promise<void>;
  onRestoreLastCleared?: () => void;
  hasHistory?: boolean;
  isGenerating: boolean;
  progress?: { current: number, total: number } | null;
  status?: string | null;
  currentCategory: 'NCE' | 'PET' | 'General' | 'MistakeBook';
  onCategoryChange: (category: 'NCE' | 'PET' | 'General' | 'MistakeBook') => void;
}

export const VocabInput: React.FC<VocabInputProps> = ({
  vocabList,
  savedVocabLists,
  onAdd,
  onBulkAdd,
  onRemove,
  onClearAll,
  onGenerate,
  onExtractFromDoc,
  onRestoreLastCleared,
  hasHistory,
  isGenerating,
  progress,
  status,
  currentCategory,
  onCategoryChange,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'doc' | 'lib'>('list');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [questTitle, setQuestTitle] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customMemoryTips, setCustomMemoryTips] = useState('');
  const [supportGrammarExam, setSupportGrammarExam] = useState(false);
  const [supportZhongkao, setSupportZhongkao] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [extractionLevel, setExtractionLevel] = useState('');
  const [startPage, setStartPage] = useState<string>('');
  const [endPage, setEndPage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim() && meaning.trim()) {
      const addedWord = word.trim();
      const addedMeaning = meaning.trim();
      onAdd(addedWord, addedMeaning, example.trim() || undefined, exampleTranslation.trim() || undefined);
      
      setWord('');
      setMeaning('');
      setExample('');
      setExampleTranslation('');
    }
  };

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit for safety

  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    // Generate previews for images
    const newPreviews: Record<string, string> = {};
    docFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPreviews[index] = url;
      }
    });
    setPreviews(newPreviews);

    // Cleanup
    return () => {
      Object.values(newPreviews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [docFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter((f: File) => ALLOWED_TYPES.includes(f.type));
      const oversizedFiles = validFiles.filter((f: File) => f.size > MAX_FILE_SIZE);

      if (oversizedFiles.length > 0) {
        alert(`Some files are too large (max 15MB): ${oversizedFiles.map((f: File) => f.name).join(', ')}`);
        return;
      }

      if (validFiles.length > 0) {
        setDocFiles(prev => [...prev, ...validFiles]);
      } else {
        alert('Please select valid PDF, Image, or Text files.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFiles = Array.from(e.dataTransfer.files);
      const validFiles = selectedFiles.filter((f: File) => ALLOWED_TYPES.includes(f.type));
      const oversizedFiles = validFiles.filter((f: File) => f.size > MAX_FILE_SIZE);

      if (oversizedFiles.length > 0) {
        alert(`Some files are too large (max 15MB): ${oversizedFiles.map((f: File) => f.name).join(', ')}`);
        return;
      }

      if (validFiles.length > 0) {
        setDocFiles(prev => [...prev, ...validFiles]);
      } else {
        alert('Please drop valid PDF, Image, or Text files.');
      }
    }
  };

  const [isGridPattern, setIsGridPattern] = useState<boolean>(true);

  const handleExtract = async () => {
    if (docFiles.length === 0) return;
    const start = startPage ? parseInt(startPage, 10) : undefined;
    const end = endPage ? parseInt(endPage, 10) : undefined;
    await onExtractFromDoc(docFiles, extractionLevel.trim() || undefined, start, end, isGridPattern);
    setActiveTab('list');
    setDocFiles([]);
    setExtractionLevel('');
    setStartPage('');
    setEndPage('');
  };

  const handleDownloadPDF = () => {
    if (vocabList.length === 0) return;
    
    const htmlContent = `
      <h1>Vocabulary List</h1>
      <table>
        <thead>
          <tr>
            <th>English Word</th>
            <th>Chinese Meaning</th>
          </tr>
        </thead>
        <tbody>
          ${vocabList.map(item => `
            <tr>
              <td>${item.word}</td>
              <td>${item.meaning}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    printToPDF(htmlContent, 'Vocabulary_List');
  };

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const playAudio = async (text: string, lang: string = 'en-US') => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      await playHighQualityAudio(text, lang);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black text-slate-800 mb-2 flex items-center justify-center gap-2">
          <span>✨</span> Create a New Quest! <span>✨</span>
        </h2>
        <p className="text-slate-500 font-medium">
          {vocabList.length > 0
            ? `Awesome! You have ${vocabList.length} magic words ready to practice!`
            : 'Type your magic words here, or upload a PDF to find them!'}
        </p>
      </div>

      <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-6 gap-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
          }`}
        >
          <List size={18} />
          Type Words ⌨️
        </button>
        <button
          onClick={() => setActiveTab('doc')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'doc' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
          }`}
        >
          <FileText size={18} />
          Magic Doc Extract 📄✨
        </button>
        <button
          onClick={() => setActiveTab('lib')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'lib' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
          }`}
        >
          <Library size={18} />
          Discover ✨
        </button>
      </div>

      {activeTab !== 'lib' && (
        <div className="mb-6">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">
            Select Category for this Quest
          </label>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 max-w-sm mx-auto">
            {(['General', 'NCE', 'PET', 'MistakeBook'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  currentCategory === cat 
                    ? 'bg-white text-indigo-600 shadow-sm scale-105' 
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
                }`}
              >
                {cat === 'General' ? 'General' : cat === 'NCE' ? '新概念' : cat === 'PET' ? 'PET' : '错题本'}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'list' ? (
          <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Magic Word (e.g., Apple)"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <input
                type="text"
                placeholder="Chinese Meaning (e.g., 苹果)"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Example Sentence (Optional)"
                value={example}
                onChange={(e) => setExample(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <input
                type="text"
                placeholder="Sentence Translation (Optional)"
                value={exampleTranslation}
                onChange={(e) => setExampleTranslation(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1" />
              <button
                type="submit"
                disabled={!word.trim() || !meaning.trim()}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                <span>Add</span>
              </button>
            </div>
          </form>

          {vocabList.length > 0 && (
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <List size={16} className="text-slate-400" />
                Total Words: <span className="text-indigo-600 text-base">{vocabList.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClearAll}
                  className="text-sm flex items-center gap-2 text-red-600 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="Clear all words"
                >
                  <Trash2 size={16} />
                  Clear All
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="text-sm flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  title="Download as PDF"
                >
                  <FileDown size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-2">
            <AnimatePresence>
              {vocabList.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center">
                      <BookOpen size={24} className="text-slate-300" />
                    </div>

                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 text-lg">{item.word}</span>
                          <button 
                            onClick={() => playAudio(item.word, 'en-US')}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="Listen to word"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                        <span className="hidden sm:inline text-slate-300">-</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">{item.meaning}</span>
                          <button 
                            onClick={() => playAudio(item.meaning, 'zh-CN')}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="Listen to meaning"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      </div>
                      {item.example && (
                        <div className="mt-1">
                          <div className="text-sm text-slate-500 italic flex items-center gap-2">
                            <span>"{item.example}"</span>
                            <button 
                              onClick={() => playAudio(item.example!, 'en-US')}
                              className="text-slate-300 hover:text-indigo-400 transition-colors"
                              title="Listen to example"
                            >
                              <Volume2 size={14} />
                            </button>
                          </div>
                          {item.exampleTranslation && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {item.exampleTranslation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ml-4"
                    aria-label="Remove word"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {vocabList.length === 0 && (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                  <BookOpen size={24} className="text-slate-300" />
                </div>
                <p>No words added yet. Start by adding a word above or uploading a document!</p>
                {hasHistory && onRestoreLastCleared && (
                  <button
                    onClick={onRestoreLastCleared}
                    className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 text-sm"
                  >
                    <Wand2 size={16} />
                    Restore Last Cleared List
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-md mb-2">
              <input
                type="text"
                placeholder="Quest Title (Optional, e.g., 新概念 123-124)"
                value={questTitle}
                onChange={(e) => setQuestTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all text-center"
              />
              
              <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Wand2 size={16} className="text-indigo-500" />
                    Advanced Options
                  </span>
                  <span className="text-slate-400 text-xs">{showAdvanced ? 'Hide' : 'Show'}</span>
                </button>
                
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 px-4 py-4 bg-slate-50/50 space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Custom Memory Tips
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Use funny animal stories..."
                          value={customMemoryTips}
                          onChange={(e) => setCustomMemoryTips(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={supportGrammarExam}
                              onChange={(e) => setSupportGrammarExam(e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                            <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                            Support Grammar Exams (语法考试)
                          </span>
                        </label>
                        
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={supportZhongkao}
                              onChange={(e) => setSupportZhongkao(e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                            <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                            Include Zhongkao Questions (中考题)
                          </span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              onClick={() => onGenerate(questTitle.trim() || undefined, {
                customMemoryTips: customMemoryTips.trim() || undefined,
                supportGrammarExam,
                supportZhongkao
              })}
              disabled={vocabList.length === 0 || isGenerating}
              className="px-8 py-5 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 text-white font-black text-lg rounded-2xl hover:from-fuchsia-600 hover:via-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center gap-3 transform hover:-translate-y-1 hover:scale-105"
            >
              {isGenerating ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {progress 
                      ? `Creating Magic (${progress.current}/${progress.total})...` 
                      : 'Creating Magic...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={28} className="animate-pulse" />
                  <span>🪄 Generate Magic Quest!</span>
                </>
              )}
            </button>

            {isGenerating && progress && (
              <div className="w-full max-w-md">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <motion.div 
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {status && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-amber-600 text-center animate-pulse"
                  >
                    ⚠️ {status}
                  </motion.p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ) : activeTab === 'doc' ? (
        <motion.div key="doc" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          {docFiles.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer mb-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".pdf,application/pdf,image/*,text/plain,.docx"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload size={32} />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Click to upload or drag and drop</h3>
              <p className="text-slate-500 text-sm">Select PDF, Image, Word, or Text files</p>
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Selected Files</h4>
                <button 
                  onClick={() => setDocFiles([])}
                  className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
              {docFiles.map((file, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                      {previews[index] ? (
                        <img 
                          src={previews[index]} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <FileText size={24} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDocFiles(prev => prev.filter((_, i) => i !== index))}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-medium rounded-xl hover:bg-indigo-50 transition-colors"
              >
                + Add More Files
              </button>
              <input
                type="file"
                accept=".pdf,application/pdf,image/*,text/plain,.docx"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 mb-2">
              <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                Target Level / Stage (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Level 1, Stage 5, or Lesson 10"
                  value={extractionLevel}
                  onChange={(e) => setExtractionLevel(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                />
                {extractionLevel && (
                  <button 
                    onClick={() => setExtractionLevel('')}
                    className="p-2 text-indigo-400 hover:text-indigo-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-indigo-400 mt-2 italic">
                Tip: For your 66-level document, specify which level (关) to extract. Or leave it empty to extract all words from any document!
              </p>
            </div>

            {docFiles.some(f => f.type === 'application/pdf') && (
              <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 mb-2">
                <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                  PDF Page Range (Optional)
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      placeholder="Start Page (e.g. 19)"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      placeholder="End Page (e.g. 66)"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isGridPattern"
                    checked={isGridPattern}
                    onChange={(e) => setIsGridPattern(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="isGridPattern" className="text-sm text-slate-700 font-medium cursor-pointer">
                    Use 66-Level Grid Pattern (45 words per page)
                  </label>
                </div>
                <p className="text-[10px] text-indigo-400 mt-2 italic">
                  Tip: Specify a range to skip pages (e.g., Start: 19, End: 66). Leave empty to process all pages.
                </p>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={docFiles.length === 0 || isGenerating}
              className="px-8 py-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {progress 
                      ? `Extracting Words (${progress.current}/${progress.total})...` 
                      : 'Extracting Words...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  <span>Extract Words & Meanings</span>
                </>
              )}
            </button>

            {isGenerating && progress && (
              <div className="w-full max-w-md">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <motion.div 
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {status && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-amber-600 text-center animate-pulse"
                  >
                    ⚠️ {status}
                  </motion.p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div key="lib" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <Discover 
            onExtract={onBulkAdd} 
            onViewBuilder={() => setActiveTab('list')} 
            userResources={savedVocabLists}
          />
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};
