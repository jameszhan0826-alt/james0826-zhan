import React, { useState } from 'react';
import { motion } from 'motion/react';
import { VocabItem, WordProgress, PracticeSession } from '../types';
import { Trophy, TrendingUp, AlertCircle, Search, CheckCircle2, Download, Loader2, ChevronUp, ChevronDown, RefreshCw, BarChart3, Calendar, Zap } from 'lucide-react';
import { printToPDF } from '../utils/pdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProgressViewProps {
  wordProgress: Record<string, WordProgress>;
  vocabList: VocabItem[];
  savedSessions: PracticeSession[];
  onRegenerate: (words: VocabItem[], title?: string) => void;
  onQuickReview?: (words: VocabItem[], title?: string) => void;
  isGenerating?: boolean;
  students?: string[];
}

type SortColumn = 'word' | 'meaning' | 'accuracy' | 'attempts' | 'status' | 'lastAttempted';

export const ProgressView: React.FC<ProgressViewProps> = ({ wordProgress, vocabList, savedSessions, onRegenerate, onQuickReview, isGenerating, students }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastAttempted');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const words = Object.values(wordProgress) as WordProgress[];
  
  const masteredWords = words.filter((w: WordProgress) => w.attempts >= 3 && (w.correct / w.attempts) >= 0.8);
  const needsImprovement = words.filter((w: WordProgress) => w.attempts >= 3 && (w.correct / w.attempts) < 0.5);
  const learningWords = words.filter((w: WordProgress) => w.attempts > 0 && !masteredWords.includes(w) && !needsImprovement.includes(w));

  const getVocabItems = (progressList: WordProgress[]) => {
    return progressList.map(p => {
      const existing = vocabList.find(v => v.word.toLowerCase() === p.word.toLowerCase());
      if (existing) return existing;
      return {
        id: crypto.randomUUID(),
        word: p.word,
        meaning: p.meaning
      } as VocabItem;
    });
  };

  const getAccuracy = (w: WordProgress) => w.attempts > 0 ? Math.round((w.correct / w.attempts) * 100) : 0;
  const getStatusScore = (w: WordProgress) => {
    const acc = getAccuracy(w);
    if (w.attempts >= 3 && acc >= 80) return 3; // Mastered
    if (w.attempts >= 3 && acc < 50) return 1; // Review
    return 2; // Learning
  };

  const filteredWords = words
    .filter((w: WordProgress) => 
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

  // Prepare chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const sessionsOnDate = savedSessions.filter(s => s.lastAttempted && new Date(s.lastAttempted).toISOString().split('T')[0] === date);
    return {
      date: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
      count: sessionsOnDate.length,
      fullDate: date
    };
  });

  const totalPractices = savedSessions.reduce((acc, s) => acc + (s.lastAttempted ? 1 : 0), 0);

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
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">🌟 Star Achiever (Mastered)</p>
          </div>
          <div>
            <h2 style="color: #4f46e5; margin: 0; font-size: 32px;">${learningWords.length}</h2>
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">🌱 Growing Sprout (Getting There)</p>
          </div>
          <div>
            <h2 style="color: #d97706; margin: 0; font-size: 32px;">${needsImprovement.length}</h2>
            <p style="margin: 5px 0 0 0; color: #475569; font-weight: bold;">💪 Extra Practice (Needs Review)</p>
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
            ${(words as WordProgress[]).sort((a, b) => b.lastAttempted - a.lastAttempted).map((w: WordProgress) => {
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
      {students && students.length > 0 && (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Students</h3>
          <p className="text-slate-600 text-lg">{students.join(', ')}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-emerald-200 flex flex-col gap-4 transform transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Trophy size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider">🌟 Star Achiever (Mastered)</p>
                <p className="text-3xl font-black text-slate-800">{masteredWords.length}</p>
              </div>
            </div>
            {masteredWords.length > 0 && (
              <div className="flex gap-2">
                {onQuickReview && (
                  <button 
                    onClick={() => onQuickReview(getVocabItems(masteredWords), 'Quick Mastery Review')} 
                    className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors shrink-0" 
                    title="Quick Review (Instant)"
                  >
                    <Zap size={20} />
                  </button>
                )}
                <button 
                  onClick={() => onRegenerate(getVocabItems(masteredWords), 'Mastery Review')} 
                  disabled={isGenerating}
                  className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors shrink-0 disabled:opacity-50" 
                  title="AI Quest (Better)"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                </button>
              </div>
            )}
          </div>
          {masteredWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-200">
              {masteredWords.map((w, idx) => (
                <span key={idx} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100">
                  {w.word}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-indigo-200 flex flex-col gap-4 transform transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">🌱 Growing Sprout (Getting There)</p>
                <p className="text-3xl font-black text-slate-800">{learningWords.length}</p>
              </div>
            </div>
            {learningWords.length > 0 && (
              <div className="flex gap-2">
                {onQuickReview && (
                  <button 
                    onClick={() => onQuickReview(getVocabItems(learningWords), 'Quick Learning Practice')} 
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shrink-0" 
                    title="Quick Review (Instant)"
                  >
                    <Zap size={20} />
                  </button>
                )}
                <button 
                  onClick={() => onRegenerate(getVocabItems(learningWords), 'Learning Practice')} 
                  disabled={isGenerating}
                  className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shrink-0 disabled:opacity-50" 
                  title="AI Quest (Better)"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                </button>
              </div>
            )}
          </div>
          {learningWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-indigo-200">
              {learningWords.map((w, idx) => (
                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100">
                  {w.word}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-amber-200 flex flex-col gap-4 transform transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                <AlertCircle size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-600 uppercase tracking-wider">💪 Extra Practice (Needs Review)</p>
                <p className="text-3xl font-black text-slate-800">{needsImprovement.length}</p>
              </div>
            </div>
            {needsImprovement.length > 0 && (
              <div className="flex gap-2">
                {onQuickReview && (
                  <button 
                    onClick={() => onQuickReview(getVocabItems(needsImprovement), 'Quick Review Practice')} 
                    className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors shrink-0" 
                    title="Quick Review (Instant)"
                  >
                    <Zap size={20} />
                  </button>
                )}
                <button 
                  onClick={() => onRegenerate(getVocabItems(needsImprovement), 'Review Practice')} 
                  disabled={isGenerating}
                  className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors shrink-0 disabled:opacity-50" 
                  title="AI Quest (Better)"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                </button>
              </div>
            )}
          </div>
          {needsImprovement.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-amber-200">
              {needsImprovement.map((w, idx) => (
                <span key={idx} className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-100">
                  {w.word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-200 flex flex-col gap-4 transform transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center shadow-inner">
              <BarChart3 size={28} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">🎯 Total Quests</p>
              <p className="text-3xl font-black text-slate-800">{totalPractices}</p>
            </div>
          </div>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-sm text-[10px]">
                          <p className="font-bold">{payload[0].payload.fullDate}</p>
                          <p className="text-indigo-600">{payload[0].value} Quests</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#4f46e5' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                            <CheckCircle2 size={12} /> 🌟 Mastered
                          </span>
                        ) : isStruggling ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <AlertCircle size={12} /> 💪 Needs Review
                            </span>
                            {onQuickReview && (
                              <button 
                                onClick={() => {
                                  const vocabItem = vocabList.find(v => v.word === w.word);
                                  if (vocabItem) onQuickReview([vocabItem], `Quick Review: ${w.word}`);
                                }}
                                className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                title="Quick Review (Instant)"
                              >
                                <Zap size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                const vocabItem = vocabList.find(v => v.word === w.word);
                                if (vocabItem) onRegenerate([vocabItem], `Review: ${w.word}`);
                              }}
                              disabled={isGenerating}
                              className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                              title="AI Quest (Better)"
                            >
                              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                              <TrendingUp size={12} /> 🌱 Getting There
                            </span>
                            {onQuickReview && (
                              <button 
                                onClick={() => {
                                  const vocabItem = vocabList.find(v => v.word === w.word);
                                  if (vocabItem) onQuickReview([vocabItem], `Quick Learning: ${w.word}`);
                                }}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                title="Quick Review (Instant)"
                              >
                                <Zap size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                const vocabItem = vocabList.find(v => v.word === w.word);
                                if (vocabItem) onRegenerate([vocabItem], `Learning: ${w.word}`);
                              }}
                              disabled={isGenerating}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                              title="AI Quest (Better)"
                            >
                              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            </button>
                          </div>
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
