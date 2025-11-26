import React from 'react';
import { WordDocument } from '../types';

interface WordCardProps {
  word: WordDocument;
  onClick: (word: WordDocument) => void;
}

export const WordCard: React.FC<WordCardProps> = ({ word, onClick }) => {
  return (
    <div 
        onClick={() => onClick(word)}
        className="neumorph-btn rounded-xl p-4 cursor-pointer flex flex-col justify-between h-full group hover:scale-[1.02] transition-transform"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-slate-800">{word.english}</h3>
        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider 
            ${word.status === 'Mastered' ? 'text-green-600 bg-green-100' : 
              word.status === 'Training' ? 'text-blue-600 bg-blue-100' : 'text-gray-500 bg-gray-200'}`}>
            {word.status}
        </span>
      </div>
      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{word.meaning}</p>
      
      <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-200/50">
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{word.category}</span>
        <button 
            className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-colors"
            onClick={(e) => {
                e.stopPropagation();
                window.open(word.pronunciationURL, '_blank');
            }}
        >
            <i className="fa-solid fa-volume-high text-xs"></i>
        </button>
      </div>
    </div>
  );
};
