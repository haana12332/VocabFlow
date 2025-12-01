import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore'; 
import { auth, db, saveUserToFirestore, updateUserProfile, validateAndSaveConfig } from '../firebase'; 

export const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 基本情報
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 新規登録用 設定項目
  const [language, setLanguage] = useState('ja');
  const [geminiKey, setGeminiKey] = useState('');
  
  // Firebase設定を個別のフィールドとして管理
  const [fbConfig, setFbConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  });
  
  const [showFirebaseInput, setShowFirebaseInput] = useState(false);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFbConfig(prev => ({ ...prev, [name]: value }));
  };

  // Firebase設定が入力されているかチェック (必須項目)
  const isConfigEntered = () => {
    return fbConfig.apiKey.trim() !== '' && fbConfig.projectId.trim() !== '';
  };

  // 設定オブジェクトをJSON文字列に変換
  const getConfigString = () => {
    return JSON.stringify(fbConfig);
  };

  // --- Email/Password Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 整形済みの設定データを格納する変数
      let validatedConfig: any = null;

      if (isRegistering) {
        // --- 新規登録フロー ---

        // ★ステップ0: Firebase設定の検証 (入力がある場合)
        if (isConfigEntered()) {
            const configStr = getConfigString();
            try {
                // 検証を実行し、成功したら整形済みのオブジェクトを受け取る
                validatedConfig = await validateAndSaveConfig(configStr);
            } catch (configError: any) {
                setError(`Firebase設定が無効です: ${configError.message}`);
                setLoading(false);
                return;
            }
        }
        
        // 1. Authenticationでユーザー作成
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user) {
            // 2. Firestoreにユーザー設定を保存
            // validatedConfig (整形済み) があればそれを保存
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                createdAt: Timestamp.now(),
                settings: {
                    language: language,
                    geminiKey: geminiKey,
                    ...(validatedConfig ? { firebaseConfig: JSON.stringify(validatedConfig) } : {})
                }
            });
            console.log("新規ユーザー設定を保存しました");

            // 3. 設定変更がある場合はリロードして適用
            if (isConfigEntered()) {
                alert("カスタムデータベース設定を保存しました。\n新しい接続先でアプリを再起動します。");
                window.location.reload();
                return;
            }
        }

      } else {
        // --- ログインフロー ---
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // 既存ユーザーの場合、データ枠がない場合だけ作成する（安全策）
        if (userCredential.user) {
            await saveUserToFirestore(userCredential.user);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に登録されています。');
      } else if (err.code === 'auth/wrong-password') {
        setError('パスワードが間違っています。');
      } else if (err.code === 'auth/weak-password') {
        setError('パスワードは6文字以上で設定してください。');
      } else if (err.code === 'auth/invalid-credential') {
        setError('メールアドレスまたはパスワードが正しくありません。');
      } else {
        setError('エラーが発生しました: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Google Login ---
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true); 
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const exists = userDocSnap.exists();

        if (!isRegistering && !exists) {
            await signOut(auth); 
            alert('アカウントが見つかりません。\n新規登録の場合は「Sign Up」モードに切り替えてから登録してください。');
            setLoading(false);
            return;
        }

        if (!exists) {
            await saveUserToFirestore(user);
        }

        if (isRegistering) {
            // 整形済みの設定データを格納する変数
            let validatedConfig: any = null;

            if (isConfigEntered()) {
                 const configStr = getConfigString();
                 try {
                     validatedConfig = await validateAndSaveConfig(configStr);
                     if (validatedConfig) {
                         // 設定をFirestoreにも保存 (JSON文字列として保存)
                         await updateUserProfile(user.uid, {
                            settings: { 
                                language, 
                                geminiKey, 
                                firebaseConfig: JSON.stringify(validatedConfig) 
                            }
                         });
                         alert("カスタム設定を保存しました。リロードします。");
                         window.location.reload();
                         return;
                     }
                 } catch (e) {
                     console.error("Config validation failed", e);
                 }
            }

            // 言語やAPIキーを保存 (Configがない場合)
            if (!validatedConfig) {
                await updateUserProfile(user.uid, {
                    settings: {
                        language: language,
                        geminiKey: geminiKey
                    }
                });
            }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('ログインがキャンセルされました。');
      } else if (err.message && err.message.includes('Cross-Origin-Opener-Policy')) {
        setError('ブラウザのセキュリティ設定によりブロックされました。ポップアップを許可するか、別タブで開いてください。');
      } else {
        setError('Googleログインに失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  // 入力フィールドのヘルパーコンポーネント
  const ConfigInput = ({ name, placeholder, value }: { name: string, placeholder: string, value: string }) => (
    <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={handleConfigChange}
        className="w-full bg-white rounded-xl py-2 px-3 outline-none text-slate-600 text-xs border border-slate-200 focus:border-indigo-400 placeholder-slate-400 transition-colors font-mono mb-2"
    />
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="neumorph-flat p-8 rounded-[2rem] bg-[#f0f4f8]">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="neumorph-flat w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
              <i className={`fa-solid ${isRegistering ? 'fa-user-plus' : 'fa-user-astronaut'} text-3xl`}></i>
            </div>
            <h2 className="text-2xl font-bold text-slate-700">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              {isRegistering ? 'API設定とアカウント登録' : 'ログインして学習を続ける'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-500 text-xs font-bold flex items-center gap-3 border border-red-100">
              <i className="fa-solid fa-triangle-exclamation text-base"></i>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {/* --- Extra Fields (Register Only) - 先に設定を見せる --- */}
            {isRegistering && (
              <div className="flex flex-col gap-5 animate-fadeIn mb-2">
                <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30">
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">
                        <i className="fa-solid fa-sliders mr-1"></i> API & Language Settings
                    </p>

                    {/* 1. Language Selection */}
                    <div className="relative group mb-3">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
                            <i className="fa-solid fa-language text-slate-400"></i>
                        </div>
                        <select 
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-white rounded-xl py-3 pl-10 pr-10 outline-none text-slate-700 text-sm border border-slate-200 focus:border-indigo-400 transition-colors cursor-pointer appearance-none"
                        >
                            <option value="ja">Japanese (日本語)</option>
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="ko">Korean</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                    </div>

                    {/* 2. Gemini API Key */}
                    <div className="relative group mb-3">
                        <i className="fa-solid fa-robot absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Gemini API Key"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            className="w-full bg-white rounded-xl py-3 pl-10 pr-4 outline-none text-slate-700 text-sm border border-slate-200 focus:border-indigo-400 placeholder-slate-400 transition-colors"
                        />
                    </div>

                    {/* 3. Firebase Config (Individual Fields) */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowFirebaseInput(!showFirebaseInput)}
                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 flex items-center gap-1 transition-colors mb-2"
                        >
                            <i className={`fa-solid fa-chevron-right transition-transform ${showFirebaseInput ? 'rotate-90' : ''}`}></i>
                            Custom Firebase Config (Advanced)
                        </button>
                        
                        {showFirebaseInput && (
                            <div className="pl-1 animate-fadeIn">
                                <ConfigInput name="apiKey" placeholder="apiKey (Required)" value={fbConfig.apiKey} />
                                <ConfigInput name="authDomain" placeholder="authDomain" value={fbConfig.authDomain} />
                                <ConfigInput name="projectId" placeholder="projectId (Required)" value={fbConfig.projectId} />
                                <ConfigInput name="storageBucket" placeholder="storageBucket" value={fbConfig.storageBucket} />
                                <ConfigInput name="messagingSenderId" placeholder="messagingSenderId" value={fbConfig.messagingSenderId} />
                                <ConfigInput name="appId" placeholder="appId" value={fbConfig.appId} />
                                <ConfigInput name="measurementId" placeholder="measurementId" value={fbConfig.measurementId} />
                            </div>
                        )}
                    </div>
                </div>
              </div>
            )}

            {/* --- Basic Info --- */}
            <div className="relative group">
              <i className="fa-solid fa-envelope absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full neumorph-pressed rounded-2xl py-3.5 pl-12 pr-6 outline-none text-slate-700 placeholder-slate-400 transition-all focus:ring-2 focus:ring-indigo-100 shadow-inner bg-[#f0f4f8]"
              />
            </div>

            <div className="relative group">
              <i className="fa-solid fa-lock absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full neumorph-pressed rounded-2xl py-3.5 pl-12 pr-6 outline-none text-slate-700 placeholder-slate-400 transition-all focus:ring-2 focus:ring-indigo-100 shadow-inner bg-[#f0f4f8]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neumorph-btn w-full h-12 rounded-2xl text-indigo-600 font-bold flex items-center justify-center gap-2 mt-2 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50"
            >
              {loading ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <i className={`fa-solid ${isRegistering ? 'fa-check' : 'fa-right-to-bracket'}`}></i>
                  <span>{isRegistering ? 'Save Settings & Sign Up' : 'Login'}</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs text-slate-400 font-bold uppercase">Or</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            type="button" 
            disabled={loading}
            className="neumorph-btn w-full h-12 rounded-2xl text-slate-600 font-bold flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50"
          >
            <i className="fa-brands fa-google text-red-500"></i>
            <span>Continue with Google</span>
          </button>

          {/* Toggle Mode */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
              }}
              className="text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors"
            >
              {isRegistering 
                ? 'Already have an account? Login' 
                : "Don't have an account? Sign Up"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};