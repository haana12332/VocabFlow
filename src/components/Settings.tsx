import React, { useState, useEffect } from 'react';
import { updateUserProfile } from '../firebase';

interface SettingsModalProps {
  onClose: () => void;
  onLogout: () => void;
  userId: string; 
}

export const Settings: React.FC<SettingsModalProps> = ({ onClose, onLogout, userId }) => {
  // Local State for settings
  const [language, setLanguage] = useState('en');
  const [geminiKey, setGeminiKey] = useState('');
  // ▼ 追加: モデル選択用のState (デフォルトはFlash-live)
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  
  const [firebaseConfig, setFirebaseConfig] = useState('');
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') || 'en';
    const savedGemini = localStorage.getItem('gemini_api_key') || '';
    // ▼ 追加: 保存されたモデルを読み込む
    const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
    
    const savedFirebase = localStorage.getItem('custom_firebase_config') || '';
    
    setLanguage(savedLang);
    setGeminiKey(savedGemini);
    setGeminiModel(savedModel); // Stateにセット
    setFirebaseConfig(savedFirebase);
  }, []);

  const handleSave = async () => {
    try {
        if (!userId) {
            alert("User ID is missing. Please try logging in again.");
            return;
        }

        // 1. LocalStorageに保存 (即時反映のため)
        localStorage.setItem('app_language', language);
        localStorage.setItem('gemini_api_key', geminiKey);
        // ▼ 追加: 選択されたモデルを保存
        localStorage.setItem('gemini_model', geminiModel);
        
        localStorage.setItem('custom_firebase_config', firebaseConfig);

        // 2. Firestoreデータベースに保存 (永続化のため)
        await updateUserProfile(userId, {
            settings: {
                language: language,
                geminiKey: geminiKey,
                geminiModel: geminiModel, // ▼ DBにも保存
                // firebaseConfig: firebaseConfig // 必要ならコメントアウトを外して保存
            }
        });
        
        alert('Settings saved to your account!');
        onClose();
    } catch (error) {
        console.error("Error saving settings:", error);
        alert('Failed to save settings to database.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-200/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#f0f4f8] w-full max-w-lg rounded-[2rem] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#f0f4f8]/95 backdrop-blur px-8 py-6 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shadow-inner">
               <i className="fa-solid fa-gear"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-700">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full neumorph-flat flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8">
          
          {/* 1. General Settings (Language) */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">General</h3>
            <div className="neumorph-flat p-6 rounded-2xl">
              <label className="block text-sm font-bold text-slate-600 mb-2">Interface Language</label>
              <div className="relative">
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full neumorph-pressed rounded-xl py-3 px-4 outline-none text-slate-600 bg-transparent appearance-none cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="es">Spanish</option>
                  <option value="ko">Korean</option>
                </select>
                <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
              </div>
            </div>
          </section>

          {/* 2. AI Settings (Gemini) */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">AI Configuration</h3>
            <div className="neumorph-flat p-6 rounded-2xl flex flex-col gap-4">
              
              {/* API Key Input */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-robot text-indigo-500"></i>
                    <label className="text-sm font-bold text-slate-600">Gemini API Key</label>
                </div>
                <p className="text-xs text-slate-400 mb-3">Required for auto-generating word definitions and quizzes.</p>
                <input 
                    type="password" 
                    placeholder="Enter your Gemini API Key"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full neumorph-pressed rounded-xl py-3 px-4 outline-none text-slate-600 placeholder-slate-400 text-sm"
                />
              </div>

              {/* ▼ 追加: Model Selection Dropdown */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">AI Model</label>
                <div className="relative">
                    <select 
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        className="w-full neumorph-pressed rounded-xl py-3 px-4 outline-none text-slate-600 bg-transparent appearance-none cursor-pointer text-sm"
                    >
                        <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                        <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Faster/Cheaper)</option>
              
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 ml-1">
                    Select the model version to use for generation.
                </p>
              </div>

            </div>
          </section>

          {/* 3. Database Settings (Firebase) */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Database</h3>
            <div className="neumorph-flat p-6 rounded-2xl">
              <button 
                onClick={() => setShowFirebaseConfig(!showFirebaseConfig)}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-database text-orange-500"></i>
                  <label className="text-sm font-bold text-slate-600 cursor-pointer">Firebase Configuration</label>
                </div>
                <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${showFirebaseConfig ? 'rotate-180' : ''}`}></i>
              </button>
              
              {showFirebaseConfig && (
                <div className="mt-3 animate-fadeIn">
                  <p className="text-xs text-red-400 mb-2">
                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                    Advanced: Override default database connection.
                  </p>
                  <textarea 
                    rows={5}
                    placeholder='{"apiKey": "...", "projectId": "..."}'
                    value={firebaseConfig}
                    onChange={(e) => setFirebaseConfig(e.target.value)}
                    className="w-full neumorph-pressed rounded-xl py-3 px-4 outline-none text-slate-600 placeholder-slate-400 text-xs font-mono resize-y"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-2 mb-6">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 neumorph-btn py-3 rounded-xl font-bold text-indigo-600 hover:text-indigo-700 transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>

          <div className="h-px bg-slate-200 w-full"></div>

          {/* 4. Account (Logout) */}
          <section className="pb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Account</h3>
            <button 
              onClick={onLogout}
              className="w-full neumorph-flat p-4 rounded-2xl flex items-center justify-between group hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-700 group-hover:text-red-600">Sign Out</div>
                  <div className="text-xs text-slate-400">End your current session</div>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-red-300"></i>
            </button>
          </section>

        </div>
      </div>
    </div>
  );
};