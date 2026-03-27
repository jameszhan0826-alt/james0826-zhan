import React, { useState } from 'react';
import { BookOpen, Sparkles, FileText, Download, Play, ChevronRight, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VocabItem } from '../types';

interface MagicDoc {
  id: string;
  title: string;
  category: 'NCE' | 'PET' | 'MistakeBook';
  description: string;
  wordCount: number;
  vocab: { word: string; meaning: string; example?: string; exampleTranslation?: string }[];
}

const OFFICIAL_RESOURCES: MagicDoc[] = [
  {
    id: 'nce1-l1-10',
    title: 'New Concept English 1: Lessons 1-10',
    category: 'NCE',
    description: 'Basic greetings, introductions, and common objects. Perfect for beginners.',
    wordCount: 45,
    vocab: [
      { word: 'excuse', meaning: '原谅', example: 'Excuse me, is this your handbag?', exampleTranslation: '对不起，这是你的手提包吗？' },
      { word: 'handbag', meaning: '手提包', example: 'My handbag is on the table.', exampleTranslation: '我的手提包在桌子上。' },
      { word: 'pardon', meaning: '原谅，请再说一遍', example: 'Pardon? I didn\'t hear you.', exampleTranslation: '对不起，我没听清。' },
      { word: 'watch', meaning: '手表', example: 'Is this your watch?', exampleTranslation: '这是你的手表吗？' },
      { word: 'dress', meaning: '连衣裙', example: 'That is a beautiful dress.', exampleTranslation: '那是一件漂亮的连衣裙。' },
      // ... more words can be added
    ]
  },
  {
    id: 'nce2-l1-5',
    title: 'New Concept English 2: Lessons 1-5',
    category: 'NCE',
    description: 'Focus on narrative tenses and basic sentence structures.',
    wordCount: 38,
    vocab: [
      { word: 'private', meaning: '私人的', example: 'It\'s a private conversation.', exampleTranslation: '这是一场私人谈话。' },
      { word: 'conversation', meaning: '谈话', example: 'We had a long conversation.', exampleTranslation: '我们谈了很久。' },
      { word: 'theatre', meaning: '剧院', example: 'I went to the theatre last night.', exampleTranslation: '我昨晚去了剧院。' },
      { word: 'angry', meaning: '生气的', example: 'He was very angry with me.', exampleTranslation: '他对我非常生气。' },
    ]
  },
  {
    id: 'nce3-l1-5',
    title: 'New Concept English 3: Lessons 1-5',
    category: 'NCE',
    description: 'Advanced sentence structures and complex vocabulary for intermediate learners.',
    wordCount: 42,
    vocab: [
      { word: 'pummel', meaning: '接连地打', example: 'The boxer pummelled his opponent.', exampleTranslation: '拳击手接连击打他的对手。' },
      { word: 'fascinating', meaning: '迷人的', example: 'It was a fascinating story.', exampleTranslation: '这是一个迷人的故事。' },
    ]
  },
  {
    id: 'nce4-l1-5',
    title: 'New Concept English 4: Lessons 1-5',
    category: 'NCE',
    description: 'Academic and literary English for advanced students.',
    wordCount: 35,
    vocab: [
      { word: 'specimen', meaning: '标本', example: 'This is a rare specimen of the butterfly.', exampleTranslation: '这是蝴蝶的一个罕见标本。' },
      { word: 'contemplate', meaning: '沉思', example: 'He contemplated the meaning of life.', exampleTranslation: '他沉思着生命的意义。' },
    ]
  },
  {
    id: 'pet-core-1',
    title: 'PET Core Vocabulary: Travel & Holidays',
    category: 'PET',
    description: 'Essential words for the PET exam travel section.',
    wordCount: 52,
    vocab: [
      { word: 'accommodation', meaning: '住宿', example: 'We need to find some accommodation.', exampleTranslation: '我们需要找些住宿的地方。' },
      { word: 'adventure', meaning: '冒险', example: 'Our trip was a real adventure.', exampleTranslation: '我们的旅行是一次真正的冒险。' },
      { word: 'destination', meaning: '目的地', example: 'What is your final destination?', exampleTranslation: '你的最终目的地 is 哪里？' },
      { word: 'itinerary', meaning: '行程', example: 'Do you have a copy of the itinerary?', exampleTranslation: '你有行程单的副本吗？' },
    ]
  },
  {
    id: 'pet-core-2',
    title: 'PET Core Vocabulary: Education & Work',
    category: 'PET',
    description: 'Essential words for the PET exam education and work sections.',
    wordCount: 48,
    vocab: [
      { word: 'qualification', meaning: '资格，学历', example: 'He has the right qualifications for the job.', exampleTranslation: '他有这份工作的合适资历。' },
      { word: 'curriculum', meaning: '课程', example: 'The school curriculum is very broad.', exampleTranslation: '学校的课程非常广泛。' },
      { word: 'internship', meaning: '实习', example: 'I am doing an internship at a law firm.', exampleTranslation: '我正在一家律师事务所实习。' },
    ]
  },
  {
    id: 'pet-core-3',
    title: 'PET Core Vocabulary: Health & Fitness',
    category: 'PET',
    description: 'Essential words for the PET exam health and lifestyle sections.',
    wordCount: 45,
    vocab: [
      { word: 'nutrition', meaning: '营养', example: 'Good nutrition is essential for health.', exampleTranslation: '良好的营养对健康至关重要。' },
      { word: 'symptom', meaning: '症状', example: 'What are the symptoms of a cold?', exampleTranslation: '感冒的症状是什么？' },
      { word: 'prescription', meaning: '处方', example: 'The doctor gave me a prescription for some medicine.', exampleTranslation: '医生给我开了一些药的处方。' },
    ]
  },
  {
    id: 'pet-sample-table',
    title: 'PET Sample: Table Extraction',
    category: 'PET',
    description: 'Sample vocabulary from table-based extraction tests.',
    wordCount: 15,
    vocab: [
      { word: 'forever', meaning: '永远', example: 'I will love you forever.', exampleTranslation: '我会永远爱你。' },
      { word: 'cushion', meaning: '软垫', example: 'Sit on the cushion to be comfortable.', exampleTranslation: '坐在软垫上会很舒服。' },
      { word: 'sock', meaning: '短袜', example: 'I lost one of my blue socks.', exampleTranslation: '我丢了一只蓝色的短袜。' },
      { word: 'password', meaning: '口令,密码', example: 'Don\'t share your password with anyone.', exampleTranslation: '不要把你的密码告诉任何人。' },
      { word: 'snowboard', meaning: '滑雪板', example: 'He bought a new snowboard for the winter.', exampleTranslation: '他为冬天买了一个新的滑雪板。' },
      { word: 'pavement', meaning: '人行道', example: 'Walk on the pavement, not the road.', exampleTranslation: '走在人行道上，不要走在马路上。' },
      { word: 'select', meaning: '选择', example: 'Please select your favorite color.', exampleTranslation: '请选择你最喜欢的颜色。' },
      { word: 'luggage', meaning: '行李', example: 'We have too much luggage for this trip.', exampleTranslation: '我们这次旅行的行李太多了。' },
      { word: 'health', meaning: '健康; 卫生', example: 'Exercise is good for your health.', exampleTranslation: '锻炼对你的健康有好处。' },
      { word: 'exactly', meaning: '精确地', example: 'That is exactly what I meant.', exampleTranslation: '那正是我的意思。' },
      { word: 'resort', meaning: '旅游胜地', example: 'We stayed at a beautiful beach resort.', exampleTranslation: '我们住在一个美丽的海滨度假胜地。' },
      { word: 'cartoon', meaning: '动画片', example: 'Kids love watching cartoons on Saturday mornings.', exampleTranslation: '孩子们喜欢在周六早上看动画片。' },
      { word: 'eighty', meaning: '八十', example: 'My grandfather is eighty years old.', exampleTranslation: '我的祖父八十岁了。' },
      { word: 'injure', meaning: '伤害', example: 'Be careful not to injure yourself.', exampleTranslation: '小心不要伤到自己。' },
      { word: 'biscuit', meaning: '饼干(英式)', example: 'Would you like a biscuit with your tea?', exampleTranslation: '你想喝茶时来块饼干吗？' },
    ]
  }
];

