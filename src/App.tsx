import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { WordCard } from './components/WordCard';
import { AddWordModal } from './components/AddWordModal';
import { FlashcardView } from './components/FlashcardView';
import { QuizModal } from './components/QuizModal';
import { WordDetailModal } from './components/WordDetailModal';
import { fetchWords, deleteWord } from './firebase';
import { WordDocument, WordStatus } from './types';

function App() {
  const [words, setWords] = useState<WordDocument[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showFlashcardView, setShowFlashcardView] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordDocument | null>(null);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'a-z'>('newest');
  
  // New Filters
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPos, setFilterPos] = useState<string>('All');
  const [filterToeic, setFilterToeic] = useState<string>('All');

  // Infinite Scroll Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const lastWordElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadWords();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const loadWords = async (reset = false) => {
    setLoading(true);
    const startAfter = reset ? null : lastVisible;
    const { words: newWords, lastVisible: newLast } = await fetchWords(startAfter);
    
    if (newWords.length === 0) {
      setHasMore(false);
    } else {
        setWords(prev => reset ? newWords : [...prev, ...newWords]);
        setLastVisible(newLast);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWords(true);
  }, []);

  const handleRefresh = () => {
      loadWords(true);
  };

  const handleDelete = async (id: string) => {
      await deleteWord(id);
      setWords(prev => prev.filter(w => w.id !== id));
      setSelectedWord(null);
  };

  const handleLocalStatusUpdate = (wordId: string, newStatus: WordStatus) => {
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: newStatus } : w));
  };

  // Derive Filter Options dynamically from loaded words
  const uniqueCategories = Array.from(new Set(words.map(w => w.category))).sort();
  const uniquePos = Array.from(new Set(words.flatMap(w => w.partOfSpeech))).sort();

  // Client-side filtering/sorting for the visible list
  const processedWords = words
    .filter(w => {
        // Search
        const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              w.meaning.includes(searchTerm);
        if (!matchesSearch) return false;

        // Filters
        if (filterCategory !== 'All' && w.category !== filterCategory) return false;
        if (filterStatus !== 'All' && w.status !== filterStatus) return false;
        if (filterPos !== 'All' && !w.partOfSpeech.includes(filterPos)) return false;
        if (filterToeic !== 'All') {
            const minScore = parseInt(filterToeic);
            if ((w.toeicLevel || 0) < minScore) return false;
        }

        return true;
    })
    .sort((a, b) => {
        if (sortOrder === 'newest') return b.createdAt.seconds - a.createdAt.seconds;
        if (sortOrder === 'oldest') return a.createdAt.seconds - b.createdAt.seconds;
        return a.english.localeCompare(b.english);
    });

  // Reusable Filter Pill Component
  const FilterPill = ({ 
    icon, 
    label, 
    value, 
    onChange, 
    options 
  }: { 
    icon: string, 
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    options: string[] 
  }) => (
    <div className="relative group">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 group-hover:border-indigo-100 transition-colors">
            <i className={`fa-solid ${icon} text-slate-400 text-xs`}></i>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none tracking-wider">{label}</span>
                <select 
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent appearance-none cursor-pointer pr-4"
                >
                    <option value="All">All</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            <i className="fa-solid fa-chevron-down text-[8px] text-slate-300 absolute right-3 pointer-events-none"></i>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20">
      <Navbar 
        toggleAddModal={() => setShowAddModal(true)} 
        toggleQuizMode={() => setShowQuizModal(true)}
      />

      <div className="max-w-7xl mx-auto px-4">
        
        {/* Controls Section */}
        <div className="flex flex-col gap-6 mb-8">
            {/* Top Row: Search and Sort */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96 group">
                    <i className="fa-solid fa-search absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
                    <input 
                        type="text" 
                        placeholder="Search your vocabulary..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full neumorph-pressed rounded-2xl py-3.5 pl-12 pr-6 outline-none text-slate-700 placeholder-slate-400 transition-all focus:ring-2 focus:ring-indigo-100 shadow-inner"
                    />
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                     <button 
                        onClick={() => setShowFlashcardView(true)}
                        disabled={words.length === 0}
                        className="flex-1 md:flex-none neumorph-btn h-12 px-5 rounded-2xl text-indigo-600 font-bold flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                    >
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                            <i className="fa-solid fa-clone text-xs"></i>
                        </div>
                        <span>Flashcards</span>
                    </button>
                    
                    <div className="relative flex-1 md:flex-none group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                             <i className="fa-solid fa-arrow-down-wide-short text-slate-400 group-hover:text-indigo-500 transition-colors text-xs"></i>
                        </div>
                        <select 
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="w-full md:w-48 neumorph-btn h-12 pl-9 pr-10 rounded-2xl text-sm font-bold text-slate-600 outline-none cursor-pointer appearance-none hover:text-indigo-600 transition-colors bg-[#f0f4f8]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="a-z">A-Z</option>
                        </select>
                        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none"></i>
                    </div>
                </div>
            </div>

            {/* Elegant Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 pb-2">
                <div className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-widest flex items-center gap-1">
                    <i className="fa-solid fa-sliders"></i> Filters
                </div>
                
                <FilterPill 
                    icon="fa-layer-group" 
                    label="Category" 
                    value={filterCategory} 
                    onChange={setFilterCategory} 
                    options={uniqueCategories} 
                />

                <FilterPill 
                    icon="fa-chart-simple" 
                    label="Proficiency" 
                    value={filterStatus} 
                    onChange={setFilterStatus} 
                    options={['Beginner', 'Training', 'Mastered']} 
                />

                <FilterPill 
                    icon="fa-shapes" 
                    label="Part of Speech" 
                    value={filterPos} 
                    onChange={setFilterPos} 
                    options={uniquePos} 
                />

                <FilterPill 
                    icon="fa-award" 
                    label="TOEIC Min" 
                    value={filterToeic} 
                    onChange={setFilterToeic} 
                    options={['400', '600', '730', '860']} 
                />
                
                {(filterCategory !== 'All' || filterStatus !== 'All' || filterPos !== 'All' || filterToeic !== 'All') && (
                    <button 
                        onClick={() => {
                            setFilterCategory('All');
                            setFilterStatus('All');
                            setFilterPos('All');
                            setFilterToeic('All');
                        }}
                        className="ml-auto text-xs font-bold text-slate-400 hover:text-indigo-500 px-3 py-1 rounded-full hover:bg-white transition-colors flex items-center gap-1"
                    >
                        <i className="fa-solid fa-rotate-left"></i> Reset
                    </button>
                )}
            </div>
        </div>

        {/* Word Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {processedWords.map((word, index) => {
                if (index === processedWords.length - 1) {
                    return <div ref={lastWordElementRef} key={word.id}><WordCard word={word} onClick={setSelectedWord} /></div>;
                } else {
                    return <div key={word.id}><WordCard word={word} onClick={setSelectedWord} /></div>;
                }
            })}
        </div>

        {loading && (
            <div className="flex justify-center py-8">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-400"></i>
            </div>
        )}
        
        {!loading && words.length === 0 && (
            <div className="text-center py-20 text-slate-400">
                <div className="neumorph-flat w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-200">
                    <i className="fa-regular fa-folder-open text-4xl"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-600 mb-2">No Words Yet</h3>
                <p>Add some vocabulary to get started!</p>
            </div>
        )}
        
        {!loading && words.length > 0 && processedWords.length === 0 && (
             <div className="text-center py-20 text-slate-400">
                <div className="neumorph-flat w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-200">
                     <i className="fa-solid fa-filter text-4xl"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-600 mb-2">No Matches</h3>
                <p>Try adjusting your filters or search terms.</p>
            </div>
        )}

      </div>

      {/* Modals */}
      {showAddModal && (
        <AddWordModal 
            onClose={() => setShowAddModal(false)} 
            onSuccess={handleRefresh} 
        />
      )}
      
      {showFlashcardView && (
        <FlashcardView 
            words={processedWords} 
            onClose={() => setShowFlashcardView(false)}
            onUpdateStatus={handleLocalStatusUpdate}
        />
      )}

      {showQuizModal && (
          <QuizModal 
            words={words} 
            onClose={() => setShowQuizModal(false)}
            onUpdate={handleRefresh}
          />
      )}

      {selectedWord && (
          <WordDetailModal 
            word={selectedWord} 
            onClose={() => setSelectedWord(null)}
            onDelete={handleDelete}
            onUpdate={handleRefresh}
          />
      )}
    </div>
  );
}

export default App;