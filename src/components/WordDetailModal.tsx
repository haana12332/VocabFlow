import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordDocument } from '../types';
import { updateWord, updateWordExample, updateWordComment } from '../firebase';

interface WordDetailModalProps {
  word: WordDocument;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedWord: WordDocument) => void;
}

// 設定用の型定義
interface PlaybackSettings {
    rate: number;          // 再生速度
    englishRepeat: number; // 英語繰り返し回数
    readJapanese: boolean; // 日本語を読み上げるかどうか
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({ word, onClose, onDelete, onUpdate }) => {
  const [currentWord, setCurrentWord] = useState<WordDocument>(word);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<WordDocument>({ 
    ...word, 
    examples: word.examples || [],
    comment: word.comment || ''
  });
  const [loading, setLoading] = useState(false);

  // --- 音声再生用ステート ---
  const [showSettings, setShowSettings] = useState(false);
  const [playingExampleIndex, setPlayingExampleIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<PlaybackSettings>({
      rate: 1.0,
      englishRepeat: 1,
      readJapanese: false, 
  });

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const isPlayingRef = useRef(false);
  
  // 設定パネル外をクリックしたときに閉じるためのRef
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentWord(word);
    setEditData({ 
      ...word, 
      examples: word.examples || [],
      comment: word.comment || ''
    });
  }, [word]);

