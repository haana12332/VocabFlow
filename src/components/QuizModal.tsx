import React, { useState, useEffect, useRef } from 'react';
import { QuizMode, WordDocument, ChatMessage } from '../types';
import { createQuizChat } from '../services/geminiService';
import { updateWordStatus } from '../firebase';

interface QuizModalProps {
    words: WordDocument[];
    onClose: () => void;
    onUpdate?: () => void; // Callback to refresh data
}

interface QuizConfig {
    numQuestions: number;
    toeicLevel: string; // 'All' or specific levels
    partOfSpeech: string;
    category: string;
    status: string; // 'All', 'Beginner', 'Training', 'Mastered'
}

export const QuizModal: React.FC<QuizModalProps> = ({ words, onClose, onUpdate }) => {
    const [mode, setMode] = useState<QuizMode>(QuizMode.CONFIG);
    const [filteredWords, setFilteredWords] = useState<WordDocument[]>([]);
    
    // Config State
    const [config, setConfig] = useState<QuizConfig>({
        numQuestions: 5,
        toeicLevel: 'All',
        partOfSpeech: 'All',
        category: 'All',
        status: 'All'
    });

    // AI Chat State
    const [chatSession, setChatSession] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [correctWordId, setCorrectWordId] = useState<string | null>(null);
    const [upgrading, setUpgrading] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Standard Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    // Helpers for Select Options
    const categories = Array.from(new Set(words.map(w => w.category)));
    const partsOfSpeech = Array.from(new Set(words.flatMap(w => w.partOfSpeech)));
    
    const startQuiz = (selectedMode: QuizMode) => {
        // Filter Words
        let filtered = words.filter(w => {
            if (config.status !== 'All' && w.status !== config.status) return false;
            if (config.category !== 'All' && w.category !== config.category) return false;
            if (config.partOfSpeech !== 'All' && !w.partOfSpeech.includes(config.partOfSpeech)) return false;
            if (config.toeicLevel !== 'All') {
                 const level = parseInt(config.toeicLevel);
                 if (w.toeicLevel < level) return false;
            }
            return true;
        });

        // Shuffle and Limit
        filtered = filtered.sort(() => 0.5 - Math.random()).slice(0, config.numQuestions);

        if (filtered.length === 0) {
            alert("No words match your criteria. Please adjust filters.");
            return;
        }

        setFilteredWords(filtered);
        setMode(selectedMode);

        if (selectedMode === QuizMode.AI_CHAT) {
            const chat = createQuizChat(filtered);
            setChatSession(chat);
            // Instead of auto-starting, we ask the user what they want
            setMessages([{ 
                role: 'model', 
                text: "Hello! I am ready to quiz you. What kind of quiz would you like? (e.g., 'TOEIC 800 grammar' or 'Vocabulary check')" 
            }]);
        }
    };

    // Chat Functions
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 修正: ストリーミング対応版 handleSendMessage
    const handleSendMessage = async () => {
        if (!input.trim() || !chatSession) return;
        
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);
        setCorrectWordId(null); // Reset detection

        try {
            // AI応答用のプレースホルダーを追加
            setMessages(prev => [...prev, { role: 'model', text: "" }]);

            // ストリーミング送信
            const result = await chatSession.sendMessageStream(userMsg);
            
            let fullText = "";
            
            // ストリームチャンクをループ処理
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;

                setMessages(prev => {
                    const newMessages = [...prev];
                    // 最後のメッセージ（モデルの応答）を更新
                    newMessages[newMessages.length - 1] = {
                        role: 'model',
                        text: fullText
                    };
                    return newMessages;
                });
            }

            // --- 完了後の判定ロジック ---
            let isCorrect = false;
            
            // Match for word in brackets [word]
            const match = fullText.match(/\[(.*?)\]/);
            const foundWord = match && match[1] 
                ? words.find(w => w.english.toLowerCase() === match[1].toLowerCase()) 
                : null;

            if (fullText.includes('【正解】')) {
                isCorrect = true;
                if (foundWord) setCorrectWordId(foundWord.id);
            } else if (fullText.includes('【不正解】')) {
                // Logic: If user mistakes a Mastered word, downgrade it to Training
                if (foundWord && foundWord.status === 'Mastered') {
                    await updateWordStatus(foundWord.id, 'Training');
                    setToastMsg(`Oops! '${foundWord.english}' downgraded to Training.`);
                    setTimeout(() => setToastMsg(null), 3000);
                    if (onUpdate) onUpdate();
                }
            }

            // 最終的な状態を更新（isCorrectフラグを追加）
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                    role: 'model',
                    text: fullText,
                    isCorrect: isCorrect
                };
                return newMessages;
            });

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', text: "Error connecting to Gemini." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleMasteryUpgrade = async (wordId: string) => {
        setUpgrading(true);
        try {
            await updateWordStatus(wordId, 'Mastered');
            if (onUpdate) {
                onUpdate(); // Trigger refresh in App.tsx
            }
            alert("Success! Word status updated to Mastered.");
            setCorrectWordId(null);
        } catch (e) {
            console.error("Update failed", e);
            alert("Failed to update status. Please try again.");
        } finally {
            setUpgrading(false);
        }
    };

    // Configuration Screen
    if (mode === QuizMode.CONFIG) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="neumorph-flat w-full max-w-lg rounded-2xl p-8 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><i className="fa-solid fa-times"></i></button>
                    <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Quiz Setup</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Number of Questions <span className="text-red-400">*</span></label>
                            <select 
                                value={config.numQuestions}
                                onChange={e => setConfig({...config, numQuestions: Number(e.target.value)})}
                                className="w-full neumorph-pressed rounded-xl p-3 text-slate-700 bg-transparent outline-none"
                            >
                                <option value="5">5 Questions</option>
                                <option value="10">10 Questions</option>
                                <option value="20">20 Questions</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">TOEIC Level (Min)</label>
                                <select 
                                    value={config.toeicLevel}
                                    onChange={e => setConfig({...config, toeicLevel: e.target.value})}
                                    className="w-full neumorph-pressed rounded-xl p-3 text-slate-700 bg-transparent outline-none"
                                >
                                    <option value="All">Any Level</option>
                                    <option value="400">400+</option>
                                    <option value="600">600+</option>
                                    <option value="730">730+</option>
                                    <option value="860">860+</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                                <select 
                                    value={config.status}
                                    onChange={e => setConfig({...config, status: e.target.value})}
                                    className="w-full neumorph-pressed rounded-xl p-3 text-slate-700 bg-transparent outline-none"
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Beginner">Beginner</option>
                                    <option value="Training">Training</option>
                                    <option value="Mastered">Mastered</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                                <select 
                                    value={config.category}
                                    onChange={e => setConfig({...config, category: e.target.value})}
                                    className="w-full neumorph-pressed rounded-xl p-3 text-slate-700 bg-transparent outline-none"
                                >
                                    <option value="All">All Categories</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Part of Speech</label>
                                <select 
                                    value={config.partOfSpeech}
                                    onChange={e => setConfig({...config, partOfSpeech: e.target.value})}
                                    className="w-full neumorph-pressed rounded-xl p-3 text-slate-700 bg-transparent outline-none"
                                >
                                    <option value="All">All POS</option>
                                    {partsOfSpeech.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => startQuiz(QuizMode.STANDARD)}
                            className="neumorph-btn py-3 rounded-xl text-indigo-600 font-bold flex flex-col items-center justify-center hover:bg-indigo-50"
                        >
                             <i className="fa-solid fa-layer-group mb-1"></i> Standard Quiz
                        </button>
                        <button 
                            onClick={() => startQuiz(QuizMode.AI_CHAT)}
                            className="neumorph-btn py-3 rounded-xl text-purple-600 font-bold flex flex-col items-center justify-center hover:bg-purple-50"
                        >
                             <i className="fa-solid fa-robot mb-1"></i> AI Quiz
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Standard Quiz Mode
    if (mode === QuizMode.STANDARD) {
        const currentWord = filteredWords[currentQuestionIndex];
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="neumorph-flat w-full max-w-lg rounded-2xl p-8 relative min-h-[400px] flex flex-col">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><i className="fa-solid fa-times"></i></button>
                    
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <span className="text-sm font-bold text-slate-400 mb-2">Question {currentQuestionIndex + 1} / {filteredWords.length}</span>
                        
                        <h2 className="text-4xl font-black text-slate-800 mb-6">{currentWord.english}</h2>
                        
                        <button 
                             onClick={() => window.open(currentWord.pronunciationURL, '_blank')}
                             className="mb-8 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200"
                        >
                            <i className="fa-solid fa-volume-high"></i>
                        </button>

                        {showAnswer ? (
                            <div className="animate-fade-in space-y-2">
                                <p className="text-2xl font-bold text-indigo-600">{currentWord.meaning}</p>
                                <p className="text-slate-500 italic text-sm">{currentWord.partOfSpeech.join(', ')}</p>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setShowAnswer(true)}
                                className="neumorph-btn px-6 py-2 rounded-full text-indigo-600 font-bold"
                            >
                                Show Meaning
                            </button>
                        )}
                    </div>

                    <div className="mt-8 flex justify-between">
                        <button 
                            disabled={currentQuestionIndex === 0}
                            onClick={() => {
                                setCurrentQuestionIndex(p => p - 1);
                                setShowAnswer(false);
                            }}
                            className="px-4 py-2 text-slate-500 disabled:opacity-30"
                        >
                            <i className="fa-solid fa-chevron-left"></i> Prev
                        </button>
                        <button 
                            disabled={currentQuestionIndex === filteredWords.length - 1}
                            onClick={() => {
                                setCurrentQuestionIndex(p => p + 1);
                                setShowAnswer(false);
                            }}
                            className="px-4 py-2 text-indigo-600 font-bold disabled:opacity-30"
                        >
                            Next <i className="fa-solid fa-chevron-right ml-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // AI Chat Mode
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div className="bg-[#f0f4f8] w-full max-w-2xl h-[90vh] rounded-2xl flex flex-col relative shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-white/50 p-4 border-b border-gray-200 flex justify-between items-center backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold">
                        <i className="fa-solid fa-robot"></i>
                        <span>AI Tutor (Japanese Support)</span>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                {toastMsg && (
                    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg z-10 animate-fade-in">
                        {toastMsg}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white text-slate-700 shadow-sm rounded-bl-none'
                            }`}>
                                {msg.text.split('\n').map((line, j) => <p key={j}>{line}</p>)}
                                
                                {msg.role === 'model' && msg.isCorrect && correctWordId && i === messages.length - 1 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <p className="text-green-600 font-bold text-xs"><i className="fa-solid fa-star"></i> Correct!</p>
                                        <button 
                                            onClick={() => handleMasteryUpgrade(correctWordId)}
                                            disabled={upgrading}
                                            className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            {upgrading ? 'Saving...' : 'Upgrade to Mastered'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                    {loading && (
                         <div className="flex justify-start">
                             <div className="bg-white/50 rounded-2xl p-3 flex gap-2">
                                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                             </div>
                         </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-200">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Type request (e.g. 'Create TOEIC question')..."
                            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200 text-slate-700"
                            autoFocus
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={loading || !input.trim()}
                            className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};