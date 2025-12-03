import React, { useState, useEffect } from 'react';
import { WordDocument } from '../types';
import { updateWord, updateWordExample, updateWordComment } from '../firebase';

interface WordDetailModalProps {
  word: WordDocument;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedWord: WordDocument) => void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({ word, onClose, onDelete, onUpdate }) => {
  // 表示用のデータをローカルステートで管理 (Optimistic UI用)
  const [currentWord, setCurrentWord] = useState<WordDocument>(word);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<WordDocument>({ 
    ...word, 
    examples: word.examples || [],
    comment: word.comment || ''
  });
  const [loading, setLoading] = useState(false);

  // 親から渡されるwordが変わった場合にステートを同期
  useEffect(() => {
    setCurrentWord(word);
    setEditData({ 
      ...word, 
      examples: word.examples || [],
      comment: word.comment || ''
    });
  }, [word]);

  const handleSave = async () => {
    setLoading(true);
    try {
        // 基本情報の更新
        await updateWord(currentWord.id, editData);
        
        // Examplesの更新
        await updateWordExample(currentWord.id, editData.examples);
        
        // Commentの更新
        await updateWordComment(currentWord.id, editData.comment);
        
        // 保存成功時、即座に表示用ステートを更新
        setCurrentWord(editData);
        
        // 親コンポーネントに更新後の完全なデータを渡す
        onUpdate(editData); 
        
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

  const handleExampleChange = (index: number, field: 'sentence' | 'translation', value: string) => {
    const newExamples = [...(editData.examples || [])];
    newExamples[index] = {
        ...newExamples[index],
        [field]: value
    };
    setEditData(prev => ({ ...prev, examples: newExamples }));
  };

  const handleAddExample = () => {
    setEditData(prev => ({
        ...prev,
        examples: [...(prev.examples || []), { sentence: '', translation: '' }]
    }));
  };

  const handleRemoveExample = (index: number) => {
    const newExamples = [...(editData.examples || [])];
    newExamples.splice(index, 1);
    setEditData(prev => ({ ...prev, examples: newExamples }));
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
                    className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
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
                             <option value="Technology">Technology</option>
                             <option value="Shopping">Shopping</option>
                             <option value="Finance">Finance</option>
                             <option value="Restaurant">Restaurant</option>
                             <option value="Emotions">Emotions</option>
                             <option value="Relationships">Relationships</option>
                             <option value="Nature">Nature</option>
                             <option value="Transportation">Transportation</option>
                             <option value="Science">Science</option>
                             <option value="Other">Other</option>
                         </select>
                     </div>
                 ) : (
                     <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {currentWord.category}
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
                        TOEIC {currentWord.toeicLevel || 'N/A'}
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
                <h2 className="text-4xl font-black text-slate-800 text-center">{currentWord.english}</h2>
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
                    currentWord.partOfSpeech.map((pos, i) => (
                        <span key={i} className="text-slate-400 text-sm font-semibold italic">{pos}</span>
                    ))
                 )}
            </div>

            <button 
                onClick={() => window.open(currentWord.pronunciationURL, '_blank')}
                className="mt-4 neumorph-btn w-10 h-10 rounded-full flex items-center justify-center text-indigo-600"
            >
                <i className="fa-solid fa-volume-high"></i>
            </button>
        </div>

        {/* Status Section (Read Only) */}
        <div className="flex justify-center mb-6">
             <div className="bg-slate-100 rounded-lg p-1 flex">
                <div className={`px-3 py-1 rounded text-xs font-bold ${currentWord.status === 'Beginner' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 opacity-50'}`}>
                    Beginner
                </div>
                <div className={`px-3 py-1 rounded text-xs font-bold ${currentWord.status === 'Training' ? 'bg-white shadow text-blue-600' : 'text-slate-400 opacity-50'}`}>
                    Training
                </div>
                <div className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 ${currentWord.status === 'Mastered' ? 'bg-green-100 text-green-700' : 'text-slate-300 opacity-50'}`}>
                    {currentWord.status === 'Mastered' && <i className="fa-solid fa-check"></i>} Mastered
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
                    <p className="text-2xl font-bold text-slate-700">{currentWord.meaning}</p>
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
                    <p className="text-slate-600 leading-relaxed">{currentWord.coreImage}</p>
                )}
            </div>

            {/* Examples Section */}
            {(currentWord.examples && currentWord.examples.length > 0) || isEditing ? (
                <div>
                      <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Examples</h3>
                        {isEditing && (
                            <button 
                                onClick={handleAddExample}
                                className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 font-bold"
                            >
                                <i className="fa-solid fa-plus mr-1"></i> Add
                            </button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {isEditing ? (
                            (editData.examples || []).map((ex, index) => (
                                <div key={index} className="border border-indigo-200 rounded p-3 bg-white relative group">
                                    <button 
                                        onClick={() => handleRemoveExample(index)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-400"
                                        title="Remove example"
                                    >
                                        <i className="fa-solid fa-times-circle"></i>
                                    </button>
                                    
                                    <div className="mb-2">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Sentence</label>
                                        <input 
                                            className="w-full border-b border-slate-100 outline-none text-sm text-slate-800" 
                                            placeholder="English Sentence"
                                            value={ex.sentence}
                                            onChange={(e) => handleExampleChange(index, 'sentence', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Translation</label>
                                        <input 
                                            className="w-full outline-none text-xs text-slate-500" 
                                            placeholder="Japanese Translation"
                                            value={ex.translation}
                                            onChange={(e) => handleExampleChange(index, 'translation', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            currentWord.examples && currentWord.examples.map((ex, i) => (
                                <div key={i} className="border-l-4 border-indigo-200 pl-4 py-1">
                                    <p className="text-slate-800 font-medium mb-1">{ex.sentence}</p>
                                    <p className="text-slate-500 text-sm">{ex.translation}</p>
                                </div>
                            ))
                        )}
                        {isEditing && (!editData.examples || editData.examples.length === 0) && (
                            <p className="text-center text-slate-400 text-xs py-4 border border-dashed border-slate-300 rounded">
                                No examples yet. Click "Add" to create one.
                            </p>
                        )}
                      </div>
                </div>
            ) : null}

            {/* Comment Section */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <i className="fa-solid fa-comment mr-2"></i>Comment / Notes
                </h3>
                {isEditing ? (
                    <textarea 
                        className="w-full bg-transparent border border-indigo-200 outline-none text-slate-600 rounded p-2"
                        rows={4}
                        value={editData.comment || ''}
                        onChange={(e) => handleChange('comment', e.target.value)}
                        placeholder="Add your personal notes, tips, or reminders here..."
                    />
                ) : (
                    <p className="text-slate-600 leading-relaxed">
                        {currentWord.comment || <span className="text-slate-400 italic">No comments yet</span>}
                    </p>
                )}
            </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between">
            <span className="text-xs text-slate-400">Added on {currentWord.createdAt?.seconds ? new Date(currentWord.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
            <button 
                onClick={() => {
                    if(window.confirm('Are you sure you want to delete this word?')) {
                        onDelete(currentWord.id);
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