  // 設定パネル外クリック検知
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setShowSettings(false);
        }
    };
    if (showSettings) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesRef.current = voices;
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
        window.speechSynthesis.cancel();
        isPlayingRef.current = false;
    };
  }, []);

  const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP', rate: number) => {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      if (voicesRef.current.length > 0) {
        let targetVoice;
        if (lang === 'en-US') {
          targetVoice = voicesRef.current.find(v => v.name === 'Google US English') 
                      || voicesRef.current.find(v => v.name === 'Samantha')
                      || voicesRef.current.find(v => v.lang.startsWith('en'));
        } else {
          targetVoice = voicesRef.current.find(v => v.lang === 'ja-JP') 
                      || voicesRef.current.find(v => v.name === 'Kyoko')
                      || voicesRef.current.find(v => v.lang.startsWith('ja'));
        }
        if (targetVoice) utterance.voice = targetVoice;
      }
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handlePlayExample = async (index: number) => {
      if (playingExampleIndex === index) {
          window.speechSynthesis.cancel();
          isPlayingRef.current = false;
          setPlayingExampleIndex(null);
          return;
      }

      window.speechSynthesis.cancel();
      isPlayingRef.current = true;
      setPlayingExampleIndex(index);

      const example = currentWord.examples![index];
      
      for (let i = 0; i < settings.englishRepeat; i++) {
          if (!isPlayingRef.current) break;
          await speak(example.sentence, 'en-US', settings.rate);
          if (i < settings.englishRepeat - 1 || settings.readJapanese) {
              await sleep(300);
          }
      }

      if (settings.readJapanese && isPlayingRef.current) {
          await sleep(200);
          await speak(example.translation, 'ja-JP', settings.rate);
      }

      if (isPlayingRef.current) {
          setPlayingExampleIndex(null);
          isPlayingRef.current = false;
      }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        await updateWord(currentWord.id, editData);
        await updateWordExample(currentWord.id, editData.examples);
        await updateWordComment(currentWord.id, editData.comment);
        setCurrentWord(editData);
        onUpdate(editData); 
        setIsEditing(false);
    } catch (e) {
        console.error("Failed to update", e);
        alert("Failed to update word.");
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (field: keyof WordDocument, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleExampleChange = (index: number, field: 'sentence' | 'translation', value: string) => {
    const newExamples = [...(editData.examples || [])];
    newExamples[index] = { ...newExamples[index], [field]: value };
    setEditData(prev => ({ ...prev, examples: newExamples }));
  };

  const handleAddExample = () => {
    setEditData(prev => ({
        ...prev,
        examples: [...(prev.examples || []), { sentence: '', translation: '' }]
    }));
  };

  const handleRemoveExample = (index: number) => {
    const newExamples = [...(editData.examples || [])];
    newExamples.splice(index, 1);
    setEditData(prev => ({ ...prev, examples: newExamples }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <style>{`
        .custom-range {
          -webkit-appearance: none;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          outline: none;
        }
        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .custom-range::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>

      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-8 relative animate-slide-up sm:animate-none max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Close Button Only (Settings moved to Examples) */}
        <div className="absolute top-4 right-4 z-20">
            <button onClick={() => {
                window.speechSynthesis.cancel();
                onClose();
            }} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200">
                <i className="fa-solid fa-times"></i>
            </button>
        </div>

        {/* Edit/Save Header */}
        {isEditing ? (
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-700">Edit Word</h2>
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                >
                    {loading ? "Saving..." : "Save Changes"}
                </button>
             </div>
        ) : (
            <div className="absolute top-4 left-4">
                <button 
                    onClick={() => setIsEditing(true)}
                    className="text-slate-400 hover:text-indigo-600 font-semibold text-sm flex items-center gap-1"
                >
                    <i className="fa-solid fa-pen"></i> Edit
                </button>
            </div>
        )}

        {/* Word Info Header */}
        <div className="flex flex-col items-center mb-6 mt-6">
            <div className="flex gap-2 mb-3">
                 {isEditing ? (
                     <div className="flex flex-col gap-2">
                         <label className="text-[10px] text-slate-400 uppercase font-bold text-center">Category</label>
                         <select 
                             value={editData.category} 
                             onChange={(e) => handleChange('category', e.target.value)}
                             className="text-xs bg-indigo-50 px-2 py-1 rounded border border-indigo-100 text-indigo-700 outline-none"
                         >
                             <option value="Daily">Daily</option>
                             <option value="Business">Business</option>
                             <option value="Academic">Academic</option>
                             {/* ... other options ... */}
                             <option value="Other">Other</option>
                         </select>
                     </div>
                 ) : (
                     <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {currentWord.category}
                     </span>
                 )}
                 {isEditing ? (
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-slate-400 uppercase font-bold text-center">TOEIC</label>
                        <input 
                            type="number"
                            value={editData.toeicLevel || ''}
                            onChange={(e) => handleChange('toeicLevel', Number(e.target.value))}
                            className="w-20 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 text-center"
                        />
                     </div>
                 ) : (
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        TOEIC {currentWord.toeicLevel || 'N/A'}
                     </span>
                 )}
            </div>

            {isEditing ? (
                <input 
                    type="text"
                    value={editData.english}
                    onChange={(e) => handleChange('english', e.target.value)}
                    className="text-3xl font-black text-slate-800 text-center border-b-2 border-indigo-200 outline-none w-full"
                />
            ) : (
                <h2 className="text-4xl font-black text-slate-800 text-center">{currentWord.english}</h2>
            )}

            <div className="flex gap-2 mt-2 items-center">
                 {isEditing ? (
                    <input 
                        type="text"
                        value={editData.partOfSpeech.join(', ')}
                        onChange={(e) => handleChange('partOfSpeech', e.target.value.split(',').map(s=>s.trim()))}
                        className="text-sm text-center text-slate-400 border-b border-slate-200 outline-none w-full"
                    />
                 ) : (
                    currentWord.partOfSpeech.map((pos, i) => (
                        <span key={i} className="text-slate-400 text-sm font-semibold italic">{pos}</span>
                    ))
                 )}
            </div>

            <button 
                onClick={() => window.open(currentWord.pronunciationURL, '_blank')}
                className="mt-4 neumorph-btn w-10 h-10 rounded-full flex items-center justify-center text-indigo-600"
            >
                <i className="fa-solid fa-volume-high"></i>
            </button>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center mb-6">
             <div className="bg-slate-100 rounded-lg p-1 flex">
                <div className={`px-3 py-1 rounded text-xs font-bold ${currentWord.status === 'Beginner' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 opacity-50'}`}>Beginner</div>
                <div className={`px-3 py-1 rounded text-xs font-bold ${currentWord.status === 'Training' ? 'bg-white shadow text-blue-600' : 'text-slate-400 opacity-50'}`}>Training</div>
                <div className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${currentWord.status === 'Mastered' ? 'bg-green-100 text-green-700' : 'text-slate-300 opacity-50'}`}>
                    {currentWord.status === 'Mastered' && <i className="fa-solid fa-check"></i>} Mastered
                </div>
             </div>
        </div>

        <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Meaning</h3>
                {isEditing ? (
                    <input 
                        className="w-full bg-transparent border-b border-indigo-200 outline-none text-xl font-bold text-slate-700"
                        value={editData.meaning}
                        onChange={(e) => handleChange('meaning', e.target.value)}
                    />
                ) : (
                    <p className="text-2xl font-bold text-slate-700">{currentWord.meaning}</p>
                )}
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Core Image / Etymology</h3>
                {isEditing ? (
                    <textarea 
                        className="w-full bg-transparent border border-indigo-200 outline-none text-slate-600 rounded p-2"
                        rows={3}
                        value={editData.coreImage}
                        onChange={(e) => handleChange('coreImage', e.target.value)}
                    />
                ) : (
                    <p className="text-slate-600 leading-relaxed">{currentWord.coreImage}</p>
                )}
            </div>

            {/* Examples Section */}
            {(currentWord.examples && currentWord.examples.length > 0) || isEditing ? (
                <div>
                      {/* Section Header with Settings Button */}
                      <div className="flex justify-between items-center mb-3 px-2">
                        <div className="flex items-center gap-2 relative">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Examples</h3>
                            
                            {/* Settings Button (View Mode Only) */}
                            {!isEditing && (
                                <div className="relative" ref={settingsRef}>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowSettings(!showSettings);
                                        }}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors text-xs ${showSettings ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-indigo-500'}`}
                                        title="Audio Settings"
                                    >
                                        <i className="fa-solid fa-gear"></i>
                                    </button>

                                    {/* Settings Panel Popup - Positioned relative to the header */}
                                    {showSettings && (
                                        <div className="absolute top-8 left-0 w-64 bg-slate-800 text-white p-4 rounded-xl shadow-xl z-50 animate-slide-up">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-white/10 pb-2">Audio Settings</h4>
                                            
                                            {/* Read Japanese Toggle */}
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-xs text-slate-300">Read Meaning (JP)</span>
                                                <button 
                                                    onClick={() => setSettings({...settings, readJapanese: !settings.readJapanese})}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${settings.readJapanese ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                                >
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.readJapanese ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            {/* Speed Control */}
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-300">Speed</span>
                                                    <span className="font-mono text-indigo-300">x{settings.rate}</span>
                                                </div>
                                                <input 
                                                    type="range" min="0.5" max="2.0" step="0.1"
                                                    value={settings.rate}
                                                    onChange={(e) => setSettings({...settings, rate: parseFloat(e.target.value)})}
                                                    className="w-full custom-range"
                                                />
                                            </div>

                                            {/* Repeat Count */}
                                            <div>
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className="text-slate-300">English Repeat</span>
                                                    <span className="font-mono text-indigo-300">{settings.englishRepeat} times</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3].map(num => (
                                                        <button
                                                            key={num}
                                                            onClick={() => setSettings({...settings, englishRepeat: num})}
                                                            className={`flex-1 py-1 text-xs rounded border transition-colors ${
                                                                settings.englishRepeat === num 
                                                                ? 'bg-indigo-500 border-indigo-500 text-white' 
                                                                : 'border-white/20 text-slate-400 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {isEditing && (
                            <button 
                                onClick={handleAddExample}
                                className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 font-bold"
                            >
                                <i className="fa-solid fa-plus mr-1"></i> Add
                            </button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {isEditing ? (
                            (editData.examples || []).map((ex, index) => (
                                <div key={index} className="border border-indigo-200 rounded p-3 bg-white relative group">
                                    <button 
                                        onClick={() => handleRemoveExample(index)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-400"
                                    >
                                        <i className="fa-solid fa-times-circle"></i>
                                    </button>
                                    <div className="mb-2">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Sentence</label>
                                        <input 
                                            className="w-full border-b border-slate-100 outline-none text-sm text-slate-800" 
                                            value={ex.sentence}
                                            onChange={(e) => handleExampleChange(index, 'sentence', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Translation</label>
                                        <input 
                                            className="w-full outline-none text-xs text-slate-500" 
                                            value={ex.translation}
                                            onChange={(e) => handleExampleChange(index, 'translation', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            currentWord.examples && currentWord.examples.map((ex, i) => (
                                <div key={i} className={`flex gap-3 border-l-4 pl-4 py-2 transition-colors ${playingExampleIndex === i ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200'}`}>
                                    <button
                                        onClick={() => handlePlayExample(i)}
                                        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                                            playingExampleIndex === i 
                                            ? 'bg-indigo-500 text-white shadow-md' 
                                            : 'bg-white text-indigo-500 border border-indigo-100 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <i className={`fa-solid ${playingExampleIndex === i ? 'fa-stop' : 'fa-play'} text-xs`}></i>
                                    </button>
                                    <div>
                                        <p className={`text-slate-800 font-medium mb-1 ${playingExampleIndex === i ? 'text-indigo-900' : ''}`}>
                                            {ex.sentence}
                                        </p>
                                        <p className={`text-sm transition-opacity ${settings.readJapanese ? 'text-slate-500' : 'text-slate-300'}`}>
                                            {ex.translation}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        {isEditing && (!editData.examples || editData.examples.length === 0) && (
                            <p className="text-center text-slate-400 text-xs py-4 border border-dashed border-slate-300 rounded">
                                No examples yet. Click "Add" to create one.
                            </p>
                        )}
                      </div>
                </div>
            ) : null}

            {/* Comment Section */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <i className="fa-solid fa-comment mr-2"></i>Comment / Notes
                </h3>
                {isEditing ? (
                    <textarea 
                        className="w-full bg-transparent border border-indigo-200 outline-none text-slate-600 rounded p-2"
                        rows={4}
                        value={editData.comment || ''}
                        onChange={(e) => handleChange('comment', e.target.value)}
                    />
                ) : (
                    <p className="text-slate-600 leading-relaxed">
                        {currentWord.comment || <span className="text-slate-400 italic">No comments yet</span>}
                    </p>
                )}
            </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between">
            <span className="text-xs text-slate-400">Added on {currentWord.createdAt?.seconds ? new Date(currentWord.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
            <button 
                onClick={() => {
                    if(window.confirm('Are you sure you want to delete this word?')) {
                        onDelete(currentWord.id);
                        onClose();
                    }
                }}
                className="text-red-400 hover:text-red-600 text-sm font-bold"
            >
                <i className="fa-solid fa-trash mr-1"></i> Delete Word
            </button>
        </div>
      </div>
    </div>
  );
};