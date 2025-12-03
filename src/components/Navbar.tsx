import React from 'react';

interface NavbarProps {
  toggleQuizMode: () => void;
  toggleAddModal: () => void;
  toggleSettings: () => void;
  toggleDailyComment: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ toggleQuizMode, toggleAddModal, toggleSettings, toggleDailyComment }) => {
  return (
    <nav className=" backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-indigo-200 shadow-lg">
            V
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">VocabFlow</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleQuizMode}
            className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
            title="AI Quiz"
          >
            <i className="fa-solid fa-robot"></i>
          </button>
          
          <button 
            onClick={toggleDailyComment}
            className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
            title="Daily Journal"
          >
            <i className="fa-regular fa-comment-dots"></i>
          </button>

          <button 
            onClick={toggleAddModal}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <i className="fa-solid fa-plus"></i>
            <span className="hidden sm:inline">Add Word</span>
          </button>

          <button 
            onClick={toggleSettings}
            className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};