import React, { useState } from 'react';
import { WordDocument } from '../types';
import { updateWord } from '../firebase';

interface WordDetailModalProps {
  word: WordDocument;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: () => void; // Callback to refresh parent
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({ word, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<WordDocument>({ ...word });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
        await updateWord(word.id, editData);
        onUpdate();
        setIsEditing(false);
    } catch (e) {
        console.error("Failed to update", e);
        alert("Failed to update word.");
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (field: keyof WordDocument, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-8 relative animate-slide-up sm:animate-none max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 z-10">
            <i className="fa-solid fa-times"></i>
        </button>

        {isEditing ? (
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-700">Edit Word</h2>
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                    {loading ? "Saving..." : "Save Changes"}
                </button>
             </div>
        ) : (
            <div className="absolute top-4 left-4">
                <button 
                    onClick={() => setIsEditing(true)}
                    className="text-slate-400 hover:text-indigo-600 font-semibold text-sm flex items-center gap-1"
                >
                    <i className="fa-solid fa-pen"></i> Edit
                </button>
            </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col items-center mb-6 mt-6">
            <div className="flex gap-2 mb-3">
                 {isEditing ? (
                     <div className="flex flex-col gap-2">
                         <label className="text-[10px] text-slate-400 uppercase font-bold text-center">Category</label>
                         <select 
                             value={editData.category} 
                             onChange={(e) => handleChange('category', e.target.value)}
                             className="text-xs bg-indigo-50 px-2 py-1 rounded border border-indigo-100 text-indigo-700 outline-none"
                         >
                             <option value="Daily">Daily</option>
                             <option value="Business">Business</option>
                             <option value="Academic">Academic</option>
                             <option value="Academic">Technology</option>
                             <option value="Academic">Shopping</option>
                             <option value="Academic">Finance</option>
                             <option value="Academic">Restaurant</option>
                             <option value="Academic">Emotions</option>
                             <option value="Academic">Relationships</option>
                             <option value="Academic">Nature</option>
                             <option value="Academic">Transportation</option>
                             <option value="Academic">Science</option>
                             <option value="Academic">other</option>
                         </select>
                     </div>
                 ) : (
                     <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {word.category}
                     </span>
                 )}
                 {isEditing ? (
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-slate-400 uppercase font-bold text-center">TOEIC</label>
                        <input 
                            type="number"
                            value={editData.toeicLevel || ''}
                            onChange={(e) => handleChange('toeicLevel', Number(e.target.value))}
                            className="w-20 text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 text-center"
                        />
                     </div>
                 ) : (
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        TOEIC {word.toeicLevel || 'N/A'}
                     </span>
                 )}
            </div>

            {isEditing ? (
                <input 
                    type="text"
                    value={editData.english}
                    onChange={(e) => handleChange('english', e.target.value)}
                    className="text-3xl font-black text-slate-800 text-center border-b-2 border-indigo-200 outline-none w-full"
                />
            ) : (
                <h2 className="text-4xl font-black text-slate-800 text-center">{word.english}</h2>
            )}

            <div className="flex gap-2 mt-2 items-center">
                 {isEditing ? (
                    <input 
                        type="text"
                        value={editData.partOfSpeech.join(', ')}
                        onChange={(e) => handleChange('partOfSpeech', e.target.value.split(',').map(s=>s.trim()))}
                        className="text-sm text-center text-slate-400 border-b border-slate-200 outline-none w-full"
                        placeholder="Noun, Verb"
                    />
                 ) : (
                    word.partOfSpeech.map((pos, i) => (
                        <span key={i} className="text-slate-400 text-sm font-semibold italic">{pos}</span>
                    ))
                 )}
            </div>

            <button 
                onClick={() => window.open(word.pronunciationURL, '_blank')}
                className="mt-4 neumorph-btn w-10 h-10 rounded-full flex items-center justify-center text-indigo-600"
            >
                <i className="fa-solid fa-volume-high"></i>
            </button>
        </div>

        {/* Status Section (Read Only) */}
        <div className="flex justify-center mb-6">
             <div className="bg-slate-100 rounded-lg p-1 flex">
                <div 
                    className={`px-3 py-1 rounded text-xs font-bold ${word.status === 'Beginner' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 opacity-50'}`}
                >
                    Beginner
                </div>
                <div 
                    className={`px-3 py-1 rounded text-xs font-bold ${word.status === 'Training' ? 'bg-white shadow text-blue-600' : 'text-slate-400 opacity-50'}`}
                >
                    Training
                </div>
                <div 
                    className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${word.status === 'Mastered' ? 'bg-green-100 text-green-700' : 'text-slate-300 opacity-50'}`}
                >
                    {word.status === 'Mastered' && <i className="fa-solid fa-check"></i>} Mastered
                </div>
             </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mb-6 bg-slate-50 py-2 rounded">
            <i className="fa-solid fa-info-circle mr-1"></i> 
            Status can only be changed in <strong>Flashcards</strong> or via <strong>AI Quiz</strong>.
        </p>


        <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Meaning</h3>
                {isEditing ? (
                    <input 
                        className="w-full bg-transparent border-b border-indigo-200 outline-none text-xl font-bold text-slate-700"
                        value={editData.meaning}
                        onChange={(e) => handleChange('meaning', e.target.value)}
                    />
                ) : (
                    <p className="text-2xl font-bold text-slate-700">{word.meaning}</p>
                )}
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Core Image / Etymology</h3>
                {isEditing ? (
                    <textarea 
                        className="w-full bg-transparent border border-indigo-200 outline-none text-slate-600 rounded p-2"
                        rows={3}
                        value={editData.coreImage}
                        onChange={(e) => handleChange('coreImage', e.target.value)}
                    />
                ) : (
                    <p className="text-slate-600 leading-relaxed">{word.coreImage}</p>
                )}
            </div>

            {(word.examples && word.examples.length > 0) || isEditing ? (
                <div>
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Examples</h3>
                     <div className="space-y-3">
                        {isEditing ? (
                            <div className="border border-indigo-200 rounded p-2 bg-white">
                                <input 
                                    className="w-full border-b border-slate-100 mb-1 outline-none text-sm" 
                                    placeholder="English Sentence"
                                    value={editData.examples?.[0]?.sentence || ''}
                                    onChange={(e) => {
                                        const newEx = [...(editData.examples || [])];
                                        if(!newEx[0]) newEx[0] = { sentence: '', translation: '' };
                                        newEx[0].sentence = e.target.value;
                                        handleChange('examples', newEx);
                                    }}
                                />
                                <input 
                                    className="w-full outline-none text-xs text-slate-500" 
                                    placeholder="Japanese Translation"
                                    value={editData.examples?.[0]?.translation || ''}
                                    onChange={(e) => {
                                        const newEx = [...(editData.examples || [])];
                                        if(!newEx[0]) newEx[0] = { sentence: '', translation: '' };
                                        newEx[0].translation = e.target.value;
                                        handleChange('examples', newEx);
                                    }}
                                />
                            </div>
                        ) : (
                            word.examples.map((ex, i) => (
                                <div key={i} className="border-l-4 border-indigo-200 pl-4 py-1">
                                    <p className="text-slate-800 font-medium mb-1">{ex.sentence}</p>
                                    <p className="text-slate-500 text-sm">{ex.translation}</p>
                                </div>
                            ))
                        )}
                     </div>
                </div>
            ) : null}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between">
            <span className="text-xs text-slate-400">Added on {new Date(word.createdAt.seconds * 1000).toLocaleDateString()}</span>
            <button 
                onClick={() => {
                    if(window.confirm('Are you sure you want to delete this word?')) {
                        onDelete(word.id);
                        onClose();
                    }
                }}
                className="text-red-400 hover:text-red-600 text-sm font-bold"
            >
                <i className="fa-solid fa-trash mr-1"></i> Delete Word
            </button>
        </div>
      </div>
    </div>
  );
};