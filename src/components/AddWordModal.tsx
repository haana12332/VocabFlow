import React, { useState, useEffect } from 'react';
import { WordDocument } from '../types';
import { generateBulkWordInfo } from '../services/geminiService';
import { addWordToFirestore } from '../firebase';

interface AddWordModalProps {
  onClose: () => void;
  onSuccess: (newWord: WordDocument) => void;
}

export const AddWordModal: React.FC<AddWordModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [loading, setLoading] = useState(false);
  
  // AI Input State
  const [bulkInput, setBulkInput] = useState('');
  const [progress, setProgress] = useState(0);

  // Manual Form State
  const [manualData, setManualData] = useState<Partial<WordDocument> & { exampleSentence: string, exampleTranslation: string }>({
    english: '',
    meaning: '',
    category: 'Daily',
    toeicLevel: 600,
    partOfSpeech: [],
    coreImage: '',
    exampleSentence: '',
    exampleTranslation: ''
  });

  // Auto-detect Idiom for Manual Entry
  useEffect(() => {
    if (manualData.english && manualData.english.trim().includes(' ')) {
        if (Array.isArray(manualData.partOfSpeech) && !manualData.partOfSpeech.includes('Idiom')) {
             setManualData(prev => ({ ...prev, partOfSpeech: ['Idiom'] }));
        }
    }
  }, [manualData.english]);

  // AI Submit Handler
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    setLoading(true);
    setProgress(10);
    try {
        const wordsData = await generateBulkWordInfo(bulkInput);
        setProgress(50);
        
        let completed = 0;
        
        // 生成された各単語を保存し、リストに追加する
        // Promise.allで並列処理しつつ、個別にonSuccessを呼ぶ
        await Promise.all(wordsData.map(async (data) => {
            // Firestoreに保存しIDを取得
            const docId = await addWordToFirestore(data as WordDocument);
            
            // 完全なオブジェクトを作成
            const newWord: WordDocument = {
                ...(data as WordDocument),
                id: docId,
                createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
            };

            // 親コンポーネントのリストに追加 (Optimistic UI)
            // これによりリロードせずに画面に反映されます
            onSuccess(newWord);

            completed++;
            setProgress(50 + (completed / wordsData.length) * 50);
        }));

        onClose();
        // window.location.reload(); // ★削除: これがソートリセットの原因でした

    } catch (error) {
        alert("Error processing words. Please try again.");
        console.error(error);
    } finally {
        setLoading(false);
        setProgress(0);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const examples = [];
      if (manualData.exampleSentence && manualData.exampleTranslation) {
          examples.push({
              sentence: manualData.exampleSentence,
              translation: manualData.exampleTranslation
          });
      }

      let pos = typeof manualData.partOfSpeech === 'string' ? [manualData.partOfSpeech] : manualData.partOfSpeech || [];
      if (manualData.english?.trim().includes(' ') && !pos.includes('Idiom')) {
          pos = ['Idiom'];
      }

      const wordToSave: any = {
          english: manualData.english,
          meaning: manualData.meaning,
          category: manualData.category,
          toeicLevel: Number(manualData.toeicLevel) || 600,
          coreImage: manualData.coreImage || '',
          status: 'Beginner',
          createdAt: new Date(),
          pronunciationURL: `https://www.google.com/search?q=${manualData.english}+pronunciation`,
          partOfSpeech: pos,
          examples: examples
      };
      
      const newDocId = await addWordToFirestore(wordToSave);

      const newWord: WordDocument = {
          ...wordToSave,
          id: newDocId,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
      };

      onSuccess(newWord);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to save word.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="neumorph-flat w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-times text-xl"></i>
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-6">Add New Words</h2>

        {/* Mode Toggle */}
        <div className="flex bg-slate-200 p-1 rounded-xl mb-6 sticky top-0 z-10">
            <button 
                onClick={() => setMode('ai')}
                className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${mode === 'ai' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
                AI
            </button>
            <button 
                onClick={() => setMode('manual')}
                className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
                Manual
            </button>
        </div>

        {mode === 'ai' && (
             <form onSubmit={handleAiSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Words (comma separated)</label>
                    <textarea 
                        rows={4}
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        className="w-full neumorph-pressed rounded-xl p-4 text-base outline-none text-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-200"
                        placeholder="Apple, Banana, Beach, Take off"
                        autoFocus
                    />
                    <p className="text-xs text-slate-400 mt-2 text-right">Separate words with commas to add multiple.</p>
                </div>
                
                {loading && (
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full neumorph-btn py-4 rounded-xl text-indigo-600 font-bold flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-wand-magic-sparkles"></i> AI Generate</>}
                </button>
            </form>
        )}

        {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">English</label>
                        <input 
                            required
                            type="text" 
                            value={manualData.english}
                            onChange={(e) => setManualData({...manualData, english: e.target.value})}
                            className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent"
                            placeholder="e.g. apple"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Japanese Meaning</label>
                        <input 
                            required
                            type="text" 
                            value={manualData.meaning}
                            onChange={(e) => setManualData({...manualData, meaning: e.target.value})}
                            className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent"
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                         <select 
                            value={manualData.category}
                            onChange={(e) => setManualData({...manualData, category: e.target.value})}
                            className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent"
                         >
                             <option value="Daily">Daily</option>
                             <option value="Business">Business</option>
                             <option value="Academic">Academic</option>
                             <option value="Travel">Travel</option>
                             <option value="Technical">Technical</option>
                         </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">TOEIC Level</label>
                        <input 
                            type="number" 
                            placeholder="e.g. 600"
                            value={manualData.toeicLevel}
                            onChange={(e) => setManualData({...manualData, toeicLevel: Number(e.target.value)})}
                            className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Part of Speech (English)</label>
                    <input 
                        type="text" 
                        placeholder="Noun, Verb"
                        value={Array.isArray(manualData.partOfSpeech) ? manualData.partOfSpeech.join(', ') : manualData.partOfSpeech}
                        onChange={(e) => setManualData({...manualData, partOfSpeech: e.target.value.split(',').map(s => s.trim())})}
                        className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Core Image</label>
                    <textarea 
                        rows={2}
                        value={manualData.coreImage}
                        onChange={(e) => setManualData({...manualData, coreImage: e.target.value})}
                        className="w-full neumorph-pressed rounded-xl p-3 outline-none text-slate-700 bg-transparent text-sm"
                    />
                 </div>

                 <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-xs font-bold text-indigo-500 mb-2 uppercase">Example Sentence</label>
                    <input 
                        type="text" 
                        placeholder="English Sentence"
                        value={manualData.exampleSentence}
                        onChange={(e) => setManualData({...manualData, exampleSentence: e.target.value})}
                        className="w-full neumorph-pressed rounded-lg p-2 text-sm outline-none text-slate-700 bg-transparent mb-2"
                    />
                    <input 
                        type="text" 
                        placeholder="Japanese Translation"
                        value={manualData.exampleTranslation}
                        onChange={(e) => setManualData({...manualData, exampleTranslation: e.target.value})}
                        className="w-full neumorph-pressed rounded-lg p-2 text-sm outline-none text-slate-700 bg-transparent"
                    />
                 </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full neumorph-btn py-4 rounded-xl text-indigo-600 font-bold hover:scale-[1.01]"
                >
                    {loading ? "Saving..." : "Save Word"}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};