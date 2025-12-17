import React, { useState, useRef, useEffect } from 'react';

// ソートオプションの定義
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', icon: 'fa-calendar-check', group: 'Date' },
  { value: 'oldest', label: 'Oldest First', icon: 'fa-history', group: 'Date' },
  { value: 'a-z', label: 'A to Z', icon: 'fa-arrow-down-a-z', group: 'Alphabet' },
  { value: 'z-a', label: 'Z to A', icon: 'fa-arrow-down-z-a', group: 'Alphabet' },
  { value: 'toeic-high', label: 'TOEIC High', icon: 'fa-arrow-trend-up', group: 'Score' },
  { value: 'toeic-low', label: 'TOEIC Low', icon: 'fa-arrow-trend-down', group: 'Score' },
];

interface SortDropdownProps {
  value: string;
  onChange: (value: any) => void;
}

export const SortDropdown = ({ value, onChange }: SortDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 現在選択されているオプションを取得
  const currentOption = SORT_OPTIONS.find(opt => opt.value === value) || SORT_OPTIONS[0];

  // 外側クリックで閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* トリガーボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-3 px-4 h-12 rounded-2xl transition-all duration-200
          text-sm font-bold text-slate-600 outline-none w-full md:w-52
          ${isOpen 
            ? 'bg-white shadow-inner ring-2 ring-indigo-100 text-indigo-600' 
            : 'neumorph-btn hover:text-indigo-600'
          }
        `}
      >
        <div className="flex items-center gap-2">
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center transition-colors
            ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}
          `}>
            <i className={`fa-solid ${currentOption.icon} text-[10px]`}></i>
          </div>
          <span>{currentOption.label}</span>
        </div>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : 'text-slate-400'}`}></i>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="py-2">
            {/* グループごとにマッピング（簡易実装のためフラットに表示しますが、ロジックで区切り線を入れることも可能） */}
            {SORT_OPTIONS.map((option, index) => {
              // グループの変わり目に区切り線を入れる
              const isNewGroup = index > 0 && SORT_OPTIONS[index - 1].group !== option.group;
              const isSelected = value === option.value;

              return (
                <React.Fragment key={option.value}>
                  {isNewGroup && <div className="h-px bg-slate-100 my-1 mx-3" />}
                  
                  <button
                    onClick={() => handleSelect(option.value)}
                    className={`
                      w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs font-bold transition-colors
                      ${isSelected 
                        ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-500' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-500 border-l-4 border-transparent'
                      }
                    `}
                  >
                    <i className={`fa-solid ${option.icon} w-4 text-center ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}></i>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-[9px] font-normal text-slate-400 uppercase tracking-wider">{option.group}</span>
                    </div>
                    {isSelected && <i className="fa-solid fa-check ml-auto text-indigo-500"></i>}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};