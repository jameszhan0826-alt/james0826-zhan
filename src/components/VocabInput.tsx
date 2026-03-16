import React, { useState, useRef } from 'react';
import { Plus, Trash2, Sparkles, FileText, Upload, X, List, Download, FileDown, Volume2 } from 'lucide-react';
import { VocabItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { printToPDF } from '../utils/pdf';
import { playHighQualityAudio } from '../utils/audio';

interface VocabInputProps {
  vocabList: VocabItem[];
  onAdd: (word: string, meaning: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onGenerate: () => void;
  onExtractFromPDF: (files: File[]) => Promise<void>;
  isGenerating: boolean;
  progress?: { current: number, total: number } | null;
}

export const VocabInput: React.FC<VocabInputProps> = ({
  vocabList,
  onAdd,
  onRemove,
  onClearAll,
  onGenerate,
  onExtractFromPDF,
  isGenerating,
  progress,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'pdf'>('list');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (word.trim() && meaning.trim()) {
      onAdd(word.trim(), meaning.trim());
      setWord('');
      setMeaning('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf');
      if (files.length > 0) {
        setPdfFiles(prev => [...prev, ...files]);
      } else {
        alert('Please select valid PDF files.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f: File) => f.type === 'application/pdf');
      if (files.length > 0) {
        setPdfFiles(prev => [...prev, ...files]);
      } else {
        alert('Please drop valid PDF files.');
      }
    }
  };

  const handleExtract = async () => {
    if (pdfFiles.length === 0) return;
    await onExtractFromPDF(pdfFiles);
    setActiveTab('list');
    setPdfFiles([]);
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

      <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8 gap-1">
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
          onClick={() => setActiveTab('pdf')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === 'pdf' ? 'bg-white text-indigo-600 shadow-sm scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'
          }`}
        >
          <FileText size={18} />
          Magic PDF Extract 📄✨
        </button>
      </div>

      {activeTab === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-8">
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
            <button
              type="submit"
              disabled={!word.trim() || !meaning.trim()}
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              <span>Add</span>
            </button>
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
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label="Remove word"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {vocabList.length === 0 && (
              <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No words added yet. Start by adding a word above or uploading a PDF!
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={onGenerate}
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
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {pdfFiles.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer mb-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload size={32} />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Click to upload or drag and drop</h3>
              <p className="text-slate-500 text-sm">You can select multiple PDF files</p>
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {pdfFiles.map((file, index) => (
                <div key={index} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <FileText size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPdfFiles(prev => prev.filter((_, i) => i !== index))}
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
                + Add More PDFs
              </button>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleExtract}
              disabled={pdfFiles.length === 0 || isGenerating}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-3 transform hover:-translate-y-0.5"
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
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
