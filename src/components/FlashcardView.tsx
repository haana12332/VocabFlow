import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordDocument, WordStatus } from '../types';
import { updateWordStatus } from '../firebase';

interface FlashcardViewProps {
  words: WordDocument[];
  onClose: () => void;
  onUpdateStatus?: (wordId: string, newStatus: WordStatus) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ words, onClose, onUpdateStatus }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showButtons, setShowButtons] = useState(true);

  // --- 自動再生用のState ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalTime, setIntervalTime] = useState(0.8);
  
  const isPlayingRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const currentWord = words[currentIndex];

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      window.speechSynthesis.cancel();
    }
  }, [isPlaying]);

  // 音声リスト読み込み
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
  }, []);

  // --- 音声再生用ヘルパー ---
  const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP') => {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;

      if (voicesRef.current.length > 0) {
        let targetVoice;
        if (lang === 'en-US') {
          targetVoice = voicesRef.current.find(v => v.name === 'Google US English') 
                      || voicesRef.current.find(v => v.name === 'Samantha')
                      || voicesRef.current.find(v => v.lang === 'en-US')
                      || voicesRef.current.find(v => v.lang.startsWith('en'));
        } else {
          targetVoice = voicesRef.current.find(v => v.lang === 'ja-JP')
                      || voicesRef.current.find(v => v.name === 'Kyoko')
                      || voicesRef.current.find(v => v.lang === 'ja-JP')
                      || voicesRef.current.find(v => v.lang.startsWith('ja'));
        }
        if (targetVoice) {
          utterance.voice = targetVoice;
        }
      }
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- 自動再生ロジック ---
  useEffect(() => {
    let isMounted = true;

    const playSequence = async () => {
      if (!isPlaying || !currentWord) return;

      if (isFlipped) {
        setIsFlipped(false);
        await sleep(600);
      }
      
      if (!isMounted || !isPlayingRef.current) return;
      await speak(currentWord.english, 'en-US');

      if (!isMounted || !isPlayingRef.current) return;
      await sleep(intervalTime * 1000);

      if (!isMounted || !isPlayingRef.current) return;
      setIsFlipped(true);
      await sleep(600);

      if (!isMounted || !isPlayingRef.current) return;
      await speak(currentWord.meaning, 'ja-JP');

      if (!isMounted || !isPlayingRef.current) return;
      await sleep(intervalTime * 1000);

      if (!isMounted || !isPlayingRef.current) return;
      
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setShowButtons(false);
        setTimeout(() => setShowButtons(true), 500);
      } else {
        setIsPlaying(false);
        setIsFlipped(false);
      }
    };

    if (isPlaying) {
      playSequence();
    }

    return () => {
      isMounted = false;
      window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying]); 

  // --- ナビゲーションロジック ---
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

  // --- キーボードイベントハンドラ (更新版) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          navigateNext();
          break;
        case 'ArrowLeft':
          navigatePrev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          triggerFlip();
          break;
        case ' ': // Spaceキーの処理を追加
        case 'Space': 
          e.preventDefault(); // スクロール防止
          setIsPlaying(false); // 自動再生を停止して手動再生を優先
          
          if (isFlipped) {
            // 裏面なら日本語（意味）を再生
            speak(currentWord.meaning, 'ja-JP');
          } else {
            // 表面なら英語を再生
            speak(currentWord.english, 'en-US');
          }
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  // 依存配列に currentWord, isFlipped, speak, setIsPlaying を追加
  }, [navigateNext, navigatePrev, triggerFlip, onClose, currentWord, isFlipped, speak]);

  // --- クリック用ハンドラ ---
  const handleNextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigateNext();
  };

  const handlePrevClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigatePrev();
  };

  const handleFlipClick = () => {
    triggerFlip();
  };

  const toggleStatus = async (e: React.MouseEvent, targetStatus: WordStatus) => {
      e.stopPropagation();
      if (!currentWord) return;
      try {
          await updateWordStatus(currentWord.id, targetStatus);
          if (onUpdateStatus) {
              onUpdateStatus(currentWord.id, targetStatus);
          }
      } catch (error) {
          console.error("Failed to update status", error);
      }
  };

  const handleManualSpeak = (e: React.MouseEvent, text: string, lang: 'en-US'|'ja-JP') => {
    e.stopPropagation();
    setIsPlaying(false);
    speak(text, lang);
  }

  if (!currentWord) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-element { animation: fadeIn 0.3s ease-out forwards; }
        
        .custom-range {
          -webkit-appearance: none;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          outline: none;
        }
        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .custom-range::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
      
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg aspect-square">
          
          {/* Close Button */}
          <button 
              onClick={() => {
                setIsPlaying(false);
                onClose();
              }}
              className="absolute -top-14 right-0 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors z-50 backdrop-blur-md"
          >
              <i className="fa-solid fa-times"></i>
          </button>

          {/* Controls */}
          <div className="absolute -top-16 left-0 flex flex-col gap-2 z-50">
             <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-lg">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isPlaying 
                      ? 'bg-red-500/80 text-white hover:bg-red-600' 
                      : 'bg-indigo-500/80 text-white hover:bg-indigo-600'
                  }`}
                >
                  <i className={`fa-solid ${isPlaying ? 'fa-stop' : 'fa-play'}`}></i>
                </button>

                <div className="flex flex-col px-2 w-28">
                  <div className="flex justify-between text-[10px] text-white/80 font-mono mb-1">
                    <span>Speed</span>
                    <span>{intervalTime}s</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.5" 
                    step="0.2" 
                    value={intervalTime}
                    onChange={(e) => setIntervalTime(parseFloat(e.target.value))}
                    className="w-full custom-range cursor-pointer"
                  />
                </div>
             </div>
          </div>

          {/* Main Card */}
          <div 
              className="w-full h-full cursor-pointer"
              style={{ perspective: '1000px' }}
              onClick={handleFlipClick}
          >
            <div 
              className="relative w-full h-full transition-transform duration-500" 
              style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              
              {/* Front (English) */}
              <div 
                className="absolute w-full h-full bg-[#f0f4f8] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8"
                style={{ backfaceVisibility: 'hidden' }}
              >
                  <span className="text-indigo-500 font-bold tracking-widest text-sm mb-4 uppercase">{currentWord.category}</span>
                  <h2 className="text-5xl font-black text-slate-800 mb-6 text-center">{currentWord.english}</h2>
                  <div className="flex gap-2">
                      {currentWord.partOfSpeech.map((pos, i) => (
                          <span key={i} className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">{pos}</span>
                      ))}
                  </div>
                  
                  {/* Audio Button (Front Only) */}
                  {!isFlipped && showButtons && (
                      <button 
                          onClick={(e) => handleManualSpeak(e, currentWord.english, 'en-US')}
                          className="mt-8 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 z-10 fade-in-element active:scale-95 transition-transform"
                      >
                          <i className="fa-solid fa-volume-high"></i>
                      </button>
                  )}
                   
                  {/* Visual Hint for Space Key */}
                  <div className="absolute bottom-16 text-slate-300 text-[10px] font-mono opacity-50">
                    SPACE to speak
                  </div>

                  {/* Status Badges */}
                  {!isFlipped && showButtons && (
                      <div className="absolute top-6 left-6 flex flex-col gap-2 z-20 fade-in-element">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider text-center
                              ${currentWord.status === 'Mastered' ? 'text-green-600 bg-green-100' : 
                                currentWord.status === 'Training' ? 'text-blue-600 bg-blue-100' : 'text-gray-500 bg-gray-200'}`}>
                              {currentWord.status}
                          </span>
                          
                          {currentWord.status === 'Beginner' && (
                              <button 
                                  onClick={(e) => toggleStatus(e, 'Training')}
                                  className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-blue-600 transition-colors"
                              >
                                  Promote
                              </button>
                          )}
                          {currentWord.status === 'Training' && (
                              <button 
                                   onClick={(e) => toggleStatus(e, 'Beginner')}
                                   className="bg-gray-400 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-gray-500 transition-colors"
                              >
                                  Demote
                              </button>
                          )}
                          {currentWord.status === 'Mastered' && (
                              <button 
                                   onClick={(e) => toggleStatus(e, 'Training')}
                                   className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-blue-600 transition-colors"
                              >
                                  Demote
                              </button>
                          )}
                      </div>
                  )}
                  
                  <p className="absolute bottom-8 text-slate-400 text-sm">Tap or ↑ to flip</p>
              </div>

              {/* Back (Meaning) */}
              <div 
                className="absolute w-full h-full bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-white"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                  <h3 className="text-3xl font-bold mb-4 text-center">{currentWord.meaning}</h3>
                  <div className="w-16 h-1 bg-indigo-500 rounded-full mb-6"></div>
                  <p className="text-center text-slate-300 italic mb-6">"{currentWord.coreImage}"</p>
                  {currentWord.examples?.[0] && (
                      <div className="bg-slate-700/50 p-4 rounded-xl text-sm">
                          <p className="text-indigo-300 mb-1">{currentWord.examples[0].sentence}</p>
                          <p className="text-slate-400">{currentWord.examples[0].translation}</p>
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="absolute top-1/2 -left-4 sm:-left-16 transform -translate-y-1/2">
              <button 
                  onClick={handlePrevClick} 
                  disabled={currentIndex === 0}
                  className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"
                  title="Previous (Left Arrow)"
              >
                  <i className="fa-solid fa-chevron-left"></i>
              </button>
          </div>
          <div className="absolute top-1/2 -right-4 sm:-right-16 transform -translate-y-1/2">
              <button 
                  onClick={handleNextClick}
                  disabled={currentIndex === words.length - 1}
                  className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"
                  title="Next (Right Arrow)"
              >
                  <i className="fa-solid fa-chevron-right"></i>
              </button>
          </div>
          
          <div className="absolute -bottom-10 w-full flex justify-center text-white/80 font-mono">
              {currentIndex + 1} / {words.length}
          </div>
        </div>
      </div>
    </>
  );
};