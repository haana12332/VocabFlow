import React, { useState, useEffect, useRef } from 'react';
import { QuizMode, WordDocument, ChatMessage, WordStatus } from '../types';
import { createQuizChat } from '../services/geminiService';
import { updateWordStatus } from '../firebase';

interface QuizModalProps {
    words: WordDocument[];
    onClose: () => void;
    // 親コンポーネント(App.tsx)のhandleWordUpdatedに合わせる
    onUpdate?: (updatedWord: WordDocument) => void; 
}

interface QuizConfig {
    numQuestions: number;
    toeicLevel: string;
    partOfSpeech: string;
    category: string;
    status: string;
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
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
    const [upgradingStatus, setUpgradingStatus] = useState<{ [key: string]: boolean }>({});

    // Helpers for Select Options
    const categories = Array.from(new Set(words.map(w => w.category))).sort();
    const partsOfSpeech = Array.from(new Set(words.flatMap(w => w.partOfSpeech))).sort();
    
    const startQuiz = (selectedMode: QuizMode) => {
        // Filter Words
        let filtered = words.filter(w => {
            if (config.status !== 'All' && w.status !== config.status) return false;
            if (config.category !== 'All' && w.category !== config.category) return false;
            if (config.partOfSpeech !== 'All' && !w.partOfSpeech.includes(config.partOfSpeech)) return false;
            if (config.toeicLevel !== 'All') {
                 const level = parseInt(config.toeicLevel);
                 if ((w.toeicLevel || 0) < level) return false;
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
            // ★修正: createQuizChat は同期的のため、.then() ではなく try-catch で処理
            try {
                const chat = createQuizChat(filtered);
                setChatSession(chat);
                setMessages([{ 
                    role: 'model', 
                    text: "Hello! I am ready to quiz you. What kind of quiz would you like? (e.g., 'TOEIC 800 grammar' or 'Vocabulary check')" 
                }]);
            } catch (e: any) { // ★修正: e に型注釈を追加
                console.error("Failed to start chat", e);
                alert("Failed to connect to AI service. Please check your API key.");
                setMode(QuizMode.CONFIG);
            }
        }
    };

    // Chat Functions
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ★共通ヘルパー関数: ステータス更新と親コンポーネントへの通知を行う
    const updateStatusAndNotify = async (word: WordDocument, newStatus: WordStatus) => {
        try {
            await updateWordStatus(word.id, newStatus);
            
            // ローカルのクイズ用リストを更新
            setFilteredWords(prev => prev.map(w => w.id === word.id ? { ...w, status: newStatus } : w));
            
            // ★重要: 更新後のオブジェクトを作成して親(App.tsx)に渡す
            if (onUpdate) {
                onUpdate({ ...word, status: newStatus });
            }
        } catch (e) {
            console.error("Status update failed", e);
            throw e;
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || !chatSession) return;
        
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);
        setCorrectWordId(null);

        try {
            setMessages(prev => [...prev, { role: 'model', text: "" }]);

            const result = await chatSession.sendMessageStream(userMsg);
            
            let fullText = "";
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                        role: 'model',
                        text: fullText
                    };
                    return newMessages;
                });
            }

            // --- 判定ロジック ---
            let isCorrect = false;
            const match = fullText.match(/\[(.*?)\]/);
            const foundWord = match && match[1] 
                ? words.find(w => w.english.toLowerCase() === match[1].toLowerCase()) 
                : null;

            if (fullText.includes('【正解】')) {
                isCorrect = true;
                if (foundWord) setCorrectWordId(foundWord.id);
            } else if (fullText.includes('【不正解】')) {
                if (foundWord && foundWord.status === 'Mastered') {
                    // 自動ダウングレード処理
                    await updateStatusAndNotify(foundWord, 'Training');
                    setToastMsg(`Oops! '${foundWord.english}' downgraded to Training.`);
                    setTimeout(() => setToastMsg(null), 3000);
                }
            }

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
        const word = words.find(w => w.id === wordId);
        if (!word) return;

        setUpgrading(true);
        try {
            await updateStatusAndNotify(word, 'Mastered');
            alert("Success! Word status updated to Mastered.");
            setCorrectWordId(null);
        } catch (e) {
            alert("Failed to update status.");
        } finally {
            setUpgrading(false);
        }
    };

    const handleStatusChange = async (wordId: string, newStatus: WordStatus) => {
        const word = words.find(w => w.id === wordId);
        if (!word) return;

        setUpgradingStatus(prev => ({ ...prev, [wordId]: true }));
        try {
            await updateStatusAndNotify(word, newStatus);
            setToastMsg(`Word status updated to ${newStatus}.`);
            setTimeout(() => setToastMsg(null), 3000);
        } catch (e) {
            alert("Failed to update status.");
        } finally {
            setUpgradingStatus(prev => ({ ...prev, [wordId]: false }));
        }
    };

    // Configuration Screen
    if (mode === QuizMode.CONFIG) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="neumorph-flat w-full max-w-lg rounded-2xl p-8 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                        <i className="fa-solid fa-times"></i>
                    </button>
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
                            className="neumorph-btn py-3 rounded-xl text-indigo-600 font-bold flex flex-col items-center justify-center hover:bg-indigo-50 transition-colors"
                        >
                             <i className="fa-solid fa-layer-group mb-1"></i> Standard Quiz
                        </button>
                        <button 
                            onClick={() => startQuiz(QuizMode.AI_CHAT)}
                            className="neumorph-btn py-3 rounded-xl text-purple-600 font-bold flex flex-col items-center justify-center hover:bg-purple-50 transition-colors"
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
        const currentAnswer = userAnswers[currentQuestionIndex] || '';
        
        return (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="neumorph-flat w-full max-w-lg rounded-2xl p-8 relative min-h-[500px] flex flex-col">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                        <i className="fa-solid fa-times"></i>
                    </button>
                    
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                        <span className="text-sm font-bold text-slate-400 mb-2">
                            Question {currentQuestionIndex + 1} / {filteredWords.length}
                        </span>
                        
                        <h2 className="text-4xl font-black text-slate-800 mb-2">{currentWord.english}</h2>
                        
                        <button 
                            onClick={() => window.open(currentWord.pronunciationURL, '_blank')}
                            className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                        >
                            <i className="fa-solid fa-volume-high"></i>
                        </button>

                        {/* 入力フォーム */}
                        {!showAnswer ? (
                            <div className="w-full max-w-md space-y-4">
                                <input 
                                    type="text" 
                                    value={currentAnswer}
                                    onChange={(e) => setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: e.target.value }))}
                                    placeholder="Enter the meaning..."
                                    className="w-full neumorph-pressed rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 text-center text-lg placeholder-slate-400"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && currentAnswer.trim()) {
                                            setShowAnswer(true);
                                        }
                                    }}
                                    autoFocus
                                />
                                <button 
                                    onClick={() => setShowAnswer(true)}
                                    disabled={!currentAnswer.trim()}
                                    className="neumorph-btn px-8 py-3 rounded-full text-indigo-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-50 transition-colors"
                                >
                                    Check Answer
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-md space-y-4 animate-fade-in">
                                {/* ユーザーの回答と正解の比較 */}
                                <div className="space-y-3">
                                    <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                                        <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Your Answer</p>
                                        <p className="text-lg font-bold text-slate-700">
                                            {currentAnswer || '(No answer)'}
                                        </p>
                                    </div>
                                    
                                    <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                                        <p className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider">Correct Answer</p>
                                        <p className="text-lg font-bold text-indigo-600">{currentWord.meaning}</p>
                                    </div>
                                </div>

                                {/* 追加情報 */}
                                <div className="text-slate-500 text-sm">
                                    <p className="italic">{currentWord.partOfSpeech.join(', ')}</p>
                                </div>

                                {/* 習熟度変更ボタン */}
                                <div className="flex flex-col gap-2">
                                    {currentWord.status === 'Beginner' && (
                                        <button 
                                            onClick={() => handleStatusChange(currentWord.id, 'Training')}
                                            disabled={upgradingStatus[currentWord.id]}
                                            className="w-full neumorph-btn px-6 py-3 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {upgradingStatus[currentWord.id] ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-up"></i>}
                                            <span>Upgrade to Training</span>
                                        </button>
                                    )}

                                    {currentWord.status === 'Training' && (
                                        <button 
                                            onClick={() => handleStatusChange(currentWord.id, 'Beginner')}
                                            disabled={upgradingStatus[currentWord.id]}
                                            className="w-full neumorph-btn px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {upgradingStatus[currentWord.id] ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-down"></i>}
                                            <span>Downgrade to Beginner</span>
                                        </button>
                                    )}

                                    {currentWord.status === 'Mastered' && (
                                        <button 
                                            onClick={() => handleStatusChange(currentWord.id, 'Training')}
                                            disabled={upgradingStatus[currentWord.id]}
                                            className="w-full neumorph-btn px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {upgradingStatus[currentWord.id] ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-down"></i>}
                                            <span>Downgrade to Training</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-between items-center">
                        <button 
                            disabled={currentQuestionIndex === 0}
                            onClick={() => {
                                setCurrentQuestionIndex(p => p - 1);
                                setShowAnswer(false);
                            }}
                            className="px-4 py-2 text-slate-500 disabled:opacity-30 hover:text-slate-700 transition-colors flex items-center gap-2"
                        >
                            <i className="fa-solid fa-chevron-left"></i> Prev
                        </button>
                        
                        <button 
                            onClick={() => {
                                setShowAnswer(false);
                                setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: '' }));
                            }}
                            className="px-4 py-2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                        >
                            <i className="fa-solid fa-redo mr-1"></i> Try Again
                        </button>
                        
                        <button 
                            disabled={currentQuestionIndex === filteredWords.length - 1}
                            onClick={() => {
                                setCurrentQuestionIndex(p => p + 1);
                                setShowAnswer(false);
                            }}
                            className="px-4 py-2 text-indigo-600 font-bold disabled:opacity-30 hover:text-indigo-700 transition-colors flex items-center gap-2"
                        >
                            Next <i className="fa-solid fa-chevron-right"></i>
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
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
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