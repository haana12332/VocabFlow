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
  const [intervalTime, setIntervalTime] = useState(0.8); // デフォルト0.8秒 (0.5~1.0の間)
  
  // 非同期処理の中断制御用Ref
  const isPlayingRef = useRef(false);
  
  const currentWord = words[currentIndex];

  // stateとrefを同期（useEffect内から最新のisPlayingを参照するため）
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      window.speechSynthesis.cancel();
    }
  }, [isPlaying]);

  // --- 音声再生用ヘルパー ---
  const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP') => {
    return new Promise<void>((resolve) => {
      // 既に再生中ならキャンセル
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0; 
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // エラーでも止まらないようにする

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // --- 待機用ヘルパー ---
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- 自動再生のメインロジック ---
  useEffect(() => {
    let isMounted = true;

    const playSequence = async () => {
      // 再生中でなければ何もしない
      if (!isPlaying || !currentWord) return;

      // 1. 表面（英語）を表示
      if (isFlipped) {
        setIsFlipped(false);
        await sleep(600); // フリップアニメーション待ち
      }
      
      if (!isMounted || !isPlayingRef.current) return;

      // 2. 英語を読み上げ
      await speak(currentWord.english, 'en-US');

      if (!isMounted || !isPlayingRef.current) return;
      // 3. 設定された間隔を待機
      await sleep(intervalTime * 1000);

      if (!isMounted || !isPlayingRef.current) return;
      // 4. 裏返す
      setIsFlipped(true);
      await sleep(600); // フリップアニメーション待ち

      if (!isMounted || !isPlayingRef.current) return;
      // 5. 日本語を読み上げ
      await speak(currentWord.meaning, 'ja-JP');

      if (!isMounted || !isPlayingRef.current) return;
      // 6. 設定された間隔を待機
      await sleep(intervalTime * 1000);

      if (!isMounted || !isPlayingRef.current) return;
      // 7. 次のカードへ（最後のカードでなければ）
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        // ボタンの一時非表示（手動と同じエフェクト）
        setShowButtons(false);
        setTimeout(() => setShowButtons(true), 500);
      } else {
        // 最後まで来たら停止
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
  // ↑ intervalTimeを依存配列に入れるとスライダー操作中に再実行されるため外しています


  // --- 手動操作ハンドラ ---
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 手動操作時も自動再生は継続するが、現在の読み上げはリセットされる（useEffectが再発火するため）
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowButtons(false);
      setTimeout(() => setShowButtons(true), 500);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
      setShowButtons(false);
      setTimeout(() => setShowButtons(true), 500);
    }
  };

  const handleFlip = () => {
    // フリップ時は自動再生を止める（ユーザーがじっくり見たいと判断）
    if (isPlaying) setIsPlaying(false);

    setShowButtons(false);
    setTimeout(() => {
      setIsFlipped(!isFlipped);
      setTimeout(() => setShowButtons(true), 150);
    }, 200);
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
    // 手動再生時は自動再生を止める
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
        
        /* スライダーのカスタムスタイル */
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
          
          {/* --- Header Controls (Close & Auto Play) --- */}
          
          {/* Close Button (Right) */}
          <button 
              onClick={() => {
                setIsPlaying(false);
                onClose();
              }}
              className="absolute -top-14 right-0 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors z-50 backdrop-blur-md"
          >
              <i className="fa-solid fa-times"></i>
          </button>

          {/* Auto Play Controls (Left) */}
          <div className="absolute -top-16 left-0 flex flex-col gap-2 z-50">
             <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-lg">
                
                {/* Play/Stop Button */}
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

                {/* Interval Slider */}
                <div className="flex flex-col px-2 w-28">
                  <div className="flex justify-between text-[10px] text-white/80 font-mono mb-1">
                    <span>Speed</span>
                    <span>{intervalTime}s</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.1" 
                    value={intervalTime}
                    onChange={(e) => setIntervalTime(parseFloat(e.target.value))}
                    className="w-full custom-range cursor-pointer"
                  />
                </div>
             </div>
          </div>


          {/* --- Card Container --- */}
          <div 
              className="w-full h-full cursor-pointer"
              style={{ perspective: '1000px' }}
              onClick={handleFlip}
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
                  
                  {/* Audio Button */}
                  {!isFlipped && showButtons && (
                      <button 
                          onClick={(e) => handleManualSpeak(e, currentWord.english, 'en-US')}
                          className="mt-8 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 z-10 fade-in-element active:scale-95 transition-transform"
                      >
                          <i className="fa-solid fa-volume-high"></i>
                      </button>
                  )}

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
                  
                  <p className="absolute bottom-8 text-slate-400 text-sm">Tap to flip</p>
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
                  
                  {/* Audio Button */}
                  {isFlipped && showButtons && (
                      <div className="mt-6 flex gap-4 fade-in-element">
                           <button 
                              onClick={(e) => handleManualSpeak(e, currentWord.meaning, 'ja-JP')}
                              className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors active:scale-95"
                          >
                              <i className="fa-solid fa-volume-high"></i>
                          </button>
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* --- Navigation Buttons (Preserved) --- */}
          <div className="absolute top-1/2 -left-4 sm:-left-16 transform -translate-y-1/2">
              <button 
                  onClick={handlePrev} 
                  disabled={currentIndex === 0}
                  className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"
              >
                  <i className="fa-solid fa-chevron-left"></i>
              </button>
          </div>
          <div className="absolute top-1/2 -right-4 sm:-right-16 transform -translate-y-1/2">
              <button 
                  onClick={handleNext}
                  disabled={currentIndex === words.length - 1}
                  className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all z-40"
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