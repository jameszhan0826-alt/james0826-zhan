import React, { useState } from 'react';
import { motion } from 'motion/react';
import { WordProgress } from '../types';
import { Trophy, TrendingUp, AlertCircle, Search, CheckCircle2, Download, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { printToPDF } from '../utils/pdf';

interface ProgressViewProps {
  wordProgress: Record<string, WordProgress>;
}

type SortColumn = 'word' | 'meaning' | 'accuracy' | 'attempts' | 'status' | 'lastAttempted';

export const ProgressView: React.FC<ProgressViewProps> = ({ wordProgress }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastAttempted');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const words = Object.values(wordProgress);
  
  const masteredWords = words.filter(w => w.attempts >= 3 && (w.correct / w.attempts) >= 0.8);
  const learningWords = words.filter(w => w.attempts > 0 && !masteredWords.includes(w));
  const needsImprovement = words.filter(w => w.attempts >= 3 && (w.correct / w.attempts) < 0.5);

  const getAccuracy = (w: WordProgress) => w.attempts > 0 ? Math.round((w.correct / w.attempts) * 100) : 0;
  const getStatusScore = (w: WordProgress) => {
    const acc = getAccuracy(w);
    if (w.attempts >= 3 && acc >= 80) return 3; // Mastered
    if (w.attempts >= 3 && acc < 50) return 1; // Review
    return 2; // Learning
  };

  const filteredWords = words
    .filter(w => 
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.meaning.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'word':
          comparison = a.word.localeCompare(b.word);
          break;
        case 'meaning':
          comparison = a.meaning.localeCompare(b.meaning);
          break;
        case 'accuracy':
          comparison = getAccuracy(a) - getAccuracy(b);
          break;
        case 'attempts':
          comparison = a.attempts - b.attempts;
          break;
        case 'status':
          comparison = getStatusScore(a) - getStatusScore(b);
          break;
        case 'lastAttempted':
        default:
          comparison = a.lastAttempted - b.lastAttempted;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'word' || column === 'meaning' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <div className="w-4 h-4 inline-block opacity-0 group-hover:opacity-50 transition-opacity"><ChevronDown size={16} /></div>;
    return sortDirection === 'asc' ? <ChevronUp size={16} className="inline-block text-indigo-600" /> : <ChevronDown size={16} className="inline-block text-indigo-600" />;
  };

  const handleDownloadStats = async () => {
    setIsDownloading(true);
    try {
      const htmlContent = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; font-size: 28px; margin-bottom: 10px;">🏆 My Vocab Quest Trophies & Stats</h1>
          <p style="color: #64748b; font-size: 16px;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div style="display: flex; justify-content: space-around; margin-bottom: 40px; text-align: center; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div>
            <h2 style="color: #059669; margin: 0; font-size: 32px;">${masteredWords.length}</h2>
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">🌟 Super Stars</p>
          </div>
          <div>
            <h2 style="color: #4f46e5; margin: 0; font-size: 32px;">${learningWords.length}</h2>
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">🧠 Brain Growing</p>
          </div>
          <div>
            <h2 style="color: #d97706; margin: 0; font-size: 32px;">${needsImprovement.length}</h2>
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">💪 Power Up Needed</p>
          </div>
        </div>

        <h2 style="color: #1e293b; margin-bottom: 15px; font-size: 20px;">Word Progress Details</h2>
        <table>
          <thead>
            <tr>
              <th>Word</th>
              <th>Meaning</th>
              <th style="text-align: center;">Accuracy</th>
              <th style="text-align: center;">Attempts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${words.sort((a, b) => b.lastAttempted - a.lastAttempted).map(w => {
              const accuracy = w.attempts > 0 ? Math.round((w.correct / w.attempts) * 100) : 0;
              const isMastered = w.attempts >= 3 && accuracy >= 80;
              const isStruggling = w.attempts >= 3 && accuracy < 50;
              const status = isMastered ? 'Mastered 🌟' : isStruggling ? 'Review 💪' : 'Learning 🧠';
              return `
                <tr>
                  <td><strong>${w.word}</strong></td>
                  <td>${w.meaning}</td>
                  <td style="text-align: center;">${accuracy}%</td>
                  <td style="text-align: center;">${w.attempts}</td>
                  <td>${status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      await printToPDF(htmlContent, 'Vocab_Quest_Stats');
    } catch (error) {
      console.error('Failed to download stats:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-emerald-200 flex items-center gap-4 transform transition-transform hover:scale-105">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Trophy size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider">🌟 Super Stars</p>
            <p className="text-3xl font-black text-slate-800">{masteredWords.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-indigo-200 flex items-center gap-4 transform transition-transform hover:scale-105">
          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">🧠 Brain Growing</p>
            <p className="text-3xl font-black text-slate-800">{learningWords.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-amber-200 flex items-center gap-4 transform transition-transform hover:scale-105">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-600 uppercase tracking-wider">💪 Power Up Needed</p>
            <p className="text-3xl font-black text-slate-800">{needsImprovement.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-3xl">📊</span> My Stats
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadStats}
              disabled={isDownloading || words.length === 0}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span className="hidden sm:inline">Download Stats</span>
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search magic words..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-64 transition-all"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                <th 
                  className="px-6 py-4 font-bold cursor-pointer group hover:bg-slate-200 transition-colors select-none"
                  onClick={() => handleSort('word')}
                >
                  <div className="flex items-center gap-1">Word 📝 <SortIcon column="word" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold cursor-pointer group hover:bg-slate-200 transition-colors select-none"
                  onClick={() => handleSort('meaning')}
                >
                  <div className="flex items-center gap-1">Meaning 📖 <SortIcon column="meaning" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold text-center cursor-pointer group hover:bg-slate-200 transition-colors select-none"
                  onClick={() => handleSort('accuracy')}
                >
                  <div className="flex items-center justify-center gap-1">Power Level ⚡ <SortIcon column="accuracy" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold text-center cursor-pointer group hover:bg-slate-200 transition-colors select-none"
                  onClick={() => handleSort('attempts')}
                >
                  <div className="flex items-center justify-center gap-1">Tries 🎯 <SortIcon column="attempts" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold cursor-pointer group hover:bg-slate-200 transition-colors select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">Level 🏅 <SortIcon column="status" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    {words.length === 0 ? "No practice data yet. Complete a session to see your progress!" : "No words found matching your search."}
                  </td>
                </tr>
              ) : (
                filteredWords.map((w, index) => {
                  const accuracy = w.attempts > 0 ? Math.round((w.correct / w.attempts) * 100) : 0;
                  const isMastered = w.attempts >= 3 && accuracy >= 80;
                  const isStruggling = w.attempts >= 3 && accuracy < 50;
                  
                  return (
                    <motion.tr 
                      key={w.word}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">{w.word}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{w.meaning}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isMastered ? 'bg-emerald-500' : isStruggling ? 'bg-amber-500' : 'bg-indigo-500'}`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-8">{accuracy}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 font-medium">{w.attempts}</td>
                      <td className="px-6 py-4">
                        {isMastered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={12} /> Mastered
                          </span>
                        ) : isStruggling ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <AlertCircle size={12} /> Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            <TrendingUp size={12} /> Learning
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
