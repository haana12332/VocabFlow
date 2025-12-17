import React, { useState, useEffect, useMemo, memo } from 'react'; // useRef, useCallbackの一部は不要になる場合がありますが、念のため残してもOK
import { Navbar } from './components/Navbar';
import { WordCard } from './components/WordCard';
import { AddWordModal } from './components/AddWordModal';
import { Settings } from './components/Settings'; 
import { FlashcardView } from './components/FlashcardView';
import { QuizModal } from './components/QuizModal';
import { WordDetailModal } from './components/WordDetailModal';
import { DailyCommentModal } from './components/DailyCommentModal'; 
import { SortDropdown } from './components/SortDropdown';
import { FilterBar } from './components/FilterBar';
import { Login } from './components/Login'; 
// ★ fetchWords の代わりに fetchAllWords をインポート（firebase.tsで定義したもの）
import { fetchAllWords, deleteWord, auth, getUserProfile } from './firebase'; 
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { WordDocument, WordStatus } from './types';

// App コンポーネント
function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isConfigVerified, setIsConfigVerified] = useState(false);

  // App State
  const [words, setWords] = useState<WordDocument[]>([]);
  // ★ 削除: lastVisible, hasMore は不要
  // const [lastVisible, setLastVisible] = useState<any>(null);
  // const [hasMore, setHasMore] = useState(true);
  
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcardView, setShowFlashcardView] = useState(false);
  const [showDailyComment, setShowDailyComment] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordDocument | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort State
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'a-z' | 'z-a' | 'toeic-high' | 'toeic-low'>('newest');
  
  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPos, setFilterPos] = useState<string>('All');
  const [filterToeic, setFilterToeic] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
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
                  console.log("Detecting new database config. Syncing and reloading...");
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

      // ★ 修正: ステート初期化のみ行う
      setWords([]);
      setUser(currentUser);
      setAuthLoading(false);
      setIsConfigVerified(true); 
    });
    return () => unsubscribe();
  }, []);

  // ★ 削除: Infinite Scroll Observer (observer, lastWordElementRef) はすべて削除

  // ★ 修正: 一括読み込み用の関数
  const loadWords = async () => {
    if (!user || !isConfigVerified) return;

    setLoading(true);
    // ここで全件取得関数を呼ぶ (引数は必要に応じて user.uid などを渡す)
    const allWords = await fetchAllWords(user.uid); 
    setWords(allWords);
    setLoading(false);
  };

  // ★ 修正: 初期データ読み込み (依存配列から authLoading などを適切に監視)
  useEffect(() => {
    if (user && !authLoading && isConfigVerified) {
        loadWords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, isConfigVerified]);

  // ★ 削除または修正: 時間経過による自動読み込み
  // 全件取得の場合、頻繁な自動リロードは負荷が高いため削除推奨ですが、
  // どうしても必要なら setInterval で loadWords() を呼んでください。
  // ここでは削除します。

  // Handler Functions
  const handleWordAdded = (newWord: WordDocument) => {
    setWords(prev => [newWord, ...prev]);
  };

  const handleWordUpdated = (updatedWord: WordDocument) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
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

  // Derive Filter Options (ここはそのまま)
  const categoriesString = useMemo(() => 
    Array.from(new Set(words.map(w => w.category))).sort().join(','), 
    [words.length, words.map(w => w.category).join(',')]
  );
  
  const uniqueCategories = useMemo(() => {
    const categories = categoriesString ? categoriesString.split(',') : [];
    return Array.from(new Set([...categories])).sort();
  }, [categoriesString]);
  
  const posString = useMemo(() => 
    Array.from(new Set(words.flatMap(w => w.partOfSpeech))).sort().join(','), 
    [words.length, words.flatMap(w => w.partOfSpeech).join(',')]
  );
  
  const uniquePos = useMemo(() => {
    const pos = posString ? posString.split(',') : [];
    return Array.from(new Set([...pos])).sort();
  }, [posString]);

  // Check if any filter is active (そのまま)
  const isAnyFilterActive = useMemo(() => {
    return filterCategory !== 'All' || 
           filterStatus !== 'All' || 
           filterPos !== 'All' || 
           filterToeic !== 'All' || 
           filterDateFrom !== '' || 
           filterDateTo !== '' || 
           filterIndexFrom !== '' || 
           filterIndexTo !== '';
  }, [filterCategory, filterStatus, filterPos, filterToeic, filterDateFrom, filterDateTo, filterIndexFrom, filterIndexTo]);

  // Reset all filters (そのまま)
  const handleResetFilters = () => {
     setFilterCategory('All');
     setFilterStatus('All');
     setFilterPos('All');
     setFilterToeic('All');
     setFilterDateFrom('');
     setFilterDateTo('');
     setFilterIndexFrom('');
     setFilterIndexTo('');
  };

  // Client-side filtering/sorting (そのまま)
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
        if (sortOrder === 'newest') return b.createdAt.seconds - a.createdAt.seconds;
        if (sortOrder === 'oldest') return a.createdAt.seconds - b.createdAt.seconds;
        if (sortOrder === 'z-a') return b.english.localeCompare(a.english);
        if (sortOrder === 'toeic-high') return (b.toeicLevel || 0) - (a.toeicLevel || 0);
        if (sortOrder === 'toeic-low') return (a.toeicLevel || 0) - (b.toeicLevel || 0);
        return a.english.localeCompare(b.english); // Default 'a-z'
    })
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
            toggleDailyComment={() => setShowDailyComment(true)}
        />
      </div>
 
      <div className="max-w-7xl mx-auto px-4 pt-4">
        
        {/* Controls Section (Search, Flashcards, Sort) */}
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

            {/* Mobile-Friendly Filter Bar */}
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
            {processedWords.map((word) => (
                // ★ 修正: ref={lastWordElementRef} を削除
                <div key={word.id}><WordCard word={word} onClick={setSelectedWord} /></div>
            ))}
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