import React, { useState } from 'react';
import { FilterModal } from './FilterModal'; // 分割されたファイルをインポート

// バッジコンポーネント（変更なし）
const ActiveFilterBadge = ({ label, onClear }: { label: string; onClear: () => void }) => (
  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold whitespace-nowrap animate-in zoom-in-50 duration-200">
    {label}
    <button onClick={onClear} className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-indigo-200 transition-colors">
      <i className="fa-solid fa-times text-[8px]"></i>
    </button>
  </span>
);

interface FilterBarProps {
  // App.tsx から渡されるProps
  category: string; setCategory: (v: string) => void; categoryOptions: string[];
  status: string; setStatus: (v: string) => void;
  pos: string; setPos: (v: string) => void; posOptions: string[];
  toeic: string; setToeic: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  indexFrom: string; setIndexFrom: (v: string) => void;
  indexTo: string; setIndexTo: (v: string) => void;
  onResetAll: () => void;
  isAnyFilterActive: boolean;
}

export const FilterBar = (props: FilterBarProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="w-full">
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className={`flex items-center gap-2 px-5 h-10 rounded-xl font-bold text-xs transition-all flex-shrink-0 shadow-sm ${props.isAnyFilterActive ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                    <i className="fa-solid fa-sliders"></i>
                    <span>Filters</span>
                    {props.isAnyFilterActive && <span className="w-2 h-2 rounded-full bg-white ml-1 animate-pulse"></span>}
                </button>

                {/* Badges */}
                {props.category !== 'All' && <ActiveFilterBadge label={props.category} onClear={() => props.setCategory('All')} />}
                {props.status !== 'All' && <ActiveFilterBadge label={props.status} onClear={() => props.setStatus('All')} />}
                {props.pos !== 'All' && <ActiveFilterBadge label={props.pos} onClear={() => props.setPos('All')} />}
                {props.toeic !== 'All' && <ActiveFilterBadge label={`TOEIC > ${props.toeic}`} onClear={() => props.setToeic('All')} />}
                {(props.dateFrom || props.dateTo) && <ActiveFilterBadge label="Date Range" onClear={() => { props.setDateFrom(''); props.setDateTo(''); }} />}
                {(props.indexFrom || props.indexTo) && <ActiveFilterBadge label="Index Range" onClear={() => { props.setIndexFrom(''); props.setIndexTo(''); }} />}
                
                {props.isAnyFilterActive && (
                    <button onClick={props.onResetAll} className="text-[10px] font-bold text-slate-400 hover:text-red-500 underline ml-auto px-2 whitespace-nowrap">
                        Clear All
                    </button>
                )}
            </div>
        </div>
      </div>

      {isModalOpen && (
        <FilterModal onClose={() => setIsModalOpen(false)} {...props} />
      )}
    </>
  );
};