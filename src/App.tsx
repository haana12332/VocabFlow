import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { WordCard } from './components/WordCard';
import { MilestoneCard } from './components/MilestoneCard';
import { AddWordModal } from './components/AddWordModal';
import { Settings } from './components/Settings'; 
import { FlashcardView } from './components/FlashcardView';
import { QuizModal } from './components/QuizModal';
import { WordDetailModal } from './components/WordDetailModal';
import { DailyCommentModal } from './components/DailyCommentModal'; 
import { SortDropdown } from './components/SortDropdown';
import { FilterBar } from './components/FilterBar';
import { Login } from './components/Login'; 
import { fetchAllWords, deleteWord, auth, getUserProfile } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { WordDocument, WordStatus } from './types';

type WordWithOrder = WordDocument & { initialOrder: number };

function App() {
  // --- Auth & Basic State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isConfigVerified, setIsConfigVerified] = useState(false);
  const [words, setWords] = useState<WordWithOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Modals State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcardView, setShowFlashcardView] = useState(false);
  const [showDailyComment, setShowDailyComment] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordDocument | null>(null);

  // --- Search & Sort State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'a-z' | 'z-a' | 'toeic-high' | 'toeic-low'>('newest');
  
  // フィルター適用時の「ベースの並び順」を保存する変数
  const [frozenSortOrder, setFrozenSortOrder] = useState<string | null>(null);

  // --- Filter State ---
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPos, setFilterPos] = useState<string>('All');
  const [filterToeic, setFilterToeic] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterIndexFrom, setFilterIndexFrom] = useState<string>('');
  const [filterIndexTo, setFilterIndexTo] = useState<string>('');

  // --- Auth & Initial Data Load ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
          setIsConfigVerified(false);
          setUser(null);
          setAuthLoading(false);
          return;
      }
      try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile?.settings) {
              let needsReload = false;
              if (profile.settings.language) {
                  const currentLang = localStorage.getItem('app_language');
                  if (currentLang !== profile.settings.language) {
                      localStorage.setItem('app_language', profile.settings.language);
                  }
              }
              if (profile.settings.geminiKey) {
                  const currentGemini = localStorage.getItem('gemini_api_key');
                  if (currentGemini !== profile.settings.geminiKey) {
                      localStorage.setItem('gemini_api_key', profile.settings.geminiKey);
                  }
              }
              const remoteConfig = profile.settings.firebaseConfig;
              const currentConfig = localStorage.getItem('custom_firebase_config');
              if (remoteConfig && remoteConfig !== currentConfig) {
                  localStorage.setItem('custom_firebase_config', remoteConfig);
                  needsReload = true;
              }
              if (needsReload) {
                  window.location.reload();
                  return;
              }
          }
      } catch (error) {
          console.error("Failed to sync user settings", error);
      }
      setWords([]);
      setUser(currentUser);
      setAuthLoading(false);
      setIsConfigVerified(true); 
    });
    return () => unsubscribe();
  }, []);

  const loadWords = useCallback(async () => {
    if (!user || !isConfigVerified) return;
    setLoading(true);
    const allWords = await fetchAllWords(user.uid); 
    const indexedWords: WordWithOrder[] = allWords.map((word, index) => ({
      ...word,
      initialOrder: index
    }));
    setWords(indexedWords);
    setLoading(false);
  }, [user, isConfigVerified]);

  useEffect(() => {
    if (user && !authLoading && isConfigVerified) {
        loadWords();
    }
  }, [user, authLoading, isConfigVerified, loadWords]);

  // --- Event Handlers ---
  const handleWordAdded = (newWord: WordDocument) => {
    const wordWithOrder: WordWithOrder = { ...newWord, initialOrder: -1 }; 
    setWords(prev => [wordWithOrder, ...prev]);
  };

  const handleWordUpdated = (updatedWord: WordDocument) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? { ...updatedWord, initialOrder: w.initialOrder } : w));
    if (selectedWord && selectedWord.id === updatedWord.id) {
        setSelectedWord(updatedWord);
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

  // --- Derive Filter Options ---
  const categoriesString = useMemo(() => Array.from(new Set(words.map(w => w.category))).sort().join(','), [words]);
  const uniqueCategories = useMemo(() => categoriesString ? categoriesString.split(',') : [], [categoriesString]);
  const posString = useMemo(() => Array.from(new Set(words.flatMap(w => w.partOfSpeech))).sort().join(','), [words]);
  const uniquePos = useMemo(() => posString ? posString.split(',') : [], [posString]);

  const isAnyFilterActive = useMemo(() => {
    return filterCategory !== 'All' || filterStatus !== 'All' || filterPos !== 'All' || filterToeic !== 'All' || filterDateFrom !== '' || filterDateTo !== '' || filterIndexFrom !== '' || filterIndexTo !== '';
  }, [filterCategory, filterStatus, filterPos, filterToeic, filterDateFrom, filterDateTo, filterIndexFrom, filterIndexTo]);

  const handleResetFilters = () => {
     setFilterCategory('All'); setFilterStatus('All'); setFilterPos('All'); setFilterToeic('All');
     setFilterDateFrom(''); setFilterDateTo(''); setFilterIndexFrom(''); setFilterIndexTo('');
  };

  // --- 範囲指定フィルター状態の監視 ---
  useEffect(() => {
    const hasIndexFilter = filterIndexFrom !== '' || filterIndexTo !== '';
    if (hasIndexFilter) {
        // フィルター開始時、現在のソート順を「基準」として保存
        if (frozenSortOrder === null) {
            setFrozenSortOrder(sortOrder);
        }
    } else {
        setFrozenSortOrder(null);
    }
  }, [filterIndexFrom, filterIndexTo, sortOrder, frozenSortOrder]);


  // =========================================================
  // ★ Phase 1: ベースリストの作成 (Range / Slice)
  // ここで「範囲指定された単語リスト」を確定させ、変数(baseRangeWords)に保存します。
  // 検索やカテゴリなどのフィルターはここではかけません。
  // =========================================================
  const baseRangeWords = useMemo(() => {
    let tempWords = [...words];

    // 1. ソート (ロックされた順序 または 現在の順序)
    const sortStrategy = frozenSortOrder || sortOrder;

    tempWords.sort((a, b) => {
        switch (sortStrategy) {
            case 'newest': return a.initialOrder - b.initialOrder;
            case 'oldest': return b.initialOrder - a.initialOrder;
            case 'a-z': return a.english.localeCompare(b.english);
            case 'z-a': return b.english.localeCompare(a.english);
            case 'toeic-high': return (b.toeicLevel || 0) - (a.toeicLevel || 0);
            case 'toeic-low': return (a.toeicLevel || 0) - (b.toeicLevel || 0);
            default: return 0;
        }
    });

    // 2. 範囲切り取り (Slice)
    if (filterIndexFrom || filterIndexTo) {
        const start = filterIndexFrom ? Math.max(0, parseInt(filterIndexFrom) - 1) : 0;
        const end = filterIndexTo ? parseInt(filterIndexTo) : tempWords.length;
        
        tempWords = tempWords.slice(start, end);
    }
    
    // これが「保存されたリスト」となります
    return tempWords;
  }, [
    words, 
    frozenSortOrder, // ロックされたソート順が変わらない限り、ここの並びは維持される
    sortOrder,       // ロックされていない場合はこれに従う
    filterIndexFrom, 
    filterIndexTo
  ]);


  // =========================================================
  // ★ Phase 2: 表示用データの作成 (Filter & Display Sort)
  // Phase 1で作成された「baseRangeWords」に対して、検索などをかけます。
  // これにより、全リストに戻ることなく「範囲内での絞り込み」が実現します。
  // =========================================================
  const processedWords = useMemo(() => {
    // ★ 全リスト(words)ではなく、Phase 1で作ったリスト(baseRangeWords)を使う
    let tempWords = [...baseRangeWords];

    // 1. フィルタリング (検索・カテゴリ・日付など)
    tempWords = tempWords.filter(w => {
        // Search
        if (searchTerm) {
            const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  w.meaning.includes(searchTerm);
            if (!matchesSearch) return false;
        }
        // Date (範囲内の単語が日付条件を満たすか)
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
        // Others
        if (filterCategory !== 'All' && w.category !== filterCategory) return false;
        if (filterStatus !== 'All' && w.status !== filterStatus) return false;
        if (filterPos !== 'All' && !w.partOfSpeech.includes(filterPos)) return false;
        if (filterToeic !== 'All') {
            const minScore = parseInt(filterToeic);
            if ((w.toeicLevel || 0) < minScore) return false;
        }
        return true;
    });

    // 2. 表示用ソート (Display Sort)
    // 範囲指定中(frozenSortOrderあり)なら、絞り込まれた結果を現在の希望順に並べる
    if (frozenSortOrder) {
         tempWords.sort((a, b) => {
            switch (sortOrder) {
                case 'newest': return a.initialOrder - b.initialOrder;
                case 'oldest': return b.initialOrder - a.initialOrder;
                case 'a-z': return a.english.localeCompare(b.english);
                case 'z-a': return b.english.localeCompare(a.english);
                case 'toeic-high': return (b.toeicLevel || 0) - (a.toeicLevel || 0);
                case 'toeic-low': return (a.toeicLevel || 0) - (b.toeicLevel || 0);
                default: return 0;
            }
        });
    }

    return tempWords;
  }, [
    baseRangeWords,   // ★重要: Phase 1の結果が変わった時だけ再計算
    searchTerm, 
    filterCategory, 
    filterStatus, 
    filterPos, 
    filterToeic,
    filterDateFrom,
    filterDateTo,
    sortOrder,        // 表示ソートの変更用
    frozenSortOrder   // 条件分岐用
  ]);


  // --- Render ---
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
            toggleDailyComment={() => setShowDailyComment(true)}
        />
      </div>
 
      <div className="max-w-7xl mx-auto px-4 pt-4">
        
        {/* Controls Section */}
        <div className="flex flex-col gap-6 mb-4">
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
                
                <div className="flex items-center gap-4 w-full md:w-auto z-20">
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
                    
                    <div className="relative flex-1 md:flex-none">
                      <SortDropdown 
                        value={sortOrder}
                        onChange={(val) => setSortOrder(val)}
                      />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <FilterBar 
                category={filterCategory} setCategory={setFilterCategory} categoryOptions={uniqueCategories}
                status={filterStatus} setStatus={setFilterStatus}
                pos={filterPos} setPos={setFilterPos} posOptions={uniquePos}
                toeic={filterToeic} setToeic={setFilterToeic}
                dateFrom={filterDateFrom} setDateFrom={setFilterDateFrom}
                dateTo={filterDateTo} setDateTo={setFilterDateTo}
                indexFrom={filterIndexFrom} setIndexFrom={setFilterIndexFrom}
                indexTo={filterIndexTo} setIndexTo={setFilterIndexTo}
                onResetAll={handleResetFilters}
                isAnyFilterActive={isAnyFilterActive}
            />
        </div>

        {/* Word Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {processedWords.map((word, index) => {
                const currentCount = index + 1;
                const showMilestone = currentCount > 0 && currentCount % 100 === 0;

                return (
                    <React.Fragment key={word.id}>
                        <div className="animate-in fade-in duration-500">
                            <WordCard word={word} onClick={setSelectedWord} />
                        </div>
                        {showMilestone && (
                            <div className="animate-in zoom-in-50 duration-500">
                                <MilestoneCard count={currentCount} />
                            </div>
                        )}
                    </React.Fragment>
                );
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