import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { RelationSuggester } from './components/RelationSuggester';
import { Auth } from './components/Auth';
import { supabase } from './supabase';
import type { Folder } from './types';
import { api } from './api';
import { FolderPlus, Menu, ChevronLeft } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // フォルダ作成時の補助ステート
  const [isCreatingFirstFolder, setIsCreatingFirstFolder] = useState(false);
  const [firstFolderName, setFirstFolderName] = useState('');

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 1. フォルダ一覧の取得
  const loadFolders = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.getFolders();
      setFolders(data);
      
      // アクティブフォルダが未設定で、フォルダが存在する場合は先頭をアクティブにする
      if (data.length > 0 && !activeFolderId) {
        // ルートフォルダを優先的に探す
        const rootFolder = data.find(f => f.parent_id === null) || data[0];
        setActiveFolderId(rootFolder.id);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, [activeFolderId, session]);

  useEffect(() => {
    if (session) {
      loadFolders();
    } else {
      setFolders([]);
      setActiveFolderId(null);
    }
  }, [loadFolders, session]);

  // 2. フォルダ操作のハンドラー
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    try {
      const newFolder = await api.createFolder(name, parentId);
      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolder.id);
    } catch (err) {
      console.error('Failed to create folder:', err);
      alert('フォルダの作成に失敗しました。');
    }
  };

  const handleUpdateFolder = async (id: string, name: string) => {
    try {
      const updated = await api.updateFolder(id, name);
      setFolders(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('Failed to update folder:', err);
      alert('フォルダ名の変更に失敗しました。');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api.deleteFolder(id);
      setFolders(prev => prev.filter(f => f.id !== id));
      if (activeFolderId === id) {
        setActiveFolderId(null);
        setIsAIPanelOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete folder:', err);
      alert('フォルダの削除に失敗しました。');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // 3. AIパネルでのエッジ追加の検知
  const handleEdgeAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // アクティブなフォルダオブジェクトの取得
  const activeFolder = folders.find(f => f.id === activeFolderId);

  // 初回フォルダ作成
  const handleCreateFirstFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstFolderName.trim()) return;
    await handleCreateFolder(firstFolderName.trim(), null);
    setFirstFolderName('');
    setIsCreatingFirstFolder(false);
  };

  if (authLoading) {
    return (
      <div className="empty-state" style={{ height: '100vh', justifyContent: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>読み込み中...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      {/* サイドバー */}
      <Sidebar
        folders={folders}
        activeFolderId={activeFolderId}
        onSelectFolder={(id) => {
          setActiveFolderId(id);
          setIsAIPanelOpen(false); // フォルダ切り替え時にAIパネルは一旦閉じる
        }}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        userEmail={session.user?.email}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
      />

      {/* メインエリア */}
      <main 
        style={{ flex: 1, position: 'relative', height: '100%' }} 
        className={sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-open'}
      >
        {/* サイドバー開閉用フローティングボタン */}
        <button 
          className="sidebar-toggle-floating" 
          onClick={() => setSidebarCollapsed(prev => !prev)}
          title={sidebarCollapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
        >
          {sidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>

        {activeFolderId && activeFolder ? (
          <>
            <GraphCanvas
              folderId={activeFolderId}
              folderName={activeFolder.name}
              onOpenAIPanel={() => setIsAIPanelOpen(true)}
              refreshTrigger={refreshTrigger}
            />

            {/* AI提案パネル */}
            {isAIPanelOpen && (
              <RelationSuggester
                folderId={activeFolderId}
                onClose={() => setIsAIPanelOpen(false)}
                onEdgeAdded={handleEdgeAdded}
              />
            )}
          </>
        ) : (
          /* 空白表示（フォルダがない場合） */
          <div className="empty-state">
            <h2 className="empty-state-title">ナレッジグラフへようこそ</h2>
            <p className="empty-state-desc">
              このツールは、テキストをノードとして整理し、それらの関係性をネットワーク図で構築・可視化するためのパーソナルツールです。
              まずは、フォルダを作成してネットワークを開始しましょう。
            </p>
            
            {isCreatingFirstFolder ? (
              <form onSubmit={handleCreateFirstFolderSubmit} className="inline-form" style={{ width: '320px' }}>
                <input
                  type="text"
                  placeholder="最初のフォルダ名 (例: 小説の分析)"
                  className="inline-input"
                  value={firstFolderName}
                  onChange={e => setFirstFolderName(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn-primary">作成</button>
                <button type="button" className="btn-secondary" onClick={() => setIsCreatingFirstFolder(false)}>キャンセル</button>
              </form>
            ) : (
              <button className="btn-primary" onClick={() => setIsCreatingFirstFolder(true)}>
                <FolderPlus size={16} />
                最初のフォルダを作成する
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
