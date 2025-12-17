import React from 'react';

export const MilestoneCard = ({ count }: { count: number }) => {
  return (
    <div className="relative group h-full rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-amber-100 to-orange-50 border-2 border-amber-200 shadow-sm hover:shadow-md">
      
      {/* キラキラ装飾 (位置調整) */}
      <div className="absolute top-2 right-2 text-amber-300 animate-pulse">
        <i className="fa-solid fa-star text-xs"></i>
      </div>
      <div className="absolute bottom-2 left-2 text-amber-300 animate-pulse delay-700">
        <i className="fa-solid fa-star text-[10px]"></i>
      </div>

      {/* アイコン (サイズ縮小: 56px -> 40px) */}
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 ring-2 ring-amber-100">
        <i className="fa-solid fa-trophy text-lg text-amber-500 drop-shadow-sm"></i>
      </div>

      {/* テキスト (行間とマージンを詰める) */}
      <h3 className="text-lg font-extrabold text-amber-600 leading-tight">
        {count} Words!
      </h3>
      <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-2">
        Great Job
      </p>
      
      {/* バッジ (パディング縮小) */}
      <div className="px-2 py-0.5 bg-white/60 rounded-full text-[9px] font-bold text-amber-600">
        Keep going!
      </div>
    </div>
  );
};