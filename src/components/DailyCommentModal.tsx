import React, { useState, useEffect } from 'react';
import { getDailyComment, saveDailyComment, getDailyCommentHistory } from '../firebase';

interface DailyCommentModalProps {
  onClose: () => void;
  userId: string;
}

interface CommentHistory {
  id: string;
  date: string;
  content: string;
}

export const DailyCommentModal: React.FC<DailyCommentModalProps> = ({ onClose, userId }) => {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [history, setHistory] = useState<CommentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  
  const displayDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Load today's comment
  useEffect(() => {
    const loadComment = async () => {
      setLoading(true);
      try {
        const savedComment = await getDailyComment(userId, today);
        setComment(savedComment);
      } catch (error) {
        console.error("Failed to load comment", error);
      } finally {
        setLoading(false);
      }
    };
    loadComment();
  }, [userId, today]);

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await getDailyCommentHistory(userId);
        setHistory(data.map(item => ({
            id: item.id,
            date: item.date,
            content: item.content
        })));
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDailyComment(userId, today, comment);
      
      const newEntry = { id: today, date: today, content: comment };
      setHistory(prev => {
        const exists = prev.some(h => h.date === today);
        if (exists) {
            return prev.map(h => h.date === today ? newEntry : h);
        } else {
            return [newEntry, ...prev];
        }
      });
      
      onClose();
    } catch (error) {
      console.error("Failed to save comment", error);
      alert("Failed to save comment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Container with neumorph-flat style aligned with QuizModal */}
      <div className="neumorph-flat w-full max-w-lg rounded-2xl p-8 relative flex flex-col max-h-[85vh]">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10">
            <i className="fa-solid fa-times text-lg"></i>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6 flex-shrink-0">
            {/* Icon styled similar to the provided images */}
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl mb-3 shadow-sm">
                <i className="fa-solid fa-pen-to-square"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center">Daily Journal</h2>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{displayDate}</p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-6">
            {loading ? (
                <div className="flex justify-center py-12">
                    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-400"></i>
                </div>
            ) : (
                <>
                    {/* Input Section */}
                    <div className="space-y-4">
                        <textarea 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Write your thoughts, learning progress, or memo for today..."
                            className="w-full h-40 neumorph-pressed rounded-2xl border-none p-4 text-slate-700 bg-[#f0f4f8] placeholder:text-slate-400 outline-none resize-none transition-all text-base leading-relaxed"
                            autoFocus
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={onClose}
                                className="neumorph-btn py-3 rounded-xl text-slate-500 font-bold hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="neumorph-btn py-3 rounded-xl text-indigo-600 font-bold hover:text-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                                Save Journal
                            </button>
                        </div>
                    </div>

                    {/* Past Entries Section */}
                    <div className="border-t border-slate-200 pt-6">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-clock-rotate-left"></i> Past Entries
                        </h3>
                        
                        {loadingHistory ? (
                            <div className="text-center text-slate-400 py-6 text-sm">Loading...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-slate-400 text-sm font-bold">No journal entries yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <div key={item.id} className="neumorph-flat rounded-xl p-4 relative group">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                    {item.date}
                                                </span>
                                                {item.date === today && (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md uppercase tracking-wider">
                                                        Today
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap pl-1">
                                            {item.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};