import React, { useState } from 'react';
import type { Folder as FolderType } from '../types';
import { 
  Folder as FolderIcon, 
  FolderPlus, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  Plus, 
  Check, 
  X, 
  Network
} from 'lucide-react';

interface SidebarProps {
  folders: FolderType[];
  activeFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onUpdateFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  userEmail?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  userEmail,
  onLogout,
}) => {
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [newSubFolderName, setNewSubFolderName] = useState('');

  // 階層構造の構築
  const buildFolderTree = (parentId: string | null): FolderType[] => {
    return folders.filter(f => f.parent_id === parentId);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim()) return;
    await onCreateFolder(newRootName.trim(), null);
    setNewRootName('');
    setIsAddingRoot(false);
  };

  const handleCreateSub = async (parentId: string) => {
    if (!newSubFolderName.trim()) return;
    await onCreateFolder(newSubFolderName.trim(), parentId);
    setNewSubFolderName('');
    setAddingParentId(null);
    setExpandedFolders(prev => ({ ...prev, [parentId]: true })); // 親を展開
  };

  const handleStartEdit = (folder: FolderType, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    await onUpdateFolder(id, editingName.trim());
    setEditingFolderId(null);
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`フォルダ「${name}」を削除しますか？\n※フォルダ内のすべてのサブフォルダ、ノード、エッジも削除されます。`)) {
      await onDeleteFolder(id);
    }
  };

  // 再帰的なフォルダツリーレンダラー
  const renderTree = (parentId: string | null) => {
    const currentLevelFolders = buildFolderTree(parentId);

    if (currentLevelFolders.length === 0 && parentId !== null && addingParentId !== parentId) {
      return null;
    }

    return (
      <ul className="folder-tree">
        {currentLevelFolders.map(folder => {
          const isExpanded = !!expandedFolders[folder.id];
          const isActive = folder.id === activeFolderId;
          const isEditing = folder.id === editingFolderId;
          const isAddingSub = folder.id === addingParentId;
          const children = buildFolderTree(folder.id);
          const hasChildren = children.length > 0;

          return (
            <li key={folder.id} className="folder-item-container">
              <div 
                className={`folder-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder.id)}
              >
                {/* 展開トグル */}
                <span 
                  className="folder-toggle" 
                  onClick={(e) => toggleExpand(folder.id, e)}
                  style={{ opacity: hasChildren ? 1 : 0.3 }}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>

                <FolderIcon className="folder-icon" size={16} />

                {isEditing ? (
                  <div className="inline-form" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      className="inline-input"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(folder.id)}
                      autoFocus
                    />
                    <button className="btn-icon-submit" onClick={() => handleSaveEdit(folder.id)}>
                      <Check size={14} />
                    </button>
                    <button className="btn-icon-cancel" onClick={() => setEditingFolderId(null)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="folder-name">{folder.name}</span>
                    <div className="folder-actions">
                      <button 
                        className="folder-action-btn" 
                        title="サブフォルダを追加"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingParentId(folder.id);
                        }}
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        className="folder-action-btn" 
                        title="名前を変更"
                        onClick={(e) => handleStartEdit(folder, e)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="folder-action-btn delete" 
                        title="削除"
                        onClick={(e) => handleDelete(folder.id, folder.name, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* サブフォルダ追加フォーム */}
              {isAddingSub && (
                <div className="inline-form" style={{ marginLeft: '24px' }}>
                  <input
                    type="text"
                    placeholder="新しいフォルダ名..."
                    className="inline-input"
                    value={newSubFolderName}
                    onChange={e => setNewSubFolderName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateSub(folder.id)}
                    autoFocus
                  />
                  <button className="btn-icon-submit" onClick={() => handleCreateSub(folder.id)}>
                    <Check size={14} />
                  </button>
                  <button className="btn-icon-cancel" onClick={() => setAddingParentId(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* 子階層のレンダリング */}
              {isExpanded && (
                <div className="folder-children">
                  {renderTree(folder.id)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">
          <Network size={22} style={{ color: 'var(--color-primary)' }} />
          <span>Knowledge Nodes</span>
        </h1>
      </div>

      <div className="sidebar-content">
        {isAddingRoot ? (
          <form onSubmit={handleCreateRoot} className="inline-form" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="新しいフォルダ名..."
              className="inline-input"
              value={newRootName}
              onChange={e => setNewRootName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-icon-submit">
              <Check size={14} />
            </button>
            <button 
              type="button" 
              className="btn-icon-cancel"
              onClick={() => setIsAddingRoot(false)}
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button 
            className="add-folder-btn"
            onClick={() => setIsAddingRoot(true)}
          >
            <FolderPlus size={16} />
            <span>新規フォルダを追加</span>
          </button>
        )}

        {folders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
            フォルダがありません。追加してください。
          </div>
        ) : (
          renderTree(null)
        )}
      </div>

      <div className="sidebar-user-section">
        {userEmail && (
          <div className="sidebar-user-info">
            <span className="user-email-text" title={userEmail}>{userEmail}</span>
            {onLogout && (
              <button className="sidebar-logout-btn" onClick={onLogout}>
                ログアウト
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        © 2026 Knowledge Graph Tool
      </div>
    </aside>
  );
};