interface DiscoverProps {
  onExtract: (vocab: { word: string; meaning: string; example?: string; exampleTranslation?: string }[], category: 'NCE' | 'PET' | 'MistakeBook') => void;
  onViewBuilder: () => void;
  userResources?: { id: string; title: string; words: any[]; category?: 'NCE' | 'PET' | 'General' | 'MistakeBook' }[];
}

export const Discover: React.FC<DiscoverProps> = ({ onExtract, onViewBuilder, userResources = [] }) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'NCE' | 'PET' | 'MistakeBook'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const mappedUserResources: MagicDoc[] = userResources
    .filter(res => res.category === 'NCE' || res.category === 'PET' || res.category === 'MistakeBook')
    .map(res => ({
      id: res.id,
      title: res.title,
      description: `User-saved word list (${res.words.length} words)`,
      category: (res.category === 'General' ? 'NCE' : res.category) as 'NCE' | 'PET' | 'MistakeBook',
      wordCount: res.words.length,
      vocab: res.words
    }));

  const allResources = [...OFFICIAL_RESOURCES, ...mappedUserResources];

  const filteredResources = allResources.filter(doc => {
    const matchesCategory = activeCategory === 'ALL' || doc.category === activeCategory;
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'ALL', name: 'All Discoveries', icon: '🌟', count: allResources.length },
    { id: 'NCE', name: '新概念', icon: '📖', count: allResources.filter(r => r.category === 'NCE').length },
    { id: 'PET', name: 'PET', icon: '🎓', count: allResources.filter(r => r.category === 'PET').length },
    { id: 'MistakeBook', name: '错题本', icon: '📝', count: allResources.filter(r => r.category === 'MistakeBook').length },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-black text-slate-800 mb-3 flex items-center justify-center gap-3">
          <span>✨</span> Discover Magic Words <span>✨</span>
        </h2>
        <p className="text-slate-500 font-medium text-lg">
          Ready-to-use vocabulary from New Concept English and PET exams!
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search for lessons or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeCategory === cat.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeCategory === cat.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredResources.map((doc) => (
            <motion.div
              key={doc.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                  doc.category === 'NCE' ? 'bg-emerald-50 text-emerald-600' : 
                  doc.category === 'PET' ? 'bg-amber-50 text-amber-600' : 
                  'bg-rose-50 text-rose-600'
                }`}>
                  {doc.category === 'NCE' ? '📖' : doc.category === 'PET' ? '🎓' : '📝'}
                </div>
                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                  doc.category === 'NCE' ? 'bg-emerald-100 text-emerald-700' : 
                  doc.category === 'PET' ? 'bg-amber-100 text-amber-700' : 
                  'bg-rose-100 text-rose-700'
                }`}>
                  {doc.category === 'NCE' ? '新概念' : doc.category === 'PET' ? 'PET' : '错题本'}
                </span>
              </div>

              <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                {doc.title}
              </h3>
              <p className="text-slate-500 text-sm mb-6 flex-1">
                {doc.description}
              </p>

              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <FileText size={14} />
                  {doc.wordCount} Magic Words
                </div>
                <button
                  onClick={() => {
                    onExtract(doc.vocab, doc.category);
                    onViewBuilder();
                  }}
                  className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 transform hover:-translate-y-1"
                >
                  <Sparkles size={16} />
                  Magic Extract
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
            🔍
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No collections found</h3>
          <p className="text-slate-500">Try adjusting your search or category filter.</p>
        </div>
      )}
    </div>
  );
};
