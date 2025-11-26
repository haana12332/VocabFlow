import React, { useState } from 'react';
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

  const currentWord = words[currentIndex];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
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

  if (!currentWord) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-square">
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors z-50"
        >
            <i className="fa-solid fa-times"></i>
        </button>

        {/* Card Container */}
        <div 
            className="w-full h-full perspective-1000 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`} 
               style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            
            {/* Front */}
            <div className="absolute w-full h-full bg-[#f0f4f8] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden"
                 style={{ backfaceVisibility: 'hidden' }}>
                <span className="text-indigo-500 font-bold tracking-widest text-sm mb-4 uppercase">{currentWord.category}</span>
                <h2 className="text-5xl font-black text-slate-800 mb-6 text-center">{currentWord.english}</h2>
                <div className="flex gap-2">
                    {currentWord.partOfSpeech.map((pos, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">{pos}</span>
                    ))}
                </div>
                {/* Audio Button on Front */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        window.open(currentWord.pronunciationURL, '_blank');
                    }}
                    className="mt-8 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 z-10"
                >
                    <i className="fa-solid fa-volume-high"></i>
                </button>

                {/* Status Toggle on Front */}
                <div className="absolute top-6 left-6 flex flex-col gap-2 z-20">
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
                            Promote to Training
                        </button>
                    )}
                    {currentWord.status === 'Training' && (
                        <button 
                             onClick={(e) => toggleStatus(e, 'Beginner')}
                             className="bg-gray-400 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-gray-500 transition-colors"
                        >
                            Demote to Beginner
                        </button>
                    )}
                    {currentWord.status === 'Mastered' && (
                        <button 
                             onClick={(e) => toggleStatus(e, 'Training')}
                             className="bg-blue-500 text-white text-xs px-3 py-2 rounded-lg shadow hover:bg-blue-600 transition-colors"
                        >
                            Demote to Training
                        </button>
                    )}
                </div>

                <p className="absolute bottom-8 text-slate-400 text-sm">Tap to flip</p>
            </div>

            {/* Back */}
            <div className="absolute w-full h-full bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden text-white rotate-y-180"
                 style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <h3 className="text-3xl font-bold mb-4 text-center">{currentWord.meaning}</h3>
                <div className="w-16 h-1 bg-indigo-500 rounded-full mb-6"></div>
                <p className="text-center text-slate-300 italic mb-6">"{currentWord.coreImage}"</p>
                {currentWord.examples?.[0] && (
                    <div className="bg-slate-700/50 p-4 rounded-xl text-sm">
                        <p className="text-indigo-300 mb-1">{currentWord.examples[0].sentence}</p>
                        <p className="text-slate-400">{currentWord.examples[0].translation}</p>
                    </div>
                )}
                <div className="mt-6 flex gap-4">
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(currentWord.pronunciationURL, '_blank');
                        }}
                        className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors"
                    >
                        <i className="fa-solid fa-volume-high"></i>
                    </button>
                </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="absolute top-1/2 -left-4 sm:-left-16 transform -translate-y-1/2">
            <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all"
            >
                <i className="fa-solid fa-chevron-left"></i>
            </button>
        </div>
        <div className="absolute top-1/2 -right-4 sm:-right-16 transform -translate-y-1/2">
            <button 
                onClick={handleNext}
                disabled={currentIndex === words.length - 1}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 disabled:opacity-50 hover:scale-110 transition-all"
            >
                <i className="fa-solid fa-chevron-right"></i>
            </button>
        </div>
        
        <div className="absolute -bottom-10 w-full flex justify-center text-white/80 font-mono">
            {currentIndex + 1} / {words.length}
        </div>
      </div>
    </div>
  );
};