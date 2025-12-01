// filepath: c:\Users\araih\Desktop\P\App\VocabFlow\vocabflow\src\components\Navbar.tsx
import React from 'react';

interface NavbarProps {
    toggleAddModal: () => void;
    toggleQuizMode: () => void;
    toggleSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ toggleAddModal, toggleQuizMode, toggleSettings }) => {
  return (
    <nav className="sticky top-0 z-50 bg-[#f0f4f8]/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 mb-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-lg">
                <i className="fa-solid fa-layer-group"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-700 tracking-tight">VocabFlow</h1>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={toggleAddModal}
                className="neumorph-btn px-4 py-2 rounded-xl text-sm font-semibold text-indigo-600 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
                <i className="fa-solid fa-plus"></i>
                <span className="hidden sm:inline">Add Word</span>
            </button>
            <button 
                onClick={toggleQuizMode}
                className="neumorph-btn w-10 h-10 rounded-full flex items-center justify-center text-indigo-600 hover:-translate-y-0.5 transition-all"
                title="Start Quiz"
            >
                <i className="fa-solid fa-graduation-cap"></i>
            </button>
            <button 
                onClick={toggleSettings}
                className="neumorph-btn w-10 h-10 rounded-full flex items-center justify-center text-indigo-600 hover:-translate-y-0.5 transition-all"
                title="Settings"
            >
                <i className="fa-solid fa-gear"></i>
            </button>
        </div>
      </div>
    </nav>
  );
};