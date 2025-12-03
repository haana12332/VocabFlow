import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Navbar } from './components/Navbar';
import { WordCard } from './components/WordCard';
import { AddWordModal } from './components/AddWordModal';
import { Settings } from './components/Settings'; 
import { FlashcardView } from './components/FlashcardView';
import { QuizModal } from './components/QuizModal';
import { WordDetailModal } from './components/WordDetailModal';
import { DailyCommentModal } from './components/DailyCommentModal'; // ★追加
import { Login } from './components/Login'; 
import { fetchWords, deleteWord, auth, getUserProfile } from './firebase'; 
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { WordDocument, WordStatus } from './types';

// Helper function to compare arrays
const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// Reusable Filter Pill Component
const FilterPill = memo(({ 
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
}) => {
  const allOptions = useMemo(() => {
    return Array.from(new Set([...options, ...(value !== 'All' ? [value] : [])])).sort();
  }, [options.join(','), value]);
  
  return (
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
                    {allOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            <i className="fa-solid fa-chevron-down text-[8px] text-slate-300 absolute right-3 pointer-events-none"></i>
        </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value &&
         prevProps.icon === nextProps.icon &&
         prevProps.label === nextProps.label &&
         prevProps.onChange === nextProps.onChange &&
         arraysEqual(prevProps.options, nextProps.options);
});

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // 設定が確認済みかどうかのフラグ
  const [isConfigVerified, setIsConfigVerified] = useState(false);

  // App State
  const [words, setWords] = useState<WordDocument[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcardView, setShowFlashcardView] = useState(false);
  const [showDailyComment, setShowDailyComment] = useState(false); // ★追加
  const [selectedWord, setSelectedWord] = useState<WordDocument | null>(null);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // ソート順の型定義を拡張
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'a-z' | 'z-a' | 'toeic-high' | 'toeic-low'>('newest');
  
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPos, setFilterPos] = useState<string>('All');
  const [filterToeic, setFilterToeic] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  
  // 数値範囲フィルタ (インデックス用)
  const [filterIndexFrom, setFilterIndexFrom] = useState<string>('');
  const [filterIndexTo, setFilterIndexTo] = useState<string>('');

  // ユーザー認証の監視 & 設定同期
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
          setIsConfigVerified(false);
          setUser(null);
          setAuthLoading(false);
          return;
      }

      try {
          // 1. まずユーザー設定をFirestoreから取得
          const profile = await getUserProfile(currentUser.uid);
          
          if (profile?.settings) {
              let needsReload = false;

              // 2. 言語設定の同期
              if (profile.settings.language) {
                  const currentLang = localStorage.getItem('app_language');
                  if (currentLang !== profile.settings.language) {
                      localStorage.setItem('app_language', profile.settings.language);
                  }
              }

              // 3. Geminiキーの同期
              if (profile.settings.geminiKey) {
                  const currentGemini = localStorage.getItem('gemini_api_key');
                  if (currentGemini !== profile.settings.geminiKey) {
                      localStorage.setItem('gemini_api_key', profile.settings.geminiKey);
                  }
              }

              // 4. Firebase Configの同期とリロード判定
              const remoteConfig = profile.settings.firebaseConfig;
              const currentConfig = localStorage.getItem('custom_firebase_config');

              // リモートに設定があり、かつローカルと異なる場合は更新してリロード
              if (remoteConfig && remoteConfig !== currentConfig) {
                  console.log("Detecting new database config. Syncing and reloading...");
                  localStorage.setItem('custom_firebase_config', remoteConfig);
                  needsReload = true;
              }

              // 設定が変わった場合はリロードして、新しいDB接続でアプリを再起動させる
              if (needsReload) {
                  window.location.reload();
                  return; // ここで処理終了 (リロード待ち)
              }
          }
      } catch (error) {
          console.error("Failed to sync user settings", error);
      }

      // 同期・確認完了後、ステートを更新してアプリを開始
      setWords([]);
      setLastVisible(null);
      setHasMore(true);
      setUser(currentUser);
      setAuthLoading(false);
      setIsConfigVerified(true); 
    });
    return () => unsubscribe();
  }, []);

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

  const loadWords = useCallback(async (reset = false) => {
    if (!user || !isConfigVerified) return;

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
  }, [lastVisible, user, isConfigVerified]); 

  // 初期データ読み込み
  useEffect(() => {
    if (user && !authLoading && isConfigVerified) {
        loadWords(true);
    }
  }, [user, authLoading, isConfigVerified]);

  // 時間経過による自動読み込み
  useEffect(() => {
    if (!hasMore || !user || !isConfigVerified) return; 

    const interval = setInterval(() => {
      if (!loading && hasMore) {
        loadWords();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loading, hasMore, lastVisible, user, isConfigVerified]);

  // ★ Optimistic UI Updates (ソート・フィルタ維持) ★
  const handleWordAdded = (newWord: WordDocument) => {
    // リストの先頭に追加 (ソート条件等は維持される)
    setWords(prev => [newWord, ...prev]);
  };

  const handleWordUpdated = (updatedWord: WordDocument) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
    
    // 詳細モーダルで編集中の単語も更新しておく
    if (selectedWord && selectedWord.id === updatedWord.id) {
        setSelectedWord(updatedWord);
    }
  };

  // 強制リロードが必要な場合に使用
  const handleRefresh = () => {
      loadWords(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setWords([]); 
      setShowSettings(false); 
      localStorage.removeItem('custom_firebase_config'); 
      localStorage.removeItem('gemini_api_key');
      window.location.reload();
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handleDelete = async (id: string) => {
      await deleteWord(id);
      setWords(prev => prev.filter(w => w.id !== id));
      setSelectedWord(null);
  };

  const handleLocalStatusUpdate = (wordId: string, newStatus: WordStatus) => {
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: newStatus } : w));
  };

  // Derive Filter Options
  const categoriesString = useMemo(() => 
    Array.from(new Set(words.map(w => w.category))).sort().join(','), 
    [words.length, words.map(w => w.category).join(',')]
  );
  
  const uniqueCategories = useMemo(() => {
    const categories = categoriesString ? categoriesString.split(',') : [];
    return Array.from(new Set([
      ...categories,
      ...(filterCategory !== 'All' ? [filterCategory] : [])
    ])).sort();
  }, [categoriesString, filterCategory]);
  
  const posString = useMemo(() => 
    Array.from(new Set(words.flatMap(w => w.partOfSpeech))).sort().join(','), 
    [words.length, words.flatMap(w => w.partOfSpeech).join(',')]
  );
  
  const uniquePos = useMemo(() => {
    const pos = posString ? posString.split(',') : [];
    return Array.from(new Set([
      ...pos,
      ...(filterPos !== 'All' ? [filterPos] : [])
    ])).sort();
  }, [posString, filterPos]);

  // Client-side filtering/sorting
  const processedWords = words
    .filter(w => {
        const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              w.meaning.includes(searchTerm);
        if (!matchesSearch) return false;

        if (filterCategory !== 'All' && w.category !== filterCategory) return false;
        if (filterStatus !== 'All' && w.status !== filterStatus) return false;
        if (filterPos !== 'All' && !w.partOfSpeech.includes(filterPos)) return false;
        if (filterToeic !== 'All') {
            const minScore = parseInt(filterToeic);
            if ((w.toeicLevel || 0) < minScore) return false;
        }
        
        if (filterDateFrom || filterDateTo) {
            const wordDate = w.createdAt?.seconds ? new Date(w.createdAt.seconds * 1000) : null;
            if (!wordDate) return false;
            
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (wordDate < fromDate) return false;
            }
            
            if (filterDateTo) {
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (wordDate > toDate) return false;
            }
        }

        return true;
    })
    .sort((a, b) => {
        // ソートロジック
        if (sortOrder === 'newest') return b.createdAt.seconds - a.createdAt.seconds;
        if (sortOrder === 'oldest') return a.createdAt.seconds - b.createdAt.seconds;
        if (sortOrder === 'z-a') return b.english.localeCompare(a.english);
        if (sortOrder === 'toeic-high') return (b.toeicLevel || 0) - (a.toeicLevel || 0);
        if (sortOrder === 'toeic-low') return (a.toeicLevel || 0) - (b.toeicLevel || 0);
        return a.english.localeCompare(b.english); // Default 'a-z'
    })
    // 数値範囲（インデックス）によるフィルタリング
    .filter((_, index) => {
        const start = filterIndexFrom ? Math.max(0, parseInt(filterIndexFrom) - 1) : 0;
        const end = filterIndexTo ? parseInt(filterIndexTo) : Infinity;
        return index >= start && index < end;
    });

  if (authLoading || (user && !isConfigVerified)) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-400"></i>
        </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen pb-20 bg-[#f0f4f8]">
      <div className="sticky top-0 z-50 bg-[#f0f4f8] shadow-sm">
        <Navbar 
            toggleQuizMode={() => setShowQuizModal(true)}
            toggleAddModal={() => setShowAddModal(true)}
            toggleSettings={() => setShowSettings(true)}
            toggleDailyComment={() => setShowDailyComment(true)} // ★追加
        />
      </div>
 
      <div className="max-w-7xl mx-auto px-4 pt-4">
        
        {/* Controls Section */}
        <div className="flex flex-col gap-6 mb-8">
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
                            <option value="z-a">Z-A</option>
                            <option value="toeic-high">TOEIC High-Low</option>
                            <option value="toeic-low">TOEIC Low-High</option>
                        </select>
                        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none"></i>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
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

                {/* Range (Index) Filter */}
                <div className="relative group">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 group-hover:border-indigo-100 transition-colors">
                        <i className="fa-solid fa-list-ol text-slate-400 text-xs"></i>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none tracking-wider">Range (#)</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="1"
                                    value={filterIndexFrom}
                                    onChange={(e) => setFilterIndexFrom(e.target.value)}
                                    className="text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-indigo-400 transition-colors w-12 text-center"
                                />
                                <span className="text-slate-300 text-xs">~</span>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="All"
                                    value={filterIndexTo}
                                    onChange={(e) => setFilterIndexTo(e.target.value)}
                                    className="text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-indigo-400 transition-colors w-12 text-center"
                                />
                                {(filterIndexFrom || filterIndexTo) && (
                                    <button
                                        onClick={() => {
                                            setFilterIndexFrom('');
                                            setFilterIndexTo('');
                                        }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date Filter */}
                 <div className="relative group">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 group-hover:border-indigo-100 transition-colors">
                        <i className="fa-solid fa-calendar-days text-slate-400 text-xs"></i>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none tracking-wider">Date Range</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={(e) => setFilterDateFrom(e.target.value)}
                                    className="text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-indigo-400 transition-colors w-24"
                                />
                                <span className="text-slate-300 text-xs">~</span>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={(e) => setFilterDateTo(e.target.value)}
                                    className="text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-indigo-400 transition-colors w-24"
                                />
                                {(filterDateFrom || filterDateTo) && (
                                    <button
                                        onClick={() => {
                                            setFilterDateFrom('');
                                            setFilterDateTo('');
                                        }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <i className="fa-solid fa-times text-xs"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {(filterCategory !== 'All' || filterStatus !== 'All' || filterPos !== 'All' || filterToeic !== 'All' || filterDateFrom || filterDateTo || filterIndexFrom || filterIndexTo) && (
                    <button 
                        onClick={() => {
                            setFilterCategory('All');
                            setFilterStatus('All');
                            setFilterPos('All');
                            setFilterToeic('All');
                            setFilterDateFrom('');
                            setFilterDateTo('');
                            setFilterIndexFrom('');
                            setFilterIndexTo('');
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
            onSuccess={handleWordAdded} 
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
            onUpdate={handleWordUpdated}
          />
      )}
      
      {showSettings && user && (
          <Settings
            onClose={() => setShowSettings(false)}
            onLogout={handleLogout}
            userId={user.uid}
          />
      )}

      {/* ★追加: 日次コメントモーダル */}
      {showDailyComment && user && (
          <DailyCommentModal
            onClose={() => setShowDailyComment(false)}
            userId={user.uid}
          />
      )}

      {selectedWord && (
          <WordDetailModal 
            word={selectedWord} 
            onClose={() => setSelectedWord(null)}
            onDelete={handleDelete}
            onUpdate={handleWordUpdated}
          />
      )}
    </div>
  );
}

export default App;