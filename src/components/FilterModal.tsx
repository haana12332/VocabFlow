import React, { useState, useEffect } from 'react';

// ==========================================
// 1. 内部コンポーネント: FilterModal
// ==========================================

interface FilterModalProps {
  onClose: () => void;
  // Category State
  category: string; setCategory: (v: string) => void; categoryOptions: string[];
  // Status State
  status: string; setStatus: (v: string) => void;
  // POS State
  pos: string; setPos: (v: string) => void; posOptions: string[];
  // TOEIC State
  toeic: string; setToeic: (v: string) => void;
  // Date State
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  // Index State
  indexFrom: string; setIndexFrom: (v: string) => void;
  indexTo: string; setIndexTo: (v: string) => void;
  // Reset
  onResetAll: () => void;
}

export const  FilterModal = (props: FilterModalProps) => {
  // 背景スクロール固定
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // 共通のセクションタイトル
  const SectionTitle = ({ icon, label }: { icon: string; label: string }) => (
    <div className="flex items-center gap-2 mb-3 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-1">
      <i className={`fa-solid ${icon}`}></i> {label}
    </div>
  );

  // 選択チップ（ボタン）
  const SelectChip = ({ 
    label, isActive, onClick 
  }: { label: string; isActive: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg text-xs font-bold transition-all border
        ${isActive 
          ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-500'
        }
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
      {/* モーダル本体 */}
      <div className="bg-white w-full md:w-[600px] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] animate-in slide-in-from-bottom-10 duration-300">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <i className="fa-solid fa-sliders text-indigo-500"></i> Filters
          </h2>
          <button 
            onClick={props.onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* コンテンツ (スクロール可能) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          
          {/* Status & TOEIC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <SectionTitle icon="fa-chart-simple" label="Proficiency" />
              <div className="flex flex-wrap gap-2">
                {['All', 'Beginner', 'Training', 'Mastered'].map(opt => (
                  <SelectChip key={opt} label={opt} isActive={props.status === opt} onClick={() => props.setStatus(opt)} />
                ))}
              </div>
            </div>
            <div>
              <SectionTitle icon="fa-award" label="TOEIC Score" />
              <div className="flex flex-wrap gap-2">
                <SelectChip label="All" isActive={props.toeic === 'All'} onClick={() => props.setToeic('All')} />
                {['400', '600', '730', '860'].map(score => (
                   <SelectChip key={score} label={`Over ${score}`} isActive={props.toeic === score} onClick={() => props.setToeic(score)} />
                ))}
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <SectionTitle icon="fa-layer-group" label="Category" />
            <div className="flex flex-wrap gap-2">
               <SelectChip label="All" isActive={props.category === 'All'} onClick={() => props.setCategory('All')} />
               {props.categoryOptions.map(opt => (
                  <SelectChip key={opt} label={opt} isActive={props.category === opt} onClick={() => props.setCategory(opt)} />
               ))}
            </div>
          </div>

          {/* Part of Speech */}
          <div>
            <SectionTitle icon="fa-shapes" label="Part of Speech" />
            <div className="flex flex-wrap gap-2">
               <SelectChip label="All" isActive={props.pos === 'All'} onClick={() => props.setPos('All')} />
               {props.posOptions.map(opt => (
                  <SelectChip key={opt} label={opt} isActive={props.pos === opt} onClick={() => props.setPos(opt)} />
               ))}
            </div>
          </div>

          {/* ★修正箇所: Date & Range を縦並び(flex-col)に変更して幅を確保 */}
          <div className="flex flex-col gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {/* Date */}
            <div className="flex flex-col gap-2">
               <SectionTitle icon="fa-calendar-days" label="Date Added" />
               <div className="flex items-center gap-2">
                  <input type="date" value={props.dateFrom} onChange={(e) => props.setDateFrom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-slate-400">~</span>
                  <input type="date" value={props.dateTo} onChange={(e) => props.setDateTo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" />
               </div>
            </div>
            
            <div className="h-px bg-slate-200 w-full" /> {/* 区切り線を追加 */}

            {/* Range */}
            <div className="flex flex-col gap-2">
               <SectionTitle icon="fa-list-ol" label="Word Index (#)" />
               <div className="flex items-center gap-2">
                  <input type="number" placeholder="1" min="1" value={props.indexFrom} onChange={(e) => props.setIndexFrom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-slate-400">~</span>
                  <input type="number" placeholder="End" min="1" value={props.indexTo} onChange={(e) => props.setIndexTo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" />
               </div>
            </div>
          </div>

        </div>

        {/* フッター */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white md:rounded-b-3xl">
          <button onClick={props.onResetAll} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-2 px-2 py-2 transition-colors">
            <i className="fa-solid fa-rotate-left"></i> Reset All
          </button>
          <button onClick={props.onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
            Show Results
          </button>
        </div>
      </div>
    </div>
  );
};


