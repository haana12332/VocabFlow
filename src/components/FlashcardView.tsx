import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordDocument, WordStatus } from '../types';
import { updateWordStatus } from '../firebase';

interface FlashcardViewProps {
  words: WordDocument[];
  onClose: () => void;
  onUpdateStatus?: (wordId: string, newStatus: WordStatus) => void;
}

type BlockType = 'english' | 'japanese' | 'example';

interface PlaybackBlock {
  uuid: string;
  type: BlockType;
  label: string;
}

interface PlaybackSettings {
  flipInterval: number;
  timeline: PlaybackBlock[];
  word: { rate: number; };
  example: { rate: number; };
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ words, onClose, onUpdateStatus }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showButtons, setShowButtons] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // --- デフォルト値 ---
  const defaultTimeline: PlaybackBlock[] = [
    { uuid: '1', type: 'english', label: 'Word (EN)' },
    { uuid: '2', type: 'japanese', label: 'Meaning (JP)' },
    { uuid: '3', type: 'example', label: 'Example (EN)' },
  ];

  const [isPlaying, setIsPlaying] = useState(false);
  
  const [settings, setSettings] = useState<PlaybackSettings>({
    flipInterval: 1.0,
    timeline: defaultTimeline,
    word: { rate: 1.0 },
    example: { rate: 1.0 }
  });
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  const isPlayingRef = useRef(false);
  const settingsRef = useRef(settings);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const isFlippedRef = useRef(isFlipped);

  const currentWord = words[currentIndex];

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) window.speechSynthesis.cancel();
  }, [isPlaying]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) voicesRef.current = voices;
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // --- 音声再生用ヘルパー ---
  const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP', rate: number) => {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      if (voicesRef.current.length > 0) {
        let targetVoice;
        if (lang === 'en-US') {
          targetVoice = 
            voicesRef.current.find(v => v.name === 'Google US English') 
            || voicesRef.current.find(v => v.name.includes('Microsoft Zira')) 
            || voicesRef.current.find(v => v.name.includes('Microsoft David')) 
            || voicesRef.current.find(v => v.name === 'Samantha') 
            || voicesRef.current.find(v => v.lang === 'en-US')
            || voicesRef.current.find(v => v.lang.startsWith('en'));
        } else {
          targetVoice = 
            voicesRef.current.find(v => v.name === 'Google 日本語') 
            || voicesRef.current.find(v => v.name.includes('Microsoft Haruka')) 
            || voicesRef.current.find(v => v.name.includes('Microsoft Ichiro')) 
            || voicesRef.current.find(v => v.name === 'Kyoko') 
            || voicesRef.current.find(v => v.name === 'Otoya') 
            || voicesRef.current.find(v => v.lang === 'ja-JP')
            || voicesRef.current.find(v => v.lang.startsWith('ja'));
        }
        if (targetVoice) utterance.voice = targetVoice;
      }
      
      utterance.onend = () => resolve();
      utterance.onerror = (e) => { console.error("Speech Error", e); resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- 設定パネル操作 ---
  const addBlock = (type: BlockType) => {
    const label = type === 'english' ? 'Word (EN)' : type === 'japanese' ? 'Meaning (JP)' : 'Example (EN)';
    const newBlock: PlaybackBlock = { uuid: crypto.randomUUID(), type, label };
    setSettings(prev => ({ ...prev, timeline: [...prev.timeline, newBlock] }));
  };

  const removeBlock = (uuid: string) => {
    setSettings(prev => ({ ...prev, timeline: prev.timeline.filter(b => b.uuid !== uuid) }));
  };

  // ドラッグ＆ドロップ（PC用）
  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _timeline = [...settings.timeline];
    const draggedItemContent = _timeline[dragItem.current];
    _timeline.splice(dragItem.current, 1);
    _timeline.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setSettings(prev => ({ ...prev, timeline: _timeline }));
  };

  // ボタンによる並べ替え（スマホ用）
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const _timeline = [...settings.timeline];
    if (direction === 'up') {
        if (index === 0) return;
        const temp = _timeline[index];
        _timeline[index] = _timeline[index - 1];
        _timeline[index - 1] = temp;
    } else {
        if (index === _timeline.length - 1) return;
        const temp = _timeline[index];
        _timeline[index] = _timeline[index + 1];
        _timeline[index + 1] = temp;
    }
    setSettings(prev => ({ ...prev, timeline: _timeline }));
  };

  // --- 自動再生ロジック ---
  useEffect(() => {
    let isMounted = true;

    const ensureFlipState = async (shouldBeFlipped: boolean) => {
      if (isFlippedRef.current !== shouldBeFlipped) {
         if (!isMounted || !isPlayingRef.current) return;
         
         setIsFlipped(shouldBeFlipped);
         isFlippedRef.current = shouldBeFlipped;
         await sleep(600);
      }
    };

    const playSequence = async () => {
      if (!isPlaying || !currentWord) return;
      const s = settingsRef.current;
      
      for (const block of s.timeline) {
        if (!isMounted || !isPlayingRef.current) return;

        switch (block.type) {
          case 'english':
            await ensureFlipState(false);
            if (!isMounted || !isPlayingRef.current) return;
            await speak(currentWord.english, 'en-US', s.word.rate);
            break;

          case 'japanese':
            await ensureFlipState(true);
            if (!isMounted || !isPlayingRef.current) return;
            await speak(currentWord.meaning, 'ja-JP', s.word.rate);
            break;

          case 'example':
            await ensureFlipState(true);
            if (!isMounted || !isPlayingRef.current) return;
            if (currentWord.examples && currentWord.examples.length > 0) {
              const examplesToPlay = currentWord.examples.slice(0, 2);
              for (const ex of examplesToPlay) {
                  if (!isMounted || !isPlayingRef.current) return;
                  await speak(ex.sentence, 'en-US', s.example.rate);
                  await sleep(400); 
              }
            }
            break;
        }
        await sleep(s.flipInterval * 1000);
      }

      if (!isMounted || !isPlayingRef.current) return;
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        isFlippedRef.current = false;
        setShowButtons(false);
        setTimeout(() => setShowButtons(true), 500);
      } else {
        setIsPlaying(false);
        setIsFlipped(false);
        isFlippedRef.current = false;
      }
    };

    if (isPlaying) playSequence();

    return () => {
      isMounted = false;
      window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]);

  // --- イベントハンドラ ---
  const navigateNext = useCallback(() => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowButtons(false);
      setTimeout(() => setShowButtons(true), 500);
    }
  }, [currentIndex, words.length]);

  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
      setShowButtons(false);
      setTimeout(() => setShowButtons(true), 500);
    }
  }, [currentIndex]);

  const triggerFlip = useCallback(() => {
    if (isPlaying) setIsPlaying(false);
    setShowButtons(false);
    setTimeout(() => {
      setIsFlipped(prev => !prev);
      setTimeout(() => setShowButtons(true), 150);
    }, 200);
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': navigateNext(); break;
        case 'ArrowLeft': navigatePrev(); break;
        case 'ArrowUp': e.preventDefault(); triggerFlip(); break;
        case ' ': 
        case 'Space': 
          e.preventDefault();
          setIsPlaying(false);
          isFlipped 
            ? speak(currentWord.meaning, 'ja-JP', settings.word.rate) 
            : speak(currentWord.english, 'en-US', settings.word.rate);
          break;
        case 'Escape': onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateNext, navigatePrev, triggerFlip, onClose, currentWord, isFlipped, speak, settings.word.rate]);

  const handleNextClick = (e: React.MouseEvent) => { e.stopPropagation(); navigateNext(); };
  const handlePrevClick = (e: React.MouseEvent) => { e.stopPropagation(); navigatePrev(); };
  const handleFlipClick = () => !showSettings ? triggerFlip() : setShowSettings(false);

  const toggleStatus = async (e: React.MouseEvent, targetStatus: WordStatus) => {
      e.stopPropagation();
      if (!currentWord) return;
      try {
          await updateWordStatus(currentWord.id, targetStatus);
          if (onUpdateStatus) onUpdateStatus(currentWord.id, targetStatus);
      } catch (error) { console.error(error); }
  };

  const handleManualSpeak = (e: React.MouseEvent, text: string, lang: 'en-US'|'ja-JP') => {
    e.stopPropagation();
    setIsPlaying(false);
    speak(text, lang, settings.word.rate);
  }

  const getBlockColor = (type: BlockType) => {
      switch(type) {
          case 'english': return 'bg-indigo-500 border-indigo-400';
          case 'japanese': return 'bg-slate-600 border-slate-500';
          case 'example': return 'bg-emerald-600 border-emerald-500';
      }
  };

  if (!currentWord) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in-element { animation: fadeIn 0.3s ease-out forwards; }
        .custom-range { -webkit-appearance: none; height: 4px; background: rgba(255, 255, 255, 0.3); border-radius: 2px; outline: none; }
        .custom-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: white; border-radius: 50%; cursor: pointer; transition: transform 0.1s; }
        .custom-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .card-scrollbar::-webkit-scrollbar { width: 4px; }
        .card-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .card-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}</style>
      
      <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg aspect-square">
          
          {/* Close Button */}
          <button onClick={() => { setIsPlaying(false); onClose(); }} className="absolute -top-14 right-0 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors z-50 backdrop-blur-md">
              <i className="fa-solid fa-times"></i>
          </button>

          {/* Top Controls */}
          <div className="absolute -top-16 left-0 flex gap-3 z-50">
             <div className="flex items-center bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying ? 'bg-red-500/80 hover:bg-red-600' : 'bg-indigo-500/80 hover:bg-indigo-600'}`}>
                  <i className={`fa-solid ${isPlaying ? 'fa-stop' : 'fa-play'} text-white`}></i>
                </button>
             </div>
             <div className="flex items-center bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
                <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all text-white hover:bg-white/10 ${showSettings ? 'bg-white/20' : ''}`}>
                    <i className="fa-solid fa-sliders"></i>
                </button>
             </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
              <>
                  {/* ★重要: パネル外タップで閉じるための透明なバックドロップ */}
                  <div 
                    className="fixed inset-0 z-[55] bg-transparent"
                    onClick={() => setShowSettings(false)}
                  />

                  {/* パネル本体 */}
                  <div 
                      className="absolute top-[-60px] left-0 sm:left-32 z-[60] w-full sm:w-80 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 text-white fade-in-element flex flex-col max-h-[600px]"
                      onClick={(e) => e.stopPropagation()} // パネル内のクリックで閉じないようにする
                  >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Custom Playback</h4>
                      
                      {/* Timeline Buttons */}
                      <div className="flex gap-2 mb-4">
                          <button onClick={() => addBlock('english')} className="flex-1 py-1.5 bg-indigo-500/20 border border-indigo-500/50 rounded-lg text-xs font-bold text-indigo-300 hover:bg-indigo-500 hover:text-white transition-all">+ Word</button>
                          <button onClick={() => addBlock('japanese')} className="flex-1 py-1.5 bg-slate-500/20 border border-slate-500/50 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-500 hover:text-white transition-all">+ Meaning</button>
                          <button onClick={() => addBlock('example')} className="flex-1 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all">+ Ex</button>
                      </div>

                      {/* Timeline List (Sortable) */}
                      <div className="flex-1 overflow-y-auto card-scrollbar min-h-[140px] mb-4 bg-slate-900/50 rounded-xl p-2 border border-white/5">
                        {settings.timeline.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">Tap buttons to add</div>
                        ) : (
                            <div className="space-y-2">
                            {settings.timeline.map((block, index) => (
                                <div 
                                    key={block.uuid}
                                    className={`flex items-center justify-between p-2 rounded-lg border shadow-sm cursor-move active:scale-[0.98] transition-transform ${getBlockColor(block.type)}`}
                                    draggable
                                    onDragStart={() => (dragItem.current = index)}
                                    onDragEnter={() => (dragOverItem.current = index)}
                                    onDragEnd={handleSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div className="flex items-center gap-3">
                                        <i className="fa-solid fa-grip-lines text-white/50 text-xs cursor-grab"></i>
                                        <span className="text-xs font-bold text-white">{block.label}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                        {/* ★スマホ用 並べ替えボタン (ドラッグの代わり) */}
                                        <div className="flex flex-col mr-2 gap-0.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
                                                className="w-5 h-4 bg-white/10 hover:bg-white/30 rounded flex items-center justify-center text-[8px] disabled:opacity-30"
                                                disabled={index === 0}
                                            >
                                                <i className="fa-solid fa-chevron-up"></i>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
                                                className="w-5 h-4 bg-white/10 hover:bg-white/30 rounded flex items-center justify-center text-[8px] disabled:opacity-30"
                                                disabled={index === settings.timeline.length - 1}
                                            >
                                                <i className="fa-solid fa-chevron-down"></i>
                                            </button>
                                        </div>

                                        <button onClick={(e) => { e.stopPropagation(); removeBlock(block.uuid); }} className="w-6 h-6 rounded-full bg-black/20 text-white/70 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                                            <i className="fa-solid fa-xmark text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            </div>
                        )}
                      </div>

                      {/* Settings */}
                      <div className="space-y-3 pt-2 border-t border-white/10 overflow-y-auto card-scrollbar max-h-[250px] pr-2">
                        {/* Word Settings */}
                        <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-lg">
                            <p className="text-xs font-bold text-indigo-300 mb-2 uppercase">Word Settings</p>
                            <div className="mb-1">
                                <div className="flex justify-between text-[10px] mb-1 text-slate-300">
                                    <span>Speed</span><span className="font-mono text-indigo-200">x{settings.word.rate}</span>
                                </div>
                                <input type="range" min="0.5" max="2.0" step="0.1" value={settings.word.rate} onChange={(e) => setSettings({...settings, word: {...settings.word, rate: parseFloat(e.target.value)}})} className="w-full custom-range" />
                            </div>
                        </div>

                        {/* Example Settings */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                            <p className="text-xs font-bold text-emerald-300 mb-2 uppercase">Example Settings</p>
                            <div className="mb-1">
                                <div className="flex justify-between text-[10px] mb-1 text-slate-300">
                                    <span>Speed</span><span className="font-mono text-emerald-200">x{settings.example.rate}</span>
                                </div>
                                <input type="range" min="0.5" max="2.0" step="0.1" value={settings.example.rate} onChange={(e) => setSettings({...settings, example: {...settings.example, rate: parseFloat(e.target.value)}})} className="w-full custom-range" />
                            </div>
                        </div>

                        {/* Global Settings */}
                        <div className="px-1">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">Delay</span>
                                <span className="font-mono text-white">{settings.flipInterval}s</span>
                            </div>
                            <input type="range" min="0" max="3.0" step="0.2" value={settings.flipInterval} onChange={(e) => setSettings({...settings, flipInterval: parseFloat(e.target.value)})} className="w-full custom-range" />
                        </div>
                      </div>
                  </div>
              </>
          )}

          {/* Main Card */}
          <div className="w-full h-full cursor-pointer" style={{ perspective: '1000px' }} onClick={handleFlipClick}>
            <div className="relative w-full h-full transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              
              {/* Front (Word) */}
              <div className="absolute w-full h-full bg-[#f0f4f8] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8" style={{ backfaceVisibility: 'hidden' }}>
                  <span className="text-indigo-500 font-bold tracking-widest text-sm mb-4 uppercase">{currentWord.category}</span>
                  <h2 className="text-5xl font-black text-slate-800 mb-6 text-center select-none">{currentWord.english}</h2>
                  <div className="flex gap-2">
                      {currentWord.partOfSpeech.map((pos, i) => (<span key={i} className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">{pos}</span>))}
                  </div>
                  {!isFlipped && showButtons && (
                      <button onClick={(e) => handleManualSpeak(e, currentWord.english, 'en-US')} className="mt-8 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 z-10 fade-in-element active:scale-95 transition-transform"><i className="fa-solid fa-volume-high"></i></button>
                  )}
                  {!isFlipped && showButtons && (
                      <div className="absolute top-6 left-6 flex flex-col gap-2 z-20 fade-in-element">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider text-center ${currentWord.status === 'Mastered' ? 'text-green-600 bg-green-100' : currentWord.status === 'Training' ? 'text-blue-600 bg-blue-100' : 'text-gray-500 bg-gray-200'}`}>{currentWord.status}</span>
                          {currentWord.status === 'Beginner' && <button onClick={(e) => toggleStatus(e, 'Training')} className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-blue-600">Promote</button>}
                          {currentWord.status === 'Training' && <button onClick={(e) => toggleStatus(e, 'Beginner')} className="bg-gray-400 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-gray-500">Demote</button>}
                          {currentWord.status === 'Mastered' && <button onClick={(e) => toggleStatus(e, 'Training')} className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-blue-600">Demote</button>}
                      </div>
                  )}
                  <p className="absolute bottom-8 text-slate-400 text-sm">Tap or ↑ to flip</p>
              </div>

              {/* Back (Meaning & Example) */}
              <div className="absolute w-full h-full bg-slate-800 rounded-3xl shadow-2xl flex flex-col p-8 text-white" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <div className="flex flex-col items-center flex-shrink-0 mb-4">
                      <h3 className="text-3xl font-bold mb-4 text-center select-none">{currentWord.meaning}</h3>
                      <div className="w-16 h-1 bg-indigo-500 rounded-full mb-4"></div>
                      <p className="text-center text-slate-300 italic">"{currentWord.coreImage}"</p>
                  </div>
                  <div className="flex-1 overflow-y-auto card-scrollbar min-h-0 w-full pr-1">
                      <div className="space-y-3 pt-2">
                        {currentWord.examples && currentWord.examples.slice(0, 2).map((ex, idx) => (
                            <div key={idx} className="bg-slate-700/50 p-4 rounded-xl text-sm relative group">
                                <div className="pr-8">
                                    <p className="text-indigo-300 mb-1">{ex.sentence}</p>
                                    <p className="text-slate-400 text-xs">{ex.translation}</p>
                                </div>
                                <button onClick={(e) => handleManualSpeak(e, ex.sentence, 'en-US')} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors">
                                    <i className="fa-solid fa-volume-high text-xs"></i>
                                </button>
                            </div>
                        ))}
                      </div>
                  </div>
              </div>
            </div>
          </div>
          
          {/* Navigation Buttons */}
          <div className="absolute top-1/2 -left-4 sm:-left-16 transform -translate-y-1/2">
              <button onClick={handlePrevClick} disabled={currentIndex === 0} className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"><i className="fa-solid fa-chevron-left"></i></button>
          </div>
          <div className="absolute top-1/2 -right-4 sm:-right-16 transform -translate-y-1/2">
              <button onClick={handleNextClick} disabled={currentIndex === words.length - 1} className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
          <div className="absolute -bottom-10 w-full flex justify-center text-white/80 font-mono">{currentIndex + 1} / {words.length}</div>
        </div>
      </div>
    </>
  );
};