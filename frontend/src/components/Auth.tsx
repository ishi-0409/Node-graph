import React, { useState } from 'react';
import { supabase } from '../supabase';
import './Auth.css';

export const Auth: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setError(null);
    setLoading(true);
    try {
      const { error: socialError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // ログイン完了後に元のアプリ画面に戻る
          redirectTo: window.location.origin,
        }
      });
      if (socialError) throw socialError;
    } catch (err: any) {
      setError(err.message || `${provider}でのログインに失敗しました`);
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Node Graph</h1>
        <p className="auth-subtitle">関係性を整理するネットワーク図ツール</p>

        <div className="auth-instruction">
          ご利用にはアカウントでのサインインが必要です。以下からログイン方法を選択してください。
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="social-buttons" style={{ marginTop: '16px' }}>
          <button onClick={() => handleSocialLogin('google')} className="social-button google" disabled={loading}>
            <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69c-.29 1.5-.1.85-.29 1.57-.6 1.6-1.57 2.96-2.9 3.86l3.3 2.56c1.96-1.8 3.09-4.46 3.09-7.56z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.3-2.56c-.92.62-2.1 1-3.63 1-2.8 0-5.17-1.89-6.02-4.44H.65v2.78C2.63 21.88 7 24 12 24z" />
              <path fill="#FBBC05" d="M5.98 15.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V8.13H.65C-.13 9.7.13 11.24.13 13s.13 3.3.78 4.87l5.07-2.78z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7 0 2.63 2.12.65 4.87l5.33 4.12C6.83 6.64 9.2 4.75 12 4.75z" />
            </svg>
            Google でサインイン
          </button>
          <button onClick={() => handleSocialLogin('github')} className="social-button github" disabled={loading}>
            <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub でサインイン
          </button>
        </div>

        {loading && (
          <div className="auth-loading-text">
            認証画面へリダイレクト中...
          </div>
        )}
      </div>
    </div>
  );
};
